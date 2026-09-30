# Reglas FIBA 2026 alcanzables en el Laboratorio (ME-01 a ME-04)

**Estado:** ACTIVE
**Es fuente de verdad para:** qué parte del reglamento FIBA 2026 adjudica realmente el motor: la posesión individual (ME-01/ME-02), las fronteras y relojes del tramo enlazado (ME-03) y el partido completo (ME-04).
**Debe leerse cuando:** vayas a añadir o cambiar un estado terminal, una falta o una reanudación.
**No cubre:** el reglamento completo (solo lo alcanzable por el escenario de ME-01); NBA/NCAA no están implementados.
**Documentos relacionados:** `docs/match/reference/BeManager-estudio-baloncesto-v1.md` (capítulo 01 §§1.1, 1.4–1.5; capítulo 02 §§2.2–2.5), `MODEL.md` (continuidad del tramo), Official Basketball Rules 2026 v1.1, arts. 4, 8–12, 17, 19, 28, 29, 33–34, 41, 42, 44 y 50–51.
**Última actualización:** 2026-09-29 (ME-06, adelantada antes de ME-05).

## Perfil de reglas

`rulesetVersion: "FIBA-2026"`, identificado por edición (entra en vigor el
1-10-2026 según FIBA). El perfil se completa según los desenlaces
alcanzables en cada entrega; ME-01 no simula ni reanudaciones especiales ni
sanciones que no pueda adjudicar.

## Estados terminales legales de una posesión de laboratorio

| `TerminalOutcome.kind` | Significado |
|---|---|
| `made_basket` | Canasta válida (2 o 3 puntos) |
| `missed_shot_defensive_rebound` | Fallo con rebote defensivo |
| `missed_shot_offensive_rebound_continues` | Fallo con rebote ofensivo; la misma posesión estadística continúa (ver nota) |
| `live_turnover` | Pérdida con balón vivo |
| `steal_by_defense` | Robo/desvío que da el control a la defensa |
| `blocked_shot_live_ball` | Tapón legal con balón vivo |
| `shooting_foul` | Falta ordinaria de tiro, con libres y continuación adjudicados |
| `out_of_bounds` | Balón fuera con último toque identificado |
| `shot_clock_violation` | Fin por reloj de lanzamiento |
| `possession_reorganized_control_kept` | Salida segura; control conservado, se reorganiza |
| `simulation_guard_stopped` | Guardián de progreso: evita un bucle inválido y exporta el motivo |

No se activan sanciones fuera de este ámbito (prompt §2): solo contacto
defensivo ordinario sancionable en acto de tiro.

**Nota sobre `missed_shot_offensive_rebound_continues`:** en el tramo de
ME-03 (modo enlazado del núcleo) sí es el desenlace de un tramo de cálculo:
el tramo abre entonces una fase nueva de la misma posesión (ver abajo). En
la posesión individual, como ME-01
continúa la misma posesión estadística con otro intento en vez de
detenerse ahí (ver `ACTIONS.md`), este `kind` nunca es el terminal final
que produce `runPossession` — el terminal final es el que decida el
siguiente intento. El rebote ofensivo queda igualmente auditable en el
relato: cada vez que un atacante recupera el control tras un fallo se
registra un hecho `rebound_secured` o `rebound_contested` con ese actor
(HF-002 §1.4), y el resolvedor rápido cuenta cada uno de esos hechos, no
solo el terminal de la corrida completa.

## Libres por falta de tiro

- Canasta válida con falta → 1 libre adicional.
- Tiro de dos fallado con falta → 2 libres.
- Triple fallado con falta → 3 libres.
- HF-002 ejecuta de verdad cada libre (`freeThrowProbability(T05)`, con la
  semilla de la posesión): el terminal `shooting_foul` incluye
  `freeThrowsMade`, `pointsFromFreeThrows` y `totalPoints` además del
  conteo concedido. El último libre fallado queda vivo y se resuelve como
  cualquier rebote disputado (misma disputa que un tiro de campo, incluida
  la continuación ofensiva si corresponde): en ese caso el terminal final
  de la posesión ya no es `shooting_foul`, sino el que decida esa disputa
  (`missed_shot_defensive_rebound`, una continuación ofensiva, etc.); el
  hecho `shooting_foul` en el relato deja constancia de que hubo falta.

## Legalidad del cierre (`evaluateCloseoutLegality`) y oposición real (C1, ME-02; R_contest, ME-04B §3.3)

Dos preguntas separadas, cada una con su propio modelo geométrico:

**¿Hubo contacto sancionable?** Se decide **una vez, por hecho de contacto y
posición/legalidad** (estudio §5.6, §9.6), no como una probabilidad
repartida en cada actualización temporal, y **no comparando solo dos marcas
de reloj**:

1. Se reconstruye la posición real del defensor en el instante exacto de
   liberación del tiro (`positionAtInstant`, en `possession-core.ts`), a
   partir de su origen, destino y velocidad reales — no de un punto de
   referencia ("llegar a la ayuda") que puede estar lejos del tirador real.
2. Solo si el espacio corporal del defensor y el del tirador se solapan
   (radio LAB-0.2 de 0,35 m por jugador, 0,7 m combinados) puede haber
   contacto atribuible a ese defensor. Si no se solapan, no hay contacto,
   con independencia de cuán "tarde" llegue por el reloj.
3. Solo cuando sí hay solape se aplica la regla de frenada existente:
   - Llega con margen suficiente para frenar (`F03`) → contacto legal.
   - Llega en el margen intermedio, sin tiempo de frenar, invadiendo la
     posición de lanzamiento → contacto tardío ilegal → falta ordinaria de
     tiro.

El escenario `closeout_tardio_con_contacto` está construido para que esta
última rama siga siendo alcanzable de verdad (recalibrado en ME-04B tras
corregir el desplazamiento real de O1, ver `SCENARIOS.md` y
`domain/simulation/me02.test.ts`, prueba (2)). Frenar tarde por sí solo, sin
invadir el espacio corporal del tirador, no es una falta.

**¿Puede un defensor oponerse al tiro sin tocar al tirador?** Es una
pregunta distinta, con un alcance mayor que el radio de contacto: el modelo
geométrico `R_contest` (LAB-0.3, `domain/lab/lab-0-3-parameters.ts`) —
`0,35 m + C03 (envergadura, cm) / 200` — desde la posición real del defensor
al liberar el tiro:

- No alcanza el punto de liberación dentro de `R_contest` antes de soltar →
  oposición 0 (`no_contest` a efectos de probabilidad de acierto), aunque
  haya solape corporal posterior.
- Alcanza esa ventana durante el gesto de tiro (entre el inicio del gesto y
  la liberación) sin estar aún colocado → oposición 0,5.
- Ya estaba dentro de `R_contest` y colocado (llegada + frenada F03) al
  **empezar el gesto de tiro** → oposición 1.

Nunca se suman varios defensores ni T22 y T23 en una sola intervención. Un
cierre dentro del alcance de brazos pero fuera del radio corporal de
contacto puede contestar (oposición 0,5 o 1) sin que exista ninguna falta:
son preguntas independientes, decididas con la misma foto de posiciones
pero comparadas contra dos radios distintos. El Tapón T18 es elegible con
cualquier oposición geométrica real (0,5 o 1), sin contacto ilegal ya
sancionado, y solo si `maxTouchHeightMeters` alcanza
`shotReleaseHeightMeters`; C01/C04 no reciben un segundo premio.

**ME-06:** la mano a mano sin balón reutiliza este mismo modelo de
contacto/contestación sin excepción (el tiro de O2/O3/O4 se resuelve con
el mismo `resolveShotAttempt`); no introduce una regla de falta ni de
oposición nueva. La entrega/hand-off y el bloqueo/corte del lado débil
usan la misma comprobación de contención geométrica (solape de radios
corporales sobre la posición reconstruida en el instante real) para
decidir si se niegan, no una regla de contacto distinta.

## Estadística oficial FIBA: FGA/FGM/FTA/FTM/puntos (C3, ME-02)

Un tiro preparado (`shot_prepared`) es la oportunidad de tiro que se lee
para analizar decisiones; **no** es por sí mismo un tiro de campo oficial.
El hecho `field_goal_attempt` marca cuándo un intento cuenta de verdad
como FGA/FGM, según el Manual de Estadísticos FIBA:

- Falta de tiro con intento **fallado** → **no** FGA (ni FGM).
- Canasta válida con falta (and-one) → **1 FGA y 1 FGM**, más el libre
  adicional.
- Tapón legal sin falta → FGA (aunque no haya canasta).
- Tiro de campo limpio (sin falta) → FGA, y FGM si entra.

Los libres (`FTA`/`FTM`) se cuentan por cada libre realmente ejecutado
(`free_throws_result`). Los puntos de la muestra son
`2×2FGM + 3×3FGM + FTM` en el ámbito implementado (una posesión de
laboratorio, no un partido completo).

## Tramo enlazado (ME-03): fronteras que se adjudican

Funciones puras con fronteras exactas en `domain/sequence/fiba-clock-rules.ts`;
la orquestación en `domain/sequence/play-tramo.ts`.

| Hecho real | Continuación |
|---|---|
| Fallo que toca aro (todos los fallos del núcleo lo tocan), o último libre fallado, con rebote ofensivo | Misma posesión, **fase nueva**, 14 s desde el control (art. 29) |
| Mismo fallo con rebote defensivo | **Posesión nueva** del rival, 24 s desde el control |
| Robo (control del rival en balón vivo) | Posesión nueva, 24 s, salida desde el punto del robo |
| Tapón o desvío con balón suelto | Nadie controla; lo recupera quien llega antes (misma disputa T20 del rebote). Si es el mismo equipo, fase nueva **sin reiniciar** el reloj de lanzamiento; si es el rival, posesión nueva de 24 s **sin anotar robo** |
| Canasta o último libre anotado | Puntos al que anota; saque del otro equipo desde detrás de su línea de fondo, sacador y receptor reales |
| Rebote que cae fuera | Último toque: el tirador; saque del rival en el punto más cercano (nunca detrás del tablero), 24/14 s según pista del saque |
| Violación de 24 s | Balón muerto al agotarse (nunca tiempo negativo); saque del rival, reloj según pista del saque |
| Salida segura | Misma posesión, fase nueva, consume tiempo real y conserva el reloj |

**Relojes.** El reloj de partido corre con el balón vivo; en el primer
cuarto una canasta no lo detiene. Se detiene con la falta de tiro (y sigue
parado en los libres), con el balón fuera y con las violaciones; vuelve a
correr cuando un jugador toca el último libre fallado o con el toque legal
en la cancha tras un saque (art. 50). El reloj de lanzamiento no corre
durante el saque: arranca con ese toque. Un tiro se libera a tiempo si
sale **antes** de agotarse el reloj; el vuelo no lo invalida.

**Cuentas de 8 y 5 s.** Con control en pista trasera, el balón debe pasar
a la delantera antes de 8 s (art. 28); un nuevo saque del mismo equipo en
su pista trasera conservaría lo consumido. El sacador suelta antes de 5 s
desde que tiene el balón a su disposición (art. 17). Las tres cuentas se
agotan en el milisegundo N·1000 exacto (pruebas de frontera en
`domain/sequence/me03.test.ts`).

**Alcanzable y no alcanzable.** Con el fixture, las violaciones de 8 s y
5 s, la violación de 24 s y el saque del mismo equipo que conserva reloj
y cuenta de 8 no aparecen en la práctica (el balón llega siempre a tiempo y
ningún defensor saca el balón fuera): están adjudicadas por las funciones
puras y probadas en frontera, pero no se presentan como jugadas simuladas.

**Simplificaciones declaradas.** El sacador tras canasta recoge el balón
al llegar a la línea de fondo; el saque tras violación se hace desde la
banda más próxima; no hay presión sobre saques ni sobre el pase de
reorganización; la alineación de los pasillos de libres no se modela.

**Fuera de ME-03.** Faltas acumuladas y bonus, final de cuarto y prórroga,
sustituciones, salto entre dos, campo atrás y otras infracciones. Si el
reloj de partido llega a 0:00, el tramo **se detiene** (causa «tiempo
reglamentario agotado») sin adjudicar la bocina; si un estado generado no
tiene reanudación adjudicable, lo detiene el guardián con su diagnóstico.

## Partido completo (ME-04)

Funciones puras en `domain/game/fiba-2026-rules.ts` (perfil `FIBA_2026`),
llamadas por el partido y por los casos de frontera de `/lab`.

| Frontera | Adjudicación |
|---|---|
| Salto inicial (`ME-04-JUMP-1`) | Interiores titulares; alcance = `C04 + 2 × (F06 − 8)` + variación sembrada uniforme ±5 cm (C01 no se suma); empate exacto, sorteo sembrado. Aproximación de laboratorio: el vencedor toca hacia su **base** (rol 1), que obtiene el primer control; el vuelo del toque usa la velocidad de pase LAB-0.1. El reloj arranca con el toque; el de lanzamiento, con el control |
| Flecha | Al equipo sin el primer control; saque de C2–C4 y prórrogas desde la prolongación de la línea central; se invierte cuando ese saque termina (legalmente o por violación, art. 12.5). Los diez se colocan durante el descanso: ese saque abre un ataque organizado, sin lectura de transición |
| Duración y sentido | 4 × 10:00; prórrogas de 5:00 hasta desempatar; cambio de canastas en C3, las prórrogas conservan C4. Los descansos no son tiempo disputado |
| Bocina | Un tiro soltado antes de la señal termina de resolverse (FGA, puntos, tapón o falta con sus libres); soltado en la señal o después no existe. Tras la bocina no empieza ninguna acción ni hay rebote |
| Reloj tras canasta | Solo se detiene desde 2:00 o menos en C4 y cada prórroga, hasta el toque del saque |
| Faltas | Cada falta personal suma una al autor y una al equipo en el período; C1/C2/C3 separados, las prórrogas en C4. Falta de tiro: 1/2/3 libres con o sin bonus. Falta sin tiro: dos libres si el equipo ya tenía cuatro en el período; si no, saque del equipo objeto de la falta desde la línea más cercana (nunca detrás del tablero) con 24 s en pista trasera o, en delantera, conserva ≥14 s y pasa a 14 s con 13 s o menos (≥ 14 000 ms = «14 s o más») |
| Exclusión | Quinta personal: sale en la misma parada, antes de reanudar, y no vuelve |
| Libres | Tirador real y T05; en ME-04 se ejecutan después de abrir la sustitución. Último fallado vivo → rebote; último anotado → saque rival |

**Vía sin tiro alcanzable:** el defensor que ayuda (D3 en drop con ayuda o
low man en trampa) cierra el paso del continuador. Hay contacto si los
espacios corporales (0,35 m por jugador) se solapan; es **falta** solo si el
continuador aún se desplaza y el defensor no había llegado **y frenado**
(llegada + frenada F03) antes del contacto, y todo ocurre antes de cualquier
gesto de tiro (art. 33.5: el tiempo y la distancia protegen a un oponente en
movimiento). Si el continuador ya estaba parado, la contención es legal. El
hecho lleva actor, receptor, posiciones, instante, distancia, llegada,
frenada y legalidad. Sin cuotas: con el fixture natural sigue sin producirse
ninguna tras ME-04B (ver
`DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`,
actualizada); el mecanismo en sí es alcanzable de verdad con geometría
construida a mano (`domain/game/me04b.test.ts`).

**Sustituciones (art. 19, política `ME-04-ROT-2`).** Oportunidades: falta
(ambos equipos; se conserva al tirador de los libres), último libre
anotado, balón fuera y violaciones (ambos), inicio de período (ambos) y,
desde 2:00 en C4/prórroga, canasta **solo para el equipo que la recibe**;
nunca con el balón vivo ni con el reloj en marcha. Política fija: primero
las exclusiones (sin consumir cupo); después, como máximo dos voluntarias
por equipo y parada (cinco entre períodos) entre quienes llevan 5:00 de
reloj continuo desde su entrada, mayor tiempo primero y desempate por ID;
entra el suplente elegible con ese rol declarado y menos minutos, desempate
por ID; sin compatible, sigue el mismo. Quien entra o sale no invierte el
cambio hasta que corre el reloj. Si ningún suplente declara el rol de un
excluido, un compañero en pista que sí lo declara pasa a ese rol y entra el
suplente elegible del rol que deja (menos minutos; `ME-04-ROT-2`, ME-07B
v2); nadie juega fuera de un rol declarado. Si tampoco hay ese reajuste,
el guardián lo explica y no hay ganador. Interpretación documentada: el
umbral de 5:00 es condición para ser candidato voluntario (no se sustituye
a nadie que no lo alcance).

**No representado (y no fingido):** faltas técnicas, antideportivas o
descalificantes, faltas durante el saque en los dos últimos minutos, falta
ofensiva de equipo con control, libres con infracción, lucha por el balón,
tiempos muertos, tres segundos, pasos y campo atrás. El caso «tirador
excluido por la misma falta» no es alcanzable: solo se sancionan faltas
defensivas.
