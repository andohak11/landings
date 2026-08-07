#!/usr/bin/env node
/**
 * strip-canonical.mjs
 * Removes every <link rel="canonical" ...> tag from all .html files under ROOT.
 * Handles any attribute order (href before/after rel) and extra attrs
 * (data-react-helmet, data-next-head, etc.). Idempotent & re-runnable.
 *
 * Usage: node strip-canonical.mjs [rootDir]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] || ".";
const SKIP = new Set([".git", ".vercel", "node_modules"]);
// a <link ...> tag (no '>' inside) that contains rel="canonical"; trims trailing whitespace
const CANON = /<link\b[^>]*\brel=["']canonical["'][^>]*>[ \t]*\n?/gi;

function findHtml(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(findHtml(p));
    else if (e.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}

let total = 0, changed = 0;
for (const f of findHtml(ROOT)) {
  const html = fs.readFileSync(f, "utf8");
  const matches = html.match(CANON);
  if (!matches) continue;
  fs.writeFileSync(f, html.replace(CANON, ""));
  total += matches.length;
  changed++;
  console.log(`- removed ${matches.length}  ${f}`);
}
console.log(`\nDone. Removed ${total} canonical tag(s) across ${changed} file(s).`);
