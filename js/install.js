// "Add to Home Screen" help for phones: a banner on the first screen and a
// step-by-step sheet, with drawings of each screen, for iPhone/iPad (Safari)
// and Android (Chrome). Where Chrome offers its own install prompt, the
// banner's button opens that instead. The banner shows only in a browser tab
// on iOS or Android (not once installed, nor inside another page). ✕ hides it
// until the next visit; "Don't show again" hides it for good. The sheet stays
// reachable from a link at the foot of the first screen.
(function () {
  "use strict";

  const { store, esc, ICON } = window.Kit;
  const FOREVER = "bl.install.hidden";
  const SESSION = "bl.install.later";

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const installed = navigator.standalone === true ||
    !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  let framed = false;
  try { framed = window.top !== window.self; } catch (_) { framed = true; }

  function laterThisVisit() { try { return sessionStorage.getItem(SESSION) === "1"; } catch (_) { return false; } }
  function hideForNow() { try { sessionStorage.setItem(SESSION, "1"); } catch (_) { /* hidden until re-render only */ } hiddenNow = true; }
  let hiddenNow = false;

  const showBanner = () => (isIOS || isAndroid) && !installed && !framed && !hiddenNow && !laterThisVisit() && !store.get(FOREVER, false);
  const offerHelp = () => !installed && !framed;
  let tab = isAndroid ? "android" : "ios"; // which phone the sheet shows

  // Chrome's own install prompt, when it offers one. It's held back (no
  // mini-infobar) while our banner is showing, and used by its Install button.
  let prompt = null;
  let changed = () => {}; // set by the shell to redraw
  window.addEventListener("beforeinstallprompt", (ev) => {
    if (showBanner()) ev.preventDefault();
    prompt = ev;
    changed();
  });
  window.addEventListener("appinstalled", () => { prompt = null; hiddenNow = true; changed(); });
  function installNow() {
    if (!prompt) return;
    const p = prompt;
    prompt = null;
    p.prompt();
    p.userChoice.then((c) => { if (c && c.outcome === "accepted") hiddenNow = true; changed(); }).catch(() => {});
  }

  // The app's icon, drawn inline so it also works in the single-file build.
  const appIcon = (cls) => `<svg class="${cls}" viewBox="0 0 180 180" aria-hidden="true"><rect width="180" height="180" fill="#1f5a44"/><rect x="18" y="18" width="144" height="144" rx="10" fill="none" stroke="#dab562" stroke-width="3" opacity="0.55"/><text x="90" y="128" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="118" fill="#dab562">&amp;</text></svg>`;
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';
  const PLUS_BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
  const DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>';
  const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const STAR = line("M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z");
  const BOOK = line("M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13");
  const FIND = line("M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5L20 20");
  const COPY = line("M9 9h10v11H9zM5 15V4h10");
  const GLASSES = line("M3 14a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M14 14a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M10 14c.7-.8 3.3-.8 4 0");
  const KEBAB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="18.5" r="1.9"/></svg>';
  const HOME = line("M4 11l8-7 8 7M6 9.5V20h12V9.5");
  const PAGE_MENU = line("M5 7h14M5 12h14M5 17h9");
  const RELOAD = line("M18.5 12a6.5 6.5 0 1 1-2-4.7M18.5 4.5v3.5H15");
  const TABS = line("M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8z");
  const RIBBON = line("M7 4h10v16l-5-4-5 4z");
  const ZOOM = line("M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5L20 20M10.5 8v5M8 10.5h5");
  const CHEVRON_DOWN = line("M6 9.5l6 6 6-6");
  const CHEVRON_UP = line("M6 14.5l6-6 6 6");
  const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const host = esc(location.host || "tjelton.github.io");

  function bannerHtml() {
    if (!showBanner()) return "";
    return `
      <aside class="install-banner" aria-label="Add to Home Screen">
        ${appIcon("install-icon")}
        <div class="install-text">
          <p class="install-title">Put Bible Learning on your Home Screen</p>
          <p class="install-sub">It opens full screen, like an app.</p>
          <div class="install-actions">
            ${prompt
              ? `<button type="button" class="btn btn-small btn-primary" data-action="install-now">Install</button>`
              : `<button type="button" class="btn btn-small btn-primary" data-action="install-help">Show me how</button>`}
            <button type="button" class="btn btn-small btn-ghost" data-action="install-never">Don’t show again</button>
          </div>
        </div>
        <button type="button" class="icon-btn install-close" data-action="install-later" aria-label="Hide for now">${ICON.close}</button>
      </aside>`;
  }

  function footerLinkHtml() {
    return offerHelp() ? `<button type="button" class="link-btn" data-action="install-help">${PLUS_BOX} How to put it on your phone’s Home Screen</button>` : "";
  }

  // ── Drawings of each screen (the phone's light appearance, in both themes) ──
  // Safari's bottom bar: back, the address bar (page menu ≡ at its left end), tabs.
  const safariBottom = (ringMenu) => `
      <div class="ios-bar">
        <span class="ios-round">${BACK}</span>
        <span class="ios-address"><span class="ios-pm${ringMenu ? " ring" : ""}">${PAGE_MENU}</span><span class="ios-host">${host}</span>${RELOAD}</span>
        <span class="ios-round">${TABS}</span>
      </div>`;
  const safariBar = `
    <div class="ios-screen ios-bottom">
      <div class="ios-page"><span class="ios-line w70"></span><span class="ios-line w90"></span><span class="ios-line w50"></span></div>
      ${safariBottom(true)}
    </div>`;
  const moreMenu = `
    <div class="ios-screen ios-bottom">
      <div class="ios-menu">
        <span class="ios-row ring">${SHARE} Share</span>
        <span class="ios-row">${RIBBON} Add to Bookmarks</span>
        <span class="ios-row">${BOOK} Add Bookmark to…</span>
        <span class="ios-row">${FIND} Find on Page</span>
        <span class="ios-row">${ZOOM} Page Zoom</span>
      </div>
      ${safariBottom(false)}
    </div>`;
  // Safari's share sheet: the page, a row of round actions, then (after
  // View More) a list that includes Add to Home Screen.
  const shareHead = `
      <div class="ios-share-head">${appIcon("ios-mini")}<span><b>Bible Learning</b><br>${host}<br><span class="ios-pill">Options ›</span></span></div>
      <div class="ios-apps">${'<span class="ios-app-dot"></span>'.repeat(4)}</div>`;
  const actionRow = (last, ring) => `
      <div class="ios-actions">
        <span class="ios-action"><span class="ios-circle">${COPY}</span>Copy</span>
        <span class="ios-action"><span class="ios-circle">${RIBBON}</span>Add to Bookmarks</span>
        <span class="ios-action"><span class="ios-circle">${GLASSES}</span>Add to Reading List</span>
        <span class="ios-action"><span class="ios-circle${ring ? " ring" : ""}">${last === "more" ? CHEVRON_DOWN : CHEVRON_UP}</span>${last === "more" ? "View More" : "View Less"}</span>
      </div>`;
  const shareSheet = `
    <div class="ios-screen ios-sheet ios-share">
      ${shareHead}
      ${actionRow("more", true)}
    </div>`;
  const shareMore = `
    <div class="ios-screen ios-sheet ios-share">
      ${actionRow("less", false)}
      <div class="ios-list">
        <span class="ios-row ios-left">${BOOK} Add Bookmark to…</span>
        <span class="ios-row ios-left">${STAR} Add to Favourites</span>
        <span class="ios-row ios-left">${FIND} Find on Page</span>
        <span class="ios-row ios-left ring">${PLUS_BOX} Add to Home Screen</span>
      </div>
    </div>`;
  const addDialog = `
    <div class="ios-screen ios-sheet">
      <div class="ios-nav"><span class="ios-link">Cancel</span><b>Add to Home Screen</b><span class="ios-link ring">Add</span></div>
      <div class="ios-list">
        <span class="ios-row ios-name">${appIcon("ios-mini")}<span>Bible Learning<br><small>${host}</small></span></span>
        <span class="ios-row">Open as Web App <span class="ios-toggle"></span></span>
      </div>
    </div>`;
  const homeScreen = `
    <div class="ios-screen ios-home">
      ${'<span class="ios-app"><span class="ios-app-icon"></span><span class="ios-app-name">&nbsp;</span></span>'.repeat(3)}
      <span class="ios-app">${appIcon("ios-app-icon ring")}<span class="ios-app-name">Bible Learning</span></span>
    </div>`;

  // Android, Chrome
  const chromeBar = `
    <div class="ios-screen and-screen and-top">
      <div class="and-bar">
        <span class="and-ic">${HOME}</span>
        <span class="and-address">${host}</span>
        <span class="and-tabs">1</span>
        <span class="and-ic ring">${KEBAB}</span>
      </div>
      <div class="ios-page"><span class="ios-line w70"></span><span class="ios-line w90"></span><span class="ios-line w50"></span></div>
    </div>`;
  const chromeMenu = `
    <div class="ios-screen and-screen and-top">
      <div class="and-bar">
        <span class="and-ic">${HOME}</span>
        <span class="and-address">${host}</span>
        <span class="and-tabs">1</span>
        <span class="and-ic">${KEBAB}</span>
      </div>
      <div class="and-menu">
        <span class="and-row">New tab</span>
        <span class="and-row">History</span>
        <span class="and-row">Bookmarks</span>
        <span class="and-row">Share…</span>
        <span class="and-row ring">${PLUS_BOX} Add to Home screen</span>
      </div>
    </div>`;
  const chromeDialog = `
    <div class="ios-screen and-screen and-dim">
      <div class="and-dialog">
        <b class="and-title">Install app</b>
        <span class="and-app">${appIcon("ios-mini")}<span>Bible Learning<br><small>${host}</small></span></span>
        <span class="and-buttons"><span class="and-btn">Cancel</span><span class="and-btn ring">Install</span></span>
      </div>
    </div>`;

  const IOS_STEPS = [
    { title: "Tap ≡ in the address bar", art: safariBar,
      text: `Open this page in Safari. In the address bar at the bottom of the screen, tap the ≡ button at its left end. On older iPhones, tap the Share button <span class="inline-ic">${SHARE}</span> in the toolbar instead, and skip to step 3.` },
    { title: "Tap Share", art: moreMenu, text: "It’s at the top of the menu that opens." },
    { title: "Tap View More", art: shareSheet,
      text: "It’s the ⌄ button at the end of the row of round buttons, below your contacts and apps." },
    { title: "Tap Add to Home Screen", art: shareMore,
      text: "It’s in the list that opens. If you don’t see it, scroll down." },
    { title: "Tap Add", art: addDialog, text: "Leave <b>Open as Web App</b> switched on so it opens full screen." },
    { title: "Open it from your Home Screen", art: homeScreen,
      text: "Bible Learning is now on your Home Screen with your other apps. Open it from there each time." },
  ];
  const ANDROID_STEPS = [
    { title: "Tap ⋮ in Chrome", art: chromeBar,
      text: "Open this page in Chrome, then tap the ⋮ button at the top right, next to the address bar." },
    { title: "Tap Add to Home screen", art: chromeMenu,
      text: "Scroll down the menu to find it. On some phones it’s called <b>Install app</b>." },
    { title: "Tap Install", art: chromeDialog,
      text: "If Chrome asks, choose <b>Install</b> rather than <b>Create shortcut</b>, so it opens full screen." },
    { title: "Open it from your Home Screen", art: homeScreen,
      text: "Bible Learning is now on your Home Screen and in your apps list. Open it from there each time." },
  ];

  function sheetHtml() {
    const android = tab === "android";
    const steps = (android ? ANDROID_STEPS : IOS_STEPS).map((st, i) => `
      <li class="install-step">
        <div class="install-step-text">
          <h3><span class="step-n">${i + 1}</span>${esc(st.title)}</h3>
          <p>${st.text}</p>
        </div>
        <div class="ios-art" aria-hidden="true">${st.art}</div>
      </li>`).join("");
    const quick = android && prompt
      ? `<div class="install-quick"><p>Chrome can do it for you in one tap.</p><button type="button" class="btn btn-primary" data-action="install-now">Install Bible Learning</button><p class="install-or">Or do it yourself:</p></div>`
      : "";
    const note = android
      ? `<p class="install-note"><b>Using Samsung Internet?</b> Tap ≡ at the bottom right, then <b>Add page to</b> → <b>Home screen</b>.</p>
         <p class="install-note"><b>Your progress:</b> the app shares the progress saved in Chrome, so nothing is lost.</p>`
      : `<p class="install-note"><b>Your progress:</b> the Home Screen app keeps its own progress, separate from Safari’s. Anything you’ve done in Safari stays there, so it’s best to add it before you get far.</p>`;
    const never = (isIOS || isAndroid) && !store.get(FOREVER, false);
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow">Phones and tablets</p><h2 class="ref" id="sheet-title">Add to Home Screen</h2></div>
          <button type="button" class="icon-btn" data-action="install-close" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          <p class="sheet-intro">Bible Learning can sit on your Home Screen and open full screen, like an app. It takes a few taps.</p>
          <div class="segmented install-tabs" role="group" aria-label="Your phone">
            <button type="button" data-action="install-tab" data-value="ios" aria-pressed="${!android}">iPhone or iPad</button>
            <button type="button" data-action="install-tab" data-value="android" aria-pressed="${android}">Android</button>
          </div>
          ${quick}
          <ol class="install-steps">${steps}</ol>
          ${note}
          <div class="install-done">
            <button type="button" class="btn btn-primary" data-action="install-close">Got it</button>
            ${never ? `<button type="button" class="btn btn-ghost" data-action="install-never">Don’t show the reminder again</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  // Handles the banner's and sheet's buttons. Returns what the shell should
  // do: "open" or "close" the sheet, "render" the screen again, or null.
  function action(el) {
    switch (el.dataset.action) {
      case "install-help": return "open";
      case "install-close": return "close";
      case "install-tab": tab = el.dataset.value; return "render";
      case "install-now": installNow(); return "close";
      case "install-later": hideForNow(); return "render";
      case "install-never": store.set(FOREVER, true); hiddenNow = true; return "close";
      default: return null;
    }
  }

  // The shell's redraw, for when Chrome offers or finishes an install.
  function onChange(fn) { changed = fn; }

  window.Install = { bannerHtml, footerLinkHtml, sheetHtml, action, onChange };
})();
