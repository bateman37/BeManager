# Modelo y hechos del Laboratorio de Partido

**Estado:** ACTIVE
**Es fuente de verdad para:** las entidades de estado y el modelo de hechos de ME-01, el modelo de continuidad entre posesiones del tramo de ME-03 y el estado del partido completo de ME-04.
**Debe leerse cuando:** vayas a leer o modificar `modules/match/domain/simulation/`.
**No cubre:** las reglas de reloj, faltas y reanudación (ver `RULES.md`) ni el acta (ver `BOXSCORE.md`).
**Documentos relacionados:** `RULES.md`, `ACTIONS.md`, `docs/architecture/DATA_AND_PERSISTENCE.md`.
**Última actualización:** 2026-09-30 (ME-07A).

## Entidades de estado (`MatchState`)

- **Reloj interno**: milisegundos enteros, avance con paso máximo de 100 ms
  y cortes exactos de evento (`domain/time/clock.ts`).
- **Relojes reglamentarios**: reloj de partido y de lanzamiento, en ms.
- **Balón**: estado (`held`/`in_flight_pass`/`in_flight_shot`/`loose`/`dead`),
  poseedor y posición.
- **Diez jugadores en pista**: posición 2D en metros; el rol (manejador,
  bloqueador, esquinas, alas, y sus equivalentes defensivos) viene del
  escenario, no del perfil.
- **Hechos** (`Fact`): secuencia, instante, fase
  (`ordenado`/`reconocido`/`intentado`/`ejecutado`/`concedido`), tipo,
  participantes, texto en español y una foto de "quién estaba dónde" en ese
  instante — la base del detalle seleccionable de la interfaz.
- **Estado terminal** (`TerminalOutcome`): el único conjunto de desenlaces
  legales de una posesión de laboratorio (ver `RULES.md`).

## Núcleo compartido y foto fiel al instante del hecho (HF-002)

El árbol de decisión, las fórmulas LAB-0.1 y los estados terminales viven
en `domain/simulation/possession-core.ts`, compartido por el motor
detallado y por el resolvedor rápido (ver `docs/match/SCENARIOS.md`). El
núcleo no construye snapshots de posición durante el cálculo: registra un
historial de llegadas reales por jugador (solo cuando el motor detallado
lo activa) y `possession-engine.ts` reconstruye, para cada hecho, la
posición de cada jugador *tal y como era conocida hasta ese instante*, no
la posición final ya mutada para los cálculos posteriores. Así un hecho
nunca muestra una posición futura como si ya hubiese ocurrido.

El balón (`BallState`) se deriva de la mecánica real de cada desenlace, no
de un valor por defecto: un tapón o una pérdida en balón vivo dejan el
balón `loose` (suelto, sin dueño) en el punto donde ocurrió, un robo lo
deja `held` por quien lo recuperó, y solo una canasta anotada lo deja
`dead` en el aro.

## Snapshots e independencia de partidas en curso

`MatchInput` es una copia estable de perfiles, escenario, semilla y
versiones (`labParametersVersion`, `rulesetVersion`). El motor no relee la
base de datos mientras calcula: modificar y guardar un jugador desde la
interfaz no altera una corrida ya iniciada, porque esa corrida ya recibió su
propio snapshot de perfiles (invariante verificada en
`possession-engine.test.ts`).

## Reproducibilidad

El núcleo no usa `Date.now()` ni `Math.random()`. Recibe una semilla entera
y un generador reproducible (`domain/random/seeded-random.ts`, mulberry32).
Misma entrada (perfiles + escenario + semilla) produce siempre la misma
secuencia de hechos.

## Estadística oficial y cobertura (ME-02)

El hecho `field_goal_attempt` distingue el tiro de campo oficial FIBA de la
oportunidad de tiro preparada (`shot_prepared`); ver `RULES.md` para la
regla exacta. `MatchInput` incorpora además `coverage: "drop" | "trampa"`,
independiente del escenario: la misma media pista, quintetos y bloqueo
central se resuelven con cualquiera de las dos coberturas (ver
`ACTIONS.md`).

**ME-06:** `MatchInput`/`GameTeamInput` incorporan `offensivePlan`
(`"auto" | "bloqueo_directo" | "mano_a_mano_sin_balon"`, opcional en
`MatchInput` con valor por defecto `bloqueo_directo`, y siempre presente
en `GameTeamInput` con valor por defecto `auto`) y
`offBallDefensiveCall` (`"negar_primera_salida" | "guardar_espacio"`,
por defecto `guardar_espacio`), ambos independientes de `coverage` y del
escenario: la misma disposición admite las dos familias ofensivas y
cualquier combinación de cobertura/orden (ver `ACTIONS.md`).

**ME-07B v2 (LAB-0.7):** `GameTeamInput.screenPlacement`
(`"auto" | "central" | "lateral"`, por defecto `auto`) y
`MatchInput.screenPlacement` (`"central" | "lateral"`, por defecto
`central`): la colocación del bloqueo directo de cada acción organizada,
con su propia disposición (`LATERAL_PNR_TARGETS`) y continuación; la mano
a mano solo desde la central. `coverage` admite además `a_la_altura`.

**ME-07A:** `coverage` y `offBallDefensiveCall` admiten `"auto"` (ver
`ACTIONS.md`, resuelto de forma pura antes del árbol); `GameTeamInput`
añade `creationPriority` (`"equilibrado" | "buscar_aro" | "buscar_triple"`,
por defecto `equilibrado`). `PlayerProfile` añade `shotTendency`
(`"prudente" | "equilibrada" | "decidida"`, por defecto `equilibrada` en
los perfiles ya persistidos), ortogonal a `pnrTendency`.

## Continuidad entre posesiones: el tramo de ME-03

`domain/sequence/play-tramo.ts` juega hasta cuatro posesiones estadísticas
enlazadas desde `drop_con_ayuda` (7:12 del primer cuarto, 18 s). Separa
conceptos que en ME-01 estaban fusionados:

| Concepto | Dónde vive | Qué es |
|---|---|---|
| Evento | `TramoEvent` | Hecho con instante absoluto creciente, posesión y fase, equipo de la posesión, actores reales, foto de los diez, balón, control, relojes y marcador |
| Fase de una posesión | `PhaseRecord` | Tramo ofensivo continuo: inicio, rebote ofensivo, salida segura, balón suelto propio; con su entrada (ataque organizado, ventaja temprana, segunda oportunidad) y el motivo |
| Posesión estadística | `PossessionRecord` | Del control (o derecho a saque) de un equipo hasta que el rival lo obtiene; un rebote ofensivo **no** abre otra |
| Equipo con control | `ControlState.controlTeamId` | Solo con balón retenido o pase en el aire |
| Derecho a saque | `ControlState.throwInTeamId` | Balón muerto ya adjudicado a un equipo |
| Balón suelto sin control | `ControlState.status = "balon_suelto"` | Nadie controla; la posesión estadística sigue abierta |

En cada frontera se hereda: los diez IDs y sus coordenadas globales reales
(trayectorias con puntos de paso, `geometry/trajectory.ts`), el balón,
los encargos vigentes (`ResponsibilityChange`: cargar, balance, retorno,
salida, saque, organización), el lado atacado, los relojes, el marcador y
el estado del azar (`rngStateAtBoundaries`). Ninguna posesión posterior
recarga `scenario.ts` ni vuelve a 7:12/18 s: los jugadores **se desplazan**
hacia la disposición del bloqueo a su velocidad real.

`TramoInput` es el snapshot único del tramo: semilla, los diez perfiles
(copia profunda), la prioridad tras tiro de cada equipo, la cobertura y las
versiones (`FIBA-2026`, `LAB-0.2`, `ME-03-TRAMO-1`). El tramo reutiliza el
núcleo compartido en su **modo enlazado** con un marco local de ataque y
roles canónicos (ver `docs/decisions/ADR-0006-linked-possessions-local-frame.md`);
Puerto Ámbar ataca el aro izquierdo con sus propios jugadores y
capacidades, y la foto que ve el usuario es siempre global.

## Partido completo (ME-04)

`domain/game/play-full-game.ts` (`playFullGame`) juega un partido entero en
una llamada del dominio con el **mismo motor de continuidad** del tramo
(`domain/sequence/linked-run.ts`, ADR-0007); no hay bucle de microticks: el
tiempo avanza de hecho en hecho.

- **Foto única** (`GameInput`, `game-model.ts`): hasta doce inscritos por
  equipo (copia profunda), cinco titulares en orden de rol, roles
  funcionales declarados (`players/functional-roles.ts`), prioridad tras tiro
  y **cobertura de cada equipo**, semilla y versiones (`FIBA-2026`,
  `LAB-0.2`, `ME-04-GAME-1`, `ME-04-JUMP-1`, `ME-04-ROT-3`). Empieza 0–0, C1
  10:00, con el salto inicial; no reutiliza la entrada 7:12/18 s del tramo.
- **Estado del partido:** período, sentido de ataque de cada equipo, flecha
  de alternancia, control/derecho a saque/balón suelto, relojes (partido,
  lanzamiento, 8 s), marcador, faltas personales y de equipo por período,
  elegibilidad (excluidos, bloqueo de reentrada), quinteto por rol, minutos
  totales y continuos, hechos y estado del azar.
- **Quinteto y roles:** en cada instante hay cinco jugadores reales por
  equipo, uno por rol `1 base / 2 escolta / 3 alero / 4 ala-pívot / 5
  interior`. El rol del sistema (O1…O5/D1…D5 dentro del núcleo) sale del
  quinteto vigente, no del ID; un suplente ocupa el rol de quien sale. Cada
  ID está en pista o en el banquillo, nunca en ambos.
- **Hechos:** los del tramo (`TramoEvent`) más `period` y `onCourtIds`
  (los diez en pista), con nuevos tipos para salto, flecha, bocina, inicio y
  fin de período, falta personal, exclusión, sustitución, contención,
  segunda entrada y final. Los hechos entre el fin de un período y el
  siguiente saque no pertenecen a ninguna posesión (`possessionIndex` 0).
- **Resultado** (`GameResult`): `gameId` local reproducible, hechos,
  posesiones, períodos con parciales, sustituciones, faltas, acta
  (`BOXSCORE.md`), minutos del motor, tiempo disputado y recuento de
  entradas de ataque. No se persiste (historial y checkpoints: ME-09).
- **Guardián:** límite de pasos, fases por posesión, ciclos sin avance y
  prórrogas encadenadas (12): detiene con diagnóstico y `winnerTeamId: null`.

## Qué no modela todavía

Dirección en vivo, fatiga y tiempos muertos (ME-05), alineación de
jugadores en los pasillos de tiros libres, historial de partidos (ME-09) y
un modo rápido de partidos (ME-08; el rápido sigue limitado a sus
escenarios de una posesión).
