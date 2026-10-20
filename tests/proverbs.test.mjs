// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const P = require("../js/proverbs-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../js/data/text-proverbs.js", import.meta.url), "utf8"), ctx);
const TEXT = ctx.window.BIBLE_TEXT.Proverbs;
const pool = P.sayings(TEXT);
const byId = Object.fromEntries(pool.map((s) => [s.id, s]));
const verse = (ch, v) => TEXT[ch][v - 1];

test("proverbs split where their two lines meet", () => {
  assert.deepEqual(P.split(verse(15, 1)), { text: verse(15, 1), first: "A gentle answer turns away wrath", second: "but a harsh word stirs up anger.", kind: "but" });
  assert.equal(P.split(verse(16, 18)).second, "and a haughty spirit before a fall.");
  assert.equal(P.split(verse(26, 11)).kind, "so");
  assert.equal(P.split(verse(21, 9)).kind, "than");
  const two = P.split(verse(10, 15));
  assert.equal(two.kind, "sentence");
  assert.equal(two.first, "The rich man’s wealth is his strong city.", "a full stop stays with the first line");
  assert.equal(P.split(verse(10, 1)).first, "A wise son makes a glad father", "10:1’s title is dropped");
});

test("sayings that run on, or quote someone, are left out", () => {
  assert.equal(P.split(verse(25, 4)), null, "ends mid-sentence");
  assert.equal(P.split(verse(25, 7)), null, "starts mid-sentence");
  assert.equal(P.split(verse(22, 13)), null, "a quotation");
  assert.equal(P.split(verse(25, 1)), null, "a heading");
});

test("every saying comes from the two collections and rebuilds its verse", () => {
  assert.ok(pool.length > 350, `${pool.length} sayings`);
  assert.equal(new Set(pool.map((s) => s.id)).size, pool.length);
  const kinds = {};
  for (const s of pool) {
    const c = P.COLLECTIONS[s.collection];
    const at = (ch, v) => ch * 1000 + v;
    assert.ok(at(s.ch, s.v) >= at(...c.from) && at(s.ch, s.v) <= at(...c.to), s.id);
    assert.ok(verse(s.ch, s.v).endsWith(s.text) && s.text.startsWith(s.first) && s.text.endsWith(s.second), s.id);
    kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  }
  for (const [k, n] of Object.entries(kinds)) assert.ok(n >= P.MIN_KIND, `${k}: ${n}`);
});

test("near-duplicate proverbs share a group, and groups stay small", () => {
  for (const [a, b] of [["pv-14-12", "pv-16-25"], ["pv-21-9", "pv-25-24"], ["pv-22-3", "pv-27-12"], ["pv-10-1", "pv-15-20"]]) {
    assert.equal(byId[a].group, byId[b].group, `${a} and ${b}`);
  }
  assert.notEqual(byId["pv-15-1"].group, byId["pv-16-18"].group);
  const sizes = {};
  for (const s of pool) sizes[s.group] = (sizes[s.group] || 0) + 1;
  assert.ok(Math.max(...Object.values(sizes)) <= 4, "no runaway group");
});

test("four endings: the right one, and three of the same kind that can’t be mistaken for it", () => {
  const rng = Engine.seededRng(2);
  for (const s of pool) {
    const endings = P.choices(s, pool, rng);
    assert.equal(endings.length, 4, s.id);
    assert.equal(new Set(endings).size, 4, s.id);
    assert.ok(endings.includes(s.second), s.id);
    for (const t of endings) {
      if (t === s.second) continue;
      const o = pool.find((x) => x.second === t && x.kind === s.kind);
      assert.ok(o, `${s.id}: “${t}” is the ending of another proverb of the same kind`);
      assert.notEqual(o.group, s.group, `${s.id}: “${t}” is a near-duplicate`);
      assert.ok(P.overlap(t, s.second) < P.CLASH, `${s.id}: “${t}” is too like “${s.second}”`);
    }
  }
});

test("the 50/50 removes two wrong endings", () => {
  const s = byId["pv-15-1"];
  const endings = P.choices(s, pool, Engine.seededRng(4));
  for (let i = 0; i < 20; i++) {
    const gone = P.fiftyFifty(endings, s.second, Math.random);
    assert.equal(gone.length, 2);
    assert.ok(gone.every((j) => endings[j] !== s.second));
  }
});

test("a round never asks two near-duplicates", () => {
  const rng = Engine.seededRng(8);
  for (let i = 0; i < 300; i++) {
    const round = Engine.pickEvents(pool, {}, 10, rng);
    assert.equal(new Set(round.map((s) => s.group)).size, 10);
  }
});

test("ranks cover every score and quote the World English Bible", () => {
  assert.equal(Engine.rankFor(10, 10, P.RANKS).title, "A word fitly spoken");
  assert.equal(Engine.rankFor(0, 10, P.RANKS).title, "Go to the ant");
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of P.RANKS) {
    const [, ch, v] = /^Proverbs (\d+):(\d+)$/.exec(r.ref);
    assert.ok(words(verse(+ch, +v)).includes(words(r.note)), `${r.ref}: "${r.note}"`);
  }
});
