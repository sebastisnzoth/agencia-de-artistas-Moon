import { ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const schema = z.object({
  status: z.nativeEnum(ProposalStatus),
});

const transitions: Record<ProposalStatus, ProposalStatus[]> = {
  DRAFT: [ProposalStatus.PENDING_APPROVAL, ProposalStatus.EXPIRED],
  PENDING_APPROVAL: [ProposalStatus.APPROVED, ProposalStatus.DRAFT, ProposalStatus.EXPIRED],
  APPROVED: [ProposalStatus.SENT, ProposalStatus.DRAFT, ProposalStatus.EXPIRED],
  SENT: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED],
  ACCEPTED: [],
  REJECTED: [ProposalStatus.DRAFT],
  EXPIRED: [ProposalStatus.DRAFT],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = schema.parse(await request.json());

    const current = await db.proposal.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (
      input.status !== current.status &&
      !transitions[current.status].includes(input.status)
    ) {
      return NextResponse.json(
        { error: `Invalid transition ${current.status} -> ${input.status}` },
        { status: 409 },
      );
    }

    if (
      input.status === ProposalStatus.SENT &&
      current.status !== ProposalStatus.APPROVED
    ) {
      return NextResponse.json(
        { error: "Proposal must be approved before it can be marked sent" },
        { status: 409 },
      );
    }

    const proposal = await db.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id: current.id },
        data: { status: input.status },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "proposal.status_changed",
          entityType: "Proposal",
          entityId: updated.id,
          metadata: { fromStatus: current.status, toStatus: updated.status },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: proposal });
  } catch (error) {
    return apiError(error);
  }
}
