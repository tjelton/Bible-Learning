// Bundles the site (every part and game) into one self-contained HTML file (CSS and scripts inlined)
// for hosts that serve a single page, such as a claude.ai artifact.
//
// Usage: node scripts/build.mjs   →   dist/bible-learning.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
let html = read("index.html");

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, "<\\/script")}</script>`);
// The host supplies the document shell, viewport and safe-area padding, and
// manifest/icon files aren't published alongside the single page.
html = html
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?(html|head|body)[^>]*>\s*/gi, "")
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, "");

mkdirSync(new URL("dist/", root), { recursive: true });
writeFileSync(new URL("dist/bible-learning.html", root), html);
console.error(`dist/bible-learning.html (${(html.length / 1024).toFixed(0)} KB)`);
