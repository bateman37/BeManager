# Decisiones arquitectónicas (ADR) — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** la lista de ADR existentes y su convención.
**Debe leerse cuando:** vayas a tomar una decisión técnica significativa o difícil de revertir.
**No cubre:** el contenido de cada ADR (ver el archivo correspondiente).
**Documentos relacionados:** `docs/README.md`.
**Última actualización:** 2026-09-28.

## Convención

- Identificador: `ADR-NNNN-slug-corto.md`, numeración correlativa.
- Cada ADR incluye: estado, contexto, decisión, consecuencias y
  alternativas descartadas.
- Un ADR aceptado no se reescribe: si una decisión cambia, se crea un ADR
  nuevo que referencia y sustituye (`SUPERSEDED`) al anterior.

## ADR existentes

- `ADR-0001-technical-stack.md` — elección de stack técnico y versiones principales.
- `ADR-0002-modular-monolith.md` — monolito modular frente a microservicios/monorepo.
- `ADR-0003-fictional-world-and-ecosystems.md` — universo ficticio y separación de familias de ecosistemas.
- `ADR-0004-detailed-engine-analytic-timing.md` — el motor detallado calcula llegadas de forma analítica en vez de interpolar posiciones cada 100 ms.
- `ADR-0005-shared-possession-core.md` — el árbol de decisión y las fórmulas LAB-0.1 viven en un núcleo compartido (`possession-core.ts`), separado de la construcción de relato; sustituye la relación motor detallado/aproximación rápida descrita en ADR-0004.
- `ADR-0006-linked-possessions-local-frame.md` — tramos de posesiones enlazadas sobre el núcleo compartido: marco local de ataque por giro de 180°, roles canónicos asignados a jugadores reales y modo enlazado opcional del núcleo (ME-03).

## Decisiones requeridas pendientes

Bloques `DECISIÓN REQUERIDA` que Claude Code no puede cerrar por ser reglas
de juego (ver `docs/process/WORKFLOW.md`). No son ADR: cuando Dennis decida,
se registra en el prompt siguiente y, si procede, en un ADR.

- `DECISION-REQUERIDA-ME-03-ventaja-temprana.md` — criterio para que exista una ventana de ventaja temprana en transición (con el fixture, el balance de dos o tres jugadores nunca la concede).
