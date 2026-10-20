// "Add to Home Screen" help for iPhone and iPad: a banner on the first screen
// and a step-by-step sheet with drawings of each Safari screen. The banner
// shows only in a browser tab on iOS (not once installed, nor inside another
// page). ✕ hides it until the next visit; "Don't show again" hides it for good.
// The sheet stays reachable from a link at the foot of the first screen.
(function () {
  "use strict";

  const { store, esc, ICON } = window.Kit;
  const FOREVER = "bl.install.hidden";
  const SESSION = "bl.install.later";

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true ||
    !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  let framed = false;
  try { framed = window.top !== window.self; } catch (_) { framed = true; }

  function laterThisVisit() { try { return sessionStorage.getItem(SESSION) === "1"; } catch (_) { return false; } }
  function hideForNow() { try { sessionStorage.setItem(SESSION, "1"); } catch (_) { /* hidden until re-render only */ } hiddenNow = true; }
  let hiddenNow = false;

  const showBanner = () => isIOS && !installed && !framed && !hiddenNow && !laterThisVisit() && !store.get(FOREVER, false);
  const offerHelp = () => !installed && !framed;

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
            <button type="button" class="btn btn-small btn-primary" data-action="install-help">Show me how</button>
            <button type="button" class="btn btn-small btn-ghost" data-action="install-never">Don’t show again</button>
          </div>
        </div>
        <button type="button" class="icon-btn install-close" data-action="install-later" aria-label="Hide for now">${ICON.close}</button>
      </aside>`;
  }

  function footerLinkHtml() {
    return offerHelp() ? `<button type="button" class="link-btn" data-action="install-help">${SHARE} How to add it to your iPhone Home Screen</button>` : "";
  }

  // ── Drawings of each screen (iOS light appearance, in both themes) ──
  const safariBar = `
    <div class="ios-screen ios-bottom">
      <div class="ios-page"><span class="ios-line w70"></span><span class="ios-line w90"></span><span class="ios-line w50"></span></div>
      <div class="ios-bar">
        <span class="ios-round">${BACK}</span>
        <span class="ios-address">${host}</span>
        <span class="ios-round ring">${DOTS}</span>
      </div>
    </div>`;
  const moreMenu = `
    <div class="ios-screen ios-bottom">
      <div class="ios-menu">
        <span class="ios-row ring">Share ${SHARE}</span>
        <span class="ios-row">Add to Favorites ${STAR}</span>
        <span class="ios-row">Add Bookmark ${BOOK}</span>
        <span class="ios-row">Find on Page ${FIND}</span>
      </div>
      <div class="ios-bar">
        <span class="ios-round">${BACK}</span>
        <span class="ios-address">${host}</span>
        <span class="ios-round">${DOTS}</span>
      </div>
    </div>`;
  const shareSheet = `
    <div class="ios-screen ios-sheet">
      <div class="ios-sheet-head">${appIcon("ios-mini")}<span><b>Bible Learning</b><br>${host}</span></div>
      <div class="ios-list">
        <span class="ios-row">Copy ${COPY}</span>
        <span class="ios-row">Add to Reading List ${GLASSES}</span>
        <span class="ios-row">Add Bookmark ${BOOK}</span>
        <span class="ios-row ring">Add to Home Screen ${PLUS_BOX}</span>
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

  const STEPS = [
    { title: "Tap ••• in Safari", art: safariBar,
      text: `Open this page in Safari, then tap the ••• button next to the address bar. On older iPhones, tap the Share button <span class="inline-ic">${SHARE}</span> in the toolbar instead, and skip to step 3.` },
    { title: "Tap Share", art: moreMenu, text: "It’s at the top of the menu." },
    { title: "Tap Add to Home Screen", art: shareSheet,
      text: "Scroll down the list to find it. If it isn’t there, tap <b>View More</b> or <b>Edit Actions</b> at the bottom." },
    { title: "Tap Add", art: addDialog, text: "Leave <b>Open as Web App</b> switched on so it opens full screen." },
    { title: "Open it from your Home Screen", art: homeScreen,
      text: "Bible Learning is now on your Home Screen with your other apps. Open it from there each time." },
  ];

  function sheetHtml() {
    const steps = STEPS.map((s, i) => `
      <li class="install-step">
        <div class="install-step-text">
          <h3><span class="step-n">${i + 1}</span>${esc(s.title)}</h3>
          <p>${s.text}</p>
        </div>
        <div class="ios-art" aria-hidden="true">${s.art}</div>
      </li>`).join("");
    const banner = isIOS && !store.get(FOREVER, false);
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow">iPhone and iPad</p><h2 class="ref" id="sheet-title">Add to Home Screen</h2></div>
          <button type="button" class="icon-btn" data-action="install-close" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          <p class="sheet-intro">Bible Learning can sit on your Home Screen and open full screen, like an app. It takes five taps.</p>
          <ol class="install-steps">${steps}</ol>
          <p class="install-note"><b>Your progress:</b> the Home Screen app keeps its own progress, separate from Safari’s. Anything you’ve done in Safari stays there, so it’s best to add it before you get far.</p>
          <div class="install-done">
            <button type="button" class="btn btn-primary" data-action="install-close">Got it</button>
            ${banner ? `<button type="button" class="btn btn-ghost" data-action="install-never">Don’t show the reminder again</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  // Handles the banner's and sheet's buttons. Returns what the shell should
  // do: "open" or "close" the sheet, "render" the screen again, or null.
  function action(name) {
    switch (name) {
      case "install-help": return "open";
      case "install-close": return "close";
      case "install-later": hideForNow(); return "render";
      case "install-never": store.set(FOREVER, true); hiddenNow = true; return "close";
      default: return null;
    }
  }

  window.Install = { bannerHtml, footerLinkHtml, sheetHtml, action };
})();
