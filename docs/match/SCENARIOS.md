# Escenarios y validación (ME-01)

**Estado:** ACTIVE
**Es fuente de verdad para:** los tres escenarios cargables y cómo se comprueban.
**Debe leerse cuando:** vayas a añadir un escenario o a entender por qué uno concreto es alcanzable.
**No cubre:** el modo rápido completo de ME-08 (aquí solo hay una aproximación limitada a este escenario).
**Documentos relacionados:** `ACTIONS.md`, `RULES.md`.
**Última actualización:** 2026-09-28.

## Los tres escenarios (`domain/lab/scenario.ts`)

| ID | Ayuda de D3 | Qué permite comprobar |
|---|---|---|
| `drop_con_ayuda` | Sí | D3 deja a O3; posible pase a la esquina liberada |
| `drop_sin_ayuda` | No | D3 conserva la marca; sin esa liberación |
| `closeout_tardio_con_contacto` | Sí, ya comprometida al cargar el estado | Alcanza la rama de falta ordinaria de tiro por cierre tardío |

`closeout_tardio_con_contacto` no fuerza un pitido por su identificador: se
limita a cargar el estado más allá del punto en que D3 ya ayudó y O3 está
disponible (prompt §4), incluyendo que el defensor que repara (D4) parte de
una posición de recuperación más exigente (ya había rotado hacia el aro),
igual que ocurriría tras una ayuda comprometida. La legalidad real del
cierre se sigue decidiendo por hechos (ver `RULES.md`); verificado con 40
semillas en `possession-engine.test.ts` que la rama de falta es alcanzable.

## Dos resoluciones del mismo escenario

- **Detallado** (`domain/simulation/possession-engine.ts`): relato completo
  por pasos, cancha esquemática, un resultado por corrida.
- **Rápido** (`domain/fast/fast-resolver.ts`): reutiliza el motor detallado
  con semillas derivadas del lote y agrega solo las categorías que
  realmente representa (pantallas navegadas, ayuda dejada, pases al roll o
  a la esquina, tiros, pérdidas, robos, tapones, rebotes, faltas de tiro,
  balón fuera). No genera relato por jugada ni boxscore de partido.

## Qué demuestra la comparación

Cambiar la ayuda de D3 con la misma semilla altera dónde aparece la
oportunidad (verificado en `fast-resolver.test.ts`): sin ayuda,
`helpLeftAssignment` y `passesToCorner` son siempre 0; con ayuda, no. La
interfaz de laboratorio permite repetir el mismo escenario, cambiar solo la
ayuda o una capacidad, y comparar un lote pequeño desde la misma pantalla.
