import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const requiredEnv = [
  "DATABASE_URL",
  "MOON_APP_URL",
  "MOON_SESSION_SECRET",
  "MOON_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
] as const;

export async function GET() {
  const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim());
  let database = "ok";

  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const ready = missingEnv.length === 0 && database === "ok";

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks: {
        database,
        environment: missingEnv.length === 0 ? "ok" : "incomplete",
      },
      missingConfiguration: missingEnv,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
