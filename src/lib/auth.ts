export type RequestActor = {
  userId: string;
  source: "development-header";
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Temporary authentication boundary for the P0 foundation.
 *
 * Development can identify a seeded user through x-moon-user-id.
 * Production intentionally fails closed until a real identity provider is wired.
 * This prevents a development shortcut from silently becoming production auth.
 */
export function resolveRequestActor(request: Request): RequestActor {
  if (process.env.NODE_ENV === "production") {
    throw new AuthenticationError(
      "Production authentication provider is not configured yet",
    );
  }

  const userId = request.headers.get("x-moon-user-id")?.trim();

  if (!userId) {
    throw new AuthenticationError(
      "Missing x-moon-user-id development identity header",
    );
  }

  return { userId, source: "development-header" };
}
