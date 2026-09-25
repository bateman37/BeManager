# Familias de ecosistemas de competición

**Estado:** ACTIVE
**Es fuente de verdad para:** las fronteras entre familias de ecosistemas que la arquitectura debe prever.
**Debe leerse cuando:** se diseñe cualquier regla de competición, plantilla, contratos o movimiento de jugadores.
**No cubre:** reglas concretas de ninguna familia (ninguna está implementada todavía).
**Documentos relacionados:** `docs/architecture/MODULE_BOUNDARIES.md`, `docs/roadmap/ROADMAP.md`.
**Última actualización:** 2026-09-25.

> Documental únicamente. FND-001 no implementa reglas de ninguna de estas
> familias.

## 4.1 Club profesional abierto (punto de partida)

Cubre Europa y otros países con estructura semejante:

- Clubes independientes; ligas nacionales y posibles divisiones jerárquicas.
- Ascensos y descensos cuando corresponda.
- Competiciones nacionales y continentales.
- Contratos profesionales y mercado de fichajes/traspasos según las reglas
  de cada país.

No se asume que todos los países comparten exactamente las mismas reglas:
las diferencias vivirán en paquetes o reglas versionadas, no en
condicionales dispersos por el código.

## 4.2 Profesional norteamericano cerrado (futuro)

Inspirado en el modelo NBA, con universo y denominaciones ficticias:
franquicias y liga cerrada, conferencias/divisiones si se deciden, draft,
traspasos propios, salary cap y excepciones, sin ascensos ni descensos.
Requerirá su propia fase de investigación y diseño.

## 4.3 Universitario norteamericano (futuro)

Inspirado en el ecosistema NCAA, también ficticio: universidades y
conferencias, reclutamiento, elegibilidad y duración limitada de la etapa
universitaria, torneos y clasificación propios, reglas de movilidad y
compensación a investigar cuando se aborde.

## Separación obligatoria en la arquitectura

Debe distinguirse siempre entre:

- Núcleo universal de baloncesto.
- Reglas de partido de un `ruleset` versionado.
- Reglas de competición.
- Reglas de plantilla e inscripción.
- Reglas económicas, contractuales y de movimiento de jugadores.
- Contenido concreto de países, ligas, clubes y personas.

## Qué evitar expresamente

- `if country === ...` repartidos por el código.
- Ascensos y descensos incrustados en entidades universales.
- Draft o salary cap dentro del núcleo compartido.
- Fórmulas de partido dependientes de un país concreto.
- Una única entidad de contrato con campos opcionales para todos los
  ecosistemas imaginables.
