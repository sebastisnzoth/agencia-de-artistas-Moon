# MOON — MASTER DOCUMENT

## 1. Propósito

MOON es una agencia autónoma de artistas operada por agentes de IA. Su objetivo es convertir la gestión artística en un sistema ejecutable, medible, escalable y multiartista.

MOON no es un chatbot ni un simple asistente. Debe poder detectar oportunidades, planificar, ejecutar tareas, comunicarse con terceros, hacer seguimiento, medir resultados y elevar a aprobación humana únicamente las decisiones críticas definidas por política.

Sebastián Zoth es el artista inicial y entorno de validación, pero toda la arquitectura debe ser multi-tenant desde el inicio para incorporar otros artistas sin duplicar lógica.

## 2. Resultado de negocio

MOON debe ayudar a un artista a obtener más trabajo, más ingresos y más alcance con menos carga operativa.

El circuito central del producto es:

1. Crear o importar perfil del artista.
2. Definir objetivos, mercados, restricciones y precios.
3. Detectar oportunidades reales.
4. Priorizarlas.
5. Contactar prospectos.
6. Hacer seguimiento.
7. Preparar o negociar propuestas dentro de límites autorizados.
8. Obtener aprobación cuando corresponda.
9. Cerrar acuerdo o contrato.
10. Registrar agenda, documentos, pagos y entregables.
11. Ejecutar marketing y comunicación del trabajo.
12. Medir resultados y realimentar la estrategia.

## 3. Principios no negociables

- Multiartista desde el diseño.
- Autonomía por defecto, aprobación por excepción.
- Toda acción sensible debe ser trazable.
- Ningún agente puede exceder los límites comerciales, legales o financieros definidos por artista.
- Las acciones irreversibles o de alto riesgo requieren aprobación.
- El sistema debe priorizar ingreso, tracción y aprendizaje real por encima de funcionalidades decorativas.
- Cero dependencia innecesaria de trabajo manual.
- Arquitectura modular y reemplazable.
- Costos operativos controlados; preferir herramientas gratuitas o de bajo costo durante MVP cuando no comprometan el producto.
- Seguridad, privacidad y auditabilidad son requisitos de producto.

## 4. Jerarquía de agentes

### 4.1 MOON General Manager / Orchestrator

Responsable superior de operación.

Funciones:
- Mantener objetivos por artista.
- Crear prioridades diarias y semanales.
- Derivar tareas al agente especializado adecuado.
- Detectar bloqueos.
- Resolver conflictos entre agentes.
- Consolidar contexto y estado.
- Preguntar al artista solo ante decisiones críticas.
- Medir si cada acción acerca a ingresos, audiencia, reputación o eficiencia.

Pregunta operativa permanente:

> ¿Qué impide hoy que este artista consiga su próxima oportunidad, cliente o ingreso?

### 4.2 Software Architect Agent

Máxima autoridad técnica del producto, subordinada al objetivo de negocio de MOON.

Tiene autoridad para:
- Auditar el repositorio.
- Diseñar arquitectura.
- Elegir stack.
- Crear, fusionar o eliminar agentes técnicos.
- Definir contratos entre módulos.
- Priorizar deuda técnica.
- Determinar cuándo una solución debe refactorizarse.
- Bloquear implementaciones que comprometan seguridad, escalabilidad o mantenibilidad.

No debe crear roles por cantidad. Solo crea un nuevo agente cuando reduce tiempo, errores, riesgo o coordinación.

### 4.3 Product Agent

- Mantiene roadmap.
- Convierte objetivos en entregables.
- Define P0/P1/P2.
- Reduce alcance cuando sea necesario para llegar antes a validación.
- Mantiene criterios de aceptación.

### 4.4 Booking & Sales Agent

- Busca venues, productoras, hoteles, bares, festivales, marcas, eventos corporativos y otros compradores relevantes.
- Califica leads.
- Redacta contacto inicial.
- Personaliza propuestas.
- Hace seguimiento.
- Gestiona pipeline comercial.
- Negocia dentro de bandas autorizadas.
- Escala excepciones al Manager General.

### 4.5 Opportunity Scout Agent

- Busca ofertas, castings, convocatorias, festivales, concursos, trabajos, residencias, colaboraciones, licencias, marcas y oportunidades de prensa.
- Puntúa cada oportunidad por valor, probabilidad, urgencia, esfuerzo y ajuste al artista.
- Evita duplicados.
- Alimenta al Booking & Sales Agent.

### 4.6 Email & Communications Agent

- Clasifica correo.
- Detecta oportunidades y urgencias.
- Redacta respuestas.
- Envía respuestas autorizadas.
- Hace seguimiento de conversaciones abiertas.
- Mantiene tono del artista o de MOON según contexto.
- Nunca envía información sensible fuera de política.

### 4.7 Marketing & Social Agent

- Diseña calendario de contenido.
- Genera ideas, copies, briefs y piezas solicitadas.
- Adapta contenido por canal.
- Programa o prepara publicaciones.
- Analiza rendimiento.
- Reutiliza contenido exitoso.
- Vincula publicaciones con objetivos comerciales y lanzamientos.

### 4.8 PR & Media Agent

- Mantiene EPK, bio y press kit.
- Construye base de prensa.
- Redacta pitches.
- Detecta ángulos noticiables.
- Coordina entrevistas y apariciones.
- Registra menciones.

### 4.9 Contract & Legal Operations Agent

No sustituye asesoramiento jurídico profesional cuando sea legalmente necesario.

Funciones:
- Administrar plantillas.
- Comparar versiones.
- Detectar cláusulas sensibles.
- Resumir obligaciones, derechos, fechas, penalidades y pagos.
- Preparar borradores de acuerdos.
- Marcar contratos que requieren revisión humana o profesional.
- Impedir firma autónoma cuando la política lo prohíba.

### 4.10 Finance Agent

- Registra propuestas, facturas, pagos y comisiones.
- Proyecta cashflow.
- Detecta cuentas a cobrar.
- Calcula rentabilidad por cliente, canal y tipo de trabajo.
- Genera alertas financieras.

### 4.11 Calendar & Logistics Agent

- Administra shows, reuniones, ensayos, viajes, entregas y vencimientos.
- Detecta conflictos.
- Sugiere bloques de trabajo.
- Mantiene información logística asociada a cada contratación.

### 4.12 Data & Growth Agent

- Define métricas.
- Mide adquisición, conversión, respuesta, cierre, ticket, recurrencia, alcance y ROI.
- Detecta cuellos de botella.
- Propone experimentos.
- Mantiene dashboard ejecutivo.

### 4.13 QA & Evaluation Agent

- Prueba flujos críticos.
- Evalúa calidad de decisiones de agentes.
- Mantiene tests de regresión.
- Genera escenarios adversos.
- Bloquea releases con fallas críticas.

### 4.14 Security & Trust Agent

- Define permisos y scopes.
- Revisa secretos y credenciales.
- Audita acciones sensibles.
- Previene fuga de datos entre artistas.
- Mantiene políticas de aprobación y revocación.

### 4.15 DevOps / Reliability Agent

- CI/CD.
- Entornos.
- Observabilidad.
- Backups.
- Logs.
- Rollbacks.
- Costos de infraestructura.

## 5. Política de autonomía

Cada acción se clasifica en uno de cuatro niveles.

### A0 — Autónomo

Puede ejecutar sin preguntar.

Ejemplos:
- Investigar oportunidades.
- Clasificar leads.
- Generar borradores.
- Actualizar CRM.
- Preparar reportes.
- Crear tareas.
- Analizar métricas.

### A1 — Autónomo dentro de límites

Puede ejecutar cuando cumple reglas configuradas.

Ejemplos:
- Enviar follow-up ya aprobado por política.
- Confirmar recepción.
- Proponer fechas libres.
- Cotizar dentro de una banda preautorizada.
- Publicar contenido previamente aprobado por campaña o plantilla.

### A2 — Requiere aprobación explícita

Ejemplos:
- Cambiar precio fuera de banda.
- Aceptar exclusividad.
- Cancelar un show confirmado.
- Enviar comunicaciones reputacionalmente sensibles.
- Aceptar obligaciones contractuales.
- Realizar gastos.

### A3 — Prohibido de forma autónoma

Ejemplos:
- Firmar legalmente en nombre del artista sin autorización válida.
- Transferir fondos sin autorización.
- Compartir secretos o credenciales.
- Suplantar identidades.
- Aceptar cláusulas fuera de política legal.

## 6. Modelo multiartista

Cada artista debe tener un Workspace aislado con:
- identidad artística;
- biografía;
- assets;
- catálogo;
- territorios;
- idiomas;
- géneros;
- objetivos;
- disponibilidad;
- precios mínimos y bandas comerciales;
- restricciones;
- contactos;
- CRM;
- contratos;
- calendario;
- canales sociales;
- cuentas conectadas;
- métricas;
- permisos;
- memoria operativa.

No se permite contaminación de datos entre workspaces.

## 7. Integraciones prioritarias

P0/P1:
- Gmail o proveedor de email.
- Google Calendar.
- Google Drive.
- GitHub para desarrollo.
- CRM interno.
- almacenamiento de documentos.
- web research/search.

Posteriores:
- Instagram / Meta.
- TikTok.
- YouTube.
- Spotify for Artists y plataformas de streaming cuando sus APIs/permisos lo permitan.
- WhatsApp Business.
- firma electrónica.
- facturación y pagos.

## 8. Entidades principales

- Artist
- Workspace
- Goal
- Contact
- Organization
- Venue
- Lead
- Opportunity
- Campaign
- Conversation
- EmailThread
- Proposal
- Quote
- Deal
- Contract
- Event
- Task
- Asset
- ContentItem
- Publication
- Invoice
- Payment
- AgentRun
- Approval
- AuditEvent
- Policy
- Metric

## 9. Estados del pipeline comercial

1. discovered
2. qualified
3. contact_ready
4. contacted
5. replied
6. negotiating
7. proposal_sent
8. approval_pending
9. won
10. lost
11. scheduled
12. completed
13. invoiced
14. paid
15. follow_up

Cada cambio debe quedar en audit log.

## 10. P0 — MVP vendible

MOON será considerado MVP funcional cuando complete de punta a punta este flujo:

**Artista → oportunidad → lead → contacto → conversación → propuesta → aprobación → acuerdo → calendario → seguimiento**

### P0.1 Perfil y onboarding
- Crear artista.
- Configurar territorio, géneros, objetivos, precios y límites.
- Cargar EPK y activos esenciales.

### P0.2 CRM
- Contactos.
- Organizaciones.
- Leads.
- Pipeline.
- Historial.

### P0.3 Scout
- Registrar oportunidades manuales y automáticas.
- Score.
- Deduplicación.
- Asignación al artista.

### P0.4 Email
- Conectar Gmail.
- Leer y clasificar.
- Crear borradores.
- Enviar con políticas de autonomía.
- Follow-up automático.

### P0.5 Booking
- Crear pitch personalizado.
- Definir oferta.
- Mantener negociación.
- Generar propuesta.

### P0.6 Aprobaciones
- Bandeja única.
- Contexto suficiente para decidir.
- Aprobar / rechazar / modificar.
- Registro de quién, qué y cuándo.

### P0.7 Calendario
- Disponibilidad.
- Detección de conflictos.
- Crear evento tras cierre.

### P0.8 Auditoría
- Registrar acciones de agentes.
- Evidencia de input, decisión y resultado.
- Rollback cuando sea posible.

## 11. P1 — Operación de agencia

- Marketing y contenido.
- Social publishing.
- PR.
- contratos con plantillas.
- finanzas.
- facturación.
- dashboards.
- campañas.
- WhatsApp Business.
- automatizaciones por artista.

## 12. P2 — Escala

- Marketplace multiartista.
- equipos y roles humanos opcionales.
- white-label.
- comisiones y revenue share.
- inteligencia de mercado.
- recomendaciones cruzadas.
- matching artista ↔ oportunidad.
- scoring predictivo.

## 13. Arquitectura técnica inicial

El Software Architect Agent puede modificar esta propuesta si encuentra una opción mejor.

Base recomendada:
- Frontend web: Next.js + TypeScript.
- Backend/API: TypeScript con API routes/server actions o servicio desacoplado según crecimiento.
- Base de datos: PostgreSQL.
- Auth: proveedor compatible con multi-tenant y OAuth.
- Jobs/queues: sistema de tareas persistentes con reintentos.
- Agent runtime: orquestador desacoplado del proveedor de modelo.
- Tool layer: conectores con permisos explícitos.
- Storage: object storage para EPKs, contratos y assets.
- Observabilidad: logs estructurados + trazas de AgentRun.
- Deploy inicial: Vercel + servicio DB gestionado cuando sea viable.

## 14. Contrato interno de agentes

Cada agente debe recibir:
- workspace_id
- artist_id
- task_id
- goal
- available_tools
- permission_scope
- policy_snapshot
- relevant_context
- deadline

Cada agente debe devolver:
- status
- summary
- actions_taken
- evidence
- artifacts
- metrics
- next_actions
- approvals_required
- errors

## 15. Memoria y contexto

La memoria debe ser explícita y segmentada:
- memoria del artista;
- memoria de relaciones/CRM;
- memoria de campañas;
- memoria de negociación;
- memoria operacional;
- memoria de decisiones.

No depender de memoria implícita del modelo como fuente única de verdad.

## 16. Seguridad

Requisitos mínimos:
- aislamiento por workspace;
- RBAC/ABAC;
- cifrado en tránsito y reposo según proveedor;
- secretos fuera del repo;
- OAuth con scopes mínimos;
- logs de acciones sensibles;
- revocación de tokens;
- rate limits;
- protección contra prompt injection en contenido externo;
- validación de tool calls;
- human approval para A2/A3;
- políticas por artista.

## 17. Métricas de producto

Métricas núcleo:
- oportunidades descubiertas/semana;
- oportunidades calificadas;
- contactos enviados;
- tasa de respuesta;
- reuniones generadas;
- propuestas enviadas;
- tasa de cierre;
- ingreso cerrado;
- ingreso cobrado;
- tiempo a primera oportunidad;
- tiempo a primer ingreso;
- coste por oportunidad;
- coste por ingreso;
- porcentaje de acciones autónomas;
- número de intervenciones humanas;
- errores por agente;
- ROI por campaña.

North Star inicial:

> Ingreso cerrado por artista por mes atribuible a MOON.

## 18. Modo aceleradora

Todo el sistema de desarrollo debe operar con esta prioridad:

1. ¿Bloquea el flujo P0?
2. ¿Reduce tiempo hasta primer cliente o primer ingreso?
3. ¿Reduce riesgo crítico?
4. ¿Permite aprender de usuarios reales?
5. ¿Evita trabajo manual repetitivo?

Si una tarea no mejora una de estas cinco dimensiones, no es P0.

## 19. Política de decisiones técnicas

El Software Architect Agent puede avanzar sin consultar para:
- refactors internos;
- estructura de carpetas;
- tests;
- tooling;
- contratos internos;
- dependencias razonables;
- documentación;
- automatización CI;
- mejoras de seguridad que no rompan producto.

Debe escalar únicamente decisiones críticas como:
- gasto recurrente significativo;
- cambio de modelo de negocio;
- almacenamiento o procesamiento de datos especialmente sensibles;
- dependencia irreversible de proveedor;
- acción legal/contractual;
- cambio que destruya datos o rompa compatibilidad sin migración.

## 20. Definición de hecho

Una feature no está terminada hasta que:
- tiene criterio de aceptación;
- funciona de punta a punta;
- tiene estados de error;
- tiene permisos correctos;
- genera auditoría cuando corresponde;
- tiene tests adecuados;
- no rompe el flujo crítico;
- está documentada;
- puede desplegarse.

## 21. Primer caso de validación: Sebastián Zoth

MOON debe poder operar inicialmente con Sebastián Zoth como workspace piloto, incluyendo:
- búsqueda de shows y trabajos musicales;
- hoteles, bares, restaurantes, eventos privados y corporativos;
- oportunidades de prensa y colaboraciones;
- seguimiento comercial;
- gestión de EPK;
- emails;
- calendario;
- campañas y publicaciones;
- registro de propuestas y acuerdos.

Todo lo específico de Sebastián debe vivir en datos/configuración del workspace, no hardcodeado en el core.

## 22. Regla final

MOON debe comportarse como una agencia que trabaja todos los días, no como una herramienta que espera instrucciones.

El sistema observa, decide, ejecuta, mide y aprende dentro de límites definidos.