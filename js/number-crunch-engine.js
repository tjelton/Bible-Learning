// "Number Crunch" rules with no DOM access: slider steps, scoring guesses and
// picking questions. Builds on Engine for weighting and mastery. Loaded as a
// classic script in the browser (window.NumberCrunchEngine) and with require()
// in the tests.
(function (root, E) {
  "use strict";

  const BULLSEYE = 50; // bonus for the exact number
  const CLOSE = 50; // a guess worth at least this many points counts as right
  const NEW_TESTAMENT = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
  ];

  // "Genesis 5:27" → "Genesis"; "1 Kings 11:3" → "1 Kings"
  const bookOf = (ref) => ref.replace(/ \d+:[\d-]+$/, "");
  const testament = (ref) => (NEW_TESTAMENT.includes(bookOf(ref)) ? "New" : "Old");

  // The slider moves in steps that keep about a thousand stops across it:
  // 1 up to 9,999, then 10, 100 and so on.
  function step(fact) {
    return Math.max(1, Math.pow(10, Math.floor(Math.log10(fact.max)) - 3));
  }
  const minOf = (fact) => fact.min || 0;
  // Every guess starts in the middle of the range.
  function startGuess(fact) {
    const s = step(fact);
    return Math.round((minOf(fact) + fact.max) / 2 / s) * s;
  }

  // Up to 100 points for closeness: full marks for the exact number, falling to
  // nothing at a quarter of the slider's range away. The exact number earns a
  // bonus on top. A guess worth at least CLOSE points counts as right.
  function score(fact, guess) {
    const off = Math.abs(guess - fact.a);
    const tolerance = (fact.max - minOf(fact)) / 4;
    const close = Math.round(100 * Math.max(0, 1 - off / tolerance));
    const exact = off === 0;
    return { total: close + (exact ? BULLSEYE : 0), close, exact, off, ok: close >= CLOSE };
  }

  function verdict(s) {
    if (s.exact) return "Bullseye!";
    if (s.close >= 90) return "So close!";
    if (s.close >= 70) return "Close!";
    if (s.close >= CLOSE) return "Not bad.";
    if (s.close > 0) return "A long way off.";
    return "Nowhere near.";
  }

  // Facts sharing a `group` (all the forties, say) never meet in one round.
  function pickFacts(pool, stats, n, rng, avoid) {
    return E.pickEvents(pool, stats, n, rng, avoid);
  }

  // Titles for a finished game by average closeness, each with the verse it
  // comes from (WEB).
  const RANKS = [
    { min: 0.9, title: "Counter of the stars", ref: "Psalm 147:4", note: "He counts the number of the stars." },
    { min: 0.7, title: "Wise in your days", ref: "Psalm 90:12", note: "Teach us to count our days, that we may gain a heart of wisdom." },
    { min: 0.5, title: "Counter of the cost", ref: "Luke 14:28", note: "Sit down and count the cost." },
    { min: 0.3, title: "Every hair numbered", ref: "Matthew 10:30", note: "The very hairs of your head are all numbered." },
    { min: 0, title: "Beyond counting", ref: "Revelation 7:9", note: "A great multitude, which no man could count." },
  ];
  // history: [{ close }]
  function rankFor(history) {
    const ratio = history.length ? history.reduce((sum, h) => sum + h.close, 0) / (100 * history.length) : 0;
    return RANKS.find((r) => ratio >= r.min);
  }

  const NumberCrunchEngine = {
    BULLSEYE, CLOSE, RANKS, bookOf, testament, step, startGuess, score, verdict, pickFacts, rankFor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = NumberCrunchEngine;
  else root.NumberCrunchEngine = NumberCrunchEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
