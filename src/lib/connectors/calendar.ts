export type CalendarEventInput = {
  title: string;
  startsAt: Date;
  endsAt?: Date;
  timezone: string;
  location?: string;
  notes?: string;
};

export interface CalendarConnector {
  readonly provider: string;

  listBusyWindows(input: {
    from: Date;
    to: Date;
  }): Promise<Array<{ startsAt: Date; endsAt: Date }>>;

  createEvent(input: CalendarEventInput): Promise<{
    externalEventId: string;
  }>;

  updateEvent(
    externalEventId: string,
    input: Partial<CalendarEventInput>,
  ): Promise<void>;
}

export class CalendarConnectorNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Calendar connector ${provider} is not configured`);
    this.name = "CalendarConnectorNotConfiguredError";
  }
}
