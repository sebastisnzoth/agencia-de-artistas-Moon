import { verifySessionToken } from "@/lib/session";

export type RequestActor = {
  userId: string;
  source: "development-header" | "session-cookie";
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function resolveRequestActor(request: Request): Promise<RequestActor> {
  const sessionToken = cookieValue(request, "moon_session");
  if (sessionToken) {
    try {
      const session = await verifySessionToken(sessionToken);
      return { userId: session.userId, source: "session-cookie" };
    } catch {
      throw new AuthenticationError("Invalid or expired session");
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const userId = request.headers.get("x-moon-user-id")?.trim();
    if (userId) return { userId, source: "development-header" };
  }

  throw new AuthenticationError();
}
