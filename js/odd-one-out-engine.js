// "Odd One Out" rules with no DOM access: building a set of four from the
// Clusters groups (three words from one group, one from another) and choosing
// which group comes next. Builds on Engine for weighting and mastery, and reads
// the groups as ClustersEngine.prepare leaves them. Loaded as a classic script
// in the browser (window.OddOneOutEngine) and with require() in the tests.
(function (root, E) {
  "use strict";

  // What a group's words are. The odd word comes from a group of the same kind,
  // so a set of three people gets a fourth person, not a place.
  const KINDS = ["people", "places", "things", "words", "books", "story"];
  const ROUND_LEVELS = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4]; // a round gets harder as it goes
  const LAMP_STEP = 3; // with three lamps, this many right in a row opens the next level
  const NEIGHBOUR = 3; // weight for an odd word from a group that shares a word with the three's
  const norm = (s) => s.toLowerCase();

  // Whether a set has exactly one answer: `odd` mustn't belong to the three's
  // group `g`, and no other group may hold `odd` and two of the three (that
  // would make a second set of three).
  function fair(groups, g, three, odd) {
    const o = norm(odd);
    if (g.all.has(o) || three.some((w) => norm(w) === o)) return false;
    return groups.every((h) => h === g || !h.all.has(o) || three.filter((w) => h.all.has(norm(w))).length < 2);
  }

  const shareWord = (g, h) => [...h.all].some((w) => g.all.has(w));
  function weightedPick(list, rng) {
    let r = rng() * list.reduce((sum, o) => sum + o.weight, 0);
    for (const o of list) { r -= o.weight; if (r < 0) return o; }
    return list[list.length - 1];
  }

  // The odd word for three words of `g`: { word, id } from another group of the
  // same kind (any kind only if none fits), never from g's family. Each group is
  // equally likely whatever its size, and groups that share a word with `g`
  // more so, as their words tend to look as if they belong.
  function pickOdd(groups, g, three, rng) {
    for (const sameKind of [true, false]) {
      const options = [];
      for (const h of groups) {
        if (h === g || (h.family && h.family === g.family) || (sameKind && h.kind !== g.kind)) continue;
        const words = h.items.map((it) => it[0]).filter((w) => fair(groups, g, three, w));
        if (!words.length) continue;
        const weight = (shareWord(g, h) ? NEIGHBOUR : 1) / words.length;
        for (const word of words) options.push({ word, id: h.id, weight });
      }
      if (options.length) {
        const { word, id } = weightedPick(options, rng);
        return { word, id };
      }
    }
    return null;
  }

  // A set of four from group `g`: { id, three, odd, oddId, words } with the
  // words shuffled, or null if no odd word fits.
  function question(groups, g, rng) {
    const three = E.shuffle(g.items, rng).slice(0, 3).map((it) => it[0]);
    const odd = pickOdd(groups, g, three, rng);
    if (!odd) return null;
    return { id: g.id, three, odd: odd.word, oddId: odd.id, words: E.shuffle(three.concat(odd.word), rng) };
  }

  // The groups for a round, easiest first: one per entry of ROUND_LEVELS,
  // favouring groups not seen or often missed.
  function roundGroups(groups, stats, rng) {
    const out = [];
    for (const level of [...new Set(ROUND_LEVELS)]) {
      const n = ROUND_LEVELS.filter((l) => l === level).length;
      out.push(...E.pickEvents(groups.filter((g) => g.level === level), stats, n, rng));
    }
    return out;
  }

  // With three lamps the hardest level on offer rises with the run, and it
  // comes up most.
  const levelCap = (run) => Math.min(4, 1 + Math.floor(run / LAMP_STEP));
  function lampGroup(groups, stats, run, rng, avoid) {
    const cap = levelCap(run);
    return E.pickEvents(groups.filter((g) => g.level <= cap), stats, 1, rng, avoid, (g) => (g.level === cap ? 3 : 1))[0];
  }

  // Titles for a finished game, each with the verse it comes from (WEB).
  const RANKS = [
    { min: 1, title: "Sheep from the goats", ref: "Matthew 25:32", note: "He will separate them one from another, as a shepherd separates the sheep from the goats." },
    { min: 0.8, title: "Senses exercised", ref: "Hebrews 5:14", note: "Who by reason of use have their senses exercised to discern good and evil." },
    { min: 0.5, title: "Test all things", ref: "1 Thessalonians 5:21", note: "Test all things, and hold firmly that which is good." },
    { min: 0.3, title: "Looking at the heart", ref: "1 Samuel 16:7", note: "Man looks at the outward appearance, but Yahweh looks at the heart." },
    { min: 0, title: "The one that was lost", ref: "Luke 15:4", note: "Leave the ninety-nine in the wilderness, and go after the one that was lost." },
  ];

  const OddOneOutEngine = {
    KINDS, ROUND_LEVELS, LAMP_STEP, NEIGHBOUR, RANKS,
    fair, pickOdd, question, roundGroups, levelCap, lampGroup,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = OddOneOutEngine;
  else root.OddOneOutEngine = OddOneOutEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
