# ME-07B v2 — el comparador proyecta el rebote ofensivo (sesión v2-9)

**Estado:** ACTIVE (medición fechada; no se reescribe)
**Es fuente de verdad para:** las cifras de la sesión v2-9 sobre la proyección del rebote ofensivo y la palmeada en el comparador de familias y fichas (calibración frente a la ejecución, partidos dirigidos de las cinco fichas, mismas 20 semillas) y la parte del trabajo heredado que se retiró, con su causa medida.
**Debe leerse cuando:** se toque el valor que comparan familias, fichas, coberturas o la transición, el rebote enlazado o la valoración de falta y tapón en las lecturas.
**No cubre:** la mecánica del rebote (ver `docs/match/ACTIONS.md`, «Rebote ofensivo y continuación») ni las mediciones anteriores (`ME-07B-v2-mano-a-mano-v2-8.md`).
**Documentos relacionados:** `ME-07B-v2-mano-a-mano-v2-8.md`, `ME-07B-v2-foto-basal-20.md`, `docs/match/TACTICAL-MATRIX.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md` (sesión v2-9).
**Última actualización:** 2026-10-10 (ME-07B v2, sesión v2-9).

## 1. Qué hace el arreglo (sin coeficientes nuevos)

La proyección en seco de cada familia se fija en su primera lectura (valor
de cada vía × completado, como hasta v2-8) y, desde ahí, **sigue ejecutando
en la misma copia en seco la vía que la lectura elegiría** por su camino
modal (cada sorteo toma su resultado más probable: el pase no se desvía, no
hay falta ni robo improbables). Al llegar al tiro (`resolveShotAttempt`) se
valora lo que seguiría a un fallo vivo con el estado real de ese instante y
se corta. Ese término se suma a la vía elegida:

`(1 − falta) · (1 − tapón) · (1 − acierto) · palmeada`

- **Falta y tapón** con las mismas reglas que la resolución (contacto tardío
  o cierre legal con solape y M07; tapón con oposición, sin contacto ilegal y
  altura T18): un tiro con falta o taponado no deja rebote.
- **Palmeada**: los movimientos del gesto se aplican sobre una copia con la
  misma función que la ejecución (`planLinkedShotMovement`: tirador en su
  punto, carrera real del que cierra, quién carga y quién vuelve); después
  todas las posiciones salen del historial, como en `buildReboundCandidates`.
  Para cada punto de una cuadratura de la caída (la distribución de
  `seedReboundLanding`, 2 radios × 6 ángulos con peso igual) la disputa es la
  del resolvedor sin sorteo (`contestRebound`: cierres T19/F05, ventana de
  vuelo, captura T20, palmeo por T20; falta sobre la espalda M07). Si
  controla un atacante, `readSecondChance` (defensores donde están al
  controlar) decide si hay palmeada y esta vale como cualquier lectura
  (puntos × acierto).
- Solo cuenta lo que pasa **dentro del mismo uso**: un rebote que se
  reorganiza abre otra decisión organizada que se valora entonces.
- Mismo término en todas las fichas (bloqueo central y lateral, Horns, Spain,
  mano a mano, Delay) y en las concesiones de una sola vía de la trampa. La
  defensa compara coberturas con las mismas proyecciones.
- `resolucion_tiro` audita en cada tiro real lo que esa proyección espera
  (`projectedOffensiveReboundProbability`, `projectedPutbackProbability`,
  `projectedPutbackValue`), para contrastarlo con lo que ocurre
  (`scripts/me07b-v2-rebound-calibration.ts`).

## 2. Lo que se retiró del trabajo heredado (medido)

El árbol sin commit de la sesión cortada ampliaba el alcance. Mismas 4
semillas `auto`/`auto` (1–4), `ab50cf1` → árbol heredado → árbol final:

| Medida (4 partidos) | `ab50cf1` | heredado | final |
|---|---:|---:|---:|
| Rebote ofensivo / fallos vivos | 96/417 (23 %) | 215/524 (41 %) | 97/389 (25 %) |
| Triples de transición tomados | 4 | 228 | 5 |
| Faltas de tiro | 66 | 111 | 85 |
| Contactos tardíos (`late_illegal_contact`) | 24 | 48 | 23 |
| Familia bloqueo / mano a mano | 564/381 | 394/425 | 395/571 |
| Puntos (los dos equipos) | 922 | 960 | 902 |

- **Falta y tapón en el valor de cada lectura.** Valorar la falta hacía que
  el ataque buscara el contacto tardío, que hoy es falta segura: con cambio
  por orden (semilla 92) Sierra acaba recibiendo 42 faltas de tiro en dos
  cuartos, D5 de Puerto se queda con cuatro jugadores y el partido termina
  en guardián. Solo el tapón: familia bloqueo 962 / mano a mano 33. Las
  lecturas vuelven a puntos × acierto; el riesgo de tapón y de falta sigue
  sin valorarse en las lecturas (pendiente con `DECISIÓN REQUERIDA`, ver
  `ME-07B-PROGRESS.md`).
- **Rebote tras el triple de transición.** Tras fallarlo el ataque recupera
  el 60 % (99 de 164): el que carga sale hacia el aro desde el gesto y los
  defensores, que vuelven a sus marcas, no reaccionan al tiro (limitación ya
  escrita en `ACTIONS.md`). La lectura de transición compara organizar y el
  triple **sin** rebote en los dos lados (`assignOrganizedRoles(..., false)`),
  la misma base que en `ab50cf1`.
- **Defecto propio del heredado:** el que cierra el tiro se situaba con su
  geometría de cierre aunque la ejecución lo dejara en su retirada al aro
  (D5 tras ir por debajo); la palmeada tras un triple de O1 se proyectaba
  9,3 veces en 16 fallos con 1 real. Ahora sale del historial.

## 3. Calibración en los tiros reales

`scripts/me07b-v2-rebound-calibration.ts`, solo tiros que fallan y tocan aro:

| Muestra | Fallos vivos | Rebote ofensivo proy./real | Palmeadas proy./real | Puntos de palmeada proy./real |
|---|---:|---|---|---|
| `auto`/`auto`, semillas 1–8 | 800 | 180,1 / 165 | 25,8 / 23 | 28,1 / 41 |
| Bloqueo central por orden, 1–8 | 452 | 69,4 / 76 | 9,3 / 12 | 10,4 / 17 |

Rebote y palmeada cuadran; los puntos reales de la palmeada superan a los
proyectados porque la palmeada se valora como cualquier lectura (puntos ×
acierto, sin falta).

## 4. Proyectado frente a anotado, cinco fichas por orden

`scripts/me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20` (ahora
también Horns y Spain), equipo dirigido alterno, misma ventana que la
observación del motor. Anotado − proyectado por partido (media ± error
típico, partidos por debajo):

| Ficha por orden | `ab50cf1` | heredado | final | Subida proyectada · puntos tras rebote ofensivo por uso (final) |
|---|---|---|---|---|
| Bloqueo central | −0,005 ± 0,029 (11/20) | −0,068 ± 0,029 | **+0,001 ± 0,033** (11/20) | 0,917 → 0,936 · 0,021 |
| Horns | +0,005 ± 0,028 (10/20) | −0,045 ± 0,024 | **−0,020 ± 0,031** (11/20) | 0,900 → 0,902 · 0,004 |
| Horns→Spain | +0,037 ± 0,030 (8/20) | −0,044 ± 0,022 | **+0,001 ± 0,030** (12/20) | 0,924 → 0,947 · 0,019 |
| Delay | +0,010 ± 0,026 (10/20) | +0,001 ± 0,025 | **−0,033 ± 0,022** (13/20) | 0,847 → 0,867 · 0,027 |
| Mano a mano central | −0,140 ± 0,019 (20/20) | −0,084 ± 0,028 | **−0,059 ± 0,025** (15/20) | 0,997 → 1,003 · 0,000 |

La subida de cada proyección coincide con lo que de verdad se anota tras un
rebote ofensivo dentro del uso; ninguna ficha gana una ventaja sin contar.
La mano a mano sigue por debajo por las causas ya descompuestas en v2-8
(respuesta de D5 que la defensa elige por menor concesión y el ataque solo
conoce por frecuencia; banda de tendencia; tapones), no por el rebote: casi
todos sus rebotes ofensivos (271 de 846 fallos) se reorganizan.

## 5. Mismas 20 semillas (`scripts/me07b-v2-baseline-20.ts`)

| Foto · equipo | OREB tras fallo de campo vivo (`ab50cf1` → final) | Familia bloqueo / mano a mano | Puntos |
|---|---|---|---|
| seed · Sierra | 150/461 (33 %) → 131/491 (27 %) | 550/767 → 629/671 | 1.160 → 1.152 |
| seed · Puerto | 150/506 (30 %) → 138/555 (25 %) | 673/702 → 625/723 | 1.224 → 1.282 |
| +3 · Sierra | 139/234 (59 %) → 106/263 (40 %) | 314/516 → 692/40 | 914 → 926 |
| +3 · Puerto | 43/290 (15 %) → 39/297 (13 %) | 511/173 → 508/251 | 551 → 576 |
| +5 · Sierra | 51/102 (50 %) → 54/114 (47 %) | 374/4 → 364/12 | 528 → 523 |
| +5 · Puerto | 22/153 (14 %) → 41/186 (22 %) | 256/121 → 365/12 | 284 → 262 |

**Familia bloqueo en la foto de las 20: 54,0 % → 65,1 %** (3.183 de 4.892).
En la foto seed el reparto apenas cambia (51 % / 49 %); el salto viene de
Sierra +3 y Puerto ante Sierra +5, donde el bloqueo deja rebote real (sus
interiores mejorados ganan llegadas, efecto de capacidad) y la mano a mano
casi nunca (§4). No se ajustó nada hacia ningún reparto. Coste de la foto:
63,6 s (seed) · 43,8 s (+3) · 19,9 s (+5), con otros procesos en paralelo.

## Reproducir

```bash
npx tsx scripts/me07b-v2-rebound-calibration.ts --seeds 1-8
npx tsx scripts/me07b-v2-rebound-calibration.ts --seeds 1-8 --order bloqueo_central
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20
npx tsx scripts/me07b-v2-baseline-20.ts
```
