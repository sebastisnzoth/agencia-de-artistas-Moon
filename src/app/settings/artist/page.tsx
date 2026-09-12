"use client";

import { FormEvent, useEffect, useState } from "react";

type Artist = {
  id: string;
  stageName: string;
  genres: string[];
  languages: string[];
  territories: string[];
};

type PricingPolicy = {
  id: string;
  artistId: string;
  currency: string;
  minimumCents: number;
  targetCents: number | null;
  autonomousMinCents: number | null;
  autonomousMaxCents: number | null;
  maximumCents: number | null;
};

const moneyToCents = (value: string) => Math.round(Number(value || 0) * 100);
const centsToMoney = (value: number | null | undefined) => value == null ? "" : (value / 100).toFixed(2);

export default function ArtistSettingsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [message, setMessage] = useState("");

  async function refreshArtists() {
    const response = await fetch("/api/artists", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const list = payload.data ?? [];
    setArtists(list);
    if (!selectedArtistId && list[0]?.id) setSelectedArtistId(list[0].id);
  }

  async function refreshPricing(artistId: string) {
    if (!artistId) {
      setPolicies([]);
      return;
    }
    const response = await fetch(`/api/pricing-policies?artistId=${encodeURIComponent(artistId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setPolicies(payload.data ?? []);
  }

  useEffect(() => {
    void refreshArtists();
  }, []);

  useEffect(() => {
    void refreshPricing(selectedArtistId);
  }, [selectedArtistId]);

  async function createArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const split = (name: string) => String(form.get(name) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const response = await fetch("/api/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stageName: String(form.get("stageName") ?? ""),
        genres: split("genres"),
        languages: split("languages"),
        territories: split("territories"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear el artista");
      return;
    }
    setMessage("Artista creado");
    setSelectedArtistId(payload.data.id);
    event.currentTarget.reset();
    await refreshArtists();
  }

  async function savePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedArtistId) return;
    setMessage("");
    const form = new FormData(event.currentTarget);
    const optionalMoney = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw ? moneyToCents(raw) : undefined;
    };
    const response = await fetch("/api/pricing-policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artistId: selectedArtistId,
        name: "default",
        currency: String(form.get("currency") ?? "USD").toUpperCase(),
        minimumCents: moneyToCents(String(form.get("minimum") ?? "0")),
        targetCents: optionalMoney("target"),
        autonomousMinCents: optionalMoney("autonomousMin"),
        autonomousMaxCents: optionalMoney("autonomousMax"),
        maximumCents: optionalMoney("maximum"),
        active: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo guardar la política de precios");
      return;
    }
    setMessage("Política de precios guardada");
    await refreshPricing(selectedArtistId);
  }

  const currentPolicy = policies[0];

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui" }}>
      <nav style={{ display: "flex", gap: 14 }}>
        <a href="/dashboard">← Dashboard</a>
        <a href="/settings/integrations">Integraciones</a>
      </nav>
      <h1>Artist Workspace</h1>
      <p>Configuración mínima para que MOON pueda buscar, priorizar y cotizar sin salir de los límites del artista.</p>

      <section style={{ marginTop: 28, border: "1px solid #ddd", borderRadius: 16, padding: 20 }}>
        <h2>Artistas</h2>
        {artists.length ? (
          <select value={selectedArtistId} onChange={(event) => setSelectedArtistId(event.target.value)}>
            {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.stageName}</option>)}
          </select>
        ) : <p style={{ opacity: 0.7 }}>Todavía no hay artistas en este workspace.</p>}

        <form onSubmit={(event) => void createArtist(event)} style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <h3>Crear artista</h3>
          <input name="stageName" required placeholder="Nombre artístico" />
          <input name="genres" placeholder="Géneros, separados por coma" />
          <input name="languages" placeholder="Idiomas, ej. es, pt, en" />
          <input name="territories" placeholder="Territorios, ej. BR, AR" />
          <button type="submit">Crear artista</button>
        </form>
      </section>

      {selectedArtistId ? (
        <section style={{ marginTop: 20, border: "1px solid #ddd", borderRadius: 16, padding: 20 }}>
          <h2>Pricing guardrails</h2>
          <p style={{ opacity: 0.7 }}>Dentro de la banda autónoma MOON puede cotizar en A1. Fuera de ella escala a A2.</p>
          <form onSubmit={(event) => void savePricing(event)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label>Moneda<input name="currency" defaultValue={currentPolicy?.currency ?? "USD"} maxLength={3} required /></label>
            <label>Mínimo<input name="minimum" type="number" min="0" step="0.01" required defaultValue={centsToMoney(currentPolicy?.minimumCents)} /></label>
            <label>Autónomo mínimo<input name="autonomousMin" type="number" min="0" step="0.01" defaultValue={centsToMoney(currentPolicy?.autonomousMinCents)} /></label>
            <label>Objetivo<input name="target" type="number" min="0" step="0.01" defaultValue={centsToMoney(currentPolicy?.targetCents)} /></label>
            <label>Autónomo máximo<input name="autonomousMax" type="number" min="0" step="0.01" defaultValue={centsToMoney(currentPolicy?.autonomousMaxCents)} /></label>
            <label>Máximo<input name="maximum" type="number" min="0" step="0.01" defaultValue={centsToMoney(currentPolicy?.maximumCents)} /></label>
            <div style={{ gridColumn: "1 / -1" }}><button type="submit">Guardar política</button></div>
          </form>
        </section>
      ) : null}

      {message ? <p style={{ marginTop: 20 }}>{message}</p> : null}
    </main>
  );
}
