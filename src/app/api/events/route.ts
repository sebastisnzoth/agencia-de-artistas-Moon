import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createEventSchema = z.object({
  dealId: z.string().min(1),
  title: z.string().trim().min(2).max(200).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  venue: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const events = await db.event.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        artist: { select: { id: true, stageName: true } },
        deal: { select: { id: true, title: true, status: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({ data: events });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createEventSchema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : undefined;

    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json(
        { error: "endsAt must be after startsAt" },
        { status: 400 },
      );
    }

    const deal = await db.deal.findFirst({
      where: { id: input.dealId, workspaceId: ctx.workspaceId },
      select: { id: true, artistId: true, title: true },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const effectiveEnd = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
    const conflict = await db.event.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        artistId: deal.artistId,
        startsAt: { lt: effectiveEnd },
        OR: [
          { endsAt: { gt: startsAt } },
          { endsAt: null, startsAt: { gte: new Date(startsAt.getTime() - 60 * 60 * 1000) } },
        ],
      },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "Artist schedule conflict", conflict },
        { status: 409 },
      );
    }

    const event = await db.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: deal.artistId,
          dealId: deal.id,
          title: input.title ?? deal.title,
          startsAt,
          endsAt,
          timezone: input.timezone,
          venue: input.venue,
          notes: input.notes,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "event.scheduled",
          entityType: "Event",
          entityId: created.id,
          metadata: {
            dealId: deal.id,
            startsAt: created.startsAt.toISOString(),
            endsAt: created.endsAt?.toISOString(),
            timezone: created.timezone,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
