import { OpportunityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createOpportunitySchema = z.object({
  artistId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(200),
  source: z.string().trim().max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  score: z.number().int().min(0).max(100).optional(),
  valueCents: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  nextAction: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && Object.values(OpportunityStatus).includes(statusParam as OpportunityStatus)
      ? (statusParam as OpportunityStatus)
      : undefined;

    const opportunities = await db.opportunity.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      include: {
        artist: { select: { id: true, stageName: true } },
        contact: { select: { id: true, name: true, organization: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: opportunities });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createOpportunitySchema.parse(await request.json());

    const [artist, contact] = await Promise.all([
      db.artist.findFirst({
        where: { id: input.artistId, workspaceId: ctx.workspaceId },
        select: { id: true },
      }),
      input.contactId
        ? db.contact.findFirst({
            where: { id: input.contactId, workspaceId: ctx.workspaceId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!artist) {
      return NextResponse.json({ error: "Artist not found in this workspace" }, { status: 404 });
    }

    if (input.contactId && !contact) {
      return NextResponse.json({ error: "Contact not found in this workspace" }, { status: 404 });
    }

    const opportunity = await db.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
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
          action: "opportunity.created",
          entityType: "Opportunity",
          entityId: created.id,
          metadata: { title: created.title, status: created.status },
        },
      });

      return created;
    });

    return NextResponse.json({ data: opportunity }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
