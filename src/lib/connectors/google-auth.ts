import { db } from "@/lib/db";
import { googleOAuthClient } from "@/lib/google";
import { decryptSecret } from "@/lib/secrets";

export async function googleClientForWorkspace(workspaceId: string) {
  const connection = await db.integrationAccount.findFirst({
    where: { workspaceId, provider: "google" },
    orderBy: { updatedAt: "desc" },
  });

  if (!connection) {
    throw new Error("Google integration is not connected for this workspace");
  }

  const client = googleOAuthClient();
  client.setCredentials({
    refresh_token: decryptSecret(connection.encryptedRefreshToken),
  });

  return { client, connection };
}
