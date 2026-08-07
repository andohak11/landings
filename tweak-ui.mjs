#!/usr/bin/env node
/**
 * tweak-ui.mjs  (LOCAL ONLY — does not commit/push/deploy)
 *
 * Subtly differentiates each landing:
 *  - a per-landing hue shift (keeps the same colour family; header/banner IMAGES
 *    are preserved via a counter-rotate on <img>/media)
 *  - optional sidebar removal (only where the container is a clean `.sidebar`)
 *
 * Injects one <style id="uniq-tweaks"> before </body> in every index.html of the
 * landing. Idempotent & re-runnable. Header, banner and images are untouched.
 *
 * Usage: node tweak-ui.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = ".";
const SKIP = new Set([".git", ".vercel", "node_modules"]);

// per-landing: hue (deg, subtle ±) and whether to drop the sidebar
const CONFIG = {
  "FR_STAKE_CURSED-dayofbonus0002.lat":        { hue: 25,  sidebar: true  },
  "FR_BC.GAME_SPINBAO-dayofbonus0002.live":    { hue: 22,  sidebar: true  },
  "GR_SPINZEN_CURSED-dayofbonus0002.my":       { hue: 18,  sidebar: true  },
  "FR_RAINBET_SAILSPINS-dayofbonus0002.life":  { hue: -22, sidebar: false },
  "ES_HUGO_SAILSPINS-dayofbonus0002.lol":      { hue: 16,  sidebar: false },
  "ES_WINSHARK_SPINBAO-dayofbonus0002.loan":   { hue: -16, sidebar: false },
  "GR_22BET_SAILSPINS-dayofbonus0002.space":   { hue: 30,  sidebar: false },
  "GR_DRAGONIA_SPIBAO-dayofbonus0002":         { hue: -30, sidebar: false },
  "NO_BETNINJA_SAILSPINS-dayofbonus0002.store":{ hue: -18, sidebar: false },
  "NO_HELLSPIN_CURSED-dayofbonus0002.site":    { hue: 28,  sidebar: false },
  "NO_IVIBETPLAYX_CURSED-dayofbonus0002.today":{ hue: -28, sidebar: false },
  "NO_ROBOCAT_SPINBAO-dayofbonus0002.xyz":     { hue: 34,  sidebar: false },
};

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

function styleBlock(hue, sidebar) {
  const side = sidebar ? ".sidebar{display:none!important}" : "";
  return `<style id="uniq-tweaks">html{filter:hue-rotate(${hue}deg) saturate(1.05)}` +
    `img,picture,video,canvas,svg{filter:hue-rotate(${-hue}deg) saturate(.95)}${side}</style>`;
}

for (const [folder, cfg] of Object.entries(CONFIG)) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) { console.warn(`  (!) missing: ${folder}`); continue; }
  const block = styleBlock(cfg.hue, cfg.sidebar);
  const files = findHtml(dir);
  for (const f of files) {
    let h = fs.readFileSync(f, "utf8");
    h = h.replace(/<style id="uniq-tweaks">[\s\S]*?<\/style>/i, "");
    if (!/<\/body>/i.test(h)) { console.warn(`  (!) no </body> in ${f}`); continue; }
    h = h.replace(/<\/body>/i, block + "</body>");
    fs.writeFileSync(f, h);
  }
  console.log(`${folder.padEnd(44)} hue ${String(cfg.hue).padStart(3)}째  sidebar ${cfg.sidebar ? "REMOVED" : "kept"}  (${files.length} file[s])`);
}
console.log("\nDone — LOCAL files only. Nothing committed, pushed, or deployed to production.");
