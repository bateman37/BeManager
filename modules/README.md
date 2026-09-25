# `modules/` — dirección futura

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo se organizarán los futuros módulos de negocio.
**Debe leerse cuando:** se vaya a crear el primer módulo vertical (por ejemplo, `match`, `club`, `competition`).
**No cubre:** la arquitectura compartida actual (ver `src/shared/`) ni las reglas de cada ecosistema.
**Documentos relacionados:** `docs/architecture/MODULE_BOUNDARIES.md`.
**Última actualización:** 2026-09-25.

Esta carpeta está intencionadamente casi vacía en la entrega FND-001.

Ningún módulo de negocio (`match`, `tactics`, `attributes`, `club`,
`competition`, `career`, etc.) existe todavía: crearlos ahora sin reglas de
juego aprobadas produciría carpetas vacías que aparentan arquitectura sin
aportarla. El primer módulo real se creará cuando exista una decisión de
diseño cerrada que lo justifique (por ejemplo, el núcleo de partido descrito
en `docs/foundation/MATCH_CORE_PRINCIPLES.md`).

Cuando se cree el primer módulo, seguirá esta forma interna, ya usada por
`src/shared/`:

```text
modules/<module>/
  domain/          # reglas puras y entidades del módulo
  application/      # casos de uso y puertos
  infrastructure/    # Prisma y adaptadores externos
  ui/              # componentes específicos del módulo
```

Reglas de dependencia (ver `docs/architecture/MODULE_BOUNDARIES.md` para el
detalle completo):

- `domain` no importa Next.js, React ni Prisma.
- `application` depende de `domain` y de sus propios puertos, nunca de
  Prisma ni de componentes visuales.
- `infrastructure` implementa los puertos y concentra el acceso a Prisma.
- `ui` y las rutas de `src/app/` llaman a casos de uso; no contienen reglas
  de juego.
- Un módulo no accede directamente a las tablas internas de otro módulo.
