# ME-04A — Plan de prueba manual

**Identificador:** ME-04A
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar el interruptor «Registrar auditoría» y la descarga de auditoría del partido completo, desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-04A.
**No cubre:** una repetición completa de ME-01–ME-04 (ver `docs/testing/manual/ME-04-manual-test-plan.md`); aquí solo se prueba lo nuevo de la auditoría.
**Documentos relacionados:** `docs/match/AUDIT.md`, `docs/process/DEFINITION_OF_DONE.md`, `docs/prompts/implementation/ME-04A-auditoria-exportable-partidos.md`.
**Última actualización:** 2026-09-29.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-04A**, no desde la rama de la PR.

**Un partido jugado antes de ME-04A no sirve para esto.** Si tienes un
partido en pantalla de una sesión anterior, no tendrá auditoría: vuelve a
jugar la misma semilla con «Registrar auditoría» activado para poder
descargarla. Las cifras de este plan corresponden a los **perfiles del
fixture**; si has editado capacidades o medidas de algún jugador, el
marcador y el reparto de tiros pueden cambiar, y eso es correcto — comprueba
el comportamiento (que el archivo reproduzca lo que ves en pantalla), no la
cifra exacta.

## 0. Requisitos previos

Los mismos que en ME-04: Node.js 22 y PostgreSQL local accesible.

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
sobrescribe tus perfiles guardados; si ya lo habías corrido, dice que los
24 jugadores ya existían).
**Resultado real:** _______________
**Señal de rechazo:** cualquier error, o el seed dice haber sobrescrito
perfiles.

## 2. Arrancar y activar la auditoría

```powershell
npm run dev
```

Abre `http://localhost:3000/lab` y baja hasta «Partido completo FIBA 2026
(ME-04)».

**Esperado:** junto a la semilla ves una casilla **«Registrar auditoría»**
ya marcada por defecto.
**Resultado real:** _______________
**Señal de rechazo:** la casilla no existe, o aparece desmarcada por
defecto.

## 3. Jugar la semilla 1 (drop/drop, «Proteger balance») y descargar

Pon semilla **1**, cobertura **Drop** en ambos equipos, prioridad
**Proteger balance** en ambos, con «Registrar auditoría» marcada. Pulsa
«Jugar partido» y espera a que termine.

**Esperado:** aparece el visor del partido y, justo debajo del marcador, un
recuadro **«Auditoría exportable (ME-04A)»** con la semilla, el `gameId` y
«Registro de auditoría activado en esta corrida», con un botón **«Descargar
auditoría (.json.gz)»**.
**Resultado real:** _______________
**Señal de rechazo:** el recuadro no aparece, o dice que la auditoría
estaba desactivada.

Pulsa **«Descargar auditoría (.json.gz)»**.

**Esperado:** el navegador descarga un archivo llamado
`bemanager-auditoria-semilla-1-<gameId>.json.gz`; debajo del botón aparece su
tamaño en KB (comprimido, del orden de algunos cientos de KB: el `.json`
sin comprimir del partido natural completo pesa del orden de 14 MB).
**Resultado real (nombre y tamaño del archivo):** _______________
**Señal de rechazo:** no se descarga nada, o el nombre no incluye la
semilla.

## 4. Abrir el archivo y comprobar que reproduce la pantalla

El archivo es un `.json` comprimido con gzip. Descomprímelo primero (7-Zip,
`Expand-Archive` no sirve para `.gz`; en Git Bash o WSL: `gzip -d
archivo.json.gz`) y abre el `.json` resultante con un editor de texto (o
`code`, o `Get-Content archivo.json | ConvertFrom-Json` en PowerShell).

Comprueba, comparando con lo que ves en `/lab` para esa misma corrida:

- `run.seed` es `1` y `run.gameId` coincide con el de la pantalla.
- `input.teams` tiene los perfiles **actuales** (con tus ediciones, si las
  hay) de los dos equipos.
- `result.finalScore` coincide con el marcador final de la pantalla.
- `timeline.length` coincide con «… hechos» que muestra el recuadro del
  marcador.
- `result.box` coincide con el acta que ves en la pantalla (puntos,
  rebotes, faltas de al menos dos jugadores a tu elección).

**Resultado real:** _______________
**Señal de rechazo:** cualquier discrepancia entre el archivo y la pantalla
de esa misma corrida.

## 5. Localizar una posesión con tiro interior y su lectura

En `decisions.records`, busca una entrada con `"point": "lectura_bloqueo_o1"`
y `"chosenOptionId": "pase_o5"` (el continuador recibe y finaliza cerca del
aro: con el fixture es la vía más frecuente). Anota su `possessionIndex`.

- En `continuity.possessions`, localiza la posesión con ese `index`: debe
  existir y tener un `teamId`.
- En la misma decisión, dentro de `options`, localiza la opción `"id":
  "finalizar"` con `"status": "descartada_por_condicion"`: debe traer
  `values` con números (por ejemplo `o1TimeToHoopSeconds` y
  `d5TimeToHoopSeconds`), no un texto vacío ni `null`.
- En `timeline`, filtra por ese mismo `possessionIndex` y confirma que hay
  un hecho `"kind": "field_goal_attempt"` cerca del `atMs` de la decisión.

**Resultado real (possessionIndex encontrado y el par de valores de la
alternativa rechazada):** _______________
**Señal de rechazo:** no encuentras ninguna decisión `pase_o5`, o la opción
rechazada no trae valores numéricos, o no hay ningún hecho de tiro en esa
posesión.

## 6. Segunda semilla (82, mismos planes) y comprobación de que son archivos distintos

Cambia solo la semilla a **82** (mismas coberturas y prioridades), pulsa
«Jugar partido» y luego «Descargar auditoría (.json.gz)».

**Esperado:** un segundo archivo `bemanager-auditoria-semilla-82-<gameId>.json.gz`,
con `gameId` distinto del de la semilla 1 y, normalmente, tamaño distinto.
**Resultado real (nombre y tamaño):** _______________
**Señal de rechazo:** el segundo archivo tiene el mismo `gameId` que el
primero, o el marcador coincide punto por punto con el de la semilla 1.

*(Opcional, si quieres un caso con prórroga: prueba la semilla **3** con los
mismos planes; el resultado exacto puede cambiar si tienes perfiles
editados.)*

## 7. Cambiar semilla/plan y comprobar que no se ofrece una descarga vieja

Con el partido de la semilla 82 en pantalla, cambia la semilla a un número
distinto (por ejemplo 5) **sin volver a pulsar «Jugar partido»**.

**Esperado:** el visor del partido desaparece y se muestra un aviso de que
el partido anterior pertenecía a otra foto y se ha retirado; no hay ningún
botón de descarga ofrecido para una semilla que no has jugado.
**Resultado real:** _______________
**Señal de rechazo:** el recuadro de auditoría sigue visible u ofrece
descargar algo tras cambiar la semilla sin volver a jugar.

Vuelve a poner semilla 82, pulsa «Jugar partido», y ahora **desmarca**
«Registrar auditoría» y pulsa «Jugar partido» otra vez.

**Esperado:** el nuevo partido (auditoría apagada) muestra el recuadro con
«Registro de auditoría desactivado en esta corrida» y una explicación de
que hay que volver a jugar esa semilla con auditoría activada; no hay botón
de descarga.
**Resultado real:** _______________
**Señal de rechazo:** aparece un botón de descarga con la auditoría
apagada, o el archivo de la corrida anterior (con auditoría) se sigue
ofreciendo como si fuera de esta.

## 8. Adjuntar los archivos

Guarda los dos archivos de las semillas 1 y 82 (y el de la 3, si lo
generaste) en una carpeta y adjúntalos en el chat cuando quieras que
investiguemos juntos por qué se reparten así los tiros o las faltas.

**Resultado real (rutas o nombres de los archivos adjuntados):** _______________

## 9. Regresión rápida

Repite un paso básico de `docs/testing/manual/ME-04-manual-test-plan.md`
(por ejemplo, jugar la semilla 82 **sin** tocar la auditoría) y confirma que
el partido, el relato y el acta se ven exactamente igual que antes de esta
entrega.

**Resultado real:** _______________
**Señal de rechazo:** cualquier cambio visible en el partido, el relato o
el acta al desactivar la auditoría.
