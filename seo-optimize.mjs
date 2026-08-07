#!/usr/bin/env node
/**
 * seo-optimize.mjs
 *
 * Per landing (technical SEO hygiene — not content spinning):
 *   - self-referencing <link rel="canonical"> per locale URL
 *   - og:url -> the landing's OWN domain (was pointing at the real brand)
 *   - fill an empty <title>
 *   - write robots.txt + sitemap.xml at the landing root (served at /robots.txt, /sitemap.xml)
 *
 * Idempotent. Run AFTER setup-locale-routing.mjs (so the <base> markers exist).
 * Usage: node seo-optimize.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = ".";
const SKIP = new Set([".git", ".vercel", "node_modules", "assets"]);

function domainOf(folder) {
  const m = folder.match(/dayofbonus0002\.([a-z0-9]+)$/i);
  if (m) return `dayofbonus0002.${m[1].toLowerCase()}`;
  if (/dragonia/i.test(folder)) return "dayofbonus0002.mom"; // folder lacks the .mom suffix
  return null;
}
function brandOf(folder) {
  const parts = folder.split("-")[0].split("_"); // FR_RAINBET_SAILSPINS -> [FR,RAINBET,SAILSPINS]
  const b = parts[1] || parts[0];
  return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}
function localesOf(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name))
    .filter((e) => fs.existsSync(path.join(dir, e.name, "index.html")))
    .map((e) => e.name).sort();
}

function optimize(file, url, brand) {
  let h = fs.readFileSync(file, "utf8");
  // 1) strip any existing canonical, then add self-canonical
  h = h.replace(/<link[^>]*rel="canonical"[^>]*>\s*/gi, "");
  let inject = `<link rel="canonical" href="${url}">`;
  // 2) og:url -> own domain (replace if present, else add)
  if (/property="og:url"/i.test(h)) {
    h = h.replace(/(<meta[^>]*property="og:url"[^>]*content=")[^"]*(")/i, `$1${url}$2`);
  } else {
    inject += `<meta property="og:url" content="${url}">`;
  }
  // insert right after the <base ...LR-BASE--> marker (or after <head>)
  if (/<!--LR-BASE-->/.test(h)) h = h.replace(/(<!--LR-BASE-->)/, `$1${inject}`);
  else if (/<head[^>]*>/i.test(h)) h = h.replace(/(<head[^>]*>)/i, `$1${inject}`);
  // 3) fill empty title
  h = h.replace(/<title>\s*<\/title>/i, `<title>${brand} — Casino Bonus, Free Spins & Sports Betting</title>`);
  fs.writeFileSync(file, h);
}

const landings = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name))
  .map((e) => e.name)
  .filter((n) => fs.existsSync(path.join(n, "default", "index.html")));

for (const folder of landings) {
  const domain = domainOf(folder);
  if (!domain) { console.warn(`  (!) no domain for ${folder}`); continue; }
  const brand = brandOf(folder);
  const locales = localesOf(folder);
  const urls = locales.map((l) => (l === "default" ? `https://${domain}/` : `https://${domain}/${l}/`));

  for (const loc of locales) {
    const url = loc === "default" ? `https://${domain}/` : `https://${domain}/${loc}/`;
    optimize(path.join(folder, loc, "index.html"), url, brand);
  }

  fs.writeFileSync(path.join(folder, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml\n`);
  fs.writeFileSync(path.join(folder, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`).join("\n") +
    `\n</urlset>\n`);

  console.log(`${folder.padEnd(44)} ${domain}  canon+og:${locales.length}  robots+sitemap (${urls.length} url)`);
}
console.log("\nDone. Redeploy to apply. robots.txt served at /robots.txt, sitemap at /sitemap.xml");
