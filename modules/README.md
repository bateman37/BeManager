# `modules/` — módulos de negocio

**Estado:** ACTIVE
**Es fuente de verdad para:** qué módulos existen y la forma interna que comparten.
**Debe leerse cuando:** vayas a crear un módulo nuevo o a tocar `modules/match/`.
**No cubre:** el diseño deportivo de `match` (ver `docs/match/README.md`).
**Documentos relacionados:** `docs/architecture/MODULE_BOUNDARIES.md`, `docs/match/README.md`.
**Última actualización:** 2026-09-28.

## Módulos existentes

- **`match/`** — Laboratorio de Partido (ME-01 a ME-03): motor detallado y
  aproximación rápida de una posesión 5v5, tramo de hasta cuatro
  posesiones enlazadas, perfiles de jugador y su persistencia. Ver `docs/match/README.md` para el índice completo.

Ningún otro módulo (`club`, `competition`, `career`, etc.) existe todavía:
se crearán cuando exista una decisión de diseño cerrada que los justifique.

## Forma interna común

```text
modules/<module>/
  domain/          # reglas puras y entidades del módulo
  application/      # casos de uso y puertos
  infrastructure/    # Prisma y adaptadores externos
  ui/              # componentes específicos del módulo
```

Reglas de dependencia (detalle completo en
`docs/architecture/MODULE_BOUNDARIES.md`):

- `domain` no importa Next.js, React ni Prisma.
- `application` depende de `domain` y de sus propios puertos, nunca de
  Prisma ni de componentes visuales.
- `infrastructure` implementa los puertos y concentra el acceso a Prisma.
- `ui` y las rutas de `src/app/` llaman a casos de uso; no contienen reglas
  de juego.
- Un módulo no accede directamente a las tablas internas de otro módulo.
