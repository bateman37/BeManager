# Alcance vigente

**Estado:** ACTIVE
**Es fuente de verdad para:** qué está dentro y fuera de alcance en la entrega actual, y qué decisiones de producto siguen abiertas.
**Debe leerse cuando:** dudes si algo debe implementarse ya o si requiere una `DECISIÓN REQUERIDA`.
**No cubre:** el roadmap a medio plazo (ver `docs/roadmap/ROADMAP.md` y `docs/match/roadmap.md`).
**Documentos relacionados:** `PRODUCT_VISION.md`, `docs/roadmap/ROADMAP.md`, `docs/match/README.md`.
**Última actualización:** 2026-09-28.

## Entrega actual: ME-01 — Primera posesión integrada y Laboratorio de Partido

FND-001 (Foundation general y arquitectura técnica) ya no es la entrega
vigente; sigue siendo la base arquitectónica sobre la que se apoya ME-01.

Cubre exclusivamente:

1. Un Laboratorio de Partido con un único escenario 5v5: bloqueo directo
   central contra drop, con la ayuda de D3 como única instrucción
   defensiva editable.
2. Creación, edición, duplicado y guardado de jugadores/equipos de
   laboratorio desde la interfaz (diez perfiles fijos como fixture).
3. Una aproximación rápida limitada a ese mismo escenario, para comparar
   lotes pequeños con y sin ayuda.

Ver `docs/match/README.md` para el detalle exacto de qué está y qué no
está implementado.

## Explícitamente fuera de alcance en ME-01

- Partido entero (cuatro períodos), banquillo, sustituciones, tiempos muertos.
- Trampa, switch, zonas u otras coberturas de bloqueo distintas de drop.
- Transición entre varias posesiones y calendario/temporada.
- Generación poblacional de jugadores y equipos completos.
- Panel de administración visual de coeficientes LAB-0.1.
- Países, ligas, contratos, mercado, economía.
- Las familias NBA-like o NCAA-like de forma funcional.
- Motor 3D, texto generativo, herramientas de despliegue.
- Usuarios, login o roles de aplicación.
- Interfaz definitiva del juego.
- Cualquier importación del proyecto Basket Manager anterior.

## Decisiones de producto todavía abiertas

No se cierran en esta entrega ni en las siguientes hasta que Dennis lo
decida explícitamente:

- El rol exacto del usuario dentro del club.
- La lista definitiva de las 45 capacidades candidatas (26 están activas
  en ME-01; ver `docs/match/CAPABILITIES.md`).
- El catálogo táctico completo (ME-01 solo cierra el bloqueo directo
  central; ver `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`).
- Las fórmulas definitivas del motor de partido (LAB-0.1 son hipótesis de
  prototipo, no valores calibrados de liga).
- El primer país o las ligas y clubes iniciales.
- Los formatos concretos de competición.
- El sistema económico o contractual.
- La identidad visual definitiva.

Si una tarea futura parece requerir cerrar alguna de estas decisiones,
Claude Code debe detenerse y presentar un bloque `DECISIÓN REQUERIDA` en
lugar de inventar una respuesta.
