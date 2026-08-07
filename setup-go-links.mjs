#!/usr/bin/env node
/**
 * setup-go-links.mjs
 *
 * 1. Detects each landing's affiliate destination (the most-linked
 *    sailspins/spinbao/cursedcaptain URL) and records it in ./go-urls.json
 *    (repo root — NOT inside any deployed folder, so it isn't shipped).
 * 2. Rewrites every <a href="..."> in the landing to a VISIBLE href="/go".
 * 3. Injects a small script that forwards the current query string to /go
 *    (so ad click-ids reach the affiliate).
 *
 * The /go endpoint itself is created by setup-locale-routing.mjs (middleware),
 * which reads go-urls.json. Run this BEFORE setup-locale-routing.mjs.
 *
 * Idempotent. Usage: node setup-go-links.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = ".";
const SKIP = new Set([".git", ".vercel", "node_modules"]);
const AFF = /href="(https?:\/\/(?:sailspins|spinbao|cursedcaptain)\.com[^"]*)"/gi;
const decode = (s) => s.replace(/&amp;/g, "&");

function findHtml(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(findHtml(p));
    else if (e.name.toLowerCase() === "index.html") out.push(p);
  }
  return out;
}

function detectGoUrl(files) {
  const counts = {};
  for (const f of files) {
    const h = fs.readFileSync(f, "utf8");
    const re = new RegExp(AFF.source, "gi");
    let m;
    while ((m = re.exec(h))) { const u = decode(m[1]); counts[u] = (counts[u] || 0) + 1; }
  }
  let best = null, bc = 0;
  for (const [u, c] of Object.entries(counts)) if (c > bc) { bc = c; best = u; }
  return best;
}

const FORWARD = `<script id="go-forward">document.addEventListener('DOMContentLoaded',function(){var s=location.search;if(!s)return;document.querySelectorAll('a[href="/go"]').forEach(function(a){a.setAttribute('href','/go'+s)})});</script>`;

const landings = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name))
  .map((e) => e.name)
  .filter((n) => fs.existsSync(path.join(n, "default", "index.html")));

const map = {};
for (const name of landings) {
  const files = findHtml(name);
  const go = detectGoUrl(files);
  if (!go) { console.warn(`  (!) no affiliate link found in ${name}`); continue; }
  map[name] = go;
  let links = 0;
  for (const f of files) {
    let h = fs.readFileSync(f, "utf8");
    h = h.replace(/(<a\b[^>]*?\bhref=)("[^"]*"|'[^']*')/gi, (m, p1) => { links++; return p1 + '"/go"'; });
    h = h.replace(/<script id="go-forward">[\s\S]*?<\/script>/i, "");
    if (/<\/body>/i.test(h)) h = h.replace(/<\/body>/i, FORWARD + "</body>");
    fs.writeFileSync(f, h);
  }
  console.log(`${name.padEnd(44)} -> ${go.slice(0, 48)}...  (${links} links -> /go)`);
}
fs.writeFileSync(path.join(ROOT, "go-urls.json"), JSON.stringify(map, null, 2) + "\n");
console.log(`\nWrote go-urls.json (${Object.keys(map).length} landings). Now run setup-locale-routing.mjs to build the /go endpoint.`);
