# Acciones ofensivas: bloqueo directo y mano a mano sin balón (ME-01/ME-02/ME-04B/ME-06/ME-07A)

**Estado:** ACTIVE
**Es fuente de verdad para:** el árbol de decisión de las dos familias ofensivas implementadas y las responsabilidades de los diez jugadores ante cada una, en las coberturas y órdenes defensivas implementadas.
**Debe leerse cuando:** vayas a modificar `possession-core.ts` o a añadir una tercera acción táctica, otra cobertura u otra orden defensiva.
**No cubre:** ninguna otra familia táctica (poste, zonas, todas las variantes de mano a mano) ni otras coberturas de bloqueo (switch, ICE/veer...): llegan en entregas posteriores (ver `docs/match/roadmap.md`). La transición de ME-03 no es una táctica nueva: solo decide si existe ventana y reutiliza las ejecuciones ya existentes (sección final).
**Documentos relacionados:** `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, `CAPABILITIES.md`, `RULES.md`.
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-5: fichas Horns→Spain, LAB-0.9, y Delay→DHO con poste, LAB-0.10).

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

**ME-07B v2 §2.3 — defensa `auto` desde la preparación.** D5 decide la
trampa cuando empieza a prepararse la pantalla (instante 0 de la fase
organizada) y sale tras su latencia M01/M05, no cuando O1 ya la usa; una
trampa que aun así llega después del pase a O5 sigue siendo tardía y
concede el carril. `auto` proyecta en seco ambas ejecuciones desde la
misma geometría: `drop` concede la mejor vía de la primera lectura del
bloqueo (con riesgo de pase); `trampa`, el valor esperado de la rama que
alcanza su propia geometría (presión T07/T15, desvío T17/T09, low man
tardío → O4 libre, inversión a O3 o tiro contenido de O5). Cada concesión
se combina con lo que esa defensa ya ha concedido de verdad con esa
cobertura en el partido (`blendProjectionWithObservation`, LAB-0.4, peso
previo 6 usos); el ataque hace lo mismo con cada familia. Así la defensa
alterna por resultados visibles, sin cuotas: foto seed 484 trampas / 675
drops (Sierra defendiendo) y 443 / 733 (Puerto).

**ME-07B v2 §5 — cambio, show, por debajo e ICE.** `auto` compite entre
seis coberturas con la misma proyección en seco y la misma mezcla con lo
observado; una concesión proyectada idéntica a la de drop conserva drop.
*Cambio*: D5 canta (M01/M05) y sale a la altura del bloqueo (T22), D1 se
queda con el bloqueador (aviso M09, T23); O1 lee frente al pívot
(`lectura_cambio`) y el emparejamiento cambiado persiste en la posesión.
*Show*: D5 sale delante del punto de uso y vuelve al aro cuando D1 supera
la pantalla (M09); ventana del roll mientras vuelve (`lectura_show`).
*Por debajo*: D1 pasa entre el bloqueador y su defensor sin ser bloqueado;
sin retraso no hay dos contra uno (el pase al roll sigue la regla de drop
con retraso nulo) y D1 contesta la entrada si ya espera en su punto; para
cerrar el triple de O1 tiene que rodear al bloqueador y, si al soltar aún
no lo ha rodeado, no contesta (`d1CloseoutMarginSeconds`, `d1WallsDrive`
en `lectura_bloqueo_o1`). *ICE*: solo elegible con pantalla lateral; ante
el bloqueo central no es elegible (`coverage_ice_central_not_eligible`) y
la orden manual juega drop con el hecho `coverage_not_applicable`.
Pendiente: la respuesta de zona.

**ME-07B v2 §4–§5 (sesión v2-3, LAB-0.7) — bloqueo lateral, ICE y «a la
altura».** *Colocación*: al organizar, `assignOrganizedRoles` compara
además la colocación del bloqueo (`screenPlacement`: `auto` evalúa central
y lateral con la misma proyección en seco que creador y bloqueador; el
entrenador puede fijar una) y la audita en `colocacion_bloqueo`. La lateral
usa la disposición `LATERAL_PNR_TARGETS` (manejador en el ala, bloqueador a
3,3 m del eje, misma distancia manejador–bloqueador que la central) y su
short roll lateral; la mano a mano solo existe desde la central
(`family_not_in_lateral_placement`). *ICE* (solo lateral): D1 reconoce la
pantalla (M01/M05) y se pone de su lado a contacto del manejador (F04); si
llega antes del uso (`ice_committed`), O1 no usa el bloqueo y D5 baja a la
ayuda baja (M01/M05, T23); el bloqueador se abre al codo. `lectura_ice`:
`penetrar_fondo` (frente a D5 abajo y D1 que se desliza), `parada_fondo`
(tiro medio T03 tras rechazar hacia fondo), `pase_o5` (la línea pasa por
D1, que puede desviar con T17), `pase_esquina_o2` (D2 en casa) y
`salida_segura`. Si D1 llega tarde (`ice_late`), se juega drop. *Show* y
*a la altura* comparten «el pívot sube al bloqueo» con tres diferencias:
el show sale a contacto del punto de uso (línea del manejador) y, si llega
antes que O1 a ese punto, frena su penetración hasta que D5 se retira
(`halted`), y D5 vuelve al aro; «a la altura» sube a contacto del
bloqueador (≥0,3 m más hondo), O1 dobla la esquina sin pausa con D5
conteniéndole al decidir, y D5 vuelve con el continuador
(`lectura_a_la_altura`, `at_level_committed`, `at_level_recovery`). `auto`
compite ahora entre siete coberturas (ICE solo ante la lateral).

**ME-07B v2 §3 — ficha de libro (primer paso).** `domain/tactics/playbook-card.ts`
declara las tres acciones organizadas que existen (bloqueo directo central,
mano a mano central, bloqueo directo lateral) como fichas con fase y
condición (planes que la admiten), colocación, roles y sustitutos (creador
O1 o poseedor real; bloqueador O5 u O4), primera acción, variantes (segunda
entrada), lecturas permitidas, seguridad (salida segura y reorganizar) y
prioridad. Al organizar, las colocaciones ofrecidas salen de las fichas
compatibles con el plan y la orden de colocación; el núcleo devuelve la
ficha en vigor (`organizedChoice.card`). No cambia la conducta (foto de las
20 idéntica); Horns, Delay, Spain, drag y los saques siguen pendientes como
fichas nuevas con su mecanismo.

**ME-07B v2 §4 (sesión v2-4, LAB-0.8) — ficha `horns_bloqueo`
(«Organizado: Horns→bloqueo»).** *Colocación* (`HORNS_PNR_TARGETS`):
manejador arriba, los dos interiores del quinteto en los codos —uno es el
bloqueador (O5, mismo punto de pantalla que la central) y el otro el
**segundo cuerno** (rol canónico O3, en el codo contrario, zona de tiro
medio)—, los dos exteriores en las esquinas (O2, O4) y el ala débil vacía;
cada defensor sigue a su marca (D3 entre el segundo cuerno y el aro). Los
cuernos son siempre los dos interiores por el orden de roles del quinteto en
pista; si el poseedor es uno de ellos, devuelve el balón al manejador.
*Entrada*: orden del entrenador (`screenPlacement=horns`, `/lab` «Colocación
del bloqueo: Horns») o, en `auto`, la misma proyección en seco que compara
creador, bloqueador y colocación (`colocacion_bloqueo`). *Acción*: el mismo
árbol de coberturas del bloqueo (drop, por debajo, show, a la altura,
cambio, trampa; ICE no aplicable: pantalla dentro de la franja de la zona),
con otra **responsabilidad**: el jugador que deja libre la ayuda al roll es
el segundo cuerno en el codo (tiro medio T03 de recepción, `helpLeftSpot`)
y la reparación sale del defensor de la esquina débil, que deja la esquina.
Ante la trampa, el low man (defensor del codo) llega a tiempo más a menudo y
la inversión va al codo (tiro medio); en la central nunca se invierte. Ante
drop, el receptor del roll valora un tiro medio del codo en lugar de un
triple de esquina. *Negación y salida*: la ayuda contiene al continuador y
su lectura reevalúa (aro, floater, codo, segunda entrada con motivo); la
trampa puede robar; sin opción, salida segura y reorganizar. Técnico y
local: el defensor que ayuda no se mete en el mismo punto del short roll si
llegaría mientras el continuador aún corre (contiene a contacto, en su línea
de llegada) y el solape corporal de la contención es estrictamente menor que
la suma de radios; sin esto, el defensor del codo (a 2 m) chocaba de frente
en carrera y cada ayuda era falta. Pruebas: `me07b-v2-horns.test.ts`,
`lab-0-8-parameters.test.ts`, `playbook-card.test.ts`.

**ME-07B v2 §4 (sesión v2-5, LAB-0.9) — ficha `horns_spain`
(«Organizado: Horns→Spain»).** *Colocación*: la de Horns. *Entrada*: orden
(`chainedVariant=spain`, «Variante encadenada» en `/lab`) o, en `auto`,
`seleccion_variante` compara la ficha base y Spain con la misma proyección en
seco frente a cada cobertura vista (ante drop y por debajo, la ejecución de
Spain suponiendo la mejor respuesta del rival; ante el resto, el valor de la
base: no hay a quién bloquear). *Lectura del bloqueador ciego*
(`lectura_spain_bloqueador`): hay objetivo si la defensa juega drop o por
debajo (ICE ante pantalla no lateral es drop), D5 está a más de 2,7 m del aro
y hay reloj para sincronizar; si no, se queda en el codo y se juega el árbol
de Horns con la misma ficha. *Acción*: el segundo cuerno (O3) rodea a su
defensor y llega a contacto de D5 en su línea de retroceso
(`spainBackScreenPoint`), se coloca (0,3 s) y el manejador espera en el punto
de uso hasta que el roll pueda arrancar con el bloqueo ciego puesto (cuesta
reloj). D5 queda retenido `screenInterceptDelaySeconds(T13, F05 de O3; T16 de
D5)` + peso desde que el roll arranca y luego rodea al bloqueador; O5 rueda
profundo al poste bajo débil (`SPAIN_ROLL_SPOT`) por fuera del bloqueo y O3 se
abre al pop (`SPAIN_POP_SPOT`) al soltar a D5. *Respuesta*
(`respuesta_bloqueo_ciego`, orden `backScreenCall`): `seguir` (D3 va con O3 al
pop; el roll solo lo protege D5 retenido), `ayudar` (D3 rodea al bloqueador y
contiene el roll desde la pintura; deja el pop y lo cierra al recuperar) o
`cambiar` (D3 al roll, D5 al pop; solo si D3 reconoce el corte y lo canta, M09,
antes de que el roll arranque; el cambio persiste); en `auto` la de menor
concesión proyectada; con `seguir`, D3 lee entre seguir y ayudar. *Lectura de
O1* (`lectura_spain`): aro, pase al roll (el receptor lee aro, floater o pase
al pop, que puede no haber llegado aún), pase al pop, triple tras la pantalla
o salida segura. Pruebas: `me07b-v2-spain.test.ts`, `lab-0-9-parameters.test.ts`.

**ME-07B v2 §4 (sesión v2-5, LAB-0.10) — ficha `delay_mano_a_mano`
(«Organizado: Delay→DHO/corte y entrada a poste con salidas»).**
*Colocación* (`DELAY_TARGETS`): un interior arriba por encima del arco (O5),
el otro en el poste bajo del lado del balón (O4), el manejador en el ala
derecha, la esquina fuerte (O2) y el ala débil (O3) ocupadas; los dos
interiores por el orden de roles del quinteto. *Entrada*: solo por orden
(`screenPlacement=delay`); en la colocación `auto` no compite todavía
(`offeredInAuto=false`). Familia: la de la entrega en mano. *Acción*: pase de
entrada arriba (desvío por D5); el manejador sigue su pase y recibe la
entrega en mano a contacto del pívot: el cuerpo de O5 retrasa a D1 como una
pantalla (T13/F05 de O5, T16 de D1, peso), ajustado por la orden sin balón de
D1 (±0,15 s, la misma del mano a mano; en `auto`, la de menor concesión).
*Respuesta de D5* (por su cobertura; en `auto`, la menor concesión de tres;
el resto de coberturas no aplican: `coverage_not_in_card`): `hundirse`
(drop y demás), `cambiar_entrega` (cambio: D5 a O1 y D1 a O5, persiste) o
`saltar_entrega` (show/trampa): si D5 está colocado en el punto de la entrega
antes que O1, la niega. *Lecturas*: entrega hecha → `lectura_delay` (aro,
triple, tiro parado, entrada al poste, salida al pívot); negada →
`lectura_delay_pivote` (el pívot ataca el aro rodeando a D5, puerta de atrás de
O1 rodeando a D5 con D1 persiguiendo, alto-bajo al poste o inversión al ala
débil). *Poste* (`respuesta_poste`, `lectura_poste`): el defensor de la
esquina lee el pase al poste en el aire y ayuda a contacto («dig») si concede
menos; el poste reconoce (M01/M05) y gira (0,4 s) antes de moverse; si la
ayuda llega antes del giro son dos sobre el balón y cada movimiento puede ser
robo (T07 del poste frente al peor T15, como en la trampa). Salidas: aro
rodeando a D4, gancho desde el poste (T02, D4 a contacto), salida a la
esquina (solo si ayudó), corte del ala débil (rodea a su defensor; le cierran
él, D5 y D4 girándose desde el poste) y repostear (devolver arriba y
reorganizar). Pruebas: `me07b-v2-delay.test.ts`, `lab-0-10-parameters.test.ts`.

**ME-07B v2 §2.2/§5 (sesión v2-4) — el ataque proyecta contra la defensa
observada.** Antes el selector de familia y `assignOrganizedRoles`
proyectaban el bloqueo directo **solo contra drop**. Ahora proyectan en seco
la concesión de cada cobertura que el rival ha usado en el partido y la
ponderan por su frecuencia observada (`shownCoverageWeights`, LAB-0.4: peso
`(usos_c + K·[c=drop]) / (Σusos + K)`, mismo K = 6 usos); sin muestras es la
proyección de siempre. ICE ante pantalla no lateral pesa como drop.
Auditoría en `seleccion_familia`: `coverageWeight_*`, `valueAgainst_*`,
`expectedValueOverShownCoverages` (`situationalValue` sigue siendo la
proyección contra drop). Prueba: `me07b-v2-coverage-projection.test.ts`.

**ME-07B v2 §2.4 — lecturas frente al mejor cierre real.** Cada vía de
tiro de la primera lectura del bloqueo y de la lectura del continuador se
valora con la oposición que resultará de verdad (`bestContest`, misma regla
R_contest que `resolveShotAttempt`). O1: `finalizar`, `pase_o5` (valor =
la misma lectura del receptor proyectada), `pase_o3`, `triple_o1` (cierra
el mejor de D1, que sale de la pantalla con su retraso, y D5 solo si el
continuador ya está contenido), `parada_o1` y `flotadora_o1` (se detiene
antes del protector: fuera de su alcance o justo antes del contacto; el
tipo, tiro medio T03 o floater T02, lo decide la zona real, LAB-0.5) y
`salida_segura`. O5 al recibir (`lectura_segunda_o5`): `finalizar_aro`,
`flotadora` o `invertir_o3`, frente a D5 con **una sola trayectoria de
drop** (retrocede al aro desde que empieza el roll) y D3 si ayuda; en la
banda de empate decide su tendencia de tiro. Contenido y sin vía mejor,
conserva la segunda entrada de ME-04. D3 decide la ayuda (`help_decision`)
comparando la concesión con y sin ayuda en la recepción prevista; en la
posesión de laboratorio el escenario sigue siendo una orden explícita y en
el partido `rollHelpCall` (`auto` por defecto, `siempre`) la gobierna. Al
organizar, `assignOrganizedRoles` (linked-run) compara creador (poseedor u
O1) y bloqueador (O5 u O4) por proyección; los defensores siguen a su marca.

**ME-07B v2 §2.5 — transición y faltas.** Sin ventaja, el portador sigue
botando hasta un punto detrás del arco (`planTransitionPullUps`, a 2/1,25/
0,5 m) y cada defensor cierra desde su posición real en el cruce; el triple
tras bote (preparación T06) compite con el valor proyectado de organizar y
la tendencia decide en la banda. Los contactos defensivos reales se
adjudican con M07 del defensor (LAB-0.6): cierre legal con solape en una
finalización o tiro (`resolucion_tiro`, falta de tiro), trampa cerrada y
rebote por encima de la espalda (`puerta_falta_sin_tiro`, falta sin tiro).
Pendiente: falta en ataque y carrera defensiva a cerrar tras el tiro.

**Cobertura `auto` (ME-07A §4, superado en parte por ME-07B v2).** Antes de despachar el árbol, si
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

**ME-07B v2 §2.2 — comparador en la misma frontera.** `auto` ya no usa
dos estimadores ad hoc (`estimateBloqueoDirectoOpportunity` suponía una
recepción limpia futura de O5; la mano a mano estimaba otra cadena). Cada
familia se **proyecta en seco con su propia ejecución** (`runDropPhase`,
`runHandoffPhase` sobre una copia del contexto, sin azar, hechos ni
auditoría) hasta su primera lectura real: mismas posiciones, reloj,
preparación, ayudas y concesiones que luego se ejecutan. El valor de la
familia es la mejor vía viable × la probabilidad de que sus pases no se
desvíen (`deflectionProbability`, LAB-0.1; en la mano a mano incluye el
pase de entrada). El bloqueo directo se proyecta contra `drop` (la trampa
no tiene aún una lectura por valor proyectable; pendiente con §2.3).
**Resultado medido:** el monopolio **no desaparece** (seed: PnR 1.197/1.235
Sierra, 1.216/1.217 Puerto) y ahora tiene explicación física
reproducible: en 2.397 de 2.413 primeras lecturas del bloqueo, la ayuda de
D3 llega después de que O5 esté listo en el short roll, así que el drop
concede un tiro cercano libre (≈1,17 puntos) frente a la mejor salida
proyectada de la mano a mano (triple libre o contestado, ≈0,8–0,94 tras
riesgo de entrada). Brecha mediana PnR−DHO +0,336 (p10 +0,244, p90
+0,369; 39/2.452 negativas). Es la defensa (§2.3) la que concede esa
ventana, no un sesgo del comparador.

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
**ME-07B v2 §2.1:** la llegada que decide ventana, primer optante e
instante de control es la **efectiva**: un rival cerrado de forma legal y
próxima llega más tarde (ver `CAPABILITIES.md`), y el tirador sale hacia
el rebote al caer de su salto (LAB-0.4), sin cerrar a nadie durante su
gesto. Los defensores todavía **no** reaccionan al tiro desplazándose a
cerrar a los cargadores: una primera versión se probó y se retiró porque
eliminaba la única fuente natural de faltas del fixture (faltas de tiro en la
segunda oportunidad); queda pendiente junto a las faltas (§2.5).

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
