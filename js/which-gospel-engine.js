// "Which Gospel?" rules with no DOM access: reading references, grading answers,
// hints and picking questions. Builds on Engine for weighting, mastery and
// scoring. Loaded as a classic script in the browser (window.WhichGospelEngine)
// and with require() in the tests.
(function (root, E) {
  "use strict";

  const BOOKS = E.BOOK_ORDER;

  // "Luke 15:11-32" → { book: "Luke", ch: 15, v: [11, 32] }, the same shape as an
  // event, so Engine.formatRef and Engine.passage work on it.
  function parseRef(s) {
    const m = /^(Matthew|Mark|Luke|John) (\d+):(\d+)(?:-(\d+))?$/.exec(s);
    return m ? { book: m[1], ch: +m[2], v: [+m[3], +(m[4] || m[3])] } : null;
  }

  // Items with their references parsed and `answer`: the Gospels that tell it,
  // in Bible order.
  function itemPool(items) {
    return items.map((it) => {
      const refs = it.refs.map(parseRef);
      return Object.assign({}, it, { refs, answer: BOOKS.filter((b) => refs.some((r) => r.book === b)) });
    });
  }

  // Right only when the ticked Gospels are exactly the answer.
  function grade(picked, answer) {
    const missed = answer.filter((b) => !picked.includes(b));
    const extra = picked.filter((b) => !answer.includes(b));
    return { ok: !missed.length && !extra.length, missed, extra };
  }

  // The hint settles one Gospel: one the player currently has wrong if there is
  // one, otherwise any they haven't had settled yet. Returns its name, or null.
  function revealOne(picked, answer, locked, rng) {
    const open = BOOKS.filter((b) => !locked.includes(b));
    const wrong = open.filter((b) => picked.includes(b) !== answer.includes(b));
    const from = wrong.length ? wrong : open;
    return from.length ? from[Math.floor(rng() * from.length)] : null;
  }

  // Stories told by one Gospel far outnumber those told by all four, so each
  // question's weight is divided by the square root of how many share its
  // answer size. A round then mixes ones, twos, threes and fours.
  function balance(pool) {
    const count = {};
    for (const it of pool) count[it.answer.length] = (count[it.answer.length] || 0) + 1;
    return (it) => 1 / Math.sqrt(count[it.answer.length]);
  }
  function pickItems(pool, stats, n, rng, avoid) {
    return E.pickEvents(pool, stats, n, rng, avoid, balance(pool));
  }

  // "Matthew and Luke", "Matthew, Mark and Luke"
  function listBooks(books) {
    return books.length < 3 ? books.join(" and ") : `${books.slice(0, -1).join(", ")} and ${books[books.length - 1]}`;
  }
  function answerLabel(answer) {
    if (answer.length === BOOKS.length) return "All four Gospels";
    if (answer.length === 1) return `Only ${answer[0]}`;
    return listBooks(answer);
  }

  // Order for grouping by answer: all four first, then threes, twos and ones,
  // each in Bible order.
  function compareAnswers(a, b) {
    if (a.length !== b.length) return b.length - a.length;
    for (let i = 0; i < a.length; i++) {
      const d = BOOKS.indexOf(a[i]) - BOOKS.indexOf(b[i]);
      if (d) return d;
    }
    return 0;
  }

  // Titles for a finished round, each with the verse it comes from (WEB).
  const RANKS = [
    { min: 1, title: "Servant of the word", ref: "Luke 1:2", note: "Like those who from the beginning were eyewitnesses and servants of the word." },
    { min: 0.8, title: "True witness", ref: "John 21:24", note: "We know that his witness is true." },
    { min: 0.5, title: "Disciple", ref: "Mark 1:17", note: "“Come after me.” Keep following." },
    { min: 0.3, title: "Seeker", ref: "Luke 11:9", note: "Keep seeking, and you will find." },
    { min: 0, title: "Mustard seed", ref: "Luke 13:19", note: "A tiny seed grows into a large tree." },
  ];

  const WhichGospelEngine = {
    RANKS, parseRef, itemPool, grade, revealOne, balance, pickItems,
    listBooks, answerLabel, compareAnswers,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = WhichGospelEngine;
  else root.WhichGospelEngine = WhichGospelEngine;
})(
  typeof window !== "undefined" ? window : globalThis,
  typeof module !== "undefined" && module.exports ? require("./engine.js") : window.Engine
);
