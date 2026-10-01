# Auditoría exportable del partido detallado (ME-04A/ME-04B)

**Estado:** ACTIVE
**Es fuente de verdad para:** el esquema del `.json` de auditoría, sus
unidades, el alcance real de `decisions` y las reglas de `no_evaluada`.
**Debe leerse cuando:** vayas a interpretar un archivo de auditoría
descargado desde `/lab`, o a añadir un nuevo punto de observación al
colector (`domain/audit/`).
**No cubre:** el árbol de decisión en sí (ver `ACTIONS.md`), el modelo de
hechos (ver `MODEL.md`) ni el acta (ver `BOXSCORE.md`): este documento solo
describe cómo se observa y se exporta lo que esos documentos ya definen.
**Documentos relacionados:** `MODEL.md`, `ACTIONS.md`, `BOXSCORE.md`,
`docs/decisions/DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`.
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-5: puntos y
hechos de Horns→Spain y de Delay, configuración `chainedVariant`/
`backScreenCall` exportada).

## Qué es y qué no es

Un archivo por partido, autónomo, para investigar **por qué** ocurrió algo
sin depender de la aplicación ni de PostgreSQL. Se genera en el navegador,
desde el `GameInput` y el `GameResult` **ya calculados** de esa corrida
(`domain/audit/build-audit-export.ts`, función pura): no vuelve a jugar el
partido, no reconstruye causas a partir del acta y no envía nada fuera del
equipo. No es un guardado persistente (eso es ME-09): solo vive mientras el
resultado sigue en la sesión del navegador.

## Cómo se registra (sin cambiar la simulación)

Un colector opcional (`domain/audit/audit-collector.ts`) se enhebra por
`playFullGame` → `LinkedRun` → `computePossessionCore` y los resolutores de
drop/trampa, segunda entrada, tiro/rebote y falta sin tiro
(`domain/simulation/possession-core.ts`, `second-entry-read.ts`,
`domain/sequence/linked-run.ts`). En cada punto donde el árbol **ya
decidió**, se registra qué opciones se evaluaron y con qué valores; nunca se
calcula una alternativa extra solo para el informe. Con el colector nulo
(auditoría desactivada) el coste y el comportamiento son exactamente los de
antes de ME-04A: la prueba discriminante `audit-export.test.ts` verifica
que ON y OFF producen el mismo marcador, acta, hechos, sustituciones,
relojes y estados del generador de números aleatorios, con la única
diferencia del registro.

## ME-06: selección de familia, mano a mano y comparación entre fotos

Esquema versionado a `"ME-06-AUDIT-1"` (contrato cambiado: nuevos campos
de equipo y nueva sección de resumen; no reinterpreta ni sobrescribe los
archivos `ME-04B-AUDIT-1` ya descargados, que siguen siendo evidencia de
otra versión).

- **Nuevos puntos de `decisions.records`:** `seleccion_familia` (elección
  pura entre `bloqueo_directo`/`mano_a_mano_sin_balon`, con
  `family_opportunity_higher/lower` cuando fue `auto`, o
  `family_forced_by_plan` cuando el equipo fijó una familia), y para la
  mano a mano: `entrada_mano_a_mano`, `transferencia_mano_a_mano`,
  `bloqueo_indirecto_o3` y `lectura_mano_a_mano` — mismas reglas de
  `status`/`reasonCode`/`factLink` que el resto del árbol.
- **`input.teams[]`** ahora declara también `offensivePlan` y
  `offBallDefensiveCall` (la foto de cada equipo para todo el partido), y
  cada jugador del roster lleva `fixtureDiff`: diferencias reales por
  atributo frente a `LAB_ROSTER_FIXTURE` (`delta = actual − fixture`),
  `null` cuando el ID no pertenece al fixture (jugador añadido a mano).
- **Huella estable:** `run.matchFingerprint` e `input.teams[].fingerprint`
  (hash FNV-1a sobre la foto efectiva — atributos, medidas, quinteto,
  roles, cobertura, plan y orden — **excluyendo** semilla, `gameId`,
  `exportedAt` y `buildId`). Dos exportaciones con la misma foto y
  distinta semilla comparten huella; una edición real de un solo
  atributo la cambia. Se recalcula siempre desde la foto completa: nunca
  se infiere de una etiqueta de lote ni de atributos saturados en 15.
- **`result.summary.byFamily`:** entradas y tiros reales por familia y
  equipo, agrupando `seleccion_familia` por (posesión, fase) y
  atribuyendo los `field_goal_attempt` reales de esa misma fase. Los FGA
  de fases sin `seleccion_familia` (transición/ventaja temprana, segunda
  oportunidad, segunda entrada del bloqueo directo) quedan fuera de
  propósito; su hueco se declara en `coverageGaps` con
  `possessionsAffected`. `null` cuando la auditoría no estaba activada
  (mismo coste cero que el resto de `decisions`).

## ME-07A: decisión generalizada, defensa `auto` y `phaseIndex` corregido

Esquema versionado a `"ME-07A-AUDIT-1"` (no reinterpreta ni sobrescribe los
archivos `ME-06-AUDIT-1` ya descargados).

- **Corrige un defecto real de ME-06**: el `phaseIndex` de las decisiones
  (`seleccion_familia`, `organizacion_creador`) estaba desfasado en uno
  frente al de los hechos (`pushEvent`), así que `result.summary.byFamily`
  nunca casaba un tiro con la decisión de familia de su propia fase.
  Corregido en `linked-run.ts` (misma convención 1-based que `phase.index`);
  regresión en `domain/audit/phase-index-attribution.test.ts`.
- **`result.summary.byFamilyUnattributed`**: FGA por equipo que no
  pertenecen a ninguna fase con `seleccion_familia` (separados en 2FGA/3FGA),
  para poder verificar por equipo que atribuidos + sin atribuir = FGA del
  acta.
- **Nuevos puntos de `decisions.records`:** `seleccion_cobertura` y
  `seleccion_orden_sin_balon` (defensa `auto`, ver `ACTIONS.md`);
  `entrada_fase_transicion` añade el desenlace `triple_portador`.
  `organizacion_creador` deja de tener una única opción fija: compara al
  poseedor real contra el manejador de rol con motivo estable
  (`creator_kept_by_real_holder`/`creator_pass_back_faster`).
- **`input.teams[]`** añade `creationPriority`; cada jugador del roster
  añade `shotTendency`. Ambos entran en `matchFingerprint`/
  `fingerprint` del equipo: cambiarlos invalida un resultado anterior,
  igual que `offensivePlan`.

## ME-07B v2: `ME-07B-AUDIT-1` y disputa de rebote

Esquema versionado a `"ME-07B-AUDIT-1"` (no reinterpreta los archivos
`ME-07A-AUDIT-1`). Nuevo punto `disputa_rebote`, emitido tras cada rebote
de tiro o libre que toca aro: una opción por candidato real (ID en pista)
con `rawArrivalSeconds`, `effectiveArrivalSeconds`, `inPool`,
`boxedOutBy`/`boxOutDelaySeconds`/`closerT19`/`closerF05` si un rival le
cerró, `boxesOut` si él cerró, y sus T19/F05/T20 consultados. Motivos
`rebound_boxed_out_by_rival`, `rebound_arrival_in_window`,
`rebound_arrival_outside_window`; elegida = quien controló. El hecho
`rebound_secured`/`rebound_contested` lleva los mismos cierres en
`detail.boxOuts`. `seleccion_familia` (§2.2) añade por familia
`bestReadOption`, `bestReadRawValue`, `bestReadCompletion` y
`projectedDecisionSeconds` de la primera lectura proyectada en seco
(`projectedCoverage: "drop"` para el bloqueo directo);
`seleccion_cobertura` (§2.3) añade la concesión proyectada, la rama
prevista de la trampa, `stealProbability`, llegadas de D5/pase y la
mezcla con lo observado (`observedUses`, `observedPoints`,
`blendedValue`); desde §5 compiten `drop`, `trampa`, `cambio`, `show`,
`por_debajo` e `ice` (motivos `coverage_tied_base_kept` si su concesión es
idéntica a la de drop y `coverage_ice_central_not_eligible`). Nuevos puntos
`lectura_cambio` y `lectura_show` (motivos `read_value_higher/lower`,
`read_option_not_viable`) y hechos `switch_committed`, `show_committed`,
`show_recovery` y `coverage_not_applicable` (`requested`, `applied`,
`lateral`); `screen_navigated.detail.route = "por_debajo"` en el under.
**LAB-0.7 (v2-3):** punto `colocacion_bloqueo` (una opción por colocación
evaluada con `projectedValue`, creador, bloqueador, plan y lectura
proyectados; motivos `placement_projected_value_higher/lower`,
`placement_forced_by_plan`, `creator_ready_later_in_band`);
`organizacion_creador` añade `placement`; `seleccion_familia` ante la
lateral marca la mano a mano `family_not_in_lateral_placement`;
`seleccion_cobertura` añade `a_la_altura` y da a `ice` su concesión
proyectada cuando la pantalla es lateral (`lateralScreen`). Puntos
`lectura_ice` y `lectura_a_la_altura`; `lectura_show`/`lectura_a_la_altura`
llevan `halted`, `driveStartSeconds` y `d5RecoversTo`. Hechos
`ice_committed` (`icePoint`, `d1IceAt`, `screenUsedAt`, `lowHelpSpot`,
`d5LowAt`), `ice_late`, `at_level_committed`/`show_committed`
(`depthToHoop`) y `at_level_recovery`; `organized_entry` y `screen_set`
llevan `placement`. La configuración exportada de cada equipo añade
`screenPlacement` (entra en la huella). **§3:** cada opción de
`seleccion_familia` lleva `cardId`, la ficha de libro a la que corresponde
(`null` si la colocación no admite esa familia).
**v2-4 (LAB-0.8, Horns):** `colocacion_bloqueo` admite `horns`; ante Horns
la mano a mano se marca `family_not_in_card_placement`; `organized_entry`
lleva `placement: "horns"` y los roles (O3 = segundo cuerno); el texto de
`help_left_assignment` dice dónde queda libre el jugador («en el codo» /
«en la esquina débil») y `invertir_o3`/`pase_o3` llevan `shotType`. Cada tiro
de `result.summary.shots` añade `cardId` (ficha en vigor de su fase) y la
acción causante incluye ahora `lectura_cambio`, `lectura_show`,
`lectura_a_la_altura` y `lectura_ice` (antes faltaban). La opción
`bloqueo_directo` de `seleccion_familia` pasa a `projectedCoverage:
"observada"` con `coverageWeight_<cobertura>`, `valueAgainst_<cobertura>` y
`expectedValueOverShownCoverages` (tendencia observada del rival, LAB-0.4).
**v2-5 (LAB-0.9, Horns→Spain):** puntos `seleccion_variante` (opciones
`horns_bloqueo`/`horns_spain`; en `auto`, `expectedValueOverShownCoverages`,
`valueAgainst_*`, `coverageWeight_*`; motivos `variant_projected_value_*`,
`variant_forced_by_plan`), `lectura_spain_bloqueador` (`bloqueo_ciego`/
`quedarse_en_codo`; motivos `back_screen_target_present/absent`,
`back_screen_shot_clock_insufficient`; valores `coverage`, `d5DistanceToHoop`,
`backScreenSetSeconds`), `respuesta_bloqueo_ciego` (`seguir`/`ayudar`/
`cambiar` con `concessionValue`, `call`, `switchCallSeconds`,
`rollStartSeconds`, `d5ReleaseSeconds`; motivos `back_screen_lower/
higher_concession`, `back_screen_forced_by_call`,
`back_screen_switch_recognized_late`) y `lectura_spain` (acción causante de
tiro). Hechos `back_screen_set` (`screenPoint`, `backScreenDelay`,
`d5ReleaseAt`, `handlerWaitSeconds`), `back_screen_switch`, `back_screen_pop`
(`popSpot`, `arrivesAt`); `roll_continuation` lleva `deep` y se fecha al
arrancar el roll en Spain. `seleccion_familia.cardId` y `summary.shots[].cardId`
valen `horns_spain`. **v2-5 (LAB-0.10, Delay):** `colocacion_bloqueo` admite
`delay`; `seleccion_familia` elige la mano a mano con `cardId:
delay_mano_a_mano` (el bloqueo, `family_not_in_card_placement`);
`seleccion_cobertura` ante Delay compara solo drop/cambio/show (respuestas
hundirse/cambiar/saltar la entrega, `delayResponse`, `concessionValue`) y marca
el resto `coverage_not_in_card`; puntos `entrega_delay` (`entrega_completada`/
`entrega_negada`/`entrada_negada` con `handoffScreenDelay`, `d1BackSeconds`,
`d5JumpArrivalSeconds`), `lectura_delay`, `lectura_delay_pivote`,
`respuesta_poste` (`ayudar_poste`/`quedarse_esquina`, `digArrivalSeconds`,
`postTurnSeconds`, `digInTime`; motivos `help_lower/higher_concession`) y
`lectura_poste` (las tres de lectura son acción causante de tiro; `holderId`
es quien lee: manejador, pívot o poste). Hechos `delay_hold`, `dho_completed`,
`dho_denied`, `backdoor_cut`, `post_dig` (`digPoint`), `weak_side_cut`. La
configuración exportada de cada equipo añade `chainedVariant` y
`backScreenCall` (entran en la huella). **v2-6 (comparador):**
`colocacion_bloqueo` añade por opción `firstReadSeconds`, el desglose
`valueAgainst_<cobertura|respuesta>` y `coverageWeight_<cobertura>`, la mejor vía
ante el plan base (`baseBestRead`, `baseBestReadRawValue`,
`baseBestReadCompletion`, `baseDecisionSeconds`), `spainCalled` en Horns y, en
la elegida, la asignación ejecutada (`chosenAssignmentValue`,
`chosenHandlerId`, `chosenScreenerId`, `chosenFirstReadSeconds`); motivo nuevo
`placement_tied_first_read_later` (a igual valor exacto) en lugar de
`creator_ready_later_in_band` entre fichas. `organizacion_creador` añade
`firstReadSeconds`. `lectura_segunda_o5` sin opción (`chosenOptionId=null`,
todas `receiver_option_not_viable` con `shotClockSeconds`) cuando el reloj
expira antes de cualquier vía del receptor.
**§2.6:** `result.summary.shots` enlaza cada FGA a la
familia elegida antes que él en su fase y a la última decisión de
lectura/entrada anterior (`causingDecision` con id, punto, opción,
instante y `factLink`), con tirador real, posición e instante; categorías
`familia`/`transicion`/`segunda_oportunidad`/`otra_fase`. `byFamily`
cuenta los tiros con esa atribución (antes: la última familia de la fase).
**§2.4–§2.5:** `organizacion_creador` lista una opción por creador
candidato (ID real) con `projectedValue`, `screenerId`, `projectedPlan`,
`projectedBestRead` y `readySeconds`; motivos
`creator_kept_by_real_holder`, `creator_projected_value_higher`,
`creator_pass_back_faster`, `creator_ready_later_in_band`. El hecho
`organized_entry` lleva `detail.roles` (rol → ID real).
`lectura_bloqueo_o1` añade `parada_o1`/`flotadora_o1` (tipo, distancia,
cerrador, oposición) y `triple_o1.contesterId`; `lectura_segunda_o5` pasa
a `finalizar_aro`/`flotadora`/`invertir_o3` (cerrador y oposición real) con
`receiver_value_higher|lower`, `receiver_option_not_viable` y los motivos
de tendencia; `help_decision` lleva `concessionWithHelp/WithoutHelp`.
`entrada_fase_transicion.triple_portador` guarda profundidad, carrera,
cerrador, oposición y `organizeProjectedValue`. `resolucion_tiro.legal_contest`
añade `contactFoulProbability`, `contactFoul` y `contesterM07`;
`puerta_falta_sin_tiro` registra también las faltas de trampa y de rebote
(`contact_foul_drawn`/`contact_foul_not_drawn`, `situation`,
`foulProbability`). Tipos de FGA: `close_finish`, `floater`, `mid_range`,
`three_point` (los dos intermedios cuentan como 2FGA).
Sigue pendiente de este encargo (§6):
candidatos viables/inviables por decisión en todos los puntos y los
demás puntos nuevos de §6.

## Esquema (`schemaVersion: "ME-07B-AUDIT-1"`)

| Sección | Contenido |
|---|---|
| `schemaVersion` / `run` | Versión del esquema, `gameId`, semilla, causa de parada (`final`/`guardian`), versiones de motor/reglas/parámetros/rotación, `buildId` solo si el entorno lo expone, y `exportedAt` (fecha real de exportación, separada del cálculo determinista). |
| `input` | Snapshot completo de los dos equipos: inscritos, atributos y medidas efectivamente usadas, titulares, roles declarados, prioridad y cobertura. Permite distinguir una semilla distinta de una plantilla editada distinta. |
| `timeline` | Los mismos hechos que ya produce ME-04 (`GameResult.events`), en el mismo orden estable; ninguno se sustituye por el relato en texto. |
| `decisions` | `available` (si esta corrida activó el registro), `records` (los puntos de decisión observados, ver abajo) y `coverageGaps` (rutas secundarias no instrumentadas de forma fiable en este bloque, con cuántas posesiones afectan). |
| `continuity` | Fronteras de posesión, responsables de carga/balance/ayudas, sustituciones, faltas y estados del generador en cada frontera, ya registrados por ME-04. |
| `result` | Períodos, marcador, ganador o parada, acta, conciliación (`reconcileBoxScore`) y un resumen por equipo/jugador (§4 del prompt) derivado de estos mismos hechos y decisiones. |

## `decisions.records`: un punto de decisión

Cada registro (`AuditDecisionRecord`, `domain/audit/audit-types.ts`) tiene:
instante absoluto en ms, punto de observación (`point`, uno de
`entrada_fase_transicion`, `organizacion_creador`, `lectura_bloqueo_o1`,
`lectura_segunda_o5`, `lectura_trampa`, `segunda_entrada`,
`resolucion_tiro`, `asignacion_rebote`, `puerta_falta_sin_tiro`,
`sustitucion`, desde ME-06 `seleccion_familia`, `entrada_mano_a_mano`,
`transferencia_mano_a_mano`, `bloqueo_indirecto_o3`,
`lectura_mano_a_mano`, y desde ME-07A `seleccion_cobertura` y
`seleccion_orden_sin_balon`, y desde ME-07B v2 `disputa_rebote`), posesión/fase si existía, poseedor, participantes, las
opciones realmente evaluadas y cuál se eligió. Cada opción lleva:

- `status`: `elegida`, `descartada_por_condicion` (se evaluó y perdió) o
  `no_evaluada_por_cortocircuito` (el árbol ya había decidido antes: nunca
  se presenta como si hubiera perdido una comparación). Desde ME-04B, la
  primera lectura del bloqueo (`lectura_bloqueo_o1`) evalúa de verdad sus
  cinco vías con un valor comparable: ninguna se corta por cortocircuito
  ahí (la reasonCode `situational_value_lower` o `tie_band_resolved_by_
  tendency` sustituye al antiguo `not_evaluated_short_circuit` para las
  vías realmente evaluadas y perdidas por valor); el cortocircuito real
  sigue vivo en `lectura_segunda_o5` (p. ej. `segunda_entrada` cuando la
  inversión a la esquina ya estaba abierta) y en `lectura_trampa`.
- `reasonCode`: un código estable en inglés (`AuditReasonCode`), documentado
  en el propio tipo — nunca se depende de parsear la frase en español.
- `values`: las magnitudes realmente usadas (tiempos de llegada, márgenes,
  distancias, capacidades, probabilidad de conversión, y desde ME-04B el
  valor de tiro situacional `situationalValue` de cada vía de la primera
  lectura). Cuando el motor no calculó una magnitud en esa rama, el campo
  queda ausente o con `reasonCode: "not_available"`; nunca un número
  inventado.
- `holderId`/`participants`: **IDs reales en pista** (ME-04B §4.1), nunca el
  código de rol/opción del núcleo (`O1`..`D5`) cuando ese código no coincide
  con quien realmente ocupa el rol tras una sustitución; los identificadores
  de *opción* (`"pase_o5"`, `"O1+O4"`...) siguen siendo símbolos del árbol,
  no jugadores, y no se traducen.
- `factLink`: instante y tipo del hecho de `timeline` que **efectivamente se
  emitió** para esta decisión (ME-04B §4.2), buscado hacia atrás en la línea
  de tiempo ya calculada y saneado contra la línea de tiempo final del
  partido antes de exportar — nunca el instante propio de la decisión. Si el
  hecho no llegó a ocurrir de verdad (desvío previo, bocina, guardián, corte
  de período), el enlace queda `null` explícito en vez de apuntar a un
  instante inventado; un enlace `null` nunca coincide por casualidad con uno
  roto porque se resuelve buscando el hecho real, no reutilizando una marca.

`resolucion_tiro` incluye, además, la probabilidad de conversión y (si
aplica) de tapón que la regla **realmente usó**, recalculadas de forma pura
con las mismas fórmulas LAB-0.1/LAB-0.3 sin consumir un sorteo nuevo (el
sorteo real lo sigue consumiendo `resolveShot`, con su propio generador), y
el alcance `R_contest` y el nivel de oposición geométrica (0/0,5/1) que se
usaron (ver `RULES.md`).

## Cobertura declarada como faltante

- **`sustitucion`**: se registra el cambio realmente aplicado (rol, motivo,
  minutos), pero no la comparación completa frente a todos los candidatos
  elegibles del quinteto en ese instante. `coverageGaps` indica cuántas
  sustituciones de esa corrida quedan así de parcialmente explicadas.
  **Excepción completa (ME-04-ROT-3):** el relevo de emergencia sí registra
  una decisión `sustitucion` con cada suplente comparado (su mejor
  asignación: roles declarados conservados, quién queda fuera de rol y con
  qué capacidad pertinente, reajustes, minutos), el elegido
  (`emergency_fill_chosen`) y por qué perdió cada otro
  (`emergency_fill_fewer_declared_roles`, `emergency_fill_lower_role_fit`,
  `emergency_fill_lost_tie_break`); la nota indica el criterio decisivo y el
  enlace apunta al hecho `substitution`. No consume RNG.

Ninguna otra ruta de las priorizadas por el prompt (§3, puntos 1–5) queda
sin instrumentar en este bloque; si una futura entrega añade un punto de
observación nuevo, se declara aquí y en `coverageGaps` mientras no tenga la
misma cobertura que el resto.

## Relación con la decisión pendiente de ME-04

El barrido documentado en
`docs/decisions/DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`
queda **parcialmente resuelto** por ME-04B: la ventaja temprana ya no es
exactamente 0 con el fixture natural (aparece `penetracion` en una muestra
pequeña de semillas, ver `SCENARIOS.md`), pero la falta ordinaria sin tiro y
la segunda entrada siguen sin producirse de forma natural con este fixture
concreto (siguen demostradas como mecánicamente alcanzables con geometría
construida a mano en `domain/game/me04b.test.ts`). La decisión se actualiza
en consecuencia, no se cierra del todo.

`result.summary.rejectionReasons` (ME-04B): antes solo contaba las opciones
`descartada_por_condicion` de cada punto, así que un punto donde el único
motivo real vivía en la opción **elegida** (p. ej. `entrada_fase_transicion`
con `sin_ventaja` elegido, o `puerta_falta_sin_tiro` con `no_evaluada`
elegido) se exportaba con `byReasonCode: {}`, aunque la traza sí tuviera el
motivo. Ahora cada entrada separa `chosenByReasonCode` (motivo del desenlace
elegido) de `alternativesByReasonCode` (motivos de las alternativas
realmente evaluadas y descartadas, sin contar los cortocircuitos), con
denominadores (`total`) en cada punto.

## Cómo abrir y comparar archivos

El `.json` es UTF-8, indentado, abrible con cualquier editor de texto o con
`JSON.parse` en una consola. Para localizar una posesión: busca su
`possessionIndex` en `continuity.possessions` (te da inicio/fin y motivo) y
filtra `timeline`/`decisions.records` por el mismo `possessionIndex`. Dos
archivos son comparables cuando comparten `input` (mismos perfiles,
versiones y planes) salvo la dimensión que se cambió a propósito (semilla,
cobertura...); el archivo conserva esa foto completa para poder agruparlos
fuera de la aplicación.

## Compresión

Medido en el mismo equipo (semilla 1, drop/drop, proteger balance, doce
inscritos por equipo, partido natural completo): el `.json` indentado pesa
**~14,2–14,9 MB** según la semilla, incómodo de adjuntar. El botón lo
comprime en el propio navegador con `CompressionStream("gzip")` antes de
descargarlo: el mismo archivo queda en **~0,6–0,7 MB** (razón ~21×–23×),
sin perder ni un campo (verificado por el ciclo de descompresión →
`JSON.parse` en la prueba automática y en el recorrido manual) y en un
único fichero `bemanager-auditoria-semilla-<seed>-<gameId>.json.gz` (nunca
varios archivos por partido). Para abrirlo: descomprímelo (7-Zip, o `gzip
-d archivo.json.gz` en Git Bash/WSL; `Expand-Archive` de PowerShell no sirve
para un `.gz` suelto) y el resultado es el `.json` descrito arriba.

## Coste medido (mismo equipo, Node 22, semillas 1–5, drop/drop)

- **Simulación:** mediana ~205 ms con el registro desactivado y ~211 ms con
  el registro activado (overhead ~3 %, dentro del ruido de medición entre
  corridas).
- **Preparar el archivo** (serializar + gzip, semilla 1): ~109 ms de
  serialización (`JSON.stringify`) y ~434 ms de compresión gzip nivel 9 en
  Node (el `CompressionStream` del navegador no es exactamente el mismo
  camino, pero el orden de magnitud es el mismo: es la compresión, no la
  auditoría, el coste dominante de la descarga).
- **Memoria aproximada** retenida por la preparación del archivo (delta de
  heap, con `--expose-gc`): ~30 MB.
- **Disco/transferencia:** ~14,2–14,9 MB sin comprimir, ~0,6–0,7 MB
  comprimido; a 5 Mbit/s de subida, ≈1,1 s; a 20 Mbit/s, ≈0,3 s.

No se ha medido con más de doce inscritos por equipo ni con lotes de
partidos: el prompt pide expresamente no lanzar barridos automáticos de
partidos completos desde el navegador.
