# Changelog

Formato libre en español, orden cronológico inverso. Los motivos de
decisiones duraderas viven en `docs/decisions/`, no aquí.

## ME-07B v2 — Capítulo táctico íntegro y reparación causal (en curso, PR #11 Draft, sin fusionar)

- Encargo vigente guardado en
  `docs/prompts/implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md`
  y diagnóstico de 20 auditorías en
  `docs/match/analysis/ME-07A-diagnostico-20-auditorias.md`. Rama nueva
  `claude/me-07b-v2-capitulo-tactico` desde `main` (`7b7eedd`, PR #10 ya
  fusionada); PR #11 Draft.
- Foto basal de las 20 auditorías recreada desde el `GameInput`
  (`scripts/me07b-v2-baseline-20.ts`, cuadro en
  `docs/match/analysis/ME-07B-v2-foto-basal-20.md`): mismos marcadores y
  tiros que el anexo del informe en los 20 partidos.
- **§2.1 Rebote.** Corrige el defecto de ME-01 (el retraso del cierre
  valía siempre cero y la ventana de vuelo usaba la llegada sin ajustar):
  un cierre legal y próximo —cerrador más cerca del aro que su rival y con
  contacto alcanzable durante el vuelo y antes de que el rival llegue— suma
  `closeoutReboundDelaySeconds(T19, F05)` **del cerrador** a la llegada **del
  rival**; pool, instante de control, hecho (`boxOuts`) y auditoría usan la
  llegada efectiva. El tirador no cierra mientras completa su gesto y cae
  de su salto antes de ir al rebote (`shooterLandingSeconds(F06)`, nueva
  hipótesis LAB-0.4). Efecto medido en la foto seed: OREB tras fallo de
  campo vivo 362/537 → 167/518 (Sierra) y 374/617 → 103/534 (Puerto); casi
  todo el efecto viene de la caída del tirador, no del retraso del cierre.
- Auditoría versionada a `ME-07B-AUDIT-1` con el punto `disputa_rebote`.
- **§2.2 Selección de familia.** `auto` proyecta en seco cada familia con su
  propia ejecución hasta la primera lectura real (misma frontera, reloj,
  ayudas y concesiones) y pondera la mejor vía por el riesgo de desvío de
  sus pases; se retiran los estimadores ad hoc. El monopolio del bloqueo
  directo persiste y queda explicado: el drop concede el roll libre en
  2.397 de 2.413 primeras lecturas de la foto seed (trabajo de §2.3).
- **§2.3 Defensa auto.** D5 decide la trampa al empezar a prepararse la
  pantalla (antes, al usarla: nunca era elegible); drop y trampa se
  comparan con su propia ejecución proyectada en seco desde la misma
  geometría y cada equipo combina esa proyección con lo que ya ha
  concedido o anotado en el partido (LAB-0.4,
  `blendProjectionWithObservation`). Foto seed: 484 trampas / 675 drops
  (Sierra defendiendo) y 443 / 733 (Puerto); Sierra +3 elige la mano a
  mano 128 veces. La trampa sube rebote ofensivo y pérdidas (pendiente).
- **§2.6 Atribución.** `result.summary.shots` enlaza cada FGA a su acción
  efectiva anterior y a la familia elegida antes que él en su fase;
  `byFamily` usa esa atribución. Invariante atribuidos + sin atribuir = FGA
  por equipo conservado.
- Semillas naturales de cuatro pruebas (bocina ×2, dos prórrogas/guardián,
  tapón) y dos huellas de regresión recalculadas con causa documentada.
- **§2.4 Roles.** Al organizar, creador (O1) y bloqueador (O5/O4) se
  asignan entre jugadores reales con la misma proyección en seco del
  selector de familia; los defensores siguen a su marca (sin cambio de
  emparejamiento instantáneo). Foto seed: el poseedor real crea 745/1.233
  veces (antes 34/1.182).
- **§2.4 Lecturas.** O5 lee aro, floater o inversión frente al mejor
  cierre real (D5 con una sola trayectoria de drop, que antes nunca
  contestaba al continuador, y D3); O1 añade el tiro parado (tiro medio o
  floater) y su triple cuenta el cierre de D1; D3 decide si ayuda al
  continuador comparando concesiones (orden `rollHelpCall`, «no dejar
  tirador de esquina»). Nuevos tipos de tiro `floater` (T02) y `mid_range`
  (T03), LAB-0.5; T02/T03 activas con relleno neutro 8.
- **§2.5 Transición.** El triple del portador se lee en su punto real de
  tiro tras la carrera con balón, con el cierre desde posiciones reales, y
  compite con el valor proyectado de organizar (antes se leía en el medio
  campo y nunca existía): 14 y 8 elegidos en la foto seed.
- **§2.5 Faltas.** Contactos defensivos reales —cierre legal con solape,
  trampa cerrada, rebote por encima de la espalda— se adjudican con M07
  (Disciplina, activa con relleno neutro 8; LAB-0.6). Foto seed: 70 → 230
  PF y ≈100 → 278 FTA; ya no dependen de las segundas oportunidades.
- **Rotación `ME-04-ROT-2`.** Con las faltas de contacto reales (§2.5) las
  exclusiones pasan a ≈0,7 por partido y la política rígida por rol paraba
  por guardián partidos ordinarios (3 de 60 semillas naturales en `f4fe5f8`)
  cuando ningún suplente declaraba el rol del excluido. Ahora un compañero
  en pista que declara ese rol se reajusta a él y entra el suplente del rol
  que deja; nadie juega fuera de un rol declarado. Si ni así hay relevo, el
  guardián sigue explicándolo (queda 1 de 60: los cuatro aleros declarados
  de Puerto excluidos; decisión requerida en el progreso).
- **§3 Ficha de libro (primer paso).** `PlaybookCard` une fase/condición,
  colocación, roles y sustitutos, primera acción, variantes, lecturas
  permitidas, seguridad y prioridad de las tres acciones organizadas
  existentes; decide qué colocaciones se ofrecen al organizar y se audita
  (`cardId`). Sin cambio de conducta (foto de las 20 idéntica).
- **§4 Ficha Horns→bloqueo (LAB-0.8), primera ficha «jugable».** Los dos
  interiores del quinteto en los codos (bloqueador y segundo cuerno), las
  esquinas llenas y el ala débil vacía; entrada por orden
  (`screenPlacement=horns`, «Colocación del bloqueo: Horns» en `/lab`) o por
  proyección en `auto`. Mismo árbol de coberturas con otra responsabilidad:
  ayuda al roll el defensor del segundo cuerno y deja un tiro medio en el
  codo (no un triple de esquina); la reparación sale de la esquina débil.
  Misma ficha ante drop/cambio/trampa → tres desenlaces distintos;
  ejecución, negación y continuidad en `me07b-v2-horns.test.ts`; `/lab`
  recorrido. Arreglos técnicos al construirla: la ayuda no se mete en el
  mismo punto que un continuador en carrera (antes, cada ayuda desde el
  codo era falta y un partido llegaba a `menos_de_cinco`), el cambio
  persiste tras un pase desviado recuperado, el marco se reasigna aunque
  gane el primer candidato, los tiros tras lecturas de cambio/show/a la
  altura/ICE tienen acción causante y cada tiro lleva `cardId`.
- **§4 Ficha Horns→Spain (LAB-0.9), jugable.** Desde Horns, el segundo cuerno
  pone un bloqueo ciego real a D5 (a contacto, en su retroceso al aro) y el
  manejador espera a que esté puesto; D5 queda retenido (T13/F05 frente a T16)
  y rodea al bloqueador; roll profundo al poste bajo débil y pop del bloqueador
  ciego. Entrada por orden («Variante encadenada: Spain» en `/lab`) o en `auto`
  frente a Horns→bloqueo; sin objetivo (cambio, trampa, show, a la altura)
  se juega el árbol de Horns. Respuesta defensiva nueva («Bloqueo ciego
  (Spain)»: seguir, ayudar desde la pintura o cambiar), por concesión en
  `auto`. Pruebas en `me07b-v2-spain.test.ts`; `/lab` recorrido. Semillas
  naturales recalculadas (dos prórrogas 984 → 1718; faltas sobre 8 partidos).
- **§4 Ficha Delay→DHO con puerta de atrás y entrada a poste con salidas
  (LAB-0.10), jugable por orden.** Interior arriba, entrega en mano con el
  cuerpo del pívot como pantalla, respuesta hundirse/cambiar/saltar la
  entrega (la negada da la puerta de atrás y el alto-bajo), poste con ayuda
  «dig» de la esquina, salida a la esquina, corte del ala débil y repostear.
  Solo por orden («Colocación: Delay»): en `auto` no compite todavía. Corregido
  en el recorrido de `/lab`: el corte atravesaba a su defensor y cada corte era
  falta tardía (3–5 excluidos por partido). Pruebas en `me07b-v2-delay.test.ts`.
- **Saques (stack, Iverson, box, diamond, elevator):** analizados, sin
  mecanismo nuevo; falta la primitiva de saque defendido (nota en la matriz).
- **§2.2/§5 El ataque proyecta contra la defensa observada.** Selector de
  familia y asignación de roles ponderan la concesión de cada cobertura que
  el rival ha mostrado por su frecuencia (`shownCoverageWeights`, LAB-0.4;
  sin muestras, drop como antes). Coste: ≈1,7 s por partido con auditoría
  (antes ≈0,65 s).
- **Diagnóstico de la bajada de puntos de v2-3** en
  `docs/match/analysis/ME-07B-v2-descomposicion-puntos-v2-3.md`: dos
  prórrogas, aciertos bajo lo esperado y mezcla defensiva; fuera de muestra
  sube. Decisión de Dennis sobre `menos_de_cinco` registrada en `RULES.md`
  (sin implementar).
- **§4–§5 Bloqueo directo lateral, ICE ejecutable y «a la altura» (LAB-0.7).**
  Segunda colocación real del bloqueo (`screenPlacement`, selector en
  `/lab`; en `auto` el poseedor real la elige con creador y bloqueador por
  la misma proyección en seco, punto `colocacion_bloqueo`), con su
  disposición y su short roll. ICE solo ante ella: D1 se pone del lado de la
  pantalla si llega antes del uso (M01/M05/F04), D5 baja a la ayuda baja, el
  bloqueador se abre al codo y O1 lee fondo, tiro medio, pase al bloqueador
  por la línea de D1, esquina fuerte o salida; ICE tardío juega drop.
  «A la altura» sube junto al bloqueador y vuelve con el continuador sin
  frenar al manejador; el show sale a la línea del manejador y le frena si
  llega antes que él, y vuelve al aro. `auto` compite entre siete
  coberturas. Foto seed (Sierra/Puerto): colocación lateral 55/32 de
  1.230/1.294; ICE elegido 9/38 (como defensa), a la altura 5/135, show
  1/61; puntos 1.201–1.210 (antes 1.317–1.307). 180/180 semillas 1–60 en
  las tres fotos `final` con acta conciliada. Semillas de prueba de
  bocina/prórrogas recalculadas (325, 69, 1, 246).
- **Rotación `ME-04-ROT-3` (decisión de Dennis, semilla 39).** Si ni el
  relevo por rol ni el reajuste ROT-2 completan el quinteto tras una
  exclusión, entra un suplente habilitado aunque no declare el rol vacante:
  la asignación de los cinco que conserva más roles declarados, la mayor
  capacidad pertinente en el puesto excepcional y desempate sin sorteo
  (reajustes, minutos, ID). Hecho, registro de sustitución y decisión
  auditada `sustitucion` dicen quién y por qué; sin malus ni cambios de
  perfil; el excluido no vuelve. Con menos de cinco habilitados sigue el
  guardián (caso reglamentario distinto, pendiente). Semillas 1–60 en las
  tres fotos: 180/180 `final` con acta conciliada (antes la 39 seed paraba).
- **§5 Coberturas.** `auto` compite entre drop, trampa, cambio, show, por
  debajo e ICE con la misma proyección en seco. Cambio: D5 canta y sale a
  la altura del bloqueo, D1 se queda con el bloqueador y el desajuste
  persiste en la posesión. Show: D5 sale y vuelve cuando D1 supera la
  pantalla. Por debajo: D1 pasa entre el bloqueador y su defensor; niega
  roll y penetración, pero el cierre del triple tiene que rodear al
  bloqueador y llega tarde (margen medio −0,60 s → +0,27 s en la semilla
  92; O1 elige triple 6 → 120 veces). ICE: no elegible ante el bloqueo
  central (orden manual → drop con el motivo); el ICE ejecutable espera al
  bloqueo lateral. Foto seed, coberturas de Sierra defendiendo: trampa 349,
  drop 757, por debajo 125, cambio 40, show 48 (Puerto: 236/775/55/61/139).
- **Pendiente**: ICE ejecutable y at the level, falta en
  ataque, respuesta defensiva «cerrar» tras el tiro (probada y retirada en
  v2-1; OREB tras fallo vivo aún 35–38 %), §§3–7 completos (gramática,
  estructuras, libro, inventario, 15 atributos candidatos restantes, UI de
  Ataque/Defensa/Libro, plan manual). ME-07B no está terminada.

## ME-07B — Cierre de ME-07A y motor táctico integrado (en curso, sin fusionar)

- Prompt guardado íntegro en
  `docs/prompts/implementation/ME-07B-cierre-me-07a-motor-tactico-integrado.md`,
  en la misma rama/PR de ME-07A (#10, Draft), sin crear rama ni PR nueva.
- Foto basal reproducible de cuatro semillas naturales (1/37/82/156, ambos
  equipos en auto) capturada con `scripts/me07b-baseline-snapshot.ts` antes
  de tocar comportamiento; confirma con evidencia fresca los defectos de
  §2 (monopolio de bloqueo directo 96–98 %, cobertura auto=drop siempre,
  `organizacion_creador` casi inerte) y añade un hallazgo nuevo: la lectura
  de triple de transición tiene **cero** decisiones auditadas en juego
  natural, no solo cero aciertos. Detalle en
  `docs/prompts/implementation/ME-07B-PROGRESS.md`.
- **Elimina el veto absoluto T04>=9 de un triple legal** (§2), en la
  primera lectura del bloqueo directo (`runDropPhase`) y en el estimador
  de oportunidad de familia (`estimateBloqueoDirectoOpportunity`): un
  triple detrás de la línea es siempre una vía real; calidad (T04 en
  `shotProbability`) y oposición (ventana real de cierre de D5, la misma
  que ya usaba la lectura del bloqueo) deciden su valor frente a las
  demás vías, no una capacidad binaria. Huella de `me04.test.ts` (7)
  recalculada con causa documentada (mismo precedente que ME-07A);
  `me04b.test.ts` actualizado para exigir que un T04 bajo compita por
  valor situacional en vez de excluirse por `reasonCode` de capacidad.
- **Pendiente, no cerrado en esta sesión**: el resto de defectos de §2
  (monopolio de familia por falta de comprobación de ventana inmediata,
  triple de transición inalcanzable en juego natural, `organize()` casi
  siempre vuelve a O1, `shotTendency` en la política común, trampa nunca
  elegible por la posición inicial de D5, prueba de partido con guardián,
  atribución de FGA por acción causal) y la totalidad de §§3-9 (capa
  táctica compartida, estructuras/libro/familias nuevas, defensa
  asentada/presión/cobertura ampliada, 45 atributos, UI de `/lab`,
  auditoría ME-07B-AUDIT-1, documentación y plan manual). No se declara
  ME-07B terminada; la PR permanece en Draft.

## ME-07A — Decisiones vivas de jugadores y partido táctico automático (sin fusionar)

- Prompt guardado íntegro en
  `docs/prompts/implementation/ME-07A-decisiones-vivas-y-partido-auto.md`
  antes de modificar producto. Ejecutado en la rama `claude/new-session-p9xna7`
  (el entorno de ejecución ya la tenía activa y sincronizada), no en la rama
  propuesta `match/me-07a-decisiones-auto` (ver `docs/prompts/README.md`).
- **Corrige el desfase de `phaseIndex`** entre decisiones (`seleccion_familia`,
  `organizacion_creador`) y hechos reales (`pushEvent`/`phase.index`), que
  rompía `result.summary.byFamily` sistemáticamente. Nuevo desglose
  `byFamilyUnattributed` por equipo para verificar la invariante FGA
  atribuidos + sin atribuir = FGA del acta. Regresión en
  `domain/audit/phase-index-attribution.test.ts`.
- **Tendencia individual de tiro** (`shotTendency`:
  `prudente`/`equilibrada`/`decidida`), ortogonal a `pnrTendency` y a
  T04/T01, añadida a los 24 perfiles del fixture, la persistencia
  (Postgres, `DEFAULT 'equilibrada'`) y el editor de `/lab`.
- **Prioridad de creación del entrenador** (`equilibrado`/`buscar_aro`/
  `buscar_triple`, por equipo) y generalización de la banda de empate
  `FIRST_READ_TIE_BAND_POINTS` (LAB-0.3) más allá de la primera lectura
  del bloqueo directo: dentro de la banda, la prioridad favorece primero
  una vía compatible; si sigue compitiendo un tiro con la continuación,
  decide `shotTendency` (`pnrTendency` conserva su papel específico solo
  en la primera lectura del bloqueo). Aplicado a la primera lectura de la
  mano a mano (que no tenía ningún mecanismo de banda hasta ahora) y al
  triple de transición.
- **Triple del portador en transición**: cuando el aro está contenido pero
  el portador queda detrás de la línea con separación y tiempo reales
  (nuevo `TRANSITION_THREE_DEPTH_BUFFER_METERS`, declarado), la tendencia
  de tiro decide si lo toma. Probado con geometría construida a mano
  (`evaluateTransitionThreeOpportunity`).
- **El poseedor real puede conservar la iniciativa al organizar**
  (`organize()`): compara, con geometría real, si conservarla es al
  menos tan rápido como el pase de vuelta al rol fijo O1; si lo es,
  reasigna roles con `rebindFrame` (mismo mecanismo que la segunda
  entrada). Confirmado con el fixture natural: jugadores reales (incluidos
  suplentes) conservan la iniciativa en 5 de 219 decisiones de un partido
  completo.
- **Cobertura y orden sin balón `auto`** para el partido completo: la
  defensa compara, sin RNG, la concesión de cada respuesta con fórmulas
  de valor ya existentes y conserva `drop`/`guardar_espacio` como plan
  base si no distingue una claramente mejor. Hallazgo de calibración
  documentado (no oculto): con la disposición inicial fija de los
  escenarios de laboratorio, la trampa `auto` nunca resulta elegible
  (pendiente para ME-07B).
- Corrige de paso un defecto real descubierto al construir el triple de
  transición: la cuenta de 8 s (art. 28) no se comprobaba cuando una vía
  nueva despachaba directo a `runCore` fuera del flujo habitual, lo que
  podía disparar el guardián de progreso por hechos desordenados.
- Esquema de auditoría versionado a `ME-07A-AUDIT-1` (nuevos puntos
  `seleccion_cobertura`/`seleccion_orden_sin_balon`, `creationPriority`/
  `shotTendency` en la huella); no reinterpreta `ME-06-AUDIT-1`. Ver
  `docs/decisions/ADR-0009-generalized-tendency-priority-and-auto-defense.md`.
- Reserva del identificador `ME-07` para táctica y decisiones
  (`ME-07A`/`ME-07B`, decisión de Dennis); el generador de plantillas
  ficticias queda aplazado con un identificador por decidir (ver
  `docs/match/roadmap.md`).

## ME-06 — Mano a mano sin balón, correccion acotada de ME-04B y laboratorio comparativo (sin fusionar)

- Prompt guardado íntegro en
  `docs/prompts/implementation/ME-06-ataques-variados-correccion-ME04-laboratorio.md`
  antes de modificar producto. Ejecutado en la rama `claude/new-session-p9xna7`
  (el entorno de ejecución ya la tenía activa y sincronizada), no en la rama
  propuesta `match/me-06-variedad-y-laboratorio` (ver `docs/prompts/README.md`).
- **Corrección acotada de ME-04B** (`possession-core.ts`, diagnóstico de las
  ocho auditorías `ME-04B-AUDIT-1`: 1790/1797 primeras lecturas elegían
  `pase_o5`): `finalizar` ya no se descarta por una carrera de reloj cruda,
  sino por la misma contención geométrica real que ya usan D3/O5 (solape de
  radios corporales en el instante real de liberación); si D5 llega pero no
  llega a solapar, la vía sigue viable y se puntúa contestada. `pase_o5`, en
  el tramo donde D3 contendría de verdad la recepción, ya no puntúa una
  inversión a O3 todavía dependiente de una segunda decisión y una segunda
  proyección defensiva: puntúa con la misma fórmula de tiro contenido que ya
  usa la propia lectura real de O5. Ninguna de las dos vías cambia respecto a
  antes cuando su condición real no aplica.
- **Segunda familia posicional: mano a mano sin balón** (`possession-core.ts`,
  `runHandoffPhase`, extiende el mismo núcleo compartido, no un módulo
  paralelo): O1 encuentra a O5 en el codo alto; O5 da un mano a mano real a
  O2 (negable por D2, o por D5+D2 en trampa); O4 coloca un bloqueo indirecto
  para que O3 corte desde el lado débil (negable por D3, con ayuda opcional
  de D4 que abre a O4 y contesta el tiro de O3). Primera lectura real entre
  finalizar/pase a O3/continuar a O4/seguridad a O1, por el mismo valor
  situacional que el bloqueo directo. Activa por primera vez un mecanismo
  para T21 (desmarque), sin fórmulas LAB-0.1 nuevas.
- **Selector de plan ofensivo por equipo** (`offensivePlan`:
  `auto`/`bloqueo_directo`/`mano_a_mano_sin_balon`, por defecto `auto` en
  partido): `auto` evalúa de forma pura —sin RNG, sin ejecutar la vía
  descartada— la oportunidad de entrada de cada familia desde el estado real
  heredado y elige la de mayor valor; confirmado en casos construidos que
  elige cada familia cuando de verdad es mejor. La segunda entrada del
  bloqueo directo (kick-out) sigue siendo exclusivamente del bloqueo directo:
  no reevalúa la familia.
- **Orden de defensa sin balón por equipo** (`offBallDefensiveCall`:
  `negar_primera_salida`/`guardar_espacio`, por defecto `guardar_espacio`):
  desplaza la navegación real de D3 y decide si D4 ayuda; confirmado que
  ambas producen decisiones distintas y estables con la misma plantilla y
  semilla (ver muestra comparativa en `docs/match/SCENARIOS.md`).
- **Auditoría** (`ME-04B-AUDIT-1` → `ME-06-AUDIT-1`): nuevos puntos de
  decisión (`seleccion_familia`, `entrada_mano_a_mano`,
  `transferencia_mano_a_mano`, `bloqueo_indirecto_o3`,
  `lectura_mano_a_mano`); `input.teams[]` declara `offensivePlan`/
  `offBallDefensiveCall` y el `fixtureDiff` de cada jugador frente al
  fixture; huella estable de equipo/partido (`fingerprint`/
  `matchFingerprint`) que excluye semilla, `gameId`, `exportedAt` y
  `buildId`; `result.summary.byFamily` con entradas y tiros reales por
  familia y equipo (con hueco de cobertura declarado para transición/segunda
  oportunidad/segunda entrada). No reinterpreta los ocho archivos
  `ME-04B-AUDIT-1` ya descargados.
- **Controles de laboratorio** (`/lab`, `ProfileControlsPanel`): selección
  múltiple por equipo, «Restaurar desde el seed» (atómico, con confirmación,
  respeta jugadores manuales fuera del fixture) e incremento masivo +1/+3/+5
  sobre los 27 atributos activos (atómico, `min(15, valor actual +
  incremento)`, validación en servidor). Nuevo método
  `LabTeamRepository.savePlayers` (upsert múltiple en una transacción
  Prisma). Selectores de plan ofensivo y orden de defensa sin balón por
  equipo en la sección de partido completo; el marcador muestra el plan/
  orden reales de cada equipo.
- `GAME_VERSION`: `ME-04B-GAME-1` → `ME-06-GAME-1`.
- Documentación actualizada en `docs/match/{README,ACTIONS,CAPABILITIES,
  RULES,SCENARIOS,BOXSCORE,AUDIT,roadmap}.md` (roadmap marca ME-06 como
  implementada, adelantada antes de ME-05, sin cambiar identificadores
  históricos) y plan manual nuevo en
  `docs/testing/manual/ME-06-manual-test-plan.md`.
- Suite completa de dominio en verde (`npm run check` sin PostgreSQL);
  recorrido manual de `/lab` pendiente de confirmación por Dennis (ver PR).

## ME-04B — Lecturas del bloqueo, oposición real y auditoría reparada (sin fusionar)

- Prompt guardado en
  `docs/prompts/implementation/ME-04B-lecturas-oposicion-y-auditoria.md`
  antes de modificar producto. Ejecutado en la rama `claude/new-session-p9xna7`
  (el entorno de ejecución ya la tenía activa y sincronizada; ver
  `docs/prompts/README.md`), no en la rama propuesta `match/me-04b-lecturas-oposicion`.
- **Desplazamiento real de O1/D1 en la pantalla** (`possession-core.ts`):
  ambos se desplazan de verdad hasta el punto de uso de la pantalla —junto
  a O5, con el margen de 0,70 m del radio corporal combinado— en vez de
  permanecer congelados en su posición de partida durante el resto de la
  posesión (diagnóstico de la auditoría 210 A). D1 lo sigue con el retraso
  real de `screenDelay`.
- **Primera lectura del bloqueo ponderada por valor** (`possession-core.ts`,
  §3.2): las cinco vías (finalizar, pase a O5, pase a O3, triple de O1,
  salida segura) se evalúan de verdad con un valor de tiro situacional
  (`puntos × shotProbability`) en vez de cortarse siempre en `pase_o5`; una
  banda de empate de 0,15 puntos esperados (`FIRST_READ_TIE_BAND_POINTS`,
  LAB-0.3) se resuelve por la tendencia del jugador.
- **Modelo geométrico `R_contest`** (`domain/lab/lab-0-3-parameters.ts`,
  §3.3): separa «¿puede un defensor oponerse al tiro sin tocar al tirador?»
  (alcance de brazos, C03/200 + radio corporal) de «¿hubo contacto
  sancionable?» (0,70 m combinados, sin cambios). El tapón vuelve a ser
  elegible con cualquier oposición geométrica real, no solo con el defensor
  ya colocado de antes.
- **Auditoría** (`ME-04A-AUDIT-1` → `ME-04B-AUDIT-1`): `holderId`/
  `participants` resuelven a IDs reales de pista en un único punto;
  `factLink` busca el hecho realmente emitido en vez de reutilizar el
  instante de la decisión, y se sanea contra la línea de tiempo final del
  partido (`sanitizeAuditFactLinks`) para que un hecho calculado que no
  llega a ocurrir (bocina, guardián) deje un enlace ausente explícito;
  `rejectionReasons` separa `chosenByReasonCode` de
  `alternativesByReasonCode`.
- Recalibrado `closeout_tardio_con_contacto` (posición de partida de O1 y
  de D4) para que la falta ordinaria de tiro tardía siga siendo alcanzable
  con la nueva geometría de O1.
- Pruebas nuevas: `domain/simulation/me04b.test.ts`, `domain/game/me04b.test.ts`,
  `domain/audit/audit-export-me04b.test.ts` (casos construidos: pantalla y
  persecución real, primera lectura con varias vías, oposición sin contacto,
  ayuda/cierre que libera a O4, negar salida y segunda entrada). Semillas y
  huellas de regresión de ME-01..ME-04A recalculadas donde el mecanismo
  cambia intencionadamente, documentado en cada prueba.
- Documentación actualizada: `docs/match/{ACTIONS,CAPABILITIES,RULES,
  SCENARIOS,AUDIT,README}.md`, `docs/match/roadmap.md` (bloque ME-04B entre
  ME-04A y ME-05), la decisión pendiente de ME-04 (ventaja temprana resuelta
  en parte; faltas sin tiro y segunda entrada siguen sin producirse de forma
  natural), y `docs/testing/manual/ME-04B-manual-test-plan.md`.
- `npm run check` en verde sin PostgreSQL.

## ME-04A — Auditoría exportable de partidos detallados (sin fusionar)

- Prompt guardado en
  `docs/prompts/implementation/ME-04A-auditoria-exportable-partidos.md`
  antes de modificar producto.
- **Colector de auditoría** (`modules/match/domain/audit/`): opcional y
  enhebrado por `playFullGame` → `LinkedRun` → `computePossessionCore` y los
  resolutores de drop/trampa, segunda entrada, tiro/rebote y falta sin tiro.
  Colector nulo por defecto (coste y comportamiento idénticos a antes de
  ME-04A, verificado en `audit-export.test.ts`); colector real solo cuando
  `GameInput.auditEnabled` está activo.
- **`buildAuditExport`** (`domain/audit/build-audit-export.ts`): función
  pura que ensambla el `.json` versionado (`ME-04A-AUDIT-1`) desde el
  `GameInput`/`GameResult` ya calculados, sin recalcular ni volver a jugar
  el partido.
- **`/lab`**: interruptor «Registrar auditoría» (activado por defecto) antes
  de «Jugar partido» y botón «Descargar auditoría (.json)» tras un partido
  resuelto (incluida una parada de guardián, sin ganador inventado); cambiar
  semilla, cobertura, prioridad o el interruptor invalida la descarga
  anterior.
- Documentación nueva `docs/match/AUDIT.md`; `docs/match/README.md`,
  `docs/match/roadmap.md` (ME-04A implementado, sin desplazar ME-05) y
  `docs/testing/manual/ME-04A-manual-test-plan.md` actualizados. La
  decisión pendiente de ME-04 sobre el alcance natural de faltas y segunda
  entrada sigue **pendiente**, ahora con mejor evidencia trazable.

## ME-04 — Primer partido reglamentario FIBA (sin fusionar)

- Prompt guardado en `docs/prompts/implementation/ME-04-primer-partido-fiba.md`
  antes de modificar producto.
- **Partido completo** (`modules/match/domain/game/`, `playFullGame`): una
  sola foto de los dos equipos (hasta doce inscritos), 4 × 10:00 desde el
  salto inicial `ME-04-JUMP-1` y prórrogas de 5:00 hasta desempatar; flecha
  de alternancia, cambio de canastas en C3, bocina con tiro soltado a
  tiempo, reloj que solo se detiene tras canasta desde 2:00 en C4/prórroga,
  faltas personales y de equipo con bonus (C1–C3 separados, prórrogas en
  C4), saque tras falta con 24/14 s (art. 29), quinta personal con
  sustitución obligatoria, libres con el tirador real. Adjudicación en
  funciones puras (`fiba-2026-rules.ts`), acta proyectada de los hechos
  (`box-score.ts`) con conciliación. Guardián sin ganador falso.
- **Motor de continuidad compartido** (`domain/sequence/linked-run.ts`,
  ADR-0007): el tramo de ME-03 es ahora una subclase; su huella (y la de la
  posesión individual y los lotes) es idéntica a la de `main`.
- **Núcleo** con reglas de partido opcionales: libres diferidos, infractor
  en la falta de tiro, vía sin tiro por contención del continuador (FIBA
  art. 33.5, geometría y frenada) y **segunda entrada** del bloqueo cuando
  la primera lectura queda negada. Sin esas reglas, ME-01/02/03 no cambian.
- **Banquillo**: siete suplentes escritos a mano por equipo (SC06–SC12,
  PA06–PA12) con roles funcionales declarados; los diez titulares no
  cambian. Rotación automática fija `ME-04-ROT-1` en oportunidades legales
  del art. 19. La siembra pasa a `seedLabRoster` (caso de uso probado):
  solo crea lo que falta.
- **`/lab`**: sección «Partido completo» (plantillas, cobertura y prioridad
  por equipo, semilla, «Jugar partido», visor por período → posesión →
  evento con cancha, faltas y bonus, sustituciones, acta con minutos/DNP y
  conciliación) y seis **casos de frontera** etiquetados como fixtures de
  prueba (bocina, reset 13/14 s, and-one, bonus y quinta, dos prórrogas,
  canasta a 2:00).
- **Pruebas**: 32 nuevas en `domain/game/me04.test.ts` (§8 puntos 1–7) más
  siembra y caso de uso; 157 en total, en verde sin base de datos.
- **Barrido del fixture** (60 partidos): 0 paradas del guardián, 3 con
  prórroga, 63 faltas (todas de tiro), 0 sin tiro, 0 bonus, 0 segundas
  entradas y 0 ventajas tempranas; el continuador acapara los tiros. Se
  registra como `DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`
  (no bloquea). No se ha tocado ningún coeficiente, posición ni la opción B.
- **Rendimiento** (`npm run profile:game`, 12 partidos, semillas 1–12, sin
  BD, Xeon 2,1 GHz de 4 núcleos del contenedor): mediana 204 ms por partido,
  peor 258 ms; ~4 600 hechos y ~205 posesiones; ~1 ms por posesión (tres
  veces el tramo: el coste crece con trayectorias más largas y el GC);
  proyección del acta ~2,4 ms; ~8 MB retenidos por resultado.
- Recorrido real: PostgreSQL 16 local, migraciones al día, seed no
  destructivo (14 creados, ediciones conservadas) y navegador Chromium
  (Playwright) sobre `next start`: partido, C3, prórroga, acta con
  suplentes, casos de frontera, edición/recarga de un titular, posesión,
  tramo y lote.
- Plan manual: `docs/testing/manual/ME-04-manual-test-plan.md`.

## ME-03 — Aclaración: ventaja temprana, opción B (sin fusionar)

- Guardado el prompt en
  `docs/prompts/implementation/ME-03-aclaracion-ventaja-temprana.md`.
  Dennis resuelve `DECISION-REQUERIDA-ME-03-ventaja-temprana.md` con la
  **opción B**: leer también la superioridad numérica en el instante real
  en que el balón entra en pista delantera, no solo la carrera directa al
  aro.
- **`readTransition`** (`domain/sequence/transition.ts`): un defensor solo
  cuenta como protector si, en ese instante (posición real, no una carrera
  hipotética desde la salida), ya está entre el balón y el aro atacado.
  Nueva lectura **3×2** (`superioridad_3x2`): cuando el corredor también
  queda contenido pero un segundo receptor exterior recibe el pase directo
  del portador antes de que exista un tercer defensor ya situado.
- **`play-tramo.ts`**: la trayectoria de subida de balón se programa de
  verdad (`moveGlobal`) antes de leer el cruce de media pista, para que las
  diez posiciones en ese instante sean reales, no congeladas. La ventaja se
  resuelve con `resolvePass`/`resolveShotAttempt`, sin árbol estadístico
  aparte.
- 4 pruebas discriminantes nuevas en `me03.test.ts` (3×2 ejecutable, ambas
  opciones cerradas → ataque organizado, prioridad de rebote que cambia
  tiempos sin cambiar resultados por cuota) más una prueba que documenta
  que un defensor todavía no situado ya no cuenta como protector. 120/120
  pruebas del módulo en verde.
- **Barrido del fixture real** (semillas 1–1000 × cuatro combinaciones de
  prioridad × drop/trampa, 8 000 tramos, 24 000 lecturas de transición):
  **0 ejecutadas, 24 000 neutralizadas**. El mecanismo en sí es correcto
  (probado con geometría construida a mano); la causa de que este fixture
  concreto nunca abra una ventana es que el defensor de `drop` permanece
  siempre cerca del aro que protege y llega solo, por sí mismo, entre 0,25
  y 1 s antes que cualquier atacante en tránsito, incluso en el ~6,7% de
  lecturas donde 1 o 2 de los otros cuatro defensores quedan legítimamente
  excluidos por no estar aún situados. No se ha ajustado ningún
  coeficiente ni posición del fixture para cambiar esta frecuencia. Detalle
  en `docs/match/ACTIONS.md` y en la resolución de la decisión.
- Documentación actualizada: `docs/match/{ACTIONS,SCENARIOS}.md`,
  `docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md` (resuelta)
  y `docs/decisions/README.md`.
- Pendiente: el recorrido real de navegador y PostgreSQL no se ha
  ejecutado en este contenedor (sin navegador ni base de datos
  disponibles aquí). Verificar desde un entorno con ambos, en `main` tras
  la fusión que decida Dennis, con el plan
  `docs/testing/manual/ME-03-manual-test-plan.md` (semillas 1, 3, 27 y las
  cuatro combinaciones de prioridad).

## ME-03 — Posesiones enlazadas y transición (sin fusionar)

- Guardado el prompt de implementación en
  `docs/prompts/implementation/ME-03-posesiones-enlazadas-y-transicion.md`.
- **Tramo enlazado** (`modules/match/domain/sequence/`): hasta cuatro
  posesiones estadísticas desde `drop_con_ayuda` (7:12 C1, 18 s) con los
  mismos diez jugadores, balón y cancha global. Separa evento, fase,
  posesión estadística, equipo con control, derecho a saque y balón suelto.
  Termina por cuatro posesiones cerradas, tiempo reglamentario agotado o
  guardián, y lo muestra. Snapshot único (`TramoInput`) con semilla,
  perfiles copiados, planes, cobertura y versiones (`ME-03-TRAMO-1`).
- **Fronteras y relojes FIBA 2026 alcanzables** (`fiba-clock-rules.ts`):
  rebote ofensivo = fase nueva con 14 s; rebote defensivo, robo o balón
  suelto rival = posesión nueva con 24 s (sin robo inventado); tapón sin
  aro recuperado por el mismo equipo sin reinicio; saques tras canasta,
  último libre, balón fuera y violación con 24/14 s según pista; reloj de
  partido que no se detiene por canasta en C1, parado en libres, fuera y
  violaciones, y que vuelve con el toque legal; cuentas de 8 y 5 s y
  liberación antes de 24 s con fronteras exactas.
- **Carga frente a balance** por equipo: encargos antes de conocer el tiro,
  por llegada real al aro (F01) y desempate por ID; desplazamientos reales
  hacia el aro o la línea central; quien retorna no disputa el rebote.
- **Transición**: salida al base con carrera de intercepción, lecturas de
  penetración, pase adelantado y 2×1 por llegadas reales, o «Sin ventaja:
  ataque organizado» con recorridos y reloj consumido; segunda oportunidad
  con el criterio de la opción 1 o reorganización con 14 s. Sin
  multiplicador de ataque temprano.
- **Núcleo compartido en modo enlazado** (ADR-0006): marco local por giro
  de 180°, roles canónicos asignados a jugadores reales, generador
  reanudable. Sin la opción, ME-01/ME-02 producen exactamente la misma
  huella que antes (prueba de regresión con hash).
- **Interfaz `/lab`**: sección «Jugar tramo» separada, prioridades por
  equipo, visor por eventos y por posesiones con cancha completa, relojes,
  control, marcador, encargos y motivo de la entrada de cada fase.
- 20 pruebas nuevas en `domain/sequence/me03.test.ts`.
- Perfil de coste (`npm run profile:tramo`, semillas 1–100, sin BD, mismo
  proceso, Node 22, 4 núcleos): media 1,35–1,98 ms por tramo y
  0,34–0,50 ms por posesión según configuración; peor tramo 5,78 ms
  (semilla 21, drop, ambos «Proteger balance»); máximo 184 hechos en un
  tramo (semilla 99, trampa). Sin bucles: los 8 000 tramos de semillas
  1–1000 terminan por cuatro posesiones cerradas.
- `DECISIÓN REQUERIDA` sobre el criterio de ventaja temprana
  (`docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md`): con el
  fixture, el balance de dos o tres jugadores nunca concede transición.
- Plan manual en `docs/testing/manual/ME-03-manual-test-plan.md`.

## ME-02 — Trampa, salidas reales y tres correcciones de ME-01 (sin fusionar)

- Guardado el prompt de implementación en
  `docs/prompts/implementation/ME-02-trampa-y-salidas-con-correcciones-me01.md`.
- **C1 (contacto/falta de tiro):** la legalidad del cierre ya no compara
  solo dos marcas de reloj. Se reconstruye la posición real del defensor
  en el instante de liberación (`positionAtInstant`) y solo hay contacto u
  oposición si su espacio corporal (radio LAB-0.2 de 0,35 m por jugador)
  se solapa de verdad con el del tirador. O5 recorre de verdad su
  continuación desde la pantalla hasta el short roll real `(23,0; 7,5)` en
  vez de finalizar desde la posición del bloqueo. Rechaza el falso
  contacto geométrico que producía ~982-983 faltas/1500 corridas con ayuda
  frente a 0 sin ayuda.
- **C2 (esquina débil alcanzable):** O5, tras recibir el pase, activa una
  segunda lectura real (misma geometría de contacto que C1): si D3
  realmente contiene el roll, O5 puede invertir hacia O3 en la esquina
  débil sin reiniciar el reloj. Con ayuda, un lote de 1500 corridas
  demuestra al menos un pase a la esquina; sin ayuda, nunca se regala O3.
- **C3 (estadística conciliada):** nuevo hecho `field_goal_attempt`,
  separado de la oportunidad de tiro (`shot_prepared`): no cuenta FGA en
  una falta de tiro fallada; cuenta 1 FGA/1 FGM en canasta con falta
  (and-one); cuenta FGA en tapón legal. El resolvedor rápido agrega
  2FGA/2FGM, 3FGA/3FGM, FTA/FTM y puntos (2×2FGM+3×3FGM+FTM) desde la
  misma taxonomía de hechos que el motor detallado, versionados como
  `LAB-0.2`.
- **Cobertura de trampa:** nuevo campo `coverage` en `MatchInput`
  (`"drop" | "trampa"`), independiente del escenario. D1 sigue a O1 por la
  pantalla; D5 sale a comprometerlo junto a D1 (`trap_committed`, solo si
  llega); D3 pasa a low man sobre el short roll; D4 rota hacia la amenaza
  que deja D3 (O3), exponiendo a O4; D2 mantiene el lado fuerte. La trampa
  se juzga cerrada en el instante en que el pase a O5 llegaría, no en el
  instante de decidir; una trampa cerrada aplica presión real de dos
  defensores (T07 vs T15, sin robo garantizado); una trampa rota abre un
  carril directo o una salida a O4 sin canasta garantizada.
- **M09 (Comunicación):** nueva capacidad activa (27 en total). Añade una
  latencia de coordinación entre un aviso defensivo reconocido (D5→D3,
  D3→D4) y la respuesta del receptor. Perfiles nuevos del fixture reciben
  valores por plantilla/rol; perfiles ya persistidos sin M09 reciben el
  valor neutro 8 hasta que el usuario lo edite y guarde.
- Interfaz `/lab`: selector de cobertura (drop/trampa) para la misma
  posesión; tabla nueva «Misma posesión: drop/trampa (con ayuda)»,
  separada visualmente de «Drop: ayuda sí/no»; ambas muestran categorías
  en español (sin claves internas), sus propias entradas/versiones, y se
  desactualizan al cambiar perfiles, cobertura, semilla o tamaño de lote.
- Seed de laboratorio (`prisma/seed.ts`) ahora no destructivo por defecto:
  crea equipos/jugadores que falten sin sobrescribir ediciones ya
  guardadas; `LAB_SEED_FORCE_RESET=1` restablece el fixture de forma
  deliberada.
- Añadidas 15 pruebas discriminantes nuevas en
  `domain/simulation/me02.test.ts` (reproducibilidad con trampa, C1 sin
  falta por mera llegada, closeout tardío alcanzable, rechazo del
  experimento de ~982 faltas, C2 esquina alcanzable/no regalada, trampa
  cambia responsabilidades y puede abrir salida sin garantizar
  robo/canasta, M09 solo desplaza el instante del aviso, C3 conciliación
  FGA/FGM/FTA/FTM/puntos incluido and-one, y misma taxonomía de hechos en
  rápido/detallado).
- Actualizados `docs/match/{README,MODEL,ACTIONS,CAPABILITIES,SCENARIOS,RULES}.md`
  y estado de ME-02 en `docs/match/roadmap.md`.
- Plan de prueba manual: `docs/testing/manual/ME-02-manual-test-plan.md`.

## HF-002 — Integridad de la posesión ME-01 y comparación rápida real (sin fusionar)

- Guardado el prompt del hotfix en `docs/prompts/hotfix/HF-002-me01-integridad-y-rapido.md`.
- Extraído el árbol de decisión y las fórmulas LAB-0.1 a un núcleo
  compartido (`domain/simulation/possession-core.ts`, ADR-0005), usado
  tanto por el motor detallado como por el resolvedor rápido.
- Corregido el balón: un tapón o una pérdida en balón vivo dejan el balón
  suelto (no muerto en el aro); un robo lo deja en poder real del
  defensor; solo una canasta lo deja muerto en el aro.
- Corregida la instantánea de cada hecho: se reconstruye desde el
  historial real de llegadas, no desde la posición ya mutada para
  cálculos posteriores (D3/D4 ya no aparecen en su destino antes de
  llegar).
- Corregido el rebote ofensivo: el resolvedor rápido cuenta cada rebote
  ofensivo real desde la línea de tiempo de hechos, no solo el terminal
  final de la corrida; `resolveRebound` ya no llama "fuera" a un balón
  dentro de la cancha solo porque nadie llega en la ventana de vuelo, y el
  palmeo se decide por T20 solo entre quienes realmente llegan.
- Conectados T22 (defensa perimetral) y T23 (defensa interior) a las
  llegadas de cierre/protección reales; añadida la elegibilidad de tapón
  (T18) por alcance físico real del defensor sobre el punto de
  liberación del tiro.
- Ejecutados de verdad los libres de una falta de tiro (T05 + semilla,
  puntos y reloj); el último libre fallado se resuelve como un rebote
  vivo real, incluida la continuación ofensiva si corresponde.
- Sustituida la aproximación rápida: ya no llama a `runPossession` ni
  construye relato/snapshots por muestra; mide ≈1,5–1,75× más rápida que
  ejecutar el detallado en lote (mismo equipo, mismas semillas,
  calentamiento y cálculo separado de render/BD).
- Interfaz `/lab`: se muestra el escenario, semilla, reglas y versión de
  parámetros de cada resultado (individual y de lote); un cambio de
  escenario, semilla o roster limpia el resultado anterior; la
  comparación por lotes aclara que siempre compara ayuda sí/no,
  independientemente del escenario seleccionado.
- Añadido ADR-0005 y actualizados `docs/match/{MODEL,RULES,SCENARIOS,ACTIONS,CAPABILITIES}.md`,
  el plan de prueba manual de ME-01 y `docs/process/{WORKFLOW,DEFINITION_OF_DONE}.md`
  (secuencia: recorrido básico de Claude antes de dejar la PR sin fusionar,
  prueba profunda de Dennis después de fusionar, desde `main`).

## ME-01 — Primera posesión integrada y Laboratorio de Partido (sin fusionar)

- Guardados el prompt de implementación y el hotfix HF-001 (sincronización
  de rama) en `docs/prompts/`.
- Creado el módulo `modules/match/` (domain/application/infrastructure/ui):
  atributos y perfiles de jugador (26 capacidades activas, escala 1–15,
  `E−`…`A+`), parámetros LAB-0.1 tipados y acotados, tres escenarios de
  bloqueo directo central, motor detallado con árbol de decisión y relato
  por pasos, y aproximación rápida por lotes reutilizando el mismo motor.
- Añadidos los modelos Prisma `LabTeam`/`LabPlayer` con migración real y
  script de siembra idempotente de los diez perfiles del fixture.
- Añadida la interfaz `/lab`: editor de jugadores agrupado, cancha
  esquemática, relato paso a paso con detalle seleccionable, y comparación
  rápida de la ayuda de D3.
- Añadido ADR-0004 (llegada analítica en vez de interpolación cada 100 ms)
  y la documentación activa del módulo (`docs/match/`).
- Actualizados `docs/foundation/CURRENT_SCOPE.md`, `docs/roadmap/ROADMAP.md`,
  `docs/architecture/TECHNICAL_ARCHITECTURE.md` y `modules/README.md` para
  reflejar que ME-01 es la entrega vigente.

## FND-001 — Foundation general y arquitectura técnica (sin fusionar)

- Base de bootstrap en `main` (README provisional) como excepción
  irrepetible, al tratarse de un repositorio recién creado.
- Guardado el prompt de implementación literal en
  `docs/prompts/implementation/FND-001-foundation-general-and-technical-architecture.md`.
- Creado el esqueleto ejecutable: Next.js (App Router) + TypeScript
  estricto + Prisma + PostgreSQL + Tailwind CSS + Vitest + ESLint.
- Creada la arquitectura modular (`src/shared/{domain,application,infrastructure,ui}`)
  con un ejemplo real de límites de capas: la comprobación de salud de la
  aplicación y de PostgreSQL.
- Añadido el endpoint `GET /api/health` y la página inicial Foundation,
  ambos tolerantes a la ausencia de PostgreSQL sin filtrar credenciales.
- Añadida la comprobación documental ligera (`npm run docs:check`) y el
  workflow de CI (`.github/workflows/ci.yml`).
- Creado el sistema documental dividido e indexado (`docs/README.md` y
  subcarpetas), tres ADR iniciales y el plan de prueba manual
  `docs/testing/manual/FND-001-manual-test-plan.md`.
- Documentadas, sin implementar, las familias de ecosistemas de
  competición y los principios del futuro núcleo de partido.
