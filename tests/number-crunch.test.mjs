// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const N = require("../js/number-crunch-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["number-crunch.js", "number-crunch-text.js"]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { NUMBER_CRUNCH: FACTS, NUMBER_CRUNCH_TEXT: TEXT } = ctx.window;
const fact = (a, max, min) => ({ a, max, min });

test("the slider has about a thousand steps, and every answer is on one", () => {
  assert.equal(N.step(fact(5, 20)), 1);
  assert.equal(N.step(fact(969, 1200)), 1);
  assert.equal(N.step(fact(3000, 9999)), 1);
  assert.equal(N.step(fact(42360, 90000)), 10);
  assert.equal(N.step(fact(185000, 400000)), 100);
  assert.equal(N.step(fact(600000, 1000000)), 1000);
  for (const f of FACTS) {
    const s = N.step(f);
    assert.equal(f.a % s, 0, `${f.id}: ${f.a} on a step of ${s}`);
    const start = N.startGuess(f);
    assert.ok(start >= (f.min || 0) && start <= f.max && start % s === 0, `${f.id}: starts at ${start}`);
  }
});

test("closeness scores 100 for the exact number, falling to nothing a quarter of the range away", () => {
  const f = fact(40, 120);
  assert.deepEqual(N.score(f, 40), { total: 100 + N.BULLSEYE, close: 100, exact: true, off: 0, ok: true });
  assert.equal(N.score(f, 55).close, 50, "half the tolerance away is 50");
  assert.ok(N.score(f, 55).ok, "50 points counts as close");
  assert.ok(!N.score(f, 56).ok);
  assert.equal(N.score(f, 70).close, 0, "a quarter of the range away is nothing");
  assert.equal(N.score(f, 120).close, 0, "never below nothing");
  assert.equal(N.score(f, 25).close, N.score(f, 55).close, "under and over score alike");
  let last = Infinity;
  for (let g = 40; g <= 120; g++) {
    const c = N.score(f, g).close;
    assert.ok(c <= last, "points never rise as the guess moves away");
    last = c;
  }
});

test("verdicts follow the points", () => {
  const f = fact(100, 400);
  assert.equal(N.verdict(N.score(f, 100)), "Bullseye!");
  assert.equal(N.verdict(N.score(f, 105)), "So close!");
  assert.equal(N.verdict(N.score(f, 125)), "Close!");
  assert.equal(N.verdict(N.score(f, 140)), "Not bad.");
  assert.equal(N.verdict(N.score(f, 180)), "A long way off.");
  assert.equal(N.verdict(N.score(f, 400)), "Nowhere near.");
});

test("books and testaments are read from the reference", () => {
  assert.equal(N.bookOf("Genesis 5:27"), "Genesis");
  assert.equal(N.bookOf("1 Kings 4:32"), "1 Kings");
  assert.equal(N.bookOf("2 Kings 4:42-44"), "2 Kings");
  assert.equal(N.testament("Psalm 90:10"), "Old");
  assert.equal(N.testament("2 Corinthians 11:24"), "New");
  assert.equal(N.testament("Revelation 7:4"), "New");
});

test("a round never asks two facts from the same group", () => {
  const rng = Engine.seededRng(3);
  for (let i = 0; i < 300; i++) {
    const round = N.pickFacts(FACTS, {}, 10, rng);
    assert.equal(new Set(round.map((f) => f.id)).size, 10);
    const groups = round.filter((f) => f.group).map((f) => f.group);
    assert.equal(new Set(groups).size, groups.length, groups.join(", "));
  }
});

test("ranks cover every score and quote the World English Bible", () => {
  assert.equal(N.rankFor([{ close: 100 }, { close: 90 }]).title, "Counter of the stars");
  assert.equal(N.rankFor([{ close: 0 }]).title, "Beyond counting");
  assert.equal(N.rankFor([]).title, "Beyond counting");
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of N.RANKS) {
    const text = (TEXT[r.ref] || []).join(" ");
    assert.ok(words(text).includes(words(r.note)), `${r.ref}: "${r.note}"`);
  }
});
