import { AutonomyLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { GoogleCalendarConnector } from "@/lib/connectors/google-calendar";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    await requireToolPermission({
      workspaceId: ctx.workspaceId,
      toolName: "calendar.write",
      requestedLevel: AutonomyLevel.A1,
      requiredScope: "write",
    });

    const { id } = await params;
    const event = await db.event.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { artist: { select: { stageName: true } }, deal: { select: { id: true } } },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const alreadySynced = await db.auditEvent.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        action: "google_calendar.event_created",
        entityType: "Event",
        entityId: event.id,
      },
      orderBy: { createdAt: "desc" },
    });
    if (alreadySynced) {
      return NextResponse.json({ data: { synced: true, alreadySynced: true } });
    }

    const connector = new GoogleCalendarConnector(ctx.workspaceId);
    const remote = await connector.createEvent({
      title: `${event.title} · ${event.artist.stageName}`,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? undefined,
      timezone: event.timezone,
      location: event.venue ?? undefined,
      notes: event.notes ?? undefined,
    });

    await db.auditEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorType: "SYSTEM",
        action: "google_calendar.event_created",
        entityType: "Event",
        entityId: event.id,
        metadata: {
          externalEventId: remote.externalEventId,
          dealId: event.dealId,
          startsAt: event.startsAt.toISOString(),
        },
      },
    });

    return NextResponse.json({
      data: { synced: true, alreadySynced: false, externalEventId: remote.externalEventId },
    });
  } catch (error) {
    return apiError(error);
  }
}
