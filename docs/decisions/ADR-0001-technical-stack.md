# ADR-0001: Stack técnico de BeManager

**Estado:** ACCEPTED
**Última actualización:** 2026-09-25.

## Contexto

FND-001 exige un monolito modular web con Next.js (App Router), React,
TypeScript estricto, PostgreSQL, Prisma, Tailwind CSS, Vitest y ESLint,
usando versiones estables y compatibles disponibles en el momento de
ejecutar el prompt, bloqueadas en el lockfile.

Al comprobar el registro de npm en la fecha de esta entrega, las versiones
`latest` de varias herramientas resultaron ser lanzamientos muy recientes
con cambios de ruptura que rompían la compatibilidad entre sí:

- `prisma`/`@prisma/client` 7.x elimina `datasource.url` de
  `schema.prisma` y exige configurar la conexión mediante adaptadores de
  driver (`prisma.config.ts` + `@prisma/adapter-pg`), un cambio muy
  reciente y todavía poco extendido en el ecosistema.
- `eslint` 10.x rompe la compatibilidad de peer dependencies con
  `eslint-plugin-react` (dependencia transitiva de `eslint-config-next`
  16.x), que declara soporte hasta `eslint@^9.7`.
- `typescript` 7.x es una reescritura nativa (compilador en Go) muy
  reciente; su compatibilidad con el resto del ecosistema TypeScript
  (ESLint, Next.js) todavía no está consolidada.

## Decisión

Se fijan las siguientes versiones principales, verificadas con
`npm install`, `prisma generate`, `next build`, `eslint` y `vitest`
ejecutados realmente durante esta entrega:

| Paquete | Versión |
|---|---|
| Node.js | 22.x (LTS, ver `.nvmrc`) |
| Next.js | 16.3.6 |
| React / React DOM | 19.3.0 |
| TypeScript | 5.9.3 |
| Prisma / `@prisma/client` | 6.19.3 |
| Tailwind CSS | 4.3.3 |
| ESLint | 9.39.5 |
| `eslint-config-next` | 16.3.6 |
| Vitest | 5.0.2 |

Todas quedan bloqueadas en `package-lock.json` mediante `npm install`.

## Consecuencias

- Se usa Prisma 6.19.3 (última versión estable de la serie 6.x) en lugar
  de la 7.x más reciente, manteniendo el patrón ampliamente documentado de
  `datasource { url = env("DATABASE_URL") }`. Esto es una decisión técnica
  reversible: cuando el ecosistema (drivers, ejemplos, integraciones) esté
  consolidado alrededor de Prisma 7, migrar implicará adoptar
  `prisma.config.ts` y un adaptador de driver explícito.
- Se usa ESLint 9.39.5 en lugar de 10.x hasta que `eslint-config-next` (o
  sus dependencias transitivas) declaren soporte para ESLint 10.
- Se usa TypeScript 5.9.3 en lugar de 7.x por prudencia ante un cambio de
  compilador tan reciente; es una decisión reversible y de bajo riesgo de
  producto.
- `postcss` se fija explícitamente en `8.5.28` (en vez de dejar resolver
  una versión con vulnerabilidades conocidas) para que `npm audit` no
  reporte hallazgos altos.
- Las dependencias transitivas de Prisma (`mysql2`, `deepmerge-ts`) se
  fuerzan mediante `overrides` en `package.json` a versiones parcheadas,
  ya que el proyecto no usa MySQL y estas librerías solo forman parte de
  la herramienta CLI de Prisma.

## Alternativas descartadas

- Usar las versiones `latest` sin comprobar compatibilidad: descartado
  porque `npm install` producía advertencias de peer dependency real
  (`eslint-plugin-react` vs. ESLint 10) y `prisma generate` fallaba de
  forma dura contra el esquema sin adaptadores de driver.
- Fijar versiones antiguas "conocidas" de hace tiempo: descartado porque
  el prompt exige usar las versiones estables disponibles en el momento
  de ejecutar la entrega, no versiones arbitrariamente antiguas.
