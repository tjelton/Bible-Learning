// Chapter & Verse — screens, input and saved progress.
(function () {
  "use strict";

  const E = window.Engine;
  const GOSPELS = window.GOSPELS;
  const TEXT = window.BIBLE_TEXT;
  const ROUND_LENGTH = 10;
  const LAMPS = 3;
  const BOOKS = E.BOOK_ORDER;

  // ── Saved data (this device only) ──
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage unavailable */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (_) { /* storage unavailable */ } },
  };
  const DEFAULT_SETTINGS = { books: ["Matthew"], clues: "both", difficulty: "normal", timer: true, sound: true };
  let settings = Object.assign({}, DEFAULT_SETTINGS, store.get("cv.settings", {}));
  settings.books = (settings.books || []).filter((b) => GOSPELS[b]);
  if (!settings.books.length) settings.books = ["Matthew"];
  let stats = store.get("cv.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("cv.bests", {}));

  const byId = {};
  for (const e of E.eventPool(GOSPELS, BOOKS)) byId[e.id] = e;

  let state = { screen: "home", game: null, study: { book: "Matthew", ch: null, open: null }, sheet: null, resetArmed: false };
  const app = document.getElementById("app");

  // ── Helpers ──
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("en-US");
  const same = (a, b) => a.book === b.book && a.ch === b.ch;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/></svg>',
    lamp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.6 2.6 3.4 4.6 3.4 7.7a3.4 3.4 0 0 1-6.8 0c0-1.7.9-2.8 1.5-4 .6 1 .8 1.8.8 2.6 1-.9 1.4-3.6 1.1-6.3z"/><path d="M3 15.5h13.5c1.6 0 2.9-.7 3.9-1.8l.9.6c-.6 2.6-2.4 4.7-5.3 5.2H9.4C6 19.5 3.6 17.9 3 15.5z"/></svg>',
  };

  function gospel(book) { return GOSPELS[book]; }
  function chapterEvents(book, ch) { return gospel(book).events.filter((e) => e.ch === ch).map((e) => byId[e.id]); }
  function chapterProgress(book, ch) {
    const evs = chapterEvents(book, ch);
    const done = evs.filter((e) => E.isMastered(stats[e.id])).length;
    return { done, total: evs.length, p: evs.length ? done / evs.length : 0 };
  }
  function isTeachingChapter(book, ch) {
    const s = E.sectionFor(gospel(book), ch);
    return !!(s && s.discourse);
  }
  function saveSettings() { store.set("cv.settings", settings); }

  // ── Sound (tiny synthesized tones; starts only after a tap) ──
  let audio = null;
  function play(kind) {
    if (!settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const notes = {
        right: [[659.25, 0], [987.77, 0.09]],
        wrong: [[220, 0], [174.61, 0.12]],
        done: [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.3]],
      }[kind];
      const t0 = audio.currentTime;
      for (const [freq, at] of notes) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = kind === "wrong" ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(kind === "wrong" ? 0.12 : 0.09, t0 + at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.28);
        osc.connect(gain).connect(audio.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.3);
      }
    } catch (_) { /* no audio available */ }
  }

  // ── Confetti for a great round ──
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    document.body.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = innerWidth * dpr);
    const h = (canvas.height = innerHeight * dpr);
    const ctx = canvas.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const colors = ["--gold", "--accent", "--good", "--gold-soft"].map((v) => css.getPropertyValue(v).trim());
    const parts = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 16 - 6) * dpr,
      s: (4 + Math.random() * 5) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2200);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 2200) requestAnimationFrame(frame); else canvas.remove();
    })(start);
  }

  // ── Game flow ──
  function pool() { return E.eventPool(GOSPELS, settings.books); }

  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps"
      queue: mode === "round" ? E.pickEvents(pool(), stats, ROUND_LENGTH, Math.random).map((e) => e.id) : [],
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
    const id = g.mode === "round" ? g.queue[g.history.length] : E.pickEvents(pool(), stats, 1, Math.random, g.recent)[0].id;
    g.recent = g.recent.concat(id).slice(-60);
    const e = byId[id];
    const type = settings.clues === "both" ? (Math.random() < 0.5 ? "event" : "verse") : settings.clues;
    g.q = {
      id, type,
      choices: E.buildChoices(e, GOSPELS, settings.books, settings.difficulty, Math.random),
      removed: [], picked: null, hinted: false, points: null,
      startedAt: Date.now(),
    };
    render();
  }

  function timed() { return settings.timer && state.game && state.game.mode === "round"; }

  function answer(index) {
    const g = state.game;
    const q = g.q;
    if (!q || q.picked !== null || q.removed.includes(index)) return;
    const e = byId[q.id];
    const choice = q.choices[index];
    const ok = same(choice, e);
    q.picked = index;
    g.streak = ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: q.hinted, timed: timed() });
      g.score += q.points.total;
    } else {
      if (ok) g.score += 1; else g.lamps -= 1;
    }
    g.history.push({ id: q.id, ok, picked: choice, type: q.type });
    stats = E.recordAnswer(stats, q.id, ok);
    store.set("cv.stats", stats);
    play(ok ? "right" : "wrong");
    render({ animate: ok ? "pop" : "shake", index });
    if (ok && g.mode === "round") floatPoints(q.points.total);
  }

  function useHint() {
    const q = state.game && state.game.q;
    if (!q || q.hinted || q.picked !== null) return;
    q.hinted = true;
    q.removed = E.fiftyFifty(q.choices, byId[q.id], Math.random);
    render();
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    bests.run = Math.max(bests.run, g.bestRun);
    store.set("cv.bests", bests);
    state.screen = "results";
    render();
    const right = g.history.filter((h) => h.ok).length;
    if (g.newBest || (g.mode === "round" && right === ROUND_LENGTH)) { play("done"); confetti(); }
  }

  function floatPoints(n) {
    const el = document.createElement("div");
    el.className = "points";
    el.textContent = "+" + n;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ── Screens ──
  function render(opts) {
    opts = opts || {};
    app.className = "app" + (state.screen === "play" ? " is-play" : "");
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, study: studyHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.animate != null) {
      const btn = app.querySelector(`.choice[data-index="${opts.index}"]`);
      if (btn) btn.classList.add(opts.animate);
    }
    if (state.screen === "play" && state.game.q.picked !== null) {
      const reveal = app.querySelector(".reveal");
      const card = app.querySelector(".card");
      if (reveal && card && opts.animate != null) card.scrollTo({ top: reveal.offsetTop - 12, behavior: "smooth" });
      const next = app.querySelector('[data-action="next"]');
      if (next && opts.animate != null) next.focus({ preventScroll: true });
    }
    if (opts.scrollTop) window.scrollTo(0, 0);
  }

  function seg(name, current, options) {
    return `<div class="segmented" role="group">${options
      .map(([v, label]) => `<button type="button" data-action="set" data-key="${name}" data-value="${v}" aria-pressed="${current === v}">${label}</button>`)
      .join("")}</div>`;
  }

  function mapTiles(book, from, to) {
    let out = "";
    for (let c = from; c <= to; c++) {
      const pr = chapterProgress(book, c);
      const cls = ["tile", pr.p >= 1 ? "is-done" : "", isTeachingChapter(book, c) ? "is-teaching" : ""].join(" ");
      out += `<button type="button" class="${cls}" style="--p:${pr.p.toFixed(3)}" data-action="chapter" data-book="${book}" data-ch="${c}" aria-label="${book} ${c}: ${pr.done} of ${pr.total} mastered"><span class="fill"></span><span class="n">${c}</span></button>`;
    }
    return out;
  }

  function homeHtml() {
    const book = "Matthew";
    const g = gospel(book);
    const mastered = g.events.filter((e) => E.isMastered(stats[e.id])).length;
    const bookToggles = BOOKS.map((b) => {
      const available = !!GOSPELS[b];
      const on = settings.books.includes(b);
      return `<button type="button" class="book-toggle" data-action="book" data-book="${b}" aria-pressed="${on}" ${available ? "" : "disabled"}>
        <span class="name">${b}</span><span class="state">${available ? (on ? "On" : "Off") : "Coming soon"}</span></button>`;
    }).join("");
    const bestBits = [];
    if (bests.round) bestBits.push(`Best round <b class="tabular">${fmt(bests.round)}</b>`);
    if (bests.lamps) bestBits.push(`Best with three lamps <b class="tabular">${bests.lamps}</b>`);
    if (bests.run) bestBits.push(`Longest run <b class="tabular">${bests.run}</b>`);

    return `
      <header class="masthead">
        <p class="eyebrow">A Gospel game</p>
        <h1>Chapter <span class="amp">&amp;</span> Verse</h1>
        <p class="lede">Read a moment from the Gospel. Name the chapter it comes from.</p>
      </header>

      <section class="play-buttons" aria-label="Play">
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 questions · bonus points for speed and streaks</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        <button type="button" class="btn btn-ghost mode-btn" data-action="study">
          <span class="mode-text"><span class="mode-name">Study the chapters</span><span class="mode-desc">Browse every event and read the passages</span></span>${ICON.book}
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>

      <section aria-labelledby="map-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="map-title">Your map of ${book}</h2>
          <span class="note tabular">${mastered} of ${g.events.length} mastered</span>
        </div>
        <div class="map">${mapTiles(book, 1, g.chapters)}</div>
        <div class="map-legend">
          <span><i class="swatch"></i>Fills as you master events (right twice in a row)</span>
          <span><i class="dot"></i>One of Matthew's five teaching blocks</span>
        </div>
      </section>

      <section class="options" aria-labelledby="opt-title">
        <div class="section-head"><h2 id="opt-title">Options</h2></div>
        <div class="option">
          <span class="option-label">Gospels</span>
          <div class="books">${bookToggles}</div>
        </div>
        <div class="option">
          <span class="option-label">Clues</span>
          ${seg("clues", settings.clues, [["event", "Events"], ["verse", "Verses"], ["both", "Both"]])}
          <span class="option-help">Events describe what happens. Verses quote a line from the passage.</span>
        </div>
        <div class="option">
          <span class="option-label">Answer choices</span>
          ${seg("difficulty", settings.difficulty, [["easy", "Spread out"], ["normal", "Mixed"], ["hard", "Neighbours"]])}
          <span class="option-help">Neighbours puts the wrong answers in the chapters right next to the real one.</span>
        </div>
        <div class="switch-row">
          <span><span class="option-label">Speed bonus timer</span><br><span class="option-help">Up to +50 points for answering within 20 seconds</span></span>
          <button type="button" class="switch" role="switch" aria-checked="${settings.timer}" aria-label="Speed bonus timer" data-action="toggle" data-key="timer"></button>
        </div>
        <div class="switch-row">
          <span class="option-label">Sound</span>
          <button type="button" class="switch" role="switch" aria-checked="${settings.sound}" aria-label="Sound" data-action="toggle" data-key="sound"></button>
        </div>
        <button type="button" class="btn btn-small btn-ghost danger" data-action="reset">${state.resetArmed ? "Tap again to erase all progress" : "Reset progress"}</button>
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. Progress is saved on this device only. On iPhone, tap Share → Add to Home Screen to play it like an app.</p>
      </section>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const e = byId[q.id];
    const answered = q.picked !== null;
    const ok = answered && same(q.choices[q.picked], e);

    let status;
    if (g.mode === "round") {
      const pips = Array.from({ length: ROUND_LENGTH }, (_, i) => {
        const h = g.history[i];
        const cls = h ? (h.ok ? "is-right" : "is-wrong") : i === g.history.length ? "is-now" : "";
        return `<span class="pip ${cls}"></span>`;
      }).join("");
      status = `<div class="pips" aria-label="Question ${Math.min(g.history.length + (answered ? 0 : 1), ROUND_LENGTH)} of ${ROUND_LENGTH}">${pips}</div>`;
    } else {
      const lamps = Array.from({ length: LAMPS }, (_, i) => ICON.lamp.replace("<svg", `<svg class="lamp${i >= g.lamps ? " is-out" : ""}"`)).join("");
      status = `<div class="lamps" aria-label="${plural(g.lamps, "lamp")} left">${lamps}<span class="run">Run <b class="tabular">${g.streak}</b></span></div>`;
    }

    const clue = q.type === "verse"
      ? `<p class="verse">${esc(E.cleanVerse(E.verseText(TEXT, e, e.key)))}</p>`
      : `<h2 class="event-title">${esc(e.title)}</h2><p class="clue">${esc(e.clue)}</p>`;

    const choices = q.choices.map((c, i) => {
      let cls = "choice";
      if (q.removed.includes(i)) cls += " is-removed";
      if (answered) {
        if (same(c, e)) cls += " is-right";
        else if (i === q.picked) cls += " is-wrong";
        else cls += " is-faded";
      }
      const label = `${c.book} ${c.ch}`;
      return `<button type="button" class="${cls}" data-action="answer" data-index="${i}" ${answered || q.removed.includes(i) ? "disabled" : ""} aria-label="${label}">
        <span class="key" aria-hidden="true">${i + 1}</span><span class="book">${c.book}</span><span class="num">${c.ch}</span></button>`;
    }).join("");

    let actions;
    if (answered) {
      const last = (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${last ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      actions = `<div class="actions two">
        <button type="button" class="btn btn-small hint-btn" data-action="hint" ${q.hinted ? "disabled" : ""}>${q.hinted ? "50/50 used" : "50/50"}</button>
        ${timed() ? `<div style="align-self:center" aria-hidden="true"><div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div></div>` : "<span></span>"}
      </div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to home">${ICON.close}</button>
        ${status}
        <span class="score tabular" aria-label="Score">${fmt(g.score)}</span>
      </div>
      <article class="card${answered ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top">
          <span class="kind">${q.type === "verse" ? "Which chapter is this verse in?" : "Which chapter is this in?"}</span>
        </div>
        ${clue}
        ${answered ? revealHtml(e, ok, q) : ""}
      </article>
      <div class="choices">${choices}</div>
      ${actions}`;
  }

  function revealHtml(e, ok, q) {
    const g = gospel(e.book);
    const sec = E.sectionFor(g, e.ch);
    const range = sec ? (sec.from === sec.to ? `ch. ${sec.from}` : `ch. ${sec.from}–${sec.to}`) : "";
    const verdict = ok
      ? `Right!${q.points && q.points.total ? ` +${q.points.total}` : ""}${q.points && q.points.speed ? ` (speed +${q.points.speed}${q.points.streak ? `, streak +${q.points.streak}` : ""})` : q.points && q.points.streak ? ` (streak +${q.points.streak})` : ""}`
      : `Not quite. You picked ${q.choices[q.picked].book} ${q.choices[q.picked].ch}.`;
    const keyVerse = q.type === "event"
      ? `<p class="key-verse">${esc(E.cleanVerse(E.verseText(TEXT, e, e.key)))} <span style="font-style:normal">(${e.ch}:${e.key})</span></p>`
      : `<p class="ref-title">${esc(e.title)}</p>`;
    return `
      <div class="reveal">
        <p class="verdict ${ok ? "ok" : "miss"}" role="status">${verdict}</p>
        <p class="ref">${esc(E.formatRef(e))}</p>
        ${keyVerse}
        ${sec ? `<p class="meta">Part of <b>${esc(sec.name)}</b> (${range})${sec.discourse ? ", one of Matthew's five teaching blocks" : ""}.</p>` : ""}
        ${e.par && e.par.length ? `<p class="meta">Also told in ${e.par.map(esc).join(" · ")}</p>` : `<p class="meta">Only ${esc(e.book)} tells this.</p>`}
        <button type="button" class="link-btn" data-action="passage" data-id="${e.id}">${ICON.book} Read ${esc(E.formatRef(e))}</button>
      </div>`;
  }

  function resultsHtml() {
    const g = state.game;
    const right = g.history.filter((h) => h.ok).length;
    const total = g.history.length;
    const rank = E.rankFor(right, total);
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${right} of ${total}</b> right · longest run <b>${g.bestRun}</b></p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${plural(g.score, "right answer")}</b> before your lamps went out · longest run <b>${g.bestRun}</b></p>`;
    const items = g.history.map((h, i) => {
      const e = byId[h.id];
      const sub = h.ok ? (h.type === "verse" ? "Verse clue" : "Event clue") : `You said ${h.picked.book} ${h.picked.ch}`;
      return `<button type="button" class="review-item" data-action="passage" data-id="${e.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Right" : "Wrong"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(e.title)}<span class="sub">${esc(sub)}</span></span>
        <span class="r">${e.ch}:${e.v[0]}${e.v[1] !== e.v[0] ? "–" + e.v[1] : ""}</span></button>`;
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
        <button type="button" class="btn" data-action="home">Home</button>
      </div>
      <section style="display:grid;gap:8px" aria-labelledby="review-title">
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any event to read it</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  function studyHtml() {
    const s = state.study;
    const g = gospel(s.book);
    if (s.ch == null) {
      const secs = g.sections.map((sec) => `
        <div class="sec">
          <div class="sec-head">
            <span class="sec-name">${esc(sec.name)}${sec.discourse ? `<span class="tag">Teaching block</span>` : ""}</span>
            <span class="sec-range">${sec.from === sec.to ? `Chapter ${sec.from}` : `Chapters ${sec.from}–${sec.to}`}</span>
          </div>
          <div class="map">${mapTiles(s.book, sec.from, sec.to)}</div>
        </div>`).join("");
      return `
        <div class="page-head">
          <button type="button" class="icon-btn" data-action="home" aria-label="Back to home">${ICON.back}</button>
          <h1>Study ${esc(s.book)}</h1>
        </div>
        <p class="study-intro">Matthew is built around five long blocks of Jesus' teaching, each ending with words like “when Jesus had finished these sayings.” Learn those five (chapters 5–7, 10, 13, 18 and 24–25) and the stories fall into place between them.</p>
        <div class="sections">${secs}</div>`;
    }
    const sec = E.sectionFor(g, s.ch);
    const evs = chapterEvents(s.book, s.ch).map((e) => {
      const st = stats[e.id];
      const m = E.isMastered(st) ? `<span class="mastery done">Mastered</span>` : st && st.seen ? `<span class="mastery seen">${st.right}/${st.seen}</span>` : "";
      const open = s.open === e.id;
      return `<div class="ev">
        <button type="button" data-action="toggle-ev" data-id="${e.id}" aria-expanded="${open}">
          <span><span class="t">${esc(e.title)}</span><span class="r">${esc(E.formatRef(e))}</span></span>${m}
        </button>
        ${open ? `<div class="ev-body">
          <p class="clue">${esc(e.clue)}</p>
          ${e.par && e.par.length ? `<p class="meta">Also told in ${e.par.map(esc).join(" · ")}</p>` : `<p class="meta">Only ${esc(e.book)} tells this.</p>`}
          <button type="button" class="link-btn" data-action="passage" data-id="${e.id}">${ICON.book} Read the passage</button>
        </div>` : ""}
      </div>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="study-back" aria-label="Back to all chapters">${ICON.back}</button>
        <p class="eyebrow">${esc(sec ? sec.name : "")}</p>
      </div>
      <header class="chapter-head">
        <h1 class="big">${esc(s.book)} ${s.ch}</h1>
        <p class="meta">${plural(chapterEvents(s.book, s.ch).length, "event")} · ${chapterProgress(s.book, s.ch).done} mastered${sec && sec.discourse ? " · part of a teaching block" : ""}</p>
      </header>
      <div class="events">${evs}</div>
      <div class="chapter-nav">
        <button type="button" class="btn btn-small" data-action="chapter" data-book="${s.book}" data-ch="${s.ch - 1}" ${s.ch <= 1 ? "disabled" : ""}>${ICON.back.replace('aria-hidden="true"', 'aria-hidden="true" width="18" height="18"')} Chapter ${Math.max(1, s.ch - 1)}</button>
        <button type="button" class="btn btn-small" data-action="chapter" data-book="${s.book}" data-ch="${s.ch + 1}" ${s.ch >= g.chapters ? "disabled" : ""}>Chapter ${Math.min(g.chapters, s.ch + 1)} ${ICON.arrow.replace('aria-hidden="true"', 'aria-hidden="true" width="18" height="18"')}</button>
      </div>`;
  }

  function sheetHtml() {
    const e = byId[state.sheet];
    const verses = E.passage(TEXT, e)
      .map((v) => `<span${v.n === e.key ? ' class="is-key"' : ""}><sup>${v.n}</sup>${esc(v.text)}</span>`)
      .join(" ");
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow">${esc(e.title)}</p><h2 class="ref" id="sheet-title">${esc(E.formatRef(e))}</h2></div>
          <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          <p class="passage">${verses}</p>
          <p class="attribution">World English Bible (public domain). The highlighted verse is the one used for verse clues.</p>
        </div>
      </div>`;
  }

  // ── Input ──
  app.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "start": startGame(el.dataset.mode); window.scrollTo(0, 0); break;
      case "answer": answer(Number(el.dataset.index)); break;
      case "hint": useHint(); break;
      case "next": nextQuestion(); break;
      case "quit": state.game = null; state.screen = "home"; render({ scrollTop: true }); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "study": state.screen = "study"; state.study.ch = null; render({ scrollTop: true }); break;
      case "study-back": state.study.ch = null; render({ scrollTop: true }); break;
      case "chapter":
        state.screen = "study";
        state.study = { book: el.dataset.book, ch: Number(el.dataset.ch), open: null };
        render({ scrollTop: true });
        break;
      case "toggle-ev": state.study.open = state.study.open === el.dataset.id ? null : el.dataset.id; render(); break;
      case "passage": state.sheet = el.dataset.id; render(); app.querySelector(".sheet .icon-btn")?.focus(); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "set": settings[el.dataset.key] = el.dataset.value; saveSettings(); render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; saveSettings(); render(); break;
      case "book": {
        const b = el.dataset.book;
        const on = settings.books.includes(b);
        if (on && settings.books.length === 1) return; // keep at least one Gospel on
        settings.books = on ? settings.books.filter((x) => x !== b) : settings.books.concat(b);
        saveSettings(); render();
        break;
      }
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, run: 0 };
          store.remove("cv.stats"); store.remove("cv.bests");
          render();
        }
        break;
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (state.sheet) { if (ev.key === "Escape") { state.sheet = null; render(); } return; }
    if (state.screen !== "play") return;
    const q = state.game.q;
    if (q.picked === null && /^[1-4]$/.test(ev.key)) { answer(Number(ev.key) - 1); ev.preventDefault(); }
    else if (q.picked === null && ev.key.toLowerCase() === "h") useHint();
    else if (q.picked !== null && ev.key === "Enter" && !(ev.target instanceof HTMLButtonElement && ev.target.dataset.action !== "next")) { nextQuestion(); ev.preventDefault(); }
    else if (ev.key === "Escape") { state.game = null; state.screen = "home"; render(); }
  });

  // ── Start (keeps an in-progress game when the page is updated live) ──
  function boot(data) {
    if (data && data.state && data.state.screen) {
      state = Object.assign(state, data.state);
      if (state.game && state.game.q) state.game.q.startedAt = Date.now();
      if (state.screen !== "home" && state.screen !== "study" && !state.game) state.screen = "home";
    }
    render();
  }
  const hot = window.claude && window.claude.hot;
  try {
    if (hot && typeof hot.snapshot === "function") hot.snapshot(() => ({ state: JSON.parse(JSON.stringify(state)) }));
  } catch (_) { /* live updates not available */ }
  if (hot && typeof hot.ready === "function") hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
