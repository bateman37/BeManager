# Principios del futuro núcleo de partido

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo deberá organizarse conceptualmente el futuro módulo `match` (motor + tácticas + atributos).
**Debe leerse cuando:** se vaya a diseñar o implementar cualquier pieza del motor de partido, tácticas o atributos.
**No cubre:** implementación real (no existe todavía) ni fórmulas de simulación (decisión abierta, ver `CURRENT_SCOPE.md`).
**Documentos relacionados:** `docs/architecture/MODULE_BOUNDARIES.md`, `modules/README.md`.
**Última actualización:** 2026-09-25.

> Este documento es puramente conceptual. FND-001 no implementa ninguna
> parte del motor de partido, tácticas o atributos.

## Un único bounded context

El futuro módulo `match` contendrá de forma coordinada:

- Estado del partido y de la posesión.
- Jugadores en pista, roles, emparejamientos y rotaciones.
- Plan ofensivo y respuesta defensiva.
- Selección de acciones y su resolución mediante atributos.
- Reloj, marcador, faltas, energía y demás consecuencias.
- Estadísticas y telemetría diagnóstica.
- Aleatoriedad determinista mediante semilla.

## Responsabilidad conceptual

- Las **tácticas** determinan qué intenta hacer el equipo y qué
  situaciones provoca.
- Los **atributos** determinan con qué calidad ejecutan o defienden los
  jugadores.
- El **motor** ordena la secuencia, aplica el contexto y actualiza el
  estado.

Las tácticas no se limitarán a bonificadores finales sobre el acierto o el
resultado. Los atributos se derivarán de las acciones que el modelo
necesite resolver, en lugar de crear primero una lista aislada e intentar
encajarla después.

## Laboratorio de Partido

Será el primer consumidor del mismo núcleo real que después usarán
competiciones y carreras. No habrá un motor de laboratorio desechable y
otro motor distinto para el juego.

## Por qué no se implementa todavía

Diseñar motor, tácticas y atributos como sistemas independientes
superpuestos después produciría acoplamientos difíciles de deshacer. Este
documento fija la intención arquitectónica para que, cuando llegue esa
entrega, el diseño de Dennis y ChatGPT encaje en estas fronteras sin
requerir una reescritura.
