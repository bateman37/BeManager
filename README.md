# BeManager

Manager profundo de baloncesto ficticio para navegador. Proyecto en fase
**Foundation**: todavía no implementa reglas de juego.

## Empezar

Requisitos: Node.js 22.x (ver `.nvmrc`), npm y una instancia local de
PostgreSQL.

```bash
npm ci
cp .env.example .env   # ajusta DATABASE_URL si lo necesitas
npm run prisma:generate
npm run dev
```

Abre `http://localhost:3000`. La página muestra el estado de la fase
Foundation y la conexión con PostgreSQL. Si PostgreSQL no está disponible,
la aplicación sigue funcionando y lo indica sin exponer credenciales.

## Comandos principales

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Arranca el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript en modo estricto, sin emitir |
| `npm run test` | Pruebas unitarias (Vitest) |
| `npm run docs:check` | Enlaces Markdown locales rotos en `docs/` |
| `npm run check` | Todo lo anterior + build, en orden |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:migrate` | Migraciones de desarrollo |
| `npm run prisma:studio` | Prisma Studio |

## Documentación

Empieza por [`CLAUDE.md`](./CLAUDE.md) y por
[`docs/README.md`](./docs/README.md), el índice maestro con rutas de
lectura mínimas por tipo de tarea.

## Pruebas manuales de esta entrega

[`docs/testing/manual/FND-001-manual-test-plan.md`](./docs/testing/manual/FND-001-manual-test-plan.md).
