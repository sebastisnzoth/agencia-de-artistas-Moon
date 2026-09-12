# MOON — PRODUCT ROADMAP

Este roadmap deriva de `docs/MOON_MASTER.md` y prioriza validación comercial antes que amplitud funcional.

## Fase 0 — Fundaciones

Objetivo: dejar el repositorio listo para desarrollar sin deuda estructural temprana.

Entregables:
- arquitectura base;
- autenticación;
- modelo multi-tenant;
- modelo de datos inicial;
- sistema de permisos;
- auditoría;
- configuración de entornos;
- CI básico;
- convenciones de código;
- observabilidad mínima.

Criterio de salida:
- crear dos workspaces sin contaminación de datos;
- autenticar usuario;
- persistir entidades asociadas a workspace;
- registrar audit events.

## Fase 1 — P0 Comercial

Objetivo: cerrar el primer trabajo usando MOON.

### Epic 1 — Artist Workspace
- alta de artista;
- objetivos;
- territorios;
- idiomas;
- géneros;
- pricing rules;
- restricciones;
- disponibilidad;
- EPK/assets.

### Epic 2 — CRM
- contactos;
- organizaciones;
- venues;
- leads;
- notas;
- historial;
- pipeline.

### Epic 3 — Opportunity Scout
- crear/importar oportunidad;
- score;
- deduplicación;
- estado;
- fuente;
- asignación a artista.

### Epic 4 — Email
- OAuth;
- inbox ingest;
- clasificación;
- thread linking;
- draft;
- send policy;
- follow-up scheduler.

### Epic 5 — Booking
- lead qualification;
- pitch generation;
- proposal generation;
- negotiation state;
- pricing guardrails.

### Epic 6 — Approvals
- cola de aprobaciones;
- resumen ejecutivo;
- aprobar/rechazar/modificar;
- expiración;
- audit trail.

### Epic 7 — Deal & Calendar
- deal won/lost;
- evento;
- disponibilidad;
- detección de conflicto;
- follow-up posterior.

Criterio de salida de Fase 1:

Un artista debe poder pasar por:

`opportunity -> contact -> conversation -> proposal -> approval -> won -> scheduled`

con evidencia y auditoría completas.

## Fase 2 — Agencia Operativa

Objetivo: que MOON gestione el trabajo posterior al cierre.

- contratos;
- facturación;
- cuentas a cobrar;
- logística;
- contenido asociado al show/lanzamiento;
- PR;
- calendario editorial;
- analytics comercial;
- dashboard general.

## Fase 3 — Autonomía avanzada

Objetivo: reducir al mínimo la intervención del artista.

- prioridades automáticas diarias;
- campañas outbound autónomas con límites;
- follow-ups adaptativos;
- negociación asistida por política;
- recomendación de pricing;
- matching artista/oportunidad;
- evaluación continua de agentes;
- learning loops.

## Fase 4 — SaaS Multiartista

Objetivo: vender MOON a otros artistas, managers o agencias.

- onboarding self-service;
- billing;
- planes;
- límites de uso;
- equipos;
- roles;
- white-label opcional;
- administración global;
- métricas SaaS;
- soporte y recuperación.

## Primeros P0 técnicos

Orden recomendado por el Software Architect Agent:

1. Inicializar aplicación y tooling.
2. Definir modelo de datos multi-tenant.
3. Auth + workspace isolation.
4. AuditEvent + Approval primitives.
5. Artist onboarding.
6. CRM mínimo.
7. Opportunity pipeline.
8. Email connector abstraction.
9. AgentRun + tool permission layer.
10. Booking/proposal flow.
11. Calendar connector abstraction.
12. E2E del flujo crítico.

## Estado de implementación actual

Implementado en `main`:

- aplicación Next.js + TypeScript + Prisma/PostgreSQL;
- autenticación Google OAuth de producción y sesiones firmadas;
- aislamiento por workspace;
- Artist Workspace base;
- contactos CRM;
- oportunidades con creación automática de Lead;
- pipeline de Lead auditado;
- Opportunity Scout con ingestión por lotes;
- deduplicación estable por artista, fuente y referencia externa;
- creación/reutilización de contacto desde Scout;
- AgentRun estandarizado para ejecuciones de Scout;
- Conversation como entidad persistente del flujo comercial;
- drafts de email que crean/relacionan Conversation;
- ingestión inbound que cambia Conversation a `REPLIED`;
- envío outbound que cambia Conversation a `WAITING_FOR_REPLY`;
- clasificación automática de replies comerciales en español/portugués/inglés;
- actualización automática de Opportunity, Lead y próximo paso según intención detectada;
- generación contextual de propuesta comercial;
- PricingPolicy persistente por artista/moneda con mínimo, target, banda autónoma y máximo;
- evaluación A1/A2 de pricing antes de generar propuesta;
- excepciones de precio elevadas explícitamente a aprobación;
- toda propuesta generada automáticamente queda detrás de aprobación antes del envío;
- priorización diaria automática del General Manager sobre tareas, oportunidades y conversaciones;
- scoring de prioridad por reply, negociación, deadlines, follow-up y score comercial;
- propuestas y aprobaciones;
- Deal;
- Event/Calendar;
- follow-up automático después de email enviado;
- Gmail y Google Calendar connectors;
- permisos de tools A0/A1/A2/A3;
- auditoría;
- smoke test del flujo P0 incluyendo Scout, dedupe, Conversation, clasificación, pricing guardrails, prioridades y propuesta generada;
- CI con Prisma validate, lint, typecheck y build.

## Camino restante P0

El foco deja de ser agregar estructura y pasa a validación operacional real.

1. **Infraestructura de producción**
   - base PostgreSQL persistente;
   - variables de entorno y secretos fuera del repo;
   - OAuth Google configurado en dominio real;
   - migración/esquema aplicado de forma reproducible;
   - observabilidad mínima de errores y AgentRun.

2. **Artist Workspace completo para primera validación**
   - cargar pricing policy real del artista piloto;
   - restricciones comerciales;
   - disponibilidad real;
   - EPK/assets esenciales;
   - objetivos comerciales activos.

3. **Primera campaña comercial controlada**
   - cargar o descubrir prospectos reales;
   - priorizar con MOON General Manager;
   - preparar pitch;
   - enviar únicamente dentro de la política de autonomía vigente;
   - registrar reply/follow-up/propuesta.

4. **Cerrar primera oportunidad real**
   - propuesta;
   - aprobación;
   - acuerdo;
   - evento/calendario;
   - seguimiento posterior.

5. **Medir validación**
   - tiempo a primera oportunidad;
   - tiempo a primera respuesta;
   - propuestas enviadas;
   - tasa de respuesta;
   - ingreso cerrado;
   - intervenciones humanas necesarias;
   - errores por agente.

## Métrica de progreso

No medir progreso por cantidad de pantallas.

Medirlo por porcentaje del flujo P0 ejecutable de punta a punta.

Definición recomendada:
- 0–20%: fundaciones.
- 20–40%: artist + CRM + opportunities.
- 40–60%: email + booking.
- 60–80%: approvals + proposal/deal.
- 80–95%: calendar + follow-up + hardening.
- 95–100%: prueba real con oportunidad y cliente.

Estimación técnica actual: **~94% del flujo P0 ejecutable**. El principal bloqueo restante es operacional: infraestructura/cuentas reales, configuración comercial real del artista y ejecución con un prospecto externo medible.
