# Arquitectura técnica

**Estado:** ACTIVE
**Es fuente de verdad para:** el stack elegido, la estructura de carpetas y cómo fluye una petición a través de las capas.
**Debe leerse cuando:** empieces a trabajar en el código de la aplicación web.
**No cubre:** los límites de dependencia detallados (ver `MODULE_BOUNDARIES.md`) ni la persistencia (ver `DATA_AND_PERSISTENCE.md`).
**Documentos relacionados:** `docs/decisions/ADR-0001-technical-stack.md`, `docs/decisions/ADR-0002-modular-monolith.md`.
**Última actualización:** 2026-09-25.

## Stack

Monolito modular web (no microservicios, no monorepo):

- Next.js (App Router) + React + TypeScript en modo estricto.
- PostgreSQL + Prisma ORM con migraciones versionadas.
- Tailwind CSS para la base visual.
- Vitest para pruebas unitarias y de dominio.
- ESLint (configuración plana `eslint-config-next`).
- npm + `package-lock.json`.

Las versiones exactas elegidas están registradas en
`docs/decisions/ADR-0001-technical-stack.md`.

## Estructura de carpetas

```text
src/
  app/                       # rutas, layouts y composición web (Next.js App Router)
    api/health/route.ts      # endpoint de salud
    page.tsx                 # página Foundation
  shared/
    domain/                  # reglas puras realmente compartidas
    application/             # casos de uso y puertos compartidos
    infrastructure/           # Prisma y adaptadores comunes
    ui/                      # componentes visuales reutilizables
modules/                     # (vacío en FND-001) dirección futura de módulos de negocio
prisma/
  schema.prisma              # datasource + generator, sin modelos todavía
```

`modules/` no contiene módulos todavía porque ninguno tiene reglas de
diseño aprobadas. Ver `modules/README.md` para la forma que tendrán
cuando se creen.

## Flujo de una petición (ejemplo: salud de la aplicación)

1. `src/app/page.tsx` o `src/app/api/health/route.ts` (capa `app`) invocan
   el caso de uso `getApplicationHealth`.
2. `src/shared/application/health/get-application-health.ts` (capa
   `application`) pide al puerto `DatabaseHealthChecker` si la base de
   datos es alcanzable, y delega en el dominio cómo interpretar el
   resultado.
3. `src/shared/domain/health/health-snapshot.ts` (capa `domain`) contiene
   la regla pura: cómo combinar el estado en un `HealthSnapshot`.
4. `src/shared/infrastructure/db/prisma-database-health-checker.ts` (capa
   `infrastructure`) implementa el puerto usando Prisma (`SELECT 1`) y
   traduce cualquier error de conexión a `false`, sin propagar detalles
   sensibles.
5. La capa `app` renderiza el resultado o lo serializa como JSON HTTP.

Este mismo patrón (dominio puro → caso de uso → puerto → adaptador de
infraestructura) es el que deberán seguir los futuros módulos de negocio.

## Por qué no hay `next.config` de despliegue, Docker ni autenticación

Quedan fuera de alcance de FND-001 por decisión explícita de Dennis (ver
`docs/foundation/CURRENT_SCOPE.md`). No es una limitación técnica.
