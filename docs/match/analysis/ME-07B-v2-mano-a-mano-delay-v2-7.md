# ME-07B v2 — por qué la mano a mano central y Delay anotaban menos de lo proyectado (sesión v2-7)

**Estado:** ACTIVE (medición fechada; no se reescribe)
**Es fuente de verdad para:** las cifras de la sesión v2-7 sobre la distancia entre el valor proyectado y los puntos anotados por uso de ficha (mano a mano central, Delay y bloqueo directo), la causa encontrada en la mano a mano, su arreglo y la comparación de las mismas 20 semillas antes/después.
**Debe leerse cuando:** se discuta si una ficha rinde lo que promete su proyección, se cambie la lectura de la mano a mano o se reabra la competencia entre familias en `auto`.
**No cubre:** el diseño del comparador (ver `docs/match/ACTIONS.md`) ni la medición v2-6 (ver `ME-07B-v2-comparador-v2-6.md`).
**Documentos relacionados:** `ME-07B-v2-comparador-v2-6.md`, `ME-07B-v2-foto-basal-20.md`, `docs/match/TACTICAL-MATRIX.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md` (sesión v2-7).
**Última actualización:** 2026-10-04 (ME-07B v2, sesión v2-7).

## Respuesta corta

- **Mano a mano central: defecto causal demostrado y corregido.** Su
  primera lectura (y por tanto la proyección de la familia, que es esa
  lectura en seco) valoraba `pase_o3` y `continuar_o4` como triples **sin
  oposición** con un umbral propio (`d4Helps ? 1 : 0`), mientras la
  ejecución resolvía el tiro con el defensor **ya colocado** en el punto:
  199 de 200 primeros tiros de la foto de las 20 con oposición 1. Lectura
  1,17 puntos frente a 0,63 del tiro que de verdad se lanzaba.
- **Delay: no hay error sistemático.** Con 2.209 usos dirigidos en 20
  semillas, anotado − proyectado por partido = **+0,032 ± 0,026** (error
  típico) antes del arreglo y −0,018 ± 0,025 después; 7 y 12 de 20 partidos
  por debajo. Los 33 usos de la semilla 86 (0,61 frente a 0,77) eran ruido
  de un solo partido.
- **Bloqueo directo «por encima» de su proyección: es la ventana de
  medida.** La proyección cuenta solo el primer tiro de la primera lectura;
  lo anotado suma libres y lo que viene tras el primer tiro (rebote
  ofensivo). Sin ellos, el bloqueo central anota 0,907 frente a 0,926
  proyectados.

## 1. ¿Miden lo mismo la proyección y el resultado?

`scripts/me07b-v2-handoff-delay-gap.ts`, misma ventana que la muestra que
el motor aprende (`settleObservation`): desde `seleccion_familia` hasta la
siguiente organización de la posesión o su último hecho.

- **Mismo punto de partida, ventana distinta por arriba.** La proyección
  (`familyOpportunity`) es el mejor `valor × completado` de la **primera
  lectura**: puntos esperados del primer tiro, con el riesgo de los pases
  (completado = 1 − desvío; cada desvío acaba en pérdida: el defensor que
  desvía recupera en 0,00 s, 100 % de los casos medidos). No incluye
  libres, rebote ofensivo ni segundas acciones. Lo anotado sí.
- **La calibración v2-6 usaba la proyección de la colocación**, calculada
  al organizar con la defensa supuesta en su puesto, no la de la familia en
  el instante real: en la mano a mano central 1,027 frente a 0,975 (foto de
  las 20). Diferencia menor; aquí se usan ambas.

Descomposición (foto de las 20, antes del arreglo, `030056f`):

| Ficha | n | Proyección familia | 1.ª lectura (elegida) | Tiro esperado (prob. usada) | Anotado = 1.er tiro + libres + resto |
|---|---:|---:|---:|---:|---|
| Bloqueo central | 1.663 | 0,926 | 0,982 | 1,015 | 1,058 = 0,907 + 0,070 + 0,081 |
| Mano a mano central | 249 | 0,975 | 1,170 | **0,632** | 0,763 = 0,494 + 0,044 + 0,225 |
| Delay | 33 | 0,767 | 0,711 | 0,903 | 0,606 = 0,545 + 0 + 0,061 |

En el bloqueo, lectura y tiro coinciden por vía (`finalizar`, `triple_o1`,
`parada_o1`: misma oposición en la lectura y en `resolucion_tiro`); `pase_o5`
mejora 0,995 → 1,048 porque el receptor relee al recibir. En la mano a mano,
la caída está entera entre la lectura (1,170) y el tiro (0,632).

## 2. Desglose de la mano a mano y de Delay

Partidos dirigidos (`--directed --seeds 1-20`: el equipo dirigido alterna,
Sierra en impares y Puerto en pares; el otro en `auto`), antes del arreglo:

| | Mano a mano (orden) | Delay (orden) | Bloqueo central (orden) |
|---|---|---|---|
| Usos | 2.207 | 2.209 | 2.335 |
| Pérdidas por uso (robo + pase desviado) | 16,5 % | 17,1 % | 6,7 % |
| Segundos hasta el 1.er tiro | 3,50 | 3,97 | 2,51 |
| Violaciones de 24 s | 2 | 0 | 1 |
| 1.ª lectura elegida → tiro esperado | 1,020 → **0,479** | 0,789 → 0,944 | 0,961 → 0,988 |
| Oposición del 1.er tiro (0 / 0,5 / 1) | 0 / 0 / 1.788 | 0 / 670 / 1.139 | 1.187 / 594 / 293 |
| Oposición supuesta = usada | — (la lectura no la registraba) | sí en todas las vías con registro | sí |
| Anotado (1.er tiro + libres + resto) | 0,593 (0,341 + 0,068 + 0,184) | 0,872 (0,699 + 0,149 + 0,024) | 1,033 (0,860 + 0,087 + 0,086) |

- **Pérdidas**: altas en las dos entregas (pase de entrada y pase de
  salida), pero ya están en la proyección (completado); no explican la
  brecha.
- **Reloj**: la entrega tarda ~1 s más en llegar al tiro; la proyección ya
  corre ese reloj y los tiros apenas llegan tarde (2 violaciones en 2.207).
- **Ayudas**: en la mano a mano la lectura espera a `max(entrega, corte de
  O3, llegada de D3)`, así que D3 ya está en el punto del corte cuando sale
  el pase; y el punto del bloqueo de O4 está a **0,81 m** del punto donde
  ayuda D4 (alcance de cierre R_contest ≈ 1,3–1,4 m con el fixture). Ninguna de las dos vías «libres»
  existe físicamente con esta geometría.
- **Calidad frente a ejecución**: la probabilidad de acierto es la misma
  regla (LAB-0.1) en todas las familias; lo que difería era la oposición
  supuesta por la lectura de la mano a mano (0 o 1 por umbral) frente a la
  geométrica de `resolveShotAttempt` (R_contest, LAB-0.3).
- **Segundas lecturas**: la mano a mano no tiene; Delay sí (poste → corte
  del ala débil 748, esquina 120) y sube de 0,771 a 1,018 por tiro, a
  cambio de las pérdidas. Ninguna ficha acaba en salida segura/reorganización
  dentro de la ventana (0 casos), así que esa vía no separa proyección y resultado.

## 3. El defecto y el arreglo (`possession-core.ts`, `runHandoffPhase`)

Antes: `o3Opposition = d4Helps ? 1 : 0`, `continuar_o4` siempre con
oposición 0 y `finalizar_portador` con el umbral de margen ≥ 0,25 s. La
ejecución pasaba a `resolveShotAttempt` el cierre de D3 (o D4) llegando a
`tD3AtCut ≤ tDecision`, y el de D4 sobre O4 desde su posición hacia el
punto de O4.

Ahora las tres vías se valoran con `estimateContestLevel` y **los mismos
argumentos** (defensor, geometría, llegada, instante de tiro y preparación)
que se pasan después a `resolveShotAttempt`, que se calculan una sola vez y
se reutilizan en la ejecución: la regla que ya usaba la primera lectura del
bloqueo desde §2.4. Se audita `opposition` en cada vía. No hay coeficiente
nuevo ni cambio de geometría, de ejecución ni de la defensa.

**Prueba discriminante** `me07b-v2-handoff-read.test.ts`: mano a mano
dirigida en geometría construida, semillas 1–40 × dos órdenes sin balón;
con recepción limpia, el valor de la vía elegida debe ser puntos × la
probabilidad que usa el tiro. Antes del arreglo **falla** («guardar_espacio
semilla 1 continuar_o4: expected 1.173 to be close to 0.633»); después pasa.

Después (dirigidos, mismas 20 semillas): mano a mano lectura **0,547 = tiro
esperado 0,547**, oposición supuesta = usada en 1.048/1.048; anotado 0,652
(0,385 + 0,074 + 0,193) frente a 0,461 proyectados: el exceso es el de la
ventana (libres y rebote ofensivo tras triples contestados), igual que en
el bloqueo. Delay sin cambios de fondo (0,838 → 0,819).

## 4. Mismas 20 semillas, antes (`030056f`) y después

`scripts/me07b-v2-baseline-20.ts`; 20/20 `final` y actas conciliadas en ambos.

| Foto · equipo | Familia bloqueo / mano a mano (incl. Delay) | Colocación central / lateral / Horns / Delay | Puntos · posesiones |
|---|---|---|---|
| seed · Sierra | 1.155/106 → 1.286/8 | 589/351/327/0 → 606/428/258/8 | 1.302 · 1.174 → 1.325 · 1.201 |
| seed · Puerto | 1.274/7 → 1.285/1 | 324/524/443/0 → 304/617/380/0 | 1.229 · 1.175 → 1.296 · 1.203 |
| +3 · Sierra | 615/112 → 702/0 | 278/278/173/0 → 166/327/214/0 | 895 · 667 → 934 · 668 |
| +3 · Puerto | 697/40 → 713/9 | 373/277/60/33 → 267/267/188/9 | 658 · 667 → 633 · 669 |
| +5 · Sierra | 342/15 → 364/0 | 160/25/173/0 → 92/34/241/0 | 444 · 330 → 483 · 346 |
| +5 · Puerto | 345/2 → 354/15 | 196/132/21/0 → 171/70/116/15 | 331 · 330 → 313 · 345 |

**El monopolio del bloqueo como familia crece: 94,0 % → 99,3 %**
(4.704/4.737). La mano a mano central pasa de 249 usos a 1: valorada con la
oposición que de verdad encuentra, vale ~0,5 frente a ~0,9 del bloqueo. Es
la consecuencia honesta del arreglo, no un objetivo: la mano a mano solo
volverá a competir si su geometría crea vías realmente abiertas (ver
«Decisión requerida»). Delay se elige 32 veces en tres partidos (antes 33 en
uno). Sus 32 usos naturales anotan 0,906 frente a 0,781 proyectados.

Barrido `me07b-v2-stop-sweep.ts 1 60`: 180/180 `final`, 0 actas sin
conciliar, 3 relevos ROT-3. Coste de la foto de las 20 con auditoría, en
serie y mismo equipo: 54,5 → 50,5 s (seed 27,6 → 27,9; +3 20,0 → 14,5; +5
6,9 → 8,0).

## 5. `/lab` real (PostgreSQL 16 + Chromium, `next start`, árbol del arreglo)

- Semilla 92 todo `auto` → **103–121** (= dominio), `stop=final`, actas
  conciliadas. Posesiones **101–120 consecutivas** (mismo tramo que v2-6):
  colocación lateral/central (Horns segunda en varias), coberturas drop, ICE
  y show con su concesión, lecturas pase al roll (flotadora, aro, invertir),
  finalizar ante show; Delay 0,07–0,17 por debajo en todas; ninguna mano a
  mano en el partido.
- Semilla 92 con «Plan ofensivo: mano a mano» y colocación central en los
  dos → **119–98**, conciliado: 133 lecturas `lectura_mano_a_mano` (126
  `pase_o3`, 7 `continuar_o4`), todas con oposición 1; en los 120 tiros que
  salen de ellas la oposición supuesta = la usada y lectura media 0,542 =
  tiro esperado 0,542.
- Sierra +3, semilla 88 → **140–121** (= dominio): Puerto elige Delay 9
  veces (0,760–0,787 frente a 0,746–0,776 de la central). Perfiles
  restaurados al seed al terminar.

## Decisión requerida

La geometría sintética de la mano a mano (ME-06: punto del corte de O3 a
0,81 m del punto del bloqueo de O4; lectura que espera a la llegada de D3)
no crea ninguna vía exterior abierta. Si Dennis quiere que la mano a mano
compita, hay que decidir su diseño (cuándo lee el portador, dónde se abre
O4 tras la ayuda de D4). No se cambia sin esa decisión.

## Pendiente (medido, no corregido)

- La orden sin balón `auto` de la mano a mano (`evaluateOffBallCall`) sigue
  comparando concesiones con el umbral antiguo (triple sin oposición).
- `contesterArrival` del cierre de D4 reutiliza `tD3AtCut` (no su propia
  carrera); no cambia la oposición medida (1 en todos los tiros), sí el
  posible contacto.
- Una entrega de Delay decidida después de la bocina conserva su decisión
  auditada sin hecho (semilla 92, posesión 160); preexistente.

## Reproducir

```bash
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --photos
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20
npx tsx scripts/me07b-v2-baseline-20.ts
npx tsx scripts/me07b-v2-possession-slice.ts <exportación.json.gz> 101 120
```
