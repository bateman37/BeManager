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
- **Rápido** (`domain/fast/fast-resolver.ts`, HF-002): resuelve por etapas
  usando el mismo núcleo de decisión y las mismas fórmulas LAB-0.1 que el
  motor detallado (`domain/simulation/possession-core.ts`), pero **no
  llama a `runPossession`** ni construye relato por jugada ni snapshots de
  diez jugadores por paso: solo agrega las categorías que realmente
  representa (pantallas navegadas, ayuda dejada, pases al roll o a la
  esquina, tiros, pérdidas, robos, tapones, rebotes, faltas de tiro, balón
  fuera). Al saltarse la construcción de relato y el historial de
  posiciones, es medible y explicablemente más rápido que ejecutar el
  detallado en lote (≈1,5–1,75× en las mediciones de la PR de HF-002,
  mismo equipo, mismas semillas).

## Qué demuestra la comparación

Cambiar la ayuda de D3 con la misma semilla altera dónde aparece la
oportunidad (verificado en `fast-resolver.test.ts`): sin ayuda,
`helpLeftAssignment` y `passesToCorner` son siempre 0; con ayuda, no. La
interfaz de laboratorio permite repetir el mismo escenario, cambiar solo la
ayuda o una capacidad, y comparar un lote pequeño desde la misma pantalla.

**El lote siempre compara ayuda sí/no, no el escenario seleccionado**
(HF-002 §1.7): la comparación por lotes ejecuta siempre exactamente
`drop_con_ayuda` frente a `drop_sin_ayuda`, con independencia de qué
escenario esté elegido en la ejecución individual. `closeout_tardio_con_contacto`
no es una variante de ayuda sí/no y no participa en esa tabla; se prueba
en la ejecución individual, y la interfaz lo indica explícitamente para no
atribuir esa tabla a un escenario distinto del que realmente mide.
