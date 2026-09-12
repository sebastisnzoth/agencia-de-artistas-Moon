import { NextResponse } from "next/server";
import { googleAuthorizationUrl } from "@/lib/google";
import { createOAuthState } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("workspaceSlug")?.trim() || undefined;
  const state = await createOAuthState({ workspaceSlug });
  return NextResponse.redirect(googleAuthorizationUrl(state));
}
