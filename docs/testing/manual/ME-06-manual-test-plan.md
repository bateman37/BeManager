# ME-06 — Plan de prueba manual

**Identificador:** ME-06
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar
la mano a mano sin balón, el selector de plan ofensivo, la orden de
defensa sin balón, los controles de perfiles de laboratorio y la
corrección acotada de ME-04B, desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-06.
**No cubre:** una repetición completa de ME-01–ME-04B (ver los planes
anteriores); aquí solo se prueba lo que añade o corrige esta entrega.
**Documentos relacionados:** `docs/match/{ACTIONS,CAPABILITIES,AUDIT,SCENARIOS}.md`,
`docs/process/DEFINITION_OF_DONE.md`,
`docs/prompts/implementation/ME-06-ataques-variados-correccion-ME04-laboratorio.md`.
**Última actualización:** 2026-09-29.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-06**, no desde la rama de la PR.

**El motor cambia de verdad esta entrega.** El marcador exacto y qué vía
elige cada equipo pueden ser distintos de partidas anteriores con la misma
semilla, incluso jugando `bloqueo_directo` (la corrección acotada de
ME-04B desplaza el flujo de números aleatorios sembrado del resto del
partido). No compares contra un marcador fijado de antemano.

## 0. Requisitos previos

Los mismos que en ME-04/ME-04B: Node.js 22 y PostgreSQL local accesible.

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
npm run dev
```

**Esperado:** sin errores en rojo; el seed es no destructivo.
**Resultado real:** _______________

Abre `http://localhost:3000/lab`.

## 2. Controles de perfiles: restablecer y aplicar un incremento

En la sección «Perfiles de laboratorio (ME-06)»:

1. En **Sierra Clara**, marca «Todos» y anota los 12 IDs mostrados.
   Edita a mano un atributo de un jugador (por ejemplo O1) desde el
   editor de arriba, guárdalo.
2. Pulsa **«Restaurar desde el seed»** en Sierra Clara. Lee el aviso de
   confirmación (debe enumerar los 12 perfiles y avisar que los
   jugadores manuales quedan intactos) y confirma.
   **Esperado:** el atributo editado vuelve a su valor del fixture; si
   habías duplicado un jugador (ID fuera del fixture), sigue existiendo
   sin cambios; **Puerto Ámbar no cambia**.
   **Resultado real:** _______________
3. Selecciona 2-3 jugadores de Puerto Ámbar (no «Todos») y pulsa **+3**.
   Lee el aviso (debe decir cuántos atributos ya estaban en 15).
   Confirma.
   **Esperado:** solo esos jugadores cambian sus 27 atributos activos
   (`min(15, valor + 3)`); nombre/medidas/tendencia no cambian; recarga
   la página (F5): los valores nuevos persisten; Sierra Clara no cambió.
   **Resultado real:** _______________
4. Sin cambiar la selección, pulsa **+5**.
   **Esperado:** el resultado se **acumula** sobre el +3 ya aplicado
   (no equivale a +5 desde el seed): compáralo restableciendo el equipo
   entre pruebas si quieres verificar la diferencia.
   **Resultado real:** _______________
5. Deselecciona todos los jugadores de un equipo: los botones +1/+3/+5
   quedan deshabilitados.
   **Resultado real:** _______________

## 3. Un partido por cada plan ofensivo (misma semilla)

En «Partido completo FIBA 2026», semilla **82**, drop/drop, Proteger
balance en ambos, «Registrar auditoría» marcada. Juega tres partidos
seguidos, cambiando solo el **plan ofensivo** de ambos equipos cada vez:
`bloqueo_directo`, `mano_a_mano_sin_balon`, `auto`.

**Esperado en cada uno:**
- El partido termina con un ganador (o, rara vez, una prórroga) y un acta
  que concilia.
- El marcador y la línea «Plan ofensivo (ME-06)» del visor coinciden con
  el plan elegido.
- Con `mano_a_mano_sin_balon`, el relato narra explícitamente «Se organiza
  el mano a mano», la entrega a O2 y el bloqueo/corte de O3 en varias
  posesiones, no solo bloqueos directos.
- Con `auto`, el marcador coincide con uno de los otros dos partidos (el
  motor elige la misma familia en las dos aperturas, dado que ambos
  equipos comparten la plantilla natural); si buscas `seleccion_familia`
  en la auditoría descargada (§4), la familia elegida no cambia de una
  posesión a otra sin motivo.

**Resultado real (bloqueo_directo):** _______________
**Resultado real (mano_a_mano_sin_balon):** _______________
**Resultado real (auto):** _______________
**Señal de rechazo:** el partido se detiene por el guardián sin
explicación clara, el acta no concilia, o `auto` no coincide con ninguna
de las dos familias forzadas.

## 4. Defensa sin balón

Con `mano_a_mano_sin_balon` en ambos equipos, misma semilla 82, juega dos
partidos cambiando solo la **orden de defensa sin balón** de ambos
equipos: `guardar_espacio` y `negar_primera_salida`.

**Esperado:** marcador distinto entre los dos; en el relato/auditoría
(§4), con `guardar_espacio` aparecen posesiones donde D4 ayuda y O4
recibe libre; con `negar_primera_salida`, D4 nunca ayuda (O3 recibe
directamente cuando D3 lo pierde, sin que O4 se abra).
**Resultado real:** _______________

## 5. Descargar y comparar auditorías

Descarga la auditoría (`.json.gz`) de dos de los partidos jugados
(por ejemplo `bloqueo_directo` y `mano_a_mano_sin_balon`), descomprímelas
y ábrelas con un editor de texto.

**Comprobaciones:**

- [ ] `schemaVersion` es `"ME-06-AUDIT-1"` en ambas.
- [ ] `input.teams[].offensivePlan` y `offBallDefensiveCall` coinciden con
      lo elegido en la interfaz para ese partido.
- [ ] `decisions.records` incluye `seleccion_familia` con `chosenOptionId`
      igual a la familia realmente jugada en cada posesión organizada.
- [ ] Con `mano_a_mano_sin_balon`: existen registros
      `entrada_mano_a_mano`, `transferencia_mano_a_mano`,
      `bloqueo_indirecto_o3` y `lectura_mano_a_mano`, con `holderId`/
      `participants` como IDs reales (`SC01`..`SC12`/`PA01`..`PA12`).
- [ ] `result.summary.byFamily` tiene al menos una fila por equipo con
      `entries > 0` y la familia realmente jugada; `fgm2 ≤ fga2` y
      `fgm3 ≤ fga3` en cada fila.
- [ ] `run.matchFingerprint` **difiere** entre el archivo de
      `bloqueo_directo` y el de `mano_a_mano_sin_balon` (planes distintos,
      foto distinta); si vuelves a jugar la **misma** semilla y plan sin
      cambiar perfiles, la huella de `input.teams[]` coincide con la de
      antes.
- [ ] No se ha reinterpretado ningún archivo antiguo: los `.json.gz` de
      ME-04B que pudieras tener guardados siguen abriéndose y siguen
      diciendo `"ME-04B-AUDIT-1"`.

**Resultado real:** _______________

## 6. `npm run check`

```powershell
npm run check
```

**Esperado:** todo en verde (lint, typecheck, test, docs:check, build),
sin PostgreSQL corriendo si quieres reproducir el estado del CI (los
tests de dominio no lo necesitan).
**Resultado real:** _______________
