import { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveRequestActor } from "@/lib/auth";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
};

export class AuthorizationError extends Error {
  constructor(message = "Not authorized for this workspace") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireWorkspaceContext(
  request: Request,
): Promise<WorkspaceContext> {
  const actor = resolveRequestActor(request);
  const workspaceId = request.headers.get("x-moon-workspace-id")?.trim();

  if (!workspaceId) {
    throw new AuthorizationError("Missing x-moon-workspace-id header");
  }

  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: actor.userId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw new AuthorizationError();
  }

  return {
    userId: actor.userId,
    workspaceId,
    role: membership.role,
  };
}
