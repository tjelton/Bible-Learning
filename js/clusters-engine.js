// "Clusters" rules with no DOM access: building puzzles and checking
// guesses. Loaded as a classic script in the browser
// (window.ClustersEngine) and with require() in the tests.
(function (root, E) {
  "use strict";

  const LEVELS = [1, 2, 3, 4];
  const LEVEL_NAMES = { 1: "Straightforward", 2: "Steady", 3: "Tricky", 4: "Devious" };
  const MISTAKES = 4; // a puzzle ends after this many wrong guesses
  const RECENT = 24; // this many most recently shown groups are held back
  const norm = (s) => s.toLowerCase();

  // Each group with `all`: every word that belongs to it, from `items` and `fits`.
  function prepare(groups) {
    return groups.map((g) => Object.assign({}, g, {
      all: new Set(g.items.map((it) => norm(it[0])).concat((g.fits || []).map(norm))),
    }));
  }

  // The items of `g` a puzzle with `others` can show: none of them may also
  // belong to one of the other groups.
  function usable(g, others) {
    return g.items.filter((it) => !others.some((o) => o !== g && o.all.has(norm(it[0]))));
  }

  // Whether `g` can join the groups already chosen, leaving every group at
  // least four words that belong only to it.
  function compatible(chosen, g) {
    if (chosen.some((c) => c.family && c.family === g.family)) return false;
    const all = chosen.concat(g);
    return all.every((c) => usable(c, all).length >= 4);
  }

  // Groups never shown come up most, then those shown least.
  function weightFor(g, seen) {
    const n = seen[g.id] || 0;
    return n ? 1 / (1 + n) : 3;
  }
  function weightedPick(list, weight, rng) {
    const ws = list.map(weight);
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }

  // A new puzzle: one group per level, four words each, tiles shuffled.
  // `progress` is { seen: { [groupId]: count }, recent: [groupId] }.
  // Returns { groups: [{ id, level, words }], tiles: [word] } or null.
  function buildPuzzle(groups, rng, progress) {
    const seen = (progress && progress.seen) || {};
    const recent = (progress && progress.recent) || [];
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = [];
      for (const level of E.shuffle(LEVELS, rng)) {
        const options = groups.filter((g) => g.level === level && compatible(chosen, g));
        if (!options.length) break;
        // Recently shown groups are used only when nothing else fits.
        const fresh = options.filter((g) => !recent.includes(g.id));
        chosen.push(weightedPick(fresh.length ? fresh : options, (g) => weightFor(g, seen), rng));
      }
      if (chosen.length < LEVELS.length) continue;
      const picked = chosen
        .sort((a, b) => a.level - b.level)
        .map((g) => ({ id: g.id, level: g.level, words: E.shuffle(usable(g, chosen), rng).slice(0, 4).map((it) => it[0]) }));
      return { groups: picked, tiles: E.shuffle(picked.flatMap((g) => g.words), rng) };
    }
    return null;
  }

  // A guess of four words: the group it completes, if any, and whether three
  // of them belong to the same unsolved group.
  function check(puzzle, solved, guess) {
    let best = 0;
    for (const g of puzzle.groups) {
      if (solved.includes(g.id)) continue;
      const hits = guess.filter((w) => g.words.includes(w)).length;
      if (hits === 4) return { id: g.id, close: false };
      best = Math.max(best, hits);
    }
    return { id: null, close: best === 3 };
  }

  // Order-free key for a guess, to spot one already tried.
  const guessKey = (guess) => guess.slice().sort().join("|");

  // Titles for a finished puzzle by mistakes made (or `lost`), each with the
  // verse it comes from (WEB).
  const RANKS = [
    { mistakes: 0, title: "Wise master builder", ref: "1 Corinthians 3:10", note: "As a wise master builder, I laid a foundation." },
    { mistakes: 1, title: "Workman unashamed", ref: "2 Timothy 2:15", note: "A workman who doesn’t need to be ashamed, properly handling the Word of Truth." },
    { mistakes: 2, title: "Searcher of matters", ref: "Proverbs 25:2", note: "The glory of kings is to search out a matter." },
    { mistakes: 3, title: "Patient endurance", ref: "Romans 5:3-4", note: "Suffering produces perseverance; and perseverance, proven character." },
    { lost: true, title: "Through a mirror, dimly", ref: "1 Corinthians 13:12", note: "For now we see in a mirror, dimly, but then face to face." },
  ];
  function rankFor(mistakes, won) {
    return won ? RANKS.find((r) => r.mistakes === mistakes) : RANKS.find((r) => r.lost);
  }

  const ClustersEngine = {
    LEVELS, LEVEL_NAMES, MISTAKES, RECENT, RANKS,
    prepare, usable, compatible, buildPuzzle, check, guessKey, rankFor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = ClustersEngine;
  else root.ClustersEngine = ClustersEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
