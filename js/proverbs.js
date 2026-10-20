// Finish the Proverb — read the first half of one of Solomon's proverbs and
// pick its real ending. Screens, input and saved progress; the rules live in
// proverbs-engine.js and the text in js/data/text-proverbs.js.
(function () {
  "use strict";

  const E = window.Engine;
  const P = window.ProverbsEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.BIBLE_TEXT.Proverbs;
  const NAME = "Finish the Proverb";
  const ROUND_LENGTH = 10;
  const LAMPS = 3;
  const CONTEXT = 3; // verses either side when reading a proverb in context

  const POOL = P.sayings(TEXT);
  const byId = {};
  for (const s of POOL) byId[s.id] = s;
  // The chapters the game draws on, in order.
  const CHAPTERS = [...new Set(POOL.map((s) => s.ch))];

  let settings = Object.assign({ timer: true, sound: true }, store.get("pv.settings", {}));
  let stats = store.get("pv.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("pv.bests", {}));

  // sheet: a proverb's id, or "ch-<n>" for a whole chapter
  let state = { screen: "home", game: null, sheet: null, resetArmed: false };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const learned = (sayings) => sayings.filter((s) => E.isMastered(stats[s.id])).length;
  const refOf = (s) => `Proverbs ${s.ch}:${s.v}`;
  const timed = () => settings.timer && state.game && state.game.mode === "round";
  const over = (g) => (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);

  // ── Game flow ──
  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps"
      queue: mode === "round" ? E.pickEvents(POOL, stats, ROUND_LENGTH, Math.random).map((s) => s.id) : [],
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
    if (over(g)) return finishGame();
    const id = g.mode === "round" ? g.queue[g.history.length] : E.pickEvents(POOL, stats, 1, Math.random, g.recent)[0].id;
    g.recent = g.recent.concat(id).slice(-60);
    g.q = { id, endings: P.choices(byId[id], POOL, Math.random), removed: [], hinted: false, picked: null, points: null, startedAt: Date.now() };
    render();
  }

  function answer(i) {
    const g = state.game;
    const q = g.q;
    if (q.picked !== null || q.removed.includes(i) || !q.endings[i]) return;
    const s = byId[q.id];
    q.picked = i;
    const ok = q.endings[i] === s.second;
    g.streak = ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: q.hinted, timed: timed() });
      g.score += q.points.total;
    } else if (ok) g.score += 1;
    else g.lamps -= 1;
    g.history.push({ id: q.id, ok, picked: q.endings[i] });
    stats = E.recordAnswer(stats, q.id, ok);
    store.set("pv.stats", stats);
    play(ok ? "right" : "wrong");
    render({ checked: true });
    if (ok && g.mode === "round") Kit.floatPoints(q.points.total);
  }

  function useHint() {
    const q = state.game && state.game.q;
    if (!q || q.hinted || q.picked !== null) return;
    q.hinted = true;
    q.removed = P.fiftyFifty(q.endings, byId[q.id].second, Math.random);
    render();
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    bests.run = Math.max(bests.run, g.bestRun);
    store.set("pv.bests", bests);
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
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, read: readHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.checked) {
      const q = state.game.q;
      const ok = q.endings[q.picked] === byId[q.id].second;
      app.querySelectorAll(".choice.is-right, .choice.is-wrong").forEach((el) => el.classList.add(ok ? "pop" : "shake"));
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
    const bars = P.COLLECTIONS.map((c, i) => {
      const sayings = POOL.filter((s) => s.collection === i);
      const done = learned(sayings);
      const range = `${c.from[0]}–${c.to[0]}`;
      return `<div class="bar-row">
        <span class="bar-label">Chapters ${range}</span>
        <span class="bar" style="--p:${(done / sayings.length).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${sayings.length} learned">${done}/${sayings.length}</span>
      </div>`;
    }).join("");

    return `
      ${Kit.crumb("#/old-testament", "The Old Testament")}
      <header class="masthead">
        <p class="eyebrow">An Old Testament game</p>
        <h1>Finish the Proverb</h1>
        <p class="lede">Read the first half of one of Solomon’s proverbs. Pick the ending he wrote.</p>
      </header>

      ${Kit.saveWarning()}
      <div class="play-buttons mode-groups">
      <section class="mode-group" aria-labelledby="quick-title">
        <h2 class="eyebrow" id="quick-title">Quick play</h2>
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 proverbs · bonus points for speed and streaks</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>
      <section class="mode-group is-learn" aria-labelledby="learn-title">
        <h2 class="eyebrow" id="learn-title">Learning</h2>
        <button type="button" class="btn btn-ghost mode-btn" data-action="read">
          <span class="mode-text"><span class="mode-name">Read the proverbs</span><span class="mode-desc">Every chapter the game uses, with the proverbs you’ve learned marked</span></span>${ICON.book}
        </button>
      </section>
      </div>

      <section aria-labelledby="progress-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="progress-title">Your progress</h2>
          <span class="note tabular">${learned(POOL)} of ${POOL.length} learned</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">A proverb is learned once you finish it right twice in a row. Chapters 10–22 are the proverbs of Solomon; chapters 25–29 are more of his proverbs, copied out by the men of King Hezekiah.</p>
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
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. The wrong endings are real endings from other proverbs. Progress is saved on this device only.</p>
      </section>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const s = byId[q.id];
    const done = q.picked !== null;

    const choices = q.endings.map((t, i) => {
      const removed = q.removed.includes(i);
      let cls = "choice choice-event";
      if (done) cls += t === s.second ? " is-right" : i === q.picked ? " is-wrong" : " is-faded";
      else if (removed) cls += " is-removed";
      return `<button type="button" class="${cls}" data-action="answer" data-i="${i}" ${done || removed ? "disabled" : ""}>
        <span class="key" aria-hidden="true">${i + 1}</span><span class="title">${esc(P.showEnding(t))}</span></button>`;
    }).join("");

    let actions;
    if (done) {
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${over(g) ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      actions = `
        ${timed() ? `<div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s" aria-hidden="true"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div>` : ""}
        <div class="actions"><button type="button" class="btn btn-small hint-btn" data-action="hint" ${q.hinted ? "disabled" : ""}>${q.hinted ? "50/50 used" : "50/50"}</button></div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${Kit.roundStatus(g, done, ROUND_LENGTH, LAMPS)}
        <span class="score tabular" aria-label="${g.mode === "round" ? "Score" : "Right answers"}">${fmt(g.score)}</span>
      </div>
      <article class="card${done ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top"><span class="kind">Finish the proverb</span></div>
        <p class="verse">${esc(P.showFirst(s))}</p>
        ${done ? revealHtml(s, q) : ""}
      </article>
      <div class="choices is-events" role="group" aria-label="Endings">${choices}</div>
      ${actions}`;
  }

  function revealHtml(s, q) {
    const ok = q.endings[q.picked] === s.second;
    const at = s.text.lastIndexOf(s.second);
    return `
      <div class="reveal">
        <p class="verdict ${ok ? "ok" : "miss"}" role="status">${ok ? `Right!${Kit.pointsNote(q.points)}` : "Not quite."}</p>
        <p class="ref">${refOf(s)}</p>
        <p class="pv-whole">${esc(s.text.slice(0, at))}<mark>${esc(s.text.slice(at))}</mark></p>
        <button type="button" class="link-btn" data-action="passage" data-id="${s.id}">${ICON.book} Read it in context</button>
      </div>`;
  }

  function resultsHtml() {
    const g = state.game;
    const right = g.history.filter((h) => h.ok).length;
    const total = g.history.length;
    const rank = E.rankFor(right, total, P.RANKS);
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${right} of ${total}</b> right · longest run <b>${g.bestRun}</b></p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${plural(g.score, "right answer")}</b> before your lamps went out · longest run <b>${g.bestRun}</b></p>`;
    const items = g.history.map((h) => {
      const s = byId[h.id];
      return `<button type="button" class="review-item" data-action="passage" data-id="${s.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Right" : "Wrong"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(s.text)}${h.ok ? "" : `<span class="sub">You said ${esc(P.showEnding(h.picked))}</span>`}</span>
        <span class="r">${s.ch}:${s.v}</span></button>`;
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
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any proverb to read it in context</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  // The chapters the game uses, each with how many of its proverbs are learned.
  function readHtml() {
    const secs = P.COLLECTIONS.map((c, i) => {
      const rows = CHAPTERS.filter((ch) => POOL.some((s) => s.ch === ch && s.collection === i)).map((ch) => {
        const sayings = POOL.filter((s) => s.ch === ch);
        const done = learned(sayings);
        const all = done === sayings.length;
        return `<button type="button" class="review-item" data-action="chapter" data-ch="${ch}">
          <span class="mark ${all ? "ok" : "none"}" aria-label="${all ? "All learned" : "Not all learned yet"}">${all ? "✓" : ""}</span>
          <span class="t">Proverbs ${ch}<span class="sub">${done} of ${sayings.length} learned</span></span></button>`;
      }).join("");
      return `<section class="sec">
        <div class="sec-head"><h2 class="sec-name">${esc(c.name)}</h2><span class="sec-range">Chapters ${c.from[0]}–${c.to[0]}</span></div>
        <div class="review">${rows}</div>
      </section>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>Read the proverbs</h1>
      </div>
      <p class="study-intro">The game’s proverbs come from these chapters. Open one to read it through; the proverbs you’ve learned are highlighted.</p>
      <div class="sections">${secs}</div>`;
  }

  function versesHtml(ch, from, to, marked) {
    const out = [];
    for (let v = from; v <= to; v++) out.push(`<span${marked(v) ? ' class="is-key"' : ""}><sup>${v}</sup>${esc(TEXT[ch][v - 1])}</span>`);
    return `<p class="passage">${out.join(" ")}</p>`;
  }

  function sheetHtml() {
    const chapter = /^ch-(\d+)$/.exec(state.sheet);
    if (chapter) {
      const ch = Number(chapter[1]);
      const mastered = new Set(POOL.filter((s) => s.ch === ch && E.isMastered(stats[s.id])).map((s) => s.v));
      return Kit.sheetHtml({
        eyebrow: "Read the proverbs",
        title: `Proverbs ${ch}`,
        intro: mastered.size ? `${plural(mastered.size, "proverb")} you’ve learned ${mastered.size === 1 ? "is" : "are"} highlighted.` : "",
        html: versesHtml(ch, 1, TEXT[ch].length, (v) => mastered.has(v)),
        attribution: "World English Bible (public domain).",
      });
    }
    const s = byId[state.sheet];
    const from = Math.max(1, s.v - CONTEXT);
    const to = Math.min(TEXT[s.ch].length, s.v + CONTEXT);
    return Kit.sheetHtml({
      eyebrow: "In context",
      title: refOf(s),
      html: `<h3 class="passage-ref">Proverbs ${s.ch}:${from}–${to}</h3>${versesHtml(s.ch, from, to, (v) => v === s.v)}`,
      attribution: "World English Bible (public domain).",
    });
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function goHome() { state.game = null; state.screen = "home"; render({ scrollTop: true }); }
  function openSheet(id) { state.sheet = id; render(); app.querySelector(".sheet .icon-btn")?.focus(); }
  function click(el) {
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "start": startGame(el.dataset.mode); window.scrollTo(0, 0); break;
      case "answer": answer(Number(el.dataset.i)); break;
      case "hint": useHint(); break;
      case "next": nextQuestion(); break;
      case "quit": goHome(); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "read": state.screen = "read"; render({ scrollTop: true }); break;
      case "passage": openSheet(el.dataset.id); break;
      case "chapter": openSheet(`ch-${el.dataset.ch}`); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; store.set("pv.settings", settings); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, run: 0 };
          store.remove("pv.stats"); store.remove("pv.bests");
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
    if (q.picked === null && /^[1-4]$/.test(ev.key)) { answer(Number(ev.key) - 1); ev.preventDefault(); }
    else if (q.picked === null && ev.key.toLowerCase() === "h") useHint();
    else if (ev.key === "Enter" && !onButton && q.picked !== null) { nextQuestion(); ev.preventDefault(); }
    else if (ev.key === "Escape") goHome();
  }

  window.Games = window.Games || {};
  window.Games.proverbs = {
    title: NAME,
    blurb: "Read the first half of one of Solomon’s proverbs. Pick the ending he wrote.",
    art: `<span class="art-halves"><i></i><i></i></span>`,
    summary() {
      const bits = [`${learned(POOL)} of ${POOL.length} proverbs learned`];
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
      if (state.game && state.game.q && !byId[state.game.q.id]) state.game = null;
      if (state.game && state.game.q) state.game.q.startedAt = Date.now();
      if (state.sheet && !byId[state.sheet] && !/^ch-\d+$/.test(state.sheet)) state.sheet = null;
      if (state.screen !== "home" && state.screen !== "read" && !state.game) state.screen = "home";
    },
  };
})();
