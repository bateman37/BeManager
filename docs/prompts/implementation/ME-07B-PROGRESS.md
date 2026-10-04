# ME-07B — Progreso de trabajo (no es fuente de verdad de diseño)

Archivo de trabajo versionado, exigido por ME-07B §0.5. Se actualiza en cada
sesión/commit relevante. No sustituye a CAPABILITIES/ACTIONS/AUDIT/roadmap
como fuente de verdad; cuando algo quede consolidado, se traslada allí y se
borra de aquí.

## Estado de la PR (vigente)

- **PR #10** (`claude/new-session-p9xna7`) **ya está fusionada** en `main`
  (`7b7eedd`, merge de 30-09-2026) con ME-07A y el comienzo parcial de
  ME-07B (foto basal de cuatro semillas y eliminación del veto T04≥9). Su
  rama y su PR **no se continúan**. Lo que decía más abajo («PR #10
  Draft») era cierto en su sesión y queda como historial.
- **Encargo vigente:** `ME-07B-v2-capitulo-tactico-y-20-auditorias.md`
  (prevalece sobre los recortes del prompt anterior).
- **Rama nueva:** `claude/me-07b-v2-capitulo-tactico`, creada desde
  `origin/main` en `7b7eedd` (línea de base registrada). Una sola PR Draft
  nueva hacia `main` para todo el trabajo de ME-07B v2. No fusionar.

El registro de sesiones de ME-07B v2 está al final de este archivo
(«ME-07B v2 — sesiones»).

## Historial: sesión 1 del prompt anterior — 2026-09-30

### Hecho
- Confirmado: main y la rama/PR de ME-07A siguen disponibles y en Draft
  (PR #10). Se continúa en la misma rama/PR, sin crear alternativa.
- Guardado el prompt literal de ME-07B en
  `docs/prompts/implementation/ME-07B-cierre-me-07a-motor-tactico-integrado.md`,
  enlazado desde `docs/prompts/README.md` (commit `7cedfa9`).
- Lectura acotada completa (CLAUDE.md, docs/process/*, docs/match/*,
  ADR-0009, referencias v1/v2 §§ indicadas, estudio §§3.4-3.10/4.2-4.7).
- Mapeo técnico del motor actual (post-ME-07A) con referencias file:line,
  ver resumen debajo. Sirve de punto de partida para todo lo que sigue;
  no se repite la exploración.

### Mapa técnico de partida (post-ME-07A)

- Selección de familia ofensiva `auto`: `computePossessionCore`
  (`modules/match/domain/simulation/possession-core.ts:535`), compara
  `estimateBloqueoDirectoOpportunity` (1844) vs `estimateHandoffOpportunity`
  (1885). **No existe hoy** el paso de "ventana inmediata antes de la
  entrada" que pide ME-07B §3.1/defecto 1: los estimadores solo comparan
  valor situacional de las dos familias organizadas entre sí, nunca
  "¿hay tiro/penetración ya disponible sin preparar nada?". Esta es la
  causa más probable del monopolio de bloqueo directo.
- Triple de transición: `evaluateTransitionThreeOpportunity`
  (`modules/match/domain/sequence/transition.ts:306`), consumido desde
  `linked-run.ts`. Geometría correcta pero 0 intentos naturales
  (ADR-0009): hay que verificar por qué el fixture natural nunca llega a
  esa ventana (defensor de aro llega antes, o el organizador nunca la
  reconoce a tiempo).
- `organize()` (`modules/match/domain/sequence/linked-run.ts:1203`): ya
  compara `keepSeconds` vs `passSeconds`; con las posiciones/perfiles del
  fixture solo gana `creator_kept_by_real_holder` 5/219 veces. Revisar si
  el criterio geométrico es demasiado estricto o si el holder casi nunca
  está mejor posicionado que O1 en la disposición fija actual.
- `creationPriority`/`shotTendency`: ya integrados en la lectura de mano a
  mano (possession-core.ts:2260-2340) y `creationPriority` en la lectura
  de PnR (1066-1092), pero `shotTendency` **no** se consulta en la lectura
  de PnR (por diseño de ADR-0009, que reserva esa banda a `pnrTendency`).
  El prompt ME-07B §2 pide integrarlo en "la política común" además de la
  banda específica del PnR — hay que decidir el mecanismo común sin tocar
  el rol reservado de `pnrTendency`.
- Veto absoluto de triple T04>=9: dos sitios,
  `possession-core.ts:1021` (lectura PnR) y `possession-core.ts:1873`
  (estimador de familia). Su eliminación está explícitamente autorizada
  por ME-07B §2 ("Elimina el veto absoluto T04 >= 9").
- Cobertura auto: `estimateCoverageChoice` (possession-core.ts:1948).
  Trampa nunca elegible porque D5 arranca en `scenario.ts:89`
  (`initialPosition: {x:22.3, y:7.7}`, protección de aro) y nunca llega a
  tiempo al punto de pantalla. Cambiar esto es una decisión de escenario/
  geometría, no solo de código de decisión.
- No existe ninguna estructura de datos de "ficha de jugada" (`structure`,
  `roles`, `reads`, `exits`) ni ninguna defensa de zona/presión/switch/
  ICE/show hoy: cada familia es una función imperativa en
  `possession-core.ts`. Construir la capa táctica compartida de ME-07B §3
  es trabajo nuevo, no una extensión de un tipo existente.
- Patrón para partido completo + auditoría: `modules/match/domain/game/me07a.test.ts`
  (helper `input(seed, ...)`, `playFullGame`, `buildAuditExport`).
  `scripts/profile-game.ts` mide coste pero no vuelca resumen de
  selección; hace falta un script nuevo para la foto basal.

### Siguiente paso inmediato
Escribir el script de foto basal (4 semillas: 1, 37, 82, 156, ambos
equipos en auto) reutilizando `buildGameInput`+`playFullGame`+
`buildAuditExport`, y guardarlo en el propio repo o en este archivo antes
de cambiar ningún comportamiento del motor.

### Pendiente (no iniciado)
Todo el §§4-9 del prompt: estructuras espaciales, libro de jugadas,
familias con interacciones nuevas, defensa asentada/presión/cobertura
ampliada, 45 atributos con tarea alcanzable, UI de /lab, esquema de
auditoría ME-07B-AUDIT-1, documentación y plan manual. Nada de esto está
implementado todavía. No se declara ME-07B terminada.

## Foto basal (previa a cualquier cambio), 2026-09-30

Script: `scripts/me07b-baseline-snapshot.ts` (`npx tsx scripts/me07b-baseline-snapshot.ts`).
Ambos equipos en auto (cobertura/orden sin balón/plan ofensivo/prioridad
`equilibrado`), semillas 1/37/82/156, fixture Sierra Clara vs Puerto Ámbar.

| Semilla | Coste | Hechos/Posesiones | stop.cause | Marcador | seleccion_familia | seleccion_cobertura | organizacion_creador (conserva) | lectura_transicion |
|---|---|---|---|---|---|---|---|---|
| 1 | 542 ms | 4710/203 | final | 130–159 | bloqueo_directo 217, mano_a_mano 6 | drop 223 | 224 (6) | 0 |
| 37 | 267 ms | 4785/197 | final | 138–148 | bloqueo_directo 217, mano_a_mano 3 | drop 220 | 222 (3) | 0 |
| 82 | 204 ms | 4751/207 | final | 144–139 | bloqueo_directo 212, mano_a_mano 5 | drop 217 | 219 (5) | 0 |
| 156 | 224 ms | 4873/202 | final | 138–129 | bloqueo_directo 218, mano_a_mano 5 | drop 223 | 224 (5) | 0 |

Confirma con evidencia fresca (no el resumen histórico de ME-06, que tiene
el defecto de atribución conocido) los defectos de §2 de ME-07B:
- Monopolio de bloqueo directo: 96–98 % de `seleccion_familia` en las
  cuatro semillas.
- Cobertura auto = drop en el 100 % de los casos, en las cuatro semillas.
- `organizacion_creador` conserva al poseedor real en 2,3–2,7 % de los
  casos (peor que el 5/219 citado en el prompt en algunas semillas).
- **Hallazgo nuevo, peor que lo documentado en ME-07A**: `lectura_transicion`
  tiene **cero** decisiones auditadas en las cuatro semillas naturales, no
  solo cero *aciertos*. La ventana de triple de transición no se llega a
  evaluar nunca en juego natural (ni siquiera se descarta con motivo);
  hay que localizar por qué el punto de decisión no se alcanza antes de
  arreglar la elección en sí (Tarea #3).
- stop.cause = final en las cuatro semillas ya en el estado actual
  (ninguna termina por guardián); hay que verificar que la prueba de
  partido completo no acepte guardian como válido en fixture normal
  (Tarea #7) — el motor en sí ya se comporta bien aquí.

No se compara contra el resumen por familias de ME-06 (histórico, con
defecto de atribución); esta tabla es la única referencia basal fiable
para medir el cierre de estos defectos.

## Sesión 1 (continuación) — defecto de §2 cerrado parcialmente

### Hecho
- **Veto absoluto T04>=9 eliminado** en `possession-core.ts`
  (`runDropPhase` línea ~1015 y `estimateBloqueoDirectoOpportunity` línea
  ~1874): un triple legal detrás de la línea ahora es siempre una vía
  real; su valor depende de `shotProbability` (calidad continua) y de la
  oposición geométrica real de D5 (ventana de cierre), nunca de un
  umbral binario de capacidad. Cambio explícitamente autorizado por el
  prompt §2.
- Actualizado `me04b.test.ts` (el caso que fijaba el veto anterior) para
  exigir la nueva conducta: T04 bajo compite por valor situacional
  (`reasonCode: situational_value_lower`), no se excluye por capacidad.
- Recalculada con causa documentada la huella de `me04.test.ts` (7) — la
  posesión de regresión pasa por la misma lectura del bloqueo.
- `npm run check` completo (lint+typecheck+test 231/231+docs:check+build)
  en verde tras el cambio.
- Foto basal re-ejecutada tras el cambio: **sin variación** en la muestra
  natural (mismos conteos de `seleccion_familia`/FGA por semilla) — los
  jugadores del fixture natural ya tenían T04>=9 donde importaba, así que
  este cierre por sí solo no resuelve el monopolio de familia ni el resto
  de defectos de §2; son mecanismos independientes que siguen abiertos.

### Por qué el resto de §2 no se cierra en esta sesión (evidencia, no excusa)
Diagnóstico con datos reales (no solo lectura del código): instrumenté
`seleccion_familia` en la semilla 82 y los valores comparados
(`situationalValue`) son **casi constantes entre posesiones** (bloqueo
directo ≈1.30-1.34, mano a mano ≈1.234, siempre en ese orden). La causa
raíz es el "guion de disposición fija" que el propio prompt señala en
§3: cada posesión nueva reevalúa `estimateBloqueoDirectoOpportunity`/
`estimateHandoffOpportunity` casi siempre desde la misma geometría de
partida (no hay variedad real de espaciamiento entre posesiones porque no
existe todavía una capa de estructuras/espaciamiento real, §4). Resolver
esto bien exige construir primero la capa táctica compartida de §3 (los
"diez posiciones y trayectorias" que persisten con estructura real,
quinteto y lecturas hasta ese instante) — no un ajuste de umbral o un
factor de variedad artificial, que el prompt prohíbe explícitamente
("no imponer una cuota ni mover jugadores de forma ficticia"). Intentar
un parche rápido aquí habría sido precisamente el cierre superficial que
el prompt prohíbe. Por eso quedan abiertas las tareas #2, #3, #4, #6 (y
con ellas dependen las de §§3-9), documentadas como siguiente paso de la
próxima sesión, no como "ya se ha corregido".

### Siguiente sesión — orden recomendado
1. Diseñar la capa táctica compartida mínima de §3 (operaciones comunes +
   tipo de datos de ficha de jugada) — es prerrequisito real de las
   tareas #2, #3, #4, #6 y de todo §4-§5, no una tarea aparte que se
   pueda posponer.
2. Reconstruir `estimateBloqueoDirectoOpportunity`/`estimateHandoffOpportunity`
   (y el resto de estimadores `auto`) sobre esa capa, con geometría que sí
   varíe entre posesiones según lo que de verdad ocurrió antes.
3. Recapturar la foto basal tras cada cambio de comportamiento real (no
   solo al final) para verificar causalmente cada cierre de §2 antes de
   avanzar a §4-§9.

## ME-07B v2 — sesiones

### Sesión v2-1 — 2026-09-30

**Base:** `origin/main` = `7b7eedd`; rama `claude/me-07b-v2-capitulo-tactico`;
**PR #11** (https://github.com/bateman37/BeManager/pull/11), **Draft**.

#### Hecho y verificado (con commits)
1. `0d95892` — encargo v2 y diagnóstico guardados literalmente, índices.
2. `ee58a58` — foto basal de las 20 auditorías recreada
   (`scripts/me07b-v2-baseline-20.ts`): marcadores/tiros idénticos al anexo
   del informe en los 20 partidos; huellas seed/+5 idénticas, +3 distinta
   (campo no deportivo del perfil). Los `.json.gz` originales **no** están
   en la sesión: no se han reanalizado.
3. `8966fe6` — **§2.1 rebote**: retraso real del cierre (cerrador → rival,
   T19/F05 del cerrador), ventana/pool/control con llegada efectiva, tirador
   sin cierre durante su gesto, caída del tirador LAB-0.4, punto de
   auditoría `disputa_rebote`, esquema `ME-07B-AUDIT-1`. Efecto
   descompuesto en `docs/match/analysis/ME-07B-v2-foto-basal-20.md`.
4. `9b3fd12` — matriz táctica versionada `docs/match/TACTICAL-MATRIX.md`
   (ninguna fila jugable; existentes = parcial; resto pendiente).
5. `fde84e1` — **§2.2 selector de familia** por proyección en seco de la
   primera lectura (misma frontera y costes) + riesgo de pase.
6. `021d767` — **§2.3 defensa auto**: trampa decidida al preparar la
   pantalla, concesiones drop/trampa proyectadas desde la misma geometría,
   aprendizaje por muestras visibles del propio partido (LAB-0.4, ataque y
   defensa). Foto seed: trampa 484 / drop 675 (Sierra defendiendo), 443 /
   733 (Puerto).
7. `9b032f9` — **§2.6 atribución**: `result.summary.shots` por FGA con
   familia anterior, decisión causante, tirador, posición e instante;
   `byFamily` usa esa atribución.

#### Probado y retirado (no commiteado)
Respuesta defensiva «cerrar» tras el tiro: cada cargador recibe al
defensor libre (sin el que cerró el tiro) que antes intercepta su carrera
—latencia M01/M05 desde el gesto, carrera F01, búsqueda del primer
instante en que ocupa la posición interior a 0,70 m entre cargador y aro
antes del fallo; si llega, sella al cargador (su trayectoria se corta ahí).
Efecto: OREB casi igual, **pero 0 faltas y 0 libres** en los 11 partidos
seed (todas las faltas naturales nacen de faltas de tiro en la segunda
oportunidad). Se reintroduce junto a §2.5 (faltas de contacto de
rebote/penetración) para no dejar el partido sin faltas.

#### Pruebas realmente pasadas
`npm run check` completo (lint + typecheck + 253 tests + docs:check +
build) en `9b032f9`.

#### `/lab` real (PostgreSQL 16 local + Chromium de Playwright), en `9b032f9`
Script `walk.cjs` (fuera del repo) sobre `npm run dev`: restaurar ambos
equipos desde el seed, partido auto/auto semilla 92 y 91, `+3` a Sierra,
semilla 91, restaurar, semilla 91. Descargados y abiertos los `.json.gz`
(esquema `ME-07B-AUDIT-1`, `stop=final`, actas conciliadas, ~0,8 MB):
- 92 seed: 119–107, cobertura trampa 183 / drop 18, familias PnR 201.
- 91 seed: 124–134 (huella `2d8067b0`), trampa 15 / drop 205.
- 91 Sierra +3: 135–137 (huella `36caa0c5`) = mismo resultado que el
  script de dominio; restaurar vuelve a `2d8067b0` y a 124–134 idéntico.
No se han recorrido todavía: estructuras, fichas nombradas, zonas ni
presión (no existen), ni el relato causal pantalla a pantalla.

#### No verificado / bloqueos / honestidad
- ME-07B **no** está terminada. Pendiente: §2.4 (lecturas y continuidad:
  1ª lectura PnR sigue siendo casi siempre pase a O5), §2.5 (transición:
  triple del portador 0; faltas solo en segunda oportunidad; reintroducir
  «cerrar» tras el tiro), switch/show/at the level/ICE/under, trampa
  proyectable para el ataque, todo §§3–7 (gramática, estructuras, libro,
  inventario ofensivo y defensivo, 18 atributos candidatos, UI de Ataque/
  Defensa/Libro, plan manual PowerShell).
- La familia sigue ~99 % PnR en la foto seed (explicado por el roll libre
  del drop; con la trampa en juego sigue ganando el PnR porque la mano a
  mano proyecta menos). Sierra +3 sí elige mano a mano 128/623.
- La trampa en `auto` eleva rebote ofensivo y pérdidas; no hay carrera
  defensiva a cerrar tras el tiro (retirada, ver arriba).
- Ninguna táctica del capítulo es «jugable» según §0.4.

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-baseline-20.ts   # foto de las 20 semillas/fotos
```
Para `/lab`: `pg_ctlcluster 16 main start`, `npx prisma migrate deploy`,
`npm run dev`, abrir `http://localhost:3000/lab`.

Siguiente paso: §2.4 (lecturas del receptor: extra pass, media distancia
T03, floater T02, re-screen, conservar), §2.5 (transición y faltas de
contacto; volver a introducir «cerrar» tras el tiro), switch como tercera
cobertura; después la gramática de §3.

### Sesión v2-2 — 2026-09-30 (en curso)

**Base:** continúa `claude/me-07b-v2-capitulo-tactico` y la **PR #11 Draft**.

#### Hecho y verificado (con commits)
1. `635a66d` — **§2.4 roles**: `assignOrganizedRoles` asigna creador y
   bloqueador por proyección en seco; defensores siguen a su marca. Foto
   seed: el poseedor real crea 745/1.233 (antes 34/1.182).
2. `2e6b62f` + `8bb8bf8` — **§2.4 lecturas**: O5 lee aro/floater/inversión
   y O1 añade tiro parado, todo frente al mejor cierre real (D5 con una sola
   trayectoria de drop, D1, D3); D3 decide la ayuda comparando concesiones
   (`rollHelpCall`); T02/T03 activas con floater/tiro medio (LAB-0.5).
3. `e75641c` + `7346e64` — **§2.5**: triple del portador en transición en su
   punto real de tiro (14 y 8 elegidos en seed, antes 0); faltas por contacto
   real con M07 activa (LAB-0.6): 70 → 230 PF, ≈100 → 278 FTA en los 11 seed.
4. Documentación: `ACTIONS`, `CAPABILITIES`, `AUDIT`, `CHANGELOG`, matriz y
   análisis de la foto (`ME-07B-v2-foto-basal-20.md`, sección §2.4–§2.5).

#### Decisión sobre «cerrar tras el tiro» (retirada en v2-1)
No se reintroduce todavía: su efecto medido en v2-1 sobre OREB fue casi nulo
y su único daño (0 faltas) desaparece porque las faltas ya no dependen de la
segunda oportunidad. OREB tras fallo vivo en seed: 215/570 y 222/640.

#### Hecho y verificado (con commits, continuación de v2-2)
5. `25e0695` — **§3 primitivas**: lectura del receptor del roll y plan de
   ayuda compartidos por drop/show (antes duplicados por familia).
6. `f4fe5f8` — **§5 cambio y show** (commit de la sesión interrumpida; sus
   documentos no se actualizaron entonces y se ponen al día aquí).
7. `5cbb4a7` — **«Parada de guardián»: causa real y corrección.** No era un
   defecto del trabajo de under/ICE en curso, sino de la rotación
   `ME-04-ROT-1`: con las faltas de contacto de §2.5 las exclusiones suben a
   ≈0,7 por partido y, si ningún suplente declaraba el rol del excluido, el
   partido ordinario paraba por guardián. Reproducido: `f4fe5f8` limpio para
   por guardián en 3 de 60 semillas naturales (10, 29, 54); el WIP lo hacía
   en la 91 (foto seed, `me07b-v2-rebound.test.ts` en rojo) porque cambiaba
   la secuencia. Semilla 91: se excluye PA09 (alero) con PA08 [2,3] en pista
   como escolta y solo escoltas/bases/interiores en el banquillo. Ahora
   (`ME-04-ROT-2`) un compañero en pista que declara el rol pasa a él y entra
   el suplente del rol que deja; nadie juega fuera de un rol declarado.
   Prueba pura nueva en `me04.test.ts`; la 91 termina `final` con el hecho
   «PA08 pasa de escolta a alero y entra PA06».
8. `85725d6` — **§5 por debajo (under) e ICE** (terminado desde el WIP, con
   dos correcciones de fondo): (a) el WIP hacía **siempre viable** el pase al
   roll en el under, al revés de su lógica (sin retraso de pantalla no hay
   dos contra uno): ahora sigue la regla de drop con retraso nulo; (b) el
   triple de O1 salía igual de contestado que por encima (0,5 en el 100 %:
   el under solo quitaba opciones y dominaba). Ahora D1 pasa entre el
   bloqueador y su defensor, contesta la entrada (`d1WallsDrive`) y, para
   cerrar el triple, rodea al bloqueador; si al soltar aún no lo ha rodeado,
   no contesta. Semilla 92 (Puerto por debajo vs drop, ataque bloqueo):
   margen medio del cierre de D1 −0,60 s → +0,27 s, oposición del triple
   0,5 → 0, O1 elige triple 6 → 120; Sierra 99 → 131 puntos. ICE: no
   elegible ante el bloqueo central (`coverage_ice_central_not_eligible`);
   la orden manual juega drop con `coverage_not_applicable`.
9. Documentación (este commit): `ACTIONS`, `AUDIT`, `CAPABILITIES`,
   `RULES`, `MODEL`, `CHANGELOG`, matriz.

#### Pruebas realmente pasadas
`npm run check` completo (lint + typecheck + 284 tests + docs:check +
build) en `85725d6`.

#### Foto de las 20 (`scripts/me07b-v2-baseline-20.ts`) en `85725d6`
Las 20 terminan `final`, actas conciliadas. Frente a `f4fe5f8`:
- Seed (11): coberturas de Sierra defendiendo trampa 349 / drop 757 / por
  debajo 125 / cambio 40 / show 48 (antes 478/668/—/17/117); Puerto
  236/775/55/61/139. PF 104 y 126 (antes 108 y 110: sin regresión a «0
  faltas»). OREB tras fallo vivo 207/522 y 215/661 (antes 234/561 y
  210/627). Puntos 1.317–1.307 (antes 1.146–1.199): más triples anotados de
  Sierra (168/513 frente a 123/495) — pendiente de descomponer.
- Sierra +5 (3): la familia de Sierra pasa a mano a mano 293 / PnR 17
  (antes 119/213; con el WIP 20/319). **No es efecto del under** (la
  proyección de familia es siempre contra drop): la mediana de la brecha
  PnR–DHO es −0,012/−0,012/−0,001 por partido (antes −0,033/0,000/−0,001),
  un empate de filo en el que cada partido se va entero a un lado. A
  investigar en §2.2 (no se ha tocado): puede ser explotación legítima —
  LAB-0.4 solo actualiza con muestras la familia que se usa y la otra se
  queda en su proyección— o falta de una lectura que rompa el empate con
  información visible; no se añade banda ni cuota sin decidirlo.
- 60 semillas naturales: guardián en 1 (la 39: los dos bases declarados de
  Sierra excluidos). Ver decisión requerida.

#### `/lab` real (PostgreSQL 16 + Chromium de Playwright) en `85725d6`
`walk.cjs` (fuera del repo) sobre `npm run dev`: restaurar ambos equipos,
semilla 92 con Puerto «Por debajo (under)» → 163–127, `final`, 110 hechos
`screen_navigated` con `route=por_debajo`; semilla 92 con Puerto «ICE
lateral» → 103–105, `final`, 118 `coverage_not_applicable`; auto/auto
semilla 91 → 123–87, idéntico al script de dominio, coberturas trampa 191,
show 8, cambio 5, por debajo 5, drop 4. Exportaciones `ME-07B-AUDIT-1`
abiertas (~1 MB); el panel muestra «rotación ME-04-ROT-2».

#### DECISIÓN REQUERIDA — exclusión sin nadie que declare su rol
Con `ME-04-ROT-2` el guardián solo queda cuando **todos** los inscritos
que declaran un rol están excluidos (1 de 60 semillas naturales; la
plantilla de laboratorio declara dos bases por equipo). Opciones: (a)
dejarlo así (el guardián lo explica, partido sin ganador); (b) permitir un
suplente fuera de rol declarado, con criterio a decidir (menos minutos,
rol vecino…); (c) ampliar los roles declarados de la plantilla. No se
inventa: queda para Dennis. Observación relacionada: las faltas se
concentran en los aleros (D3/O3: ayuda al roll y segunda oportunidad).

#### No verificado / pendiente
- ICE ejecutable (necesita bloqueo lateral), at the level, respuesta de
  zona; scram/recuperar tras el desajuste del cambio.
- El ataque no anticipa under/cambio/show al elegir familia (proyecta contra
  drop).
- Resto de §3 (ficha de libro, estructuras), §4–§7 completos. Ninguna fila
  de la matriz es «jugable».

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-baseline-20.ts
```
Siguiente paso (no iniciado en esta sesión para no dejar otra vez trabajo
a medias): (1) bloqueo directo **lateral** como segunda colocación real
(hoy `SHORT_ROLL_SPOT`, `WEAK_CORNER_SPOT` y la disposición del escenario
son fijos: 48 usos en `possession-core.ts`), que habilita el ICE
ejecutable; (2) **at the level** separado del show: hoy el punto del show
(0,7 m del punto de uso hacia el aro) ya es «a la altura», así que hace
falta primero dar al show su profundidad propia en la trayectoria de salida
de O1, o serían dos nombres con la misma geometría (§3); (3) la ficha de
libro de §3 sobre las primitivas ya compartidas; (4) el empate de familia
de Sierra +5.

### Sesión v2-3 — 2026-10-01 (en curso)

**Base:** continúa `claude/me-07b-v2-capitulo-tactico` desde `3ccc249`;
**PR #11 Draft** (no se fusiona ni se marca Ready).

#### Decisión de Dennis sobre la semilla 39 (literal)
> «Decisión para la semilla 39: opción B. Continúa la siguiente ronda.
> Mantén primero los relevos por rol declarado y el reajuste ME-04-ROT-2. Si
> ninguno permite completar el quinteto tras una exclusión, incorpora a un
> suplente inscrito y habilitado aunque no declare el rol vacante. Elige la
> asignación de los cinco que conserve más roles declarados; para el puesto
> excepcional, usa las capacidades pertinentes y un desempate reproducible.
> Registra quién asume el rol de emergencia y por qué. No cambies sus roles
> persistidos ni sus atributos, no apliques un malus global y no permitas
> volver al excluido. Prueba específicamente la semilla 39 y repite las 60
> semillas con parada final y acta conciliada. Si alguna vez quedan menos de
> cinco jugadores realmente habilitados, trátalo como un caso reglamentario
> distinto; no fabriques un quinto jugador ni conviertas un guardian en un
> final.»

#### Hecho y verificado (con commits)
1. `399d8e6` — **`ME-04-ROT-3`** (`substitution-policy.ts`): orden ROT-1 →
   ROT-2 → emergencia. La emergencia prueba cada suplente habilitado (no
   excluido, no bloqueado en la parada) con todas las asignaciones de los
   cinco a los roles 1–5 (los otros excluidos de la misma parada y los ya
   reajustados conservan su ranura) y ordena: (1) más roles declarados
   conservados, (2) mayor capacidad pertinente en el/los puesto(s) fuera de
   rol, (3) menos reajustes en pista, (4) menos minutos, (5) ID. Sin sorteo:
   no consume RNG y se reproduce igual. «Capacidad pertinente» = media de los
   atributos que el motor de esta versión lee específicamente para la ranura
   O_n/D_n de ese rol (`EMERGENCY_ROLE_TASK_ATTRIBUTES`, inventario por
   lectura del código `o<n>.attributes.*`/`d<n>.attributes.*`); solo ordena
   candidatos, no modifica el juego. Hecho `substitution` con el relato
   («Relevo de emergencia… entra SC08 como rol 1… decide:
   capacidad_pertinente»), `SubstitutionRecord.emergency` y decisión
   auditada `sustitucion` con cada candidato, valores y código de motivo
   (`emergency_fill_*`), enlazada al hecho. Perfiles y roles declarados no se
   tocan; sin malus. `menos_de_cinco` (menos de cinco inscritos no
   excluidos) queda sin resolver con explicación propia de guardián: **caso
   reglamentario pendiente de decisión** (no hay regla de partido perdido por
   insuficiencia en `fiba-2026-rules.ts`; no se inventa).
2. Semilla 39 (seed): SC06 se excluye en C3 (entra O1 por ROT-1) y O1 en
   C4 a 3:27. Antes: guardián. Ahora: entra SC08 [2,3] como base (capacidad
   de base 9,00 frente a SC07 8,71 si entrase O2, O3/O4 8,57, O5 6,57; 4/5
   roles declarados en todas), termina **final 110–101**, acta conciliada.
3. Pruebas: `me04-rot3.test.ts` (4): semilla 39 pura con el estado real;
   preferencia (ROT-1 antes; cadena 5/5 antes que fuera de rol; empate por
   minutos e ID); `menos_de_cinco`; partido completo de la 39 (final, acta,
   hecho y auditoría con quién/por qué, ningún excluido vuelve ni actúa,
   entrada sin mutar). `me04.test.ts` (ROT-2): el caso «sin reajuste» pasa
   de «sin resolver» a emergencia.
4. Barrido `npx tsx scripts/me07b-v2-stop-sweep.ts 1 60` (seed, Sierra +3,
   Sierra +5): **180/180 `final`, 0 actas sin conciliar**; 3 relevos de
   emergencia (seed 39 Sierra O1→SC08 base; +3 semilla 11 y +5 semilla 8:
   Puerto PA10 alero excluido → entra D4 [4] como alero, capacidad 9,67).
   Ningún caso `menos_de_cinco`. Foto de las 20: las 20 `final`, actas
   conciliadas, sin emergencias (huellas cambian solo por la versión de
   rotación en la entrada).
5. `npm run check` completo (lint + typecheck + 288 tests + docs:check +
   build) en `399d8e6`.

#### Pendiente de esta parte
- Regla para **menos de cinco habilitados** (partido perdido/insuficiencia):
  decisión de Dennis cuando haga falta; hoy guardián explicado.
- La comparación completa de candidatos solo se audita en la emergencia; las
  sustituciones ordinarias siguen como `coverageGaps` declarado.
- **Nota posterior (ea4e50b):** el bloqueo lateral y el ICE cambian la
  secuencia de la semilla 39 y ya no llega a excluir a los dos bases; su
  estado real se conserva como prueba pura y la prueba de partido completo
  pasa a la semilla 23 (Sierra: O5, SC11 y SC12, los tres que declaran el
  rol 5, excluidos; O4 [4] pasa a interior y entra SC10 [3,4] de ala-pívot,
  `capacidad_pertinente`). Barrido 1–60 × 3 fotos repetido tras ea4e50b:
  **180/180 `final`, actas conciliadas**; 2 emergencias (seed 23 Sierra;
  +5 semilla 47 Puerto: PA08 alero → D4 [4] de alero, entra PA11), ninguna
  `menos_de_cinco`.

#### Hecho y verificado (con commits, continuación de v2-3)
6. `ea4e50b` — **bloqueo directo lateral, ICE ejecutable y «a la altura»**
   (LAB-0.7, `lab-0-7-parameters.ts`, solo geometría en metros):
   - *Colocación* `screenPlacement` (`auto`/`central`/`lateral`; selector
     «Colocación del bloqueo» en `/lab`). En `auto`, `assignOrganizedRoles`
     compara creador × bloqueador × colocación con la misma proyección en
     seco y lo audita en `colocacion_bloqueo`. Disposición lateral: manejador
     en el ala (19,32; 2,23), bloqueador a 3,3 m del eje (20,8; 4,2), misma
     distancia manejador–bloqueador que la central (2,46 m), short roll
     lateral; lado débil y esquina fuerte iguales. La mano a mano solo desde
     la central. Antes: un solo bloqueo (central) y 48 usos de puntos fijos.
   - *ICE* real ante el lateral: D1 se pone del lado de la pantalla, a
     contacto del manejador (M01/M05/F04), si llega antes del uso; D5 baja a
     la ayuda baja (T23); el bloqueador se abre al codo; `lectura_ice` con
     cinco vías. ICE tardío → drop (`ice_late`). Ante el central sigue no
     elegible. Antes: «no elegible» siempre (`coverage_not_applicable`).
     Semilla 92 forzada (Sierra lateral, Puerto ICE): 235 ICE puestos, 0
     tardíos; lecturas `pase_o5` 219 / `parada_fondo` 16; con D1 lento
     (M01/M05/F04 = 1) aparecen los tardíos.
   - *A la altura* frente a *show*: antes el show usaba el punto «a la
     altura» y no frenaba a nadie (mismo mecanismo con dos nombres). Ahora
     el show sale a contacto del punto de uso y frena al manejador si llega
     antes (semilla 92 central: 58/116 lecturas frenadas; misma decisión:
     penetración lista 3,54 s frente a 3,27 s «a la altura») y vuelve al
     aro; «a la altura» sube ≥0,3 m más hondo junto al bloqueador, no frena,
     contiene al decidir y vuelve con el continuador.
   - `auto` compite entre siete coberturas. Pruebas nuevas
     `lab-0-7-parameters.test.ts` (4) y `me07b-v2-lateral-ice.test.ts` (8).
     Semillas naturales de ME-04 recalculadas (bocina 325 y 69, canasta
     tardía 1, dos prórrogas 246).
7. Foto de las 20 tras `ea4e50b` en
   `docs/match/analysis/ME-07B-v2-foto-basal-20.md` (sección v2-3): las 20
   `final` y conciliadas; seed: lateral 55/1.230 (Sierra) y 32/1.294
   (Puerto); ICE 9/38, a la altura 5/135, show 1/61 como defensa; puntos
   1.201–1.210 (antes 1.317–1.307, sin descomponer).
8. `npm run check` completo (lint + typecheck + 300 tests + docs:check +
   build) en `ea4e50b`.

9. `54c1716` — restaura `next-env.d.ts` (lo había reescrito `npm run dev` y
   entró por error en `a05d30d`).
10. `f819010` — **§3 ficha de libro, primer paso**: `PlaybookCard`
    (`domain/tactics/playbook-card.ts`) con los ocho campos de §3 para las
    tres acciones organizadas existentes; `assignOrganizedRoles` toma de las
    fichas las colocaciones ofrecidas; el núcleo devuelve y audita la ficha
    en vigor (`cardId`). Prueba de contrato: en tres partidos completos cada
    lectura pertenece a la ficha de su fase (se ven las tres fichas; ICE solo
    en la lateral). Conducta idéntica: foto de las 20 sin un solo cambio de
    marcador ni de tiros. `npm run check` (303 tests) en `f819010`.
    **No hecho todavía:** fichas nuevas (Horns, Delay, Spain, drag, saques),
    variantes encadenadas, prioridad de llamada por fase/reloj y romper la
    llamada a mitad de ficha más allá de la salida segura existente.

#### `/lab` real en `ea4e50b` (PostgreSQL 16 + Chromium de Playwright)
`walk.cjs` (fuera del repo, en el scratchpad) sobre `npm run dev`:
restaurar ambos equipos desde el seed; semilla 92 con Sierra «Colocación
del bloqueo: Lateral» y Puerto «ICE lateral» → 88–103, `final`, 116
`ice_committed`, `lectura_ice` pase_o5 110 / parada_fondo 6; semilla 92 con
Sierra «Central» y Puerto «A la altura» → 152–115, 111 `at_level_committed`;
auto/auto semilla 91 → 92–99 (= script de dominio), colocación central 204
/ lateral 6, una ICE. Las tres exportaciones `ME-07B-AUDIT-1` (~1 MB)
abiertas: `stopCause=final`, actas conciliadas, `screenPlacement` en la
configuración, rotación `ME-04-ROT-3`. Mismos marcadores que el dominio con
la misma configuración (la huella difiere por campos de perfil persistido).

#### No verificado / pendiente (v2-3)
- Bloqueo lateral solo a la izquierda; sin espaciado propio (empty side,
  lift del ala débil). El ataque proyecta familia y colocación contra drop
  (no anticipa ICE/show/a la altura).
- Descomponer la bajada de puntos de la foto seed.
- §3: la ficha de libro existe (`f819010`) pero solo describe las tres
  acciones ya implementadas; §4–§7 resto; ninguna fila de la matriz es
  «jugable».

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-stop-sweep.ts 1 60     # 60 semillas × 3 fotos: parada y acta
npx tsx scripts/me07b-v2-baseline-20.ts          # foto de las 20
```

### Sesión v2-4 — 2026-10-01

**Base:** `ed1960a`; rama `claude/me-07b-v2-capitulo-tactico`, **PR #11 Draft**
(no se fusiona ni se marca Ready).

#### Decisión de Dennis sobre `menos_de_cinco` (literal, decidida y sin implementar)
> «Decisión sobre menos_de_cinco: cuando no queden cinco inscritos
> habilitados, continúa con cuatro, tres o dos jugadores reales; con menos de
> dos, registra derrota por default conforme a FIBA 2026. No inventes un
> sustituto, no reutilices excluidos y no conviertas un guardian en final.
> Documenta esta regla ahora; su implementación puede esperar porque no
> aparece en las 180 partidas comprobadas. Si impide cerrar una prueba o
> entrega, deja el caso pendiente explícito en la PR Draft.»

Registrada también en `docs/match/RULES.md`. Hueco del motor: no hay
resultado de derrota por default (`GameStopCause` = `final | guardian`;
`fiba-2026-rules.ts` no recoge los arts. 20–21) ni juego con menos de cinco.
Sigue **pendiente**: guardián explicado. Durante la sesión apareció una vez
(Horns forzado, semilla 92) por un defecto de la ayuda (abajo, punto 3), no
por la regla; corregido el defecto, no reaparece en 180 partidas.

#### Hecho y verificado (con commits)
1. `75b5d0f` — **bajada de puntos de v2-3 descompuesta**
   (`docs/match/analysis/ME-07B-v2-descomposicion-puntos-v2-3.md`,
   `scripts/me07b-v2-points-breakdown.ts`): de −213 combinados, −65 son dos
   prórrogas que dejan de jugarse (98 y 99), −101 aciertos por debajo de la
   probabilidad usada (triples de Sierra 141 frente a 160,7 esperados,
   −1,9 σ) y −47 calidad esperada y libres (mezcla defensiva de Sierra:
   menos show/cambio/under, Puerto pierde 37 dobles). En semillas 1–60 el
   total **sube** +347 (13.449 → 13.796). Nada calibrado.
2. `d3ca201` — **ficha `horns_bloqueo` (LAB-0.8)** y **proyección frente a la
   defensa observada** (detalle en `ACTIONS.md`, `AUDIT.md`). Defectos
   encontrados y corregidos al construirla: (a) la ayuda corría al mismo
   punto del short roll que el continuador: desde el codo (2 m) chocaba en
   carrera y cada ayuda era falta (37 en un partido → 8 excluidos de Puerto
   → `menos_de_cinco`); ahora contiene a contacto si llegaría mientras el
   continuador corre y el solape es estrictamente menor que la suma de
   radios; (b) el cambio se perdía tras un pase desviado recuperado por el
   ataque; (c) `assignOrganizedRoles` no reasignaba el marco si ganaba el
   primer candidato (en Horns el primero ya está reasignado); (d) tiros tras
   `lectura_cambio/show/a_la_altura/ice` sin acción causante. La central y
   el laboratorio ME-01–03 conservan sus huellas; cambian la del tramo de
   ME-03 (por la proyección) y las semillas naturales (787, 86, 984, 146).
3. Pruebas: `npm run check` completo (lint + typecheck + **320 tests** +
   docs:check + build) en `d3ca201`. Nuevas: `me07b-v2-horns.test.ts` (9),
   `me07b-v2-coverage-projection.test.ts` (2), `lab-0-8-parameters.test.ts`
   (4), LAB-0.4 `shownCoverageWeights`.
4. Barrido `scripts/me07b-v2-stop-sweep.ts 1 60`: **180/180 `final`**, 0 actas
   sin conciliar, 2 emergencias ROT-3, ningún `menos_de_cinco`. Foto de las
   20: 20 `final`, conciliadas (sección v2-4 de la foto).

#### Horns→bloqueo: evidencia de «jugable»
- Ejecución: semilla 92, Sierra «Horns», Puerto drop: 111/111 entradas en
  Horns con los dos interiores en los codos (distancias de la disposición
  comprobadas), `seleccion_familia.cardId = horns_bloqueo`, 94/94 tiros con
  `cardId` y acción causante de la ficha.
- Contrafactual (misma ficha, semilla 92): drop → `pase_o5` y remate del
  continuador (85 finalizaciones, 8 triples); cambio → `lectura_cambio`
  (`atacar_cambio` 49, `pase_o5` 57; 99 finalizaciones); trampa →
  `lectura_trampa` (`trap_broken_o4` 78, `invertir_o3` al codo 17, 8 robos;
  78 triples y 17 tiros medios, ninguna finalización).
- Frente a la central (misma trampa): Horns invierte al codo con tiro medio;
  la central nunca invierte. Ante drop, el receptor del roll valora un tiro
  medio del codo en lugar de un triple de esquina.
- Negación: la ayuda del segundo cuerno contiene al continuador; la lectura
  reevalúa con alternativas y la segunda entrada se evalúa con motivo (en
  Horns casi nunca es viable: el defensor que repara cubre las líneas, y el
  continuador remata contenido); la trampa roba y cambia la posesión.
- `/lab` real (PostgreSQL 16 + Chromium, `walk-horns.cjs` en el scratchpad,
  sobre el árbol de `d3ca201`): restaurar ambos equipos; semilla 92 con
  Sierra «Colocación del bloqueo: Horns» y Puerto drop → 109–126; trampa →
  130–133; cambio → 118–106; auto/auto → 133–136 (Horns elegido 1 vez por
  proyección). Las cuatro exportaciones `ME-07B-AUDIT-1` (~1 MB) abiertas:
  `stop=final`, actas conciliadas, `screenPlacement=horns`, todas las
  entradas en Horns y todos los tiros de la ficha enlazados. Repetidas con
  el dominio desde la configuración exportada: mismo marcador y mismo
  número de hechos. El panel muestra «bloqueo Horns (dos interiores en los
  codos)».

#### Proyección del ataque frente a la defensa observada (evidencia)
Antes: `projectedCoverage: "drop"` siempre. Ahora, prueba pura con la misma
geometría y muestras propias: sin muestras del rival gana la mano a mano
(0,981 frente a 0,883); con 20 cambios vistos gana el bloqueo (1,049); 20
drops o 20 ICE ante pantalla central dejan la proyección exacta de antes.
En partido (semilla 92): contra drop el peso de drop es 1 y nada cambia;
contra cambio el peso del cambio crece hasta >0,9 y la familia elegida se
aparta de la proyección solo contra drop. Foto seed: 2.291/2.323 selecciones
pesan otras coberturas, 5 cambian de familia por ello.

#### No verificado / pendiente
- Spain, Delay, saques y el resto del libro; Horns sin variantes encadenadas
  propias (la segunda entrada se juega con geometría central) y sin ayuda
  del codo sobre la penetración de O1.
- La tendencia observada no distingue colocación (el ICE visto ante la
  lateral pesa igual en la central, donde se pliega a drop).
- Coste ≈1,7 s por partido con auditoría (antes ≈0,65 s).
- `menos_de_cinco` (arriba). Ninguna otra fila de la matriz es «jugable».

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-stop-sweep.ts 1 60
npx tsx scripts/me07b-v2-baseline-20.ts
```
Siguiente paso: segunda ficha (Delay→DHO/corte o Horns→Spain con tercer
bloqueador) sobre la misma gramática; abaratar la proyección por coberturas.

### Sesión v2-5 — 2026-10-01

**Base:** `dc71e16`; rama `claude/me-07b-v2-capitulo-tactico`, **PR #11 Draft**
(no se fusiona ni se marca Ready).

#### Hecho y verificado (con commits)
1. `e48e5db` — **ficha `horns_spain` (LAB-0.9)**. Desde Horns, el segundo
   cuerno rodea a su defensor y pone un bloqueo ciego a D5 a contacto, en su
   línea de retroceso al aro; el manejador espera en el punto de uso a que esté
   puesto (reloj real); D5 queda retenido `screenInterceptDelaySeconds` (T13/F05
   del bloqueador, T16 de D5) + peso y rodea al bloqueador; O5 rueda profundo al
   poste bajo débil y el bloqueador ciego se abre al pop. Entrada:
   `chainedVariant` (orden «Variante encadenada», o `auto`: `seleccion_variante`
   con la misma proyección frente a la defensa observada). Lectura del
   bloqueador (`lectura_spain_bloqueador`): sin objetivo (cambio, trampa, show,
   a la altura) se queda en el codo y se juega Horns con la misma ficha.
   Respuesta (`respuesta_bloqueo_ciego`, orden `backScreenCall`
   auto/seguir/cambiar): seguir, ayudar desde la pintura (deja el pop) o cambiar
   (D3 al roll, D5 al pop; persiste). Lectura de O1 `lectura_spain`. Técnico:
   `RollReceiverEnv.invert.targetReadySeconds` (el pop aún se abre),
   `CoreContext.set` mutable, `roll_continuation`/`back_screen_pop` fechados al
   arrancar (un triple rápido no adelanta el relato). Default de la variante
   en el partido: `auto`.
2. `6157d03` — **ficha `delay_mano_a_mano` (LAB-0.10)**: interior arriba, el otro
   en el poste bajo, esquina fuerte y ala débil; pase de entrada, entrega en mano
   (cuerpo del pívot como pantalla; orden sin balón de D1 por concesión en
   `auto`), respuesta de D5 hundirse/cambiar/saltar la entrega (`seleccion_cobertura`
   propia: el resto `coverage_not_in_card`), `lectura_delay`,
   `lectura_delay_pivote` (aro, puerta de atrás, alto-bajo, invertir),
   `respuesta_poste` («dig» por concesión; si llega antes del giro, dos sobre el
   balón con robo T07/T15) y `lectura_poste` (aro rodeando a D4, gancho T02,
   salida a la esquina, corte del ala débil, repostear). `decideHandlerRead`
   admite quién lee. **Solo por orden** (`offeredInAuto=false`).
3. `a7e341c` — **arreglo encontrado en el recorrido de `/lab`**: ante saltar la
   entrega o el cambio, 15–22 de cada 19–36 cortes eran falta tardía (Puerto
   23–33 PF, 3–5 excluidos por partido). Causa geométrica: el corte atravesaba
   a D3 (a 0,01 m de su línea) y solo D3/D5 cerraban; la llegada repetida de D3
   caía siempre en la ventana de frenada. Ahora el corte rodea a D3, el pívot y
   la puerta de atrás rodean a D5 en el punto de la entrega y D4 se gira al
   cortador desde el poste. Semillas 91–94: faltas tardías en el corte 0 de
   16–28, PF de Puerto 10–21. Prueba de regresión.
4. Documentación (este commit): matriz (Spain, Delay, poste con salidas y su
   colocación jugables; roll profundo, pop, keeper, backdoor, corte, poste y
   dig parciales; nota de saques), `ACTIONS`, `AUDIT`, `CAPABILITIES`,
   `CHANGELOG`, foto de las 20 (sección v2-5).

#### Pruebas realmente pasadas
`npm run check` completo (lint + typecheck + test + docs:check + build) en
`e48e5db` (333 tests), `6157d03` (344) y `a7e341c` (345). Nuevas:
`me07b-v2-spain.test.ts` (10), `lab-0-9-parameters.test.ts` (3),
`me07b-v2-delay.test.ts` (9), `lab-0-10-parameters.test.ts` (3); ampliada
`playbook-card.test.ts`. Recalculadas con causa (Spain en `auto` cambia la
secuencia natural): dos prórrogas/guardián 984 → **1718** (ninguna en 1–1717);
la prueba de faltas de tiro fuera de segundas oportunidades pasa de 2 a 8
partidos (92+93 daban 13/29 con Spain y 25/42 sin él; las ocho, 79/125 y
84/135); la de trampa no elegible y las de Horns→bloqueo fijan
`chainedVariant: "ninguna"` (son de esa regla y de esa ficha); el partido
reproducible de ME-07A tiene 60 s de límite.

#### Evidencia de «jugable»
- **Horns→Spain** (semilla 92, Sierra Horns+Spain): ante drop 108/108
  bloqueos ciegos físicos (bloqueador a 0,7 m de D5, espera del manejador ≥ 0,
  retraso > 0), 96/96 tiros con `cardId=horns_spain` y lectura causante de su
  ficha. **Discriminante, misma defensa (drop):** Horns→bloqueo `lectura_bloqueo_o1`
  pase_o5 102 / finalizar 0, remata tras segunda entrada 67; Spain
  `lectura_spain` finalizar 48 / pase_o5 45 / triple 13 / pop 2, segunda entrada
  0; la ayuda deja libre «en el codo» (base) frente a «en el pop» (Spain).
  **Contrafactual (misma ficha y semilla):** `seguir` → ayudar 91 / seguir 21,
  O1 pasa al pop 49 (47 triples), finalizar 45; `cambiar` → 112 cambios
  cantados, pop 8 (6 triples), finalizar 65 y 33 remates del roll. **Negación:** ante
  cambio y trampa, 115/115 «quedarse en el codo» (`back_screen_target_absent`)
  y se juega Horns. En la foto natural seed, Spain 37 de 44 Horns.
- **Delay** (semilla 92, Sierra Delay): drop → 101 entregas hechas y
  `lectura_delay` (aro 64, poste 35); show → 103-104 entregas negadas y
  `lectura_delay_pivote` (aro del pívot 60-67, poste 25-31, puerta de atrás 6-17);
  cambio → 102 cambios en la entrega, triple tras la entrega menos valioso.
  Poste: con defensores rápidos (F04/M01/M05 = 15) la ayuda llega antes del
  giro y el poste sale a la esquina; con un tirador de esquina malo la ayuda
  no le deja esa salida.
- **`/lab` real** (PostgreSQL 16 + Chromium de Playwright, `walk-spain-delay.cjs`
  y `walk-delay2.cjs` en el scratchpad; árbol de `6157d03` y de `a7e341c` para
  Delay): restaurar ambos equipos desde el seed; semilla 92 con Sierra
  «Colocación: Horns» + «Variante encadenada: Spain» y Puerto drop → 102–122;
  Puerto «Bloqueo ciego: Cambiar» → 89–101; Puerto «Cambio» → 103–126 (115
  «quedarse en el codo»); Sierra «Colocación: Delay» y Puerto drop → 97–116,
  show → 104–150, cambio → 93–104, auto → 86–122; auto/auto → 133–136 (igual que
  v2-4). Las diez exportaciones `ME-07B-AUDIT-1` (~1 MB) abiertas: `stop=final`,
  actas conciliadas, `chainedVariant`/`backScreenCall` en la configuración,
  todos los tiros de la ficha enlazados (Spain 96/96, 101/101, 103/103; Delay
  tras `a7e341c` 82/82, 82/82, 91/91, 91/91; auto/auto 107/107; las dos de Delay
  sobre `6157d03`, antes del arreglo, 85/85 y 80/80). Repetidas con el dominio desde la configuración
  exportada: mismo marcador y mismo número de hechos en las diez.

#### Regresión
Barrido `scripts/me07b-v2-stop-sweep.ts 1 60` en `e48e5db` y en `6157d03`
(idénticos entre sí): **180/180 `final`**, 0 actas sin conciliar, 5 relevos de
emergencia ROT-3, ningún `menos_de_cinco`. Foto de las 20: 20 `final` y
conciliadas (sección v2-5 de `ME-07B-v2-foto-basal-20.md`, con `dc71e16`
recalculado al lado); idéntica entre `e48e5db` y `a7e341c`. Coste: 11 partidos
seed con auditoría 20,3 s → 24,8 s.

#### Probado y retirado (no commiteado)
- Spain sin sincronizar: el bloqueador ciego salía con el resto y buscaba el
  primer punto del retroceso de D5 que podía cortar; llegaba con D5 ya a 2 m
  del aro en casi todas las combinaciones de F01/F04 (el drop retrocede desde
  que arranca el roll). Se sustituyó por la espera del manejador.
- Delay en la colocación `auto`: elegido en el 6–40 % de las organizaciones
  naturales, coste por partido ≈ +50 % y 15 pruebas de semilla natural rotas.
  No se deja competir hasta contrastar sus concesiones (poste, corte) con las
  del bloqueo; queda por orden.
- Ayudas de Delay que paran a contacto del tirador (y solape estricto global):
  quitaban casi todas las faltas de las finalizaciones de Delay (PF 1–5), al
  revés que el resto del motor; se retiró por el arreglo geométrico de `a7e341c`.

#### No verificado / pendiente
- **Saques** (stack, Iverson, box, diamond, elevator): el contexto
  reglamentario existe (5 s, reloj al toque, 24/14, alternancia), pero el
  receptor es «el más cercano, recibe donde está» y **nadie defiende el
  saque**; falta la primitiva de saque defendido (nota en la matriz). No se
  inició para no dejar a medias algo que cambia todos los saques.
- Delay no compite en `auto`; el poste no trabaja de espaldas; la ayuda de la
  esquina llega tarde con el fixture; el «dump-off» al poste cuando D4 ayuda no
  existe.
- En Spain la puerta del cambio tardío nunca se cierra con el fixture (≤ 0,52 s
  frente a ≥ 0,65 s del corte); flare y otras salidas de Spain pendientes.
- La regla de falta tardía de cierre es determinista (`evaluateCloseoutLegality`):
  con geometría repetida puede concentrar faltas; aquí se corrigió la geometría,
  no la regla.
- Resto de §4–§7 y `menos_de_cinco` como en v2-4.

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-stop-sweep.ts 1 60
npx tsx scripts/me07b-v2-baseline-20.ts
```
Siguiente paso: la primitiva de saque defendido (colocación por ficha, marca
de cada receptor, pantallas sin balón, lectura del sacador con la cuenta de
5 s, pase con desvío) y sobre ella una ficha de saque; contrastar Delay para
dejarlo competir en `auto`.

### Sesión v2-6 — 2026-10-01

**Base:** `478ad56`; rama `claude/me-07b-v2-capitulo-tactico`, **PR #11 Draft**
(no se fusiona ni se marca Ready). Encargo de Dennis para esta ronda (literal):
«Pausa la construcción de saques. La próxima ronda debe centrarse en el
partido auto/auto: hacer que Delay pueda competir mediante una comparación
válida, comprobar por qué domina el bloqueo directo y mostrar en /lab
partidos completos con decisiones variadas y explicables, sin cuotas
artificiales. Compara las mismas 20 semillas y enseña posesiones
consecutivas, no solo jugadas escogidas como ejemplo. Deja la PR en Draft y
entrega los resultados aunque el monopolio persista.» Saques: sin trabajo.

**Resultado en una línea: el monopolio del bloqueo persiste como familia
(94,0 % de 4.710 en la foto de las 20; antes 86,5 % de 4.613) y se reparte
como ficha (central 93,4 % → 40,5 %); Delay compite y se elige 33 veces
(0,7 %).** Detalle en `docs/match/analysis/ME-07B-v2-comparador-v2-6.md`.

#### Trabajo interrumpido de la sesión anterior (qué se hizo con él)
La sesión se cortó por límite de API con el motor sin commitear (comparador,
Delay en `auto`, balón suelto con parejas vivas, receptor del roll sin reloj
y semillas de escenario recalculadas). Se leyó el diff completo y se ejecutó
`npm run check`: **verde** (350 tests). Se **terminó y commiteó tal cual**
(`47f2eea`) porque era coherente y correcto; no se revirtió nada. La
afirmación de su comentario («decidía el 82 % de las colocaciones a favor de
una ficha que valía menos») se **verificó** sobre `478ad56`: 3.801 de 4.639
(81,9 %), 3.556 a favor de la central.

#### Hecho y verificado (con commits)
1. `47f2eea` — **ficha por valor y Delay en `auto`** (ver CHANGELOG):
   colocación por mejor valor proyectado; banda de LAB-0.3 solo entre
   asignaciones de la misma ficha, por la primera lectura real
   (`firstReadSeconds`); Delay valorado frente a `defenseByHandoffResponse`
   (aparte de las coberturas de pantalla) y fuera de `offenseByFamily`;
   motivo `placement_tied_first_read_later`; desglose por cobertura en la
   auditoría; balón suelto recuperado por el ataque conserva las parejas vivas
   (un segundo cambio en la posesión las dejaba al revés); receptor del roll
   sin vía viable porque el reloj expira → lectura auditada sin opción y
   violación (antes, excepción). Nueva `me07b-v2-comparator.test.ts`.
2. `54a0979` — **la banda no cruza de plan en la central** (encontrado en esta
   sesión al comparar Sierra +5: 264 mano a mano → 3 con `47f2eea`; 71
   colocaciones proyectaban la mano a mano como mejor plan y la asignación
   ejecutada era la del bloqueo, que leía antes). Tras el arreglo: 15.
3. Este commit — scripts reproducibles `me07b-v2-placement-gap.ts`
   (brecha emparejada y su descomposición, y la etapa de familia),
   `me07b-v2-projection-calibration.ts` (proyectado frente a anotado por
   ficha y cobertura) y `me07b-v2-possession-slice.ts` (posesiones
   consecutivas desde una exportación de `/lab`); análisis nuevo
   `docs/match/analysis/ME-07B-v2-comparador-v2-6.md` (la foto basal ya tenía
   295 líneas) enlazado desde el índice; matriz, ACTIONS, AUDIT, CHANGELOG.

#### Por qué domina el bloqueo (cifras reales; detalle en el análisis)
- **Colocación:** Delay nunca supera a la mejor de las otras tres salvo 33
  veces (Sierra +3, semilla 86, Puerto). Mediana de la brecha −0,08 a −0,20;
  ante la misma respuesta base (drop/hundirse) ya vale 0,05–0,16 menos, y las
  coberturas que muestra el rival suman hasta +0,06 al bloqueo.
- **Familia en la central:** la proyección sola prefiere la mano a mano en 343
  de 587 decisiones (foto seed, Sierra) y se juega en 106: lo observado sube el
  bloqueo +0,135 y baja la mano a mano −0,083 de media. No es sesgo de unidades
  (ambas se miden igual): la mano a mano central rinde 0,67 por uso frente a
  0,96 proyectados; el bloqueo central 1,09 frente a 0,97; Delay 0,61 frente a
  0,77 (n = 33). Con este fixture, la mano a mano y Delay crean menos de lo que
  promete su primera lectura.

#### `/lab` real (PostgreSQL 16 + Chromium de Playwright, `next start`)
`walk-v26.cjs` en el scratchpad (restaurar ambos equipos desde el seed, todo
`auto`, auditoría, descarga `.json.gz`; opcional `SIERRA_INC=3` con «Todos» +
«+3» y restauración al terminar), sobre el árbol de `54a0979`:
- Semilla 92 → **130–128** (= dominio), `stop=final`, 0 actas sin conciliar.
  Posesiones **101–120 consecutivas** (tramo fijado antes del segundo arreglo,
  no escogido): colocaciones central/lateral/Horns con valores separados por
  0,000–0,019, coberturas cambio/show/drop/por debajo con su concesión, lecturas
  atacar el cambio, pase al roll (aro/floater/invertir), finalizar y triple;
  familia bloqueo en las 19 que organizan; Delay 0,13–0,20 por debajo en todas.
- Sierra +3, semilla 86 → **183–85** (= dominio): Delay 33 veces; posesiones
  109–128: Delay en 8 de las 9 de Puerto (0,760 frente a 0,744 de Horns), ante
  «hundirse» y siempre con `entrada_poste_o4`; racha de 16 seguidas (117–147).

#### Pruebas realmente pasadas
`npm run check` completo (lint + typecheck + test + docs:check + build) en el
árbol de `47f2eea` (350 tests) y en `54a0979` (350). Recalculadas con causa
(cambia la secuencia natural): ME-04 bocina con tiro anotado 560 → **540**,
fallo sin rebote 41 → **31**, dos prórrogas/guardián 376 → **111** (ninguna en
1–110); ROT-3 natural pasa de Puerto rol 3 (ninguna semilla 1–150 lo alcanza)
a **Sierra rol 5, semilla 9** (entra O4); receptor sin reloj 1134 → **597** (1
de 1.200); Delay en `auto` +5/103 → **+3/86**; faltas de trampa sobre 92–94
(92 y 93 no tienen ninguna); frontera del bloqueo sobre 92–93; Horns frente a
central comprueba que nadie queda libre en el codo (la central puede jugar la
mano a mano); roles: banda solo dentro del mismo plan.

#### Regresión
`scripts/me07b-v2-stop-sweep.ts 1 60` en `54a0979`: **180/180 `final`**, 0 actas
sin conciliar, 3 relevos de emergencia ROT-3 (seed 9; +5 43 y 50), ningún
`menos_de_cinco` ni guardián. Foto de las 20 (`me07b-v2-baseline-20.ts`): 20
`final` y conciliadas; tabla antes/después en el análisis v2-6. Coste con
auditoría: seed 25,5 s → 29,9 s (11 partidos).

#### No verificado / pendiente
- **DECISIÓN REQUERIDA (Dennis):** si la colocación (ficha) debe aprender de
  sus propios resultados con la misma regla LAB-0.4 que ya usa la familia.
  Sin ello Delay hace rachas que no rinden (semilla 86); con ello cambiaría
  también el reparto central/lateral/Horns. No implementado.
- Por qué la mano a mano central y Delay rinden ~30 % menos de lo proyectado
  (la proyección llega a la primera lectura; lo que pasa después no se
  proyecta): sin diagnosticar por dentro.
- Pase desviado recuperado por el pasador «en 0,00 s» y repetido: preexistente
  (373/382 recuperaciones a 0,00 s en `478ad56`), repeticiones seguidas 4 → 6.
- Sierra +5 pierde su mano a mano (264 → 15): Horns gana por valor y la mano a
  mano solo existe en la central.
- Saques (pausados por Dennis), `menos_de_cinco` y el resto de §4–§7 como en v2-5.

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-stop-sweep.ts 1 60
npx tsx scripts/me07b-v2-baseline-20.ts
npx tsx scripts/me07b-v2-placement-gap.ts
```
Siguiente paso: la decisión de Dennis sobre el aprendizaje por ficha; después,
diagnosticar dentro de la mano a mano central y de Delay la distancia entre
lo proyectado y lo anotado.

### Sesión v2-7 — 2026-10-04

**Base:** `030056f`; rama `claude/me-07b-v2-capitulo-tactico`, **PR #11 Draft**
(no se fusiona ni se marca Ready). Encargo de Dennis para esta ronda (literal):
«Objetivo de esta ronda: averiguar por qué la mano a mano central y Delay
producen menos puntos por uso de los que promete su proyección, mientras el
bloqueo directo produce más. Comprueba primero que proyección y resultado
miden el mismo tramo de posesión. Desglosa pérdidas, reloj, ayudas, calidad y
ejecución del tiro, segundas lecturas y reorganizaciones. Para Delay, amplía
la muestra con varias semillas y partidos dirigidos; sus 33 usos naturales en
un solo partido no bastan para concluir que haya un error sistemático. Si
identificas un defecto causal concreto, corrígelo y añade una prueba que
falle antes del arreglo y pase después. Mantén acotado el cambio. Aún no
implementes aprendizaje por colocación, ni ajustes valores para obtener un
reparto deseado, ni añadas saques u otras tácticas. Tras el cambio, compara
las mismas 20 semillas y revisa un tramo consecutivo auto/auto desde /lab si
el entorno lo permite. Ejecuta las pruebas pertinentes durante el desarrollo
y npm run check una vez al cerrar; repite el barrido de 180 solo si cambia el
comportamiento del partido. Deja la PR en Draft y documenta causa,
resultados, coste y pendientes. Si no encuentras una causa demostrable,
entrega el diagnóstico sin introducir un arreglo especulativo.»

**Resultado en una línea: defecto causal demostrado en la mano a mano central
(su lectura prometía triples abiertos que la ejecución resolvía siempre
contestados) y corregido; Delay no tiene error sistemático; el «exceso» del
bloqueo es la ventana de medida.** Detalle en
`docs/match/analysis/ME-07B-v2-mano-a-mano-delay-v2-7.md`.

#### Hecho y verificado (con commits)
1. `6b74634` — `scripts/me07b-v2-handoff-delay-gap.ts`: por uso organizado,
   en la ventana de `settleObservation`, proyección (colocación, familia en
   el instante real, ante la respuesta elegida), primera lectura real,
   primer tiro (probabilidad y oposición usadas frente a las supuestas),
   libres, resto, pérdidas, reloj y segundas lecturas; `--directed` juega
   mano a mano, Delay y bloqueo central por orden en 20 semillas.
2. `7f85c55` — **arreglo**: en `runHandoffPhase`, `pase_o3`, `continuar_o4` y
   `finalizar_portador` se valoran con `estimateContestLevel` y los mismos
   argumentos que `resolveShotAttempt` (calculados una vez, reutilizados en
   la ejecución); `opposition` auditada. Sin coeficientes nuevos ni cambio de
   geometría, ejecución o defensa. Prueba discriminante nueva
   `me07b-v2-handoff-read.test.ts`: **falla antes** («guardar_espacio semilla
   1 continuar_o4: expected 1.173 to be close to 0.633») y pasa después.
3. Este commit — análisis v2-7 enlazado desde el índice, matriz, ACTIONS,
   AUDIT, CHANGELOG y este progreso.

#### Ventana de medida (lo primero que se comprobó)
Misma decisión de partida (`seleccion_familia`) en proyección y resultado.
La proyección es el primer tiro esperado de la primera lectura × completado
de pases (cada desvío acaba en pérdida: el defensor que desvía recupera en
0,00 s en todos los casos medidos); lo anotado suma además libres y lo que
viene tras el primer tiro. Foto de las 20 antes del arreglo: bloqueo central
proyección 0,926, anotado 1,058 = 0,907 (1.er tiro) + 0,070 (libres) + 0,081
(resto): su «exceso» es la ventana. Mano a mano central 0,975 frente a 0,763
= 0,494 + 0,044 + 0,225: la caída está entre la lectura (1,170) y el tiro
real (0,632; oposición 1 en 199 de 200). La calibración v2-6 usaba la
proyección de la colocación (1,027 frente a 0,975 de la familia): artefacto
menor.

#### Delay con muestra ampliada
2.209 usos dirigidos (20 semillas, Sierra en impares y Puerto en pares):
proyección 0,841 (colocación) / 0,821 (ante la respuesta elegida), anotado
0,872; por partido anotado − proyectado +0,032 ± 0,026 (error típico), 7 de
20 por debajo. Tras el arreglo (Delay no cambia de código): −0,018 ± 0,025,
12 de 20. Oposición supuesta = usada en todas sus vías registradas; el poste
sube de 0,771 a 1,018 por tiro (corte del ala débil) y lo compensa con 17 %
de pérdidas, ya proyectadas. Los 33 usos de la semilla 86 (0,61 frente a
0,77) eran ruido de un partido.

#### Mismas 20 semillas (`030056f` → `7f85c55`)
20/20 `final` y conciliadas en ambos. Familia bloqueo **94,0 % → 99,3 %**
(4.704/4.737): la mano a mano central pasa de 249 usos a 1 porque, valorada
con la oposición que de verdad encuentra, vale ~0,5 frente a ~0,9 del
bloqueo. Delay 33 (un partido) → 32 (seed 96 Sierra 8, +3 88 Puerto 9, +5 104
Puerto 15), con 0,906 anotados frente a 0,781 proyectados. Puntos: seed
1.302/1.229 → 1.325/1.296; +3 895/658 → 934/633; +5 444/331 → 483/313. Tabla
completa en el análisis v2-7. Es la consecuencia del arreglo, no un objetivo.

#### `/lab` real (PostgreSQL 16 + Chromium, `next start`, árbol de `7f85c55`)
`walk-v26.cjs` y `walk-v27-dho.cjs` en el scratchpad. Semilla 92 todo `auto`
→ **103–121** (= dominio), conciliado; posesiones 101–120 consecutivas
(mismo tramo que v2-6): lateral/central, drop/ICE/show, pase al roll y
finalizar; ninguna mano a mano en el partido. Semilla 92 con mano a mano
por orden en los dos → 119–98: 133 lecturas, 120 tiros con oposición
supuesta = usada y lectura media 0,542 = tiro esperado 0,542. Sierra +3,
semilla 88 → 140–121 (= dominio), Puerto con Delay 9 veces; perfiles
restaurados al seed.

#### Pruebas realmente pasadas
`npx vitest run` completo (351) en `7f85c55`; `npm run check` completo (lint +
typecheck + test + docs:check + build, 351 tests) en verde sobre el árbol final. Recalculadas con causa (cambia la secuencia natural):
bocina con tiro anotado 540 → **148**, fallo sin rebote 31 → **21**, dos
prórrogas/guardián 111 → **206** (ninguna en 1–205); ROT-3 natural de Sierra
semilla 9 → mismo estado en **Puerto, semilla 74** (ninguna semilla 1–150
repite el de Sierra); Delay en `auto` +3/86 → **+3/88**; M07 sobre 92–94
(92+93 empatan 34/34; 91–98: 76 frente a 136); receptor del roll sin reloj
**construido** (ninguna semilla 1–3000 drop/drop lo alcanza); la prueba de
fichas juega la mano a mano central por orden; proyección frente a la
defensa observada con casos construidos (el fixture no acerca nunca la mano
a mano al bloqueo: 0 de 2.271 decisiones en 91–110); entrega de Delay
decidida tras la bocina (semilla 92, posesión 160) sin hecho, preexistente.

#### Regresión y coste
`scripts/me07b-v2-stop-sweep.ts 1 60` en `7f85c55`: **180/180 `final`**, 0
actas sin conciliar, 3 relevos de emergencia ROT-3 (+3 56; +5 7 y 9), ningún
`menos_de_cinco` ni guardián. Coste de la foto de las 20 con auditoría,
mismo equipo y en serie: seed 27,6 → 27,9 s, +3 20,0 → 14,5 s, +5 6,9 →
8,0 s (total 54,5 → 50,5 s). Los partidos dirigidos (60) tardan ~4 min.

#### No verificado / pendiente
- **DECISIÓN REQUERIDA (Dennis):** la geometría sintética de la mano a mano
  central (ME-06) no crea ninguna vía exterior abierta: la lectura espera a
  que D3 llegue al corte y el punto del bloqueo de O4 está a 0,81 m de donde
  ayuda D4. Si debe competir, hay que decidir su diseño. Sigue pendiente la
  decisión v2-6 sobre el aprendizaje por ficha (no implementado).
- La orden sin balón `auto` de la mano a mano compara concesiones con el
  umbral antiguo; el cierre de D4 reutiliza `tD3AtCut` como llegada.
- Pase desviado recuperado por el defensor en 0,00 s (preexistente).
- Saques (pausados), `menos_de_cinco` y el resto de §4–§7 como en v2-6.

#### Reanudar
```bash
cd BeManager && git fetch origin && git checkout claude/me-07b-v2-capitulo-tactico && git pull
npm ci && npm run check
npx tsx scripts/me07b-v2-stop-sweep.ts 1 60
npx tsx scripts/me07b-v2-baseline-20.ts
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --photos
npx tsx scripts/me07b-v2-handoff-delay-gap.ts --directed --seeds 1-20
```
Siguiente paso: las decisiones de Dennis (geometría de la mano a mano;
aprendizaje por ficha); después, el resto de §4–§7.
