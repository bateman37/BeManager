# Acción de bloqueo directo central: drop y trampa (ME-01/ME-02)

**Estado:** ACTIVE
**Es fuente de verdad para:** el árbol de decisión de O1/O5 y las responsabilidades de los diez jugadores ante esta única acción, en las dos coberturas implementadas.
**Debe leerse cuando:** vayas a modificar `possession-core.ts` o a añadir una segunda acción táctica u otra cobertura.
**No cubre:** ninguna otra familia táctica (mano a mano, poste, zonas, transición) ni otras coberturas de bloqueo (switch, ICE/veer...): llegan en entregas posteriores (ver `docs/match/roadmap.md`).
**Documentos relacionados:** `docs/match/reference/BeManager-capitulo-tacticas-integradas-al-motor-v1.md`, `CAPABILITIES.md`, `RULES.md`.
**Última actualización:** 2026-09-28 (ME-02).

## Disposición y roles fijos

4-out/1-in ofensivo (O1 manejador, O5 bloqueador/continuador, O2 esquina del
lado del balón, O3 esquina débil, O4 ala débil) contra defensa individual
(D1 persigue a O1, D5 en drop o en trampa, D2/D3/D4 conservan o cambian
asignaciones según la cobertura). Un parámetro de la corrida (`coverage:
"drop" | "trampa"`, no del escenario) escoge la cobertura sobre **la misma**
entrada de media pista, quintetos y bloqueo central. Las posiciones
iniciales exactas están en `domain/lab/scenario.ts`.

## Cobertura `drop`: árbol de decisión de O1/O5, en orden de prioridad

Instrucción defensiva editable por escenario: **D3 ayuda al continuador:
sí/no**. Drop permanece fijo en D5.

1. **Finalizar** si O1 ya tiene carril al aro antes de que D5 llegue.
2. **Pasar a O5** (roll, hacia el short roll real en `(23,0; 7,5)`, ME-02
   §3/C1) si bate al perseguidor por ≥0,2 s de retraso de pantalla, hay
   línea, y D3 no ha comprometido su ayuda *antes* de la lectura de O1. Si
   O5 recibe y, para entonces, el espacio corporal de D3 sí se solapa de
   verdad con el suyo (C1: `positionAtInstant` + radio de 0,35 m por
   jugador), O5 activa su **segunda lectura** (C2) e invierte hacia O3 en
   la esquina débil si D4 todavía no ha cerrado esa ventana, sin reiniciar
   el reloj de la posesión.
3. **Pasar a O3** (esquina débil) directamente desde O1, solo cuando la
   opción 2 no estuvo disponible (bloqueo bien defendido), si D3 dejó la
   marca *antes* de la decisión y la recepción + preparación anticipan el
   cierre por ≥0,25 s.
4. **Triple de O1** si está detrás de la línea FIBA, el drop concede ≥0,25 s
   de ventana y su capacidad de triple (T04) ≥9.
5. **Salida segura** a O4/O2: termina en `possession_reorganized_control_kept`.

Si una opción se frustra, se conserva el tiempo consumido y se evalúa la
siguiente sin reiniciar posiciones (implementado como una única línea de
tiempo por posesión, no como reinicios). Con ≤2 s de reloj de lanzamiento,
solo se lanza si un tipo de tiro implementado es legal/preparable.

## Cobertura `trampa`: responsabilidades y lectura de O1/O5 (ME-02 §3)

D1 sigue a O1 por la pantalla (igual mecanismo de navegación que en drop);
D5 sale desde su posición hacia el nivel del bloqueo para comprometer a O1
junto a D1 (hecho `trap_committed`), **solo si de verdad llega**; D3 pasa a
`low man` sobre el short roll real de O5 (misma geometría que en drop); D4
rota hacia la amenaza que deja D3 (O3), exponiendo a O4 (`help_repair_attempt`);
D2 mantiene el lado fuerte sobre O2 y no participa en esta secuencia. Los
avisos D5→D3 y D3→D4 son avisos defensivos con emisor y receptor: cada uno
suma una vez la latencia de coordinación de M09 (ver `CAPABILITIES.md`).

La trampa se juzga **cerrada** en el instante en que el pase de O1 a O5 en
el short roll en realidad llegaría (no en el instante puramente mental de
la decisión): "si O1 pasa antes de cerrarse la trampa, el ataque dispone de
4x3 solo mientras los dos defensores sigan comprometidos y el pase llegue"
(prompt ME-02 §3).

- **Trampa cerrada:** presión real de dos defensores sobre el balón (T07 de
  O1 vs el peor T15 de D1/D5, mismo mecanismo ya vigente de
  `resolvesTurnoverUnderPressure`, no un robo nuevo). Sin pérdida, O1 busca
  a O5 en el short roll; si D3 (low man) no llega a tiempo, el 4x3 sigue
  vivo y O5 puede leer directamente la salida exterior a O4
  (`trap_broken_advantage`); si D3 sí contiene, O5 puede todavía invertir a
  O3 (misma lectura C2) antes de forzar el tiro bajo contención.
- **Trampa no cerrada en el instante de decisión** (`trap_broken_advantage`
  sobre O1): D5 no protege el aro y O1 puede escapar por el carril directo
  si de verdad lo tiene; si no hay carril ni tiempo, D1/D5 recuperan por
  trayecto (`trap_recovered`) y O1 conserva el control con una salida
  segura.

Una trampa rota nunca garantiza tiro cómodo; una trampa cerrada nunca
garantiza robo ni canasta (ver pruebas discriminantes en
`domain/simulation/me02.test.ts`).

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
