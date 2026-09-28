# Módulo de partido — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** qué está implementado en `modules/match/` y por dónde leer según la tarea.
**Debe leerse cuando:** vayas a tocar cualquier código de `modules/match/` o a planificar la siguiente entrega del motor.
**No cubre:** el razonamiento completo de diseño (ver `docs/match/reference/`) ni el orden de las diez entregas (ver `docs/match/roadmap.md`).
**Documentos relacionados:** `docs/foundation/MATCH_CORE_PRINCIPLES.md`, `docs/architecture/MODULE_BOUNDARIES.md`.
**Última actualización:** 2026-09-28.

## Qué existe hoy (ME-01 + ME-02 + ME-03)

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

**No implementado todavía:** partido completo (cuatro períodos, bonus,
final de cuarto), temporadas, más de una
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
| Capacidades activas y parámetros LAB-0.1 | `CAPABILITIES.md` |
| Los tres escenarios, el modo «Jugar tramo» y cómo se validan | `SCENARIOS.md` |
| Diseño completo (no solo lo aprobado) | `reference/README.md` |
| Próximas entregas | `roadmap.md` |

## Estructura de código

```text
modules/match/
  domain/
    geometry/ time/ random/       # primitivas puras (y marco local de ataque, trayectorias: ME-03)
    players/                      # atributos, perfiles, fixture, validación
    lab/                          # parámetros LAB-0.1, escenarios, MatchInput
    simulation/                   # núcleo compartido (modo enlazado ME-03), hechos, resolvers
    sequence/                     # tramo de posesiones enlazadas, reglas de reloj, transición (ME-03)
    fast/                         # aproximación rápida por lotes
  application/
    ports/ use-cases/             # casos de uso de laboratorio
  infrastructure/
    db/                           # PrismaLabTeamRepository
  ui/                              # editor de jugadores, cancha, relato, visor del tramo (ME-03)
```
