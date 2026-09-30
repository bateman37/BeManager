# ME-07A — Plan de prueba manual

**Identificador:** ME-07A
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar
la tendencia de tiro, la prioridad de creación, la defensa `auto`
(cobertura y orden sin balón), el triple del portador en transición y el
poseedor real conservando la iniciativa al organizar, desde `main` tras
fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-07A.
**No cubre:** una repetición completa de ME-01–ME-06 (ver los planes
anteriores); aquí solo se prueba lo que añade o corrige esta entrega.
**Documentos relacionados:** `docs/match/{ACTIONS,CAPABILITIES,AUDIT,SCENARIOS}.md`,
`docs/decisions/ADR-0009-generalized-tendency-priority-and-auto-defense.md`,
`docs/prompts/implementation/ME-07A-decisiones-vivas-y-partido-auto.md`.
**Última actualización:** 2026-09-30.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-07A**, no desde la rama de la PR.

**El motor cambia de verdad esta entrega.** El marcador exacto, quién crea
cada ataque y si aparece algún triple de transición pueden ser distintos
de partidas anteriores con la misma semilla (el poseedor real ya puede
conservar la iniciativa, y la cobertura/orden sin balón por defecto ahora
es `auto`). No compares contra un marcador fijado de antemano.

## 0. Requisitos previos

Los mismos que en ME-06: Node.js 22 y PostgreSQL local accesible.

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

**Esperado:** sin errores en rojo; la migración añade `shotTendency` con
`DEFAULT 'equilibrada'` sin tocar ningún otro campo.
**Resultado real:** _______________

Abre `http://localhost:3000/lab`.

## 2. Editor de jugador: tendencia de tiro

1. Selecciona un jugador (por ejemplo el base titular de Sierra Clara).
   **Esperado:** junto al selector «Tendencia en bloqueo directo» hay
   ahora un segundo selector «Tendencia de tiro» con
   prudente/equilibrada/decidida.
   **Resultado real:** _______________
2. Cambia la tendencia de tiro, guarda. Recarga la página (F5): el valor
   nuevo persiste.
   **Resultado real:** _______________
3. Pulsa «Restaurar desde el seed» en ese equipo.
   **Esperado:** la tendencia vuelve al valor del fixture (no se borra el
   campo ni el resto de la ficha).
   **Resultado real:** _______________

## 3. Un partido con la misma semilla, dos prioridades de creación

En la sección «Partido completo»:

1. Semilla fija (anótala), Sierra Clara: prioridad de creación
   `equilibrado`, Puerto Ámbar: `equilibrado`. Cobertura y orden sin balón
   en `auto` para los dos. Pulsa **«Jugar partido»**.
   **Esperado:** el resumen bajo el marcador muestra la prioridad de
   creación efectiva de cada equipo junto al plan ofensivo.
   **Resultado real:** _______________
2. Descarga la auditoría (`.json.gz`). Descomprímela y busca
   `decisions.records` con `point: "organizacion_creador"`.
   **Esperado:** al menos algún registro tiene `chosenOptionId` igual a
   un ID que no es el titular de rol 1 del quinteto vigente, con
   `reasonCode: "creator_kept_by_real_holder"` en su opción elegida (si
   no aparece ninguno con esta semilla, prueba otra: no es obligatorio en
   cada partido, pero debe ser observable en algunos).
   **Resultado real:** _______________
3. Cambia la prioridad de creación de Sierra Clara a `buscar_triple`
   (misma semilla, sin tocar nada más). El resultado anterior debe
   quedar retirado con el aviso de foto obsoleta. Juega de nuevo.
   **Esperado:** el marcador y/o el reparto de 2PA/3PA cambian de forma
   explicable; la huella de equipo en la auditoría (`input.teams[].
   fingerprint`) es distinta de la del paso 1.
   **Resultado real:** _______________

## 4. Defensa `auto` frente a manual

1. Con la misma semilla del paso 3, cambia la cobertura de Puerto Ámbar
   de `auto` a `drop` manualmente (deja a Sierra Clara en `auto`). Juega.
   **Esperado:** el resumen indica «Drop» para Puerto Ámbar, no
   «Auto (elige la defensa)».
   **Resultado real:** _______________
2. En la auditoría descargada, busca `point: "seleccion_cobertura"`
   (debería aparecer para el equipo que sigue en `auto`, no para el que
   pusiste en `drop` manual).
   **Esperado:** cada registro tiene `chosenOptionId: "drop"` y la opción
   `trampa` descartada con `reasonCode: "coverage_trap_not_eligible"`
   (hallazgo de calibración documentado en `CAPABILITIES.md`: con el
   fixture y las posiciones iniciales estándar, la trampa `auto` no
   resulta alcanzable todavía). No es un error si no ves ninguna trampa
   elegida.
   **Resultado real:** _______________

## 5. Triple del portador en transición

Con el fixture natural esta vía es rara (el mismo hallazgo de ME-03: el
protector del aro en `drop` casi siempre llega antes que cualquier
atacante en tránsito). Para verla de forma fiable:

1. Ejecuta `npm run test -- me07a` desde una terminal (con el repo
   compilado) y confirma que las pruebas de
   `evaluateTransitionThreeOpportunity` en
   `modules/match/domain/game/me07a.test.ts` pasan: demuestran la ventana
   apareciendo y desapareciendo con geometría construida a mano.
   **Resultado real:** _______________
2. Si quieres verla en un partido real, juega varias semillas con
   cobertura `drop`/`drop` y prioridad `cargar_rebote` en ambos equipos
   (más balones sueltos y transiciones) y busca en la auditoría
   `point: "entrada_fase_transicion"` con `chosenOptionId:
   "triple_portador"`. Puede no aparecer en una muestra corta: no es un
   fallo, es la misma limitación del fixture natural documentada arriba.
   **Resultado real:** _______________

## 6. `npm run check` y recorrido completo

```powershell
npm run check
```

**Esperado:** lint, typecheck, pruebas (231+), documentación y build en
verde.
**Resultado real:** _______________

Repite un partido completo de principio a fin con los dos equipos en
`auto` (plan, cobertura, orden sin balón, prioridad de creación
`equilibrado`), lee el relato completo y el acta, y confirma que
coinciden con la auditoría descargada.
**Resultado real:** _______________
