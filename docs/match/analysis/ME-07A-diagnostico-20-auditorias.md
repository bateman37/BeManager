# BeManager — Diagnóstico de 20 auditorías del motor ME-07A

**Fecha de análisis:** 30-09-2026. **Código contrastado:** `origin/main` en `7b7eedd` (PR #10 fusionada). **Fuente táctica:** `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, leído completo. Los 20 archivos son exportaciones `ME-07A-AUDIT-1` aportadas por Dennis, semillas 86–96, 98–104; 91 y 102 aparecen dos veces con perfiles diferentes. El repositorio ya contiene el comienzo de ME-07B, incluido un cambio sobre el veto de T04; `docs/prompts/implementation/ME-07B-PROGRESS.md` aún dice que la PR #10 es Draft, dato desactualizado tras el merge.

## 1. Cómo se han comparado

Cada exportación incluye la configuración de ambos equipos, la lista de 12 jugadores por equipo con sus 27 capacidades activas y `fixtureDiff`, decisiones, hechos, continuidad, acta y conciliación. Las 20 tienen ataque `auto`, cobertura `auto`, defensa sin balón `auto`, prioridad de creación `equilibrado` y rebote `proteger_balance`. **No son 20 partidos de la misma plantilla**:

| Foto de atributos | Huella de la configuración | Partidos | Semillas | Diferencia frente a seed |
|---|---|---:|---|---|
| Seed de ambos equipos | `2d8067b0` | 11 | 91–96, 98–102 | Ningún perfil editado. |
| Sierra Clara aumentada | `da872180` | 6 | 86–91 | Sus 12 jugadores tienen 27 capacidades editadas; 320 deltas efectivos +3 y cuatro +2 por tope 15. Puerto Ámbar permanece en seed. |
| Sierra Clara aumentada más | `b296cbac` | 3 | 102–104 | Sus 12 jugadores tienen 27 capacidades editadas; 286 deltas +5, 20 +3, 14 +4 y cuatro +2 por topes. Puerto Ámbar permanece en seed. |

Las parejas de **semilla 91** (seed frente a +3) y **102** (seed frente a +5) son comparaciones controladas de la misma semilla y las mismas órdenes, aunque aumentar 27 capacidades a la vez impide adjudicar el efecto a un atributo concreto. Los nombres `+3` y `+5` describen la operación solicitada, no el incremento efectivo de cada rating.

## 2. Hallazgos cuantitativos

Las 20 partidas terminaron con causa `final`, y todos los checks de `result.reconciliation` dieron `ok`. También se comprobó independientemente que los FGA por familia más los no atribuidos suman los FGA por equipo en los 20 archivos. Esto acredita terminación y coherencia contable; **no** acredita buen baloncesto ni causalidad correcta de cada atribución futura.

| Métrica, denominador explícito | Seed, 11 partidos | Sierra +3, 6 partidos | Sierra +5, 3 partidos |
|---|---:|---:|---:|
| Ataque organizado: bloqueo directo / total de familias | 2.412 / 2.466 (97,8 %) | 1.400 / 1.409 (99,4 %) | 725 / 727 (99,7 %) |
| Mano a mano / total de familias | 54 / 2.466 | 9 / 1.409 | 2 / 727 |
| Defensa auto: drop / coberturas consideradas | 2.466 / 2.466 | 1.409 / 1.409 | 727 / 727 |
| Trampa elegible / coberturas consideradas | 0 / 2.466 | 0 / 1.409 | 0 / 727 |
| Triple del portador en transición elegido | 0 | 0 | 0 |
| Puntos combinados por partido, media | 268,2 | 274,3 | 276,7 |
| FGA combinados por partido, media | 250,6 | 234,2 | 241,3 |
| Faltas personales combinadas | 20 en 11 partidos | 51 en 6 | 24 en 3 |
| Tiros libres combinados | 33 en 11 partidos | 71 en 6 | 34 en 3 |
| Rebotes ofensivos Sierra / tiros de campo fallados Sierra¹ | 380 / 632 (60,1 %) | 206 / 299 (68,9 %) | 97 / 130 (74,6 %) |
| Rebotes ofensivos Puerto / tiros de campo fallados Puerto¹ | 404 / 731 (55,3 %) | 156 / 428 (36,4 %) | 98 / 239 (41,0 %) |
| Triples Puerto / FGA Puerto | 200 / 1.447 (13,8 %) | 577 / 662 (87,2 %) | 241 / 353 (68,3 %) |

¹ Es una **razón diagnóstica** calculada como OREB/(2FGA+3FGA−2FGM−3FGM). Los rebotes pueden seguir también a tiros libres fallados; no debe interpretarse sin matices como porcentaje oficial de rebote ofensivo.

**En conjunto:** 4.537 bloqueos directos de 4.602 elecciones de familia (98,6 %); 4.602 drops de 4.602 elecciones de cobertura; 0 triples del portador en transición; 4.012 posesiones estadísticas, 4.886 FGA, 1.341 rebotes ofensivos, 138 tiros libres y 95 faltas personales. La muestra base tiene solo 20 faltas personales y 33 libres en 11 partidos completos. La distribución simultánea de acciones, tiros, rebotes y faltas señala un problema del flujo de oportunidades, no uno que se resuelva añadiendo nombres tácticos al selector.

### Dos parejas con la misma semilla

| Semilla y foto | Resultado Sierra–Puerto | Tiros de Puerto, 2FGA / 3FGA | Rebotes ofensivos Sierra | Pérdidas Puerto |
|---|---:|---:|---:|---:|
| 91, seed | 138–145 | 126 / 17 | 28 | 1 |
| 91, Sierra +3 | 153–109 | 20 / 99 | 39 | 12 |
| 102, seed | 144–146 | 123 / 16 | 25 | 1 |
| 102, Sierra +5 | 180–107 | 46 / 81 | 31 | 9 |

Los ratings **sí llegan** a la simulación y pueden cambiar resultados y tipos de tiro. Lo que no cambian aquí es la acción de ataque elegida: el bloqueo directo casi siempre gana en ambas fotos. La variación extrema del rival merece diagnóstico por rutas de ayuda/recepción/rebote y atributos por tarea, no un ajuste del marcador.

### Distribución de tiros en la foto seed

Sierra lanzó 1.094 tiros de dos; O5, SC12 y SC11 intentaron **1.069** (97,7 %). Puerto lanzó 1.247 tiros de dos; D5, PA11 y PA12 intentaron **1.138** (91,3 %). Los únicos tipos de FGA observados en los 20 archivos son `close_finish` y `three_point`. El jugador recibe un papel demasiado predeterminado por la rama del bloqueo y su rol canónico. Los 11 encuentros seed registraron 2.408 pases a O5 frente a cuatro triples O1 en 2.412 primeras lecturas del bloqueo; las 442 segundas lecturas registradas terminaron todas en inversión a O3. Las 2.412 primeras lecturas declararon cerrada la vía de finalización de O1 y la esquina directa O3. No significa que cada posesión llegue a esa segunda lectura.

## 3. Causas concretas que se pueden comprobar en el código

1. **Selección de familia optimista y casi estática.** `modules/match/domain/simulation/possession-core.ts`, `estimateBloqueoDirectoOpportunity`, compara, entre otros, un **tiro limpio futuro de O5** cuando la pantalla supera un retraso; `estimateHandoffOpportunity` estima otra cadena con distinto coste. La ejecución real del bloqueo vuelve a evaluar contención y pases. La banda mediana observada del valor del bloqueo menos mano a mano es **+0,068** tanto en seed como en +3; seleccionar el mayor valor de solo dos acciones desde posiciones muy parecidas reproduce el monopolio. Falta comparar ventanas actuales, tiempo/preparación, entrega y respuestas rivales equivalentes. La hipótesis está respaldada por el algoritmo y las decisiones exportadas, pero la contribución exacta de cada término requiere pruebas contrafácticas.
2. **Defensa auto sin trampa practicable.** `estimateCoverageChoice` solo ofrece drop o trampa y exige que D5 llegue desde su posición heredada al punto del bloqueo antes de la ventana calculada. Las 4.602 decisiones registran `coverage_trap_not_eligible`. Resolver desde la preparación real de la pantalla y permitir desplazamientos defensivos ordenados es distinto de declarar elegible una trampa tardía o recolocar defensores instantáneamente.
3. **Árbol de lectura rígido.** En el `runDropPhase` observado, finalizar con O1 y pasar directamente a O3 están cerrados casi siempre; pasar al continuador, invertir si hay ayuda o lanzar el triple O1 absorbe el juego. Solo hay dos familias organizadas, dos tipos de FGA y pocas segundas lecturas distintas. La tendencia individual puede actuar en una banda, pero no compensa las opciones que nunca llegan a estar disponibles.
4. **El triple de transición no llega al juego natural.** En `linked-run.ts`, `evaluateTransitionThreeOpportunity` se invoca después de `read.kind === "sin_ventaja"`; las decisiones exportadas de transición nunca escogen `triple_portador`. La foto basal ya versionada de cuatro semillas informa de cero lecturas específicas de triple. Hay que registrar también por qué la ventana no llega a ser elegible y evaluar el lugar alcanzable en el momento de armar el tiro, con defensores que siguen moviéndose.
5. **Error verificable en el cálculo de rebote.** En `modules/match/domain/simulation/resolvers/rebound-resolver.ts`, se calcula `delay` solo cuando `c.closedOut`, pero `effectiveArrival` añade ese delay solo cuando `!c.closedOut`: la demora es **siempre cero**. Además, el filtro `withinFlightWindow` compara `arrivalTimeSeconds` sin el supuesto ajuste. Esto deja sin efecto ahí a `closeoutReboundDelaySeconds(T19,F05)` y puede alterar ganador y ventana de rebote. **No se puede atribuir toda la tasa ofensiva a este defecto** sin repetir las parejas tras corregirlo. La posición de caída, participantes, cierre, dominio de T20 y secuencias de segunda oportunidad también requieren auditoría.
6. **La auditoría incluye atributos, con un límite de causalidad.** Cada uno de los 480 snapshots de jugador incluye 27 ratings, medidas, tendencias y `fixtureDiff`; no aparecen los otros 18 atributos candidatos aún no activos. `byFamily` suma tiros de la misma pareja posesión/fase que `seleccion_familia` mediante un mapa que retiene la última selección, sin enlazar cada FGA al hecho causante y su orden temporal. Las sumas actuales concilian, pero una fase futura con dos entradas puede atribuir el tiro a la última familia aunque otra acción lo originó. El nuevo esquema debe guardar actor, capacidad consultada, decisión y enlace al hecho anterior concreto.

## 4. Huecos al comparar el manual con el prompt anterior

El capítulo es una **propuesta de diseño marcada DRAFT**: su §9 permitía un primer bloque pequeño. Dennis pide ahora cubrir **todo lo nombrado en el capítulo como táctica jugable**, y esa instrucción nueva amplía el alcance. El prompt previo de ME-07B recortó explícitamente nombres que el capítulo sí enumeraba.

| Capa del capítulo | Ya previsto por el prompt previo | Omitido o dejado como «candidato» pese a estar nombrado |
|---|---|---|
| Espacios, entradas y saques | 5-out, 4-out/1-in, 3-out/2-in, Horns, Delay, 1-4, stack, box | Empty side, dunker spot, sobrecarga y diamond como ocupación/entrada real; Iverson y elevator en saque. |
| Acciones, variaciones, lecturas | Bloqueo central/lateral, DHO, pindown, drag, double drag, Spain, Chicago/Zoom, pistol, hammer, reject, re-screen, slip, keeper, backdoor, roll/short roll/pop | **Ram, snake, ghost, curl, mantener al perseguidor detrás, lift/drift**; salida ante negación, receptor y espacio con movimientos específicos. |
| Defensa asentada y presión | Individual, zonas 2-3/3-2/1-3-1, box-and-one, presión toda pista/run-and-jump/2-2-1/1-2-1-1 | **Matchup zone, triangle-and-two, 1-2-2 de media pista y 1-2-2 de presión como fases diferentes, presión individual a 3/4**. |
| Responsabilidad defensiva | Drop/trampa/switch/show/under/at the level/ICE, gap/deny/top-lock, low man/tag/X-out | **Distancia, orientación, agresividad/manos, nail, stunt, dig, sink-and-fill, ayuda a la ayuda, scram, closeout y reglas/excepciones situacionales**. |
| Libro y planificación | Cinco carpetas, cinco roles, prioridad, salidas | Diferenciar ficha de banda Iverson y ficha de fondo elevator; carga de rebote por funciones, estructura posterior a una presión rota, sustituto por rol y coste de coordinación real. |

El capítulo **no** enumera `inverted`, `UCLA` ni `2-1-2` como opciones obligatorias; el prompt anterior los llamaba ejemplos del dossier. No se deben prometer como parte del capítulo sin consultar además las hojas originales de tácticas, que no están versionadas en `docs/match/reference`.

## 5. Orden de reparación y pruebas que discriminan

1. **Primero, evidencia y errores físicos:** congelar las 20 exportaciones como basal por foto; corregir la cancelación del retraso en rebote y comprobar mediante dos estados iguales con cambio solo de cierre/T19/F05 que la llegada, ganador y acta se explican. Medir también reloj, faltas y puntos sin forzar cifras objetivo.
2. **Después, gramática compartida y decisión:** estado continuo de diez jugadores, balón, reloj, fases y responsabilidades; comparar oportunidad inmediata y acciones preparables, contra defensas que reaccionan, antes de la resolución del tiro. Una misma ficha con drop, switch y trampa debe cambiar lectura, ayuda, tirador y destino final por causa. El portador real puede decidir y ceder iniciativa.
3. **Completar el inventario del capítulo con consecuencias:** cada nombre configurable debe tener un movimiento/asignación, condición de aplicabilidad, reacción rival y fallback; probarlo desde `/lab` y dentro de un partido completo. Un menú sin mecanismo es un incumplimiento visible.
4. **Repetir las 20 parejas de configuración/semilla y nuevas parejas de táctica:** comparar frecuencia por familia y cobertura con denominador, posesiones, duración, tipos/tiradores, 2FGA/3FGA, FT, PF, OREB y score; explicar la primera divergencia de las semillas 91 y 102. Examinar las decisiones negadas además de los tiros exitosos. No introducir turnos alternos, cuotas de acciones o clamps de marcador.

**Límites:** estas 20 corridas usan una sola configuración táctica por foto, dos equipos ficticios y semillas finitas. No miden el efecto de zonas, presiones o un libro de jugadas todavía inexistentes. Las medias muestran un problema en este fixture, no definen una distribución objetivo universal para el baloncesto real. La corrección del rebote se identifica por inspección estática del código y necesita una prueba del motor y un partido repetido para cuantificar su efecto.

## Anexo — Comprobación de cada exportación

Los conteos de PnR/mano a mano y drop suman ambos equipos; la última columna pertenece solo a Sierra. **Todas** las filas terminaron `final` y conciliaron el acta. La etiqueta de foto distingue las dos exportaciones con semilla 91 y las dos con semilla 102.

| Semilla | Foto | Sierra–Puerto | PnR / mano a mano | Drop | 2FGA/3FGA Puerto | OREB Sierra |
|---:|---|---:|---:|---:|---:|---:|
| 86 | +3 | 174–112 | 229 / 4 | 233 | 12 / 94 | 42 |
| 87 | +3 | 163–107 | 231 / 3 | 234 | 11 / 92 | 38 |
| 88 | +3 | 150–116 | 239 / 1 | 240 | 18 / 100 | 23 |
| 89 | +3 | 168–104 | 235 / 0 | 235 | 12 / 97 | 24 |
| 90 | +3 | 167–123 | 229 / 0 | 229 | 12 / 95 | 40 |
| 91 | +3 | 153–109 | 237 / 1 | 238 | 20 / 99 | 39 |
| 91 | seed | 138–145 | 223 / 2 | 225 | 126 / 17 | 28 |
| 92 | seed | 114–122 | 217 / 8 | 225 | 116 / 14 | 31 |
| 93 | seed | 139–140 | 224 / 1 | 225 | 111 / 16 | 57 |
| 94 | seed | 127–138 | 215 / 6 | 221 | 127 / 12 | 31 |
| 95 | seed | 137–117 | 218 / 7 | 225 | 107 / 17 | 39 |
| 96 | seed | 126–147 | 224 / 6 | 230 | 119 / 15 | 45 |
| 98 | seed | 129–139 | 219 / 6 | 225 | 113 / 21 | 34 |
| 99 | seed | 132–139 | 209 / 6 | 215 | 99 / 23 | 29 |
| 100 | seed | 115–147 | 222 / 5 | 227 | 108 / 29 | 36 |
| 101 | seed | 138–131 | 225 / 2 | 227 | 98 / 20 | 25 |
| 102 | +5 | 180–107 | 242 / 0 | 242 | 46 / 81 | 31 |
| 102 | seed | 144–146 | 216 / 5 | 221 | 123 / 16 | 25 |
| 103 | +5 | 175–91 | 246 / 1 | 247 | 34 / 73 | 32 |
| 104 | +5 | 174–103 | 237 / 1 | 238 | 32 / 87 | 34 |
