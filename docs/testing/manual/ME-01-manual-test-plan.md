# ME-01 — Plan de prueba manual

**Identificador:** ME-01
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar el Laboratorio de Partido desde la interfaz.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-01.
**No cubre:** pruebas automáticas (ver `docs/process/TESTING_STRATEGY.md`) ni el hotfix HF-001 (operativo, sin interfaz propia).
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`, `docs/match/README.md`.
**Última actualización:** 2026-09-28.

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
**Resultado real:** _______________

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
