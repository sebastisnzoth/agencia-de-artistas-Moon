# MOON — EXECUTION HANDOFF

Este archivo es el estado operativo vivo para ChatGPT, Codex y cualquier agente que continúe el trabajo.

Estados válidos: `NEXT`, `IN PROGRESS`, `IMPLEMENTED`, `VALIDATED`, `RELEASED`, `BLOCKED`.

## Estado general

Producto: MOON — Autonomous AI Artist Agency  
Rama operativa: `main`  
Objetivo actual: dejar el P0 técnicamente validado y listo para una prueba real controlada.

## P0 actual

### VALIDATED

- Arquitectura base Next.js + TypeScript + Prisma/PostgreSQL.
- Modelo multi-tenant con workspace isolation.
- Google OAuth + sesión firmada.
- Gmail connector real.
- Google Calendar connector real.
- CRM básico.
- Opportunity + Lead pipeline.
- Conversation persistente.
- Proposal + Approval + Deal + Event.
- Opportunity Scout con deduplicación.
- Reply classification.
- PricingPolicy con guardrails A1/A2.
- Manager IA con prioridades comerciales.
- ToolPermission A0/A1/A2/A3.
- AuditEvent y AgentRun.
- Production readiness endpoint/checks.
- Seguridad base y headers.

### IN PROGRESS

- Gate de CI limpio para deploy de prueba.
  - Corregir warnings/errors de lint restantes.
  - Confirmar Prisma validate.
  - Confirmar typecheck.
  - Confirmar build.
  - Verificar que el último commit de preparación deje CI verde.

### NEXT

1. Completar gate CI y dejar `main` verde.
2. Revisar configuración de deploy de prueba segura.
3. Preparar proyecto Vercel para MOON sin ejecutar producción irreversible.
4. Definir/configurar base PostgreSQL persistente de prueba.
5. Configurar variables requeridas fuera del repo.
6. Validar `/api/readiness` en entorno desplegado.
7. Iniciar sesión Google en entorno de prueba.
8. Crear/cargar Artist Workspace piloto.
9. Cargar pricing real y límites comerciales.
10. Ejecutar primera oportunidad/prospecto real controlado.
11. Medir reply, propuesta, aprobación, cierre y calendarización.

### BLOCKED

- Deploy real de prueba en Vercel: requiere que exista/vincule un proyecto Vercel y que el entorno tenga secretos/configuración reales.
- PostgreSQL persistente externo: requiere un recurso de base de datos disponible y su `DATABASE_URL`.
- Google OAuth público/real: requiere credenciales/configuración de Google Cloud y redirect URI del dominio final de prueba.

Estos bloqueos no impiden seguir haciendo hardening, CI, documentación y preparación de deploy.

### IMPLEMENTED pero pendiente de VALIDATED

- Dashboard operativo y navegación interna actualizada.
- Artist Workspace + pricing settings UI.
- Correcciones recientes de lint de navegación y Prisma singleton.

### RELEASED

- Ningún release de MOON debe considerarse `RELEASED` hasta verificar un deploy de prueba o producción en el entorno objetivo.

## Regla de continuidad

El agente que lea este archivo debe tomar el primer ítem `NEXT` que no dependa de un `BLOCKED`, moverlo a `IN PROGRESS`, ejecutarlo, verificarlo y actualizar este documento.

No pedir al usuario una orden general para continuar. Solo pedir una acción puntual cuando sea imposible avanzar sin producción, dinero, credenciales, consentimiento externo o una decisión crítica.

## Última dirección operativa

Camino corto a validación:

`CI verde -> preview seguro -> infraestructura real -> OAuth -> workspace piloto -> prospecto real -> propuesta -> aprobación -> deal -> calendar -> métricas`
