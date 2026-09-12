import {
  AutonomyLevel,
  MessageDirection,
  MessageStatus,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

const deliverySchema = z.object({
  status: z.enum([MessageStatus.SENT, MessageStatus.FAILED]),
  externalId: z.string().trim().min(1).max(500).optional(),
  sentAt: z.coerce.date().optional(),
  error: z.string().trim().max(2000).optional(),
  followUpDays: z.number().int().min(1).max(30).default(3),
});

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
    const input = deliverySchema.parse(await request.json());

    const message = await db.emailMessage.findFirst({
      where: {
        id,
        thread: { workspaceId: ctx.workspaceId },
      },
      include: {
        thread: {
          include: {
            opportunity: { select: { id: true, artistId: true, title: true } },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Email message not found" }, { status: 404 });
    }

    if (message.direction !== MessageDirection.OUTBOUND) {
      return NextResponse.json({ error: "Only outbound email has delivery state" }, { status: 409 });
    }

    if (message.status !== MessageStatus.QUEUED) {
      return NextResponse.json(
        { error: `Email must be QUEUED, current status is ${message.status}` },
        { status: 409 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.emailMessage.update({
        where: { id: message.id },
        data: {
          status: input.status,
          externalId: input.externalId ?? message.externalId,
          sentAt:
            input.status === MessageStatus.SENT
              ? input.sentAt ?? new Date()
              : message.sentAt,
        },
      });

      let followUpTaskId: string | null = null;

      if (input.status === MessageStatus.SENT && message.thread.opportunity) {
        const opportunity = message.thread.opportunity;
        const existingTask = await tx.task.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            opportunityId: opportunity.id,
            status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
            title: { startsWith: "Follow up email" },
          },
        });

        if (!existingTask) {
          const dueAt = new Date();
          dueAt.setUTCDate(dueAt.getUTCDate() + input.followUpDays);

          const task = await tx.task.create({
            data: {
              workspaceId: ctx.workspaceId,
              artistId: opportunity.artistId,
              opportunityId: opportunity.id,
              title: `Follow up email · ${opportunity.title}`,
              notes: `Automatic follow-up after outbound message ${message.id}`,
              dueAt,
            },
          });
          followUpTaskId = task.id;
        } else {
          followUpTaskId = existingTask.id;
        }
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "SYSTEM",
          action:
            input.status === MessageStatus.SENT
              ? "email.sent"
              : "email.delivery_failed",
          entityType: "EmailMessage",
          entityId: message.id,
          metadata: {
            externalId: input.externalId,
            error: input.error,
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
