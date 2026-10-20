// Which Gospel? — read a story, saying or detail and tick every Gospel that
// tells it. Screens, input and saved progress; the rules live in
// which-gospel-engine.js and the questions in js/data/which-gospel.js.
(function () {
  "use strict";

  const E = window.Engine;
  const W = window.WhichGospelEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.BIBLE_TEXT;
  const ROUND_LENGTH = 10;
  const LAMPS = 3;
  const BOOKS = E.BOOK_ORDER;
  const BOOK_ABBR = { Matthew: "Mt", Mark: "Mk", Luke: "Lk", John: "Jn" };
  const ASK = {
    event: "Which Gospels tell this?",
    detail: "Which Gospels mention this?",
    teaching: "Which Gospels have this teaching?",
    saying: "Which Gospels have these words?",
  };
  const SIZES = [[4, "All four Gospels"], [3, "Three Gospels"], [2, "Two Gospels"], [1, "Only one Gospel"]];

  const POOL = W.itemPool(window.WHICH_GOSPEL);
  const byId = {};
  for (const it of POOL) byId[it.id] = it;

  const DEFAULT_SETTINGS = { timer: true, sound: true };
  let settings = Object.assign({}, DEFAULT_SETTINGS, store.get("wg.settings", {}));
  let stats = store.get("wg.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("wg.bests", {}));

  let state = { screen: "home", game: null, sheet: null, resetArmed: false };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const abbr = (books) => books.map((b) => BOOK_ABBR[b]).join(" ");
  const shownTitle = (it) => (it.kind === "saying" ? `“${it.title}”` : it.title);
  const mastered = (items) => items.filter((it) => E.isMastered(stats[it.id])).length;
  // "14:13–21", or "11:12–14 +1" when a Gospel tells it in more than one place.
  function refsIn(it, book) {
    const refs = it.refs.filter((r) => r.book === book);
    const first = E.formatRef(refs[0]).slice(book.length + 1);
    return refs.length > 1 ? `${first} +${refs.length - 1}` : first;
  }
  function saveSettings() { store.set("wg.settings", settings); }

  // ── Game flow ──
  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps"
      queue: mode === "round" ? W.pickItems(POOL, stats, ROUND_LENGTH, Math.random).map((it) => it.id) : [],
      history: [],
      recent: [],
      score: 0,
      streak: 0,
      bestRun: 0,
      lamps: LAMPS,
      q: null,
      newBest: false,
    };
    state.screen = "play";
    nextQuestion();
  }

  function nextQuestion() {
    const g = state.game;
    if ((g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0)) {
      return finishGame();
    }
    const id = g.mode === "round" ? g.queue[g.history.length] : W.pickItems(POOL, stats, 1, Math.random, g.recent)[0].id;
    g.recent = g.recent.concat(id).slice(-60);
    // picked: the Gospels ticked; locked: those the hint has settled.
    g.q = { id, picked: [], locked: [], hinted: false, result: null, points: null, startedAt: Date.now() };
    render();
  }

  function timed() { return settings.timer && state.game && state.game.mode === "round"; }

  function toggle(book) {
    const q = state.game.q;
    if (q.result || q.locked.includes(book)) return;
    const on = !q.picked.includes(book);
    q.picked = BOOKS.filter((b) => (b === book ? on : q.picked.includes(b)));
    render();
  }

  function check() {
    const g = state.game;
    const q = g.q;
    if (q.result || !q.picked.length) return;
    q.result = W.grade(q.picked, byId[q.id].answer);
    const ok = q.result.ok;
    g.streak = ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: q.hinted, timed: timed() });
      g.score += q.points.total;
    } else {
      if (ok) g.score += 1; else g.lamps -= 1;
    }
    g.history.push({ id: q.id, ok, picked: q.picked.slice() });
    stats = E.recordAnswer(stats, q.id, ok);
    store.set("wg.stats", stats);
    play(ok ? "right" : "wrong");
    render({ checked: true });
    if (ok && g.mode === "round") Kit.floatPoints(q.points.total);
  }

  function useHint() {
    const q = state.game && state.game.q;
    if (!q || q.hinted || q.result) return;
    const answer = byId[q.id].answer;
    const book = W.revealOne(q.picked, answer, q.locked, Math.random);
    q.hinted = true;
    if (book) {
      q.locked.push(book);
      q.picked = BOOKS.filter((b) => (b === book ? answer.includes(b) : q.picked.includes(b)));
    }
    render();
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    bests.run = Math.max(bests.run, g.bestRun);
    store.set("wg.bests", bests);
    state.screen = "results";
    render();
    const right = g.history.filter((h) => h.ok).length;
    if (g.newBest || (g.mode === "round" && right === ROUND_LENGTH)) { play("done"); Kit.confetti(); }
  }

  // ── Screens ──
  function render(opts) {
    if (!app) return;
    opts = opts || {};
    app.className = "app" + (state.screen === "play" ? " is-play" : "");
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, browse: browseHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.checked) {
      const ok = state.game.q.result.ok;
      app.querySelectorAll(".pick.is-right, .pick.is-wrong, .pick.is-missed").forEach((el) => el.classList.add(ok ? "pop" : "shake"));
      const reveal = app.querySelector(".reveal");
      const card = app.querySelector(".card");
      if (reveal && card) card.scrollTo({ top: reveal.offsetTop - 12, behavior: "smooth" });
      app.querySelector('[data-action="next"]')?.focus({ preventScroll: true });
    }
    if (opts.scrollTop) window.scrollTo(0, 0);
  }

  function homeHtml() {
    const bestBits = [];
    if (bests.round) bestBits.push(`Best round <b class="tabular">${fmt(bests.round)}</b>`);
    if (bests.lamps) bestBits.push(`Best with three lamps <b class="tabular">${bests.lamps}</b>`);
    if (bests.run) bestBits.push(`Longest run <b class="tabular">${bests.run}</b>`);
    const bars = SIZES.map(([n, label]) => {
      const items = POOL.filter((it) => it.answer.length === n);
      const done = mastered(items);
      return `<div class="bar-row">
        <span class="bar-label">${label}</span>
        <span class="bar" style="--p:${(items.length ? done / items.length : 0).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${items.length} mastered">${done}/${items.length}</span>
      </div>`;
    }).join("");

    return `
      ${Kit.crumb("#/gospels", "The Gospels")}
      <header class="masthead">
        <p class="eyebrow">A Gospel game</p>
        <h1>Which Gospel<span class="amp">?</span></h1>
        <p class="lede">Read a story, saying or detail. Tick every Gospel that tells it.</p>
      </header>

      ${Kit.saveWarning()}
      <div class="play-buttons mode-groups">
      <section class="mode-group" aria-labelledby="quick-title">
        <h2 class="eyebrow" id="quick-title">Quick play</h2>
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 questions · bonus points for speed and streaks</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>
      <section class="mode-group is-learn" aria-labelledby="learn-title">
        <h2 class="eyebrow" id="learn-title">Learning</h2>
        <button type="button" class="btn btn-ghost mode-btn" data-action="browse">
          <span class="mode-text"><span class="mode-name">Browse the answers</span><span class="mode-desc">What all four share, and what only one tells</span></span>${ICON.book}
        </button>
      </section>
      </div>

      <section aria-labelledby="progress-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="progress-title">Your progress</h2>
          <span class="note tabular">${mastered(POOL)} of ${POOL.length} mastered</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">A question is mastered once you get it right twice in a row.</p>
      </section>

      <section class="options" aria-labelledby="opt-title">
        <div class="section-head"><h2 id="opt-title">Options</h2></div>
        <div class="switch-row">
          <span><span class="option-label">Speed bonus timer</span><br><span class="option-help">Up to +50 points for answering within 20 seconds</span></span>
          <button type="button" class="switch" role="switch" aria-checked="${settings.timer}" aria-label="Speed bonus timer" data-action="toggle" data-key="timer"></button>
        </div>
        <div class="switch-row">
          <span class="option-label">Sound</span>
          <button type="button" class="switch" role="switch" aria-checked="${settings.sound}" aria-label="Sound" data-action="toggle" data-key="sound"></button>
        </div>
        <button type="button" class="btn btn-small btn-ghost danger" data-action="reset">${state.resetArmed ? "Tap again to erase all progress" : "Reset progress"}</button>
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. A Gospel counts only if it tells that story, saying or detail itself, not just something like it; the notes point out the near misses. Progress is saved on this device only.</p>
      </section>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const it = byId[q.id];
    const r = q.result;

    const prompt = it.kind === "saying"
      ? `<p class="verse">${esc(it.title)}</p><p class="clue">${esc(it.clue)}</p>`
      : `<h2 class="event-title">${esc(it.title)}</h2><p class="clue">${esc(it.clue)}</p>`;

    const picks = BOOKS.map((b, i) => {
      const on = q.picked.includes(b);
      const inAnswer = it.answer.includes(b);
      const locked = q.locked.includes(b);
      let cls = "pick";
      let sub = locked ? (inAnswer ? "Tells it" : "Not here") : "";
      let label = b;
      if (r) {
        cls += on && inAnswer ? " is-right" : on ? " is-wrong" : inAnswer ? " is-missed" : " is-faded";
        sub = inAnswer ? refsIn(it, b) : "Not here";
        label = `${b}: ${inAnswer ? `tells it, ${refsIn(it, b)}` : "doesn’t"}${on !== inAnswer ? (on ? " (you ticked it)" : " (you missed it)") : ""}`;
      } else if (locked) {
        cls += " is-locked";
        label = `${b}: ${inAnswer ? "tells it" : "doesn’t"} (revealed)`;
      }
      const mark = r && on && !inAnswer ? ICON.close : ICON.check;
      return `<button type="button" class="${cls}" data-action="pick" data-book="${b}" aria-pressed="${on}" aria-label="${esc(label)}" ${r || locked ? "disabled" : ""}>
        <span class="key" aria-hidden="true">${i + 1}</span>
        <span class="tick" aria-hidden="true">${mark}</span>
        <span class="name">${b}</span>
        <span class="sub">${esc(sub)}</span></button>`;
    }).join("");

    let actions;
    if (r) {
      const last = (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${last ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      actions = `
        ${timed() ? `<div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s" aria-hidden="true"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div>` : ""}
        <div class="actions two">
          <button type="button" class="btn btn-small hint-btn" data-action="hint" ${q.hinted ? "disabled" : ""}>${q.hinted ? "Hint used" : "Reveal one"}</button>
          <button type="button" class="btn btn-primary" data-action="check" ${q.picked.length ? "" : "disabled"}>${q.picked.length ? "Check" : "Tick at least one"}</button>
        </div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${Kit.roundStatus(g, !!r, ROUND_LENGTH, LAMPS)}
        <span class="score tabular" aria-label="Score">${fmt(g.score)}</span>
      </div>
      <article class="card${r ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top"><span class="kind">${ASK[it.kind]}</span></div>
        ${prompt}
        ${r ? revealHtml(it, q) : ""}
      </article>
      <div class="picks" role="group" aria-label="Gospels">${picks}</div>
      ${actions}`;
  }

  function revealHtml(it, q) {
    const r = q.result;
    let verdict = `Right!${Kit.pointsNote(q.points)}`;
    if (!r.ok) {
      const bits = ["Not quite."];
      if (r.missed.length) bits.push(`You missed ${W.listBooks(r.missed)}.`);
      if (r.extra.length) bits.push(`${W.listBooks(r.extra)} ${r.extra.length > 1 ? "don’t" : "doesn’t"} have it.`);
      verdict = bits.join(" ");
    }
    const read = it.refs.length > 1 ? `Read all ${it.refs.length} passages` : `Read ${E.formatRef(it.refs[0])}`;
    return `
      <div class="reveal">
        <p class="verdict ${r.ok ? "ok" : "miss"}" role="status">${verdict}</p>
        <p class="ref answer">${esc(W.answerLabel(it.answer))}</p>
        ${it.note ? `<p class="meta">${esc(it.note)}</p>` : ""}
        <button type="button" class="link-btn" data-action="passage" data-id="${it.id}">${ICON.book} ${esc(read)}</button>
      </div>`;
  }

  function resultsHtml() {
    const g = state.game;
    const right = g.history.filter((h) => h.ok).length;
    const total = g.history.length;
    const rank = E.rankFor(right, total, W.RANKS);
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${right} of ${total}</b> right · longest run <b>${g.bestRun}</b></p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${plural(g.score, "right answer")}</b> before your lamps went out · longest run <b>${g.bestRun}</b></p>`;
    const items = g.history.map((h) => {
      const it = byId[h.id];
      const sub = h.ok ? W.answerLabel(it.answer) : `You said ${W.listBooks(h.picked)}`;
      return `<button type="button" class="review-item" data-action="passage" data-id="${it.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Right" : "Wrong"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(shownTitle(it))}<span class="sub">${esc(sub)}</span></span>
        <span class="r">${abbr(it.answer)}</span></button>`;
    }).join("");
    return `
      <header class="results-head">
        <p class="eyebrow">${g.mode === "round" ? "Round complete" : "Three lamps"}</p>
        ${g.newBest ? `<span class="badge">New personal best</span>` : ""}
        ${headline}
        <h1 class="rank">${esc(rank.title)}</h1>
        <p class="rank-note">${esc(rank.note)} (${esc(rank.ref)})</p>
      </header>
      <div class="button-row">
        <button type="button" class="btn btn-primary" data-action="start" data-mode="${g.mode}">Play again</button>
        <button type="button" class="btn" data-action="home">Menu</button>
      </div>
      <section style="display:grid;gap:8px" aria-labelledby="review-title">
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any question to read the passages</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  // Every question, grouped by which Gospels tell it.
  function browseHtml() {
    const groups = new Map();
    for (const it of POOL) {
      const k = it.answer.join("+");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const secs = [...groups.values()]
      .sort((a, b) => W.compareAnswers(a[0].answer, b[0].answer))
      .map((items) => {
        const rows = items.map((it) => {
          const m = E.isMastered(stats[it.id]);
          return `<button type="button" class="review-item" data-action="passage" data-id="${it.id}">
            <span class="mark ${m ? "ok" : "none"}" aria-label="${m ? "Mastered" : "Not mastered yet"}">${m ? "✓" : ""}</span>
            <span class="t">${esc(shownTitle(it))}</span></button>`;
        }).join("");
        return `<section class="sec">
          <div class="sec-head"><h2 class="sec-name">${esc(W.answerLabel(items[0].answer))}</h2><span class="sec-range">${plural(items.length, "question")}</span></div>
          <div class="review">${rows}</div>
        </section>`;
      }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>Browse the answers</h1>
      </div>
      <p class="study-intro">Every question in the game, grouped by the Gospels that tell it. Tap one to read the passages side by side.</p>
      <div class="sections">${secs}</div>`;
  }

  function sheetHtml() {
    const it = byId[state.sheet];
    return Kit.sheetHtml({
      eyebrow: W.answerLabel(it.answer),
      title: shownTitle(it),
      intro: it.note,
      passages: it.refs.map((r) => ({ heading: E.formatRef(r), verses: E.passage(TEXT, r) })),
      attribution: "World English Bible (public domain).",
    });
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function click(el) {
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "start": startGame(el.dataset.mode); window.scrollTo(0, 0); break;
      case "pick": toggle(el.dataset.book); break;
      case "check": check(); break;
      case "hint": useHint(); break;
      case "next": nextQuestion(); break;
      case "quit": state.game = null; state.screen = "home"; render({ scrollTop: true }); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "browse": state.screen = "browse"; render({ scrollTop: true }); break;
      case "passage": state.sheet = el.dataset.id; render(); app.querySelector(".sheet .icon-btn")?.focus(); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; saveSettings(); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, run: 0 };
          store.remove("wg.stats"); store.remove("wg.bests");
          render();
        }
        break;
    }
  }

  function key(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (state.sheet) { if (ev.key === "Escape") { state.sheet = null; render(); } return; }
    if (state.screen !== "play") return;
    const q = state.game.q;
    // Enter on a focused button is left to the button itself.
    const onButton = ev.target instanceof HTMLButtonElement;
    if (!q.result && /^[1-4]$/.test(ev.key)) { toggle(BOOKS[Number(ev.key) - 1]); ev.preventDefault(); }
    else if (!q.result && ev.key.toLowerCase() === "h") useHint();
    else if (ev.key === "Enter" && !onButton) { if (q.result) nextQuestion(); else check(); ev.preventDefault(); }
    else if (ev.key === "Escape") { state.game = null; state.screen = "home"; render(); }
  }

  window.Games = window.Games || {};
  window.Games["which-gospel"] = {
    title: "Which Gospel?",
    blurb: "Read a story, saying or detail. Tick every Gospel that tells it.",
    art: `<span class="art-picks">${BOOKS.map((b, i) => `<i class="${i === 1 || i === 2 ? "on" : ""}">${BOOK_ABBR[b]}</i>`).join("")}</span>`,
    summary() {
      const bits = [`${mastered(POOL)} of ${POOL.length} questions mastered`];
      if (bests.round) bits.push(`best round ${fmt(bests.round)}`);
      return bits.join(" · ");
    },
    mount(root) { app = root; render({ scrollTop: true }); },
    // Leaving abandons a game in progress; the menu is there on return.
    unmount() {
      app = null;
      Object.assign(state, { screen: "home", game: null, sheet: null, resetArmed: false });
    },
    click, key,
    // Keeps an in-progress game when the page is updated live.
    snapshot: () => JSON.parse(JSON.stringify(state)),
    restore(saved) {
      if (!saved || !saved.screen) return;
      state = Object.assign(state, saved);
      if (state.game && state.game.q) state.game.q.startedAt = Date.now();
      if (state.screen !== "home" && state.screen !== "browse" && !state.game) state.screen = "home";
    },
  };
})();
