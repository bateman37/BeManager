# Definición de "hecho"

**Estado:** ACTIVE
**Es fuente de verdad para:** cuándo una entrega puede considerarse terminada.
**Debe leerse cuando:** creas que una entrega está lista para PR.
**No cubre:** los criterios de aceptación específicos de una entrega concreta (viven en su propio prompt).
**Documentos relacionados:** `WORKFLOW.md`, `TESTING_STRATEGY.md`.
**Última actualización:** 2026-09-25.

Una entrega no está terminada hasta que:

- El prompt exacto que la originó está guardado en
  `docs/prompts/implementation/` o `docs/prompts/hotfix/`.
- Existe una rama específica y la entrega no se ha fusionado en `main`
  sin que Dennis lo decida.
- La aplicación se instala de forma reproducible con `npm ci`.
- `npm run check` (lint + typecheck + tests + validación documental +
  build) termina correctamente sin necesitar una base de datos activa.
- Si la entrega tiene interfaz, se ha recorrido manualmente desde el
  navegador, no solo verificado por compilación.
- La documentación de diseño afectada, las decisiones arquitectónicas
  necesarias y `CHANGELOG.md` están actualizados.
- Existe un plan de prueba manual ejecutable por Dennis cuando la entrega
  tiene interfaz.
- No se ha implementado ninguna regla de juego ni contenido fuera del
  alcance declarado por el prompt.
- No se han mezclado refactorizaciones ajenas ni correcciones silenciosas
  de otros módulos.
- El árbol de trabajo final está limpio y todos los archivos necesarios
  están versionados.

Claude Code no fusiona la PR. Dennis realiza la validación manual y
decide la fusión.
