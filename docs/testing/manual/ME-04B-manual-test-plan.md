# ME-04B — Plan de prueba manual

**Identificador:** ME-04B
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar
las correcciones del bloqueo directo (desplazamiento real de O1/D1,
primera lectura ponderada por valor, oposición geométrica R_contest) y de
la auditoría, desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-04B.
**No cubre:** una repetición completa de ME-01–ME-04A (ver los planes
anteriores); aquí solo se prueba lo que corrige esta entrega.
**Documentos relacionados:** `docs/match/{ACTIONS,RULES,AUDIT,SCENARIOS}.md`,
`docs/process/DEFINITION_OF_DONE.md`,
`docs/prompts/implementation/ME-04B-lecturas-oposicion-y-auditoria.md`.
**Última actualización:** 2026-09-29.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-04B**, no desde la rama de la PR.

**El motor cambia de verdad esta entrega.** El marcador exacto, el reparto
de tiros y qué vía elige O1 pueden ser distintos de partidas anteriores con
la misma semilla — eso es lo esperado, no un fallo. No compares contra un
marcador fijado de antemano: comprueba el comportamiento (qué vía se eligió,
si la oposición y los enlaces de la auditoría tienen sentido), no una cifra
exacta.

## 0. Requisitos previos

Los mismos que en ME-04/ME-04A: Node.js 22 y PostgreSQL local accesible.

## 1. Actualizar `main`, instalar y preparar la base

```powershell
cd BeManager
git checkout main
git pull
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

**Esperado:** sin errores en rojo; el seed es no destructivo (no
sobrescribe tus perfiles guardados).
**Resultado real:** _______________
**Señal de rechazo:** cualquier error, o el seed dice haber sobrescrito
perfiles.

## 2. Arrancar y jugar un partido natural (semilla 82, drop/drop)

```powershell
npm run dev
```

Abre `http://localhost:3000/lab`, baja hasta «Partido completo FIBA 2026»,
pon semilla **82**, cobertura **Drop** en ambos equipos, prioridad
**Proteger balance** en ambos, con «Registrar auditoría» marcada. Pulsa
«Jugar partido» y espera a que termine.

**Esperado:** el partido termina con un ganador (o, rara vez, una prórroga)
y un acta que concilia (puntos del acta = marcador, FGM≤FGA, FTM≤FTA,
minutos cuadran).
**Resultado real:** _______________
**Señal de rechazo:** el partido se detiene por el guardián sin explicación
clara, o el acta no concilia (avisos en rojo en el visor).

### 2.1. Recorre el relato y busca un tiro de O1 o una salida real a O4/O2

Avanza el relato período → posesión → hecho hasta encontrar una posesión en
la que **O1 finaliza él mismo**, **tira un triple**, o **pasa a O3/O4/O2**
(no siempre a O5). No hace falta forzarlo con perfiles: con la semilla y
cobertura natural debería aparecer al menos una vez en un partido completo.

**Esperado:** el relato describe esa vía con su propio texto (por ejemplo
«O1 finaliza en el aro» o «O1 encuentra a O3 en la esquina débil»), no
siempre «O1 pasa al continuador O5».
**Resultado real:** _______________
**Señal de rechazo:** las 200+ posesiones del partido eligen siempre
`pase_o5` como primera vía (compruébalo en la auditoría descargada, ver
§3).

### 2.2. Busca un tiro de O5 contestado por D5 sin falta

Busca un hecho `resolucion_tiro` (en la auditoría, ver §3) con
`chosenOptionId: "legal_contest"` o con oposición geométrica 0,5/1 y sin
falta. En el relato correspondiente no debe aparecer ninguna falta de tiro
en esa jugada.

**Esperado:** existe al menos una jugada así en el partido.
**Resultado real:** _______________

### 2.3. Busca un caso de ayuda que deja libre a otro jugador

En el relato, localiza un hecho «La ayuda de D3 deja libre a O3 en la
esquina débil» seguido de «D4 intenta reparar hacia la esquina débil y deja
libre a O4».

**Esperado:** ambos hechos aparecen encadenados en varias posesiones del
partido (mecanismo sin cambios en esta entrega, solo reverificado).
**Resultado real:** _______________

### 2.4. Sustitución: decisión posterior con ID e enlace reales

Localiza una sustitución en el relato (por ejemplo SC06 entra por O1).
Busca, después de esa sustitución, una decisión de auditoría cuyo titular
sea el jugador que entró (no el que salió).

**Esperado:** en la auditoría descargada (§3), ninguna decisión posterior a
la sustitución tiene como `holderId` al jugador que ya salió; el que entró
aparece con su propio ID cuando le toca decidir.
**Resultado real:** _______________
**Señal de rechazo:** una decisión posterior sigue citando al jugador que
salió.

## 3. Descargar la auditoría y comprobar la trazabilidad

Pulsa «Descargar auditoría (.json.gz)», descomprímelo y ábrelo con un
editor de texto o `JSON.parse` en una consola.

**Comprobaciones (prompt §4):**

- [ ] `schemaVersion` es `"ME-04B-AUDIT-1"`.
- [ ] `decisions.records` con `point: "lectura_bloqueo_o1"`: al menos una
      decisión no elige `"pase_o5"` (§2.1), y las opciones no elegidas
      tienen `values.situationalValue` numérico (no `"no_evaluada_por_
      cortocircuito"` salvo casos estructuralmente inaplicables, como
      `pase_o3` en un escenario sin ayuda de D3).
- [ ] `holderId`/`participants` de esas decisiones son IDs reales
      (`SC01`..`SC12`, `PA01`..`PA12` o los nombres reales del fixture),
      nunca literalmente `"O1"`/`"D3"` salvo que ese titular concreto tenga
      ese ID real (los titulares del fixture del repo coinciden por
      construcción, ver `docs/match/CAPABILITIES.md`).
- [ ] Para una decisión con `factLink` no nulo, busca en `timeline` un
      hecho del mismo `kind` en el mismo `atMs`: debe existir. Si el
      `factLink` es `null`, es una ausencia explícita, no un error.
- [ ] `result.summary.rejectionReasons`: para `entrada_fase_transicion` y
      `puerta_falta_sin_tiro`, si `total > 0`, `chosenByReasonCode` no está
      vacío (antes de ME-04B mostraba `{}`).

**Resultado real:** _______________

## 4. Contraste rápido: trampa/trampa y prioridad distinta

Vuelve a jugar la **misma semilla 82** con cobertura **Trampa** en ambos
equipos y prioridad **Cargar rebote** en ambos.

**Esperado:** un partido distinto y jugable (no necesariamente mejor ni
peor); en el relato, la trampa produce sus propios hechos
(`trap_committed`, `trap_broken_advantage`...).
**Resultado real:** _______________

## 5. Semillas de referencia (motor corregido, sin marcador fijado)

| Semilla | Configuración | Qué comprobar |
|---|---|---|
| 210 | drop/drop, Proteger balance | Compárala con la semilla 82: la primera lectura sigue dominada por `pase_o5` con los perfiles del fixture, pero no al 100 % (busca al menos un `triple_o1` en la auditoría). |
| 125 | drop/drop, Proteger balance | Un tiro se libera antes de la bocina **final del partido** y entra; después del hecho `buzzer`, solo se resuelve ese tiro (`field_goal_attempt`, `shot_result`, `possession_ended`), nada más. |
| 14 | drop/drop, Proteger balance | Un tiro se libera a tiempo y falla justo en la bocina: no se inventa un rebote después. |
| 7 | trampa/trampa, Cargar rebote | El partido llega a **dos prórrogas** antes de decidirse; el reloj de cada prórroga es 5:00 y las faltas de equipo de C4 se acumulan tal cual. |

No fijes un marcador esperado para ninguna de ellas: compara la mecánica
(qué vía se elige, si hay falta/tapón/robo cuando toca), no el resultado
final.

## 6. `npm run check`

```powershell
npm run check
```

**Esperado:** todo en verde (lint, typecheck, test, docs:check, build), sin
PostgreSQL corriendo si quieres reproducir el estado del CI (los tests de
dominio no lo necesitan).
**Resultado real:** _______________
