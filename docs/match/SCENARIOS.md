# Escenarios, cobertura y validación (ME-01 a ME-04B)

**Estado:** ACTIVE
**Es fuente de verdad para:** los tres escenarios cargables, la cobertura defensiva (`drop`/`trampa`), el modo «Jugar tramo», el partido completo, los casos de frontera y cómo se comprueban.
**Debe leerse cuando:** vayas a añadir un escenario, una cobertura, o a entender por qué una rama concreta es alcanzable.
**No cubre:** el modo rápido completo de ME-08 (aquí solo hay una aproximación limitada a este escenario).
**Documentos relacionados:** `ACTIONS.md`, `RULES.md`.
**Última actualización:** 2026-09-29 (ME-06, adelantada antes de ME-05).

## Los tres escenarios (`domain/lab/scenario.ts`)

| ID | Ayuda de D3 | Qué permite comprobar |
|---|---|---|
| `drop_con_ayuda` | Sí | D3 deja a O3; posible pase a la esquina liberada |
| `drop_sin_ayuda` | No | D3 conserva la marca; sin esa liberación |
| `closeout_tardio_con_contacto` | Sí, ya comprometida al cargar el estado | Alcanza la rama de falta ordinaria de tiro por cierre tardío |

**Recalibrado en ME-04B:** tras corregir el desplazamiento real de O1/D1
(§3.1), este escenario usa una posición de partida de O1 propia
(`CLOSEOUT_OFFENSE_SLOTS`, ligeramente más adentro que en los otros dos) y
un nuevo punto de partida de D4 (`LATE_CLOSEOUT_D4_START`), para que la
primera lectura siga compitiendo de verdad entre el pase a la esquina y las
demás vías y la falta de cierre tardío siga siendo alcanzable con la nueva
geometría. Es una condición geométrica propia de este escenario sintético,
no un cambio de las posiciones reales de `drop_con_ayuda`/`drop_sin_ayuda`.

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

## Partido completo y casos de frontera (ME-04)

Sección «Partido completo FIBA 2026 (ME-04)» de `/lab`: los dos equipos con
sus doce inscritos (titulares y suplentes con sus roles), semilla, cobertura
y prioridad **de cada equipo**, «Jugar partido». Cambiar la semilla, una
cobertura, una prioridad o guardar un perfil retira el partido anterior con
un aviso. El visor muestra ganador, marcador y parciales, faltas de equipo y
bonus, sustituciones, relato por período → posesión → evento con cancha y
quinteto en pista, y el acta con minutos, DNP y su conciliación.

**ME-06:** cada equipo añade un **plan ofensivo** (`auto` por defecto,
`bloqueo_directo` o `mano_a_mano_sin_balon`) y una **orden de defensa sin
balón** (`guardar_espacio` por defecto o `negar_primera_salida`), junto a
cobertura y prioridad; cambiar cualquiera de los dos también retira el
partido anterior. El marcador muestra el plan/orden reales de cada
equipo, no solo el resultado del tiro; el relato ya narra en prosa la
entrada, la entrega y el bloqueo/corte de la mano a mano cuando esa
familia se juega.

**Partido natural publicado (marcador anterior a ME-04B, ver abajo):** semilla
**82**, drop/drop, «Proteger balance» en ambos. Las semillas naturales
útiles para casos de frontera siguen siendo válidas para su mecanismo
(reloj, bocina, prórroga), aunque el marcador exacto que citaban cambia con
el árbol de decisión corregido: 3 (prórroga), 121 (fallo soltado a tiempo
sin rebote tras la bocina), 13 con trampa/trampa y «Cargar rebote» (más de
una prórroga; ver ME-04B (6) en `me04.test.ts`, semilla 7 recalculada).

**Barrido reproducible pre-ME-04B** (semillas 1–20 × drop/drop, trampa/
trampa y drop/trampa con prioridades mezcladas; 60 partidos): 60 finales, 3
con prórroga; entradas de ataque: organizado 12 011, segunda oportunidad
2 780, ventaja temprana 0, segunda entrada 0; 63 faltas (todas de tiro), 0
sin tiro, 0 bonus, 0 exclusiones. Estas cifras motivaron el diagnóstico de
ME-04B (ver abajo y `docs/match/ACTIONS.md`); no se han vuelto a barrer a
esta escala tras la corrección por no convertir la auditoría de aceptación
en una campaña enorme (prompt ME-04B §5).

## Corrección de lecturas y oposición (ME-04B)

Con el árbol de decisión y el modelo de oposición corregidos (§3.1-§3.3 del
prompt ME-04B, ver `docs/match/ACTIONS.md` y `RULES.md`), una muestra
pequeña y representativa de ocho semillas naturales (1, 37, 82, 156, 190,
199, 210, 367; drop/drop, «Proteger balance», perfiles del fixture del
repositorio) da:

- **Primera lectura:** de 1 799 lecturas evaluadas de verdad, 1 798 siguen
  eligiendo `pase_o5` y solo 1 elige `triple_o1` (semilla 210). Ya no es un
  cortocircuito (cada vía tiene un valor comparable registrado en la
  auditoría), pero con este fixture concreto O5 sigue siendo, en la
  inmensa mayoría de los casos, la vía de mayor valor esperado: es un buen
  finalizador cercano (T01) que rara vez queda realmente contenido por D3
  (`d3TrulyContaining` ya no es automático: la segunda lectura invierte a
  O3 solo entre 29 y 57 veces por partido de las ~220 recepciones, antes
  era exactamente el 100 %). Los perfiles editados del grupo B de los
  archivos adjuntos (T04 y T16/T17 de O1 más altos) sí desplazan el reparto
  de forma observable hacia el triple y el pase directo a O3 (ver más
  abajo, fotos A/B de la semilla 210); los casos construidos de
  `domain/simulation/me04b.test.ts` demuestran que O1 elige el triple de
  verdad cuando su valor lo supera.
- **Transición:** `entrada_fase_transicion` deja de ser 100 % `sin_ventaja`:
  aparece `penetracion` entre 6 y 15 veces por partido (de ~190-200
  lecturas). El desplazamiento real de O1/D1 (§3.1) altera las posiciones
  que hereda la siguiente posesión, incluida la de D1 como protector
  potencial; no se ha investigado más a fondo el mecanismo exacto porque
  la transición no es el objeto de esta entrega (`transition.ts` no se
  tocó). Sigue sin verse `superioridad_2x1`/`3x2` con este fixture.
- **Oposición al tiro:** de 2 042 resoluciones de tiro, ~93,5 % siguen
  siendo `no_contest`, ~5,3 % `legal_contest` y ~1,1 % contacto tardío
  ilegal (antes del ajuste, el diagnóstico documentaba ~96,7 % `no_contest`
  producido por un modelo de contacto roto, no por una defensa creíble). La
  falta ordinaria sin tiro sigue sin producirse de forma natural con este
  fixture y la segunda entrada tampoco (ver la decisión pendiente de ME-04,
  actualizada); ambos mecanismos se demuestran alcanzables con geometría
  construida a mano en `domain/game/me04b.test.ts`.
- **Fotos A/B de la semilla 210** (perfiles y planes de los archivos
  adjuntos, motor corregido): foto A (perfiles ME-04A) 92–145 con 3
  `triple_o1` y 22 3PA de Sierra Clara; foto B (O1/O4/O5 de Sierra Clara
  editados) 103–160 con 2 `triple_o1` pero 43 3PA (16 anotados) — el cambio
  de perfil desplaza de verdad el volumen y acierto de tres puntos, visible
  en la auditoría, aunque la vía elegida en la primera lectura casi no
  cambie con este fixture. Una tercera foto con el fixture del repositorio
  a la misma semilla da 130–160 con 1 `triple_o1` y 39 3PA: las tres fotos
  son comparables entre sí (mismo motor, ME-04B-GAME-1) pero no frente al
  marcador antiguo (`ME-04-GAME-1`, ME-04A), que queda como evidencia
  histórica del motor anterior.
- **Drop/drop frente a trampa/trampa (contraste, no un experimento
  exhaustivo):** en la misma semilla 1, trampa/trampa con «Cargar rebote»
  no genera ninguna `resolucion_tiro` fuera de `no_contest` en la muestra
  observada (la trampa resuelve por vías distintas — robo bajo presión,
  salida a O4/O2, inversión — con su propia geometría de contacto, no
  comparada aquí en detalle). No se afirma un efecto general de la
  cobertura sobre la oposición a partir de un solo partido.
- **Coste:** los ocho partidos naturales tardan entre 255 y 431 ms en jugarse
  (mismo equipo, sin base de datos), el mismo orden de magnitud que el
  coste de simulación ya documentado en `AUDIT.md` para ME-04A; no se
  observa una regresión grande.

**Casos de frontera** (sección con borde discontinuo, etiquetada «Caso de
frontera reglamentario (fixture de prueba, no es un partido)»,
`domain/game/rule-boundary-fixtures.ts`): (a) tiro soltado antes, en y
después de la bocina; (b) reset del reloj de lanzamiento tras falta sin tiro
a 13/14 s; (c) falta de tiro y and-one con su acta; (d) cuarta y quinta falta
de equipo, bonus y quinta personal (también en prórroga, contada en C4); (e)
empate al acabar C4 → prórroga → otra prórroga → final; (f) canasta en C4 a
2:00 con oportunidad del equipo que encaja. Cada paso muestra su estado y
hechos de entrada, la función pura del partido que lo adjudica y su
resultado; nada se inserta en un acta real.

Se comprueba en `domain/game/me04.test.ts` (prompt §8, puntos 1–7) y con el
plan `docs/testing/manual/ME-04-manual-test-plan.md`; las correcciones de
ME-04B se comprueban además en `domain/game/me04b.test.ts`,
`domain/simulation/me04b.test.ts` y `domain/audit/audit-export-me04b.test.ts`,
con el plan `docs/testing/manual/ME-04B-manual-test-plan.md`. El coste se
perfila con `npm run profile:game` (`scripts/profile-game.ts`).

## Segunda familia y selector automático (ME-06)

Muestra pequeña y honesta (semilla 82, drop/drop, «Proteger balance»,
fixture vigente del repositorio, no las ocho semillas naturales de
ME-04B): distingue siempre fixture puro de una foto editada.

- **Auto frente a familia forzada, misma semilla:** con la plantilla
  natural, `auto` elige `bloqueo_directo` en las 219 aperturas
  organizadas de la semilla 82 (idéntico a forzar `bloqueo_directo`
  explícitamente: 129–145, 204 posesiones, vía `pase_o5` en las 219
  lecturas) — D5, en `drop`, protege un aro geométricamente más cerca del
  portador que cualquier recepción perimetral de la mano a mano en esta
  disposición concreta, la misma causa espacial que ya explica el
  dominio de `pase_o5` en ME-04B. `auto` **sí** elige la mano a mano en
  casos construidos donde de verdad es mejor (`estimateHandoffOpportunity`
  supera a `estimateBloqueoDirectoOpportunity`, ver
  `domain/game/me06-mano-a-mano.test.ts`); no se ha forzado una
  frecuencia de reparto.
- **Mano a mano forzada, misma semilla:** 73–67, 182 posesiones. El
  reparto de tiro cambia de forma marcada frente al bloqueo directo
  (más 3PA/menos 2PA: Sierra Clara 28/87 frente a 91/18), consistente
  con que la primera salida real de esta familia es casi siempre
  perimetral (O3/O4), no una finalización cercana.
- **Contraste de la orden de defensa sin balón** (misma semilla y
  familia): `guardar_espacio` → 206 entradas, vía `continuar_o4` en 193
  de las 206 lecturas (D4 ayuda casi siempre que D3 no deniega con
  margen real: `reasonCode help_rotation_opened_o4`); `negar_primera_salida`
  → 210 entradas, vía `pase_o3` en 201 de las 210 (D4 nunca ayuda:
  `continuar_o4` queda siempre en `help_rotation_not_available`). Marcador
  73–67 frente a 77–99: la orden desplaza de verdad quién recibe el tiro
  y con qué oposición, causa observable en `bloqueo_indirecto_o3`, no una
  moneda al aire.
- **Base frente a `+3`, una sola selección de jugadores/equipo (Sierra
  Clara), misma semilla y órdenes:** base 73–67 (28/87 2PA/3PA); Sierra
  Clara `+3` a los 27 atributos activos de los doce inscritos → 109–68
  (48/85 2PA/3PA), manteniendo la misma vía dominante (`continuar_o4`).
  No se compara como una regresión de marcador (es una edición real, no
  la misma foto): el efecto sigue una ventaja de habilidades explicable,
  no un cambio de mecanismo.
- **Opciones con frecuencia cero en esta muestra y su `reasonCode`:**
  `lectura_mano_a_mano:finalizar_portador` (`lane_closed_help_ready`: D5
  protege un aro más próximo que cualquier recepción de esta familia en
  esta disposición, misma causa espacial que en el bloqueo directo);
  `lectura_mano_a_mano:pase_o1`/`pase_o3` cuando no son la vía elegida
  (`situational_value_lower`, evaluadas de verdad y perdidas por valor,
  no cortocircuitadas); `bloqueo_indirecto_o3:ayuda_d4_abre_o4` bajo
  `negar_primera_salida` (`help_rotation_not_available`, por diseño de
  esa orden). Ninguna de estas ausencias es un cortocircuito: cada una
  tiene una condición real registrada.

Reproducible con `SIERRA_CLARA`/`PUERTO_AMBAR` del fixture,
`offensivePlan`/`offBallDefensiveCall` en `buildGameInput` y
`buildAuditExport` para extraer `decisions.records`/`result.box.teams`;
ver los casos construidos discriminantes en
`domain/game/me06-mano-a-mano.test.ts`,
`domain/simulation/me06-diagnostico-me04b.test.ts` y
`domain/audit/audit-export-me06.test.ts`, y el plan manual
`docs/testing/manual/ME-06-manual-test-plan.md`.
