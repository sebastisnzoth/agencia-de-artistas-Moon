import { AgentRunStatus, AutonomyLevel, LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { opportunityDedupeKey } from "@/lib/scout";
import { requireWorkspaceContext } from "@/lib/workspace";

const candidateSchema = z.object({
  source: z.string().trim().min(2).max(160),
  sourceKey: z.string().trim().min(1).max(500).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  valueCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  contact: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().email().optional(),
    organization: z.string().trim().max(200).optional(),
    kind: z.string().trim().max(100).optional(),
  }).optional(),
});

const requestSchema = z.object({
  artistId: z.string().min(1),
  candidates: z.array(candidateSchema).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = requestSchema.parse(await request.json());

    const artist = await db.artist.findFirst({
      where: { id: input.artistId, workspaceId: ctx.workspaceId },
      select: { id: true, stageName: true },
    });
    if (!artist) {
      return NextResponse.json({ error: "Artist not found in this workspace" }, { status: 404 });
    }

    const startedAt = new Date();
    const run = await db.agentRun.create({
      data: {
        workspaceId: ctx.workspaceId,
        artistId: artist.id,
        agentName: "Opportunity Scout",
        taskType: "opportunity_discovery_ingest",
        goal: "Ingest, deduplicate and prioritize commercial opportunities",
        status: AgentRunStatus.RUNNING,
        autonomyLevel: AutonomyLevel.A0,
        input: { candidateCount: input.candidates.length },
        startedAt,
      },
    });

    const created: Array<{ opportunityId: string; leadId: string; score: number | null }> = [];
    const duplicates: Array<{ opportunityId: string; dedupeKey: string }> = [];

    for (const candidate of input.candidates) {
      const dedupeKey = opportunityDedupeKey(artist.id, candidate);
      const existing = await db.opportunity.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          artistId: artist.id,
          OR: [
            ...(candidate.sourceKey ? [{ source: candidate.source, sourceKey: candidate.sourceKey }] : []),
            ...(candidate.sourceUrl ? [{ sourceUrl: candidate.sourceUrl }] : []),
            ...(!candidate.sourceKey && !candidate.sourceUrl
              ? [{ source: candidate.source, title: candidate.title }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (existing) {
        duplicates.push({ opportunityId: existing.id, dedupeKey });
        continue;
      }

      const result = await db.$transaction(async (tx) => {
        let contactId: string | undefined;
        if (candidate.contact) {
          const existingContact = candidate.contact.email
            ? await tx.contact.findFirst({
                where: {
                  workspaceId: ctx.workspaceId,
                  email: candidate.contact.email,
                },
              })
            : null;

          const contact = existingContact ?? await tx.contact.create({
            data: {
              workspaceId: ctx.workspaceId,
              name: candidate.contact.name,
              email: candidate.contact.email,
              organization: candidate.contact.organization,
              kind: candidate.contact.kind,
            },
          });
          contactId = contact.id;
        }

        const opportunity = await tx.opportunity.create({
          data: {
            workspaceId: ctx.workspaceId,
            artistId: artist.id,
            contactId,
            title: candidate.title,
            source: candidate.source,
            sourceKey: candidate.sourceKey,
            sourceUrl: candidate.sourceUrl,
            description: candidate.description,
            score: candidate.score,
            valueCents: candidate.valueCents,
            currency: candidate.currency,
            nextAction: contactId
              ? "Qualify lead and prepare first contact"
              : "Identify decision-maker contact",
          },
        });

        const lead = await tx.lead.create({
          data: {
            workspaceId: ctx.workspaceId,
            artistId: artist.id,
            opportunityId: opportunity.id,
            contactId,
            status: contactId ? LeadStatus.QUALIFIED : LeadStatus.NEW,
            source: candidate.source,
            score: candidate.score,
            nextAction: opportunity.nextAction,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            actorType: "AGENT",
            actorId: run.id,
            action: "scout.opportunity_discovered",
            entityType: "Opportunity",
            entityId: opportunity.id,
            metadata: {
              source: candidate.source,
              sourceKey: candidate.sourceKey,
              sourceUrl: candidate.sourceUrl,
              dedupeKey,
              score: candidate.score,
              leadId: lead.id,
            },
          },
        });

        return { opportunity, lead };
      });

      created.push({
        opportunityId: result.opportunity.id,
        leadId: result.lead.id,
        score: result.opportunity.score,
      });
    }

    const completedAt = new Date();
    const output = {
      status: "completed",
      summary: `Scout processed ${input.candidates.length} candidates: ${created.length} created, ${duplicates.length} duplicates`,
      actions_taken: ["deduplicated_candidates", "created_opportunities", "created_leads", "linked_contacts"],
      evidence: { created, duplicates },
      artifacts: [],
      metrics: {
        candidates: input.candidates.length,
        created: created.length,
        duplicates: duplicates.length,
      },
      next_actions: created
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map((item) => ({ opportunityId: item.opportunityId, action: "qualify_and_contact" })),
      approvals_required: [],
      errors: [],
    };

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: AgentRunStatus.COMPLETED,
        output,
        completedAt,
      },
    });

    return NextResponse.json({ data: { runId: run.id, ...output } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
