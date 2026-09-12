import { OpportunityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const updateSchema = z.object({
  status: z.nativeEnum(OpportunityStatus).optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  valueCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
});

const transitions: Record<OpportunityStatus, OpportunityStatus[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["CONTACTED", "LOST"],
  CONTACTED: ["NEGOTIATING", "LOST"],
  NEGOTIATING: ["PROPOSAL", "LOST"],
  PROPOSAL: ["WON", "NEGOTIATING", "LOST"],
  WON: [],
  LOST: ["QUALIFIED"],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = updateSchema.parse(await request.json());

    const current = await db.opportunity.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (
      input.status &&
      input.status !== current.status &&
      !transitions[current.status].includes(input.status)
    ) {
      return NextResponse.json(
        { error: `Invalid transition ${current.status} -> ${input.status}` },
        { status: 409 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.update({
        where: { id: current.id },
        data: input,
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "opportunity.updated",
          entityType: "Opportunity",
          entityId: current.id,
          metadata: {
            fromStatus: current.status,
            toStatus: opportunity.status,
            changedFields: Object.keys(input),
          },
        },
      });

      return opportunity;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiError(error);
  }
}
