# Módulo de partido — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** qué está implementado en `modules/match/` y por dónde leer según la tarea.
**Debe leerse cuando:** vayas a tocar cualquier código de `modules/match/` o a planificar la siguiente entrega del motor.
**No cubre:** el razonamiento completo de diseño (ver `docs/match/reference/`) ni el orden de las diez entregas (ver `docs/match/roadmap.md`).
**Documentos relacionados:** `docs/foundation/MATCH_CORE_PRINCIPLES.md`, `docs/architecture/MODULE_BOUNDARIES.md`.
**Última actualización:** 2026-09-29 (ME-04B).

## Qué existe hoy (ME-01 a ME-04B)

Un Laboratorio de Partido con un único bloqueo directo central 5×5, ante el
que la defensa puede responder con **drop** (con o sin ayuda de D3) o con
**trampa** (D1+D5 comprometen a O1, D3 pasa a low man, D4 rota exponiendo a
O4). Motor detallado (`modules/match/domain/simulation/`), aproximación
rápida por lotes del mismo escenario (`modules/match/domain/fast/`), 27
capacidades activas por jugador (incluida M09 Comunicación desde ME-02),
diez perfiles de laboratorio fijos y editables, y persistencia de
equipos/jugadores en PostgreSQL.

**ME-03:** modo «Jugar tramo» con hasta cuatro posesiones estadísticas
enlazadas (`modules/match/domain/sequence/`): rebote ofensivo como fase
nueva, rebote defensivo/robo/balón suelto como posesión nueva, saques y
relojes FIBA alcanzables, carga frente a balance por equipo, salida y
lectura de ventaja temprana o ataque organizado, con los diez jugadores
continuos en una cancha global y Puerto Ámbar atacando de verdad el otro
aro (ver `docs/decisions/ADR-0006-linked-possessions-local-frame.md`).

**ME-04:** partido completo FIBA 2026 de laboratorio (`domain/game/`):
salto inicial, 4 × 10:00 y prórrogas sucesivas, bocina, faltas personales y
de equipo con bonus, exclusión por cinco faltas, plantillas de doce con
rotación automática fija, segunda entrada del bloqueo directo, relato y acta
calculados de los hechos, y casos de frontera reglamentarios en `/lab` (ver
`docs/decisions/ADR-0007-shared-continuity-engine-and-game-rules-profile.md`).

**ME-04A:** auditoría exportable de ese mismo partido (`domain/audit/`):
interruptor «Registrar auditoría» y descarga de un `.json` versionado por
partido con la entrada, los hechos, los puntos de decisión observados del
árbol de drop/trampa/segunda entrada/tiro/rebote/falta sin tiro y el
resultado, sin cambiar la simulación (ver `AUDIT.md`).

**ME-04B:** corrige el diagnóstico de las nueve auditorías de ME-04A sobre
el bloqueo directo: O1 y D1 ya se desplazan de verdad hasta el punto de uso
de la pantalla (antes permanecían congelados en su posición de partida); la
primera lectura del bloqueo evalúa de verdad varias vías (finalizar, pase a
O5, pase a O3, triple de O1, salida segura) por un valor de tiro
situacional en vez de cortarse siempre en `pase_o5`; la oposición al tiro
usa un modelo geométrico `R_contest` separado del contacto/falta (LAB-0.3);
y la auditoría resuelve IDs reales de pista, enlaza al hecho realmente
emitido y separa motivo elegido de alternativas descartadas (esquema
`ME-04B-AUDIT-1`, ver `AUDIT.md`). No cambia ninguna otra familia táctica,
cobertura, regla de reloj/falta ni el acta.

**No implementado todavía:** dirección en vivo, fatiga, tiempos muertos,
temporadas, más de una
acción táctica ofensiva, coberturas de bloqueo distintas de drop/trampa,
zonas, cualquier familia de ecosistema (ver
`docs/foundation/COMPETITION_ECOSYSTEMS.md`), la mayoría de los 76 sucesos
P01–P76 y 45 capacidades candidatas del estudio de atributos (27 de 45
están activas; ver `CAPABILITIES.md`).

## Rutas de lectura por tarea

| Tarea | Documentos |
|---|---|
| Entender el estado/hechos del partido y la continuidad del tramo | `MODEL.md` |
| Reglas FIBA 2026 alcanzables (incluidos relojes y saques del tramo) | `RULES.md` |
| La acción de bloqueo directo, carga/balance y transición | `ACTIONS.md` |
| Capacidades activas y parámetros LAB-0.1/0.2/0.3 | `CAPABILITIES.md` |
| Los tres escenarios, el modo «Jugar tramo», el partido completo y los casos de frontera | `SCENARIOS.md` |
| Acta (boxscore) calculada de los hechos y su conciliación | `BOXSCORE.md` |
| Auditoría exportable del partido detallado (esquema, colector, cobertura) | `AUDIT.md` |
| Diseño completo (no solo lo aprobado) | `reference/README.md` |
| Próximas entregas | `roadmap.md` |

## Estructura de código

```text
modules/match/
  domain/
    geometry/ time/ random/       # primitivas puras (y marco local de ataque, trayectorias: ME-03)
    players/                      # atributos, perfiles, fixture, validación
    lab/                          # parámetros LAB-0.1/0.2/0.3, escenarios, MatchInput
    simulation/                   # núcleo compartido (modo enlazado ME-03), hechos, resolvers
    sequence/                     # motor de continuidad compartido, tramo, reglas de reloj, transición (ME-03/ME-04)
    game/                         # partido completo: reglas FIBA 2026 puras, rotación, acta, casos de frontera (ME-04)
    audit/                        # colector y exportador de auditoría del partido (ME-04A/ME-04B)
    fast/                         # aproximación rápida por lotes
  application/
    ports/ use-cases/             # casos de uso de laboratorio
  infrastructure/
    db/                           # PrismaLabTeamRepository
  ui/                              # editor de jugadores, cancha, relato, visor del tramo y del partido
```
