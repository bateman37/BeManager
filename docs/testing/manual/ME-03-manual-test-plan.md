# ME-03 — Plan de prueba manual

**Identificador:** ME-03
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar el modo «Jugar tramo» (posesiones enlazadas, rebote, transición, saques y relojes), desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-03.
**No cubre:** una repetición completa de ME-01/ME-02 (ver sus planes); aquí solo hay una regresión acotada (paso 11).
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`, `docs/match/{MODEL,RULES,ACTIONS,SCENARIOS}.md`, `docs/decisions/ADR-0006-linked-possessions-local-frame.md`, `docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md`, `docs/prompts/implementation/ME-03-posesiones-enlazadas-y-transicion.md`.
**Última actualización:** 2026-09-28.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-03**, no desde la rama de la PR.

**No hace falta reseedear ni sobrescribir jugadores.** ME-03 no añade
migraciones ni cambia el seed: tus diez perfiles guardados, con sus
ediciones, y tu `.env` se quedan como están. Las semillas de este plan dan
el resultado descrito **con los perfiles del fixture**; si has editado
jugadores, los números pueden cambiar (eso es correcto: el tramo usa tus
perfiles guardados). Para comparar con este plan sin tocar tus ediciones,
puedes anotar tus cambios y probar primero los pasos 4–8 con un jugador
sin editar, o aceptar que las cifras difieran y comprobar solo el
comportamiento.

## 0. Requisitos previos

Los mismos que en ME-02: Node.js 22 y PostgreSQL local accesible.

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

## 2. Preservar tu `.env` y tus jugadores

No copies `.env.example` sobre tu `.env`. No ejecutes el seed en modo
restablecimiento (`LAB_SEED_FORCE_RESET`). Solo regenera el cliente y
aplica migraciones pendientes (no hay nuevas en ME-03; el comando es
seguro y no borra datos):

```powershell
npm run prisma:generate
npm run prisma:migrate
```

**Esperado:** Prisma indica que la base de datos ya está al día.
**Resultado real:** _______________
**Señal de rechazo:** Prisma propone restablecer la base de datos (responde
que no y detén la prueba).

## 3. Arrancar y abrir el laboratorio

```powershell
npm run dev
```

Abre `http://localhost:3000/lab`.

**Esperado:** tus diez jugadores con sus ediciones; debajo de la sección
«Escenario» aparece una sección nueva **«Jugar tramo: posesiones enlazadas
(ME-03)»** con Semilla, Cobertura, dos selectores «Prioridad tras tiro de
Sierra Clara / Puerto Ámbar» (por defecto «Proteger balance») y el botón
«Jugar tramo».
**Resultado real:** _______________
**Señal de rechazo:** falta la sección o alguno de sus controles.

## 4. Tramo completo: rebote ofensivo, balón fuera, saque y cambio de lado (semilla 26)

En la sección del tramo: semilla `26`, cobertura **Drop**, ambas
prioridades «Proteger balance». Pulsa «Jugar tramo».

**Esperado:**
- Arriba: «Cuatro posesiones cerradas» y cuatro botones de posesión
  (Sierra Clara, Puerto Ámbar, Sierra Clara, Puerto Ámbar).
- Con «Evento siguiente ▶» o la lista: en 3,19 s «O5 controla el balón
  dividido… (rebote ofensivo)» y a continuación **«Rebote ofensivo de O5:
  nueva fase de la misma posesión»** (etiqueta P1·F2, reloj de lanzamiento
  14 s); luego «Segunda oportunidad».
- En 4,96 s «El rebote sale fuera… último toque de O5», fin de la posesión
  1 y **posesión 2 de Puerto Ámbar**: «Saque para Puerto Ámbar…». Entre ese
  evento y «D5 recibe el saque» (6,38 s) el reloj de partido se queda en
  **7:07.0** y el de lanzamiento dice «sin correr»; al recibir pasa a 24 s.
- Selecciona un hecho de la posesión 2: en la cancha, Puerto Ámbar (rojo)
  ataca el **aro izquierdo**; los diez jugadores aparecen, con el poseedor
  marcado con anillo naranja.
**Resultado real:** _______________
**Señal de rechazo:** el rebote ofensivo abre una posesión nueva; el reloj
de partido corre durante el saque tras balón fuera; algún jugador salta de
posición o desaparece; Puerto Ámbar ataca el aro derecho.

## 5. Rebote defensivo = control rival = nueva posesión (semilla 3)

Semilla `3`, mismas opciones, «Jugar tramo». Ve a la posesión 3
(«Posesión siguiente ⏭» o su botón).

**Esperado:** en 24,23 s «D3 asegura el rebote defensivo», «Termina la
posesión 3… control rival = nueva posesión» y «Empieza la posesión 4 de
Puerto Ámbar… (reloj de lanzamiento 24 s)». El panel dice «Control rival =
nueva posesión (rebote defensivo)» y muestra la lectura «Sin ventaja: ataque
organizado» con los tiempos de llegada.
**Resultado real:** _______________
**Señal de rechazo:** el reloj de lanzamiento no vuelve a 24 s, o el
rebote defensivo aparece como fase de la misma posesión.

## 6. Recuperación viva y robo (semillas 1 y 27)

Semilla `1`: en 1,56 s «D1 recupera el balón suelto… no se anota robo
porque nadie controlaba el balón» y empieza la posesión 2 de Puerto Ámbar
con 24 s. Semilla `27`: en 1,56 s «D1 desvía el pase y recupera el
control: pérdida en balón vivo» y la posesión 1 termina por «robo de D1».

**Esperado:** exactamente eso; en la semilla 1 no aparece la palabra
«robo» en el cierre de la posesión 1.
**Resultado real:** _______________
**Señal de rechazo:** un balón suelto se cuenta como robo, o la posesión
cambia antes de que alguien controle el balón.

## 7. Saque tras canasta: el reloj de partido no se para en el primer cuarto (semilla 1)

Semilla `1`, posesión 3 (12,04 s): «D5 anota 2 puntos», «Saque para Sierra
Clara tras canasta: O3 va al espacio de saque…».

**Esperado:** el reloj de partido **sigue bajando** entre la canasta
(6:59.9) y «O5 recibe el saque» (13,55 s, 6:58.4); el de lanzamiento dice
«sin correr» hasta el toque y entonces marca 24 s. El sacador (O3)
aparece fuera de la línea de fondo **izquierda** (la del aro donde anotó
Puerto Ámbar), llegando a ella corriendo, sin saltos.
**Resultado real:** _______________
**Señal de rechazo:** el reloj de partido se detiene tras la canasta, o el
reloj de lanzamiento empieza al entregar el balón al sacador.

## 8. Cargar rebote frente a proteger balance, cambiando un solo equipo (semilla 2)

8.1. Semilla `2`, ambos «Proteger balance», «Jugar tramo». Anota el evento
9 (1,56 s): «Plan «Proteger balance» … carga O2…; O3, O1, O4 preparan el
retorno». En 5,02 s el rebote ofensivo es de **O5**.

8.2. Cambia **solo** «Prioridad tras tiro de Sierra Clara» a «Cargar
rebote».

**Esperado:** el tramo anterior desaparece al cambiar el selector.
**Resultado real:** _______________

8.3. Pulsa «Jugar tramo» con la misma semilla.

**Esperado:** los eventos 1–8 son iguales; la **primera diferencia** está
en el evento 9 (1,56 s, **antes** de conocer el tiro): «carga O2… y O3…;
O1, O4 preparan el retorno» (O2 y O3 empatan a 1,90 s y el desempate es
por ID). En la cancha, en el evento del tiro, O3 ya va hacia el aro y en
«Quién carga, quién vuelve» aparece «Carga el rebote». En 5,02 s el rebote
ofensivo es ahora de **O3**. La cabecera del visor dice que el tramo se
ejecutó con «Sierra Clara: Cargar rebote».
**Resultado real:** _______________
**Señal de rechazo:** la primera diferencia aparece después del resultado
del tiro; el resultado antiguo sigue visible tras cambiar el selector;
la cabecera atribuye el tramo al plan anterior.

Nota: con el fixture no verás ninguna «Ventaja temprana»: el balance de
dos o tres jugadores siempre llega antes. Es un resultado esperado,
pendiente de la decisión descrita en
`docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md`.

## 9. Recorrer el resultado hacia delante y hacia atrás

En cualquier tramo: usa «◀ Evento anterior», «Evento siguiente ▶»,
«⏮ Posesión anterior», «Posesión siguiente ⏭» y el deslizador.

**Esperado:** todos responden; al pasar del último evento de una posesión
al primero de la siguiente nadie retrocede ni salta; el marcador, los
relojes y «Control: …» cambian coherentemente con el texto del evento.
**Resultado real:** _______________
**Señal de rechazo:** un botón no responde, o un jugador se teletransporta.

## 10. El resultado se invalida al cambiar la configuración

Con un tramo visible, cambia la semilla; repite con la cobertura, con una
prioridad y guardando un jugador.

**Esperado:** cada cambio hace desaparecer el tramo anterior.
**Resultado real:** _______________
**Señal de rechazo:** un tramo antiguo permanece visible sin indicarlo.

## 11. Regresión acotada de ME-01/ME-02

En «Escenario»: «Drop con ayuda», cobertura Drop, semilla `1`,
«Ejecutar». Después, con tamaño de muestra `100`, pulsa «Comparar lote
(drop/trampa)».

**Esperado:** relato por pasos completo como en ME-02 y la tabla drop/trampa
con sus categorías en español.
**Resultado real:** _______________
**Señal de rechazo:** error en pantalla o relato cortado.

## 12. (Opcional) Sin PostgreSQL

Detén PostgreSQL y recarga `/lab`.

**Esperado:** aviso claro de que no se pudo conectar; el tramo se puede
jugar con los perfiles de referencia y la sección lo indica. Al volver a
arrancar PostgreSQL, tus jugadores siguen intactos.
**Resultado real:** _______________
**Señal de rechazo:** error técnico en pantalla o pérdida de jugadores.

---

**Aceptación final:** todos los pasos con resultado real igual al
esperado. Cualquier señal de rechazo abre un hotfix según
`docs/process/WORKFLOW.md`.
