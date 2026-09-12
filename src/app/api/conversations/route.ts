import { ConversationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createSchema = z.object({
  artistId: z.string().min(1),
  opportunityId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  channel: z.string().trim().min(2).max(40).default("email"),
  subject: z.string().trim().max(300).optional(),
  status: z.nativeEnum(ConversationStatus).default(ConversationStatus.OPEN),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const opportunityId = url.searchParams.get("opportunityId") || undefined;
    const statusParam = url.searchParams.get("status");
    const status = statusParam && Object.values(ConversationStatus).includes(statusParam as ConversationStatus)
      ? (statusParam as ConversationStatus)
      : undefined;

    const conversations = await db.conversation.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(opportunityId ? { opportunityId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        artist: { select: { id: true, stageName: true } },
        contact: { select: { id: true, name: true, email: true, organization: true } },
        opportunity: { select: { id: true, title: true, status: true } },
        emailThreads: {
          select: { id: true, provider: true, externalId: true, subject: true, lastMessageAt: true },
          orderBy: { lastMessageAt: "desc" },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: conversations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createSchema.parse(await request.json());

    const opportunity = await db.opportunity.findFirst({
      where: {
        id: input.opportunityId,
        artistId: input.artistId,
        workspaceId: ctx.workspaceId,
      },
      select: { id: true, contactId: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found for artist in this workspace" }, { status: 404 });
    }

    const contactId = input.contactId ?? opportunity.contactId ?? undefined;
    if (contactId) {
      const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId: ctx.workspaceId }, select: { id: true } });
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const conversation = await db.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: input.artistId,
          opportunityId: input.opportunityId,
          contactId,
          channel: input.channel,
          subject: input.subject,
          status: input.status,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "conversation.created",
          entityType: "Conversation",
          entityId: created.id,
          metadata: { opportunityId: created.opportunityId, channel: created.channel },
        },
      });

      return created;
    });

    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
