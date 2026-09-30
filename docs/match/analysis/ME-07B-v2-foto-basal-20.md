# ME-07B v2 — foto basal recreada de las 20 auditorías

**Estado:** ACTIVE
**Es fuente de verdad para:** las cifras basales por foto, equipo y denominador contra las que se mide cada reparación causal de ME-07B v2.
**Debe leerse cuando:** vayas a cambiar el comportamiento del motor en ME-07B v2 o a comparar una muestra nueva.
**No cubre:** la interpretación completa del diagnóstico (ver `ME-07A-diagnostico-20-auditorias.md`) ni el diseño táctico.
**Documentos relacionados:** `ME-07A-diagnostico-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-09-30 (ME-07B v2, sesión 1).

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
