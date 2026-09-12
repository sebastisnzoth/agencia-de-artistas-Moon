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
- Conversation como entidad persistente del flujo comercial;
- drafts de email que crean/relacionan Conversation;
- ingestión inbound que cambia Conversation a `REPLIED`;
- envío outbound que cambia Conversation a `WAITING_FOR_REPLY`;
- propuestas y aprobaciones;
- Deal;
- Event/Calendar;
- follow-up automático después de email enviado;
- Gmail y Google Calendar connectors;
- permisos de tools A0/A1/A2/A3;
- auditoría;
- smoke test del flujo P0;
- CI con Prisma validate, lint, typecheck y build.

Próximo cuello de botella P0:

1. Opportunity Scout con ingestión/deduplicación automática.
2. Clasificación de replies y recomendación de siguiente acción comercial.
3. Generación de pitch/propuesta a partir del contexto del artista y oportunidad.
4. Ejecutar el flujo con una oportunidad real y medir tiempo a primera conversión.

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

Estimación técnica actual: **~88% del flujo P0 ejecutable**, todavía sin contar una validación real con prospecto/cliente externo.
