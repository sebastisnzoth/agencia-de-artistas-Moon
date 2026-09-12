import {
  ApprovalStatus,
  MessageStatus,
  ProposalStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const resolveSchema = z.object({
  status: z.union([
    z.literal(ApprovalStatus.APPROVED),
    z.literal(ApprovalStatus.REJECTED),
  ]),
});

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = resolveSchema.parse(await request.json());

    const current = await db.approval.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    if (current.status !== ApprovalStatus.PENDING) {
      return NextResponse.json(
        { error: `Approval already resolved as ${current.status}` },
        { status: 409 },
      );
    }

    const resolved = await db.$transaction(async (tx) => {
      const approval = await tx.approval.update({
        where: { id: current.id },
        data: {
          status: input.status,
          resolvedAt: new Date(),
        },
      });

      if (approval.proposalId) {
        await tx.proposal.update({
          where: { id: approval.proposalId },
          data: {
            status:
              input.status === ApprovalStatus.APPROVED
                ? ProposalStatus.APPROVED
                : ProposalStatus.DRAFT,
          },
        });
      }

      if (
        approval.actionType === "email.send" &&
        input.status === ApprovalStatus.APPROVED
      ) {
        const messageId = getPayloadString(approval.payload, "messageId");

        if (!messageId) {
          throw new Error("Approved email.send action is missing messageId");
        }

        const message = await tx.emailMessage.findFirst({
          where: {
            id: messageId,
            thread: { workspaceId: ctx.workspaceId },
          },
        });

        if (!message) {
          throw new Error("Approved email message no longer exists");
        }

        if (message.status !== MessageStatus.DRAFT) {
          throw new Error(
            `Approved email cannot be queued from status ${message.status}`,
          );
        }

        await tx.emailMessage.update({
          where: { id: message.id },
          data: { status: MessageStatus.QUEUED },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            actorType: "USER",
            actorId: ctx.userId,
            action: "email.queued_after_approval",
            entityType: "EmailMessage",
            entityId: message.id,
            metadata: { approvalId: approval.id },
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action:
            input.status === ApprovalStatus.APPROVED
              ? "approval.approved"
              : "approval.rejected",
          entityType: "Approval",
          entityId: approval.id,
          metadata: {
            actionType: approval.actionType,
            opportunityId: approval.opportunityId,
            proposalId: approval.proposalId,
          },
        },
      });

      return approval;
    });

    return NextResponse.json({ data: resolved });
  } catch (error) {
    return apiError(error);
  }
}
