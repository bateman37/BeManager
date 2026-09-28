# Changelog

Formato libre en español, orden cronológico inverso. Los motivos de
decisiones duraderas viven en `docs/decisions/`, no aquí.

## HF-002 — Integridad de la posesión ME-01 y comparación rápida real (sin fusionar)

- Guardado el prompt del hotfix en `docs/prompts/hotfix/HF-002-me01-integridad-y-rapido.md`.
- Extraído el árbol de decisión y las fórmulas LAB-0.1 a un núcleo
  compartido (`domain/simulation/possession-core.ts`, ADR-0005), usado
  tanto por el motor detallado como por el resolvedor rápido.
- Corregido el balón: un tapón o una pérdida en balón vivo dejan el balón
  suelto (no muerto en el aro); un robo lo deja en poder real del
  defensor; solo una canasta lo deja muerto en el aro.
- Corregida la instantánea de cada hecho: se reconstruye desde el
  historial real de llegadas, no desde la posición ya mutada para
  cálculos posteriores (D3/D4 ya no aparecen en su destino antes de
  llegar).
- Corregido el rebote ofensivo: el resolvedor rápido cuenta cada rebote
  ofensivo real desde la línea de tiempo de hechos, no solo el terminal
  final de la corrida; `resolveRebound` ya no llama "fuera" a un balón
  dentro de la cancha solo porque nadie llega en la ventana de vuelo, y el
  palmeo se decide por T20 solo entre quienes realmente llegan.
- Conectados T22 (defensa perimetral) y T23 (defensa interior) a las
  llegadas de cierre/protección reales; añadida la elegibilidad de tapón
  (T18) por alcance físico real del defensor sobre el punto de
  liberación del tiro.
- Ejecutados de verdad los libres de una falta de tiro (T05 + semilla,
  puntos y reloj); el último libre fallado se resuelve como un rebote
  vivo real, incluida la continuación ofensiva si corresponde.
- Sustituida la aproximación rápida: ya no llama a `runPossession` ni
  construye relato/snapshots por muestra; mide ≈1,5–1,75× más rápida que
  ejecutar el detallado en lote (mismo equipo, mismas semillas,
  calentamiento y cálculo separado de render/BD).
- Interfaz `/lab`: se muestra el escenario, semilla, reglas y versión de
  parámetros de cada resultado (individual y de lote); un cambio de
  escenario, semilla o roster limpia el resultado anterior; la
  comparación por lotes aclara que siempre compara ayuda sí/no,
  independientemente del escenario seleccionado.
- Añadido ADR-0005 y actualizados `docs/match/{MODEL,RULES,SCENARIOS,ACTIONS,CAPABILITIES}.md`,
  el plan de prueba manual de ME-01 y `docs/process/{WORKFLOW,DEFINITION_OF_DONE}.md`
  (secuencia: recorrido básico de Claude antes de dejar la PR sin fusionar,
  prueba profunda de Dennis después de fusionar, desde `main`).

## ME-01 — Primera posesión integrada y Laboratorio de Partido (sin fusionar)

- Guardados el prompt de implementación y el hotfix HF-001 (sincronización
  de rama) en `docs/prompts/`.
- Creado el módulo `modules/match/` (domain/application/infrastructure/ui):
  atributos y perfiles de jugador (26 capacidades activas, escala 1–15,
  `E−`…`A+`), parámetros LAB-0.1 tipados y acotados, tres escenarios de
  bloqueo directo central, motor detallado con árbol de decisión y relato
  por pasos, y aproximación rápida por lotes reutilizando el mismo motor.
- Añadidos los modelos Prisma `LabTeam`/`LabPlayer` con migración real y
  script de siembra idempotente de los diez perfiles del fixture.
- Añadida la interfaz `/lab`: editor de jugadores agrupado, cancha
  esquemática, relato paso a paso con detalle seleccionable, y comparación
  rápida de la ayuda de D3.
- Añadido ADR-0004 (llegada analítica en vez de interpolación cada 100 ms)
  y la documentación activa del módulo (`docs/match/`).
- Actualizados `docs/foundation/CURRENT_SCOPE.md`, `docs/roadmap/ROADMAP.md`,
  `docs/architecture/TECHNICAL_ARCHITECTURE.md` y `modules/README.md` para
  reflejar que ME-01 es la entrega vigente.

## FND-001 — Foundation general y arquitectura técnica (sin fusionar)

- Base de bootstrap en `main` (README provisional) como excepción
  irrepetible, al tratarse de un repositorio recién creado.
- Guardado el prompt de implementación literal en
  `docs/prompts/implementation/FND-001-foundation-general-and-technical-architecture.md`.
- Creado el esqueleto ejecutable: Next.js (App Router) + TypeScript
  estricto + Prisma + PostgreSQL + Tailwind CSS + Vitest + ESLint.
- Creada la arquitectura modular (`src/shared/{domain,application,infrastructure,ui}`)
  con un ejemplo real de límites de capas: la comprobación de salud de la
  aplicación y de PostgreSQL.
- Añadido el endpoint `GET /api/health` y la página inicial Foundation,
  ambos tolerantes a la ausencia de PostgreSQL sin filtrar credenciales.
- Añadida la comprobación documental ligera (`npm run docs:check`) y el
  workflow de CI (`.github/workflows/ci.yml`).
- Creado el sistema documental dividido e indexado (`docs/README.md` y
  subcarpetas), tres ADR iniciales y el plan de prueba manual
  `docs/testing/manual/FND-001-manual-test-plan.md`.
- Documentadas, sin implementar, las familias de ecosistemas de
  competición y los principios del futuro núcleo de partido.
