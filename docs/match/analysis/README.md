# Análisis del motor de partido — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** dónde están los diagnósticos cuantitativos y las fotos basales que sirven de evidencia para una entrega del motor.
**Debe leerse cuando:** una entrega cite un diagnóstico o necesites comparar el motor antes/después de un cambio.
**No cubre:** el diseño (ver `docs/match/reference/`) ni lo implementado (ver `docs/match/README.md`).
**Documentos relacionados:** `docs/match/README.md`, `docs/prompts/implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md`.
**Última actualización:** 2026-09-30 (ME-07B v2).

Los diagnósticos son evidencia fechada contra un commit concreto: no se
reescriben cuando el motor cambia; una medición nueva va en su propio
documento o sección fechada.

- [`ME-07A-diagnostico-20-auditorias.md`](./ME-07A-diagnostico-20-auditorias.md)
  — informe literal aportado por Dennis (30-09-2026) sobre 20 exportaciones
  `ME-07A-AUDIT-1` contra `7b7eedd`. Forma parte del encargo ME-07B v2.
- [`ME-07B-v2-foto-basal-20.md`](./ME-07B-v2-foto-basal-20.md) — recreación
  reproducible de las tres fotos de esas 20 auditorías desde el `GameInput`
  del fixture (`scripts/me07b-v2-baseline-20.ts`), por equipo y denominador,
  y su evolución tras cada reparación causal de ME-07B v2.
