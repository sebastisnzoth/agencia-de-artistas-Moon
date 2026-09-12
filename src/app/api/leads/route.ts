import { LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createLeadSchema = z.object({
  opportunityId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  source: z.string().trim().max(160).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
  nextAction: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && Object.values(LeadStatus).includes(statusParam as LeadStatus)
        ? (statusParam as LeadStatus)
        : undefined;

    const leads = await db.lead.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      include: {
        artist: { select: { id: true, stageName: true } },
        opportunity: { select: { id: true, title: true, status: true, source: true } },
        contact: { select: { id: true, name: true, organization: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: leads });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createLeadSchema.parse(await request.json());

    const opportunity = await db.opportunity.findFirst({
      where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
      select: {
        id: true,
        artistId: true,
        contactId: true,
        source: true,
        score: true,
        title: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found in this workspace" }, { status: 404 });
    }

    const contactId = input.contactId ?? opportunity.contactId ?? undefined;
    if (contactId) {
      const contact = await db.contact.findFirst({
        where: { id: contactId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found in this workspace" }, { status: 404 });
      }
    }

    const lead = await db.$transaction(async (tx) => {
      const existing = await tx.lead.findUnique({
        where: {
          workspaceId_opportunityId: {
            workspaceId: ctx.workspaceId,
            opportunityId: opportunity.id,
          },
        },
      });

      if (existing) return existing;

      const created = await tx.lead.create({
        data: {
          workspaceId: ctx.workspaceId,
          opportunityId: opportunity.id,
          artistId: opportunity.artistId,
          contactId,
          source: input.source ?? opportunity.source,
          score: input.score ?? opportunity.score,
          notes: input.notes,
          nextAction: input.nextAction ?? "Qualify lead and prepare contact",
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "lead.created",
          entityType: "Lead",
          entityId: created.id,
          metadata: {
            opportunityId: opportunity.id,
            opportunityTitle: opportunity.title,
            contactId: created.contactId,
            score: created.score,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
