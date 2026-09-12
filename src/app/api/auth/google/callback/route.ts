import crypto from "node:crypto";
import { AutonomyLevel, MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GOOGLE_SCOPES, googleOAuthClient } from "@/lib/google";
import { encryptSecret } from "@/lib/secrets";
import { createSessionToken, verifyOAuthState } from "@/lib/session";

function slugBase(email: string) {
  const raw = email.split("@")[0]?.toLowerCase() || "artist";
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artist";
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    if (!code || !stateRaw) {
      return NextResponse.json({ error: "Missing OAuth code or state" }, { status: 400 });
    }

    const state = await verifyOAuthState(stateRaw);
    const nonceCookie = cookieValue(request, "moon_oauth_nonce");
    if (!nonceCookie || nonceCookie !== state.nonce) {
      return NextResponse.json({ error: "OAuth state validation failed" }, { status: 400 });
    }

    const client = googleOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return NextResponse.json({ error: "Google did not return identity token" }, { status: 400 });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified === false) {
      return NextResponse.json({ error: "Verified Google identity required" }, { status: 403 });
    }

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: profile.email! },
        update: { name: profile.name },
        create: { email: profile.email!, name: profile.name },
      });

      let workspace;
      if (state.workspaceSlug) {
        workspace = await tx.workspace.findUnique({ where: { slug: state.workspaceSlug } });
        if (!workspace) throw new Error("Requested workspace does not exist");
        const membership = await tx.membership.findUnique({
          where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        });
        if (!membership) throw new Error("Google user is not a member of requested workspace");
      } else {
        const membership = await tx.membership.findFirst({
          where: { userId: user.id },
          include: { workspace: true },
          orderBy: { id: "asc" },
        });
        if (membership) {
          workspace = membership.workspace;
        } else {
          const base = slugBase(user.email);
          const slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
          workspace = await tx.workspace.create({
            data: {
              name: profile.name ? `${profile.name} · MOON` : "MOON Workspace",
              slug,
            },
          });
          await tx.membership.create({
            data: { workspaceId: workspace.id, userId: user.id, role: MembershipRole.OWNER },
          });
        }
      }

      const existing = await tx.integrationAccount.findUnique({
        where: {
          workspaceId_provider_externalAccountId: {
            workspaceId: workspace.id,
            provider: "google",
            externalAccountId: profile.sub,
          },
        },
      });
      const refreshToken = tokens.refresh_token ?? (existing ? undefined : null);
      if (refreshToken === null) {
        throw new Error("Google refresh token missing; revoke access and reconnect with consent");
      }

      const connection = await tx.integrationAccount.upsert({
        where: {
          workspaceId_provider_externalAccountId: {
            workspaceId: workspace.id,
            provider: "google",
            externalAccountId: profile.sub,
          },
        },
        update: {
          userId: user.id,
          email: user.email,
          scopes: tokens.scope?.split(" ").filter(Boolean) ?? existing?.scopes ?? GOOGLE_SCOPES,
          ...(refreshToken ? { encryptedRefreshToken: encryptSecret(refreshToken) } : {}),
        },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          provider: "google",
          externalAccountId: profile.sub,
          email: user.email,
          encryptedRefreshToken: encryptSecret(refreshToken!),
          scopes: tokens.scope?.split(" ").filter(Boolean) ?? GOOGLE_SCOPES,
        },
      });

      const defaults = [
        {
          toolName: "email.ingest",
          enabled: true,
          autonomyLevel: AutonomyLevel.A0,
          scopes: ["read"],
        },
        {
          toolName: "email.send",
          enabled: false,
          autonomyLevel: AutonomyLevel.A1,
          scopes: ["send"],
        },
        {
          toolName: "calendar.write",
          enabled: false,
          autonomyLevel: AutonomyLevel.A1,
          scopes: ["read", "write"],
        },
      ];

      for (const permission of defaults) {
        const current = await tx.toolPermission.findUnique({
          where: {
            workspaceId_toolName: {
              workspaceId: workspace.id,
              toolName: permission.toolName,
            },
          },
        });
        if (!current) {
          await tx.toolPermission.create({
            data: { workspaceId: workspace.id, ...permission },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: workspace.id,
          actorType: "USER",
          actorId: user.id,
          action: "integration.google_connected",
          entityType: "IntegrationAccount",
          entityId: connection.id,
          metadata: { email: user.email, scopes: connection.scopes },
        },
      });

      return { user, workspace };
    });

    const session = await createSessionToken({ userId: result.user.id, email: result.user.email });
    const appUrl = process.env.MOON_APP_URL || new URL(request.url).origin;
    const response = NextResponse.redirect(new URL("/", appUrl));
    response.cookies.set("moon_session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set("moon_workspace", result.workspace.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set("moon_oauth_nonce", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google OAuth failed" },
      { status: 400 },
    );
  }
}
