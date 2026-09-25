# CLAUDE.md — router del proyecto BeManager

Este archivo es un router, no una enciclopedia. No copies aquí la visión,
la arquitectura ni el diseño: enlaza a su fuente de verdad.

## Ruta mínima de lectura para cualquier tarea

1. Este archivo.
2. El prompt de implementación o hotfix activo, en `docs/prompts/`.
3. `docs/README.md`, para localizar las fuentes de verdad necesarias.
4. Únicamente los documentos que el prompt activo declare obligatorios.

## Roles y límites de decisión (resumen)

Dennis diseña y acepta. ChatGPT ayuda a convertir el diseño en prompts.
Claude Code implementa y decide solo lo mínimo, técnico, reversible y
local. Si falta una decisión de juego, Claude Code se detiene con un
bloque `DECISIÓN REQUERIDA` en vez de inventarla. Detalle completo en
`docs/process/WORKFLOW.md`.

## Metodología esencial (resumen)

Entregas medianas, una rama y una PR por bloque, `main` siempre estable,
pruebas automáticas mínimas centradas en invariantes, pruebas manuales
para Dennis, documentación y `CHANGELOG.md` actualizados en cada entrega,
Claude Code no fusiona la PR. Detalle completo en
`docs/process/WORKFLOW.md` y `docs/process/DEFINITION_OF_DONE.md`.

## Reglas de seguridad documental (resumen)

Un documento, un propósito. Una decisión, una única fuente de verdad
(enlazar, no copiar). Documentos activos cortos (~250 líneas). Prompts
ejecutados no se editan retrospectivamente. No leer documentación fuera de
la declarada por el prompt activo. Detalle completo en
`docs/process/DOCUMENTATION_STANDARD.md`.

## Comandos principales

`npm ci` · `npm run dev` · `npm run check` (lint + typecheck + test +
docs:check + build) · `npm run prisma:generate` · `npm run prisma:migrate`.

## Fuentes de verdad

- Visión y alcance: `docs/foundation/`.
- Arquitectura técnica: `docs/architecture/`.
- Decisiones: `docs/decisions/`.
- Proceso: `docs/process/`.
- Roadmap: `docs/roadmap/ROADMAP.md`.
- Prompts: `docs/prompts/README.md`.
