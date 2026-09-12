import { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createTaskSchema = z.object({
  artistId: z.string().min(1).optional(),
  opportunityId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(240),
  notes: z.string().trim().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)
      ? (statusParam as TaskStatus)
      : undefined;

    const tasks = await db.task.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      include: {
        artist: { select: { id: true, stageName: true } },
        opportunity: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createTaskSchema.parse(await request.json());

    const [artist, opportunity] = await Promise.all([
      input.artistId
        ? db.artist.findFirst({
            where: { id: input.artistId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.opportunityId
        ? db.opportunity.findFirst({
            where: { id: input.opportunityId, workspaceId: ctx.workspaceId },
            select: { id: true, artistId: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.artistId && !artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }
    if (input.opportunityId && !opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    if (artist && opportunity && opportunity.artistId !== artist.id) {
      return NextResponse.json(
        { error: "Task artist must match opportunity artist" },
        { status: 409 },
      );
    }

    const task = await db.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: input.artistId ?? opportunity?.artistId,
          opportunityId: input.opportunityId,
          title: input.title,
          notes: input.notes,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "task.created",
          entityType: "Task",
          entityId: created.id,
          metadata: {
            opportunityId: created.opportunityId,
            dueAt: created.dueAt?.toISOString(),
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
