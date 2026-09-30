# Matriz táctica versionada (ME-07B v2 §0.4)

**Estado:** ACTIVE
**Es fuente de verdad para:** el estado real de cada nombre del capítulo táctico en el motor: capa, configuración visible, condición de entrada, mecanismo, fallback, hecho/auditoría, prueba y estado.
**Debe leerse cuando:** vayas a implementar, probar o declarar jugable cualquier táctica de ME-07B.
**No cubre:** el diseño de cada táctica (ver `reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`) ni el detalle del árbol ya implementado (ver `ACTIONS.md`).
**Documentos relacionados:** `ACTIONS.md`, `AUDIT.md`, `docs/prompts/implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-09-30 (ME-07B v2, sesión v2-1).

## Reglas de estado

- **jugable**: un partido completo puede ejecutarla, negarla y continuar con
  reloj, balón y participantes coherentes; tiene prueba de ejecución y de
  negación/respuesta rival y se ha visto en `/lab`. Hoy **ninguna fila**
  cumple las cuatro condiciones (sin recorrido de `/lab` en v2).
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
| Correr solo ante ventaja | Estilo | — (comportamiento fijo) | Salida tras rebote/robo/saque | Lectura de ventaja por llegadas reales (ME-03, opción B) | Organizar | `entrada_fase_transicion` | `me03.test.ts` | parcial: no configurable, sin alternativa «agresiva» |
| Ataque temprano | Estilo | — | — | — | — | — | — | pendiente |
| Juego de control | Estilo | — | — | — | — | — | — | pendiente |
| Movimiento continuo | Estilo | — | — | — | — | — | — | pendiente |
| Creador central | Estilo | — | — | — | — | — | — | pendiente |
| Libertad pautada/contextual | Estilo | — | — | — | — | — | — | pendiente |
| Buscar aro / buscar triple / equilibrio | Estilo | `creationPriority` | Banda de empate de la lectura | Desempate dentro de `FIRST_READ_TIE_BAND_POINTS` | Valor mayor | `creation_priority_resolved_band` | `me07a.test.ts` | parcial: solo desempata, no crea oportunidades |
| Cargar rebote / proteger balance | Estilo | `priority` | Gesto de cada tiro | Reparto por llegada al aro (1 ó 2 cargan) | — | `asignacion_rebote`, `disputa_rebote` | `me03.test.ts`, `me07b-v2-rebound.test.ts` | parcial: reparto por personas sí; sin elegir quién |
| Roles fijos / intercambio viable | Estilo | — | — | Reasignación O1↔poseedor (`organize`) | Pase de vuelta | `organizacion_creador` | `me07a.test.ts` | parcial: solo creador |

## Ataque — espaciado, ocupación y colocación

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| 4-out/1-in | Espaciado | — (fijo) | Todo ataque organizado | Disposición única de `scenario.ts` | — | — | varias | parcial: única estructura, sin rellenos |
| 5-out | Espaciado | — | — | — | — | — | — | pendiente |
| 3-out/2-in | Espaciado | — | — | — | — | — | — | pendiente |
| Horns | Colocación | — | — | — | — | — | — | pendiente |
| 1-4 alto | Colocación | — | — | — | — | — | — | pendiente |
| Delay | Colocación | — | — | — | — | — | — | pendiente |
| Empty side | Ocupación | — | — | — | — | — | — | pendiente |
| Dunker spot | Ocupación | — | — | — | — | — | — | pendiente |
| Sobrecarga | Ocupación | — | — | — | — | — | — | pendiente |
| Rellenos tras corte/inversión | Ocupación | — | — | — | — | — | — | pendiente |

## Ataque — familias base

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Bloqueo directo central | Familia | `offensivePlan` | Ataque organizado | O5 pantalla, O1 usa, lectura por valor | Salida segura | `seleccion_familia`, `lectura_bloqueo_o1` | `me04b`, `me06` | parcial: monopolio en `auto` (§2.2) |
| Bloqueo directo lateral | Familia | — | — | — | — | — | — | pendiente |
| Mano a mano (DHO) | Familia | `offensivePlan` | Ataque organizado | Entrada a O5 en codo, entrega a O2 | O5 conserva | `entrada/transferencia_mano_a_mano` | `me06-mano-a-mano.test.ts` | parcial: casi nunca elegido en `auto` |
| Pindown | Familia | — | — | Solo el indirecto O4→O3 dentro del DHO | — | `bloqueo_indirecto_o3` | `me06` | pendiente como familia propia |
| Poste alto / bajo / alto-bajo | Familia | — | — | — | — | — | — | pendiente |
| Corte | Familia | — | — | Corte de O3 dentro del DHO | — | — | `me06` | pendiente como familia propia |
| Aislamiento contextual | Familia | — | — | — | — | — | — | pendiente |
| Drive-and-kick | Familia | — | — | — | — | — | — | pendiente |
| Pase extra | Familia | — | — | Inversión O5→O3 (segunda lectura) | — | `lectura_segunda_o5` | `me04b` | parcial: una sola ruta |
| Ataque a zona (poste alto, short corner, inversión) | Familia | — | — | — | — | — | — | pendiente |
| Ataque a presión (salida, receptor central, 3×2 tras ruptura) | Familia | — | — | — | — | — | — | pendiente |

## Ataque — variantes encadenadas

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Drag | Variante | — | — | — | — | — | — | pendiente |
| Double drag | Variante | — | — | — | — | — | — | pendiente |
| Spain | Variante | — | — | — | — | — | — | pendiente |
| Ram | Variante | — | — | — | — | — | — | pendiente |
| Chicago / Zoom | Variante | — | — | — | — | — | — | pendiente |
| Pistol | Variante | — | — | — | — | — | — | pendiente |
| Hammer | Variante | — | — | — | — | — | — | pendiente |
| Flare (salida desde Spain) | Lectura | — | — | — | — | — | — | pendiente |
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
| Keeper | Lectura | — | Entrega negada | O5 conserva y lee | — | `transferencia_mano_a_mano` | `me06` | parcial: solo por negación, no elección |
| Curl | Lectura | — | — | — | — | — | — | pendiente |
| Backdoor | Lectura | — | — | — | — | — | — | pendiente |
| Tiro temprano/penetración del base libre | Lectura | — | — | Finalizar / triple O1 en 1ª lectura | — | `lectura_bloqueo_o1` | `me04b` | parcial |

## Ataque — continuaciones

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Roll profundo | Continuación | — | — | Punto `DEEP_CONTINUATION_SPOT` sin decisión propia | — | — | — | pendiente |
| Short roll | Continuación | — | Pase a O5 | Recepción en `SHORT_ROLL_SPOT` y lectura de O5 | Tiro contenido | `lectura_segunda_o5` | `me02`, `me04b` | parcial: única continuación |
| Pop | Continuación | — | — | — | — | — | — | pendiente |
| Mantener perseguidor detrás | Continuación | — | — | — | — | — | — | pendiente |
| Lift | Continuación | — | — | — | — | — | — | pendiente |
| Drift | Continuación | — | — | — | — | — | — | pendiente |
| Relleno ala/esquina y salida de balance | Continuación | — | — | — | — | — | — | pendiente |

## Libro por fase

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Organizado: Horns→bloqueo/Spain | Libro | — | — | — | — | — | — | pendiente |
| Organizado: Delay→DHO/corte | Libro | — | — | — | — | — | — | pendiente |
| Organizado: entrada a poste con salidas | Libro | — | — | — | — | — | — | pendiente |
| Temprano: drag / double drag / pistol | Libro | — | — | — | — | — | — | pendiente |
| Saque lateral: stack | Libro | — | — | — | — | — | — | pendiente |
| Saque lateral: Iverson | Libro | — | — | — | — | — | — | pendiente |
| Saque de fondo: box | Libro | — | — | — | — | — | — | pendiente |
| Saque de fondo: diamond | Libro | — | — | — | — | — | — | pendiente |
| Saque de fondo: elevator | Libro | — | — | — | — | — | — | pendiente |
| Saque de fondo: corte a aro/esquina | Libro | — | — | — | — | — | — | pendiente |
| Especial: último tiro / necesidad de triple / poco reloj | Libro | — | — | — | — | — | — | pendiente |

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
| Drop | Cobertura | `coverage` | Bloqueo directo | D5 protege aro, D3 ayuda opcional | — | `seleccion_cobertura` | `me02`, `me04b` | parcial: 100 % en `auto` (§2.3) |
| At the level | Cobertura | — | — | — | — | — | — | pendiente |
| Show / hedge | Cobertura | — | — | — | — | — | — | pendiente |
| Trap | Cobertura | `coverage=trampa` | Bloqueo directo | D1+D5 al balón, D3 low man, D4 rota | Recuperar | `lectura_trampa` | `me02` | parcial: nunca elegible en `auto` (§2.3) |
| Switch | Cobertura | — | — | — | — | — | — | pendiente |
| ICE lateral | Cobertura | — | — | — | — | — | — | pendiente |
| Under | Cobertura | — | — | — | — | — | — | pendiente |
| Respuesta de zona al bloqueo | Cobertura | — | — | — | — | — | — | pendiente |

## Defensa — ayudas, reparación y tras tiro

| Nombre | Capa | Config. | Entrada | Mecanismo | Fallback | Hecho/auditoría | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| Nail | Ayuda | — | — | — | — | — | — | pendiente |
| Low man | Ayuda | — (en trampa) | Trampa | D3 sobre el short roll | — | `lectura_trampa` | `me02` | parcial: solo dentro de la trampa |
| Tag | Ayuda | `d3HelpsRoller` (escenario) | Drop | D3 frena el roll y deja su marca | — | `lectura_bloqueo_o1` | `me02` | parcial: no configurable en partido |
| Stunt | Ayuda | — | — | — | — | — | — | pendiente |
| Dig | Ayuda | — | — | — | — | — | — | pendiente |
| No dejar tirador de esquina | Ayuda | — | — | — | — | — | — | pendiente |
| X-out | Reparación | — | — | — | — | — | — | pendiente |
| Sink-and-fill | Reparación | — | — | — | — | — | — | pendiente |
| Ayuda a la ayuda | Reparación | — (en trampa) | Trampa | D4 rota a O3 tras D3 | — | `lectura_trampa` | `me02` | parcial |
| Recuperar / intercambiar | Reparación | — | — | — | — | — | — | pendiente |
| Scram | Reparación | — | — | — | — | — | — | pendiente |
| Cerrar línea (box-out) | Tras tiro | — (fijo) | Tiro/libre que toca aro | Cierre legal y próximo con T19/F05 del cerrador; sin desplazamiento defensivo previo | Carrera libre | `disputa_rebote` | `rebound-boxout.test.ts`, `me07b-v2-rebound.test.ts` | parcial: sin orden configurable ni carrera defensiva a cerrar (retirada, ver `ACTIONS.md`) |
| Capturar / cargar / balancear (defensa) | Tras tiro | — | — | — | — | — | — | pendiente |
| Excepciones: ICE izq., cambiar con este quinteto, perseguir a X, presión solo tras saque de fondo | Excepción | — | — | — | — | — | — | pendiente |
| Prioridad y fallback de órdenes contradictorias | Excepción | — | — | — | — | — | — | pendiente |

## Fuera del inventario obligatorio

`inverted`, `UCLA` y `2-1-2`: no están en el capítulo; solo se añadirían con
las hojas `TacticasOFF.xlsx`/`TacticasDEF.xlsx` (no versionadas) y una
ampliación explícita de esta matriz. Modo rápido: ME-08.
