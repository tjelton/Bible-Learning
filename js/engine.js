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
  // Training teaches a few chapters at a time from the chapters you choose
  // (the scope: whole books, or only some of their chapters). It starts with
  // TRAINING_ACTIVE chapters and brings in the next one whenever a chapter is
  // learned (every event in it mastered), so that many are always being
  // learned. Learned chapters come back for review on a growing schedule
  // (REVIEW_STEPS); a miss puts the chapter back with the ones being learned.
  const TRAINING_ACTIVE = 3;
  const REVIEW_SHARE = 0.5; // share of questions spent on reviews while any are due
  const MINUTE = 60 * 1000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
  const REVIEW_STEPS = [10 * MINUTE, HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY, 120 * DAY];
  const parseKey = (k) => { const i = k.lastIndexOf(" "); return { book: k.slice(0, i), ch: Number(k.slice(i + 1)) }; };

  // The chapters chosen for training, in Bible order: each book in `books`,
  // limited to the chapters in only[book] when that is given.
  function trainingScope(gospels, books, only) {
    const out = [];
    for (const b of BOOK_ORDER) {
      if (!books.includes(b) || !gospels[b]) continue;
      const pick = only && only[b];
      for (let c = 1; c <= gospels[b].chapters; c++) if (!pick || pick.includes(c)) out.push(key(b, c));
    }
    return out;
  }
  const scopeBooks = (scope) => BOOK_ORDER.filter((b) => scope.some((k) => parseKey(k).book === b));

  function chapterLearned(gospels, k, stats) {
    const { book, ch } = parseKey(k);
    const evs = gospels[book] ? gospels[book].events.filter((e) => e.ch === ch) : [];
    return evs.length > 0 && evs.every((e) => isMastered(stats[e.id]));
  }

  // Chapters in training within the scope, split into those being learned and
  // those already learned.
  function trainingStatus(gospels, scope, introduced, stats) {
    const inScope = new Set(scope);
    const on = introduced.filter((k) => inScope.has(k));
    const learned = on.filter((k) => chapterLearned(gospels, k, stats));
    return { learning: on.filter((k) => !learned.includes(k)), learned, total: scope.length };
  }

  // The next chapter to bring in: the first one in the scope not yet in
  // training, from the book that is least far through, so several Gospels
  // move together.
  function nextTrainingChapter(gospels, scope, introduced) {
    const have = new Set(introduced);
    let best = null;
    for (const b of scopeBooks(scope)) {
      const mine = scope.filter((k) => parseKey(k).book === b);
      const done = mine.filter((k) => have.has(k)).length;
      const next = mine.find((k) => !have.has(k));
      if (next && (!best || done / mine.length < best.share)) best = { share: done / mine.length, k: next };
    }
    return best ? best.k : null;
  }

  // Brings in chapters until TRAINING_ACTIVE are being learned. Returns the
  // new list and the chapters added (including any already learned elsewhere).
  function trainingTopUp(gospels, scope, introduced, stats) {
    const list = introduced.slice();
    const added = [];
    let next;
    while (trainingStatus(gospels, scope, list, stats).learning.length < TRAINING_ACTIVE &&
           (next = nextTrainingChapter(gospels, scope, list))) {
      list.push(next);
      added.push(next);
    }
    return { introduced: list, added };
  }

  // ── Reviews ──
  // review[k] = { level, due }: a learned chapter's place on REVIEW_STEPS and
  // when it is next due (ms). A learned chapter with no entry is due now.
  const dueAt = (review, k) => (review && review[k] ? review[k].due : 0);
  function dueChapters(gospels, scope, introduced, stats, review, now) {
    return trainingStatus(gospels, scope, introduced, stats).learned
      .filter((k) => dueAt(review, k) <= now)
      .sort((a, b) => dueAt(review, a) - dueAt(review, b));
  }

  // The review schedule after answering a question on chapter k. Learning a
  // chapter schedules its first review; a right answer on a due review moves
  // it a step further apart (one answered early keeps its step); a miss that
  // un-learns it drops it back half its steps for when it is learned again.
  function updateReview(review, k, wasLearned, nowLearned, now) {
    const r = (review && review[k]) || { level: 0, due: 0 };
    let next;
    if (!wasLearned && nowLearned) next = { level: r.level, due: now + REVIEW_STEPS[r.level] };
    else if (wasLearned && !nowLearned) next = { level: Math.floor(r.level / 2), due: 0 };
    else if (wasLearned) {
      const level = r.due <= now ? Math.min(r.level + 1, REVIEW_STEPS.length - 1) : r.level;
      next = { level, due: now + REVIEW_STEPS[level] };
    } else return review || {};
    return Object.assign({}, review, { [k]: next });
  }

  // The next training question: { event, review }. While chapters are due for
  // review, about REVIEW_SHARE of questions check the most overdue one; the
  // rest come from chapters being learned, weighted towards events you miss.
  // With everything learned and nothing due, the soonest-due chapter comes
  // up early. Recent events are skipped where possible.
  function pickTrainingEvent(gospels, scope, introduced, stats, review, now, rng, avoid) {
    const st = trainingStatus(gospels, scope, introduced, stats);
    const due = dueChapters(gospels, scope, introduced, stats, review, now);
    let chapters, isReview = false;
    if (due.length && (!st.learning.length || rng() < REVIEW_SHARE)) {
      chapters = [due[0]];
      isReview = true;
    } else if (st.learning.length) {
      chapters = st.learning;
    } else if (st.learned.length) {
      chapters = [st.learned.slice().sort((a, b) => dueAt(review, a) - dueAt(review, b))[0]];
      isReview = true;
    } else return null;
    const inChapters = new Set(chapters);
    const pool = eventPool(gospels, scopeBooks(scope)).filter((e) => inChapters.has(key(e.book, e.ch)));
    const avoidSet = new Set(avoid || []);
    const fresh = pool.filter((e) => !avoidSet.has(e.id));
    const from = fresh.length ? fresh : pool;
    const weights = from.map((e) => weightFor(stats[e.id]));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < from.length; i++) {
      r -= weights[i];
      if (r < 0) return { event: from[i], review: isReview };
    }
    return { event: from[from.length - 1], review: isReview };
  }

  // Question style: "chapter" (given the chapter, pick what happens there),
  // "event" (given what happens, pick the chapter) or "verse" (given a verse,
  // pick the chapter). Verses join once an event has been answered right.
  function trainingKind(stat, rng) {
    const r = rng();
    if (!stat || !stat.box) return r < 0.5 ? "chapter" : "event";
    return r < 0.35 ? "chapter" : r < 0.7 ? "event" : "verse";
  }

  // Chapter choices for an event, drawn only from chapters in training (and in
  // the scope). Wrong
  // answers come from the right Gospel where it has enough (closer chapters
  // first); otherwise the books are balanced as in buildChoices so the mix
  // doesn't point at the answer. Up to 4 choices, sorted in Bible order.
  function trainingChapterChoices(event, gospels, scope, introduced, rng) {
    const inScope = new Set(scope);
    const banned = new Set([key(event.book, event.ch)].concat(event.par || []));
    const open = introduced
      .map(parseKey)
      .filter((o) => inScope.has(key(o.book, o.ch)) && !banned.has(key(o.book, o.ch)));
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
  // training (different chapters where possible), then the same book, before
  // any others from the books in the scope.
  function trainingEventChoices(event, gospels, scope, introduced, rng) {
    const asked = key(event.book, event.ch);
    const inChapter = gospels[event.book].events.filter((e) => e.ch === event.ch).map((e) => Object.assign({ book: event.book }, e));
    const titles = new Set(inChapter.map((e) => e.title));
    const valid = (w) => key(w.book, w.ch) !== asked && !titles.has(w.title) &&
      !(w.par || []).includes(asked) && !inChapter.some((x) => sameStory(x, w));
    const all = eventPool(gospels, scopeBooks(scope)).filter(valid);
    const inScope = new Set(scope);
    const inTraining = new Set(introduced.filter((k) => inScope.has(k)));
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
    TRAINING_ACTIVE, REVIEW_STEPS, REVIEW_SHARE, trainingScope, chapterLearned, trainingStatus,
    nextTrainingChapter, trainingTopUp, dueChapters, updateReview, pickTrainingEvent, trainingKind, trainingChapterChoices, trainingEventChoices,
    cleanVerse, verseText, passage,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
