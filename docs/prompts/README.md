# Prompts — índice y convención

**Estado:** ACTIVE
**Es fuente de verdad para:** dónde se guardan los prompts y cómo se nombran.
**Debe leerse cuando:** vayas a guardar un nuevo prompt de implementación o hotfix.
**No cubre:** el contenido de cada prompt (son registros inmutables, no se resumen aquí).
**Documentos relacionados:** `docs/prompts/hotfix/README.md`, `docs/process/DOCUMENTATION_STANDARD.md`.
**Última actualización:** 2026-09-30 (ME-07B v2).

## Convención

- Implementaciones: `docs/prompts/implementation/<ID>-<slug>.md`.
- Hotfixes: `docs/prompts/hotfix/HF-<secuencia>-<slug>.md`.
- Un prompt ejecutado no se edita retrospectivamente. Si hay que
  corregir una entrega, se crea otro prompt de implementación o un
  hotfix; nunca se reescribe silenciosamente el original.
- Los prompts no forman parte de la ruta documental habitual salvo el
  prompt activo de la tarea en curso.

## Prompts de implementación existentes

- `implementation/FND-001-foundation-general-and-technical-architecture.md`
- `implementation/ME-01-primera-posesion-integrada.md`
- `implementation/ME-02-trampa-y-salidas-con-correcciones-me01.md`
- `implementation/ME-03-posesiones-enlazadas-y-transicion.md`
- `implementation/ME-03-aclaracion-ventaja-temprana.md` — decisión de Dennis (opción B) sobre cuándo existe ventana de ventaja temprana.
- `implementation/ME-04-primer-partido-fiba.md`
- `implementation/ME-04A-auditoria-exportable-partidos.md`
- `implementation/ME-04B-lecturas-oposicion-y-auditoria.md` — corrige
  desplazamiento, primera lectura, oposición al tiro y trazabilidad de
  auditoría del bloqueo directo de ME-04A. El prompt propone la rama
  `match/me-04b-lecturas-oposicion`; el entorno de ejecución ya tenía
  activa y sincronizada `claude/new-session-p9xna7`, así que la entrega
  se hizo ahí (una sola rama, una sola PR), conforme al punto 0.3 del
  prompt.
- `implementation/ME-06-ataques-variados-correccion-ME04-laboratorio.md`
  — adelanta ME-06 antes de ME-05: revisión acotada de las lecturas de
  ME-04B, segunda familia ofensiva (mano a mano sin balón), selector de
  plan ofensivo por equipo, controles de perfiles de laboratorio y
  auditoría ampliada. El prompt propone la rama
  `match/me-06-variedad-y-laboratorio`; el entorno de ejecución ya tenía
  activa y sincronizada `claude/new-session-p9xna7`, así que la entrega
  se hizo ahí (una sola rama, una sola PR), igual que en ME-04B.
- `implementation/ME-07A-decisiones-vivas-y-partido-auto.md` — primera
  de dos entregas integradas (ME-07A/ME-07B): cambia la política de
  decisión de las posesiones (entrenador, tendencia individual,
  percepción, elección y ejecución/respuesta separadas), amplía la
  cobertura y la defensa sin balón a `auto` para ambos equipos, corrige
  el desfase de `phaseIndex` en la auditoría y exige un partido completo
  automático auditable desde `/lab`. El prompt propone la rama
  `match/me-07a-decisiones-auto`; el entorno de ejecución ya tenía activa
  y sincronizada `claude/new-session-p9xna7`, así que la entrega se hace
  ahí (una sola rama, una sola PR), igual que en ME-04B y ME-06.
- `implementation/ME-07B-cierre-me-07a-motor-tactico-integrado.md` —
  segunda entrega del bloque integrado: cierra los incumplimientos
  deportivos verificados de ME-07A y completa el repertorio táctico
  (estructuras, libro, familias ofensivas con interacciones, defensa
  asentada/presión/cobertura de bloqueo) y los 45 atributos con tarea
  alcanzable, en la **misma rama y PR ya abiertas** (`claude/new-session-p9xna7`,
  PR #10, Draft). Dennis decide su fusión desde `main`; esta entrega no
  la fusiona ni abre rama o PR alternativa. **Histórico:** la PR #10 se
  fusionó en `main` (`7b7eedd`) con el comienzo parcial de ME-07B; su rama
  y su PR no se continúan.
- `implementation/ME-07B-v2-capitulo-tactico-y-20-auditorias.md` — encargo
  vigente de ME-07B (30-09-2026): amplía el alcance a **todo** el capítulo
  táctico, exige reparar primero el flujo causal (rebote, selección de
  familia, defensa auto, lecturas, transición, atribución) a partir del
  diagnóstico de 20 auditorías
  (`docs/match/analysis/ME-07A-diagnostico-20-auditorias.md`) y prevalece
  sobre los recortes del prompt anterior. Rama nueva
  `claude/me-07b-v2-capitulo-tactico` desde `main` en `7b7eedd`, una sola
  PR Draft. Progreso por sesión en `implementation/ME-07B-PROGRESS.md`.

## Hotfixes existentes

Ver `docs/prompts/hotfix/README.md`.
