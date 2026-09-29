# Datos y persistencia

**Estado:** ACTIVE
**Es fuente de verdad para:** la separación conceptual de categorías de datos y qué debe identificar toda futura partida.
**Debe leerse cuando:** se vaya a diseñar cualquier modelo Prisma.
**No cubre:** el detalle de los modelos de laboratorio (ver `docs/match/MODEL.md` y `prisma/schema.prisma`).
**Documentos relacionados:** `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `docs/match/MODEL.md`, ADR relacionados en `docs/decisions/`.
**Última actualización:** 2026-09-29.

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

## Qué existe desde ME-01

Los primeros modelos reales son `LabTeam` y `LabPlayer`
(`prisma/schema.prisma`): equipos y jugadores del Laboratorio de Partido,
categoría 1 ("datos de contenido... cuando se diseñen", aquí perfiles
ficticios escritos a mano, no generación poblacional). No son la categoría
2 (partida/carrera): el laboratorio no es una carrera ni una temporada.

ME-04 amplía el fixture a doce jugadores por equipo sin migración: el seed
(caso de uso `seedLabRoster` con su puerto `LabSeedStore`) solo crea los
que falten. El partido completo no se persiste: su resultado vive en memoria
y en la interfaz; historial y checkpoints llegan en ME-09.

## Qué no existe todavía

Ni ME-01 ni FND-001 crean tablas de partidas/carrera, clubes de
competición, contratos ni competiciones. El motor detallado conserva su
snapshot y hechos en memoria durante la corrida; no escribe cada
movimiento en la base (estudio de referencia §13.4).
