# ME-07B v2 — comparador de fichas, Delay en `auto` y por qué domina el bloqueo (sesión v2-6)

**Estado:** ACTIVE (medición fechada; no se reescribe)
**Es fuente de verdad para:** las cifras de la sesión v2-6 sobre la elección de ficha y familia en `auto`: mismas 20 semillas antes/después, diagnóstico numérico del dominio del bloqueo directo y recorrido de posesiones consecutivas en `/lab`.
**Debe leerse cuando:** se discuta la variedad táctica del partido `auto`/`auto` (encargo §2.2 y §7.4) o se cambie el comparador.
**No cubre:** el diseño del comparador (ver `docs/match/ACTIONS.md`) ni el cuadro basal completo (ver `ME-07B-v2-foto-basal-20.md`).
**Documentos relacionados:** `ME-07B-v2-foto-basal-20.md`, `docs/match/TACTICAL-MATRIX.md`, `docs/prompts/implementation/ME-07B-PROGRESS.md` (sesión v2-6).
**Última actualización:** 2026-10-01 (ME-07B v2, sesión v2-6, `54a0979`).

## Respuesta corta

**El monopolio del bloqueo directo persiste como familia y se ha repartido
como ficha.** En las 20 semillas de la foto, la familia elegida es bloqueo en
el **94,0 %** de las organizaciones (4.428/4.710), frente al 86,5 % antes
(3.992/4.613). La colocación central bajó del **93,4 %** (4.333/4.639) al
**40,5 %** (1.920/4.737): ahora se reparten central, lateral (33,5 %) y
Horns (25,3 %), con Spain dentro de Horns. **Delay compite en `auto`** y se
elige 33 veces (0,7 %), todas en un partido (Sierra +3, semilla 86, Puerto).
No hay cuotas ni turnos: cada elección es la de mayor valor proyectado.

## Qué cambió (commits)

1. `47f2eea` — la **ficha (colocación) se elige por su valor proyectado**. Antes,
   la banda de empate de LAB-0.3 (0,15 puntos, pensada para la primera lectura
   de un jugador) se aplicaba también entre fichas y desempataba por el
   instante en que los cinco quedan situados: en `478ad56` la ficha ganadora
   valía menos que otra en **3.801 de 4.639** organizaciones (81,9 %), 3.556 de
   ellas a favor de la central (situada antes y primera de la lista). Ahora la
   banda solo desempata asignaciones de creador/bloqueador dentro de una
   ficha, por la **primera lectura real** (`firstReadSeconds`). Delay
   (`offeredInAuto`) compite, valorado frente a lo que la defensa ha hecho
   **ante la entrega** (`defenseByHandoffResponse`), no ante pantallas.
2. `54a0979` — la banda **no cruza de plan** dentro de la central: una
   asignación proyecta la mano a mano y otra el bloqueo; desempatar entre
   ellas por la primera lectura (la entrega lee después) elegía el bloqueo
   aunque la mano a mano valiese más.

Los dos arreglos son de la regla de comparación, sin coeficientes nuevos.

## Mismas 20 semillas, antes (`478ad56`) y después (`54a0979`)

`scripts/me07b-v2-baseline-20.ts`; 20/20 `final`, actas conciliadas en ambos.

| Foto · equipo | Familia bloqueo / mano a mano | Colocación central / lateral / Horns / Delay | Puntos · posesiones |
|---|---|---|---|
| seed · Sierra | 1.196/49 → 1.155/106 | 1.182/59/10/— → 589/351/327/0 | 1.338 · 1.179 → 1.302 · 1.174 |
| seed · Puerto | 1.164/108 → 1.274/7 | 1.178/65/35/— → 324/524/443/0 | 1.366 · 1.179 → 1.229 · 1.175 |
| +3 · Sierra | 568/137 → 615/112 | 649/40/23/— → 278/278/173/0 | 901 · 644 → 895 · 667 |
| +3 · Puerto | 701/11 → 697/40 | 688/21/7/— → 373/277/60/33 | 684 · 639 → 658 · 667 |
| +5 · Sierra | 57/264 → 342/15 | 297/26/0/— → 160/25/173/0 | 419 · 319 → 444 · 330 |
| +5 · Puerto | 306/52 → 345/2 | 339/18/2/— → 196/132/21/0 | 291 · 319 → 331 · 330 |

«Mano a mano» incluye Delay (su familia es la mano a mano). La cobertura
como defensa también se reparte más (foto seed, drop 1.343 → 944 de unas
2.550). Coste con auditoría: seed 25,5 s → 29,9 s (11 partidos), +3 13,8 →
14,3 s, +5 5,8 → 7,1 s. **Sierra +5 pierde casi toda su mano a mano
(264 → 15)**: antes la central ganaba casi siempre (por la banda) y la mano a
mano solo existe en la central; ahora Horns gana 173 veces por valor.

## Por qué domina el bloqueo: dos etapas, con números

`scripts/me07b-v2-placement-gap.ts` (comparación emparejada: las cuatro
fichas se proyectan con el mismo quinteto, instante, reloj y observaciones).

### Etapa 1 — colocación: Delay proyecta menos que la mejor de las otras tres

| Foto · equipo | n | Delay − mejor otra (mediana) | Misma respuesta base (hundirse − drop) | Mezcla de coberturas vistas a favor de las otras | Delay por encima |
|---|---:|---:|---:|---:|---:|
| seed · Sierra | 1.267 | −0,110 | −0,053 | +0,063 | 0 |
| seed · Puerto | 1.291 | −0,116 | −0,077 | +0,043 | 0 |
| +3 · Sierra | 729 | −0,139 | −0,131 | +0,014 | 0 |
| +3 · Puerto | 743 | −0,076 | −0,094 | −0,018 | 33 |
| +5 · Sierra | 358 | −0,197 | −0,157 | +0,040 | 0 |
| +5 · Puerto | 349 | −0,112 | −0,115 | −0,003 | 0 |

Lectura: **ante la misma respuesta base** (drop para el bloqueo, hundirse
para Delay) Delay ya vale 0,05–0,16 menos; la mezcla de coberturas que el
rival muestra (cambio, show, por debajo conceden más al bloqueo proyectado)
suma hasta +0,06 al bloqueo en la foto seed. Delay llega a su primera
lectura 0,7–1,1 s después (pase de entrada y entrega) y el reloj que
consume ya está en su valor. Su mejor vía ante hundirse es el aro del
manejador (`finalizar`) o la entrada al poste; el triple, pocas veces.

### Etapa 2 — familia en la central: lo observado empuja al bloqueo

En la central la familia se vuelve a elegir con las posiciones reales y
mezclando la proyección con los puntos vistos en el partido
(`blendProjectionWithObservation`, LAB-0.4, mismo `K` para las dos).

| Foto · equipo | n central | Proyección sola prefiere mano a mano | Elegida mano a mano | Desplazamiento medio por lo observado (bloqueo / mano a mano) |
|---|---:|---:|---:|---|
| seed · Sierra | 587 | 343 | 106 | +0,135 / −0,083 |
| seed · Puerto | 321 | 156 | 7 | +0,140 / −0,035 |
| +3 · Sierra | 278 | 176 | 112 | +0,097 / −0,004 |
| +5 · Sierra | 160 | 92 | 15 | +0,114 / −0,081 |

Es aprendizaje legítimo, no un sesgo de unidades: las dos familias se miden
igual (puntos del atacante desde la decisión hasta el fin de la posesión o la
siguiente organización). `scripts/me07b-v2-projection-calibration.ts` lo
confirma: en la foto seed la mano a mano central rinde **0,67** puntos por
uso frente a **0,96** proyectados (0,70), y el bloqueo central 1,09 frente a
0,97 (1,13). Delay (n=33) rinde 0,61 frente a 0,77. **Explicación física
reproducible**: con este fixture, la mano a mano y Delay crean menos de lo
que su primera lectura promete, y el bloqueo más; el motor elige lo que rinde.

### Lo que queda sin aprender (y por qué Delay hace racha)

La colocación no mezcla los resultados propios de cada ficha (solo pondera
coberturas vistas). En la semilla 86 (+3) Puerto elige Delay en 16 posesiones
seguidas (117–147) con 0,760 frente a 0,744 de Horns, ante una defensa que
siempre se hunde (igual que la previa: los pesos no cambian), y anota poco;
nada le hace corregir. Ver «Decisión requerida».

## `/lab` real: posesiones consecutivas (no escogidas)

PostgreSQL 16 + Chromium (Playwright), restaurar ambos equipos desde el seed,
todo `auto`, auditoría ON, exportación `.json.gz` descargada y leída con
`scripts/me07b-v2-possession-slice.ts`. Semilla 92 → **130–128** (mismo
marcador que el dominio), `stop=final`, actas conciliadas. Tramo fijado de
antemano, **posesiones 101–120** (el mismo que se miró antes del segundo
arreglo):

| # | Equipo | Colocación (valor; 2.ª; Delay) | Defensa (motivo) | Lectura del manejador | Puntos |
|---|---|---|---|---|---:|
| 101 | SC | central 1,011; lateral 1,004; 0,871 | cambio (menor concesión) | atacar el cambio | 0 |
| 102 | PA | lateral 0,966; central 0,946; 0,794 | show | pase al roll → invertir | 3 |
| 103 | SC | central 1,013; lateral 1,004; 0,871 | cambio | atacar el cambio | 0 |
| 104 | PA | central 0,966; lateral 0,964; 0,798 | drop | pase al roll → floater | 2 |
| 105 | SC | central 1,009; lateral 0,993; 0,871 | cambio | atacar el cambio | 2 |
| 106 | PA | central 0,988; Horns 0,987; 0,835 | show | pase al roll → invertir | 0 |
| 107 | SC | central 0,977 (fin de C2 antes de la entrada) | — | — | 0 |
| 108 | PA | Horns 0,991; central 0,983; 0,835 | show | finalizar | 0 |
| 109 | SC | lateral 1,006; central 1,006 | cambio | atacar el cambio | 2 |
| 110 | PA | lateral 0,965; central 0,961 | show | pase al roll → aro | 2 |
| 111 | SC | Horns 0,999; central 0,997 | cambio | pase al roll → aro | 1 |
| 112 | PA | lateral 0,967; central 0,963 | show | pase al roll → aro | 2 |
| 113 | SC | Horns 1,000; central 0,999 | cambio | pase al roll → aro | 2 |
| 114 | PA | lateral 0,962; central 0,958 | show | pase al roll → aro | 0 |
| 115 | SC | Horns 1,002; central 1,000 | cambio | pase al roll | 0 |
| 116 | PA | lateral 0,970; central 0,966 | show | pase al roll → aro | 2 |
| 117 | SC | Horns 1,003; central 1,002 | cambio | pase al roll → aro | 0 |
| 118 | PA | lateral 0,972; central 0,968 | por debajo | triple del manejador | 1 |
| 119 | SC | Horns 1,005; central 1,003 | cambio | pase al roll → aro | 2 |
| 120 | PA | lateral 0,965; central 0,961 | show | pase al roll | 0 |

Variedad real de colocación, cobertura y lectura (cambio/show/drop/por
debajo; atacar el cambio, pase al roll, finalizar, triple), todas con su
valor auditado; la familia es bloqueo en las 19 que llegan a organizarse.
Partido entero: Sierra central 71 / lateral 17 / Horns 26 (Spain 3), una mano
a mano; Puerto central 28 / lateral 66 / Horns 20 (Spain 12). Delay vale
0,13–0,20 menos en todas.

Segundo recorrido, Sierra **+3** en `/lab` y semilla 86 → **183–85** (igual
que el dominio): Puerto elige Delay 33 veces; tramo 109–128 (desde dos antes
de la primera): Delay en las 8 posesiones de Puerto desde la 111 menos la 115
(lateral 0,838 con otro quinteto), siempre ante «hundirse» y con la lectura
`entrada_poste_o4`. Los perfiles se restauraron al seed al terminar.

## Hallazgo lateral (pendiente, no corregido)

Un pase desviado al soltarse lo recupera el pasador «en 0,00 s» y la fase se
reorganiza igual; en la semilla 92 (posesión 104 del recorrido sobre
`47f2eea`) se repitió tres veces seguidas. En la foto seed: 327 de 339
recuperaciones son a 0,00 s (373/382 en `478ad56`: preexistente); repeticiones
idénticas seguidas 4 (`478ad56`) → 16 (`47f2eea`) → 6 (`54a0979`).

## Decisión requerida

Si la **colocación** (ficha) debe aprender de sus propios resultados como ya
lo hace la familia (misma regla LAB-0.4 por ficha). Sin ello, Delay puede
hacer rachas que no rinden; con ello, también la central/lateral/Horns
cambiarían por aprendizaje y el reparto actual se movería. No se implementa
sin decisión de Dennis.

## Reproducir

```bash
npx tsx scripts/me07b-v2-baseline-20.ts
npx tsx scripts/me07b-v2-placement-gap.ts
npx tsx scripts/me07b-v2-projection-calibration.ts
npx tsx scripts/me07b-v2-possession-slice.ts <exportación.json.gz> 101 120
```
