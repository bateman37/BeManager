# Changelog

Formato libre en español, orden cronológico inverso. Los motivos de
decisiones duraderas viven en `docs/decisions/`, no aquí.

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
