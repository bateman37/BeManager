# ME-07B — Progreso de trabajo (no es fuente de verdad de diseño)

Archivo de trabajo versionado, exigido por ME-07B §0.5. Se actualiza en cada
sesión/commit relevante. No sustituye a CAPABILITIES/ACTIONS/AUDIT/roadmap
como fuente de verdad; cuando algo quede consolidado, se traslada allí y se
borra de aquí.

## Estado de la PR

PR #10, `claude/new-session-p9xna7` → `main`. **Draft.** No fusionar.

## Sesión 1 — 2026-09-30

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
