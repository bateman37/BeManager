#!/usr/bin/env node
/**
 * Comprobación documental ligera: detecta enlaces Markdown locales rotos
 * dentro de `docs/`. No valida enlaces externos (http/https) ni construye
 * un generador documental completo; solo confirma que los enlaces relativos
 * a otros archivos del repositorio apuntan a rutas existentes.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const docsRoot = join(repoRoot, "docs");

const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;

function listMarkdownFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    if (entry.isFile() && extname(entry.name) === ".md") return [fullPath];
    return [];
  });
}

function isLocalLink(link) {
  if (link.startsWith("http://") || link.startsWith("https://")) return false;
  if (link.startsWith("mailto:")) return false;
  if (link.startsWith("#")) return false;
  return true;
}

function resolveLinkTarget(fileDir, link) {
  const [pathPart] = link.split("#");
  if (!pathPart) return null;
  return resolve(fileDir, pathPart);
}

function findBrokenLinks(files) {
  const broken = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const fileDir = dirname(file);
    let match;

    while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
      const link = match[1].trim();
      if (!isLocalLink(link)) continue;

      const target = resolveLinkTarget(fileDir, link);
      if (!target) continue;

      if (!existsSync(target)) {
        broken.push({ file, link });
      }
    }
  }

  return broken;
}

if (!existsSync(docsRoot)) {
  console.error(`No existe el directorio a comprobar: ${docsRoot}`);
  process.exit(1);
}

const markdownFiles = listMarkdownFiles(docsRoot);
const broken = findBrokenLinks(markdownFiles);

if (broken.length > 0) {
  console.error(`Se han encontrado ${broken.length} enlace(s) local(es) roto(s):\n`);
  for (const { file, link } of broken) {
    console.error(`  - ${file.replace(repoRoot + "/", "")} -> ${link}`);
  }
  process.exit(1);
}

console.log(`Comprobación documental correcta: ${markdownFiles.length} archivo(s) revisado(s), 0 enlaces rotos.`);
