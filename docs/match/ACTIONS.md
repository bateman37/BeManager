# Acción de bloqueo directo central (ME-01)

**Estado:** ACTIVE
**Es fuente de verdad para:** el árbol de decisión de O1 y las responsabilidades de los diez jugadores en esta única acción.
**Debe leerse cuando:** vayas a modificar `possession-engine.ts` o a añadir una segunda acción táctica.
**No cubre:** ninguna otra familia táctica (mano a mano, poste, zonas, transición): llegan en entregas posteriores (ver `docs/match/roadmap.md`).
**Documentos relacionados:** `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, `CAPABILITIES.md`.
**Última actualización:** 2026-09-28.

## Disposición y roles fijos

4-out/1-in ofensivo (O1 manejador, O5 bloqueador/continuador, O2 esquina del
lado del balón, O3 esquina débil, O4 ala débil) contra defensa individual
(D1 persigue a O1, D5 en drop, D2/D3/D4 conservan asignaciones). Única
instrucción defensiva editable: **D3 ayuda al continuador: sí/no**. Drop
permanece fijo. Las posiciones iniciales exactas están en
`domain/lab/scenario.ts` y coinciden con el prompt ME-01 §2.

## Árbol de decisión de O1, en orden de prioridad

1. **Finalizar** si O1 ya tiene carril al aro antes de que D5 llegue.
2. **Pasar a O5** (roll) si bate al perseguidor por ≥0,2 s de retraso de
   pantalla, hay línea, y D3 no ha comprometido su ayuda antes de la lectura.
3. **Pasar a O3** (esquina débil) si D3 dejó la marca y la recepción +
   preparación anticipan el cierre por ≥0,25 s.
4. **Triple de O1** si está detrás de la línea FIBA, el drop concede ≥0,25 s
   de ventana y su capacidad de triple (T04) ≥9.
5. **Salida segura** a O4/O2: termina en `possession_reorganized_control_kept`.

Si una opción se frustra, se conserva el tiempo consumido y se evalúa la
siguiente sin reiniciar posiciones (implementado como una única línea de
tiempo por posesión, no como reinicios). Con ≤2 s de reloj de lanzamiento,
solo se lanza si un tipo de tiro implementado es legal/preparable.

## Simplificación técnica reversible: llegada analítica, no malla de navegación

El estudio de referencia permite explícitamente prescindir de una malla de
navegación para diez jugadores en una cancha pequeña (§4.2). ME-01 calcula
tiempos de llegada de forma analítica (distancia ÷ velocidad, con los
retrasos LAB-0.1 de pantalla, ayuda y cierre) en vez de interpolar
posiciones cada 100 ms para una IA general de evitación de obstáculos. El
reloj interno sigue avanzando con paso máximo de 100 ms y cortes exactos de
evento para los fines de reproducibilidad y comparación de resoluciones,
pero el movimiento de cada responsable usa una trayectoria recta hacia su
objetivo de fase. Documentado también como decisión técnica en
`docs/decisions/ADR-0004-detailed-engine-analytic-timing.md`.

## Rebote ofensivo y continuación

Si O5 (u otro atacante) captura el rebote ofensivo, la misma posesión
estadística continúa con un intento de finalización o palmeo, heredando
posiciones y sin reiniciar la pantalla original. Un guardián de progreso
(`MAX_PROGRESS_ITERATIONS`) detiene una cadena anómala de rebotes ofensivos
y lo marca como `simulation_guard_stopped` en vez de forzar un desenlace.
Solo participan en la disputa del rebote quienes realmente llegan (dentro
de la ventana de vuelo, o los más próximos si nadie llega dentro de ella:
un balón que sigue en la cancha nunca se declara "fuera" solo porque nadie
llegó a tiempo); el palmeo se decide por T20 únicamente entre esos
candidatos reales, no entre los diez jugadores sin filtrar (HF-002 §1.4).

## Falta ordinaria de tiro y libres

Alcanzada la rama `shooting_foul`, se adjudica primero la validez de la
canasta y después se ejecuta cada libre concedido con `T05` y la semilla
de la posesión (ver `RULES.md`). Si el último libre falla, el balón queda
vivo y se resuelve con la misma disputa de rebote que un tiro de campo,
incluida la continuación ofensiva si el ataque lo recupera (HF-002 §1.6).
