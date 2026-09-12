const stages = [
  "Oportunidad",
  "Contacto",
  "Conversación",
  "Propuesta",
  "Aprobación",
  "Acuerdo",
  "Calendario",
  "Seguimiento",
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui" }}>
      <p style={{ letterSpacing: 2, textTransform: "uppercase", opacity: 0.65 }}>MOON · Autonomous Artist Agency</p>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>Artist Workspace</h1>
      <p style={{ fontSize: 20, maxWidth: 720 }}>
        Centro operativo multiartista para convertir oportunidades en trabajos cerrados con trazabilidad y control.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
        <a
          href="/api/auth/google/start"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 12,
            background: "#111",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Entrar / conectar Google
        </a>
        <a href="/dashboard">Abrir dashboard</a>
        <a href="/settings/integrations">Integraciones</a>
        <span style={{ opacity: 0.65 }}>
          Gmail + Google Calendar con OAuth y permisos controlados.
        </span>
      </div>

      <section style={{ marginTop: 48 }}>
        <h2>Pipeline P0</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {stages.map((stage, index) => (
            <article key={stage} style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
              <small>Paso {index + 1}</small>
              <h3>{stage}</h3>
              <p style={{ opacity: 0.7 }}>Controlado por el workspace activo</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 40, padding: 24, border: "1px solid #ddd", borderRadius: 16 }}>
        <h2>Prioridad del Manager IA</h2>
        <p>Detectar el bloqueo que impide conseguir, gestionar y convertir la próxima oportunidad real.</p>
      </section>
    </main>
  );
}
