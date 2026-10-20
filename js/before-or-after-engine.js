// "Before or After?" rules with no DOM access: the timeline, which events can
// be asked against each other, and picking the next one. Builds on Engine for
// weighting and mastery. Loaded as a classic script in the browser
// (window.BeforeOrAfterEngine) and with require() in the tests.
(function (root, E) {
  "use strict";

  // The next event is drawn from within this many places of the last one. The
  // reach shrinks as a run of right answers grows, so the gaps get smaller.
  const START_REACH = 60;
  const REACH_STEP = 5;
  const MIN_REACH = 8;

  // Every event in story order with its place (`pos`) and era (`era`, `eraName`).
  function timeline(eras) {
    const out = [];
    eras.forEach((era, i) => {
      for (const e of era.events) out.push(Object.assign({}, e, { pos: out.length, era: i, eraName: era.era }));
    });
    return out;
  }

  // Two events can be asked against each other unless the Bible leaves their
  // order uncertain (they share a `with` tag).
  function canPair(a, b) {
    if (a.id === b.id) return false;
    const tags = b.with || [];
    return !(a.with || []).some((t) => tags.includes(t));
  }

  const answer = (anchor, next) => (next.pos < anchor.pos ? "before" : "after");
  const reach = (streak) => Math.max(MIN_REACH, START_REACH - REACH_STEP * streak);

  function weightedPick(list, weight, rng) {
    const ws = list.map(weight);
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }

  // The first event of a game: any, favouring ones not yet learned.
  function pickStart(list, stats, rng) {
    return weightedPick(list, (e) => E.weightFor(stats[e.id]), rng);
  }

  // The next event to place against `anchor`: one it can be paired with, not
  // asked recently (`avoid`, ids), within reach for the current `streak`, and
  // favouring ones not yet learned. When every event in reach was asked
  // recently, the reach widens just enough: the nearest few not asked recently.
  // A recent one is used only when there is nothing else.
  const NEAREST = 4;
  function pickNext(list, anchor, stats, rng, avoid, streak) {
    const avoidSet = new Set(avoid || []);
    const dist = (e) => Math.abs(e.pos - anchor.pos);
    const pairable = list.filter((e) => canPair(anchor, e));
    const fresh = pairable.filter((e) => !avoidSet.has(e.id));
    const inReach = fresh.filter((e) => dist(e) <= reach(streak || 0));
    const options = inReach.length ? inReach
      : fresh.length ? fresh.sort((a, b) => dist(a) - dist(b)).slice(0, NEAREST)
      : pairable;
    return options.length ? weightedPick(options, (e) => E.weightFor(stats[e.id]), rng) : null;
  }

  // "Genesis 3:23-24" → "Genesis 3:23–24"
  const showRef = (ref) => ref.replace("-", "–");

  // Titles for a finished round, each with the verse it comes from (WEB).
  const RANKS = [
    { min: 1, title: "Fullness of time", ref: "Galatians 4:4", note: "When the fullness of the time came, God sent out his Son." },
    { min: 0.8, title: "A time for everything", ref: "Ecclesiastes 3:1", note: "For everything there is a season, and a time for every purpose under heaven." },
    { min: 0.5, title: "Remembering the days of old", ref: "Deuteronomy 32:7", note: "Remember the days of old. Consider the years of many generations." },
    { min: 0.3, title: "Times in his hand", ref: "Psalm 31:15", note: "My times are in your hand." },
    { min: 0, title: "Yesterday, today and forever", ref: "Hebrews 13:8", note: "Jesus Christ is the same yesterday, today, and forever." },
  ];

  const BeforeOrAfterEngine = {
    START_REACH, REACH_STEP, MIN_REACH, RANKS,
    timeline, canPair, answer, reach, pickStart, pickNext, showRef,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = BeforeOrAfterEngine;
  else root.BeforeOrAfterEngine = BeforeOrAfterEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
