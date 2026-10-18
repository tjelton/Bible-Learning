// Pieces every game shares: saved data, HTML helpers, icons, sound, confetti,
// the round status bar and the passage sheet. (window.Kit)
(function () {
  "use strict";

  // ── Saved data (this device only) ──
  // When the browser blocks storage (Safari with "Block All Cookies", some
  // in-app browsers) saving fails; each game's home screen then says so.
  const store = {
    failed: false,
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { store.failed = true; } },
    remove(k) { try { localStorage.removeItem(k); } catch (_) { store.failed = true; } },
  };
  try {
    localStorage.setItem("bl.check", "1");
    if (localStorage.getItem("bl.check") !== "1") store.failed = true;
    localStorage.removeItem("bl.check");
  } catch (_) { store.failed = true; }
  // Ask the browser to keep progress rather than clear it when space runs low.
  try { navigator.storage.persist().catch(() => {}); } catch (_) { /* not supported */ }

  function saveWarning() {
    return store.failed
      ? `<p class="save-warning" role="alert"><b>Progress isn’t being saved.</b> This browser is blocking storage, so everything resets when the page closes. On iPhone, check that Settings → Apps → Safari → Block All Cookies is off, and that you aren’t in a Private tab.</p>`
      : "";
  }

  // ── Helpers ──
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("en-US");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    sprout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20v-8M12 12c0-3.5-2.5-6-7-6 0 3.5 2.5 6 7 6zM12 14c0-3.5 2.5-6 7-6 0 3.5-2.5 6-7 6z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/></svg>',
    lamp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.6 2.6 3.4 4.6 3.4 7.7a3.4 3.4 0 0 1-6.8 0c0-1.7.9-2.8 1.5-4 .6 1 .8 1.8.8 2.6 1-.9 1.4-3.6 1.1-6.3z"/><path d="M3 15.5h13.5c1.6 0 2.9-.7 3.9-1.8l.9.6c-.6 2.6-2.4 4.7-5.3 5.2H9.4C6 19.5 3.6 17.9 3 15.5z"/></svg>',
  };

  // A link back up a level, shown above a game's own home screen.
  function crumb(href, label) {
    return `<nav class="crumb"><a href="${href}">${ICON.back}<span>${esc(label)}</span></a></nav>`;
  }

  // ── Sound (tiny synthesized tones; starts only after a tap) ──
  let audio = null;
  function sound(kind, on) {
    if (!on) return;
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

  function floatPoints(n) {
    const el = document.createElement("div");
    el.className = "points";
    el.textContent = "+" + n;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // " +145 (speed +35, streak +10)" for a scored answer, or "" for none.
  function pointsNote(p) {
    if (!p || !p.total) return "";
    const parts = [];
    if (p.speed) parts.push(`speed +${p.speed}`);
    if (p.streak) parts.push(`streak +${p.streak}`);
    return ` +${p.total}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  }

  // ── Round status: pips for a 10-question round, lamps for "three lamps" ──
  // g: { mode, history: [{ ok }], lamps, streak }
  function roundStatus(g, answered, roundLength, lampCount) {
    if (g.mode === "round") {
      const pips = Array.from({ length: roundLength }, (_, i) => {
        const h = g.history[i];
        const cls = h ? (h.ok ? "is-right" : "is-wrong") : i === g.history.length ? "is-now" : "";
        return `<span class="pip ${cls}"></span>`;
      }).join("");
      return `<div class="pips" aria-label="Question ${Math.min(g.history.length + (answered ? 0 : 1), roundLength)} of ${roundLength}">${pips}</div>`;
    }
    const lamps = Array.from({ length: lampCount }, (_, i) => ICON.lamp.replace("<svg", `<svg class="lamp${i >= g.lamps ? " is-out" : ""}"`)).join("");
    return `<div class="lamps" aria-label="${plural(g.lamps, "lamp")} left">${lamps}<span class="run">Run <b class="tabular">${g.streak}</b></span></div>`;
  }

  // ── Passage sheet ──
  // passages: [{ heading, verses: [{ n, text }], key }] where `key` is a verse
  // number to highlight. `intro` is an optional line above the passages.
  function sheetHtml({ eyebrow, title, intro, passages, attribution }) {
    const body = passages.map((p) => {
      const verses = p.verses
        .map((v) => `<span${v.n === p.key ? ' class="is-key"' : ""}><sup>${v.n}</sup>${esc(v.text)}</span>`)
        .join(" ");
      return `${p.heading ? `<h3 class="passage-ref">${esc(p.heading)}</h3>` : ""}<p class="passage">${verses}</p>`;
    }).join("");
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <div><p class="eyebrow">${esc(eyebrow)}</p><h2 class="ref" id="sheet-title">${esc(title)}</h2></div>
          <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="sheet-body">
          ${intro ? `<p class="sheet-intro">${esc(intro)}</p>` : ""}
          ${body}
          <p class="attribution">${esc(attribution)}</p>
        </div>
      </div>`;
  }

  window.Kit = {
    store, saveWarning, esc, fmt, plural, ICON, crumb,
    sound, confetti, floatPoints, pointsNote, roundStatus, sheetHtml,
  };
})();
