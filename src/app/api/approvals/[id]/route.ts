import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const resolveSchema = z.object({
  status: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
});

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
