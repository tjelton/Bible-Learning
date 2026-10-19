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
const ALL = ["Matthew", "Mark", "Luke", "John"];
for (const f of ALL.flatMap((b) => [`${b.toLowerCase()}.js`, `text-${b.toLowerCase()}.js`])) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { GOSPELS, BIBLE_TEXT } = ctx.window;
const pool = Engine.eventPool(GOSPELS, ["Matthew"]);
const allPool = Engine.eventPool(GOSPELS, ALL);

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

test("with all four Gospels on, every event gets 4 valid choices and no parallel is a wrong answer", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = Engine.seededRng(seed);
      for (const e of allPool) {
        const choices = Engine.buildChoices(e, GOSPELS, ALL, difficulty, rng);
        assert.equal(choices.length, 4, `${e.id} ${difficulty}`);
        assert.equal(new Set(choices.map((c) => c.book + c.ch)).size, 4, `${e.id} duplicate choice`);
        assert.equal(choices.filter((c) => same(c, e)).length, 1, `${e.id} missing answer`);
        for (const c of choices) {
          assert.ok(c.ch >= 1 && c.ch <= GOSPELS[c.book].chapters, `${e.id}: ${c.book} ${c.ch} out of range`);
          if (!same(c, e)) assert.ok(!(e.par || []).includes(`${c.book} ${c.ch}`), `${e.id}: parallel ${c.book} ${c.ch} offered`);
        }
        const order = choices.map((c) => ALL.indexOf(c.book) * 100 + c.ch);
        assert.deepEqual(order, [...order].sort((a, b) => a - b), "choices are in Bible order");
      }
    }
  }
});

test("with several Gospels on, wrong answers come from more than one book", () => {
  const rng = Engine.seededRng(21);
  let mixed = 0;
  for (const e of allPool) {
    const books = new Set(Engine.buildChoices(e, GOSPELS, ALL, "normal", rng).map((c) => c.book));
    if (books.size > 1) mixed++;
  }
  // About a quarter of questions keep all four choices in one Gospel on purpose.
  const share = mixed / allPool.length;
  assert.ok(share > 0.6 && share < 0.9, `${mixed} of ${allPool.length}`);
});

test("with several Gospels on, the mix of books never gives the answer away", () => {
  for (const books of [ALL, ["Matthew", "Luke"], ["Mark", "Luke", "John"]]) {
    const events = Engine.eventPool(GOSPELS, books);
    const layouts = { same: 0, pairs: 0, spread: 0 };
    for (let seed = 1; seed <= 5; seed++) {
      const rng = Engine.seededRng(seed);
      for (const e of events) {
        const counts = {};
        for (const c of Engine.buildChoices(e, GOSPELS, books, "normal", rng)) counts[c.book] = (counts[c.book] || 0) + 1;
        const values = Object.values(counts);
        // The answer's book must never be the odd one out or the clear majority.
        if (values.length === 1) layouts.same++;
        else if (values.every((v) => v === 2)) layouts.pairs++;
        else if (values.every((v) => v === 1)) layouts.spread++;
        else assert.fail(`${e.id} with ${books}: ${JSON.stringify(counts)}`);
      }
    }
    assert.ok(layouts.same > 0 && layouts.pairs > 0, JSON.stringify(layouts));
    if (books.length === 4) assert.ok(layouts.spread > 0, JSON.stringify(layouts));
  }
});

test("a round doesn't ask the same story twice from different Gospels", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const picked = Engine.pickEvents(allPool, {}, 10, Engine.seededRng(seed));
    assert.equal(picked.length, 10);
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        assert.ok(!Engine.sameStory(picked[i], picked[j]), `${picked[i].id} and ${picked[j].id}`);
      }
    }
  }
});

test("pickEvents still fills the round from a tiny pool", () => {
  const tiny = allPool.filter((e) => e.par && e.par.includes("Matthew 14"));
  const picked = Engine.pickEvents(tiny, {}, tiny.length, Engine.seededRng(1));
  assert.equal(picked.length, tiny.length);
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
  for (const e of allPool) {
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

// ── Training ──
const masterAll = (stats, events) => {
  for (const e of events) for (let i = 0; i < Engine.MASTERED_BOX; i++) stats = Engine.recordAnswer(stats, e.id, true);
  return stats;
};
const eventsIn = (k) => allPool.filter((e) => `${e.book} ${e.ch}` === k);

const scopeOf = (books, only) => Engine.trainingScope(GOSPELS, books, only);
const MT = scopeOf(["Matthew"]);

test("the training scope is whole books, or only the chapters chosen", () => {
  assert.equal(MT.length, 28);
  assert.deepEqual(scopeOf(["Mark", "Matthew"], { Matthew: [7, 1, 2] }).slice(0, 4), ["Matthew 1", "Matthew 2", "Matthew 7", "Mark 1"]);
  assert.equal(scopeOf(["Mark", "Matthew"], { Matthew: [7, 1, 2] }).length, 3 + 16);
  assert.deepEqual(scopeOf(["Matthew"], { Matthew: [] }), []);
});

test("training starts with three chapters, in order", () => {
  const r = Engine.trainingTopUp(GOSPELS, MT, [], {});
  assert.deepEqual(r.introduced, ["Matthew 1", "Matthew 2", "Matthew 3"]);
  assert.deepEqual(r.added, r.introduced);
  assert.deepEqual(Engine.trainingTopUp(GOSPELS, MT, r.introduced, {}).added, []);
});

test("training adds the next chapter once one is learned", () => {
  const start = ["Matthew 1", "Matthew 2", "Matthew 3"];
  let stats = masterAll({}, eventsIn("Matthew 2").slice(0, -1));
  assert.equal(Engine.chapterLearned(GOSPELS, "Matthew 2", stats), false);
  assert.deepEqual(Engine.trainingTopUp(GOSPELS, MT, start, stats).added, []);
  stats = masterAll(stats, eventsIn("Matthew 2"));
  assert.equal(Engine.chapterLearned(GOSPELS, "Matthew 2", stats), true);
  assert.deepEqual(Engine.trainingTopUp(GOSPELS, MT, start, stats).added, ["Matthew 4"]);
  // A miss on a learned chapter puts it back into learning; nothing new is added.
  const missed = Engine.recordAnswer(stats, eventsIn("Matthew 2")[0].id, false);
  assert.equal(Engine.chapterLearned(GOSPELS, "Matthew 2", missed), false);
  assert.deepEqual(Engine.trainingTopUp(GOSPELS, MT, start, missed).added, []);
});

test("training skips past chapters already learned elsewhere", () => {
  const stats = masterAll({}, eventsIn("Matthew 1").concat(eventsIn("Matthew 2")));
  const r = Engine.trainingTopUp(GOSPELS, MT, [], stats);
  assert.deepEqual(r.introduced, ["Matthew 1", "Matthew 2", "Matthew 3", "Matthew 4", "Matthew 5"]);
  assert.deepEqual(Engine.trainingStatus(GOSPELS, MT, r.introduced, stats).learning, ["Matthew 3", "Matthew 4", "Matthew 5"]);
});

test("with several Gospels on, training moves through them together", () => {
  const r = Engine.trainingTopUp(GOSPELS, scopeOf(["Matthew", "Mark"]), [], {});
  assert.deepEqual(r.introduced, ["Matthew 1", "Mark 1", "Matthew 2"]);
  const st = Engine.trainingStatus(GOSPELS, scopeOf(["Mark"]), r.introduced, {});
  assert.deepEqual(st.learning, ["Mark 1"]);
  assert.equal(st.total, 16);
});

test("training with some chapters chosen stays within them", () => {
  const scope = scopeOf(["Matthew"], { Matthew: [5, 6, 7, 13] });
  let introduced = [];
  let stats = {};
  for (let step = 0; step < 6; step++) {
    introduced = Engine.trainingTopUp(GOSPELS, scope, introduced, stats).introduced;
    stats = masterAll(stats, eventsIn(introduced[introduced.length - 1]));
  }
  assert.deepEqual(introduced, ["Matthew 5", "Matthew 6", "Matthew 7", "Matthew 13"]);
  // Chapters brought in earlier with a wider choice are left out.
  const st = Engine.trainingStatus(GOSPELS, scope, ["Matthew 1", "Matthew 5"], {});
  assert.deepEqual(st.learning, ["Matthew 5"]);
  assert.equal(st.total, 4);
  const rng = Engine.seededRng(3);
  for (let i = 0; i < 300; i++) {
    const { event: e } = Engine.pickTrainingEvent(GOSPELS, scope, ["Matthew 1", "Matthew 5", "Matthew 6"], {}, {}, 0, rng);
    assert.ok(e.ch === 5 || e.ch === 6, e.id);
    for (const c of Engine.trainingChapterChoices(e, GOSPELS, scope, ["Matthew 1", "Matthew 5", "Matthew 6"], rng)) {
      assert.ok(c.ch !== 1, `${e.id}: Matthew 1 is outside the scope`);
    }
  }
});

test("training only asks about chapters being learned until one is due for review", () => {
  const introduced = ["Matthew 1", "Matthew 2", "Matthew 3", "Matthew 4"];
  const stats = masterAll({}, eventsIn("Matthew 1"));
  const now = 1e12;
  const rng = Engine.seededRng(4);
  const notDue = { "Matthew 1": { level: 2, due: now + 1 } };
  for (let i = 0; i < 500; i++) {
    const p = Engine.pickTrainingEvent(GOSPELS, MT, introduced, stats, notDue, now, rng);
    assert.ok(["Matthew 2", "Matthew 3", "Matthew 4"].includes(`${p.event.book} ${p.event.ch}`), p.event.id);
    assert.equal(p.review, false);
  }
  // Due (or never scheduled): about half the questions check it.
  for (const review of [{ "Matthew 1": { level: 2, due: now } }, {}]) {
    let reviews = 0;
    for (let i = 0; i < 1000; i++) {
      const p = Engine.pickTrainingEvent(GOSPELS, MT, introduced, stats, review, now, rng);
      assert.equal(p.review, p.event.ch === 1, p.event.id);
      if (p.review) reviews++;
    }
    assert.ok(reviews > 400 && reviews < 600, `${reviews}`);
  }
  const avoid = eventsIn("Matthew 2").map((e) => e.id);
  for (let i = 0; i < 200; i++) assert.ok(!avoid.includes(Engine.pickTrainingEvent(GOSPELS, MT, introduced, stats, notDue, now, rng, avoid).event.id));
});

test("reviews take the most overdue chapter, and run early once everything is learned", () => {
  const scope = scopeOf(["Matthew"], { Matthew: [1, 2, 3] });
  const introduced = ["Matthew 1", "Matthew 2", "Matthew 3"];
  const stats = masterAll({}, introduced.flatMap(eventsIn));
  const rng = Engine.seededRng(5);
  const review = { "Matthew 1": { level: 1, due: 500 }, "Matthew 2": { level: 1, due: 100 }, "Matthew 3": { level: 1, due: 900 } };
  assert.deepEqual(Engine.dueChapters(GOSPELS, scope, introduced, stats, review, 600), ["Matthew 2", "Matthew 1"]);
  for (let i = 0; i < 50; i++) {
    let p = Engine.pickTrainingEvent(GOSPELS, scope, introduced, stats, review, 600, rng);
    assert.ok(p.review && p.event.ch === 2);
    p = Engine.pickTrainingEvent(GOSPELS, scope, introduced, stats, review, 0, rng); // nothing due yet
    assert.ok(p.review && p.event.ch === 2);
  }
});

test("reviews space out when right and come back sooner after a miss", () => {
  const S = Engine.REVIEW_STEPS;
  const k = "Matthew 5";
  let r = Engine.updateReview({}, k, false, false, 0);
  assert.deepEqual(r, {});
  r = Engine.updateReview(r, k, false, true, 1000); // just learned
  assert.deepEqual(r[k], { level: 0, due: 1000 + S[0] });
  r = Engine.updateReview(r, k, true, true, 2000); // right, but before it was due
  assert.deepEqual(r[k], { level: 0, due: 2000 + S[0] });
  let t = r[k].due;
  for (let level = 1; level <= 5; level++) { // right on each due review
    r = Engine.updateReview(r, k, true, true, t);
    assert.deepEqual(r[k], { level, due: t + S[level] });
    t = r[k].due;
  }
  r = Engine.updateReview(r, k, true, false, t); // missed: back to learning
  assert.deepEqual(r[k], { level: 2, due: 0 });
  r = Engine.updateReview(r, k, false, true, t + 5); // learned again
  assert.deepEqual(r[k], { level: 2, due: t + 5 + S[2] });
  t = r[k].due;
  for (let i = 0; i < 20; i++) { r = Engine.updateReview(r, k, true, true, t); t = r[k].due; }
  assert.equal(r[k].level, S.length - 1);
});

test("training mixes question styles, with verses only after a right answer", () => {
  const rng = Engine.seededRng(8);
  const seen = { fresh: new Set(), known: new Set() };
  for (let i = 0; i < 200; i++) {
    seen.fresh.add(Engine.trainingKind(undefined, rng));
    seen.known.add(Engine.trainingKind({ seen: 1, right: 1, box: 1 }, rng));
  }
  assert.deepEqual([...seen.fresh].sort(), ["chapter", "event"]);
  assert.deepEqual([...seen.known].sort(), ["chapter", "event", "verse"]);
});

test("training chapter choices come from chapters in training", () => {
  for (const books of [["Matthew"], ALL]) {
    const scope = scopeOf(books);
    let introduced = [];
    let stats = {};
    for (let step = 0; step < 40; step++) {
      introduced = Engine.trainingTopUp(GOSPELS, scope, introduced, stats).introduced;
      const rng = Engine.seededRng(step + 1);
      for (const k of introduced) {
        for (const e of eventsIn(k)) {
          const choices = Engine.trainingChapterChoices(e, GOSPELS, scope, introduced, rng);
          assert.ok(choices.length >= 3 && choices.length <= 4, `${e.id}: ${choices.length}`);
          assert.equal(choices.filter((c) => same(c, e)).length, 1, `${e.id} missing answer`);
          assert.equal(new Set(choices.map((c) => c.book + c.ch)).size, choices.length, `${e.id} duplicate`);
          for (const c of choices) {
            // Outside training only when parallels leave too few: then a neighbour of the answer.
            if (!introduced.includes(`${c.book} ${c.ch}`)) assert.ok(choices.length === 3 && c.book === e.book, `${e.id}: ${c.book} ${c.ch} not in training`);
            if (!same(c, e)) assert.ok(!(e.par || []).includes(`${c.book} ${c.ch}`), `${e.id}: parallel offered`);
          }
        }
      }
      stats = masterAll(stats, eventsIn(introduced[introduced.length - 3]));
    }
    assert.equal(introduced.length, Math.min(42, Engine.trainingStatus(GOSPELS, scope, [], {}).total));
  }
});

test("'what happens in this chapter?' never offers something that happens there", () => {
  for (const books of [["Matthew"], ALL]) {
    const scope = scopeOf(books);
    const introduced = Engine.trainingTopUp(GOSPELS, scope, [], {}).introduced;
    for (let seed = 1; seed <= 3; seed++) {
      const rng = Engine.seededRng(seed);
      for (const e of Engine.eventPool(GOSPELS, books)) {
        const choices = Engine.trainingEventChoices(e, GOSPELS, scope, introduced.concat(`${e.book} ${e.ch}`), rng);
        assert.equal(choices.length, 4, e.id);
        assert.equal(choices.filter((c) => c.id === e.id).length, 1, `${e.id} missing answer`);
        assert.equal(new Set(choices.map((c) => c.title)).size, 4, `${e.id} repeated title`);
        const asked = eventsIn(`${e.book} ${e.ch}`);
        for (const c of choices) {
          if (c.id === e.id) continue;
          assert.ok(!(c.book === e.book && c.ch === e.ch), `${e.id}: ${c.id} is in the same chapter`);
          assert.ok(!asked.some((x) => x.title === c.title || Engine.sameStory(x, c)), `${e.id}: ${c.id} is told there too`);
        }
      }
    }
  }
});

test("'what happens in this chapter?' prefers events from chapters in training", () => {
  const introduced = ["Matthew 1", "Matthew 2", "Matthew 3"];
  const rng = Engine.seededRng(2);
  for (const e of eventsIn("Matthew 2")) {
    const wrong = Engine.trainingEventChoices(e, GOSPELS, MT, introduced, rng).filter((c) => c.id !== e.id);
    for (const c of wrong) assert.ok(c.ch === 1 || c.ch === 3, `${c.id}`);
    assert.equal(new Set(wrong.map((c) => c.ch)).size, 2, "both other chapters used");
  }
});
