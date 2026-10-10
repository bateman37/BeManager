<!--
Este archivo existe para que `next dev` no reescriba `CLAUDE.md`: Next.js
genera automáticamente reglas para agentes de IA en `AGENTS.md` o, si no
existe, en `CLAUDE.md`. Mantenerlo presente evita que esa generación
automática mezcle contenido de framework con el router documental del
proyecto (`CLAUDE.md`), que sigue las reglas de
`docs/process/DOCUMENTATION_STANDARD.md`.

Este archivo no forma parte del sistema documental de BeManager y no debe
citarse desde `docs/README.md`.
-->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
