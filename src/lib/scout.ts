import crypto from "node:crypto";

export type ScoutCandidate = {
  source: string;
  sourceKey?: string;
  sourceUrl?: string;
  title: string;
  description?: string;
  score?: number;
  valueCents?: number;
  currency?: string;
  contact?: {
    name: string;
    email?: string;
    organization?: string;
    kind?: string;
  };
};

function normalize(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function opportunityDedupeKey(artistId: string, candidate: ScoutCandidate) {
  const identity = candidate.sourceKey
    ? `${normalize(candidate.source)}|key:${normalize(candidate.sourceKey)}`
    : candidate.sourceUrl
      ? `${normalize(candidate.source)}|url:${normalize(candidate.sourceUrl)}`
      : [
          normalize(candidate.source),
          normalize(candidate.title),
          normalize(candidate.contact?.organization),
          normalize(candidate.contact?.email),
        ].join("|");

  return crypto
    .createHash("sha256")
    .update(`${artistId}|${identity}`)
    .digest("hex");
}

export type ReplyIntent =
  | "POSITIVE"
  | "NEGATIVE"
  | "PRICING"
  | "AVAILABILITY"
  | "QUESTION"
  | "NEUTRAL";

export type ReplyClassification = {
  intent: ReplyIntent;
  confidence: number;
  nextAction: string;
  shouldAdvanceNegotiation: boolean;
  shouldClose: boolean;
};

const patterns: Array<{
  intent: ReplyIntent;
  terms: string[];
  nextAction: string;
  shouldAdvanceNegotiation?: boolean;
  shouldClose?: boolean;
}> = [
  {
    intent: "NEGATIVE",
    terms: ["no gracias", "no interesa", "no estamos interesados", "not interested", "não temos interesse", "nao temos interesse", "decline", "rechaz"],
    nextAction: "Cerrar oportunidad como perdida y registrar motivo.",
    shouldClose: true,
  },
  {
    intent: "PRICING",
    terms: ["precio", "presupuesto", "cachet", "caché", "valor", "quanto custa", "preço", "price", "budget", "fee", "quote", "cotización", "cotizacao", "cotação"],
    nextAction: "Preparar propuesta comercial dentro de los límites de pricing autorizados.",
    shouldAdvanceNegotiation: true,
  },
  {
    intent: "AVAILABILITY",
    terms: ["disponible", "disponibilidad", "fecha", "datas", "data", "available", "availability", "date", "agenda", "calendar"],
    nextAction: "Verificar disponibilidad y responder con opciones de fecha autorizadas.",
    shouldAdvanceNegotiation: true,
  },
  {
    intent: "POSITIVE",
    terms: ["me interesa", "nos interesa", "interesado", "interessado", "interesse", "sounds good", "interested", "perfecto", "perfeito", "vamos", "let's do", "aceptamos", "aceitamos"],
    nextAction: "Avanzar negociación y preparar propuesta o confirmación del siguiente paso.",
    shouldAdvanceNegotiation: true,
  },
];

export function classifyCommercialReply(text: string): ReplyClassification {
  const normalized = normalize(text);

  for (const rule of patterns) {
    if (rule.terms.some((term) => normalized.includes(normalize(term)))) {
      return {
        intent: rule.intent,
        confidence: 0.82,
        nextAction: rule.nextAction,
        shouldAdvanceNegotiation: Boolean(rule.shouldAdvanceNegotiation),
        shouldClose: Boolean(rule.shouldClose),
      };
    }
  }

  if (normalized.includes("?")) {
    return {
      intent: "QUESTION",
      confidence: 0.68,
      nextAction: "Responder la consulta y mantener la conversación activa.",
      shouldAdvanceNegotiation: false,
      shouldClose: false,
    };
  }

  return {
    intent: "NEUTRAL",
    confidence: 0.5,
    nextAction: "Revisar la respuesta y definir el próximo paso comercial.",
    shouldAdvanceNegotiation: false,
    shouldClose: false,
  };
}
