import { ConversationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const patchSchema = z.object({
  status: z.nativeEnum(ConversationStatus),
  subject: z.string().trim().max(300).optional(),
});

const transitions: Record<ConversationStatus, ConversationStatus[]> = {
  OPEN: [ConversationStatus.WAITING_FOR_REPLY, ConversationStatus.REPLIED, ConversationStatus.CLOSED],
  WAITING_FOR_REPLY: [ConversationStatus.REPLIED, ConversationStatus.CLOSED],
  REPLIED: [ConversationStatus.WAITING_FOR_REPLY, ConversationStatus.CLOSED],
  CLOSED: [ConversationStatus.OPEN],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;
    const input = patchSchema.parse(await request.json());

    const current = await db.conversation.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });

    if (!current) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (input.status !== current.status && !transitions[current.status].includes(input.status)) {
      return NextResponse.json(
        { error: `Invalid conversation transition ${current.status} -> ${input.status}` },
        { status: 409 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.update({
        where: { id: current.id },
        data: { status: input.status, subject: input.subject ?? current.subject },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "conversation.updated",
          entityType: "Conversation",
          entityId: conversation.id,
          metadata: { fromStatus: current.status, toStatus: conversation.status },
        },
      });

      return conversation;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiError(error);
  }
}
