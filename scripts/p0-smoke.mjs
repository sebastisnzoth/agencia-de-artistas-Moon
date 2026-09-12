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

const pricingPolicy = await call("/api/pricing-policies", {
  method: "PUT",
  body: body({
    artistId: artist.id,
    currency: "USD",
    minimumCents: 100000,
    autonomousMinCents: 120000,
    targetCents: 150000,
    autonomousMaxCents: 180000,
    maximumCents: 220000,
    notes: "P0 smoke pricing policy",
  }),
}, headers);

if (!pricingPolicy.id) throw new Error("Pricing policy must be persisted");

const scoutCandidate = {
  source: "p0-smoke-scout",
  sourceKey: `venue-show-${stamp}`,
  sourceUrl: `https://example.com/opportunities/${stamp}`,
  title: `Live show ${stamp}`,
  description: "Paid live performance opportunity",
  score: 90,
  valueCents: 150000,
  currency: "USD",
  contact: {
    name: "Venue Buyer",
    email: `buyer-${stamp}@example.com`,
    organization: "Smoke Venue",
    kind: "venue",
  },
};

const scout = await call("/api/scout/opportunities", {
  method: "POST",
  body: body({ artistId: artist.id, candidates: [scoutCandidate] }),
}, headers);

if (scout.metrics.created !== 1 || scout.metrics.duplicates !== 0) {
  throw new Error(`Scout must create first candidate: ${JSON.stringify(scout.metrics)}`);
}

const duplicateScout = await call("/api/scout/opportunities", {
  method: "POST",
  body: body({ artistId: artist.id, candidates: [scoutCandidate] }),
}, headers);

if (duplicateScout.metrics.created !== 0 || duplicateScout.metrics.duplicates !== 1) {
  throw new Error(`Scout must deduplicate repeated candidate: ${JSON.stringify(duplicateScout.metrics)}`);
}

const opportunityId = scout.evidence.created[0]?.opportunityId;
const leadId = scout.evidence.created[0]?.leadId;
if (!opportunityId || !leadId) throw new Error("Scout must create opportunity and lead");

const opportunities = await call("/api/opportunities", {}, headers);
const opportunity = opportunities.find((item) => item.id === opportunityId);
if (!opportunity?.contact?.id || !opportunity.contact.email) {
  throw new Error("Scout opportunity must link prospect contact");
}
const contact = opportunity.contact;

await call(`/api/leads/${leadId}`, {
  method: "PATCH",
  body: body({ status: "CONTACT_READY" }),
}, headers);

await call(`/api/leads/${leadId}`, {
  method: "PATCH",
  body: body({ status: "CONTACTED", nextAction: "Continue conversation" }),
}, headers);

const draft = await call("/api/email/drafts", {
  method: "POST",
  body: body({
    opportunityId,
    contactId: contact.id,
    toAddresses: [contact.email],
    subject: "Booking inquiry",
    bodyText: "We would like to discuss a live performance booking.",
  }),
}, headers);

if (!draft.conversationId) throw new Error("Outbound draft must create a conversation");

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

const inbound = await call("/api/email/ingest", {
  method: "POST",
  body: body({
    provider: "gmail",
    threadExternalId: `thread-${stamp}`,
    messageExternalId: `reply-${stamp}`,
    opportunityId,
    contactId: contact.id,
    fromAddress: contact.email,
    toAddresses: [bootstrap.user.email],
    subject: "Re: Booking inquiry",
    bodyText: "Nos interesa. ¿Cuál es el precio? Mandame el presupuesto para avanzar.",
  }),
}, headers);

if (!inbound.conversationId) throw new Error("Inbound reply must attach to a conversation");

const classification = await call(`/api/conversations/${inbound.conversationId}/classify`, {
  method: "POST",
  body: body({}),
}, headers);

if (classification.classification.intent !== "PRICING") {
  throw new Error(`Expected PRICING reply classification, got ${JSON.stringify(classification)}`);
}

const priorities = await call(`/api/manager/priorities?artistId=${artist.id}&limit=5`, {}, headers);
if (!priorities.runId || priorities.priorities.length === 0) {
  throw new Error(`Manager must generate daily priorities: ${JSON.stringify(priorities)}`);
}
if (!priorities.priorities.some((item) => item.opportunityId === opportunityId)) {
  throw new Error("Replied opportunity should appear in manager priorities");
}

const conversations = await call(`/api/conversations?opportunityId=${opportunityId}`, {}, headers);
const conversation = conversations.find((item) => item.id === inbound.conversationId);
if (!conversation || conversation.status !== "REPLIED") {
  throw new Error(`Expected REPLIED conversation, got ${JSON.stringify(conversation)}`);
}

const proposalResult = await call("/api/booking/generate-proposal", {
  method: "POST",
  body: body({
    opportunityId,
    amountCents: 150000,
    currency: "USD",
    durationMinutes: 120,
    notes: "Generated automatically from qualified booking context.",
  }),
}, headers);

if (!proposalResult.approval?.id || proposalResult.proposal.status !== "PENDING_APPROVAL") {
  throw new Error(`Generated proposal must require approval: ${JSON.stringify(proposalResult)}`);
}
if (proposalResult.pricing?.reason !== "within_autonomous_band" || proposalResult.pricing?.level !== "A1") {
  throw new Error(`Expected A1 pricing guardrail decision: ${JSON.stringify(proposalResult.pricing)}`);
}

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

console.log(JSON.stringify({
  ok: true,
  workspaceId: bootstrap.workspace.id,
  artistId: artist.id,
  pricingPolicyId: pricingPolicy.id,
  scoutRunId: scout.runId,
  managerRunId: priorities.runId,
  opportunityId,
  leadId,
  conversationId: conversation.id,
  classificationRunId: classification.runId,
  proposalRunId: proposalResult.runId,
  proposalId: proposalResult.proposal.id,
  dealId: deal.id,
  eventId: event.id,
  emailMessageId: draft.message.id,
  followUpTaskId: delivery.followUpTaskId,
}, null, 2));
