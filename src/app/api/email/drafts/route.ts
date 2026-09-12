import {
  ConversationStatus,
  MessageDirection,
  MessageStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createDraftSchema = z.object({
  opportunityId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
  provider: z.string().trim().min(2).max(80).default("local"),
  toAddresses: z.array(z.string().email()).min(1).max(20),
  subject: z.string().trim().min(1).max(300),
  bodyText: z.string().trim().min(1).max(30000),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createDraftSchema.parse(await request.json());

    const [opportunity, contact, existingThread] = await Promise.all([
      input.opportunityId
        ? db.opportunity.findFirst({
            where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
            select: { id: true, artistId: true, contactId: true },
          })
        : Promise.resolve(null),
      input.contactId
        ? db.contact.findFirst({
            where: { id: input.contactId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.threadId
        ? db.emailThread.findFirst({
            where: { id: input.threadId, workspaceId: ctx.workspaceId },
            select: { id: true, conversationId: true, opportunityId: true, contactId: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.opportunityId && !opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    if (input.contactId && !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (input.threadId && !existingThread) {
      return NextResponse.json({ error: "Email thread not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      let conversationId = existingThread?.conversationId ?? undefined;

      if (!conversationId && opportunity) {
        const effectiveContactId = input.contactId ?? opportunity.contactId ?? undefined;
        const conversation = await tx.conversation.create({
          data: {
            workspaceId: ctx.workspaceId,
            artistId: opportunity.artistId,
            opportunityId: opportunity.id,
            contactId: effectiveContactId,
            channel: "email",
            subject: input.subject,
            status: ConversationStatus.OPEN,
            lastMessageAt: new Date(),
          },
        });
        conversationId = conversation.id;
      }

      const thread = existingThread
        ? await tx.emailThread.update({
            where: { id: existingThread.id },
            data: {
              conversationId,
              opportunityId: input.opportunityId ?? existingThread.opportunityId,
              contactId: input.contactId ?? existingThread.contactId,
              subject: input.subject,
              lastMessageAt: new Date(),
            },
          })
        : await tx.emailThread.create({
            data: {
              workspaceId: ctx.workspaceId,
              opportunityId: input.opportunityId,
              contactId: input.contactId,
              conversationId,
              provider: input.provider,
              externalId: `draft-${crypto.randomUUID()}`,
              subject: input.subject,
              lastMessageAt: new Date(),
            },
          });

      const message = await tx.emailMessage.create({
        data: {
          threadId: thread.id,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.DRAFT,
          toAddresses: input.toAddresses,
          subject: input.subject,
          bodyText: input.bodyText,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "email.draft_created",
          entityType: "EmailMessage",
          entityId: message.id,
          metadata: {
            threadId: thread.id,
            conversationId,
            opportunityId: input.opportunityId,
            contactId: input.contactId,
          },
        },
      });

      return { thread, message, conversationId };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
