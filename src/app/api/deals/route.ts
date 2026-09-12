import { DealStatus, OpportunityStatus, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createDealSchema = z.object({
  proposalId: z.string().min(1),
  title: z.string().trim().min(2).max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const deals = await db.deal.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        artist: { select: { id: true, stageName: true } },
        opportunity: { select: { id: true, title: true } },
        proposal: { select: { id: true, version: true, status: true } },
        events: { orderBy: { startsAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: deals });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createDealSchema.parse(await request.json());

    const proposal = await db.proposal.findFirst({
      where: { id: input.proposalId, workspaceId: ctx.workspaceId },
      include: { opportunity: true },
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      return NextResponse.json(
        { error: "Only accepted proposals can be converted into deals" },
        { status: 409 },
      );
    }

    const existing = await db.deal.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [
          { proposalId: proposal.id },
          { opportunityId: proposal.opportunityId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ data: existing }, { status: 200 });
    }

    const deal = await db.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId: proposal.opportunityId,
          proposalId: proposal.id,
          artistId: proposal.artistId,
          title: input.title ?? proposal.title,
          amountCents: proposal.amountCents,
          currency: proposal.currency,
          status: DealStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await tx.opportunity.update({
        where: { id: proposal.opportunityId },
        data: {
          status: OpportunityStatus.WON,
          nextAction: "Schedule confirmed work",
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "deal.confirmed",
          entityType: "Deal",
          entityId: created.id,
          metadata: {
            opportunityId: created.opportunityId,
            proposalId: created.proposalId,
            amountCents: created.amountCents,
            currency: created.currency,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
