# ME-01 — Primera posesión integrada y Laboratorio de Partido

**Destino literal de este prompt en BeManager:** docs/prompts/implementation/ME-01-primera-posesion-integrada.md
**Repositorio:** https://github.com/bateman37/BeManager
**Rama:** match/me-01-primera-posesion-integrada
**PR sugerida:** ME-01: primera posesión 5v5, perfiles manuales y laboratorio
**Estado de este texto:** prompt de implementación. Guárdalo íntegro antes de ejecutarlo.

## 0. Instrucción y orden de trabajo

Implementa **una única entrega vertical**: desde la interfaz se crean y editan jugadores ficticios de laboratorio y se juega una posesión 5v5 de bloqueo directo central contra drop, con atributos, ayuda, tiro, falta ordinaria de tiro si ocurre, rebote, continuación, relato y repetición. Incluye una resolución rápida **solo de este escenario**, para validar pronto el contrato compartido. No implementes todavía un partido de cuarenta minutos ni un mundo/temporada.

1. Inspecciona main, estado del árbol, ramas, código y rutas reales. Conserva cualquier trabajo ajeno. Parte de main limpio; crea la rama indicada. Si ya existe trabajo en curso, no lo sobrescribas: detente y explícalo.
2. **Antes de tocar código o documentación de producto**, copia este prompt de forma íntegra y literal a la ruta indicada arriba; versiona esa copia en la rama. Un prompt ejecutado nunca se reescribe retroactivamente. Si no puedes guardarlo, detente.
3. Sigue las reglas vigentes de CLAUDE.md y del proceso del repositorio. Si alguna instrucción de este prompt choca con una regla superior del repo o un hecho comprobado del código, muestra el conflicto y aplica su precedencia; no lo resuelvas inventando una regla deportiva.
4. Trabaja en esa sola rama, con commits coherentes. Abre una PR al acabar si tienes acceso; **no la fusiones**. Dennis ejecutará las pruebas manuales y decidirá si entra en main.

## 1. Lectura delimitada

Ruta inicial obligatoria: CLAUDE.md → este prompt ya guardado → docs/README.md. Lee después solo:

- Proceso: docs/process/WORKFLOW.md, DEFINITION_OF_DONE.md, DOCUMENTATION_STANDARD.md y TESTING_STRATEGY.md; docs/prompts/README.md.
- Arquitectura: docs/foundation/MATCH_CORE_PRINCIPLES.md, CURRENT_SCOPE.md y COMPETITION_ECOSYSTEMS.md (solo la separación de ecosistemas); docs/architecture/TECHNICAL_ARCHITECTURE.md, MODULE_BOUNDARIES.md y DATA_AND_PERSISTENCE.md; modules/README.md.
- Plan activo: docs/match/roadmap.md, secciones 1–2, ME-01 en §4, §§5–7.
- Motor de referencia: docs/match/reference/BeManager-del-estudio-al-motor-de-partidos-v1.md, §§1.2, 4–6, 7.1–7.2, 8.1–8.2, 9.1–9.7, 12.1–12.4, 13.1–13.2, 14.1–14.2, 16.1–16.2 y 17.3–17.6.
- Tácticas: docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md, §§1, 2.1–2.3, 3.1 y 3.3, 4.2–4.3, 5, 6.2 y 9.1–9.2.
- Atributos: docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md, §§1–3, 4.2–4.5 para los sucesos afectados, 5, 6.1, 7–8. Consulta filas concretas del mapa P01–P76 únicamente cuando implementes una de ellas.
- Reglamento: docs/match/reference/BeManager-estudio-baloncesto-v1.md, capítulo 01 §§1.1, 1.4–1.5; capítulo 02 §§2.2–2.5; capítulos 05 §§5.1 y 5.3. Para una sanción exacta consulta la fuente oficial FIBA 2026 que enlaza el estudio, no una regla recordada de 2024.

Opcional solo ante una duda técnica concreta: ADR vigentes, código de salud de Foundation, las secciones 13.3–13.6 del documento del motor o las interpretaciones FIBA 2026 citadas por el estudio.

**Fuera de lectura:** DESIGN.md del juego anterior, CLAUDE.odt histórico, prompts FND-001 ejecutados, capítulos completos de fuentes no citadas, NCAA/NBA detallado, ligas, mercado y carrera. No cargues los cuatro grandes documentos de referencia de principio a fin en cada sesión; usa secciones y búsquedas acotadas.

## 2. Decisiones deportivas cerradas para ME-01

### Qué es el laboratorio

- El mismo núcleo de dominio será reutilizado por los futuros partidos. No hagas una demo que el juego deba desechar.
- Perfil de reglas identificado como **FIBA 2026**. La primera entrada comienza ya en media pista, en el primer cuarto, con 7:12 en el reloj de partido y 18 segundos de lanzamiento. Se distinguen tiempo interno, relojes reglamentarios y tiempo de presentación.
- Dos equipos ficticios con **cinco jugadores cada uno** en pista. Cada participante tiene ubicación/orientación y una responsabilidad; mantenerse abierto, negar un pase o conservar una marca también es trabajo sin balón. No teletransportar jugadores a coordenadas ideales.
- Ofensiva 4-out/1-in: O1 manejador, O5 bloqueador y continuador, O2 esquina del lado del balón, O3 esquina débil, O4 ala débil. La defensa es individual; D1 persigue a O1, D5 espera en drop y D2/D3/D4 conservan sus asignaciones. D3 es el último ayudador sobre el roll desde la esquina débil; si sale, deja a O3. D4 puede intentar reparar esa salida, dejando a O4. D2 sostiene el lado fuerte. Todas las ayudas consumen tiempo y trayecto.
- Convención espacial de este fixture: cancha 28 × 15 m, origen en esquina inferior de la línea de fondo izquierda, ataque hacia x creciente y aro atacado centrado en (26,425; 7,5) m. Posiciones iniciales en metros: O1 (18,0; 7,5), O2 (24,0; 1,1), O3 (24,0; 13,9), O4 (18,0; 12,5), O5 (20,2; 8,6); D1 (19,1; 7,5), D2 (23,4; 1,5), D3 (23,4; 11,3), D4 (19,0; 12,2), D5 (22,3; 7,7). O5 llega y coloca su pantalla antes de que O1 la utilice; ni pantalla ni drop son posiciones teletransportadas. Las dos variantes de ayuda arrancan de **idéntico** estado: solo cambia la instrucción. El caso de closeout tardío carga el estado después de que D3 haya comprometido su ayuda y O3 esté disponible; no fuerza un pitido por identificador de escenario.
- Única instrucción defensiva editable en esta entrega: **D3 ayuda al continuador: sí/no**. Drop permanece fijo. No trampa, switch, zonas, ICE ni presión todavía.
- Árbol ofensivo, orden de prioridad entre opciones **percibidas y viables**: (1) finalizar si O1 ya tiene carril al aro antes de D5; (2) pasar a O5 si gana al perseguidor por al menos 0,2 s, existe línea y D3 no anuló la recepción; (3) si D3 deja a O3, pasar a esa esquina cuando recepción y preparación anticipen el closeout por al menos 0,25 s; (4) triple de O1 si está **detrás de la línea FIBA**, el drop concede al menos 0,25 s de ventana y T04 ≥9; (5) salida segura a O4/O2 según línea y tiempo. Si O1 está dentro de la línea sin estar cerca del aro, no inventes un tiro de media distancia: busca otra salida. Si una opción se frustra, se conserva el tiempo consumido y se evalúa la siguiente, sin reiniciar posiciones. Con ≤2 s, lanzar solo si hay uno de los dos tipos de tiro implementados y es legal/preparable; de lo contrario vence el reloj. M03 puede preferir la segunda opción legal según LAB-0.1 y la tendencia individual; nunca convierte una opción imposible en pase válido. Tras rebote ofensivo, O5 puede intentar palmeo/finalización si llega al balón o sacar a receptor alcanzable; misma lógica de tiempos, sin recomenzar el bloqueo original. Una lectura no garantiza pase ni canasta.
- El desenlace de cada rama generable debe tener **estado legal**: control conservado, pérdida viva, tiro anotado, fallo seguido de rebote ofensivo/defensivo, tapón elegible con balón vivo, falta de tiro con sus libres y continuación, balón fuera de banda/fondo con último toque y saque adjudicado como estado terminal del laboratorio, o fin por reloj. No simules aún el saque posterior: el laboratorio termina en un estado de reanudación legal y lo identifica. Rebote ofensivo conserva la misma posesión estadística e inicia otra fase con posiciones heredadas; cuando el tiro tocó aro, reloj de lanzamiento según FIBA 2026. No cortar tras un rebote ofensivo ni inventar una pérdida para salir del bucle; un guardián de progreso informa de anomalía y exporta contexto.
- **Ámbito de faltas generado ahora:** solo contacto defensivo ordinario sancionable en acto de tiro. Canasta válida con falta → un libre adicional; tiro fallado de dos o tres → los libres que procedan; último libre fallado vivo → disputa. No generar otras familias de falta si no están adjudicadas. Un bloqueo del balón legal o una contestación vertical no son automáticamente falta; no sortear canasta, tapón y falta como eventos independientes incompatibles.
- Hechos adjudicados, métricas, diagnóstico y texto son proyecciones separadas. El relato es español, comprensible y **por pasos**; describe qué hizo cada participante relevante y qué espacio quedó libre. No narra una jugada que el motor no produjo.

### Los jugadores que hacen creíble el escenario

Crear dos equipos y diez perfiles **fijos, escritos a mano y editables**. Los datos siguientes son diseño de laboratorio, no biografías ni ratings extraídos de jugadores reales. Unidad de altura, envergadura y alcance: cm; peso: kg. Los números de capacidades son internos (1–15) y la interfaz muestra E−…A+ según §2.1 del documento de atributos.

Aplica la plantilla G (base), W (exterior/alero) o B (interior); después los overrides explícitos de cada fila. **No rellenes ninguna capacidad activa con random ni con un 8 por defecto oculto.** Solo son editables y aparecen en ficha las 26 capacidades activas de las tablas siguientes; las restantes del catálogo v2 figuran en documentación como candidatas, sin rating ficticio ni efecto silencioso.

| Equipo | ID | Nombre ficticio | Edad | Posición/plantilla | Altura | Peso | Envergadura | Alcance de pie | Overrides 1–15 |
|---|---|---|---:|---|---:|---:|---:|---:|---|
| Sierra Clara | O1 | Izan Marea | 27 | Base / G | 189 | 85 | 195 | 248 | T09=13, M01=12, T06=11 |
| Sierra Clara | O2 | Darío Soler | 25 | Escolta / W | 195 | 87 | 202 | 255 | T04=13, T11=12, T22=8 |
| Sierra Clara | O3 | Adriel Varo | 28 | Alero / W | 201 | 96 | 209 | 263 | T21=12, M05=12, T01=11 |
| Sierra Clara | O4 | Bruno Nemec | 30 | Ala-pívot / W | 205 | 103 | 214 | 271 | T04=11, T13=10, T19=10, F05=10, T23=9 |
| Sierra Clara | O5 | León Uria | 29 | Pívot / B | 211 | 113 | 223 | 282 | T13=13, T01=12, T20=12, F05=13 |
| Puerto Ámbar | D1 | Omar Celis | 26 | Base / G | 188 | 83 | 194 | 246 | T22=12, T16=12, T15=11 |
| Puerto Ámbar | D2 | René Lasko | 27 | Escolta / W | 194 | 89 | 202 | 254 | T22=11, T17=10, T04=9 |
| Puerto Ámbar | D3 | Elian Feliu | 25 | Alero / W | 200 | 95 | 210 | 265 | M05=11, T18=8, F01=11 |
| Puerto Ámbar | D4 | Tarek Vela | 31 | Ala-pívot / W | 206 | 105 | 216 | 273 | T23=11, M05=12, T19=11, T04=7 |
| Puerto Ámbar | D5 | Niko Baran | 32 | Pívot / B | 210 | 111 | 222 | 280 | T23=13, T18=12, F06=11, T04=4 |

| Plantilla | T01 | T04 | T05 | T06 | T07 | T09 | T11 | T13 | T21 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G | 8 | 9 | 10 | 10 | 12 | 12 | 10 | 5 | 8 |
| W | 9 | 10 | 9 | 9 | 8 | 8 | 10 | 7 | 10 |
| B | 11 | 5 | 8 | 6 | 5 | 7 | 9 | 12 | 7 |

| Plantilla | T15 | T16 | T17 | T18 | T19 | T20 | T22 | T23 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| G | 8 | 8 | 8 | 3 | 5 | 6 | 9 | 4 |
| W | 9 | 9 | 8 | 6 | 8 | 8 | 10 | 7 |
| B | 8 | 6 | 5 | 11 | 11 | 11 | 6 | 12 |

| Plantilla | M01 | M03 | M04 | M05 | F01 | F03 | F04 | F05 | F06 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| G | 11 | 10 | 10 | 9 | 11 | 10 | 10 | 6 | 6 |
| W | 9 | 9 | 9 | 10 | 10 | 10 | 9 | 8 | 9 |
| B | 8 | 8 | 10 | 9 | 7 | 7 | 6 | 12 | 10 |

Las tablas cierran **26 capacidades**: 9 ofensivas, 8 defensivas/rebote, 4 mentales y 5 físicas. No crear un atributo «talento general». Posición y plantilla inicial ayudan a poblar los diez perfiles; después el motor consulta las capacidades individuales, no un bonus por llevar etiqueta G/W/B. G/W/B no serán los únicos arquetipos del futuro sistema de ME-07.

Se permite crear, modificar, duplicar y guardar jugadores/equipos de laboratorio desde la interfaz. Incluye una sola tendencia individual pertinente: **elección PnR** «priorizar primera opción» o «explorar segunda opción», independiente de M03 y visible en ficha; O1 comienza con la segunda y los otros nueve con la primera. «Explorar» activa únicamente la probabilidad M03 de LAB-0.1 entre dos opciones ya viables; «priorizar» la deja en cero. Al modificar un jugador, se conserva el perfil guardado y se crea un **snapshot nuevo para la ejecución**: repetir una corrida antigua no reescribe sus participantes. El editor da avisos sin bloquear excepciones intencionadas: pívot nominal por debajo de 195 cm, base nominal con T09 ≤5, alcance de pie menor que la altura, envergadura inferior a altura−10 cm o superior a altura+35 cm, o peso adulto inferior a 60 kg o superior a 150 kg. Los diez perfiles preparados no generan esos avisos. Nunca corrige una medida o rating a escondidas.

## 3. Hipótesis numéricas del laboratorio, perfil LAB-0.1

El estudio no da coeficientes causales universales. Estos valores **son hipótesis provisionales de prototipo para verificar mecanismos**, no porcentajes de liga FIBA. Regístralos como parámetros tipados/versionados con unidades, ámbito, valor y prueba; no como constantes repartidas por componentes, ni como un editor admin todavía. Si un mecanismo necesita otro coeficiente deportivo no especificado aquí, muestra DECISIÓN REQUERIDA en lugar de elegirlo tú. No modifiques estos valores silenciosamente para que «salgan estadísticas bonitas».

- En fórmulas, d(X)=rating(X)−8; rango −7…+7. Valor igual entre países y modos. No multiplicar todos los ratings como si 15 fuese 100 %.
- Movimiento inicial de un atacante: 3,4 + 0,10·d(F01) m/s; lateral defensivo: 2,8 + 0,08·d(F04) m/s. Tiempo extra de frenada de un closeout: max(0,06; 0,16−0,01·d(F03)) s. T21 reduce el tiempo de salida sin balón en 0,012·d(T21) s cuando hay ruta. Las posiciones se actualizan con pasos internos máximos de 100 ms y fronteras de evento exactas; nadie cruza cuerpos/pantallas ni aparece directamente en su objetivo.
- Latencia de reconocer una oportunidad: acotar a 0,10–0,40 s la expresión 0,25−0,008·d(M01)−0,005·d(M05). M03 altera **solo la elección entre dos opciones percibidas y viables**: probabilidad de preferir la segunda opción acotada a 0,03–0,20 como 0,10−0,006·d(M03). No da información omnisciente. M04 cambia en 0,01·d(M04) s la coordinación del bloqueo y su continuación, aplicado una vez.
- Si el perseguidor intercepta un **bloqueo legal preparado y realmente colocado**, retraso acotado a 0,04–0,55 s: 0,24+0,017·d(T13)+0,009·d(F05)−0,017·d(T16). C02 interviene únicamente en contacto corporal plausible: sumar 0,001 s por kg de diferencia bloqueador-defensor, acotado a ±0,03 s en este mecanismo. No sumar el retraso si no hay contacto/intersección. El drop es posición y responsabilidad, no multiplicador de acierto.
- Ante presión **real y balón expuesto**, probabilidad de perder control: acotar a 0,01–0,16 la expresión 0,06−0,004·d(T07)+0,005·d(T15). Con una línea de pase y un defensor **físicamente elegible** por posición, orientación y C03, opción de tocar el balón: acotar a 0,01–0,30 la expresión 0,12+0,015·d(T17)−0,005·d(T09). Un toque no es necesariamente robo; balón desviado sigue su trayectoria y requiere control. Sin defensor elegible, no sortear robo.
- Pase liberado con vuelo a 11 m/s: probabilidad de error de trayectoria acotada a 0,01–0,14 como 0,05−0,003·d(T09)+0,02·presión (presión 0 o 1 según defensor presente y elegible). Una recepción limpia se resuelve una vez con probabilidad acotada 0,60–0,99 como 0,90+0,006·d(T11)−0,06·presión. Si no es limpia, control incómodo y 0,3 s de demora; el balón solo se pierde si un defensor llega realmente antes del nuevo control. T06 reduce en 0,012·d(T06) s la preparación de un tiro tras bote/movimiento; no suma después otro bonus al acierto.
- Duraciones de preparación LAB-0.1: O5 coloca pantalla legal en 0,30 s **después de llegar**; liberar un pase consume 0,18 s; tiro tras recepción controlada 0,55 s, tiro tras bote/movimiento 0,70−0,012·d(T06) s, finalización desde menos de 2 m del aro 0,40 s tras entrar legalmente en su espacio, libre 2,0 s desde balón a disposición. Son tiempos de acción, se descuentan de los relojes mientras corren; no representan la duración de una posesión o de un libre ya detenido.
- Un error de trayectoria desvía 0,6 m el objetivo de recepción hacia izquierda o derecha con azar reproducible, y vuelve a comprobar alcance, defensores y control; no concede una pérdida automática. El orden es liberar → trayectoria real → posibles toques elegibles → recepción/control o balón vivo. Si un pase o tapón deja balón suelto, resuelve llegada y control con las reglas de recepción T11 o captura T20 ya definidas; no añade otra lotería de «robo» independiente.
- T22 ajusta 0,010·d(T22) s la llegada inicial a recepción/closeout exterior; T23 ajusta 0,010·d(T23) s la protección y recepción interior; T15 ya influyó en contención iniciada. Estos ajustes pueden ser negativos y se aplican en **tiempos de llegada**, nunca como otros multiplicadores de porcentaje. Orientación, distancia y rol determinan si cada uno interviene.
- Para intervención vertical usar alcance de mano C04 + salto ejecutable; techo inicial del salto: 0,25+0,02·F06 metros, limitado por tiempo y posición. La altura de liberación de un tiro preparado usa como hipótesis 0,25·C01+0,75·C04 (misma unidad) más el salto **que se ejecutó en esa acción**, nunca más que la mano alcanzable. Para recibir un balón alto, la ventana cómoda para el cuerpo llega hasta 0,55·C01+0,45·C04, y el máximo de tocarlo sigue limitado a C04+salto disponible; recepción fuera de la ventana cómoda es control incómodo según T11, nunca bonus plano por centímetros. Así C01 puede alterar liberación/recepción aun con C04 constante, mientras C04 define alcance máximo. C03 solo en ventanas laterales/diagonales compatibles con orientación; no hay bonus final de «altura». T18 interviene solo si la mano defensora puede tocar un balón lanzado; probabilidad de desvío acotada a 0,02–0,30 como 0,12+0,012·d(T18). Si hay tapón, no sortear además canasta de ese mismo lanzamiento.
- Tipos de lanzamiento disponibles: finalización cercana de dos puntos (base 0,60, T01) y triple (base 0,34, T04). Probabilidad acotada a 0,04–0,82: base+0,017·d(capacidad de tiro)−0,18·oposición. Oposición = 0 si nadie llega, 0,5 si cierre parcial, 1 si el defensor alcanza y contesta legalmente antes de soltar; sale de tiempos, orientación y alcance, no del nombre de la cobertura. El libre, sin oposición, usa acotación 0,40–0,94 de 0,74+0,017·d(T05). Son interceptos de laboratorio, **no medias observadas de una liga**.
- Tras tiro fallado que toca aro, generar primero salida con semilla: radial 0,8–2,5 m desde aro para tiro cercano, 2–5 m para triple; tiempo de vuelo 0,8 s y 1,1 s, respectivamente. Dirección base desde aro hacia punto de tiro, más variación sembrada uniforme entre −π/2 y +π/2; si sale de la cancha, registra último toque y estado de saque según regla, sin colocar artificialmente el balón dentro. Si queda en cancha, resolver acceso por trayectoria/tiempo y C04+salto, sin adjudicar primero el reboteador. Un cierre legal y próximo retrasa acceso rival en acotación 0,02–0,35 s de 0,16+0,012·d(T19)+0,008·d(F05); C02 solo interviene durante contacto corporal realmente producido, según el mismo límite ±0,03 s del bloqueo. T20 interviene al controlar: probabilidad de captura acotada 0,45–0,96 de 0,78+0,015·d(T20)−0,12·disputa (0/1 según rival elegible). Si falla, balón suelto/palmeado y nueva disputa desde posiciones presentes. Quien cierra puede no ser quien captura. Un tiro taponado antes de tocar aro no recibe el reset de 14 s por esta regla.
- Contacto sancionable en acto de tiro: decidir por **hecho de contacto y posición/legalidad**, una vez por interacción; no una probabilidad de falta cada 100 ms. Preparar un caso de laboratorio de closeout tardío e ilegal donde se pueda alcanzar esta rama. La adjudicación FIBA 2026 determina continuidad y libres. No generar faltas especiales ni falta de bloqueo en este perfil; una pantalla inválida no se convierte en «pantalla legal que produce bonus»: rechaza la configuración o la acción.

Son valores editables **como datos versionados por el desarrollo**, no controles para quien dirige el equipo. Toda calibración posterior requerirá aprobación y escenarios comparativos; el admin visual vendrá más adelante. No añadir atributos ajenos a esta matriz sin decidir antes cuál es su mecanismo y prueba.

## 4. Motor, relato y modo rápido de escenario

Organiza el primer módulo en **modules/match/** con domain/application/infrastructure/ui siguiendo los límites vigentes; composición y ruta web en src/app/. Dominio TypeScript puro, sin React/Next/Prisma/reloj real/Math.random. Un propietario serial de cada corrida y azar inyectado con estado reproducible. Define entrada de partido y perfiles de reglas/estadística versionados sin montar servicios NBA o universitarios todavía. La diferencia entre reglas de pista, formatos de competición y población de jugadores debe ser explícita en contratos y documentación.

Persistencia: usa PostgreSQL/Prisma **en infrastructure** para equipos y perfiles de laboratorio y, si hace falta, entrada/semilla de escenarios guardados; migración versionada. No crees aún modelos de Club, Player de carrera, contrato o liga. El partido en ejecución conserva su snapshot y hechos en memoria; no escribe cada movimiento en la base. Las pruebas automáticas y npm run check funcionan sin PostgreSQL activo. Si falta base, la interfaz informa y el guardado falla de forma clara, sin fallback efímero engañoso ni exposición de DATABASE_URL.

La vista principal debe tener: enlace desde la portada; dos equipos y quintetos; editor sencillo agrupado de medidas, ofensivos, defensivos/rebote, mentales y físicos **activos**; selector ayuda sí/no; semilla visible; ejecutar, paso siguiente, repetir misma entrada y comparar cambio; cancha 2D esquemática; reloj/posesión/marcador del escenario; relato cronológico por hechos; detalle seleccionable «quién estaba dónde, qué se ordenó y qué se concedió». No exige dibujo avanzado, animación, identidad visual final ni menús de temporada. En pantalla estrecha las zonas se apilan sin ocultar botones o texto.

Proporciona tres escenarios cargables desde la interfaz, sin resultados prefijados: **drop con ayuda**, **drop sin ayuda** y **closeout tardío con contacto de tiro**. Sus geometrías iniciales, roles y condiciones se guardan como datos; un resultado sigue dependiendo de lectura, ejecución y semilla, nunca de un guion que fuerza canasta. Un escenario bajo reloj puede alcanzar violación si no surge tiro legal. Etiqueta en relato y diagnóstico cuándo el bloqueo fue útil, si D3 llegó, qué marca dejó, quién intentó reparar, tipo de tiro y causa del rebote. Una buena defensa puede impedir recepción sin registrar robo.

La resolución rápida de **esta acción**, visible en una comparación de lotes pequeños del laboratorio, usa los mismos snapshots, roles, reglas y funciones de tiro/libre/rebote. Calcula una vez por etapa los tiempos de llegada analíticos con las velocidades, posiciones iniciales y retrasos LAB-0.1, sin avanzar diez trayectorias cada 100 ms; hereda la siguiente etapa del último estado calculado, sin resetear ubicaciones ni reloj. No introduce otros coeficientes ni una probabilidad sustitutiva de «táctica exitosa». Cuenta acciones que realmente representa: bloqueo, ayuda/no ayuda, pase al roll o esquina, tiros, pérdidas, rebotes y faltas ordinarias de tiro soportadas. Muestra agregados y tamaño de muestra, **sin relato por jugada, boxscore de partido ni posiciones inventadas**. No llames motor rápido completo a este experimento: ME-08 lo ampliará. Un cambio en ayuda debe alterar dónde aparece la oportunidad en ambos modos, aunque una sola semilla no garantice igual resultado.

## 5. Invariantes y pruebas de aceptación

Automatiza solo los riesgos de esta entrega, con Vitest y casos pequeños:

1. Escala 1–15 y 15 letras exactas; validación de perfiles y medidas; fixture del repositorio sin generación aleatoria.
2. Mismo snapshot/semilla/versión → mismos hechos deportivos y estadística en detallado; velocidad de lectura, animación o relato no alteran la secuencia.
3. Ningún balón con dos dueños; diez asignaciones sin teletransporte; tiempos positivos o progreso visible; puntos/libres y rebotes coherentes con hechos.
4. Ayuda de D3 deja a O3 y la posible reparación de D4 deja a O4; un defensor lejano no toca un pase/tiro; T18 no aumenta todas las oposiciones sin tapón viable.
5. C01 influye en cuerpo/liberación/recepción con C04 medido fijo, sin añadir una segunda mano más alta al alcance de C04; captura de rebote exige llegar. T22, T23 y T15 afectan tareas distintas.
6. Tiro acertado, fallo con rebote ofensivo o defensivo, pérdida viva, tapón con control posterior, falta de tiro con canasta+libre o fallo+libres y violación de reloj terminan o continúan de forma válida según FIBA 2026. No activar casos adicionales sin tratamiento.
7. La aproximación rápida registra solo categorías que genera; el resultado detallado produce texto desde hechos, el rápido no tiene secuencia narrativa. En muestras comparables, variar la ayuda cambia las oportunidades por un mecanismo comprensible.
8. Persistencia de perfil por interfaz: tras guardar y recargar se recuperan los valores; una corrida iniciada antes de un cambio mantiene su snapshot. Un fallo de base devuelve error controlado.

Si una prueba estocástica es necesaria, fija semillas y compara **mecanismo/condición o lotes razonables**; no exijas que un único lanzamiento acierte por mejorar un grado. No añadas Playwright ni una batería de miles de partidos a cada cambio. La validación manual de Dennis sigue siendo obligatoria.

## 6. Documentación y prueba manual de Dennis

- Crear **docs/match/reference/README.md** como índice de los cuatro estudios ya presentes, con enlace relativo a cada nombre real, propósito, estado (investigación/propuesta, no cuatro especificaciones activas contradictorias) y secciones necesarias para ME-01. No copiar su contenido ni cambiar esas cuatro referencias.
- Crear **docs/match/README.md** como índice del módulo y ruta de lectura por tarea. Extraer las decisiones aprobadas y el alcance implementado a documentos activos pequeños: modelo y hechos, reglas FIBA 2026 alcanzables, acción PnR/drop, capacidades activas y parámetros LAB-0.1, escenarios y validación. Si uno supera ~250 líneas, dividirlo y actualizar índices. Indicar explícitamente qué partes de los 76 sucesos y 45 candidatas NO están implementadas.
- Actualizar docs/README.md, docs/foundation/CURRENT_SCOPE.md (FND-001 ya no es la entrega vigente), docs/roadmap/ROADMAP.md enlazando docs/match/roadmap.md, docs/prompts/README.md, modules/README.md, documentación de arquitectura si el módulo real aporta contratos nuevos, y CHANGELOG.md. Mantener el roadmap con estado correcto sin reescribir su historia. ADR solo si la decisión técnica duradera no está cubierta por las ADR actuales.
- Crear docs/testing/manual/ME-01-manual-test-plan.md, en español para **Windows PowerShell**, con comandos concretos para cambiar a la rama, npm ci, revisar .env sin sobrescribirlo, migrar PostgreSQL, npm run dev y abrir la URL. Pasos desde pantalla: cargar los diez jugadores, crear/editar/guardar uno, recargar, ejecutar ayuda sí y no, avanzar el relato, ver trabajo de los diez, repetir mismo seed, cambiar T09 y C01 por separado, inspeccionar rebote y falta/libres, comparar lote rápido y probar fallo de guardado si la BD no está disponible. Para cada paso: esperado, campo «resultado real» y señal que implicaría rechazar PR. Dennis hará esta prueba personalmente; no declares que la ha superado tú.
- Ejecuta npm ci, npm run prisma:generate, npm run check sin base activa, y el recorrido manual que puedas hacer con PostgreSQL local. Informa qué pruebas has realizado de verdad, errores y límites; no marques como verde lo que no pudiste ejecutar. Si una migración requiere BD, pruébala cuando esté disponible y deja pasos PowerShell claros para Dennis.

## 7. Criterio de cierre y exclusiones

La PR está lista para que Dennis la pruebe cuando la **interfaz** permita crear un jugador, guardar, cargar escenario 5v5, ver una posesión completa con diez responsabilidades, leer el relato, variar ayuda/capacidad, repetir y comparar el escenario rápido limitado. Deben pasar las comprobaciones de reglas/invariantes del alcance, migración y documentación. Deja el árbol limpio, commits y PR listos, pero no fusiones.

**Fuera de ME-01:** partido entero, banquillo y sustituciones, trampa/switch/zona, transición entre varias posesiones, generación poblacional y equipos completos, admin visual de coeficientes, países y ligas, contratos, mercado, NBA/NCAA funcionales, motor 3D, texto generativo y herramientas de despliegue. Si una dependencia hace inevitable abrir alguna de esas vertientes, detente con DECISIÓN REQUERIDA y propone el corte más pequeño que mantenga una experiencia completa en la interfaz.

Al finalizar responde en español con: qué puedo probar desde la interfaz, rama y commits, PR o bloqueo de publicación, documentos creados/actualizados, pruebas realmente ejecutadas y sus resultados, limitaciones conocidas, ruta al plan manual y cualquier DECISIÓN REQUERIDA pendiente. **No solicites fusionar ni des por hecha mi aceptación funcional.**
