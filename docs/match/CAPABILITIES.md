# Capacidades activas y parámetros LAB-0.1/LAB-0.2

**Estado:** ACTIVE
**Es fuente de verdad para:** qué capacidades tienen mecanismo real y dónde viven los coeficientes LAB-0.1/LAB-0.2.
**Debe leerse cuando:** vayas a activar una nueva capacidad o a calibrar un coeficiente existente.
**No cubre:** las 45 capacidades candidatas completas del catálogo (ver `docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md` §2.2–2.4).
**Documentos relacionados:** `ACTIONS.md`, `docs/decisions/ADR-0004-detailed-engine-analytic-timing.md`.
**Última actualización:** 2026-09-28 (ME-03).

## 27 capacidades activas (de 45 candidatas)

- **Ofensivas (9):** T01, T04, T05, T06, T07, T09, T11, T13, T21.
- **Defensivas/rebote (8):** T15, T16, T17, T18, T19, T20, T22, T23.
- **Mentales (5):** M01, M03, M04, M05, **M09 (Comunicación, ME-02)**.
- **Físicas (5):** F01, F03, F04, F05, F06.
- **Medidas corporales (4):** C01 altura, C02 peso, C03 envergadura, C04
  alcance de pie (cm/kg, no en escala 1–15).

Las 18 capacidades restantes del catálogo (T02, T03, T08, T10, T12, T14,
M02, M06–M08, M10–M12, F02, F07–F10) son candidatas documentadas sin
mecanismo ni rating ficticio: no aparecen en la ficha editable.

## M09 (Comunicación), ME-02 §3

Solo tiene efecto en avisos defensivos con emisor y receptor identificables
(por ejemplo, D5 avisando a D3 de la trampa, o D3 avisando a D4 de que deja
su marca): añade, una única vez por aviso pertinente, la latencia
`m09CoordinationLatencySeconds` = `clamp(0,12 − 0,008 × (min(M09_emisor,
M09_receptor) − 8), 0,06, 0,18)` s entre el aviso reconocido y la respuesta
del otro defensor. No se aplica por fotograma ni como bonus de robo o
tiro, y no sustituye a M01 (reconocer), M05 (situarse) ni M04 (sincronizar
el gesto).

- **Plantillas nuevas del laboratorio:** G=10, W=9, B=9 por defecto;
  overrides D1=12, D3=11, D4=11, D5=10 en el fixture (`lab-roster-fixture.ts`).
- **Perfiles ya persistidos sin M09:** se backfillea con el valor neutro
  explícito **8** (`M09_BACKFILL_NEUTRAL_RATING`, en `player-profile.ts` y
  en `prisma-lab-team-repository.ts`) hasta que el usuario lo edite y
  guarde; no borra ni restablece las otras 26 capacidades.

## Dónde viven los coeficientes

- `modules/match/domain/lab/lab-0-1-parameters.ts` (`LAB_PARAMETERS_VERSION
  = "LAB-0.1"`): coeficientes de ME-01.
- `modules/match/domain/lab/lab-0-2-parameters.ts`
  (`LAB_0_2_PARAMETERS_VERSION = "LAB-0.2"`): los tres parámetros
  deportivos nuevos aprobados en ME-02 — el radio corporal de contacto
  (`BODY_CONTACT_RADIUS_METERS` = 0,35 m por jugador), los dos puntos de
  referencia del short roll/continuación (`SHORT_ROLL_SPOT` (23,0; 7,5) y
  `DEEP_CONTINUATION_SPOT` (24,8; 7,5)), y la latencia de M09.

Cada función documenta su fórmula, unidad y el rango acotado exacto del
prompt correspondiente. No son porcentajes de liga FIBA: son hipótesis de
prototipo, versionadas como datos tipados, no como constantes repartidas
por el código.

## Reglas de no duplicar premio (verificadas con pruebas unitarias)

- `shotReleaseHeightMeters` nunca supera alcance de pie + salto ejecutado:
  C01 sitúa el cuerpo, pero no añade una segunda mano por encima de C04.
- `maxTouchHeightMeters` depende solo de alcance de pie y salto disponible.
- `jumpCeilingMeters` usa el rating bruto de F06, no `d(F06)` (fórmula
  literal del prompt).
- T22 (exterior), T23 (interior) y T15 (contención ya iniciada) ajustan
  tareas distintas y nunca se suman sobre la misma intervención.

## T22/T23 y la elegibilidad real de T18 (HF-002)

ME-01 declaraba T22/T23 como capacidades activas, pero `runPossession` no
las consultaba: cambiar esos ratings no tenía ningún efecto observable.
HF-002 los conecta a las llegadas ya calculadas por `perimeterArrivalAdjustmentSeconds`
y `interiorArrivalAdjustmentSeconds` (ambas ya existían en LAB-0.1, sin
llamador):

- **T22 (perimetral):** ajusta la llegada de un cierre exterior real —
  D4 rotando a la esquina débil, D5 recuperando sobre el triple de O1.
- **T23 (interior):** ajusta la llegada de una protección/recepción
  cercana al aro — D3 ayudando al continuador, D5 protegiendo el carril,
  el defensor de un rebote ofensivo en su segunda oportunidad.

Cada intervención usa solo uno de los dos ajustes, nunca ambos, según sea
exterior o interior (regla ya vigente, ahora aplicada de verdad).

**C1 (ME-02):** subir T22/T23 acerca la llegada del defensor, pero ya no
convierte por sí sola una llegada tardía en falta: la legalidad se decide
comprobando primero si el espacio corporal del defensor (reconstruido en
el instante real de liberación del tiro, no en su instante de "llegada" a
un punto de referencia) se solapa con el del tirador (radio LAB-0.2 de
0,35 m por jugador). Si no se solapan, no hay contacto ni oposición
atribuible, por rápido o lento que llegue el defensor por el reloj.

Además, un tapón (T18) solo es elegible cuando el defensor puede tocar
físicamente el punto de liberación del tiro: `maxTouchHeightMeters` del
defensor debe alcanzar `shotReleaseHeightMeters` del tirador (ambas
fórmulas ya existían, sin usarse en el motor). Subir T18 no garantiza más
tapones brutos si cambian los tiros y ventanas que realmente se alcanzan.

## ME-03: las mismas 27, en tareas del tramo que ya las usaban

El tramo enlazado no activa capacidades nuevas ni coeficientes nuevos:

- **F01** (movimiento, `attackerMoveSpeedMps`): carrera sin balón o con
  bote de cualquier jugador — cargar, retornar, subir el balón, colocarse,
  correr al aro en transición (P53 del catálogo cita F01 para el balance).
- **F04 + T23**: protector del aro en la segunda oportunidad (mismo
  criterio de la opción 1); **T23** también ajusta la llegada al aro del
  primer defensor en transición.
- **T09/T11**: pase de salida, pase adelantado, saque y devolución al base.
- **T19/T20/F05**: la disputa de rebote de siempre; **T20** decide también
  el balón suelto tras tapón o desvío (misma regla del palmeo).
- **T01/T18/F03/F06/C01/C04**: la finalización en transición o segunda
  oportunidad pasa por el mismo `resolveShotAttempt`.

## Editor de equilibrio

Los coeficientes son datos versionados por el desarrollo, no un panel de
administración visual todavía (ese editor es una entrega futura, ver
`docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md` §6). Un
cambio de coeficiente en ME-01 se hace editando
`lab-0-1-parameters.ts` y requiere revisión y pruebas, igual que cualquier
otro cambio de código.
