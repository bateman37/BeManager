# Acciones ofensivas: bloqueo directo y mano a mano sin balón (ME-01/ME-02/ME-04B/ME-06/ME-07A)

**Estado:** ACTIVE
**Es fuente de verdad para:** el árbol de decisión de las dos familias ofensivas implementadas y las responsabilidades de los diez jugadores ante cada una, en las coberturas y órdenes defensivas implementadas.
**Debe leerse cuando:** vayas a modificar `possession-core.ts` o a añadir una tercera acción táctica, otra cobertura u otra orden defensiva.
**No cubre:** ninguna otra familia táctica (poste, zonas, todas las variantes de mano a mano) ni otras coberturas de bloqueo (switch, ICE/veer...): llegan en entregas posteriores (ver `docs/match/roadmap.md`). La transición de ME-03 no es una táctica nueva: solo decide si existe ventana y reutiliza las ejecuciones ya existentes (sección final).
**Documentos relacionados:** `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, `CAPABILITIES.md`, `RULES.md`.
**Última actualización:** 2026-09-30 (ME-07A).

## Disposición y roles fijos

4-out/1-in ofensivo (O1 manejador, O5 bloqueador/continuador, O2 esquina del
lado del balón, O3 esquina débil, O4 ala débil) contra defensa individual
(D1 persigue a O1, D5 en drop o en trampa, D2/D3/D4 conservan o cambian
asignaciones según la cobertura). Un parámetro de la corrida (`coverage:
"drop" | "trampa"`, no del escenario) escoge la cobertura sobre **la misma**
entrada de media pista, quintetos y bloqueo central. Las posiciones
iniciales exactas están en `domain/lab/scenario.ts`.

## Desplazamiento real de O1/D1 en la pantalla (ME-04B §3.1)

O1 se desplaza de verdad desde su posición real hasta el punto de uso de la
pantalla — junto a O5, a un margen de 0,70 m (el mismo radio corporal
combinado de contacto, LAB-0.2/`pointShortOfTarget`), nunca sobre su
posición exacta ni teletransportado a un punto de referencia hipotético. D1
lo sigue con el retraso real de navegación (`screenDelay`, T13/F05/T16/C02),
saliendo desde el mismo instante que O1 para no implicar una velocidad
imposible. Antes de esta corrección, ambos permanecían inmóviles en su
posición de partida durante el resto de la posesión (auditoría ME-04A 210 A:
`organized_entry` → `pass_released` sin desplazamiento real), lo que
alteraba en cascada distancias de pase, tiempos de finalización y geometría
de oposición. Detalle técnico reversible: el punto de uso exacto y el
margen de separación son datos locales de esta acción, no un parámetro
deportivo nuevo.

## Cobertura `drop`: primera lectura ponderada por valor (ME-04B §3.2)

Instrucción defensiva editable por escenario: **D3 ayuda al continuador:
sí/no**. Drop permanece fijo en D5. La ventana de la pantalla
(`screenDelay >= 0,2 s`) habilita una posibilidad, **no ordena
automáticamente pasar a O5**: el árbol calcula de forma pura, sin consumir
sorteo ni ejecutar ramas alternativas, la viabilidad espacial y temporal de
cada vía real y las ordena por **valor de tiro situacional provisional**
(`puntos del lanzamiento × shotProbability(base, capacidad del tirador,
oposición prevista)`):

- **Finalizar** (ME-06 §2, corrige la carrera de reloj cruda de ME-04B): la
  vía se descarta por la misma comprobación geométrica de contención real
  que O5/D3 usan más abajo (solape de radios corporales sobre la posición
  reconstruida en el instante real de liberación, no una comparación de
  instantes de llegada); si D5 llega pero no llega a solapar, la vía sigue
  viable y se puntúa contestada (oposición 1) en vez de asumirse limpia.
- **Pasar a O5** (roll, hacia el short roll real en `(23,0; 7,5)`, ME-02
  §3/C1): bate al perseguidor por ≥0,2 s de retraso de pantalla, hay línea,
  y D3 no ha comprometido su ayuda *antes* de la lectura de O1. Si la
  estimación pura prevé que D3 no contendrá a O5, su valor es el de un
  tiro cercano abierto. Si prevé que sí lo contendrá (ME-06 §2, corrige la
  "estimación optimista de una recepción futura" de ME-04B), su valor **ya
  no** asume una inversión a O3 todavía dependiente de la lectura real de
  O5 y de una segunda proyección de D4: puntúa con la misma fórmula de
  tiro contenido que usa la propia lectura real de O5 más abajo. O5
  siempre reevalúa de verdad con el estado real del instante en que recibe
  (más abajo), no con esta estimación pregrabada.
- **Pasar a O3** (esquina débil) directamente desde O1: viable en cuanto D3
  ya dejó su marca (antes de la decisión, o el escenario carga el estado ya
  comprometido) — ya no depende de que la vía de O5 esté cerrada, compiten
  de verdad por valor.
- **Triple de O1**: detrás de la línea FIBA, el drop concede ≥0,25 s de
  ventana y su capacidad de triple (T04) ≥9.
- **Salida segura** a O4/O2: último recurso, sin puntos esperados, siempre
  viable; termina en `possession_reorganized_control_kept`.

Una vía inviable (condición geométrica no cumplida) no entra en la
comparación de valor. Entre vías viables que difieran en ≤0,15 puntos
esperados (`FIRST_READ_TIE_BAND_POINTS`, LAB-0.3), la tendencia del jugador
decide: `priorizar_primera_opcion` escoge la mejor vía de manejador/
continuador (finalizar o pase a O5) de la banda; `explorar_segunda_opcion`
tira una sola vez `secondOptionProbability(M03)` para escoger la mejor vía
exterior (pase a O3 o triple) de la banda, o el valor mayor si la tirada
falla o no hay vía exterior en banda. Fuera de la banda gana el valor mayor
sin tirada de preferencia. La conversión y el pase siguen resolviéndose con
sus capacidades y sorteos ya existentes: el valor solo ordena las vías, no
es un bonus de puntos ni una cuota de uso.

Si una opción se frustra tras elegirse (pase interceptado, recepción
incómoda), se conserva el tiempo consumido y se resuelve con el estado real
de ese instante, sin reiniciar posiciones. Con ≤2 s de reloj de lanzamiento,
solo se lanza si un tipo de tiro implementado es legal/preparable.

## Cobertura `trampa`: responsabilidades y lectura de O1/O5 (ME-02 §3)

D1 sigue a O1 por la pantalla (igual mecanismo de navegación que en drop);
D5 sale desde su posición hacia el nivel del bloqueo para comprometer a O1
junto a D1 (hecho `trap_committed`), **solo si de verdad llega**; D3 pasa a
`low man` sobre el short roll real de O5 (misma geometría que en drop); D4
rota hacia la amenaza que deja D3 (O3), exponiendo a O4 (`help_repair_attempt`);
D2 mantiene el lado fuerte sobre O2 y no participa en esta secuencia. Los
avisos D5→D3 y D3→D4 son avisos defensivos con emisor y receptor: cada uno
suma una vez la latencia de coordinación de M09 (ver `CAPABILITIES.md`).

La trampa se juzga **cerrada** en el instante en que el pase de O1 a O5 en
el short roll en realidad llegaría (no en el instante puramente mental de
la decisión): "si O1 pasa antes de cerrarse la trampa, el ataque dispone de
4x3 solo mientras los dos defensores sigan comprometidos y el pase llegue"
(prompt ME-02 §3).

- **Trampa cerrada:** presión real de dos defensores sobre el balón (T07 de
  O1 vs el peor T15 de D1/D5, mismo mecanismo ya vigente de
  `resolvesTurnoverUnderPressure`, no un robo nuevo). Sin pérdida, O1 busca
  a O5 en el short roll; si D3 (low man) no llega a tiempo, el 4x3 sigue
  vivo y O5 puede leer directamente la salida exterior a O4
  (`trap_broken_advantage`); si D3 sí contiene, O5 puede todavía invertir a
  O3 (misma lectura C2) antes de forzar el tiro bajo contención.
- **Trampa no cerrada en el instante de decisión** (`trap_broken_advantage`
  sobre O1): D5 no protege el aro y O1 puede escapar por el carril directo
  si de verdad lo tiene; si no hay carril ni tiempo, D1/D5 recuperan por
  trayecto (`trap_recovered`) y O1 conserva el control con una salida
  segura.

Una trampa rota nunca garantiza tiro cómodo; una trampa cerrada nunca
garantiza robo ni canasta (ver pruebas discriminantes en
`domain/simulation/me02.test.ts`).

**Cobertura `auto` (ME-07A §4).** Antes de despachar el árbol, si
`coverage: "auto"`, compara de forma pura (sin RNG) qué concede `drop`
(el short roll de O5 queda libre si la pantalla retiene a D1 lo
suficiente) frente a si `trampa` es siquiera elegible (D5 debe poder
comprometer a tiempo desde su posición real) y, si lo es, qué concedería
la rotación D3→D4 después. Empate, trampa no elegible o concesión
indistinguible conservan `drop`. Auditado en `seleccion_cobertura`. Con
la disposición inicial fija de los tres escenarios de laboratorio, D5
arranca en la protección del aro y nunca resulta elegible (ver
`CAPABILITIES.md`); alcanzable con una posición defensiva inicial más
agresiva.

## Segunda familia posicional: mano a mano sin balón (ME-06 §3)

Misma disposición 4-out/1-in y roles funcionales; extiende el núcleo
compartido (`runHandoffPhase` junto a `runDropPhase`/`runTrapPhase` en
`possession-core.ts`, ADR-0005/0006), no un módulo paralelo. Secuencia real:

1. **Entrada:** O1 encuentra a O5 en el codo alto (`FREE_THROW_LINE_SPOT`,
   reutilizado). Pase real (T09/T11), negable por D5; si se desvía o el
   reloj no llega, sanción o balón suelto, nunca teletransporte.
2. **Mano a mano:** O5 entrega a O2, que sube desde el lado fuerte con
   tiempo de movimiento y recepción reales. D2 puede llegar a negar la
   entrega; en `trampa`, D5 puede saltar a presionarla junto a D2 (deja el
   interior expuesto, con el retraso real de coordinación M09 al
   recuperar). Si se niega, O5 conserva el balón y su propia lectura.
3. **Bloqueo/corte simultáneo:** O4 coloca un bloqueo indirecto legal
   (T13/F05) para que O3 corte desde el lado débil (T21 activa por
   primera vez su desmarque, `cutterStartTimeReductionSeconds`); D3
   navega con el retraso real (T16), ajustado por la orden de defensa sin
   balón (`negar_primera_salida` persigue más apretado; `guardar_espacio`
   concede más separación). Si D3 no lo deniega, la ventana queda abierta;
   bajo `guardar_espacio`, D4 puede ayudar a cerrarlo (O3 recibe entonces
   contestado, no libre) y O4 se abre en su propio punto de bloqueo; bajo
   `negar_primera_salida`, D4 nunca ayuda. **`auto` (ME-07A §4)** evalúa
   ambas navegaciones de D3 de forma pura con la misma geometría real y
   elige la que concede menos (triple de O3 sin ayuda, o de O4 si D4
   abre); empate conserva `guardar_espacio`. Auditado en
   `seleccion_orden_sin_balon`.
4. **Primera lectura real** (portador: O2 si la entrega se completó; si
   no, O5): entre finalizar (mismo modelo de contención real que el
   bloqueo directo), pasar a O3 (si el corte quedó libre), continuar a O4
   (si D4 ayudó) o la seguridad a O1, por el mismo valor situacional que
   el bloqueo directo. Hasta ME-06 esta lectura no tenía banda de empate
   propia (siempre ganaba el valor mayor). **ME-07A §2** añade la misma
   `FIRST_READ_TIE_BAND_POINTS`: dentro de la banda, la prioridad de
   creación del entrenador favorece primero aro (`finalizar_portador`) o
   triple (`pase_o3`/`continuar_o4`); si sigue compitiendo un tiro con la
   seguridad a O1, decide `shotTendency` del portador (no `pnrTendency`,
   que conserva su papel específico en el bloqueo). Ver `AUDIT.md`.

**Selector de plan por equipo** (`offensivePlan`, `MatchInput`/
`GameTeamInput`): `auto` (por defecto en partido), `bloqueo_directo` o
`mano_a_mano_sin_balon`. En `auto`, al iniciar cada ataque organizado se
evalúa de forma **pura** (sin RNG, sin ejecutar la vía descartada) la
oportunidad de entrada de cada familia desde el estado real heredado
(`estimateBloqueoDirectoOpportunity`/`estimateHandoffOpportunity`) y se
elige la de mayor valor; empate exacto conserva el bloqueo directo. Con
la plantilla natural del laboratorio, `auto` sigue prefiriendo el
bloqueo directo (D5 protege un aro geométricamente más cerca del
portador que cualquier recepción perimetral de esta familia); casos
construidos con atributos handicapados a propósito demuestran que `auto`
elige la mano a mano cuando de verdad es mejor
(`domain/game/me06-mano-a-mano.test.ts`). La segunda entrada del bloqueo
directo (kick-out) sigue siendo exclusivamente del bloqueo directo: no
se reevalúa la familia en esa continuación.

No autoriza mover D5, adelantar la ayuda de D3 del bloqueo directo, ni
resolver la decisión pendiente de faltas sin tiro/segunda entrada
(sigue abierta). Sin fórmulas LAB-0.1 nuevas: dos puntos de cancha
sintéticos documentados (`WEAK_SIDE_SCREEN_SPOT`/`WEAK_SIDE_CUT_SPOT`) y
un ajuste local de la orden de defensa sin balón sobre la navegación de
D3, ambos en `possession-core.ts`.

## Simplificación técnica reversible: llegada analítica, no malla de navegación

El estudio de referencia permite explícitamente prescindir de una malla de
navegación para diez jugadores en una cancha pequeña (§4.2). ME-01 calcula
tiempos de llegada de forma analítica (distancia ÷ velocidad, con los
retrasos LAB-0.1 de pantalla, ayuda y cierre) en vez de interpolar
posiciones cada 100 ms para una IA general de evitación de obstáculos. El
reloj interno sigue avanzando con paso máximo de 100 ms y cortes exactos de
evento para los fines de reproducibilidad y comparación de resoluciones,
pero el movimiento de cada responsable usa una trayectoria recta hacia su
objetivo de fase. Documentado también como decisión técnica en
`docs/decisions/ADR-0004-detailed-engine-analytic-timing.md`.

## Rebote ofensivo y continuación

Si O5 (u otro atacante) captura el rebote ofensivo, la misma posesión
estadística continúa con un intento de finalización o palmeo, heredando
posiciones y sin reiniciar la pantalla original. Un guardián de progreso
(`MAX_PROGRESS_ITERATIONS`) detiene una cadena anómala de rebotes ofensivos
y lo marca como `simulation_guard_stopped` en vez de forzar un desenlace.
Solo participan en la disputa del rebote quienes realmente llegan (dentro
de la ventana de vuelo, o los más próximos si nadie llega dentro de ella:
un balón que sigue en la cancha nunca se declara "fuera" solo porque nadie
llegó a tiempo); el palmeo se decide por T20 únicamente entre esos
candidatos reales, no entre los diez jugadores sin filtrar (HF-002 §1.4).

## Falta ordinaria de tiro y libres

Alcanzada la rama `shooting_foul`, se adjudica primero la validez de la
canasta y después se ejecuta cada libre concedido con `T05` y la semilla
de la posesión (ver `RULES.md`). Si el último libre falla, el balón queda
vivo y se resuelve con la misma disputa de rebote que un tiro de campo,
incluida la continuación ofensiva si el ataque lo recupera (HF-002 §1.6).

## Tramo enlazado (ME-03): carga/balance, transición y segunda oportunidad

Plan fijo por equipo durante el tramo (la dirección en vivo es ME-05).

**Carga y balance.** Al empezar el gesto de cada tiro de campo (y al soltar
el último libre), antes de conocer el resultado y de sembrar el rebote, los
cuatro atacantes que no tiran se ordenan por tiempo de llegada al aro
atacado desde su posición real (F01), con desempate por ID real.
«Proteger balance»: el primero carga y tres retornan; «Cargar rebote»: los
dos primeros cargan y dos retornan. Quien carga se desplaza hacia el aro;
quien retorna, hacia la línea central en su mismo carril (`x = 14`), ambos
a su velocidad real y solo durante el tiempo disponible. Quien retorna no
disputa el rebote; la disputa usa las posiciones alcanzadas y la lógica
T19/T20/F05 existente, sin bonus por cargar. El tirador completa su gesto.

**Segunda oportunidad.** Tras un rebote ofensivo, el reboteador finaliza de
inmediato solo si llega al aro antes que el primer protector (el criterio de
la opción 1 de este documento, F04 + T23); si no, la posesión sale y se
reorganiza con sus 14 s.

**Salida y lectura de transición (opción B, aclaración ME-03).** Tras
rebote defensivo, robo, recuperación viva o saque: si quien tiene el balón
no es el base, le da la salida solo si ningún rival llega antes al
receptor ni puede cortar la línea (carrera de intercepción con el radio
corporal de LAB-0.2); si no, él mismo sube el balón botando. Antes de leer
la ventaja se avanza esa trayectoria real hasta el **instante en que el
balón entra de verdad en pista delantera** (no el instante en que se
decidió la salida): solo entonces se reconstruyen las diez posiciones. Un
defensor cuenta como protector únicamente si, en ese instante, ya está
entre el balón y el aro atacado (su posición real, no una carrera
hipotética completa); uno que todavía va por detrás no protege nada
todavía, por rápido que sea de ahí en adelante. Comparadas esas llegadas
reales:

1. **Penetración**: el portador llega antes que el primer defensor (o no
   hay ninguno ya situado).
2. **Pase adelantado**: un compañero llega antes que el primer defensor y la
   línea de pase está libre.
3. **2×1**: el primer defensor para al portador en el aro y el corredor (el
   compañero más rápido) recibe antes de que llegue el segundo, que es
   quien le disputa.
4. **3×2**: el corredor también queda contenido por el segundo defensor,
   pero un segundo receptor —el exterior— recibe el pase directo del
   portador antes de que exista un tercer defensor ya situado que lo cierre
   (o no lo hay). Si ese tercero sí llega a tiempo, se resuelve como el 2×1
   ordinario: no se inventa una asistencia intermedia del corredor ya
   contenido.

La ventaja se ejecuta con pase/recepción (T09/T11) y finalización cercana
por el mismo `resolveShotAttempt` (oposición por geometría en el instante
de lanzar, tapón, falta, rebote); no hay un árbol estadístico ni una
tercera función de tiro distinta para el 3×2. Si no hay ventana, el relato
registra «Sin ventaja: ataque organizado» con los tiempos y los diez se
desplazan hacia la disposición del bloqueo. La acción organizada empieza
cuando los **cinco atacantes** están situados; un defensor que aún no ha
llegado entra en ella desde donde está de verdad, y el relato lo nombra.
Con 2 s o menos de reloj no se habilita una finalización en carrera. No
hay multiplicador de «ataque temprano».

**Limitación observada con el fixture, tras implementar la opción B.** En
8 000 tramos (semillas 1–1000 × cuatro combinaciones de prioridades × dos
coberturas, 24 000 lecturas de transición) sigue sin ejecutarse ninguna
ventaja: 0 de 24 000. La causa ya no es un defecto de elegibilidad (el
filtro de "ya situado" se comprueba con geometría construida a mano en
`me03.test.ts`, incluidos un 2×1 y un 3×2 reales): en 1 600 de esas 24 000
lecturas solo 1 o 2 de los cinco defensores ya estaban situados al cruzar
la mitad de la pista, pero el defensor de `drop` (típicamente D5, que por
su cobertura permanece siempre cerca del aro que protege) llega solo, por
sí mismo, entre 0,25 y 1 s antes que cualquier atacante en tránsito, en
prácticamente todas las lecturas. El coste de cargar rebote sigue viéndose
en encargos, trayectorias y rebotes (ver la prueba (5) de `me03.test.ts`),
no en transición concedida con este fixture concreto. Ver
`docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md` (resuelta:
opción B).

**Triple del portador en transición (ME-07A §3.2).** «Sin ventaja» ya no
reorganiza sin más: si el portador queda detrás de la línea de tres, a una
profundidad razonable tras ella
(`TRANSITION_THREE_DEPTH_BUFFER_METERS = 2` m) y con ≥0,25 s de margen
antes de que el defensor real más cercano a **él** (no necesariamente el
protector del aro) pueda cerrarle el tiro, la vía es viable. La tendencia
de tiro decide si la toma (`decidida` siempre, `prudente` nunca,
`equilibrada` con `secondOptionProbability(M03)`, la misma función que el
resto del motor); nunca un tiro concedido por sistema. Con el fixture
natural, dado el hallazgo anterior (D5 siempre cerca del aro y llegando
antes), esta ventana tampoco aparece: se prueba con geometría construida a
mano (`evaluateTransitionThreeOpportunity`, `domain/game/me07a.test.ts`).

## Organización: el poseedor real puede conservar la iniciativa (ME-07A §3.2)

`organize()` ya no devuelve el balón por sistema al rol fijo O1 tras un
rebote, robo o saque. Compara, con la misma geometría real (F01 del
portador frente a T09/T11 y vuelo del pase de vuelta), si conservar la
iniciativa es al menos tan rápido como esperar el pase: si lo es, se
reasignan los roles O1 y el del portador (`rebindFrame`, el mismo
mecanismo ya usado por la segunda entrada) y los otros tres atacantes
conservan su tarea de espaciado/corte/balance sin cambios; si no, se
conserva el pase de vuelta de siempre. Empate exacto conserva el pase de
vuelta. Auditado en `organizacion_creador` con motivo estable
(`creator_kept_by_real_holder`/`creator_pass_back_faster`); confirmado con
el fixture natural (semilla 82): jugadores reales conservan la iniciativa
en 5 de 219 decisiones de un partido completo.

## Partido completo (ME-04): segunda entrada del mismo bloqueo

El partido elige entre la ventaja temprana que ME-03 encuentre de verdad,
el bloqueo central desde la posición alcanzada y una **segunda entrada del
mismo bloqueo** (`domain/simulation/second-entry-read.ts`), sin tácticas
nuevas. Solo con reglas de partido y una vez por acción:

1. **Primera lectura negada:** O5 recibe, su defensor lo contiene de verdad
   (solape corporal en el instante de actuar) y la inversión a la esquina
   está cerrada: el punto en que ME-01 forzaría el tiro bajo contención.
2. **Viabilidad**, para O4 y O2: línea de pase libre frente a los cuatro
   defensores sin balón (carrera de intercepción de ME-03; el que contiene a
   O5 puede tocar el pase con T17 bajo presión, como en la inversión de
   ME-02), receptor en el exterior de pista delantera, nuevo punto de
   bloqueo dentro de la pista y más de 2 s de lanzamiento tras recolocar la
   pantalla. Se elige el pase más corto; desempate por ID real.
3. **Ejecución:** pase real (`resolvePass`), intercambio de roles canónicos
   O1↔creador y D1↔su defensor, recolocación del bloqueador a su velocidad
   real con la misma geometría aprobada del bloqueo girada hacia el aro
   desde el creador, y el árbol de siempre desde las posiciones alcanzadas.
   Los puntos LAB-0.2 del short roll y de la esquina débil no cambian
   (simplificación declarada).
4. **Sin viabilidad:** se conserva el tiro forzado de ME-01 y el relato
   dice por qué no hubo segunda entrada.

**Alcance con el fixture: 0 segundas entradas** en el barrido documentado:
el árbol siempre deja abierta la continuación o la inversión, y en `drop` el
pívot de la disposición aprobada está a 0,73 m del short roll, de modo que
alcanza cualquier pase de salida del continuador contenido. Demostrada con
geometría construida a mano en `domain/game/me04.test.ts`. Ventaja temprana:
0, como en ME-03 (el saque de inicio de período, con los diez ya colocados,
abre ataque organizado sin lectura de transición). Ver
`docs/decisions/DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`.

**Reparto observable:** con una sola acción ofensiva, el continuador recibe
casi todos los tiros y los marcadores son altos (~280 puntos por partido);
no es un partido calibrado. Las responsabilidades de los diez se
reasignan en cada organización tras un cambio de quinteto.
