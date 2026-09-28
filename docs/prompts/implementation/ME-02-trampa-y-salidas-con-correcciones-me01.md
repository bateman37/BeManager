# ME-02 — Respuesta al bloqueo: drop, trampa y salidas

**Repositorio:** https://github.com/bateman37/BeManager
**Ruta literal donde guardar este prompt antes de ejecutarlo:** `docs/prompts/implementation/ME-02-trampa-y-salidas-con-correcciones-me01.md`
**Entrega:** una rama, una PR; ME-02 incluye tres correcciones pendientes de ME-01 en esa misma PR.
**Rama sugerida:** `match/me-02-trampa-y-salidas`
**PR sugerida:** `ME-02: comparar drop y trampa con salidas reales y corregir ME-01`

## 0. Objetivo y orden

Implementa la **respuesta defensiva al bloqueo directo** prevista en ME-02 y, dentro de la misma entrega, corrige tres fallos que impiden juzgarla: faltas masivas al mejorar la defensa, esquina débil inalcanzable en drop, y estadísticas engañosas de tiros/faltas/libres/puntos. Queremos observar desde `/lab` que una cobertura cambia presiones, receptores, rotaciones, oportunidades y concesiones. Sigue siendo **una posesión de laboratorio**, no un partido completo.

1. Inspecciona el `main` remoto, árbol local y rutas reales; parte de `main` actualizado, crea **una sola rama** y preserva cualquier trabajo ajeno. Si el entorno impone otra rama, explica la diferencia; no publiques otra por tu cuenta contra esa imposición.
2. **Guarda este texto íntegro, sin reescribirlo, en la ruta indicada y versiona el prompt antes de tocar código o documentación de producto.** Actualiza el índice de prompts. No alteres ME-01, HF-001 ni HF-002 históricos.
3. Implementa primero las tres correcciones, luego la trampa, después interfaz y validación. Commits coherentes en la misma rama; abre **una PR sin fusionar**. Dennis la fusionará y hará la prueba profunda desde `main`.
4. El diseño deportivo y los límites de esta entrega están cerrados abajo. Ante una contradicción real con la fuente de verdad, indica `DECISIÓN REQUERIDA` con la parte exacta afectada; continúa solo con trabajo independiente. Toma decisiones técnicas internas reversibles sin detenerte por trivialidades.

## 1. Lectura acotada

Ruta inicial: `CLAUDE.md` → este prompt archivado → `docs/README.md`. Obligatorios:

- `docs/process/{WORKFLOW,DEFINITION_OF_DONE,DOCUMENTATION_STANDARD,TESTING_STRATEGY}.md`, `docs/prompts/README.md`.
- `docs/match/{README,MODEL,ACTIONS,CAPABILITIES,SCENARIOS,RULES}.md`; `docs/match/roadmap.md`, solo §§1–2, mapa §3, ME-02 en §4 y validación §7.
- `docs/foundation/MATCH_CORE_PRINCIPLES.md`; `docs/architecture/{MODULE_BOUNDARIES,DATA_AND_PERSISTENCE}.md` solo al tocar límites o persistencia.
- Referencia táctica: `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, §§2-5 y 9.2, en particular cobertura de trampa, short roll, reparaciones y concesiones.
- Atributos: `docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md`, §§2.2-2.4, 3, 4 solo filas pertinentes P05/P09/P13/P16/P17/P22/P34/P49, y §§5-6. Para reglas de acta consulta el Manual de Estadísticos FIBA 2024, §§1-3, 8-9 (assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf); las reglas de pista siguen el perfil FIBA 2026 ya documentado en `RULES.md`.
- Código afectado: `modules/match/` (núcleo, resolutores, fixture, aproximación rápida, aplicación e interfaz), más el plan manual ME-01 existente.

Consulta opcional: ADR del núcleo y secciones puntuales de los estudios de motor/FIBA **solo si una regla alcanzable lo necesita**. Fuera de lectura y alcance: archivos del juego anterior (`DESIGN(1).md`, `CLAUDE.odt`), prompts históricos completos salvo una duda concreta, NBA/NCAA, ligas, mercado, ME-03 en adelante y diseño general de interfaz.

## 2. Tres correcciones de ME-01, integradas en ME-02

### C1. Contacto, llegada y falta de tiro

El experimento reproducido por Dennis con 1.500 posesiones y las ocho capacidades defensivas `T15,T16,T17,T18,T19,T20,T22,T23` a 15 produjo **982-983 faltas de tiro con ayuda**, frente a 0 sin ayuda. El núcleo actual trata una llegada en la breve franja de frenada como contacto ilegal, aun cuando el defensor no ocupa el espacio del tirador; una mejor llegada puede convertirse así en más faltas. Corrige el mecanismo, no recortes el contador ni fuerces porcentajes finales.

- Primero determina dónde están realmente tirador, balón y defensor **en el instante de tiro**. Distingue haber recibido la orden, llegar al punto de ayuda, alcanzar al tirador y poder oponerse legalmente; `tD3ArriveHelp` no significa que D3 ya esté junto a O5. O5 debe recorrer su continuación desde la pantalla hasta una posición de recepción/finalización alcanzable, con tiempo y defensor compatibles; no finalizar desde la posición original del bloqueo por tener asignado el rol de continuador.
- Para este laboratorio, define en parámetros `LAB-0.2` el radio corporal de contacto **0,35 m por jugador**: solo puede haber contacto si los espacios corporales de defensor y tirador se solapan en la interacción de tiro. Si se solapan, el defensor llega sin margen para frenar y la trayectoria invade la posición de lanzamiento, se registra la falta ordinaria de tiro. Si llega legalmente y se estabiliza, hay contestación legal; si no alcanza ese espacio, no hay contacto ni oposición atribuible a ese jugador. Frenar tarde por sí solo no es una falta. Comprueba la trayectoria/posición a tiempo, no compares únicamente dos marcas de reloj.
- `F03` afecta la posibilidad de frenar; `T22/T23` afectan llegadas exteriores/interiores según el contexto; `T18` solo interviene en un tapón alcanzable. Mejorar defensa puede impedir una recepción, contestar legalmente o forzar una salida. No debe traducirse automáticamente en más faltas. Preserva un caso de **closeout tardío realmente ilegal y reproducible** sin codificar «este escenario siempre pita falta».
- No introduzcas nuevas familias de falta, un factor de "disciplina" ficticio ni un sorteo global de falta. Documenta geometría, secuencia y límites de esta simplificación.

### C2. Ayuda y esquina débil utilizables

En las mismas 1.500 corridas, `passesToCorner=0` con y sin ayuda. El árbol anterior acepta el pase a O5 antes de comprobar si la ayuda lo negó y liberó a O3. Ajusta la **lectura de oportunidades** para que un mismo cambio de ayuda pueda cerrar el roll y abrir la esquina; no conviertas el pase a la esquina en obligación ni en un porcentaje añadido.

- Si D3 conserva O3, O3 no obtiene una ventaja ficticia por etiqueta. Si D3 sale, registra **cuándo** deja a O3, **cuándo** O1 u O5 pueden verlo, si hay línea real, pase ejecutable y recepción antes de la reparación de D4. Si el roll sigue realmente libre y es mejor opción, puede elegirse; si D3 lo niega antes de la decisión, la esquina entra en la lectura a tiempo. Un pase a O5 recibido puede activar su segunda lectura, incluida la inversión, sin reiniciar el reloj.
- D4 repara desde su posición actual dejando temporalmente O4; la amenaza cedida y la recuperación deben verse en hechos y posiciones. Ningún defensor cubre a O5 y O3 a la vez. Mantén T09/T11, M01/M03/M05 y las ventanas vigentes de LAB-0.1 donde sean aplicables; no repitas T22/T23 como premio final al tiro.
- Con la plantilla original y las mismas semillas, el lote «drop con ayuda/sin ayuda» debe demostrar **al menos un pase a la esquina con ayuda** y explicar por qué no hubo ventaja equivalente sin ayuda. Si para lograrlo hay que alterar una constante LAB-0.1 distinta de la nueva geometría autorizada aquí, señala la decisión deportiva que falta; no la ajustes silenciosamente.

### C3. Estadísticas y puntos fieles a los hechos

La tabla actual llama `shotsAttempted` a todo `shot_prepared` y `shotsMade` solo a `shot_result`. Una falta de tiro puede conceder canasta y libres sin figurar como `shot_result`; comparar 121/1218 como si fuera eficacia real engaña. Mantén **dos conceptos separados**: oportunidad/intento preparado para analizar decisiones y **tiro de campo oficial FGA/FGM** para estadística FIBA.

- En falta de tiro con intento fallado: **no FGA**. En canasta válida con falta: **1 FGA y 1 FGM**, además del libre adicional. Tapón legal sin falta: FGA, aunque no haya canasta. Libres FTA/FTM por los hechos realmente ejecutados; puntos = `2×2FGM + 3×3FGM + FTM` en el ámbito implementado. Un tiro preparado no es por sí mismo un FGA; el relato debe poder indicar el intento frustrado sin falsificar acta. El Manual FIBA enlazado rige esta proyección estadística.
- Agrega y muestra en **español** por variante: posesiones de muestra, oportunidades de tiro, 2FGA/2FGM, 3FGA/3FGM, FTA/FTM, puntos, faltas de tiro, pérdidas, robos, pases al roll/esquina, rebotes; porcentajes solo con denominador aplicable. Evita contar robo por cada pérdida o perder un rebote ofensivo porque luego hubo otro tiro. En este laboratorio, «puntos por corrida» no son puntos de un partido completo.
- Detallado y rápido derivan estas categorías de una **misma taxonomía de hechos**; el rápido sigue sin construir relato ni snapshots por paso. Versiona el perfil nuevo como `LAB-0.2`, deja trazables regla, parámetros, semilla, perfiles y cobertura en el resultado. No presentes un lote anterior como si respondiera a la selección actual.

## 3. ME-02: cobertura drop frente a trampa

Usa **la misma entrada de media pista, quintetos y bloqueo central**. En la comparación principal cambia exclusivamente la cobertura: `drop` o `trampa`; en ambas D3 tiene encomendada la ayuda al continuador y D4 la reparación. Conserva aparte la comparación anterior «drop ayuda sí/no» y el caso individual de closeout. El usuario puede escoger la cobertura antes de ejecutar; la tabla principal de ME-02 debe decir explícitamente qué dos variantes compara, aunque el selector individual esté en otra.

**Responsabilidades de la trampa:** D1 sigue a O1 por la pantalla y D5 sale desde su posición hacia O1, comprometiendo dos defensores **solo si llegan**. D3 pasa a `low man` para retrasar el roll/short roll de O5; D4 rota hacia la amenaza dejada por D3 (O3) y al hacerlo expone a O4; D2 mantiene el lado fuerte (O2). Cada orden, reconocimiento, desplazamiento, llegada, asignación abandonada y posible reparación tiene tiempo, ubicación y hecho propios. Si O1 pasa antes de cerrarse la trampa, el ataque dispone de 4 contra 3 **solo mientras** los dos defensores sigan comprometidos y el pase llegue; D1/D5 recuperan con trayecto, no por teletransporte.

**Lecturas ofensivas habilitadas, por viabilidad en el instante, sin resultado prefijado:** O1 puede intentar pase temprano a O5 en short roll, escapar por un carril si de verdad lo tiene, invertir hacia O4/O3 si existe línea, o mantener control y reorganizar. Si O5 recibe en short roll, puede finalizar solo cuando hay ruta y defensor que no llega, o pasar a la salida exterior que haya quedado libre; una recepción lenta permite reparar. El pase puede desviarse y el balón quedar suelto; pérdida solo cuando se adjudique control rival. Una trampa rota no garantiza tiro cómodo; una trampa cerrada no garantiza robo. Si no hay salida y vence reloj, termina legalmente.

**Geometría mínima de esta secuencia:** el short roll de O5 se orienta hacia `(23,0; 7,5)` m y la continuación profunda hacia `(24,8; 7,5)` m, partiendo de su posición real de bloqueo. Son puntos de referencia, no teletransporte ni recepción obligatoria: llegada = distancia/velocidad y ventanas reales. D5 solo presiona O1 al alcanzar su espacio; D3 solo contiene O5 desde posición alcanzada. O2, O3 y O4 ocupan los espacios existentes y se mueven cuando les corresponda, con líneas de pase efectivas; no inventes una jugada adicional.

**Capacidades:** reutiliza M01/M05 para reconocer líneas y espacio, M03 para preferencia entre opciones legales, M04 para coordinación/temporización; T09 del pasador (también O5), T11 del receptor, T07 frente a presión real, T15/T16/T17/T22/T23 para tareas defensivas distintas, y F01/F03/F04/medidas en movimiento/contacto. Activa **M09 Comunicación** solo para avisos defensivos que tienen emisor y receptor: añade una latencia de coordinación `clamp(0,12 − 0,008 × (min(M09_emisor, M09_receptor) − 8), 0,06, 0,18)` segundos entre aviso reconocido y respuesta de otro defensor. Aplica una vez por aviso pertinente, no por fotograma ni como bonus de robo/tiro. M09 no sustituye a M01 (reconocer), M05 (situarse) ni M04 (sincronizar gesto).

Para perfiles **nuevos** del laboratorio fija M09 por plantilla: G=10, W=9, B=9; sobrescribe D1=12, D3=11, D4=11, D5=10. El resto conserva valor de plantilla. Para perfiles **ya persistidos** que carecen de M09, usa explícita y visiblemente el valor neutro **8** hasta que el usuario lo edite/guarde; no borres ni restablezcas las otras 26 capacidades. El `seed` no debe sobrescribir perfiles existentes editados por Dennis: crea faltantes y documenta cómo restablecer el fixture solo de manera deliberada. M09 se muestra en ficha con nombre y grado; si la acción ejecutada no requiere comunicación, no le atribuyas efecto.

Los tiempos, presión, intercepción, tiro y rebote ya existentes se reutilizan cuando corresponden. Los únicos **parámetros deportivos nuevos** aprobados aquí son el radio corporal, los dos puntos de referencia del roll y la latencia M09. No inventes modificadores globales por «trampa», nuevas probabilidades de robo o puntuaciones de jugada. Si una salida exige otro coeficiente, vuelve a modelarla con posición, tiempo y mecanismos existentes o informa qué decisión exacta falta.

## 4. Interfaz y pruebas de aceptación

Desde `/lab`, Dennis debe poder editar/guardar jugadores, escoger `drop` o `trampa` para la **misma posesión**, fijar semilla, ejecutar/repetir con relato por pasos y observar en cancha cuándo D5 sale, D3 ayuda, D4 repara y quién queda libre. Separa visualmente la tabla **«Drop: ayuda sí/no»** de la tabla **«Misma posesión: drop/trampa (con ayuda)»**; ambas usan las mismas plantillas y semillas dentro de su comparación. Cada resultado muestra sus propias entradas/versiones, permanece atribuible tras navegar por la pantalla y se limpia o marca desactualizado al cambiar perfiles, cobertura, semilla o tamaño de lote. Etiquetas deportivas en español; no obligues a Dennis a interpretar claves internas `passesToRoll`.

Pruebas automáticas **pocas y discriminantes**, sin BD ni E2E añadidos: (1) mismo input/semilla/versiones ⇒ mismos hechos y agregados; (2) defender lejos nunca causa falta/oposición por mera llegada al punto de ayuda, closeout ilegal real sí puede alcanzarse; (3) help que niega roll y deja esquina ⇒ pase a O3 alcanzable, sin ayuda no se regala O3; (4) trampa cambia responsabilidades y abre una salida si supera a dos, sin garantizar robo/canasta; (5) M09 cambia únicamente el instante de aviso/reparación pertinente, conservando lo demás; (6) and-one, fallo con falta, tiro taponado y rebote ofensivo reconcilian FGA/FGM/FTA/FTM/puntos; (7) modo rápido comparte significado de hechos y no llama a `runPossession`.

Ejecuta `npm run check` sin BD. Con PostgreSQL y fixture existentes, recorre tú mismo **un navegador real**: edición/persistencia, drop ayuda sí/no, drop/trampa con mismo perfil/semillas, closeout individual, relato completo y ambas tablas. Registra en la PR qué comprobaste realmente; compilación o tests verdes no sustituyen los clics. Antes de darla por lista, repite **una vez** el experimento de Dennis con 1.500 semillas `1-1500` y `167-1666`, perfiles normales y luego defensa técnica a 15. Compara secuencia causal, tiros de campo oficiales, tiros libres, puntos, pérdidas, esquinas y faltas; documenta los conteos y explica si algo sigue siendo anómalo. Como señal de rechazo del laboratorio: no aceptar unas ~982 faltas/1.500 corridas de drop con ayuda por un falso contacto geométrico, ni esquinas permanentemente a cero cuando la ayuda la deja libre. **No impongas cuotas artificiales** para hacer pasar esos umbrales ni extrapoles una única acción al promedio de un partido completo.

Deja `docs/testing/manual/ME-02-manual-test-plan.md` con comandos PowerShell **desde `main` tras la fusión de Dennis**, pasos numerados de interfaz para los dos pares comparados, perfiles normales y defensa a 15, resultado esperado, campo de resultado real y condición de rechazo. No pidas que Dennis vuelva a completar todo ME-01; basta un recorrido de regresión acotado más el nuevo mecanismo. Incluye instrucciones para preservar su `.env` y sus ediciones de jugadores.

Actualiza **solo** `docs/match/{README,MODEL,ACTIONS,CAPABILITIES,SCENARIOS,RULES}.md` que cambien realmente, estado de ME-02 en `docs/match/roadmap.md` y los índices pertinentes, un ADR solo si hay decisión técnica duradera, y `CHANGELOG.md`. Registra qué sigue sin estar implementado (otras coberturas, partido completo, simulación estadística de ligas). No edites los cuatro estudios de referencia ni reescribas prompts anteriores.

## 5. Entrega

Una PR revisable, sin fusionar, con: resumen de cambios C1-C3 y ME-02, primera diferencia observada entre coberturas con **misma semilla**, ejemplos reproducibles de short roll/salida, falta real y esquina, estadística conciliada, comandos y resultados efectivamente ejecutados, comparación rápida/detallada y su coste medido en el mismo equipo, límites conocidos y ruta al plan manual. Si un camino anunciado en la interfaz no funciona de verdad, la PR todavía no está lista. La prueba funcional profunda de Dennis será desde `main` después de que él fusione.

---

**Nota de entorno (no forma parte del encargo original de Dennis/ChatGPT, la añade Claude Code al archivar):** el entorno de ejecución de esta sesión impuso la rama `claude/new-session-p9xna7` en lugar de la rama sugerida `match/me-02-trampa-y-salidas`. Seguí la instrucción de la propia tarea ("si el entorno impone otra rama, explica la diferencia; no publiques otra por tu cuenta contra esa imposición") y no creé la rama sugerida.
