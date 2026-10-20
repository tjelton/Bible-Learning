// Number Crunch — a number from the Bible: slide to your best guess, and the
// closer you get, the more you score. Screens, input and saved progress; the
// rules live in number-crunch-engine.js and the facts in js/data/number-crunch.js.
(function () {
  "use strict";

  const E = window.Engine;
  const N = window.NumberCrunchEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.NUMBER_CRUNCH_TEXT || {};
  const NAME = "Number Crunch";
  const ROUND_LENGTH = 10;
  const LAMPS = 3;

  const POOL = window.NUMBER_CRUNCH;
  const byId = {};
  for (const f of POOL) byId[f.id] = f;

  let settings = Object.assign({ sound: true }, store.get("nc.settings", {}));
  let stats = store.get("nc.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, bullseyes: 0 }, store.get("nc.bests", {}));

  let state = { screen: "home", game: null, sheet: null, resetArmed: false };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const mastered = (facts) => facts.filter((f) => E.isMastered(stats[f.id])).length;
  const withUnit = (f, n) => `${fmt(n)}${f.unit ? ` ${f.unit}` : ""}`;
  const clamp = (f, n) => Math.min(f.max, Math.max(f.min || 0, n));
  const placeOf = (f, n) => ((n - (f.min || 0)) / (f.max - (f.min || 0))).toFixed(4);

  // ── Game flow ──
  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps"
      queue: mode === "round" ? N.pickFacts(POOL, stats, ROUND_LENGTH, Math.random).map((f) => f.id) : [],
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

  const over = (g) => (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);

  function nextQuestion() {
    const g = state.game;
    if (over(g)) return finishGame();
    const id = g.mode === "round" ? g.queue[g.history.length] : N.pickFacts(POOL, stats, 1, Math.random, g.recent)[0].id;
    g.recent = g.recent.concat(id).slice(-40);
    g.q = { id, guess: N.startGuess(byId[id]), result: null };
    render();
    app.querySelector(".nc-slider")?.focus({ preventScroll: true });
  }

  // Moves the guess without redrawing the screen, so dragging the slider stays smooth.
  function setGuess(n) {
    const q = state.game.q;
    const f = byId[q.id];
    q.guess = clamp(f, n);
    const slider = app.querySelector(".nc-slider");
    if (slider && Number(slider.value) !== q.guess) slider.value = q.guess;
    const num = app.querySelector(".nc-num");
    if (num) num.textContent = fmt(q.guess);
  }
  function nudge(dir) {
    const q = state.game && state.game.q;
    if (!q || q.result) return;
    setGuess(q.guess + dir * N.step(byId[q.id]));
  }

  function lockIn() {
    const g = state.game;
    const q = g.q;
    if (q.result) return;
    const f = byId[q.id];
    const s = N.score(f, q.guess);
    q.result = s;
    g.streak = s.ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") g.score += s.total;
    else if (s.ok) g.score += 1;
    else g.lamps -= 1;
    if (s.exact) { bests.bullseyes += 1; store.set("nc.bests", bests); }
    g.history.push({ id: q.id, guess: q.guess, ok: s.ok, close: s.close, total: s.total, exact: s.exact });
    stats = E.recordAnswer(stats, q.id, s.ok);
    store.set("nc.stats", stats);
    play(s.ok ? "right" : "wrong");
    render({ checked: true });
    if (s.total && g.mode === "round") Kit.floatPoints(s.total);
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    store.set("nc.bests", bests);
    state.screen = "results";
    render({ scrollTop: true });
    if (g.newBest || N.rankFor(g.history) === N.RANKS[0]) { play("done"); Kit.confetti(); }
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
    if (bests.bullseyes) bestBits.push(`Bullseyes <b class="tabular">${fmt(bests.bullseyes)}</b>`);
    const bars = ["Old", "New"].map((t) => {
      const facts = POOL.filter((f) => N.testament(f.ref) === t);
      const done = mastered(facts);
      return `<div class="bar-row">
        <span class="bar-label">${t} Testament</span>
        <span class="bar" style="--p:${(facts.length ? done / facts.length : 0).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${facts.length} mastered">${done}/${facts.length}</span>
      </div>`;
    }).join("");

    return `
      ${Kit.crumb("#/bible", "The Whole Bible")}
      <header class="masthead">
        <p class="eyebrow">A whole-Bible game</p>
        <h1>Number Crunch</h1>
        <p class="lede">How many small coins did the poor widow put in the temple treasury? Slide to your best guess. The closer you get, the more you score.</p>
      </header>

      ${Kit.saveWarning()}
      <div class="play-buttons mode-groups">
      <section class="mode-group" aria-labelledby="quick-title">
        <h2 class="eyebrow" id="quick-title">Quick play</h2>
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 numbers · up to 100 points each, +50 for a bullseye</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">A lamp goes out each time you’re way off</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>
      <section class="mode-group is-learn" aria-labelledby="learn-title">
        <h2 class="eyebrow" id="learn-title">Learning</h2>
        <button type="button" class="btn btn-ghost mode-btn" data-action="browse">
          <span class="mode-text"><span class="mode-name">All the numbers</span><span class="mode-desc">Every number in the game, smallest to largest, with its verse</span></span>${ICON.book}
        </button>
      </section>
      </div>

      <section aria-labelledby="progress-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="progress-title">Your progress</h2>
          <span class="note tabular">${mastered(POOL)} of ${POOL.length} mastered</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">A number is mastered once you get close twice in a row.</p>
      </section>

      <section class="options" aria-labelledby="how-title">
        <div class="section-head"><h2 id="how-title">How to play</h2></div>
        <p class="study-intro">Drag the slider to your guess, or fine-tune it with <b>−</b> and <b>+</b>, then <b>Lock in</b>. The exact number scores 100 points plus a 50-point bullseye bonus. Points fall away the further off you are, reaching nothing at a quarter of the slider away. In Three lamps, a guess worth fewer than ${N.CLOSE} points puts out a lamp.</p>
      </section>

      <section class="options" aria-labelledby="opt-title">
        <div class="section-head"><h2 id="opt-title">Options</h2></div>
        <div class="switch-row">
          <span class="option-label">Sound</span>
          <button type="button" class="switch" role="switch" aria-checked="${settings.sound}" aria-label="Sound" data-action="toggle" data-key="sound"></button>
        </div>
        <button type="button" class="btn btn-small btn-ghost danger" data-action="reset">${state.resetArmed ? "Tap again to erase all progress" : "Reset progress"}</button>
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. Progress is saved on this device only.</p>
      </section>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const f = byId[q.id];
    const r = q.result;
    const min = f.min || 0;
    const scale = `<div class="nc-scale tabular" aria-hidden="true"><span>${fmt(min)}</span><span>${fmt(f.max)}</span></div>`;

    let dial;
    if (r) {
      const pg = placeOf(f, q.guess);
      const pa = placeOf(f, f.a);
      dial = `
        <div class="nc-track is-result" aria-hidden="true">
          <span class="nc-gap" style="--from:${Math.min(pg, pa)};--to:${Math.max(pg, pa)}"></span>
          <span class="nc-pin is-answer" style="--p:${pa}"><b class="tabular">${fmt(f.a)}</b></span>
          <span class="nc-pin is-guess${r.ok ? " is-ok" : ""}" style="--p:${pg}"><b class="tabular">${fmt(q.guess)}</b></span>
        </div>
        ${scale}
        <div class="actions"><button type="button" class="btn btn-primary" data-action="next">${over(g) ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      dial = `
        <p class="nc-readout"><span class="nc-num tabular">${fmt(q.guess)}</span>${f.unit ? ` <span class="nc-unit">${esc(f.unit)}</span>` : ""}</p>
        <input type="range" class="nc-slider" min="${min}" max="${f.max}" step="${N.step(f)}" value="${q.guess}" aria-label="Your guess">
        ${scale}
        <div class="nc-actions">
          <button type="button" class="btn nc-nudge" data-action="nudge" data-dir="-1" aria-label="Down ${fmt(N.step(f))}">−</button>
          <button type="button" class="btn btn-primary" data-action="lock">Lock in</button>
          <button type="button" class="btn nc-nudge" data-action="nudge" data-dir="1" aria-label="Up ${fmt(N.step(f))}">+</button>
        </div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${Kit.roundStatus(g, !!r, ROUND_LENGTH, LAMPS)}
        <span class="score tabular" aria-label="${g.mode === "round" ? "Score" : "Close guesses"}">${fmt(g.score)}</span>
      </div>
      <article class="card${r ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top"><span class="kind">${esc(N.bookOf(f.ref))}</span></div>
        <h2 class="nc-question">${esc(f.q)}</h2>
        ${r ? revealHtml(f, q) : ""}
      </article>
      <div class="nc-dial">${dial}</div>`;
  }

  function revealHtml(f, q) {
    const r = q.result;
    const points = r.total ? ` +${r.total}${r.exact ? ` (bullseye +${N.BULLSEYE})` : ""}` : "";
    const off = r.exact ? "Exactly right" : `You said ${fmt(q.guess)}, off by ${fmt(r.off)}`;
    return `
      <div class="reveal">
        <p class="verdict ${r.ok ? "ok" : "miss"}" role="status">${N.verdict(r)}${points}</p>
        <p class="ref answer tabular">${esc(withUnit(f, f.a))}</p>
        <p class="meta">${off}.</p>
        <p class="meta">${esc(f.note)}</p>
        <button type="button" class="link-btn" data-action="passage" data-id="${f.id}">${ICON.book} Read ${esc(f.ref.replace("-", "–"))}</button>
      </div>`;
  }

  function resultsHtml() {
    const g = state.game;
    const close = g.history.filter((h) => h.ok).length;
    const exact = g.history.filter((h) => h.exact).length;
    const rank = N.rankFor(g.history);
    const extra = exact ? ` · ${plural(exact, "bullseye")}` : "";
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${close} of ${g.history.length}</b> close${extra}</p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${g.score} close ${g.score === 1 ? "guess" : "guesses"}</b> before your lamps went out${extra}</p>`;
    const items = g.history.map((h) => {
      const f = byId[h.id];
      return `<button type="button" class="review-item" data-action="passage" data-id="${f.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Close" : "Way off"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(f.q)}<span class="sub">${h.exact ? "Bullseye" : `You said ${fmt(h.guess)}`}</span></span>
        <span class="r tabular">${fmt(f.a)}</span></button>`;
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
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any number to read its verse</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  // Every fact, smallest number first.
  function browseHtml() {
    const rows = POOL.slice().sort((a, b) => a.a - b.a).map((f) => {
      const m = E.isMastered(stats[f.id]);
      return `<button type="button" class="review-item" data-action="passage" data-id="${f.id}">
        <span class="mark ${m ? "ok" : "none"}" aria-label="${m ? "Mastered" : "Not mastered yet"}">${m ? "✓" : ""}</span>
        <span class="t">${esc(f.q)}<span class="sub">${esc(f.ref.replace("-", "–"))}</span></span>
        <span class="r tabular">${fmt(f.a)}</span></button>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>All the numbers</h1>
      </div>
      <p class="study-intro">Every number in the game, from the smallest to the largest. Tap one to read the verse it comes from.</p>
      <div class="review">${rows}</div>`;
  }

  function sheetHtml() {
    const f = byId[state.sheet];
    return Kit.sheetHtml({
      eyebrow: "The answer",
      title: withUnit(f, f.a),
      intro: `${f.q} ${f.note}`,
      html: Kit.markedPassageHtml(f.ref.replace("-", "–"), Number(/:(\d+)/.exec(f.ref)[1]), TEXT[f.ref] || [], f.find),
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
      case "nudge": nudge(Number(el.dataset.dir)); break;
      case "lock": lockIn(); break;
      case "next": nextQuestion(); break;
      case "quit": goHome(); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "browse": state.screen = "browse"; render({ scrollTop: true }); break;
      case "passage": state.sheet = el.dataset.id; render(); app.querySelector(".sheet .icon-btn")?.focus(); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; store.set("nc.settings", settings); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, bullseyes: 0 };
          store.remove("nc.stats"); store.remove("nc.bests");
          render();
        }
        break;
    }
  }

  // The slider reports every move; the shell only forwards clicks and keys.
  function onInput(ev) {
    if (!ev.target.classList.contains("nc-slider") || state.screen !== "play") return;
    const q = state.game.q;
    if (!q.result) setGuess(Number(ev.target.value));
  }

  function key(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (state.sheet) { if (ev.key === "Escape") { state.sheet = null; render(); } return; }
    if (state.screen !== "play") return;
    const q = state.game.q;
    const onButton = ev.target instanceof HTMLButtonElement;
    const onSlider = ev.target.classList && ev.target.classList.contains("nc-slider");
    if (!q.result && (ev.key === "-" || (ev.key === "ArrowLeft" && !onSlider))) { nudge(-1); ev.preventDefault(); }
    else if (!q.result && (ev.key === "+" || ev.key === "=" || (ev.key === "ArrowRight" && !onSlider))) { nudge(1); ev.preventDefault(); }
    else if (ev.key === "Enter" && !onButton) { if (q.result) nextQuestion(); else lockIn(); ev.preventDefault(); }
    else if (ev.key === "Escape") goHome();
  }

  window.Games = window.Games || {};
  window.Games["number-crunch"] = {
    title: NAME,
    blurb: "How many coins did the poor widow put in the treasury? Slide to your best guess.",
    art: `<span class="art-num">2</span>`,
    summary() {
      const bits = [`${mastered(POOL)} of ${POOL.length} numbers mastered`];
      if (bests.round) bits.push(`best round ${fmt(bests.round)}`);
      return bits.join(" · ");
    },
    mount(root) { app = root; app.addEventListener("input", onInput); render({ scrollTop: true }); },
    // Leaving abandons a game in progress; the menu is there on return.
    unmount() {
      if (app) app.removeEventListener("input", onInput);
      app = null;
      Object.assign(state, { screen: "home", game: null, sheet: null, resetArmed: false });
    },
    click, key,
    // Keeps an in-progress game when the page is updated live.
    snapshot: () => JSON.parse(JSON.stringify(state)),
    restore(saved) {
      if (!saved || !saved.screen) return;
      state = Object.assign(state, saved);
      if (state.game && state.game.q && !byId[state.game.q.id]) state.game = null;
      if (state.sheet && !byId[state.sheet]) state.sheet = null;
      if (state.screen !== "home" && state.screen !== "browse" && !state.game) state.screen = "home";
    },
  };
})();
