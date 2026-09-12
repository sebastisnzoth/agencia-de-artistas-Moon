# MOON · Google Production Setup

MOON ya implementa autenticación Google, sesión firmada, almacenamiento cifrado del refresh token, Gmail y Google Calendar. Para activarlo en un deploy real faltan únicamente credenciales e infraestructura del entorno.

## Variables obligatorias

- `DATABASE_URL`
- `MOON_APP_URL`
- `MOON_SESSION_SECRET` (mínimo 32 caracteres)
- `MOON_TOKEN_ENCRYPTION_KEY` (32 bytes en base64)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Generar la clave de cifrado localmente:

```bash
openssl rand -base64 32
```

No versionar secretos.

## Google Cloud

Crear una aplicación OAuth 2.0 de tipo Web y configurar como redirect URI exactamente:

```text
https://TU-DOMINIO/api/auth/google/callback
```

Para desarrollo:

```text
http://localhost:3000/api/auth/google/callback
```

MOON solicita identidad Google y acceso a Gmail/Calendar mediante los scopes definidos en `src/lib/google.ts`.

## Base de datos

Después de configurar `DATABASE_URL`:

```bash
npm install
npm run prisma:generate
npm run prisma:push
```

`IntegrationAccount` guarda el refresh token cifrado con AES-256-GCM. Nunca se almacena el refresh token en texto plano.

## Flujo de conexión

1. Abrir `/api/auth/google/start`.
2. Google redirige a `/api/auth/google/callback`.
3. MOON valida el `id_token` contra `GOOGLE_CLIENT_ID`.
4. Crea/actualiza el usuario y workspace.
5. Cifra el refresh token.
6. Crea una sesión HTTP-only firmada y selecciona el workspace activo.
7. Gmail y Calendar quedan disponibles según `ToolPermission`.

Para conectar una cuenta a un workspace existente:

```text
/api/auth/google/start?workspaceSlug=SLUG
```

El usuario autenticado por Google debe ser miembro de ese workspace.

## Endpoints operativos

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/integrations/google/status`
- `POST /api/integrations/google/disconnect`
- `POST /api/email/sync`
- `POST /api/email/messages/:id/send`
- `POST /api/events/:id/sync-google`
- `POST /api/workspaces/select`

## Límites de autonomía

La conexión OAuth no elimina las políticas A0/A1/A2/A3. Gmail y Calendar siguen pasando por `ToolPermission`; acciones bloqueadas o que requieran aprobación continúan bloqueadas aunque la cuenta Google esté conectada.
