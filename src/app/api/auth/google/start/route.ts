import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { googleAuthorizationUrl } from "@/lib/google";
import { createOAuthState } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("workspaceSlug")?.trim() || undefined;
  const nonce = crypto.randomBytes(24).toString("base64url");
  const state = await createOAuthState({ workspaceSlug, nonce });
  const response = NextResponse.redirect(googleAuthorizationUrl(state));
  response.cookies.set("moon_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 60 * 10,
  });
  return response;
}
