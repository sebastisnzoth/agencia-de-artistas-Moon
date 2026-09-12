import { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const schema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = schema.parse(await request.json());

    const current = await db.task.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await db.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: current.id },
        data: {
          status: input.status,
          dueAt:
            input.dueAt === undefined
              ? undefined
              : input.dueAt === null
                ? null
                : new Date(input.dueAt),
          notes: input.notes,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "task.updated",
          entityType: "Task",
          entityId: updated.id,
          metadata: {
            fromStatus: current.status,
            toStatus: updated.status,
            changedFields: Object.keys(input),
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: task });
  } catch (error) {
    return apiError(error);
  }
}
