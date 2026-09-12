export type EmailAddress = {
  address: string;
  name?: string;
};

export type EmailDraft = {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyText: string;
  replyToExternalMessageId?: string;
};

export type ProviderEmailMessage = {
  externalId: string;
  threadExternalId: string;
  from?: EmailAddress;
  to: EmailAddress[];
  subject?: string;
  bodyText?: string;
  sentAt?: Date;
  receivedAt?: Date;
};

export interface EmailConnector {
  readonly provider: string;

  listRecentMessages(input: {
    since?: Date;
    cursor?: string;
    limit?: number;
  }): Promise<{ messages: ProviderEmailMessage[]; nextCursor?: string }>;

  createDraft(input: EmailDraft): Promise<{
    externalMessageId: string;
    threadExternalId: string;
  }>;

  sendDraft(externalMessageId: string): Promise<{
    sentAt: Date;
    externalMessageId?: string;
    threadExternalId?: string;
  }>;
}

export class EmailConnectorNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Email connector ${provider} is not configured`);
    this.name = "EmailConnectorNotConfiguredError";
  }
}
