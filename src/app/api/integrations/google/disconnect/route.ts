import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleOAuthClient } from "@/lib/google";
import { apiError } from "@/lib/http";
import { decryptSecret } from "@/lib/secrets";
import { AuthorizationError, requireWorkspaceContext } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    if (ctx.role !== MembershipRole.OWNER && ctx.role !== MembershipRole.ADMIN) {
      throw new AuthorizationError("Owner or admin role required");
    }

    const connection = await db.integrationAccount.findFirst({
      where: { workspaceId: ctx.workspaceId, provider: "google" },
      orderBy: { updatedAt: "desc" },
    });
    if (!connection) {
      return NextResponse.json({ data: { disconnected: true, alreadyDisconnected: true } });
    }

    try {
      await googleOAuthClient().revokeToken(decryptSecret(connection.encryptedRefreshToken));
    } catch (error) {
      console.warn("Google token revocation failed; deleting local credential anyway", error);
    }

    await db.$transaction(async (tx) => {
      await tx.integrationAccount.delete({ where: { id: connection.id } });
      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "integration.google_disconnected",
          entityType: "IntegrationAccount",
          entityId: connection.id,
          metadata: { email: connection.email },
        },
      });
    });

    return NextResponse.json({ data: { disconnected: true, alreadyDisconnected: false } });
  } catch (error) {
    return apiError(error);
  }
}
