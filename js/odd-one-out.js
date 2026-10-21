// Odd One Out — four words from across the Bible, three of which share a
// Clusters group; tap the one that doesn't belong. Screens, input and saved
// progress; the rules live in odd-one-out-engine.js and the groups in
// js/data/clusters.js.
(function () {
  "use strict";

  const E = window.Engine;
  const C = window.ClustersEngine;
  const O = window.OddOneOutEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.CLUSTERS_TEXT || {};
  const NAME = "Odd One Out";
  const ROUND_LENGTH = O.ROUND_LEVELS.length;
  const LAMPS = 3;

  const GROUPS = C.prepare(window.CLUSTERS);
  const byId = {};
  for (const g of GROUPS) byId[g.id] = g;

  let settings = Object.assign({ timer: true, sound: true }, store.get("oo.settings", {}));
  let stats = store.get("oo.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("oo.bests", {}));

  // sheet: { id, first: [word] }, a group with the words to show first
  let state = { screen: "home", game: null, sheet: null, resetArmed: false };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const learned = (groups) => groups.filter((g) => E.isMastered(stats[g.id])).length;
  const timed = () => settings.timer && state.game && state.game.mode === "round";
  const over = (g) => (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);
  const swatch = (level) => `<span class="cl-swatch lv-${level}" aria-hidden="true"></span>`;
  // Long words get a smaller size so two fit across a phone.
  function sizeClass(word) {
    const longest = Math.max(...word.split(/[\s-]/).map((w) => w.length));
    if (longest >= 12 || word.length >= 20) return " is-xlong";
    if (longest >= 9 || word.length >= 14) return " is-long";
    return "";
  }

  // ── Game flow ──
  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps"
      queue: mode === "round" ? O.roundGroups(GROUPS, stats, Math.random).map((g) => g.id) : [],
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
    const grp = g.mode === "round" ? byId[g.queue[g.history.length]] : O.lampGroup(GROUPS, stats, g.streak, Math.random, g.recent);
    g.recent = g.recent.concat(grp.id).slice(-30);
    const set = O.question(GROUPS, grp, Math.random);
    g.q = Object.assign(set, { hinted: false, picked: null, points: null, startedAt: Date.now() });
    render();
  }

  function answer(i) {
    const g = state.game;
    const q = g.q;
    if (q.picked !== null || !q.words[i]) return;
    q.picked = q.words[i];
    const ok = q.picked === q.odd;
    g.streak = ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: q.hinted, timed: timed() });
      g.score += q.points.total;
    } else if (ok) g.score += 1;
    else g.lamps -= 1;
    g.history.push({ id: q.id, ok, three: q.three, odd: q.odd, oddId: q.oddId, picked: q.picked });
    stats = E.recordAnswer(stats, q.id, ok);
    store.set("oo.stats", stats);
    play(ok ? "right" : "wrong");
    render({ checked: true });
    if (ok && g.mode === "round") Kit.floatPoints(q.points.total);
  }

  // The clue names what the three share, for half the points.
  function useHint() {
    const q = state.game && state.game.q;
    if (!q || q.hinted || q.picked !== null) return;
    q.hinted = true;
    render();
  }

  function finishGame() {
    const g = state.game;
    // Beating an earlier score counts as a new best; the very first game doesn't.
    const field = g.mode === "round" ? "round" : "lamps";
    if (g.score > bests[field]) { g.newBest = bests[field] > 0; bests[field] = g.score; }
    bests.run = Math.max(bests.run, g.bestRun);
    store.set("oo.bests", bests);
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
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, groups: groupsHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.checked) {
      const q = state.game.q;
      app.querySelectorAll(`.choice.is-${q.picked === q.odd ? "right" : "wrong"}`).forEach((el) => el.classList.add(q.picked === q.odd ? "pop" : "shake"));
      app.querySelector('[data-action="next"]')?.focus({ preventScroll: true });
    }
    if (opts.scrollTop) window.scrollTo(0, 0);
  }

  function homeHtml() {
    const bestBits = [];
    if (bests.round) bestBits.push(`Best round <b class="tabular">${fmt(bests.round)}</b>`);
    if (bests.lamps) bestBits.push(`Best with three lamps <b class="tabular">${bests.lamps}</b>`);
    if (bests.run) bestBits.push(`Longest run <b class="tabular">${bests.run}</b>`);
    const bars = C.LEVELS.map((lv) => {
      const groups = GROUPS.filter((g) => g.level === lv);
      const done = learned(groups);
      return `<div class="bar-row">
        <span class="bar-label">${swatch(lv)}${C.LEVEL_NAMES[lv]}</span>
        <span class="bar cl-bar lv-${lv}" style="--p:${(done / groups.length).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${groups.length} learned">${done}/${groups.length}</span>
      </div>`;
    }).join("");

    return `
      ${Kit.crumb("#/bible", "The Whole Bible")}
      <header class="masthead">
        <p class="eyebrow">A whole-Bible game</p>
        <h1>Odd One Out</h1>
        <p class="lede">Four words from across the Bible. Three belong together: tap the one that doesn’t.</p>
      </header>

      ${Kit.saveWarning()}
      <div class="play-buttons mode-groups">
      <section class="mode-group" aria-labelledby="quick-title">
        <h2 class="eyebrow" id="quick-title">Quick play</h2>
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 sets, straightforward to tricky · bonus points for speed and streaks</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out. The sets get trickier as your run grows.</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        ${bestBits.length ? `<p class="bests">${bestBits.join("")}</p>` : ""}
      </section>
      <section class="mode-group is-learn" aria-labelledby="learn-title">
        <h2 class="eyebrow" id="learn-title">Learning</h2>
        <button type="button" class="btn btn-ghost mode-btn" data-action="groups">
          <span class="mode-text"><span class="mode-name">The groups</span><span class="mode-desc">Every group the sets come from, with the verse behind each word</span></span>${ICON.book}
        </button>
      </section>
      </div>

      <section aria-labelledby="progress-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="progress-title">Your progress</h2>
          <span class="note tabular">${learned(GROUPS)} of ${GROUPS.length} learned</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">A group is learned once you spot the odd one out of it twice in a row. The groups are the same as in Clusters, from straightforward to tricky.</p>
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
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. The odd word always comes from a different group, and no other three of the four share a group, so every set has one right answer. Progress is saved on this device only.</p>
      </section>`;
  }

  function playHtml() {
    const g = state.game;
    const q = g.q;
    const grp = byId[q.id];
    const done = q.picked !== null;

    const tiles = q.words.map((w, i) => {
      let cls = `choice oo-tile${sizeClass(w)}`;
      if (done) cls += w === q.odd ? " is-right" : w === q.picked ? " is-wrong" : ` is-three lv-${grp.level}`;
      const action = done ? `data-action="word" data-word="${esc(w)}"` : `data-action="answer" data-i="${i}"`;
      const label = done ? ` aria-label="${esc(`${w}: read the verse`)}"` : "";
      return `<button type="button" class="${cls}" ${action}${label}>
        <span class="key" aria-hidden="true">${i + 1}</span><span class="oo-word">${esc(w)}</span></button>`;
    }).join("");

    let actions;
    if (done) {
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${over(g) ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    } else {
      actions = `
        ${timed() ? `<div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s" aria-hidden="true"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div>` : ""}
        <div class="actions"><button type="button" class="btn btn-small hint-btn" data-action="hint" ${q.hinted ? "disabled" : ""}>${q.hinted ? "Clue used" : "Clue: what do three share?"}</button></div>`;
    }

    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${Kit.roundStatus(g, done, ROUND_LENGTH, LAMPS)}
        <span class="score tabular" aria-label="${g.mode === "round" ? "Score" : "Right answers"}">${fmt(g.score)}</span>
      </div>
      <article class="card${done ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top"><span class="kind">Odd one out</span><span class="oo-level">${swatch(grp.level)}${C.LEVEL_NAMES[grp.level]}</span></div>
        ${done ? revealHtml(q, grp) : `<p class="oo-ask">Which one doesn’t belong?</p>
        ${q.hinted ? `<p class="oo-clue">Three of them: <b>${esc(grp.title)}</b></p>` : ""}`}
      </article>
      <div class="choices oo-choices" role="group" aria-label="Words">${tiles}</div>
      ${actions}`;
  }

  function revealHtml(q, grp) {
    const ok = q.picked === q.odd;
    const home = byId[q.oddId];
    return `
      <div class="reveal oo-reveal">
        <p class="verdict ${ok ? "ok" : "miss"}" role="status">${ok ? `Right!${Kit.pointsNote(q.points)}` : `Not quite: the odd one out was ${esc(q.odd)}.`}</p>
        <button type="button" class="cl-group oo-group lv-${grp.level}" data-action="group" data-id="${grp.id}" aria-label="${esc(`${grp.title}: ${q.three.join(", ")}. Read the verses.`)}">
          <span class="cl-group-title">${esc(grp.title)}</span>
          <span class="cl-group-words">${esc(q.three.join(", "))}</span>
        </button>
        <p class="oo-note">${esc(grp.note)}</p>
        <button type="button" class="oo-home lv-${home.level}" data-action="group" data-id="${home.id}" data-word="${esc(q.odd)}"><span><b>${esc(q.odd)}</b> belongs with <b>${esc(home.title)}</b></span></button>
        <p class="option-help">Tap a word or a group to read the verses.</p>
      </div>`;
  }

  function resultsHtml() {
    const g = state.game;
    const right = g.history.filter((h) => h.ok).length;
    const total = g.history.length;
    const rank = E.rankFor(right, total, O.RANKS);
    const headline = g.mode === "round"
      ? `<p class="big-score tabular">${fmt(g.score)}</p><p class="result-line"><b>${right} of ${total}</b> right · longest run <b>${g.bestRun}</b></p>`
      : `<p class="big-score tabular">${g.score}</p><p class="result-line"><b>${plural(g.score, "right answer")}</b> before your lamps went out · longest run <b>${g.bestRun}</b></p>`;
    const items = g.history.map((h) => {
      const grp = byId[h.id];
      return `<button type="button" class="review-item" data-action="group" data-id="${grp.id}">
        <span class="mark ${h.ok ? "ok" : "miss"}" aria-label="${h.ok ? "Right" : "Wrong"}">${h.ok ? "✓" : "✕"}</span>
        <span class="t">${esc(grp.title)}<span class="sub">${esc(h.three.join(", "))} · odd one out ${esc(h.odd)}${h.ok ? "" : ` (you said ${esc(h.picked)})`}</span></span>
        ${swatch(grp.level)}</button>`;
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
        <div class="section-head"><h2 id="review-title">Review</h2><span class="note">Tap any set to read its verses</span></div>
        <div class="review">${items}</div>
      </section>`;
  }

  // Every group by level, the learned ones marked.
  function groupsHtml() {
    const secs = C.LEVELS.map((lv) => {
      const groups = GROUPS.filter((g) => g.level === lv);
      const rows = groups.map((g) => {
        const done = E.isMastered(stats[g.id]);
        return `<button type="button" class="review-item" data-action="group" data-id="${g.id}">
          <span class="mark ${done ? "ok" : "none"}" aria-label="${done ? "Learned" : "Not learned yet"}">${done ? "✓" : ""}</span>
          <span class="t">${esc(g.title)}<span class="sub">${esc(g.items.map((it) => it[0]).join(", "))}</span></span></button>`;
      }).join("");
      return `<section class="sec">
        <div class="sec-head"><h2 class="sec-name"><span>${swatch(lv)} ${C.LEVEL_NAMES[lv]}</span></h2><span class="sec-range">${learned(groups)} of ${groups.length} learned</span></div>
        <div class="review">${rows}</div>
      </section>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>The groups</h1>
      </div>
      <p class="study-intro">Every group the sets come from, by level, with every word that can appear in it. The ones you’ve learned are ticked; tap a group to read the verses.</p>
      <div class="sections">${secs}</div>`;
  }

  // A passage with the word's evidence highlighted.
  function passageHtml(word, ref, find) {
    const verses = (TEXT[ref] || []).map(E.cleanVerse);
    return Kit.markedPassageHtml(`${word} · ${ref.replace("-", "–")}`, Number(/:(\d+)/.exec(ref)[1]), verses, find || word);
  }

  function sheetHtml() {
    const grp = byId[state.sheet.id];
    const first = state.sheet.first || [];
    const shown = grp.items.filter((it) => first.includes(it[0]));
    const rest = grp.items.filter((it) => !first.includes(it[0]));
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow">${swatch(grp.level)} ${C.LEVEL_NAMES[grp.level]}</p><h2 class="ref" id="sheet-title">${esc(grp.title)}</h2></div>
          <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          <p class="sheet-intro">${esc(grp.note)}</p>
          ${shown.map((it) => passageHtml(...it)).join("")}
          ${rest.length ? `${shown.length ? `<p class="cl-also">Also in this group</p>` : ""}${rest.map((it) => passageHtml(...it)).join("")}` : ""}
          <p class="attribution">World English Bible (public domain).</p>
        </div>
      </div>`;
  }

  // A word from the set on screen opens its own group, with it first; the three
  // open their group with all three first.
  function openGroup(id, word) {
    const q = state.game && state.screen === "play" && state.game.q;
    let first = word ? [word] : [];
    if (q && id === q.id) first = q.three;
    else if (!word && state.screen === "results") first = (state.game.history.find((h) => h.id === id) || {}).three || [];
    state.sheet = { id, first };
    render();
    app.querySelector(".sheet .icon-btn")?.focus();
  }

  function openWord(word) {
    const q = state.game.q;
    openGroup(word === q.odd ? q.oddId : q.id, word === q.odd ? word : null);
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function goHome() { state.game = null; state.screen = "home"; render({ scrollTop: true }); }
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
      case "groups": state.screen = "groups"; render({ scrollTop: true }); break;
      case "group": openGroup(el.dataset.id, el.dataset.word || null); break;
      case "word": openWord(el.dataset.word); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; store.set("oo.settings", settings); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          stats = {}; bests = { round: 0, lamps: 0, run: 0 };
          store.remove("oo.stats"); store.remove("oo.bests");
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
  window.Games["odd-one-out"] = {
    title: NAME,
    blurb: "Four words from across the Bible. Three belong together: tap the one that doesn’t.",
    art: `<span class="art-grid art-odd"><i></i><i></i><i></i><i class="is-odd"></i></span>`,
    summary() {
      const bits = [`${learned(GROUPS)} of ${GROUPS.length} groups learned`];
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
      const q = state.game && state.game.q;
      if (q && !(byId[q.id] && byId[q.oddId])) state.game = null;
      if (state.game && state.game.q) state.game.q.startedAt = Date.now();
      if (state.sheet && !byId[state.sheet.id]) state.sheet = null;
      if (state.screen !== "home" && state.screen !== "groups" && !state.game) state.screen = "home";
    },
  };
})();
