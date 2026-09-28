# Hotfixes — índice y convención

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo se registran los hotfixes futuros.
**Debe leerse cuando:** se necesite corregir una entrega ya fusionada.
**No cubre:** el contenido de cada hotfix (ver el archivo correspondiente).
**Documentos relacionados:** `docs/prompts/README.md`.
**Última actualización:** 2026-09-28.

Un hotfix corrige un problema concreto de una entrega ya aceptada, sin
reabrir su alcance completo.

- Nombre: `HF-<secuencia>-<slug>.md`, con secuencia correlativa global
  (no reinicia por entrega).
- Se guarda en esta carpeta antes de ejecutarse, igual que un prompt de
  implementación.
- No se edita retrospectivamente una vez ejecutado.
- Un hotfix no mezcla corrección de bugs con ampliación de alcance: si al
  investigar aparece la necesidad de ampliar alcance, se detiene y se
  señala como `DECISIÓN REQUERIDA`.

## Hotfixes existentes

- `HF-001-me-01-sincronizar-rama.md` — corrección operativa de arranque de
  ME-01: sincroniza la rama de trabajo con `main` para poder leer las
  referencias de diseño de `docs/match/` ya subidas por Dennis. No amplía
  el alcance funcional de ME-01.
