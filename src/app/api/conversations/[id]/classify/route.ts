import {
  AgentRunStatus,
  AutonomyLevel,
  ConversationStatus,
  LeadStatus,
  MessageDirection,
  OpportunityStatus,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { classifyCommercialReply } from "@/lib/scout";
import { requireWorkspaceContext } from "@/lib/workspace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const { id } = await params;

    const conversation = await db.conversation.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        opportunity: { select: { id: true, artistId: true, status: true, title: true } },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const latestInbound = await db.emailMessage.findFirst({
      where: {
        direction: MessageDirection.INBOUND,
        thread: {
          workspaceId: ctx.workspaceId,
          conversationId: conversation.id,
        },
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    });

    if (!latestInbound?.bodyText) {
      return NextResponse.json(
        { error: "No inbound message with text is available for classification" },
        { status: 409 },
      );
    }

    const classification = classifyCommercialReply(latestInbound.bodyText);
    const startedAt = new Date();

    const result = await db.$transaction(async (tx) => {
      const run = await tx.agentRun.create({
        data: {
          workspaceId: ctx.workspaceId,
          artistId: conversation.artistId,
          agentName: "Booking Sales",
          taskType: "classify_commercial_reply",
          goal: "Classify the latest prospect reply and choose the next safe commercial action",
          status: AgentRunStatus.COMPLETED,
          autonomyLevel: AutonomyLevel.A0,
          input: {
            conversationId: conversation.id,
            messageId: latestInbound.id,
          },
          output: {
            status: "completed",
            summary: `Reply classified as ${classification.intent}`,
            actions_taken: ["classified_reply", "updated_pipeline", "scheduled_next_action"],
            evidence: {
              messageId: latestInbound.id,
              intent: classification.intent,
              confidence: classification.confidence,
            },
            artifacts: [],
            metrics: { confidence: classification.confidence },
            next_actions: [{ action: classification.nextAction }],
            approvals_required: [],
            errors: [],
          },
          startedAt,
          completedAt: new Date(),
        },
      });

      let opportunityStatus = conversation.opportunity.status;
      let conversationStatus = conversation.status;
      let leadStatus: LeadStatus | undefined;

      if (classification.shouldClose) {
        opportunityStatus = OpportunityStatus.LOST;
        conversationStatus = ConversationStatus.CLOSED;
        leadStatus = LeadStatus.DISQUALIFIED;
      } else if (classification.shouldAdvanceNegotiation) {
        opportunityStatus = OpportunityStatus.NEGOTIATING;
        conversationStatus = ConversationStatus.REPLIED;
        leadStatus = LeadStatus.CONTACTED;
      } else {
        conversationStatus = ConversationStatus.REPLIED;
      }

      await tx.opportunity.update({
        where: { id: conversation.opportunity.id },
        data: {
          status: opportunityStatus,
          nextAction: classification.nextAction,
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { status: conversationStatus },
      });

      const lead = await tx.lead.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          opportunityId: conversation.opportunity.id,
        },
      });
      if (lead) {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            ...(leadStatus ? { status: leadStatus } : {}),
            nextAction: classification.nextAction,
          },
        });
      }

      let taskId: string | null = null;
      if (!classification.shouldClose) {
        const existingTask = await tx.task.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            opportunityId: conversation.opportunity.id,
            status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
            title: { startsWith: "Commercial next step" },
          },
        });

        if (existingTask) {
          const task = await tx.task.update({
            where: { id: existingTask.id },
            data: { notes: classification.nextAction, dueAt: new Date() },
          });
          taskId = task.id;
        } else {
          const task = await tx.task.create({
            data: {
              workspaceId: ctx.workspaceId,
              artistId: conversation.artistId,
              opportunityId: conversation.opportunity.id,
              title: `Commercial next step · ${classification.intent}`,
              notes: classification.nextAction,
              dueAt: new Date(),
            },
          });
          taskId = task.id;
        }
      }

      await tx.auditEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorType: "AGENT",
          actorId: run.id,
          action: "conversation.reply_classified",
          entityType: "Conversation",
          entityId: conversation.id,
          metadata: {
            intent: classification.intent,
            confidence: classification.confidence,
            opportunityStatus,
            conversationStatus,
            leadStatus,
            taskId,
          },
        },
      });

      return { runId: run.id, classification, taskId };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return apiError(error);
  }
}
