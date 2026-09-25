# ADR-0002: Monolito modular en vez de microservicios o monorepo

**Estado:** ACCEPTED
**Última actualización:** 2026-09-25.

## Contexto

BeManager es, en esta fase, un único producto web con un equipo pequeño
(Dennis + ChatGPT para diseño, Claude Code para implementación). El
proyecto crecerá por módulos de negocio (club profesional abierto,
futuro NBA-like, futuro NCAA-like, motor de partido, etc.) pero todos
comparten un mismo despliegue y una misma base de datos en esta etapa.

## Decisión

Se construye como un **monolito modular web**:

- Un único proyecto Next.js, un único `package.json`, un único
  `package-lock.json`.
- La modularidad se consigue organizando el código por capacidad de
  negocio dentro de `src/` y de la futura carpeta `modules/`, con límites
  de dependencia explícitos (ver
  `docs/architecture/MODULE_BOUNDARIES.md`), no mediante separación en
  repositorios o servicios distintos.
- No se usan microservicios: no hay beneficio de escalado independiente
  que justifique su complejidad operativa en esta fase, y añadirían
  necesidad de orquestación, red y despliegue fuera del alcance de FND-001
  (que excluye explícitamente Docker y despliegue).
- No se usa un monorepo multi-paquete (por ejemplo, con Turborepo o
  workspaces de npm): con un único producto desplegable, un monorepo solo
  añadiría complejidad de tooling sin un segundo paquete real que lo
  justifique.

## Consecuencias

- Los límites entre módulos deben mantenerse por disciplina de código y
  revisión (imports, capas `domain`/`application`/`infrastructure`/`ui`),
  no por fronteras físicas de despliegue.
- Si en el futuro un módulo necesita escalar o desplegarse de forma
  independiente, esta decisión puede revisarse mediante un nuevo ADR; no
  se anticipa esa necesidad ahora.
- Simplifica CI, build y pruebas manuales: un único comando de
  instalación, un único build.

## Alternativas descartadas

- **Microservicios**: descartado por complejidad operativa injustificada
  en esta fase y porque el prompt lo excluye explícitamente.
- **Monorepo con múltiples paquetes**: descartado porque no existe
  todavía un segundo paquete (por ejemplo, una librería compartida
  publicada por separado) que lo justifique.
