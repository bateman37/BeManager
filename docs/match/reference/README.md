# Referencias de diseño del motor de partido — índice

**Estado:** ACTIVE
**Es fuente de verdad para:** qué es cada uno de los cuatro estudios subidos por Dennis y por dónde empezar a leerlos.
**Debe leerse cuando:** necesites consultar el razonamiento completo detrás de una decisión ya cerrada en `docs/match/`.
**No cubre:** las decisiones ya aprobadas para una entrega concreta (viven en `docs/match/*.md` y en el prompt de esa entrega).
**Documentos relacionados:** `docs/match/README.md`, `docs/match/roadmap.md`.
**Última actualización:** 2026-09-28.

Estos cuatro archivos son **investigación y propuesta de diseño**, no
especificaciones activas contradictorias entre sí ni código. No se copia su
contenido aquí ni se cambian sus nombres o rutas.

## [`BeManager-del-estudio-al-motor-de-partidos-v1.md`](./BeManager-del-estudio-al-motor-de-partidos-v1.md)

**Propósito:** recomendación de arquitectura del motor (estado, tiempo,
coordinación de los diez jugadores, tácticas, capacidades, resolución de
acciones, arquitectura técnica, partido detallado vs. rápido).
**Estado:** propuesta de diseño, parcialmente aprobada (ver `docs/match/MODEL.md` y `docs/match/ACTIONS.md`).
**Sección de entrada para ME-01:** §1.2, 4–9, 12–14, 16–17.

## [`BeManager-capitulo-tacticas-integradas-al-motor-v1.md`](./BeManager-capitulo-tacticas-integradas-al-motor-v1.md)

**Propósito:** cómo estructurar ataque y defensa como capas configurables
(estilo, disposición, acción/jugada, cobertura, ayuda) y su gramática común.
**Estado:** propuesta de diseño; ME-01 solo implementa el bloqueo directo
central con drop y la ayuda de D3.
**Sección de entrada para ME-01:** §1–2, 3.1, 3.3, 4.2–4.3, 5, 6.2, 9.

## [`BeManager-capitulo-atributos-y-motor-v2.md`](./BeManager-capitulo-atributos-y-motor-v2.md)

**Propósito:** catálogo de 45 capacidades candidatas, mapa completo de
sucesos P01–P76 y cómo cada capacidad interviene por etapa (percepción,
elección, movimiento, ejecución).
**Estado:** propuesta de diseño; ME-01 activa 26 de las 45 capacidades (ver
`docs/match/CAPABILITIES.md`).
**Sección de entrada para ME-01:** §1–3, 4.2–4.5, 5–8.

## [`BeManager-estudio-baloncesto-v1.md`](./BeManager-estudio-baloncesto-v1.md)

**Propósito:** estudio integral del reglamento (FIBA/NBA/NCAA), anatomía de
una posesión, táctica ofensiva/defensiva y capacidades, con evidencia
científica y sus límites.
**Estado:** investigación de referencia; el perfil de reglas activo es
FIBA 2026 (ver `docs/match/RULES.md`).
**Sección de entrada para ME-01:** capítulo 01 §§1.1, 1.4–1.5; capítulo 02
§§2.2–2.5; capítulo 05 §§5.1, 5.3.
