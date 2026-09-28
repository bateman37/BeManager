# BeManager — Atributos del jugador y su impacto en el partido

**ID:** MAT-ATR-001 · **Versión:** 2 · **Estado:** borrador de diseño para revisar juntos · **Fecha:** 28-09-2026  
**Relación:** complementa `BeManager-del-estudio-al-motor-de-partidos-v1.md` y `BeManager-capitulo-tacticas-integradas-al-motor-v1.md`; desarrolla el capítulo 06 de `BeManager-estudio-baloncesto-v1.md`.  
**Alcance:** catálogo máximo de capacidades, ficha de jugador, trazabilidad de las acciones P01–P76 y parámetros de equilibrio. Acuerda la escala de capacidades, pero no asigna valores a jugadores ni establece coeficientes, fórmulas finales o un prompt para Claude Code.

**Cambio en v2:** incorpora Defensa perimetral y Defensa interior, renombra T18 como Tapón, separa los técnicos en ataque, defensa y rebote, y actualiza los mecanismos y sucesos afectados. La v1 se conserva para consultar la evolución de la propuesta.

**Revisión de v2:** acuerda quince grados (`E−` a `A+`, almacenados como 1–15) y hace explícito el papel de la altura en la geometría corporal, sin duplicar el efecto del alcance de pie.

## Índice y lectura rápida

1. [Decisión de diseño](#1-decisión-de-diseño)
2. [Ficha y catálogo de atributos](#2-ficha-y-catálogo-de-atributos)
3. [Cómo intervienen realmente](#3-cómo-intervienen-realmente)
4. [Mapa completo de acciones P01–P76](#4-mapa-completo-de-acciones-p01p76)
5. [Caso de estudio: rebote y tamaño](#5-caso-de-estudio-rebote-y-tamaño)
6. [Editor de equilibrio y versiones](#6-editor-de-equilibrio-y-versiones)
7. [Dos motores, tácticas y validación](#7-dos-motores-tácticas-y-validación)
8. [Decisiones registradas y primera entrega](#8-decisiones-registradas-y-primera-entrega)
9. [Fuentes y límites](#9-fuentes-y-límites)

Para discutir nombres y ficha: §2. Para comprobar si falta una acción: §4. Para discutir pesos configurables: §§5–6. Para trasladarlo al motor: §§3 y 7–8. Los identificadores `T`, `M`, `F` y `C` son referencias estables **de este borrador**, no nombres de columnas impuestos al código.

## 1. Decisión de diseño

La ficha puede tener una profundidad parecida a la captura de Football Manager que aportaste: técnicos divididos en **ataque, defensa y rebote**, más mentales y físicos, medidas corporales destacadas, roles, tendencias y estado. En baloncesto, altura, peso, envergadura y alcance merecen estar a la vista, pero se expresan en **cm y kg**, no como grados de capacidad. Las 43 capacidades del estudio, junto con las dos defensivas añadidas en esta revisión, tienen aquí un nombre corto y una categoría: **45 candidatas en total**. Su presencia en el catálogo máximo **no obliga** a implementar 45 efectos independientes ni a mostrarlas todas desde el primer prototipo.

La idea central es: **plan táctico → oportunidad y responsabilidades → acciones de jugadores → resultado reglamentario**. La capacidad modifica reconocimiento, elección, movimiento o ejecución *en la etapa donde actúa*. La morfología cambia lo físicamente accesible y las relaciones de contacto. No se suma un porcentaje general de «talento», «altura» o «IQ» al final de cada jugada.

Para fijar expectativas, la evidencia disponible apoya mirar posición, movimiento y relación entre jugadores en el rebote; también indica que la altura de la oposición cambia la tarea del lanzador. **No** proporciona un coeficiente universal para convertir centímetros o un grado `E−`–`A+` en una probabilidad de canasta o rebote. Las magnitudes del juego serán hipótesis de diseño sujetas a calibración. [S1](#s1-rebote-espacial), [S2](#s2-rebote-colectivo), [S3](#s3-alcance-y-tiro)

**Cambio respecto al documento histórico `DESIGN(1).md`:** allí se proponían 2–5 atributos ofensivos/defensivos por acción, un modificador corporal posterior, un posible «impuesto» por altura/peso y una penalización de tiro por envergadura relativa. No heredaríamos esas fórmulas como reglas aprobadas para el nuevo proyecto. Las acciones pueden necesitar cero, una o varias capacidades en **etapas distintas**; un cuerpo alto y hábil no recibe una resta automática de agilidad, y unos brazos largos no reducen el tiro exterior por definición. Si hubiera un coste observado, debe tener mecanismo y evidencia propios. [S4](#s4-antropometría-y-selección)

## 2. Ficha y catálogo de atributos

### 2.1 Estructura visible

| Zona de ficha | Contenido | Cómo se interpreta |
|---|---|---|
| Cabecera | Identidad ficticia, edad, posición/es utilizables, mano dominante, equipo | Posición y etiqueta de rol son información deportiva, no bonificaciones automáticas |
| Medidas | Altura, peso, envergadura, alcance de pie | Medidas reales; se comparan en acciones concretas; el alcance puede estar estimado si falta medida |
| Técnicos ofensivos | 15 capacidades de gesto y creación | Pase, balón, tiro, poste, bloqueos y desmarque; pueden usarse tras cualquier cambio de posesión |
| Técnicos defensivos | 6 capacidades | Defensa perimetral e interior, contención, navegación, robo y tapón |
| Técnicos de rebote | 2 capacidades compartidas | Cerrar el camino y capturar, en ataque o defensa según posición y encargo |
| Mentales | 12 capacidades de reconocimiento, elección y coordinación | Lo que detecta y cómo dirige la acción; no aumenta cualquier porcentaje |
| Físicos | 10 capacidades de movimiento, contacto y recuperación | El rendimiento del movimiento y el esfuerzo, distinto de la talla |
| Estilo | Tendencias y rasgos condicionados | Preferencias, no calidad intrínseca |
| Hoy | Energía/fatiga, carga reciente, faltas y disponibilidad | Estado dinámico; algunas alteraciones pueden reservarse al análisis |
| Encaje | Funciones posibles en ataque/defensa y tareas exigidas por la táctica | Explicación contextual: «puede llegar al closeout», «recibe en short roll»; sin estrella que sustituya la simulación |
| Historial | Minutos, estadística y tendencias observadas, con muestra | Resultado de oportunidades y rol; no lectura directa de la capacidad verdadera |

No abriría un bloque de «técnicos generales»: pase, manejo y recepción se emplean cuando el equipo controla o disputa el balón, y su uso tras un robo no los convierte en una habilidad defensiva distinta. **Cierre y captura de rebote sí merecen un bloque propio**, porque ocurren con tareas diferentes a ambos lados de la pista. Las categorías ordenan la ficha; la matriz de acciones determina dónde actúa cada atributo.

**Escala acordada:** cada capacidad técnica, mental o física se guarda internamente como un entero de **1 a 15** y se presenta con **cinco grados y tres matices**. De menor a mayor se lee de izquierda a derecha dentro de cada fila y después de E a A:

| Grado | Matiz − | Sin matiz | Matiz + |
|:---:|:---:|:---:|:---:|
| E | `E−` (1) | `E` (2) | `E+` (3) |
| D | `D−` (4) | `D` (5) | `D+` (6) |
| C | `C−` (7) | `C` (8) | `C+` (9) |
| B | `B−` (10) | `B` (11) | `B+` (12) |
| A | `A−` (13) | `A` (14) | `A+` (15) |

Un grado describe **capacidad relativa en una tarea**, no probabilidad directa: `B` no significa un porcentaje fijo de acierto. La escala conserva el mismo significado entre países, categorías y modos de simulación; el contexto, la oposición y las curvas calibradas por tarea determinan el resultado. Las medidas C01–C04 conservan unidades físicas; tendencias, rasgos y estados tienen sus propios tipos, no reciben automáticamente una letra. La ficha puede mostrar el grado conocido del propio jugador y estimaciones con intervalo de grados y confianza para rivales según el ojeo; **la visibilidad no cambia el valor real que simula el motor**. El perfil que genera jugadores debe producir combinaciones plausibles y también excepciones, sin topes rígidos basados en la posición. Las fronteras empíricas entre grados y las curvas de impacto siguen sujetas a calibración. Estas letras son una **decisión de interfaz de BeManager**; no se presentan como convención del ojeo profesional.

### 2.2 Técnicos — 23 candidatos en tres bloques

Los IDs de la v1 se conservan para que la trazabilidad P01–P76 siga siendo legible; T21 pasa a mostrarse con los ofensivos y las dos nuevas capacidades se añaden como T22/T23. La agrupación de la ficha **no restringe** el uso de una capacidad cuando aparece la misma tarea en otra fase.

**Técnicos ofensivos (15):**

| ID | Nombre de ficha | Qué significa; dónde entra principalmente |
|---|---|---|
| T01 | Finalización | Toque, ángulo y control cerca del aro: bandeja, reverso o gancho corto |
| T02 | Floater | Toque intermedio por encima de primera contención y antes del aro |
| T03 | Tiro medio | Ejecución de lanzamiento de dos fuera del aro, con contexto de distancia |
| T04 | Triple | Ejecución exterior según zona y distancia; también determina amenaza percibida |
| T05 | Tiro libre | Rutina y ejecución de libres; sin defensor que tapone el lanzamiento |
| T06 | Tiro móvil | Preparar pies y balón tras corte, bote o recepción en movimiento |
| T07 | Manejo | Conservar, proteger y desplazar el balón bajo presión |
| T08 | Separación | Fintas, cambios de ritmo y recursos para ganar espacio al defensor |
| T09 | Precisión pase | Enviar el balón a lugar, altura y momento apropiados |
| T10 | Recursos pase | Ejecutar trayectorias y tipos de pase adecuados a la ventana |
| T11 | Recepción | Controlar un pase difícil y quedar preparado para continuar |
| T12 | Poste | Pies, pivotes, sellos y repertorio ofensivo cerca del aro |
| T13 | Bloqueos | Ángulo, base, contacto legal y reajuste de pantalla |
| T14 | Contacto al aro | Proteger la finalización y mantener el gesto pese al contacto; no es fuerza pura |
| T21 | Desmarque | Preparar y recorrer cortes y salidas de pantalla |

**Técnicos defensivos (6):**

| ID | Nombre de ficha | Qué significa; dónde entra principalmente |
|---|---|---|
| T15 | Contención | Gesto inmediato para guiar o frenar al atacante que ya amenaza con penetrar, manteniendo una posición legal |
| T16 | Navegación | Pasar bloqueos y recuperar ruta defensiva con técnica |
| T17 | Robo | Tocar o interceptar un balón realmente accesible con manos legales |
| T18 | Tapón | Intervención legal **sobre el balón de un tiro** alcanzable; no representa todo tiro molestado |
| T22 | Defensa perimetral | Colocación, distancia y respuesta ante amenazas exteriores, recepciones y closeouts; antes de la contención concreta |
| T23 | Defensa interior | Ganar y sostener posición cerca del aro o en el poste, negar recepción/profundidad y proteger un espacio sin depender del tapón |

**Técnicos de rebote (2):**

| ID | Nombre de ficha | Qué significa; dónde entra principalmente |
|---|---|---|
| T19 | Cierre rebote | Contactar, sellar y liberar posición para que el equipo capture; puede beneficiar a otro compañero |
| T20 | Captura rebote | Asegurar, palmear útilmente o dirigir un balón disputado, ofensivo o defensivo |

**Límites entre defensivos:** T22 determina mejor la posición y el ángulo desde el exterior; T15 actúa sobre la contención de un desplazamiento con balón que ya se inició. T23 trata la lucha por posición y la defensa del aro/poste **antes del tiro**; T18 solo puede intervenir cuando existe una trayectoria y un balón que se puede taponar. Molestar un tiro sin tocar el balón sale de T22/T23, llegada, orientación, frenada y alcance; no exige una tirada de T18. T16, T17 y T19 conservan mecanismos propios. Ninguno de estos atributos sustituye las órdenes de drop, cambio, ayuda o zona: son capacidades de jugadores para ejecutarlas.

**Fronteras que habría que validar:** T01 frente a T14, T03/T04 frente a T06, T09 frente a T10, T15 frente a T22, T18 frente a T23, T19 frente a T20. Si dos columnas siempre explican el mismo efecto, se fusionan o se restringe su ámbito; no se mantienen 45 números por obligación estética.

### 2.3 Mentales — 12 candidatos

| ID | Nombre de ficha | Qué significa; dónde entra principalmente |
|---|---|---|
| M01 | Visión | Buscar y detectar información relevante; puede no ver una ventana abierta |
| M02 | Anticipación | Prever la trayectoria o acción probable sin conocer el futuro |
| M03 | Decisiones | Elegir entre opciones *percibidas* para el contexto y el plan |
| M04 | Temporización | Sincronizar el instante del corte, pase, salto o intervención |
| M05 | Espacios | Reconocer carriles, ocupaciones y relaciones posicionales |
| M06 | Concentración | Mantener la atención en marcas, reloj y tarea durante la acción |
| M07 | Disciplina | Respetar responsabilidad y controlar riesgo evitable, sin imponer pasividad |
| M08 | Temple | Conservar calidad de elección/rutina ante presión contextual real |
| M09 | Comunicación | Avisar pantalla, cambio, ayuda y asignación al compañero que puede oírlo |
| M10 | Adaptación | Ajustar la respuesta ante un patrón efectivamente observado |
| M11 | Comprensión táctica | Entender llamadas, reglas, lecturas y excepciones del plan conocido |
| M12 | Dosificación | Distribuir esfuerzos sin abandonar responsabilidades importantes |

M01 no es «visión de pase» únicamente; un defensor también necesita detectar a su marca y la ayuda. M04 decide *cuándo*; M09 permite que otros lo sepan; M11 decide *qué regla compartida se entendió*. M08 interviene cuando se representa presión psicológica concreta; no es «clutch + puntos» ni altera a todos en cada posesión.

Un experimento reciente de búsqueda visual y decisiones en tareas de vídeo apoya separar rapidez de lectura, elección y fatiga mental; **no** mide directamente el efecto de nuestros 12 atributos durante un 5×5 profesional. [S7](#s7-decisión-y-fatiga-mental)

### 2.4 Físicos — 10 candidatos

| ID | Nombre de ficha | Qué significa; dónde entra principalmente |
|---|---|---|
| F01 | Aceleración | Primeros pasos en ataque, recuperación y ayuda |
| F02 | Velocidad | Recorridos largos, avance y retorno |
| F03 | Frenada | Parada, closeout controlado, reorientación tras carrera |
| F04 | Agilidad lateral | Cambios de dirección y desplazamiento defensivo/cortes |
| F05 | Fuerza | Aplicar y resistir contacto útil en sello, pantalla y cierre |
| F06 | Salto | Desplazamiento vertical alcanzable en aro, rebote y tapón |
| F07 | Repetición | Sostener esfuerzos intensos sucesivos dentro del encuentro |
| F08 | Recuperación | Reponer recursos entre esfuerzos y descansos pertinentes |
| F09 | Equilibrio | Mantener estabilidad física tras frenada, contacto o aterrizaje |
| F10 | Coordinación | Encadenar movimientos complejos de cuerpo y balón; candidato a fusionar si no aporta efecto propio |

F07/F08 y M12 tienen tareas distintas: sostener esfuerzos, recuperar recursos y **elegir** cómo repartirlos. Si al diseñar el partido F10 duplica T06, T13 o T21, puede pasar a ser un factor derivado/no visible. No inventar lesiones individuales desde F08; salud y durabilidad son otro sistema.

### 2.5 Morfología, preferencias y estados: tipos distintos

| ID | Medida | Vía causal concreta | No hacer |
|---|---|---|---|
| C01 | Altura (cm) | Geometría vertical y corporal: altura del cuerpo y del punto de salida del balón, recepción alta, liberación cerca del aro, posición y emparejamiento en el poste; también ayuda a estimar C04 cuando falta | +X % automático de rebote/tapón/canasta o segundo premio por un alcance ya explicado por C04 |
| C02 | Peso (kg) | Masa en contactos y espacio ocupado, junto con velocidad, técnica, fuerza y base | Transformar kg directamente en fuerza o penalizar velocidad dos veces |
| C03 | Envergadura (cm) | Radio lateral/diagonal alcanzable con orientación y brazo disponible | Restar tiro exterior por ser larga; asumir que cubre dos sitios a la vez |
| C04 | Alcance de pie (cm) | Altura de mano sin salto; junto a F06, posición y tiempo define alcance aéreo | Sumar además altura y envergadura al mismo alcance ya calculado |

**Contrato geométrico común:** C01–C04 construyen antes de resolver cada acción un perfil corporal y de alcance, actualizado con postura, orientación, salto y ubicación. La altura C01 sigue influyendo **aunque se haya medido C04**: sitúa cuerpo, hombros y salida posible del balón, cambia la recepción alta y la relación espacial al sellar, finalizar o defender el poste. C04 describe hasta dónde llega la mano de pie y, con salto y tiempo disponibles, la elegibilidad para tocar un balón alto. C02 y C03 intervienen en contacto y alcance lateral según la acción. Los mecanismos usan **las propiedades geométricas resultantes**; no añaden después un bonus plano de C01 y otro de C04 para premiar dos veces la misma mano o el mismo tiro.

Si no conocemos C04, se puede **estimar** desde medidas corporales en la generación ficticia, etiquetar la estimación y mantener correlación plausible. Si sí conocemos la medida, se usa directamente **para ese alcance**, sin que C01 deje de describir el cuerpo y el punto de salida. Una diferencia de 40 cm puede abrir una recepción o finalización alta, o facilitar un sello interior frente a un defensor mucho más bajo; pies, fuerza, técnica, negación de pase y ayudas todavía pueden anular la ventaja. En un rebote lejano, un cierre perfecto o sin contacto, la talla puede ser irrelevante. Datos del Combine muestran asociaciones de talla, alcance, salto y agilidad con la selección NBA, pero seleccionar jugadores no identifica el efecto causal de cada centímetro en una jugada. [S4](#s4-antropometría-y-selección)

**Tendencias/rasgos separados:** tirar tras recepción, buscar aro o triple, pasar tras ventaja, pase arriesgado, usar mano no dominante, roll/pop, cargar rebote, saltar a robar, ayudar, improvisar. Una escala de *preferencia* solo altera frecuencia de intento en condiciones disponibles; los niveles técnicos determinan ejecución. «Mano dominante» y competencia con la otra pueden expresarse como perfil asimétrico de las tareas de manejo, pase y finalización, no un plus general.

**Estados separados:** energía y carga aguda, equilibrio actual, atención actual, faltas, molestias/limitación declarada y familiaridad con compañeros y jugada. El estado puede afectar las capacidades *efectivas por una vía elegida*; no se vuelve a aplicar una penalización global al resultado. Potencial, profesionalidad, ambición, reputación, experiencia y posición nominal pueden existir en otros capítulos, pero no reciben un bonus directo de canasta. Experiencia puede influir en reconocimiento/preparación si se diseña y valida; no sustituye M01, M03 ni M08 automáticamente.

## 3. Cómo intervienen realmente

### 3.1 Resolver por etapas

| Etapa | Pregunta | Datos y capacidades | Resultado intermedio observable |
|---|---|---|---|
| 1. Posibilidad | ¿Puede llegar, tocar, recibir o lanzar antes de que cierre la ventana? | Balón y diez posiciones, geometría C01–C04, F01–F06, reloj y estado | Elegibilidad, margen de llegada, espacio |
| 2. Percepción | ¿Qué información ve u oye este jugador? | M01, M02, M06, M09, visión bloqueada y scouting conocido | Opciones percibidas; algunas reales quedan fuera |
| 3. Elección | ¿Qué intenta según plan, roles y preferencias? | M03, M10, M11, M12, instrucción vigente y tendencia | Intención con objetivo y alternativa |
| 4. Movimiento/coordinación | ¿Llega a ocupar y sincronizarse? | F01–F04, F09–F10, M04–M05, técnica de corte/bloqueo/contención | Separación, contacto, ventana o retraso |
| 5. Interacción/ejecución | ¿Qué calidad produce ante oposición y balón concreto? | T01–T23 pertinentes, alcance/contacto efectivos, estado | Pase, recepción, lanzamiento, disputa, falta posible |
| 6. Reglamento | ¿Qué hechos valen y cómo se reanuda? | Perfil FIBA/NBA/NCAA, hechos y relojes | Canasta, posesión, libres, infracción, acta |

El perfil geométrico del §2.5 alimenta las etapas pertinentes y se actualiza si cambian posición, postura o salto; **C01 está presente en la física** aunque no se enumere como coeficiente en cada suceso. La etapa 6 es determinista respecto a hechos y reglas; no se calibra para «hacer que salga la estadística». La incertidumbre residual de las etapas anteriores es contextual y reproducible por semilla, no una segunda tirada independiente de tapón y canasta ya resueltos. El trabajo científico sobre valor esperado de posesión distingue movimiento continuo y sucesos discretos; nuestra traducción es una **decisión de videojuego**, no una implementación de aquel modelo. [S5](#s5-movimiento-y-sucesos)

### 3.2 Los cinco del ataque y los cinco de la defensa

Un atributo pertenece a un **participante en una responsabilidad**. En bloqueo directo, por ejemplo: T13/M04/F05 del bloqueador cambian contacto y momento; T07/M01/M03 del manejador cambian lectura y salida; T21/M05 del exterior débil mantienen salida; T16/F04 del perseguidor cambian separación; T22/T15 del defensor exterior afectan colocación inicial y contención posterior; T23/C04 del grande alteran lo que protege cerca del aro; M02/M09/F01 del ayudador determinan llegada; otro defensor intenta la reparación. La táctica elige responsables y condiciones; los atributos deciden qué ocurre con ellos. No se calcula «ataque del equipo × defensa del equipo» como sustituto de estas relaciones.

**Ejemplo de un triple:** disposición y acciones crean una línea; el pasador ve, decide y ejecuta; la recepción consume tiempo; el defensor sale y frena. T22, F03 y M02 ayudan a fijar distancia, ángulo y momento del closeout; C03/C04 y orientación determinan si una mano puede molestar. T04 resuelve el tiro *una vez fijados* distancia, equilibrio y oposición efectiva. T06 puede acortar la preparación; no se le añade después otro premio por «tiro cómodo» si esa comodidad ya fue creada. T18 solo entra **si el defensor puede intervenir sobre el balón para intentar un tapón**; no se exige una gran capacidad de tapón para molestar un tiro. La estatura nominal no resta porcentaje desde el otro lado de la pista.

### 3.3 Reutilizar mecanismos; no setenta y seis fórmulas

Las acciones P01–P76 del estudio son **sucesos y situaciones**, no 76 lanzamientos independientes de dados. Una misma capacidad puede actuar en varios sucesos porque éstos reutilizan mecanismos pequeños:

| Mecanismo reutilizable | Atributos que pueden intervenir, según etapa | Qué se ajustaría |
|---|---|---|
| Buscar/decidir (`LD`) | M01–M03, M06, M10–M11; información y táctica | Tiempo/ruido de percepción, elección y persistencia |
| Moverse (`MV`) | F01–F04, F07–F09, M04–M05, C02 solo cuando media contacto | Trayectoria, tiempo de llegada, equilibrio y coste |
| Pasar/controlar (`PC`) | T07, T09–T11, M04; rivales T17/M02/C03 | Ventana, error de trayectoria, recepción y desvío |
| Bloquear/sellar (`BS`) | T12–T13, T19, F05/F09, M04, C02 y posición | Contacto, legalidad y ruta retardada |
| Defender/ayudar (`DA`) | T22/T23 para posición y respuesta exterior/interior; T15 para contención iniciada; T16 para pantalla; T17 para balón expuesto; T18 para tapón elegible; M01–M02/M04–M07/M09–M11, F01/F03/F04/F06, C03–C04 | Contención, recepción negada, ayuda, oposición, reparación y, si llega al balón, tapón |
| Tirar/finalizar (`TF`) | T01–T06/T14 según gesto, F06/F09, M08 condicionado; oposición efectiva | Preparación, alteración, trayectoria y acierto |
| Rebotear (`RB`) | T19–T20, M02/M04–M05, F01/F05–F07/F09, C02–C04 | Acceso, cierre, alcance, captura y siguiente fase |
| Contacto/sanción (`CS`) | T12–T15/T18–T19/T22–T23 según actor y momento, F05/F09, M07, C02; hechos y reglamento | Posición/contacto legal, no cuota prefijada de faltas |
| Adjudicar (`RG`) | Ningún rating por sí solo; reloj, hechos, edición normativa | Reglas tipadas y comprobables, fuera del editor de pesos |

La lista es de *atributos elegibles* por mecanismo, no de pesos que deban activarse todos a la vez. Cada mecanismo espacial consume la geometría corporal derivada de C01–C04 cuando corresponde, aunque la tabla solo destaque algunas medidas como entradas directas. Una acción puede pasar por varios mecanismos; cada atributo recibe una vía identificable. `LD` no puede consultar intenciones futuras ni capacidades ocultas del rival.

## 4. Mapa completo de acciones P01–P76

**Cómo leer las tablas:** `T`, `M`, `F` y `C` remiten al §2; `LD/MV/PC/BS/DA/TF/RB/CS/RG` al §3.3. Se anotan **factores principales y condicionales**; la geometría C01–C04, táctica, estado, reloj, balón y adversarios son entradas siempre necesarias cuando intervienen en la acción, aunque no se repitan en cada celda. Por tanto, que C01 no figure junto a cada uno de los 76 sucesos **no significa que se ignore la altura**: el mecanismo espacial recibe ya altura de cuerpo, punto de salida y alcances derivados. «Resultado» o «regla» significa que **no se aplica un grado nuevo** al suceso: ya debe salir de las acciones previas. T22/T23 pueden determinar oposición sin tapón; T18 solo trata un intento viable de tocar el balón lanzado. Estos mapas proponen responsabilidades; no aprueban que todos los IDs aparezcan simultáneamente en una fórmula.

### 4.1 Inicio, recuperación y avance — P01–P12

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P01 Salto inicial | MV, RB, RG | C04 + F06 + M04 para alcanzar; T20 para dirigir; rival disputa; regla decide saque |
| P02 Saque tras canasta | LD, MV, PC, DA, RG | Sacador M01/M03/T09–T10; receptores T21/T11; defensa exterior T22/M02, T15 si contiene avance; tiempo y líneas |
| P03 Saque lateral/fondo | LD, MV, BS, PC, RG | T13/T21/M04 de desmarques; T09/T11 frente a negación T22 o T23 según receptor, T16 si hay pantalla; regla de saque |
| P04 Rebote defensivo asegurado | RB, PC | Tras P47–P48: T20 controla, T07 protege, M01/T09/M03 seleccionan salida; presión rival |
| P05 Intercepción de pase | DA, PC, RG | Posición previa T22/T23 según sector; defensor M02/T17/F01/C03 elegible en trayectoria; pasador T09–T10; control T20 o T11 |
| P06 Robo sobre bote/recepción | DA, PC, CS | T22/T15 o T23 colocan y contienen; T17/M04/F04 intervienen frente a T07/T11; alcance C03 y riesgo M07 |
| P07 Balón dividido | MV, RB, RG | M02/F01/T20/M04/C04; F05/C02 solo si hay contacto legal; quién controla o palmea |
| P08 Avance por bote | LD, MV, PC, DA | Atacante T07/T08/F01/F02/F04/M03; defensor T22 para ángulo y T15 si frena penetración, más F04/M02; balón expuesto |
| P09 Avance por pase | LD, PC, DA | T09–T11/M01/M04; destinatario F01/T21; defensor T22/M02 para negar línea, T17/C03 si interviene |
| P10 Superioridad transitoria | LD, MV | Es **estado generado** por carreras y asignaciones; explotarla usa M01/M03/T09/F01; sin dado «2×1» |
| P11 Ataque temprano | LD, MV, BS, TF | Plan habilita drag/sello/tiro; T13/M04/F01 crean ventana; T01/T04 ejecutan si existe |
| P12 Renunciar a correr | LD | M03/M11 y orden del entrenador priorizan conservar; coste es oportunidad/tiempo perdido |

### 4.2 Preparación y juego sin balón — P13–P24

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P13 Recepción | PC | T11/M04/F09; calidad T09 del pase; rival T17; una mala recepción consume tiempo |
| P14 Parada y pivote | MV, PC, RG | F03/F09/T07; T12 en gesto de poste; apoyos reales determinan pasos |
| P15 Amenaza triple | LD, MV, DA | T08/M03/F01; defensor T22/M02 decide distancia ante amenaza creíble T03/T04/T07; T15 si comienza penetración |
| P16 Pase de continuidad | LD, PC | M01/M03/T09–T10; receptor T11/M05; oponente M02/T17 en línea |
| P17 Pase que rompe línea | LD, PC, DA | M01/T09–T10/M04; defensor M02/T17/C03; receptor T11 y ventana disponible |
| P18 Corte | LD, MV, DA | T21/M04/M05/F01/F04; defensor T22 o T23 según zona, T16 si navega pantalla, M02/F04 y ayuda posterior |
| P19 Reubicación | LD, MV | M05/M04/F01/F04, disposición; defensor T22/T23 y M02/M05 puede conservar o perder línea |
| P20 Bloqueo sin balón | BS, MV, DA, CS | T13/M04/F05/F09 y C02 en contacto; T21 del receptor; T22/T23 para posición y T16 para navegar |
| P21 Bloqueo directo | BS, PC, DA | Bloqueador T13/M04/F05; manejador T07/M03; defensores T22/T16, T15 si hay penetración, T23 si protege zona interior, M09 |
| P22 Continuación | LD, MV, PC, DA | Roll F01/T11/T01, short roll M01/T09, pop T04, slip T21/M04; ayudador T23 en aro o T22 en perímetro, M02 |
| P23 Sello/posición | BS, CS | Atacante T12 al sellar en poste, T19 solo al posicionarse para rebote; F05/F09/C02 y ángulo; rival T23/F05 en poste, T15 si hay conducción; C04 importa en recepción posterior |
| P24 Negación ofensiva fallida | LD, RG | **Consecuencia** de ruta/timing/línea perdidos; M03/M10 y reloj deciden reinicio |

### 4.3 Defensa y cambio de ventaja — P25–P36

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P25 Contención del balón | DA, MV | T22 fija distancia y ángulo exterior; T15/M02/F04/F03 frenan penetración frente a T07/T08/F01; T23 si la acción se traslada al interior; orientación táctica y ayuda disponible |
| P26 Superación parcial | DA, MV | **Estado geométrico** tras P25/P37; M02/F01 del defensor aún permiten recuperar |
| P27 Navegación de bloqueo | DA, MV | T22 coloca antes, T16/M02/F04/F03 navegan frente a T13/F05/M04 del bloqueador; trayectoria legal |
| P28 Cobertura del interior | DA, LD | T23/M11/M09/F04/F03/C04 del responsable interior; T15 al contener salida, T22 si cambia al exterior; rol drop/show/switch y ocupantes débiles |
| P29 Ayuda breve | DA, LD, MV | M01/M04/M07/F03/F04 y T22/T23 según origen y destino; T15 al frenar balón; tiempo para volver |
| P30 Ayuda comprometida | DA, MV | M02/M11/M09/F01 y T23 si protege aro/roll/poste o T22 si niega salida; C04 para alcance; T18 solo ante tiro que puede taponar; deja otro espacio |
| P31 Rotación | DA, MV | M09/M05/M06/F01/F03; T22/T23 según nuevo sector, T15 si recibe una penetración; tercer defensor mantiene nueva asignación |
| P32 Cambio de marca | DA, LD | M09/M11/M02/F01/F04; T22/T23 según nuevo atacante/sector, T15 ante conducción; tamaño y alcance concretos |
| P33 Recuperación y closeout | DA, MV | F01/F03/T22/M02/C03–C04 para llegar y molestar conservando contención; T18 solo si intercepta el tiro; rival T04/T08 lee cierre |
| P34 Desvío sin pérdida | DA, PC | T17/M02/C03 sobre pase T09; T20/T11 si hay posterior control |
| P35 Error de coordinación | LD, DA | Orden incompatible, M09/M11/M06 y observación incompleta; no «fallo aleatorio de equipo» |
| P36 Neutralización | RG, LD | **Estado** de distancias/rutas recuperadas; ataque debe volver a elegir |

### 4.4 Creación y lanzamiento — P37–P46

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P37 Penetración | LD, MV, PC, DA | T07/T08/F01/F04/M01/M03 frente a T22 al empezar, T15 al contener, T23 ante ayuda interior; C03 en balón accesible |
| P38 Juego de poste | BS, TF, DA | T12/T14/F05/F09/C02, recepción T11; defensor T23/F05 para posición y oposición, T15 si contiene conducción; C04 en extensión |
| P39 Preparación de tiro | MV, PC, TF | T06/T11/F03/F09/M04; tiro T03/T04 según zona; defensor T22/F03 al exterior o T23 cerca del aro; un tapón posterior se trata en P43 |
| P40 Finalización cercana | TF, DA | T01 o T02, T14 si contacto; F06/F09/C04 frente a T23/C04 y ayuda; T18 si hay posibilidad de taponar el balón |
| P41 Lanzamiento exterior | TF, DA | T03 o T04 y contexto de P39; distancia, tipo y oposición por T22/C04 (o T23 si defendía allí); T18 solo si intenta tapón elegible; **sin segundo premio T06** |
| P42 Tiro alterado | DA, TF, LD | Antes de soltar, T22/T23, M04/F06/C04 condicionan oposición y ruta; tirador T06/M03/T10 responde; si luego hay tapón, se resuelve en P43 |
| P43 Tapón | DA, TF, RG | T18/M04/F06/C04, posición y legalidad; T14/C04 del atacante y balón liberado |
| P44 Trayectoria del tiro | TF | Sale de ejecución T01–T05 pertinente y contexto ya fijado; **no nueva probabilidad independiente** |
| P45 Interferencia | RG | Tiempo, balón, aro y edición reglamentaria; capacidades solo causaron posición previa |
| P46 Abortar tiro | LD, PC, RG | M01/M03/T09–T10/T07/F09 ante posición y mano de T22/T23, sin tirada de T18 antes de lanzar; legalidad de salto y caída |

### 4.5 Rebote y continuidad — P47–P53

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P47 Preparación | LD, MV, BS, RB | Orden de carga/balance, M02/M05/T19/F05/C02; balones posibles, rivales y posición |
| P48 Disputa aérea | RB, CS | C04 + F06 + llegada; T20/M04/F09 para asegurar; T19 rival cambió acceso |
| P49 Rebote ofensivo controlado | RB, LD, TF/PC, RG | Control T20; M03 elige tiro T01 o pase T09; reloj se ajusta por regla |
| P50 Palmeo a canasta | RB, TF, DA | Llegada C04/F06, toque T20/T01/M04 frente a posición T23, alcance C04 y T18 si se tapona; no requiere agarre previo |
| P51 Rebote de equipo/fuera | RG | Último toque y ubicación del balón; no asignar T20 a un jugador ficticio |
| P52 Disputa sin control | RB, CS, RG | T20/M04/F07, C04 y F05/C02 en contacto; cada toque modifica siguiente acceso |
| P53 Balance tras tiro | LD, MV | Reparto táctico, M05/F01/F02/F07; las posiciones se conservan al cambiar posesión |

### 4.6 Faltas, infracciones y administración — P54–P67

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P54 Falta sobre tiro | TF, DA, CS, RG | T14/F09 del atacante; defensor T22/T23 según posición, T18 si intenta tapón, M07/F03/C02 si contacto; momento y regla |
| P55 Falta no de tiro | DA, CS, RG | T22/T23 en posición, T15/M07/F09 si contiene, presión y desplazamiento rival T07; contacto real y bonus |
| P56 Falta ofensiva | BS, CS, RG | T13/T12/F05/F09/M07 al bloquear, sellar o cargar; rival y regla de contacto |
| P57 Falta de rebote/suelto | RB, CS, RG | T19/F05/F09/M07, C02 durante contacto; situación de control y bonus |
| P58 Técnica/conducta especial | CS, RG | Hecho disciplinario definido aparte; **sin dado de M07/M08 por posesión** |
| P59 Infracción de manejo | PC, MV, RG | T07/T12/F09/M04 influyen en gesto, defensa T22/T15 o T23 puede presionar; pasos/doble se adjudican a hechos |
| P60 Infracción temporal | RG | Relojes y hechos; M01/M03/táctica pudieron agotar el tiempo antes |
| P61 Fuera/campo atrás/pie | PC, DA, RG | Último toque, control e intención; T09/T17 solo en la acción que produjo el hecho |
| P62 Retenido/encajado | RB, CS, RG | Si hay disputa, T20/M04/F05/C04; una vez retenido, perfil de alternancia/salto |
| P63 Tiempo muerto | RG | Elegibilidad normativa y solicitud de entrenador; no tirada de atributo jugador |
| P64 Sustitución | RG, LD | Ventana legal y decisión de entrenador; cambian actores, estados y roles futuros |
| P65 Lesión/sangre | RG | Estado de salud y protocolos de un sistema futuro; sin azar físico genérico aquí |
| P66 Revisión/corrección | RG | Reinterpreta hechos y consecuencias; no consulta ratings para «convencer» |
| P67 Bocina/fin | RG | Reloj, liberación, balón en vuelo y sanciones pendientes |

### 4.7 Libres y situaciones extremas — P68–P76

| ID y suceso | Mecanismo | Factores causales destacados |
|---|---|---|
| P68 Libre intermedio | TF, RG | T05, rutina y M08 solo si presión contextual modelada; no rebote vivo ordinario |
| P69 Último libre vivo | TF, RB, RG | T05; si falla, P47–P48 con posiciones de jugadores y regla aplicable |
| P70 Primer libre de 1+1 | TF, RG | T05 y regla que habilita otro tiro o balón vivo; solo donde exista |
| P71 Libre con posesión retenida | TF, RG | T05; derecho a saque conservado según sanción, sin rebote vivo inventado |
| P72 Invasión/infracción | MV, RG | Posición y tiempo legales; M06/M07 pueden afectar la conducta previa, no la sanción |
| P73 Fallo deliberado de libre | LD, TF, RB, RG | M03/T05/M04 eligen/ejecutan intento legal; después P47–P48 y reloj |
| P74 Sanciones múltiples | RG | Orden y compensación determinados por perfil normativo y hechos previos |
| P75 Canasta propia/saque a canasta/por debajo | RG | Hecho extraordinario y adjudicación específica; no «tiro normal» con rating |
| P76 Insuficiencia/abandono | RG | Estado administrativo y resolución normativa; no atributos de lanzamiento |

## 5. Caso de estudio: rebote y tamaño

**Situación:** el quinteto atacante lanza de tres. El entrenador ordenó que dos carguen y tres protejan el balance; el rival cierra con su pívot y un exterior. El balón va largo. El pívot alto está cerca del aro, pero lejos de la salida del balón; un alero menos alto ya ganó el carril.

1. **Antes del tiro:** quién recibe orden de cargar, dónde estaban todos, T19/M02/M05 del cierre y posición relativa alteran quién puede acceder. C02 y F05 influyen *si se produce contacto*; un bloqueo eficaz puede abrir el rebote a un compañero.
2. **Tras soltarlo:** gesto y localización del lanzamiento determinan una distribución razonable de vuelo/salida. No se adjudica ya el rebote a «el más alto». El motor conserva el compromiso de los que hicieron balance.
3. **Llegada:** trayectoria y velocidad inicial, F01/F04, anticipación M02 y tiempo de vuelo fijan un margen. Si el pívot no llega a la zona de aterrizaje, C04 y F06 no lo hacen elegible mágicamente.
4. **Disputa:** para cada candidato realmente próximo, `alcance aéreo alcanzable ≈ C04 + salto ejecutable(F06, estado, tiempo)`; C01 ya participó en la geometría de cuerpo, punto de partida y posición, C03 modifica contactos laterales cuando procede, y C02/F05/F09/T19 la calidad del cierre. No se suman como premios independientes altura, envergadura y alcance por el **mismo brazo**.
5. **Control:** T20, M04 y equilibrio determinan agarre, palmeo o balón suelto. Si un jugador solo cerró, el equipo puede capturar con otro. Un toque no adjudica un rebote individual ni un robo automático.
6. **Después:** P49–P53 heredan lugares y compromisos para segunda oportunidad o contraataque. Más carga puede mejorar acceso y dejar peor balance; el resultado no está escrito por la orden.

**Lo configurable:** sensibilidad de la *elegibilidad vertical* a centímetros de margen, influencia de posición/tiempo en la llegada, eficacia técnica del cierre y del control, incertidumbre de salida del balón, y coste de abandonar balance. El admin debe poder probar «demasiado peso al tamaño» cambiando **un mecanismo identificado**. No editar «altura del rebote = 25 %» si ya entró en C04 y luego duplicarla en un multiplicador de captura. Estudios observacionales de rebote destacan posición, movimiento, relaciones y número de jugadores que participan; no entregan nuestros pesos. [S1](#s1-rebote-espacial), [S2](#s2-rebote-colectivo), [S6](#s6-rebote-y-transición)

## 6. Editor de equilibrio y versiones

### 6.1 Qué significa «configurable»

| Ajustable desde pantalla de administración | Fuera de esa pantalla |
|---|---|
| Activar o desactivar **entradas elegibles** de un mecanismo/etapa; consultar qué acciones P las reutilizan | Conectar un atributo arbitrario a cualquier resultado sin una vía causal declarada |
| Coeficientes de sensibilidad por **mecanismo y etapa**; curvas acotadas, magnitud de ruido residual | Legalidad de pasos, faltas, alternancia, relojes y reinicio |
| Cómo cambian tiempos, márgenes, error condicionado y elección en contextos definidos | Fichas de jugadores, resultados históricos y posiciones a posteriori |
| Parámetros distintos por tarea: rebote aéreo, pase bajo presión, tiro tras bote, closeout | Fórmulas arbitrarias ejecutables o un bonus secreto global por táctica |
| Perfiles de referencia calibrados cuando existan muestras de contextos distintos | Trasladar porcentajes de NBA a FIBA/NCAA mediante un multiplicador universal |

Cada parámetro declara **unidad**, dominio, signo permitido, etapa, participantes, mecanismo, eventos P que lo usan y métrica observable. El conjunto de entradas activas puede evolucionar dentro del registro tipado de mecanismos: por ejemplo, ensayar T20 en la captura y C04 en la elegibilidad, o retirar una entrada redundante. Añadir una nueva clase de movimiento o una relación causal inexistente exige diseño y código, no una casilla libre. En el editor, cambiar una sensibilidad muestra escenarios antes/después: quién llega al rebote, cuánto cambia el tiempo de cierre, tiros concedidos y efectos secundarios. Un aviso detecta entradas duplicadas: «C01 y C04 explican el mismo alcance» o «T22 y T15 premian dos veces la misma contención». El admin configura equilibrio del juego; el entrenador solo elige tácticas. No se dan controles de balance numérico al usuario que dirige el equipo.

Ejemplo de **registro de diseño**, deliberadamente sin valores finales ni sintaxis de implementación exigida:

| Etapa | Entrada tipada | Parámetro que puede calibrarse | Salida y prueba |
|---|---|---|---|
| Rebote: llegar | Distancia/tiempo/posición y aceleración efectiva | Sensibilidad de tiempo de llegada | Margen temporal hasta zona de balón |
| Rebote: cerrar | Base, T19, F05, C02, ángulo y rival | Sensibilidad del contacto legal | Ruta libre/impedida; falta si corresponde |
| Rebote: alcanzar | C04, F06, vuelo, orientación y salto disponible | Sensibilidad de margen vertical | Elegibilidad; no captura automática |
| Rebote: controlar | T20, M04, F09, oposición y balón | Error residual de control | Agarre, palmeo, disputa, fuera |
| Siguiente fase | Orden carga/balance y posiciones finales | Coste temporal del retorno | Oportunidad ofensiva o transición concedida |

**Flujo de publicación:** edición en borrador → comparación de escenarios fijos y lotes comparables → comprobación de invariantes y rangos → revisión de impacto táctico en ambos motores → publicación de una **versión inmutable** → futuras partidas/encuentros usan la nueva versión según política acordada. Guardar autor, fecha, motivo, diff, métricas, advertencias y versión anterior para revertir. Cada partido registra versión de perfil, entrada y semilla. Una corrección no reescribe los boxscores pasados; una partida en curso debe mantener una política de anclaje de versión definida antes de lanzar la pantalla admin. No se publican coeficientes fuera de límites ni versiones que rompan el contrato rápido/detallado.

**Coste y prudencia:** las entradas se validan y preparan antes de simular muchos partidos; el bucle de una jugada solo consulta el subconjunto de mecanismos pertinente. No hay evaluación de fórmulas textuales arbitrarias, ni búsqueda de 45 atributos para cada uno de los 76 sucesos de cada actualización temporal. Los pesos son editables como **datos versionados**; los mecanismos y reglas permanecen implementaciones auditables. La pantalla no elimina la necesidad de calibración ni de pruebas.

## 7. Dos motores, tácticas y validación

### 7.1 Mismo significado, resolución distinta

| Cambio del jugador o del plan | Partido detallado | Partido rápido e informe |
|---|---|---|
| Mejor lectura M01 en trampa | Reconoce antes la salida *si está visible* y tiene pase ejecutable | Modifica frecuencia y calidad de salidas representadas de trampas ante perfiles comparables |
| Mejor T22, igual T15 | Se coloca antes, niega recepciones o cierra al exterior con mejor ángulo; su contención posterior mantiene la misma pericia | Varían recepciones, ventanas exteriores y penetraciones iniciadas; no todas las defensas se convierten en robo |
| Mejor T23, igual T18 | Disputa posición interior, niega profundidad o fuerza otro tiro; su técnica de tapón no cambia | Cambian recepciones profundas y tiros cercanos concedidos, sin sumar tapones obligatoriamente |
| Mejor T18, igual T22/T23 | Mejora la intervención sobre tiros a cuyo balón llega, no la calidad de todos sus closeouts | Cambian los tapones elegibles y la alteración de esos intentos; no recibe un bonus universal de defensa |
| Mayor C01, con C04 medido igual | Puede cambiar altura corporal, recepción, salida del tiro y emparejamiento interior; no aumenta la altura máxima de mano ya fijada por C04 | Cambian las ventanas espaciales representadas, sin fabricar centímetros extra de alcance de mano |
| Más C04/F06 en rebote | Puede llegar a balones más altos cuando está bien situado | Cambia oportunidades de disputa según quinteto, política de carga y perfil de salida |
| Mejor T19, mismo T20 | Cierra y facilita captura ajena, sin ganarse necesariamente rebote individual | Aumenta oportunidad de rebote de equipo, no solo el contador personal |
| 5-out con no tirador y mal T04 | Su marca puede ayudar; el ataque puede darle función de bloqueador T13 | Ayudas y tiros permitidos cambian según amenaza representada; ojeo registra lo que calculó |
| Cambio de drop a trampa | Mueve defensores y cambia líneas, receptor libre y reparaciones | Respuestas condicionales de pase, pérdidas y tiros con los mismos perfiles |

El motor rápido usa **los mismos datos de jugadores, instrucciones y lenguaje de mecanismos** y calcula aproximaciones de sus consecuencias sin simular cada paso. Debe representar suficientes acciones/coberturas para generar boxscore y estadísticas detalladas coherentes con el ojeo, y solo publica métricas que realmente produjo. Los partidos propios y rivales elegidos **antes** se simulan en detallado y tienen relato; el resto usa rápido, conserva estadísticas pero no texto ni secuencia recuperable. Ningún atributo recibe una segunda definición deportiva incompatible para acelerar el rápido.

### 7.2 Pruebas que revelarían un error de diseño

| Intervención aislada | Observar primero | Señal de fallo |
|---|---|---|
| Aumentar T22 sin cambiar T15 | Posición exterior, recepciones negadas, ángulo de closeout y penetraciones que llegan a empezar | Aumenta directamente el porcentaje de tapones o se duplica el premio en la misma contención |
| Aumentar T23 sin cambiar T18 | Poste/aro protegidos, profundidad recibida y calidad del tiro concedido | Solo mejora el tapón y no cambia ninguna recepción o posición interior |
| Aumentar T18 sin cambiar T22/T23 | Intervenciones legales sobre balones alcanzables | Mejora todos los tiros defendidos, incluso sin posibilidad de tocar el balón |
| Aumentar C04 manteniendo colocación y salto | Margen de alcance y disputas *elegibles* | Sube el rebote incluso cuando el jugador no se acerca al balón |
| Enfrentar interiores con unos 40 cm de diferencia y perfiles corporales plausibles | Recepciones altas, altura de salida, sello, ayuda y respuesta defensiva; repetir con defensor que niega pase o ayuda eficaz | C01 no cambia nada, o la talla garantiza canasta/rebote sin acceso, técnica ni defensa |
| Variar C01 manteniendo C04 medido, habilidades y contexto | Altura corporal, salida, postura y colocación; elegibilidad vertical con la mano debe seguir C04 y F06 | Aparece un segundo bonus de alcance, tapón o rebote solo por sumar C01 a C04 |
| Aumentar T19 sin cambiar T20 | Acceso rival y rebotes del **equipo** | Crecen solo los rebotes personales del cerrador |
| Aumentar T09 y conservar T11 | Trayectoria, tiempo de recepción y pérdidas por pases | Sube directamente el porcentaje del tirador sin alterar la recepción |
| Mejorar M01, no T09 | Ventanas vistas, elecciones, pases intentados | Cada pase es más preciso aunque la técnica no cambió |
| Aumentar T04 con defensa en drop | Amenaza, selección de tiro, respuesta de cobertura y acierto contextual | Solo aumenta %3 sin afectar jamás al defensor ni a la selección |
| Más C02 manteniendo F05/F04 | Resultado del contacto **si existe**, ausencia de efecto sin contacto | Todo jugador pesado corre menos por regla sin medir su F01/F02 |
| Cambiar carga por balance | Quién entra al rebote y quién puede defender transición | Sube el rebote sin coste de retorno |
| Reducir M09 en una zona o switch | Duplicidades, huecos y tiempo de reasignación | Solo cambia un rating global de defensa |
| Elevar F07 con igual carga inicial | Degradación tras secuencias repetidas | Ventaja completa en el primer sprint fresco |

Primero se comprueban causas e invariantes en escenarios pequeños; luego distribuciones en muestras comparables, y por último el recorrido táctico desde la interfaz. Para dos valores de un atributo importan **participación, contexto y magnitud**, no exigir que una semilla produzca siempre la misma canasta. La calibración usa distancia, tiempo, elección, calidad de oposición, faltas, rebote colectivo y boxscore; no solo puntos. Comparar equipos/roles equivalentes evita atribuir al centímetro lo que se debe a que el entrenador envía al jugador grande a disputar más rebotes.

## 8. Decisiones registradas y primera entrega

| ID | Decisión o estado | Acuerdo o propuesta de partida |
|---|---|---|
| A01 | ¿45 capacidades visibles desde el inicio? | Conservar 45 candidatas en el diseño; decidir qué valores se muestran a medida que los mecanismos funcionen |
| A02 | Escala y significado de los grados: **cerrada**; queda calibrar sus efectos | 1–15 internamente; `E−` a `A+` en la ficha; curvas y población por tarea pendientes, sin equivalencia porcentual |
| A03 | ¿Cómo medir/estimar C04? | Guardar medida real o estimación marcada; nunca doble premio con C01/C03 |
| A04 | ¿Qué atributos fusionar tras probarlos? | Revisar parejas T01/T14, T09/T10, F10 y demás fronteras del §2 |
| A05 | ¿Qué se revela de un rival? | Informe con estimación e incertidumbre; capacidad simulada intacta |
| A06 | ¿Quién puede cambiar pesos y con qué política de partida guardada? | Admin de equilibrio, versiones inmutables y cambios solo en encuentros futuros |
| A07 | ¿Qué categorías observa el modo rápido para ojeo? | Contrato explícito de acciones/ayudas/tiros antes de publicar estadísticas |
| A08 | ¿Qué fuente, categoría y competición calibran cada magnitud? | Referencia anotada y muestra reservada; números provisionales identificados |

**Primer bloque integrado, acotado:** desde la interfaz, un quinteto ofensivo ejecuta una acción de bloqueo con salida exterior y un quinteto defensivo responde con drop o trampa. Debe existir al menos una lectura de ayuda, tiro/pase, oposición, fallo, **rebote con cierre y continuación**; entran a la vez los atributos que hacen funcionar *esas* decisiones. Los otros nombres quedan documentados para ampliar sin cambiar el contrato. El laboratorio muestra «se pidió → se percibió → se intentó → se ejecutó → se respondió → se concedió». El modo rápido aproxima ese mismo escenario y registra las categorías que usa. En ningún caso se entrega primero un marcador y se «añaden los atributos» después.

La ficha y el editor de equilibrio pueden diseñarse ahora, pero sus 45 valores y coeficientes no deben poblarse al azar para llamar completo al sistema. Cuando aprobemos este capítulo, podremos escribir prompts medianos, uno por bloque funcional, con las decisiones cerradas y pruebas manuales concretas. Cada prompt se guarda en el repositorio antes de ejecutarse, y `main` permanece jugable.

## 9. Fuentes y límites

**Material del proyecto:** capítulo 06 aportado (`Markdown pegado.md`, idéntico en lo esencial a `estudio-baloncesto/06-capacidades.md`), catálogo P01–P76 de `Partido.xlsx`, documentos del motor y tácticas citados en cabecera, captura de ficha de Football Manager y `DESIGN(1).md` histórico. La captura inspira organización visual; el catálogo nuevo y la arquitectura son **propuestas de BeManager**. No se modifica el estudio principal ni las hojas del usuario.

### S1. Rebote espacial

[Hojo, Fujii y Kawahara, *Analysis of factors predicting who obtains a ball in basketball rebounding situations* (2019)](https://kyushu-u.elsevierpure.com/en/publications/analysis-of-factors-predicting-who-obtains-a-ball-in-basketball-r/). La ficha del trabajo original informa de factores de posición individual, movimiento y relaciones entre jugadores asociados a quién captura. **Límite:** modelo predictivo observacional; no ofrece pesos del motor ni un experimento con los quince grados de BeManager.

### S2. Rebote colectivo

[Csátaljay, James, Hughes y Dancs, *Analysis of influencing factors behind offensive rebounding performance in elite basketball* (2017)](https://journals.sagepub.com/doi/10.1177/1747954117738900). Observación de partidos EuroLeague 2011/12; el número y actividad de quienes disputan importan. **Límite:** época/muestra concretas y posible confusión entre estrategia, jugadores y lanzamientos; no usar «tres cargadores óptimos» como ley de juego.

### S3. Alcance y tiro

[Kambič, Stepišnik Krašovec, Erčulj y Štirn, *Biomechanical Adjustments of the Basketball Jump Shot Performed Over Differently High Opponents* (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9465762/). Ensayo de tiros sobre obstáculos de distintas alturas, con cambios de gesto y eficacia. **Límite:** 19 participantes, tarea de laboratorio y obstáculo en lugar de defensa completa; no transferir porcentajes como penalización fija.

### S4. Antropometría y selección

[Estudio original sobre NBA Draft Combine 2000–2018, *Key Anthropometric and Physical Determinants for Different Playing Positions During National Basketball Association Draft Combine Test* (2019)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.02359/full). Recoge altura, peso, envergadura, alcance, salto y agilidad en aspirantes. **Límite:** seleccionados/no seleccionados no equivale a impacto causal durante una posesión, ni impone un umbral universal de altura/agilidad.

### S5. Movimiento y sucesos

[Cervone, D’Amour, Bornn y Goldsberry, *A Multiresolution Stochastic Process Model for Predicting Basketball Possession Outcomes* (2016)](https://arxiv.org/abs/1408.0777). Modelo espaciotemporal que diferencia movimientos y eventos para estimar valor esperado. **Límite:** herramienta predictiva con tracking NBA, no fórmulas listas para construir un videojuego ni fuente de efectos causales de estos atributos.

### S6. Rebote y transición

[Wiens, Balakrishnan, Brooks y Guttag, *To Crash or Not To Crash* (2013)](https://www.sloansportsconference.com/research-papers/to-crash-or-not-to-crash). Análisis de tracking NBA 2011/12 sobre carga de rebote y retorno defensivo. **Límite:** asociaciones tácticas y temporada concreta; no importar multiplicadores.

### S7. Decisión y fatiga mental

[Li, Zhang y Zheng, *Effects of mental fatigue on basketball decision-making and visual search behavior* (2026)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1837100/full). Sesenta universitarios realizaron decisiones sobre vídeo con eye-tracking y una manipulación de fatiga; el tiempo de respuesta y la búsqueda visual se analizaron por experiencia. **Límite:** vídeo sin ejecución física completa y grupos pequeños; no asignar un descuento universal a M01, M03 o M06.

**Conocimiento pendiente:** para muchas capacidades mentales, sincronizaciones raras y situaciones reglamentarias no hay coeficientes observacionales transferibles. Esta matriz registra *vías causales propuestas* y escenarios donde comprobarlas; no pretende que la ciencia haya validado todos los atributos o los pesos de un juego FIBA, NBA y universitario.
