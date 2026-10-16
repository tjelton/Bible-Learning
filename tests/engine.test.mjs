// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["matthew.js", "text-matthew.js"]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { GOSPELS, BIBLE_TEXT } = ctx.window;
const pool = Engine.eventPool(GOSPELS, ["Matthew"]);

// A made-up second Gospel to exercise the multi-book code paths.
const FAKE = Object.assign({}, GOSPELS, {
  Mark: {
    book: "Mark", chapters: 16, sections: [{ from: 1, to: 16, name: "All" }],
    events: [{ id: "mk-x", title: "x", ch: 6, v: [35, 44], key: 41, clue: "x", par: ["Matthew 14", "Luke 9", "John 6"] }],
  },
});

const same = (a, b) => a.book === b.book && a.ch === b.ch;

test("every event yields 4 distinct choices containing the answer, in every difficulty", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = Engine.seededRng(seed);
      for (const e of pool) {
        const choices = Engine.buildChoices(e, GOSPELS, ["Matthew"], difficulty, rng);
        assert.equal(choices.length, 4, `${e.id} ${difficulty}`);
        assert.equal(choices.filter((c) => same(c, e)).length, 1, `${e.id} missing answer`);
        const keys = new Set(choices.map((c) => c.book + c.ch));
        assert.equal(keys.size, 4, `${e.id} duplicate choice`);
        for (const c of choices) assert.ok(c.ch >= 1 && c.ch <= 28);
        const sorted = [...choices].sort((a, b) => a.ch - b.ch);
        assert.deepEqual(choices, sorted, "choices are in chapter order");
      }
    }
  }
});

test("easy choices are spread out; hard choices are close by", () => {
  const rng = Engine.seededRng(7);
  for (const e of pool) {
    const easy = Engine.buildChoices(e, GOSPELS, ["Matthew"], "easy", rng);
    for (const c of easy) if (!same(c, e)) assert.ok(Math.abs(c.ch - e.ch) >= 4, `${e.id} easy too close`);
    const hard = Engine.buildChoices(e, GOSPELS, ["Matthew"], "hard", rng);
    const near = hard.filter((c) => !same(c, e) && Math.abs(c.ch - e.ch) <= 3).length;
    assert.ok(near >= 2, `${e.id} hard should have neighbours`);
  }
});

test("the answer isn't always in the same position", () => {
  const counts = [0, 0, 0, 0];
  const rng = Engine.seededRng(99);
  for (let i = 0; i < 20; i++) {
    for (const e of pool) {
      for (const d of ["normal", "hard"]) {
        const choices = Engine.buildChoices(e, GOSPELS, ["Matthew"], d, rng);
        counts[choices.findIndex((c) => same(c, e))]++;
      }
    }
  }
  const total = counts.reduce((a, b) => a + b);
  for (const n of counts) assert.ok(n / total > 0.12, `position spread ${counts}`);
});

test("parallel accounts are never offered as wrong answers", () => {
  const e = Object.assign({ book: "Mark" }, FAKE.Mark.events[0]);
  for (let seed = 1; seed <= 300; seed++) {
    for (const d of ["easy", "normal", "hard"]) {
      const choices = Engine.buildChoices(e, FAKE, ["Matthew", "Mark"], d, Engine.seededRng(seed));
      assert.equal(choices.length, 4);
      assert.ok(!choices.some((c) => c.book === "Matthew" && c.ch === 14), "Matthew 14 is a parallel");
      assert.ok(choices.some((c) => same(c, e)));
    }
  }
});

test("50/50 removes exactly two wrong answers", () => {
  const rng = Engine.seededRng(3);
  for (const e of pool) {
    const choices = Engine.buildChoices(e, GOSPELS, ["Matthew"], "normal", rng);
    const removed = Engine.fiftyFifty(choices, e, rng);
    assert.equal(removed.length, 2);
    for (const i of removed) assert.ok(!same(choices[i], e));
  }
});

test("pickEvents returns distinct events and favours missed ones", () => {
  const rng = Engine.seededRng(11);
  const picked = Engine.pickEvents(pool, {}, 10, rng);
  assert.equal(new Set(picked.map((e) => e.id)).size, 10);

  const target = pool[0].id;
  let missedStats = Engine.recordAnswer({}, target, false);
  let masteredStats = {};
  for (let i = 0; i < 4; i++) masteredStats = Engine.recordAnswer(masteredStats, target, true);
  let missedHits = 0, masteredHits = 0;
  for (let i = 0; i < 2000; i++) {
    if (Engine.pickEvents(pool, missedStats, 10, rng).some((e) => e.id === target)) missedHits++;
    if (Engine.pickEvents(pool, masteredStats, 10, rng).some((e) => e.id === target)) masteredHits++;
  }
  assert.ok(missedHits > masteredHits * 3, `${missedHits} vs ${masteredHits}`);
});

test("pickEvents avoids recently asked events when it can", () => {
  const avoid = pool.slice(0, 100).map((e) => e.id);
  const picked = Engine.pickEvents(pool, {}, 10, Engine.seededRng(5), avoid);
  for (const e of picked) assert.ok(!avoid.includes(e.id));
});

test("recordAnswer tracks streaks toward mastery", () => {
  let s = {};
  s = Engine.recordAnswer(s, "a", true);
  assert.equal(Engine.isMastered(s.a), false);
  s = Engine.recordAnswer(s, "a", true);
  assert.equal(Engine.isMastered(s.a), true);
  s = Engine.recordAnswer(s, "a", false);
  assert.deepEqual(s.a, { seen: 3, right: 2, box: 0 });
});

test("scoring", () => {
  assert.equal(Engine.scoreAnswer({ correct: false, ms: 0, streak: 5, timed: true }).total, 0);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 0, streak: 1, timed: true }).total, 150);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 30000, streak: 1, timed: true }).total, 100);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 10000, streak: 3, timed: true }).total, 145);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 0, streak: 20, timed: true }).total, 200);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 0, streak: 1, timed: true, hinted: true }).total, 75);
  assert.equal(Engine.scoreAnswer({ correct: true, ms: 0, streak: 1, timed: false }).total, 100);
});

test("ranks", () => {
  assert.equal(Engine.rankFor(10, 10).title, "Scribe of the Kingdom");
  assert.equal(Engine.rankFor(8, 10).title, "Good and faithful servant");
  assert.equal(Engine.rankFor(0, 10).title, "Mustard seed");
});

test("cleanVerse balances quotes and marks partial sentences", () => {
  assert.equal(Engine.cleanVerse("Pray like this: ‘Our Father in heaven, may your name be kept holy."),
    "Pray like this: Our Father in heaven, may your name be kept holy.");
  assert.equal(Engine.cleanVerse("But she said, “Yes, Lord, but even the dogs eat the crumbs which fall from their masters’ table.”"),
    "But she said, Yes, Lord, but even the dogs eat the crumbs which fall from their masters’ table.");
  assert.equal(Engine.cleanVerse("“His lord said to him, ‘Well done, good and faithful servant.’"),
    "His lord said to him, ‘Well done, good and faithful servant.’");
  assert.equal(Engine.cleanVerse("and said, “Are you he who comes, or should we look for another?”"),
    "…and said, Are you he who comes, or should we look for another?");
  assert.equal(Engine.cleanVerse("Go and make disciples of all nations,"), "Go and make disciples of all nations…");
});

test("every key verse cleans up without stray quote marks", () => {
  for (const e of pool) {
    const t = Engine.cleanVerse(Engine.verseText(BIBLE_TEXT, e, e.key));
    assert.ok(t.length > 10, e.id);
    assert.ok(!/[“”]/.test(t), `${e.id}: ${t}`);
    const opens = (t.match(/‘/g) || []).length;
    const closes = (t.match(/[.,!?;:—]’/g) || []).length;
    assert.equal(opens, closes, `${e.id}: ${t}`);
  }
});

test("formatRef", () => {
  assert.equal(Engine.formatRef({ book: "Matthew", ch: 14, v: [13, 21] }), "Matthew 14:13–21");
  assert.equal(Engine.formatRef({ book: "Matthew", ch: 7, v: [12, 12] }), "Matthew 7:12");
});
