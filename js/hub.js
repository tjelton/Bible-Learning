// The shell: asks which part of the Bible to study, lists that part's games,
// and hands the page to whichever game is open. The route lives in the URL
// hash, so the back button and home-screen bookmarks work:
//   #/              choose a part of the Bible
//   #/gospels       the games for that part
//   #/gospels/<id>  a game (registered on window.Games by its own script)
(function () {
  "use strict";

  const { esc, ICON } = window.Kit;
  const Install = window.Install;
  const GAMES = window.Games || {};
  const NAME = "Bible Learning";

  // Parts of the Bible that can be studied: the whole Bible, then its parts in
  // Bible order. Add a part here with its games to offer it on the first screen.
  const PARTS = [
    { id: "bible", testament: "Old and New Testaments", name: "The Whole Bible", books: "Genesis to Revelation",
      lede: "Games that range across all sixty-six books.",
      games: ["clusters", "odd-one-out", "number-crunch", "before-or-after"] },
    { id: "old-testament", testament: "Old Testament", name: "The Old Testament", books: "Genesis to Malachi",
      lede: "From creation to the prophets. Pick a game.",
      games: ["proverbs"] },
    { id: "gospels", testament: "New Testament", name: "The Gospels", books: "Matthew, Mark, Luke and John",
      lede: "Four accounts of the life of Jesus. Pick a game.",
      games: ["chapter-and-verse", "which-gospel"] },
  ];
  const gamesOf = (part) => (part.games || []).filter((id) => GAMES[id]);
  const open = PARTS.filter((p) => gamesOf(p).length);

  const app = document.getElementById("app");
  let active = null; // the open game, if any
  let installSheet = false; // the "Add to Home Screen" steps are open

  function parse() {
    const [partId, gameId] = location.hash.replace(/^#\/?/, "").split("/");
    const part = open.find((p) => p.id === partId) || null;
    const game = part && gamesOf(part).includes(gameId) ? gameId : null;
    return { part, game };
  }

  // ── Screens ──
  function pickerHtml() {
    const cards = open.map((p) => {
      const n = gamesOf(p).length;
      return `<a class="part-card" href="#/${p.id}">
        <span class="part-text">
          <span class="eyebrow">${esc(p.testament)}</span>
          <span class="part-name">${esc(p.name)}</span>
          <span class="part-books">${esc(p.books)} · ${n} ${n === 1 ? "game" : "games"}</span>
        </span>${ICON.arrow}</a>`;
    }).join("");
    return `
      <header class="masthead">
        <p class="eyebrow">${NAME}</p>
        <h1 class="ask" tabindex="-1">What would you like to study?</h1>
      </header>
      ${Install.bannerHtml()}
      <section class="parts" aria-label="Parts of the Bible">${cards}</section>
      <p class="footer-note">Progress is saved in this browser on this device only.</p>
      ${Install.footerLinkHtml()}`;
  }

  function partHtml(part) {
    const cards = gamesOf(part).map((id) => {
      const g = GAMES[id];
      return `<a class="game-card" href="#/${part.id}/${id}">
        <span class="game-art" aria-hidden="true">${g.art}</span>
        <span class="game-text">
          <span class="game-name">${esc(g.title)}</span>
          <span class="game-blurb">${esc(g.blurb)}</span>
          <span class="game-progress">${esc(g.summary())}</span>
        </span>${ICON.arrow}</a>`;
    }).join("");
    return `
      ${window.Kit.crumb("#/", "Parts of the Bible")}
      <header class="masthead">
        <p class="eyebrow">${esc(part.testament)}</p>
        <h1 tabindex="-1">${esc(part.name)}</h1>
        <p class="lede">${esc(part.lede || part.books)}</p>
      </header>
      <section class="games" aria-label="Games">${cards}</section>`;
  }

  // ── Routing ──
  function show(focus) {
    const r = parse();
    if (active && active !== r.game) { GAMES[active].unmount(); active = null; }
    document.body.style.overflow = "";
    if (r.game) {
      document.title = GAMES[r.game].title;
      if (active !== r.game) { active = r.game; GAMES[active].mount(app); }
      return;
    }
    // Anything unrecognised falls back to the picker.
    if (!r.part && location.hash.replace(/^#\/?/, "")) history.replaceState(null, "", "#/");
    document.title = r.part ? `${r.part.name} · ${NAME}` : NAME;
    app.className = "app";
    if (r.part) installSheet = false;
    renderShell();
    window.scrollTo(0, 0);
    if (focus) app.querySelector("h1")?.focus({ preventScroll: true });
  }

  // The first screen or a part's games page, with the install steps over it when open.
  function renderShell() {
    const r = parse();
    app.innerHTML = (r.part ? partHtml(r.part) : pickerHtml()) + (installSheet ? Install.sheetHtml() : "");
    document.body.style.overflow = installSheet ? "hidden" : "";
  }

  Install.onChange(() => { if (!active) renderShell(); });
  window.addEventListener("hashchange", () => show(true));
  app.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el || el.disabled) return;
    if (active) return GAMES[active].click(el, ev);
    const next = Install.action(el);
    if (!next) return;
    installSheet = next === "open" ? true : next === "close" ? false : installSheet;
    renderShell();
    if (next === "open") app.querySelector(".sheet .icon-btn")?.focus();
  });
  document.addEventListener("keydown", (ev) => {
    if (active) return GAMES[active].key(ev);
    if (installSheet && ev.key === "Escape") { installSheet = false; renderShell(); }
  });

  // ── Start (keeps the route and any game in progress when the page is updated live) ──
  function boot(data) {
    if (data && data.games) {
      for (const [id, saved] of Object.entries(data.games)) if (GAMES[id] && GAMES[id].restore) GAMES[id].restore(saved);
    }
    if (data && data.route && !location.hash) history.replaceState(null, "", data.route);
    show(false);
  }
  const hot = window.claude && window.claude.hot;
  try {
    if (hot && typeof hot.snapshot === "function") {
      hot.snapshot(() => ({
        route: location.hash,
        games: Object.fromEntries(Object.entries(GAMES).map(([id, g]) => [id, g.snapshot ? g.snapshot() : null])),
      }));
    }
  } catch (_) { /* live updates not available */ }
  if (hot && typeof hot.ready === "function") hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
