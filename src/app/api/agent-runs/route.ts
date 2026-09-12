import { AgentRunStatus, AutonomyLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

const createRunSchema = z.object({
  artistId: z.string().min(1).optional(),
  agentName: z.string().trim().min(2).max(120),
  taskType: z.string().trim().min(2).max(120),
  goal: z.string().trim().min(2).max(5000),
  autonomyLevel: z.nativeEnum(AutonomyLevel).default(AutonomyLevel.A0),
  availableTools: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  input: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && Object.values(AgentRunStatus).includes(statusParam as AgentRunStatus)
      ? (statusParam as AgentRunStatus)
      : undefined;

    const runs = await db.agentRun.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createRunSchema.parse(await request.json());

    if (input.artistId) {
      const artist = await db.artist.findFirst({
        where: { id: input.artistId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!artist) {
        return NextResponse.json({ error: "Artist not found" }, { status: 404 });
      }
    }

    await Promise.all(
      input.availableTools.map((toolName) =>
        requireToolPermission({
          workspaceId: ctx.workspaceId,
          toolName,
          requestedLevel: input.autonomyLevel,
        }),
      ),
    );

    const run = await db.$transaction(async (tx) => {
      const created = await tx.agentRun.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: input.artistId,
          agentName: input.agentName,
          taskType: input.taskType,
          goal: input.goal,
          autonomyLevel: input.autonomyLevel,
          input: {
            ...(input.input ?? {}),
            availableTools: input.availableTools,
          },
          status: AgentRunStatus.QUEUED,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "agent_run.queued",
          entityType: "AgentRun",
          entityId: created.id,
          metadata: {
            agentName: created.agentName,
            taskType: created.taskType,
            autonomyLevel: created.autonomyLevel,
            availableTools: input.availableTools,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
