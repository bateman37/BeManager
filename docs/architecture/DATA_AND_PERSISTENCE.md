# Datos y persistencia

**Estado:** ACTIVE
**Es fuente de verdad para:** la separación conceptual de categorías de datos y qué debe identificar toda futura partida.
**Debe leerse cuando:** se vaya a diseñar cualquier modelo Prisma.
**No cubre:** modelos concretos (no existen todavía; ver `prisma/schema.prisma`).
**Documentos relacionados:** `docs/architecture/TECHNICAL_ARCHITECTURE.md`, ADR relacionados en `docs/decisions/`.
**Última actualización:** 2026-09-25.

## Categorías de datos previstas

Aunque todavía no existe ningún modelo, la arquitectura debe distinguir
desde el principio estas categorías, para que cuando se creen tablas no se
mezclen en un único esquema plano:

1. **Datos de contenido y definiciones versionadas** — por ejemplo,
   catálogos de reglas, `rulesets` o definiciones de competición cuando se
   diseñen.
2. **Estado de una partida/carrera concreta** — el progreso de una carrera
   de un usuario.
3. **Resultados y estadísticas de simulación** — lo que produce el motor
   de partido al ejecutarse.
4. **Configuración o metadatos técnicos** — ajustes de la propia
   aplicación, no del juego.

## Identificación mínima de toda futura partida

Cuando exista el concepto de partida/carrera, cada una deberá poder
identificar como mínimo:

- `saveVersion` — versión del formato de guardado.
- `rulesetVersion` — versión del conjunto de reglas de partido aplicado.
- Semilla o semillas necesarias para reproducibilidad de la simulación.

## Qué no existe todavía

FND-001 no crea tablas de partidas, jugadores, equipos ni competiciones.
El esquema Prisma (`prisma/schema.prisma`) solo contiene el `datasource` y
el `generator`, sin ningún modelo, para poder ejecutar `prisma generate` y
validar la conexión sin inventar dominio de juego de ejemplo.
