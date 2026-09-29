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
**Última actualización:** 2026-09-29 (ME-04B: esquema `ME-04B-AUDIT-1`,
IDs reales, `factLink` saneado y `rejectionReasons` separado por
elegida/alternativas — ver más abajo).

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

## Esquema (`schemaVersion: "ME-04B-AUDIT-1"`)

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
`sustitucion`), posesión/fase si existía, poseedor, participantes, las
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
