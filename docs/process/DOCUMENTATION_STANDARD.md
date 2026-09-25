# Estándar documental

**Estado:** ACTIVE
**Es fuente de verdad para:** las reglas del sistema documental (propósito único, cabeceras, tamaño, índices).
**Debe leerse cuando:** crees, dividas o reestructures cualquier documento activo.
**No cubre:** el contenido concreto de ningún documento.
**Documentos relacionados:** `docs/README.md`, `docs/prompts/README.md`.
**Última actualización:** 2026-09-25.

## Reglas obligatorias

1. Un documento activo tiene un único propósito principal.
2. Toda decisión tiene una única fuente de verdad; otros documentos
   enlazan a ella, sin copiarla.
3. Los documentos activos son cortos y navegables. Como referencia, si un
   archivo activo supera ~250 líneas, se evalúa dividirlo.
4. Los prompts históricos pueden superar ese tamaño porque son registros
   inmutables; no forman parte de la lectura normal.
5. El historial de cambios va en `CHANGELOG.md`; los motivos de decisiones
   duraderas, en ADR. La documentación activa no se contamina con diarios
   narrativos.
6. Cada carpeta documental tiene un índice (`README.md`) cuando contiene
   varias fuentes de verdad.
7. `docs/README.md` es el índice maestro y mapa de lectura.
8. Ninguna instrucción global ordena leer toda la documentación en cada
   sesión.
9. Cada prompt futuro declara expresamente: documentos obligatorios,
   documentos opcionales de consulta, y documentos que no deben cargarse
   por estar fuera de alcance.
10. Los documentos archivados y prompts anteriores no se leen salvo que el
    prompt actual los cite expresamente.
11. Cuando un documento se divide, se actualizan inmediatamente los
    índices y enlaces.
12. Antes de duplicar una regla, se enlaza su fuente de verdad.

## Cabecera de documentos activos

```markdown
# Título

**Identificador:** (si aplica, p. ej. FND-001)
**Estado:** ACTIVE | DRAFT | SUPERSEDED | ARCHIVED
**Es fuente de verdad para:** ...
**Debe leerse cuando:** ...
**No cubre:** ...
**Documentos relacionados:** ...
**Última actualización:** AAAA-MM-DD.
```

Las ADR usan su propia cabecera simplificada (estado + fecha) más las
secciones contexto/decisión/consecuencias/alternativas descartadas; ver
`docs/decisions/README.md`.

## Taxonomía de identificadores

- `FND` — Foundation.
- `ARC` — arquitectura.
- `MAT` — partido, tácticas y atributos.
- `WRL` — mundo y países.
- `CMP` — competiciones.
- `CAR` — carrera.
- `CLB` — clubes.
- `MKT` — contratos, fichajes y mercados.
- `UI` — interfaz.
- `DAT` — datos y persistencia.
- `HF` — hotfix.
- `ADR` — decisiones arquitectónicas.
