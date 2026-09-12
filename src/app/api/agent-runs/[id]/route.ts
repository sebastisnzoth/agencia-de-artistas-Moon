import { AgentRunStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const updateRunSchema = z.object({
  status: z.nativeEnum(AgentRunStatus),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(10000).nullable().optional(),
  approvalsNeeded: z.array(z.record(z.string(), z.unknown())).optional(),
});

const transitions: Record<AgentRunStatus, AgentRunStatus[]> = {
  QUEUED: [AgentRunStatus.RUNNING, AgentRunStatus.BLOCKED, AgentRunStatus.FAILED],
  RUNNING: [AgentRunStatus.COMPLETED, AgentRunStatus.BLOCKED, AgentRunStatus.FAILED],
  COMPLETED: [],
  FAILED: [AgentRunStatus.QUEUED],
  BLOCKED: [AgentRunStatus.QUEUED, AgentRunStatus.RUNNING, AgentRunStatus.FAILED],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = updateRunSchema.parse(await request.json());

    const current = await db.agentRun.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
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

    const now = new Date();
    const isTerminal =
      input.status === AgentRunStatus.COMPLETED ||
      input.status === AgentRunStatus.FAILED;

    const run = await db.$transaction(async (tx) => {
      const updated = await tx.agentRun.update({
        where: { id: current.id },
        data: {
          status: input.status,
          output: input.output as Prisma.InputJsonValue | undefined,
          error: input.error,
          approvalsNeeded: input.approvalsNeeded as Prisma.InputJsonValue | undefined,
          startedAt:
            input.status === AgentRunStatus.RUNNING && !current.startedAt
              ? now
              : current.startedAt,
          completedAt: isTerminal ? now : null,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "SYSTEM",
          actorId: ctx.userId,
          action: "agent_run.status_changed",
          entityType: "AgentRun",
          entityId: updated.id,
          metadata: {
            fromStatus: current.status,
            toStatus: updated.status,
            approvalsNeeded: input.approvalsNeeded?.length ?? 0,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: run });
  } catch (error) {
    return apiError(error);
  }
}
