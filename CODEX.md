# CODEX.md — MOON autonomous execution protocol

Este archivo convierte el repositorio en el puente operativo entre el usuario y Codex.

Codex debe obedecer en este orden:

1. `docs/MOON_MASTER.md`
2. `AGENTS.md`
3. `CODEX.md`
4. `docs/MOON_PRODUCT_ROADMAP.md`
5. `docs/HANDOFF.md`
6. código, tests, CI y logs del repositorio

Si existe contradicción, prevalece el documento de mayor prioridad.

## 1. Comando corto esperado

El usuario puede iniciar una sesión con una instrucción mínima como:

`seguí con los P0 según AGENTS.md y CODEX.md`

Eso autoriza a Codex a leer el estado actual, elegir el siguiente P0 no bloqueado y continuar sin pedir microconfirmaciones.

## 2. Ciclo obligatorio de trabajo

Al comenzar cada sesión:

1. leer `AGENTS.md`, `CODEX.md`, `docs/MOON_PRODUCT_ROADMAP.md` y `docs/HANDOFF.md`;
2. inspeccionar el estado real del repo, rama, CI y código relevante;
3. identificar el P0 más próximo a producto validable;
4. marcarlo `IN PROGRESS` en `docs/HANDOFF.md`;
5. implementar;
6. verificar lint, typecheck, tests y build relevantes;
7. corregir fallos por cuenta propia;
8. actualizar roadmap y handoff con evidencia real;
9. commitear usando Conventional Commits;
10. pasar automáticamente al siguiente P0 no bloqueado.

No detenerse después de un commit si todavía existe trabajo P0 ejecutable.

## 3. Regla por defecto: ejecutar

DEFAULT = EXECUTE.

Codex debe resolver por sí mismo:

- decisiones técnicas reversibles;
- estructura de archivos;
- refactors;
- bugs;
- tests;
- CI;
- validaciones;
- documentación;
- observabilidad;
- seguridad razonable;
- migraciones no destructivas;
- mejoras del flujo P0 ya definido.

No preguntar por estilo, nombres menores, organización interna o alternativas técnicas equivalentes.

## 4. Política de desbloqueo

Ante un bloqueo:

1. diagnosticar;
2. buscar evidencia en código, docs, CI y logs;
3. intentar una solución;
4. verificar;
5. si falla, intentar otra opción razonable;
6. si una parte queda bloqueada, continuar con otro P0 no dependiente;
7. registrar el bloqueo real en `docs/HANDOFF.md`.

No usar al usuario como debugger de tareas que Codex puede resolver sola.

## 5. Únicas causas de pausa obligatoria

Codex debe frenar y pedir una acción mínima del usuario solo cuando el siguiente paso requiera necesariamente:

- deploy o cambio sobre producción real;
- gasto de dinero o activación de servicio pago;
- credenciales, secretos, tokens o claves que el usuario debe proporcionar/configurar;
- creación/aprobación de una cuenta externa o consentimiento OAuth que solo el usuario puede completar;
- aceptación de costos recurrentes;
- acción irreversible o con riesgo de pérdida de datos;
- decisión legal, contractual o financiera vinculante;
- cambio material del modelo de negocio.

Cuando deba frenar, pedir una sola acción concreta con:

- qué hacer;
- dónde hacerlo;
- qué resultado devolver;
- por qué Codex no puede hacerlo sola.

Después de recibir esa acción, continuar automáticamente desde el punto bloqueado.

## 6. Producción y Vercel

Preparar producción de forma autónoma sí está permitido:

- hardening;
- readiness endpoint;
- documentación de variables;
- archivos de configuración;
- checks de CI;
- preview-safe code;
- scripts de readiness;
- detección de variables faltantes.

Pero no ejecutar un deploy de producción, activar servicios con costo, ni modificar credenciales/secretos sin la acción explícita necesaria del usuario.

Un preview sin costo y reversible puede prepararse, pero Codex debe verificar primero que no use datos productivos ni habilite acciones externas peligrosas.

## 7. Handoff obligatorio

`docs/HANDOFF.md` es el estado operativo vivo.

Cada ítem debe tener uno de estos estados exactos:

- `NEXT`
- `IN PROGRESS`
- `IMPLEMENTED`
- `VALIDATED`
- `RELEASED`
- `BLOCKED`

Reglas:

- `NEXT`: siguiente trabajo elegible.
- `IN PROGRESS`: trabajo actualmente tomado.
- `IMPLEMENTED`: código escrito pero todavía no completamente validado.
- `VALIDATED`: CI/tests/build confirman el cambio.
- `RELEASED`: desplegado en entorno objetivo y verificado allí.
- `BLOCKED`: no puede avanzar sin dependencia externa o decisión crítica.

Nunca marcar `VALIDATED` sin evidencia real. Nunca marcar `RELEASED` sin deploy verificado.

## 8. Actualización de roadmap

`docs/MOON_PRODUCT_ROADMAP.md` debe reflejar estado real, no intención.

Actualizarlo cuando:

- se complete una capacidad relevante;
- cambie el orden del P0;
- aparezca o desaparezca un bloqueo;
- una validación real modifique la estimación;
- se alcance un gate de deploy o prueba.

No subir porcentajes por cantidad de archivos o commits. Medir por flujo ejecutable de punta a punta.

## 9. Git y commits

Trabajar sobre la rama indicada por el repo o por el usuario. Si no hay otra instrucción, usar `main` según la política actual del proyecto.

Cada commit debe ser:

- pequeño y reversible cuando sea posible;
- con Conventional Commit;
- coherente con el estado escrito en `docs/HANDOFF.md`.

Después de un commit, verificar CI si existe y corregir automáticamente fallos causados por el cambio.

## 10. Definición de sesión exitosa

Una sesión no termina porque "ya se hizo algo".

Termina cuando ocurre una de estas condiciones:

- no queda ningún P0 ejecutable sin bloqueo;
- se alcanza un gate que requiere producción, dinero, credenciales o una acción externa del usuario;
- aparece una decisión crítica de las definidas en `AGENTS.md`;
- el usuario ordena detenerse.

Mientras no ocurra una de esas condiciones, Codex debe continuar.

## 11. Regla final

Leer estado -> elegir P0 -> marcar handoff -> implementar -> verificar -> corregir -> actualizar docs -> commitear -> revisar CI -> continuar.

No pedir `seguí` para repetir este ciclo.
