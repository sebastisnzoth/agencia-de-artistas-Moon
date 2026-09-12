import { LeadStatus, OpportunityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  contactId: z.string().min(1).nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
});

const transitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: [LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED],
  QUALIFIED: [LeadStatus.CONTACT_READY, LeadStatus.DISQUALIFIED],
  CONTACT_READY: [LeadStatus.CONTACTED, LeadStatus.DISQUALIFIED],
  CONTACTED: [LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED],
  DISQUALIFIED: [LeadStatus.NEW],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = updateLeadSchema.parse(await request.json());

    const current = await db.lead.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (
      input.status &&
      input.status !== current.status &&
      !transitions[current.status].includes(input.status)
    ) {
      return NextResponse.json(
        { error: `Invalid lead transition ${current.status} -> ${input.status}` },
        { status: 409 },
      );
    }

    if (input.contactId) {
      const contact = await db.contact.findFirst({
        where: { id: input.contactId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found in this workspace" }, { status: 404 });
      }
    }

    if (input.status === LeadStatus.CONTACT_READY && !(input.contactId ?? current.contactId)) {
      return NextResponse.json(
        { error: "Lead requires a contact before CONTACT_READY" },
        { status: 409 },
      );
    }

    const lead = await db.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id: current.id },
        data: {
          status: input.status,
          contactId: input.contactId,
          score: input.score,
          notes: input.notes,
          nextAction: input.nextAction,
        },
      });

      if (updated.status === LeadStatus.CONTACTED) {
        await tx.opportunity.update({
          where: { id: updated.opportunityId },
          data: {
            status: OpportunityStatus.CONTACTED,
            contactId: updated.contactId ?? undefined,
            nextAction: updated.nextAction ?? "Continue conversation and qualify response",
          },
        });
      } else if (updated.status === LeadStatus.QUALIFIED) {
        await tx.opportunity.update({
          where: { id: updated.opportunityId },
          data: {
            status: OpportunityStatus.QUALIFIED,
            nextAction: updated.nextAction ?? "Prepare contact",
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "lead.updated",
          entityType: "Lead",
          entityId: updated.id,
          metadata: {
            fromStatus: current.status,
            toStatus: updated.status,
            contactId: updated.contactId,
            score: updated.score,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: lead });
  } catch (error) {
    return apiError(error);
  }
}
