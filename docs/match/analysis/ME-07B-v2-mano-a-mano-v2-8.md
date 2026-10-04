# ME-07B v2 — rediseño de la mano a mano central: el cuerpo de O5 como pantalla real (sesión v2-8)

**Estado:** ACTIVE (medición fechada; no se reescribe)
**Es fuente de verdad para:** las cifras de la sesión v2-8 sobre el rediseño acotado de la mano a mano central (pruebas de un solo cambio, proyección frente a ejecución, mismas 20 semillas y partidos dirigidos) y la causa medida que queda abierta en la elección de familia.
**Debe leerse cuando:** se toque la entrega en mano (central o Delay), la respuesta de D5 a la entrega o la comparación entre familias en `auto`.
**No cubre:** el árbol completo de la entrega (ver `docs/match/ACTIONS.md`) ni las mediciones anteriores (`ME-07B-v2-mano-a-mano-delay-v2-7.md`).
**Documentos relacionados:** `ME-07B-v2-mano-a-mano-delay-v2-7.md`, `ME-07B-v2-foto-basal-20.md`, `docs/match/TACTICAL-MATRIX.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md` (sesión v2-8).
**Última actualización:** 2026-10-04 (ME-07B v2, sesión v2-8).

## Decisión de Dennis (literal)

> «DECISIÓN DE DISEÑO: autorizo el rediseño acotado de la mano a mano central.
> En la entrega de O5 a O2, el cuerpo de O5 debe poder actuar como pantalla
> real sobre D2. La ventaja debe depender de la posición y llegada de ambos
> atacantes, calidad de la pantalla, trayectoria y capacidades de D2, y ayuda
> de D5. La defensa debe poder superar, negar o contener la acción y obligar
> al atacante a leer otra salida o reorganizarse. Un triple o una penetración
> solo existen si los movimientos crean esa ventana de verdad. No separes
> artificialmente al defensor, no regales oposición cero, no aumentes
> porcentajes de acierto para hacer competitiva la jugada y no impongas cuotas
> de familias.»

## Qué se cambió (sin coeficientes nuevos)

Detalle en `ACTIONS.md` («Segunda familia posicional»). Resumen:

1. **Punto de entrega.** ME-06 llamaba «codo alto» al centro de la línea de
   tiros libres. Ahora O5 recibe en el codo real del lado fuerte (semianchura
   FIBA de la zona) y la entrega es en su hombro alto, a contacto (7,0 m del
   aro, detrás del arco). O2 rodea a O5 hasta ese hombro y sale por el otro.
2. **Pantalla del cuerpo de O5 sobre D2:** la misma primitiva del bloqueo
   directo (`screenInterceptDelaySeconds` T13/F05 frente a T16, peso),
   **sumada** a la llegada de D2 al hombro de contacto, solo si O5 está
   puesto (`SCREEN_SET_AFTER_ARRIVAL_SECONDS`). D2 sigue a O2 con su
   reconocimiento (M01/M05), velocidad (F04) y llegada perimetral (T22); si
   llega antes que O2 al punto, la entrega queda negada.
3. **Respuesta de D5 a la entrega** (las tres de Delay: hundirse, cambiar,
   saltar), elegida por menor concesión y lo visto ante entregas. Antes la
   defensa elegía una cobertura de pantalla que la entrega solo consultaba
   para la trampa.
4. **Lectura al recibir** (ya no espera al indirecto) con vías nuevas:
   parada de O2, triple al recibir (solo detrás del arco), continuación de O5
   al aro tras entregar (con una sola trayectoria de retirada de quien le
   defiende, como D5 en el drop del bloqueo), puerta de atrás de O2 con la
   entrega negada.
5. **Tipo de tiro del indirecto por su zona real.** Los puntos de ME-06
   (`WEAK_SIDE_CUT_SPOT` 6,60 m, `WEAK_SIDE_SCREEN_SPOT` 5,79 m) están dentro
   del arco; hasta v2-8 se anotaban **tres** puntos. Ahora son tiros medios.
6. **Delay** usa la misma suma del retraso (antes `max(llegada, entrega +
   retraso)`: a un D1 tardío la pantalla no le costaba nada). Efecto medido
   casi nulo (proyección dirigida 0,841 → 0,843).

## 1. Pruebas de un solo cambio (misma geometría del escenario)

`me07b-v2-handoff-screen.test.ts` (7 casos), sobre el motor real:

| Cambio único | Intermedio que cambia | Desenlace de la lectura |
|---|---|---|
| Bloqueador O5 T13/F05 1 → 15 (D2 lento, F04 3) | retraso 0,06 → 0,43 s; D2 se libera más tarde | parada de O2: oposición 0,5 → 0; aro y triple al recibir sin cambio (sin bono global) |
| Defensor D2 F04/T16 15 → 1 | llega al hombro de O5 1,34 → 1,91 s; se libera 1,94 → 2,58 s | parada de O2: 0,5 → 0 |
| Receptor O2 F01 1 → 15 | llega a la entrega 2,02 → 1,33 s | aro: oposición 1 → 0,5 y pasa a ser la vía elegida |
| Respuesta de D5 hundirse / cambiar / saltar | entrega completada / completada con cambio que persiste / negada | continuación de O5 / aro contra el pívot / O5 se la queda: tres primeras decisiones distintas |
| D2 por delante de O2 | llega antes al punto (0,79 frente a 1,52 s) | entrega negada, O5 lee aro, puerta de atrás, indirecto o salida |
| O5 llega tarde y entrega al recibir | pantalla no puesta: retraso 0 | D2 sigue a O2 sin coste de contacto |

Invariante: ningún tramo de D2 supera su velocidad (con el margen T22).

**Lo que la geometría no permite (y se deja así):** el triple al recibir en
el hombro alto lo contesta a medias un D2 retenido en el hombro de contacto
(0,99 m del tirador frente a un alcance de 1,4–1,5 m): la calidad de la
pantalla no lo convierte en un triple libre. Libre solo si D2 no ha llegado
aún al hombro al soltar.

## 2. Proyección frente a ejecución (misma regla que v2-7)

`me07b-v2-handoff-read.test.ts` (reescrita): con las tres respuestas, las dos
órdenes sin balón y 25 semillas, el valor de la vía elegida es puntos × la
probabilidad que usa el tiro en todos los casos con recepción limpia (≥ 100).

Partidos dirigidos (`me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20`):

| Ficha por orden | Usos | Proyectado (familia) | Anotado = 1.er tiro + libres + resto | Anotado − proyectado por partido |
|---|---:|---:|---|---|
| Mano a mano central | 2.319 | 0,998 | 1,006 = 0,860 + 0,100 + 0,047 | +0,010 ± 0,025 (9/20 por debajo) |
| Delay (tras alinear la pantalla) | 2.177 | 0,843 | 0,802 = 0,653 + 0,126 + 0,023 | −0,040 ± 0,018 (12/20) |
| Bloqueo central | 2.229 | 0,917 | 1,039 = 0,816 + 0,088 + **0,135** | **+0,123 ± 0,027 (2/20)** |

Mano a mano: oposición supuesta = usada en 2.011 de 2.019 primeros tiros a
0,5 (las 8 restantes son recepciones con control incómodo). En v2-7 la misma
ficha por orden proyectaba 0,461 y anotaba 0,652.

## 3. Mismas 20 semillas (todo `auto`)

`scripts/me07b-v2-baseline-20.ts`; 20/20 `final` y actas conciliadas.

| Foto · equipo | Familia bloqueo / mano a mano (v2-7 → v2-8) | Puntos · posesiones (v2-7 → v2-8) |
|---|---|---|
| seed · Sierra | 1.286/8 → 480/788 | 1.325 · 1.201 → 1.335 · 1.115 |
| seed · Puerto | 1.285/1 → 438/856 | 1.296 · 1.203 → 1.309 · 1.121 |
| +3 · Sierra | 702/0 → 394/362 | 934 · 668 → 893 · 620 |
| +3 · Puerto | 713/9 → 687/12 | 633 · 669 → 616 · 623 |
| +5 · Sierra | 364/0 → 317/30 | 483 · 346 → 452 · 325 |
| +5 · Puerto | 354/15 → 276/98 | 313 · 345 → 339 · 327 |

**Familia bloqueo 99,3 % → 54,7 %** (2.592 de 4.738). Respuestas de la
defensa ante la mano a mano en la foto seed: hundirse 588, cambiar 503,
saltar 415 (401 de ellas niegan la entrega). Lecturas: continuación de O5
449, triple al recibir 266, aro de O2 390, aro de O5 con la entrega negada
303, puerta de atrás 98. Más tiempo por posesión (11,6 → 12,3 s): la entrega
necesita pase de entrada y la carrera de O2.

Coste de la foto de las 20 con auditoría, en serie y sin otros procesos:
62,0 s antes del cambio y 64,5 s después.

## 4. Siguiente causa medida (no corregida)

El comparador valora el **primer tiro y sus libres**; no proyecta lo que
viene después (rebote ofensivo, segunda acción). Por orden, el bloqueo
central anota 0,135 por uso en ese «resto» y la mano a mano 0,047, así que
el bloqueo rinde +0,12 por encima de su proyección de forma sistemática y en
la foto seed `auto` elige más la mano a mano (0,976 por uso) que el bloqueo
central (1,092). Lo corrige en parte el aprendizaje por muestras (LAB-0.4),
que mezcla puntos de toda la ventana. Proyectar el rebote exige una regla
sobre quién carga y dónde cae cada tiro antes de lanzarlo: queda como
siguiente trabajo del comparador, sin coeficiente inventado.

## Reproducir

```bash
npx vitest run modules/match/domain/game/me07b-v2-handoff-screen.test.ts modules/match/domain/game/me07b-v2-handoff-read.test.ts
npx tsx scripts/me07b-v2-baseline-20.ts
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --photos
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20
```
