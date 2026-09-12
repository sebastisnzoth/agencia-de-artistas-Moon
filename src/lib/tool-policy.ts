import { AutonomyLevel } from "@prisma/client";
import { db } from "@/lib/db";

const rank: Record<AutonomyLevel, number> = {
  A0: 0,
  A1: 1,
  A2: 2,
  A3: 3,
};

export class ToolPermissionError extends Error {
  constructor(message = "Tool action is not permitted") {
    super(message);
    this.name = "ToolPermissionError";
  }
}

export async function requireToolPermission(input: {
  workspaceId: string;
  toolName: string;
  requestedLevel: AutonomyLevel;
}) {
  const permission = await db.toolPermission.findUnique({
    where: {
      workspaceId_toolName: {
        workspaceId: input.workspaceId,
        toolName: input.toolName,
      },
    },
  });

  if (!permission || !permission.enabled) {
    throw new ToolPermissionError(`Tool ${input.toolName} is disabled`);
  }

  if (rank[input.requestedLevel] > rank[permission.autonomyLevel]) {
    throw new ToolPermissionError(
      `Tool ${input.toolName} allows up to ${permission.autonomyLevel}, requested ${input.requestedLevel}`,
    );
  }

  if (input.requestedLevel === AutonomyLevel.A3) {
    throw new ToolPermissionError("A3 actions cannot execute autonomously");
  }

  return permission;
}
