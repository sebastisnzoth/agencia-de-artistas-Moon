import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AuditInput = {
  workspaceId: string;
  actorId?: string;
  actorType?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditEvent(input: AuditInput) {
  return db.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorType: input.actorType ?? "USER",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
