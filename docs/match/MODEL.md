# Modelo y hechos del Laboratorio de Partido

**Estado:** ACTIVE
**Es fuente de verdad para:** las entidades de estado y el modelo de hechos que usa ME-01.
**Debe leerse cuando:** vayas a leer o modificar `modules/match/domain/simulation/`.
**No cubre:** un partido completo de 40 minutos (todavía no existe).
**Documentos relacionados:** `RULES.md`, `ACTIONS.md`, `docs/architecture/DATA_AND_PERSISTENCE.md`.
**Última actualización:** 2026-09-28.

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

## Qué no modela todavía

Posesión estadística, fase ofensiva y evento están fusionados en un único
concepto de "posesión de laboratorio" (el prompt ME-01 no exige separarlos
todavía). No hay reloj de partido completo (cuatro períodos), ni
sustituciones, ni más de un quinteto por equipo.
