// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const C = require("../js/clusters-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["clusters.js", "clusters-text.js"]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { CLUSTERS, CLUSTERS_TEXT } = ctx.window;
const groups = C.prepare(CLUSTERS);
const byId = Object.fromEntries(groups.map((g) => [g.id, g]));

function puzzles(n, seed) {
  const rng = Engine.seededRng(seed);
  return Array.from({ length: n }, () => C.buildPuzzle(groups, rng, {}));
}

test("every puzzle has one group per level and sixteen different words", () => {
  for (const p of puzzles(500, 1)) {
    assert.ok(p, "a puzzle can always be built");
    assert.deepEqual(p.groups.map((g) => g.level), C.LEVELS);
    assert.equal(p.tiles.length, 16);
    assert.equal(new Set(p.tiles.map((w) => w.toLowerCase())).size, 16);
    assert.deepEqual(p.tiles.slice().sort(), p.groups.flatMap((g) => g.words).sort());
    for (const g of p.groups) {
      assert.equal(g.words.length, 4);
      for (const w of g.words) assert.ok(byId[g.id].items.some((it) => it[0] === w), `${w} is an item of ${g.id}`);
    }
  }
});

test("every word belongs to exactly one of its puzzle's groups", () => {
  for (const p of puzzles(500, 2)) {
    const chosen = p.groups.map((g) => byId[g.id]);
    for (const w of p.tiles) {
      const homes = chosen.filter((g) => g.all.has(w.toLowerCase()));
      assert.equal(homes.length, 1, `${w} fits ${homes.map((g) => g.id).join(" and ")}`);
    }
  }
});

test("groups that share a family never meet", () => {
  for (const p of puzzles(500, 3)) {
    const families = p.groups.map((g) => byId[g.id].family).filter(Boolean);
    assert.equal(new Set(families).size, families.length);
  }
});

test("a word in two groups is left out rather than shown", () => {
  const judges = byId["cl-judges"];
  const prophetesses = byId["cl-prophetesses"];
  assert.ok(C.usable(judges, [judges, prophetesses]).every((it) => it[0] !== "Deborah"));
  assert.ok(C.usable(prophetesses, [judges, prophetesses]).every((it) => it[0] !== "Deborah"));
  assert.ok(C.usable(judges, [judges]).some((it) => it[0] === "Deborah"));
  // Kings and child kings share too many words to leave either four of its own.
  assert.equal(C.compatible([byId["cl-kings"]], byId["cl-child-kings"]), false);
});

test("new puzzles favour groups not seen, and hold back recent ones", () => {
  const rng = Engine.seededRng(4);
  const progress = { seen: {}, recent: [] };
  const shown = [];
  for (let i = 0; i < 15; i++) {
    const p = C.buildPuzzle(groups, rng, progress);
    const ids = p.groups.map((g) => g.id);
    for (const id of ids) {
      assert.ok(!progress.recent.includes(id), `${id} came back within ${C.RECENT} groups`);
      progress.seen[id] = (progress.seen[id] || 0) + 1;
    }
    progress.recent = progress.recent.concat(ids).slice(-C.RECENT);
    shown.push(...ids);
  }
  assert.ok(new Set(shown).size >= 50, `15 puzzles showed ${new Set(shown).size} different groups`);
});

test("checking a guess finds the group, or says when three of it belong together", () => {
  const p = puzzles(1, 5)[0];
  const [a, b] = p.groups;
  assert.deepEqual(C.check(p, [], a.words.slice().reverse()), { id: a.id, close: false });
  assert.deepEqual(C.check(p, [], a.words.slice(0, 3).concat(b.words[0])), { id: null, close: true });
  assert.deepEqual(C.check(p, [], a.words.slice(0, 2).concat(b.words.slice(0, 2))), { id: null, close: false });
  assert.equal(C.guessKey(["b", "a", "c", "d"]), C.guessKey(["d", "c", "b", "a"]));
});

test("ranks cover every finish and quote the World English Bible", () => {
  for (let m = 0; m < C.MISTAKES; m++) assert.ok(C.rankFor(m, true), `a rank for ${m} mistakes`);
  assert.ok(C.rankFor(C.MISTAKES, false).lost);
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of C.RANKS) {
    const text = (CLUSTERS_TEXT[r.ref] || []).join(" ");
    assert.ok(words(text).includes(words(r.note)), `${r.ref}: "${r.note}"`);
  }
});
