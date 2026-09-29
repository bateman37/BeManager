# Modelo y hechos del Laboratorio de Partido

**Estado:** ACTIVE
**Es fuente de verdad para:** las entidades de estado y el modelo de hechos de ME-01, y el modelo de continuidad entre posesiones del tramo de ME-03.
**Debe leerse cuando:** vayas a leer o modificar `modules/match/domain/simulation/`.
**No cubre:** un partido completo de 40 minutos (todavía no existe); las reglas de reloj/reanudación del tramo (ver `RULES.md`).
**Documentos relacionados:** `RULES.md`, `ACTIONS.md`, `docs/architecture/DATA_AND_PERSISTENCE.md`.
**Última actualización:** 2026-09-28 (ME-03).

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

## Qué no modela todavía

Partido completo (cuatro períodos, fin de cuarto, prórroga), faltas
acumuladas y bonus, sustituciones, más de un quinteto por equipo,
alineación de jugadores en los pasillos de tiros libres, y un modo rápido
de tramos (el rápido sigue limitado a sus escenarios de una posesión).
