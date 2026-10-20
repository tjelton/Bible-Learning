// "Finish the Proverb" rules with no DOM access: splitting proverbs into two
// halves, keeping near-duplicates apart, and building answer choices. Builds on
// Engine for weighting and mastery. Loaded as a classic script in the browser
// (window.ProverbsEngine) and with require() in the tests.
(function (root, E) {
  "use strict";

  // The two collections of Solomon's sayings, whose verses are mostly
  // self-contained couplets. (Chapters 1–9 are longer speeches, and 22:17–24:34
  // and 30–31 run sayings across several verses.)
  const COLLECTIONS = [
    { name: "Proverbs of Solomon", from: [10, 1], to: [22, 16] },
    { name: "Copied by Hezekiah’s men", from: [25, 1], to: [29, 27] },
  ];
  const HEADING = /^The proverbs of Solomon\. /; // 10:1 opens with the collection's title
  const MIN_KIND = 6; // a kind of split needs this many proverbs to make wrong answers from
  const TWIN = 0.6; // halves sharing this share of their words are near-duplicates
  const CLASH = 0.34; // a wrong ending can share no more than this with the right one or another wrong one

  // Where a proverb divides, tried in this order. `at` finds the split; the
  // second half starts after it. Each kind's endings read alike (“but …”,
  // “so …”), so wrong answers are drawn from the same kind.
  const count = (t, re) => (t.match(re) || []).length;
  const KINDS = [
    { kind: "but", test: (t) => count(t, /[,;] but /g) === 1, at: (t) => t.search(/[,;] but /) },
    { kind: "semicolon", test: (t) => count(t, /; /g) === 1, at: (t) => t.indexOf("; ") },
    { kind: "colon", test: (t) => count(t, /: /g) === 1 && !/;/.test(t), at: (t) => t.indexOf(": ") },
    { kind: "sentence", test: (t) => count(t, /[.!?] (?=[A-Z])/g) === 1 && !/[;:]/.test(t), at: (t) => t.search(/[.!?] (?=[A-Z])/), keep: 1 },
    { kind: "so", test: (t) => /^(As|Like) /.test(t) && count(t, /, so /g) === 1, at: (t) => t.indexOf(", so ") },
    { kind: "than", test: (t) => /^(Better|It is better)/.test(t) && count(t, /, than /g) === 1, at: (t) => t.indexOf(", than ") },
    { kind: "and", test: (t) => count(t, /,/g) === 1 && count(t, /, and /g) === 1, at: (t) => t.indexOf(", and ") },
    { kind: "lest", test: (t) => count(t, /,/g) === 1 && count(t, /, lest /g) === 1, at: (t) => t.indexOf(", lest ") },
    { kind: "for", test: (t) => count(t, /,/g) === 1 && count(t, /, for /g) === 1, at: (t) => t.indexOf(", for ") },
  ];

  // { text, first, second, kind } for a self-contained two-part saying, or
  // null. `text` is the whole proverb (without 10:1's title).
  // `keep` is how many characters of the divider stay on the first half (a
  // full stop); the comma or semicolon is dropped.
  function split(text) {
    const t = text.replace(HEADING, "");
    if (!/[.!?]$/.test(t) || /^[a-z]/.test(t) || /[“”‘]/.test(t)) return null;
    for (const k of KINDS) {
      if (!k.test(t)) continue;
      const at = k.at(t);
      const first = t.slice(0, at + (k.keep || 0));
      const second = t.slice(at + 2);
      if (first.split(" ").length < 3 || second.split(" ").length < 3) return null;
      return { text: t, first, second, kind: k.kind };
    }
    return null;
  }

  const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, "").split(/\s+/).filter(Boolean);
  // Near-duplicates are judged on the words that carry meaning.
  const STOP = new Set(("the and but nor for with his her him she its they them their who whom whose which that " +
    "this those these man one from than not all has have was there when what whoever your you does doesnt dont " +
    "more much like are will shall yahweh").split(" "));
  const content = (s) => new Set(words(s).filter((w) => w.length > 2 && !STOP.has(w)));
  // Shared content words as a share of all the content words in either.
  function overlap(a, b) {
    const A = content(a);
    const B = content(b);
    let shared = 0;
    for (const w of A) if (B.has(w)) shared++;
    const all = A.size + B.size - shared;
    return all ? shared / all : 1;
  }
  const twins = (a, b) => overlap(a.first, b.first) >= TWIN || overlap(a.second, b.second) >= TWIN;

  // Every proverb the game can ask, from the text of Proverbs
  // (TEXT[chapter][verse - 1]). Each has an id ("pv-15-1"), its chapter and
  // verse, the halves, its kind, its collection's index, and a `group` shared
  // with any near-duplicates (14:12 and 16:25 are word for word the same).
  function sayings(text) {
    const out = [];
    COLLECTIONS.forEach((c, ci) => {
      for (let ch = c.from[0]; ch <= c.to[0]; ch++) {
        const verses = text[ch] || [];
        for (let v = 1; v <= verses.length; v++) {
          if ((ch === c.from[0] && v < c.from[1]) || (ch === c.to[0] && v > c.to[1])) continue;
          const s = split(verses[v - 1]);
          if (s) out.push(Object.assign({ id: `pv-${ch}-${v}`, ch, v, collection: ci }, s));
        }
      }
    });
    const kinds = {};
    for (const s of out) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
    const kept = out.filter((s) => kinds[s.kind] >= MIN_KIND);
    // Near-duplicates share a group (joined transitively), so a round never asks
    // both and neither is offered as a wrong answer to the other.
    const parent = kept.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < kept.length; i++) {
      for (let j = i + 1; j < kept.length; j++) if (twins(kept[i], kept[j])) parent[find(j)] = find(i);
    }
    return kept.map((s, i) => Object.assign(s, { group: kept[find(i)].id }));
  }

  // Four endings, the right one among them: three from other proverbs of the
  // same kind, never near-duplicates of it, never close in wording to the right
  // ending or to each other, favouring endings of a similar length.
  function choices(s, pool, rng) {
    const len = words(s.second).length;
    const options = E.shuffle(pool.filter((o) => o.kind === s.kind && o.group !== s.group), rng)
      .map((o) => ({ o, k: Math.pow(rng(), 1 + Math.abs(words(o.second).length - len) / 3) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.o);
    const picked = [s];
    for (const o of options) {
      if (picked.length === 4) break;
      if (picked.every((p) => p.group !== o.group && overlap(p.second, o.second) < CLASH)) picked.push(o);
    }
    return E.shuffle(picked.map((p) => p.second), rng);
  }

  // The 50/50: the indexes of two wrong endings to remove.
  function fiftyFifty(endings, right, rng) {
    return E.shuffle(endings.map((_, i) => i).filter((i) => endings[i] !== right), rng).slice(0, 2);
  }

  // How a half is shown on its own: the start trails off, and an ending that
  // picks up mid-sentence gets a leading ellipsis.
  const showFirst = (s) => (s.kind === "sentence" ? `${s.first} …` : `${s.first}…`);
  const showEnding = (t) => (/^[a-z]/.test(t) ? `…${t}` : t);

  // Titles for a finished round, each with the verse it comes from (WEB).
  const RANKS = [
    { min: 1, title: "A word fitly spoken", ref: "Proverbs 25:11", note: "A word fitly spoken is like apples of gold in settings of silver." },
    { min: 0.8, title: "Wise in heart", ref: "Proverbs 16:21", note: "The wise in heart shall be called prudent." },
    { min: 0.5, title: "Getting understanding", ref: "Proverbs 4:7", note: "Get wisdom. Yes, though it costs all your possessions, get understanding." },
    { min: 0.3, title: "Iron sharpening iron", ref: "Proverbs 27:17", note: "Iron sharpens iron; so a man sharpens his friend’s countenance." },
    { min: 0, title: "Go to the ant", ref: "Proverbs 6:6", note: "Go to the ant, you sluggard. Consider her ways, and be wise." },
  ];

  const ProverbsEngine = {
    COLLECTIONS, MIN_KIND, TWIN, CLASH, RANKS,
    split, overlap, twins, sayings, choices, fiftyFifty, showFirst, showEnding,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = ProverbsEngine;
  else root.ProverbsEngine = ProverbsEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
