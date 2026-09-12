const baseUrl = process.env.MOON_BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();

async function call(path, options = {}, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...headers,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

function body(value) {
  return JSON.stringify(value);
}

const bootstrap = await call("/api/dev/bootstrap", {
  method: "POST",
  body: body({
    email: `moon-smoke-${stamp}@example.com`,
    name: "MOON Smoke",
    workspaceName: `MOON Smoke ${stamp}`,
    workspaceSlug: `moon-smoke-${stamp}`,
  }),
});

const headers = {
  "x-moon-user-id": bootstrap.user.id,
  "x-moon-workspace-id": bootstrap.workspace.id,
};

const artist = await call("/api/artists", {
  method: "POST",
  body: body({
    stageName: `Artist ${stamp}`,
    genres: ["rock"],
    languages: ["es"],
    territories: ["BR", "AR"],
  }),
}, headers);

const contact = await call("/api/contacts", {
  method: "POST",
  body: body({
    name: "Venue Buyer",
    email: `buyer-${stamp}@example.com`,
    organization: "Smoke Venue",
    kind: "venue",
  }),
}, headers);

const opportunity = await call("/api/opportunities", {
  method: "POST",
  body: body({
    artistId: artist.id,
    contactId: contact.id,
    title: `Live show ${stamp}`,
    source: "p0-smoke",
    score: 90,
    valueCents: 150000,
    currency: "USD",
  }),
}, headers);

const proposalResult = await call("/api/proposals", {
  method: "POST",
  body: body({
    opportunityId: opportunity.id,
    title: "Live performance proposal",
    summary: "P0 smoke proposal",
    amountCents: 150000,
    currency: "USD",
    requestApproval: true,
  }),
}, headers);

await call(`/api/approvals/${proposalResult.approval.id}`, {
  method: "PATCH",
  body: body({ status: "APPROVED" }),
}, headers);

await call(`/api/proposals/${proposalResult.proposal.id}`, {
  method: "PATCH",
  body: body({ status: "SENT" }),
}, headers);

await call(`/api/proposals/${proposalResult.proposal.id}`, {
  method: "PATCH",
  body: body({ status: "ACCEPTED" }),
}, headers);

const deal = await call("/api/deals", {
  method: "POST",
  body: body({ proposalId: proposalResult.proposal.id }),
}, headers);

const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

const event = await call("/api/events", {
  method: "POST",
  body: body({
    dealId: deal.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: "America/Sao_Paulo",
    venue: "Smoke Venue",
  }),
}, headers);

const draft = await call("/api/email/drafts", {
  method: "POST",
  body: body({
    opportunityId: opportunity.id,
    contactId: contact.id,
    toAddresses: [contact.email],
    subject: "Booking confirmation",
    bodyText: "Thanks. We confirm the next steps for the booking.",
  }),
}, headers);

const queued = await call(`/api/email/messages/${draft.message.id}/queue`, {
  method: "POST",
  body: body({ requestedLevel: "A1" }),
}, headers);

if (queued.status !== "QUEUED") {
  throw new Error(`Expected queued email, got ${JSON.stringify(queued)}`);
}

const delivery = await call(`/api/email/messages/${draft.message.id}/delivery`, {
  method: "POST",
  body: body({
    status: "SENT",
    externalId: `smoke-message-${stamp}`,
    followUpDays: 3,
  }),
}, headers);

if (!delivery.followUpTaskId) {
  throw new Error("Expected automatic follow-up task after sent email");
}

console.log(JSON.stringify({
  ok: true,
  workspaceId: bootstrap.workspace.id,
  artistId: artist.id,
  opportunityId: opportunity.id,
  proposalId: proposalResult.proposal.id,
  dealId: deal.id,
  eventId: event.id,
  emailMessageId: draft.message.id,
  followUpTaskId: delivery.followUpTaskId,
}, null, 2));
