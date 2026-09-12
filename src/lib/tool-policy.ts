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

export type ToolDecision =
  | { allowed: true; requiresApproval: false; autonomyLevel: AutonomyLevel }
  | { allowed: false; requiresApproval: true; autonomyLevel: AutonomyLevel }
  | { allowed: false; requiresApproval: false; autonomyLevel: AutonomyLevel };

export async function evaluateToolPermission(input: {
  workspaceId: string;
  toolName: string;
  requestedLevel: AutonomyLevel;
  requiredScope?: string;
}): Promise<ToolDecision> {
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

  if (input.requiredScope && !permission.scopes.includes(input.requiredScope)) {
    throw new ToolPermissionError(
      `Tool ${input.toolName} lacks scope ${input.requiredScope}`,
    );
  }

  if (input.requestedLevel === AutonomyLevel.A3) {
    return {
      allowed: false,
      requiresApproval: false,
      autonomyLevel: permission.autonomyLevel,
    };
  }

  if (rank[input.requestedLevel] <= rank[permission.autonomyLevel]) {
    return {
      allowed: true,
      requiresApproval: false,
      autonomyLevel: permission.autonomyLevel,
    };
  }

  if (input.requestedLevel === AutonomyLevel.A2) {
    return {
      allowed: false,
      requiresApproval: true,
      autonomyLevel: permission.autonomyLevel,
    };
  }

  return {
    allowed: false,
    requiresApproval: false,
    autonomyLevel: permission.autonomyLevel,
  };
}

export async function requireToolPermission(input: {
  workspaceId: string;
  toolName: string;
  requestedLevel: AutonomyLevel;
  requiredScope?: string;
}) {
  const decision = await evaluateToolPermission(input);

  if (!decision.allowed) {
    if (decision.requiresApproval) {
      throw new ToolPermissionError(
        `Tool ${input.toolName} requires approval for ${input.requestedLevel}`,
      );
    }

    throw new ToolPermissionError(
      `Tool ${input.toolName} cannot execute at ${input.requestedLevel}`,
    );
  }

  return decision;
}
