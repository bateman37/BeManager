# Changelog

Formato libre en español, orden cronológico inverso. Los motivos de
decisiones duraderas viven en `docs/decisions/`, no aquí.

## ME-02 — Trampa, salidas reales y tres correcciones de ME-01 (sin fusionar)

- Guardado el prompt de implementación en
  `docs/prompts/implementation/ME-02-trampa-y-salidas-con-correcciones-me01.md`.
- **C1 (contacto/falta de tiro):** la legalidad del cierre ya no compara
  solo dos marcas de reloj. Se reconstruye la posición real del defensor
  en el instante de liberación (`positionAtInstant`) y solo hay contacto u
  oposición si su espacio corporal (radio LAB-0.2 de 0,35 m por jugador)
  se solapa de verdad con el del tirador. O5 recorre de verdad su
  continuación desde la pantalla hasta el short roll real `(23,0; 7,5)` en
  vez de finalizar desde la posición del bloqueo. Rechaza el falso
  contacto geométrico que producía ~982-983 faltas/1500 corridas con ayuda
  frente a 0 sin ayuda.
- **C2 (esquina débil alcanzable):** O5, tras recibir el pase, activa una
  segunda lectura real (misma geometría de contacto que C1): si D3
  realmente contiene el roll, O5 puede invertir hacia O3 en la esquina
  débil sin reiniciar el reloj. Con ayuda, un lote de 1500 corridas
  demuestra al menos un pase a la esquina; sin ayuda, nunca se regala O3.
- **C3 (estadística conciliada):** nuevo hecho `field_goal_attempt`,
  separado de la oportunidad de tiro (`shot_prepared`): no cuenta FGA en
  una falta de tiro fallada; cuenta 1 FGA/1 FGM en canasta con falta
  (and-one); cuenta FGA en tapón legal. El resolvedor rápido agrega
  2FGA/2FGM, 3FGA/3FGM, FTA/FTM y puntos (2×2FGM+3×3FGM+FTM) desde la
  misma taxonomía de hechos que el motor detallado, versionados como
  `LAB-0.2`.
- **Cobertura de trampa:** nuevo campo `coverage` en `MatchInput`
  (`"drop" | "trampa"`), independiente del escenario. D1 sigue a O1 por la
  pantalla; D5 sale a comprometerlo junto a D1 (`trap_committed`, solo si
  llega); D3 pasa a low man sobre el short roll; D4 rota hacia la amenaza
  que deja D3 (O3), exponiendo a O4; D2 mantiene el lado fuerte. La trampa
  se juzga cerrada en el instante en que el pase a O5 llegaría, no en el
  instante de decidir; una trampa cerrada aplica presión real de dos
  defensores (T07 vs T15, sin robo garantizado); una trampa rota abre un
  carril directo o una salida a O4 sin canasta garantizada.
- **M09 (Comunicación):** nueva capacidad activa (27 en total). Añade una
  latencia de coordinación entre un aviso defensivo reconocido (D5→D3,
  D3→D4) y la respuesta del receptor. Perfiles nuevos del fixture reciben
  valores por plantilla/rol; perfiles ya persistidos sin M09 reciben el
  valor neutro 8 hasta que el usuario lo edite y guarde.
- Interfaz `/lab`: selector de cobertura (drop/trampa) para la misma
  posesión; tabla nueva «Misma posesión: drop/trampa (con ayuda)»,
  separada visualmente de «Drop: ayuda sí/no»; ambas muestran categorías
  en español (sin claves internas), sus propias entradas/versiones, y se
  desactualizan al cambiar perfiles, cobertura, semilla o tamaño de lote.
- Seed de laboratorio (`prisma/seed.ts`) ahora no destructivo por defecto:
  crea equipos/jugadores que falten sin sobrescribir ediciones ya
  guardadas; `LAB_SEED_FORCE_RESET=1` restablece el fixture de forma
  deliberada.
- Añadidas 15 pruebas discriminantes nuevas en
  `domain/simulation/me02.test.ts` (reproducibilidad con trampa, C1 sin
  falta por mera llegada, closeout tardío alcanzable, rechazo del
  experimento de ~982 faltas, C2 esquina alcanzable/no regalada, trampa
  cambia responsabilidades y puede abrir salida sin garantizar
  robo/canasta, M09 solo desplaza el instante del aviso, C3 conciliación
  FGA/FGM/FTA/FTM/puntos incluido and-one, y misma taxonomía de hechos en
  rápido/detallado).
- Actualizados `docs/match/{README,MODEL,ACTIONS,CAPABILITIES,SCENARIOS,RULES}.md`
  y estado de ME-02 en `docs/match/roadmap.md`.
- Plan de prueba manual: `docs/testing/manual/ME-02-manual-test-plan.md`.

## HF-002 — Integridad de la posesión ME-01 y comparación rápida real (sin fusionar)

- Guardado el prompt del hotfix en `docs/prompts/hotfix/HF-002-me01-integridad-y-rapido.md`.
- Extraído el árbol de decisión y las fórmulas LAB-0.1 a un núcleo
  compartido (`domain/simulation/possession-core.ts`, ADR-0005), usado
  tanto por el motor detallado como por el resolvedor rápido.
- Corregido el balón: un tapón o una pérdida en balón vivo dejan el balón
  suelto (no muerto en el aro); un robo lo deja en poder real del
  defensor; solo una canasta lo deja muerto en el aro.
- Corregida la instantánea de cada hecho: se reconstruye desde el
  historial real de llegadas, no desde la posición ya mutada para
  cálculos posteriores (D3/D4 ya no aparecen en su destino antes de
  llegar).
- Corregido el rebote ofensivo: el resolvedor rápido cuenta cada rebote
  ofensivo real desde la línea de tiempo de hechos, no solo el terminal
  final de la corrida; `resolveRebound` ya no llama "fuera" a un balón
  dentro de la cancha solo porque nadie llega en la ventana de vuelo, y el
  palmeo se decide por T20 solo entre quienes realmente llegan.
- Conectados T22 (defensa perimetral) y T23 (defensa interior) a las
  llegadas de cierre/protección reales; añadida la elegibilidad de tapón
  (T18) por alcance físico real del defensor sobre el punto de
  liberación del tiro.
- Ejecutados de verdad los libres de una falta de tiro (T05 + semilla,
  puntos y reloj); el último libre fallado se resuelve como un rebote
  vivo real, incluida la continuación ofensiva si corresponde.
- Sustituida la aproximación rápida: ya no llama a `runPossession` ni
  construye relato/snapshots por muestra; mide ≈1,5–1,75× más rápida que
  ejecutar el detallado en lote (mismo equipo, mismas semillas,
  calentamiento y cálculo separado de render/BD).
- Interfaz `/lab`: se muestra el escenario, semilla, reglas y versión de
  parámetros de cada resultado (individual y de lote); un cambio de
  escenario, semilla o roster limpia el resultado anterior; la
  comparación por lotes aclara que siempre compara ayuda sí/no,
  independientemente del escenario seleccionado.
- Añadido ADR-0005 y actualizados `docs/match/{MODEL,RULES,SCENARIOS,ACTIONS,CAPABILITIES}.md`,
  el plan de prueba manual de ME-01 y `docs/process/{WORKFLOW,DEFINITION_OF_DONE}.md`
  (secuencia: recorrido básico de Claude antes de dejar la PR sin fusionar,
  prueba profunda de Dennis después de fusionar, desde `main`).

## ME-01 — Primera posesión integrada y Laboratorio de Partido (sin fusionar)

- Guardados el prompt de implementación y el hotfix HF-001 (sincronización
  de rama) en `docs/prompts/`.
- Creado el módulo `modules/match/` (domain/application/infrastructure/ui):
  atributos y perfiles de jugador (26 capacidades activas, escala 1–15,
  `E−`…`A+`), parámetros LAB-0.1 tipados y acotados, tres escenarios de
  bloqueo directo central, motor detallado con árbol de decisión y relato
  por pasos, y aproximación rápida por lotes reutilizando el mismo motor.
- Añadidos los modelos Prisma `LabTeam`/`LabPlayer` con migración real y
  script de siembra idempotente de los diez perfiles del fixture.
- Añadida la interfaz `/lab`: editor de jugadores agrupado, cancha
  esquemática, relato paso a paso con detalle seleccionable, y comparación
  rápida de la ayuda de D3.
- Añadido ADR-0004 (llegada analítica en vez de interpolación cada 100 ms)
  y la documentación activa del módulo (`docs/match/`).
- Actualizados `docs/foundation/CURRENT_SCOPE.md`, `docs/roadmap/ROADMAP.md`,
  `docs/architecture/TECHNICAL_ARCHITECTURE.md` y `modules/README.md` para
  reflejar que ME-01 es la entrega vigente.

## FND-001 — Foundation general y arquitectura técnica (sin fusionar)

- Base de bootstrap en `main` (README provisional) como excepción
  irrepetible, al tratarse de un repositorio recién creado.
- Guardado el prompt de implementación literal en
  `docs/prompts/implementation/FND-001-foundation-general-and-technical-architecture.md`.
- Creado el esqueleto ejecutable: Next.js (App Router) + TypeScript
  estricto + Prisma + PostgreSQL + Tailwind CSS + Vitest + ESLint.
- Creada la arquitectura modular (`src/shared/{domain,application,infrastructure,ui}`)
  con un ejemplo real de límites de capas: la comprobación de salud de la
  aplicación y de PostgreSQL.
- Añadido el endpoint `GET /api/health` y la página inicial Foundation,
  ambos tolerantes a la ausencia de PostgreSQL sin filtrar credenciales.
- Añadida la comprobación documental ligera (`npm run docs:check`) y el
  workflow de CI (`.github/workflows/ci.yml`).
- Creado el sistema documental dividido e indexado (`docs/README.md` y
  subcarpetas), tres ADR iniciales y el plan de prueba manual
  `docs/testing/manual/FND-001-manual-test-plan.md`.
- Documentadas, sin implementar, las familias de ecosistemas de
  competición y los principios del futuro núcleo de partido.
