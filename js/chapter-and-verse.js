// Chapter & Verse — read a moment from the Gospels and name the chapter it comes
// from. Screens, input and saved progress; the rules live in engine.js.
(function () {
  "use strict";

  const E = window.Engine;
  const Kit = window.Kit;
  const { store, esc, fmt, plural, ICON } = Kit;
  const GOSPELS = window.GOSPELS;
  const TEXT = window.BIBLE_TEXT;
  const ROUND_LENGTH = 10;
  const LAMPS = 3;
  const BOOKS = E.BOOK_ORDER;
  const BOOK_ABBR = { Matthew: "Mt", Mark: "Mk", Luke: "Lk", John: "Jn" };

  const DEFAULT_SETTINGS = { books: ["Matthew"], clues: "both", difficulty: "normal", timer: true, sound: true };
  let settings = Object.assign({}, DEFAULT_SETTINGS, store.get("cv.settings", {}));
  settings.books = (settings.books || []).filter((b) => GOSPELS[b]);
  if (!settings.books.length) settings.books = ["Matthew"];
  let stats = store.get("cv.stats", {});
  let bests = Object.assign({ round: 0, lamps: 0, run: 0 }, store.get("cv.bests", {}));
  // Training: the chapters brought in so far, in the order they were added.
  let training = Object.assign({ chapters: [] }, store.get("cv.training", {}));

  const byId = {};
  for (const e of E.eventPool(GOSPELS, BOOKS)) byId[e.id] = e;

  let state = {
    screen: "home", game: null, sheet: null, resetArmed: false,
    mapBook: settings.books[0],
    study: { book: settings.books[0], ch: null, open: null },
  };
  let app = null; // the page element while this game is open

  // ── Helpers ──
  const same = (a, b) => a.book === b.book && a.ch === b.ch;

  function gospel(book) { return GOSPELS[book]; }
  function chapterEvents(book, ch) { return gospel(book).events.filter((e) => e.ch === ch).map((e) => byId[e.id]); }
  function chapterProgress(book, ch) {
    const evs = chapterEvents(book, ch);
    const done = evs.filter((e) => E.isMastered(stats[e.id])).length;
    return { done, total: evs.length, p: evs.length ? done / evs.length : 0 };
  }
  // Chapters in a section the book's outline highlights (Matthew's teaching
  // blocks, Luke's journey to Jerusalem, John's farewell discourse).
  function isMarkedChapter(book, ch) {
    const s = E.sectionFor(gospel(book), ch);
    return !!(s && s.mark);
  }
  function saveSettings() { store.set("cv.settings", settings); }
  const shortRef = (k) => { const i = k.lastIndexOf(" "); return `${BOOK_ABBR[k.slice(0, i)]} ${k.slice(i + 1)}`; };
  function trainingStatus() { return E.trainingStatus(GOSPELS, settings.books, training.chapters, stats); }

  const play = (kind) => Kit.sound(kind, settings.sound);

  // ── Game flow ──
  function pool() { return E.eventPool(GOSPELS, settings.books); }

  function startGame(mode) {
    state.game = {
      mode, // "round" | "lamps" | "train"
      queue: mode === "round" ? E.pickEvents(pool(), stats, ROUND_LENGTH, Math.random).map((e) => e.id) : [],
      history: [],
      recent: [],
      score: 0,
      streak: 0,
      bestRun: 0,
      lamps: LAMPS,
      q: null,
      newBest: false,
      intro: [], // training: chapters to introduce before the next question
      firstIntro: false,
    };
    if (mode === "train") {
      state.game.firstIntro = !training.chapters.length;
      state.game.intro = topUpTraining();
    }
    state.screen = "play";
    nextQuestion();
  }

  // Brings new chapters into training. Returns the ones to introduce (chapters
  // already learned in other modes join without an introduction).
  function topUpTraining() {
    const r = E.trainingTopUp(GOSPELS, settings.books, training.chapters, stats);
    if (!r.added.length) return [];
    training = { chapters: r.introduced };
    store.set("cv.training", training);
    return r.added.filter((k) => !E.chapterLearned(GOSPELS, k, stats));
  }

  function nextQuestion() {
    const g = state.game;
    if ((g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0)) {
      return finishGame();
    }
    if (g.mode === "train") return nextTrainingQuestion();
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

  // Training mixes question styles: "chapter" gives the chapter and asks what
  // happens there; "event" and "verse" ask for the chapter.
  function nextTrainingQuestion() {
    const g = state.game;
    g.q = null;
    if (g.intro.length) return render(); // show the new chapters first
    const pick = E.pickTrainingEvent(GOSPELS, settings.books, training.chapters, stats, Math.random, g.recent.slice(-3));
    if (!pick) { state.game = null; state.screen = "home"; return render(); }
    const e = byId[pick.id];
    g.recent = g.recent.concat(e.id).slice(-60);
    const type = E.trainingKind(stats[e.id], Math.random);
    g.q = {
      id: e.id, type,
      choices: type === "chapter"
        ? E.trainingEventChoices(e, GOSPELS, settings.books, training.chapters, Math.random)
        : E.trainingChapterChoices(e, GOSPELS, settings.books, training.chapters, Math.random),
      removed: [], picked: null, hinted: false, points: null,
      startedAt: Date.now(),
    };
    render();
  }

  function beginTraining() {
    const g = state.game;
    if (!g || g.mode !== "train" || g.q) return;
    g.intro = [];
    g.firstIntro = false;
    nextQuestion();
  }

  // Whether a choice is the right answer: a chapter, or (for "chapter"
  // questions) the event itself.
  function isRight(q, c) { return q.type === "chapter" ? c.id === q.id : same(c, byId[q.id]); }

  function timed() { return settings.timer && state.game && state.game.mode === "round"; }

  // index -1 means "show me" in training: the answer is revealed and counts as a miss.
  function answer(index) {
    const g = state.game;
    const q = g.q;
    if (!q || q.picked !== null || q.removed.includes(index) || index >= q.choices.length) return;
    const e = byId[q.id];
    const choice = index >= 0 ? q.choices[index] : null;
    const ok = !!choice && isRight(q, choice);
    const chapter = `${e.book} ${e.ch}`;
    const wasLearned = E.chapterLearned(GOSPELS, chapter, stats);
    q.picked = index;
    g.streak = ok ? g.streak + 1 : 0;
    g.bestRun = Math.max(g.bestRun, g.streak);
    if (g.mode === "round") {
      q.points = E.scoreAnswer({ correct: ok, ms: Date.now() - q.startedAt, streak: g.streak, hinted: q.hinted, timed: timed() });
      g.score += q.points.total;
    } else if (g.mode === "train") {
      if (ok) g.score += 1;
    } else {
      if (ok) g.score += 1; else g.lamps -= 1;
    }
    g.history.push({ id: q.id, ok, picked: choice, type: q.type });
    stats = E.recordAnswer(stats, q.id, ok);
    store.set("cv.stats", stats);
    if (g.mode === "train") {
      q.learned = !wasLearned && E.chapterLearned(GOSPELS, chapter, stats) ? chapter : null;
      g.intro = g.intro.concat(topUpTraining());
    }
    play(q.learned ? "done" : ok ? "right" : "wrong");
    render({ animate: ok ? "pop" : "shake", index });
    if (ok && g.mode === "round") Kit.floatPoints(q.points.total);
    if (q.learned) Kit.confetti();
  }

  function useHint() {
    const q = state.game && state.game.q;
    if (!q || q.hinted || q.picked !== null || state.game.mode === "train") return;
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
    if (g.newBest || (g.mode === "round" && right === ROUND_LENGTH)) { play("done"); Kit.confetti(); }
  }

  // ── Screens ──
  function render(opts) {
    if (!app) return;
    opts = opts || {};
    app.className = "app" + (state.screen === "play" ? " is-play" : "");
    const html = { home: homeHtml, play: playHtml, results: resultsHtml, study: studyHtml }[state.screen]();
    app.innerHTML = html + (state.sheet ? sheetHtml() : "");
    document.body.style.overflow = state.sheet ? "hidden" : "";
    if (opts.animate != null) {
      const btn = app.querySelector(`.choice[data-index="${opts.index}"]`);
      if (btn) btn.classList.add(opts.animate);
    }
    if (state.screen === "play" && state.game.q && state.game.q.picked !== null) {
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
      const cls = ["tile", pr.p >= 1 ? "is-done" : "", isMarkedChapter(book, c) ? "is-marked" : ""].join(" ");
      out += `<button type="button" class="${cls}" style="--p:${pr.p.toFixed(3)}" data-action="chapter" data-book="${book}" data-ch="${c}" aria-label="${book} ${c}: ${pr.done} of ${pr.total} mastered"><span class="fill"></span><span class="n">${c}</span></button>`;
    }
    return out;
  }

  // A row of Gospel tabs that switches which book a screen shows.
  function bookTabs(action, current) {
    return `<div class="segmented" role="group" aria-label="Gospel">${BOOKS.filter((b) => GOSPELS[b])
      .map((b) => `<button type="button" data-action="${action}" data-book="${b}" aria-pressed="${current === b}">${b}</button>`)
      .join("")}</div>`;
  }

  function trainingDesc() {
    if (!training.chapters.length) return "Learn three chapters at a time. A new one joins each time you learn one";
    const st = trainingStatus();
    if (!st.learning.length && st.learned.length >= st.total) return `All ${st.total} chapters learned · keep them fresh`;
    return `${st.learned.length} of ${plural(st.total, "chapter")} learned · now ${st.learning.map(shortRef).join(", ")}`;
  }

  function homeHtml() {
    const book = state.mapBook;
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
      ${Kit.crumb("#/gospels", "The Gospels")}
      <header class="masthead">
        <p class="eyebrow">A Gospel game</p>
        <h1>Chapter <span class="amp">&amp;</span> Verse</h1>
        <p class="lede">Read a moment from the Gospels. Name the chapter it comes from.</p>
      </header>

      ${Kit.saveWarning()}
      <section class="play-buttons" aria-label="Play">
        <button type="button" class="btn btn-primary mode-btn" data-action="start" data-mode="round">
          <span class="mode-text"><span class="mode-name">Play a round</span><span class="mode-desc">10 questions · bonus points for speed and streaks</span></span>${ICON.arrow}
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="lamps">
          <span class="mode-text"><span class="mode-name">Three lamps</span><span class="mode-desc">Keep going until your three lamps go out</span></span>
          <span class="lamps" aria-hidden="true">${ICON.lamp.replace("<svg", '<svg class="lamp"').repeat(3)}</span>
        </button>
        <button type="button" class="btn mode-btn" data-action="start" data-mode="train">
          <span class="mode-text"><span class="mode-name">Training</span><span class="mode-desc">${esc(trainingDesc())}</span></span>${ICON.sprout}
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
        ${bookTabs("map-book", book)}
        <div class="map">${mapTiles(book, 1, g.chapters)}</div>
        <div class="map-legend">
          <span><i class="swatch"></i>Fills as you master events (right twice in a row)</span>
          ${g.markLegend ? `<span><i class="dot"></i>${esc(g.markLegend)}</span>` : ""}
        </div>
      </section>

      <section class="options" aria-labelledby="opt-title">
        <div class="section-head"><h2 id="opt-title">Options</h2></div>
        <div class="option">
          <span class="option-label">Gospels</span>
          <div class="books">${bookToggles}</div>
          <span class="option-help">Turn on more than one to mix them. Then you pick the Gospel as well as the chapter.</span>
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
        <p class="footer-note">Scripture text is the World English Bible, which is in the public domain. Progress is saved in this browser on this device only.</p>
      </section>`;
  }

  function topbarHtml(g, status) {
    return `
      <div class="topbar">
        <button type="button" class="icon-btn" data-action="quit" aria-label="Quit to menu">${ICON.close}</button>
        ${status}
        <span class="score tabular" aria-label="${g.mode === "train" ? "Right answers" : "Score"}">${fmt(g.score)}</span>
      </div>`;
  }

  // Training's status: the chapters being learned, each filling as you master it.
  function trainingSetHtml() {
    const st = trainingStatus();
    if (!st.learning.length) return `<span class="run">Reviewing all ${plural(st.learned.length, "chapter")}</span>`;
    const chips = st.learning.map((k) => {
      const i = k.lastIndexOf(" ");
      const pr = chapterProgress(k.slice(0, i), Number(k.slice(i + 1)));
      return `<span class="chip" style="--p:${pr.p.toFixed(3)}"><span class="fill"></span><span class="l">${shortRef(k)}</span></span>`;
    }).join("");
    return `<div class="train-set" aria-label="Learning ${st.learning.join(", ")}">${chips}</div>`;
  }

  // Shown before questions start on new chapters: what happens in each.
  function introHtml(g) {
    const first = g.firstIntro;
    const lede = first
      ? `Training starts with ${g.intro.length === 1 ? "this chapter" : `these ${["", "", "two", "three"][g.intro.length] || g.intro.length} chapters`}. Read what happens in each, then answer questions on them. Each time you learn a chapter (every event in it right twice in a row), the next one joins.`
      : `Here’s what happens in ${g.intro.length === 1 ? "it" : "them"}. Questions on ${g.intro.length === 1 ? "it start" : "them start"} now, alongside your other chapters.`;
    const chapters = g.intro.map((k) => {
      const i = k.lastIndexOf(" ");
      const book = k.slice(0, i), ch = Number(k.slice(i + 1));
      const sec = E.sectionFor(gospel(book), ch);
      const evs = chapterEvents(book, ch).map((e) => `
        <li><button type="button" class="intro-ev" data-action="passage" data-id="${e.id}">
          <span class="t">${esc(e.title)}</span><span class="r">${e.ch}:${e.v[0]}${e.v[1] !== e.v[0] ? "–" + e.v[1] : ""}</span></button></li>`).join("");
      return `<section class="intro-ch">
          <h2 class="ref">${esc(k)}</h2>
          ${sec ? `<p class="meta">Part of <b>${esc(sec.name)}</b></p>` : ""}
          <ul class="intro-evs">${evs}</ul>
        </section>`;
    }).join("");
    return `
      ${topbarHtml(g, trainingSetHtml())}
      <article class="card" aria-live="polite">
        <div class="card-top"><span class="kind">${first ? "Your first chapters" : g.intro.length === 1 ? "New chapter" : "New chapters"}</span></div>
        <p class="intro-lede">${lede}</p>
        ${chapters}
        <p class="meta">Tap an event to read it.</p>
      </article>
      <div class="actions"><button type="button" class="btn btn-primary" data-action="begin">${first ? "Start training" : "Carry on"} ${ICON.arrow}</button></div>`;
  }

  function playHtml() {
    const g = state.game;
    if (!g.q) return introHtml(g);
    const q = g.q;
    const e = byId[q.id];
    const answered = q.picked !== null;
    const ok = answered && q.picked >= 0 && isRight(q, q.choices[q.picked]);

    const status = g.mode === "train" ? trainingSetHtml() : Kit.roundStatus(g, answered, ROUND_LENGTH, LAMPS);

    const clue = q.type === "chapter"
      ? `<h2 class="chapter-ask">${esc(e.book)} ${e.ch}</h2>`
      : q.type === "verse"
        ? `<p class="verse">${esc(E.cleanVerse(E.verseText(TEXT, e, e.key)))}</p>`
        : `<h2 class="event-title">${esc(e.title)}</h2><p class="clue">${esc(e.clue)}</p>`;

    const choices = q.choices.map((c, i) => {
      let cls = q.type === "chapter" ? "choice choice-event" : "choice";
      if (q.removed.includes(i)) cls += " is-removed";
      if (answered) {
        if (isRight(q, c)) cls += " is-right";
        else if (i === q.picked) cls += " is-wrong";
        else cls += " is-faded";
      }
      const attrs = `class="${cls}" data-action="answer" data-index="${i}" ${answered || q.removed.includes(i) ? "disabled" : ""}`;
      if (q.type === "chapter") {
        return `<button type="button" ${attrs}><span class="key" aria-hidden="true">${i + 1}</span><span class="title">${esc(c.title)}</span></button>`;
      }
      return `<button type="button" ${attrs} aria-label="${c.book} ${c.ch}">
        <span class="key" aria-hidden="true">${i + 1}</span><span class="book">${c.book}</span><span class="num">${c.ch}</span></button>`;
    }).join("");

    let actions;
    if (answered) {
      const last = (g.mode === "round" && g.history.length >= ROUND_LENGTH) || (g.mode === "lamps" && g.lamps <= 0);
      const label = last ? "See results" : g.mode === "train" && g.intro.length ? `Meet ${g.intro.join(", ")}` : "Next";
      actions = `<div class="actions"><button type="button" class="btn btn-primary" data-action="next">${esc(label)} ${ICON.arrow}</button></div>`;
    } else if (g.mode === "train") {
      actions = `<div class="actions two"><button type="button" class="btn btn-small hint-btn" data-action="dunno">Show me</button><span></span></div>`;
    } else {
      actions = `<div class="actions two">
        <button type="button" class="btn btn-small hint-btn" data-action="hint" ${q.hinted ? "disabled" : ""}>${q.hinted ? "50/50 used" : "50/50"}</button>
        ${timed() ? `<div style="align-self:center" aria-hidden="true"><div class="timer" style="--t:${E.QUESTION_TIME_MS / 1000}s"><i style="animation-delay:-${Math.min(Date.now() - q.startedAt, E.QUESTION_TIME_MS)}ms"></i></div></div>` : "<span></span>"}
      </div>`;
    }

    return `
      ${topbarHtml(g, status)}
      <article class="card${answered ? "" : " is-asking"}" aria-live="polite">
        <div class="card-top">
          <span class="kind">${q.type === "chapter" ? "What happens in this chapter?" : settings.books.length > 1 ? (q.type === "verse" ? "Which Gospel and chapter is this verse in?" : "Which Gospel and chapter?") : q.type === "verse" ? "Which chapter is this verse in?" : "Which chapter is this in?"}</span>
        </div>
        ${clue}
        ${answered ? revealHtml(e, ok, q) : ""}
      </article>
      <div class="choices${q.type === "chapter" ? " is-events" : q.choices.length === 3 ? " is-three" : ""}">${choices}</div>
      ${actions}`;
  }

  function revealHtml(e, ok, q) {
    const g = gospel(e.book);
    const sec = E.sectionFor(g, e.ch);
    const range = sec ? (sec.from === sec.to ? `ch. ${sec.from}` : `ch. ${sec.from}–${sec.to}`) : "";
    const picked = q.picked >= 0 ? q.choices[q.picked] : null;
    const verdict = ok
      ? `Right!${Kit.pointsNote(q.points)}`
      : !picked ? "Here’s the answer."
        : q.type === "chapter" ? `Not quite. “${picked.title}” is in ${picked.book} ${picked.ch}.`
          : `Not quite. You picked ${picked.book} ${picked.ch}.`;
    const learned = q.learned
      ? `<p class="learned" role="status">${esc(q.learned)} learned!${state.game.intro.length ? ` Next up: ${esc(state.game.intro.join(", "))}.` : ""}</p>`
      : "";
    const keyVerse = q.type !== "verse"
      ? `<p class="key-verse">${esc(E.cleanVerse(E.verseText(TEXT, e, e.key)))} <span style="font-style:normal">(${e.ch}:${e.key})</span></p>`
      : `<p class="ref-title">${esc(e.title)}</p>`;
    return `
      <div class="reveal">
        <p class="verdict ${ok ? "ok" : "miss"}" role="status">${esc(verdict)}</p>
        ${learned}
        <p class="ref">${esc(E.formatRef(e))}</p>
        ${keyVerse}
        ${sec ? `<p class="meta">Part of <b>${esc(sec.name)}</b> (${range})${sec.mark ? `, ${esc(g.markNote)}` : ""}.</p>` : ""}
        ${e.note ? `<p class="meta note">${esc(e.note)}</p>` : ""}
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
        <span class="r">${BOOK_ABBR[e.book]} ${e.ch}:${e.v[0]}${e.v[1] !== e.v[0] ? "–" + e.v[1] : ""}</span></button>`;
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
            <span class="sec-name">${esc(sec.name)}${sec.mark ? `<span class="tag">${esc(g.markTag)}</span>` : ""}</span>
            <span class="sec-range">${sec.from === sec.to ? `Chapter ${sec.from}` : `Chapters ${sec.from}–${sec.to}`}</span>
          </div>
          <div class="map">${mapTiles(s.book, sec.from, sec.to)}</div>
        </div>`).join("");
      return `
        <div class="page-head">
          <button type="button" class="icon-btn" data-action="home" aria-label="Back to home">${ICON.back}</button>
          <h1>Study ${esc(s.book)}</h1>
        </div>
        ${bookTabs("study-book", s.book)}
        <p class="study-intro">${esc(g.intro)}</p>
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
          ${e.note ? `<p class="meta note">${esc(e.note)}</p>` : ""}
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
        <p class="meta">${plural(chapterEvents(s.book, s.ch).length, "event")} · ${chapterProgress(s.book, s.ch).done} mastered${sec && sec.mark ? ` · ${esc(g.markNote)}` : ""}</p>
      </header>
      <div class="events">${evs}</div>
      <div class="chapter-nav">
        <button type="button" class="btn btn-small" data-action="chapter" data-book="${s.book}" data-ch="${s.ch - 1}" ${s.ch <= 1 ? "disabled" : ""}>${ICON.back.replace('aria-hidden="true"', 'aria-hidden="true" width="18" height="18"')} Chapter ${Math.max(1, s.ch - 1)}</button>
        <button type="button" class="btn btn-small" data-action="chapter" data-book="${s.book}" data-ch="${s.ch + 1}" ${s.ch >= g.chapters ? "disabled" : ""}>Chapter ${Math.min(g.chapters, s.ch + 1)} ${ICON.arrow.replace('aria-hidden="true"', 'aria-hidden="true" width="18" height="18"')}</button>
      </div>`;
  }

  function sheetHtml() {
    const e = byId[state.sheet];
    return Kit.sheetHtml({
      eyebrow: e.title,
      title: E.formatRef(e),
      passages: [{ verses: E.passage(TEXT, e), key: e.key }],
      attribution: "World English Bible (public domain). The highlighted verse is the one used for verse clues.",
    });
  }

  // ── Input (the shell forwards clicks on [data-action] and key presses) ──
  function click(el) {
    const a = el.dataset.action;
    if (a !== "reset") state.resetArmed = false;
    switch (a) {
      case "start": startGame(el.dataset.mode); window.scrollTo(0, 0); break;
      case "answer": answer(Number(el.dataset.index)); break;
      case "hint": useHint(); break;
      case "dunno": answer(-1); break;
      case "begin": beginTraining(); break;
      case "next": nextQuestion(); break;
      case "quit": state.game = null; state.screen = "home"; render({ scrollTop: true }); break;
      case "home": state.screen = "home"; render({ scrollTop: true }); break;
      case "study": state.screen = "study"; state.study = { book: state.mapBook, ch: null, open: null }; render({ scrollTop: true }); break;
      case "map-book": state.mapBook = el.dataset.book; render(); break;
      case "study-book": state.study = { book: el.dataset.book, ch: null, open: null }; render(); break;
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
          stats = {}; bests = { round: 0, lamps: 0, run: 0 }; training = { chapters: [] };
          store.remove("cv.stats"); store.remove("cv.bests"); store.remove("cv.training");
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
    if (!q) { // training's chapter introduction
      if (ev.key === "Enter" && !(ev.target instanceof HTMLButtonElement && ev.target.dataset.action !== "begin")) { beginTraining(); ev.preventDefault(); }
      else if (ev.key === "Escape") { state.game = null; state.screen = "home"; render(); }
      return;
    }
    if (q.picked === null && /^[1-4]$/.test(ev.key)) { answer(Number(ev.key) - 1); ev.preventDefault(); }
    else if (q.picked === null && ev.key.toLowerCase() === "h") useHint();
    else if (q.picked !== null && ev.key === "Enter" && !(ev.target instanceof HTMLButtonElement && ev.target.dataset.action !== "next")) { nextQuestion(); ev.preventDefault(); }
    else if (ev.key === "Escape") { state.game = null; state.screen = "home"; render(); }
  }

  function masteredCount() {
    return Object.keys(byId).filter((id) => E.isMastered(stats[id])).length;
  }

  window.Games = window.Games || {};
  window.Games["chapter-and-verse"] = {
    title: "Chapter & Verse",
    blurb: "Read a moment from the Gospels. Name the chapter it comes from.",
    art: '<span class="art-amp">&amp;</span>',
    summary() {
      const bits = [`${masteredCount()} of ${Object.keys(byId).length} events mastered`];
      if (training.chapters.length) bits.push(`${trainingStatus().learned.length} chapters learned in training`);
      if (bests.round) bits.push(`best round ${fmt(bests.round)}`);
      return bits.join(" · ");
    },
    mount(root) { app = root; render({ scrollTop: true }); },
    // Leaving abandons a game in progress; the menu is there on return.
    // (Training progress is saved as it goes.)
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
      if (state.screen !== "home" && state.screen !== "study" && !state.game) state.screen = "home";
    },
  };
})();
