"use client";

import { useEffect, useState } from "react";

type GoogleStatus = {
  connected: boolean;
  connection: null | {
    email: string | null;
    scopes: string[];
    connectedAt: string;
  };
};

type Permission = {
  toolName: string;
  enabled: boolean;
  autonomyLevel: "A0" | "A1" | "A2" | "A3";
  scopes: string[];
};

export default function IntegrationsPage() {
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [statusResponse, permissionsResponse] = await Promise.all([
      fetch("/api/integrations/google/status", { cache: "no-store" }),
      fetch("/api/tool-permissions", { cache: "no-store" }),
    ]);

    if (statusResponse.ok) {
      const payload = await statusResponse.json();
      setGoogle(payload.data);
    }
    if (permissionsResponse.ok) {
      const payload = await permissionsResponse.json();
      setPermissions(payload.data);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function setPermission(permission: Permission, enabled: boolean) {
    setMessage("");
    const response = await fetch("/api/tool-permissions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...permission, enabled }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo actualizar el permiso");
      return;
    }
    setMessage(`${permission.toolName}: ${enabled ? "habilitado" : "deshabilitado"}`);
    await refresh();
  }

  async function disconnect() {
    setMessage("");
    const response = await fetch("/api/integrations/google/disconnect", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo desconectar Google");
      return;
    }
    setMessage("Google desconectado");
    await refresh();
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui" }}>
      <a href="/" style={{ color: "inherit" }}>← MOON</a>
      <h1>Integraciones</h1>
      <p>Google OAuth habilita identidad, Gmail y Calendar. Los permisos operativos siguen separados.</p>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 20, marginTop: 28 }}>
        <h2>Google</h2>
        {google?.connected ? (
          <>
            <p>Conectado como <strong>{google.connection?.email ?? "cuenta Google"}</strong></p>
            <button onClick={() => void disconnect()}>Desconectar Google</button>
          </>
        ) : (
          <a href="/api/auth/google/start">Entrar / conectar Google</a>
        )}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 20, marginTop: 20 }}>
        <h2>Autonomía operativa</h2>
        <p style={{ opacity: 0.7 }}>
          La lectura de Gmail puede quedar en A0. Envío y escritura en calendario se mantienen apagados por defecto hasta que un owner/admin los habilite.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {permissions.map((permission) => (
            <div key={permission.toolName} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
              <div>
                <strong>{permission.toolName}</strong>
                <div style={{ opacity: 0.65 }}>Nivel {permission.autonomyLevel} · {permission.scopes.join(", ")}</div>
              </div>
              <button onClick={() => void setPermission(permission, !permission.enabled)}>
                {permission.enabled ? "Deshabilitar" : "Habilitar"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {message ? <p style={{ marginTop: 20 }}>{message}</p> : null}
    </main>
  );
}
