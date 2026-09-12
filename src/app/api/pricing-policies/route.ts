import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { AuthorizationError, requireWorkspaceContext } from "@/lib/workspace";

const upsertSchema = z.object({
  artistId: z.string().min(1),
  name: z.string().trim().min(1).max(80).default("default"),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("USD"),
  minimumCents: z.number().int().nonnegative(),
  targetCents: z.number().int().nonnegative().optional(),
  autonomousMinCents: z.number().int().nonnegative().optional(),
  autonomousMaxCents: z.number().int().nonnegative().optional(),
  maximumCents: z.number().int().nonnegative().optional(),
  active: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  const ordered = [
    value.minimumCents,
    value.autonomousMinCents,
    value.targetCents,
    value.autonomousMaxCents,
    value.maximumCents,
  ].filter((item): item is number => item !== undefined);

  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] < ordered[index - 1]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pricing bounds must be ordered from minimum to maximum",
      });
      break;
    }
  }
});

function requireCommercialAdmin(role: MembershipRole) {
  if (![MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER].includes(role)) {
    throw new AuthorizationError("Owner, admin or manager role required");
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const artistId = url.searchParams.get("artistId") ?? undefined;

    const policies = await db.pricingPolicy.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(artistId ? { artistId } : {}),
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: policies });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    requireCommercialAdmin(ctx.role);
    const input = upsertSchema.parse(await request.json());

    const artist = await db.artist.findFirst({
      where: { id: input.artistId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });

    if (!artist) {
      return NextResponse.json({ error: "Artist not found in this workspace" }, { status: 404 });
    }

    const policy = await db.$transaction(async (tx) => {
      const saved = await tx.pricingPolicy.upsert({
        where: {
          artistId_name_currency: {
            artistId: input.artistId,
            name: input.name,
            currency: input.currency,
          },
        },
        update: {
          minimumCents: input.minimumCents,
          targetCents: input.targetCents,
          autonomousMinCents: input.autonomousMinCents,
          autonomousMaxCents: input.autonomousMaxCents,
          maximumCents: input.maximumCents,
          active: input.active,
          notes: input.notes,
        },
        create: {
          workspaceId: ctx.workspaceId,
          ...input,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          action: "pricing_policy.upserted",
          entityType: "PricingPolicy",
          entityId: saved.id,
          metadata: {
            artistId: saved.artistId,
            currency: saved.currency,
            minimumCents: saved.minimumCents,
            autonomousMinCents: saved.autonomousMinCents,
            autonomousMaxCents: saved.autonomousMaxCents,
            maximumCents: saved.maximumCents,
            active: saved.active,
          },
        },
      });

      return saved;
    });

    return NextResponse.json({ data: policy });
  } catch (error) {
    return apiError(error);
  }
}
