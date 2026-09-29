# DECISIÓN REQUERIDA — ME-04: alcance natural de las faltas y de la segunda entrada con el fixture

**Estado:** PENDIENTE en lo que respecta a faltas sin tiro y segunda entrada;
la ventaja temprana queda resuelta en parte (no bloquea ME-04, ME-04A ni
ME-04B).
**Última actualización:** 2026-09-29 (ME-04B: opción C aplicada parcialmente
—desplazamiento real de O1/D1 y primera lectura ponderada por valor, ver
`docs/match/ACTIONS.md`—; la ventaja temprana deja de ser exactamente 0 con
el fixture natural, pero las faltas sin tiro y la segunda entrada siguen sin
producirse de forma natural; ver `docs/match/SCENARIOS.md` y
`docs/match/AUDIT.md`).

## Qué resuelve ME-04B y qué no

ME-04B corrige dos errores técnicos que sesgaban la observación anterior: O1
y D1 permanecían congelados en su posición de partida durante toda la
posesión (afectando distancias de pase y geometría de contacto en cascada),
y la primera lectura del bloqueo se cortaba en la primera vía viable en vez
de comparar varias por valor. Corregidos ambos, con una muestra pequeña de
ocho semillas naturales (drop/drop, «Proteger balance», fixture del
repositorio):

- **Ventaja temprana:** ya no es 0. Aparece `penetracion` entre 6 y 15 veces
  por partido (de ~190–200 lecturas de transición). No se ha investigado a
  fondo el mecanismo causal exacto (la corrección no tocó
  `domain/sequence/transition.ts`); es plausible que el desplazamiento real
  de O1/D1 altere las posiciones que hereda la posesión siguiente, incluida
  la de D1 como protector potencial en transición. Sigue sin verse
  `superioridad_2x1`/`3x2` con este fixture.
- **Faltas sin tiro y segunda entrada:** siguen sin producirse en partidos
  naturales con este fixture. La corrección de ME-04B no tocó la disposición
  aprobada (posición del pívot, momento de reparación de D4) que la opción C
  original habría implicado revisar; solo corrigió errores técnicos ya
  identificados como tales (posición congelada, cortocircuito de la primera
  lectura), sin inventar una regla deportiva nueva. Ambos mecanismos siguen
  demostrados como alcanzables de verdad con geometría construida a mano en
  `domain/game/me04b.test.ts`.

La pregunta original (§ "Decisión que falta") sigue en pie para faltas sin
tiro y segunda entrada: si este reparto natural es aceptable para el
laboratorio o si hace falta revisar la disposición aprobada (opción C
original) o añadir otras vías de contacto (opción B). No se ha tomado esa
decisión en ME-04B porque excedía el alcance corrector de esta entrega
(cambiar la disposición aprobada habría alterado las huellas de ME-01/02/03
sin una regla deportiva nueva que lo justifique).

## Contexto exacto

ME-04 implementa, con adjudicación geométrica y sin cuotas, la vía
ordinaria de falta sin tiro (el defensor que ayuda cierra el paso del
continuador **mientras este aún rueda** y sin haber llegado y frenado,
FIBA art. 33.5) y la segunda entrada del bloqueo (cuando la primera lectura
queda negada: continuador contenido y esquina cerrada, pase real a un
exterior con línea libre, ubicaciones y reloj viables). Ambos mecanismos se
demuestran en `domain/game/me04.test.ts` con perfiles o geometría
construidos a mano, y el bonus, la quinta personal y la prórroga, con los
casos de frontera de `/lab`.

## Qué se observaba antes de ME-04B (evidencia histórica del motor anterior)

Barrido de 60 partidos (semillas 1–20 × drop/drop, trampa/trampa,
drop/trampa con prioridades mezcladas) y de 450 para casos concretos, **con
el motor anterior a ME-04B** (O1/D1 congelados, primera lectura
cortocircuitada en `pase_o5`): las cifras exactas de puntos y TC ya no
aplican al motor corregido, pero los ceros de falta sin tiro/segunda entrada
siguen vigentes (ver sección anterior).

- **Faltas:** ~1 falta personal por partido, todas de tiro (63 en 60
  partidos); **0 faltas sin tiro**: la ayuda de D3 llega siempre 0,53–0,78 s
  **después** de que el continuador se ha detenido, así que la contención es
  legal. En consecuencia no aparece el bonus ni la quinta personal en
  partidos naturales.
- **Segunda entrada: 0.** El árbol de ME-01/ME-02 deja siempre abierta la
  continuación o la inversión a la esquina (D4 solo repara después de que
  llegue D3); y en `drop` el pívot de la disposición aprobada está a 0,73 m
  del short roll, así que cualquier pase de salida del continuador contenido
  estaría a su alcance.
- **Ventaja temprana: 0** (igual que en ME-03, sin cambios).
- Consecuencia visible: el continuador acapara los tiros (p. ej. 31/51 TC
  en la semilla publicada) y los marcadores son altos (~280 puntos).

No se ha ajustado ningún coeficiente, posición ni perfil del fixture para
cambiar estas frecuencias.

## Decisión que falta

Si este comportamiento es aceptable para el laboratorio de ME-04 o si deben
representarse más situaciones de contacto y de negación de la primera
lectura. Es una decisión de juego (qué acciones y contactos existen), no
técnica.

## Opciones viables

- **A. Aceptar para ME-04** y revisar el reparto de faltas y lecturas cuando
  ME-05/ME-06 añadan fatiga y una segunda familia ofensiva. Consecuencia:
  el bonus y la exclusión solo se ven en los casos de frontera. (Recomendada.)
- **B. Añadir otras vías de contacto ya alcanzables** (p. ej. el cierre
  sobre el receptor antes del gesto, la trampa sobre el manejador en
  movimiento, el contacto del perseguidor en la pantalla), cada una con su
  regla de legalidad aprobada. Consecuencia: prompt nuevo con sus fronteras.
- **C. Revisar la disposición aprobada** (posición del pívot en drop,
  momento de la reparación de D4) para que la negación de la primera
  lectura sea alcanzable. Consecuencia: cambia LAB-0.2/escenario y las
  huellas de ME-01/02/03.

## Qué queda bloqueado

Nada de ME-04. Solo la afirmación de que un partido natural del
laboratorio muestra bonus, exclusiones o segundas entradas.
