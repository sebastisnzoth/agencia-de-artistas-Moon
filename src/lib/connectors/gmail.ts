import { google } from "googleapis";
import type { EmailConnector, EmailDraft, ProviderEmailMessage } from "@/lib/connectors/email";
import { googleClientForWorkspace } from "@/lib/connectors/google-auth";

function encodeMime(input: EmailDraft) {
  const lines = [
    `To: ${input.to.map((item) => item.name ? `${item.name} <${item.address}>` : item.address).join(", ")}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.map((item) => item.address).join(", ")}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${input.bcc.map((item) => item.address).join(", ")}`] : []),
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.bodyText,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function header(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function decodeBody(payload: any): string | undefined {
  if (payload?.body?.data) return Buffer.from(payload.body.data, "base64url").toString("utf8");
  for (const part of payload?.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
  }
  return undefined;
}

export class GmailConnector implements EmailConnector {
  readonly provider = "gmail";

  constructor(private readonly workspaceId: string) {}

  private async api() {
    const { client } = await googleClientForWorkspace(this.workspaceId);
    return google.gmail({ version: "v1", auth: client });
  }

  async listRecentMessages(input: { since?: Date; cursor?: string; limit?: number }) {
    const gmail = await this.api();
    const q = input.since ? `after:${Math.floor(input.since.getTime() / 1000)}` : undefined;
    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      pageToken: input.cursor,
      maxResults: Math.min(input.limit ?? 25, 100),
    });

    const messages: ProviderEmailMessage[] = [];
    for (const item of list.data.messages ?? []) {
      if (!item.id) continue;
      const full = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
      const data = full.data;
      if (!data.id || !data.threadId) continue;
      const headers = data.payload?.headers;
      const fromRaw = header(headers, "From");
      const toRaw = header(headers, "To");
      messages.push({
        externalId: data.id,
        threadExternalId: data.threadId,
        from: fromRaw ? { address: fromRaw } : undefined,
        to: toRaw ? toRaw.split(",").map((address) => ({ address: address.trim() })) : [],
        subject: header(headers, "Subject"),
        bodyText: decodeBody(data.payload),
        receivedAt: data.internalDate ? new Date(Number(data.internalDate)) : undefined,
      });
    }

    return { messages, nextCursor: list.data.nextPageToken ?? undefined };
  }

  async createDraft(input: EmailDraft) {
    const gmail = await this.api();
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodeMime(input),
          ...(input.replyToExternalMessageId ? { threadId: input.replyToExternalMessageId } : {}),
        },
      },
    });
    const draftId = response.data.id;
    const threadId = response.data.message?.threadId;
    if (!draftId || !threadId) throw new Error("Gmail draft creation returned incomplete identifiers");
    return { externalMessageId: draftId, threadExternalId: threadId };
  }

  async sendDraft(externalMessageId: string) {
    const gmail = await this.api();
    const response = await gmail.users.drafts.send({
      userId: "me",
      requestBody: { id: externalMessageId },
    });
    return {
      sentAt: new Date(),
      externalMessageId: response.data.id ?? undefined,
      threadExternalId: response.data.threadId ?? undefined,
    };
  }
}
