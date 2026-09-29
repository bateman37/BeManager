# BeManager — Roadmap del motor de partidos

**ID:** MAT-RDM-001 · **Versión:** 1 · **Estado:** propuesta para revisar juntos · **Fecha:** 28-09-2026  
**Ubicación propuesta en el repositorio:** `docs/match/roadmap.md`  
**Fuentes de diseño:** los cuatro documentos de `docs/match/reference/` y las decisiones de esta conversación. Este roadmap ordena su implementación; no sustituye el detalle deportivo de aquellos documentos ni es todavía un prompt para Claude Code.

## Índice

1. [Objetivo y decisiones acordadas](#1-objetivo-y-decisiones-acordadas)
2. [Tamaño y criterio de cada entrega](#2-tamaño-y-criterio-de-cada-entrega)
3. [Mapa de las diez entregas](#3-mapa-de-las-diez-entregas)
4. [Alcance de cada entrega](#4-alcance-de-cada-entrega)
5. [Jugadores y equipos creíbles](#5-jugadores-y-equipos-creíbles)
6. [Contratos para NBA y baloncesto universitario](#6-contratos-para-nba-y-baloncesto-universitario)
7. [Validación, rendimiento y documentación](#7-validación-rendimiento-y-documentación)
8. [Después del primer núcleo](#8-después-del-primer-núcleo)

## 1. Objetivo y decisiones acordadas

Construir un partido de baloncesto **con diez jugadores activos**, donde la táctica ofensiva y defensiva cambie oportunidades, responsabilidades y concesiones; los atributos influyan en percepción, decisión, tiempo y ejecución; y un relato explique los hechos que realmente produjo el motor. Geometría 2D simplificada y acciones con duración, sin simulación biomecánica completa.

**Primer perfil de reglas:** FIBA 2026, identificado por edición. [FIBA publica la edición 2026 y su aplicación desde el 1-10-2026](https://about.fiba.basketball/en/news/fiba-official-basketball-rules-2026-to-take-effect-october-1). El perfil se completa según los desenlaces alcanzables en cada entrega: no se simulan faltas, reanudaciones o decisiones sin poder adjudicarlas. NBA y NCAA se incorporarán después como perfiles propios; ninguna regla FIBA se esconderá en una fórmula universal de deporte.

**Dos resoluciones acordadas:** el partido propio y los rivales elegidos **antes** del inicio se juegan con detalle y relato; los demás, en rápido con boxscore y estadísticas de equipo, jugador y ojeo derivadas de sus acciones representadas. Un resultado rápido no adquiere después un relato jugada a jugada. Ambos modos comparten perfiles, planes, significado de las acciones, reglas y versiones, aunque calculen con distinta resolución.

**Atributos:** escala interna `1–15`, visible como `E−` a `A+`, sin equivalencia directa con porcentajes. Las cuatro medidas corporales C01–C04 se conservan en unidades físicas. La altura participa en la geometría corporal incluso si se conoce el alcance de pie; una misma mano o ventaja espacial no recibe dos bonificaciones. Las 45 capacidades del catálogo son candidatas: cada una se activa cuando exista un mecanismo concreto y verificable que la necesite.

**Meta de estas diez entregas:** laboratorio de posesión, primer partido completo dirigible, variedad táctica suficiente para probar la gramática, equipos y jugadores ficticios plausibles, modo rápido fiable para ojeo y una jornada mixta medible. Es una **primera versión del motor**, no la cobertura total de todas las tácticas, las 76 situaciones ni todos los reglamentos estudiados.

## 2. Tamaño y criterio de cada entrega

Elijo **diez** entregas. Ocho obligarían a juntar creación de jugadores con un partido entero, o el modo rápido con calendario, persistencia y rendimiento. La primera y la cuarta serán las más exigentes; las demás mantienen una sola vertiente deportiva o funcional.

Cada entrega ocupa **una rama, una PR y una sesión de Claude Code como objetivo de planificación**, sin prometer una duración fija antes de ver el repositorio. Una PR termina con un recorrido concreto desde la interfaz. Si al detallar un bloque excede una sesión razonable, se divide por resultados deportivos visibles y completos, no en «primero fórmulas, luego táctica, luego atributos». `main` conserva siempre el laboratorio o partido jugable ya aprobado.

La pantalla evoluciona con lo que podemos probar. No diseñamos toda la interfaz antes del primer mecanismo. Tampoco convertimos los nombres de tácticas, habilidades o ligas en porcentajes añadidos al resultado final.

## 3. Mapa de las diez entregas

| ID | Vertiente | Resultado revisable desde la interfaz | Tamaño previsto |
|---|---|---|---|
| ME-01 | Primera posesión integrada y jugadores de prueba | Crear/editar perfiles ficticios; jugar, leer y repetir una posesión 5v5 completa | Medio-alto, acotado a un escenario |
| ME-02 | Respuesta defensiva al bloqueo | Comparar drop y trampa, con salidas y ayudas reales | Medio |
| ME-03 | Continuidad y transición | Encadenar posesiones y ver el coste de rebote/balance | Medio |
| ME-04 | Partido FIBA 2026 | Jugar un encuentro entero con acta y rotación básica | Medio-alto |
| ME-05 | Dirección durante el partido | Sustituir, pedir tiempo y modificar órdenes; ver cuándo se aplican | Medio |
| ME-06 | Segunda familia ofensiva y defensa sin balón | Ejecutar mano a mano y corte/bloqueo indirecto con lecturas y salidas | Medio |
| ME-07 | Población y plantillas ficticias creíbles | Crear plantillas completas con perfiles coherentes y editables | Medio |
| ME-08 | Partido rápido y ojeo | Simular encuentros completos sin relato, con estadísticas trazables | Medio-alto |
| ME-09 | Recuperación del partido | Interrumpir, continuar y auditar ambos modos sin duplicar hechos | Medio |
| ME-10 | Jornada mixta y rendimiento | Elegir rivales, resolver calendario mixto y medir 240 partidos | Medio-alto |

El camino crítico es `ME-01 → ME-03 → ME-04 → ME-08 → ME-09 → ME-10`. `ME-02`, `ME-05`, `ME-06` y `ME-07` añaden defensas, dirección, variedad y poblaciones antes de que el rápido y la jornada pretendan representar un partido creíble. Antes de cada prompt se revisarán dependencias exactas, sin reordenar silenciosamente el alcance deportivo.

## 4. Alcance de cada entrega

### ME-01 — Posesión 5v5, perfiles manuales y laboratorio

**Alcance:** dos equipos ficticios de prueba con cinco jugadores cada uno, preparados a mano, más creación, edición, duplicación y guardado sencillos desde la interfaz. Ficha inicial con identidad ficticia, rol, C01–C04, escala de capacidades activas y tendencias pertinentes. Validación y avisos de coherencia; sin generar atributos independientes al azar. Un bloqueo directo central contra drop, ayuda desde el lado débil que puede permitirse o negarse, movimientos y responsabilidades de los diez, pase o pérdida, lanzamiento, oposición, acierto o fallo, cierre y rebote con continuación. Si se genera falta ordinaria sobre el tiro, se adjudican sus libres y la continuación; no se activan tipos especiales sin regla y salida.

**Interfaz y cierre:** cancha simple y relato **por pasos**, con «ordenado → reconocido → intentado → ejecutado → concedido». Repetir el mismo escenario, cambiar una ayuda o capacidad y observar la primera diferencia. Terminar cada rama generable en un estado válido; no inventar un marcador de partido. Fijar `MatchInput` compartido, hechos y categorías estadísticas para los dos modos. Añadir una **aproximación rápida limitada a este mismo escenario** y comparar desde el laboratorio lotes pequeños de intentos y desenlaces que represente de verdad; no genera partido, acta completa ni relato. Medir el coste de ambas resoluciones del escenario. El partido rápido completo llega en ME-08.

**Documentación obligatoria del primer prompt:** crear `docs/match/reference/README.md` como índice breve de los cuatro archivos que el usuario ya ha subido, indicando propósito, estado y sección de entrada de cada uno, sin duplicar su contenido. Crear o actualizar `docs/match/README.md` como mapa activo si la Foundation todavía no lo ofrece; enlazar este roadmap y registrar qué está implementado. Conservar los nombres y rutas reales, sin duplicar documentos por diferencias de sufijo.

**Fuera:** liga, temporada, editor exhaustivo de 45 capacidades, trampa, lesiones y excepciones FIBA no alcanzables por este escenario. El hecho de que un atributo todavía no esté activo debe ser explícito, no esconderse tras una ficha que aparente que ya influye.

### ME-02 — Trampa y salida ofensiva

**Estado: implementado** (PR ME-02, incluye tres correcciones pendientes de
ME-01: contacto/falta de tiro por geometría real, esquina débil alcanzable
con ayuda, y estadística FGA/FGM/FTA/FTM/puntos conciliada con los hechos).
Ver `docs/match/{ACTIONS,CAPABILITIES,SCENARIOS,RULES}.md`.

**Alcance:** ante el bloqueo, elegir drop o trampa. Dos defensores comprometen el balón, otros cubren roll y lado débil; el ataque puede pasar temprano, encontrar short roll, invertir o perder la oportunidad. Los defensores sin balón dejan y reparan responsabilidades. Las capacidades de lectura, pase, recepción, defensa perimetral/interior y comunicación actúan en sus etapas.

**Interfaz y cierre:** repetir el escenario con una sola cobertura cambiada. Mostrar pérdidas, recepciones, tiros concedidos y costes de cada defensa. La trampa no garantiza robo; un pase de salida no garantiza canasta. Preparar una comparación por lotes pequeños del **mismo escenario** para comprobar el signo de los efectos que más tarde debe conservar el rápido.

**Fuera:** todas las coberturas de bloqueo y zonas.

### ME-03 — Posesiones enlazadas y transición

**Estado: implementado** (PR ME-03: tramo de hasta cuatro posesiones
enlazadas, carga/balance, transición y saques; queda una `DECISIÓN
REQUERIDA` sobre la ventana de ventaja temprana, ver
`docs/decisions/DECISION-REQUERIDA-ME-03-ventaja-temprana.md`). Ver
`docs/match/{MODEL,RULES,ACTIONS,SCENARIOS}.md`.

**Alcance:** conservar ubicación, control de balón, reloj y encargos al terminar una posesión. Rebote ofensivo, rebote defensivo, pérdida viva, salida de balón, regreso defensivo, ventaja temprana o ataque organizado. Comparar prioridad de carga y balance con jugadores y posiciones reales; no transformar «ataque temprano» en un bonus de tiro.

**Interfaz y cierre:** jugar tramos de varias posesiones, identificar quién cargó, quién volvió y qué concedió cada elección. Relojes y reanudaciones de los caminos disponibles deben cuadrar. Primer perfil de coste por posesión y por secuencia para prevenir un bucle detallado demasiado caro.

**Fuera:** calendario, país y partido completo.

### ME-04 — Primer partido reglamentario FIBA

**Estado: implementado** (PR ME-04: partido completo, rotación automática,
acta y casos de frontera; queda una `DECISIÓN REQUERIDA` no bloqueante sobre
el alcance natural de faltas y segunda entrada con el fixture, ver
`docs/decisions/DECISION-REQUERIDA-ME-04-alcance-natural-faltas-y-segunda-entrada.md`).
Ver `docs/match/{MODEL,RULES,ACTIONS,SCENARIOS,BOXSCORE}.md`.

**Alcance:** cuatro períodos, relojes, canastas, faltas ordinarias y bonus alcanzables, libres, reanudaciones, fin y prórroga aplicable del perfil FIBA 2026. Acta y estadísticas de equipo/jugador derivadas de hechos, no ajustadas después. Plantillas de prueba ampliadas para banquillo, con rotación automática sencilla y reglas de elegibilidad. Se amplía el repertorio mínimo necesario para que un partido pueda fluir sin repetir un guion fijo; se declaran todavía sus limitaciones tácticas.

**Interfaz y cierre:** iniciar y terminar un partido, ver marcador, relato, minutos y boxscore coherentes. Escenarios exactos para bocina, reset de reloj, falta en tiro, bonus y prórroga; primero se resuelven hechos y después se adjudican las reglas.

**Fuera:** dirigir toda la rotación manualmente, catálogo completo de faltas raras y temporadas.

### ME-04A — Auditoría exportable de partidos detallados

**Estado: implementado** (auditoría opcional del partido detallado, sin
cambiar la simulación; ver `docs/match/AUDIT.md`).

**Alcance:** interruptor «Registrar auditoría» (activado por defecto) y
descarga de un `.json` versionado por partido con la entrada, los hechos,
las decisiones observadas del árbol de drop/trampa/segunda entrada/tiro/
rebote/falta sin tiro y el resultado, para investigar fuera de la
aplicación por qué se reparten así los protagonistas. No añade ni cambia
ninguna probabilidad, atributo, táctica o regla; solo observa y expone lo
que el motor ya decide.

**Interfaz y cierre:** activar/desactivar el registro antes de jugar,
descargar el archivo de una corrida ya resuelta (incluida una detenida por
el guardián), y comprobar que invalida su descarga al cambiar semilla,
plan o el propio interruptor.

**Fuera:** cambiar el reparto de faltas/segunda entrada/ventaja temprana
que documenta la decisión pendiente de ME-04 (sigue pendiente), lotes
automáticos, persistencia entre recargas (ME-09) y cualquier ajuste de
motor, tácticas o atributos.

### ME-04B — Corregir las lecturas del bloqueo, la oposición y su auditoría

**Estado: implementado** (entrega correctiva, no archivada como HF-003 por
ampliar decisiones deportivas visibles; ver
`docs/prompts/implementation/ME-04B-lecturas-oposicion-y-auditoria.md`).

**Alcance:** Dennis revisó nueve auditorías de ME-04A y detectó que O1/D1
permanecían congelados en su posición de partida durante toda la posesión,
que la primera lectura del bloqueo se cortaba siempre en `pase_o5`
(1 984/1 984), que la oposición al tiro casi nunca se atribuía a un
defensor real (96,7 % `no_contest`) y que la auditoría tenía IDs de rol sin
resolver, enlaces a hechos que nunca ocurrieron y motivos de rechazo vacíos.
Corrige los cuatro problemas sobre **la misma** interacción del bloqueo
directo ya existente: O1/D1 se desplazan de verdad hasta el punto de uso de
la pantalla; la primera lectura compara varias vías reales por un valor de
tiro situacional (LAB-0.3); la oposición usa el modelo geométrico
`R_contest`, separado del contacto/falta; y la auditoría resuelve IDs
reales, enlaza al hecho emitido y separa motivo elegido de alternativas
(esquema `ME-04B-AUDIT-1`). No añade tácticas, coberturas, familias
ofensivas ni recalibra el resto del boxscore FIBA.

**Interfaz y cierre:** mismo `/lab`, sin cambios de interfaz; el relato, la
cancha y la descarga de auditoría reflejan la vía elegida y a quién dejó
libre la defensa con datos reales. Ver
`docs/testing/manual/ME-04B-manual-test-plan.md`.

**Fuera:** DHO/poste/zonas, más coberturas, selector táctico, sustituciones
manuales/fatiga/tiempos muertos (ME-05), calibración completa del boxscore
FIBA, transición y rebote rediseñados. La falta ordinaria sin tiro y la
segunda entrada siguen sin producirse en partidos naturales con el fixture
del repositorio (decisión pendiente de ME-04, actualizada).

### ME-05 — Dirigir en vivo

**Alcance:** controles efectivos para sustituciones, tiempos muertos y ajustes de ataque/defensa dentro de lo ya soportado. Registrar cuándo se envía, recibe y aplica una instrucción. Estados de esfuerzo, descanso y fatiga con efecto sobre tareas concretas y capacidad de recuperación, no un castigo global misterioso. Roles se reasignan al cambiar quinteto; acciones comprometidas terminan o se interrumpen por una causa definida.

**Interfaz y cierre:** dirigir un encuentro, cambiar ayuda o cobertura, sustituir a un jugador y entender el efecto y la latencia. Probar que una orden no altera retrospectivamente posesiones cerradas.

**Fuera:** entrenamiento, lesiones de carrera y gestión contractual.

### ME-06 — Acciones encadenadas sin balón

**Alcance:** una segunda familia posicional representativa: mano a mano enlazado con corte o bloqueo indirecto, negación de la primera salida y una continuación segura. Añadir una ficha inicial de libro de jugadas con roles, situación, entrada y salida; los cinco atacantes y cinco defensores tienen ocupación y deberes. La misma acción puede desembocar en tiros distintos sin ser «jugada = porcentaje».

**Interfaz y cierre:** escoger entre la entrada anterior de bloqueo directo y esta familia; cambiar deny/gap o fuente de ayuda y ver qué salida se abre o se cierra. Ver en el relato cuándo se rompe una jugada y cómo se reorganiza el ataque.

**Fuera:** libro completo, Spain y todas las variantes de mano a mano o bloqueo indirecto.

### ME-07 — Equipos y población de jugadores

**Alcance:** pasar de diez perfiles de laboratorio a plantillas ficticias completas y editables. Generador **condicionado por arquetipo, rol, competición objetivo y nivel de equipo**, con relaciones plausibles entre medidas, técnica, físico y lectura; reproducible por semilla y parametrizado con una población de referencia documentada. La talla, peso, envergadura y alcance no se sortean independientemente. Bases y pívots generados por defecto son capaces de desempeñar su función; el usuario puede crear excepciones deliberadas que se señalen como atípicas.

**Interfaz y cierre:** crear o editar dos equipos, inspeccionar plantillas, escoger quinteto y jugar el partido ya existente. Lotes de perfiles permiten localizar anomalías como un pívot nominal de 1,80 m creado automáticamente o un base titular sin pase funcional. El nivel de una liga se modela en la población y la composición de equipos, **no** como multiplicador oculto del motor FIBA. Los equipos y jugadores se mantienen ficticios.

**Fuera:** contratos, traspasos, desarrollo de carrera y construcción completa de países. La población inicial necesita referencias empíricas por competición y temporada; «FIBA» por sí solo no define la calidad media de jugadores.

### ME-08 — Resolver partidos en rápido y producir ojeo

**Alcance:** segundo resolvedor sobre las mismas entradas deportivas, con acciones agregadas y participantes atribuibles. Respetar FIBA 2026 y producir boxscore reconciliado, desgloses de PnR, coberturas, ayudas, mano a mano/cortes, tiro y rebote **solo cuando esas categorías se hayan representado realmente**. Ojeo con muestras, rivales y contexto; no deducir hábitos seguros de cuatro observaciones.

**Interfaz y cierre:** simular un partido rápido y consultar estadísticas de equipo/jugador y tendencias, sin botón de relato. Comparar lotes de partidos con los mismos perfiles/planes en detallado y rápido: ritmo, tiros, pérdidas, faltas, rebotes y **dirección del efecto** al cambiar drop por trampa o la fuente de ayuda. Mantener categorías con incertidumbre si el rápido no calcula geometría fina; no inventar coordenadas.

**Fuera:** calendario masivo y reproducción narrativa de partidos rápidos.

### ME-09 — Reanudar sin cambiar el partido

**Alcance:** checkpoints versionados de estado, azar, órdenes, participantes, responsabilidades y hechos confirmados. Recuperar y terminar ambos modos tras interrupción; trabajo y comandos idempotentes. El detallado conserva hechos suficientes para consultar su relato real; el rápido solo lo que calculó. Guardar semilla, versiones, plantilla y políticas necesarias para interpretar resultados.

**Interfaz y cierre:** pausar, cerrar y volver; comprobar que no se duplica una canasta ni se altera una orden ya confirmada. Un caso exportable permite reproducir anomalías del laboratorio. Las escrituras de persistencia van por fronteras o lotes, no por jugador y actualización temporal.

**Fuera:** persistencia completa de carrera, mercado o países.

### ME-10 — Selección de encuentros y jornada mixta

**Alcance:** calendario mínimo de prueba con encuentros en franjas; elegir **antes de cada inicio** qué rivales seguir en detallado. El partido propio es detallado y los demás son rápidos. Cola acotada y workers reutilizables, con prioridad del partido observado, resultados confirmados una sola vez y progreso visible. Una jornada de referencia contiene **10 países × 3 divisiones × 8 encuentros = 240 partidos** sintéticos; no exige crear ya treinta ligas jugables con sus competiciones y contratos.

**Interfaz y cierre:** seguir tu partido y al menos uno designado, avanzar el resto y comprobar relatos solo donde se simularon. Medir coste completo, memoria y percentil 95 en un PC de referencia declarado, con arranque frío y caliente. **Objetivo provisional:** aproximarse a diez segundos de cálculo para el avance desatendido de esa jornada, excluido el tiempo que el usuario pasa mirando o pausando partidos. Si la medida se aleja mucho, revisar costes del modelo y del ejecutor antes de ampliar países; no reducir estadísticas de ojeo a cifras inventadas para cumplir el tiempo.

**Fuera:** treinta ligas finales, economía y calendario de temporada completo.

## 5. Jugadores y equipos creíbles

Hay **dos problemas distintos**: crear los primeros jugadores para probar una acción y generar después una población grande sin absurdos. Se resuelven en ME-01 y ME-07, respectivamente. Los diez iniciales serán perfiles **escritos y revisados**, con fortalezas, debilidades y funciones complementarias; no veinte atributos independientes lanzados al azar. El formulario permite editar y guardar de forma explícita, con avisos de compatibilidad entre rol, medidas y tareas. No impone que todo jugador bajo sea rápido ni que todo alto sea torpe.

Antes de ME-07 se elegirá una o varias competiciones y temporadas como **referencia estadística concreta** para baloncesto profesional europeo masculino. Las distribuciones de altura, tamaño, uso, tiro, faltas y minutos deben contrastarse por contexto; no se trasladan porcentajes de una liga real como probabilidades directas de un atributo. Habrá arquetipos útiles para iniciar la generación, pero la calidad y la mezcla de capacidades podrán solaparse entre posiciones. Un perfil deliberadamente excepcional es posible; una incoherencia generada por defecto debe investigarse.

Los jugadores muestran niveles `E−`…`A+`, que corresponden a 1–15 internamente. Se identifica qué capacidades afectan ya al motor y cuáles siguen siendo **candidatas de diseño**. El editor de equipos no crea automáticamente contratos o reglas de inscripción, porque esos sistemas pertenecen a otras entregas del juego.

## 6. Contratos para NBA y baloncesto universitario

La primera implementación no simula NBA ni NCAA. Sí deja fronteras verificables para acoplarlos después:

| Aspecto | Contrato desde el inicio | Implementación futura |
|---|---|---|
| Reglas de pista | Perfil versionado de tiempo, campo, relojes, faltas, libres y reanudaciones; hechos independientes de su sanción | Perfiles NBA y NCAA, con diferencias de categoría y edición |
| Estadística | Hechos del partido y política de acta diferenciados | Convenciones particulares que corresponda mostrar |
| Población | Capacidades y medidas del jugador separadas del reglamento | Distribuciones de jugadores y estilos por ecosistema |
| Competición | El calendario entrega encuentros al módulo de partido | Divisiones, formatos y calendarios propios |
| Plantillas y trabajo | Identidad, elegibilidad para el encuentro y quinteto separados del núcleo de acciones | Contratos profesionales, inscripción y elegibilidad universitaria |

Esto **no** significa construir ahora un framework de cientos de opciones o reglas NBA/NCAA ficticias. Significa que una diferencia posterior se añada en el propietario correcto, sin reescribir tiros, tácticas ni atributos para cada país.

## 7. Validación, rendimiento y documentación

**Puerta común de cada PR:** recorrido completo por interfaz; escenario reproducible y resultado observable; pruebas automáticas mínimas de invariantes/reglas/mecanismo nuevo; instrucciones manuales muy concretas para el usuario; diseño, decisiones y changelog actualizados; prompt exacto guardado en el repositorio **antes** de ejecutarlo, incluso para hotfixes. Claude Code puede elegir detalles técnicos reversibles, pero se detiene si falta una decisión de juego. Nada se fusiona hasta superar la prueba funcional del usuario; `main` permanece jugable.

**Pruebas que importan:** una ayuda deja una marca; altura C01 afecta recepción/liberación/poste sin doble premio por C04; subir Defensa perimetral/interior no equivale a más tapones automáticos; el rebote requiere llegada; puntos, faltas y minutos cuadran en acta; resultados rápidos y detallados responden en el mismo sentido a cambios tácticos comparables. No basta con comparar marcadores. Se usan escenarios pequeños para causalidad, lotes cuando sea necesario para distribuciones y una máquina fija para rendimiento. No se lanzan campañas masivas en cada cambio documental.

**Evolución de documentos:** `docs/match/README.md` enlaza índice, estado y rutas de lectura; `docs/match/reference/README.md` orienta los cuatro estudios originales. Los contratos aprobados pasan a documentos activos breves (`model`, `rules`, `actions`, `capabilities`, `validation`, escenarios) a medida que existen. Cada prompt cita solo las secciones necesarias y se archiva en la carpeta de prompts establecida por Foundation. Este roadmap registra alcance y estado por entrega; no copia cuatro estudios dentro de cada prompt.

## 8. Después del primer núcleo

La primera versión con jornada mixta **no agotará el baloncesto del dossier**. Se ampliará por familias completas de interacción, cada una con táctica ofensiva, respuesta defensiva, atributos implicados, estadística y equivalencia rápida: switch y castigo del emparejamiento; poste; más variantes de PnR; defensa de zonas y ataque contra ellas; presión; saques; situaciones especiales; y libro de jugadas más amplio. El orden concreto se decidirá viendo qué falta en los partidos de prueba.

La **pantalla de administración de pesos** también merece una entrega propia posterior: sensibilidades por mecanismo y etapa, perfiles versionados, comparación antes/después y publicación controlada. Desde ME-01, los parámetros ya deben estar identificados y versionados como datos, con límites y escenarios de calibración; posponer la pantalla **no** equivale a dejar los efectos deportivos enterrados en coeficientes arbitrarios imposibles de revisar.

NBA, NCAA masculina y NCAA femenina llegarán mediante perfiles normativos y poblaciones específicas, cada una con pruebas de regla y jornada propias. Su modelo de competición, contratos o elegibilidad se planificará aparte del motor de partido. El objetivo es ampliar el juego, no construir después tres motores incompatibles.

---

**Siguiente paso, cuando aprobemos este roadmap:** redactar únicamente el prompt MD de ME-01, con documentos concretos a leer, perfiles iniciales, desenlaces generables, reglas FIBA alcanzables y recorrido manual de aceptación. Este archivo no pide ejecutar ninguna fase.
