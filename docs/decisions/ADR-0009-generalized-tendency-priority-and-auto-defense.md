# ADR-0009: Tendencia/prioridad generalizadas, defensa `auto` y creador real en `organize()`

**Estado:** ACCEPTED
**Última actualización:** 2026-09-30.

## Contexto

ME-07A pide que la banda de empate `FIRST_READ_TIE_BAND_POINTS` (LAB-0.3,
ya usada solo en la primera lectura del bloqueo directo) se generalice a
otras decisiones, que `coverage`/`offBallDefensiveCall` admitan `auto`
para el partido completo, y que el poseedor real pueda conservar la
iniciativa en `organize()` en vez de devolver siempre el balón al rol
fijo O1 (auditado hasta ahora como `role_fixed_no_ranking`, sin comparar
contra nada). Ningún mecanismo nuevo podía inventar un coeficiente
deportivo oculto ni una cuota de tiros.

## Decisión

1. **Dos tendencias con papeles distintos, no una que sustituye a la
   otra.** `pnrTendency` conserva su papel específico en
   `lectura_bloqueo_o1` (el precedente literal de ME-04B/ME-06). La nueva
   `shotTendency` (`prudente`/`equilibrada`/`decidida`) decide, dentro de
   la misma banda, cuando un tiro real compite con conservar/pasar, en
   sitios que no tenían ningún mecanismo de tendencia: la primera lectura
   de la mano a mano y el triple de transición. `equilibrada` reutiliza
   `secondOptionProbability(M03)` en vez de un sorteo nuevo.
2. **La prioridad de creación del entrenador es la primera capa dentro de
   la banda, antes de cualquier tendencia**, en los tres sitios donde
   ahora existe banda de empate (bloqueo, mano a mano, y de forma
   implícita en el triple de transición al no competir con otra vía de
   tres). `equilibrado` dejaba pasar exactamente el comportamiento
   anterior a esta entrega; los tests existentes lo confirman sin
   tocarlos.
3. **Cobertura y orden sin balón `auto` se resuelven una sola vez por
   posesión, de forma pura (sin RNG), antes de despachar el árbol**, con
   el mismo patrón ya aceptado en ADR-0008 para `offensivePlan: "auto"`:
   una estimación ligera de concesión con fórmulas de valor ya existentes
   (tiro cercano T01, triple T04, sin oposición), nunca ejecutando la
   rama descartada. `ctx.resolvedCoverage` (nuevo campo mutable de
   `CoreContext`) sustituye toda lectura directa de `ctx.input.coverage`
   dentro del núcleo, para que la mano a mano (que también consulta la
   cobertura, para el salto de D5) vea el mismo valor ya resuelto.
4. **`organize()` compara conservar la iniciativa contra el pase de
   vuelta con la misma geometría real (F01 del portador, T09/T11 y vuelo
   del pase), y reasigna roles con `rebindFrame`** (el mismo mecanismo ya
   aceptado para la segunda entrada del bloqueo, ME-04): los otros tres
   atacantes conservan su tarea sin cambios, y el antiguo O1 ocupa el
   puesto que dejó el portador. Empate exacto conserva el pase de vuelta.
5. **`TRANSITION_THREE_DEPTH_BUFFER_METERS = 2` m (nuevo, declarado en
   `transition.ts`) acota el triple de transición a una posición ya de
   tiro real.** Se detectó en desarrollo que, sin este límite, "detrás de
   la línea" incluye todo el espacio desde el medio campo (>5 m de
   margen): la vía se ofrecía en casi cualquier transición sin ventaja y
   disparaba el volumen de tiro y el marcador de forma irreal (un partido
   de prueba pasó de un final natural a ~190 puntos por equipo). El
   defensor que contestaría tampoco es necesariamente el protector del
   aro de `readTransition` (`firstDefender`): se recalcula el defensor
   real más cercano al propio portador entre los cinco.

## Defecto real corregido de paso

Construir la vía de triple de transición expuso que `organize()` y la
propia vía nueva despachaban directo a `runCore` sin pasar por el mismo
control de cuenta de 8 s (art. 28) que ya hacían las demás vías de
ventaja temprana, dejando una violación de campo trasero sin detectar en
el instante correcto y disparando el guardián de progreso por hechos
desordenados en partidos largos. Se replicó el mismo control
(`evaluateBackcourtCount` + limpieza de `this.backcourt`) en el punto
exacto donde cada vía nueva decide ejecutar, solo cuando de verdad
despacha a `runCore`.

## Consecuencias

- Tres pruebas de ME-04 dependían de que el balón volviera siempre a O1
  tras cada rebote/robo (una semilla de bocina antes del final, la huella
  del tramo compartido): se sustituyeron por semillas/huella que
  reproducen exactamente el mismo caso de frontera bajo el nuevo
  mecanismo, siguiendo el precedente ya documentado en `me04.test.ts` de
  recalcular cuando el cambio de la mecánica compartida es intencional.
- **Hallazgo de calibración, no oculto:** con la disposición inicial fija
  de los tres escenarios de laboratorio, D5 arranca protegiendo el aro y
  ninguna combinación alcanzable de F04/M01/M05/T22 lo hace llegar a
  tiempo para comprometer una trampa desde ahí; `auto` declara
  `coverage_trap_not_eligible` y conserva `drop` en todas las semillas
  observadas. Documentado en `CAPABILITIES.md`/`SCENARIOS.md` como
  pendiente para ME-07B (una referencia de compromiso menos estricta, o
  posiciones defensivas iniciales más agresivas), no arreglado con una
  cuota.
- `AUDIT_SCHEMA_VERSION` sube a `"ME-07A-AUDIT-1"`; `ME-06-AUDIT-1` no se
  reinterpreta.

## Alternativas descartadas

- **Sustituir `pnrTendency` por `shotTendency` en la primera lectura del
  bloqueo:** el prompt fija explícitamente que `pnrTendency` conserva su
  papel específico ahí; se generaliza la banda, no se reemplaza el
  mecanismo ya versionado.
- **Trap "elegible" basado solo en atributos, sin geometría real:**
  descartado por poder fingir una trampa alcanzable con cualquier
  jugador con F04 alto, sin importar dónde arranca; se mantiene la
  comparación de tiempos de llegada real, aunque eso la haga
  estructuralmente difícil de alcanzar con el fixture (documentado, no
  ocultado).
- **Umbral de profundidad del triple de transición ausente o mayor de
  2 m:** produjo el volumen de tiro irreal descrito arriba; 2 m es el
  valor mínimo que, en pruebas manuales, sigue permitiendo un triple de
  ritmo real (no solo un catch-and-shoot ya colocado) sin abrir todo el
  medio campo.