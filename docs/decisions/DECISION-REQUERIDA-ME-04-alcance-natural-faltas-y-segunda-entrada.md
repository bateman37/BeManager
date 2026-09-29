# DECISIÓN REQUERIDA — ME-04: alcance natural de las faltas y de la segunda entrada con el fixture

**Estado:** PENDIENTE (no bloquea ME-04).
**Última actualización:** 2026-09-29.

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

## Qué se observa con el fixture real

Barrido de 60 partidos (semillas 1–20 × drop/drop, trampa/trampa,
drop/trampa con prioridades mezcladas) y de 450 para casos concretos:

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
