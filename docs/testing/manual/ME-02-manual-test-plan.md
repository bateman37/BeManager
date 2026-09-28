# ME-02 — Plan de prueba manual

**Identificador:** ME-02
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar drop/trampa y las tres correcciones de ME-01, desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-02.
**No cubre:** una repetición completa del recorrido de ME-01 (ver `ME-01-manual-test-plan.md`); aquí solo hay un recorrido de regresión acotado más el nuevo mecanismo.
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`, `docs/match/{ACTIONS,SCENARIOS,RULES,CAPABILITIES}.md`, `docs/prompts/implementation/ME-02-trampa-y-salidas-con-correcciones-me01.md`.
**Última actualización:** 2026-09-28.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-02**, no desde la rama de la PR.
Si ya tienes `.env` y jugadores editados de ME-01, consérvalos: no borres
tu base de datos ni relances el seed en modo destructivo (ver paso 2).

## 0. Requisitos previos

Los mismos que en ME-01: Node.js 22, PostgreSQL local accesible. Si ya
validaste ME-01 en esta máquina, tu entorno ya sirve.

## 1. Actualizar `main` e instalar dependencias

```powershell
cd BeManager
git checkout main
git pull
npm ci
```

**Esperado:** sin errores en rojo.
**Resultado real:** _______________
**Señal de rechazo:** cualquier error de instalación o de `git pull`.

## 2. Preservar tu `.env` y tus jugadores editados

**No** copies de nuevo `.env.example` sobre tu `.env` existente: perderías
tu `DATABASE_URL` si la personalizaste. Si tu base de datos ya tiene los
equipos de ME-01 (con tus ediciones de jugadores), el paso 3 **no** los
sobrescribe: el seed de ME-02 solo crea lo que falte.

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

**Esperado:** el mensaje final es
`Sembrado no destructivo: N jugadores creados, M ya existían y se conservaron tal cual (ediciones de Dennis intactas).`
Si ya tenías los diez jugadores de ME-01, `N` debería ser 0 y `M` 10.
**Resultado real:** _______________
**Señal de rechazo:** el mensaje indica un restablecimiento no pedido, o
alguna de tus ediciones previas desaparece al reabrir `/lab`.

> Solo si quieres **deliberadamente** restablecer el fixture completo
> (perdiendo tus ediciones a propósito), ejecuta
> `$env:LAB_SEED_FORCE_RESET="1"; npm run prisma:seed` y después
> `Remove-Item Env:LAB_SEED_FORCE_RESET`.

## 3. Arrancar la aplicación y abrir el laboratorio

```powershell
npm run dev
```

Abre `http://localhost:3000/lab`.

**Esperado:** ves tus dos equipos y diez jugadores (los mismos de ME-01,
con tus ediciones si las hiciste). Cada jugador muestra ahora también
**M09 · Comunicación** en el grupo "Mentales", con grado y valor.
**Resultado real:** _______________
**Señal de rechazo:** falta M09 en la ficha, o alguna otra capacidad
desapareció o se reinició a un valor por defecto.

## 4. Regresión acotada: repetir un escenario de ME-01

Escenario "Drop con ayuda", cobertura **Drop**, semilla `1`, pulsa
"Ejecutar".

**Esperado:** ves el relato por pasos completo (pantalla, ayuda de D3,
posible pase, tiro/rebote/falta) y la cancha con las posiciones finales,
igual que en ME-01.
**Resultado real:** _______________
**Señal de rechazo:** un error en pantalla, o el relato se corta antes de
un estado terminal.

## 5. Cobertura de trampa: la misma posesión, cambiando solo la cobertura

Con el mismo escenario "Drop con ayuda" y la **misma semilla** (`1`),
cambia el selector "Cobertura ante el bloqueo" a **Trampa** y pulsa
"Ejecutar".

**Esperado:** el relato es visiblemente distinto: D5 sale a comprometer a
O1 junto a D1 (hecho "trap_committed" o similar en el texto), D3 pasa a
low man, D4 rota exponiendo a O4. En la cancha, D5 ya no protege el aro en
el instante inicial.
**Resultado real:** _______________
**Señal de rechazo:** el relato de trampa es idéntico al de drop con la
misma semilla, o no se aprecia ningún cambio de responsabilidades.

## 6. Falta real por closeout tardío (C1)

Selecciona el escenario "Closeout tardío con contacto", cobertura Drop,
prueba varias semillas (1, 2, 3, 4...) hasta ver un resultado de "falta
ordinaria de tiro" (`shooting_foul` en el estado terminal).

**Esperado:** al menos una de esas semillas produce la falta, con libres
ejecutados y reflejados en el relato.
**Resultado real:** _______________
**Señal de rechazo:** ninguna semilla de las probadas produce la falta
(regresión de C1), o el relato no muestra los libres.

## 7. Comparaciones por lotes: perfiles normales

Con tus jugadores tal cual (perfiles normales, sin editar capacidades
defensivas), tamaño de muestra `100`, semilla `1`:

7.1. Pulsa "Comparar lote (ayuda sí/no)" en la tabla **«Drop: ayuda
sí/no»**.

**Esperado:** con ayuda, "Pases a la esquina (O3)" es mayor que 0 en
alguna corrida del lote; sin ayuda, es 0. Las columnas muestran categorías
en español, no claves internas.
**Resultado real:** _______________
**Señal de rechazo:** "Pases a la esquina (O3)" es 0 en ambas columnas.

7.2. Pulsa "Comparar lote (drop/trampa)" en la tabla **«Misma posesión:
drop/trampa (con ayuda)»**.

**Esperado:** las dos tablas están separadas visualmente, con su propio
título; los números de "Faltas de tiro" no son un ~65% de las corridas
(982/1500 sería la señal de rechazo del experimento, ver paso 8).
**Resultado real:** _______________

## 8. Defensa técnica a 15 (rechazo del experimento de faltas)

Edita las ocho capacidades defensivas de un jugador defensivo (por
ejemplo D3) a 15: T15, T16, T17, T18, T19, T20, T22, T23. Guarda. Repite
el lote «Drop: ayuda sí/no» con tamaño de muestra `300` y semilla `1`.

**Esperado:** "Faltas de tiro" **no** ronda el ~65% de las corridas
(982/1500 en la muestra completa del prompt); debe ser sensiblemente
menor. "Pases a la esquina (O3)" sigue siendo alcanzable con ayuda.
**Resultado real:** _______________
**Señal de rechazo:** las faltas de tiro rondan de nuevo ~65% de las
corridas, o las esquinas vuelven a estar permanentemente a 0 con ayuda.

## 9. Estadística conciliada (C3)

En cualquier lote ejecutado, compara: "Oportunidades de tiro" debe ser
mayor o igual que "2FGA + 3FGA" sumados (nunca menor); "Puntos" debe
coincidir con `2×2FGM + 3×3FGM + FTM` (puedes comprobarlo a mano con los
números mostrados).
**Resultado real:** _______________
**Señal de rechazo:** "2FGA + 3FGA" supera a "Oportunidades de tiro", o
los puntos no cuadran con la fórmula.

## 10. Recorrido completo y ambas tablas atribuibles

Ejecuta un escenario individual, cambia después la semilla sin volver a
ejecutar.

**Esperado:** el resultado anterior desaparece o queda claramente
desactualizado (no se muestra un relato que ya no corresponde a la
semilla actual). Lo mismo al cambiar cobertura, escenario o perfiles.
**Resultado real:** _______________
**Señal de rechazo:** un resultado antiguo permanece visible tras cambiar
la configuración, sin ninguna indicación.

---

**Aceptación final:** todos los pasos anteriores con resultado real
igual al esperado. Cualquier señal de rechazo marcada bloquea la fusión
(ya fusionada aquí: en ese caso, abre un hotfix siguiendo
`docs/process/WORKFLOW.md`).
