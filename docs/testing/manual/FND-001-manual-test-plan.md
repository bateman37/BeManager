# FND-001 — Plan de prueba manual

**Identificador:** FND-001
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar esta entrega desde la interfaz.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega FND-001.
**No cubre:** pruebas automáticas (ver `docs/process/TESTING_STRATEGY.md`).
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`.
**Última actualización:** 2026-09-25.

Instrucciones pensadas para **Windows PowerShell**, sin dar por hecho
conocimientos avanzados de programación. En cada paso se indica qué
comando ejecutar y qué deberías ver.

## 0. Requisitos previos

- Tener instalado Node.js 22 (puedes comprobarlo con `node --version`;
  debería empezar por `v22`).
- Tener PostgreSQL instalado y accesible localmente (o Docker, si ya lo
  usas para otra cosa; esta entrega no lo requiere ni lo instala).

## 1. Clonar o actualizar el repositorio y cambiar a la rama

Si es la primera vez:

```powershell
git clone https://github.com/bateman37/BeManager.git
cd BeManager
git checkout <nombre-de-la-rama-de-la-PR>
```

Si ya lo tenías clonado:

```powershell
cd BeManager
git fetch origin
git checkout <nombre-de-la-rama-de-la-PR>
git pull
```

**Resultado esperado:** el comando termina sin errores y `git status`
muestra que estás en la rama de la PR.
**Resultado real:** _______________

## 2. Instalar dependencias

```powershell
npm ci
```

**Resultado esperado:** termina con `added N packages` y sin errores en
rojo.
**Resultado real:** _______________

## 3. Crear tu archivo de entorno

```powershell
Copy-Item .env.example .env
```

Si ya tenías un archivo `.env` de antes, este comando puede pedirte
confirmar la sobrescritura: si no quieres perderlo, cancela y edítalo tú
mismo a mano en lugar de copiar.

Abre `.env` con un editor de texto y ajusta `DATABASE_URL` con los datos
de tu PostgreSQL local (usuario, contraseña, host, puerto y nombre de
base de datos).

**Resultado esperado:** existe un archivo `.env` en la raíz del proyecto
con tu cadena de conexión.
**Resultado real:** _______________

## 4. Preparar PostgreSQL

Asegúrate de que el servicio de PostgreSQL está en marcha y de que la
base de datos indicada en `DATABASE_URL` existe (puedes crearla con
`createdb` o con tu herramienta habitual, por ejemplo pgAdmin).

## 5. Generar el cliente Prisma y aplicar migraciones

```powershell
npm run prisma:generate
npm run prisma:migrate
```

**Resultado esperado:** ambos comandos terminan sin errores. Como esta
entrega no crea ningún modelo todavía, la migración puede indicar que no
hay cambios que aplicar; eso es correcto.
**Resultado real:** _______________

## 6. Arrancar la aplicación

```powershell
npm run dev
```

**Resultado esperado:** la consola muestra una URL local, normalmente
`http://localhost:3000`.
**Resultado real:** _______________

## 7. Abrir la URL local

Abre `http://localhost:3000` en tu navegador.

**Resultado esperado:** ves una página con el título "BeManager", un
aviso de que el proyecto está en fase Foundation, el estado de la
aplicación y el estado de PostgreSQL.
**Resultado real:** _______________

## 8. Comprobar la vista de escritorio

Con la ventana del navegador a tamaño normal de escritorio, revisa que el
contenido se ve ordenado, legible y sin elementos superpuestos.

**Resultado esperado:** diseño limpio, sin desbordamientos horizontales.
**Resultado real:** _______________

## 9. Comprobar el comportamiento adaptable (móvil)

Reduce el ancho de la ventana del navegador (o usa las herramientas de
desarrollador del navegador para simular un móvil).

**Resultado esperado:** el contenido se reorganiza en una columna y sigue
siendo legible, sin scroll horizontal.
**Resultado real:** _______________

## 10. Comprobar el estado positivo de PostgreSQL

Con PostgreSQL en marcha y accesible, recarga la página.

**Resultado esperado:** el estado de PostgreSQL aparece como "Conectado".
**Resultado real:** _______________

## 11. Provocar un fallo de conexión controlado

Detén temporalmente tu servicio de PostgreSQL, o edita `.env` para que
`DATABASE_URL` apunte a un puerto o contraseña inválidos, y recarga la
página (no hace falta reiniciar `npm run dev` si solo detienes el
servicio; si cambias `.env`, sí debes reiniciarlo).

**Resultado esperado:** la página sigue cargando sin romperse, muestra el
estado de PostgreSQL como "No disponible" y un mensaje genérico, sin
mostrar en ningún momento tu contraseña, usuario o cadena de conexión
completa.
**Resultado real:** _______________

Adicionalmente, visita `http://localhost:3000/api/health` en el
navegador.

**Resultado esperado:** ves una respuesta JSON similar a
`{"application":"ok","database":"unavailable"}` con un código de estado
HTTP 503 (puedes comprobar el código con las herramientas de
desarrollador del navegador, pestaña "Red"/"Network").
**Resultado real:** _______________

## 12. Restaurar la conexión

Vuelve a arrancar PostgreSQL (y, si cambiaste `.env`, restaura el valor
correcto y reinicia `npm run dev`). Recarga la página.

**Resultado esperado:** el estado de PostgreSQL vuelve a "Conectado" sin
que haga falta reiniciar nada más.
**Resultado real:** _______________

## 13. Ejecutar la comprobación agregada

Detén el servidor de desarrollo (`Ctrl+C` en la terminal donde corre) y
ejecuta:

```powershell
npm run check
```

**Resultado esperado:** el comando ejecuta lint, comprobación de tipos,
pruebas, validación documental y build, y termina sin errores.
**Resultado real:** _______________

## Veredicto final

- [ ] Todos los pasos anteriores han dado el resultado esperado.
- [ ] Observaciones adicionales: _______________
