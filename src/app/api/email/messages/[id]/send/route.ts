import { AutonomyLevel, MessageDirection, MessageStatus, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { GmailConnector } from "@/lib/connectors/gmail";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    await requireToolPermission({
      workspaceId: ctx.workspaceId,
      toolName: "email.send",
      requestedLevel: AutonomyLevel.A1,
      requiredScope: "send",
    });

    const { id } = await params;
    const message = await db.emailMessage.findFirst({
      where: { id, thread: { workspaceId: ctx.workspaceId } },
      include: {
        thread: {
          include: { opportunity: { select: { id: true, artistId: true, title: true } } },
        },
      },
    });

    if (!message) return NextResponse.json({ error: "Email message not found" }, { status: 404 });
    if (message.direction !== MessageDirection.OUTBOUND) {
      return NextResponse.json({ error: "Only outbound messages can be sent" }, { status: 409 });
    }
    if (message.status !== MessageStatus.QUEUED) {
      return NextResponse.json(
        { error: `Email must be QUEUED, current status is ${message.status}` },
        { status: 409 },
      );
    }

    const connector = new GmailConnector(ctx.workspaceId);
    const draft = await connector.createDraft({
      to: message.toAddresses.map((address) => ({ address })),
      subject: message.subject ?? "",
      bodyText: message.bodyText ?? "",
      ...(message.thread.provider === "gmail"
        ? { replyToExternalMessageId: message.thread.externalId }
        : {}),
    });
    const sent = await connector.sendDraft(draft.externalMessageId);

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.emailMessage.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.SENT,
          externalId: sent.externalMessageId ?? draft.externalMessageId,
          sentAt: sent.sentAt,
        },
      });

      await tx.emailThread.update({
        where: { id: message.thread.id },
        data: {
          provider: "gmail",
          externalId: sent.threadExternalId ?? draft.threadExternalId,
          lastMessageAt: sent.sentAt,
        },
      });

      let followUpTaskId: string | null = null;
      if (message.thread.opportunity) {
        const opportunity = message.thread.opportunity;
        const existingTask = await tx.task.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            opportunityId: opportunity.id,
            status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
            title: { startsWith: "Follow up email" },
          },
        });
        if (existingTask) {
          followUpTaskId = existingTask.id;
        } else {
          const dueAt = new Date(sent.sentAt);
          dueAt.setUTCDate(dueAt.getUTCDate() + 3);
          const task = await tx.task.create({
            data: {
              workspaceId: ctx.workspaceId,
              artistId: opportunity.artistId,
              opportunityId: opportunity.id,
              title: `Follow up email · ${opportunity.title}`,
              notes: `Automatic follow-up after Gmail send ${message.id}`,
              dueAt,
            },
          });
          followUpTaskId = task.id;
        }
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "SYSTEM",
          action: "gmail.sent",
          entityType: "EmailMessage",
          entityId: updated.id,
          metadata: {
            gmailMessageId: updated.externalId,
            gmailThreadId: sent.threadExternalId ?? draft.threadExternalId,
            followUpTaskId,
          },
        },
      });

      return { message: updated, followUpTaskId };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return apiError(error);
  }
}
