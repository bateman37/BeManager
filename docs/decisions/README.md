# Decisiones arquitectónicas (ADR) — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** la lista de ADR existentes y su convención.
**Debe leerse cuando:** vayas a tomar una decisión técnica significativa o difícil de revertir.
**No cubre:** el contenido de cada ADR (ver el archivo correspondiente).
**Documentos relacionados:** `docs/README.md`.
**Última actualización:** 2026-09-29.

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
- `ADR-0007-shared-continuity-engine-and-game-rules-profile.md` — motor de continuidad compartido `LinkedRun` (tramo y partido), reglas de partido opcionales en el núcleo y perfil de reglas FIBA 2026 puro, separado del acta (ME-04).

## Decisiones requeridas pendientes

Bloques `DECISIÓN REQUERIDA` que Claude Code no puede cerrar por ser reglas
de juego (ver `docs/process/WORKFLOW.md`). No son ADR: cuando Dennis decida,
se registra en el prompt siguiente y, si procede, en un ADR.

- `DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md` —
  con el fixture, los partidos naturales solo tienen ~1 falta (de tiro) y
  ninguna segunda entrada; no bloquea ME-04 (bonus, quinta personal y
  prórroga se ven en los casos de frontera).

## Decisiones requeridas resueltas

- `DECISION-REQUERIDA-ME-03-ventaja-temprana.md` — **resuelta: opción B**
  (superioridad numérica al cruzar el medio campo). Implementada; el
  fixture real sigue sin ejecutar ninguna ventaja por una propiedad
  geométrica del propio fixture (ver `docs/match/ACTIONS.md`), no por una
  decisión de juego pendiente.
