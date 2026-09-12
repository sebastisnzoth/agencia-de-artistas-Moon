import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { resolveRequestActor } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const user = await db.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          select: {
            role: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ data: user });
  } catch (error) {
    return apiError(error);
  }
}
