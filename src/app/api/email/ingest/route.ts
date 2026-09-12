import {
  AutonomyLevel,
  MessageDirection,
  MessageStatus,
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
            select: { id: true },
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

    const result = await db.$transaction(async (tx) => {
      const thread = await tx.emailThread.upsert({
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
          lastMessageAt: input.receivedAt ?? new Date(),
        },
        create: {
          workspaceId: ctx.workspaceId,
          opportunityId: input.opportunityId,
          contactId: input.contactId,
          provider: input.provider,
          externalId: input.threadExternalId,
          subject: input.subject,
          lastMessageAt: input.receivedAt ?? new Date(),
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
        return { thread, message: existing, duplicate: true };
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
          receivedAt: input.receivedAt ?? new Date(),
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
            opportunityId: input.opportunityId,
            contactId: input.contactId,
          },
        },
      });

      return { thread, message, duplicate: false };
    });

    return NextResponse.json({ data: result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
