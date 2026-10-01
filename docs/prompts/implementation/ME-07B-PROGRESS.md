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
