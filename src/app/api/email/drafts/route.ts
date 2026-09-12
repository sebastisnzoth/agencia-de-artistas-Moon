import { MessageDirection, MessageStatus } from "@prisma/client";
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
            select: { id: true },
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
    if (input.threadId && !existingThread) {
      return NextResponse.json({ error: "Email thread not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const thread = existingThread
        ? await tx.emailThread.findUniqueOrThrow({ where: { id: existingThread.id } })
        : await tx.emailThread.create({
            data: {
              workspaceId: ctx.workspaceId,
              opportunityId: input.opportunityId,
              contactId: input.contactId,
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

      await tx.emailThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date(), subject: input.subject },
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
            opportunityId: input.opportunityId,
            contactId: input.contactId,
          },
        },
      });

      return { thread, message };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
