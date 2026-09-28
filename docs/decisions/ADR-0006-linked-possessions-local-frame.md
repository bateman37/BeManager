# ADR-0006: Tramos enlazados sobre el núcleo compartido con marco local de ataque y roles canónicos

**Estado:** ACCEPTED
**Última actualización:** 2026-09-28.

## Contexto

ME-03 exige que la misma cancha, los mismos diez jugadores y el mismo balón
atraviesen hasta cuatro posesiones estadísticas: rebotes, pérdidas,
canastas, saques y cambios de dirección. El núcleo compartido
(`possession-core.ts`, ADR-0005) estaba escrito para una única posesión de
media pista: IDs fijos (`O1`…`D5`, el prefijo `O` siempre ataca), aro
atacado fijo en x creciente, posiciones iniciales de `scenario.ts`, relojes
7:12/18 s y un generador de azar creado desde la semilla en cada llamada.

El prompt prohíbe tanto construir el tramo concatenando llamadas que
reinician el fixture como duplicar un segundo árbol de pase/tiro/tapón/falta
para el equipo que antes defendía, y permite expresamente "una
transformación de coordenadas local para reutilizar resolutores", siempre
que la cancha, el historial y las posiciones que ve el usuario sean
globales y continuos.

## Decisión

1. **Marco local por giro de 180°** (`domain/geometry/frame.ts`). El equipo
   que ataca el aro izquierdo calcula en la cancha girada `(x, y) → (28 −
   x, 15 − y)`. El giro es su propia inversa, conserva distancias y la
   orientación (no refleja lados), y solo existe dentro del cálculo: todo
   lo que sale del núcleo vuelve a coordenadas globales antes de guardarse.
2. **Roles canónicos, no IDs.** Dentro del núcleo, `O1`…`O5` y `D1`…`D5`
   pasan a ser **roles de la acción organizada** (manejador, esquinas, ala,
   bloqueador; perseguidor, ayudas, protector del aro). Un `binding` asigna
   cada rol a un jugador real: el número del fixture da el rol natural, el
   control del balón decide quién ataca. Actores, textos y detalles se
   traducen a IDs reales al salir; el usuario nunca ve a O1 renombrado como
   D1. Los desempates por ID usan siempre el ID real.
3. **Modo enlazado opcional del núcleo** (`ComputePossessionCoreOptions.linked`):
   posiciones, relojes y azar heredados (un único `ResumableRandom` para
   todo el tramo, con estado exportable por frontera), desplazamientos ya
   planificados, y dos entradas: la acción organizada existente o una
   finalización directa (penetración, pase adelantado, 2×1 o segunda
   oportunidad) que reutiliza `resolveShotAttempt`. En este modo el núcleo
   además asigna carga/balance antes del tiro, registra salidas y llegadas
   como desplazamientos reales, adjudica la violación de 24 s en la
   liberación y **devuelve** el control tras un rebote en vez de encadenar
   la segunda oportunidad. Sin `linked`, el código recorre exactamente el
   camino de ME-01/ME-02.
4. **Orquestación fuera del núcleo** (`domain/sequence/`): reglas de reloj
   y reanudación FIBA alcanzables como funciones puras
   (`fiba-clock-rules.ts`), lecturas de transición (`transition.ts`) y el
   tramo (`play-tramo.ts`), que mantiene posesiones, fases, relojes,
   marcador, trayectorias globales y encargos.

## Consecuencias

- La huella de `runPossession` y de los dos lotes rápidos es idéntica bit a
  bit antes y después: comprobado durante la entrega con 3 escenarios × 2
  coberturas × 300 semillas y lotes de 500, y fijado como prueba (7) de
  `domain/sequence/me03.test.ts` (40 semillas y lotes de 200, con la huella
  calculada sobre el commit anterior a ME-03).
- Puerto Ámbar ataca de verdad el aro izquierdo con sus perfiles, usando el
  mismo árbol, las mismas fórmulas LAB-0.1/LAB-0.2 y la misma taxonomía de
  hechos; una corrección futura del árbol beneficia a ambos lados a la vez.
- El prefijo de ID sigue identificando el equipo del fixture en la
  interfaz y en el fixture, pero ya no significa "ataca".
- Añadir una segunda acción táctica (ME-06) seguirá extendiendo el núcleo
  en roles canónicos; el marco local lo hereda sin cambios.
- Coste medido: ≈0,3–0,5 ms por posesión detallada enlazada (ver
  `CHANGELOG.md`, entrada ME-03).

## Alternativas descartadas

- **Reflejo en espejo (`x → 28 − x`)**: cambia izquierda/derecha y haría
  que la "esquina del lado del balón" apareciera en la banda opuesta a la
  real; el giro conserva la geometría relativa.
- **Parametrizar el aro atacado en cada fórmula del núcleo**: exigía
  reescribir decenas de expresiones del árbol de ME-01/ME-02 con riesgo de
  romper su huella; el marco local no toca ninguna fórmula.
- **Renombrar jugadores al cambiar de lado** (`O1` ↔ `D1`): prohibido por
  el prompt y rompe la trazabilidad de perfiles, estadísticas y relato.
- **Concatenar `runPossession`**: reinicia fixture, relojes y azar.
