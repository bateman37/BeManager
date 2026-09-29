# Escenarios, cobertura y validación (ME-01/ME-02)

**Estado:** ACTIVE
**Es fuente de verdad para:** los tres escenarios cargables, la cobertura defensiva (`drop`/`trampa`), el modo «Jugar tramo» y cómo se comprueban.
**Debe leerse cuando:** vayas a añadir un escenario, una cobertura, o a entender por qué una rama concreta es alcanzable.
**No cubre:** el modo rápido completo de ME-08 (aquí solo hay una aproximación limitada a este escenario).
**Documentos relacionados:** `ACTIONS.md`, `RULES.md`.
**Última actualización:** 2026-09-28 (ME-03, aclaración opción B).

## Los tres escenarios (`domain/lab/scenario.ts`)

| ID | Ayuda de D3 | Qué permite comprobar |
|---|---|---|
| `drop_con_ayuda` | Sí | D3 deja a O3; posible pase a la esquina liberada |
| `drop_sin_ayuda` | No | D3 conserva la marca; sin esa liberación |
| `closeout_tardio_con_contacto` | Sí, ya comprometida al cargar el estado | Alcanza la rama de falta ordinaria de tiro por cierre tardío |

## Cobertura defensiva (`coverage`, ME-02)

Independiente del escenario: un campo de `MatchInput` (`coverage: "drop" |
"trampa"`) escoge la respuesta defensiva al mismo bloqueo central, mismos
quintetos y misma media pista. La comparación principal de ME-02 siempre
enfrenta `drop_con_ayuda` con cobertura `drop` frente a `drop_con_ayuda`
con cobertura `trampa` (en ambas, D3 tiene encomendada la ayuda al
continuador y D4 la reparación): ver `compareCoverageBatch` en
`domain/fast/fast-resolver.ts`. Es una comparación distinta de la de ayuda
sí/no y no sustituye el caso individual de closeout tardío.

`closeout_tardio_con_contacto` no fuerza un pitido por su identificador: se
limita a cargar el estado más allá del punto en que D3 ya ayudó y O3 está
disponible (prompt §4), incluyendo que el defensor que repara (D4) parte de
una posición de recuperación más exigente (ya había rotado hacia el aro),
igual que ocurriría tras una ayuda comprometida. La legalidad real del
cierre se sigue decidiendo por hechos (ver `RULES.md`); verificado con 40
semillas en `possession-engine.test.ts` que la rama de falta es alcanzable.

## Dos resoluciones del mismo escenario

- **Detallado** (`domain/simulation/possession-engine.ts`): relato completo
  por pasos, cancha esquemática, un resultado por corrida.
- **Rápido** (`domain/fast/fast-resolver.ts`, HF-002): resuelve por etapas
  usando el mismo núcleo de decisión y las mismas fórmulas LAB-0.1 que el
  motor detallado (`domain/simulation/possession-core.ts`), pero **no
  llama a `runPossession`** ni construye relato por jugada ni snapshots de
  diez jugadores por paso: solo agrega las categorías que realmente
  representa (pantallas navegadas, ayuda dejada, pases al roll o a la
  esquina, tiros, pérdidas, robos, tapones, rebotes, faltas de tiro, balón
  fuera). Al saltarse la construcción de relato y el historial de
  posiciones, es medible y explicablemente más rápido que ejecutar el
  detallado en lote (≈1,5–1,75× en las mediciones de la PR de HF-002,
  mismo equipo, mismas semillas).

## Qué demuestra la comparación

Cambiar la ayuda de D3 con la misma semilla altera dónde aparece la
oportunidad (verificado en `fast-resolver.test.ts`): sin ayuda,
`helpLeftAssignment` y `passesToCorner` son siempre 0; con ayuda, no. La
interfaz de laboratorio permite repetir el mismo escenario, cambiar solo la
ayuda o una capacidad, y comparar un lote pequeño desde la misma pantalla.

**El lote «Drop: ayuda sí/no» siempre compara ayuda sí/no, no el escenario
seleccionado** (HF-002 §1.7): ejecuta siempre exactamente `drop_con_ayuda`
frente a `drop_sin_ayuda`, con independencia de qué escenario esté elegido
en la ejecución individual. `closeout_tardio_con_contacto` no es una
variante de ayuda sí/no y no participa en esa tabla; se prueba en la
ejecución individual, y la interfaz lo indica explícitamente para no
atribuir esa tabla a un escenario distinto del que realmente mide.

**El lote «Misma posesión: drop/trampa (con ayuda)» (ME-02) es una tabla
aparte**, separada visualmente en `/lab`: compara exactamente `drop` frente
a `trampa` sobre `drop_con_ayuda`, con las mismas plantillas y semillas.
Ambas tablas muestran sus propias entradas, versiones y tamaño de muestra,
y se limpian o marcan desactualizadas al cambiar perfiles, cobertura,
semilla o tamaño de lote (`invalidatePreviousResults` en
`lab-workspace.tsx`).

## C3: estadística conciliada (FGA/FGM/FTA/FTM/puntos)

Tanto el lote de ayuda sí/no como el de drop/trampa muestran, además de las
categorías de lectura (pases al roll/esquina/salida, pérdidas, robos,
rebotes), el tiro de campo oficial FIBA por separado de la oportunidad de
tiro preparada: 2FGA/2FGM, 3FGA/3FGM, FTA/FTM y puntos
(2×2FGM+3×3FGM+FTM). Ver `RULES.md` para la regla exacta de cuándo un
intento cuenta como FGA.

## Modo «Jugar tramo» (ME-03)

Separado de los tres escenarios y de las dos tablas de lotes: parte siempre
de `drop_con_ayuda` y encadena hasta cuatro posesiones (ver `MODEL.md` y
`RULES.md`). Entradas: semilla y cobertura (las mismas del resto del
laboratorio; la cobertura rige para el equipo que defienda en cada
posesión) y la prioridad tras tiro de cada equipo. Cambiar cualquiera de
ellas, o guardar un perfil, limpia el tramo anterior. Solo hay versión
detallada: el modo rápido no resume tramos.

Se comprueba en `domain/sequence/me03.test.ts` (reproducibilidad,
continuidad al cambiar de lado, fronteras de rebote y balón suelto, saques
y relojes, carga frente a balance, guardián y regresión de ME-01/ME-02;
2×1 y 3×2 de la ventaja temprana con geometría construida a mano, ver
`ACTIONS.md`) y con el plan manual
`docs/testing/manual/ME-03-manual-test-plan.md`. El coste se perfila con
`npm run profile:tramo` (`scripts/profile-tramo.ts`).
