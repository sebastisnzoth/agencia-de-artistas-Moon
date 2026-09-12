import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveRequestActor } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { AuthorizationError } from "@/lib/workspace";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const input = schema.parse(await request.json());
    const membership = await db.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: actor.userId,
        },
      },
    });
    if (!membership) throw new AuthorizationError();

    const response = NextResponse.json({ data: { workspaceId: input.workspaceId } });
    response.cookies.set("moon_workspace", input.workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
