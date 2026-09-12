import { google } from "googleapis";
import type { CalendarConnector, CalendarEventInput } from "@/lib/connectors/calendar";
import { googleClientForWorkspace } from "@/lib/connectors/google-auth";

export class GoogleCalendarConnector implements CalendarConnector {
  readonly provider = "google-calendar";

  constructor(private readonly workspaceId: string) {}

  private async api() {
    const { client } = await googleClientForWorkspace(this.workspaceId);
    return google.calendar({ version: "v3", auth: client });
  }

  async listBusyWindows(input: { from: Date; to: Date }) {
    const calendar = await this.api();
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: input.from.toISOString(),
        timeMax: input.to.toISOString(),
        items: [{ id: "primary" }],
      },
    });
    return (response.data.calendars?.primary?.busy ?? [])
      .filter((item) => item.start && item.end)
      .map((item) => ({ startsAt: new Date(item.start!), endsAt: new Date(item.end!) }));
  }

  async createEvent(input: CalendarEventInput) {
    const calendar = await this.api();
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.title,
        location: input.location,
        description: input.notes,
        start: { dateTime: input.startsAt.toISOString(), timeZone: input.timezone },
        end: {
          dateTime: (input.endsAt ?? new Date(input.startsAt.getTime() + 60 * 60 * 1000)).toISOString(),
          timeZone: input.timezone,
        },
      },
    });
    if (!response.data.id) throw new Error("Google Calendar did not return event id");
    return { externalEventId: response.data.id };
  }

  async updateEvent(externalEventId: string, input: Partial<CalendarEventInput>) {
    const calendar = await this.api();
    await calendar.events.patch({
      calendarId: "primary",
      eventId: externalEventId,
      requestBody: {
        ...(input.title !== undefined ? { summary: input.title } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.notes !== undefined ? { description: input.notes } : {}),
        ...(input.startsAt
          ? { start: { dateTime: input.startsAt.toISOString(), timeZone: input.timezone ?? "UTC" } }
          : {}),
        ...(input.endsAt
          ? { end: { dateTime: input.endsAt.toISOString(), timeZone: input.timezone ?? "UTC" } }
          : {}),
      },
    });
  }
}
