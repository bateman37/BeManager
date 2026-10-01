# Análisis del motor de partido — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** dónde están los diagnósticos cuantitativos y las fotos basales que sirven de evidencia para una entrega del motor.
**Debe leerse cuando:** una entrega cite un diagnóstico o necesites comparar el motor antes/después de un cambio.
**No cubre:** el diseño (ver `docs/match/reference/`) ni lo implementado (ver `docs/match/README.md`).
**Documentos relacionados:** `docs/match/README.md`, `docs/prompts/implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md`.
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-6).

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
- [`ME-07B-v2-descomposicion-puntos-v2-3.md`](./ME-07B-v2-descomposicion-puntos-v2-3.md)
  — por qué baja el total de puntos de la foto seed entre v2-2 y LAB-0.7:
  prórrogas, calidad esperada de tiro, libres y sorteo, con denominadores
  (`scripts/me07b-v2-points-breakdown.ts`) y contraste en 60 semillas.
- [`ME-07B-v2-comparador-v2-6.md`](./ME-07B-v2-comparador-v2-6.md) — la
  ficha elegida por valor y Delay en `auto`: mismas 20 semillas antes/después,
  por qué sigue dominando el bloqueo directo (colocación y familia, con
  denominadores) y posesiones consecutivas de `/lab`
  (`scripts/me07b-v2-placement-gap.ts`, `me07b-v2-projection-calibration.ts`,
  `me07b-v2-possession-slice.ts`).
