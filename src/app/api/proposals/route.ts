import { OpportunityStatus, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createProposalSchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(5000).optional(),
  terms: z.record(z.string(), z.unknown()).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("USD"),
  validUntil: z.string().datetime().optional(),
  requestApproval: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const opportunityId = url.searchParams.get("opportunityId") ?? undefined;

    const proposals = await db.proposal.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(opportunityId ? { opportunityId } : {}),
      },
      include: {
        artist: { select: { id: true, stageName: true } },
        opportunity: { select: { id: true, title: true, status: true } },
        approvals: { orderBy: { requestedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: proposals });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createProposalSchema.parse(await request.json());

    const opportunity = await db.opportunity.findFirst({
      where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
      select: { id: true, artistId: true, title: true, status: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if ([OpportunityStatus.WON, OpportunityStatus.LOST].includes(opportunity.status)) {
      return NextResponse.json(
        { error: `Cannot create a proposal for ${opportunity.status.toLowerCase()} opportunity` },
        { status: 409 },
      );
    }

    const latest = await db.proposal.aggregate({
      where: { opportunityId: opportunity.id },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;

    const result = await db.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId: opportunity.id,
          artistId: opportunity.artistId,
          version,
          title: input.title,
          summary: input.summary,
          terms: input.terms,
          amountCents: input.amountCents,
          currency: input.currency,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          status: input.requestApproval ? ProposalStatus.PENDING_APPROVAL : ProposalStatus.DRAFT,
        },
      });

      let approval = null;
      if (input.requestApproval) {
        approval = await tx.approval.create({
          data: {
            workspaceId: ctx.workspaceId,
            opportunityId: opportunity.id,
            proposalId: proposal.id,
            actionType: "proposal.send",
            summary: `Approve proposal v${proposal.version}: ${proposal.title}`,
            payload: {
              amountCents: proposal.amountCents,
              currency: proposal.currency,
              validUntil: proposal.validUntil?.toISOString(),
            },
          },
        });
      }

      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: {
          status: OpportunityStatus.PROPOSAL,
          nextAction: input.requestApproval
            ? "Review and approve proposal"
            : "Finish proposal draft",
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "proposal.created",
          entityType: "Proposal",
          entityId: proposal.id,
          metadata: {
            opportunityId: opportunity.id,
            version: proposal.version,
            approvalId: approval?.id,
          },
        },
      });

      return { proposal, approval };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
