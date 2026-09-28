# ADR-0004: El motor detallado calcula llegadas de forma analítica en vez de interpolar posiciones cada 100 ms

**Estado:** ACCEPTED
**Última actualización:** 2026-09-28.

## Contexto

El estudio de referencia recomienda un avance espacial con paso máximo
acotado (100 ms como hipótesis) y fronteras de evento exactas para el
motor detallado, pero también permite explícitamente prescindir de una
malla de navegación general para diez jugadores en una cancha pequeña,
empezando por trayectorias cortas
(`BeManager-del-estudio-al-motor-de-partidos-v1.md` §4.2, §5.2).

ME-01 implementa una única acción (bloqueo directo central) con roles y
objetivos de fase conocidos de antemano (pantalla, ayuda, cierre). Simular
una interpolación de posición genérica cada 100 ms para diez agentes con
evitación de obstáculos habría multiplicado el trabajo de esta entrega sin
cambiar el resultado observable para este escenario concreto.

## Decisión

El motor detallado (`modules/match/domain/simulation/possession-engine.ts`)
calcula los tiempos de llegada de cada responsable de forma cerrada
(distancia ÷ velocidad, con los retrasos LAB-0.1 de pantalla, ayuda,
cierre y contacto), en vez de interpolar posiciones en un bucle de pasos
≤100 ms. El reloj interno sigue siendo lógico y en milisegundos enteros
(sin `Date.now()` ni `Math.random()`), y el resultado se ordena
cronológicamente antes de presentarse, para conservar reproducibilidad y
la posibilidad de comparar resoluciones más adelante.

La aproximación rápida (`domain/fast/fast-resolver.ts`) reutiliza
exactamente este mismo motor, lo cual es coherente porque el motor
detallado de ME-01 ya es analítico por tramo: no hay una diferencia de
coste computacional que justifique un segundo modelo distinto en esta
entrega.

## Consecuencias

- Añadir una segunda acción táctica o más de diez jugadores en movimiento
  simultáneo podría requerir revisar esta decisión hacia un bucle de
  posiciones real, si las trayectorias dejan de ser tramos rectos
  conocidos de antemano (por ejemplo, con evitación de obstáculos entre
  varios bloqueos).
- Las pruebas de invariantes (tiempos positivos, orden cronológico,
  reproducibilidad) siguen siendo válidas independientemente de esta
  decisión, porque verifican el contrato de `MatchState`, no el mecanismo
  interno de cálculo.

## Alternativas descartadas

- Interpolación genérica de posiciones cada 100 ms con evitación de
  obstáculos: descartada por complejidad injustificada para una única
  acción con roles y objetivos conocidos; el estudio de referencia permite
  explícitamente esta simplificación en este tamaño de entrega.
