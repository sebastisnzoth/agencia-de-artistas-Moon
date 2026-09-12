import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const createContactSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320).optional(),
  organization: z.string().trim().max(200).optional(),
  kind: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const contacts = await db.contact.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: contacts });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const input = createContactSchema.parse(await request.json());

    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
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
          action: "contact.created",
          entityType: "Contact",
          entityId: created.id,
          metadata: { name: created.name, organization: created.organization },
        },
      });

      return created;
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
