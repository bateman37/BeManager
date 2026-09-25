# Alcance vigente

**Estado:** ACTIVE
**Es fuente de verdad para:** qué está dentro y fuera de alcance en la entrega actual, y qué decisiones de producto siguen abiertas.
**Debe leerse cuando:** dudes si algo debe implementarse ya o si requiere una `DECISIÓN REQUERIDA`.
**No cubre:** el roadmap a medio plazo (ver `docs/roadmap/ROADMAP.md`).
**Documentos relacionados:** `PRODUCT_VISION.md`, `docs/roadmap/ROADMAP.md`.
**Última actualización:** 2026-09-25.

## Entrega actual: FND-001 — Foundation y arquitectura técnica

Cubre exclusivamente:

1. La Foundation general mínima del proyecto (esta documentación).
2. La arquitectura técnica inicial y un esqueleto web ejecutable.

## Explícitamente fuera de alcance en FND-001

- Jugadores, clubes o plantillas.
- Base de datos de contenido.
- Motor de partido, atributos, tácticas, rotaciones o estadísticas de partido.
- Laboratorio de Partido funcional.
- Calendarios, temporadas, ligas, copas, playoffs, ascensos o descensos.
- Las familias NBA-like o NCAA-like de forma funcional.
- Contratos, draft, fichajes, traspasos, salary cap o economía.
- Usuarios, login o roles de aplicación.
- Interfaz definitiva del juego.
- Cualquier importación del proyecto Basket Manager anterior.

## Decisiones de producto todavía abiertas

No se cierran en esta entrega ni en las siguientes hasta que Dennis lo
decida explícitamente:

- El rol exacto del usuario dentro del club.
- La lista definitiva de atributos.
- El catálogo táctico.
- Las fórmulas del motor de partido.
- El primer país o las ligas y clubes iniciales.
- Los formatos concretos de competición.
- El sistema económico o contractual.
- La identidad visual definitiva.

Si una tarea futura parece requerir cerrar alguna de estas decisiones,
Claude Code debe detenerse y presentar un bloque `DECISIÓN REQUERIDA` en
lugar de inventar una respuesta.
