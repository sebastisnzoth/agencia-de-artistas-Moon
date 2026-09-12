import {
  AutonomyLevel,
  MessageDirection,
  MessageStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { evaluateToolPermission, ToolPermissionError } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

const queueSchema = z.object({
  requestedLevel: z.nativeEnum(AutonomyLevel).default(AutonomyLevel.A1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = queueSchema.parse(await request.json().catch(() => ({})));

    const message = await db.emailMessage.findFirst({
      where: {
        id,
        thread: { workspaceId: ctx.workspaceId },
      },
      include: {
        thread: {
          select: {
            id: true,
            opportunityId: true,
            contactId: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Email message not found" }, { status: 404 });
    }

    if (message.direction !== MessageDirection.OUTBOUND) {
      return NextResponse.json({ error: "Only outbound email can be queued" }, { status: 409 });
    }

    if (message.status !== MessageStatus.DRAFT) {
      return NextResponse.json(
        { error: `Email must be DRAFT, current status is ${message.status}` },
        { status: 409 },
      );
    }

    const decision = await evaluateToolPermission({
      workspaceId: ctx.workspaceId,
      toolName: "email.send",
      requestedLevel: input.requestedLevel,
      requiredScope: "send",
    });

    if (!decision.allowed && !decision.requiresApproval) {
      throw new ToolPermissionError(
        `email.send cannot execute at ${input.requestedLevel}`,
      );
    }

    if (decision.requiresApproval) {
      const approval = await db.$transaction(async (tx) => {
        const existing = await tx.approval.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            actionType: "email.send",
            status: "PENDING",
            payload: {
              path: ["messageId"],
              equals: message.id,
            },
          },
        });

        if (existing) return existing;

        const created = await tx.approval.create({
          data: {
            workspaceId: ctx.workspaceId,
            opportunityId: message.thread.opportunityId,
            actionType: "email.send",
            summary: `Approve sending email: ${message.subject ?? "(no subject)"}`,
            payload: {
              messageId: message.id,
              requestedLevel: input.requestedLevel,
              toAddresses: message.toAddresses,
              subject: message.subject,
            },
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            actorType: "USER",
            actorId: ctx.userId,
            action: "email.send_approval_requested",
            entityType: "EmailMessage",
            entityId: message.id,
            metadata: { approvalId: created.id },
          },
        });

        return created;
      });

      return NextResponse.json(
        { data: { status: "APPROVAL_REQUIRED", approvalId: approval.id } },
        { status: 202 },
      );
    }

    const queued = await db.$transaction(async (tx) => {
      const updated = await tx.emailMessage.update({
        where: { id: message.id },
        data: { status: MessageStatus.QUEUED },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "email.queued",
          entityType: "EmailMessage",
          entityId: updated.id,
          metadata: {
            autonomyLevel: input.requestedLevel,
            threadId: message.thread.id,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: queued });
  } catch (error) {
    return apiError(error);
  }
}
