#!/usr/bin/env node
/**
 * add-vercel-analytics.mjs
 *
 * Injects the Vercel Web Analytics script into every .html file under the
 * given root (default: current directory). Safe to re-run: files that already
 * contain the analytics script are skipped, so you can run it again each time
 * you add a new landing.
 *
 * Usage:
 *   node add-vercel-analytics.mjs            # scans current folder recursively
 *   node add-vercel-analytics.mjs ./path     # scans a specific folder
 *   node add-vercel-analytics.mjs --speed    # also inject Speed Insights
 *
 * NOTE: The /_vercel/insights/script.js endpoint only works once the site is
 * deployed to Vercel AND Web Analytics is enabled for the project
 * (Project -> Analytics -> Enable). Locally it will 404 — that's expected.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) || ".";
const WITH_SPEED = process.argv.includes("--speed");

// Unique markers used for idempotency (also used by --speed).
const WEB_SRC = "/_vercel/insights/script.js";
const SPEED_SRC = "/_vercel/speed-insights/script.js";

const webSnippet = `
    <!-- Vercel Web Analytics -->
    <script>
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="${WEB_SRC}"></script>
`;

const speedSnippet = `
    <!-- Vercel Speed Insights -->
    <script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="${SPEED_SRC}"></script>
`;

/** Recursively collect .html files, skipping dotfiles and node_modules. */
function findHtml(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(findHtml(full));
    else if (entry.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

/** Insert `snippet` right before the last </body> (or </html>, or EOF). */
function insertBeforeBody(html, snippet) {
  const lower = html.toLowerCase();
  let pos = lower.lastIndexOf("</body>");
  if (pos === -1) pos = lower.lastIndexOf("</html>");
  if (pos === -1) return html + snippet; // no closing tags — append
  return html.slice(0, pos) + snippet + html.slice(pos);
}

const files = findHtml(ROOT);
if (files.length === 0) {
  console.log(`No .html files found under "${ROOT}".`);
  process.exit(0);
}

let injected = 0;
let skipped = 0;

for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const hasWeb = html.includes(WEB_SRC);
  const hasSpeed = html.includes(SPEED_SRC);

  let changed = false;
  if (!hasWeb) {
    html = insertBeforeBody(html, webSnippet);
    changed = true;
  }
  if (WITH_SPEED && !hasSpeed) {
    html = insertBeforeBody(html, speedSnippet);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, html);
    injected++;
    console.log(`✓ injected  ${file}`);
  } else {
    skipped++;
    console.log(`- skipped   ${file} (already has analytics)`);
  }
}

console.log(`\nDone. ${injected} file(s) updated, ${skipped} already had it.`);
console.log(`Reminder: enable Web Analytics in each Vercel project (Project → Analytics → Enable),`);
console.log(`otherwise ${WEB_SRC} will 404 and no data is collected.`);
