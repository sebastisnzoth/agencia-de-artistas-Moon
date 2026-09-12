import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const opportunityId = url.searchParams.get("opportunityId") ?? undefined;

    const threads = await db.emailThread.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(opportunityId ? { opportunityId } : {}),
      },
      include: {
        contact: {
          select: { id: true, name: true, email: true, organization: true },
        },
        opportunity: {
          select: { id: true, title: true, status: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: threads });
  } catch (error) {
    return apiError(error);
  }
}
