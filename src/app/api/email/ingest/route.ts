import {
  AutonomyLevel,
  ConversationStatus,
  LeadStatus,
  MessageDirection,
  MessageStatus,
  OpportunityStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

const ingestSchema = z.object({
  provider: z.string().trim().min(2).max(80),
  threadExternalId: z.string().trim().min(1).max(500),
  messageExternalId: z.string().trim().min(1).max(500),
  opportunityId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  fromAddress: z.string().email(),
  toAddresses: z.array(z.string().email()).min(1).max(50),
  subject: z.string().trim().max(300).optional(),
  bodyText: z.string().max(100000).optional(),
  receivedAt: z.coerce.date().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    await requireToolPermission({
      workspaceId: ctx.workspaceId,
      toolName: "email.ingest",
      requestedLevel: AutonomyLevel.A0,
      requiredScope: "read",
    });

    const input = ingestSchema.parse(await request.json());

    const [opportunity, contact] = await Promise.all([
      input.opportunityId
        ? db.opportunity.findFirst({
            where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
            select: { id: true, artistId: true, status: true, contactId: true },
          })
        : Promise.resolve(null),
      input.contactId
        ? db.contact.findFirst({
            where: { id: input.contactId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.opportunityId && !opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (input.contactId && !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const receivedAt = input.receivedAt ?? new Date();

    const result = await db.$transaction(async (tx) => {
      let thread = await tx.emailThread.upsert({
        where: {
          workspaceId_provider_externalId: {
            workspaceId: ctx.workspaceId,
            provider: input.provider,
            externalId: input.threadExternalId,
          },
        },
        update: {
          opportunityId: input.opportunityId,
          contactId: input.contactId,
          subject: input.subject,
          lastMessageAt: receivedAt,
        },
        create: {
          workspaceId: ctx.workspaceId,
          opportunityId: input.opportunityId,
          contactId: input.contactId,
          provider: input.provider,
          externalId: input.threadExternalId,
          subject: input.subject,
          lastMessageAt: receivedAt,
        },
      });

      const existing = await tx.emailMessage.findUnique({
        where: {
          threadId_externalId: {
            threadId: thread.id,
            externalId: input.messageExternalId,
          },
        },
      });

      if (existing) {
        return {
          thread,
          message: existing,
          conversationId: thread.conversationId ?? undefined,
          duplicate: true,
        };
      }

      let conversationId = thread.conversationId ?? undefined;

      if (opportunity) {
        const effectiveContactId = input.contactId ?? opportunity.contactId ?? undefined;
        const existingConversation = conversationId
          ? await tx.conversation.findUnique({ where: { id: conversationId } })
          : await tx.conversation.findFirst({
              where: {
                workspaceId: ctx.workspaceId,
                opportunityId: opportunity.id,
                channel: "email",
                ...(effectiveContactId ? { contactId: effectiveContactId } : {}),
                status: { not: ConversationStatus.CLOSED },
              },
              orderBy: { updatedAt: "desc" },
            });

        const conversation = existingConversation
          ? await tx.conversation.update({
              where: { id: existingConversation.id },
              data: {
                status: ConversationStatus.REPLIED,
                subject: input.subject ?? existingConversation.subject,
                lastMessageAt: receivedAt,
                contactId: effectiveContactId ?? existingConversation.contactId,
              },
            })
          : await tx.conversation.create({
              data: {
                workspaceId: ctx.workspaceId,
                artistId: opportunity.artistId,
                opportunityId: opportunity.id,
                contactId: effectiveContactId,
                channel: "email",
                subject: input.subject,
                status: ConversationStatus.REPLIED,
                lastMessageAt: receivedAt,
              },
            });

        conversationId = conversation.id;

        thread = await tx.emailThread.update({
          where: { id: thread.id },
          data: { conversationId },
        });

        await tx.opportunity.update({
          where: { id: opportunity.id },
          data: {
            status:
              opportunity.status === OpportunityStatus.NEW || opportunity.status === OpportunityStatus.QUALIFIED
                ? OpportunityStatus.CONTACTED
                : opportunity.status,
            nextAction: "Review inbound reply and prepare next commercial action",
          },
        });

        await tx.lead.updateMany({
          where: { workspaceId: ctx.workspaceId, opportunityId: opportunity.id },
          data: { status: LeadStatus.CONTACTED, nextAction: "Review inbound reply" },
        });
      }

      const message = await tx.emailMessage.create({
        data: {
          threadId: thread.id,
          externalId: input.messageExternalId,
          direction: MessageDirection.INBOUND,
          status: MessageStatus.RECEIVED,
          fromAddress: input.fromAddress,
          toAddresses: input.toAddresses,
          subject: input.subject,
          bodyText: input.bodyText,
          receivedAt,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "SYSTEM",
          action: "email.received",
          entityType: "EmailMessage",
          entityId: message.id,
          metadata: {
            provider: input.provider,
            threadId: thread.id,
            conversationId,
            opportunityId: input.opportunityId,
            contactId: input.contactId,
          },
        },
      });

      return { thread, message, conversationId, duplicate: false };
    });

    return NextResponse.json({ data: result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
