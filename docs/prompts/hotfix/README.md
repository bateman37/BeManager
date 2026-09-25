# Hotfixes — índice y convención

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo se registran los hotfixes futuros.
**Debe leerse cuando:** se necesite corregir una entrega ya fusionada.
**No cubre:** ningún hotfix concreto (todavía no existe ninguno).
**Documentos relacionados:** `docs/prompts/README.md`.
**Última actualización:** 2026-09-25.

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

Todavía no existe ningún hotfix en este proyecto.
