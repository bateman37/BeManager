# DECISIÓN REQUERIDA — ME-03: cuándo existe una ventana de ventaja temprana

**Estado:** DRAFT (pendiente de Dennis)
**Última actualización:** 2026-09-28.

## DECISIÓN REQUERIDA

### Contexto exacto

El prompt de ME-03 (§4) pide que, tras rebote defensivo, robo o
recuperación viva, se habilite una ventaja temprana «si existe ventana
antes de que lleguen los responsables defensivos», resuelta con
pase/recepción, penetración o tiro ya representables, y que el
compromiso de carga «tenga coste observable en retorno y pueda abrir una
ventaja al rival». También fija el destino del balance: la línea central
en el mismo carril (`x = 14`).

La implementación (ver `docs/match/ACTIONS.md`, sección del tramo) usa
solo llegadas reales al aro atacado:

1. penetración si el portador llega antes que el primer defensor;
2. pase adelantado si un compañero llega antes que el primer defensor y la
   línea de pase está libre;
3. 2×1 si el primer defensor para al portador y un compañero recibe antes
   que el segundo defensor.

Y la acción organizada empieza cuando están situados los cinco atacantes;
un defensor que llega tarde entra desde su posición real.

### Qué se observa

En 8 000 tramos (semillas 1–1000 × cuatro combinaciones de prioridades ×
drop/trampa) **ninguna** lectura encuentra ventana y **ningún** defensor
llega tarde a la acción organizada. Motivo geométrico: con «Proteger
balance» vuelven tres jugadores y con «Cargar rebote» dos; quien retorna
hacia `x = 14` está siempre más cerca de su aro que cualquier atacante que
acaba de rebotear en el otro extremo, y el ataque tarda más en colocar a
sus cinco que la defensa en volver. El coste de cargar sí se ve en los
encargos, las trayectorias y el rebote ofensivo (con «Cargar rebote»
cambia quién gana algunos rebotes: 12 de 300 semillas en `drop`), pero no
como transición concedida.

### Decisión que falta

Si esto es el comportamiento deseado para este fixture, o si la ventana
de transición debe leerse con otro criterio deportivo. Es una regla de
juego (qué constituye una ventaja en transición), no un detalle técnico.

### Opciones viables y consecuencias

- **A. Aceptar el comportamiento actual.** El balance de dos o tres
  jugadores siempre protege en este fixture; la transición concedida
  aparecerá cuando haya planes con menos balance, otras plantillas o
  acciones sin balón (ME-06). Sin cambios de código.
- **B. Superioridad numérica al cruzar el medio campo.** Leer la ventana en
  el instante en que el balón entra en pista delantera: atacantes frente a
  defensores ya situados entre el balón y el aro (3×2, 2×1). Más
  transiciones visibles; requiere definir qué es «situado» y qué acción
  ejecuta un 3×2 (hoy solo existe el 2×1).
- **C. Empezar la acción organizada con manejador y bloqueador situados.**
  El resto del ataque y de la defensa llega mientras se juega; un defensor
  tardío (p. ej. quien cargó) afectaría a la ayuda o a la reparación. Más
  coste observable de cargar; cambia cuándo arranca el bloqueo directo.
- **D. Otro destino de balance** (más profundo o más cercano al aro
  propio). Cambia el parámetro que el prompt fijó en `x = 14`.

Recomendación de Claude Code: **A** para cerrar ME-03 sin inventar reglas,
y **C** como primer candidato si se quiere ver la transición concedida
antes de ME-06, porque reutiliza el árbol existente sin acciones nuevas.

### Qué queda bloqueado

Nada del alcance funcional de ME-03: las tres lecturas están implementadas,
probadas con posiciones construidas (`domain/sequence/me03.test.ts`,
prueba (5)) y el visor muestra el motivo «Sin ventaja: ataque organizado»
con los tiempos de llegada. Solo queda sin demostrar con el fixture real
una ventaja temprana concedida por cargar.
