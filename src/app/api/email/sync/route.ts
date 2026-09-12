import { AutonomyLevel, MessageDirection, MessageStatus, OpportunityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { GmailConnector } from "@/lib/connectors/gmail";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireToolPermission } from "@/lib/tool-policy";
import { requireWorkspaceContext } from "@/lib/workspace";

function emailOnly(value?: string) {
  if (!value) return undefined;
  const bracket = value.match(/<([^>]+)>/);
  return (bracket?.[1] ?? value).trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    await requireToolPermission({
      workspaceId: ctx.workspaceId,
      toolName: "email.ingest",
      requestedLevel: AutonomyLevel.A0,
      requiredScope: "read",
    });

    const connection = await db.integrationAccount.findFirst({
      where: { workspaceId: ctx.workspaceId, provider: "google" },
      orderBy: { updatedAt: "desc" },
    });
    if (!connection) {
      return NextResponse.json({ error: "Google integration not connected" }, { status: 409 });
    }

    const url = new URL(request.url);
    const hours = Math.min(Math.max(Number(url.searchParams.get("hours") ?? "72"), 1), 24 * 30);
    const connector = new GmailConnector(ctx.workspaceId);
    const result = await connector.listRecentMessages({
      since: new Date(Date.now() - hours * 60 * 60 * 1000),
      limit: 50,
    });

    let imported = 0;
    let duplicates = 0;
    let skippedOutbound = 0;

    for (const remote of result.messages) {
      const from = emailOnly(remote.from?.address);
      if (from && connection.email && from === connection.email.toLowerCase()) {
        skippedOutbound += 1;
        continue;
      }

      const contact = from
        ? await db.contact.findFirst({
            where: { workspaceId: ctx.workspaceId, email: { equals: from, mode: "insensitive" } },
          })
        : null;
      const opportunity = contact
        ? await db.opportunity.findFirst({
            where: {
              workspaceId: ctx.workspaceId,
              contactId: contact.id,
              status: { notIn: [OpportunityStatus.WON, OpportunityStatus.LOST] },
            },
            orderBy: { updatedAt: "desc" },
          })
        : null;

      const outcome = await db.$transaction(async (tx) => {
        const thread = await tx.emailThread.upsert({
          where: {
            workspaceId_provider_externalId: {
              workspaceId: ctx.workspaceId,
              provider: "gmail",
              externalId: remote.threadExternalId,
            },
          },
          update: {
            contactId: contact?.id,
            opportunityId: opportunity?.id,
            subject: remote.subject,
            lastMessageAt: remote.receivedAt ?? new Date(),
          },
          create: {
            workspaceId: ctx.workspaceId,
            provider: "gmail",
            externalId: remote.threadExternalId,
            contactId: contact?.id,
            opportunityId: opportunity?.id,
            subject: remote.subject,
            lastMessageAt: remote.receivedAt ?? new Date(),
          },
        });

        const existing = await tx.emailMessage.findUnique({
          where: { threadId_externalId: { threadId: thread.id, externalId: remote.externalId } },
        });
        if (existing) return false;

        const message = await tx.emailMessage.create({
          data: {
            threadId: thread.id,
            externalId: remote.externalId,
            direction: MessageDirection.INBOUND,
            status: MessageStatus.RECEIVED,
            fromAddress: from ?? remote.from?.address,
            toAddresses: remote.to.map((item) => emailOnly(item.address) ?? item.address),
            subject: remote.subject,
            bodyText: remote.bodyText,
            receivedAt: remote.receivedAt ?? new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: ctx.workspaceId,
            actorType: "SYSTEM",
            action: "gmail.message_synced",
            entityType: "EmailMessage",
            entityId: message.id,
            metadata: { contactId: contact?.id, opportunityId: opportunity?.id },
          },
        });
        return true;
      });

      if (outcome) imported += 1;
      else duplicates += 1;
    }

    return NextResponse.json({
      data: { imported, duplicates, skippedOutbound, nextCursor: result.nextCursor },
    });
  } catch (error) {
    return apiError(error);
  }
}
