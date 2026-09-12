import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createArtistSchema = z.object({
  stageName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(5000).optional(),
  genres: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  languages: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  territories: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const artists = await db.artist.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: artists });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createArtistSchema.parse(await request.json());

    const artist = await db.$transaction(async (tx) => {
      const created = await tx.artist.create({
        data: {
          workspaceId: ctx.workspaceId,
          ...input,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "artist.created",
          entityType: "Artist",
          entityId: created.id,
          metadata: { stageName: created.stageName },
        },
      });

      return created;
    });

    return NextResponse.json({ data: artist }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
