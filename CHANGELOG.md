# Changelog

Formato libre en español, orden cronológico inverso. Los motivos de
decisiones duraderas viven en `docs/decisions/`, no aquí.

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
