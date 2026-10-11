# ME-07B v2 — foto basal recreada de las 20 auditorías

**Estado:** ACTIVE
**Es fuente de verdad para:** las cifras basales por foto, equipo y denominador contra las que se mide cada reparación causal de ME-07B v2.
**Debe leerse cuando:** vayas a cambiar el comportamiento del motor en ME-07B v2 o a comparar una muestra nueva.
**No cubre:** la interpretación completa del diagnóstico (ver `ME-07A-diagnostico-20-auditorias.md`) ni el diseño táctico.
**Documentos relacionados:** `ME-07A-diagnostico-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-3, tras LAB-0.7).

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

## Tras §2.4 (lecturas y asignación de roles) y §2.5 (transición y faltas)

Mismas 20 semillas y fotos, `npx tsx scripts/me07b-v2-baseline-20.ts` en el
commit `7346e64`. Las huellas cambian respecto al basal porque T02/T03/M07
pasan a activas (valor neutro 8 en el fixture y el +3/+5 también las
incrementa); el resto de la configuración es la misma.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos · posesiones | 1.133 · 1.169 | 1.297 · 1.167 | 814 · 671 | 595 · 672 | 468 · 323 | 312 · 322 |
| 2FGM/2FGA · 3FGM/3FGA | 275/607 · 159/560 | 335/624 · 178/643 | 253/462 · 80/246 | 131/302 · 101/368 | 119/192 · 63/179 | 49/124 · 65/197 |
| Tipos: aro / floater / medio / triple | 421/107/79/560 | 246/337/41/643 | 251/211/0/246 | 70/91/141/368 | 148/44/0/179 | 52/0/72/197 |
| FTM/FTA · PF | 106/135 · 119 | 93/143 · 111 | 68/90 · 45 | 30/45 · 68 | 41/49 · 20 | 19/23 · 40 |
| OREB tras fallo de campo vivo | 215/570 | 222/640 | 106/271 | 102/349 | 82/146 | 55/164 |
| Familias PnR / DHO | 1.011 / 214 | 1.088 / 180 | 452 / 222 | 752 / 34 | 169 / 139 | 383 / 3 |
| Cobertura como defensa: trampa / drop | 564 / 704 | 353 / 872 | 161 / 625 | 216 / 458 | 124 / 262 | 98 / 210 |
| 1ª lectura PnR: pase O5 / parada O1 / triple O1 | 644 / 81 / 28 | 577 / 44 / 3 | 399 / 0 / 12 | 383 / 144 / 74 | 106 / 0 / 0 | 172 / 74 / 13 |
| 2ª lectura O5: aro / floater / inversión | 270 / 107 / 204 | 42 / 339 / 129 | 141 / 211 / 15 | 0 / 91 / 219 | 51 / 44 / 1 | 14 / 0 / 124 |
| Triple del portador en transición elegido | 14 | 8 | 7 | 6 | 13 | 1 |
| Creador = poseedor real al organizar | 745 / 1.233 | 632 / 1.276 | 329 / 679 | 455 / 788 | 132 / 312 | 244 / 388 |

**Causas, no cuotas.** (1) El pase al continuador se valoraba como una
finalización sin oposición aunque el pívot de drop estaba a 0,73 m del
short roll y nunca contestaba; ahora cada vía del receptor y del manejador
se valora frente al mejor cierre real (D5 con una sola trayectoria de drop,
D1 que sale de la pantalla, D3 si ayuda), con la misma regla R_contest que
resuelve el tiro. (2) D3 ya no ayuda siempre al continuador: compara lo que
concede ayudando y sin ayudar. (3) El triple de transición se leía en el
medio campo, donde la regla de profundidad nunca se cumplía. (4) Solo un
cierre tardío podía ser falta; ahora cualquier contacto defensivo real se
adjudica con M07 (LAB-0.6), y las faltas ya no dependen de las segundas
oportunidades (70 → 230 PF y ≈100 → 278 FTA en los 11 seed).

Parejas: 91 seed 109–99 (Puerto 19/82) → +3 131–121 (Puerto 49/65); 102
seed 100–143 (Puerto 39/82) → +5 169–116 (Puerto 19/81). Con la misma
semilla y órdenes, ahora sí cambian familia, lectura y tirador (Sierra +5
elige la mano a mano 139/308). **Limitaciones abiertas:** la geometría de
entrada sigue siendo única (4-out/1-in), así que la variedad nace de
personal, reloj y respuestas defensivas, no de estructuras (§4); sin falta
en ataque; OREB aún alto (35–38 % tras fallo vivo en seed).

## Tras el bloqueo lateral, el ICE ejecutable y «a la altura» (sesión v2-3, LAB-0.7)

Mismas 20 semillas y fotos, `npx tsx scripts/me07b-v2-baseline-20.ts` sobre
el commit de LAB-0.7 (ver `ME-07B-PROGRESS.md`). Las huellas cambian porque
la configuración exportada añade `screenPlacement` (`auto`) y la rotación
pasa a `ME-04-ROT-3`. Las 20 terminan `final` con actas conciliadas; ningún
relevo de emergencia en estas 20.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos · posesiones | 1.201 · 1.166 | 1.210 · 1.168 | 888 · 653 | 640 · 650 | 436 · 327 | 322 · 327 |
| 2FGM/2FGA · 3FGM/3FGA | 334/694 · 141/525 | 338/719 · 150/548 | 347/602 · 42/128 | 161/430 · 82/275 | 145/269 · 37/139 | 87/190 · 41/119 |
| Tipos: aro / floater / medio / triple | 583/42/69/525 | 271/344/104/548 | 447/153/2/128 | 154/44/232/275 | 203/65/1/139 | 154/0/36/119 |
| FTM/FTA · PF | 110/147 · 88 | 84/106 · 127 | 68/80 · 67 | 72/95 · 59 | 35/44 · 23 | 25/29 · 35 |
| OREB tras fallo de campo vivo | 212/555 | 201/636 | 108/257 | 125/373 | 99/171 | 37/128 |
| Familias PnR / DHO | 1.089 / 133 | 1.063 / 225 | 657 / 45 | 729 / 25 | 219 / 136 | 350 / 5 |
| Colocación central / lateral | 1.175 / 55 | 1.262 / 32 | 611 / 95 | 743 / 12 | 332 / 26 | 347 / 11 |
| Cobertura como defensa: drop / trampa / under / cambio / show / a la altura / ICE | 878/346/44/5/1/5/9 | 608/315/40/25/61/135/38 | 391/150/123/34/48/3/5 | 328/31/37/62/51/165/28 | 62/128/24/87/4/45/5 | 206/6/19/15/65/35/9 |

**Lectura.** (1) El lateral aparece por proyección, no por cuota: 2–14 %
de las organizaciones según foto; Sierra +3 (más rápido y mejor tirador) lo
elige más (95/706). (2) ICE solo compite ante el lateral y gana cuando
concede menos que drop allí; su concesión habitual es el bloqueador abierto
en el codo (`ice:pase_o5` 31 de 38 lecturas de Sierra en seed). (3) «A la
altura» se elige sobre todo con Puerto defendiendo (135 seed, 165 +3) y
el show deja de ser casi idéntico: frena al manejador cuando llega antes
(semilla 92 forzada: 58/116). (4) Los puntos bajan respecto a v2-2
(1.317–1.307 → 1.201–1.210 en seed); no se ha descompuesto qué parte es
del ICE/lateral y qué parte del efecto mariposa de la secuencia (pendiente;
descompuesto en v2-4 en `ME-07B-v2-descomposicion-puntos-v2-3.md`: dos
prórrogas, aciertos bajo lo esperado y la mezcla defensiva; fuera de muestra
el total sube).

Parejas: 91 seed 92–99 (Puerto 20/72) → +3 142–127 (Puerto 45/65); 102
seed 68–120 (Puerto 92/25) → +5 159–107 (Puerto 91/10). **Limitaciones:**
un solo lado lateral (izquierdo) y el resto del espaciado igual que en la
central; el ataque proyecta la familia y la colocación contra drop (no
anticipa ICE ni las demás coberturas); sin `/lab` recorrido en v2-3.

## Tras la ficha Horns y la proyección frente a la defensa observada (sesión v2-4, LAB-0.8)

Mismas 20 semillas y fotos sobre `d3ca201`. Las 20 terminan `final` con
actas conciliadas; barrido 1–60 × 3 fotos: 180/180 `final`, 0 actas sin
conciliar, 2 relevos de emergencia (seed 14 y +5 semilla 3, Puerto),
ningún `menos_de_cinco`.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos · posesiones | 1.335 · 1.179 | 1.388 · 1.180 | 890 · 638 | 649 · 633 | 445 · 322 | 311 · 322 |
| 2FGM/2FGA · 3FGM/3FGA | 368/738 · 158/508 | 417/815 · 147/434 | 317/544 · 51/180 | 198/460 · 67/220 | 113/183 · 57/204 | 63/150 · 54/158 |
| FTM/FTA · PF | 125/172 · 122 | 113/153 · 141 | 103/128 · 52 | 52/66 · 88 | 48/57 · 23 | 23/29 · 37 |
| OREB tras fallo de campo vivo | 238/541 | 183/562 | 141/259 | 92/306 | 98/166 | 46/140 |
| Familias PnR / DHO | 1.207 / 59 | 1.188 / 71 | 573 / 134 | 708 / 11 | 117 / 212 | 327 / 32 |
| Colocación central / lateral / Horns | 1.218 / 45 / 7 | 1.116 / 64 / 86 | 644 / 46 / 22 | 695 / 19 / 9 | 309 / 21 / 1 | 341 / 18 / 3 |
| Cobertura como defensa: drop / trampa / under / cambio / show / a la altura / ICE | 497/296/161/30/105/129/41 | 793/239/96/43/37/34/24 | 275/109/106/60/157/3/9 | 241/75/22/105/201/40/23 | 139/120/34/3/9/53/1 | 190/38/19/23/1/49/9 |

**Lectura.** (1) Horns entra en `auto` por proyección, sin cuota: 7 y 86
organizaciones en seed, 1–22 en las demás fotos. (2) La proyección del
ataque frente a la defensa observada pesa otras coberturas en 2.291 de
2.323 selecciones de familia de la foto seed, pero solo cambia la familia
frente a la proyección solo contra drop en 5 (4 hacia el bloqueo, 1 hacia la
mano a mano); su efecto principal está en creador, bloqueador y colocación
(`colocacion_bloqueo`). (3) Coste: 11 partidos seed con auditoría 7,0 s →
18,6 s (≈1,7 s por partido): cada candidato de la organización proyecta en
seco cada cobertura vista y una colocación más. (4) Los puntos vuelven a
subir (1.201–1.210 → 1.335–1.388); no se calibra nada con ello (ver
`ME-07B-v2-descomposicion-puntos-v2-3.md` sobre el sorteo en 11 partidos).

## Tras Horns→Spain y Delay (sesión v2-5, LAB-0.9 y LAB-0.10)

Mismas 20 semillas y fotos sobre `a7e341c` (idénticas a `e48e5db`: Delay
solo se juega por orden y no cambia la foto natural; Spain sí, porque en
`auto` compite con Horns→bloqueo). Las 20 terminan `final` con actas
conciliadas; barrido 1–60 × 3 fotos: 180/180 `final`, 0 actas sin
conciliar, 5 relevos de emergencia (seed 14, 29, 47, 58; +5 semilla 3),
ningún `menos_de_cinco`. Entre paréntesis, `dc71e16` (v2-4) recalculado en
esta sesión con el mismo script.

| Métrica | seed Sierra | seed Puerto | +3 Sierra | +3 Puerto | +5 Sierra | +5 Puerto |
|---|---:|---:|---:|---:|---:|---:|
| Puntos · posesiones | 1.338 (1.335) · 1.179 | 1.366 (1.388) · 1.179 | 901 (890) · 644 | 684 (649) · 639 | 419 (445) · 319 | 291 (311) · 319 |
| 2FGM/2FGA · 3FGM/3FGA | 347/712 · 176/510 | 406/802 · 144/456 | 325/562 · 51/158 | 207/464 · 72/216 | 98/160 · 56/230 | 62/162 · 49/150 |
| FTM/FTA · PF | 116/157 · 114 | 122/155 · 132 | 98/118 · 55 | 54/69 · 81 | 55/61 · 20 | 20/27 · 39 |
| OREB tras fallo de campo vivo | 218/532 | 193/595 | 130/248 | 94/301 | 110/174 | 49/150 |
| Familias PnR / DHO | 1.196 / 49 | 1.164 / 108 | 568 / 137 | 701 / 11 | 57 / 264 | 306 / 52 |
| Colocación central / lateral / Horns | 1.182 / 59 / 10 (1.218/45/7) | 1.178 / 65 / 35 (1.116/64/86) | 649 / 40 / 23 | 688 / 21 / 7 | 297 / 26 / 0 | 339 / 18 / 2 |
| Cobertura como defensa: drop / trampa / under / cambio / show / a la altura / ICE | 647/156/160/47/98/130/34 | 696/279/92/42/77/32/27 | 229/123/123/64/158/4/11 | 292/24/20/102/210/33/24 | 186/76/30/3/9/53/1 | 192/83/5/23/0/4/14 |

**Lectura.** (1) En la foto seed (ambos equipos), Horns se elige 44 veces y,
de ellas, la variante Spain 37 (ficha base 7): Spain vale más que la base
frente a una defensa que hace drop. El bloqueador ciego encuentra a quién
bloquear 17 veces y se queda en el codo 20 (cobertura con D5 arriba); la
respuesta al bloqueo ciego es `ayudar` 16 y `cambiar` 1. (2) Con Spain en
`auto` la secuencia natural cambia y con ella el resto de cifras (la
colocación Horns de Puerto baja de 86 a 35 y la trampa de Sierra de 296 a
156: no es efecto directo de Spain sino de otra secuencia); no se calibra
nada con ello. (3) Coste: 11 partidos seed con auditoría 20,3 s → 24,8 s
(≈2,3 s por partido; cada organización con Horns proyecta además Spain
frente a cada cobertura vista). (4) Delay no aparece en ninguna foto: solo se
juega por orden («Colocación: Delay»). Con Delay en la colocación `auto`
(probado y retirado, ver progreso v2-5) la foto natural pasaba a tener Delay
en el 6–40 % de las organizaciones y el coste por partido subía ≈50 %, sin
contrastar todavía sus concesiones (poste, corte) con las del bloqueo.
Las huellas de equipo cambian (seed `ca9919b7` → `dceae4f9`) porque la
configuración exportada añade `chainedVariant` y `backScreenCall`.
