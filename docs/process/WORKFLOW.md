# Metodología de trabajo

**Estado:** ACTIVE
**Es fuente de verdad para:** cómo se organizan las entregas, ramas y PR, y los límites de decisión de cada rol.
**Debe leerse cuando:** empieces cualquier entrega nueva.
**No cubre:** la definición de "hecho" (ver `DEFINITION_OF_DONE.md`) ni la estrategia de pruebas (ver `TESTING_STRATEGY.md`).
**Documentos relacionados:** `docs/prompts/README.md`, `DEFINITION_OF_DONE.md`.
**Última actualización:** 2026-09-25.

## Roles y autoridad de decisión

- **Dennis** es el diseñador, Product Owner y responsable de aceptar
  funcionalmente cada entrega.
- **ChatGPT** ayuda a Dennis a desarrollar el diseño y a convertir las
  decisiones en prompts cerrados para Claude Code.
- **Claude Code** implementa lo especificado, mantiene la arquitectura y
  verifica técnicamente el resultado. Decide lo mínimo imprescindible.

### Claude Code puede decidir sin detenerse

Decisiones técnicas internas que sean reversibles, locales a la entrega,
invisibles para el comportamiento del producto y compatibles con la
arquitectura vigente. Si la decisión es significativa o difícil de
revertir, se documenta como ADR aunque no cambie el comportamiento
visible.

### Claude Code no puede decidir por su cuenta

Reglas de juego, fórmulas de simulación, atributos, tácticas, formatos de
competición, reglas de contratos/traspasos/draft/salarios/elegibilidad,
alcance funcional adicional, comportamiento visible no descrito, o
identidad visual definitiva. Cuando falte una decisión de este tipo,
Claude Code se detiene y presenta un bloque `DECISIÓN REQUERIDA` con:
contexto exacto, decisión que falta, opciones viables y consecuencias, y
qué parte queda bloqueada. Puede recomendar una opción, pero no
implementarla sin aprobación.

## Reglas de entrega

1. Las entregas son medianas, funcionales y de una única vertiente.
2. Cada bloque tiene una rama y una PR propias.
3. `main` permanece siempre ejecutable y estable.
4. Las pruebas automáticas son mínimas y se concentran en invariantes,
   reglas y simulación.
5. Cada entrega incluye pruebas funcionales manuales concretas para que
   Dennis las ejecute personalmente.
6. Nada se fusiona hasta completar desde la interfaz el recorrido
   funcional afectado.
7. Los prompts son delimitados y no mezclan sistemas independientes.
8. Cada entrega actualiza la documentación de diseño afectada, las
   decisiones arquitectónicas necesarias y `CHANGELOG.md`.
9. No se mezclan refactorizaciones ajenas ni correcciones silenciosas de
   otros módulos fuera del alcance del prompt.
10. Si se detecta un problema externo al alcance, se registra y explica,
    pero no se amplía la PR sin autorización.
11. Claude Code no fusiona la PR: Dennis realiza la validación manual y
    decide la fusión.
12. Una entrega no se da por terminada solo porque compila: debe poder
    recorrerse desde la interfaz cuando su alcance tenga interfaz.

## Ramas y PR

- Rama por bloque de trabajo, nombrada según el identificador de la
  entrega (por ejemplo, `foundation/fnd-001-foundation-architecture`).
- PR con título descriptivo referenciando el identificador.
- Commits pequeños y coherentes dentro de la misma entrega.
- No se reescribe historia remota ajena.
