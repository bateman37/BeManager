# ME-07B v2 — foto basal recreada de las 20 auditorías

**Estado:** ACTIVE
**Es fuente de verdad para:** las cifras basales por foto, equipo y denominador contra las que se mide cada reparación causal de ME-07B v2.
**Debe leerse cuando:** vayas a cambiar el comportamiento del motor en ME-07B v2 o a comparar una muestra nueva.
**No cubre:** la interpretación completa del diagnóstico (ver `ME-07A-diagnostico-20-auditorias.md`) ni el diseño táctico.
**Documentos relacionados:** `ME-07A-diagnostico-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-09-30 (ME-07B v2, sesión 1, tras §2.1).

## Procedencia y fidelidad de la réplica

Los 20 `.json.gz` originales **no están disponibles** en el repositorio ni
en la sesión: no se afirma haberlos reanalizado. Se recrean desde el
`GameInput` con `npx tsx scripts/me07b-v2-baseline-20.ts` (fixture
`LAB_ROSTER_FIXTURE`, ofensiva/cobertura/orden sin balón `auto`,
`equilibrado`, `proteger_balance`; el +3/+5 aplica la misma operación que
`bulkIncrementLabAttributes`, tope 15).

| Foto | Semillas | Deltas efectivos Sierra | Huella recreada / informe | Marcadores y 2FGA/3FGA Puerto |
|---|---|---|---|---|
| seed | 91–96, 98–102 | ninguno | `2d8067b0` / `2d8067b0` | Idénticos a los 11 del anexo del informe |
| Sierra +3 | 86–91 | 320 × +3, 4 × +2 | `36caa0c5` / `da872180` | Idénticos a los 6 del anexo |
| Sierra +5 | 102–104 | 286 × +5, 20 × +3, 14 × +4, 4 × +2 | `b296cbac` / `b296cbac` | Idénticos a los 3 del anexo |

La foto +3 reproduce exactamente marcador, tiros de Puerto y OREB de
Sierra en los seis partidos, pero su huella difiere: la huella incluye
nombre, edad y plantilla de cada perfil, que no intervienen en la
simulación; lo más probable es que el perfil persistido de Dennis difiera
en uno de esos campos. No se ha podido comprobar sin el archivo original.
Los 20 partidos terminan con `stop.cause = final` y actas conciliadas.
Coste: 20 partidos con auditoría ≈ 4,8 s en Node 22 (≈ 180–525 ms cada uno).

## Cuadro basal por equipo y denominador (antes de cualquier cambio, `7b7eedd`)

Rebote ofensivo «tras fallo vivo» = rebotes de jugador del mismo equipo
tras un fallo de campo que no acaba en tapón ni fuera / fallos de ese tipo
que terminan en rebote de jugador. «Razón diagnóstica» = OREB/(FGA−FGM),
misma definición del informe.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Partidos | 11 | 11 | 6 | 6 | 3 | 3 |
| Puntos | 1.439 | 1.511 | 975 | 671 | 529 | 301 |
| Posesiones / s por posesión | 1.091 / 12,3 | 1.096 / 12,4 | 604 / 10,8 | 605 / 14,0 | 307 / 10,2 | 309 / 14,0 |
| Fases organizado / 2ª oport. / temprana | 1.206 / 266 / 6 | 1.288 / 259 / 101 | 638 / 153 / 37 | 783 / 94 / 0 | 321 / 71 / 23 | 411 / 56 / 0 |
| 2FGM/2FGA | 609/1.094 | 651/1.247 | 389/623 | 50/85 | 211/316 | 50/112 |
| 3FGM/3FGA | 69/216 | 65/200 | 55/120 | 184/577 | 30/55 | 64/241 |
| Tipos de FGA | close 1.094, triple 216 | close 1.247, triple 200 | close 623, triple 120 | close 85, triple 577 | close 316, triple 55 | close 112, triple 241 |
| 3 primeros tiradores / FGA | O5 405, SC12 370, SC11 298 / 1.310 | D5 422, PA11 376, PA12 341 / 1.447 | O5 210, SC12 194, SC11 186 / 743 | D3 235, PA09 136, PA08 111 / 662 | O5 113, SC11 91, SC12 89 / 371 | D3 78, PA09 66, D1 56 / 353 |
| FTM/FTA · PF | 14/17 · 10 | 14/16 · 10 | 32/39 · 24 | 19/32 · 27 | 17/20 · 10 | 9/14 · 14 |
| Pérdidas (jugador + equipo) | 139 | 22 | 45 | 79 | 24 | 43 |
| OREB tras fallo de campo vivo | 362/537 | 374/617 | 200/263 | 136/314 | 96/118 | 84/181 |
| OREB tras último libre fallado | 0/3 | 1/1 | 2/6 | 0/10 | 1/1 | 0/3 |
| Razón diagnóstica OREB/fallos campo | 380/632 | 404/731 | 206/299 | 156/428 | 97/130 | 98/239 |
| Familias PnR / DHO | 1.145 / 50 | 1.267 / 4 | 632 / 0 | 768 / 9 | 319 / 0 | 406 / 2 |
| Cobertura auto como defensa: drop / total | 1.271 / 1.271 | 1.195 / 1.195 | 777 / 777 | 632 / 632 | 408 / 408 | 319 / 319 |
| Trampa `coverage_trap_not_eligible` | 1.271 | 1.195 | 777 | 632 | 408 | 319 |
| Transición: sin ventaja / penetración / 3×2 / triple portador | 1.061 / 6 / 0 / 0 | 977 / 101 / 0 / 0 | 558 / 37 / 0 / 0 | 591 / 0 / 0 / 0 | 281 / 21 / 2 / 0 | 298 / 0 / 0 / 0 |
| Organización: conserva poseedor real | 45/1.202 | 4/1.285 | 0/637 | 6/780 | 0/321 | 2/408 |
| 1ª lectura PnR: pase O5 / triple O1 | 1.141 / 4 | 1.267 / 0 | 613 / 19 | 668 / 100 | 313 / 6 | 350 / 56 |
| 2ª lectura O5: invertir O3 / finalizar contenido | 208 / 0 | 234 / 0 | 111 / 0 | 565 / 0 | 54 / 0 | 238 / 60 |

Cifras combinadas que coinciden con el informe: seed 33 FTA y 20 PF en 11
partidos; +3 71 FTA y 51 PF; +5 34 FTA y 24 PF; 4.602 coberturas, todas
drop, todas con la trampa no elegible.

**Lectura:** los dos únicos tipos de FGA son `close_finish` y
`three_point`; dos tercios de los fallos de campo vivos acaban en rebote
ofensivo en la foto seed; casi nunca hay faltas; el ataque organizado se
reduce a PnR → pase a O5 → (a veces) inversión a O3. Son síntomas del flujo
de oportunidades, no objetivos numéricos a imponer.

## Evolución tras cada reparación

Cada fila nueva se añade con su commit; las anteriores no se reescriben.

| Commit | Cambio | Efecto medido (mismas 20 semillas/fotos) |
|---|---|---|
| `7b7eedd` | Basal | Cuadro de arriba |
| sesión v2-1 | §2.1 rebote: retraso real del cierre + tirador sin cierre durante su gesto + caída LAB-0.4 | Ver «Tras §2.1» |
| sesión v2-1 | §2.2 selector de familia por proyección en seco de la primera lectura + riesgo de pase | Monopolio intacto: seed PnR 1.197/1.235 (Sierra) y 1.216/1.217 (Puerto); +3 603/613 y 800/803; +5 302/316 y 401/401. Causa física: roll libre en 2.397/2.413 primeras lecturas (ver `ACTIONS.md`). Parejas: 91 seed 120–122 → +3 135–128; 102 seed 131–104 → +5 155–125 |
| sesión v2-1 | §2.3 trampa decidida al preparar la pantalla + concesiones proyectadas + aprendizaje por muestras visibles (LAB-0.4) | Ver «Tras §2.3» |

## Tras §2.1 (rebote), mismas 20 semillas y fotos

Todos `final`, actas conciliadas. Descomposición medida en la foto seed
(OREB tras fallo de campo vivo, Sierra / Puerto), activando las piezas en
orden sobre el mismo código:

| Variante | Sierra | Puerto | PF+FTA combinados |
|---|---:|---:|---:|
| Basal (retraso siempre 0) | 362/537 (67 %) | 374/617 (61 %) | 20 PF, 33 FTA |
| Solo el retraso corregido, cierre simétrico (el tirador bajo el aro «cierra») | 505/603 (84 %) | 298/572 (52 %) | 24 PF, 36 FTA |
| + el tirador no cierra durante su gesto | 336/528 (64 %) | 225/586 (38 %) | 26 PF, 37 FTA |
| + defensores que corren a cerrar a los cargadores (**retirada**) | 335/527 | 246/605 | **0 PF, 0 FTA** |
| + caída del tirador LAB-0.4 (sin la pieza retirada) = **commit** | 167/518 (32 %) | 103/534 (19 %) | 27 PF, 40 FTA |

El defecto literal de §2.1 no explicaba por sí solo la anomalía (el
encargo lo advertía): una vez corregido, el mayor contribuyente era que el
tirador de una bandeja fallada «llegaba» al rebote desde el aro en el mismo
instante del fallo. La respuesta defensiva «cerrar» se retiró porque dejaba
el fixture sin ninguna falta natural (todas nacían de faltas de tiro en la
segunda oportunidad); vuelve con §2.5.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos | 1.255 | 1.380 | 866 | 715 | 465 | 337 |
| Posesiones / s por posesión | 1.181 / 11,6 | 1.178 / 11,2 | 623 / 10,4 | 624 / 13,6 | 316 / 10,0 | 317 / 13,5 |
| Fases organizado / 2ª oport. / temprana | 1.251 / 127 / 4 | 1.227 / 75 / 130 | 626 / 69 / 38 | 798 / 85 / 0 | 318 / 49 / 22 | 410 / 44 / 0 |
| 2FGM/2FGA · 3FGM/3FGA | 514/946 · 70/237 | 584/1.054 · 67/205 | 334/527 · 54/120 | 38/69 · 203/579 | 187/288 · 24/56 | 52/90 · 73/243 |
| FTM/FTA · PF | 17/24 · 11 | 11/16 · 16 | 36/44 · 30 | 30/46 · 28 | 19/22 · 13 | 14/19 · 13 |
| OREB tras fallo de campo vivo | 167/518 | 103/534 | 81/227 | 120/303 | 57/119 | 61/158 |
| OREB tras último libre fallado | 0/5 | 0/3 | 1/6 | 0/11 | 0/0 | 0/4 |
| Familias PnR / DHO | 1.173 / 61 | 1.214 / 2 | 620 / 0 | 783 / 8 | 314 / 0 | 405 / 4 |
| Cobertura auto: drop / total (trampa no elegible) | 1.216 / 1.216 | 1.234 / 1.234 | 791 / 791 | 620 / 620 | 409 / 409 | 314 / 314 |
| 1ª lectura PnR: pase O5 / triple O1 | 1.169 / 4 | 1.214 / 0 | 600 / 20 | 685 / 98 | 303 / 11 | 350 / 55 |

Parejas: semilla 91 seed 120–140 (Puerto 99/12 2FGA/3FGA) → Sierra +3
146–119 (Puerto 12/95); semilla 102 seed 118–122 (Puerto 100/13) → Sierra +5
146–120 (Puerto 28/81). El fix de rebote reduce las segundas oportunidades
y el marcador, pero **no cambia** el monopolio de familia, drop ni el giro
de Puerto al triple con Sierra aumentada: eso es §2.2–§2.4.

## Tras §2.3 (defensa auto), mismas 20 semillas y fotos

Sin aprendizaje, la sola corrección de tiempo y concesión pasaba a un
monopolio de trampa (1.094/1.096 y 1.108/1.108 en seed): la geometría de
entrada organizada se repite y la trampa concede un triple libre de O4
(≈0,83–1,01) frente al roll libre del drop (≈1,17–1,21). Con el
aprendizaje por muestras visibles (lo concedido de verdad, incluidos
rebotes ofensivos y libres que la proyección no ve) la defensa alterna:

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos · posesiones | 1.323 · 1.104 | 1.315 · 1.106 | 794 · 597 | 686 · 598 | 488 · 307 | 276 · 305 |
| 2FGM/2FGA · 3FGM/3FGA | 383/712 · 172/521 | 397/727 · 162/514 | 270/429 · 78/264 | 63/110 · 175/557 | 115/186 · 83/180 | 22/44 · 73/249 |
| FTM/FTA · PF | 41/54 · 32 | 35/43 · 39 | 20/26 · 29 | 35/39 · 19 | 9/12 · 12 | 13/17 · 10 |
| Pérdidas | 146 | 83 | 54 | 96 | 27 | 79 |
| OREB tras fallo de campo vivo | 291/609 | 234/617 | 160/290 | 161/358 | 96/150 | 73/185 |
| Familias PnR / DHO | 1.171 / 5 | 1.145 / 14 | 495 / 128 | 695 / 36 | 304 / 4 | 329 / 3 |
| Cobertura como defensa: trampa / drop | 484 / 675 | 443 / 733 | 309 / 422 | 207 / 416 | 328 / 4 | 186 / 122 |

Parejas: 91 seed 124–134 (Puerto 94/27) → +3 135–137 (Puerto 19/101); 102
seed 114–108 (Puerto 76/43) → +5 158–67 (Puerto 14/77). **Limitaciones
abiertas:** la trampa multiplica el rebote ofensivo (defensores fuera de
sitio y sin carrera defensiva a cerrar, ver §2.1) y las pérdidas; la
familia sigue siendo casi siempre PnR salvo con Sierra +3; solo existen
dos coberturas. Nada de esto es objetivo numérico.
