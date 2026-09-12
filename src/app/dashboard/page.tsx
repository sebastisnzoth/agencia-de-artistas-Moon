"use client";

import { useEffect, useState } from "react";

type Me = {
  id: string;
  email: string;
  name: string | null;
  memberships: Array<{
    role: string;
    workspace: { id: string; name: string; slug: string };
  }>;
};

type Opportunity = { id: string; status: string; title: string; nextAction?: string | null };
type Approval = { id: string; status: string; actionType: string; summary: string };
type Conversation = { id: string; status: string; subject?: string | null };

type PriorityResult = {
  runId: string;
  output: {
    summary: string;
    next_actions: Array<{
      type?: string;
      action?: string;
      title?: string;
      score?: number;
      opportunityId?: string;
    }>;
  };
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [priorities, setPriorities] = useState<PriorityResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [runningPriorities, setRunningPriorities] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");

    const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
    if (!meResponse.ok) {
      setLoading(false);
      setMe(null);
      return;
    }

    const mePayload = await meResponse.json();
    setMe(mePayload.data);

    const [opportunityResponse, approvalResponse, conversationResponse] = await Promise.all([
      fetch("/api/opportunities", { cache: "no-store" }),
      fetch("/api/approvals", { cache: "no-store" }),
      fetch("/api/conversations", { cache: "no-store" }),
    ]);

    if (!opportunityResponse.ok || !approvalResponse.ok || !conversationResponse.ok) {
      setError("La sesión existe, pero el workspace operativo todavía no está listo.");
      setLoading(false);
      return;
    }

    const [opportunityPayload, approvalPayload, conversationPayload] = await Promise.all([
      opportunityResponse.json(),
      approvalResponse.json(),
      conversationResponse.json(),
    ]);

    setOpportunities(opportunityPayload.data ?? []);
    setApprovals(approvalPayload.data ?? []);
    setConversations(conversationPayload.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runPriorities() {
    setRunningPriorities(true);
    setError("");
    const response = await fetch("/api/manager/priorities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 8 }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudieron generar prioridades");
      setRunningPriorities(false);
      return;
    }
    setPriorities(payload.data);
    setRunningPriorities(false);
  }

  if (loading) {
    return <main style={{ padding: 40, fontFamily: "system-ui" }}>Cargando MOON…</main>;
  }

  if (!me) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px", fontFamily: "system-ui" }}>
        <p style={{ letterSpacing: 2, textTransform: "uppercase", opacity: 0.65 }}>MOON</p>
        <h1>Dashboard operativo</h1>
        <p>Iniciá sesión con Google para entrar al workspace y comenzar las pruebas.</p>
        <a href="/api/auth/google/start">Entrar con Google</a>
      </main>
    );
  }

  const pendingApprovals = approvals.filter((item) => item.status === "PENDING").length;
  const activeOpportunities = opportunities.filter((item) => !["WON", "LOST"].includes(item.status)).length;
  const openConversations = conversations.filter((item) => item.status !== "CLOSED").length;

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ letterSpacing: 2, textTransform: "uppercase", opacity: 0.65 }}>MOON · General Manager</p>
          <h1 style={{ marginBottom: 4 }}>Centro operativo</h1>
          <p style={{ opacity: 0.7, marginTop: 0 }}>{me.name ?? me.email}</p>
        </div>
        <nav style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/settings/artist">Artista y precios</a>
          <a href="/settings/integrations">Integraciones</a>
          <a href="/">Inicio</a>
        </nav>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 28 }}>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}><strong>{activeOpportunities}</strong><div>Oportunidades activas</div></article>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}><strong>{openConversations}</strong><div>Conversaciones abiertas</div></article>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}><strong>{pendingApprovals}</strong><div>Aprobaciones pendientes</div></article>
        <article style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}><strong>{me.memberships.length}</strong><div>Workspaces</div></article>
      </section>

      <section style={{ marginTop: 28, border: "1px solid #ddd", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Prioridades del Manager IA</h2>
            <p style={{ marginTop: 0, opacity: 0.7 }}>Ordena el trabajo por replies, negociación, deadlines, score y próximos pasos.</p>
          </div>
          <button onClick={() => void runPriorities()} disabled={runningPriorities}>
            {runningPriorities ? "Analizando…" : "Generar prioridades"}
          </button>
        </div>
        {priorities ? (
          <div style={{ marginTop: 16 }}>
            <p><strong>{priorities.output.summary}</strong></p>
            <ol>
              {priorities.output.next_actions.map((item, index) => (
                <li key={`${item.opportunityId ?? "priority"}-${index}`} style={{ marginBottom: 8 }}>
                  {item.title ?? item.action ?? item.type ?? "Siguiente acción"}
                  {typeof item.score === "number" ? ` · score ${item.score}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Pipeline actual</h2>
        {opportunities.length === 0 ? <p style={{ opacity: 0.7 }}>Todavía no hay oportunidades en este workspace.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {opportunities.slice(0, 12).map((opportunity) => (
              <article key={opportunity.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
                <strong>{opportunity.title}</strong>
                <div style={{ opacity: 0.7 }}>{opportunity.status} · {opportunity.nextAction ?? "Sin próximo paso"}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      {error ? <p style={{ marginTop: 24, color: "crimson" }}>{error}</p> : null}
    </main>
  );
}
