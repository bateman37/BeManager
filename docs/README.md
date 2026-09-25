# Índice maestro de documentación — BeManager

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo navegar la documentación del proyecto sin leerla entera.
**Debe leerse cuando:** empieces cualquier tarea sobre este repositorio, justo después de `CLAUDE.md` y del prompt activo.
**No cubre:** el contenido de cada documento (solo indica dónde está).
**Documentos relacionados:** todos los listados abajo.
**Última actualización:** 2026-09-25.

Ninguna instrucción de este repositorio obliga a leer toda la
documentación en cada sesión. Carga solo lo que tu tarea necesite.

## Ruta general mínima de cualquier tarea

1. `CLAUDE.md` (raíz del repositorio).
2. El prompt de implementación o hotfix activo, en `docs/prompts/`.
3. Este archivo, para localizar las fuentes de verdad necesarias.
4. Únicamente los documentos que el prompt activo haya declarado obligatorios.

## Rutas de lectura por tipo de tarea

| Tarea | Documentos obligatorios |
|---|---|
| Cualquier entrega nueva | `docs/process/WORKFLOW.md`, `docs/process/DEFINITION_OF_DONE.md` |
| Arquitectura técnica / módulos | `docs/architecture/README.md` y los documentos que enlaza |
| Motor de partido, tácticas o atributos | `docs/foundation/MATCH_CORE_PRINCIPLES.md`, `docs/architecture/MODULE_BOUNDARIES.md` |
| Competiciones y ecosistemas (europeo, NBA-like, NCAA-like) | `docs/foundation/COMPETITION_ECOSYSTEMS.md` |
| Interfaz web | `docs/architecture/TECHNICAL_ARCHITECTURE.md` (sección de `app/`/`ui/`) |
| Persistencia y Prisma | `docs/architecture/DATA_AND_PERSISTENCE.md` |
| Hotfix | `docs/prompts/hotfix/README.md` |

## Índices por carpeta

- `docs/foundation/README.md` — visión de producto y alcance vigente.
- `docs/architecture/README.md` — arquitectura técnica y límites de módulos.
- `docs/decisions/README.md` — decisiones arquitectónicas (ADR).
- `docs/process/README.md` — metodología, pruebas y definición de "hecho".
- `docs/roadmap/ROADMAP.md` — horizonte comprometido y no comprometido.
- `docs/prompts/README.md` — convención de prompts de implementación y hotfix.
- `docs/testing/manual/` — planes de prueba manual por entrega.

## Reglas del sistema documental

Ver `docs/process/DOCUMENTATION_STANDARD.md` para las reglas completas.
Resumen: un documento, un propósito; una decisión, una fuente de verdad;
documentos activos cortos y con cabecera; historial en `CHANGELOG.md`;
motivos duraderos en ADR; prompts históricos no se editan ni se leen salvo
que se citen expresamente.
