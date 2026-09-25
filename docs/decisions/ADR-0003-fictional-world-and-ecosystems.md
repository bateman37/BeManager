# ADR-0003: Universo ficticio y separación de familias de ecosistemas

**Estado:** ACCEPTED
**Última actualización:** 2026-09-25.

## Contexto

BeManager modela baloncesto profesional en un universo ficticio, inspirado
en la estructura real del deporte pero sin copiar clubes, jugadores,
escudos o marcas reales. Además, el baloncesto real tiene ecosistemas
estructuralmente distintos (clubes profesionales abiertos con
ascensos/descensos en Europa y otros países; ligas cerradas con draft y
salary cap al estilo NBA; universidades con elegibilidad limitada al
estilo NCAA). Mezclar estas reglas en un único modelo de dominio
produciría entidades universales contaminadas con supuestos de un solo
ecosistema.

## Decisión

- Todo el contenido de personas, clubes, competiciones y países será
  ficticio desde el diseño, sin excepciones ni datos de muestra reales.
- La arquitectura separa siempre: núcleo universal de baloncesto, reglas
  de partido (`ruleset` versionado), reglas de competición, reglas de
  plantilla e inscripción, reglas económicas/contractuales, y contenido
  concreto de países/ligas/clubes/personas.
- El desarrollo empieza por la familia "club profesional abierto"
  (europea y afines), pero el núcleo universal no puede contener
  supuestos exclusivos de esa familia.
- Las familias "profesional norteamericano cerrado" y "universitario
  norteamericano" quedan documentadas como fronteras futuras (ver
  `docs/foundation/COMPETITION_ECOSYSTEMS.md`) sin implementación ni
  modelos vacíos que las anticipen.

## Consecuencias

- Ninguna entidad compartida puede tener campos como "conferencia",
  "draft" o "salary cap" hasta que exista un módulo que module
  específicamente esa familia.
- Las diferencias entre países dentro de la familia europea/abierta se
  representarán como datos o reglas versionadas, nunca como
  `if country === ...` dispersos.
- Añadir una nueva familia de ecosistema en el futuro no debe requerir
  reescribir el núcleo universal, solo añadir un nuevo paquete de reglas.

## Alternativas descartadas

- Modelar desde ya un esquema único de "competición" con campos opcionales
  para todas las familias imaginables: descartado explícitamente por el
  prompt y por el riesgo de una entidad "todo terreno" imposible de
  mantener.
- Usar licencias o datos reales para acelerar el desarrollo inicial:
  descartado por decisión de producto (universo ficticio) y por riesgo
  legal.
