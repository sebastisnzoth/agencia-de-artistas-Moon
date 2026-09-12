import {
  AgentRunStatus,
  AutonomyLevel,
  OpportunityStatus,
  Prisma,
  ProposalStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const schema = z.object({
  opportunityId: z.string().min(1),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  validDays: z.number().int().min(1).max(60).default(7),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = schema.parse(await request.json());

    const opportunity = await db.opportunity.findFirst({
      where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
      include: {
        artist: true,
        contact: true,
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    if ([OpportunityStatus.WON, OpportunityStatus.LOST].includes(opportunity.status)) {
      return NextResponse.json({ error: "Terminal opportunity cannot receive a new proposal" }, { status: 409 });
    }

    const amountCents = input.amountCents ?? opportunity.valueCents ?? undefined;
    const currency = input.currency ?? opportunity.currency ?? "USD";
    const validUntil = new Date();
    validUntil.setUTCDate(validUntil.getUTCDate() + input.validDays);

    const genreText = opportunity.artist.genres.length
      ? opportunity.artist.genres.join(", ")
      : "live music";
    const recipient = opportunity.contact?.organization ?? opportunity.contact?.name ?? "prospect";
    const summary = [
      `${opportunity.artist.stageName} propone una presentación para ${recipient}.`,
      `Perfil artístico: ${genreText}.`,
      opportunity.description ? `Oportunidad: ${opportunity.description}` : undefined,
      amountCents !== undefined ? `Valor propuesto: ${(amountCents / 100).toFixed(2)} ${currency}.` : "Valor comercial pendiente de definición.",
      input.durationMinutes ? `Duración estimada: ${input.durationMinutes} minutos.` : undefined,
      input.notes,
    ].filter(Boolean).join("\n\n");

    const latest = await db.proposal.aggregate({
      where: { opportunityId: opportunity.id },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;

    const result = await db.$transaction(async (tx) => {
      const run = await tx.agentRun.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: opportunity.artistId,
          agentName: "Booking Sales",
          taskType: "generate_booking_proposal",
          goal: "Generate a contextual commercial proposal without creating a binding commitment",
          status: AgentRunStatus.COMPLETED,
          autonomyLevel: AutonomyLevel.A0,
          input: {
            opportunityId: opportunity.id,
            requestedAmountCents: input.amountCents,
            currency,
          },
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const terms: Prisma.InputJsonValue = {
        durationMinutes: input.durationMinutes ?? null,
        recipient,
        generatedFromConversationId: opportunity.conversations[0]?.id ?? null,
        commercialGuardrail: "proposal_requires_explicit_approval_before_send",
      };

      const proposal = await tx.proposal.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId: opportunity.id,
          artistId: opportunity.artistId,
          version,
          title: `${opportunity.artist.stageName} · ${opportunity.title}`,
          summary,
          terms,
          amountCents,
          currency,
          validUntil,
          status: ProposalStatus.PENDING_APPROVAL,
        },
      });

      const approval = await tx.approval.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId: opportunity.id,
          proposalId: proposal.id,
          actionType: "proposal.send",
          summary: `Approve generated proposal v${version}: ${proposal.title}`,
          payload: {
            amountCents,
            currency,
            validUntil: validUntil.toISOString(),
            generatedByAgentRunId: run.id,
          },
        },
      });

      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: {
          status: OpportunityStatus.PROPOSAL,
          nextAction: "Review generated proposal and approve before sending",
        },
      });

      const output = {
        status: "completed",
        summary: `Generated proposal v${version} for ${opportunity.title}`,
        actions_taken: ["assembled_artist_context", "generated_pitch", "created_proposal", "requested_approval"],
        evidence: { opportunityId: opportunity.id, proposalId: proposal.id },
        artifacts: [{ type: "proposal", id: proposal.id }],
        metrics: { version, amountCents: amountCents ?? null },
        next_actions: [{ action: "review_approval", approvalId: approval.id }],
        approvals_required: [{ approvalId: approval.id, actionType: "proposal.send" }],
        errors: [],
      };

      await tx.agentRun.update({
        where: { id: run.id },
        data: { output },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "AGENT",
          actorId: run.id,
          action: "booking.proposal_generated",
          entityType: "Proposal",
          entityId: proposal.id,
          metadata: {
            opportunityId: opportunity.id,
            approvalId: approval.id,
            amountCents,
            currency,
          },
        },
      });

      return { runId: run.id, proposal, approval, output };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
