# MOON

Agencia autónoma de artistas operada por agentes de IA.

MOON está diseñada como plataforma multiartista para descubrir oportunidades, gestionar contactos, ejecutar seguimiento comercial, preparar propuestas, coordinar agenda, marketing y operación de carrera con distintos niveles de autonomía.

## Documentos principales

- [`docs/MOON_MASTER.md`](docs/MOON_MASTER.md) — constitución del producto, agentes, autonomía, seguridad, arquitectura y P0.
- [`docs/MOON_PRODUCT_ROADMAP.md`](docs/MOON_PRODUCT_ROADMAP.md) — roadmap de implementación y criterio de avance.
- [`AGENTS.md`](AGENTS.md) — reglas para agentes desarrolladores que trabajen en este repositorio.

## Objetivo P0

Construir y validar el flujo:

`Artist -> Opportunity -> Lead -> Contact -> Conversation -> Proposal -> Approval -> Deal -> Calendar -> Follow-up`

## Primer artista piloto

Sebastián Zoth será el primer workspace de validación. Toda lógica específica debe vivir en configuración y datos, nunca hardcodeada en el core.

## Regla del proyecto

MOON debe comportarse como una agencia que trabaja todos los días, no como una herramienta que espera instrucciones.
