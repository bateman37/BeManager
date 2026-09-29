# ME-04 — Plan de prueba manual

**Identificador:** ME-04
**Estado:** ACTIVE
**Es fuente de verdad para:** los pasos que Dennis debe seguir para validar el partido completo FIBA 2026 (salto, cuartos, prórrogas, faltas y bonus, banquillo y rotación, relato y acta) y los casos de frontera, desde `main` tras fusionar la PR.
**Debe leerse cuando:** vayas a aceptar o rechazar la entrega ME-04.
**No cubre:** una repetición completa de ME-01/ME-02/ME-03 (ver sus planes); aquí solo hay una regresión acotada (paso 12).
**Documentos relacionados:** `docs/process/DEFINITION_OF_DONE.md`, `docs/match/{MODEL,RULES,ACTIONS,SCENARIOS,BOXSCORE}.md`, `docs/decisions/ADR-0007-shared-continuity-engine-and-game-rules-profile.md`, `docs/decisions/DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`, `docs/prompts/implementation/ME-04-primer-partido-fiba.md`.
**Última actualización:** 2026-09-29.

Instrucciones para **Windows PowerShell**. Ejecuta estos pasos **desde
`main`, después de fusionar la PR de ME-04**, no desde la rama de la PR.

**Tus ediciones se conservan.** ME-04 no añade migraciones. El seed normal
solo **crea los catorce suplentes nuevos** (SC06–SC12, PA06–PA12) y deja tus
diez perfiles tal como los guardaste. **No uses `LAB_SEED_FORCE_RESET=1`**:
ese modo sobrescribe tus ediciones con el fixture y **no forma parte de esta
prueba**. Las cifras exactas de este plan (marcadores, minutos) corresponden
a los **perfiles del fixture**; si has editado capacidades o medidas de
algún jugador pueden cambiar, y eso es correcto. En ese caso comprueba el
comportamiento (las condiciones de rechazo), no la cifra. Cambiar solo el
nombre de un jugador no altera el partido.

## 0. Requisitos previos

Los mismos que en ME-03: Node.js 22 y PostgreSQL local accesible.

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

## 2. `.env`, migraciones y seed no destructivo

Si no tienes `.env`, créalo copiando el ejemplo (si ya lo tienes, **no lo
sobrescribas**):

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

**Esperado:** Prisma indica que la base de datos ya está al día. El seed
dice «Sembrado no destructivo: 14 jugadores creados, 10 ya existían y se
conservaron tal cual». Si lo repites, «0 jugadores creados, 24 ya
existían».
**Resultado real:** _______________
**Señal de rechazo:** Prisma propone restablecer la base (responde que no y
detén la prueba); el seed dice que ha sobrescrito jugadores; o alguno de tus
diez perfiles pierde una edición.

## 3. Arrancar y abrir el laboratorio

```powershell
npm run dev
```

Abre `http://localhost:3000/lab`.

**Esperado:** en «Jugadores», doce por equipo (tus diez de siempre más SC06–SC12
y PA06–PA12). Debajo de «Jugar tramo» aparece **«Partido completo FIBA 2026
(ME-04)»**: dos recuadros con los doce inscritos de cada equipo (titular o
suplente y sus roles, por ejemplo «SC06 Mateo Arcos · 1 base / 2 escolta ·
suplente»), un selector de cobertura y otro de prioridad por equipo,
«Semilla del partido» (82 por defecto) y el botón «Jugar partido». Más abajo,
una sección con borde discontinuo **«Casos de frontera reglamentarios (ME-04)»**.
**Resultado real:** _______________
**Señal de rechazo:** falta la sección, un equipo muestra menos de doce, o
el recuadro de un equipo avisa de que faltan suplentes.

## 4. Partido natural (semilla 82, Drop/Drop, Proteger balance en ambos)

Deja los valores por defecto y pulsa «Jugar partido».

**Esperado:**
- Mientras calcula, el botón dice «Jugando partido…»; en unos segundos
  aparece el visor.
- Cabecera: «Final: gana Puerto Ámbar · Sierra Clara 138 – 141 Puerto Ámbar»
  y tabla de parciales C1 33–43, C2 34–37, C3 31–28, C4 40–33 (suma = total).
- Evento 1: «Empieza C1 (10:00): salto entre dos…»; evento 2: «Salto inicial
  (ME-04-JUMP-1): O5 alcanza 288,6 cm y D5 289,3 cm. D5 toca hacia su base
  D1…»; evento 3: flecha hacia Sierra Clara (el equipo que no obtuvo el
  primer control).
- «Final ⏭⏭»: último evento «Final del partido … gana Puerto Ámbar».
  Justo antes: «Bocina: termina C4 … El lanzamiento de PA12 salió 0,04 s
  antes de la bocina y sigue en el aire: puede contar», seguido de «PA12
  anota 2 puntos».
- Pulsa «Jugar partido» otra vez: mismo marcador, mismos parciales y el
  mismo identificador `lab-82-…` en la línea de versiones.
**Resultado real:** _______________
**Señal de rechazo:** error en pantalla; los parciales no suman el total;
dos pulsaciones con la misma foto dan resultados distintos; un tiro después
de la bocina suma puntos sin haber salido antes.

## 5. C3 y los dos últimos minutos de C4

5.1. Pulsa la pestaña **C3** y avanza con «Evento siguiente ▶».

**Esperado:** «Empieza C3 (10:00) tras el final de C2. Sierra Clara ataca
hacia la izquierda (cambio de canastas)». En la cancha, Sierra Clara (azul)
ataca ahora el aro **izquierdo** y el rótulo de los aros está invertido
respecto a C1. El saque de alternancia lo hace el equipo de la flecha.
**Resultado real:** _______________

5.2. Pulsa **C4** y recorre las últimas posesiones (botones P… del final
de la fila) hasta el evento «O3 anota 3 puntos», con el reloj en 1:53.4.

**Esperado:** tras esa canasta el reloj de partido **se queda en 1:53.4**
hasta que se toca el saque, y aparecen dos «Sustitución en Puerto Ámbar…»
(el equipo que encaja) con la oportunidad «canasta en los 2 últimos minutos».
En C1–C3, en cambio, el reloj sigue bajando entre canasta y saque.
**Resultado real:** _______________
**Señal de rechazo:** en C3 no cambian las canastas; tras canasta en C4 con
menos de 2:00 corre el reloj o sustituye el equipo que anotó.

## 6. Sustituciones y minutos

Abre «Sustituciones (40) y quintetos iniciales».

**Esperado:** la primera es «C2 10:00.0 · Sierra Clara: entra SC06 por O1
(rol 1, base) · voluntaria, 10:00 seguidos · oportunidad: inicio de
período». Ninguna ocurre con el balón vivo; todas indican su oportunidad
(inicio de período, falta, canasta en los 2 últimos minutos…). En «En pista
en este instante» siempre hay cinco por equipo.
En el acta: SC06 (suplente) 20:59, PA12 11:11; cada fila de titular lleva *.
**Resultado real:** _______________
**Señal de rechazo:** un equipo con más o menos de cinco en pista; un
jugador en pista y en el banquillo a la vez; un suplente que actúa antes de
entrar.

## 7. Acta contra hechos

En «Conciliación del acta con los hechos» todas las líneas llevan ✓
(puntos, parciales, FGM ≤ FGA, «Minutos del equipo = 5 × tiempo disputado»
con 12000000 ms en ambos, minutos del acta = motor). Comprueba a mano una
fila: O5 anota 62 puntos con 31/51 en T2; 2 × 31 = 62. Busca en C3 3:28.5 la
falta «de tiro de PA09 sobre SC12» con 1 libre: SC12 tiene 0/1 en TL y PA09
1 en FC.
**Resultado real:** _______________
**Señal de rechazo:** alguna ✗; puntos que no salen de 2×T2 + 3×T3 + TL; una
falta sin reflejo en FC/FR.

## 8. Bonus y quinta personal (caso de frontera d)

En «Casos de frontera reglamentarios» pulsa «(d) Cuarta y quinta falta de
equipo…» y recorre los pasos con «Paso siguiente ▶».

**Esperado:** el recuadro amarillo dice «Caso de frontera reglamentario
(fixture de prueba, no es un partido)». Pasos 1–4: «saque». Paso 5: «5.ª
falta de equipo: 2 libres por bonus. D3: 5 personales → excluido». Paso 6:
también dos libres. Paso 7 (prórroga): «El contador de la prórroga es el de
C4 (clave 4)… dos libres por bonus». Cada paso muestra su entrada, la
función del partido que lo adjudica y su resultado.
**Resultado real:** _______________
**Señal de rechazo:** la cuarta falta ya da libres, la quinta no, o el caso
aparece en el acta de un partido.

Nota: con el fixture, los partidos naturales tienen muy pocas faltas (en
torno a una por partido, de tiro) y ninguna falta sin tiro, bonus ni
exclusión; por eso se demuestran aquí. Ver la decisión pendiente enlazada
arriba.

## 9. Bocina y dos prórrogas (casos a, b, c, e, f)

Recorre los otros cinco casos:

**Esperado:**
- (a) 1 ms antes: «FGA y 3 puntos; cuenta aunque entre tras la bocina»; en
  el milisegundo exacto y 1 ms después: «no cuenta ni se registra FGA».
- (b) 13,0 s y 13,999 s → 14,000 s; 14,000 s → 14,000 s; 18,4 s → 18,400 s;
  pista trasera → 24,000 s.
- (c) and-one: «1/1 TC, 1/1 TL, 3 puntos; asistencia de O1: 1»; triple
  fallado con falta: «0/0 TC, 1/3 TL».
- (e) C4 88–88 → «Se juega Prórroga 1»; Prórroga 1 96–96 → «Se juega
  Prórroga 2»; 103–101 → «Final: gana Sierra Clara».
- (f) 2:00,0 en C4: el reloj se detiene y solo sustituye Puerto Ámbar;
  2:00,1: el reloj sigue y nadie sustituye.
**Resultado real:** _______________
**Señal de rechazo:** cualquier veredicto distinto.

## 10. Partido natural con prórroga (semilla 3)

Cambia la semilla del partido a `3`.

**Esperado:** el partido anterior desaparece y se lee «Has cambiado la
semilla…: el partido anterior (semilla 82, lab-82-…) pertenecía a otra foto y
se ha retirado». Pulsa «Jugar partido»: «Final: gana Puerto Ámbar · Sierra
Clara 164 – 174 Puerto Ámbar», con una columna «Prórroga 1» (10–20). El
final de C4 es «154 – 154». Pulsa la pestaña **Prórroga 1**: «Empieza
Prórroga 1 (5:00) tras empate 154–154…», y Sierra Clara sigue atacando el aro
izquierdo, como en C4.
**Resultado real:** _______________
**Señal de rechazo:** el empate de C4 se da como final; la prórroga dura otra
cosa que 5:00; se cambian de canasta en la prórroga.

## 11. Otra foto: cobertura y edición de perfil

11.1. Cambia la cobertura de Puerto Ámbar a «Trampa»: el partido se retira
con aviso. Juega de nuevo: el relato de las posesiones de Sierra Clara dice
«(trampa)» en el bloqueo; las de Puerto Ámbar siguen con «(drop)».

11.2. Con un partido visible, edita un **titular** (por ejemplo cambia el
nombre de O1), pulsa «Guardar», recarga la página (F5) y comprueba que el
cambio sigue ahí; después devuélvele su nombre.

**Esperado:** al guardar, el partido se retira con «Has guardado el perfil
de O1: el partido anterior … pertenecía a otra foto»; tras recargar, la
edición persiste.
**Resultado real:** _______________
**Señal de rechazo:** un acta antigua sigue visible como si fuera de los
nuevos ajustes; la edición no persiste.

## 12. Regresión acotada de ME-01/ME-02/ME-03

- «Escenario»: «Drop con ayuda», Drop, semilla 1, «Ejecutar»: relato por
  pasos completo.
- «Jugar tramo»: semilla 26, Drop, ambas «Proteger balance»: «Cuatro
  posesiones cerradas» y el rebote ofensivo de O5 en 3,19 s como en el
  plan de ME-03 (paso 4).
- Tamaño de muestra 100, «Comparar lote (drop/trampa)»: tabla completa.
**Esperado:** exactamente el comportamiento de ME-03.
**Resultado real:** _______________
**Señal de rechazo:** error en pantalla, relato cortado o un tramo distinto
del descrito en el plan de ME-03.

## 13. (Opcional) Sin PostgreSQL

Detén PostgreSQL y recarga `/lab`.

**Esperado:** aviso claro de que no se pudo conectar; el partido se puede
jugar con los perfiles de referencia y la sección lo indica. Al volver a
arrancar PostgreSQL, tus jugadores siguen intactos.
**Resultado real:** _______________
**Señal de rechazo:** error técnico en pantalla o pérdida de jugadores.

---

**Aceptación final:** todos los pasos con resultado real igual al
esperado. Cualquier señal de rechazo abre un hotfix según
`docs/process/WORKFLOW.md`.
