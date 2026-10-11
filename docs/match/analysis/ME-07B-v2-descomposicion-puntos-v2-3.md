# ME-07B v2 — por qué bajan los puntos de la foto seed en v2-3

**Estado:** ACTIVE
**Es fuente de verdad para:** la descomposición, con hechos y denominadores, de la bajada de puntos de la foto seed (1.317–1.307 → 1.201–1.210) entre la sesión v2-2 y LAB-0.7 (v2-3).
**Debe leerse cuando:** alguien cite esa bajada como efecto del bloqueo lateral, del ICE o de «a la altura», o quiera comparar totales de puntos entre versiones.
**No cubre:** la foto completa por métricas (ver `ME-07B-v2-foto-basal-20.md`) ni calibración alguna: es diagnóstico, no se ajusta nada a un total.
**Documentos relacionados:** `ME-07B-v2-foto-basal-20.md`, `ME-07A-diagnostico-20-auditorias.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md`.
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-4).

## Procedencia

- Antes: `0ac23d0` (v2-2 + ROT-3, mismo comportamiento deportivo que
  `85725d6` en estas 20). Después: `ed1960a` (= `ea4e50b` en conducta; la
  ficha de `f819010` no cambia ni un marcador).
- Script reproducible: `npx tsx scripts/me07b-v2-points-breakdown.ts
  [--photo seed] [--regulation]`, ejecutado en un árbol de trabajo de cada
  commit. Cuenta hechos (`field_goal_attempt`, `free_throws_result`,
  `shot_blocked`, pérdidas) por fase y los cruza con las decisiones
  auditadas de esa fase (`seleccion_cobertura`, `colocacion_bloqueo`,
  primera lectura). «Aciertos esperados» = suma de la probabilidad que la
  regla de tiro **realmente usó** (`resolucion_tiro`, misma LAB-0.1) en
  cada tiro resuelto, incluidos los que acaban en falta; el tapón no está en
  esa probabilidad (se cuenta aparte).
- Comprobación fuera de muestra: semillas 1–60 de la foto seed en ambos
  commits, sin auditoría (mismo `GameInput`).

## 1. Las prórrogas: −65 puntos

En `0ac23d0` las semillas 98 y 99 empatan al final del cuarto 4 (112–112 y
138–138) y juegan una prórroga cada una; en `ed1960a` ninguna de las 11 la
juega. Esas dos prórrogas suman **57 posesiones y 65 puntos** (Sierra 22,
Puerto 43). Tiempo efectivo: 27.000.000 → 26.400.000 ms (−600 s = 2 × 5
min). Sin prórrogas, las posesiones son **iguales** (2.332 → 2.334).

## 2. Tiempo reglamentario: −148 puntos, separados en calidad y sorteo

Solo posesiones que empiezan en los cuartos 1–4 (`--regulation`).

| Equipo atacante | Métrica | `0ac23d0` | `ed1960a` | Δ |
|---|---|---:|---:|---:|
| Sierra | posesiones · puntos | 1.169 · 1.295 | 1.166 · 1.201 | −3 · **−94** |
| Sierra | 2P: tiros resueltos · esperados · FGM | 750 · 362,4 · 339 | 738 · 362,5 · 334 | −12 · +0,1 · −5 |
| Sierra | 3P: tiros resueltos · esperados · FGM | 511 · 162,7 · 166 | 530 · 160,7 · 141 | +19 · −2,0 · **−25** |
| Sierra | 3P con oposición 0 / 0,5 / 1 | 405 / 44 / 62 | 386 / 37 / 107 | −19 / −7 / +45 |
| Sierra | FTM/FTA · tapones sufridos | 119/154 · 92 | 110/147 · 88 | −9 · −4 |
| Puerto | posesiones · puntos | 1.163 · 1.264 | 1.168 · 1.210 | +5 · **−54** |
| Puerto | 2P: tiros resueltos · esperados · FGM | 789 · 371,4 · 372 | 752 · 353,4 · 338 | −37 · **−18,0** · −34 |
| Puerto | 3P: tiros resueltos · esperados · FGM | 540 · 146,2 · 143 | 554 · 149,9 · 150 | +14 · +3,7 · +7 |
| Puerto | FTM/FTA · tapones sufridos | 91/114 · 40 | 84/106 · 47 | −7 · +7 |

Descomposición de los −148 (puntos = 2·FGM2 + 3·FGM3 + FTM):

| Parte | Sierra | Puerto | Total |
|---|---:|---:|---:|
| Calidad/volumen de tiro esperado (Δ 2·esperados2 + 3·esperados3) | −6 | −25 | −31 |
| Libres anotados | −9 | −7 | −16 |
| Diferencia entre aciertos reales y esperados (sorteo + tapones) | −79 | −22 | −101 |
| **Total** | **−94** | **−54** | **−148** |

- **Sierra, triples: casi todo sorteo.** La calidad esperada del triple
  apenas cambia (0,318 → 0,303 por tiro: +45 triples con oposición plena,
  sobre todo ante drop, 36 → 83 de 246 → 222), pero los aciertos pasan de
  +3,3 sobre lo esperado a **−19,7** (141 frente a 160,7; desviación típica
  ≈ 10,6 en 530 tiros: −1,9 σ). Esos −23 triples respecto a la expectativa
  son −69 de los −94 de Sierra.
- **Puerto, dobles: volumen.** Puerto resuelve 37 tiros de dos menos y 14
  triples más. Lo que cambia es la defensa de Sierra que enfrenta en sus
  fases organizadas (cobertura elegida por `seleccion_cobertura`): drop 739
  → 878, por debajo 125 → 44, show 43 → 1, cambio 32 → 5, y aparecen ICE 9 y
  «a la altura» 5. Show y cambio le daban 1,14 y 1,31 puntos por fase
  organizada; drop, 0,79 → 0,77. De los −34 dobles anotados, −18 son
  esperados y −16 son aciertos bajo la probabilidad usada (con +7 tapones
  sufridos).
- **Sierra, nuevas coberturas de Puerto.** Puerto defendiendo usa «a la
  altura» 135 veces (1,14 puntos por fase para Sierra) e ICE 38 (0,42), y
  baja drop 758 → 608 y show 126 → 61. El ICE solo aparece ante el lateral
  (55 fases de Sierra, 0,67 puntos por fase frente a 0,80 en la central).
  Su efecto neto en el esperado de Sierra es pequeño (−6).
- **Libres:** −9 y −7 FTM con 7 y 8 FTA menos; no hay más faltas de balón
  vivo que lleven posesiones a la línea en lugar de al campo.
- **Pérdidas y reloj:** pérdidas 18 → 22 y 16 → 25 (trampa: 10 → 14 y 10 →
  13 pérdidas bajo presión); segundos por posesión 11,71 → 11,87 y 12,08 →
  11,85. No son un término aparte: sus posesiones ya están en las cifras
  de tiro de arriba (menos tiros resueltos).

## 3. Fuera de muestra: los puntos suben

Semillas 1–60 de la foto seed (mismo `GameInput`, sin auditoría):

| Commit | Puntos Sierra · Puerto | Total | Posesiones | Puntos/posesión | Períodos |
|---|---:|---:|---:|---:|---:|
| `0ac23d0` | 6.404 · 7.045 | 13.449 | 12.723 | 1,057 | 240 |
| `ed1960a` | 6.692 · 7.104 | 13.796 | 12.798 | 1,078 | 241 |

## Conclusión

La bajada de 213 puntos de la foto seed **no es un efecto sistemático** del
bloqueo lateral, el ICE ni «a la altura»: −65 son dos prórrogas que dejan de
jugarse, −101 son aciertos por debajo de la probabilidad usada (sobre todo
los triples de Sierra, −1,9 σ) y solo −47 son calidad/volumen esperado y
libres, de los que la mayor parte es la mezcla defensiva de Sierra (menos
show/cambio/under, más drop) que quita dobles a Puerto. En 60 semillas ajenas
a la foto, el total sube +347 (+2,6 %). No se
corrige nada a partir de esto: ningún total de puntos es un objetivo.
