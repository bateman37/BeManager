# Matriz táctica versionada (ME-07B v2 §0.4)

**Estado:** ACTIVE
**Es fuente de verdad para:** el estado real de cada nombre del capítulo táctico en el motor: capa, configuración visible, condición de entrada, mecanismo, fallback, hecho/auditoría, prueba y estado.
**Debe leerse cuando:** vayas a implementar, probar o declarar jugable cualquier táctica de ME-07B.
**No cubre:** el diseño de cada táctica (ver `reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`) ni el detalle del árbol ya implementado (ver `ACTIONS.md`).
**Documentos relacionados:** `ACTIONS.md`, `AUDIT.md`, `docs/prompts/implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-10-04 (ME-07B v2, sesión v2-7: la lectura de la mano a mano se valora con la oposición real de su ejecución; Delay no tiene error sistemático; ver `analysis/ME-07B-v2-mano-a-mano-delay-v2-7.md`).

## Reglas de estado

- **jugable**: un partido completo puede ejecutarla, negarla y continuar con
  reloj, balón y participantes coherentes; tiene prueba de ejecución y de
  negación/respuesta rival y se ha visto en `/lab`. Cumplen las cuatro
  condiciones las fichas **Horns→bloqueo** (v2-4), **Horns→Spain** y
  **Delay→DHO con entrada a poste y salidas** (v2-5), con sus colocaciones.
- **parcial**: existe mecanismo real en el motor pero falta configuración,
  negación, auditoría o recorrido de `/lab`; la columna «estado» dice qué.
- **pendiente**: sin mecanismo. Ningún nombre pendiente se oculta ni se
  deshabilita para cuadrar la matriz.

Columnas: **Capa** · **Config. visible** (`/lab`) · **Entrada** (condición)
· **Mecanismo** (movimiento/decisión/ayuda real) · **Fallback** · **Hecho /
auditoría** · **Prueba** · **Estado**. «—» = no existe todavía.

## Ataque — estilo

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Transición agresiva | Estilo | — | — | — | — | — | — | pendiente |
| Correr solo ante ventaja | Estilo | — (comportamiento fijo) | Salida tras rebote/robo/saque | Lectura de ventaja por llegadas reales (ME-03, opción B); sin ventaja, triple del portador en su punto real de tiro frente al valor de organizar (§2.5) | Organizar | `entrada_fase_transicion` (`triple_portador` con cerrador y oposición) | `me03.test.ts`, `me07b-v2-transition.test.ts` | parcial: no configurable, sin alternativa «agresiva» |
| Ataque temprano | Estilo | — | — | — | — | — | — | pendiente |
| Juego de control | Estilo | — | — | — | — | — | — | pendiente |
| Movimiento continuo | Estilo | — | — | — | — | — | — | pendiente |
| Creador central | Estilo | — | — | — | — | — | — | pendiente |
| Libertad pautada/contextual | Estilo | — | — | — | — | — | — | pendiente |
| Buscar aro / buscar triple / equilibrio | Estilo | `creationPriority` | Banda de empate de la lectura | Desempate dentro de `FIRST_READ_TIE_BAND_POINTS` | Valor mayor | `creation_priority_resolved_band` | `me07a.test.ts` | parcial: solo desempata, no crea oportunidades |
| Cargar rebote / proteger balance | Estilo | `priority` | Gesto de cada tiro | Reparto por llegada al aro (1 ó 2 cargan) | — | `asignacion_rebote`, `disputa_rebote` | `me03.test.ts`, `me07b-v2-rebound.test.ts` | parcial: reparto por personas sí; sin elegir quién |
| Roles fijos / intercambio viable | Estilo | — | Cada organización | Creador (poseedor u O1) y bloqueador (O5 u O4) por proyección en seco; defensores siguen a su marca (§2.4) | Rol vigente | `organizacion_creador`, `organized_entry.detail.roles` | `me07a.test.ts`, `me07b-v2-roles.test.ts` | parcial: sin orden «roles fijos» configurable ni UI |

## Ataque — espaciado, ocupación y colocación

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| 4-out/1-in | Espaciado | — (fijo) | Todo ataque organizado | Disposición única de `scenario.ts` | — | — | varias | parcial: única estructura, sin rellenos |
| 5-out | Espaciado | — | — | — | — | — | — | pendiente |
| 3-out/2-in | Espaciado | — | — | — | — | — | — | pendiente |
| Horns | Colocación | `screenPlacement=horns` («Colocación del bloqueo: Horns» en `/lab`) | Ataque organizado con bloqueo permitido | Disposición LAB-0.8: los dos interiores en los codos, esquinas llenas, ala débil vacía; ficha `horns_bloqueo` (ver «Libro por fase») | Central (la mano a mano no se juega desde Horns) | `colocacion_bloqueo` (`horns`), `organized_entry.detail.placement` | `lab-0-8-parameters.test.ts`, `me07b-v2-horns.test.ts` | jugable como colocación de la ficha Horns→bloqueo (ver «Libro por fase») |
| 1-4 alto | Colocación | — | — | — | — | — | — | pendiente |
| Delay | Colocación | `screenPlacement=delay` («Colocación del bloqueo: Delay» en `/lab`) | Ataque organizado con plan `auto` o mano a mano; por orden o, desde v2-6, en la colocación `auto` por valor proyectado frente a las respuestas a la entrega vistas | Disposición LAB-0.10: interior arriba por encima del arco, el otro interior en el poste bajo del lado del balón, esquina fuerte y ala débil; ficha `delay_mano_a_mano` (ver «Libro por fase») | Con el bloqueo obligado, central | `colocacion_bloqueo` (`delay`), `organized_entry.detail.placement` | `lab-0-10-parameters.test.ts`, `me07b-v2-delay.test.ts` | jugable como colocación de la ficha Delay (por orden; en `auto` compite: 32 de 4.737 organizaciones de la foto de las 20 en tres partidos, ver nota v2-7) |
| Empty side | Ocupación | — | — | — | — | — | — | pendiente |
| Dunker spot | Ocupación | — | — | — | — | — | — | pendiente |
| Sobrecarga | Ocupación | — | — | — | — | — | — | pendiente |
| Rellenos tras corte/inversión | Ocupación | — | — | — | — | — | — | pendiente |

## Ataque — familias base

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Bloqueo directo central | Familia | `offensivePlan`, `screenPlacement=central` | Ataque organizado | Pantalla del bloqueador asignado, lectura por valor frente al mejor cierre real (§2.4) | Salida segura | `seleccion_familia`, `colocacion_bloqueo`, `lectura_bloqueo_o1` | `me04b`, `me06`, `me07b-v2-reads.test.ts` | parcial: sin /lab v2-3; foto seed (v2-3) colocación central 1.175 / lateral 55 (Sierra) |
| Bloqueo directo lateral | Familia / colocación | `screenPlacement` (`auto`/`central`/`lateral`, selector «Colocación del bloqueo» en `/lab`) | Ataque organizado con bloqueo directo permitido | Disposición LAB-0.7 (manejador en el ala, bloqueador fuera de la franja de la zona, short roll lateral); en `auto` el poseedor real elige colocación junto con creador y bloqueador por la misma proyección en seco | Central (la mano a mano solo se juega desde la central) | `colocacion_bloqueo`, `organized_entry.detail.placement`, `screen_set.detail.placement`, `seleccion_familia` (`family_not_in_lateral_placement`) | `lab-0-7-parameters.test.ts`, `me07b-v2-lateral-ice.test.ts` | parcial: ejecutable, negable (ICE) y elegido en `auto` (foto seed 55 Sierra / 32 Puerto); sin `/lab` recorrido; lado derecho y espaciado propio pendientes |
| Mano a mano (DHO) | Familia | `offensivePlan` | Ataque organizado | Entrada a O5 en codo, entrega a O2 (central); desde v2-5 también la entrega de Delay: el manejador sigue su pase y el cuerpo del pívot es la pantalla (T13/F05/T16, peso) | O5 conserva | `entrada/transferencia_mano_a_mano`; `entrega_delay` | `me06-mano-a-mano.test.ts`, `me07b-v2-delay.test.ts` | parcial: la central, valorada desde v2-7 con la oposición real de su ejecución (sus triples de recepción llegan siempre contestados), casi no se elige en `auto` (1 de 4.737 organizaciones en la foto de las 20; nota v2-7); la de Delay es jugable por orden y compite en `auto` (32) |
| Pindown | Familia | — | — | Solo el indirecto O4→O3 dentro del DHO | — | `bloqueo_indirecto_o3` | `me06` | pendiente como familia propia |
| Poste alto / bajo / alto-bajo | Familia | — (dentro de Delay) | Entrada al poste bajo desde la entrega (O1) o desde arriba (O5, alto-bajo) | El poste lee tras reconocer (M01/M05) y girar: aro rodeando a D4, gancho (T02), salida a la esquina, corte del ala débil, repostear; la ayuda «dig» de la esquina lo dobla si llega antes del giro (presión T07/T15) | Repostear y reorganizar | `lectura_poste`, `respuesta_poste` | `me07b-v2-delay.test.ts` | parcial: solo poste bajo dentro de Delay; sin poste alto propio ni trabajo de espaldas (back-down) |
| Corte | Familia | — | — | Corte de O3 dentro del DHO (central); en Delay, corte del ala débil al recibir el poste, rodeando a su defensor, y puerta de atrás de O1 si la entrega está negada | — | `weak_side_cut`, `backdoor_cut`, `lectura_poste` (`corte_o3`), `lectura_delay_pivote` (`puerta_atras_o1`) | `me06`, `me07b-v2-delay.test.ts` | parcial: solo dentro de fichas; sin familia propia |
| Aislamiento contextual | Familia | — | — | — | — | — | — | pendiente |
| Drive-and-kick | Familia | — | — | — | — | — | — | pendiente |
| Pase extra | Familia | — | Receptor del roll con D3 fuera de O3 | Inversión O5→O3 valorada con desvío y cierre real de D4 (§2.4) | Tiro del receptor | `lectura_segunda_o5` | `me04b`, `me07b-v2-reads.test.ts` | parcial: una sola ruta |
| Ataque a zona (poste alto, short corner, inversión) | Familia | — | — | — | — | — | — | pendiente |
| Ataque a presión (salida, receptor central, 3×2 tras ruptura) | Familia | — | — | — | — | — | — | pendiente |

## Ataque — variantes encadenadas

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Drag | Variante | — | — | — | — | — | — | pendiente |
| Double drag | Variante | — | — | — | — | — | — | pendiente |
| Spain | Variante | `chainedVariant` (`auto`/`ninguna`/`spain`, «Variante encadenada» en `/lab`); defensa `backScreenCall` (`auto`/`seguir`/`cambiar`, «Bloqueo ciego (Spain)») | Desde Horns; el bloqueador ciego lee si hay a quién bloquear (D5 detrás de la pantalla y fuera del aro) | Ficha `horns_spain` (ver «Libro por fase») | Sin objetivo: árbol de Horns | `seleccion_variante`, `lectura_spain_bloqueador`, `respuesta_bloqueo_ciego`, `lectura_spain` | `lab-0-9-parameters.test.ts`, `me07b-v2-spain.test.ts` | jugable (ver nota v2-5) |
| Ram | Variante | — | — | — | — | — | — | pendiente |
| Chicago / Zoom | Variante | — | — | — | — | — | — | pendiente |
| Pistol | Variante | — | — | — | — | — | — | pendiente |
| Hammer | Variante | — | — | — | — | — | — | pendiente |
| Flare (salida desde Spain) | Lectura | — | — | — | — | — | — | pendiente: Spain existe desde v2-5 pero su salida es el pop, no un flare |
| Segunda pantalla sobre el perseguidor | Continuación | — | — | — | — | — | — | pendiente |
| Shake (lado débil) | Principio | — | — | — | — | — | — | pendiente |

## Ataque — lecturas y contramedidas

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Reject | Lectura | — | — | — | — | — | — | pendiente |
| Snake | Lectura | — | — | — | — | — | — | pendiente |
| Re-screen | Lectura | — | Primera lectura negada | Segunda entrada del bloqueo (ME-04) | Tiro forzado | `segunda_entrada` | `me04.test.ts` | parcial: 0 naturales |
| Slip | Lectura | — | — | — | — | — | — | pendiente |
| Ghost | Lectura | — | — | — | — | — | — | pendiente |
| Keeper | Lectura | — | Entrega negada | O5 conserva y lee (central); en Delay, si D5 salta la entrega, O5 se la queda con la pintura vacía: aro, puerta de atrás, alto-bajo o invertir | — | `transferencia_mano_a_mano`, `lectura_delay_pivote` | `me06`, `me07b-v2-delay.test.ts` | parcial: solo por negación, no elección |
| Curl | Lectura | — | — | — | — | — | — | pendiente |
| Backdoor | Lectura | — | Entrega de Delay negada (D5 en el punto de la entrega) | O1 corta al aro rodeando a D5; D1 persigue desde atrás, D4 ayuda | Otra vía del pívot | `backdoor_cut`, `lectura_delay_pivote` (`puerta_atras_o1`) | `me07b-v2-delay.test.ts` | parcial: solo ante la entrega negada; sin backdoor ante deny/top-lock |
| Tiro temprano/penetración del base libre | Lectura | — | 1ª lectura del bloqueo | Finalizar, triple con cierre de D1, tiro parado (T03) o floater (T02) antes del protector (§2.4) | Pase / salida | `lectura_bloqueo_o1` (`parada_o1`, `flotadora_o1`) | `me04b`, `me07b-v2-reads.test.ts` | parcial: sin /lab v2-2 |

## Ataque — continuaciones

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Roll profundo | Continuación | — | Recepción en el short roll; en Spain, roll al poste bajo débil por fuera del bloqueo ciego | El receptor ataca el aro (`finalizar_aro`) frente a D5/D3 reales (§2.4); en Spain D5 está retenido por el bloqueo ciego | Floater / inversión (en Spain, pase al pop) | `lectura_segunda_o5`, `roll_continuation.detail.deep` | `me07b-v2-reads.test.ts`, `me07b-v2-spain.test.ts` | parcial: fuera de Spain el roll para en el short roll |
| Short roll | Continuación | — | Pase a O5 | Recepción en `SHORT_ROLL_SPOT`; lee aro/floater/inversión frente al mejor cierre; tendencia en la banda (§2.4) | Segunda entrada / tiro contenido | `lectura_segunda_o5` | `me02`, `me04b`, `me07b-v2-reads.test.ts` | parcial: única continuación física |
| Pop | Continuación | — | ICE ante bloqueo lateral; en Spain, el bloqueador ciego al soltar a D5 | Con la pantalla negada, el bloqueador se abre al codo (`ICE_POP_SPOT`); en Spain el bloqueador ciego se abre por encima del arco (`SPAIN_POP_SPOT`) y lo cierra quien le sigue (D3) o D5 si cambian | Tiro del receptor | `roll_continuation`, `lectura_ice`, `back_screen_pop`, `lectura_spain` (`pase_pop_o3`) | `me07b-v2-lateral-ice.test.ts`, `me07b-v2-spain.test.ts` | parcial: sin pop del bloqueador del bloqueo directo elegido por él |
| Mantener perseguidor detrás | Continuación | — | — | — | — | — | — | pendiente |
| Lift | Continuación | — | — | — | — | — | — | pendiente |
| Drift | Continuación | — | — | — | — | — | — | pendiente |
| Relleno ala/esquina y salida de balance | Continuación | — | — | — | — | — | — | pendiente |

## Libro por fase

Primitiva común (§3, sesión v2-3): `PlaybookCard` en
`domain/tactics/playbook-card.ts` con fase/condición, colocación, roles y
sustitutos, primera acción, variantes, lecturas permitidas, seguridad y
prioridad; describe las tres acciones organizadas de partida (bloqueo
central, mano a mano, bloqueo lateral), desde v2-4 **Horns→bloqueo**
(`horns_bloqueo`, LAB-0.8) y desde v2-5 **Horns→Spain** (`horns_spain`,
LAB-0.9, variante encadenada) y **Delay→DHO con poste** (`delay_mano_a_mano`,
LAB-0.10, `offeredInAuto=true` desde v2-6), y gobierna qué colocaciones se ofrecen al
organizar (`playbook-card.test.ts`: cada lectura de un partido completo
pertenece a la ficha de su fase).

**Nota v2-4 (Horns→bloqueo jugable).** Ejecución: colocación real de los
cinco, entrada por orden o por proyección y cadena ficha → entrada →
lectura → tiro en ME-07B-AUDIT-1. Negación: misma ficha ante drop (pase al
roll y remate), cambio (O1 ataca al pívot) y trampa (pase al roll y de él a
la esquina débil o al codo; robo posible) → tres desenlaces físicos
distintos; la ayuda del segundo cuerno contiene al continuador. Continuidad:
partidos completos `final` con acta conciliada. Recorrido `/lab` en la
sección de progreso v2-4. Limitaciones: Spain y otras variantes
encadenadas pendientes; la segunda entrada (variante) se juega desde el
nuevo ángulo con la geometría central; el defensor del codo no ayuda sobre
la penetración de O1 (solo sobre el roll).

**Nota v2-6 (comparador de fichas y Delay en `auto`).** La colocación
(ficha) se elige por su valor proyectado; la banda de empate de LAB-0.3 solo
desempata asignaciones de creador/bloqueador de la misma ficha y del mismo
plan, por la primera lectura real (antes decidía el 81,9 % de las
colocaciones a favor de una ficha que valía menos, casi siempre la central).
Delay compite en `auto` frente a lo que la defensa ha hecho ante la entrega.
Foto de las 20: central 93,4 % → 40,5 %, lateral 33,5 %, Horns 25,3 %, Delay
0,7 %; la familia sigue siendo bloqueo en el 94,0 % (antes 86,5 %), con causa
medida: ante la misma respuesta base Delay vale 0,05–0,16 menos, y en la
central la mano a mano que la proyección prefiere (343 de 587 en la foto seed
de Sierra) pierde por lo observado (rinde 0,67 frente a 0,96 proyectados).
Cifras, posesiones consecutivas de `/lab` y la decisión pendiente (aprender
por ficha) en `analysis/ME-07B-v2-comparador-v2-6.md`. No cambia el estado de
ninguna fila: ninguna se declara jugable nueva.

**Nota v2-7 (proyectado frente a anotado).** La lectura de la mano a mano
central valoraba sus triples de recepción sin oposición y la ejecución los
resolvía siempre contestados (199 de 200 en la foto de las 20; lectura 1,17
frente a 0,63 del tiro real). Ahora se valoran con la misma regla y
geometría que los resuelve; en `auto` la mano a mano central pasa de 249
usos a 1 y la familia bloqueo de 94,0 % a 99,3 % (decisión pendiente de
diseño de su geometría). Delay, con 2.209 usos dirigidos en 20 semillas,
rinde lo proyectado (anotado − proyectado +0,03 ± 0,03 por partido); se
elige en `auto` 32 veces en tres partidos. Cifras en
`analysis/ME-07B-v2-mano-a-mano-delay-v2-7.md`. No cambia el estado de
ninguna fila.

**Nota v2-5 (Horns→Spain y Delay→DHO con poste, jugables).** *Spain*
(LAB-0.9): desde Horns, el segundo cuerno pone un bloqueo ciego a D5 (a
contacto, en su retroceso) y el manejador espera a que esté puesto; D5 queda
retenido (T13/F05 frente a T16) y rodea al bloqueador; roll profundo al poste
bajo débil y pop del bloqueador ciego por encima del arco. Entrada por orden o
en `auto` frente a Horns→bloqueo (`seleccion_variante`); el bloqueador lee si
hay a quién bloquear (drop/por debajo); la defensa sigue, ayuda desde la
pintura (deja el pop) o cambia (D3 al roll, D5 al pop). Ante drop la misma
defensa da otra primera decisión que Horns→bloqueo (el manejador ataca el aro
o encuentra el roll profundo; sin segunda entrada) y otra responsabilidad de
ayuda («en el pop» frente a «en el codo»); seguir/cambiar dan pop frente a
aro; cambio y trampa dejan sin objetivo (fallback a Horns). *Delay* (LAB-0.10,
**solo por orden**): entrada arriba, entrega en mano con el cuerpo del pívot
como pantalla, respuesta hundirse/cambiar/saltar la entrega, lectura del
receptor o del pívot (puerta de atrás, alto-bajo) y del poste (aro, gancho,
salida a la esquina si ayudan a tiempo, corte del ala débil, repostear).
`/lab` recorrido (sección de progreso v2-5). Limitaciones: Delay no compite en
la colocación `auto`; sin trabajo de espaldas en el poste; el cambio en el
bloqueo ciego siempre llega a tiempo con el fixture (la sincronización da
tiempo a cantarlo).

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Organizado: Horns→bloqueo | Libro | `screenPlacement=horns` (orden) o `auto` (proyección) | Ataque organizado sin superioridad; los dos cuernos son los dos interiores en pista (si el poseedor es interior, devuelve al manejador) | Ficha `horns_bloqueo`: el bloqueo del cuerno (O5) con el árbol de coberturas real (drop, por debajo, show, a la altura, cambio, trampa); ayuda al roll el defensor del segundo cuerno, que deja un tiro medio en el codo (T03); la reparación sale de la esquina débil | Lectura del receptor (aro, floater, codo, segunda entrada con motivo), salida segura y reorganizar; trampa puede robar | `colocacion_bloqueo`, `seleccion_familia.cardId=horns_bloqueo`, `organized_entry` (roles), `help_left_assignment` («en el codo»), lecturas, `summary.shots[].cardId` + `causingDecision` | `me07b-v2-horns.test.ts` (ejecución, cadena auditada, drop/cambio/trampa → tres desenlaces, Horns ≠ central, negación y continuidad), `playbook-card.test.ts` | **jugable** (ver nota v2-4) |
| Organizado: Horns→Spain | Libro | `screenPlacement=horns` + `chainedVariant=spain` (orden) o `auto` (proyección frente a la defensa observada, `seleccion_variante`); defensa `backScreenCall` | Colocación Horns; el bloqueador ciego (segundo cuerno) encuentra a D5 detrás de la pantalla (drop, por debajo; ICE no aplicable) fuera del radio del aro y hay reloj para sincronizar | Ficha `horns_spain`: bloqueo ciego real a D5 (a contacto en su retroceso), el manejador espera en el punto de uso, D5 retenido el retraso de pantalla y rodea al bloqueador, roll profundo al poste bajo débil, pop del bloqueador ciego; respuesta de D3/D5 seguir/ayudar/cambiar por concesión (cambiar solo si D3 lo reconoce y canta antes del roll); O1 lee aro, roll (con pase al pop), pop, triple o salida | Sin objetivo (cambio, trampa, show, a la altura): el bloqueador se queda en el codo y se juega el árbol de Horns con la misma ficha; salida segura | `seleccion_variante`, `lectura_spain_bloqueador`, `respuesta_bloqueo_ciego`, `lectura_spain`, hechos `back_screen_set`/`back_screen_switch`/`back_screen_pop`, `summary.shots[].cardId=horns_spain` | `me07b-v2-spain.test.ts` (ejecución física, cadena auditada, auto, misma defensa frente a Horns→bloqueo, seguir/cambiar, negación por cobertura, cambio con defensores lentos), `lab-0-9-parameters.test.ts`, `playbook-card.test.ts` | **jugable** (ver nota v2-5) |
| Organizado: Delay→DHO/corte | Libro | `screenPlacement=delay` (orden) o `auto` (valor proyectado frente a las respuestas a la entrega vistas, v2-6) | Ataque organizado con plan `auto` o mano a mano | Ficha `delay_mano_a_mano`: pase de entrada arriba, el manejador sigue su pase y recibe la entrega (cuerpo del pívot como pantalla; orden sin balón de D1 en `auto` por concesión); respuesta de D5 hundirse/cambiar/saltar la entrega (en `auto`, menor concesión); con la entrega: aro, triple, tiro parado, poste, salida; negada: el pívot ataca el aro, puerta de atrás de O1, alto-bajo o invierte | Entrada desviada (balón suelto), salida segura y reorganizar | `colocacion_bloqueo` (`delay`), `seleccion_familia.cardId=delay_mano_a_mano`, `seleccion_orden_sin_balon`, `entrega_delay`, `lectura_delay`, `lectura_delay_pivote`, hechos `delay_hold`/`dho_completed`/`dho_denied`/`backdoor_cut` | `me07b-v2-delay.test.ts`, `lab-0-10-parameters.test.ts`, `playbook-card.test.ts` | **jugable por orden**; en `auto` compite por valor (elegida 32 veces en la foto de las 20, en tres partidos; rinde lo proyectado con 2.209 usos dirigidos, ver nota v2-7) |
| Organizado: entrada a poste con salidas | Libro | Dentro de Delay | Pase al poste bajo desde la entrega o desde arriba | El poste lee (M01/M05) y gira; la ayuda de la esquina («dig») por concesión, a tiempo solo si llega antes del giro (dos sobre el balón: robo T07/T15); salidas: aro rodeando a D4, gancho, salida a la esquina, corte del ala débil (rodea a D3; D4 se gira al cortador), repostear | Repostear y reorganizar | `respuesta_poste`, `lectura_poste`, hechos `post_dig`/`weak_side_cut` | `me07b-v2-delay.test.ts` (salidas con ayuda rápida/lenta, tirador de esquina malo, regresión de faltas tardías en el corte) | **jugable por orden** dentro de Delay |
| Temprano: drag / double drag / pistol | Libro | — | — | — | — | — | — | pendiente |
| Saque lateral: stack | Libro | — | — | — | — | — | — | pendiente: falta la primitiva de saque defendido (ver nota de saques) |
| Saque lateral: Iverson | Libro | — | — | — | — | — | — | pendiente: ídem |
| Saque de fondo: box | Libro | — | — | — | — | — | — | pendiente: ídem |
| Saque de fondo: diamond | Libro | — | — | — | — | — | — | pendiente: ídem |
| Saque de fondo: elevator | Libro | — | — | — | — | — | — | pendiente: ídem |
| Saque de fondo: corte a aro/esquina | Libro | — | — | — | — | — | — | pendiente: ídem |
| Especial: último tiro / necesidad de triple / poco reloj | Libro | — | — | — | — | — | — | pendiente |

**Nota de saques (v2-5, análisis; sin mecanismo nuevo).** El partido ya
modela el *contexto reglamentario* del saque (`linked-run.ts` `throwIn`:
sacador = el más cercano al punto, cuenta de 5 s, reloj que arranca con el
toque legal, 24/14 s, flecha de alternancia, saque tras canasta/libre/fuera/
falta/violación), y en 4 partidos naturales (91–94) hay ≈19 saques por partido que
no son tras canasta ni libre (balón fuera, falta sin tiro, alternancia). Falta la **capa táctica** que exige §4: (1) el
receptor es «el compañero más cercano, recibe donde está» (no hay colocación
ni movimiento de los cuatro de dentro); (2) **nadie defiende el saque**: el
pase se resuelve sin defensor (`resolvePass(..., false, 0, 0)`), así que no
puede haber negación, cambio de receptor ni robo; (3) el sacador no lee
opciones (primera, segunda, salida de seguridad) ni consume la cuenta
esperando; (4) tras el toque se pasa a `advance`/organizar, sin jugada de
salida. Una ficha stack/Iverson/box/diamond/elevator jugable necesita antes
esa primitiva común de «saque defendido» (posiciones de partida por ficha,
marca de cada receptor, pantallas sin balón reutilizando el retraso
T13/F05/T16, lectura del sacador con la cuenta de 5 s y pase con desvío
real). No se ha iniciado para no dejar a medias una primitiva que cambia
todos los saques del partido.

## Defensa — asentada y presión

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Individual | Asentada | — (fijo) | Siempre | Emparejamiento D_n↔O_n | — | — | varias | parcial: única estructura |
| Zona 2-3 | Asentada | — | — | — | — | — | — | pendiente |
| Zona 3-2 | Asentada | — | — | — | — | — | — | pendiente |
| Zona 1-3-1 | Asentada | — | — | — | — | — | — | pendiente |
| Matchup zone | Asentada | — | — | — | — | — | — | pendiente |
| Box-and-one | Asentada | — | — | — | — | — | — | pendiente |
| Triangle-and-two | Asentada | — | — | — | — | — | — | pendiente |
| 1-2-2 de media pista | Asentada | — | — | — | — | — | — | pendiente |
| Presión individual 3/4 | Presión | — | — | — | — | — | — | pendiente |
| Presión individual toda pista | Presión | — | — | — | — | — | — | pendiente |
| Run-and-jump | Presión | — | — | — | — | — | — | pendiente |
| 1-2-1-1 / diamond | Presión | — | — | — | — | — | — | pendiente |
| 2-2-1 | Presión | — | — | — | — | — | — | pendiente |
| 1-2-2 de presión | Presión | — | — | — | — | — | — | pendiente |
| Trampa de media pista | Presión | — | — | — | — | — | — | pendiente |
| Transición: frenar balón, proteger aro, reparar | Transición | — | Pérdida de balón / tiro rival | Retorno y primer protector por llegada real | — | `entrada_fase_transicion` | `me03` | parcial: sin orden configurable |

## Defensa — balón, receptores y coberturas

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Distancia / orientación / agresividad / manos | Balón | — | — | — | — | — | — | pendiente |
| Gap | Receptores | `offBallDefensiveCall=guardar_espacio` | DHO | D3 concede separación, D4 puede ayudar | — | `seleccion_orden_sin_balon` | `me06` | parcial: solo en DHO |
| Deny | Receptores | `negar_primera_salida` | DHO | D3 persigue apretado | — | idem | `me06` | parcial: solo en DHO |
| Top-lock | Receptores | — | — | — | — | — | — | pendiente |
| Criterio de closeout | Receptores | — | — | — | — | — | — | pendiente |
| Drop | Cobertura | `coverage` | Bloqueo directo | D5 retrocede al aro desde el roll (una sola trayectoria) y contesta al receptor; no sale al tiro parado mientras el roll no está contenido (§2.4) | Plan base ante empate o cobertura no aplicable | `seleccion_cobertura` | `me02`, `me04b`, `me07b-v2-reads.test.ts` | parcial: compite con seis coberturas en `auto`; sin profundidad configurable |
| At the level | Cobertura | `coverage=a_la_altura` | Bloqueo directo (central o lateral) | D5 sube **a la altura del bloqueador**, a contacto suyo hacia el aro (M01/M05, T22), sin meterse en la salida de O1: O1 dobla la esquina sin pausa y D5 le contiene saliendo con él al decidir; cuando D1 se recupera (M09) D5 vuelve **con el continuador** (cierra su punto real de tiro); D3 decide la ayuda | Salida segura | `at_level_committed` (`depthToHoop`), `at_level_recovery`, `lectura_a_la_altura` (`halted=false`, `d5RecoversTo=continuador`), `seleccion_cobertura` | `lab-0-7-parameters.test.ts`, `me07b-v2-lateral-ice.test.ts` | parcial: distinto del show en profundidad (≥0,3 m más hondo), pausa y responsable; elegido en `auto` (foto seed 5 / 135); concede más penetración que drop en el fixture; sin `/lab` |
| Show / hedge | Cobertura | `coverage=show` | Bloqueo directo | D5 sale **a la línea del manejador**, a contacto del punto de uso (M01/M05, T22): si llega antes que O1 a ese punto, O1 no arranca hacia el aro hasta que D5 se retira (aviso M09 cuando D1 supera la pantalla) y D5 vuelve **al aro**; D3 decide la ayuda al roll | Salida segura | `show_committed` (`depthToHoop`), `show_recovery`, `lectura_show` (`halted`, `driveStartSeconds`, `d5RecoversTo=aro`), `seleccion_cobertura` | `me07b-v2-switch-show.test.ts`, `me07b-v2-lateral-ice.test.ts` | parcial: la pausa del manejador es nueva en v2-3 (semilla 92 central: 58/116 lecturas frenadas); elegido en `auto` (foto seed 1 / 61); sin `/lab` |
| Trap | Cobertura | `coverage=trampa` | Bloqueo directo | D1+D5 al balón, D3 low man, D4 rota; contacto de la trampa cerrada puede ser falta sin tiro (M07, §2.5) | Recuperar | `lectura_trampa`, `seleccion_cobertura`, `puerta_falta_sin_tiro` | `me02`, `me07b-v2-coverage.test.ts`, `me07b-v2-fouls.test.ts` | parcial: elegible y elegida en `auto` desde la preparación (§2.3); sin lugar/disparador configurable |
| Switch | Cobertura | `coverage=cambio` | Bloqueo directo | D5 canta y sale a la altura del bloqueo (M01/M05, T22), D1 se queda con el bloqueador (M09, T23); O1 lee frente al pívot; emparejamiento cambiado persiste en la posesión | Salida segura | `switch_committed`, `lectura_cambio`, `seleccion_cobertura` | `me07b-v2-switch-show.test.ts` | parcial: elegido en `auto` (foto seed 40/61); sin scram/recuperar tras el desajuste ni `/lab` |
| ICE lateral | Cobertura | `coverage=ice` | Solo pantalla lateral (`isLateralScreenSpot`) | D1 reconoce la pantalla (M01/M05) y se pone de su lado, a contacto del manejador (F04): si llega antes del uso, la niega y empuja a fondo; D5 baja a la ayuda baja (M01/M05, T23); el bloqueador se abre al codo; O1 lee penetrar por fondo, tiro medio tras rechazar (T03), pase al bloqueador (la línea pasa por D1, T17), esquina fuerte (D2 en casa) o salida | ICE tardío (`ice_late`) o bloqueo central (`coverage_not_applicable`): drop | `ice_committed`, `ice_late`, `lectura_ice`, `seleccion_cobertura` (concesión proyectada solo ante lateral; `coverage_ice_central_not_eligible` ante central) | `me07b-v2-lateral-ice.test.ts`, `me07b-v2-switch-show.test.ts` (negación central) | parcial: ejecutable y elegido en `auto` ante el lateral (foto seed 9 / 38); semilla 92 forzada: 235 ICE puestos, concede sobre todo el bloqueador abierto; un D1 lento llega tarde; sin `/lab` recorrido en v2-3 |
| Under | Cobertura | `coverage=por_debajo` | Bloqueo directo | D1 pasa entre el bloqueador y su defensor sin retraso: niega el dos contra uno del roll y contesta la entrada; el cierre del triple rodea al bloqueador y no contesta si aún no lo ha rodeado al soltar | — | `screen_navigated.route`, `lectura_bloqueo_o1` (`d1CloseoutMarginSeconds`, `d1WallsDrive`) | `me07b-v2-switch-show.test.ts` | parcial: elegido en `auto` (foto seed 125/55); `/lab` semilla 92 recorrida en `85725d6`; desde v2-4 el ataque lo pondera por la frecuencia con que el rival lo ha mostrado (`me07b-v2-coverage-projection.test.ts`) |
| Respuesta de zona al bloqueo | Cobertura | — | — | — | — | — | — | pendiente |

## Defensa — ayudas, reparación y tras tiro

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Nail | Ayuda | — | — | — | — | — | — | pendiente |
| Low man | Ayuda | — (en trampa) | Trampa | D3 sobre el short roll | — | `lectura_trampa` | `me02` | parcial: solo dentro de la trampa |
| Tag | Ayuda | `rollHelpCall` (motor; escenario en lab) | Drop | D3 decide ayudar comparando concesión con/sin ayuda (§2.4); `siempre` obliga | Conserva marca | `help_decision` | `me02`, `me07b-v2-reads.test.ts` | parcial: orden sin control en /lab |
| Stunt | Ayuda | — | — | — | — | — | — | pendiente |
| Dig | Ayuda | — (lectura en `auto` dentro de Delay) | Balón en el poste bajo de Delay | El defensor de la esquina fuerte lee el pase al poste en el aire (M01/M05) y ayuda a contacto del poste si concede menos; si llega antes del giro son dos sobre el balón (robo T07/T15) y deja la esquina | Quedarse en la esquina (no dejar tirador) | `respuesta_poste`, `post_dig` | `me07b-v2-delay.test.ts` | parcial: solo en el poste de Delay; con el fixture llega tarde casi siempre (a tiempo con F04/M01/M05 altos) |
| No dejar tirador de esquina | Ayuda | — (dentro de `rollHelpCall=auto`) | Drop con continuador | D3 no ayuda si la esquina concede más que el roll (§2.4) | Ayuda | `help_decision.detail.concession*` | `me07b-v2-reads.test.ts` | parcial: sin orden propia ni emergencia |
| X-out | Reparación | — | — | — | — | — | — | pendiente |
| Sink-and-fill | Reparación | — | — | — | — | — | — | pendiente |
| Ayuda a la ayuda | Reparación | — (en trampa) | Trampa | D4 rota a O3 tras D3 | — | `lectura_trampa` | `me02` | parcial |
| Recuperar / intercambiar | Reparación | — | — | — | — | — | — | pendiente |
| Scram | Reparación | — | — | — | — | — | — | pendiente |
| Cerrar línea (box-out) | Tras tiro | — (fijo) | Tiro/libre que toca aro | Cierre legal y próximo con T19/F05 del cerrador; el defensor cerrado que aún disputa puede cometer falta por encima de la espalda (M07, §2.5) | Carrera libre | `disputa_rebote`, `puerta_falta_sin_tiro` | `rebound-boxout.test.ts`, `me07b-v2-rebound.test.ts`, `me07b-v2-fouls.test.ts` | parcial: sin orden configurable ni carrera defensiva a cerrar; sin falta en ataque |
| Capturar / cargar / balancear (defensa) | Tras tiro | — | — | — | — | — | — | pendiente |
| Excepciones: ICE izq., cambiar con este quinteto, perseguir a X, presión solo tras saque de fondo | Excepción | — | — | — | — | — | — | pendiente |
| Prioridad y fallback de órdenes contradictorias | Excepción | — | — | — | — | — | — | pendiente |

## Fuera del inventario obligatorio

`inverted`, `UCLA` y `2-1-2`: no están en el capítulo; solo se añadirían con
las hojas `TacticasOFF.xlsx`/`TacticasDEF.xlsx` (no versionadas) y una
ampliación explícita de esta matriz. Modo rápido: ME-08.
