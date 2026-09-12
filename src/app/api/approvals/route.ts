import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createApprovalSchema = z.object({
  opportunityId: z.string().min(1).optional(),
  proposalId: z.string().min(1).optional(),
  actionType: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(2000),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const approvals = await db.approval.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        opportunity: {
          select: { id: true, title: true, status: true },
        },
        proposal: {
          select: { id: true, title: true, version: true, status: true },
        },
      },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    });

    return NextResponse.json({ data: approvals });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createApprovalSchema.parse(await request.json());

    const [opportunity, proposal] = await Promise.all([
      input.opportunityId
        ? db.opportunity.findFirst({
            where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.proposalId
        ? db.proposal.findFirst({
            where: { id: input.proposalId, workspaceId: ctx.workspaceId },
            select: { id: true, opportunityId: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.opportunityId && !opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found in this workspace" },
        { status: 404 },
      );
    }

    if (input.proposalId && !proposal) {
      return NextResponse.json(
        { error: "Proposal not found in this workspace" },
        { status: 404 },
      );
    }

    const opportunityId = input.opportunityId ?? proposal?.opportunityId;

    const approval = await db.$transaction(async (tx) => {
      const created = await tx.approval.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId,
          proposalId: input.proposalId,
          actionType: input.actionType,
          summary: input.summary,
          payload: input.payload,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "approval.requested",
          entityType: "Approval",
          entityId: created.id,
          metadata: {
            actionType: created.actionType,
            opportunityId: created.opportunityId,
            proposalId: created.proposalId,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: approval }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
