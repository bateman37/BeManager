# Acta del partido de laboratorio (ME-04)

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo se calcula el acta (boxscore) del partido completo a partir de los hechos y qué invariantes la concilian.
**Debe leerse cuando:** vayas a añadir o cambiar una categoría estadística, o a leer `domain/game/box-score.ts`.
**No cubre:** la adjudicación de las reglas (ver `RULES.md`) ni el modelo del partido (ver `MODEL.md`).
**Documentos relacionados:** `RULES.md`, `MODEL.md`, FIBA Statisticians' Manual 2024.
**Última actualización:** 2026-09-29 (ME-06).

## Principio

El acta es una **proyección**: `projectBoxScore` recorre una vez el registro
append-only de hechos del partido (cada hecho se lee una sola vez) y no
consulta el estado interno del motor ni se ajusta después. La adjudicación
FIBA ya decidió cada hecho; el acta solo lo cuenta.

## Categorías y convenciones (Manual FIBA 2024, en lo alcanzable)

| Categoría | Se cuenta con |
|---|---|
| 2FGM/2FGA, 3FGM/3FGA | `field_goal_attempt` (falta con fallo: sin FGA; and-one: FGA y FGM; tapón: FGA; tiro solo preparado: nada) |
| FTM/FTA | cada `free_throws_result` |
| Puntos | 2×2FGM + 3×3FGM + FTM, también por período |
| Rebote ofensivo/defensivo | control tras tiro o último libre fallados, y la recuperación de un tiro taponado; ofensivo si el reboteador es del equipo de la posesión |
| Rebote de equipo | fallo sin control de jugador que acaba en saque (balón fuera); si el período termina antes del control, no hay rebote |
| Asistencia | último pase recibido por el tirador sin otra acción entre medias (organización, lectura de transición o de segunda oportunidad, pantalla, mano a mano/bloqueo indirecto de ME-06), con canasta; o con falta de tiro en fallo si convierte al menos un libre. Nunca dos por la misma jugada |
| Pérdida / robo | pérdida al último atacante con control; robo solo si el defensor obtiene el control él mismo (convención de ME-03: un balón suelto recuperado no es robo). Violación de 24 s u 8 s: pérdida de equipo; de 5 s en el saque: del sacador |
| Tapón | `shot_blocked` |
| Faltas cometidas / recibidas | `personal_foul` (infractor y receptor se conservan aunque luego se sustituyan) |
| Minutos | reloj de partido que corre entre dos hechos del mismo período, para los diez en pista; interno en ms, mostrado al segundo |
| DNP | nunca estuvo en pista en ningún hecho |

## Invariantes (`reconcileBoxScore`, visibles en `/lab`)

- Puntos del acta = 2×2FGM + 3×3FGM + FTM = marcador, por equipo.
- Suma de parciales por período = marcador.
- En cada fila, FGM ≤ FGA y FTM ≤ FTA.
- Minutos del equipo = 5 × tiempo de juego disputado (incluidas prórrogas).
- Minutos del acta = minutos que el motor acumuló con el reloj en marcha,
  al milisegundo.

Una corrida detenida por el guardián también concilia, sobre el tiempo
realmente disputado; no se presenta como partido final.

## Simplificaciones declaradas

Sin minutos de descanso ni tiempos muertos; sin estadística de tiros por
zona, faltas técnicas ni rebotes ofensivos de equipo tras palmeo. Las
categorías que el motor todavía no representa (p. ej. pérdidas por pasos)
no aparecen como ceros inventados de otra acción.
