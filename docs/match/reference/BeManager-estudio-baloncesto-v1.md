# BeManager — Estudio integral del partido de baloncesto

**Versión:** 1.0 · **Corte de investigación:** 25 de septiembre de 2026.  
**Objeto:** baloncesto de cinco contra cinco; FIBA, NBA y NCAA masculina y femenina.  
**Naturaleza:** estudio de investigación y síntesis para discutir el futuro motor. No es una especificación aprobada ni una orden de implementación.

## Cómo leerlo sin cargar toda la documentación

| Archivo | Pregunta que resuelve | Leer junto con |
|---|---|---|
| [00 — Conclusiones y método](#00--conclusiones-y-método) | ¿Qué hemos aprendido y con qué grado de certeza? | Este índice |
| [01 — Reglamentos](#01--reglamentos-y-ecosistemas) | ¿Qué cambia entre ecosistemas y versiones? | 02 para consecuencias |
| [02 — Anatomía de la posesión](#02--anatomía-de-la-posesión) | ¿Qué puede suceder, desde lo habitual hasta lo excepcional? | 01 y 08 |
| [03 — Ataque](#03--ataque-principios-estilos-y-familias-tácticas) | ¿Cómo se crean y explotan ventajas? | 04 y 05 |
| [04 — Defensa](#04--defensa-negar-conceder-y-recuperar) | ¿Cómo se niegan ventajas y qué se concede? | 03 y 05 |
| [05 — Interacciones y casos](#05--interacciones-táctica-ejecución-y-resultado) | ¿Cómo encajan los diez jugadores en una misma posesión? | 02–04 |
| [06 — Capacidades del jugador](#06--capacidades-tendencias-y-estados-del-jugador) | ¿Qué habilidades, tendencias y estados influyen realmente? | 07 |
| [07 — Evidencia científica](#07--evidencia-científica-hallazgos-límites-y-utilidad) | ¿Qué respalda cada mecanismo y qué no está demostrado? | 06 y 08 |
| [08 — Estadística y calibración](#08--estadística-incertidumbre-y-calibración) | ¿Cómo medir realismo sin confundir resultados y causas? | 02 y 07 |
| [09 — Traslación al motor](#09--del-conocimiento-del-juego-a-un-motor-verificable) | ¿Qué estructura permitiría integrar motor, tácticas y atributos? | 02, 05, 06 y 08 |
| [10 — Partidos y formación](#10--partidos-formación-y-protocolo-de-observación) | ¿Qué casos, clínicas y materiales permiten profundizar? | 03–05 |
| [11 — Auditoría y decisiones futuras](#11--auditoría-del-diseño-anterior-y-decisiones-para-después) | ¿Qué conservar, corregir y discutir del proyecto anterior? | 00 y 09 |
| [12 — Fuentes](#12--fuentes-y-trazabilidad) | ¿De dónde procede cada afirmación contrastable? | Solo las referencias citadas |

**Ruta inicial recomendada:** 00 → 02 → 05 → 06 → 09 → 11. Después, profundizar por temas. No hace falta empezar leyendo todos los reglamentos.

## Convenciones

- `[Rxx]`: reglamento o manual estadístico oficial; `[Exx]`: investigación empírica o teórica; `[Cxx]`: formación de entrenadores; `[Dxx]`: datos y partidos.
- **REGLA:** obligación normativa de la edición indicada.
- **EVIDENCIA:** resultado de una investigación identificada, con población y límites.
- **SÍNTESIS:** explicación táctica propia que integra mecanismos y terminología de entrenamiento; no atribuye un porcentaje universal.
- **PROPUESTA:** posible representación para BeManager, pendiente de nuestra decisión.
- Las frecuencias «habitual», «situacional» y «excepcional» son orientaciones cualitativas, no porcentajes medidos.
- Las palabras inglesas se conservan cuando facilitan localizar clínicas y vídeo; se explican en español.

## Mantenimiento y lectura selectiva

Cada capítulo tiene un solo cometido. La definición canónica de posesión está en 02; las capacidades en 06; las referencias completas en 12. Los demás capítulos remiten a ellos. Las ampliaciones deben indicar fecha, reglamento, muestra y nivel de evidencia, y actualizar únicamente los módulos afectados. Una discrepancia no se resuelve duplicando una definición en otro archivo.

**Estado de aprobación:** toda propuesta de motor permanece abierta. Ninguna cifra ilustrativa constituye un parámetro autorizado. Este estudio no cambia código, repositorios, ramas ni PR.

---

# 00 — Conclusiones y método

## La conclusión central

La intuición de construir conjuntamente **motor, tácticas y atributos es correcta**, con un matiz esencial: deben compartir un modelo causal del partido, no convertirse en un archivo gigantesco e inseparable. La táctica determina qué intenta hacer cada jugador; sus capacidades determinan qué percibe y qué puede ejecutar; las reglas y el estado de la cancha determinan qué resulta posible y qué sucede después.

El núcleo no debería escoger primero un desenlace —«triple anotado»— para inventarle luego una explicación. Debería producir una secuencia comprensible: un defensor llega tarde al bloqueo, otro contiene el balón, una ayuda abandona la esquina, el manejador reconoce la ventana, el pase llega ligeramente bajo y el tirador debe reajustar los pies. El tiro puede entrar o fallar sin que eso cambie retrospectivamente la calidad de las decisiones.

## Doce hallazgos que condicionan el proyecto

1. **La posesión tiene memoria.** Importan cómo comenzó, el tiempo consumido, el emparejamiento creado, las ayudas desplazadas y las opciones ya negadas.
2. **La ventaja es el objeto central.** Puede ser espacial, temporal, numérica, corporal, técnica o informativa. No se limita a «jugador atacante mejor que defensor».
3. **El juego sin balón no es decorativo.** Cortar, bloquear, ocupar una esquina, sellar una ayuda y cerrar el rebote modifican lo que puede hacer quien lleva el balón.
4. **Una misma táctica produce distribuciones distintas según jugadores y rival.** La etiqueta «pick-and-roll» no contiene por sí sola su rendimiento.
5. **Defender es elegir concesiones.** Evitar una bandeja puede abrir un triple; perseguir un robo puede romper la estructura; cambiar bloqueos puede facilitar el rebote ofensivo rival.
6. **No hay una lista cerrada de todas las jugadas.** Existen principios y acciones combinables. Una gramática táctica resulta más completa y mantenible que miles de jugadas programadas individualmente.
7. **Posesión, control reglamentario, secuencia de ataque y lanzamiento son conceptos distintos.** Un rebote ofensivo puede añadir otro lanzamiento sin añadir otra posesión estadística. [R04](#r04--fiba-statisticians-manual-2024)
8. **No existe un único reglamento universitario.** En este estudio «universitario» significa NCAA; se distinguen sus categorías masculina y femenina. NAIA, NJCAA, ligas universitarias nacionales, 3x3 y baloncesto en silla de ruedas quedan fuera.
9. **Las diferencias reglamentarias son estructurales.** Un reloj de 30 segundos, una defensa de tres segundos o un bonus de uno más uno cambian las decisiones disponibles; no se resuelven multiplicando un resultado por un «factor de liga».
10. **Las estadísticas observadas no identifican automáticamente capacidades.** Un jugador puede tirar mejor porque selecciona más, perder más balones porque crea más o taponar menos porque disuade mejor. [E02](#e02--franks-miller-bornn-y-goldsberry-2015)
11. **La evidencia científica ayuda a elegir mecanismos; rara vez entrega coeficientes listos para un videojuego.** Las poblaciones, tareas experimentales y temporadas importan.
12. **El realismo debe comprobarse en tres niveles:** legalidad de cada transición, plausibilidad de cada posesión y distribución estadística de muchos partidos. Ninguno sustituye a los otros dos.

## Qué tipo de investigación se ha realizado

Revisión documental amplia y crítica, con búsqueda dirigida en reglamentos oficiales, manuales estadísticos, publicaciones originales, repositorios de autores, portales de formación federativa, análisis tácticos oficiales y actas con jugada a jugada. Se han buscado también resultados que limitan explicaciones intuitivas: sesgo de selección en rachas, confusión entre distancia y calidad de tiro, y coste del rebote ofensivo sobre el balance defensivo.

No es una revisión sistemática registrada, ni un metaanálisis, ni una nueva base de datos de tracking. No se ha realizado un visionado íntegro y etiquetado independiente de todos los partidos enlazados. El capítulo 10 diferencia actas examinadas, análisis escritos consultados y vídeos propuestos para revisión. Los artículos cuyo acceso solo permitió el resumen están identificados.

**Criterios de inclusión:** relación directa con decisiones, ejecución, interacción, reglas o medición del partido; procedencia verificable; mecanismo trasladable al análisis. Se prioriza fuente original sobre resúmenes periodísticos. Un estudio antiguo puede explicar un mecanismo sin representar la frecuencia del juego actual.

**Criterios de cautela:** muestras pequeñas; un solo equipo; extrapolación entre sexos, edades o niveles; métricas de «éxito» incompatibles; correlaciones tratadas como causalidad; fórmulas sin validación externa; datos propietarios no reproducibles.

## Cómo interpretar el grado de certeza

| Categoría | Qué permite afirmar | Qué no permite afirmar |
|---|---|---|
| Reglamento oficial versionado | Legalidad y administración en ese contexto | Que todas las competiciones aplican la misma versión |
| Experimento controlado | Efecto bajo las condiciones del experimento | Magnitud idéntica en una final NBA |
| Estudio observacional de partidos | Patrones y asociaciones en la muestra | Qué habría sucedido al imponer otra táctica |
| Modelo matemático | Consecuencias lógicas de sus supuestos | Que sus supuestos describen por completo el baloncesto |
| Clínica de entrenador | Conocimiento práctico y formas de organizar decisiones | Superioridad universal cuantificada |
| Propuesta de simulación | Una hipótesis explícita y comprobable | Una ley deportiva demostrada |

## Qué significa aquí «exhaustivo»

Cubrir de forma sistemática las familias de sucesos, decisiones, interacciones, capacidades y excepciones relevantes para un motor. No significa prometer cada variante nominal utilizada por cada entrenador, cada interpretación arbitral publicada o una fórmula «perfecta» ya demostrada.

El documento permite discutir un motor coherente sin decidir todavía su escala de atributos, interfaz táctica o coeficientes. La consecuencia práctica es clara: **primero acordar qué debe poder pasar y por qué; después construir y contrastar una representación mínima de esas relaciones**.

## Límites que no conviene ocultar

La investigación publicada y el tracking abierto están sesgados hacia NBA masculina y muestras de alto nivel. La evidencia sobre comunicación, anticipación colectiva, liderazgo en pista y adaptación durante un partido es más difícil de convertir en parámetros identificables. Las reglas pueden verificarse con precisión; la supuesta penalización exacta de una mala decisión, no. Donde falta evidencia se propone una hipótesis para validar, no una cifra inventada.

---

# 01 — Reglamentos y ecosistemas

## 1.1 Versiones: una fecha cambia el modelo

**Corte: 25-09-2026.** Se contrastan FIBA 2024, el reglamento FIBA 2026 ya publicado y aplicable desde el **1-10-2026**, NBA 2025-26 y documentación NCAA 2025-26/2026-27. No se presenta la edición NBA 2025-26 como garantía de todos los ajustes de una temporada futura. [R01](#r01--fiba-official-basketball-rules-2024), [R02](#r02--fiba-official-basketball-rules-2026), [R03](#r03--fiba-cambios-y-entrada-en-vigor-de-2026), [R05](#r05--nba-official-202526-playing-rules), [R15](#r15--ncaa-major-rules-differences-202526), [R16](#r16--ncaa-mens-basketball-case-book), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627), [R18](#r18--ncaa-womens-basketball-rules-book)

Una competición debe identificar organismo, edición, categoría y modificaciones propias. «Europa» no es un reglamento; «NBA-like» no obliga a copiar marcas, franquicias o contratos. Tampoco el reglamento de pista determina por sí mismo elegibilidad universitaria, draft, topes salariales o ascensos: son sistemas de competición diferentes, fuera del núcleo de esta investigación.

## 1.2 Matriz de diferencias con impacto inmediato

| Aspecto | FIBA 2024 / base 2026 | NBA 2025-26 | NCAA masculina | NCAA femenina |
|---|---|---|---|---|
| Tiempo ordinario | 4 × 10 min | 4 × 12 min | 2 × 20 min | 4 × 10 min |
| Prórroga ordinaria | 5 min | 5 min | 5 min | 5 min |
| Reloj de lanzamiento inicial | 24 s | 24 s | 30 s | 30 s |
| Tras rebote ofensivo de tiro que toca aro | 14 s | 14 s | 20 s | 20 s |
| Paso a campo delantero | 8 s | 8 s | 10 s | 10 s |
| Límite ordinario de faltas de jugador | 5 | 6 | 5 | 5 |
| Bonus por faltas comunes defensivas | Desde la 5.ª del cuarto: 2 TL | Desde la 5.ª del cuarto; reglas especiales al final | 7.ª–9.ª de la mitad: 1+1; desde 10.ª: 2 TL | Desde la 5.ª del cuarto: 2 TL |
| Acumulación en prórroga | Continúa la del 4.º cuarto | Nueva cuota de prórroga: 4.ª; excepción últimos 2 min | Continúa la de la 2.ª mitad | Continúa la del 4.º cuarto |
| Tres segundos defensivos | No | Sí, con condiciones y excepciones | No | No |
| Balón retenido | Alternancia, salvo situaciones de salto previstas | Salto entre dos | Alternancia | Alternancia |
| Dimensiones principales | 28 × 15 m; arco triple 6,75 m | 94 × 50 pies; arco 23 pies 9 pulgadas, esquinas 22 pies | 94 × 50 pies; arco 22 pies 1¾ pulgadas | Igual arco y pista que NCAA masculina |

Fuentes de la matriz: FIBA [R01](#r01--fiba-official-basketball-rules-2024), [R02](#r02--fiba-official-basketball-rules-2026); NBA [R05](#r05--nba-official-202526-playing-rules), [R06](#r06--nba-rule-7-shot-clock), [R07](#r07--nba-rule-12-fouls-and-penalties), [R08](#r08--nba-rule-10-violations-and-penalties); comparación y manuales NCAA [R15](#r15--ncaa-major-rules-differences-202526), [R16](#r16--ncaa-mens-basketball-case-book), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627), [R18](#r18--ncaa-womens-basketball-rules-book). «Bonus» no transforma automáticamente una falta de control de equipo en tiros libres. Los resets tienen condiciones: no todo rebote, toque o interrupción reinicia el reloj.

**Impacto — síntesis:** más tiempo disponible permite otro intento de organización, pero no obliga a jugar lento. Un pívot sin tres segundos defensivos puede permanecer más tiempo cerca del aro, aunque siga debiendo resolver ayudas y tiradores. El 1+1 universitario hace que fallar el primer libre cambie la continuación de la secuencia. Una cuota distinta de faltas modifica agresividad, rotaciones y estrategias de final.

## 1.3 El cambio FIBA 2026 que no debemos mezclar con 2024

La revisión sustituye la antigua agrupación de antideportivas por categorías **disruptive** y **flagrant**, con distintas consecuencias para la acumulación que provoca descalificación; introduce también categorías de técnicas. Distingue mejor interrupción táctica y conducta de mayor gravedad. Debe leerse con sus criterios y penalizaciones específicos, no traducirse automáticamente a las categorías NBA de nombre parecido. [R02](#r02--fiba-official-basketball-rules-2026), [R03](#r03--fiba-cambios-y-entrada-en-vigor-de-2026)

**Propuesta:** un evento conserva hechos observados —contacto, intención de jugar el balón, transición, severidad, localización, momento— y un adjudicador aplica la edición elegida. Evitar guardar únicamente `esAntideportiva: true`: perdería información y bloquearía la convivencia de versiones.

La regla de continuidad del acto de tiro y sus aclaraciones también importan: recibir una falta cuando se inicia la acción no es equivalente a recibirla antes. NCAA masculina modificó este ámbito para 2025-26/2026-27. Es necesario distinguir hecho, interpretación y sanción. [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627)

## 1.4 Relojes: cinco problemas diferentes

1. **Reloj de partido:** no coincide siempre con el de posesión; puede haber balón vivo y reloj detenido.
2. **Reloj de lanzamiento:** empieza, continúa, se apaga o reinicia según causa, zona y equipo con derecho al balón.
3. **Cuenta de campo trasero:** no equivale a restar ocho o diez segundos desde cualquier recuperación aparente.
4. **Cuentas locales:** saque, libre, permanencia en zona, jugador estrechamente marcado o reglas de bote aplicables.
5. **Tiempo físico de las acciones:** un pase consume vuelo; una recepción necesita control; las acciones simultáneas no suman todas sus duraciones.

NBA detalla el reset de 14 tras recuperar un tiro al aro y otros supuestos de saque delantero; un desvío fuera por la defensa no concede por sí solo un reloj completo. El simple toque del aro tampoco justifica un reset si el hecho no cumple los criterios normativos. [R06](#r06--nba-rule-7-shot-clock)

**Caso de frontera:** un tiro sale antes de la bocina y sigue en vuelo. No se debe finalizar irrevocablemente el período y borrar la posibilidad de canasta, interferencia o sanción pendiente.

## 1.5 Faltas: primero clasificar, después administrar

Separar: autor, equipo, estado del balón, existencia de control, acto de tiro, conversión del tiro, lugar, gravedad, acumulación personal/colectiva y posibles sanciones simultáneas.

| Familia | Pregunta decisiva para la continuación |
|---|---|
| Defensiva no de tiro | ¿Saque o bonus? ¿Dónde y con qué reloj? |
| Defensiva de tiro | ¿Canasta válida más un libre, dos o tres libres? |
| De control de equipo / ofensiva | ¿Pérdida del derecho al balón sin aplicar bonus ordinario? |
| Sobre balón suelto | ¿Quién tenía control jurídico? No deducirlo solo de «nadie lo agarra». |
| Técnica / administrativa | ¿Quién lanza? ¿Cuenta para exclusión? ¿Se conserva la reanudación anterior? |
| Especial de transición / camino libre | ¿Se cumplen todos los criterios del reglamento concreto? |
| Grave / descalificante | ¿Libres, posesión y exclusión? ¿Qué acumulación corresponde? |
| Doble / simultánea / sanciones compensables | ¿Qué se cancela y qué queda pendiente? |

NBA contiene excepciones específicas de final de período, faltas fuera del balón y transición. No vale «hacer falta = dos libres» ni «toda falta táctica = la misma sanción». [R07](#r07--nba-rule-12-fouls-and-penalties)

**Consecuencia táctica:** una defensa en bonus tiene otro coste esperado al contener una penetración. Eso no significa que todos sus jugadores se vuelvan mágicamente peores: pueden cambiar distancia, manos, verticalidad o tolerancia al tiro.

## 1.6 Interferencias, tiempos muertos y revisión

FIBA y NBA no tratan de forma idéntica el balón en torno al cilindro después de tocar aro. En NBA existen restricciones de interferencia sobre el aro/cilindro; no deben copiarse al resto mediante una única bandera «tapón legal». [R01](#r01--fiba-official-basketball-rules-2024), [R12](#r12--nba-rule-11-basket-interference--goaltending)

En NBA hay siete tiempos muertos ordinarios por equipo, límites de utilización tardía y dos por prórroga. Que un equipo tenga tiempos muertos disponibles no implica que pueda concedérsele uno en cualquier instante. FIBA utiliza oportunidades de tiempo muerto concedidas mediante la mesa; el entrenador no detiene a voluntad un ataque vivo propio. NCAA tiene además variantes de administración vinculadas al formato de retransmisión. [R09](#r09--nba-rule-5-scoring-and-timing), [R01](#r01--fiba-official-basketball-rules-2024), [R15](#r15--ncaa-major-rules-differences-202526), [R16](#r16--ncaa-mens-basketball-case-book), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627), [R18](#r18--ncaa-womens-basketball-rules-book)

La revisión puede cambiar un hecho adjudicado y sus consecuencias: posesión, reloj, valor del tiro, falta. El *challenge* no es una repetición libre de cualquier jugada. Sus categorías y requisitos deben pertenecer al reglamento versionado. [R13](#r13--nba-rule-14-coachs-challenge), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627)

**Propuesta:** para el primer laboratorio puede haber arbitraje correcto sin simular errores humanos. Pero la separación entre evento físico y decisión arbitral permite añadir revisiones más adelante sin reescribir las acciones.

## 1.7 Casos poco frecuentes que hay que contemplar

- Balón encajado entre aro y tablero: situación de salto, no rebote entregado al azar.
- Saque sin receptor disponible; cinco segundos; infracción de línea; toque antes de entrar; balón que entra directamente en canasta desde saque.
- Doble infracción de libre; invasión con acierto o fallo; libre que no toca aro; último libre fallado deliberadamente.
- Canasta propia accidental; lanzamiento deliberado a canasta propia; balón que entra desde abajo.
- Expiración de reloj con tiro en vuelo, airball recuperado y contacto con aro no reconocido.
- Falta seguida de técnica; sanciones de varios jugadores; descalificación que deja insuficientes participantes.
- Sustitución no autorizada, número incorrecto de jugadores, sangre/lesión, interrupción por equipamiento.
- Error corregible: orden de lanzadores, puntuación, reloj o administración; no todos los errores son corregibles indefinidamente.
- Partidos abandonados, pérdida por incomparecencia y reglas de elegibilidad: tratamiento distinto a una derrota deportiva normal.
- FIBA contempla particularidades de eliminatorias a doble partido por tanteo agregado: no codificar «todo encuentro siempre termina sin empate» como ley universal. [R02](#r02--fiba-official-basketball-rules-2026)

Este inventario identifica familias; las decisiones exactas exigen las interpretaciones y casos oficiales de la versión elegida. El catálogo no pretende sustituir un manual arbitral completo. [R14](#r14--fiba-official-basketball-rules-interpretations-2024), [R16](#r16--ncaa-mens-basketball-case-book)

## 1.8 Separación necesaria para países ficticios

**Reglas de pista** gobiernan este partido. **Formato de competición** gobierna calendario, clasificación y eliminatorias. **Reglas laborales/de plantilla** gobiernan inscripción, contratos y movimientos. **Población deportiva** gobierna distribución de capacidades, estilos y desarrollo.

Un país nuevo debería reutilizar componentes de esos cuatro ámbitos sin duplicar el motor. Dos ligas con reglas de pista idénticas pueden producir partidos diferentes por sus jugadores, entrenadores e incentivos. Esto es una conclusión arquitectónica, no una invitación a implementar ahora contratos NCAA o límites salariales NBA.

---

# 02 — Anatomía de la posesión

## 2.1 Cuatro unidades que no deben confundirse

**Control reglamentario:** concepto jurídico utilizado para resolver faltas, violaciones y relojes. Puede cesar durante un lanzamiento sin que el ataque estadístico haya terminado.

**Posesión estadística:** oportunidad de un equipo de producir puntos antes de que el rival obtenga la siguiente. El rebote ofensivo normalmente continúa esa oportunidad. Las convenciones del proveedor pueden diferir en posesiones mínimas, cierres de período y secuencias especiales. [R04](#r04--fiba-statisticians-manual-2024)

**Fase de ataque:** transición, organización, primera acción, continuación, segunda oportunidad o emergencia de reloj. Una posesión puede atravesar varias.

**Acción:** pase, corte, bloqueo, penetración, ayuda, lanzamiento, etc. Varias acciones ocurren a la vez. Contar solo al jugador con balón elimina buena parte de la causalidad.

**Propuesta de vocabulario interno:** usar `posesión`, `fase`, `acción`, `evento` y `sanción` con significados estables. Una técnica que concede un libre al rival no debe obligar a fingir un ataque completo de ese rival ni a destruir el estado de reanudación.

## 2.2 Qué debe saberse al comenzar una fase

| Dimensión | Estado necesario | Por qué cambia la siguiente decisión |
|---|---|---|
| Partido | Período, marcador, reloj, posesiones potenciales restantes | Buscar tres, agotar tiempo o anotar pronto no son objetivos equivalentes |
| Normativa | Versión, bonus, faltas, alternancia, tiempos muertos | Define opciones legales y costes |
| Balón | Posición, altura si importa, poseedor, velocidad, vivo/muerto | Distingue pase accesible, balón suelto y tiro en vuelo |
| Diez jugadores | Ubicación, orientación, movimiento, equilibrio | Determina separaciones, líneas de pase y tiempos de llegada |
| Relaciones | Emparejamientos, ayudas, bloqueos y marcas temporales | El defensor más cercano no siempre es el responsable |
| Capacidades y estados | Habilidades, fatiga, faltas, disponibilidad | Una intención puede no ser ejecutable |
| Plan | Acción, opciones, ritmo, reglas defensivas | Restringe o prioriza decisiones sin garantizar resultados |
| Información | Qué ve/anticipa cada participante | Impide una inteligencia artificial omnisciente |

No todo necesita una coordenada con precisión milimétrica; sí necesita una representación suficiente para distinguir situaciones que producen decisiones diferentes.

## 2.3 Catálogo operativo de sucesos

Las siguientes familias forman una **taxonomía de investigación**, no una lista de eventos de software ya aprobada. Las variantes se combinan; no deben sortearse como resultados independientes.

### Inicio, recuperación y avance

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P01 | Salto inicial o salto autorizado; toque dirigido o dividido | Control, segunda disputa, violación de saltador; alcance, timing, anticipación |
| P02 | Saque tras canasta | Recepción segura, presión, pase largo, retraso; organización y lectura |
| P03 | Saque lateral/fondo tras interrupción | Diseño de desmarques, negación, cambio defensivo, violación; ejecución sin reloj de juego corriendo hasta el toque correspondiente |
| P04 | Rebote defensivo asegurado | Proteger balón, girar, bote de salida o primer pase; presión inmediata posible |
| P05 | Intercepción de pase | Control limpio, desvío sin control, salida de límites, choque o falta |
| P06 | Robo sobre bote o recepción | Mano legal, balón suelto, falta o recuperación del propio atacante |
| P07 | Recuperación de balón dividido | Agarrar, palmear, salvar hacia compañero, posesión alterna/salto |
| P08 | Avance por bote | Cambio de velocidad, mano, dirección, detención; contención o pérdida |
| P09 | Avance por pase | Outlet, pase adelantado, diagonal; valor de ganar terreno frente a riesgo de interceptación |
| P10 | Superioridad transitoria | 1×0, 2×1, 3×2, 4×3; también igualdad numérica con defensores mal orientados |
| P11 | Ataque temprano sin superioridad | Drag, sello interior, triple de llegada o inversión; rival todavía organizándose |
| P12 | Renuncia a correr | Proteger posesión, esperar apoyos, consumir tiempo; puede perderse una oportunidad real |

### Preparación e interacción sin balón

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P13 | Recepción | Limpia, fuera de bolsillo, en carrera, de espaldas, bobble; afecta el tiempo hasta la siguiente acción |
| P14 | Parada y pivote | Un tiempo/dos tiempos, apertura, protección; equilibrio y legalidad de apoyos |
| P15 | Amenaza triple | Finta de tiro/pase/salida, jab, cambio de ritmo; reacción o inmovilidad defensiva |
| P16 | Pase de continuidad | Inversión, mano a mano, pase de seguridad; conserva, mejora o empeora la ventaja |
| P17 | Pase que rompe una línea | Pocket, lob, skip, pase a corte; ventana, velocidad, precisión y engaño |
| P18 | Corte | Puerta atrás, frontal, diagonal, rizo, corte por línea de fondo; recepción o arrastre de ayuda |
| P19 | Reubicación | Subir, hundirse, intercambiar esquina/ala, llenar posición libre; crea una nueva línea de pase |
| P20 | Bloqueo sin balón | Contacto legal, deslizamiento, rechazo, cambio de ángulo; obliga a perseguir, cambiar o negar |
| P21 | Bloqueo directo | Se establece, se roza, se rechaza o se abandona; coordina a manejador y bloqueador |
| P22 | Continuación del bloqueador | Roll, short roll, pop, slip, sello; no todas requieren contacto previo |
| P23 | Sello / ganar posición | Poste, rebote, impedir ayuda; fuerza útil, base, ángulo y anticipación |
| P24 | Negación ofensiva fallida | No llega pase interior, bloqueo no conecta, corte llega tarde; reorganizar, improvisar o apurar reloj |

### Defensa y cambio de ventaja

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P25 | Contención del balón | Mantener pecho, orientar, ceder distancia, presión; primer paso contra desplazamiento y frenada |
| P26 | Superación parcial | Hombro ganado, defensor en cadera/espalda; todavía puede haber recuperación o ayuda |
| P27 | Navegación de bloqueo | Pasar por arriba, debajo, engancharse, perseguir; técnica y espacio |
| P28 | Cobertura del interior | Drop, nivel, show, blitz, cambio; modifica trayectorias y zonas concedidas |
| P29 | Ayuda breve | Stunt, mano en línea, amago y vuelta; puede disuadir sin abandonar completamente |
| P30 | Ayuda comprometida | Parar penetración, tag al roll, doble al poste; deja otra responsabilidad descubierta |
| P31 | Rotación | X-out, reemplazo, ayuda a la ayuda; cadena de llegadas y comunicación |
| P32 | Cambio de emparejamiento | Switch, pre-switch, scram o peel; conserva estructura o crea desajuste |
| P33 | Recuperación y closeout | Corto/largo, controlado/fuera de balance; tiro, penetración o pase extra |
| P34 | Desvío sin pérdida | Rompe timing, desvía pase, obliga a recoger balón; puede no figurar en estadística tradicional |
| P35 | Error de coordinación | Dos al balón, corte sin seguimiento, ayuda tardía, comunicación contradictoria |
| P36 | Neutralización | Defensa recupera equilibrio; el ataque necesita otra acción, no un desenlace forzado |

### Creación individual y lanzamiento

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P37 | Penetración | Recta, cambio de mano, giro, snake, rechazo de bloqueo; busca aro, ayuda o falta |
| P38 | Juego de poste | Gancho, giro, drop step, face-up, fade, up-and-under; ayuda puede cancelar el tiro |
| P39 | Preparación del tiro | Catch-and-shoot, pull-up, step-back, turnaround; pies, manos y tiempo disponible |
| P40 | Finalización cercana | Bandeja, extensión, reverso, floater, gancho corto, mate; mano y ángulo importan |
| P41 | Lanzamiento exterior | Distancia, zona, recepción/bote, balance y oposición; no solo «2 o 3 puntos» |
| P42 | Tiro alterado antes de soltar | Cambio de arco, retraso, pase de escape o intento forzado |
| P43 | Tapón | Limpio, balón aún recuperable, fuera o control rival; tapón no equivale a rebote |
| P44 | Trayectoria del tiro | Canasta, aro, tablero, airball; puede concurrir una falta o infracción |
| P45 | Interferencia | Ofensiva/defensiva; balón descendente, aro/cilindro o tablero; depende de reglas |
| P46 | Abortar tiro | Pase en salto, caída con balón, pérdida o balón dividido; decisión puede llegar demasiado tarde |

### Rebote y continuación

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P47 | Preparación del rebote | Leer trayectoria, contactar, bloquear camino, anticipar bote; sucede antes del fallo |
| P48 | Disputa aérea | Agarrar, palmeo, rebote largo, contacto, segunda elevación |
| P49 | Rebote ofensivo controlado | Finalizar, sacar fuera o reorganizar; continúa posesión y puede reiniciar reloj |
| P50 | Palmeo a canasta | Intento de tiro sin agarre completo; no confundir todos los toques con rebote controlado |
| P51 | Rebote de equipo / balón fuera | Asignación estadística y derecho al saque no siempre son un rebote individual |
| P52 | Rebote disputado sin control | Nuevos contactos, salida, falta, salto; no adjudicarlo al más alto automáticamente |
| P53 | Balance defensivo tras tiro | Jugadores cargan, esperan o retroceden; estado inicial del siguiente ataque |

### Faltas, infracciones e interrupciones

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P54 | Falta sobre tiro | Fallo con libres; canasta válida y adicional; distinción de acto de tiro |
| P55 | Falta no de tiro | Saque o bonus; posible intención táctica sin sanción universal |
| P56 | Falta ofensiva | Carga, bloqueo ilegal, empujón, enganche; incluye acciones lejos del balón |
| P57 | Falta de rebote / balón suelto | Situación de control y bonus; no inferir sanción por nombre coloquial |
| P58 | Técnica o conducta especial | Libres, reanudación, acumulación y posible exclusión según categoría |
| P59 | Infracción de manejo | Pasos, doble bote, acompañamiento; apoyos, control y finalización del bote |
| P60 | Infracción temporal | Reloj de lanzamiento, campo trasero, saque, zona o cuenta local |
| P61 | Fuera / campo atrás / pie intencional | Último toque, control anterior, intención y punto de reanudación |
| P62 | Balón retenido o encajado | Alternancia o salto; actualización de flecha si procede |
| P63 | Tiempo muerto | Solicitud, concesión, consumo, instrucciones y reanudación legal |
| P64 | Sustitución | Ventana legal, jugador excluido/lesionado, nuevo emparejamiento |
| P65 | Lesión o sangre | Interrupción inmediata si seguridad lo requiere; sustitución y reinicio |
| P66 | Revisión / corrección | Mantener o cambiar adjudicación; ajustar consecuencias dependientes |
| P67 | Bocina / fin de partido | Resolver tiro en vuelo y sanciones pendientes antes de cerrar |

### Tiros libres y situaciones extremas

| ID | Suceso y variantes | Continuaciones y factores decisivos |
|---|---|---|
| P68 | Libre intermedio | Acierto/fallo; normalmente sin disputa viva de rebote |
| P69 | Último libre vivo | Canasta y saque, fallo y disputa; error si se entrega siempre al rival |
| P70 | Primer libre de 1+1 | Su acierto habilita el segundo; fallo permite continuación reglamentaria |
| P71 | Libre con posesión retenida | No se trata como final normal de ataque tras el lanzamiento |
| P72 | Invasión / infracción de lanzador | Repetición, anulación u otra continuación; importa quién y qué resultado |
| P73 | Fallo deliberado de libre | Debe ejecutarse legalmente; rebote y reloj resultan críticos |
| P74 | Sanciones múltiples | Ordenar, compensar cuando procede y conservar punto de interrupción |
| P75 | Canasta propia / saque a canasta / balón por debajo | Resolver mediante adjudicación especial, no por tiro ordinario |
| P76 | Insuficiencia de jugadores / abandono / incomparecencia | Salida administrativa del encuentro, distinta del ciclo normal |

Anclaje normativo de las familias legales: [R01](#r01--fiba-official-basketball-rules-2024), [R02](#r02--fiba-official-basketball-rules-2026), [R03](#r03--fiba-cambios-y-entrada-en-vigor-de-2026), [R05](#r05--nba-official-202526-playing-rules), [R06](#r06--nba-rule-7-shot-clock), [R07](#r07--nba-rule-12-fouls-and-penalties), [R08](#r08--nba-rule-10-violations-and-penalties), [R09](#r09--nba-rule-5-scoring-and-timing), [R10](#r10--nba-rule-6-putting-ball-in-play--livedead-ball), [R11](#r11--nba-rule-9-free-throws-and-penalties), [R12](#r12--nba-rule-11-basket-interference--goaltending), [R13](#r13--nba-rule-14-coachs-challenge), [R14](#r14--fiba-official-basketball-rules-interpretations-2024), [R15](#r15--ncaa-major-rules-differences-202526), [R16](#r16--ncaa-mens-basketball-case-book), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627), [R18](#r18--ncaa-womens-basketball-rules-book). Las explicaciones de percepción, ejecución y táctica son síntesis, no definiciones extraídas de los reglamentos.

## 2.4 Qué significa «desde lo más frecuente hasta lo ínfimo»

**Núcleo de alta exposición:** recibir, botar, pasar, ocupar espacio, contener, ayudar, lanzar y recuperar. Un buen motor debe acertar primero en estos mecanismos porque se repiten constantemente, incluso sin evento visible en el acta.

**Sucesos situacionales:** coberturas específicas, dobles, saques diseñados, fallos de recepción, trampas, bloqueos ilegales, finales de reloj, cambios de emparejamiento, faltas buscadas y secuencias de libres.

**Sucesos de cola:** balones encajados, violaciones simultáneas, revisión que cambia posesión y reloj, canasta propia, expulsiones múltiples o correcciones administrativas. Raros no significa imposibles. Su frecuencia debe surgir de circunstancias y decisiones o de una tasa documentada; no inventarse para «dar variedad».

**No confundir rareza de aparición con gravedad de un error:** un quinto jugador expulsado puede no aparecer durante cientos de simulaciones, pero el estado debe poder resolverse sin bloqueo.

## 2.5 Contabilidad: el relato y el acta son dos vistas

Un contacto puede crear una falta sin intento de campo fallado; una pérdida puede no incluir robo; un tapón no garantiza cambio de posesión; una asistencia no es cualquier pase anterior a una canasta. NCAA incluso contempla atribuir asistencia a un pase principal que no sea necesariamente el último en casos concretos: codificar «siempre último pasador» no reproduce su manual. [R19](#r19--ncaa-official-basketball-statistics-rules-202526)

**Propuesta:** guardar eventos causales y derivar el acta mediante una política estadística versionada. Guardar, por separado, métricas analíticas como pase que crea ventaja, bloqueo útil, ayuda disuasoria o error de rotación. No inflar la estadística oficial para premiar esas aportaciones.

Una posesión no está limitada a cuatro puntos: sanciones especiales y posesión conservada pueden producir secuencias más extensas. Debe existir también la posesión que termina sin tiro por pérdida o bocina.

## 2.6 La causalidad no termina con la canasta

Un intento cambia el estado siguiente. El tirador puede caer en línea de fondo; dos compañeros pueden quedar bajo el aro tras cargar el rebote; el defensor que captura puede lanzar un pase adelantado antes de que vuelvan. Reiniciar a los diez jugadores en posiciones neutrales tras cada desenlace borraría el coste del estilo anterior.

Este es uno de los motivos por los que el partido no debe generarse como una colección de posesiones independientes.

---

# 03 — Ataque: principios, estilos y familias tácticas

## 3.1 Una gramática, no un catálogo cerrado de jugadas

**Síntesis táctica propia.** Los nombres varían entre entrenadores. «Horns» suele describir una disposición; «Spain» una combinación; «motion» una organización de lecturas; «ritmo alto» una preferencia temporal. No son opciones del mismo nivel ni mutuamente excluyentes.

Una descripción completa necesita: **disposición inicial + objetivo + acción desencadenante + lecturas + ocupación del lado débil + respuesta a la cobertura + regla de continuidad + balance tras tiro**. El material de formación para estudiar estas familias se recoge en 10; los efectos siguientes son condicionales, no coeficientes demostrados.

## 3.2 Las seis ventajas que busca un ataque

| Ventaja | Ejemplo | Por qué puede desaparecer |
|---|---|---|
| Espacial | Carril libre, esquina desocupada, defensor lejos | Mala ocupación o pase tardío |
| Temporal | Tirador recibe antes de llegar el closeout | Recepción defectuosa o preparación lenta |
| Numérica | Dos defensores al balón, cuatro contra tres detrás | Pase interceptado o recuperación veloz |
| Corporal | Sello profundo, hombro por delante, defensor girado | Ayuda, cambio de ángulo o mal equilibrio |
| De capacidades | Interior defiende bote lejos del aro | Ayuda preparada o atacante incapaz de explotar |
| Informativa | Finta, corte ciego, cobertura mal comunicada | Reconocimiento temprano y coordinación |

**Conservar ventaja** no equivale a pasar siempre: una penetración puede sostenerla mejor que un pase lento. **Mover el balón** tampoco equivale a mover la defensa si ningún receptor amenaza.

## 3.3 Estilos generales y sus costes

| Estilo / prioridad | Mecanismo perseguido | Requisitos | Coste o vulnerabilidad |
|---|---|---|---|
| Transición agresiva | Atacar antes de que se asignen marcas | Rebote, salida, carrera, lectura | Pérdidas y mala selección si se fuerza sin ventaja |
| Ataque temprano | Primera acción antes de defensa organizada | Entrada simple, bloqueador que llega y spacing | Preparación incompleta y falta de balance |
| Juego de control | Elegir emparejamientos y limitar errores | Organización y creación con poco reloj | Menos oportunidades y tiros de emergencia |
| Movimiento continuo | Encadenar cortes, pases y bloqueos | Lectura colectiva y timing | Interferencias entre compañeros si falta coordinación |
| Creador central | Concentrar decisiones en quien genera ventaja | Manejo, tiro/pase y apoyos complementarios | Fatiga, negación y dependencia de una sola salida |
| Ataque interior | Recepción profunda, faltas, pases ante ayudas | Sello, entrada, finalización y spacing | Robos en entrada, dobles y ocupación de pintura |
| Volumen exterior | Convertir ventajas en triples | Amenaza real y generación de tiros | Varianza y vulnerabilidad si solo hay tiros difíciles |
| Rebote ofensivo prioritario | Repetir oportunidades | Posición, lectura, contactos, roles de carga | Menor protección frente a transición |
| Juego sin posiciones rígidas | Intercambiar funciones y explotar cambios | Capacidades compartidas | Puede faltar protección de aro o ventaja física concreta |
| Ataque muy pautado / libre | Predecir dónde estarán apoyos / adaptarse | Memoria compartida / lectura individual | Rigidez frente a negación / decisiones incompatibles |

Estos ejes se combinan. No existe una ley «juego europeo = lento y colectivo» ni «NBA = aislamiento»: sería confundir un estereotipo cultural con restricciones y capacidades.

## 3.4 Disposiciones y espacios

| Familia | Utilidad | Condición que suele olvidarse |
|---|---|---|
| 5-out | Abrir cortes y conducciones, alejar ayudas | Estar fuera no crea gravedad si no se amenaza con tiro, corte o handoff |
| 4-out / 1-in | Un interior finaliza, sella o bloquea | Su ubicación no debe cerrar el camino del penetrador |
| 3-out / 2-in | Alto-bajo, rebote, bloqueos entre interiores | Dos interiores no tiradores pueden facilitar ayudas |
| Horns | Dos apoyos altos, entrada a ambos lados, opciones de bloqueo/corte | La ventaja depende de la secuencia, no de dibujar dos jugadores en codos |
| 1-4 alto / bajo | Abrir una entrada, un corte o un pasillo central | Si la defensa niega la primera opción hace falta salida |
| Box / stack / diamond | Desmarques en saques y cambios de dirección | Bloqueos legales, temporización y opción de seguridad |
| Empty side | Retirar ayuda cercana del lado del balón | Quedan ayudas desde lado débil y riesgo de encierro junto a banda |
| Spread con dunker spot | Espaciar exteriores y disponer finalizador bajo | El interior necesita moverse según balón y protector del aro |
| Sobrecarga | Acumular amenazas en un sector, útil contra zonas | La congestión también puede ayudar a la defensa |

## 3.5 Pick-and-roll: árbol de decisiones integrado

No se reduce al porcentaje del manejador y del continuador. Intervienen ángulo y contacto del bloqueo, perseguidor, cobertura del interior, tag del lado débil, esquinas, lectura y llegada del pase.

| Variante | Ventaja buscada | Respuesta ofensiva posible / riesgo |
|---|---|---|
| Central alto | Dos direcciones, más espacio para decidir | Pull-up, roll, pase a ayudas; exige amenaza del manejador |
| Lateral | Usar banda y ángulo para condicionar ayuda | Rechazar, cambiar ángulo, pocket; riesgo de ICE/trampa |
| Plano | Ocultar qué lado se utilizará | Leer pies del defensor; puede conectar menos si se ejecuta lejos |
| Step-up / angled | Atacar desde ángulo favorable junto a banda | Ajustar a orientación; contacto mal puesto puede ser inútil |
| Drag | Bloqueo del interior que llega en transición | Atacar defensa sin asignaciones; sincronización con carrera |
| Double drag | Dos bloqueadores consecutivos | Distintos rolls/pops, segunda decisión defensiva; más jugadores ocupan carril |
| Empty-corner / empty-side | Quitar ayuda inmediata del lado de acción | Roll o penetración; el fondo no es automáticamente libre |
| Re-screen / flip | Repetir cambiando orientación | Castigar under/ICE o mala recuperación; consume reloj |
| Reject | No utilizar el bloqueo anunciado | Castigar sobreorientación; necesita carril y lectura de ayuda |
| Snake | Cruzar hacia el centro tras el bloqueo | Mantener perseguidor detrás y fijar al interior; exige control y espacio |
| Mantener al perseguidor detrás | Frenar y usar cuerpo sin falta ofensiva | Crear tiempo para floater/pase; no inmuniza ante tapón por detrás |
| Roll profundo | Amenaza vertical y llegada al aro | Lob, pocket o sello; vulnerable al tag |
| Short roll | Recibir entre primera y segunda línea | Decidir 4×3: aro, esquina o pase extra; necesita lectura, no solo mate |
| Pop | Separar al bloqueador hacia tiro | Castigar interior hundido; pierde presencia inmediata de rebote/aro |
| Slip | Salir antes del contacto previsto | Castigar cambios anticipados o atención al balón; riesgo de pase prematuro |
| Ghost | Amagar bloqueo y abrirse sin fijar contacto | Generar duda/cambio innecesario; ineficaz si nadie respeta al falso bloqueador |
| Spain / stack PnR | Tercer atacante bloquea al defensor del roll y sale | Exige coordinación de tres; defensa puede cambiar/anticipar y negar pase |
| Ram | Bloqueo previo al jugador que irá a bloquear balón | Retrasar al defensor interior; requiere sincronizar dos acciones |
| Inverted PnR | Un exterior bloquea para un grande u otro creador | Forzar asignación incómoda; cambia quién sabe continuar y decidir |
| Veer / continuación a bloqueo indirecto | Bloqueador abandona roll para liberar un tirador | Explota atención sobre balón; no hay amenaza simultánea ilimitada |

**Lecturas comunes:** defender pasa debajo → valorar tiro o nuevo bloqueo; interior se hunde → espacio intermedio; dos al balón → salida antes del encierro; cambio → explotar ventaja real, sellar o continuar; tag al roll → buscar compañero liberado; ayudas llegan a tiempo → circular y reatacar.

No son automatismos. Un base mal tirador puede no castigar under; un short roller sin pase puede desperdiciar el 4×3; un pase a esquina puede llegar cuando la defensa ya recuperó. Los estudios de pick-and-roll refuerzan la necesidad de analizar secuencias y contexto, no solo la acción terminal. [E06](#e06--nunes-y-colaboradores-2022), [E07](#e07--marmarinos-apostolidis-kostopoulos-y-apostolidis-2016), [E08](#e08--amatria-iván-baragaño-losada-y-maneiro-2025)

## 3.6 Mano a mano y cadenas

| Acción | Funcionamiento | Coste / respuesta |
|---|---|---|
| DHO, mano a mano con bote | Entrega próxima que también interpone al portador | Negar receptor, pasar por debajo, cambiar o atrapar |
| Handoff estático | Recepción alrededor de pasador estable | Requiere proximidad y ángulo; peligro de bloqueo móvil |
| Keeper / fake handoff | Portador conserva ante sobreanticipación | Necesita capacidad para conducir y carril |
| Chicago / Zoom | Bloqueo indirecto seguido de mano a mano | Dos obstáculos; nombres y detalles varían entre playbooks |
| Pistol | Entrada lateral temprana con pase/handoff y opciones de bloqueo | Velocidad de coordinación, no un único tiro final |
| Delay | Interior/pasador alto organiza con compañeros abiertos | Cortes, DHO y cambios de lado; exige decisión desde codo/cabecera |
| Get / give-and-go | Pasar y buscar devolución o corte | Castiga relajación del defensor; requiere ventana disponible |

## 3.7 Bloqueos indirectos y cortes

| Familia | Qué pretende | Lecturas relevantes |
|---|---|---|
| Pindown, bloqueo descendente | Subir a recibir o tirar | Curl ante perseguidor; abrirse ante under; puerta atrás ante top-lock |
| Flare | Alejar del balón hacia un espacio de tiro | Pase por encima/diagonal; riesgo si trayectoria es larga |
| Back screen | Bloquear por espalda al defensor | Corte al aro o sello; anticipación defensiva y contacto legal |
| Cross screen | Llevar receptor de un lado bajo al otro | Recepción interior; defensa puede cambiar o negar entrada |
| Stagger | Dos bloqueos separados en la ruta | Elección de salida; segundos bloqueadores deben ajustar timing |
| Elevator | Pasar entre dos compañeros que cierran espacio legalmente | Ventana corta; riesgo de bloqueo ilegal |
| Hammer | Bloqueo del lado débil durante penetración hacia fondo | Pase a esquina; requiere que el pasador pueda ver/ejecutar |
| Screen-the-screener | Quien bloqueó recibe luego otro bloqueo | Castiga atención a primera acción; exige continuidad |
| Flex cut | Corte bajo mediante bloqueo desde lado contrario | Canasta o recepción; suele enlazar con siguiente bloqueo |
| Shuffle | Corte diagonal hacia poste/bajo aro | Sello y lectura de ayudas |
| Iverson | Cruce alto sobre bloqueos en codos | Entrada de sistema; la recepción no garantiza ventaja |
| UCLA cut | Pase a ala y corte usando bloqueo alto | Finalizar, postear o seguir estructura |
| Backdoor | Cortar detrás del defensor que niega | Pase preciso antes de ayuda; no cortar hacia carril ocupado |
| 45 cut / corte desde ala débil | Atacar espalda de ayuda desplazada | Temporización con penetrador y dunker spot |
| Baseline cut | Cruzar detrás de defensa por fondo | Ver al pasador y evitar permanecer ilegalmente en zona |
| Lift / drift / shake | Reubicarse hacia arriba, fondo o nueva ventana | Distanciarse de ayuda sin perder línea de pase |

El bloqueo puede ser útil sin tiro del receptor: basta con forzar un cambio, arrastrar una ayuda o abrir un sello. Premiar únicamente «bloqueo que termina en canasta» perdería ese trabajo.

## 3.8 Juego individual, poste y continuidad

**Aislamiento:** útil con ventaja de espacio, capacidades o faltas, y en reloj corto. Sus costes son la ayuda preparada, el tiempo consumido buscando un emparejamiento y la inmovilidad de apoyos. No debe tener una penalización moral por ser «poco colectivo».

**Poste bajo/medio/alto:** separar ganar posición, recibir, leer, ejecutar y salir del doble. Un buen poste puede crear sin lanzar. Variantes: duck-in, sello tras cambio, alto-bajo, split cuts alrededor del poste, face-up, repost tras invertir. Doblar siempre al poste puede regalar cortes o triples; no doblarlo puede conceder tiros profundos o faltas.

**Drive-and-kick:** penetrar para atraer y soltar. **Drive-kick-swing:** añadir pase extra antes de recuperación. **Penetración repetida:** atacar el segundo closeout, no repetir contra defensa intacta. El objetivo no es acumular pases sino transformar desplazamientos defensivos en tiempo útil.

**Familias de sistema:** motion 4-out/5-out, read-and-react, Princeton, triángulo, flex, shuffle, dribble-drive y continuidades de bloqueos. Sus versiones históricas difieren. Para el motor interesan reglas operativas: qué hace quien pasa, quién reemplaza, cuándo se corta, qué dispara bloqueo y cómo se resuelve la negación. No necesitan motores independientes.

## 3.9 Ataque a zona y presión

Contra zona: fijar dos defensores, atacar intervalos con bote o pase, usar poste alto y short corner, sobrecargar, invertir rápido, bloquear a un defensor zonal, cortar por su espalda y disputar el rebote desde zonas sin pareja asignada. **Lanzar triples** es una posible consecuencia, no la definición del ataque a zona. Un pase interior sin receptor capaz de girar y decidir puede no aportar nada.

Contra presión: ofrecer receptor y seguridad; usar centro cuando es accesible; invertir antes de la trampa; pasar por delante del balón; ocupar una diagonal larga; atacar con pase o bote según superioridad. Evitar bote automático hacia la esquina, recepción estática junto a banda y saltar sin salida. Superar la primera línea puede producir 3×2 o solo iniciar un ataque normal: depende de la recuperación rival.

## 3.10 Saques y finales

**BLOB** —saque de fondo— y **SLOB** —lateral— requieren opción principal, contralectura y pase de seguridad. Box, stack, diamond, zipper y salidas con pantalla son disposiciones/rutas, no canastas predeterminadas. El defensor del sacador también participa: puede negar aro, pase o primer receptor.

**ATO** —acción tras tiempo muerto— no merece un bonus universal. Puede mejorar coordinación y matchup, mientras el rival ajusta su defensa. **Dos por uno** busca dos oportunidades frente a una, con coste de calidad del primer tiro. **Último tiro** reduce respuesta rival, pero puede dejar sin rebote útil. **Buscar falta** depende del reglamento, bonus y habilidad; no concede una probabilidad fija de libres.

Cuando se pierde por tres, un triple inmediato no es siempre óptimo; cuando se gana, consumir reloj no equivale a dejar de atacar. La decisión depende de tiempo, posesión, rebote posible, faltas disponibles, lanzadores y probabilidades de victoria, no solo de puntos esperados.

## 3.11 Quintetos, roles y rotaciones como estrategia

| Elección | Qué puede aportar | Qué debe comprobarse |
|---|---|---|
| Small ball | Más manejo, movilidad o tiro si los perfiles lo permiten | Rebote, protección de aro y defensa del poste; ser bajo no garantiza tirar |
| Dos interiores | Sellos, alto-bajo, rebote y protección | Compatibilidad de espacios y defensa lejos del aro |
| Cinco amenazas de tiro | Alejar ayudas y abrir conducción | Creación real, rebote y capacidad de castigar una defensa que cambie |
| Un interior pasador | Organizar desde codo, DHO y short roll | Recepción, lectura y amenaza propia para obligar a defenderlo |
| Dos creadores | Alternar iniciadores y atacar segunda ventaja | Reparto de balón, juego sin balón y defensa de sus emparejamientos |
| Especialista defensivo no tirador | Resolver una amenaza rival | Usarlo como bloqueador, cortador o pasador para que no anule spacing |
| Quinteto de cierre | Capacidades adecuadas a marcador y tiempo | No necesariamente los cinco de mayor valoración global |

**Escalonar creadores** puede sostener organización mientras descansa una estrella; agruparlos puede maximizar un tramo a costa de otro. **Sustituir por ataque/defensa** depende de ventanas legales y no permite cambiar jugadores con balón vivo a voluntad. **Proteger a alguien de faltas** evita exclusión, pero tiene coste inmediato de calidad en pista.

La rotación debe considerar carga acumulada, esfuerzo reciente, emparejamiento, bonus, siguiente ventana de descanso y rendimiento de alternativas. No necesita adivinar lesiones ni fijar sustituciones exclusivamente por un umbral de energía.

**Timeout y adaptación:** detener una mala organización, instalar un saque, descansar o cambiar cobertura son objetivos distintos. El rival también puede anticipar. El efecto debe aparecer en instrucciones, recuperación y coordinación, no como una mejora automática por haber pulsado el botón.

**Scouting:** orientar a una mano, negar recepción a una amenaza, cambiar quién bloquea y ocultar un defensor débil son políticas sobre perfiles observados. Es útil permitir conocimiento incompleto: el equipo puede sobrevalorar o interpretar mal al rival, pero ese error debe ser consistente con su información, no aleatorio sin explicación.

---

# 04 — Defensa: negar, conceder y recuperar

## 4.1 Defender no es reducir un porcentaje global

**Síntesis táctica propia.** Una defensa puede impedir que ocurra el mejor tiro, retrasarlo, desplazarlo, cambiar quién lo ejecuta o empeorar su ejecución. Las estadísticas de los tiros que sí se realizaron no capturan todas esas contribuciones. El trabajo de Franks y colaboradores distingue componentes espaciales de la defensa que ayudan a entender este problema. [E02](#e02--franks-miller-bornn-y-goldsberry-2015)

El plan defensivo necesita seis decisiones: **qué proteger, cómo orientar el balón, qué hacer ante bloqueos, de dónde ayudar, cómo rotar y quién asegura rebote/balance**. «Individual», «zona» o «presión» solo resuelven parte del problema.

## 4.2 Defensa del balón y espacios próximos

| Conducta | Beneficio perseguido | Concesión / riesgo | Capacidades clave |
|---|---|---|---|
| Presión cercana | Quitar visión, incomodar bote y pase | Ser superado, cometer falta | Pies, manos disciplinadas, frenada |
| Distancia de contención | Mantenerse entre balón y aro | Tiempo para lanzar o pasar | Lectura de amenaza, reacción |
| Orientar a mano menos eficaz | Limitar repertorio útil | Puede abrir ayuda o dirección favorable al sistema rival | Scouting, colocación, contención |
| No-middle | Evitar penetración central, orientar a banda | Fondo y ayudas bajas deben estar preparadas | Coordinación y pies |
| Influencia hacia centro | Canalizar hacia protección/ayudas elegidas | Más ángulos de pase si la ayuda falla | Comunicación y control del ángulo |
| Deny | Negar recepción | Puerta atrás, peor posición de ayuda | Anticipación y visión balón-jugador |
| Gap | Ceder algo de recepción para cerrar conducción | Catch-and-shoot y pases libres | Recuperación y closeout |
| Top-lock | Colocarse por encima del tirador para negar su salida | Corte al aro por detrás | Ayuda de aro y sincronización |
| Contestar vertical | Molestar sin invadir trayectoria ilegal | Un atacante puede anotar igualmente | Timing, alcance, equilibrio |
| Robar / meter mano | Interrumpir o recuperar | Falta, abandono de posición, paso atrás rival | Lectura de exposición del balón |
| Closeout controlado | Llegar al tiro y conservar contención | Ceder un tiro si se llega tarde | Frenada, longitud útil, disciplina |
| Fly-by o cierre máximo | Priorizar impedir lanzamiento inmediato | Penetración tras finta, falta, rebote perdido | Juicio situacional y recuperación |

«Aggressiveness» no debe subir a la vez robos, tapones y contención sin aumentar costes. Tampoco una mayor distancia equivale siempre a mala defensa: puede ser una concesión deliberada a un tirador débil.

## 4.3 Coberturas del bloqueo directo

| Cobertura | Qué hace | Qué intenta quitar | Qué suele ofrecer | Qué exige detrás |
|---|---|---|---|---|
| Drop profundo | Interior espera cerca de aro; exterior recupera | Aro y lob directo | Pull-up, floater, espacio al manejador | Perseguidor útil y control del roll |
| Drop alto | Interior contiene más arriba | Reducir tiro cómodo sin salir del todo | Pase detrás y necesidad de retroceder | Movilidad y ayudas precisas |
| At the level | Interior a la altura del bloqueo | Salida inmediata del manejador | Ventana a roll/slip | Recuperación y tag |
| Show / hedge | Interior sale temporalmente y vuelve | Romper dirección y ritmo | Pase temprano al continuador, inversión | Rotación mientras interior regresa |
| Blitz / trap | Dos defensores comprometen balón | Quitar decisión al creador, forzar error | 4×3 si sale el pase | Rotaciones largas y lectura del receptor |
| Switch | Intercambiar atacantes | Separación de bloqueo y pase simple al roll | Mismatch, sello, rebote desfavorable | Capacidad de sobrevivir y ayudas selectivas |
| Under | Defensor del balón pasa por debajo | Penetración y contacto con pantalla | Tiro y re-screen | Respeto ajustado al tirador |
| ICE / down | En lateral, negar uso hacia centro y orientar a banda | PnR central y entrada a pintura central | Reject hacia fondo, pop, cambio de ángulo | Interior y ayuda baja alineados |
| Weak | Forzar dirección/mano prefijada | Preferencia dominante del creador | Ruta alternativa | Plan compatible con spacing rival |
| Late switch / emergency switch | Cambiar cuando se pierde cobertura inicial | Evitar ventaja ya peligrosa | Desorden temporal y sello | Reconocimiento rápido |
| Peel switch | Quien ayuda toma penetrador; superado toma su atacante | Repartir responsabilidades tras ruptura | Pase a tiempo al receptor liberado | Comunicación y trayectorias viables |
| Pre-switch | Cambiar marcas antes del bloqueo | Evitar matchup que el rival busca | Slip, corte o ataque antes de completar cambio | Anticipación y tiempo disponible |
| Scram switch | Sacar a un pequeño de marca interior vulnerable | Sello/poste profundo | Pase durante el intercambio | Ayuda y ejecución antes de recepción |

**No son botones independientes:** «switch» debe especificar quién cambia, ante qué emparejamientos, en qué zona y con cuánto reloj. Una defensa puede usar drop central, ICE lateral, cambio entre exteriores y blitz contra un creador concreto.

**No existe contramedida garantizada:** el roll puede estar defendido por un tercero; el triple concedido puede ser a alguien que no lo convierte; el interior cambiado puede contener suficientemente bien. El rendimiento es una distribución condicionada a la ejecución.

## 4.4 Ayudas y rotaciones

| Mecanismo | Función | Error frecuente que debe poder ocurrir |
|---|---|---|
| Nail help | Presencia cerca del centro de la línea de libres para frenar penetración | Abandonar un tirador sin necesidad o llegar cuando ya pasó balón |
| Low man | Última ayuda del lado débil sobre aro/roll | No identificar quién asume el rol después de un corte |
| Tag al roll | Contacto/presencia temporal que retrasa al continuador | Quedarse demasiado y liberar esquina |
| Stunt-and-recover | Amenazar ayuda y volver | El amago no detiene balón y retrasa recuperación |
| Dig al poste | Mano/ayuda breve cuando interior bota | Falta o pase a exterior liberado |
| X-out | Dos defensores intercambian salidas hacia tiradores | Ambos van al mismo receptor o ninguno llega |
| Sink-and-fill | Hundir para proteger y rellenar espacio dejado | Rotación encadenada incompleta |
| Ayuda a la ayuda | Cubrir responsabilidad de quien ya ayudó | Tercera amenaza sin cubrir |
| Rotación desde no tirador | Elegir concesión menos costosa | Rival cambia ubicación, corta o bloquea con ese jugador |
| Recuperar a hombre / intercambiar | Volver al original o quedarse con nueva asignación | Perseguir marca antigua dejando libre al receptor actual |

La defensa no conoce de antemano todos los pases. Debe percibir señales y anticipar con incertidumbre. Una buena lectura puede ser vencida por un excelente pase; una mala rotación puede sobrevivir porque el atacante no ve la oportunidad.

## 4.5 Contra juego sin balón, mano a mano y poste

**Bloqueos indirectos:** perseguir por detrás, pasar por debajo, atravesar el espacio disponible, negar salida, cambiar o realizar show temporal. Cada elección responde a trayectoria, distancia y amenaza de tiro. Perseguir puede abrir curl; top-lock puede abrir backdoor; cambiar puede abrir sello.

**Mano a mano:** impedir que el receptor llegue, saltar a la entrega, cambiar, contener por debajo o atrapar. El portador puede conservar y conducir. No debe resolverse siempre como «un pase seguro» previo a la acción real: la propia entrega es un punto de disputa.

**Poste:** defender por detrás, tres cuartos o frontal; negar entrada con presión al pasador; ayuda en recepción, primer bote o giro; doble desde fondo o perímetro. Frontal sin presión de balón ni ayuda al lob puede ser autodestructivo. Un doble temprano evita que el poste bote, pero da más tiempo para localizar al libre.

**Sellos tras cambio:** prevenir la recepción puede valer más que defender el tiro posterior. La transición entre marcas forma parte de la defensa, no de una animación sin consecuencias.

## 4.6 Zonas y defensas mixtas

| Familia | Fortaleza buscada | Vulnerabilidad estructural posible |
|---|---|---|
| 2-3 | Densidad interior y presencia cerca del rebote | Poste alto, huecos entre líneas, inversión y short corner |
| 3-2 | Presencia exterior alta y primeras recepciones | Fondo, esquinas y espacios detrás de primera línea |
| 1-3-1 | Longitud, trampas laterales y pases incómodos | Esquinas, línea de fondo y rebote si la rotación es larga |
| 1-2-2 | Contener avance y orientar hacia bandas | Intervalos y pases detrás de primera línea |
| Matchup zone | Responsabilidades zonales con seguimiento de cortes | Comunicación compleja ante cruces y sobrecargas |
| Zona que cambia tras primera acción | Confundir lecturas iniciales | Jugadores propios pueden ejecutar criterios incompatibles |
| Box-and-one | Un perseguidor niega estrella; cuatro protegen espacios | Otros creadores, bloqueos sobre perseguidor, rebote |
| Triangle-and-two | Negar dos amenazas principales | Sobrecargas y espacios contra los otros tres |
| Defensas combinadas situacionales | Proteger debilidad concreta o sorprender | Más exigencia de reconocimiento compartido |

No hay una única «defensa zonal» con porcentaje de defensa interior/exterior. Una 2-3 agresiva que atrapa esquinas y una 2-3 conservadora pueden producir tiros y pérdidas muy diferentes. Las zonas están permitidas en NBA, pero deben respetar sus tres segundos defensivos. [R08](#r08--nba-rule-10-violations-and-penalties)

## 4.7 Presión a toda pista y media pista

| Familia | Objetivo | Coste principal |
|---|---|---|
| Individual toda pista | Retrasar entrada y desgastar al manejador | Espacio detrás, faltas y carga física |
| Run-and-jump | Saltos/intercambios ante avance para provocar dudas | Rotación compleja y receptor libre si se pasa temprano |
| 1-2-1-1 / diamond press | Trampa tras saque y negación de salidas próximas | Pase por encima y inferioridad si se rompe |
| 2-2-1 | Canalizar a banda y consumir reloj | Centro o diagonal si la segunda línea llega tarde |
| 1-2-2 / 2-1-2 de presión | Guiar hacia puntos de trampa prefijados | Intervalos y inversión rápida |
| Trampa en media pista | Usar banda y línea central para limitar escape | Pase al centro que crea superioridad |
| Presión de contención | Gastar tiempo sin buscar robo inmediato | Puede conceder avance seguro si resulta demasiado pasiva |
| Cambio de presión tras libre/canasta | Aprovechar tiempo para colocar estructura | Menos viable tras pérdida viva y rival lanzado |

Medir solo robos infravalora consumir diez segundos antes de iniciar un sistema. Medir solo pérdidas forzadas sobrevalora la presión si, cuando falla, concede bandejas.

## 4.8 Transición, rebote y final de posesión

**Balance:** proteger aro, parar balón, identificar tiradores, comunicar cruces y recuperar emparejamientos viables. «Cada uno vuelve con el suyo» puede ser una mala regla durante un 3×2. El más cercano al balón puede necesitar contener mientras otro cubre su amenaza.

**Rebote:** encontrar rival, ganar línea, mantener contacto legal, leer trayectoria y asegurar. El cierre es colectivo: quien bloquea al gran reboteador puede hacer posible que un compañero capture. Un tapón espectacular fuera puede ser menos valioso que una buena contestación seguida de rebote.

**Finales:** negar triple cuando un dos sirve, no cometer falta sobre tiro, decidir si hacer falta antes del lanzamiento, cambiar todo con pocos segundos, usar falta disponible o proteger a un jugador con cinco faltas. Cada política necesita tiempo, marcador, normativa y perfiles de lanzadores.

El estudio de Wiens y colaboradores analiza precisamente la relación entre cargar rebote y proteger la transición, advirtiendo que la asociación observada no prueba por sí sola causalidad. [E11](#e11--wiens-balakrishnan-brooks-y-guttag-2013) Para un motor, ambos deben compartir estado: no tiene sentido ganar rebotes «gratis» y restaurar luego una defensa perfectamente colocada.

## 4.9 Indicadores de una defensa bien representada

- Puede conseguir una gran posesión sin robo ni tapón.
- Puede conceder voluntariamente un tiro y ejecutar correctamente su plan.
- El balón puede salir de la primera trampa y aun así ser frenado por una rotación posterior.
- Un error del perseguidor puede cargar responsabilidad al interior sin que este sea el culpable original.
- Una cobertura adecuada puede fallar por ejecución; una mala cobertura puede sobrevivir por azar.
- Asegurar el rebote completa la defensa: forzar un mal tiro no basta si se concede otra oportunidad.

---

# 05 — Interacciones: táctica, ejecución y resultado

## 5.1 Matriz de enfrentamientos

**Síntesis, no tabla de bonificaciones.** La última columna indica qué medir para comprobar el mecanismo; no presupone que todos los emparejamientos favorezcan al ataque.

| Situación | Ajuste ofensivo plausible | Respuesta defensiva disponible | Capacidades que deciden | Señal observable |
|---|---|---|---|---|
| PnR contra drop | Pull-up, floater, snake o pocket | Subir interior, perseguir mejor, tag | Tiro tras bote, ritmo, pase, contención | Zona de tiro y distancia/tiempo de contestación |
| PnR contra blitz | Pase antes de encierro y short roll | Rotar al receptor y recuperar con X-out | Visión, precisión, decisión 4×3 | Tiempo de salida y ventaja residual |
| PnR contra switch | Slip, sello o ataque al mismatch | Pre-switch, scram, ayuda selectiva | Anticipación, juego interior o conducción | Recepción profunda o separación real |
| Under contra gran tirador | Tirar o re-screen | Cambiar navegación y altura de cobertura | Preparación y tiro, bloqueo, recuperación | Tiro abierto generado; no solo acierto |
| ICE lateral | Reject, flip o pop | Ajustar interior y low man | Manejo, ángulo de pantalla, tiro del bloqueador | Ruta de penetración y nueva línea de pase |
| Top-lock al tirador | Backdoor y sello del bloqueador | Ayuda interior, cambio temprano | Lectura sin balón, pase, finalización | Corte accesible antes de ayuda |
| Doble al poste | Pase fuera, corte o repost | Rotación y negación del siguiente pase | Protección, visión periférica, pase | Ventana creada y tiempo hasta nuevo ataque |
| Frontal al poste | Alto-bajo o invertir entrada | Presión al pasador y ayuda al lob | Sello, pase alto, anticipación | Riesgo de intercepción y recepción |
| Zona compacta | Poste alto, sobrecarga, short corner | Desplazar zona y ajustar responsabilidades | Pase, tiro, recepción/giro | Dos defensores fijados y hueco aprovechado |
| Presión toda pista | Invertir, centro y pase adelantado | Recuperar, variar trampa, negar centro | Manejo, desmarque, decisión | Tiempo consumido y estado tras superar línea |
| Carga de rebote rival | Cerrar con varios y asegurar salida | Rival deja jugadores de seguridad | Contacto, lectura, primer pase | Rebote disponible y calidad de transición |
| Closeout largo | Tiro, finta y penetración o pase extra | Cierre controlado y segunda ayuda | Recepción, salida, lectura, frenada | Ventaja tras segunda decisión |
| Defensa en bonus | Atacar contactos legales y aro | Verticalidad y mayor distancia | Finalización, control corporal, disciplina | Frecuencia/contexto de faltas, no «bonus = puntos» |
| Poco reloj | Simplificar hacia opción ejecutable | Cambiar, negar primera recepción | Rapidez decisional y repertorio | Tiro antes de bocina y dificultad |

## 5.2 Siete posesiones ilustrativas completas

**Son ejemplos hipotéticos construidos para explicar causalidad. No son transcripciones de los partidos del capítulo 10.** Los tiempos son ilustrativos y no parámetros recomendados.

### Caso A — El drop concede algo, pero no siempre lo mismo

1. Equipo A recibe en campo propio con 24 segundos y avanza. Al llegar a campo delantero quedan aproximadamente 20.
2. Un interior coloca pantalla central; el manejador espera a que el ángulo sea útil. El perseguidor pasa por arriba y el interior rival se hunde.
3. El manejador sale con el defensor en cadera. Puede tirar de media distancia, continuar hacia el aro o pasar al roll. La elección depende también de dónde estén las dos ayudas.
4. La ayuda baja toca temporalmente al continuador. El atacante de esquina se reubica para abrir pase; el defensor alto se prepara para rotar.
5. El manejador encuentra la esquina, pero el pase llega bajo. El receptor pierde parte de la ventana al preparar los pies.
6. Se produce un triple contestado tarde. Puede entrar o fallar. En el fallo, la posición final de interiores y del tirador condiciona el rebote y la transición.

**Qué cambia al mejorar atributos:** más precisión puede acelerar la preparación; mejor lectura puede elegir antes; mejor recuperación puede cerrar la ventana. No se necesita un «+8 % por PnR».

### Caso B — Una trampa bien diseñada puede forzar pérdida sin robo individual

1. El ataque inicia PnR lateral con esquina ocupada. El defensor del bloqueador y el del balón cierran ambos lados útiles.
2. El manejador recoge el bote antes de encontrar salida. El short roller ofrece apoyo, pero una tercera defensa niega la línea directa.
3. Un compañero no corta al espacio libre a tiempo. El pasador intenta un balón alto diagonal.
4. La trayectoria obliga al receptor a salir de pista o deja el balón fuera sin toque defensivo.

**Resultado:** pérdida sin robo, creada por orientación, trampa y negación. Atribuirla solo a «mal pase» escondería tres acciones defensivas y un desmarque tardío.

### Caso C — El short roll exige un decisor

1. La misma trampa encuentra ahora un pase temprano al interior en zona central.
2. Detrás quedan cuatro atacantes frente a tres defensores temporalmente. El receptor amenaza aro; el low man se compromete.
3. Una esquina está abierta, pero el defensor superior ya corre hacia ella. El receptor puede pasar directo, dar un pase adicional al ala o finalizar antes de llegada.
4. Un interior que decide tarde permite restablecer igualdad; otro que lee pronto puede generar tiro limpio sin lanzar él.

**Comparación útil:** misma fuerza y mates, distinta percepción/pase. Si ambos producen lo mismo, el motor no representa la función del short roll.

### Caso D — Cambio defensivo sin premio automático por mismatch

1. Un exterior busca cambiar a un pívot sobre él. La defensa acepta.
2. El atacante invierte tiempo en aislarse. El pívot concede un paso de distancia y orienta hacia ayuda.
3. El pequeño puede lanzar si convierte desde ahí; conducir si puede superar y frenar; o pasar al interior que sella a un defensor bajo.
4. El sello no recibe porque la línea de pase está negada. La defensa ejecuta scram antes del pase de entrada.
5. El ataque debe continuar con menos reloj: obtener el cambio no ha generado por sí solo una buena posesión.

**Qué medir:** tiempo gastado en cazar emparejamiento, ventaja conseguida y salida disponible, no porcentaje de éxito asociado a la palabra «switch».

### Caso E — Zona, tiro fallado y segunda oportunidad

1. Ataque contra 2-3: balón al ala, interior al poste alto y otro jugador al short corner.
2. El pase al poste alto atrae al centro de la zona. El receptor gira y encuentra al jugador bajo.
3. La defensa de fondo llega y obliga a pase a esquina. La rotación exterior contesta un triple.
4. El tiro falla; la zona tiene a sus jugadores orientados hacia rotaciones, sin todos los contactos de cierre establecidos.
5. Un atacante gana trayectoria y captura rebote ofensivo. Se mantiene la posesión estadística, se aplica el reset correspondiente y puede haber tiro inmediato o reorganización.

**No concluir:** «zona = mal rebote». El fallo fue la asignación/ejecución del cierre en ese estado. Una zona bien organizada puede cerrarlo correctamente.

### Caso F — Transición frenada y ataque que continúa

1. Tras un tiro fallado, tres atacantes cargan rebote. El rival lo captura y lanza un pase adelantado.
2. Hay 3×2 inicial. El defensor más cercano protege aro y el otro frena balón hasta que llegue un tercer apoyo.
3. El manejador no ve el pase a tiempo. Al tomarlo ya no existe bandeja limpia.
4. El ataque utiliza un drag del interior que llega. Si tampoco crea ventaja, entra en su organización de media pista.

**Lección:** la transición no termina obligatoriamente en bandeja, falta o pérdida. Puede transformarse en otra fase sin crear otra posesión.

### Caso G — Un final depende del reglamento

1. A gana por tres; B tiene balón y poco tiempo. A considera hacer falta antes del lanzamiento.
2. Importan bonus, tiempo para completar el contacto, probabilidad de que B entre en acción de tiro, sanciones especiales y capacidad de B para capturar un libre fallado.
3. Si la falta ocurre ya sobre triple y el tiro entra, la estrategia puede convertirse en canasta más adicional. Si es falta no de tiro en contexto 1+1 NCAA masculina, el árbol de libres difiere del de dos tiros garantizados.
4. B puede intentar fallo deliberado del último libre, pero necesita tocar aro legalmente, recuperar y lanzar a tiempo.

**Lección:** no programar «ganando de tres, hacer falta siempre». Se comparan probabilidades de victoria condicionadas al estado, y las decisiones humanas pueden ser imperfectas.

## 5.3 Cómo explicar una posesión en el laboratorio

El registro debería permitir contestar cinco preguntas:

1. ¿Qué se intentaba conseguir?
2. ¿Qué percibió cada decisor relevante?
3. ¿Qué cambió en el espacio y en las responsabilidades defensivas?
4. ¿Qué capacidades influyeron en ejecución, tiempo o riesgo?
5. ¿Qué resultado fue aleatorio y qué consecuencias dejó?

**Ejemplo de explicación útil:** «El interior salió a contener; la ayuda baja cerró el roll; el pase tardío permitió la recuperación a esquina». **Explicación insuficiente:** «Táctica ofensiva: 74; defensa: 68; triple fallado».

## 5.4 El mismo resultado puede ocultar partidos distintos

Dos ataques pueden anotar 1,1 puntos por posesión: uno genera tiros abiertos y los falla de forma anómala durante una muestra; otro vive de canastas difíciles que no sostendrá. Dos defensas pueden permitir igual acierto y diferir radicalmente en rebote, faltas o tiros que disuaden.

Por eso hay que validar **proceso y resultado**. La calidad esperada de una decisión no puede definirse retrospectivamente como «fue buena porque entró».

---

# 06 — Capacidades, tendencias y estados del jugador

## 6.1 La separación fundamental

| Clase de variable | Qué representa | Ejemplo | Error que evita |
|---|---|---|---|
| Capacidad técnica | Qué sabe ejecutar y con qué fiabilidad | Pase con mano débil bajo presión | Confundir habilidad con volumen de uso |
| Capacidad perceptivo-cognitiva | Qué detecta, anticipa y decide | Ver al low man y elegir pase | Dar omnisciencia a todos |
| Capacidad física | Qué movimiento/contacto puede producir | Frenar y volver a acelerar | Resolver toda defensa mediante «velocidad» |
| Morfología | Dimensiones corporales | Alcance de pie, envergadura, masa | Tratar altura como habilidad aprendida |
| Tendencia / preferencia | Qué suele intentar | Tirar pronto, ayudar mucho, arriesgar pase | Hacer que todos elijan igual con atributos distintos |
| Estado temporal | Cómo está ahora | Fatiga aguda, equilibrio, atención | Convertir un estado transitorio en talento permanente |
| Relación aprendida | Qué coordina con estos compañeros/sistema | Timing de una continuación | Un bonus genérico de química |
| Información disponible | Qué sabe de esta jugada y rival | Scouting de mano preferida | Anticipar un plan que no ha percibido |

**Propuesta:** los siguientes 43 conceptos son un inventario analítico. No significa aprobar 43 deslizadores visibles. Algunos podrían agruparse, derivarse o mantenerse como rasgos internos si no pueden medirse separadamente.

## 6.2 Capacidades técnicas candidatas

| ID | Capacidad operacional | Dónde actúa | Manifestación de nivel insuficiente |
|---|---|---|---|
| T01 | Finalización cercana: toque y control de trayectoria | Bandejas, reversos, ganchos cortos | Fallar ángulos incómodos incluso sin gran oposición |
| T02 | Floater y toque intermedio | Espacio entre perseguidor y protector | Necesitar acercarse demasiado al aro |
| T03 | Tiro de media distancia | Pull-up, poste medio, final de reloj | No castigar espacio concedido |
| T04 | Tiro de tres y rango efectivo | Esquina, frontal, recepción, apertura de bloqueador | Defensa puede ayudar desde su marca |
| T05 | Tiro libre | Rutina y ejecución sin defensa directa | Coste de faltas recibidas menor para rival |
| T06 | Preparación de tiro en movimiento | Salida de pantalla, parada, pull-up | Ventana desaprovechada o desequilibrio |
| T07 | Manejo y protección de balón | Bote ante presión, cambios de mano, salida de trampa | Recoger bote pronto, exposición y pérdidas |
| T08 | Creación técnica de separación | Fintas, cambio de ritmo, step-back | Depender solo de superioridad física |
| T09 | Precisión y peso del pase | Pocket, esquina, entrada, outlet | Recepciones lentas, desvíos, pérdida de ventana |
| T10 | Repertorio y ejecución de pase | Pase con ambas manos, por encima, bote, salto | Ver una opción pero no poder ejecutarla |
| T11 | Recepción y manos | Balón bajo, alto, en carrera o tráfico | Bobble, retraso y pérdida de control |
| T12 | Pies y recursos de poste | Pivotes, sellos, giros y contramovimientos | Pasos, mala posición de tiro o salida previsible |
| T13 | Técnica de bloqueo | Base, ángulo, inmovilidad legal y reorientación | No conectar o cometer falta ofensiva |
| T14 | Finalización bajo contacto | Absorber perturbación y proteger balón | Abortar, perder equilibrio o reducir repertorio |
| T15 | Técnica de contención defensiva | Pies, cadera, distancia, manos legales | Abrir carril pese a velocidad suficiente |
| T16 | Navegación de bloqueos | Recorrido, contacto, recuperación | Perder demasiada separación o cometer falta |
| T17 | Intercepción y robo técnico | Atacar balón expuesto y líneas accesibles | Toques sin control o faltas de mano |
| T18 | Contestación y tapón | Timing, verticalidad, mano y trayectoria | Saltar demasiado pronto, interferir o hacer falta |
| T19 | Cierre de rebote / sellado defensivo | Contacto, línea, base, liberación | Rival gana posición sin necesidad de saltar más |
| T20 | Captura y dirección de rebote | Agarre, palmeo útil, segundo esfuerzo | Toque sin asegurar o balón regalado |
| T21 | Desmarque y uso de pantalla | Cambios de dirección, preparación del defensor | Cortes previsibles o pasar lejos del bloqueador |

**Precisiones:** el tiro no debe depender solo de zona: recepción/bote, movimiento, oposición y equilibrio cambian la tarea. La mano no dominante puede expresarse como asimetría de un repertorio, no necesariamente como otro atributo global. El tiro bajo contacto y la finalización cercana se solapan: hay que evitar multiplicar dos premios que representen la misma habilidad.

## 6.3 Capacidades perceptivas, mentales y de coordinación

| ID | Capacidad operacional | Intervención concreta | Lo que no significa |
|---|---|---|---|
| M01 | Exploración y percepción relevante | Detectar compañero, ayuda, reloj y línea de pase | Ver todo el campo sin coste |
| M02 | Anticipación | Prever corte, trayectoria, segunda ayuda o rebote | Conocer la próxima acción rival con certeza |
| M03 | Selección de decisión | Elegir entre opciones percibidas según valor/riesgo | Hacer siempre la jugada que acaba anotando |
| M04 | Timing | Ejecutar cuando coinciden ventana y movimiento | Ser simplemente más rápido |
| M05 | Comprensión espacial | Mantener distancias, carriles y ángulos útiles | Una posición fija ideal en cada momento |
| M06 | Atención sostenida | Seguir marca, balón, instrucciones y reloj | Ausencia absoluta de distracciones |
| M07 | Disciplina | Respetar responsabilidad y controlar riesgo de falta | Pasividad o baja agresividad |
| M08 | Regulación emocional bajo presión | Mantener rutina y decisión ante estrés | Bonus universal en finales o inmunidad al fallo |
| M09 | Comunicación eficaz | Avisar pantalla, cambio, ayuda y responsabilidad | Subir automáticamente atributos de compañeros |
| M10 | Adaptación | Ajustar conducta ante cobertura y respuesta observada | Aprender perfectamente el rival en una posesión |
| M11 | Comprensión y memoria táctica | Ejecutar lecturas compartidas y recordar asignación | Solo memorizar el dibujo inicial de una jugada |
| M12 | Gestión del esfuerzo | Dosificar y elegir esfuerzos según situación | Pereza, moral o condición física como sinónimos |

El resultado perceptivo y la ejecución deben poder divergir: ver al compañero y pasar mal; no verlo aunque el pase fuera fácil; decidir correctamente pero llegar tarde. Esto ofrece personalidades deportivas plausibles sin recurrir a «inteligencia» como multiplicador de todo.

Los experimentos sobre fatiga mental y tareas de decisión apoyan investigar atención, tiempos de respuesta y elección; no validan un porcentaje universal de «composure». [E09](#e09--cao-y-colaboradores-2024), [E10](#e10--li-zhang-y-zheng-2026)

## 6.4 Capacidades físicas

| ID | Capacidad | Acciones afectadas | Distinción necesaria |
|---|---|---|---|
| F01 | Aceleración | Primeros pasos, salida, recuperación corta | No equivale a velocidad punta |
| F02 | Velocidad de desplazamiento | Transición y recorridos largos | No garantiza contención lateral |
| F03 | Frenada y desaceleración | Closeout, parada de tiro, evitar sobrepasar | Puede ser distinta de acelerar |
| F04 | Cambio de dirección y movilidad lateral | Defender bote, cortar, navegar | Incluye ejecución física, no lectura del estímulo |
| F05 | Fuerza funcional | Sellos, contacto, pantalla, cierre de rebote | Masa corporal no es fuerza técnica útil |
| F06 | Potencia y capacidad de salto | Finalizar, disputar rebote, contestar | Alcance total incluye morfología y tiempo de llegada |
| F07 | Repetición de esfuerzos intensos | Sprints, recuperaciones, rebotes sucesivos | Diferente de un salto máximo aislado |
| F08 | Recuperación y capacidad aeróbica | Restaurar recursos entre esfuerzos y descansos | No es un simple «minutos hasta agotarse» |
| F09 | Equilibrio y estabilidad corporal | Contacto, aterrizaje, recepción y lanzamiento | No debe duplicar toda técnica de pies |
| F10 | Coordinación motriz | Integrar apoyos, manos y orientación | Puede representarse dentro de habilidades específicas |

El baloncesto combina esfuerzos breves, cambios frecuentes y recuperación. Un estudio de competición sub-19 no justifica trasladar sus cargas exactas a profesionales, pero sí cuestiona representar el esfuerzo únicamente por minutos en cancha. [E12](#e12--ben-abdelkrim-el-fazaa-y-el-ati-2007)

## 6.5 Morfología: efectos geométricos, no destinos deportivos

Considerar altura, alcance de pie, envergadura, masa y distribución corporal solo cuando aporten una vía causal clara. Un mayor alcance puede interceptar una ventana, contestar desde más lejos o alcanzar un balón. No permite estar simultáneamente en dos sitios.

**No está justificado:** imponer automáticamente peor tiro por brazos largos, penalizar toda agilidad a partir de una altura exacta o dar un bonus independiente por altura, envergadura, alcance y tapón si todos miden el mismo resultado.

**Alternativa:** tiempo de llegada + posición + alcance útil + técnica de intervención. Para jugadores ficticios, generar perfiles correlacionados de forma plausible, pero permitir excepciones. Correlación poblacional no debe convertirse en prohibición individual.

## 6.6 Tendencias: estilo sin confundirlo con calidad

Tendencias candidatas: frecuencia de tiro, selección de distancia, preferencia de mano, atacar/pasar tras ventaja, asumir pase arriesgado, retener o mover rápido, cortar o esperar, roll/pop, cargar rebote, buscar contacto, intentar robo, ayudar más/menos, cambiar antes/tarde, correr, y obedecer/improvisar.

Una tendencia debe ser **condicional**: un jugador puede rechazar normalmente un triple, pero lanzarlo si quedan dos segundos. Una orden del entrenador modifica prioridades; no transforma un mal tirador en uno bueno ni suprime toda decisión propia.

Ejemplo: dos bases con igual precisión de pase pueden producir diferentes asistencias y pérdidas porque uno maneja más, intenta ventanas menores o juega con mejores finalizadores.

## 6.7 Estados: qué cambia dentro del encuentro

| Estado | Evolución plausible | Precaución |
|---|---|---|
| Fatiga aguda | Sprints, contactos, saltos, secuencias defensivas | No cobrar varias veces el mismo esfuerzo simultáneo |
| Recuperación | Pausas, banco, menor intensidad | Reanudar no implica volver al 100 % instantáneamente |
| Equilibrio/orientación | Acción anterior, contacto, recepción | Debe ser local y breve, no atributo permanente |
| Atención/fatiga mental | Exigencia, duración, contexto | Separar evidencia de tarea experimental y partido real |
| Confianza/estrés | Contexto individual, decisiones y percepción | Evitar rachas mágicas determinadas solo por últimas canastas |
| Riesgo de exclusión | Faltas acumuladas | Cambia decisión del jugador/entrenador, no fuerza física |
| Dolor/limitación física | Situación conocida del partido | No implementar un modelo médico causal sin evidencia específica |
| Familiaridad activa | Conocimiento de jugada, compañeros y cobertura | No mejorar automáticamente durante un encuentro a gran velocidad |

Se puede comenzar con pocos estados bien definidos. Complejidad adicional solo si explica diferencias observables que no resuelve ya otro componente.

## 6.8 Atributos que no deberían tener un bonus directo por defecto

Liderazgo, profesionalidad, ambición, lealtad, potencial, popularidad y reputación no deberían sumar directamente acierto. Si se incluyen, necesitan una vía: comunicación, preparación, cumplimiento, aprendizaje, esfuerzo o decisiones. «Trabajo en equipo» tiene efectos reales a través de sincronización y responsabilidad, pero no por una mejora global e incondicional.

La posición nominal —base, escolta, alero, ala-pívot, pívot— describe uso, no causa física. Quien cumple funciones de pasador alto debe resolverlas con sus capacidades, aunque esté etiquetado como pívot.

## 6.9 Evitar el doble conteo

1. Si el alcance ya determina si una mano llega al balón, no añadir otro premio idéntico por altura.
2. Si una mala recepción ya retrasa el tiro y permite closeout, no penalizar además el acierto por «pase malo» salvo mecanismo residual distinto.
3. Si la fatiga reduce frenada y equilibrio, no añadir después una penalización global que replique esos mismos efectos.
4. Si la lectura ya elige mejores tiros, no volver a premiar todos los tiros con «IQ».
5. Si el bloqueo crea separación, premiar directamente el acierto por nivel del bloqueador puede duplicar su contribución.

## 6.10 Cómo seleccionar el conjunto mínimo final

Conservar una dimensión cuando cumpla cuatro condiciones: altera decisiones o ejecución relevantes; puede describirse sin circularidad; tiene observables para calibrar; aporta algo que no explica otra variable. Unificar cuando dos dimensiones no sean identificables con los datos o el nivel de detalle elegido.

**Objetivo:** perfiles distintos y comprensibles, no el mayor número posible de atributos. La discusión posterior debe partir de este mapa funcional, no de una lista heredada de otros videojuegos.

---

# 07 — Evidencia científica: hallazgos, límites y utilidad

## 7.1 Cómo se han evaluado los trabajos

No se asigna una puntuación artificial de «calidad científica». Se identifica diseño, población, variable observada y límite de inferencia. Las fichas son resúmenes críticos breves; los enlaces originales y el alcance de acceso están en 12.

**Tres preguntas:** ¿describe un mecanismo?, ¿estima una asociación o un efecto causal?, ¿su magnitud puede transferirse al contexto que queremos simular? Es frecuente responder sí a la primera y no a la tercera.

## 7.2 Valor de posesión, tiro y defensa

### E01 — Cervone, D’Amour, Bornn y Goldsberry: valor esperado de posesión

**Diseño:** modelización espaciotemporal con tracking NBA; propuesta multirresolución, publicada en JASA en 2016 a partir de trabajo previo.

**Aportación:** conecta movimiento continuo con transiciones discretas para estimar valor esperado de posesión —EPV— mientras ocurre el ataque. Da una forma de valorar estados intermedios, no solo tiro final.

**Límite:** un predictor ajustado a conducta observada no identifica automáticamente lo que ocurriría al imponer una táctica nueva. Además, depende de datos de tracking no equivalentes a un acta.

**Uso propuesto:** evaluar creación y conservación de ventaja. No copiar su complejidad estadística como requisito del primer motor. [E01](#e01--cervone-damour-bornn-y-goldsberry-2016)

### E02 — Franks, Miller, Bornn y Goldsberry: estructura espacial de la defensa

**Diseño:** modelo estadístico de tracking NBA, publicado en 2015.

**Aportación:** distingue aspectos de defensa asociados a dónde se permite tirar y a cómo se defiende el lanzamiento. La asignación defensiva y su evolución importan.

**Límite:** emparejamientos, selección del tiro, ayuda y calidad rival pueden confundir las medidas. El defensor más cercano al final no resume toda la posesión.

**Uso propuesto:** representar disuasión, contención y rotación; no identificar «defensa» con robos más tapones o con porcentaje rival sin contexto. [E02](#e02--franks-miller-bornn-y-goldsberry-2015)

### E03 — Skinner: problema de selección del tiro, 2012

**Diseño:** modelo matemático de decisión secuencial con reloj.

**Aportación:** aceptar o rechazar una oportunidad depende del tiempo y de la posibilidad de encontrar otra mejor. El umbral no tiene por qué permanecer fijo durante la posesión.

**Límite:** las distribuciones y supuestos simplificados no son una ley empírica de todos los ataques.

**Uso propuesto:** que un mismo tiro sea rechazable con tiempo y razonable cerca de la bocina. No convertir todos los finales en decisiones óptimas infalibles. [E03](#e03--skinner-2012)

### E15 — Daly-Grafstein y Bornn: trayectorias y oposición, 2020

**Diseño:** análisis de más de 50.000 trayectorias de tiro NBA.

**Aportación:** relaciona oposición defensiva y características de trayectoria; utiliza altura, distancia y ángulo de contestación para mejorar la evaluación respecto a simple acierto/fallo.

**Límite:** observacional, con selección de tiros; no justifica un coeficiente universal por centímetro ni elimina responsabilidad de otras ayudas.

**Uso propuesto:** modelar contestación por geometría y tiempo, más resiliencia técnica del tirador. Evitar una única casilla «defendido». [E15](#e15--daly-grafstein-y-bornn-2020)

### E16 — Pelechrinis y Goldsberry: anatomía del triple de esquina, 2021

**Diseño:** análisis de tracking y modelo estratégico simplificado, presentado en entorno académico de analítica deportiva.

**Aportación:** en su muestra, el alto porcentaje de tiros asistidos es importante para entender la eficiencia de las esquinas; no basta explicarla por menor distancia.

**Límite:** asociación y selección de oportunidades; no demuestra que mover cualquier tiro a la esquina aumente automáticamente su valor.

**Uso propuesto:** separar distancia, preparación, asistencia, movimiento y oposición. Consultado resumen y ficha original; no utilizado para fijar tasas. [E16](#e16--pelechrinis-y-goldsberry-2021)

## 7.3 Pick-and-roll y coordinación

### E06 — Nunes y colaboradores: entrevistas a entrenadores y observación, 2022

**Diseño:** seis entrenadores; análisis relacionado con 2.224 acciones de pick-and-roll en 34 partidos de Unicaja de la temporada 2010-11; método mixto y análisis de coordenadas polares.

**Aportación:** vincula valoraciones expertas con elementos ofensivos/defensivos de las secuencias. Ayuda a construir categorías de observación contextual.

**Límite:** un club, una temporada antigua y valoraciones no equivalentes a experimento causal. No representa frecuencia universal actual.

**Uso propuesto:** registrar cobertura, participantes y continuidad; no extraer «probabilidad de éxito del PnR» de una única media. [E06](#e06--nunes-y-colaboradores-2022)

### E07 — Marmarinos y colaboradores: eficacia del pick-and-roll, 2016

**Diseño:** 12.376 acciones en 502 partidos europeos, clasificadas por desenlace ofensivo.

**Aportación:** muestra el valor de distinguir modalidades y resultado de la continuación, en lugar de tratar todos los bloqueos directos igual.

**Límite:** observación, contexto histórico y definición operacional de eficacia. La asociación con clasificación final no prueba que aumentar mecánicamente su uso cause victorias.

**Uso propuesto:** referencia para taxonomía y estratificación. El acceso principal consultado fue el resumen; no se importan porcentajes de tablas no verificadas. [E07](#e07--marmarinos-apostolidis-kostopoulos-y-apostolidis-2016)

### E08 — Análisis observacional de pick-and-roll en EuroLeague Women, 2025

**Diseño:** 298 pick-and-rolls, 1.757 eventos, cuatro encuentros de la Final Four 2021-22.

**Aportación:** ofrece secuencias ofensivas/defensivas en baloncesto femenino de élite. El 71,8 % descrito como finalización en tiro no equivale al porcentaje de tiros convertidos.

**Límite:** cuatro partidos y selección de equipos finalistas; etiquetas de resultado y algunas descripciones de procedencia requieren cautela.

**Uso propuesto:** ampliar ejemplos y evitar extrapolación automática de NBA masculina. No es una tabla de calibración general para mujeres o FIBA. [E08](#e08--amatria-iván-baragaño-losada-y-maneiro-2025)

### E18 — Bourbousson, Sève y McGarry: coordinación espacio-temporal, 2010

**Diseño:** análisis de patrones de movimiento e interacción entre equipos; la ficha describe seis secuencias seleccionadas.

**Aportación:** estudia el comportamiento colectivo como interacción dinámica, no suma de actuaciones aisladas.

**Límite:** alcance reducido; acceso a ficha/resumen, no revisión completa del análisis. No permite asignar magnitudes universales de «química».

**Uso propuesto:** respaldo conceptual limitado para estudiar separaciones y sincronización. Los mecanismos operativos de este dossier se presentan como síntesis, no como una fórmula extraída del trabajo. [E18](#e18--bourbousson-sève-y-mcgarry-2010)

## 7.4 Fatiga física, percepción y presión

### E12 — Ben Abdelkrim, El Fazaa y El Ati: exigencias sub-19, 2007

**Diseño:** análisis temporal de actividad y medidas fisiológicas durante competición en jugadores masculinos de élite sub-19.

**Aportación:** documenta el carácter intermitente y las diferencias de demanda de las tareas de partido.

**Límite:** población, reglas y época concretas. Las medidas de carga no identifican por sí solas cómo cambia cada habilidad.

**Uso propuesto:** esfuerzo dependiente de acciones y recuperación, no desgaste uniforme por minuto. No utilizar sus valores como capacidad fija NBA/NCAA. [E12](#e12--ben-abdelkrim-el-fazaa-y-el-ati-2007)

### E13 — Sprints repetidos y biomecánica del tiro, 2025

**Diseño:** doce jugadores masculinos del equipo de Beijing Sport University, edad media 20,1 años; tiro antes/después de sprints, con captura inercial de movimiento.

**Aportación:** observa cambios de ejecución y una caída agregada en tiros largos de 22/48 a 17/48; media distancia pasa de 30/48 a 27/48.

**Límite:** pocos jugadores e intentos; lanzamientos agrupados por sujeto, no 48 observaciones plenamente independientes. No se transfiere la diferencia como penalización fija ni se asume respuesta igual por distancia o jugador.

**Uso propuesto:** explorar interacción entre fatiga, preparación y ejecución. La magnitud del motor debe validarse por separado. [E13](#e13--li-yang-mi-y-li-2025)

### E09 — Cao y colaboradores: fatiga mental y recuperación, 2024

**Diseño:** ensayo por conglomerados con 54 universitarios masculinos; inducción cognitiva de fatiga y tareas de baloncesto reducido 3×3.

**Aportación:** examina cambios en indicadores tácticos y una intervención breve de mindfulness.

**Límite:** contexto experimental, pocos conglomerados y tareas sin todos los elementos de un partido 5×5. Contar acciones tácticas no equivale a medir su calidad o eficiencia.

**Uso propuesto:** hipótesis sobre atención y elección bajo carga. No crear un botón que restaure rendimiento por un porcentaje tomado del estudio. [E09](#e09--cao-y-colaboradores-2024)

### E10 — Li, Zhang y Zheng: fatiga mental, decisiones y búsqueda visual, 2026

**Diseño:** 60 universitarios masculinos; tres niveles de experiencia y dos condiciones de fatiga; decisiones de tirar, pasar o penetrar sobre vídeo y eye-tracking.

**Aportación:** los más expertos responden mejor y más rápido; la fatiga afecta especialmente al tiempo de respuesta, con diferencias entre niveles.

**Límite:** tarea de pantalla, grupos pequeños por celda y sin ejecución física completa. Experiencia no se asigna aleatoriamente.

**Uso propuesto:** separar reconocer, elegir y ejecutar; no asumir una única penalización de fatiga mental para todos. [E10](#e10--li-zhang-y-zheng-2026)

### E14 — Harle y Vickers: quiet eye y tiro libre, 2001

**Diseño:** entrenamiento y seguimiento de baloncesto universitario durante dos temporadas.

**Aportación:** relaciona una rutina visual entrenada con mejoras; el resumen diferencia resultados experimentales y transferencia a competición entre temporadas.

**Límite:** muestra exacta y detalles completos no verificados en el acceso disponible; no se importan porcentajes de mejora.

**Uso propuesto:** la atención y la rutina pueden formar parte de ejecutar un libre. No deducir que un atributo mental debe sustituir toda la técnica bajo presión. [E14](#e14--harle-y-vickers-2001)

## 7.5 Rebote, baloncesto universitario y rachas

### E11 — Wiens, Balakrishnan, Brooks y Guttag: cargar o volver, 2013

**Diseño:** tracking de 233 partidos NBA 2011-12; subconjunto de 6.521 tiros lejanos fallados.

**Aportación:** relaciona posiciones y movimientos tras el tiro con rebote ofensivo y defensa posterior. Hace visible una decisión colectiva que no aparece en el box score.

**Límite:** los autores advierten que más jugadores pueden cargar precisamente cuando el rebote parece accesible; asociación no significa efecto causal aislado.

**Uso propuesto:** conservar posición y compromiso de rebote para generar la siguiente transición. No ofrecer rebote ofensivo sin coste de balance. [E11](#e11--wiens-balakrishnan-brooks-y-guttag-2013)

### E17 — Conte y colaboradores: perfil táctico NCAA Division I, 2018

**Diseño:** comparación observacional de ganadores y perdedores en partidos igualados de 2013-14; análisis de estadísticas y acciones tácticas.

**Aportación:** permite pensar en indicadores de organización ofensiva además de puntos y lanzamientos.

**Límite:** seleccionar por resultado y diferencia final limita la generalización. Una diferencia entre ganadores y perdedores no prescribe una intervención causal; el enfoque de inferencia por magnitudes requiere cautela.

**Uso propuesto:** diseñar variables de observación universitaria, no trasladar «hacen más X, por tanto debemos bonificar X». Se verificaron ficha y resumen, no todas las tablas. [E17](#e17--conte-tessitore-gjullin-mackinnon-lupo-y-favero-2018)

### E04 — Miller y Sanjurjo: sesgo en el análisis de mano caliente, 2018

**Diseño:** resultado metodológico sobre selección en secuencias y reanálisis de evidencia de tiro.

**Aportación:** muestra que ciertas comparaciones tras rachas sufren un sesgo; corrige argumentos históricos usados contra la mano caliente.

**Límite:** no establece un bonus universal tras dos o tres aciertos ni prueba que todas las rachas de equipo requieran una variable de momentum.

**Uso propuesto:** no descartar variación persistente por intuición, pero exigir evidencia y control de selección de tiro, defensa y contexto antes de añadirla. [E04](#e04--miller-y-sanjurjo-2018)

### E05 — Schilling: ¿es el baloncesto un juego de rachas?, 2019

**Diseño:** preprint con análisis de la temporada NBA 2016-17, comparando rachas máximas con procesos aleatorios.

**Aportación:** las longitudes observadas no exigen momentum para explicarse en los análisis presentados.

**Límite:** estadístico y pregunta concretos; no refuta todos los efectos psicológicos ni la heterogeneidad individual. Consultado resumen original.

**Uso propuesto:** una simulación puede producir parciales y remontadas sin un multiplicador oculto que favorezca al equipo que acaba de anotar. [E05](#e05--schilling-2019)

## 7.6 Balance conjunto de la evidencia

| Mecanismo | Apoyo disponible | Decisión prudente para diseño |
|---|---|---|
| Importancia del estado espacial y la oposición | Modelos de tracking y observación | Representarlo desde el núcleo |
| Decisión condicionada al reloj | Teoría más lógica reglamentaria | Incluir coste de esperar y opciones ejecutables |
| Dependencia táctica de cinco contra cinco | Coaching y análisis de secuencias | Evitar duelos aislados sin ayudas |
| Fatiga altera algunas tareas | Experimentos y carga de competición | Incluir de forma parsimoniosa; magnitudes por validar |
| Experiencia y percepción cambian decisiones | Experimentos y observación | Separar percepción, elección y ejecución |
| Rebote y transición comparten un coste | Tracking observacional | Conservar estado entre posesiones |
| Momentum global fijo | No establecido por este corpus | No introducir por defecto |
| Altura/envergadura penalizan siempre el tiro | No demostrado aquí | No imponerlo |
| Liderazgo mejora directamente todos los porcentajes | No demostrado aquí | Modelar vías concretas o dejar fuera |
| Una táctica es siempre superior | No demostrado | Comparar perfiles, respuestas y estados |

## 7.7 Vacíos de conocimiento que permanecen

Faltan estimaciones transferibles para muchas tácticas raras, errores de comunicación, respuesta individual al estrés, variación estable entre partidos y adaptación en directo. La disponibilidad pública de tracking es desigual. El baloncesto femenino y niveles inferiores necesitan más evidencia propia; no deben describirse solo como escalas reducidas del masculino.

Tampoco hay un estudio que conecte todo el baloncesto con un conjunto único de atributos de 1 a 20 o de 1 a 100. Esa traducción será una construcción nuestra, contrastable y revisable, no un descubrimiento ya resuelto por la literatura.

---

# 08 — Estadística, incertidumbre y calibración

## 8.1 Qué debe medir el motor

| Nivel | Métricas | Qué detectan |
|---|---|---|
| Partido | Posesiones, eficiencia, margen, prórrogas, distribución de parciales | Ritmo global, competitividad y colas |
| Posesión | Duración, fases, origen, puntos, pérdidas vivas/muertas | Cómo se producen resultados |
| Acción | Uso, éxito intermedio, tiempo, continuación | Efecto de táctica y ejecución |
| Lanzamiento | Zona, tipo, preparación, oposición, asistido, reloj | Selección y calidad, no solo acierto |
| Rebote | Oportunidades, posición, cierre, captura, rebote largo | Responsabilidad y segunda oportunidad |
| Jugador | Uso, decisiones, contexto de tiros, faltas y carga | Perfil funcional y costes |
| Quinteto | Espaciado, ayudas, complementariedad, balance | Relaciones que no recoge una media de talento |

## 8.2 Fórmulas y unidades

Con definiciones de conteo consistentes:

- **PPP:** puntos / posesiones.
- **Rating ofensivo:** 100 × PPP. El defensivo utiliza puntos recibidos y posesiones rivales.
- **eFG%:** (tiros de campo anotados + 0,5 × triples anotados) / tiros de campo intentados.
- **3PA rate:** triples intentados / tiros de campo intentados.
- **TOV por posesión:** pérdidas / posesiones. No intercambiar con otras convenciones denominadas TOV%.
- **ORB%:** rebotes ofensivos / (rebotes ofensivos + rebotes defensivos rivales), siempre que los criterios de elegibilidad sean compatibles.
- **FT rate:** declarar si se usa FTA/FGA o FTM/FGA; son métricas distintas.
- **Pace normalizado:** posesiones por equipo referidas a una duración estándar. NBA lo expresa por 48 minutos. [D08](#d08--nba-glosario-estadístico)

El motor conoce sus eventos y puede contar posesiones directamente. Para actas sin secuencia se utiliza a veces la aproximación **FGA − OREB + TOV + α·FTA**. El factor α resume cuántos libres consumen oportunidades; valores convencionales como 0,44 no son una regla física ni deben imponerse a todas las competiciones. Libres técnicos, and-one, 1+1, tandas de tres y posesión retenida alteran la relación.

Tampoco equivale «posesiones por 40» a una proyección causal de un partido de 48 a 40 minutos: reglas, rotación, perfiles y selección pueden cambiar. La normalización sirve para comparar una tasa observada, no para inventar otra liga.

## 8.3 Datos reales comprobados: distintos usos, no una falsa comparación

### A. Evolución NCAA masculina Division I

La serie oficial consultada termina en 2025, aunque el documento esté incorporado a un paquete posterior. Promedios por equipo y partido: [D01](#d01--ncaa-tendencias-estadísticas-masculinas)

| Métrica | 2015 | 2025 |
|---|---:|---:|
| Puntos | 67,6 | 73,93 |
| Intentos de campo | 54,3 | 58,47 |
| Intentos de triple | 18,6 | 22,88 |
| Acierto triple | 34,5 % | 34,06 % |
| Acierto libre | 69,2 % | 72,04 % |
| Faltas | 18,2 | 16,81 |
| Pérdidas | 12,5 | 11,78 |

**Inferencia propia:** puede cambiar el volumen y la estructura ofensiva sin que mejore el porcentaje de triple. No representa un experimento que aísle el efecto de la reducción de reloj u otro cambio concreto.

### B. Un indicador NBA con su filtro explícito

NBA 2024-25, hasta **1-04-2025**: triples *catch-and-shoot*, media **37,4 %**. [D07](#d07--nba-tiros-202425)

No comparar una subcategoría filtrada y parcial con todos los triples de otra competición y deducir «diferencia de talento». El denominador y el corte temporal forman parte del dato. Este ejemplo se incluye precisamente porque el título de un artículo puede sugerir temporada completa cuando su tabla tiene una fecha anterior.

### C. FIBA: un perfil individual no es la media de un ecosistema

París 2024: Antetokounmpo, cuatro partidos, 25,8 puntos por partido, 67,8 % en tiros de campo. [D06](#d06--fiba-estadísticas-parís-2024)

Es un perfil individual seleccionado, no un objetivo para toda una liga ni un «factor FIBA». Si el generador atribuye esas tasas a todos los interiores, ha convertido una excepción de capacidad/uso en norma poblacional.

### D. Un acta para separar eficiencia y oportunidades

Final NCAA masculina, 7-04-2025: Florida 65–63 Houston. Florida: 21/53 de campo, 6/24 triples, 17/21 libres, 8 rebotes ofensivos y 13 pérdidas. Houston: 24/69, 6/25, 9/14, 15 y 9, respectivamente. [D02](#d02--florida-athletics-floridahouston-7-04-2025)

**Cálculo propio:** eFG de Florida = 24/53 = **45,28 %**; Houston = 27/69 = **39,13 %**. Tener más intentos no garantiza ganar. El estimador con α=0,44 daría 67,24 y 69,16 posesiones: son aproximaciones incompatibles con tratarlas como conteos exactos, no una autorización para ignorar la secuencia.

Estos ejemplos no constituyen una calibración completa NBA/FIBA/NCAA. Se han verificado datos concretos; no se ha descargado, limpiado y homologado un corpus completo de temporadas de los cuatro contextos.

## 8.4 Medir la táctica sin sesgo de etiqueta terminal

Una posesión puede contener ram → PnR → short roll → pase a esquina → penetración → corte. Si el proveedor la clasifica por el desenlace como «cut», no demuestra que el PnR no la originó.

**Propuesta de etiquetado:** origen, acciones intermedias, cobertura de cada acción, ventaja creada, acción terminal y desenlace. Mantener las categorías de un proveedor en su propia columna; no usarlas como verdad universal. NBA publica tablas por tipo de jugada. [D09](#d09--nba-tipos-de-jugada)

No sumar porcentajes de categorías solapadas esperando 100 %. Tampoco comparar «eficacia táctica» —por ejemplo generar un tiro— con FG% —anotarlo—. La ficha E08 muestra por qué es un error concreto, no solo terminológico.

## 8.5 Cuatro factores: resumen útil, causalidad incompleta

Tiro efectivo, pérdidas, rebote ofensivo y libres resumen rutas principales de eficiencia. Son útiles para diagnosticar un motor que anota demasiado o poco. No constituyen cuatro dados independientes:

- Atacar aro cambia faltas, pérdidas, tipo de tiro y ubicación de rebote.
- Aumentar presión cambia pérdidas forzadas, faltas y tiros concedidos cuando se supera.
- Cargar rebote cambia oportunidades propias y transición rival.
- Disponer tiradores cambia espacio para compañeros aunque no lancen.

Calibrar cada factor por separado sin preservar estas relaciones puede acertar el marcador y producir un baloncesto incoherente.

## 8.6 Incertidumbre: cuánta evidencia aporta una racha

**Cálculo didáctico propio.** Para intentos independientes con probabilidad fija p, el error estándar aproximado de la proporción es √[p(1−p)/n]. Si p=0,36 y n=1.000, un intervalo normal orientativo del 95 % tiene semianchura de unos **3,0 puntos porcentuales**; con n=100, unos **9,4**.

En partidos reales hay agrupación por jugador, quinteto, rival y estado; la independencia no suele cumplirse. La incertidumbre puede ser mayor y requiere modelos jerárquicos o remuestreo por unidades adecuadas. Mil acciones de un solo jugador no equivalen a mil jugadores independientes.

Consecuencias: no aprobar una táctica porque gane tres partidos; no rechazar un tirador tras 2/12; mostrar tamaño de muestra; separar incertidumbre de los parámetros y azar de una realización.

## 8.7 Protocolo de calibración propuesto

1. **Elegir referencia:** competición, sexo/categoría, temporada, fase y versión normativa. Una liga ficticia puede aspirar a parecerse a una población concreta sin copiar sus equipos.
2. **Fijar definiciones:** posesión, libre que consume posesión, rebote elegible, transición, tiro asistido y cobertura.
3. **Separar muestras:** ajuste, validación y prueba temporal/rivales no vistos. No recalibrar repetidamente usando el mismo conjunto de prueba.
4. **Ajustar mecanismos locales:** recepción, ventaja tras bloqueo, selección, oposición, rebote. Mantener restricciones legales exactas.
5. **Comprobar agregados:** distribuciones de ritmo, tiros, faltas, pérdidas, margen y prórrogas; no solo medias.
6. **Comprobar condicionales:** tiro por zona/oposición; pérdidas por presión; rebote según posición; fatiga según carga.
7. **Pruebas contrafactuales controladas:** variar una capacidad o política manteniendo comparables estados iniciales y rivales. No presentar el contrafactual simulado como efecto causal demostrado en la realidad.
8. **Buscar exploits:** extremos de táctica, quintetos artificiales, órdenes contradictorias y perfiles muy desiguales.
9. **Inspección humana de secuencias:** comprobar que las diferencias tienen una explicación visible.
10. **Versionar:** modelo, reglas, parámetros, datos y semillas de prueba.

## 8.8 Qué datos harían falta para la siguiente investigación empírica

| Fuente | Lo que permite | Lo que no permite por sí sola |
|---|---|---|
| Box score oficial | Resultados, intentos, faltas y rebotes | Coberturas, spacing, ayudas negadas |
| Play-by-play | Orden de eventos y tiempos registrados | Geometría completa o todas las acciones previas |
| Vídeo de partido | Codificación de acciones y responsabilidades | Coordenadas exactas sin medición; perspectiva puede ocultar jugadores |
| Tracking | Movimiento, separación y tiempos | Intención, comunicación o causalidad sin modelización |
| Etiquetado experto | Lecturas, coberturas y calidad de decisión | Ausencia de sesgo; exige acuerdo entre observadores |
| Tests físicos/técnicos | Capacidad en tarea controlada | Transferencia automática a todas las situaciones reales |

La disponibilidad pública no implica permiso para redistribuir datos, vídeos o modelos derivados de cualquier proveedor. Este dossier enlaza fuentes; no incorpora material audiovisual protegido ni una copia de bases propietarias.

## 8.9 Invariantes frente a comprobaciones estadísticas

**Invariantes:** reloj y sanciones consistentes; puntos reconciliados; participantes elegibles; probabilidades válidas; no asignar dos poseedores exclusivos del balón —un balón retenido/disputado es otro estado—; no continuar un período cerrado salvo resolución reglamentaria pendiente. Deben cumplirse siempre en estados aplicables.

**Expectativas estadísticas:** mejor tirador debe rendir mejor a igualdad de condiciones en muestras suficientes; mayor presión no debe producir siempre más victorias; defensa bien colocada debe modificar selección y/o dificultad. Son comparaciones probabilísticas, no aserciones de un partido aislado.

**Pruebas de propiedad útiles:** renombrar equipos no cambia rendimiento; intercambiar etiquetas de jugador conservando capacidades no crea bonus; reproducir estado, versión y aleatoriedad produce la misma secuencia; un rebote ofensivo no cuenta una posesión nueva según la convención adoptada.

No hace falta ejecutar millones de partidos en cada PR. Una suite breve de reglas y regresiones puede convivir con campañas de simulación más amplias al cambiar mecanismos. Esto respeta la metodología de entregas medianas sin renunciar a probar a fondo el núcleo.

---

# 09 — Del conocimiento del juego a un motor verificable

## 9.1 Alcance de este capítulo

Todo lo siguiente es **propuesta de diseño pendiente de discusión**, no implementación autorizada. El estudio permite definir responsabilidades y experimentos; no determina todavía fórmulas, escala de atributos, diseño de pantalla o arquitectura de clases.

El objetivo es un solo núcleo coherente de partido con piezas separables. La modularidad técnica no repite el error de construir tres modelos deportivos desconectados si tácticas y atributos operan sobre el mismo estado y las mismas acciones.

## 9.2 Ciclo causal propuesto

| Paso | Entrada | Salida | Restricción |
|---|---|---|---|
| 1. Percibir | Estado parcial, orientación, capacidades, comunicación | Información disponible para cada decisor | No leer futuro ni posiciones ocultas con exactitud perfecta |
| 2. Decidir | Información, plan, capacidades, tendencias, reloj | Intenciones coordinadas o incompatibles | Elegir entre acciones posibles, con errores plausibles |
| 3. Ejecutar | Intenciones de ambos equipos y geometría | Movimiento, pase, contacto, lanzamiento | Acciones simultáneas; límites físicos y técnicos |
| 4. Resolver | Interacción y aleatoriedad contextual | Hechos de juego | No sortear como independientes hechos incompatibles |
| 5. Adjudicar | Hechos y reglamento versionado | Legalidad, sanción, derecho al balón y relojes | Prioridad temporal y excepciones coherentes |
| 6. Registrar | Hechos, adjudicación y contexto | Narrativa, estadística y diagnóstico | Separar acta oficial de métricas analíticas |
| 7. Continuar | Nuevo estado y consecuencias | Próxima decisión, interrupción o cierre | Conservar memoria y posiciones relevantes |

El esquema es una responsabilidad lógica. En código puede requerir intercalar percepción y movimiento o resolver contactos antes de terminar una acción. No es una obligación de implementar siete servicios ni siete llamadas secuenciales rígidas.

## 9.3 Modelo temporal y espacial

| Opción | Ventaja | Problema |
|---|---|---|
| Un sorteo por posesión | Muy rápido | Difícil explicar ayudas, continuidad y creación de tiro |
| Cadena de eventos sin espacio | Fácil de registrar | «Esquina libre» o «roll defendido» pueden ser arbitrarios |
| Eventos con geometría simplificada | Representa ventanas, distancias y responsabilidades | Necesita convenciones espaciales y validación cuidadosa |
| Simulación física completa | Máximo detalle potencial | Coste enorme; detalle no garantiza decisiones realistas |

**Hipótesis de trabajo preferente:** estados y eventos de duración variable, con geometría suficiente y acciones concurrentes. Puede aproximarse a un proceso semi-Markov —el tiempo hasta la siguiente transición también importa— sin exigir un simulador biomecánico 3D.

Antes de elegir zonas o coordenadas, comprobar si se distinguen: lado fuerte/débil, esquina/ala/cabecera, poste/codo/short corner, carriles, distancia de ayuda, dirección del movimiento y línea de pase. Una cuadrícula que no distingue ángulos de bloqueo limitará las tácticas aunque tenga muchas casillas.

## 9.4 Contratos conceptuales mínimos

| Concepto | Debe expresar | No debe absorber |
|---|---|---|
| Perfil de reglas | Edición, geometría, relojes, faltas, reanudación | Calidad deportiva media de la liga |
| Estado de partido | Relojes, marcador, participantes, balón, sanciones pendientes | Historial completo duplicado en cada jugador |
| Perfil de jugador | Capacidades, morfología y tendencias estables | Resultado predeterminado de cada acción |
| Estado de jugador | Posición, equilibrio, carga y asignación actual | «Malo hoy» como explicación universal |
| Plan táctico | Roles, prioridades, desencadenantes y lecturas | Bonus de acierto por nombre de sistema |
| Acción/intención | Objetivo, participantes, geometría y ventana temporal | Canasta escogida de antemano |
| Evento resuelto | Qué ocurrió, cuándo, quién y por qué | Texto narrativo como única fuente de verdad |
| Política estadística | Cómo transformar eventos en acta | Alterar hechos para ajustar promedios |

## 9.5 Probabilidades: locales, condicionadas y compatibles

Una forma conceptual es:

**P(resultado siguiente, duración | estado, intenciones, capacidades, reglas).**

No es una fórmula calibrada. Señala que el resultado depende de condiciones y que el tiempo forma parte de la salida.

Ejemplo: para un pase, primero existe una línea y un receptor previsto; defensores pueden alcanzarla o no; la ejecución puede desplazar la trayectoria; la recepción puede ser limpia o incómoda. No hace falta modelar cada milímetro, pero sí evitar tres sorteos independientes que den a la vez pase interceptado, receptor controlando y asistencia.

Para un tiro con contacto, legalidad, acierto y libres están relacionados. Se necesita una distribución conjunta o un árbol condicional que permita and-one, fallo con falta, tapón legal y falta ofensiva cuando corresponda. Una secuencia arbitraria de porcentajes puede eliminar combinaciones reales o contar puntos dos veces.

## 9.6 Tácticas como políticas y acciones componibles

Un plan puede expresar: buscar PnR central con determinado par; si la defensa atrapa, ofrecer short roll y dos salidas; si cambia, valorar sello antes de aislar; si no hay ventaja con poco tiempo, simplificar. La defensa tiene sus propias políticas y también se equivoca.

Un nuevo sistema ofensivo debería poder componerse de acciones existentes antes de añadir una «probabilidad de sistema» exclusiva. Una nueva cobertura puede requerir ampliar roles o interacciones, pero no copiar un motor entero para esa táctica.

**Prueba de buena abstracción:** Spain necesita coordinar un bloqueo directo y uno sobre el defensor del roll; si solo puede representarse como «PnR + bonus», faltan responsabilidades sin balón.

## 9.7 Reproducibilidad de verdad

Guardar semilla no basta si cambian orden de evaluación, versión de reglas, algoritmo o consumo de aleatoriedad. Una reproducción requiere estado inicial, configuración, plantillas, políticas, versión y estado del generador aleatorio, además de un orden determinista de eventos simultáneos.

Para comparar dos tácticas, reutilizar semillas ayuda, pero sus secuencias pueden divergir y consumir números aleatorios de forma distinta. No prometer «exactamente la misma suerte» solo por igual semilla. Se pueden diseñar fuentes de aleatoriedad separadas y comparaciones por lotes, siempre documentando qué se ha emparejado.

## 9.8 Laboratorio de partido: interfaz de investigación

Debería permitir, cuando se apruebe su implementación:

- Definir equipos ficticios pequeños y reproducibles.
- Elegir reglamento y estado inicial, incluso una jugada a mitad de cuarto.
- Modificar una capacidad, rol o instrucción sin tocar todo el sistema.
- Avanzar acción a acción y ver movimientos/responsabilidades suficientes para comprenderla.
- Consultar reloj, bonus, opciones detectadas, ayudas y causa del resultado.
- Repetir el escenario y comparar lotes con incertidumbre.
- Exportar registro, resumen y semilla/versiones de una anomalía.

No necesita todavía una presentación audiovisual final. Sí necesita un recorrido funcional completo: configurar → ejecutar → observar → explicar → repetir. Sin él no podremos verificar manualmente que las tácticas afectan al juego de la forma prevista.

## 9.9 Banco de escenarios, no solo partidos enteros

| Grupo | Casos imprescindibles |
|---|---|
| Posesión | Rebote ofensivo, pérdida sin robo, tapón recuperado por ataque, transición frenada |
| Relojes | Tiro antes/después de bocina, airball, saque sin reset, reset tras aro, poco reloj de partido |
| Faltas | And-one, triple fallado con falta, control de equipo en bonus, técnica con reanudación |
| Libres | Intermedio, último vivo, 1+1, invasión, posesión retenida |
| Táctica | Drop con dos perfiles de base, blitz con dos short rollers, switch con/sin sello |
| Juego colectivo | Tag y pase a esquina, X-out, corte ante top-lock, error de comunicación |
| Capacidades | Mismo plan con distinta precisión, navegación, recepción o frenada |
| Rebote | Cerrar para compañero, rebote largo, palmeo, trade-off carga/balance |
| Excepciones | Encajado, doble falta, expulsión, revisión y fin con sanción pendiente |
| Robustez | Órdenes incompatibles, perfil extremo, jugada sin opción principal, estado inválido rechazado |

Los casos de reglas son pruebas exactas. Los de capacidades se evalúan con mecanismo visible y distribución de resultados; no exigen que el jugador mejor gane siempre una repetición.

## 9.10 Qué construir primero, después de discutir el estudio

Mi recomendación sigue siendo **el laboratorio del núcleo integrado antes de temporadas, contratos o países completos**. El primer corte representativo debería contener decisiones con balón y sin balón, una acción compartida, una respuesta defensiva, continuación, lanzamiento, rebote y consecuencias reglamentarias de su alcance.

No propongo implementar todas las familias de este dossier de golpe. Tampoco empezar por un uno contra uno que luego obligue a reinventar ayudas y roles. La unidad de entrega puede ser mediana y de una sola vertiente: una interacción colectiva que funcione de principio a fin en la interfaz.

La graduación concreta y el repertorio inicial quedan pendientes de nuestras decisiones. Cada bloque tendrá rama/PR, pruebas breves automáticas, recorrido manual tuyo, diseño/decisiones/changelog actualizados y prompt MD archivado antes de ejecución. **Este estudio no es ese prompt.**

---

# 10 — Partidos, formación y protocolo de observación

## 10.1 Qué se ha consultado y qué no

Se han contrastado actas, fragmentos de jugada a jugada y análisis escritos de fuentes oficiales. Los vídeos y clínicas están localizados y seleccionados por su utilidad; **no se afirma haber visionado ni codificado íntegramente esos materiales**. Tampoco se atribuyen marcas de tiempo de vídeo que no hayan sido verificadas.

El partido sirve para observar mecanismos; no demuestra por sí solo que una táctica sea superior. Un resumen de mejores jugadas selecciona aciertos y elimina posesiones fallidas, por lo que no permite estimar frecuencias.

## 10.2 Casos documentados

### FIBA/BCL — Tenerife–Derthona, 93–89 tras prórroga, abril de 2025

**Fuente consultada:** análisis táctico escrito de Diccon Lloyd-Smeath publicado por FIBA, con clips asociados. [D03](#d03--fiba-análisis-tenerifederthona)

El análisis describe cómo dos bloqueos flare amenazan las esquinas de una zona 3-2, desplazan defensores bajos y abren una recepción interior. También documenta coberturas agresivas sobre Huertas y pre-switch antes de la última acción del tiempo reglamentario. En otras secuencias, las ayudas sobre roll dejan oportunidades desde esquina.

**Lectura propia para el motor:** la misma defensa puede crear pérdidas y conceder tiros valiosos en otras posesiones. No hay contradicción: son dos ramas del coste de comprometer defensores. La respuesta ofensiva requiere detectar zona y coordinar jugadores lejos del balón.

**Qué revisar en vídeo:** posición inicial del low man, momento de salida a esquina y tiempo entre pase y recepción. No basta con etiquetar «zona vencida».

### FIBA/BCL — Unicaja–Rytas, 92–74, 4 de febrero de 2025

**Fuente consultada:** análisis escrito FIBA y registro del club. [D10](#d10--fiba-análisis-unicajarytas), [D11](#d11--unicaja-registro-de-partido)

El análisis destaca un sello de Kravish que impide que un defensor pequeño recupere su asignación tras cambio, facilitando la penetración de Carter. Describe también interiores de Unicaja conteniendo a la altura del bloqueo sin comprometer completamente un hedge, atentos al pase al roll.

**Lectura propia:** una acción que acaba en uno contra uno puede ser profundamente colectiva: un compañero evita la reparación defensiva. El motor necesita conservar asignaciones, sellos y líneas de ayuda después del switch.

**Qué revisar:** cuándo el sello es legal, qué camino impide y qué hubiese pasado si el atacante hubiera iniciado tarde. No atribuir todo el resultado al rating del anotador.

### NCAA masculina — Florida–Houston, final de 2025

**Acta, primera mitad:** Houston falla a 18:24 y 18:19; rebote ofensivo a 18:21 y 18:15; tiro taponado a 18:12; rebote defensivo a 18:08. [D02](#d02--florida-athletics-floridahouston-7-04-2025)

La secuencia permite probar continuidad; reconstruir posiciones requiere vídeo.

### NCAA femenina — UConn–South Carolina, final de 2025

**Fuente consultada:** acta oficial universitaria, 6 de abril, 82–59. [D12](#d12--uconn-athletics-final-femenina-2025)

Se selecciona como material para contrastar ataque, rotación y continuidad en un contexto de cuatro cuartos y bonus diferente al masculino. **No se presenta un diagnóstico táctico completo de este partido.** Al revisar vídeo, aplicar la misma plantilla de observación y comparar mecanismos, sin asumir de antemano un estilo por sexo.

### FIBA selecciones — Estados Unidos–Serbia, semifinal olímpica de 2024

**Fuente contrastada:** ficha oficial, 95–91, 8 de agosto. [D04](#d04--fiba-estados-unidosserbia-8-08-2024)

Material propuesto para revisar cambios de quinteto, decisiones de final y evolución del partido. La remontada no demuestra por sí sola momentum psicológico; para explicarla hacen falta decisiones, tiro, defensa y variabilidad. No se han codificado aquí todas sus posesiones.

### NBA — Indiana–Oklahoma City, primer partido de las Finales de 2025

**Resultado contrastado:** Indiana 111–110 Oklahoma City, 5 de junio. [D05](#d05--nba-indianaoklahoma-city-5-06-2025)

Se enlaza también un análisis oficial con vídeo. [D13](#d13--nba-análisis-audiovisual-de-finales-2025)

**Objetivo de observación propuesto:** separar presión defensiva, seguridad de recepción, pérdidas, selección de tiro y cambios entre fases. El marcador final no permite inferir la calidad de cada decisión. No se utiliza una remontada como prueba de un multiplicador oculto.

## 10.3 Material formativo seleccionado

| Material | Acceso y alcance comprobados | Utilidad para nuestro trabajo |
|---|---|---|
| WABC/FIBA, manuales niveles 1–3 | Índice oficial con versiones en varios idiomas; no lectura integral de todos los PDF | Construir vocabulario y progresión técnico-táctica |
| Glosario/manual breve WABC en español | Documento consultado | Acordar términos antes de crear etiquetas del juego |
| Catálogo WABC de clínicas | Ponentes y temas verificados; vídeos no visionados íntegramente | Revisar soluciones y responsabilidades colectivas |
| USA Basketball, recursos de habilidades y coaching | Catálogos y fichas localizados; algunas páginas exponen solo metadatos | Contrastar fundamentos y tareas de entrenamiento |
| NBA Video Rulebook | Portal oficial consultado | Examinar ejemplos arbitrales; prevalece el reglamento escrito |
| Interpretaciones FIBA y casos NCAA | Documentos oficiales consultados en los apartados relevantes | Crear pruebas de situaciones límite |

Fuentes: [C01](#c01--wabcfiba-catálogo-de-manuales), [C02](#c02--wabc-glosariomanual-breve-en-español), [C03](#c03--wabc-clínicas-de-entrenadores), [C04](#c04--usa-basketball-formación-técnica), [C05](#c05--usa-basketball-motion-offense), [C06](#c06--nba-video-rulebook), [R14](#r14--fiba-official-basketball-rules-interpretations-2024), [R15](#r15--ncaa-major-rules-differences-202526), [R16](#r16--ncaa-mens-basketball-case-book), [R17](#r17--ncaa-mens-basketball-rules-changes-202526--202627), [R18](#r18--ncaa-womens-basketball-rules-book), [R19](#r19--ncaa-official-basketball-statistics-rules-202526). Un curso disponible no se presenta como curso completado. No se han adquirido suscripciones ni accedido a contenido de pago no autorizado.

### Clínicas concretas del catálogo WABC

- **Jesse Mermuys:** spacing y decisiones de exteriores.
- **Stan Van Gundy:** defensa del pick-and-roll; construcción del sistema defensivo.
- **Damian Cotter:** fundamentos defensivos.
- **Cheryl Chambers:** respuesta a presión defensiva.
- **Chris DeMarco:** bloqueos sin balón.
- **Joshua Longstaff:** cinco abiertos y lectura defensiva.
- **Lindsey Harding:** ataque. [C03](#c03--wabc-clínicas-de-entrenadores)

**Ruta propuesta, no tarea obligatoria para ti:** aclarar principios y terminología; revisar una familia ofensiva; su defensa; estudiar dos secuencias donde funciona y dos donde falla; traducirlas a observables. Acumular nombres de jugadas sin contralecturas aporta poco al motor.

## 10.4 Plantilla de codificación de una posesión

| Campo | Registro |
|---|---|
| Identificación | Partido, fuente, período y reloj oficial; timestamp de vídeo verificado por separado |
| Contexto | Marcador, bonus, quintetos, fatiga observable si procede |
| Origen | Saque, rebote, robo, otra recuperación |
| Estado inicial | Colocación, emparejamientos, superioridad y orientación |
| Plan aparente | Etiqueta provisional; no confundir inferencia con instrucción conocida |
| Acciones | Orden y simultaneidad de pases, cortes, pantallas, ayudas |
| Cobertura | Comportamiento observado, no solo nombre supuesto |
| Ventaja | Qué cambia, cuándo y durante cuánto tiempo |
| Decisión | Opciones visibles; opción elegida; información posiblemente oculta |
| Ejecución | Recepción, pase, contacto, equilibrio y tiempo |
| Desenlace | Tiro, falta, pérdida, rebote, interrupción, continuación |
| Responsabilidad | Contribuciones múltiples; confianza de la atribución |
| Duda | Cámara incompleta, secuencia omitida, discrepancia arbitral/estadística |

Conviene codificar también posesiones neutras, errores y acciones abortadas. Para estimar frecuencias, seleccionar una muestra antes de saber qué resultado nos interesa. Si participan varios observadores, fijar definiciones y medir acuerdo; resolver desacuerdos sin borrar su existencia.

## 10.5 Vocabulario mínimo para discutir juntos

| Término | Significado operativo |
|---|---|
| Spacing | Distancias y ocupación que permiten amenazas y líneas de pase |
| Timing | Coincidencia temporal entre acción y ventana útil |
| Advantage / ventaja | Estado favorable aprovechable, no garantía de anotación |
| Gravity / atracción | Atención defensiva causada por una amenaza creíble |
| POA | Punto inicial de contención del balón |
| Low man | Ayuda más baja del lado débil con responsabilidad sobre aro/roll |
| Nail | Zona central próxima a la línea de tiros libres, relevante para ayuda |
| Tag | Intervención breve sobre continuador para retrasarlo |
| Closeout | Aproximación defensiva al receptor/tirador con control del siguiente movimiento |
| Short roll | Continuación corta para recibir y decidir antes de llegar al aro |
| Live-ball turnover | Pérdida con balón vivo que permite transición inmediata |
| Dead-ball turnover | Pérdida con interrupción y reanudación |
| ATO / BLOB / SLOB | Tras tiempo muerto / saque de fondo / saque lateral |
| EPV | Valor esperado de la posesión desde el estado actual |

El vocabulario sirve para comunicarnos; los contratos del motor deben describir comportamiento y no depender de que todos los entrenadores utilicen exactamente el mismo nombre.

---

# 11 — Auditoría del diseño anterior y decisiones para después

## 11.1 Qué se ha comparado

Se ha revisado el documento histórico `01-DESIGN-1-.md`, especialmente su sección 7. Es material de contexto del proyecto anterior, **no fuente científica ni especificación vigente del nuevo BeManager**. Esta auditoría corrige afirmaciones y supuestos; no modifica aquel archivo ni el repositorio.

## 11.2 Qué conservar y qué revisar

| Elemento anterior | Evaluación | Recomendación razonada |
|---|---|---|
| Simular posesiones en vez de generar solo resultado final | Base aprovechable | Añadir acciones, continuidad y juego sin balón dentro de ellas |
| Cinco jugadores reales en pista, sin bonus artificial de titular | Conservar principio | Minutos, roles, emparejamientos y fatiga determinan participación |
| Parámetros separados de interfaz | Conservar principio | Distinguir configuración de reglas, población y calibración |
| FIBA = unas 82–83 posesiones porque NBA tiene unas 99 en 48 minutos | Extrapolación no validada | Medir población FIBA de referencia; igualdad de reloj no implica igualdad de ritmo |
| Apuntar a 14–15 segundos medios derivados de esa extrapolación | No aceptar como objetivo empírico | Dejar emerger duración de acciones; validar distribución, no corregir hacia una cifra no demostrada |
| 24 segundos como límite duro de toda posesión | Confunde reloj con posesión | Una posesión puede prolongarse tras rebotes ofensivos y otras reanudaciones |
| Ligas mediante modificadores multiplicativos | Insuficiente | Bonus, alternancia, tres segundos defensivos y relojes necesitan reglas discretas |
| Todas las fórmulas como datos en CONFIG | Decisión técnica no exigida por el baloncesto | Parametrizar lo que deba ajustarse; reglas tipadas/versionadas pueden ser más seguras que un lenguaje de fórmulas |
| Porcentajes de liga usados como interceptos de tiro | Confusión estadística | Son mezclas de jugadores, selección y defensa; no probabilidades intrínsecas de un tirador neutro |
| Brazos largos penalizan siempre el tiro | No demostrado por los ejemplos citados | No convertir selección de unas estrellas en ley antropométrica |
| Impuesto extra de agilidad por encima de 2,05–2,10 m | Hipótesis sin umbral universal y riesgo de doble conteo | Usar capacidades de movimiento y geometría; validar relaciones poblacionales por separado |
| Presión aumenta universalmente peso mental a costa de técnica | Hipótesis, no conclusión científica | Identificar tarea, persona y mecanismo; la técnica sigue siendo necesaria bajo presión |
| Experiencia suma puntos mentales automáticamente | No validado como ley universal | Diferenciar conocimiento adquirido, adaptación y perfil individual |
| Consistencia como ruido independiente por posesión | No produce necesariamente el efecto pretendido | Distinguir azar de tiro, variación entre acciones y estados persistentes |
| Recuperación solo entre partidos | Omite parte del partido | Banco, pausas y tramos de baja intensidad también permiten recuperar |
| Trabajo en equipo no interviene en partido | Exclusión demasiado amplia | Sí importa por sincronización y responsabilidad, sin bonus global obligatorio |
| Contraataque como bonus en los primeros tres segundos | Representación arbitraria y restringida | Usar superioridad, posición, velocidad y organización defensiva |
| Ataque rápido implica peor tiro; elaborado, mejor | No universal | Una transición puede dar bandeja; una posesión larga puede terminar en tiro forzado |
| Bonus de racha individual/equipo por anotaciones recientes | No justificado por defecto | Separar evidencia, contexto y variabilidad; evitar retroalimentación artificial |
| Reset de faltas colectivas al empezar prórroga FIBA | Error reglamentario | Se acumulan con el cuarto período: 2024 art. 41.1.3; 2026 art. 42.1.3 [R01](#r01--fiba-official-basketball-rules-2024), [R02](#r02--fiba-official-basketball-rules-2026) |
| Ningún partido de baloncesto puede terminar empatado | Excesivamente absoluto | Contemplar la particularidad FIBA de eliminatorias a doble partido [R02](#r02--fiba-official-basketball-rules-2026) |
| PnR, tiempos muertos y falta táctica para un bloque posterior ajeno al motor | Repite la separación que quieres evitar | Diseñar sus contratos y consecuencias en el mismo modelo, aunque se implemente gradualmente |

## 11.3 Por qué «más ruido» no equivale a «jugador irregular»

**Demostración conceptual propia.** Supongamos que en cada tiro se sortea una probabilidad nueva e independiente `Pᵢ`, y después el acierto `Yᵢ` con esa probabilidad. Si todos esos sorteos tienen la misma media `p`, entonces `P(Yᵢ=1)=E(Pᵢ)=p`.

Si también hay independencia entre tiros, el número de aciertos de n tiros sigue siendo binomial con parámetro p. Variar cuánto fluctúa `Pᵢ` alrededor de p no crea por sí solo correlación entre aciertos ni partidos extraordinariamente buenos/malos. Recortar probabilidades a 0/1 o aplicar transformaciones puede cambiar la media, pero ese es otro efecto.

Para representar variación persistente haría falta algo compartido entre tiros —estado de partido del jugador, fatiga, rival, calidad cambiante de tiros— o una dependencia explícita. Eso **no autoriza** a inventar mano caliente: obliga a definir qué fenómeno se quiere reproducir y con qué evidencia. [E04](#e04--miller-y-sanjurjo-2018), [E05](#e05--schilling-2019)

## 11.4 Ocho decisiones que el estudio deja preparadas, no cerradas

1. **Unidad de simulación:** eventos con duración y geometría suficiente, frente a otras alternativas.
2. **Visibilidad para el usuario:** cuánto mostramos de intención, lectura, oposición y causalidad sin convertir la interfaz en una consola técnica.
3. **Repertorio inicial:** qué interacción colectiva permite probar el núcleo sin introducir todos los sistemas a la vez.
4. **Atributos finales:** qué dimensiones del inventario aportan diferencias observables y cuáles se agrupan.
5. **Control del entrenador:** principios, roles, coberturas y ajustes; cuánto puede improvisar el jugador.
6. **Aleatoriedad y estados:** qué variabilidad es puramente de ejecución y qué debe persistir.
7. **Población de referencia:** qué Europa ficticia queremos aproximar y con qué datos mediremos plausibilidad.
8. **Criterios de aprobación:** escenarios obligatorios, rangos estadísticos y recorrido manual antes de fusionar.

No te pido decidirlos ahora. El objetivo del documento es que podamos discutirlos con un mapa compartido y ejemplos concretos.

## 11.5 Orden de conversación recomendado

Primero acordar cómo se representa una posesión y qué debe explicar. Después elegir la primera interacción ofensiva-defensiva y el conjunto mínimo de capacidades que la diferencia. A continuación fijar qué observaremos en el laboratorio y cómo sabremos que funciona. Solo entonces transformar decisiones aprobadas en un prompt de implementación delimitado.

Eso preserva la idea central de tu metodología: **nosotros decidimos el juego; Claude Code implementa lo acordado y se detiene ante decisiones de diseño ausentes**.

---

# 12 — Fuentes y trazabilidad

**Fecha de consulta y corte:** 25-09-2026. Los enlaces pueden actualizarse; conservar edición, título y fecha, no solo URL. Los números de referencia son estables dentro de este dossier.

**Alcance de acceso:** «texto consultado» significa que se revisaron pasajes relevantes del documento original, no una auditoría integral de cada página; «resumen/ficha» limita las conclusiones a lo accesible; «catálogo» acredita disponibilidad y temas, no la realización del curso o visionado completo. Un fallo técnico de recuperación no equivale a que la fuente no exista.

## 12.1 Reglamentos y manuales estadísticos

### R01 — FIBA, Official Basketball Rules 2024

[Reglamento oficial, v1.0a](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf). PDF, 105 páginas; texto consultado. Referencias relevantes: arts. 8, 12, 14, 17–19, 24–31, 34–43; art. 41.1.3 para faltas en prórroga. Soporta la comparación normativa y la corrección del diseño histórico.

### R02 — FIBA, Official Basketball Rules 2026

[Reglamento oficial, v1.1](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2026-v1-1.pdf). PDF, 108 páginas; texto consultado. Aplicable desde 1-10-2026. Referencias relevantes: art. 8; categorías de faltas de arts. 36–39; art. 42 para faltas colectivas. No confundir numeración con 2024.

### R03 — FIBA, cambios y entrada en vigor de 2026

[Documento oficial de cambios](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2026-rule-changes-v10a.pdf) y [anuncio de entrada en vigor](https://about.fiba.basketball/en/news/fiba-official-basketball-rules-2026-to-take-effect-october-1). Texto consultado. Sirven para identificar la transición normativa; el reglamento consolidado prevalece sobre un resumen.

### R04 — FIBA, Statisticians’ Manual 2024

[Manual oficial de estadística](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf). Texto consultado. Referencia para posesión estadística, intentos, rebotes y clasificación de eventos; no es un reglamento de pista.

### R05 — NBA, Official 2025–26 Playing Rules

[Reglamento de temporada](https://cdn.nba.com/manage/2026/01/Official-2025-26-NBA-Playing-Rules.pdf). Texto consultado. [Índice oficial](https://official.nba.com/rulebook/). La edición fechada permite fijar referencia frente a páginas web susceptibles de actualización.

### R06 — NBA, Rule 7: Shot Clock

[Reloj de lanzamiento](https://official.nba.com/rule-no-7-24-second-clock/). Texto consultado. Resets y continuidad del reloj; ejemplos relevantes para rebote ofensivo, interrupciones y saques.

### R07 — NBA, Rule 12: Fouls and Penalties

[Faltas y sanciones](https://official.nba.com/rule-no-12-fouls-and-penalties/). Texto consultado. Bonus, prórrogas, excepciones de final, faltas de transición y categorías especiales.

### R08 — NBA, Rule 10: Violations and Penalties

[Violaciones](https://official.nba.com/rule-no-10-violations-and-penalties/). Texto consultado. Tres segundos defensivos y otras restricciones. Complementa la geometría y los relojes de la edición completa.

### R09 — NBA, Rule 5: Scoring and Timing

[Puntuación y tiempos](https://official.nba.com/rule-no-5-scoring-and-timing/). Texto consultado. Duración, tiempos muertos y administración temporal.

### R10 — NBA, Rule 6: Putting Ball in Play — Live/Dead Ball

[Balón vivo/muerto y puesta en juego](https://official.nba.com/rule-no-6-putting-ball-in-play-live-dead-ball/). Texto consultado. Referencia para estados de balón y reanudación.

### R11 — NBA, Rule 9: Free Throws and Penalties

[Tiros libres](https://official.nba.com/rule-no-9-free-throws-and-penalties/). Texto consultado. Administración y consecuencias de infracciones durante libres.

### R12 — NBA, Rule 11: Basket Interference — Goaltending

[Interferencias](https://official.nba.com/rule-no-11-basket-interference-goaltending/). Texto consultado. Diferencia entre tapón, trayectoria e interferencia.

### R13 — NBA, Rule 14: Coach’s Challenge

[Revisión solicitada por entrenador](https://official.nba.com/rule-no-14-coachs-challenge/). Texto consultado. Categorías y condiciones; no supone revisión universal.

### R14 — FIBA, Official Basketball Rules Interpretations 2024

[Interpretaciones oficiales](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-obri-v10a.pdf). PDF, 142 páginas; consulta de documento y estructura. Fuente para verificar casos límite al convertir el catálogo en pruebas. No se presenta cada caso del dossier como transcripción de un ejemplo oficial.

### R15 — NCAA, Major Rules Differences 2025–26

[Comparativa oficial](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/rules/common/2025-26PRXBB_MajorRulesDifferences.pdf). Tabla consultada y páginas relevantes inspeccionadas. Principal apoyo a la separación NCAA masculina/femenina; incluye comparación con otros marcos que aquí no se desarrollan.

### R16 — NCAA, Men’s Basketball Case Book

[Casos oficiales masculinos](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/rules/men/PRMBB_CaseBook.pdf), enlazados desde el [portal reglamentario masculino](https://www.ncaa.org/championships/playing-rules/mens-basketball-playing-rules/). Texto consultado en casos pertinentes. El PDF principal masculino no se recuperó correctamente; no se declara una lectura integral de ese reglamento. Las afirmaciones se apoyan en la comparativa, cambios y casos accesibles.

### R17 — NCAA, Men’s Basketball Rules Changes 2025–26 / 2026–27

[Cambios oficiales](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/rules/men/2025-26PRMBB_RulesChanges.pdf). Texto consultado. Acto de tiro, lugares de saque, interferencia y revisión.

### R18 — NCAA, Women’s Basketball Rules Book

[Reglamento femenino](https://ncaaorg.s3.amazonaws.com/championships/sports/basketball/rules/women/PRWBB_RulesBook.pdf), enlazado desde el [portal femenino](https://www.ncaa.org/championships/playing-rules/womens-basketball-playing-rules/). Texto consultado. Regla 5 para cuartos/prórroga; apartados de bonus, reloj y reanudación. Consultar edición interna del PDF antes de reutilizar este enlace mutable.

### R19 — NCAA, Official Basketball Statistics Rules 2025–26

[Manual estadístico](https://s3.amazonaws.com/fs.ncaa.org/Docs/stats/Stats_Manuals/Basketball.pdf). Texto consultado. Sección 5 de asistencias y apartados de rebotes/pérdidas. Importante para no equiparar acta oficial con una narración simplificada.

## 12.2 Investigaciones originales y trabajos académicos

### E01 — Cervone, D’Amour, Bornn y Goldsberry (2016)

*A Multiresolution Stochastic Process Model for Predicting Basketball Possession Outcomes*. JASA. [Repositorio de autores](https://arxiv.org/abs/1408.0777). DOI: [10.1080/01621459.2016.1141685](https://doi.org/10.1080/01621459.2016.1141685). Ficha/resumen y descripción metodológica consultados. Tema: EPV y proceso multirresolución.

### E02 — Franks, Miller, Bornn y Goldsberry (2015)

*Characterizing the spatial structure of defensive skill in professional basketball*. Annals of Applied Statistics. [Repositorio](https://arxiv.org/abs/1405.0231). DOI: [10.1214/14-AOAS799](https://doi.org/10.1214/14-AOAS799). Ficha y descripción metodológica consultadas. Tema: defensa espacial y limitaciones del box score.

### E03 — Skinner (2012)

*The Problem of Shot Selection in Basketball*. PLOS ONE. [Artículo original](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0030776). DOI: 10.1371/journal.pone.0030776. Texto consultado. Tema: selección secuencial bajo reloj.

### E04 — Miller y Sanjurjo (2018)

*Surprised by the Hot Hand Fallacy? A Truth in the Law of Small Numbers*. Econometrica. [Versión de autores depositada en 2019](https://arxiv.org/abs/1902.01265). DOI: [10.3982/ECTA14943](https://doi.org/10.3982/ECTA14943). Ficha y argumento metodológico consultados. Distinguir año de publicación y depósito.

### E05 — Schilling (2019)

*Is Basketball a Game of Runs?* [Preprint original](https://arxiv.org/abs/1903.08716). Resumen consultado; no se atribuye revisión por pares no verificada. Tema: rachas máximas NBA 2016-17 frente a procesos aleatorios.

### E06 — Nunes y colaboradores (2022)

*The Pick-and-Roll in Basketball From Deep Interviews of Elite Coaches: A Mixed Method Approach From Polar Coordinate Analysis*. [Texto original en PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8997293/). Texto y métodos consultados. Tema: observación y juicio de entrenadores sobre PnR.

### E07 — Marmarinos, Apostolidis, Kostopoulos y Apostolidis (2016)

*Efficacy of the “Pick and Roll” Offense in Top Level European Basketball Teams*. Journal of Human Kinetics. [Resumen bibliográfico](https://pubmed.ncbi.nlm.nih.gov/28149375/) y [página de la revista](https://johk.pl/?p=3822). DOI: 10.1515/hukin-2015-0176. Acceso principal a resumen; recuperación íntegra del PDF fallida. Solo muestra y conclusiones generales verificadas.

### E08 — Amatria, Iván-Baragaño, Losada y Maneiro (2025)

*Analysis of the use, effectiveness, and efficiency of the pick and roll in elite women’s basketball*. Frontiers in Sports and Active Living. [Texto original](https://pmc.ncbi.nlm.nih.gov/articles/PMC12078336/). DOI: 10.3389/fspor.2025.1553270. Texto y métodos consultados. Precaución: muestra reducida y descripción problemática de procedencia audiovisual; no calibrar directamente con sus tasas.

### E09 — Cao y colaboradores (2024)

*Effects of brief mindfulness intervention on mental fatigue and recovery in basketball tactical performance*. PLOS ONE. [Artículo](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0306815). DOI: 10.1371/journal.pone.0306815. PDF y métodos consultados. Tema: tarea experimental, fatiga mental y desempeño táctico.

### E10 — Li, Zhang y Zheng (2026)

*Effects of mental fatigue on basketball decision-making and visual search behavior*. Frontiers in Psychology, 27 de julio. [Texto original](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1837100/full). DOI: 10.3389/fpsyg.2026.1837100. Texto y métodos consultados. Tema: decisiones en vídeo, experiencia y eye-tracking.

### E11 — Wiens, Balakrishnan, Brooks y Guttag (2013)

*To Crash or Not To Crash: A quantitative look at the relationship between offensive rebounding and transition defense in the NBA*. MIT Sloan Sports Analytics Conference. [Ficha del congreso](https://www.sloansportsconference.com/research-papers/to-crash-or-not-to-crash); [PDF alojado por la autora](https://www-personal.umich.edu/~wiensj/papers/SSAC2013.pdf). Texto consultado. Tema: rebote, balance y asociación observacional.

### E12 — Ben Abdelkrim, El Fazaa y El Ati (2007)

*Time–motion analysis and physiological data of elite under-19-year-old basketball players during competition*. British Journal of Sports Medicine. [Artículo](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658931/); [registro bibliográfico](https://pubmed.ncbi.nlm.nih.gov/17138630/). DOI: 10.1136/bjsm.2006.032318. Texto recuperado con accesibilidad intermitente; no se importan coeficientes fisiológicos.

### E13 — Li, Yang, Mi y Li (2025)

*The effects of repeated sprints on mid-range and three-point jump shot biomechanics in elite basketball players*. PeerJ. [Texto original](https://pmc.ncbi.nlm.nih.gov/articles/PMC12435330/). DOI: 10.7717/peerj.19983. Métodos y resultados consultados. Los conteos se presentan como datos del experimento, no como efecto generalizable.

### E14 — Harle y Vickers (2001)

*Training Quiet Eye Improves Accuracy in the Basketball Free Throw*. The Sport Psychologist. [Página original de la revista](https://journals.humankinetics.com/abstract/journals/tsp/15/3/article-p289.xml). DOI: 10.1123/tsp.15.3.289. Resumen indexado consultado; texto integral no recuperado. Uso conceptual limitado.

### E15 — Daly-Grafstein y Bornn (2020)

*Using in-game shot trajectories to better understand defensive impact in the NBA*. Journal of Sports Analytics, 6, 235–242. [PDF de autores](https://www.lukebornn.com/papers/dalygrafstein_jsa_2020.pdf). DOI: 10.3233/JSA-200400. Texto consultado. Tema: oposición, trayectoria y evaluación defensiva.

### E16 — Pelechrinis y Goldsberry (2021)

*The Anatomy of Corner 3s in the NBA: What makes them efficient, how are they generated and how can defenses respond?* [Repositorio original](https://arxiv.org/abs/2105.12785). Ficha y resumen consultados. Trabajo de taller académico; no se trata como ensayo causal.

### E17 — Conte, Tessitore, Gjullin, Mackinnon, Lupo y Favero (2018)

*Investigating the game-related statistics and tactical profile in NCAA division I men’s basketball games*. Biology of Sport, 35(2), 137–143. [Página editorial](https://www.termedia.pl/Investigating-the-game-related-statistics-and-tactical-profile-in-NCAA-r-ndivision-I-men-s-basketball-games,78,31036,1,1.html); [resumen](https://pubmed.ncbi.nlm.nih.gov/30455541/). DOI: 10.5114/biolsport.2018.71602. Ficha/resumen consultados; tablas no auditadas.

### E18 — Bourbousson, Sève y McGarry (2010)

*Space–time coordination dynamics in basketball: Part 2. The interaction between the two teams*. Journal of Sports Sciences, 28(3), 349–358. [Ficha editorial](https://www.ingentaconnect.com/content/routledg/rjsp/2010/00000028/00000003/art00013); [repositorio institucional](https://nantes-universite.hal.science/hal-03289132). DOI: 10.1080/02640410903503640. Metadatos/resumen indexados; repositorio con acceso técnico bloqueado. Uso conceptual, no cuantitativo.

## 12.3 Formación y recursos arbitrales audiovisuales

### C01 — WABC/FIBA, catálogo de manuales

[WABC Coaching Documents](https://about.fiba.basketball/en/wabc-documents). Catálogo oficial consultado. Incluye niveles 1, 2 y 3 y materiales en español/inglés/francés. Algunos PDF extensos no pudieron recuperarse; no se atribuye lectura integral.

### C02 — WABC, glosario/manual breve en español

[Documento oficial](https://assets.fiba.basketball/image/upload/documents-corporate-wabc-coaches-manual-esp.pdf). PDF breve consultado. Referencia terminológica, no catálogo exhaustivo de todas las variantes tácticas.

### C03 — WABC, clínicas de entrenadores

[Catálogo oficial de vídeos](https://about.fiba.basketball/en/wabc-videos). Ponentes y temas verificados; los vídeos se proponen para estudio, no se presentan como visionados íntegros.

### C04 — USA Basketball, formación técnica

[Recursos de fundamentos](https://www.usab.com/coaching/coaching-resources/skills-drills-coaching-foundational) y [catálogo avanzado de ataque](https://www.usab.com/coaching/coaching-resources/skills-drills-coaching-advanced-offense). Catálogos localizados; acceso al cuerpo de algunas páginas limitado. Referencia para ampliación, no prueba cuantitativa.

### C05 — USA Basketball, motion offense

[4 Keys to an Effective Motion Offense](https://www.usab.com/news/2014/01/4-keys-to-an-effective-motion-offense), 2014. Título/fecha verificados; cuerpo no expuesto en recuperación. Se enlaza como lectura pendiente, sin atribuirle afirmaciones detalladas.

### C06 — NBA Video Rulebook

[Portal oficial de ejemplos](https://videorulebook.nba.com/). Consultada presentación del recurso. Sus ejemplos ayudan a interpretar contacto e infracciones, pero no reemplazan el reglamento escrito.

## 12.4 Datos y partidos

### D01 — NCAA, tendencias estadísticas masculinas

[Statistical Trends](https://s3.amazonaws.com/fs.ncaa.org/Docs/stats/m_basketball_RB/Trends.pdf), desde el [portal oficial](https://www.ncaa.org/championships/statistics-and-records/mens-basketball/). Tabla y página relevante inspeccionadas. Serie consultada hasta 2025; datos por equipo/partido, no por posesión.

### D02 — Florida Athletics, Florida–Houston, 7-04-2025

[Acta y play-by-play oficiales](https://floridagators.com/sports/mens-basketball/stats/2024-25/houston/boxscore/27303). Totales y secuencia inicial consultados. Fuente de las cifras y ejemplo de continuidad de 08/10.

### D03 — FIBA, análisis Tenerife–Derthona

Diccon Lloyd-Smeath. [Tactics Board: Three takeaways from Tenerife’s OT win](https://www.fiba.basketball/en/news/tactics-board-three-takeaways-from-tenerifes-ot-win), abril de 2025. Análisis escrito consultado; no codificación independiente del vídeo.

### D04 — FIBA, Estados Unidos–Serbia, 8-08-2024

[Ficha oficial de semifinal olímpica](https://www.fiba.basketball/en/events/mens-olympic-basketball-tournament-paris-2024/games/122606-USA-SRB). Resultado y contexto contrastados; partido completo no codificado.

### D05 — NBA, Indiana–Oklahoma City, 5-06-2025

[Ficha oficial](https://www.nba.com/game/0042400401). Resultado contrastado.

### D06 — FIBA, estadísticas París 2024

[Estadísticas oficiales del torneo masculino](https://www.fiba.basketball/en/events/mens-olympic-basketball-tournament-paris-2024/stats). Tabla consultada; perfil individual usado con muestra explícita.

### D07 — NBA, tiros 2024–25

[Best shooters of the 2024-25 season](https://www.nba.com/news/best-shooters-of-the-2024-25-season). Tabla consultada.

### D08 — NBA, glosario estadístico

[Glosario oficial](https://www.nba.com/stats/help/glossary). Definición de pace.

### D09 — NBA, tipos de jugada

[Tablas de transición](https://www.nba.com/stats/teams/transition). Catálogo, no dataset descargado.

### D10 — FIBA, análisis Unicaja–Rytas

[Tactics Board: Three takeaways from Unicaja’s win over Rytas Vilnius](https://www.fiba.basketball/en/news/tactics-board-three-takeaways-from-unicajas-win-over-rytas-vilnius). Análisis escrito consultado. Soporta el ejemplo de sellado después del cambio y defensa del pase al roll.

### D11 — Unicaja, registro de partido

[Unicaja–Rytas, 4-02-2025](https://www.unicajabaloncesto.com/en/game/show/id/202425047). Registro oficial del club; fecha y marcador contrastados mediante resultado indexado.

### D12 — UConn Athletics, final femenina 2025

[UConn–South Carolina, acta y play-by-play](https://uconnhuskies.com/sports/womens-basketball/stats/2024-25/south-carolina/boxscore/24860). Ficha consultada; selección como material de observación, no análisis táctico íntegro.

### D13 — NBA, análisis audiovisual de Finales 2025

[Finals Film Study: How the Pacers’ offense bounced back in Game 1](https://www.nba.com/news/finals-film-study-how-the-pacers-offense-bounced-back-in-game-1). Artículo consultado.

## 12.5 Correspondencia rápida entre preguntas y fuentes

| Pregunta | Fuentes de entrada | Capítulo canónico |
|---|---|---|
| ¿Qué es legal y bajo qué versión? | R01–R03, R05–R18 | 01 |
| ¿Qué cuenta como posesión, asistencia o pérdida? | R04, R19 | 02 |
| ¿Cómo estudiar tácticas y contralecturas? | C01–C04, E06–E08, D03, D10 | 03–05 |
| ¿Qué capacidades tienen mecanismos plausibles? | E09–E15, E18 | 06–07 |
| ¿Por qué no basta el porcentaje de tiro? | E01–E03, E15–E17 | 07–08 |
| ¿Qué hacer con rachas y consistencia? | E04–E05 y demostración propia | 07 y 11 |
| ¿Cómo comprobar el acta y la continuidad? | R04, R19, D02 | 02 y 08 |
| ¿Qué materiales revisar después? | C01–C06, D02–D05, D10–D13 | 10 |

## 12.6 Límites de trazabilidad

Las tablas tácticas son una síntesis analítica original de conceptos de baloncesto; no se presentan como una transcripción de una clínica ni como resultados experimentales cuantificados. Las fórmulas didácticas y cálculos propios se identifican como tales. Los ejemplos hipotéticos están separados de partidos documentados. Los documentos no accesibles íntegramente no se usan para inventar cifras o conclusiones de sus tablas.

Los enlaces NBA de estadísticas pueden cargar dinámicamente o cambiar por temporada. Antes de una calibración real debe conservarse exportación autorizada, filtros, fecha y definición de cada campo. Este dossier aporta un mapa de investigación; no declara haber construido ese dataset.
