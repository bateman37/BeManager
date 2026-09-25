# Estrategia de pruebas

**Estado:** ACTIVE
**Es fuente de verdad para:** qué se prueba de forma automática, qué de forma manual, y por qué.
**Debe leerse cuando:** vayas a añadir pruebas a una entrega.
**No cubre:** el plan de prueba manual de una entrega concreta (ver `docs/testing/manual/`).
**Documentos relacionados:** `docs/testing/manual/`, `DEFINITION_OF_DONE.md`.
**Última actualización:** 2026-09-25.

## Pruebas automáticas (Vitest)

Mínimas y concentradas en invariantes, reglas y simulación — nunca una
batería amplia de pruebas de componentes ni end-to-end en fases tempranas:

- Reglas puras de dominio (por ejemplo, `health-snapshot.ts`).
- Casos de uso de `application`, verificando que interpretan
  correctamente los puertos, incluido el camino de fallo.
- Que un fallo de infraestructura (por ejemplo, PostgreSQL caído) se
  traduce en un estado controlado y no filtra información sensible.
- Fronteras de arquitectura demostradas por el propio código (no se
  fabrica dominio de juego de ejemplo solo para tener algo que probar).

El conjunto automático no necesita PostgreSQL activo. Si en el futuro se
añade una prueba de integración real contra una base de datos, debe
quedar claramente separada (por ejemplo, otro comando npm) y no
ejecutarse en CI.

## Validación documental

`npm run docs:check` detecta enlaces Markdown locales rotos dentro de
`docs/`. Es una comprobación ligera, no un generador documental completo.

## Pruebas manuales

Cada entrega con interfaz incluye un plan de prueba manual en
`docs/testing/manual/<ID>-manual-test-plan.md`, escrito para que Dennis lo
ejecute sin conocimientos avanzados de programación, con pasos concretos
y espacio para registrar el resultado real.

## Fuera de alcance en fases tempranas

- Pruebas de componentes UI extensas.
- Playwright / end-to-end automatizado.
- Pruebas de carga o rendimiento.

Se añadirán cuando exista comportamiento de producto real que las
justifique.
