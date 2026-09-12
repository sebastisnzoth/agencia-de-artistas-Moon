import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(120).optional(),
  workspaceName: z.string().trim().min(2).max(120),
  workspaceSlug: z.string().trim().regex(/^[a-z0-9-]+$/).min(2).max(80),
});

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const input = schema.parse(await request.json());

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: input.email },
        update: { name: input.name },
        create: { email: input.email, name: input.name },
      });

      const workspace = await tx.workspace.upsert({
        where: { slug: input.workspaceSlug },
        update: { name: input.workspaceName },
        create: { name: input.workspaceName, slug: input.workspaceSlug },
      });

      await tx.membership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
        update: { role: MembershipRole.OWNER },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: workspace.id,
          actorType: "SYSTEM",
          actorId: user.id,
          action: "workspace.dev_bootstrap",
          entityType: "Workspace",
          entityId: workspace.id,
          metadata: { email: user.email },
        },
      });

      return { user, workspace };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
