# ADR-0008: Segunda familia ofensiva sobre el mismo núcleo y selección automática pura

**Estado:** ACCEPTED
**Última actualización:** 2026-09-29.

## Contexto

ME-06 pide una segunda familia posicional completa (mano a mano sin
balón), un selector de plan ofensivo por equipo que incluya `auto`, y una
orden de defensa sin balón, sin romper la continuidad de ME-03/ME-04 ni
la auditoría de ME-04A/ME-04B. ADR-0005 y ADR-0006 ya anticipaban esta
entrega («añadir una segunda acción táctica seguirá extendiendo este
mismo núcleo, no un tercer módulo paralelo»; «el marco local lo hereda
sin cambios»). El diseño concreto de `auto` no estaba resuelto: comparar
dos familias exige puntuar la oportunidad de cada una sin ejecutar la
descartada, sin sortear de más y sin mirar el resultado futuro.

## Decisión

1. **`runHandoffPhase` junto a `runDropPhase`/`runTrapPhase`**, en el mismo
   `possession-core.ts`: mismos roles canónicos, mismo marco local, mismas
   fórmulas LAB-0.1/0.2/0.3 reutilizadas donde corresponde. `offensivePlan`
   y `offBallDefensiveCall` viajan en `MatchInput`/`GameTeamInput` igual
   que `coverage`, no como un contrato nuevo.
2. **`auto` puntúa una oportunidad ligera, no el árbol completo de cada
   familia.** `estimateBloqueoDirectoOpportunity`/
   `estimateHandoffOpportunity` recalculan, con las posiciones **originales
   heredadas** (antes de cualquier desplazamiento real: screen, entrada,
   mano a mano, corte) y sin RNG, una aproximación del mejor valor
   situacional alcanzable de cada familia, y se elige la de mayor valor.
   Una vez elegida, esa familia se ejecuta desde cero con su propio árbol
   de lectura, tiempos reales y sorteos — la estimación nunca se reutiliza
   como resultado.
3. **La alternativa descartada — clonar el contexto y ejecutar de verdad
   ambos árboles hasta el primer punto de decisión (dry-run) — se
   descartó** por su coste de invasión: `runDropPhase`/`runHandoffPhase`
   mutan posiciones y emiten hechos desde su primera línea (el bloqueo se
   coloca, el mano a mano empieza) antes de llegar a ninguna decisión;
   hacerlas seguras para un dry-run exigiría un parámetro «no ejecutes
   todavía» en cada mutación y cada emisión de hecho de las dos funciones,
   aumentando el riesgo de regresión sobre el árbol de bloqueo directo ya
   probado, para un beneficio (una estimación bit-idéntica a la ejecución
   real) que el propio prompt no exige («comparable», no exacta).
4. **Geometría sintética propia de la mano a mano** (`WEAK_SIDE_SCREEN_
   SPOT`/`WEAK_SIDE_CUT_SPOT`) y el ajuste de la orden de defensa sin
   balón sobre la navegación de D3 son datos locales versionados en
   `possession-core.ts`, no una nueva versión LAB-0.4: no se necesitó
   ninguna fórmula deportiva nueva, solo dos puntos de cancha y un
   desplazamiento fijo documentado con su unidad.
5. **La segunda entrada del bloqueo directo (kick-out) no reevalúa la
   familia.** `GameRun.offensivePlanWhenAttacking` fuerza
   `bloqueo_directo` mientras `currentSetKind !== "central"`: esa
   continuación reasigna roles para un segundo ángulo del mismo bloqueo,
   no es «iniciar un ataque organizado» en el sentido de ME-06 §3.2, y su
   geometría (kick-out a O4/O2) es específica del bloqueo directo.

## Consecuencias

- `auto` puede, en casos construidos, discreparse levemente entre la
  familia que la estimación prefiere y la que su propio árbol real
  terminaría prefiriendo si se ejecutaran ambas; se acepta como
  aproximación documentada, verificada con casos construidos donde cada
  familia gana cuando de verdad tiene mejor oportunidad
  (`domain/game/me06-mano-a-mano.test.ts`).
- Con la plantilla natural del laboratorio, `auto` sigue prefiriendo el
  bloqueo directo (D5, en `drop`, protege un aro geométricamente más
  cercano al portador que cualquier recepción perimetral de la mano a
  mano en esta disposición): es un límite del fixture actual, documentado
  en `docs/match/SCENARIOS.md`, no una preferencia forzada del selector.
- Un tercer modo que no declare `offensivePlanWhenAttacking`/
  `offBallCallWhenDefending` (el tramo de ME-03) conserva por defecto
  `bloqueo_directo`/`guardar_espacio` sin cambiar una sola línea: el
  método base de `LinkedRun` no es abstracto.

## Alternativas descartadas

- **Dry-run real de ambas familias antes de decidir** (ver punto 3):
  descartada por invasión y riesgo de regresión frente al beneficio.
- **Alternancia por número de posesión para el empate exacto:** el
  prompt lo prohíbe explícitamente («no una alternancia por número de
  posesión»); se conserva el bloqueo directo en empate exacto, una regla
  estable vinculada a la familia ya versionada.
- **`LAB-0.4` para la geometría/ajuste nuevos:** no se justificaba una
  versión de parámetros deportivos nueva para dos puntos de cancha y un
  desplazamiento local; se documentan como datos propios de esta acción
  en `possession-core.ts` (ver `CAPABILITIES.md`).
