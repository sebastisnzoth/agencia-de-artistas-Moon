import {
  AgentRunStatus,
  AutonomyLevel,
  ConversationStatus,
  OpportunityStatus,
  TaskStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireWorkspaceContext } from "@/lib/workspace";

const querySchema = z.object({
  artistId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

type PriorityItem = {
  type: "task" | "opportunity" | "conversation";
  id: string;
  artistId: string | null;
  opportunityId: string | null;
  title: string;
  nextAction: string;
  priorityScore: number;
  reasons: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext(request);
    const url = new URL(request.url);
    const input = querySchema.parse({
      artistId: url.searchParams.get("artistId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (input.artistId) {
      const artist = await db.artist.findFirst({
        where: { id: input.artistId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!artist) {
        return NextResponse.json({ error: "Artist not found in this workspace" }, { status: 404 });
      }
    }

    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [tasks, opportunities, conversations] = await Promise.all([
      db.task.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          ...(input.artistId ? { artistId: input.artistId } : {}),
        },
        include: {
          opportunity: { select: { id: true, title: true, score: true, status: true } },
        },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 100,
      }),
      db.opportunity.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { notIn: [OpportunityStatus.WON, OpportunityStatus.LOST] },
          ...(input.artistId ? { artistId: input.artistId } : {}),
        },
        include: {
          contact: { select: { id: true, name: true, organization: true } },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        take: 100,
      }),
      db.conversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { in: [ConversationStatus.REPLIED, ConversationStatus.WAITING_FOR_REPLY] },
          ...(input.artistId ? { artistId: input.artistId } : {}),
        },
        include: {
          opportunity: { select: { id: true, title: true, score: true, status: true, nextAction: true } },
          contact: { select: { name: true, organization: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 100,
      }),
    ]);

    const items: PriorityItem[] = [];

    for (const task of tasks) {
      let score = 35;
      const reasons: string[] = ["open_task"];
      if (task.status === TaskStatus.IN_PROGRESS) {
        score += 8;
        reasons.push("already_in_progress");
      }
      if (task.dueAt && task.dueAt <= now) {
        score += 35;
        reasons.push("overdue");
      } else if (task.dueAt && task.dueAt <= inThreeDays) {
        score += 20;
        reasons.push("due_soon");
      }
      if (task.opportunity?.score) {
        score += task.opportunity.score * 0.2;
        reasons.push("high_value_opportunity_context");
      }

      items.push({
        type: "task",
        id: task.id,
        artistId: task.artistId,
        opportunityId: task.opportunityId,
        title: task.title,
        nextAction: task.title,
        priorityScore: clampScore(score),
        reasons,
      });
    }

    for (const opportunity of opportunities) {
      let score = opportunity.score ?? 40;
      const reasons: string[] = ["active_opportunity"];
      if (opportunity.status === OpportunityStatus.NEGOTIATING) {
        score += 22;
        reasons.push("negotiating");
      } else if (opportunity.status === OpportunityStatus.PROPOSAL) {
        score += 18;
        reasons.push("proposal_stage");
      } else if (opportunity.status === OpportunityStatus.CONTACTED) {
        score += 12;
        reasons.push("contacted");
      }
      if (opportunity.contactId) {
        score += 5;
        reasons.push("contact_available");
      }

      items.push({
        type: "opportunity",
        id: opportunity.id,
        artistId: opportunity.artistId,
        opportunityId: opportunity.id,
        title: opportunity.title,
        nextAction: opportunity.nextAction ?? "Review opportunity and define next commercial action",
        priorityScore: clampScore(score),
        reasons,
      });
    }

    for (const conversation of conversations) {
      let score = conversation.opportunity.score ?? 45;
      const reasons: string[] = ["active_conversation"];
      if (conversation.status === ConversationStatus.REPLIED) {
        score += 30;
        reasons.push("prospect_replied");
      } else {
        const ageHours = conversation.lastMessageAt
          ? (now.getTime() - conversation.lastMessageAt.getTime()) / 3_600_000
          : 0;
        if (ageHours >= 72) {
          score += 18;
          reasons.push("reply_wait_over_72h");
        } else if (ageHours >= 24) {
          score += 10;
          reasons.push("reply_wait_over_24h");
        }
      }
      if (conversation.opportunity.status === OpportunityStatus.NEGOTIATING) {
        score += 15;
        reasons.push("negotiation_context");
      }

      items.push({
        type: "conversation",
        id: conversation.id,
        artistId: conversation.artistId,
        opportunityId: conversation.opportunityId,
        title: conversation.subject ?? conversation.opportunity.title,
        nextAction:
          conversation.opportunity.nextAction ??
          (conversation.status === ConversationStatus.REPLIED
            ? "Classify reply and advance negotiation"
            : "Review follow-up timing"),
        priorityScore: clampScore(score),
        reasons,
      });
    }

    const deduped = new Map<string, PriorityItem>();
    for (const item of items.sort((a, b) => b.priorityScore - a.priorityScore)) {
      const key = item.opportunityId ? `opportunity:${item.opportunityId}` : `${item.type}:${item.id}`;
      const existing = deduped.get(key);
      if (!existing || item.priorityScore > existing.priorityScore) {
        deduped.set(key, item);
      }
    }

    const priorities = [...deduped.values()]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, input.limit);

    const run = await db.agentRun.create({
      data: {
        workspaceId: ctx.workspaceId,
        artistId: input.artistId,
        agentName: "MOON General Manager",
        taskType: "daily_commercial_priorities",
        goal: "Prioritize the commercial actions most likely to move artists toward revenue today",
        status: AgentRunStatus.COMPLETED,
        autonomyLevel: AutonomyLevel.A0,
        input: {
          artistId: input.artistId ?? null,
          taskCount: tasks.length,
          opportunityCount: opportunities.length,
          conversationCount: conversations.length,
        },
        output: {
          status: "completed",
          summary: `Generated ${priorities.length} daily commercial priorities`,
          actions_taken: ["scored_tasks", "scored_opportunities", "scored_conversations", "deduplicated_pipeline_actions"],
          evidence: priorities,
          artifacts: [],
          metrics: {
            priorities: priorities.length,
            repliedConversations: conversations.filter((item) => item.status === ConversationStatus.REPLIED).length,
            overdueTasks: tasks.filter((item) => item.dueAt && item.dueAt <= now).length,
          },
          next_actions: priorities.map((item) => ({
            type: item.type,
            id: item.id,
            action: item.nextAction,
            priorityScore: item.priorityScore,
          })),
          approvals_required: [],
          errors: [],
        },
        startedAt: now,
        completedAt: new Date(),
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorType: "AGENT",
        actorId: run.id,
        action: "manager.daily_priorities_generated",
        entityType: "AgentRun",
        entityId: run.id,
        metadata: {
          artistId: input.artistId ?? null,
          priorityCount: priorities.length,
        },
      },
    });

    return NextResponse.json({
      data: {
        runId: run.id,
        generatedAt: now.toISOString(),
        priorities,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
