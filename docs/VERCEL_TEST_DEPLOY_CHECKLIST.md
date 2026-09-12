# MOON · Gate para deploy de pruebas en Vercel

Este documento define cuándo el Software Architect puede declarar MOON listo para un deploy de pruebas. No reemplaza `MOON_MASTER.md`, `AGENTS.md` ni el roadmap.

## Gate técnico previo

Antes de desplegar a Vercel deben cumplirse todos estos puntos:

- CI de `main` verde: Prisma validate, lint, typecheck y build.
- `/api/health` disponible sin depender de servicios externos.
- `/api/readiness` debe verificar configuración y conectividad con PostgreSQL.
- No existen secretos versionados.
- Producción falla cerrada si la autenticación real no está configurada.
- Acciones Gmail/Calendar siguen protegidas por `ToolPermission` y niveles A0/A1/A2/A3.
- Pricing fuera de banda requiere A2/aprobación.
- Smoke P0 cubre Scout → Lead → Contact → Conversation → Proposal → Approval → Deal → Calendar → Follow-up.

## Variables de Vercel

Configurar como Environment Variables, nunca en el repositorio:

- `DATABASE_URL`
- `MOON_APP_URL`
- `MOON_SESSION_SECRET`
- `MOON_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Para el primer deploy de prueba:

- `MOON_APP_URL=https://<deployment-o-dominio>`
- `GOOGLE_REDIRECT_URI=https://<deployment-o-dominio>/api/auth/google/callback`

El redirect configurado en Google Cloud debe coincidir exactamente.

## Base de datos para pruebas

El deploy necesita PostgreSQL accesible desde Vercel. Para una primera prueba controlada puede inicializarse el esquema con `npm run prisma:push` contra una base vacía de testing.

Antes de considerar el entorno producción estable se debe versionar una migración Prisma inicial y usar `npm run prisma:migrate:deploy` para cambios posteriores. `db push` no es el mecanismo definitivo de producción.

## Verificación posterior al deploy

En este orden:

1. `GET /api/health` → HTTP 200 y `status=ok`.
2. `GET /api/readiness` → HTTP 200 y `status=ready`.
3. Abrir `/api/auth/google/start` y completar login.
4. Verificar `/api/auth/me`.
5. Crear/configurar artista y pricing policy.
6. Conectar Google y comprobar estado de integración.
7. Ejecutar sincronización Gmail en modo controlado.
8. Verificar prioridades del Manager IA.
9. Crear una oportunidad de prueba y recorrer el P0 sin compromisos externos no autorizados.
10. Solo después habilitar `email.send` o `calendar.write` según política.

## Criterio para declarar «listo para pruebas»

El Software Architect puede dar la señal cuando el último commit de `main` tenga CI verde y el único trabajo faltante sea configuración externa del entorno (PostgreSQL, variables Vercel y OAuth Google), no correcciones estructurales del código.
