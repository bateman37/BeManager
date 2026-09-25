# Límites entre módulos y capas

**Estado:** ACTIVE
**Es fuente de verdad para:** qué puede depender de qué, tanto entre capas (`domain`/`application`/`infrastructure`/`ui`) como entre futuros módulos.
**Debe leerse cuando:** crees un archivo nuevo y dudes en qué carpeta debe vivir, o antes de crear el primer módulo en `modules/`.
**No cubre:** el diseño de ningún módulo concreto (ninguno existe todavía).
**Documentos relacionados:** `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `modules/README.md`, `docs/foundation/COMPETITION_ECOSYSTEMS.md`.
**Última actualización:** 2026-09-25.

## Dependencias permitidas entre capas

- `domain` es TypeScript puro. No puede importar Next.js, React, Prisma ni
  ningún detalle de infraestructura.
- `application` puede depender de `domain` y de sus propios puertos, pero
  no de implementaciones Prisma ni de componentes visuales.
- `infrastructure` implementa los puertos definidos en `application` y
  concentra los detalles de persistencia o integraciones externas.
- `ui` y `app` llaman a casos de uso de `application`; no contienen
  fórmulas ni reglas de juego.
- Prisma solo puede aparecer en infraestructura (compartida o de un
  módulo). Nunca en `domain`, `application` o `ui`.

## Entre módulos (cuando existan)

- Un módulo no accede directamente a las tablas internas de otro módulo:
  se comunica a través de los casos de uso o puertos que ese otro módulo
  exponga.
- Las reglas específicas de un ecosistema (europeo, NBA-like, NCAA-like;
  ver `docs/foundation/COMPETITION_ECOSYSTEMS.md`) viven en su propio
  paquete o módulo versionado, nunca como condicionales dispersos en el
  núcleo universal.

## Verificación

En FND-001 estas reglas se verifican por revisión manual (no hay
todavía un linter de límites de arquitectura, como `dependency-cruiser` o
similar). Si en una entrega futura el número de módulos lo justifica,
esa herramienta se añadirá mediante una decisión explícita, no de forma
implícita.
