// Before or After? — two moments from the Bible's story: did the new one happen
// before or after the last? Screens, input and saved progress; the rules live
// in before-or-after-engine.js and the events in js/data/before-or-after.js.
(function () {
  "use strict";

  const E = window.Engine;
  const B = window.BeforeOrAfterEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.BEFORE_OR_AFTER_TEXT || {};
  const NAME = "Before or After?";
  const ROUND_LENGTH = 10;
  const LAMPS = 3;
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

  const ERAS = window.BEFORE_OR_AFTER;
  const LINE = B.timeline(ERAS);
  const byId = {};
  for (const e of LINE) byId[e.id] = e;

  let settings = Object.assign({ timer: true, sound: true }, store.get("ba.settings", {}));
  let stats = store.get("ba.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("ba.bests", {}));

  let state = { screen: "home", game: null, sheet: null, resetArmed: false };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const learned = (events) => events.filter((e) => E.isMastered(stats[e.id])).length;
  const timed = () => settings.timer && state.game && state.game.mode === "round";
  const over = (g) => (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);
  const word = (a) => (a === "before" ? "Before" : "After");

  // ── Game flow ──
  function startGame(mode) {
    const first = B.pickStart(LINE, stats, Math.random);
    state.game = {
      mode, // "round" | "lamps"
      anchor: first.id,
      history: [],
      recent: [first.id],
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
    if (g.q) g.anchor = g.q.id; // the event just placed is the next one to beat
    if (over(g)) return finishGame();
    const e = B.pickNext(LINE, byId[g.anchor], stats, Math.random, g.recent, g.streak);
    g.recent = g.recent.concat(e.id).slice(-30);
    g.q = { id: e.id, pick: null, ok: null, points: null, startedAt: Date.now() };
    render();
  }

  function choose(pick) {
    const g = state.game;
    const q = g.q;
    if (q.pick) return;
    const right = B.answer(byId[g.anchor], byId[q.id]);
    q.pick = pick;
    q.ok = pick === right;
    g.streak = q.ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: q.ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: false, timed: timed() });
      g.score += q.points.total;
    } else if (q.ok) g.score += 1;
    else g.lamps -= 1;
    g.history.push({ id: q.id, anchor: g.anchor, right, ok: q.ok });
    stats = E.recordAnswer(stats, q.id, q.ok);
    store.set("ba.stats", stats);
    play(q.ok ? "right" : "wrong");
    render({ checked: true });
    if (q.ok && g.mode === "round") Kit.floatPoints(q.points.total);
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    bests.run = Math.max(bests.run, g.bestRun);
    store.set("ba.bests", bests);
    state.screen = "results";
    render({ scrollTop: true });
    const right = g.history.filter((h) => h.ok).length;
    if (g.newBest || (g.mode === "round" && right === ROUND_LENGTH)) { play("done"); Kit.confetti(); }
  }

  // ── Screens ──
  function render(opts) {
    if (!app) return;
    opts = opts || {};
    app.className = "app" + (state.screen === "play" ? " is-play" : "");
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, timeline: timelineHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.checked) {
      app.querySelector(".ba-node.is-new")?.classList.add(state.game.q.ok ? "pop" : "shake");
      app.querySelector('[data-action="next"]')?.focus({ preventScroll: true });
    }
    if (opts.scrollTop) window.scrollTo(0, 0);
  }

  function homeHtml() {
    const bestBits = [];
    if (bests.round) bestBits.push(`Best round <b class="tabular">${fmt(bests.round)}</b>`);
    if (bests.lamps) bestBits.push(`Best with three lamps <b class="tabular">${bests.lamps}</b>`);
    if (bests.run) bestBits.push(`Longest run <b class="tabular">${bests.run}</b>`);
    const bars = ERAS.map((era, i) => {
      const events = LINE.filter((e) => e.era === i);
      const done = learned(events);
      return `<div class="bar-row">
        <span class="bar-label">${esc(era.era)}</span>
        <span class="bar" style="--p:${(done / events.length).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${events.length} learned">${done}/${events.length}</span>
      </div>`;
    }).join("");

    return `
      ${Kit.crumb("#/bible", "The Whole Bible")}
      <header class="masthead">
        <p class="eyebrow">A whole-Bible game</p>
        <h1>Before or After<span class="amp">?</span></h1>
        <p class="lede">Two moments from the Bible’s story. Did this one happen before or after that one?</p>
      </header>

      ${Kit.saveWarning()}
      <div class="play-buttons mode-groups">
      <section class="mode-group" aria-labelledby="quick-title">
        <h2 class="eyebrow" id="quick-title">Quick play</h2>
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 questions · the gaps shrink as your run grows</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>
      <section class="mode-group is-learn" aria-labelledby="learn-title">
        <h2 class="eyebrow" id="learn-title">Learning</h2>
        <button type="button" class="btn btn-ghost mode-btn" data-action="timeline">
          <span class="mode-text"><span class="mode-name">The timeline</span><span class="mode-desc">All ${LINE.length} events in order, from creation to Patmos</span></span>${ICON.book}
        </button>
      </section>
      </div>

      <section aria-labelledby="progress-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="progress-title">Your progress</h2>
          <span class="note tabular">${learned(LINE)} of ${LINE.length} learned</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">An event is learned once you place it right twice in a row.</p>
      </section>

      <section class="options" aria-labelledby="how-title">
        <div class="section-head"><h2 id="how-title">How to play</h2></div>
        <p class="study-intro">Each new event is placed against the one before, then takes its place for the next question. The longer your run of right answers, the closer together the events get. Events whose order the Bible leaves uncertain are never asked against each other.</p>
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
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. Events follow the order of the Bible’s story, not the order of its books. Progress is saved on this device only.</p>
      </section>`;
  }

  // One event on the timeline, tappable to read its passage.
  function nodeHtml(e, cls) {
    return `<li><button type="button" class="ba-node${cls}" data-action="passage" data-id="${e.id}">
      <span class="ba-era">${esc(e.eraName)}</span>
      <span class="ba-title">${esc(e.title)}</span>
      <span class="ba-ref">${esc(B.showRef(e.ref))}</span></button></li>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const e = byId[q.id];
    const anchor = byId[g.anchor];

    let body, actions;
    if (q.pick) {
      const right = B.answer(anchor, e);
      const verdict = q.ok ? `Right!${Kit.pointsNote(q.points)}` : `Not quite: it came ${right}.`;
      const mine = ` is-new ${q.ok ? "is-ok" : "is-miss"}`;
      const nodes = right === "before" ? nodeHtml(e, mine) + nodeHtml(anchor, "") : nodeHtml(anchor, "") + nodeHtml(e, mine);
      body = `
        <p class="verdict ${q.ok ? "ok" : "miss"}" role="status">${verdict}</p>
        <p class="ba-end" aria-hidden="true">Earlier</p>
        <ol class="ba-line" aria-label="In order, earlier first">${nodes}</ol>
        <p class="ba-end" aria-hidden="true">Later</p>
        <p class="option-help">Tap either one to read the passage.</p>`;
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${over(g) ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      body = `
        <div class="card-top"><span class="kind">Did this happen…</span></div>
        <h2 class="event-title ba-new">${esc(e.title)}</h2>
        <p class="ba-than">…before or after this?</p>
        <div class="ba-anchor">
          <span class="ba-era">${esc(anchor.eraName)}</span>
          <span class="ba-title">${esc(anchor.title)}</span>
          <span class="ba-ref">${esc(B.showRef(anchor.ref))}</span>
        </div>`;
      actions = `
        ${timed() ? `<div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s" aria-hidden="true"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div>` : ""}
        <div class="ba-picks">
          <button type="button" class="btn ba-pick" data-action="pick" data-pick="before">${UP} Before</button>
          <button type="button" class="btn ba-pick" data-action="pick" data-pick="after">After ${DOWN}</button>
        </div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${Kit.roundStatus(g, !!q.pick, ROUND_LENGTH, LAMPS)}
        <span class="score tabular" aria-label="${g.mode === "round" ? "Score" : "Right answers"}">${fmt(g.score)}</span>
      </div>
      <article class="card${q.pick ? "" : " is-asking"}" aria-live="polite">${body}</article>
      ${actions}`;
  }

  function resultsHtml() {
    const g = state.game;
    const right = g.history.filter((h) => h.ok).length;
    const total = g.history.length;
    const rank = E.rankFor(right, total, B.RANKS);
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${right} of ${total}</b> right · longest run <b>${g.bestRun}</b></p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${plural(g.score, "right answer")}</b> before your lamps went out · longest run <b>${g.bestRun}</b></p>`;
    const items = g.history.map((h) => {
      const e = byId[h.id];
      return `<button type="button" class="review-item" data-action="passage" data-id="${e.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Right" : "Wrong"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(e.title)}<span class="sub">${word(h.right)}: ${esc(byId[h.anchor].title)}</span></span></button>`;
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
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any event to read its passage</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  // Every event in order, era by era.
  function timelineHtml() {
    const secs = ERAS.map((era, i) => {
      const events = LINE.filter((e) => e.era === i);
      const rows = events.map((e) => {
        const m = E.isMastered(stats[e.id]);
        return `<button type="button" class="review-item" data-action="passage" data-id="${e.id}">
          <span class="mark ${m ? "ok" : "none"}" aria-label="${m ? "Learned" : "Not learned yet"}">${m ? "✓" : ""}</span>
          <span class="t">${esc(e.title)}<span class="sub">${esc(B.showRef(e.ref))}</span></span></button>`;
      }).join("");
      return `<section class="sec">
        <div class="sec-head"><h2 class="sec-name">${esc(era.era)}</h2><span class="sec-range">${learned(events)} of ${events.length} learned</span></div>
        <div class="review">${rows}</div>
      </section>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>The timeline</h1>
      </div>
      <p class="study-intro">Every event in the game, in the order of the Bible’s story. Tap one to read its passage.</p>
      <div class="sections">${secs}</div>`;
  }

  function sheetHtml() {
    const e = byId[state.sheet];
    return Kit.sheetHtml({
      eyebrow: e.eraName,
      title: e.title,
      html: Kit.markedPassageHtml(B.showRef(e.ref), Number(/:(\d+)/.exec(e.ref)[1]), TEXT[e.ref] || [], e.find),
      attribution: "World English Bible (public domain).",
    });
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function goHome() { state.game = null; state.screen = "home"; render({ scrollTop: true }); }
  function click(el) {
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "start": startGame(el.dataset.mode); window.scrollTo(0, 0); break;
      case "pick": choose(el.dataset.pick); break;
      case "next": nextQuestion(); break;
      case "quit": goHome(); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "timeline": state.screen = "timeline"; render({ scrollTop: true }); break;
      case "passage": state.sheet = el.dataset.id; render(); app.querySelector(".sheet .icon-btn")?.focus(); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; store.set("ba.settings", settings); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, run: 0 };
          store.remove("ba.stats"); store.remove("ba.bests");
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
    const onButton = ev.target instanceof HTMLButtonElement;
    const k = ev.key.toLowerCase();
    if (!q.pick && (k === "arrowup" || k === "b" || k === "1")) { choose("before"); ev.preventDefault(); }
    else if (!q.pick && (k === "arrowdown" || k === "a" || k === "2")) { choose("after"); ev.preventDefault(); }
    else if (ev.key === "Enter" && !onButton && q.pick) { nextQuestion(); ev.preventDefault(); }
    else if (ev.key === "Escape") goHome();
  }

  window.Games = window.Games || {};
  window.Games["before-or-after"] = {
    title: NAME,
    blurb: "Two moments from the Bible’s story. Which came first?",
    art: `<svg class="art-order" viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="4" width="30" height="9" rx="3" fill="#dab562"/><path d="M14 20.5l6-4 6 4M14 23.5l6 4 6-4" fill="none" stroke="#dab562" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="5.75" y="27.75" width="28.5" height="7.5" rx="3" fill="none" stroke="#dab562" stroke-width="1.5"/></svg>`,
    summary() {
      const bits = [`${learned(LINE)} of ${LINE.length} events learned`];
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
      const g = state.game;
      if (g && (!byId[g.anchor] || (g.q && !byId[g.q.id]))) state.game = null;
      if (state.game && state.game.q) state.game.q.startedAt = Date.now();
      if (state.sheet && !byId[state.sheet]) state.sheet = null;
      if (state.screen !== "home" && state.screen !== "timeline" && !state.game) state.screen = "home";
    },
  };
})();
