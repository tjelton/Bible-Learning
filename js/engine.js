// Game rules with no DOM access: picking questions, building answer choices,
// scoring and progress. Loaded as a classic script in the browser (window.Engine)
// and with require() in the tests.
(function (root) {
  "use strict";

  const BOOK_ORDER = ["Matthew", "Mark", "Luke", "John"];
  const QUESTION_TIME_MS = 20000; // speed bonus runs out after this
  const MASTERED_BOX = 2; // right this many times in a row = mastered

  // ── Random helpers (rng is injectable so tests are deterministic) ──
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function seededRng(seed) { // mulberry32
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── References ──
  const key = (book, ch) => book + " " + ch;
  function formatRef(e) {
    const [a, b] = e.v;
    return `${e.book} ${e.ch}:${a}${b !== a ? "–" + b : ""}`;
  }
  function sectionFor(gospel, ch) {
    return gospel.sections.find((s) => ch >= s.from && ch <= s.to) || null;
  }

  // All events from the enabled books, each tagged with its book.
  function eventPool(gospels, books) {
    const out = [];
    for (const b of BOOK_ORDER) {
      if (!books.includes(b) || !gospels[b]) continue;
      for (const e of gospels[b].events) out.push(Object.assign({ book: b }, e));
    }
    return out;
  }

  // ── Progress ──
  // stats[id] = { seen, right, box } where box counts correct answers in a row.
  function recordAnswer(stats, id, correct) {
    const s = stats[id] || { seen: 0, right: 0, box: 0 };
    const next = {
      seen: s.seen + 1,
      right: s.right + (correct ? 1 : 0),
      box: correct ? s.box + 1 : 0,
    };
    return Object.assign({}, stats, { [id]: next });
  }
  const isMastered = (stat) => !!stat && stat.box >= MASTERED_BOX;

  // Events you haven't seen or keep missing come up more often.
  function weightFor(stat) {
    if (!stat || !stat.seen) return 3;
    if (stat.box === 0) return 4;
    if (stat.box === 1) return 2;
    if (stat.box === 2) return 1;
    return 0.5;
  }

  // Weighted sample of n events without replacement, skipping ids in `avoid`
  // unless there aren't enough others.
  function pickEvents(pool, stats, n, rng, avoid) {
    const avoidSet = new Set(avoid || []);
    let candidates = pool.filter((e) => !avoidSet.has(e.id));
    if (candidates.length < n) candidates = pool.slice();
    // Efraimidis–Spirakis: sort by u^(1/w), take the top n.
    const keyed = candidates.map((e) => ({ e, k: Math.pow(rng(), 1 / weightFor(stats[e.id])) }));
    keyed.sort((a, b) => b.k - a.k);
    return keyed.slice(0, n).map((x) => x.e);
  }

  // ── Answer choices ──
  // Returns 4 choices [{book, ch}] including the right one, sorted in Bible order.
  // Chapters that tell the same event (parallels) are never used as wrong answers.
  function buildChoices(event, gospels, books, difficulty, rng) {
    const enabled = BOOK_ORDER.filter((b) => books.includes(b) && gospels[b]);
    const correctKey = key(event.book, event.ch);
    const banned = new Set([correctKey].concat(event.par || []));
    const all = [];
    for (const b of enabled) {
      for (let c = 1; c <= gospels[b].chapters; c++) {
        if (!banned.has(key(b, c))) all.push({ book: b, ch: c });
      }
    }
    const sameBook = all.filter((o) => o.book === event.book);
    const dist = (o) => Math.abs(o.ch - event.ch);
    const picked = [];
    const has = (o) => picked.some((p) => p.book === o.book && p.ch === o.ch);
    const take = (list, count) => {
      for (const o of shuffle(list, rng)) {
        if (picked.length >= 3 || count <= 0) break;
        if (!has(o)) { picked.push(o); count--; }
      }
    };
    const confusers = (event.confuse || [])
      .map((c) => ({ book: event.book, ch: c }))
      .filter((o) => !banned.has(key(o.book, o.ch)));
    const otherBooksSameNumber = all.filter((o) => o.book !== event.book && Math.abs(o.ch - event.ch) <= 1);

    if (difficulty === "easy") {
      // Spread out: no neighbours, so knowing roughly where you are in the book is enough.
      take(sameBook.filter((o) => dist(o) >= 4), enabled.length > 1 ? 2 : 3);
      take(all.filter((o) => o.book !== event.book), 3);
      take(all, 3);
    } else if (difficulty === "hard") {
      // A run of neighbouring chapters with the answer at a random spot, plus a look-alike.
      const n = gospels[event.book].chapters;
      const start = Math.min(Math.max(1, event.ch - randInt(rng, 4)), Math.max(1, n - 3));
      const window = sameBook.filter((o) => o.ch >= start && o.ch < start + 4);
      take(confusers, 1);
      take(otherBooksSameNumber, enabled.length > 1 ? 1 : 0);
      take(window, 3);
      take(sameBook.filter((o) => dist(o) <= 3), 3);
      take(all, 3);
    } else {
      take(confusers, 1);
      take(sameBook.filter((o) => dist(o) <= 3), 1);
      take(otherBooksSameNumber, enabled.length > 1 ? 1 : 0);
      take(sameBook.filter((o) => dist(o) <= 6), 1);
      take(all, 3);
    }

    const choices = picked.slice(0, 3).concat([{ book: event.book, ch: event.ch }]);
    choices.sort((a, b) => BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book) || a.ch - b.ch);
    return choices;
  }

  // 50/50: the indexes of two wrong choices to remove.
  function fiftyFifty(choices, event, rng) {
    const wrong = choices
      .map((c, i) => ({ c, i }))
      .filter((x) => !(x.c.book === event.book && x.c.ch === event.ch))
      .map((x) => x.i);
    return shuffle(wrong, rng).slice(0, 2).sort((a, b) => a - b);
  }

  // ── Scoring ──
  // 100 for a right answer, up to +50 for speed, +10 per answer in a row after
  // the first (max +50). Using the 50/50 halves the total.
  function scoreAnswer({ correct, ms, streak, hinted, timed }) {
    if (!correct) return { total: 0, base: 0, speed: 0, streak: 0 };
    const base = 100;
    const speed = timed ? Math.round(50 * Math.max(0, 1 - ms / QUESTION_TIME_MS)) : 0;
    const streakBonus = Math.min(Math.max(streak - 1, 0), 5) * 10;
    let total = base + speed + streakBonus;
    if (hinted) total = Math.round(total / 2);
    return { total, base, speed, streak: streakBonus };
  }

  // Titles for a finished round, each with the verse it comes from.
  const RANKS = [
    { min: 1, title: "Scribe of the Kingdom", ref: "Matthew 13:52", note: "Every scribe made a disciple of the Kingdom brings out treasure new and old." },
    { min: 0.8, title: "Good and faithful servant", ref: "Matthew 25:21", note: "Faithful over a few things, set over many." },
    { min: 0.5, title: "Disciple", ref: "Matthew 4:19", note: "“Come after me.” Keep following." },
    { min: 0.3, title: "Seeker", ref: "Matthew 7:7", note: "Seek, and you will find." },
    { min: 0, title: "Mustard seed", ref: "Matthew 13:31", note: "The smallest of seeds grows into a tree." },
  ];
  function rankFor(correct, total) {
    const ratio = total ? correct / total : 0;
    return RANKS.find((r) => ratio >= r.min);
  }

  // ── Bible text ──
  // Tidies one verse for display on its own. A verse often starts or ends partway
  // through someone talking, so double quotes are dropped and single quotes that
  // open or close outside the verse are removed. A verse that starts or ends
  // mid-sentence gets an ellipsis.
  function cleanVerse(s) {
    let t = s.trim().replace(/[“”]/g, "");
    // ‘ always opens; ’ closes only after punctuation (otherwise it's an apostrophe).
    const chars = t.split("");
    const open = [];
    const drop = new Set();
    chars.forEach((c, i) => {
      if (c === "‘") open.push(i);
      else if (c === "’" && /[.,!?;:—]/.test(chars[i - 1] || "")) {
        if (open.length) open.pop(); else drop.add(i);
      }
    });
    open.forEach((i) => drop.add(i));
    t = chars.filter((_, i) => !drop.has(i)).join("").replace(/\s{2,}/g, " ").trim();
    if (/[,;:]$/.test(t)) t = t.slice(0, -1) + "…";
    if (/^[a-z]/.test(t)) t = "…" + t;
    return t;
  }
  function verseText(text, e, n) {
    const ch = text && text[e.book] && text[e.book][e.ch];
    return ch ? ch[n - 1] || "" : "";
  }
  function passage(text, e) {
    const out = [];
    for (let n = e.v[0]; n <= e.v[1]; n++) out.push({ n, text: verseText(text, e, n) });
    return out;
  }

  const Engine = {
    BOOK_ORDER, QUESTION_TIME_MS, MASTERED_BOX, RANKS,
    seededRng, shuffle, formatRef, sectionFor, eventPool,
    recordAnswer, isMastered, weightFor, pickEvents,
    buildChoices, fiftyFifty, scoreAnswer, rankFor,
    cleanVerse, verseText, passage,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
