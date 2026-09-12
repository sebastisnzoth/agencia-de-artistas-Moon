import { AutonomyLevel, MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { AuthorizationError, requireWorkspaceContext } from "@/lib/workspace";

const upsertSchema = z.object({
  toolName: z.string().trim().min(2).max(120),
  enabled: z.boolean(),
  autonomyLevel: z.nativeEnum(AutonomyLevel),
  scopes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

function requireAdmin(role: MembershipRole) {
  if (![MembershipRole.OWNER, MembershipRole.ADMIN].includes(role)) {
    throw new AuthorizationError("Owner or admin role required");
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const permissions = await db.toolPermission.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { toolName: "asc" },
    });

    return NextResponse.json({ data: permissions });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    requireAdmin(ctx.role);
    const input = upsertSchema.parse(await request.json());

    if (input.autonomyLevel === AutonomyLevel.A3 && input.enabled) {
      return NextResponse.json(
        { error: "A3 tools cannot be enabled for autonomous execution" },
        { status: 409 },
      );
    }

    const permission = await db.$transaction(async (tx) => {
      const saved = await tx.toolPermission.upsert({
        where: {
          workspaceId_toolName: {
            workspaceId: ctx.workspaceId,
            toolName: input.toolName,
          },
        },
        update: {
          enabled: input.enabled,
          autonomyLevel: input.autonomyLevel,
          scopes: input.scopes,
          constraints: input.constraints,
        },
        create: {
          workspaceId: ctx.workspaceId,
          ...input,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "tool_permission.updated",
          entityType: "ToolPermission",
          entityId: saved.id,
          metadata: {
            toolName: saved.toolName,
            enabled: saved.enabled,
            autonomyLevel: saved.autonomyLevel,
            scopes: saved.scopes,
          },
        },
      });

      return saved;
    });

    return NextResponse.json({ data: permission });
  } catch (error) {
    return apiError(error);
  }
}
