// Validates the event data against the Bible text and prints each passage's
// boundaries so references can be proof-read by eye.
//
// Usage: node scripts/check-data.mjs [--print [Book]]
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../js/data/", import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
const BOOKS = ["matthew", "mark", "luke", "john"];
for (const f of BOOKS.flatMap((b) => [`${b}.js`, `text-${b}.js`])) {
  vm.runInContext(readFileSync(new URL(f, root), "utf8"), ctx, { filename: f });
}
const { GOSPELS, BIBLE_TEXT } = ctx.window;
const CHAPTER_COUNTS = { Matthew: 28, Mark: 16, Luke: 24, John: 21 };
const printAt = process.argv.indexOf("--print");
const printBook = printAt >= 0 ? process.argv[printAt + 1] : undefined;
const shouldPrint = (book) => printAt >= 0 && (!printBook || printBook === book);
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
    if (/['"]/.test(e.title + e.clue)) errors.push(`${where}: use curly quotes and apostrophes`);
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
    if (shouldPrint(g.book)) {
      console.log(`\n■ ${g.book} ${e.ch}:${a}–${b}  ${e.title}`);
      if (a > 1) console.log(`   (prev ${a - 1}) ${cut(verses[a - 2])}`);
      console.log(`   [${a}] ${cut(verses[a - 1])}`);
      if (b !== a) console.log(`   [${b}] ${cut(verses[b - 1])}`);
      if (b < verses.length) console.log(`   (next ${b + 1}) ${cut(verses[b], 80)}`);
      console.log(`   KEY ${e.key}: ${verses[e.key - 1]}`);
    }
  }
  for (let c = 1; c <= g.chapters; c++) if (!covered.has(c)) errors.push(`${g.book} ${c}: no events`);
  if (Object.keys(text).length !== g.chapters) errors.push(`${g.book}: text has ${Object.keys(text).length} chapters, data says ${g.chapters}`);
  let prev = 0;
  for (const s of g.sections) {
    if (s.from !== prev + 1 || s.to < s.from) errors.push(`${g.book}: sections must run in order without gaps (at ${s.from}–${s.to})`);
    prev = s.to;
  }
  if (prev !== g.chapters) errors.push(`${g.book}: sections stop at chapter ${prev}`);
  if (!g.intro) errors.push(`${g.book}: missing intro`);
  if (g.sections.some((s) => s.mark) && !(g.markNote && g.markLegend && g.markTag)) errors.push(`${g.book}: marked sections need markNote, markLegend and markTag`);
  console.error(`${g.book}: ${g.events.length} events across ${covered.size}/${g.chapters} chapters`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.error("All checks passed.");
