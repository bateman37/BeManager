# Reglas FIBA 2026 alcanzables en el Laboratorio (ME-01 a ME-03)

**Estado:** ACTIVE
**Es fuente de verdad para:** qué parte del reglamento FIBA 2026 adjudica realmente el motor: la posesión individual (ME-01/ME-02) y las fronteras y relojes del tramo enlazado (ME-03).
**Debe leerse cuando:** vayas a añadir o cambiar un estado terminal, una falta o una reanudación.
**No cubre:** el reglamento completo (solo lo alcanzable por el escenario de ME-01); NBA/NCAA no están implementados.
**Documentos relacionados:** `docs/match/reference/BeManager-estudio-baloncesto-v1.md` (capítulo 01 §§1.1, 1.4–1.5; capítulo 02 §§2.2–2.5), `MODEL.md` (continuidad del tramo), Official Basketball Rules 2026 v1.1, arts. 17, 28, 29 y 50.
**Última actualización:** 2026-09-28 (ME-03).

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

## Legalidad del cierre (`evaluateCloseoutLegality`), corregida en ME-02 (C1)

La adjudicación de una falta de tiro se decide **una vez, por hecho de
contacto y posición/legalidad** (estudio §5.6, §9.6), no como una
probabilidad repartida en cada actualización temporal, y **ya no se decide
comparando solo dos marcas de reloj**:

1. Se reconstruye la posición real del defensor en el instante exacto de
   liberación del tiro (`positionAtInstant`, en `possession-core.ts`), a
   partir de su origen, destino y velocidad reales — no de un punto de
   referencia ("llegar a la ayuda") que puede estar lejos del tirador real.
2. Solo si el espacio corporal del defensor y el del tirador se solapan
   (radio LAB-0.2 de 0,35 m por jugador, 0,7 m combinados) puede haber
   contacto u oposición atribuible a ese defensor. Si no se solapan, es
   `no_contest`, con independencia de cuán "tarde" llegue por el reloj.
3. Solo cuando sí hay solape se aplica la regla de frenada existente:
   - Llega con margen suficiente para frenar (`F03`) → contestación legal.
   - Llega en el margen intermedio, sin tiempo de frenar, invadiendo la
     posición de lanzamiento → contacto tardío ilegal → falta ordinaria de
     tiro.

El escenario `closeout_tardio_con_contacto` está construido para que esta
última rama siga siendo alcanzable de verdad (ver `SCENARIOS.md` y
`domain/simulation/me02.test.ts`, prueba (2)). Frenar tarde por sí solo,
sin invadir el espacio corporal del tirador, no es una falta.

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
