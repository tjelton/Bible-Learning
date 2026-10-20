// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const B = require("../js/before-or-after-engine.js");

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["before-or-after.js", "before-or-after-text.js"]) {
  vm.runInContext(readFileSync(new URL(`../js/data/${f}`, import.meta.url), "utf8"), ctx);
}
const { BEFORE_OR_AFTER: ERAS, BEFORE_OR_AFTER_TEXT: TEXT } = ctx.window;
const line = B.timeline(ERAS);
const byId = Object.fromEntries(line.map((e) => [e.id, e]));

test("the timeline numbers every event in story order, era by era", () => {
  assert.equal(line.length, ERAS.reduce((n, era) => n + era.events.length, 0));
  line.forEach((e, i) => assert.equal(e.pos, i));
  for (let i = 1; i < line.length; i++) assert.ok(line[i].era >= line[i - 1].era);
  assert.equal(line[0].id, "ba-creation");
  assert.equal(byId["ba-goliath"].eraName, "The kingdom");
});

test("before or after follows the timeline", () => {
  assert.equal(B.answer(byId["ba-goliath"], byId["ba-bush"]), "before");
  assert.equal(B.answer(byId["ba-bush"], byId["ba-goliath"]), "after");
  assert.equal(B.answer(byId["ba-pentecost"], byId["ba-patmos"]), "after");
});

test("events whose order is uncertain are never paired", () => {
  assert.ok(!B.canPair(byId["ba-ruth"], byId["ba-gideon"]), "Ruth sometime in the days of the judges");
  assert.ok(!B.canPair(byId["ba-magi"], byId["ba-simeon"]));
  assert.ok(!B.canPair(byId["ba-goliath"], byId["ba-goliath"]), "never against itself");
  assert.ok(B.canPair(byId["ba-ruth"], byId["ba-choose"]), "Ruth comes after Joshua");
  assert.ok(B.canPair(byId["ba-ruth"], byId["ba-saul"]), "and before Saul");
});

test("the reach shrinks as the run grows, down to a floor", () => {
  assert.equal(B.reach(0), B.START_REACH);
  assert.ok(B.reach(4) < B.reach(3));
  assert.equal(B.reach(1000), B.MIN_REACH);
});

test("the next event can be paired, isn't recent, and is within reach, or as near as it can be", () => {
  for (const seed of [11, 12, 13]) {
    const rng = Engine.seededRng(seed);
    let anchor = B.pickStart(line, {}, rng);
    let recent = [anchor.id];
    for (let streak = 0; streak < 400; streak++) {
      const next = B.pickNext(line, anchor, {}, rng, recent, streak);
      assert.ok(next && B.canPair(anchor, next), `${anchor.id} → ${next && next.id}`);
      assert.ok(!recent.includes(next.id), `${next.id} was asked recently`);
      const dist = (e) => Math.abs(e.pos - anchor.pos);
      const fresh = line.filter((e) => B.canPair(anchor, e) && !recent.includes(e.id));
      if (fresh.some((e) => dist(e) <= B.reach(streak))) {
        assert.ok(dist(next) <= B.reach(streak), `${anchor.id} → ${next.id} at a run of ${streak}`);
      } else {
        // Nothing fresh in reach: one of the nearest fresh events instead.
        const nearer = fresh.filter((e) => dist(e) < dist(next)).length;
        assert.ok(nearer < 4, `${anchor.id} → ${next.id}: ${nearer} fresh events were nearer`);
      }
      recent = recent.concat(next.id).slice(-30);
      anchor = next;
    }
  }
});

test("when nothing is in reach, it still finds an event", () => {
  const tiny = B.timeline([{ era: "A", events: [{ id: "a" }, { id: "b", with: ["x"] }, { id: "c", with: ["x"] }] }]);
  assert.equal(B.pickNext(tiny, tiny[1], {}, Math.random, ["a"], 0).id, "a", "a recent event beats none");
  assert.equal(B.pickNext(tiny, tiny[1], {}, Math.random, [], 0).id, "a", "c shares a tag with b");
});

test("ranks cover every score and quote the World English Bible", () => {
  assert.equal(Engine.rankFor(10, 10, B.RANKS).title, "Fullness of time");
  assert.equal(Engine.rankFor(0, 10, B.RANKS).title, "Yesterday, today and forever");
  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const r of B.RANKS) {
    const text = (TEXT[r.ref] || []).join(" ");
    assert.ok(words(text).includes(words(r.note)), `${r.ref}: "${r.note}"`);
  }
});
