// Clusters — sixteen words from across the Bible; sort them into four
// groups of four. Screens, input and saved progress; the rules live in
// clusters-engine.js and the groups in js/data/clusters.js.
(function () {
  "use strict";

  const E = window.Engine;
  const C = window.ClustersEngine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const TEXT = window.CLUSTERS_TEXT || {};
  const NAME = "Clusters";

  const GROUPS = C.prepare(window.CLUSTERS);
  const byId = {};
  for (const g of GROUPS) byId[g.id] = g;

  const DEFAULT_PROGRESS = { played: 0, won: 0, perfect: 0, streak: 0, bestStreak: 0, found: {}, seen: {}, recent: [] };
  let progress = Object.assign({}, DEFAULT_PROGRESS, store.get("cl.progress", {}));
  let settings = Object.assign({ sound: true }, store.get("cl.settings", {}));
  // game: { puzzle, order, solved, picked, guesses, mistakes, over, won }
  let state = { screen: "home", game: validGame(store.get("cl.game", null)), sheet: null, resetArmed: false, msg: null, fx: null };
  let app = null; // the page element while this game is open
  let msgTimer = null;

  // ── Helpers ──
  const play = (kind) => Kit.sound(kind, settings.sound);
  const foundCount = (groups) => groups.filter((g) => progress.found[g.id]).length;
  const inPlay = () => state.game && !state.game.over;
  function saveGame() { store.set("cl.game", state.game); }
  function saveProgress() { store.set("cl.progress", progress); }
  // A saved puzzle whose groups have since been removed from the data is dropped.
  function validGame(g) {
    return g && g.puzzle && g.puzzle.groups.every((pg) => byId[pg.id]) ? g : null;
  }
  function puzzleGroup(id) { return state.game && state.game.puzzle.groups.find((g) => g.id === id); }
  function say(text) {
    state.msg = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { if (state.msg === text) { state.msg = null; if (state.screen === "play") render(); } }, 1800);
  }
  // Long words get a smaller size so every tile fits four across on a phone.
  function sizeClass(word) {
    const longest = Math.max(...word.split(/[\s-]/).map((w) => w.length));
    if (longest >= 11) return " is-xlong";
    if (longest >= 9 || word.length >= 14) return " is-long";
    return "";
  }

  // ── Game flow ──
  function newPuzzle() {
    if (inPlay()) record(false); // walking away from a puzzle ends the streak
    const puzzle = C.buildPuzzle(GROUPS, Math.random, progress);
    if (!puzzle) return;
    for (const g of puzzle.groups) progress.seen[g.id] = (progress.seen[g.id] || 0) + 1;
    progress.recent = progress.recent.concat(puzzle.groups.map((g) => g.id)).slice(-C.RECENT);
    saveProgress();
    state.game = { puzzle, order: puzzle.tiles.slice(), solved: [], picked: [], guesses: [], mistakes: 0, over: false, won: false };
    state.msg = null;
    state.fx = null;
    state.screen = "play";
    saveGame();
    render({ scrollTop: true });
  }

  function toggle(word) {
    const g = state.game;
    if (!g || g.over) return;
    if (g.picked.includes(word)) g.picked = g.picked.filter((w) => w !== word);
    else if (g.picked.length < 4) g.picked = g.picked.concat(word);
    state.fx = null;
    saveGame();
    render();
  }

  function submit() {
    const g = state.game;
    if (!g || g.over || g.picked.length !== 4) return;
    const key = C.guessKey(g.picked);
    if (g.guesses.some((guess) => C.guessKey(guess) === key)) { say("Already guessed"); state.fx = null; render(); return; }
    g.guesses.push(g.picked.slice());
    const res = C.check(g.puzzle, g.solved, g.picked);
    if (res.id) {
      g.solved.push(res.id);
      g.picked = [];
      progress.found[res.id] = true;
      saveProgress();
      state.fx = { solved: res.id };
      state.msg = null;
      play("right");
      if (g.solved.length === 4) return finish(true);
    } else {
      g.mistakes += 1;
      state.fx = { shake: true };
      play("wrong");
      if (g.mistakes >= C.MISTAKES) return finish(false);
      say(res.close ? "So close: three of those belong together" : "Not a group");
    }
    saveGame();
    render();
  }

  function record(won) {
    const g = state.game;
    progress.played += 1;
    if (won) {
      progress.won += 1;
      progress.streak += 1;
      progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
      if (g.mistakes === 0) progress.perfect += 1;
    } else {
      progress.streak = 0;
    }
    saveProgress();
  }

  function finish(won) {
    const g = state.game;
    g.over = true;
    g.won = won;
    g.picked = [];
    // The groups still hidden are shown in level order after the found ones.
    for (const pg of g.puzzle.groups) if (!g.solved.includes(pg.id)) g.solved.push(pg.id);
    record(won);
    state.msg = null;
    saveGame();
    render();
    if (won) { play("done"); if (g.mistakes === 0) Kit.confetti(); }
  }

  function shuffleTiles() {
    const g = state.game;
    if (!g || g.over) return;
    g.order = E.shuffle(g.order, Math.random);
    state.fx = null;
    saveGame();
    render();
  }

  // ── Screens ──
  function render(opts) {
    if (!app) return;
    opts = opts || {};
    const playing = state.screen === "play" && inPlay();
    app.className = "app" + (playing ? " is-play" : "");
    const html = { home: homeHtml, play: playHtml, collection: collectionHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    fitTiles();
    if (state.fx && state.fx.shake) app.querySelectorAll(".cl-tile[aria-pressed=\"true\"]").forEach((el) => el.classList.add("shake"));
    if (opts.scrollTop) window.scrollTo(0, 0);
  }

  // Shrinks a tile's text until its longest word fits on one line; a word too
  // long even at the smallest size may break.
  function fitTiles() {
    app.querySelectorAll(".cl-tile > span").forEach((s) => {
      s.style.fontSize = "";
      const room = s.clientWidth;
      if (s.scrollWidth <= room) return;
      const size = parseFloat(getComputedStyle(s).fontSize) * room / s.scrollWidth;
      s.style.fontSize = `${Math.max(9, Math.floor(size * 10) / 10)}px`;
      if (s.scrollWidth > s.clientWidth) s.classList.add("is-tight");
    });
  }

  function lampsHtml(left) {
    const lamps = Array.from({ length: C.MISTAKES }, (_, i) => ICON.lamp.replace("<svg", `<svg class="lamp${i >= left ? " is-out" : ""}"`)).join("");
    return `<div class="lamps" aria-label="${plural(left, "mistake")} left">${lamps}</div>`;
  }

  function homeHtml() {
    const g = state.game;
    const bits = [];
    if (progress.won) bits.push(`Solved <b class="tabular">${fmt(progress.won)}</b>`);
    if (progress.perfect) bits.push(`Perfect <b class="tabular">${fmt(progress.perfect)}</b>`);
    if (progress.streak) bits.push(`Streak <b class="tabular">${progress.streak}</b>`);
    if (progress.bestStreak) bits.push(`Best streak <b class="tabular">${progress.bestStreak}</b>`);
    const bars = C.LEVELS.map((lv) => {
      const groups = GROUPS.filter((g) => g.level === lv);
      const done = foundCount(groups);
      return `<div class="bar-row">
        <span class="bar-label"><span class="cl-swatch lv-${lv}" aria-hidden="true"></span>${C.LEVEL_NAMES[lv]}</span>
        <span class="bar cl-bar lv-${lv}" style="--p:${(done / groups.length).toFixed(3)}" aria-hidden="true"><i></i></span>
        <span class="bar-count tabular" aria-label="${done} of ${groups.length} found">${done}/${groups.length}</span>
      </div>`;
    }).join("");
    const resume = g && !g.over;
    const resumeDesc = resume ? `${g.solved.length} of 4 groups found · ${plural(C.MISTAKES - g.mistakes, "mistake")} left` : "";

    return `
      ${Kit.crumb("#/bible", "The Whole Bible")}
      <header class="masthead">
        <p class="eyebrow">A whole-Bible game</p>
        <h1>Clusters</h1>
        <p class="lede">Sixteen words from across the Bible. Group them into four clusters of four.</p>
      </header>

      ${Kit.saveWarning()}
      <section class="play-buttons" aria-label="Play">
        ${resume ? `<button type="button" class="btn btn-primary mode-btn" data-action="resume">
          <span class="mode-text"><span class="mode-name">Continue puzzle</span><span class="mode-desc">${resumeDesc}</span></span>${ICON.arrow}
        </button>` : ""}
        <button type="button" class="btn ${resume ? "" : "btn-primary "}mode-btn" data-action="new">
          <span class="mode-text"><span class="mode-name">New puzzle</span><span class="mode-desc">${resume ? "Starting over ends your streak" : "A fresh mix every time · four mistakes allowed"}</span></span>
          ${resume ? "" : ICON.arrow}
        </button>
        <button type="button" class="btn btn-ghost mode-btn" data-action="collection">
          <span class="mode-text"><span class="mode-name">Your groups</span><span class="mode-desc">Every group you’ve found, with the verses behind it</span></span>${ICON.book}
        </button>
        ${bits.length ? `<p class="bests">${bits.join("")}</p>` : ""}
      </section>

      <section aria-labelledby="found-title" style="display:grid;gap:10px">
        <div class="section-head">
          <h2 id="found-title">Groups found</h2>
          <span class="note tabular">${foundCount(GROUPS)} of ${GROUPS.length}</span>
        </div>
        <div class="bars">${bars}</div>
        <p class="option-help">Each puzzle has one group of each colour, from straightforward to tricky. New puzzles favour groups you haven’t seen.</p>
      </section>

      <section class="options" aria-labelledby="how-title">
        <div class="section-head"><h2 id="how-title">How to play</h2></div>
        <p class="study-intro">Tap four words that share something, then <b>Submit</b>. Find all four groups before your four lamps go out. Some words look as if they fit more than one group, but each has only one right place. Tap a found group to read the verses behind it.</p>
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

  function groupBarHtml(pg, g) {
    const grp = byId[pg.id];
    const missed = g.over && !g.won && !g.guesses.some((guess) => C.guessKey(guess) === C.guessKey(pg.words));
    const fx = state.fx && state.fx.solved === pg.id ? " pop" : "";
    return `<button type="button" class="cl-group lv-${pg.level}${fx}" data-action="group" data-id="${pg.id}" aria-label="${esc(`${grp.title}: ${pg.words.join(", ")}${missed ? " (not found)" : ""}. Read the verses.`)}">
      <span class="cl-group-title">${esc(grp.title)}</span>
      <span class="cl-group-words">${esc(pg.words.join(", "))}</span>
      ${missed ? `<span class="cl-group-tag">Not found</span>` : ""}
    </button>`;
  }

  function playHtml() {
    const g = state.game;
    if (!g) { state.screen = "home"; return homeHtml(); }
    const bars = g.solved.map((id) => groupBarHtml(puzzleGroup(id), g)).join("");
    const solvedWords = new Set(g.solved.flatMap((id) => puzzleGroup(id).words));
    const tiles = g.order.filter((w) => !solvedWords.has(w)).map((w) => {
      const on = g.picked.includes(w);
      return `<button type="button" class="cl-tile${sizeClass(w)}" data-action="tile" data-word="${esc(w)}" aria-pressed="${on}"><span lang="en">${esc(w)}</span></button>`;
    }).join("");
    const board = `<div class="cl-board" role="group" aria-label="Puzzle">${bars}${tiles}</div>`;

    if (g.over) return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>${g.won ? "Solved" : "Out of lamps"}</h1>
      </div>
      ${board}
      ${resultHtml(g)}`;

    const left = C.MISTAKES - g.mistakes;
    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Back to menu">${ICON.close}</button>
        ${lampsHtml(left)}
        <span class="cl-found tabular" aria-label="${g.solved.length} of 4 groups found">${g.solved.length}/4</span>
      </div>
      ${board}
      <p class="cl-msg" role="status" aria-live="polite">${state.msg ? esc(state.msg) : ""}</p>
      <div class="cl-actions">
        <button type="button" class="btn btn-small" data-action="shuffle">Shuffle</button>
        <button type="button" class="btn btn-small" data-action="deselect" ${g.picked.length ? "" : "disabled"}>Deselect</button>
        <button type="button" class="btn btn-small btn-primary" data-action="submit" ${g.picked.length === 4 ? "" : "disabled"}>Submit</button>
      </div>`;
  }

  function resultHtml(g) {
    const rank = C.rankFor(g.mistakes, g.won);
    const line = g.won
      ? `${g.mistakes ? plural(g.mistakes, "mistake") : "No mistakes"} · streak <b>${progress.streak}</b>`
      : `${g.solved.filter((id) => g.guesses.some((guess) => C.guessKey(guess) === C.guessKey(puzzleGroup(id).words))).length} of 4 groups found`;
    return `
      <section class="cl-result" aria-labelledby="rank-title">
        <h2 class="rank" id="rank-title">${esc(rank.title)}</h2>
        <p class="rank-note">${esc(rank.note)} (${esc(rank.ref.replace("-", "–"))})</p>
        <p class="result-line">${line}</p>
        <div class="button-row">
          <button type="button" class="btn btn-primary" data-action="new">Next puzzle</button>
          <button type="button" class="btn" data-action="home">Menu</button>
        </div>
        <p class="option-help">Tap a group to read the verses behind each word.</p>
      </section>`;
  }

  function collectionHtml() {
    const secs = C.LEVELS.map((lv) => {
      const groups = GROUPS.filter((g) => g.level === lv);
      const found = groups.filter((g) => progress.found[g.id]);
      const rows = found.map((g) => `<button type="button" class="review-item" data-action="group" data-id="${g.id}">
          <span class="cl-swatch lv-${lv}" aria-hidden="true"></span>
          <span class="t">${esc(g.title)}<span class="sub">${esc(g.items.map((it) => it[0]).join(", "))}</span></span></button>`).join("");
      const left = groups.length - found.length;
      return `<section class="sec">
        <div class="sec-head"><h2 class="sec-name"><span><span class="cl-swatch lv-${lv}" aria-hidden="true"></span> ${C.LEVEL_NAMES[lv]}</span></h2><span class="sec-range">${found.length} of ${groups.length} found</span></div>
        ${rows ? `<div class="review">${rows}</div>` : ""}
        ${left ? `<p class="option-help">${plural(left, "group")} still to find.</p>` : ""}
      </section>`;
    }).join("");
    return `
      <div class="page-head">
        <button type="button" class="icon-btn" data-action="home" aria-label="Back to menu">${ICON.back}</button>
        <h1>Your groups</h1>
      </div>
      <p class="study-intro">Every group you’ve found, by colour. Each lists all the words that can appear in it; tap one to read the verses.</p>
      <div class="sections">${secs}</div>`;
  }

  // A passage with the word's evidence highlighted.
  function passageHtml(word, ref, find) {
    const verses = TEXT[ref] || [];
    const first = Number(/:(\d+)/.exec(ref)[1]);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${esc(find || word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}])`, "iu");
    const body = verses.map((t, i) => `<span><sup>${first + i}</sup>${esc(E.cleanVerse(t)).replace(re, '<mark class="is-key">$1</mark>')}</span>`).join(" ");
    return `<h3 class="passage-ref">${esc(word)} · ${esc(ref.replace("-", "–"))}</h3><p class="passage">${body}</p>`;
  }

  function sheetHtml() {
    const grp = byId[state.sheet];
    const pg = puzzleGroup(grp.id);
    const shown = pg ? grp.items.filter((it) => pg.words.includes(it[0])) : grp.items;
    const rest = pg ? grp.items.filter((it) => !pg.words.includes(it[0])) : [];
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow"><span class="cl-swatch lv-${grp.level}" aria-hidden="true"></span> ${C.LEVEL_NAMES[grp.level]}</p><h2 class="ref" id="sheet-title">${esc(grp.title)}</h2></div>
          <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          <p class="sheet-intro">${esc(grp.note)}</p>
          ${shown.map((it) => passageHtml(...it)).join("")}
          ${rest.length ? `<p class="cl-also">Also in this group</p>${rest.map((it) => passageHtml(...it)).join("")}` : ""}
          <p class="attribution">World English Bible (public domain).</p>
        </div>
      </div>`;
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function goHome() { state.screen = "home"; state.msg = null; state.fx = null; render({ scrollTop: true }); }
  function click(el) {
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "new": newPuzzle(); break;
      case "resume": state.screen = "play"; state.fx = null; render({ scrollTop: true }); break;
      case "tile": toggle(el.dataset.word); break;
      case "submit": submit(); break;
      case "shuffle": shuffleTiles(); break;
      case "deselect": state.game.picked = []; state.fx = null; saveGame(); render(); break;
      case "quit": case "home": goHome(); break;
      case "collection": state.screen = "collection"; render({ scrollTop: true }); break;
      case "group": state.sheet = el.dataset.id; state.fx = null; render(); app.querySelector(".sheet .icon-btn")?.focus(); break;
      case "close-sheet": state.sheet = null; render(); break;
      case "toggle": settings[el.dataset.key] = !settings[el.dataset.key]; store.set("cl.settings", settings); render(); break;
      case "reset":
        if (!state.resetArmed) {
          state.resetArmed = true;
          render();
          setTimeout(() => { if (state.resetArmed) { state.resetArmed = false; if (state.screen === "home") render(); } }, 4000);
        } else {
          state.resetArmed = false;
          progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
          state.game = null;
          store.remove("cl.progress"); store.remove("cl.game");
          render();
        }
        break;
    }
  }

  function key(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (state.sheet) { if (ev.key === "Escape") { state.sheet = null; render(); } return; }
    if (state.screen !== "play" || !inPlay()) return;
    const onButton = ev.target instanceof HTMLButtonElement;
    if (ev.key === "Enter" && !onButton) { submit(); ev.preventDefault(); }
    else if (ev.key === "Escape") goHome();
  }

  // Turning the phone changes the tile width.
  window.addEventListener("resize", () => { if (app && state.screen === "play") fitTiles(); });

  window.Games = window.Games || {};
  window.Games.clusters = {
    title: NAME,
    blurb: "Sixteen words from across the Bible. Group them into four clusters of four.",
    art: `<span class="art-grid">${[1, 2, 3, 4].map((lv) => `<i class="lv-${lv}"></i>`).join("")}</span>`,
    summary() {
      const bits = [`${foundCount(GROUPS)} of ${GROUPS.length} groups found`];
      if (progress.won) bits.push(`${fmt(progress.won)} solved`);
      if (progress.streak > 1) bits.push(`streak ${progress.streak}`);
      return bits.join(" · ");
    },
    mount(root) { app = root; render({ scrollTop: true }); },
    // A puzzle in progress is saved, so leaving and coming back carries on.
    unmount() {
      app = null;
      Object.assign(state, { screen: "home", sheet: null, resetArmed: false, msg: null, fx: null });
    },
    click, key,
    // Keeps the open screen when the page is updated live.
    snapshot: () => JSON.parse(JSON.stringify(Object.assign({}, state, { fx: null, msg: null }))),
    restore(saved) {
      if (!saved || !saved.screen) return;
      state = Object.assign(state, saved, { game: validGame(saved.game) });
      if (state.sheet && !byId[state.sheet]) state.sheet = null;
      if (state.screen === "play" && !state.game) state.screen = "home";
    },
  };
})();
