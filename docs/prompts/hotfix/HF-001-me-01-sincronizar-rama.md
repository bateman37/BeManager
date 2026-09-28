# ME-01 — Continuación tras sincronizar la rama con `main`

**Tipo:** corrección operativa del arranque de ME-01.  
**Repositorio:** `bateman37/BeManager`.  
**Rama existente:** `claude/new-session-p9xna7` (o la rama de sesión que tengas asignada si el entorno la ha cambiado).  
**Archivo de este prompt en el repositorio:** `docs/prompts/hotfix/HF-001-me-01-sincronizar-rama.md`.

Continúa **la misma entrega ME-01 y la misma PR**. Conserva intacto el prompt original ya archivado en `docs/prompts/implementation/ME-01-primera-posesion-integrada.md`. Antes de ejecutar esta corrección, guarda íntegramente este texto en la ruta indicada y registra el nuevo prompt según `docs/prompts/README.md`. No crees una segunda entrega funcional ni otra PR.

## Diagnóstico verificado

La parada se produjo porque tu rama partió de `40b8add`, anterior a la llegada de los documentos a `main`. En el remoto, `main` contiene `ed8b009` (los cuatro estudios) y `1a7124f` (el roadmap). Por eso una inspección del historial **de tu rama** no los encuentra. No hay que reconstruir los atributos ni pedir que Dennis vuelva a subir los archivos. La diferencia de rama asignada respecto al nombre sugerido por ME-01 tampoco impide trabajar: conserva la rama que exige el entorno.

Los cuatro estudios y el roadmap son deliberadamente **referencias de diseño**. El prompt ME-01 fija un subconjunto activo de 26 capacidades, la escala de 15 grados y parámetros provisionales LAB-0.1. `docs/foundation/CURRENT_SCOPE.md` todavía describe FND-001 y enumera como abiertas las **listas y fórmulas definitivas**; ME-01 debe actualizar ese documento para reflejar el alcance provisional de la entrega, sin proclamar definitivo el sistema completo. Esto no exige inventar decisiones deportivas nuevas.

## Pasos de recuperación

1. Comprueba rama y árbol de trabajo con `git branch --show-current` y `git status --short`. Conserva el commit del prompt original. Si hay cambios ajenos sin guardar o una restricción real del entorno que impida sincronizar, detente y explica ese problema concreto; no hagas `reset` ni descartes trabajo.
2. Guarda y confirma este prompt en `docs/prompts/hotfix/HF-001-me-01-sincronizar-rama.md` antes de modificar código o documentación del producto. No edites el prompt original. Actualiza el índice de prompts como parte de la documentación de ME-01.
3. Ejecuta `git fetch origin main`. Comprueba `git log -1 --oneline origin/main` y que `git ls-tree -r --name-only origin/main docs/match` muestra `docs/match/roadmap.md` y los cuatro archivos de `docs/match/reference/`. Si el remoto ha avanzado desde los identificadores indicados, usa la versión **actual** de `origin/main` tras verificarla.
4. Integra esa base en **la misma rama** con `git merge --no-edit origin/main`. No fusiones la PR en `main`. Esta integración trae documentación previamente subida por Dennis; no la reescribas ni la dupliques. Si aparecen conflictos, consérvalos y comunica archivos y contenido implicados antes de tocar decisiones deportivas; resuelve solo los conflictos mecánicos inequívocos.
5. Verifica que los cinco archivos son legibles ahora desde la rama (`git ls-files docs/match`), junto con el prompt original. Si alguno sigue faltando, informa de la ruta exacta y del estado remoto observado; no supongas que el estudio nunca existió.
6. Retoma ME-01 desde su §1, respetando las lecturas acotadas, el módulo `modules/match/`, las pruebas pertinentes y el recorrido completo desde la interfaz. Actualiza `CURRENT_SCOPE.md` y los índices dentro de esta entrega, como ya exige el prompt original. Solo presenta `DECISIÓN REQUERIDA` si, después de recuperar las referencias, falta realmente una decisión de juego concreta que impida implementar una rama del escenario.

Al finalizar, informa de la rama, los commits, el estado de la PR y las pruebas realizadas. Deja la PR para las pruebas funcionales de Dennis y **no la fusiones**.
