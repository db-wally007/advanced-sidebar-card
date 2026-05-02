/**
 * ha-splash.js  v16
 *
 * Central transition handler — three layers:
 *   1. Initial load    — hide page until sidebar+clock are ready, then
 *                         stagger-fade sidebar first, content area second.
 *   2. Dashboard switch — opaque overlay covers the viewport while
 *                         sidebar-card rebuilds on SPA navigation.
 *                         Only activates for dashboards listed in MANAGED_DASHBOARDS.
 *   3. View switch      — #view content cross-fades within the same dashboard.
 *                         Includes VIEW_RENDER_GRACE_MS so slower cards (mini-graph)
 *                         finish rendering before the fade begins.
 *
 * ─── CONFIGURATION ───────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ══════════════ Configurable parameters ═══════════════════════════════════════
   *
   *  MANAGED_DASHBOARDS
   *    Array of dashboard URL slugs where the full-page overlay transition is used.
   *    Built-in HA pages (energy, history, logbook, config, etc.) are NOT affected.
   *    Example: ['tablet-dashboard', 'mobile-dashboard']
   *    Set to empty array [] to disable overlay transitions entirely.
   */
  var MANAGED_DASHBOARDS = ['tablet-dashboard', 'dashboard-clock2'];

  /*  FADE_MS
   *    Duration (ms) of the main page/overlay fade-in/out animation.
   */
  var FADE_MS = 400;

  /*  VIEW_FADE_MS
   *    Duration (ms) of the #view opacity transition when switching views
   *    within the same dashboard.
   */
  var VIEW_FADE_MS = 450;

  /*  VIEW_RENDER_GRACE_MS
   *    Fixed delay (ms) added AFTER the view becomes visible in the DOM but BEFORE
   *    the fade-in animation starts. Gives slower-rendering cards (e.g. mini-graph,
   *    ApexCharts) time to finish drawing on lower-power devices.
   *    Set to 0 on fast hardware for instant transitions.
   */
  var VIEW_RENDER_GRACE_MS = 350;

  /*  STAGGER_OFFSET_MS
   *    On initial load: content area fade-in starts this many ms AFTER the sidebar
   *    begins fading in. Creates an app-like sequential reveal effect.
   *    Set to 0 to fade both in simultaneously (original behaviour).
   */
  var STAGGER_OFFSET_MS = 950;

  /*  PE_GRACE_MS
   *    Internal: time to wait for sidebar-card's Pe() to create the wrapper DOM
   *    before polling for readiness. Increase if sidebar appears late.
   */
  var PE_GRACE_MS = 800;

  /* ═══════════════════════════════════════════════════════════════════════════════ */

  /* ─────────────────── helpers ─────────────────────────────────── */

  function getHuiRoot() {
    var e = document.querySelector('home-assistant');
    e = e && e.shadowRoot;
    e = e && e.querySelector('home-assistant-main');
    e = e && e.shadowRoot;
    e = e && e.querySelector('ha-drawer partial-panel-resolver');
    e = e && (e.shadowRoot || e);
    e = e && e.querySelector('ha-panel-lovelace');
    e = e && e.shadowRoot;
    return e && e.querySelector('hui-root');
  }

  function getDash(p) { return (p || '').split('/')[1] || ''; }

  function isManagedDash(slug) {
    return MANAGED_DASHBOARDS.indexOf(slug) !== -1;
  }

  /**
   * Sidebar readiness inside a hui-root shadowRoot.
   *   true  — sidebar fully rendered (clock loaded, .loading removed)
   *   false — wrapper exists but sidebar-card still loading
   *   null  — no wrapper yet (too early or non-sidebar dashboard)
   */
  function sidebarState(sr) {
    var w = sr.querySelector('#customSidebarWrapper');
    if (!w) return null;
    var card = w.querySelector('#customSidebar sidebar-card');
    if (!card || !card.shadowRoot) return false;
    var inner = card.shadowRoot.querySelector('.sidebar-inner');
    return inner ? !inner.classList.contains('loading') : false;
  }

  /**
   * Poll until the sidebar is ready (or confirmed absent), then call cb().
   */
  function waitForSidebar(cb) {
    var att = 0;
    (function poll() {
      var root = getHuiRoot();
      if (!root || !root.shadowRoot) {
        if (++att < 20) setTimeout(poll, 200);
        else cb();
        return;
      }
      var sr = root.shadowRoot;
      setTimeout(function () {
        var s = sidebarState(sr);
        if (s === null) { cb(); return; }
        if (s === true) { cb(); return; }
        var sc = 0;
        var iv = setInterval(function () {
          var st = sidebarState(sr);
          if (st === true || st === null || ++sc >= 25) {
            clearInterval(iv);
            cb();
          }
        }, 200);
      }, PE_GRACE_MS);
    })();
  }

  /**
   * Get the #customSidebar element inside hui-root shadowRoot (or null).
   */
  function getSidebarEl() {
    var root = getHuiRoot();
    if (!root || !root.shadowRoot) return null;
    return root.shadowRoot.querySelector('#customSidebar');
  }

  /**
   * Get the #view element inside hui-root shadowRoot (or null).
   */
  function getViewEl() {
    var root = getHuiRoot();
    if (!root || !root.shadowRoot) return null;
    return root.shadowRoot.getElementById('view');
  }

  /* ────────────────── 1. initial load ─────────────────────────── */

  var html = document.documentElement;
  html.style.transition = 'none';
  html.style.opacity    = '0';

  var safetyTimer = setTimeout(function () {
    html.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
    html.style.opacity    = '1';
  }, 8000);

  waitForSidebar(function () {
    clearTimeout(safetyTimer);

    if (STAGGER_OFFSET_MS <= 0) {
      /* No stagger — fade entire page at once */
      setTimeout(function () {
        html.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
        html.style.opacity    = '1';
      }, 80);
      return;
    }

    /* Staggered reveal: sidebar first, content second */
    var sidebar = getSidebarEl();
    var view    = getViewEl();

    if (!sidebar || !view) {
      /* Fallback — can't find elements, just fade the whole page */
      setTimeout(function () {
        html.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
        html.style.opacity    = '1';
      }, 80);
      return;
    }

    /* Hide sidebar and view individually */
    sidebar.style.opacity    = '0';
    sidebar.style.transition = 'none';
    view.style.opacity       = '0';
    view.style.transition    = 'none';

    /* Reveal the page instantly (elements hidden individually) */
    html.style.transition = 'none';
    html.style.opacity    = '1';

    /* Fade sidebar in first */
    setTimeout(function () {
      sidebar.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
      sidebar.style.opacity    = '1';

      /* Fade content in after STAGGER_OFFSET_MS */
      setTimeout(function () {
        view.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
        view.style.opacity    = '1';
      }, STAGGER_OFFSET_MS);
    }, 80);
  });

  /* ────────────────── 2. transition overlay ───────────────────── */

  var ov = document.createElement('div');
  ov.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'background:var(--primary-background-color,#1c1c1c);' +
    'z-index:999;pointer-events:none;opacity:0;display:none;';
  (function addOv() {
    if (document.body) document.body.appendChild(ov);
    else setTimeout(addOv, 50);
  })();

  function showOv() {
    ov.style.display    = 'block';
    ov.style.transition = 'none';
    void ov.offsetWidth;
    ov.style.opacity = '1';
  }
  function hideOv() {
    ov.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
    ov.style.opacity    = '0';
    setTimeout(function () { ov.style.display = 'none'; }, FADE_MS + 50);
  }

  /* ────────────────── 3. navigation handler ───────────────────── */

  var prevDash = getDash(window.location.pathname);
  var prevPath = window.location.pathname;
  var prevHash = window.location.hash;

  /**
   * Apply the staggered sidebar → content reveal on the current hui-root.
   * Used after dashboard switches to get the same app-like effect as initial load.
   */
  function staggerReveal() {
    if (STAGGER_OFFSET_MS <= 0) { hideOv(); return; }
    var sidebar = getSidebarEl();
    var view    = getViewEl();
    if (!sidebar || !view) { hideOv(); return; }

    /* Hide both elements behind the overlay */
    sidebar.style.opacity    = '0';
    sidebar.style.transition = 'none';
    view.style.opacity       = '0';
    view.style.transition    = 'none';

    /* Drop the overlay instantly, elements invisible underneath */
    ov.style.transition = 'none';
    ov.style.opacity    = '0';
    ov.style.display    = 'none';

    /* Fade sidebar first */
    setTimeout(function () {
      sidebar.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
      sidebar.style.opacity    = '1';
      /* Fade content after offset */
      setTimeout(function () {
        view.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
        view.style.opacity    = '1';
      }, STAGGER_OFFSET_MS);
    }, 80);
  }

  setTimeout(function () {
    window.addEventListener('location-changed', function () {
      var curPath = window.location.pathname;
      var curHash = window.location.hash;
      var curDash = getDash(curPath);
      var dashChanged = curDash !== prevDash;
      var pathChanged = curPath !== prevPath;
      var hashOnly    = !pathChanged && curHash !== prevHash;

      prevDash = curDash;
      prevPath = curPath;
      prevHash = curHash;

      /* ── hash-only change (popup open/close) — do nothing ──── */
      if (hashOnly) return;

      if (!dashChanged && pathChanged) {
        /* ── view switch within the same dashboard ─────────────── */
        var root = getHuiRoot();
        if (!root || !root.shadowRoot) return;
        var view = root.shadowRoot.getElementById('view');
        if (!view) return;
        view.style.transition = 'none';
        view.style.opacity    = '0';
        void view.offsetWidth;
        setTimeout(function () {
          view.style.transition = 'opacity ' + VIEW_FADE_MS + 'ms ease-out';
          view.style.opacity    = '1';
        }, VIEW_RENDER_GRACE_MS);
        return;
      }

      if (!dashChanged) return;

      /* ── dashboard switch — only for managed dashboards ──────── */
      if (!isManagedDash(curDash)) return;
      showOv();
      waitForSidebar(function () { setTimeout(staggerReveal, 80); });
    });
  }, 500);

  console.info('[ha-splash] v16 loaded – managed dashboards:', MANAGED_DASHBOARDS.join(', '));
})();