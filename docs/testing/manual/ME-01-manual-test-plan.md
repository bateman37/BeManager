# ME-01 — Plan de prueba manual

**Identificador:** ME-01
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar el Laboratorio de Partido desde la interfaz.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-01.
**No cubre:** pruebas automáticas (ver `docs/process/TESTING_STRATEGY.md`) ni el hotfix HF-001 (operativo, sin interfaz propia).
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`, `docs/match/README.md`, `docs/prompts/hotfix/HF-002-me01-integridad-y-rapido.md`.
**Última actualización:** 2026-09-28 (pasos 13bis y 16bis–16quinquies añadidos por HF-002).

Instrucciones para **Windows PowerShell**, sin dar por hecho conocimientos
avanzados de programación. Para cada paso: qué comando ejecutar o qué
hacer en pantalla, qué deberías ver, un hueco para tu resultado real y una
señal que implicaría rechazar la PR.

## 0. Requisitos previos

Los mismos que en FND-001: Node.js 22, PostgreSQL local accesible. Si ya
validaste FND-001, tu entorno ya sirve.

## 1. Cambiar a la rama de la PR y actualizar

```powershell
cd BeManager
git fetch origin
git checkout <nombre-de-la-rama-de-la-PR>
git pull
```

**Esperado:** sin errores; `git status` muestra la rama de la PR.
**Resultado real:** _______________

## 2. Instalar dependencias

```powershell
npm ci
```

**Esperado:** termina con `added N packages` sin errores en rojo.
**Resultado real:** _______________
**Señal de rechazo:** cualquier error de instalación.

## 3. Revisar tu `.env` sin sobrescribirlo

Si ya tienes `.env` de FND-001, no hace falta tocarlo. Si no, cópialo:

```powershell
Copy-Item .env.example .env
```

Ajusta `DATABASE_URL` si tu PostgreSQL local usa otro usuario/puerto.

## 4. Migrar PostgreSQL y sembrar el laboratorio

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

**Esperado:** la migración aplica `lab_teams` y `lab_players` sin errores;
la siembra termina con `Sembrados 2 equipos y 10 jugadores de laboratorio.`
**Resultado real:** _______________
**Señal de rechazo:** un error de migración, o la siembra no informa 10 jugadores.

## 5. Arrancar la aplicación

```powershell
npm run dev
```

Abre `http://localhost:3000`.

**Esperado:** ves la página Foundation con un enlace "Abrir el laboratorio".
**Resultado real:** _______________

## 6. Abrir el laboratorio y ver los diez jugadores

Haz clic en "Abrir el laboratorio" (o ve a `http://localhost:3000/lab`).

**Esperado:** ves dos equipos (Sierra Clara y Puerto Ámbar) con cinco
jugadores cada uno, y al hacer clic en uno se abre su ficha con medidas y
capacidades agrupadas (Ofensivos, Defensivos/rebote, Mentales, Físicos),
cada una mostrando también su letra `E−`…`A+`.
**Resultado real:** _______________

## 7. Crear/editar y guardar un jugador

Selecciona "Izan Marea" (O1), cambia "T09 · Precisión pase" a un valor
distinto (por ejemplo, 10), y pulsa "Guardar".

**Esperado:** aparece "Guardado correctamente." (o con avisos, si aplica).
**Resultado real:** _______________

## 8. Recargar y comprobar que el valor persiste

Recarga la página completa del navegador (F5).

**Esperado:** al volver a abrir a "Izan Marea", T09 sigue mostrando el
valor que guardaste, no el original.
**Resultado real:** _______________
**Señal de rechazo:** el valor vuelve al original tras recargar.

## 9. Duplicar un jugador

Con cualquier jugador seleccionado, pulsa "Duplicar".

**Esperado:** aparece un nuevo jugador en la lista del mismo equipo, con
"(copia)" en el nombre, y queda seleccionado.
**Resultado real:** _______________

## 10. Ejecutar el escenario "Drop con ayuda"

En la sección "Escenario", deja seleccionado "Drop con ayuda", semilla `1`,
y pulsa "Ejecutar".

**Esperado:** aparece la cancha esquemática con los diez jugadores y el
aro, un "Estado terminal", y el relato con "Paso siguiente" mostrando un
primer hecho ("O5 llega y coloca su pantalla central.").
**Resultado real:** _______________

## 11. Avanzar el relato paso a paso

Pulsa "Paso siguiente" varias veces, y haz clic en alguno de los hechos ya
mostrados.

**Esperado:** cada pulsación revela un hecho más; al hacer clic en un
hecho, la cancha muestra las posiciones de ese instante ("quién estaba
dónde").
**Resultado real:** _______________

## 12. Repetir el mismo escenario y semilla

Pulsa "Repetir (misma semilla)".

**Esperado:** se genera exactamente la misma secuencia de hechos y el
mismo estado terminal que en el paso 10.
**Resultado real:** _______________
**Señal de rechazo:** un resultado distinto con la misma semilla y sin
cambios de por medio.

## 13. Cambiar la ayuda de D3 y comparar

Cambia el escenario a "Drop sin ayuda" (misma semilla `1`) y pulsa
"Ejecutar". Compara con el paso 10.

**Esperado:** el relato ya no incluye "La ayuda de D3 deja libre a O3";
la secuencia es distinta.
**Resultado real:** _______________

## 13bis. HF-002 — Un cambio de selección limpia el resultado anterior

Con el resultado del paso 13 todavía visible, cambia la semilla a `2` (sin
pulsar "Ejecutar").

**Esperado:** el relato y la cancha del resultado anterior desaparecen de
inmediato; no queda un relato de la semilla `1` mostrado como si fuera de
la `2`.
**Resultado real:** _______________
**Señal de rechazo:** el resultado anterior sigue visible tras cambiar la
semilla o el escenario, sin ejecutar de nuevo.

## 14. Cambiar una capacidad y observar la primera diferencia

Vuelve a "Drop con ayuda", edita la capacidad T04 (Triple) de O1 a 15,
guarda, y ejecuta de nuevo con la misma semilla.

**Esperado:** en algún punto del relato aparece una diferencia respecto al
paso 10 (por ejemplo, en si se intenta el triple de O1).
**Resultado real:** _______________

## 15. Escenario de closeout tardío

Selecciona "Closeout tardío con contacto", semilla `1`, y ejecuta.

**Esperado:** el relato llega a un hecho de "Falta ordinaria de tiro" con
libres otorgados, y el "Estado terminal" es `shooting_foul`.
**Resultado real:** _______________
**Señal de rechazo:** este escenario nunca llega a una falta en varios
intentos con semillas distintas (prueba semillas 1, 2 y 3).

## 16. Comparar lote rápido

En "Comparar ayuda sí/no", deja tamaño de muestra en `30` y pulsa
"Comparar lote".

**Esperado:** aparece una tabla con columnas "Con ayuda" / "Sin ayuda"; la
fila `helpLeftAssignment` es 0 en "Sin ayuda" y mayor que 0 en "Con ayuda".
Debajo de la tabla se leen las semillas y versiones usadas, y un texto
recuerda que esta tabla siempre compara ayuda sí/no, no el escenario
seleccionado arriba.
**Resultado real:** _______________

## 16bis. HF-002 — Balón vivo tras un tapón o una pérdida

Ejecuta "Drop con ayuda", semilla `232`.

**Esperado:** el "Estado terminal" es `blocked_shot_live_ball` y la línea
"Balón" muestra `loose` (suelto), no `dead` en el aro.
**Resultado real:** _______________
**Señal de rechazo:** el balón aparece `dead` tras un tapón o una pérdida
en balón vivo.

## 16ter. HF-002 — Libres ejecutados y último libre fallado

Ejecuta "Closeout tardío con contacto", semilla `9`.

**Esperado:** el relato incluye un hecho de "Falta ordinaria de tiro" y,
después, varios hechos "anota/falla el libre X de N"; el "Estado
terminal" final ya no es `shooting_foul` a secas (el último libre falló y
el rebote posterior decidió el desenlace, por ejemplo
`missed_shot_defensive_rebound`).
**Resultado real:** _______________

Repite con semilla `4`: el "Estado terminal" debe quedar en
`shooting_foul` con el libre adicional anotado (canasta válida + falta).
**Resultado real:** _______________

## 16quater. HF-002 — Rebote ofensivo con segundo tiro

Ejecuta "Drop con ayuda", semilla `145`.

**Esperado:** el relato muestra un fallo, un rebote (`rebound_contested` o
`rebound_secured`) capturado por un atacante, y un segundo "prepara un
lanzamiento" antes del "Estado terminal" final (`made_basket`). Hay más de
un hecho de tipo tiro preparado en el mismo relato.
**Resultado real:** _______________

## 16quinquies. HF-002 — Prueba conjunta de defensa a 15 (T15–T23)

Edita cada jugador de Puerto Ámbar (D1–D5) y sube a `15` sus ocho
capacidades defensivas/rebote (T15, T16, T17, T18, T19, T20, T22, T23),
sin tocar los perfiles ofensivos. Ejecuta "Drop con ayuda", semilla `1`, y
compara el relato con el mismo escenario y semilla usando los perfiles
originales (puedes anotar el resultado del paso 10 como referencia).

**Esperado:** al menos un eslabón de la cadena cambia de forma explicable
(llegada, navegación de pantalla, recepción, oposición, tapón, cierre o
captura de rebote, falta o tiro) respecto al perfil original. No se exige
que cada conteo bruto (por ejemplo, tapones) suba de forma monótona: lo
que cambian primero son los tiros y ventanas que realmente se alcanzan.
**Resultado real:** _______________

Restaura los perfiles originales de Puerto Ámbar antes de continuar.

## 17. Probar el fallo de guardado sin base de datos

Detén PostgreSQL (o cambia temporalmente `DATABASE_URL` a un valor
inválido y reinicia `npm run dev`). Intenta guardar un jugador.

**Esperado:** aparece un mensaje de error claro ("No se pudo guardar..."),
sin mostrar tu cadena de conexión ni contraseña. La página no se rompe.
**Resultado real:** _______________
**Señal de rechazo:** la página se rompe, o el mensaje muestra credenciales.

Restaura PostgreSQL (y `.env` si lo cambiaste) antes de continuar.

## 18. Ejecutar la comprobación agregada

Detén el servidor (`Ctrl+C`) y ejecuta:

```powershell
npm run check
```

**Esperado:** lint, tipos, pruebas, validación documental y build terminan
sin errores.
**Resultado real:** _______________

## Veredicto final

- [ ] Todos los pasos anteriores han dado el resultado esperado.
- [ ] Observaciones adicionales: _______________
