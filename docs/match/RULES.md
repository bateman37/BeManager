# Reglas FIBA 2026 alcanzables en ME-01

**Estado:** ACTIVE
**Es fuente de verdad para:** qué parte del reglamento FIBA 2026 adjudica realmente el motor en esta entrega.
**Debe leerse cuando:** vayas a añadir o cambiar un estado terminal, una falta o una reanudación.
**No cubre:** el reglamento completo (solo lo alcanzable por el escenario de ME-01); NBA/NCAA no están implementados.
**Documentos relacionados:** `docs/match/reference/BeManager-estudio-baloncesto-v1.md` (capítulo 01 §§1.1, 1.4–1.5; capítulo 02 §§2.2–2.5).
**Última actualización:** 2026-09-28.

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

**Nota sobre `missed_shot_offensive_rebound_continues`:** como ME-01
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
