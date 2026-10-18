// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const W = require("../js/which-gospel-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
const ALL = ["Matthew", "Mark", "Luke", "John"];
for (const f of ["which-gospel.js", ...ALL.map((b) => `text-${b.toLowerCase()}.js`)]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { WHICH_GOSPEL, BIBLE_TEXT } = ctx.window;
const pool = W.itemPool(WHICH_GOSPEL);

test("parseRef reads single verses and ranges, and rejects anything else", () => {
  assert.deepEqual(W.parseRef("Luke 15:11-32"), { book: "Luke", ch: 15, v: [11, 32] });
  assert.deepEqual(W.parseRef("John 11:35"), { book: "John", ch: 11, v: [35, 35] });
  assert.equal(W.parseRef("Acts 1:1"), null);
  assert.equal(W.parseRef("Luke 15"), null);
});

test("every item's answer lists its Gospels once each, in Bible order", () => {
  for (const it of pool) {
    assert.ok(it.answer.length >= 1 && it.answer.length <= 4, it.id);
    assert.deepEqual(it.answer, ALL.filter((b) => it.refs.some((r) => r.book === b)), it.id);
  }
  const fig = pool.find((it) => it.id === "wg-fig-tree");
  assert.deepEqual(fig.answer, ["Matthew", "Mark"], "two passages in Mark still count Mark once");
});

test("every passage has text to show", () => {
  for (const it of pool) {
    for (const r of it.refs) {
      const verses = Engine.passage(BIBLE_TEXT, r);
      assert.ok(verses.length && verses.every((v) => v.text), `${it.id} ${Engine.formatRef(r)}`);
    }
  }
});

test("grade needs exactly the right Gospels", () => {
  const answer = ["Matthew", "Mark", "Luke"];
  assert.deepEqual(W.grade(["Matthew", "Mark", "Luke"], answer), { ok: true, missed: [], extra: [] });
  assert.deepEqual(W.grade(["Matthew", "Luke"], answer), { ok: false, missed: ["Mark"], extra: [] });
  assert.deepEqual(W.grade(["Matthew", "Mark", "Luke", "John"], answer), { ok: false, missed: [], extra: ["John"] });
  assert.deepEqual(W.grade(["John"], ["Luke"]), { ok: false, missed: ["Luke"], extra: ["John"] });
});

test("revealOne fixes a Gospel the player has wrong when there is one", () => {
  const rng = Engine.seededRng(3);
  for (let i = 0; i < 50; i++) {
    // Ticked John (wrong) and left out Mark (wrong); Matthew and Luke are right.
    const b = W.revealOne(["Matthew", "Luke", "John"], ["Matthew", "Mark", "Luke"], [], rng);
    assert.ok(b === "Mark" || b === "John", b);
  }
  // All correct already: reveals any Gospel not yet settled.
  assert.ok(ALL.includes(W.revealOne(["Luke"], ["Luke"], [], rng)));
  assert.equal(W.revealOne(["Luke"], ["Luke"], ["Luke", "Matthew", "Mark"], rng), "John");
  assert.equal(W.revealOne([], ["Luke"], ALL, rng), null);
});

test("rounds mix questions told by one, two, three and four Gospels", () => {
  const rng = Engine.seededRng(11);
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let i = 0; i < 300; i++) {
    for (const it of W.pickItems(pool, {}, 10, rng)) seen[it.answer.length]++;
  }
  const total = Object.values(seen).reduce((a, b) => a + b, 0);
  // Without balancing, single-Gospel questions would be about half of every round.
  for (const n of [1, 2, 3, 4]) {
    const share = seen[n] / total;
    assert.ok(share > 0.12 && share < 0.45, `answers of size ${n}: ${(share * 100).toFixed(1)}%`);
  }
});

test("a round never asks two questions from the same group", () => {
  const rng = Engine.seededRng(5);
  for (let i = 0; i < 200; i++) {
    const round = W.pickItems(pool, {}, 10, rng);
    assert.equal(new Set(round.map((it) => it.id)).size, 10);
    const groups = round.filter((it) => it.group).map((it) => it.group);
    assert.equal(new Set(groups).size, groups.length, `repeated group in ${round.map((it) => it.id).join(", ")}`);
  }
});

test("missed questions come up more often than mastered ones", () => {
  const rng = Engine.seededRng(8);
  const missed = pool.find((it) => it.id === "wg-zacchaeus");
  const known = pool.find((it) => it.id === "wg-prodigal");
  const stats = { [missed.id]: { seen: 3, right: 0, box: 0 }, [known.id]: { seen: 5, right: 5, box: 5 } };
  let m = 0, k = 0;
  for (let i = 0; i < 2000; i++) {
    const round = W.pickItems(pool, stats, 10, rng).map((it) => it.id);
    if (round.includes(missed.id)) m++;
    if (round.includes(known.id)) k++;
  }
  assert.ok(m > k * 3, `missed ${m} vs mastered ${k}`);
});

test("answer labels", () => {
  assert.equal(W.answerLabel(["Matthew", "Mark", "Luke", "John"]), "All four Gospels");
  assert.equal(W.answerLabel(["Matthew", "Mark", "Luke"]), "Matthew, Mark and Luke");
  assert.equal(W.answerLabel(["Mark", "Luke"]), "Mark and Luke");
  assert.equal(W.answerLabel(["John"]), "Only John");
});

test("answers sort with all four first and single Gospels last, in Bible order", () => {
  const sorted = [["John"], ["Matthew", "Luke"], ["Matthew", "Mark", "Luke", "John"], ["Matthew"], ["Matthew", "Mark"], ["Matthew", "Mark", "Luke"]]
    .sort(W.compareAnswers);
  assert.deepEqual(sorted, [["Matthew", "Mark", "Luke", "John"], ["Matthew", "Mark", "Luke"], ["Matthew", "Mark"], ["Matthew", "Luke"], ["Matthew"], ["John"]]);
});

test("ranks cover every score and quote the World English Bible", () => {
  assert.equal(Engine.rankFor(10, 10, W.RANKS).title, "Servant of the word");
  assert.equal(Engine.rankFor(0, 10, W.RANKS).title, "Mustard seed");
  assert.equal(Engine.rankFor(0, 10).title, "Mustard seed", "Chapter & Verse ranks are still the default");
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of W.RANKS) {
    const ref = W.parseRef(r.ref);
    const verse = BIBLE_TEXT[ref.book][ref.ch][ref.v[0] - 1];
    // Each note quotes at least three words in a row from its verse.
    const note = words(r.note).split(" ");
    const ok = note.some((_, i) => i + 3 <= note.length && words(verse).includes(note.slice(i, i + 3).join(" ")));
    assert.ok(ok, `${r.title}: "${r.note}" vs ${r.ref}`);
  }
});
