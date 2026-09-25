# FND-001 — Foundation general y arquitectura técnica de BeManager

## Instrucción principal

Trabaja sobre el repositorio GitHub:

`https://github.com/bateman37/BeManager`

Esta es la primera entrega del nuevo proyecto **BeManager**. El repositorio ha sido creado recientemente y puede estar completamente vacío. No reutilices código del proyecto Basket Manager anterior ni importes automáticamente su documentación. Aquel proyecto es únicamente una referencia histórica que se revisará sistema por sistema cuando Dennis lo decida.

El objetivo de esta entrega es cerrar conjuntamente:

1. La **Foundation general mínima** del nuevo proyecto.
2. La **creación de la arquitectura técnica inicial** y de un esqueleto web ejecutable.

No implementes todavía el motor de partido, tácticas, atributos, temporadas, competiciones, clubes, jugadores, contratos, economía ni modo carrera.

---

## 0. Acción obligatoria antes de implementar

Antes de modificar código o documentación de producto:

1. Inspecciona el estado real del repositorio, sus ramas, commits y archivos.
2. Preserva cualquier contenido existente que no haya sido creado por ti, aunque el repositorio parezca vacío.
3. Guarda una copia **íntegra y literal** de este prompt en:

   `docs/prompts/implementation/FND-001-foundation-general-and-technical-architecture.md`

4. Ese archivo forma parte de la entrega, debe versionarse y no debe resumirse ni reescribirse.
5. Los prompts ejecutados son registros inmutables. Si posteriormente hay que corregir esta entrega, se creará otro prompt de implementación o un hotfix; no se modificará silenciosamente este archivo.

Si por una limitación real no puedes guardar el prompt antes de continuar, detente y explica el bloqueo. No continúes dejando el registro para el final.

---

## 1. Roles y autoridad de decisión

- **Dennis** es el diseñador, Product Owner y responsable de aceptar funcionalmente cada entrega.
- **ChatGPT** ayuda a Dennis a desarrollar el diseño y a convertir las decisiones en prompts cerrados para Claude Code.
- **Claude Code** implementa lo especificado, mantiene la arquitectura y verifica técnicamente el resultado.

Claude Code debe decidir lo mínimo imprescindible.

### Puede decidir sin detenerse

Decisiones técnicas internas que sean:

- Reversibles.
- Locales a esta entrega.
- Invisibles para el comportamiento del producto.
- Compatibles con la arquitectura y las restricciones de este documento.

Cuando una decisión técnica sea significativa o difícil de revertir, documéntala como ADR aunque no modifique el comportamiento visible.

### No puede decidir por su cuenta

No inventes ni cierres sin aprobación:

- Reglas de juego.
- Fórmulas de simulación.
- Atributos de jugadores.
- Tácticas ofensivas o defensivas.
- Formatos de competición.
- Reglas de contratos, traspasos, draft, salarios o elegibilidad.
- Alcance funcional adicional.
- Comportamiento visible que no esté descrito.
- Identidad visual definitiva.

Cuando falte una decisión, detente y responde con un bloque llamado `DECISIÓN REQUERIDA` que contenga:

1. Contexto exacto.
2. Decisión que falta.
3. Opciones viables y consecuencias.
4. Qué parte queda bloqueada.

Puedes recomendar una opción, pero no implementarla hasta recibir aprobación.

---

## 2. Metodología de trabajo obligatoria

Documenta estas normas como política activa del repositorio, sin alterar su sentido:

1. Las entregas serán medianas, funcionales y de una única vertiente.
2. Cada bloque tendrá una rama y una PR propias.
3. `main` debe permanecer siempre ejecutable y estable.
4. Las pruebas automáticas serán mínimas y se concentrarán en invariantes, reglas y simulación.
5. Cada entrega incluirá pruebas funcionales manuales muy concretas para que Dennis las ejecute personalmente.
6. Nada se fusionará hasta completar desde la interfaz el recorrido funcional afectado.
7. Los prompts serán delimitados y no mezclarán múltiples sistemas independientes.
8. Cada entrega actualizará la documentación de diseño afectada, las decisiones arquitectónicas necesarias y `CHANGELOG.md`.
9. Dennis y ChatGPT deciden el diseño. Claude Code implementa y decide lo mínimo imprescindible.
10. Cada prompt de implementación o hotfix se guarda en el repositorio antes de ejecutarse.
11. Si falta una decisión de juego, Claude Code debe detenerse y señalarla; no inventarla.
12. Claude Code puede tomar decisiones técnicas internas reversibles, pero no modificar reglas, alcance o comportamiento visible.

Añade además estas reglas operativas:

- No mezclar refactorizaciones ajenas con una entrega.
- No corregir silenciosamente otros módulos fuera del alcance del prompt.
- Si se detecta un problema externo, registrarlo y explicarlo, pero no ampliar la PR sin autorización.
- No fusionar la PR. Dennis realizará la validación manual y decidirá la fusión.
- No dar por terminada una entrega únicamente porque compila: debe poder recorrerse desde la interfaz cuando su alcance tenga interfaz.

---

## 3. Visión mínima de producto que debe quedar documentada

BeManager será un manager profundo de baloncesto para navegador, inicialmente orientado a escritorio y con diseño adaptable a móvil.

### Principios confirmados

- El universo deportivo será **ficticio**: no se utilizarán equipos, jugadores, escudos, logotipos ni marcas oficiales reales.
- El mundo estará inspirado en la estructura, cultura, nivel competitivo y diversidad del baloncesto real, sin crear simples copias renombradas uno a uno.
- El desarrollo empezará por el ecosistema europeo de clubes profesionales.
- La base no debe quedar limitada a Europa ni contener supuestos europeos dentro del núcleo universal.
- El corazón diferencial del juego será la interacción creíble entre **motor de partido, tácticas y atributos**.
- Esas tres piezas se diseñarán y construirán como un único núcleo de juego, no como sistemas independientes superpuestos posteriormente.
- Antes de construir temporadas o gestión de carrera se creará un Laboratorio de Partido que utilice exactamente el mismo motor destinado al juego real.
- La simulación deberá ser reproducible mediante semillas y observable mediante diagnósticos internos durante el desarrollo.
- El proyecto debe crecer mediante módulos y datos versionados, sin convertir la ampliación de países o ecosistemas en una reescritura del núcleo.

### Decisiones todavía abiertas

No cierres en esta entrega:

- El rol exacto del usuario dentro del club.
- La lista definitiva de atributos.
- El catálogo táctico.
- Las fórmulas del motor de partido.
- El primer país o las ligas y clubes iniciales.
- Los formatos concretos de competición.
- El sistema económico o contractual.
- La identidad visual definitiva.

Estas decisiones deben figurar como abiertas, no rellenarse con las decisiones del proyecto anterior.

---

## 4. Familias de ecosistemas que la arquitectura debe prever

No implementes sus reglas todavía. Documenta las fronteras para impedir que el primer desarrollo europeo bloquee las demás familias.

### 4.1 Club profesional abierto

Será el punto de partida y cubrirá Europa y aquellos países del resto del mundo que compartan una estructura semejante:

- Clubes independientes.
- Ligas nacionales y posibles divisiones jerárquicas.
- Ascensos y descensos cuando corresponda.
- Competiciones nacionales y continentales.
- Contratos profesionales y mercado de fichajes o traspasos según las reglas de cada país.

No asumas que todos los países comparten exactamente las mismas reglas. Las diferencias deben vivir en paquetes o reglas versionadas, no en condicionales dispersos.

### 4.2 Profesional norteamericano cerrado

Familia futura inspirada en el modelo NBA, pero con universo y denominaciones ficticias:

- Franquicias y liga cerrada.
- Conferencias y divisiones si se deciden.
- Draft.
- Traspasos propios de ese ecosistema.
- Salary cap, excepciones y tipos contractuales específicos.
- Ausencia de ascensos y descensos.

Todo ello requerirá una fase propia de investigación y diseño. No implementes aproximaciones ni modelos vacíos de estas reglas ahora.

### 4.3 Universitario norteamericano

Familia futura inspirada en el ecosistema NCAA, también ficticia:

- Universidades y conferencias.
- Reclutamiento.
- Elegibilidad y duración limitada de la etapa universitaria.
- Torneos y clasificación propios.
- Reglas de movilidad, compensación y plantilla que deberán investigarse según el momento en que se implemente.

No lo modeles como si fuera una liga profesional con nombres distintos.

### Separación obligatoria

La arquitectura debe distinguir entre:

- Núcleo universal de baloncesto.
- Reglas de partido proporcionadas por un `ruleset` versionado.
- Reglas de competición.
- Reglas de plantilla e inscripción.
- Reglas económicas, contractuales y de movimiento de jugadores.
- Contenido concreto de países, ligas, clubes y personas.

Evita expresamente:

- `if country === ...` repartidos por el código.
- Ascensos y descensos incrustados en entidades universales.
- Draft o salary cap dentro del núcleo compartido.
- Fórmulas de partido dependientes de un país concreto.
- Una única entidad de contrato llena de campos opcionales para todos los ecosistemas imaginables.

---

## 5. Principio arquitectónico del futuro núcleo de partido

Esta entrega solo debe documentarlo. No lo implementes.

El futuro módulo `match` será un único bounded context que contendrá de forma coordinada:

- Estado del partido y de la posesión.
- Jugadores en pista, roles, emparejamientos y rotaciones.
- Plan ofensivo.
- Respuesta defensiva.
- Selección de acciones.
- Resolución mediante atributos.
- Reloj, marcador, faltas, energía y demás consecuencias.
- Estadísticas y telemetría diagnóstica.
- Aleatoriedad determinista mediante semilla.

Responsabilidad conceptual:

- Las tácticas determinan qué intenta hacer el equipo y qué situaciones provoca.
- Los atributos determinan con qué calidad ejecutan o defienden los jugadores.
- El motor ordena la secuencia, aplica el contexto y actualiza el estado.

Las tácticas no deberán limitarse a bonificadores finales sobre el acierto o el resultado. Los atributos se derivarán de las acciones que el modelo necesite resolver, en lugar de crear primero una lista aislada e intentar encajarla después.

El Laboratorio de Partido será el primer consumidor del mismo núcleo real que posteriormente utilizarán competiciones y carreras. No habrá un motor de laboratorio desechable y otro motor para el juego.

---

## 6. Stack técnico decidido

Crea un **monolito modular web**, no microservicios y no monorepo.

Utiliza:

- Next.js con App Router.
- React.
- TypeScript en modo estricto.
- PostgreSQL.
- Prisma ORM y migraciones versionadas.
- Tailwind CSS para la base visual.
- Vitest para las pruebas unitarias y de dominio.
- ESLint.
- npm y `package-lock.json`.
- Una versión LTS mantenida de Node.js, fijada en el repositorio y declarada en `package.json`.

Usa versiones estables y compatibles disponibles en el momento de ejecutar el prompt, bloquéalas en el lockfile y registra las versiones principales elegidas en el ADR del stack.

### Restricciones técnicas

- Sin Docker en esta fase.
- Sin microservicios.
- Sin autenticación.
- Sin despliegue.
- Sin Redux ni otra capa global de estado hasta que exista una necesidad real.
- Sin librerías de simulación genéricas que oculten la lógica del juego.
- Sin conexión a servicios de pago.
- Sin telemetría externa.
- Sin datos reales de clubes o jugadores.
- Sin modelos de dominio inventados para demostrar Prisma.
- No conectarse a la base de datos durante `next build`.
- Los secretos solo vivirán en `.env`, que debe estar ignorado. Proporciona `.env.example` sin credenciales reales.

Idioma y convenciones:

- Documentación de producto, mensajes visibles y pruebas manuales: español.
- Código, nombres de archivos técnicos, identificadores y APIs: inglés.
- Comentarios: solo cuando aporten contexto no evidente; preferentemente en español.
- No usar `any` salvo excepción aislada, justificada y documentada.

---

## 7. Arquitectura técnica que debe quedar creada y documentada

Usa organización modular por capacidad de negocio. La dirección prevista es:

```text
src/
  app/                       # rutas, layouts y composición web
  modules/                   # módulos de negocio verticales
    <module>/
      domain/                # reglas puras y entidades del módulo
      application/           # casos de uso y puertos
      infrastructure/        # Prisma y adaptadores externos
      ui/                    # componentes específicos del módulo
  shared/
    domain/                  # primitivas realmente compartidas
    application/             # contratos compartidos mínimos
    infrastructure/          # configuración y adaptadores comunes
    ui/                      # componentes visuales reutilizables
```

No crees decenas de directorios vacíos. Crea únicamente los necesarios para esta Foundation y documenta la dirección futura.

### Dependencias permitidas

- `domain` debe ser TypeScript puro y no puede importar Next.js, React, Prisma ni detalles de infraestructura.
- `application` puede depender del dominio y de puertos, pero no de implementaciones Prisma ni de componentes visuales.
- `infrastructure` implementa puertos y contiene los detalles de persistencia o integraciones.
- `ui` y `app` llaman a casos de uso; no contienen fórmulas ni reglas de juego.
- Prisma solo puede aparecer en infraestructura compartida o infraestructura de un módulo.
- Los módulos no acceden directamente a las tablas internas de otros módulos.

No añadas abstracciones vacías únicamente para aparentar arquitectura. El objetivo es establecer límites comprensibles que se puedan mantener.

### Persistencia futura

Documenta desde el principio la separación conceptual entre:

- Datos de contenido y definiciones versionadas.
- Estado de una partida/carrera concreta.
- Resultados y estadísticas de simulación.
- Configuración o metadatos técnicos.

Toda futura partida deberá poder identificar, como mínimo:

- `saveVersion`.
- `rulesetVersion`.
- Semilla o semillas necesarias para reproducibilidad.

No crees todavía tablas de partidas, jugadores, equipos o competiciones.

---

## 8. Esqueleto ejecutable de esta entrega

La Foundation no puede ser únicamente documentación. Crea una aplicación mínima pero real que demuestre que la arquitectura funciona.

### Interfaz inicial

Crea una página inicial sobria y provisional que muestre:

- Nombre `BeManager`.
- Indicación clara de que el proyecto está en fase Foundation.
- Estado de la aplicación.
- Estado de conexión con PostgreSQL, sin mostrar credenciales ni detalles sensibles.
- Referencia a que el siguiente gran bloque será el diseño integrado de motor, tácticas y atributos.

Debe ser adaptable a escritorio y móvil, accesible y claramente identificada como interfaz provisional. No diseñes todavía la identidad visual definitiva del juego.

### Salud de aplicación y base de datos

- Añade un endpoint de salud apropiado para Next.js.
- Comprueba la conexión mediante una operación mínima equivalente a `SELECT 1`, sin crear modelos de dominio artificiales.
- Si PostgreSQL no está disponible, la aplicación no debe romper la página inicial: debe mostrar un estado controlado y el endpoint debe responder con un estado HTTP coherente.
- El build y las pruebas unitarias no deben requerir una base de datos activa.

### Scripts mínimos

Incluye y documenta scripts coherentes para:

- Desarrollo.
- Build.
- Inicio en producción local.
- Lint.
- Typecheck.
- Tests.
- Comprobación agregada.
- Prisma generate.
- Migraciones.
- Prisma Studio.
- Validación documental si se implementa el comprobador solicitado abajo.

`npm ci` debe funcionar desde un clon limpio utilizando el lockfile.

### Comprobación documental ligera

Implementa una comprobación local sencilla, sin una cadena pesada de herramientas, que detecte como mínimo enlaces Markdown locales rotos dentro de `docs/`. Intégrala en el comando agregado de comprobación. No intentes construir en esta entrega un generador documental completo.

### Integración continua

Crea un workflow mínimo de GitHub Actions para ramas y PR que ejecute, sin base de datos activa:

- Instalación reproducible.
- Prisma generate.
- Lint.
- Typecheck.
- Tests.
- Validación documental.
- Build.

No añadas despliegue automático.

---

## 9. Sistema documental orientado a reducir contexto y tokens

La documentación no puede convertirse en un único `DESIGN.md` ni obligar a leer todo el repositorio para cada tarea.

### Reglas obligatorias

1. Un documento activo debe tener un único propósito principal.
2. Toda decisión tendrá una única fuente de verdad. Otros documentos enlazarán a ella, sin copiarla.
3. Los documentos activos deberán ser cortos y navegables. Como referencia, si un archivo activo supera aproximadamente 250 líneas, evalúa dividirlo.
4. Los prompts históricos pueden superar ese tamaño porque son registros inmutables, pero no forman parte de la lectura normal.
5. El historial de cambios irá en `CHANGELOG.md` y los motivos de decisiones duraderas en ADR; no contamines la documentación activa con diarios narrativos.
6. Cada carpeta documental tendrá un índice cuando contenga varias fuentes de verdad.
7. `docs/README.md` será el índice maestro y mapa de lectura.
8. Ninguna instrucción global ordenará leer toda la documentación en cada sesión.
9. Cada prompt futuro deberá declarar expresamente:
   - Documentos obligatorios que se deben leer.
   - Documentos opcionales de consulta.
   - Documentos que no deben cargarse porque están fuera de alcance.
10. Los documentos archivados y prompts anteriores no se leerán salvo que el prompt actual los cite expresamente.
11. Cuando un documento se divida, actualiza inmediatamente los índices y enlaces.
12. Antes de duplicar una regla, enlaza su fuente de verdad.

### Cabecera de documentos activos

Utiliza una cabecera breve y homogénea que indique:

- Identificador documental.
- Estado: `ACTIVE`, `DRAFT`, `SUPERSEDED` o `ARCHIVED`.
- Es fuente de verdad para.
- Debe leerse cuando.
- No cubre.
- Documentos relacionados.
- Última actualización.

No es necesario usar front matter complejo si una cabecera Markdown compacta resulta más legible.

### Rutas de lectura

`docs/README.md` debe contener una tabla que permita cargar solo el contexto necesario. Incluye al menos rutas para:

- Cualquier entrega.
- Arquitectura técnica.
- Motor/tácticas/atributos.
- Competiciones y ecosistemas.
- Interfaz.
- Persistencia.
- Hotfix.

La ruta general mínima de una tarea será:

1. `CLAUDE.md`.
2. El prompt actual guardado en `docs/prompts/`.
3. `docs/README.md` para resolver fuentes.
4. Únicamente los documentos que el prompt haya declarado necesarios.

### Identificadores recomendados

Usa una taxonomía estable y sencilla:

- `FND`: Foundation.
- `ARC`: arquitectura.
- `MAT`: partido, tácticas y atributos.
- `WRL`: mundo y países.
- `CMP`: competiciones.
- `CAR`: carrera.
- `CLB`: clubes.
- `MKT`: contratos, fichajes y mercados.
- `UI`: interfaz.
- `DAT`: datos y persistencia.
- `HF`: hotfix.
- `ADR`: decisiones arquitectónicas.

---

## 10. Documentos y archivos mínimos que debe crear la entrega

Puedes ajustar nombres menores si existe una razón técnica clara, pero conserva la separación, la indexación y el contenido. No concentres todo en menos archivos.

### Raíz

- `README.md`
- `CLAUDE.md`
- `CHANGELOG.md`
- `.gitignore`
- `.env.example`
- `.editorconfig`
- Archivo de versión de Node.
- `package.json` y `package-lock.json`.

### Foundation

- `docs/README.md` — índice maestro y rutas de lectura.
- `docs/foundation/README.md` — índice de Foundation.
- `docs/foundation/PRODUCT_VISION.md`
- `docs/foundation/CURRENT_SCOPE.md`
- `docs/foundation/MATCH_CORE_PRINCIPLES.md`
- `docs/foundation/COMPETITION_ECOSYSTEMS.md`

### Arquitectura

- `docs/architecture/README.md`
- `docs/architecture/TECHNICAL_ARCHITECTURE.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/DATA_AND_PERSISTENCE.md`

### Decisiones

- `docs/decisions/README.md`
- `docs/decisions/ADR-0001-technical-stack.md`
- `docs/decisions/ADR-0002-modular-monolith.md`
- `docs/decisions/ADR-0003-fictional-world-and-ecosystems.md`

Cada ADR debe incluir estado, contexto, decisión, consecuencias y alternativas descartadas. No inventes consecuencias de producto que todavía no se hayan decidido.

### Proceso

- `docs/process/README.md`
- `docs/process/WORKFLOW.md`
- `docs/process/DOCUMENTATION_STANDARD.md`
- `docs/process/TESTING_STRATEGY.md`
- `docs/process/DEFINITION_OF_DONE.md`

### Roadmap y pruebas manuales

- `docs/roadmap/ROADMAP.md`
- `docs/testing/manual/FND-001-manual-test-plan.md`

El roadmap solo debe fijar con firmeza:

1. FND-001 Foundation y arquitectura.
2. Diseño integrado de motor, tácticas y atributos.
3. Laboratorio de Partido con una primera rebanada vertical de las tres piezas.
4. Profundización y calibración del núcleo de partido.
5. Uso del núcleo validado por competiciones y carrera.

El resto puede figurar como horizonte no comprometido, sin inventar epics detalladas.

### Registro de prompts

- `docs/prompts/README.md`
- `docs/prompts/implementation/FND-001-foundation-general-and-technical-architecture.md` — copia literal de este prompt.
- `docs/prompts/hotfix/README.md` — convención para hotfixes futuros.

Convenciones:

- Implementaciones: `<ID>-<slug>.md`.
- Hotfixes: `HF-<secuencia>-<slug>.md`.
- Un prompt ejecutado no se edita retrospectivamente.
- Los prompts no forman parte de la ruta documental habitual salvo el prompt activo.

### `CLAUDE.md`

Debe ser corto y actuar como router, no como enciclopedia. Debe contener:

- Roles y límites de decisión.
- Metodología esencial.
- Reglas de seguridad documental.
- Ruta mínima de lectura.
- Comandos principales.
- Enlaces a las fuentes de verdad.

No copies dentro de `CLAUDE.md` toda la visión, arquitectura o diseño.

---

## 11. Git, rama y PR

### Si `main` ya existe

1. Comprueba que el árbol de trabajo esté limpio.
2. Actualiza referencias remotas sin sobrescribir cambios.
3. Crea desde `main` la rama:

   `foundation/fnd-001-foundation-architecture`

### Si el repositorio está realmente vacío y no existe ningún commit

Para poder cumplir el flujo de PR:

1. Crea una única base mínima en `main` con un `README.md` provisional y `.gitignore` apropiado.
2. Registra este caso como excepción irrepetible de bootstrap.
3. Publica esa base en `main` si tienes permisos.
4. Crea inmediatamente la rama `foundation/fnd-001-foundation-architecture`.
5. Toda la Foundation real, incluido este prompt guardado, debe quedar en la rama y entrar mediante PR.

No hagas el desarrollo completo directamente sobre `main`.

### PR

- Título sugerido: `FND-001: establish project foundation and technical architecture`
- No mezcles funcionalidades de juego.
- No fusiones la PR.
- Si puedes publicar rama y abrir PR, hazlo.
- Si la autenticación no permite abrir la PR, deja la rama y commits preparados, explica el bloqueo y facilita el comando o enlace de comparación necesario. No intentes sortear permisos.

Utiliza commits pequeños y coherentes dentro de la misma entrega. No reescribas historia remota ajena.

---

## 12. Pruebas automáticas mínimas de esta entrega

Incluye únicamente pruebas con valor real para la Foundation:

- Una prueba del comportamiento puro utilizado por el estado de salud, si existe lógica separable.
- Prueba de que el fallo de base de datos se transforma en un estado controlado y no filtra información sensible.
- Validación de enlaces Markdown locales.
- Cualquier prueba mínima necesaria para demostrar las fronteras creadas, sin fabricar dominio de juego de ejemplo.

No añadas una batería amplia de tests de componentes ni Playwright en esta entrega.

Todos estos comandos deben finalizar correctamente desde un clon limpio:

- `npm ci`
- Generación de Prisma.
- Lint.
- Typecheck.
- Tests.
- Validación documental.
- Build.

El conjunto automático no debe necesitar PostgreSQL activo, salvo una comprobación de integración que quede claramente separada y no se ejecute en CI.

---

## 13. Plan de prueba manual para Dennis

Crea `docs/testing/manual/FND-001-manual-test-plan.md` con instrucciones especialmente claras para Windows PowerShell. Debe incluir:

1. Clonar o actualizar el repositorio y cambiar a la rama de la PR.
2. Instalar dependencias.
3. Crear `.env` desde `.env.example` sin sobrescribir uno existente.
4. Configurar una base PostgreSQL local.
5. Generar Prisma y ejecutar el comando de migración previsto.
6. Arrancar la aplicación.
7. Abrir la URL local.
8. Comprobar visualmente la página Foundation en escritorio.
9. Reducir el navegador y comprobar el comportamiento adaptable.
10. Comprobar el estado positivo de PostgreSQL.
11. Detener PostgreSQL o utilizar temporalmente una conexión inválida y comprobar que la interfaz informa del problema sin romperse ni revelar credenciales.
12. Restaurar la conexión y comprobar recuperación tras recarga.
13. Ejecutar el comando agregado de validación.
14. Registrar resultado esperado y espacio para resultado real de cada paso.

No presupongas conocimientos avanzados de programación. Explica qué debe ver Dennis, no solo qué comando ejecutar.

---

## 14. Criterios de aceptación

La entrega no está terminada hasta que se cumpla todo lo siguiente:

- El prompt exacto está guardado en la ubicación establecida.
- Existe una rama específica y la Foundation no se ha fusionado en `main`.
- La aplicación se instala de forma reproducible con npm.
- TypeScript está en modo estricto.
- La aplicación arranca y muestra la interfaz Foundation.
- El estado de PostgreSQL se comprueba sin crear modelos de juego falsos.
- La falta de PostgreSQL se gestiona sin caída de la página ni filtrado de secretos.
- Prisma está correctamente configurado para PostgreSQL.
- Existe una arquitectura modular documentada y no solo una estructura de carpetas.
- Las familias europea/global profesional, profesional norteamericana y universitaria norteamericana quedan previstas y separadas, pero no implementadas.
- El núcleo futuro de partido queda definido como integración inseparable de motor, tácticas y atributos.
- La documentación está dividida, indexada y tiene rutas de lectura de contexto mínimo.
- `CLAUDE.md` funciona como router conciso y no obliga a leer todos los documentos.
- Los prompts de implementación y hotfix tienen ubicación y convención estable.
- Existe `CHANGELOG.md` actualizado.
- Existe un plan manual ejecutable por Dennis.
- CI ejecuta instalación, generación Prisma, lint, typecheck, tests, validación documental y build sin una base activa.
- No se ha implementado ninguna regla de juego fuera de alcance.
- No se han importado datos, documentos ni código del Basket Manager anterior.
- No se han añadido autenticación, despliegue, Docker o servicios externos.
- El árbol de trabajo final está limpio y todos los archivos necesarios están versionados.

---

## 15. Fuera de alcance explícito

No implementes en FND-001:

- Jugadores, clubes o plantillas.
- Base de datos de contenido.
- Motor de partido.
- Atributos.
- Tácticas.
- Rotaciones deportivas.
- Estadísticas de partido.
- Laboratorio de Partido funcional.
- Calendarios o temporadas.
- Ligas, copas, playoffs, ascensos o descensos.
- NBA, NCAA o equivalentes ficticios funcionales.
- Contratos, draft, fichajes, traspasos o salary cap.
- Economía.
- Usuarios, login o roles de aplicación.
- Interfaz definitiva del juego.
- Importación del proyecto anterior.

Si algo de esta lista parece necesario para completar la Foundation, detente y presenta una `DECISIÓN REQUERIDA` en lugar de ampliar el alcance.

---

## 16. Respuesta final obligatoria de Claude Code

Al terminar, responde en español y proporciona:

1. Resumen funcional de lo creado.
2. Rama utilizada.
3. Commits realizados.
4. PR abierta o instrucciones exactas si no fue posible abrirla.
5. Estructura documental creada y cómo usar su índice.
6. Arquitectura técnica resultante.
7. Versiones principales elegidas.
8. Comandos ejecutados y resultado real de cada validación.
9. Enlace o ruta al plan de pruebas manuales de Dennis.
10. Decisiones técnicas reversibles tomadas por Claude Code.
11. ADR creados.
12. Posibles bloqueos o puntos que queden pendientes.
13. Confirmación expresa de que no se implementaron reglas de juego ni contenido fuera de alcance.

No presentes como superada ninguna prueba que no hayas ejecutado realmente. No ocultes warnings, errores o limitaciones.
