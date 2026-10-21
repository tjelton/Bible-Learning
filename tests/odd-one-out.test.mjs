// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const C = require("../js/clusters-engine.js");
const O = require("../js/odd-one-out-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["clusters.js", "clusters-text.js"]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { CLUSTERS, CLUSTERS_TEXT } = ctx.window;
// Copied into plain arrays: arrays made inside the vm context fail deepEqual.
const groups = [...C.prepare(CLUSTERS)];
const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
const has = (g, w) => g.all.has(w.toLowerCase());

function sets(n, seed) {
  const rng = Engine.seededRng(seed);
  return groups.flatMap((g) => Array.from({ length: n }, () => O.question(groups, g, rng)));
}

test("each set is three words from one group and one from another group of the same kind", () => {
  for (const q of sets(30, 1)) {
    const g = byId[q.id];
    const home = byId[q.oddId];
    assert.equal(q.words.length, 4);
    assert.deepEqual([...q.words].sort(), [...q.three, q.odd].sort());
    for (const w of q.three) assert.ok(g.items.some((it) => it[0] === w), `${w} is an item of ${g.id}`);
    assert.ok(home.items.some((it) => it[0] === q.odd), `${q.odd} is an item of ${home.id}`);
    assert.notEqual(home.id, g.id);
    assert.equal(home.kind, g.kind, `${q.odd} (${home.kind}) with ${g.id} (${g.kind})`);
    assert.ok(!g.family || home.family !== g.family, `${home.id} shares a family with ${g.id}`);
  }
});

test("every set has exactly one answer", () => {
  for (const q of sets(30, 2)) {
    assert.ok(!has(byId[q.id], q.odd), `${q.odd} also belongs to ${q.id}`);
    // Leaving out any word but the odd one must not leave three that share a group.
    for (const left of q.three) {
      const rest = q.words.filter((w) => w !== left);
      const shared = groups.filter((g) => rest.every((w) => has(g, w)));
      assert.equal(shared.length, 0, `${rest.join(", ")} also share ${shared.map((g) => g.id).join(", ")}`);
    }
  }
});

test("an odd word that makes a second set of three is never used", () => {
  const machpelah = byId["cl-machpelah"];
  // Rachel, Sarah and Leah are all wives of the patriarchs.
  assert.equal(O.fair(groups, machpelah, ["Sarah", "Leah", "Isaac"], "Rachel"), false);
  assert.equal(O.fair(groups, machpelah, ["Sarah", "Leah", "Isaac"], "Esau"), true);
  // Deborah is one of the judges, so she can't be the odd one out among them.
  assert.equal(O.fair(groups, byId["cl-judges"], ["Gideon", "Ehud", "Othniel"], "Deborah"), false);
});

test("a round has ten different groups, from straightforward to tricky", () => {
  const rng = Engine.seededRng(3);
  for (let i = 0; i < 50; i++) {
    const round = O.roundGroups(groups, {}, rng);
    assert.deepEqual(round.map((g) => g.level), O.ROUND_LEVELS);
    assert.equal(new Set(round.map((g) => g.id)).size, O.ROUND_LEVELS.length);
  }
});

test("with three lamps, harder levels open up as the run grows", () => {
  assert.deepEqual([0, 2, 3, 5, 6, 9, 30].map(O.levelCap), [1, 1, 2, 2, 3, 4, 4]);
  const rng = Engine.seededRng(4);
  for (const run of [0, 3, 6, 9]) {
    const cap = O.levelCap(run);
    const levels = Array.from({ length: 300 }, () => O.lampGroup(groups, {}, run, rng, []).level);
    assert.ok(levels.every((lv) => lv <= cap), `run ${run} stays at level ${cap} or below`);
    const count = (lv) => levels.filter((l) => l === lv).length;
    for (let lv = 1; lv < cap; lv++) assert.ok(count(cap) > count(lv), `run ${run}: level ${cap} comes up more than level ${lv}`);
  }
});

test("recent groups are held back with three lamps", () => {
  const rng = Engine.seededRng(5);
  const recent = groups.filter((g) => g.level === 1).slice(0, 10).map((g) => g.id);
  for (let i = 0; i < 100; i++) assert.ok(!recent.includes(O.lampGroup(groups, {}, 0, rng, recent).id));
});

test("ranks cover every score and quote the World English Bible", () => {
  for (const ratio of [0, 0.25, 0.5, 0.79, 1]) assert.ok(Engine.rankFor(ratio * 10, 10, O.RANKS), `a rank for ${ratio}`);
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of O.RANKS) {
    const text = (CLUSTERS_TEXT[r.ref] || []).join(" ");
    assert.ok(words(text).includes(words(r.note)), `${r.ref}: "${r.note}"`);
  }
});
