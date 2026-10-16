// Validates the event data against the Bible text and prints each passage's
// boundaries so references can be proof-read by eye.
//
// Usage: node scripts/check-data.mjs [--print]
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../js/data/", import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["matthew.js", "text-matthew.js"]) {
  vm.runInContext(readFileSync(new URL(f, root), "utf8"), ctx, { filename: f });
}
const { GOSPELS, BIBLE_TEXT } = ctx.window;
const CHAPTER_COUNTS = { Matthew: 28, Mark: 16, Luke: 24, John: 21 };
const print = process.argv.includes("--print");
const errors = [];
const ids = new Set();
const cut = (s, n = 110) => (s.length > n ? s.slice(0, n) + "…" : s);

for (const g of Object.values(GOSPELS)) {
  const text = BIBLE_TEXT[g.book];
  if (!text) { errors.push(`${g.book}: no text loaded`); continue; }
  const covered = new Set();
  for (const e of g.events) {
    const where = `${e.id} (${g.book} ${e.ch}:${e.v?.join("-")})`;
    if (ids.has(e.id)) errors.push(`${where}: duplicate id`);
    ids.add(e.id);
    for (const k of ["id", "title", "clue"]) if (!e[k]) errors.push(`${where}: missing ${k}`);
    const verses = text[e.ch];
    if (!verses) { errors.push(`${where}: chapter out of range`); continue; }
    covered.add(e.ch);
    const [a, b] = e.v;
    if (!(a >= 1 && b >= a && b <= verses.length)) errors.push(`${where}: verses out of range (chapter has ${verses.length})`);
    if (!(e.key >= a && e.key <= b)) errors.push(`${where}: key verse ${e.key} outside passage`);
    for (const p of e.par || []) {
      const m = /^(Matthew|Mark|Luke|John) (\d+)$/.exec(p);
      if (!m || +m[2] < 1 || +m[2] > CHAPTER_COUNTS[m[1]] || m[1] === g.book) errors.push(`${where}: bad parallel "${p}"`);
    }
    for (const c of e.confuse || []) {
      if (c === e.ch || c < 1 || c > g.chapters) errors.push(`${where}: bad confuse chapter ${c}`);
    }
    if (print) {
      console.log(`\n■ ${g.book} ${e.ch}:${a}–${b}  ${e.title}`);
      if (a > 1) console.log(`   (prev ${a - 1}) ${cut(verses[a - 2])}`);
      console.log(`   [${a}] ${cut(verses[a - 1])}`);
      if (b !== a) console.log(`   [${b}] ${cut(verses[b - 1])}`);
      if (b < verses.length) console.log(`   (next ${b + 1}) ${cut(verses[b], 80)}`);
      console.log(`   KEY ${e.key}: ${verses[e.key - 1]}`);
    }
  }
  for (let c = 1; c <= g.chapters; c++) if (!covered.has(c)) errors.push(`${g.book} ${c}: no events`);
  console.error(`${g.book}: ${g.events.length} events across ${covered.size}/${g.chapters} chapters`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.error("All checks passed.");
