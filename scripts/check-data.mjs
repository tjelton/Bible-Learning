// Validates the game data against the Bible text and prints each Chapter &
// Verse passage's boundaries so references can be proof-read by eye.
//
// Usage: node scripts/check-data.mjs [--print [Book]]
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");

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

// ── Which Gospel? ──
// Every passage must exist and contain the item's `find` phrase; with
// `exclusive`, the phrase must appear nowhere in the Gospels left out. A
// saying's title must be the passage's own words.
vm.runInContext(readFileSync(new URL("which-gospel.js", root), "utf8"), ctx, { filename: "which-gospel.js" });
const ITEMS = ctx.window.WHICH_GOSPEL;
const KINDS = ["event", "detail", "teaching", "saying"];
const phrase = (p) => new RegExp(`(?<![\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const bookText = (book) => Object.values(BIBLE_TEXT[book]).flat().join(" ");
const patterns = {};
for (const it of ITEMS) {
  const where = `which-gospel ${it.id}`;
  if (ids.has(it.id)) errors.push(`${where}: duplicate id`);
  ids.add(it.id);
  for (const k of ["id", "title", "clue", "find"]) if (!it[k]) errors.push(`${where}: missing ${k}`);
  if (!KINDS.includes(it.kind)) errors.push(`${where}: kind must be one of ${KINDS.join(", ")}`);
  if (/['"]/.test(it.title + it.clue + (it.note || ""))) errors.push(`${where}: use curly quotes and apostrophes`);
  const finds = [].concat(it.find || []).map(phrase);
  const passages = [];
  for (const r of it.refs || []) {
    const m = /^(Matthew|Mark|Luke|John) (\d+):(\d+)(?:-(\d+))?$/.exec(r);
    const verses = m && BIBLE_TEXT[m[1]][m[2]];
    const [a, b] = m ? [+m[3], +(m[4] || m[3])] : [];
    if (!verses || !(a >= 1 && b >= a && b <= verses.length)) { errors.push(`${where}: bad reference "${r}"`); continue; }
    const text = verses.slice(a - 1, b).join(" ");
    passages.push({ book: m[1], text });
    if (!finds.some((re) => re.test(text))) errors.push(`${where}: "${[].concat(it.find).join(" / ")}" not found in ${r}`);
  }
  if (!passages.length) { errors.push(`${where}: no references`); continue; }
  const books = new Set(passages.map((p) => p.book));
  if (it.exclusive) {
    for (const book of Object.keys(CHAPTER_COUNTS)) {
      if (!books.has(book) && finds.some((re) => re.test(bookText(book)))) errors.push(`${where}: marked exclusive, but "${[].concat(it.find).join(" / ")}" also appears in ${book}`);
    }
  }
  if (it.kind === "saying" && !passages.some((p) => words(p.text).includes(words(it.title)))) {
    errors.push(`${where}: a saying's title must be quoted from one of its passages`);
  }
  const pattern = [...books].join(" + ");
  patterns[pattern] = (patterns[pattern] || 0) + 1;
}
console.error(`Which Gospel?: ${ITEMS.length} questions`);
for (const [p, n] of Object.entries(patterns).sort((x, y) => y[1] - x[1])) console.error(`  ${String(n).padStart(3)}  ${p}`);

// ── Clusters ──
// Every passage must be downloaded and contain the word (or its `find`
// phrase); a book group's words must be book names; and every group must be
// able to appear in some puzzle.
vm.runInContext(readFileSync(new URL("clusters.js", root), "utf8"), ctx, { filename: "clusters.js" });
vm.runInContext(readFileSync(new URL("clusters-text.js", root), "utf8"), ctx, { filename: "clusters-text.js" });
const { CLUSTERS, CLUSTERS_TEXT } = ctx.window;
const CL = require("../js/clusters-engine.js");
const clGroups = CL.prepare(CLUSTERS);
for (const g of CLUSTERS) {
  const where = `clusters ${g.id}`;
  if (ids.has(g.id)) errors.push(`${where}: duplicate id`);
  ids.add(g.id);
  for (const k of ["id", "title", "note"]) if (!g[k]) errors.push(`${where}: missing ${k}`);
  if (!CL.LEVELS.includes(g.level)) errors.push(`${where}: level must be 1–4`);
  if (/['"]/.test(g.title + g.note + g.items.map((it) => it[0]).join("") + (g.fits || []).join(""))) errors.push(`${where}: use curly quotes and apostrophes`);
  if (g.items.length < 4) errors.push(`${where}: needs at least four items`);
  const words = g.items.map((it) => it[0].toLowerCase());
  if (new Set(words).size !== words.length) errors.push(`${where}: an item is listed twice`);
  for (const f of g.fits || []) if (words.includes(f.toLowerCase())) errors.push(`${where}: "${f}" is in both items and fits`);
  for (const [word, ref, find] of g.items) {
    const verses = CLUSTERS_TEXT[ref];
    if (!verses) { errors.push(`${where}: no text for "${ref}" (run scripts/fetch-clusters-text.mjs)`); continue; }
    if (g.books) {
      if (ref !== `${word} 1:1`) errors.push(`${where}: a book's reference must be its first verse ("${word} 1:1")`);
    } else if (!phrase(find || word).test(verses.join(" "))) {
      errors.push(`${where}: "${find || word}" not found in ${ref}`);
    }
  }
}
// A group no puzzle can include would never be seen: try each one as the seed.
const clRng = Engine.seededRng(7);
for (const g of clGroups) {
  let ok = false;
  for (let i = 0; i < 200 && !ok; i++) {
    const p = CL.buildPuzzle(clGroups, clRng, { seen: Object.fromEntries(clGroups.filter((o) => o.level === g.level && o !== g).map((o) => [o.id, 1e9])) });
    ok = !!p && p.groups.some((pg) => pg.id === g.id);
  }
  if (!ok) errors.push(`clusters ${g.id}: never fits in a puzzle with groups from the other levels`);
}
console.error(`Clusters: ${CLUSTERS.length} groups (${CL.LEVELS.map((lv) => CLUSTERS.filter((g) => g.level === lv).length).join(" / ")} by level)`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.error("All checks passed.");
