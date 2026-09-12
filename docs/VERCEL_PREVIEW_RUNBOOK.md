# MOON — Vercel Preview Runbook

Objetivo: desplegar MOON en un entorno de prueba controlado antes de cualquier release real.

## Precondición

No ejecutar deploy hasta que `main` tenga CI verde con:

- Prisma validate;
- lint sin warnings;
- typecheck;
- build;
- PostgreSQL efímero;
- smoke P0 de punta a punta.

## Proyecto

Crear/vincular un proyecto Vercel separado para MOON usando el repo:

`sebastisnzoth/agencia-de-artistas-Moon`

Framework: Next.js.
Rama principal: `main`.

No reutilizar proyectos de UGO ni mezclar variables entre productos.

## Variables requeridas

Configurar fuera del repo:

- `DATABASE_URL`
- `MOON_APP_URL`
- `MOON_SESSION_SECRET`
- `MOON_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Reglas:

- `MOON_SESSION_SECRET`: mínimo 32 caracteres aleatorios.
- `MOON_TOKEN_ENCRYPTION_KEY`: exactamente 32 bytes codificados en base64.
- `MOON_APP_URL`: URL HTTPS del entorno desplegado.
- `GOOGLE_REDIRECT_URI`: `${MOON_APP_URL}/api/auth/google/callback`.
- Nunca copiar secretos a GitHub, issues, commits ni documentación.

## Base de datos de prueba

Usar PostgreSQL persistente separado de producción.

Antes de validar la app:

```bash
npm run prisma:generate
npm run prisma:push
```

`prisma db push` se acepta para el primer preview controlado mientras se termina el baseline de migraciones reproducibles. No se considera estrategia final de producción.

## Google OAuth

En Google Cloud, agregar exactamente la redirect URI del preview estable que se vaya a probar:

```text
https://<dominio-preview-estable>/api/auth/google/callback
```

La conexión OAuth no habilita automáticamente envío de emails ni escritura de calendario. `ToolPermission` continúa gobernando esas acciones.

## Gate post-deploy

Validar en este orden:

1. `GET /api/readiness` retorna `200` y `status=ready`.
2. Home carga sin error.
3. Login Google completa OAuth.
4. `/dashboard` carga el workspace.
5. `/settings/artist` permite crear/cargar artista.
6. Pricing policy persiste.
7. `/settings/integrations` muestra Google conectado.
8. Permisos sensibles siguen apagados por defecto.
9. No existen errores 5xx relevantes en runtime logs.
10. Recién después ejecutar una prueba comercial controlada.

## Criterio para declarar LISTO PARA PRUEBAS

MOON queda listo para pruebas cuando se cumplan simultáneamente:

- CI verde con smoke P0;
- preview desplegado;
- PostgreSQL persistente conectado;
- readiness verde;
- OAuth funcional;
- Artist Workspace piloto cargado;
- pricing/restricciones definidas;
- acciones A2/A3 siguen protegidas.

## Condiciones de parada

Pedir acción puntual al usuario solo cuando haga falta:

- crear/vincular proyecto Vercel;
- aceptar un costo o plan pago;
- crear/proveer credenciales;
- configurar Google Cloud;
- autorizar una acción externa sensible;
- resolver una decisión irreversible.

Después de recibir esa acción, continuar automáticamente desde el punto bloqueado.
