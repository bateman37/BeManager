# Capacidades activas y parámetros LAB-0.1

**Estado:** ACTIVE
**Es fuente de verdad para:** qué capacidades tienen mecanismo real en ME-01 y dónde viven los coeficientes LAB-0.1.
**Debe leerse cuando:** vayas a activar una nueva capacidad o a calibrar un coeficiente existente.
**No cubre:** las 45 capacidades candidatas completas del catálogo (ver `docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md` §2.2–2.4).
**Documentos relacionados:** `ACTIONS.md`, `docs/decisions/ADR-0004-detailed-engine-analytic-timing.md`.
**Última actualización:** 2026-09-28.

## 26 capacidades activas (de 45 candidatas)

- **Ofensivas (9):** T01, T04, T05, T06, T07, T09, T11, T13, T21.
- **Defensivas/rebote (8):** T15, T16, T17, T18, T19, T20, T22, T23.
- **Mentales (4):** M01, M03, M04, M05.
- **Físicas (5):** F01, F03, F04, F05, F06.
- **Medidas corporales (4):** C01 altura, C02 peso, C03 envergadura, C04
  alcance de pie (cm/kg, no en escala 1–15).

Las 19 capacidades restantes del catálogo (T02, T03, T08, T10, T12, T14,
M02, M06–M12, F02, F07–F10) son candidatas documentadas sin mecanismo ni
rating ficticio en ME-01: no aparecen en la ficha editable.

## Dónde viven los coeficientes

`modules/match/domain/lab/lab-0-1-parameters.ts` (`LAB_PARAMETERS_VERSION =
"LAB-0.1"`). Cada función documenta su fórmula, unidad y el rango acotado
exacto del prompt ME-01 §3. No son porcentajes de liga FIBA: son hipótesis
de prototipo, versionadas como datos tipados, no como constantes repartidas
por el código.

## Reglas de no duplicar premio (verificadas con pruebas unitarias)

- `shotReleaseHeightMeters` nunca supera alcance de pie + salto ejecutado:
  C01 sitúa el cuerpo, pero no añade una segunda mano por encima de C04.
- `maxTouchHeightMeters` depende solo de alcance de pie y salto disponible.
- `jumpCeilingMeters` usa el rating bruto de F06, no `d(F06)` (fórmula
  literal del prompt).
- T22 (exterior), T23 (interior) y T15 (contención ya iniciada) ajustan
  tareas distintas y nunca se suman sobre la misma intervención.

## Editor de equilibrio

Los coeficientes son datos versionados por el desarrollo, no un panel de
administración visual todavía (ese editor es una entrega futura, ver
`docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md` §6). Un
cambio de coeficiente en ME-01 se hace editando
`lab-0-1-parameters.ts` y requiere revisión y pruebas, igual que cualquier
otro cambio de código.
