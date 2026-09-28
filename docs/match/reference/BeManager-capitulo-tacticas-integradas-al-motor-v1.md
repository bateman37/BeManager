# BeManager — Capítulo de táctica integrada en el motor de partidos

**ID:** MAT-TACT-001 · **Estado:** DRAFT para revisión de diseño · **Fecha:** 27-09-2026  
**Relación:** amplía la propuesta `BeManager-del-estudio-al-motor-de-partidos-v1.md` y utiliza el estudio `BeManager-estudio-baloncesto-v1.md`.  
**Material aportado:** `TacticasOFF.xlsx`, `TacticasDEF.xlsx`, `Partido.xlsx` y tres capturas de Football Manager, además de las tablas del mensaje.  
**Objetivo:** acordar cómo se configura el baloncesto de los entrenadores y cómo se manifiesta en el partido detallado y en la simulación rápida. **No es un prompt de implementación ni aprueba valores numéricos.**

## Índice

1. [La estructura que recomiendo](#1-la-estructura-que-recomiendo)
2. [Ataque: de estilo a jugada](#2-ataque-de-estilo-a-jugada)
3. [Qué es una jugada y cómo funciona el libro](#3-qué-es-una-jugada-y-cómo-funciona-el-libro)
4. [Defensa: de estructura a reacción](#4-defensa-de-estructura-a-reacción)
5. [Cruces, costes e incompatibilidades](#5-cruces-costes-e-incompatibilidades)
6. [Cómo se siente vivo en el partido](#6-cómo-se-siente-vivo-en-el-partido)
7. [Modo rápido, ojeo y coherencia](#7-modo-rápido-ojeo-y-coherencia)
8. [Una interfaz que se pueda dirigir](#8-una-interfaz-que-se-pueda-dirigir)
9. [Alcance, validación y decisiones por cerrar](#9-alcance-validación-y-decisiones-por-cerrar)
10. [Fuentes y límites](#10-fuentes-y-límites)

## 1. La estructura que recomiendo

**Tu planteamiento es sólido:** separar ataque y defensa; configurar la intención general, la organización en pista y las instrucciones específicas; y disponer de un libro de jugadas para los momentos en que el entrenador quiere llamar una secuencia. Las capturas de Football Manager aclaran la experiencia deseada: dos caras del plan, roles visibles y ajustes comprensibles. BeManager necesita además una capa de acciones y lecturas propia del baloncesto.

La clave es distinguir cosas que aparecen mezcladas en un catálogo de nombres:

| Pregunta del entrenador | Capa de ataque | Capa de defensa |
|---|---|---|
| ¿Qué queremos conseguir habitualmente? | Estilo y prioridades | Riesgos permitidos y prioridades |
| ¿Cómo nos organizamos en esta fase? | Espacios y roles | Estructura, altura y emparejamientos |
| ¿Qué hacemos ante esta situación? | Acción o jugada y sus lecturas | Cobertura, ayuda y recuperación |
| ¿Con quién y cuándo? | Quinteto, capacidades, desencadenantes | Quinteto, rival, fase y desencadenantes |

Una política táctica es una **instrucción condicionada**. El entrenador puede pedir «correr si hay superioridad; si no aparece, organizar 4-out/1-in y buscar una entrada interior». También puede pedir «drop ante este bloqueo, ayuda desde el ala débil si el continuador recibe, pero conservar la esquina de este tirador». El motor determina si los jugadores lo reconocen y llegan a ejecutar; no concede automáticamente el resultado perseguido.

Esta estructura requiere cinco ideas compartidas por los dos modos de simulación: **fase de juego, intención táctica, participantes, respuesta rival y coste asumido**. El detallado representa movimiento, decisiones y continuidad; el rápido calcula una aproximación de las mismas interacciones y registra las categorías que realmente generó.

## 2. Ataque: de estilo a jugada

### 2.1 Estilo y prioridades, primera pantalla

Tus diez filas de estilos generales son un buen **catálogo de objetivos y compensaciones**. No las convertiría en diez botones mutuamente excluyentes: pertenecen a preguntas distintas. La siguiente agrupación permite escoger sin crear una nube de modificadores:

| Dimensión configurable | Opciones que recoge de tus tablas | Consecuencia que debe observarse |
|---|---|---|
| Transición | Transición agresiva; renunciar a correr sin ventaja | Carrera, salida, oportunidad antes de organizar defensa, riesgo de pérdida y balance |
| Inicio del ataque organizado | Ataque temprano; juego de control | Momento de la primera acción, tiempo disponible para la siguiente, calidad de la organización |
| Creación | Movimiento continuo; creador central; más o menos libertad | Quién inicia, cuántas opciones se preparan y cómo reaccionan los demás |
| Destino de ventaja | Buscar recepción interior; buscar triple; equilibrio contextual | Tipo de recepción y lanzamiento intentados **cuando se abre una ventana** |
| Tras lanzamiento | Priorizar rebote ofensivo o balance | Quién disputa y quién protege la transición rival |
| Flexibilidad de funciones | Roles fijos o intercambio posible | Si un jugador puede ocupar otra función y cómo se repara el espacio dejado |

**Dos matices esenciales:** «ataque interior» y «volumen exterior» pueden formar la misma secuencia: entrada al poste, ayuda, pase y triple. «Transición agresiva» y «control» pueden convivir mediante condiciones: correr ante ventaja; proteger balón y organizarse si la defensa ya está colocada. Una contradicción solo aparece si dos órdenes exigen conductas incompatibles *en el mismo instante y situación*.

Los estilos actuarán sobre **selección, preparación y persistencia de acciones**, no como un bonus de porcentaje para todos los tiros. Si se prioriza triple, el equipo debe crear, reconocer y tomar más oportunidades exteriores; no convertir por decreto en tiradores a cinco jugadores que no lo son.

### 2.2 Disposición: dónde esperan y se mueven

5-out, 4-out/1-in y 3-out/2-in son **estructuras espaciales de referencia**. Horns y 1-4 pueden ser **colocaciones de entrada** antes de una secuencia. Empty side, dunker spot y sobrecarga son **principios de ocupación situacional**; box, stack y diamond se usan habitualmente como colocaciones para saques o inicios específicos. Algunas etiquetas pueden servir en varios contextos, pero el juego necesita saber para qué se eligieron.

La disposición define lugares deseados, relaciones y reglas de relleno: «si O4 corta, ¿quién ocupa el ala?», «si el balón cambia de lado, ¿cuál es la esquina débil?». Nadie reaparece en su punto dibujado instantáneamente. El rival puede impedir una recepción o empujar a un jugador fuera de su posición ideal.

**Estar abierto no equivale a atraer a un defensor.** En un 5-out con un no tirador, el suyo quizá ayude más cerca del aro. Puede castigarse esa ayuda usando a ese jugador como bloqueador, cortador o pasador, siempre que tenga tiempo, ruta y capacidades para hacerlo. Así el quinteto altera el significado de la estructura.

### 2.3 Quinteto y roles

Small ball, dos interiores, dos creadores o un interior pasador describen **composición y posibilidades**, no tácticas que suman puntos automáticamente. La misma alineación puede ejecutar más de una disposición; su rendimiento depende de quién lleva cada responsabilidad.

Para cada acción, el entrenador selecciona **funciones**, que se asignan a jugadores concretos: iniciador, bloqueador, amenaza exterior, receptor en short roll, ocupante de dunker spot, cortador, cargador de rebote y jugador de balance. El usuario puede fijar nombres cuando tenga sentido y disponer de una alternativa si hay sustitución, faltas o una negación defensiva.

La interfaz puede advertir: «5-out con dos no tiradores: la defensa podría ayudar desde ambos», «dos interiores en pintura: riesgo de congestión», «solo un creador disponible: este plan depende mucho de él». No prohibiría esas combinaciones: jugadores particulares y lecturas pueden hacerlas útiles.

## 3. Qué es una jugada y cómo funciona el libro

### 3.1 Clasificar los nombres que has reunido

Tu lista contiene **jugadas, acciones, principios y respuestas**. Es normal que en el lenguaje de pista se llamen «jugadas» a muchas de ellas; para el juego conviene precisar su función.

| Nivel | Ejemplos de tus tablas | Qué contiene en el motor |
|---|---|---|
| Estructura/entrada | 5-out, Horns, 1-4 alto, Delay | Colocación inicial y primeras responsabilidades |
| Familia de acción | Bloqueo directo central o lateral, DHO, pindown, poste, corte | Participantes, movimientos y opciones abiertas |
| Variación de acción | Drag, double drag, Spain, ram, Chicago/Zoom, pistol, hammer | Orden y sincronización de dos o más acciones |
| Lectura/contramedida | Reject, snake, re-screen, slip, ghost, keeper, curl, backdoor | Respuesta cuando aparece una posición o conducta defensiva |
| Continuación individual | Roll profundo, short roll, pop, mantener perseguidor detrás, lift/drift | Qué hace el jugador después y qué exige de sus compañeros |
| Jugada preparada | Una entrada concreta desde Horns hacia Spain con salida y plan de seguridad | Secuencia organizada, roles, llamadas, desencadenantes y alternativas |

La clasificación no impide que un entrenador llame «Pistol» a una jugada propia. Evita programar «Pistol = tiro» y después añadir otro sistema desconectado de pase, defensa y atributos.

### 3.2 Libro de jugadas utilizable

**Propongo un libro seleccionable, organizado por momento de uso:**

| Carpeta del libro | Cuándo se ofrece | Contenido ejemplo |
|---|---|---|
| Ataque organizado | Defensa aproximadamente colocada | Horns hacia bloqueo, Delay con DHO, entrada a poste |
| Ataque temprano | Tras cruzar y antes de asentarse el rival | Drag, doble drag o pistol |
| Saque lateral | Balón muerto desde banda | Stack, Iverson u otra liberación con salida segura |
| Saque de fondo | Balón muerto desde fondo | Box, elevator o corte hacia aro/esquina |
| Situación especial | Último tiro, necesidad de triple, falta de tiempo | Variantes con reloj, riesgo y destinatario explícitos |

Matiz a tu frase «solo en momentos posicionales»: **las jugadas preparadas tienen especial valor en ataque organizado y saques**, pero algunas entradas ensayadas se usan en ataque temprano. Drag o pistol son ejemplos de secuencias de llegada. En transición con superioridad clara, normalmente priman principios y lecturas inmediatas; no habría que detener un dos contra uno para dibujar Horns. [F1](#f1--fiba-tactics-board-sitos-pizarra)

Cada ficha del libro debería mostrar: colocación de partida, roles y sustitutos, cuándo se puede llamar, primera acción, opciones si la defensa concede/niega, salida segura si se rompe y esfuerzo de coordinación. Puede reutilizar familias: una jugada Horns puede terminar en Spain, pop, corte de lado débil o reinicio según lo observado. Eso da variedad deportiva sin exigir cientos de rutinas independientes.

El catálogo general puede ser amplio; el **libro activo de cada equipo** contiene las fichas que el entrenador prepara. Para cada una se configura su prioridad de llamada, las situaciones que la habilitan y su alternativa si la primera opción no se puede usar. No se ejecutan todas las fichas para elegir cada pase: en cada ocasión se consideran únicamente las que son aplicables a esa fase, quinteto y reloj. El coste de preparación y la dificultad de comunicación pueden afectar a la *ejecución efectiva* cuando diseñemos esos mecanismos.

**No conozco una cifra universal verificable de «jugadas de un equipo profesional».** El número depende de si se cuentan nombres llamados, entradas, variantes, acciones recurrentes, instrucciones de último segundo y continuaciones improvisadas. Los análisis oficiales muestran una misma entrada con desenlaces diferentes y respuestas durante el partido. Sería una inferencia injustificada fijar «todo profesional usa X jugadas». Para BeManager propongo un **repertorio activo manejable en pantalla, ampliable sin límite deportivo arbitrario**, y comprobar en las pruebas cuántas fichas necesita realmente el usuario. [F1](#f1--fiba-tactics-board-sitos-pizarra), [F2](#f2--fiba-tactics-board-shake-rattle-and-roll)

### 3.3 Cómo se llama y cuándo se rompe

La jugada empieza solo si se cumplen sus condiciones: balón, reloj, jugadores, fase y tiempo para colocar la entrada. Llamarla no teletransporta a nadie. Cada participante debe llegar, reconocer la llamada y realizar su tarea; la defensa ve parte de esos movimientos y actúa.

Una jugada tiene **lecturas y salidas**, nunca una obligación de completar ocho pasos. Si se niega la primera recepción, puede buscar un corte, reorientar el bloqueo, invertir o conservar balón y reorganizar. En los últimos segundos simplifica. El repertorio base del equipo responde aunque el entrenador no llame ninguna ficha concreta.

## 4. Defensa: de estructura a reacción

### 4.1 Fases y organización, no un único selector

Tu tabla de «defensas individuales» incluye **defensas de presión** como diamond, 2-2-1 y trampas. Conviene separar el *tipo de responsabilidad*, el *lugar donde empieza la presión* y la *estructura una vez superada*:

| Capa | Ejemplos | Pregunta útil |
|---|---|---|
| Estructura asentada | Individual, zona 2-3/3-2/1-3-1, matchup zone, box-and-one | ¿Quién protege cada jugador o espacio? |
| Presión al avanzar | Individual a 3/4 o toda pista, run-and-jump, 1-2-1-1, 2-2-1 | ¿Dónde se intenta consumir reloj o atrapar? |
| Transición defensiva | Retorno, protección del aro, emparejamiento inicial | ¿Cómo se frena al rival antes de organizarse? |
| Cambio de fase | Tras canasta/libre, saque o ruptura de presión | ¿Cuándo se abandona una estructura y cuál sustituye? |

Una 1-2-2 de presión y una 1-2-2 como zona de media pista comparten dibujo superficial, pero tienen tareas y ventanas distintas. Una zona puede seguir cortes y pasar a asignaciones individuales en un momento definido. Box-and-one y triangle-and-two mezclan responsabilidades personales y espaciales. No caben de manera fiel en una casilla «individual o zona» que aplique igual durante los cuarenta minutos.

### 4.2 Balón, proximidad, bloqueo y ayudas

Estas son las capas que propones hacer más configurables. Las comparto, con una precisión: **deny, gap y top-lock suelen regular la relación con un atacante sin balón**; se presentan junto a la presión del balón porque ambas determinan las recepciones y líneas de ayuda.

| Control visible | Qué ordena | Qué debe producir en el partido |
|---|---|---|
| Defensa del balón | Distancia, orientación, agresividad y riesgo de manos | Ruta permitida, tiro que se concede, falta/robo y esfuerzo |
| Defensa de receptores | Deny, gap, top-lock y criterios de closeout | Recepciones negadas, cortes, ayudas posibles y recuperación |
| Cobertura de bloqueo | Drop, at the level, show, trap, switch, ICE, under… | Posición y responsabilidad de ambos defensores, rutas y tiempo |
| Ayuda | Nail, low man, tag, stunt, dig; de dónde salir y a quién no abandonar | Quién deja una marca o sector, qué salva y qué concede |
| Reparación | X-out, sink-and-fill, ayuda a la ayuda, volver/intercambiar | Nuevas asignaciones tras el desplazamiento de la primera ayuda |
| Tras tiro | Cierre, captura y balance | Rebote propio y riesgo de transición |

La cobertura se configura **con condiciones**, por ejemplo: lateral izquierdo → ICE; central contra manejador peligroso de tiro → drop menos profundo o at the level; cambio de emergencia si el defensor quedó fuera. El detalle de opciones y sus prioridades debe acotarse para que el entrenador entienda qué orden prevalece. En zona, un bloqueo también recibe respuesta, pero sus responsabilidades no son automáticamente las mismas que en individual.

La defensa jamás recibe un bonus abstracto «por ser 2-3» o «por hacer blitz». Su plan altera **qué llegadas y pases se dificultan, dónde queda una superioridad y qué defensor puede reparar**. La ayuda no puede estar simultáneamente en el roll y pegada a la esquina. Los análisis FIBA muestran precisamente que manipular quién ayuda y quién debe recorrer la recuperación cambia la jugada. [F2](#f2--fiba-tactics-board-shake-rattle-and-roll), [F3](#f3--fiba-tactics-board-tenerife-contra-galatasaray)

### 4.3 Reglas y excepciones comprensibles

La pantalla puede expresar un **plan base más excepciones**: «ayudar al aro; no abandonar al tirador prioritario salvo emergencia», «cambiar con este quinteto», «poner un perseguidor sobre este creador», «presión 2-2-1 solo tras saque de fondo». Una excepción requiere una prioridad explícita y un fallback: ¿quién toma la amenaza cuando el defensor designado no llega?

La información del entrenador y del jugador limita estas decisiones. El motor conoce la capacidad real de un rival ficticio; la defensa actúa con scouting y observaciones disponibles. Un informe útil puede estar incompleto y la lectura de un jugador puede llegar tarde.

## 5. Cruces, costes e incompatibilidades

**No bloquearía toda combinación incómoda.** Hay incompatibilidad estricta cuando la misma persona o el mismo espacio deben cumplir dos tareas exclusivas al mismo tiempo. En otros casos hablamos de rendimiento, preparación o concesiones.

| Combinación elegida | Diagnóstico | Tratamiento propuesto |
|---|---|---|
| Correr si hay ventaja + controlar si no la hay | Compatible por condición/fase | Mostrar ambas reglas y cuándo se activan |
| Atacar poste + buscar triples | Compatible por secuencia | Pase de salida ante ayuda, sujeto a receptor y línea |
| 5-out + interior no tirador | Posible, con amenaza exterior débil | Advertencia de ayudas; opción de corte/DHO/bloqueo |
| 3-out/2-in + dos interiores no tiradores | Posible, exigente en espacios | Advertencia de congestión; no compensar con bonus oculto |
| Presión a toda pista + zona 2-3 asentada | Compatible si hay transición de fase | Definir dónde termina presión y cómo se organiza la zona |
| Rebotear con cinco + cuatro de esos mismos en balance inmediato | Orden simultánea imposible | Pedir prioridad o reparto de responsabilidades |
| Ayudar desde esquina + prohibir abandonarla siempre | Conflicto sobre el mismo disparador | Mostrar conflicto y resolver con prioridad explícita en la configuración |
| ICE y «forzar centro» sobre el mismo bloqueo lateral | Direcciones contradictorias | Impedir activación simultánea o definir una excepción expresa |
| Llamar acción que exige un tirador ausente | Jugada no ejecutable como se diseñó | Sustituto válido, versión adaptada o ficha deshabilitada |

Las **capacidades cambian la viabilidad**. Dos equipos pueden escoger la misma orden y producir resultados distintos por aceleración, timing, bloqueo, visión, precisión, tiro, fuerza y comunicación. El cansancio modifica esos mecanismos concretos; no resta un porcentaje global a «hacer bien la táctica».

En cada fase se aplican primero legalidad y posibilidades reales; después la llamada específica y sus excepciones, las reglas del equipo y las lecturas locales permitidas. El orden exacto y la libertad individual son **decisiones de juego todavía abiertas**. El usuario debe ver qué instrucción fue solicitada, cuál se aplicó y si falló por ejecución, reconocimiento o respuesta rival.

## 6. Cómo se siente vivo en el partido

### 6.1 Ejemplo: una misma jugada, tres partidos posibles

**Escenario hipotético:** quinteto con un interior pasador, 4-out/1-in, prioridad de inicio temprano si el rival no está colocado; entrada Horns cuando ya se organiza; acción de bloqueo directo central con una salida en esquina. La defensa está en individual y puede elegir su cobertura y fuente de ayuda.

| Momento | Plan y acciones reales | Consecuencia visible |
|---|---|---|
| Inicio | Los cinco atacantes ocupan funciones; el bloqueador llega, el base prepara ángulo y los otros tres conservan salidas/cortes | La formación elegida afecta distancias y tiempos, no la probabilidad directamente |
| Defensa 1: drop y tag desde lado débil | Persecución tras pantalla, interior protege aro, ayudador frena roll y deja una recepción | El base debe ver y ejecutar; si pasa, defensa rota y aparece tiro o pase extra |
| Defensa 2: cambio más scram | Se evita la separación inmediata; un tercero intenta sacar al pequeño del poste | El ataque puede sellar antes del scram, invertir o reiniciar; consume reloj |
| Defensa 3: trampa | Dos defensores comprometen el balón; low man vigila al roll y otros cubren salidas | Pase rápido genera ventaja 4 contra 3; un receptor lento permite reparar |
| Resolución | Tiro, falta, balón dividido o continuación desde posiciones resultantes | La secuencia puede ser buena aunque falle el tiro, o mala aunque anote |

Los defensores del lado débil y los atacantes que no tocan el balón importan. Si el equipo defiende de forma inteligente y niega todas las primeras lecturas, la crónica debería poder decir que la llamada se rompió y el ataque terminó tarde. Si el entrenador cambia «ayudar desde esquina» por «mantener al tirador», veremos menos tiros concedidos en esa esquina y más trabajo para contener el roll: **cambia la distribución de oportunidades y costes**, no un botón que garantice ganar.

FIBA describe situaciones donde una misma entrada cambia hacia Spain, otro tirador, re-screen o flare, y otras en las que el ataque mueve a quienes podrían ayudar sobre el continuador. Son ejemplos de por qué una ficha de jugada necesita lecturas y respuestas. [F1](#f1--fiba-tactics-board-sitos-pizarra), [F2](#f2--fiba-tactics-board-shake-rattle-and-roll), [F4](#f4--fiba-tactics-board-rytas-contra-tenerife)

### 6.2 Huella explicable y límites del entrenador

Un hecho deportivo debe registrar **qué se intentó, qué se reconoció, qué se ejecutó y qué concedió la defensa**. El texto muestra las partes observables; el laboratorio muestra además por qué una ayuda quedó corta. Los aciertos individuales se resuelven después de definir el tiro que realmente se produjo.

Un cambio durante el encuentro altera reglas futuras cuando llega a los jugadores y es legal aplicarlo. No reescribe posesiones completadas ni teletransporta una zona. La frecuencia con que un entrenador puede llamar jugadas y la manera de comunicarlas forman parte de las decisiones de interfaz y juego pendientes.

## 7. Modo rápido, ojeo y coherencia

La decisión ya acordada sigue vigente: **tu partido y los rivales elegidos antes de empezar se simulan con detalle y relato; los demás, en modo rápido con boxscore y estadísticas detalladas, sin relato ni reproducción posterior de jugadas inexistentes**.

| Táctica acordada | Motor detallado | Motor rápido y ojeo |
|---|---|---|
| Priorizar ataque temprano | Las ventanas dependen de carreras, asignaciones y balance reales | Más intentos en fases tempranas **si** los perfiles y la salida lo hacen posible; registrar su frecuencia y eficacia |
| Horns hacia bloqueo central | Los cinco ocupan posiciones, preparan entrada y leen cobertura | Registrar uso de la familia, actores principales y desenlaces aproximados; no inventar coordenadas del partido |
| Trap con low man | Dos saltan, uno ayuda al roll, rotaciones dejan espacios | Cambian pérdidas y tipos de recepción/tiro condicionados por pasadores y receptores; se registra la cobertura usada |
| Cargar rebote | Jugadores llegan y cierran; se calcula la salida siguiente | Más opciones de rebote y coste correlativo de transición, si las capacidades y quintetos lo sustentan |

Ambos modos utilizarán **los mismos nombres y significado de las instrucciones** y un perfil de reglas compatible. La resolución numérica es diferente. Los datos del rápido para el ojeo serán el recuento de acciones y coberturas que efectivamente representó, con tamaños de muestra, no una narración ficticia escrita a partir del marcador.

Para comprobar coherencia, simular muestras de los mismos perfiles y planes en ambos modos; contrastar ritmos, tipos de tiro, pérdidas, faltas, rebotes y **efectos condicionales de cambiar una cobertura, fuente de ayuda o acción de ataque**. Un ojeo que recomienda atacar una defensa y un detallado que sistemáticamente da la ventaja contraria necesita corrección antes de ampliar ligas. No se requiere igualdad partido a partido.

## 8. Una interfaz que se pueda dirigir

Tomaría de las capturas la **separación entre «con posesión», «sin posesión» y roles visibles**; las pantallas concretas de Football Manager representan fútbol y no deben copiarse control por control. Para baloncesto propongo tres entradas principales:

| Pantalla | Secciones | Qué ve Dennis |
|---|---|---|
| Ataque | Estilo, disposición, quinteto/roles | Plan general, funciones en cancha, requisitos y advertencias |
| Defensa | Estructura por fase, presión, balón/receptores, coberturas, ayudas | Responsables, concesiones y excepciones ante rivales |
| Libro | Organizado, temprano, banda, fondo y situaciones especiales | Fichas seleccionadas, condiciones, participantes y salidas |

No hace falta un editor gráfico de trayectorias en esta versión. Una ficha de jugada legible, un diagrama esquemático sencillo cuando aporte claridad, y la visualización del laboratorio pueden enseñar los cinco roles. La pantalla de roles puede alternar ataque/defensa y dejar claro qué quinteto está viendo.

La vista principal debería mostrar **la combinación efectiva** en lugar de veinte selectores aislados: «si rebote defensivo y ventaja, correr; si no, 4-out/1-in; entrada Horns disponible; cobertura base drop; no abandonar esquina de X». Al elegir una instrucción conflictiva se explica qué regla queda vigente. En el partido, un panel de tendencias relaciona lo elegido con acciones, ayudas, tiros y concesiones realmente observados.

El catálogo completo de tus hojas Excel es un **mapa de diseño**, no una obligación de poner todos sus nombres en la primera pantalla. Se pueden añadir familias y variaciones a medida que tengan un mecanismo verificable y una opción comprensible para el entrenador.

## 9. Alcance, validación y decisiones por cerrar

### 9.1 Qué sí definir antes del primer bloque de código

1. Un plan de ataque y uno de defensa con condiciones explícitas para el **primer escenario colectivo**.
2. Disposición inicial, diez roles, primera acción, respuestas de cobertura/ayuda y salidas cuando se niega.
3. Capacidades que afectan *a esa acción* a través de percepción, elección, desplazamiento y ejecución.
4. Qué verá Dennis para distinguir una orden bien aplicada de una ayuda tardía o un pase fallado.
5. Qué nombres/acciones y estadísticas podrá reconocer después el motor rápido.

No hace falta fijar hoy todos los sistemas de zona, todas las variantes de Spain ni las 43 capacidades visibles para diseñar la interfaz y los contratos. Sí hace falta que el primer bloque integre **táctica ofensiva, defensiva y atributos** desde el inicio.

### 9.2 Escenarios que comprobarían la propuesta

| Cambio único | Debe cambiar un mecanismo comprobable | No garantiza |
|---|---|---|
| Drop → trampa | Presión sobre pasador, salida tras superar dos y rotaciones | Robo en cada intento |
| Ayuda desde esquina → no ayudar | Amenazas interiores/exteriores realmente concedidas | Más victorias automáticamente |
| Cambiar bloqueador por uno que llega tarde | Momento y calidad de contacto | Bonus general de tiro |
| Dos creadores → uno | Disponibilidad y continuidad de segundas lecturas | Que el marcador caiga siempre |
| 5-out con tirador → con no tirador | Ayuda que puede conceder la defensa y contramedidas | Que todo 5-out sea inútil |
| Cinco cargan rebote → dos balancean | Capturas y riesgo de transición posterior | Una fórmula fija de posesiones extra |
| El rival aprende la primera salida | Contestación y uso de alternativas de la misma jugada | Que conozca el plan sin haberlo visto |

Cada escenario se recorre desde la interfaz. Las pruebas automáticas comprueban reglas e invariantes y comparaciones estadísticas acotadas cuando cambie la simulación; Dennis juzga si se ve baloncesto y si las decisiones son comprensibles. El modo rápido se prueba con muestras comparables, no con un partido aislado.

### 9.3 Decisiones todavía nuestras

| ID | Decisión pendiente | Primera propuesta para discutir |
|---|---|---|
| T01 | Cuánta libertad tiene cada jugador para abandonar la jugada | Salidas y lecturas autorizadas por el plan, más emergencia de reloj |
| T02 | Prioridad entre estilo general, llamada, excepción y lectura | Reglas explícitas con avisos de incompatibilidad |
| T03 | Cuántas fichas activas muestra el libro sin saturar la interfaz | Agrupar por fase y frecuencia; sin cifra profesional inventada |
| T04 | Qué puede ordenarse durante balón vivo y cómo se comunica | Aplicación en frontera comprensible, registrada en el partido |
| T05 | Qué configuraciones son normales y cuáles dependen del rival | Plan base con excepciones visibles por amenaza/cobertura |
| T06 | Alcance exacto del primer bloque | Una familia ofensiva y dos respuestas defensivas con los diez presentes |
| T07 | Qué aprende un rival automático de encuentros previos | Observaciones con muestras y scouting, sin acceso a datos ocultos |

**Conclusión de diseño:** el sistema no se construye como ataque que elige una jugada y defensa que aplica un «contra». El entrenador escoge prioridades y soluciones; diez jugadores se organizan con sus capacidades; el rival responde y deja otras posibilidades. El partido muestra dónde cambió la oportunidad y quién pudo aprovecharla. **Esta conclusión es la recomendación del capítulo, no una fórmula ya aprobada.**

## 10. Fuentes y límites

### Material del proyecto

- Tablas aportadas por Dennis en esta conversación y hojas `TacticasOFF.xlsx` (estilos, disposiciones, quintetos, bloqueo directo, mano a mano y bloqueos indirectos), `TacticasDEF.xlsx` (zonas, individual/presión, balón, coberturas y ayudas), `Partido.xlsx` (estado y sucesos). Se usaron como catálogo y preguntas de diseño; este capítulo no modifica las hojas.
- Capturas de Football Manager aportadas por Dennis: vistas «Con posesión», «Sin posesión» y roles/disposición. Se usaron como referencia de organización visual, no como fuente de reglas de baloncesto.
- `BeManager-estudio-baloncesto-v1.md`, capítulos 3–6 y 9, y `BeManager-del-estudio-al-motor-de-partidos-v1.md`, capítulos 6–8 y 14. Este capítulo concreta la configuración táctica sin repetir los catálogos íntegros.

### F1 — FIBA Tactics Board, Sito's Pizarra

[Análisis oficial de Basketball Champions League](https://www.fiba.basketball/en/news/bcl-22-23-news-tactics-board-sito-s-pizarra). Muestra una entrada «Touch», pantallas, Spain, re-screen y diferentes continuaciones en situaciones distintas. Se leyó el análisis escrito; los clips incrustados no se sometieron a codificación independiente.

### F2 — FIBA Tactics Board, Shake, Rattle and Roll

[Análisis oficial de Basketball Champions League](https://www.fiba.basketball/en/news/tactics-board-hapoel-netanel-holon-shake-rattle-and-roll). Relaciona posición de jugadores sin balón, short roll, ram, shake y responsabilidad del ayudador. Se leyó el análisis escrito; no se etiquetó íntegramente el vídeo.

### F3 — FIBA Tactics Board, Tenerife contra Galatasaray

[Análisis oficial de Basketball Champions League](https://www.fiba.basketball/en/news/tactics-board-three-takeaways-from-tenerife-vs-galatasaray). Describe hedge, ayuda sobre el roll y ayuda a la ayuda, además de ajustes posteriores. Ilustra interacciones y concesiones; no ofrece coeficientes transferibles al motor.

### F4 — FIBA Tactics Board, Rytas contra Tenerife

[Análisis oficial de Basketball Champions League](https://www.fiba.basketball/en/news/tactics-board-three-takeaways-from-rytas-vs-tenerife). Ejemplos de señuelo Spain que se convierte en flare, uso de drop y un segundo bloqueo sobre su defensor. Se consultó el texto del análisis, no se midieron las secuencias en vídeo.

### F5 — Formación WABC/FIBA

[Catálogo oficial de manuales WABC](https://about.fiba.basketball/en/wabc-documents) y [catálogo de clínicas](https://about.fiba.basketball/en/wabc-videos), incluidos cursos sobre spacing, defensa del bloqueo directo, bloqueos sin balón y juego 5-out. Aquí se verificaron títulos y disponibilidad, **no** se presenta una revisión completa de los cursos ni un número oficial de jugadas.

**Límite:** este capítulo es un análisis de diseño apoyado en el estudio previo, tus tablas y ejemplos tácticos publicados. El catálogo de un club profesional concreto y el número de llamadas de un entrenador no se han medido; cualquier límite o coeficiente definitivo debe surgir de decisiones de producto y pruebas, no de una cifra atribuida sin fuente.
