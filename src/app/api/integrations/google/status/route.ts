import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const connection = await db.integrationAccount.findFirst({
      where: { workspaceId: ctx.workspaceId, provider: "google" },
      select: {
        id: true,
        email: true,
        scopes: true,
        connectedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      data: {
        connected: Boolean(connection),
        connection,
        gmail: connection
          ? {
              read: connection.scopes.includes("https://www.googleapis.com/auth/gmail.readonly"),
              compose: connection.scopes.includes("https://www.googleapis.com/auth/gmail.compose"),
              send: connection.scopes.includes("https://www.googleapis.com/auth/gmail.send"),
            }
          : null,
        calendar: connection
          ? {
              events: connection.scopes.includes("https://www.googleapis.com/auth/calendar.events"),
            }
          : null,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
