# ADR-0005: El árbol de decisión y las fórmulas LAB-0.1 viven en un núcleo compartido, separado de la construcción de relato

**Estado:** ACCEPTED
**Última actualización:** 2026-09-28.

## Contexto

ME-01 (ADR-0004) asumía que el motor detallado y la aproximación rápida
podían compartir exactamente el mismo motor, porque el motor detallado ya
era analítico por tramo. En la práctica, HF-002 encontró que "compartir el
motor" se implementó como "el rápido llama literalmente a `runPossession`
por cada muestra y descarta el relato" (`fast-resolver.ts`, HF-002 §1.1):
no había ninguna ventaja de cálculo real, porque cada corrida seguía
construyendo el relato completo de hechos y el snapshot de diez jugadores
por paso, solo para tirarlo después.

El prompt HF-002 §3 exige una resolución rápida real: por etapas, sin
llamar a `runPossession`, sin relato ni snapshots por jugada, pero
compartiendo tipos, perfiles versionados, reglas FIBA alcanzables, LAB-0.1
y funciones puras de ejecución con el detallado — para que ambas rutas
respondan en la misma dirección a un cambio táctico o de capacidades.

## Decisión

Se extrae el árbol de decisión completo (pantalla, ayuda, opciones de O1,
tiro, rebote, falta y libres) a `domain/simulation/possession-core.ts`,
que:

- No construye relato de hechos con foto de posiciones ni objetos `Fact`:
  produce una línea de tiempo ligera (`RawEvent`: instante, fase, tipo,
  actores, texto, detalle) y, solo si se le pide explícitamente
  (`trackPositionHistory: true`), un historial de llegadas reales por
  jugador.
- Es la única fuente de verdad para el balón (`BallState`) de cada
  desenlace, derivado de la mecánica real (tapón, pérdida, robo, rebote,
  libre), no de un valor por defecto.

`possession-engine.ts` (motor detallado) pasa a ser un envoltorio fino:
llama al núcleo con `trackPositionHistory: true` y reconstruye, para cada
hecho, la foto de posiciones válida hasta ese instante (no la posición ya
mutada para cálculos posteriores), evitando que un hecho muestre una
posición futura como si ya hubiese ocurrido (HF-002 §1.3).

`fast-resolver.ts` llama al mismo núcleo con `trackPositionHistory: false`
y agrega categorías directamente desde la línea de tiempo ligera, sin
pasar nunca por `possession-engine.ts` ni por `runPossession`.

## Consecuencias

- El camino rápido es ahora medible y explicablemente más rápido que
  ejecutar el detallado en lote (≈1,5–1,75× en las mediciones de la PR de
  HF-002, mismo equipo, mismas semillas, con calentamiento y cálculo
  separado de render/BD): se ahorra la construcción de `Fact[]`,
  snapshots de diez jugadores y el historial de posiciones.
- Ambas rutas comparten literalmente el mismo árbol de decisión y las
  mismas fórmulas LAB-0.1: un cambio de capacidad o de instrucción táctica
  no puede divergir entre rutas por una reimplementación paralela.
- La afirmación de ADR-0004 de que "no hay una diferencia de coste
  computacional que justifique un segundo modelo" queda sustituida por
  esta decisión para la parte de construcción de relato; ADR-0004 no se
  reescribe (sigue siendo válida su decisión sobre llegadas analíticas
  frente a interpolación cada 100 ms), pero deja de describir la relación
  actual entre motor detallado y aproximación rápida: esa relación la
  describe este ADR.
- Añadir una segunda acción táctica seguirá extendiendo este mismo núcleo,
  no un tercer módulo paralelo.

## Alternativas descartadas

- Duplicar el árbol de decisión en `fast-resolver.ts` con su propia copia
  de las fórmulas: descartada porque introduce el riesgo de que ambas
  rutas diverjan silenciosamente ante el mismo cambio de capacidad o
  táctica, justo el invariante que HF-002 §3 pide preservar.
- Mantener `fast-resolver.ts` llamando a `runPossession` pero
  memoizando/cacheando resultados: descartada porque no resuelve el
  problema de fondo (seguiría construyendo relato completo por corrida) y
  la reproducibilidad exige semillas distintas por muestra, por lo que no
  hay resultados repetidos que cachear.
