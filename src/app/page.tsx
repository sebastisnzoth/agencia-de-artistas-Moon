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

      <section style={{ marginTop: 48 }}>
        <h2>Pipeline P0</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {stages.map((stage, index) => (
            <article key={stage} style={{ border: "1px solid #ddd", borderRadius: 16, padding: 18 }}>
              <small>Paso {index + 1}</small>
              <h3>{stage}</h3>
              <p style={{ opacity: 0.7 }}>0 activos</p>
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
