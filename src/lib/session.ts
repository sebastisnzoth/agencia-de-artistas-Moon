import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function sessionKey() {
  const secret = process.env.MOON_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MOON_SESSION_SECRET must be at least 32 characters");
  }
  return encoder.encode(secret);
}

export type MoonSession = {
  userId: string;
  email: string;
};

export async function createSessionToken(session: MoonSession) {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("moon")
    .setAudience("moon-app")
    .sign(sessionKey());
}

export async function verifySessionToken(token: string): Promise<MoonSession> {
  const { payload } = await jwtVerify(token, sessionKey(), {
    issuer: "moon",
    audience: "moon-app",
  });
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid MOON session");
  }
  return { userId: payload.sub, email: payload.email };
}

export async function createOAuthState(input: { workspaceSlug?: string }) {
  return new SignJWT({ workspaceSlug: input.workspaceSlug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setIssuer("moon-oauth")
    .setAudience("google")
    .sign(sessionKey());
}

export async function verifyOAuthState(token: string) {
  const { payload } = await jwtVerify(token, sessionKey(), {
    issuer: "moon-oauth",
    audience: "google",
  });
  return {
    workspaceSlug:
      typeof payload.workspaceSlug === "string" ? payload.workspaceSlug : undefined,
  };
}
