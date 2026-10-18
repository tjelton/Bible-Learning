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

  // Two events from different Gospels that tell the same story (by their
  // chapter-level parallels), e.g. the feeding of the 5,000 in Mark 6 and John 6.
  // Questions without a book can share a `group` instead.
  function sameStory(a, b) {
    if (a.group && a.group === b.group) return true;
    if (a.book === b.book) return false;
    return (a.par || []).includes(key(b.book, b.ch)) || (b.par || []).includes(key(a.book, a.ch));
  }

  // Weighted sample of n events without replacement. Events in `avoid` (ids),
  // and other Gospels' tellings of the same stories, are skipped unless there
  // aren't enough others. `bias(e)`, if given, scales each event's weight.
  function pickEvents(pool, stats, n, rng, avoid, bias) {
    const avoidSet = new Set(avoid || []);
    const avoided = pool.filter((e) => avoidSet.has(e.id));
    // Efraimidis–Spirakis: sort by u^(1/w) and take from the top.
    const keyed = pool
      .map((e) => ({ e, k: Math.pow(rng(), 1 / (weightFor(stats[e.id]) * (bias ? bias(e) : 1))) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.e);
    const out = [];
    const passes = [
      (e) => !avoidSet.has(e.id) && !out.some((o) => sameStory(o, e)) && !avoided.some((a) => sameStory(a, e)),
      (e) => !avoidSet.has(e.id),
      () => true,
    ];
    for (const ok of passes) {
      for (const e of keyed) {
        if (out.length >= n) return out;
        if (!out.includes(e) && ok(e)) out.push(e);
      }
    }
    return out;
  }

  // ── Answer choices ──
  // Returns 4 choices [{book, ch}] including the right one, sorted in Bible order.
  // Chapters that tell the same event (parallels) are never used as wrong answers.
  //
  // With several Gospels on, the mix of books must not give the answer away
  // (e.g. three Matthew options and one Luke would point at Matthew). Each
  // question uses one layout: all four from the right Gospel, two from it and
  // two from another, or one from each of four Gospels.
  function buildChoices(event, gospels, books, difficulty, rng) {
    const enabled = BOOK_ORDER.filter((b) => books.includes(b) && gospels[b]);
    const banned = new Set([key(event.book, event.ch)].concat(event.par || []));
    const open = (b) => {
      const out = [];
      for (let c = 1; c <= gospels[b].chapters; c++) if (!banned.has(key(b, c))) out.push({ book: b, ch: c });
      return out;
    };
    const picked = [];
    const has = (o) => picked.some((p) => p.book === o.book && p.ch === o.ch);
    // Adds up to `count` new options from `list`, stopping once `upTo` are picked.
    const take = (list, count, upTo) => {
      for (const o of shuffle(list, rng)) {
        if (picked.length >= upTo || count <= 0) break;
        if (!has(o)) { picked.push(o); count--; }
      }
    };

    // Wrong answers from the right Gospel, chosen by difficulty.
    function fromSameBook(count) {
      const upTo = picked.length + count;
      const sameBook = open(event.book);
      const dist = (o) => Math.abs(o.ch - event.ch);
      const confusers = (event.confuse || [])
        .map((c) => ({ book: event.book, ch: c }))
        .filter((o) => !banned.has(key(o.book, o.ch)));
      if (difficulty === "easy") {
        // Spread out: no neighbours, so knowing roughly where you are in the book is enough.
        take(sameBook.filter((o) => dist(o) >= 4), count, upTo);
      } else if (difficulty === "hard") {
        // A run of neighbouring chapters with the answer at a random spot, plus a look-alike.
        const n = gospels[event.book].chapters;
        const start = Math.min(Math.max(1, event.ch - randInt(rng, 4)), Math.max(1, n - 3));
        take(confusers, 1, upTo);
        take(sameBook.filter((o) => o.ch >= start && o.ch < start + 4), count, upTo);
        take(sameBook.filter((o) => dist(o) <= 3), count, upTo);
      } else {
        take(confusers, 1, upTo);
        take(sameBook.filter((o) => dist(o) <= 3), 1, upTo);
        take(sameBook.filter((o) => dist(o) <= 6), count, upTo);
      }
      take(sameBook, count, upTo);
    }

    // Wrong answers from another Gospel, near the same point in that book
    // (unless the difficulty is "spread out").
    function fromBook(b, count) {
      const upTo = picked.length + count;
      const list = open(b);
      const target = Math.round((event.ch / gospels[event.book].chapters) * gospels[b].chapters);
      const reach = difficulty === "hard" ? 2 : 4;
      if (difficulty !== "easy") take(list.filter((o) => Math.abs(o.ch - target) <= reach), count, upTo);
      take(list, count, upTo);
    }

    const others = shuffle(enabled.filter((b) => b !== event.book), rng);
    if (!others.length) {
      fromSameBook(3);
    } else {
      const r = rng();
      if (r < 0.25) {
        fromSameBook(3);
      } else if (r < 0.75 || others.length < 3) {
        fromSameBook(1);
        fromBook(others[0], 2);
      } else {
        for (const b of others.slice(0, 3)) fromBook(b, 1);
      }
    }
    // Only reached with tiny books or many parallels: fill from anything left.
    for (const b of enabled) if (picked.length < 3) take(open(b), 3, 3);

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

  // ── Training ──
  // Training teaches a few chapters at a time. It starts with TRAINING_ACTIVE
  // chapters and brings in the next one whenever a chapter is learned (every
  // event in it mastered), so that many are always being learned. Learned
  // chapters stay in the mix for review, less often.
  const TRAINING_ACTIVE = 3;
  const parseKey = (k) => { const i = k.lastIndexOf(" "); return { book: k.slice(0, i), ch: Number(k.slice(i + 1)) }; };

  function chapterLearned(gospels, k, stats) {
    const { book, ch } = parseKey(k);
    const evs = gospels[book] ? gospels[book].events.filter((e) => e.ch === ch) : [];
    return evs.length > 0 && evs.every((e) => isMastered(stats[e.id]));
  }

  // Chapters in training from the enabled books, split into those being
  // learned and those already learned.
  function trainingStatus(gospels, books, introduced, stats) {
    const on = introduced.filter((k) => books.includes(parseKey(k).book) && gospels[parseKey(k).book]);
    const learned = on.filter((k) => chapterLearned(gospels, k, stats));
    const total = BOOK_ORDER.reduce((n, b) => n + (books.includes(b) && gospels[b] ? gospels[b].chapters : 0), 0);
    return { learning: on.filter((k) => !learned.includes(k)), learned, total };
  }

  // The next chapter to bring in: the first one not yet in training, from the
  // enabled Gospel that is least far through, so several Gospels move together.
  function nextTrainingChapter(gospels, books, introduced) {
    const have = new Set(introduced);
    let best = null;
    for (const b of BOOK_ORDER) {
      if (!books.includes(b) || !gospels[b]) continue;
      const n = gospels[b].chapters;
      let done = 0, next = null;
      for (let c = 1; c <= n; c++) {
        if (have.has(key(b, c))) done++;
        else if (next === null) next = c;
      }
      if (next !== null && (!best || done / n < best.share)) best = { share: done / n, k: key(b, next) };
    }
    return best ? best.k : null;
  }

  // Brings in chapters until TRAINING_ACTIVE are being learned. Returns the
  // new list and the chapters added (including any already learned elsewhere).
  function trainingTopUp(gospels, books, introduced, stats) {
    const list = introduced.slice();
    const added = [];
    let next;
    while (trainingStatus(gospels, books, list, stats).learning.length < TRAINING_ACTIVE &&
           (next = nextTrainingChapter(gospels, books, list))) {
      list.push(next);
      added.push(next);
    }
    return { introduced: list, added };
  }

  // One event from the chapters in training. Chapters still being learned
  // come up four times as often as learned ones; recent events are skipped.
  function pickTrainingEvent(gospels, books, introduced, stats, rng, avoid) {
    const st = trainingStatus(gospels, books, introduced, stats);
    const learning = new Set(st.learning);
    const inTraining = new Set(st.learning.concat(st.learned));
    const pool = eventPool(gospels, books).filter((e) => inTraining.has(key(e.book, e.ch)));
    if (!pool.length) return null;
    const avoidSet = new Set(avoid || []);
    const fresh = pool.filter((e) => !avoidSet.has(e.id));
    const from = fresh.length ? fresh : pool;
    const weights = from.map((e) => weightFor(stats[e.id]) * (learning.has(key(e.book, e.ch)) ? 1 : 0.25));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < from.length; i++) {
      r -= weights[i];
      if (r < 0) return from[i];
    }
    return from[from.length - 1];
  }

  // Question style: "chapter" (given the chapter, pick what happens there),
  // "event" (given what happens, pick the chapter) or "verse" (given a verse,
  // pick the chapter). Verses join once an event has been answered right.
  function trainingKind(stat, rng) {
    const r = rng();
    if (!stat || !stat.box) return r < 0.5 ? "chapter" : "event";
    return r < 0.35 ? "chapter" : r < 0.7 ? "event" : "verse";
  }

  // Chapter choices for an event, drawn only from chapters in training. Wrong
  // answers come from the right Gospel where it has enough (closer chapters
  // first); otherwise the books are balanced as in buildChoices so the mix
  // doesn't point at the answer. Up to 4 choices, sorted in Bible order.
  function trainingChapterChoices(event, gospels, books, introduced, rng) {
    const banned = new Set([key(event.book, event.ch)].concat(event.par || []));
    const open = introduced
      .map(parseKey)
      .filter((o) => books.includes(o.book) && gospels[o.book] && !banned.has(key(o.book, o.ch)));
    const byBook = (b) => shuffle(open.filter((o) => o.book === b), rng);
    const same = byBook(event.book).sort((a, b) => (Math.abs(a.ch - event.ch) <= 3 ? 0 : 1) - (Math.abs(b.ch - event.ch) <= 3 ? 0 : 1));
    const others = shuffle(BOOK_ORDER.filter((b) => b !== event.book), rng).map(byBook).filter((l) => l.length);
    let wrong;
    if (same.length >= 3) wrong = same.slice(0, 3);
    else if (same.length >= 1 && others.some((l) => l.length >= 2)) wrong = [same[0]].concat(others.find((l) => l.length >= 2).slice(0, 2));
    else if (others.length >= 3) wrong = others.slice(0, 3).map((l) => l[0]);
    else wrong = shuffle(open, rng).slice(0, 3);
    // Early on, parallels can rule out most of the few chapters in training:
    // keep at least three choices by adding the answer's neighbours.
    for (let d = 1; wrong.length < 2 && d < gospels[event.book].chapters; d++) {
      for (const c of shuffle([event.ch - d, event.ch + d], rng)) {
        const o = { book: event.book, ch: c };
        if (wrong.length < 2 && c >= 1 && c <= gospels[event.book].chapters && !banned.has(key(o.book, c)) &&
            !wrong.some((w) => w.book === o.book && w.ch === c)) wrong.push(o);
      }
    }
    const choices = wrong.concat([{ book: event.book, ch: event.ch }]);
    choices.sort((a, b) => BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book) || a.ch - b.ch);
    return choices;
  }

  // Event choices for "what happens in this chapter?": the event plus three
  // from other chapters, in random order. A wrong answer never shares a title
  // or a story with anything in the asked chapter, and comes from chapters in
  // training (different chapters where possible) before any others.
  function trainingEventChoices(event, gospels, books, introduced, rng) {
    const asked = key(event.book, event.ch);
    const inChapter = gospels[event.book].events.filter((e) => e.ch === event.ch).map((e) => Object.assign({ book: event.book }, e));
    const titles = new Set(inChapter.map((e) => e.title));
    const valid = (w) => key(w.book, w.ch) !== asked && !titles.has(w.title) &&
      !(w.par || []).includes(asked) && !inChapter.some((x) => sameStory(x, w));
    const all = eventPool(gospels, books).filter(valid);
    const inTraining = new Set(introduced);
    const wrong = [];
    const passes = [
      (w) => inTraining.has(key(w.book, w.ch)) && !wrong.some((o) => o.book === w.book && o.ch === w.ch),
      (w) => inTraining.has(key(w.book, w.ch)),
      (w) => w.book === event.book,
      () => true,
    ];
    for (const ok of passes) {
      for (const w of shuffle(all, rng)) {
        if (wrong.length >= 3) break;
        if (ok(w) && !wrong.some((o) => o.title === w.title)) wrong.push(w);
      }
    }
    return shuffle(wrong.concat([Object.assign({ book: event.book }, event)]), rng);
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
  function rankFor(correct, total, ranks) {
    const ratio = total ? correct / total : 0;
    return (ranks || RANKS).find((r) => ratio >= r.min);
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
    recordAnswer, isMastered, weightFor, sameStory, pickEvents,
    buildChoices, fiftyFifty, scoreAnswer, rankFor,
    TRAINING_ACTIVE, chapterLearned, trainingStatus, nextTrainingChapter, trainingTopUp,
    pickTrainingEvent, trainingKind, trainingChapterChoices, trainingEventChoices,
    cleanVerse, verseText, passage,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
