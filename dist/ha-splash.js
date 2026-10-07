/**
 * ha-splash.js  v17
 *
 * Central transition handler — four layers:
 *   1. Initial load    — hide page until sidebar+clock are ready, then
 *                         stagger-fade sidebar first, content area second.
 *   2. Dashboard switch — opaque overlay covers the viewport while
 *                         sidebar-card rebuilds on SPA navigation.
 *                         Only activates for dashboards listed in MANAGED_DASHBOARDS.
 *   3. View switch      — #view content cross-fades within the same dashboard.
 *                         Includes VIEW_RENDER_GRACE_MS so slower cards (mini-graph)
 *                         finish rendering before the fade begins.
 *   4. Sidebar          — a view that hides the sidebar (sidebar-card's hideOnPath, a
 *                         full-screen view) slides it out to the left on the way in and
 *                         back in from the left on the way out, instead of it vanishing
 *                         and reappearing at once.
 *
 * Back / Forward (and Android's back) move Home Assistant WITHOUT its location-changed
 * event, which both this file and sidebar-card's hideOnPath listen to - no fade, and a
 * sidebar left hidden after leaving a full-screen view. A popstate is announced as a
 * location-changed, so they follow it too.
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
  var MANAGED_DASHBOARDS = ['tablet-dashboard', 'dashboard-clock2', 'mobile-dashboard'];

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

  /*  SIDEBAR_SLIDE_MS
   *    Duration (ms) of the sidebar sliding out to the left when a view hides it
   *    (sidebar-card's hideOnPath) and back in from the left when such a view is left.
   *    On the way in the content waits for it: its width changes once the sidebar is gone.
   */
  var SIDEBAR_SLIDE_MS = 420;

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

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ────────────────── 4. sidebar slide ────────────────────────── */

  /* Whether the sidebar was hidden after the last navigation (null: no sidebar here). */
  var sidebarHidden = null;
  function noteSidebar() {
    var s = getSidebarEl();
    sidebarHidden = s ? s.classList.contains('hide') : null;
  }

  /**
   * After a view switch: if sidebar-card just hid or showed the sidebar (hideOnPath), slide
   * it - out to the left, or in from the left. Transform and opacity only, so nothing is laid
   * out again frame by frame on a slow tablet; the content is invisible meanwhile (the view
   * fade). Returns how long the content should wait before it fades in.
   */
  function slideSidebar() {
    var sidebar = getSidebarEl();
    var view    = getViewEl();
    var was     = sidebarHidden;
    noteSidebar();
    if (!sidebar || !view || was === null || was === sidebarHidden || reduceMotion()) return 0;
    var w = parseFloat(getComputedStyle(sidebar).maxWidth) || 260;
    if (sidebarHidden) {
      /* into a full-screen view: keep it for its exit, then let it go */
      sidebar.classList.remove('hide');
      view.classList.remove('hideSidebar');
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        if (sidebarHidden) {          /* still on a view without it */
          sidebar.classList.add('hide');
          view.classList.add('hideSidebar');
        }
      };
      var out = sidebar.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translateX(' + -w + 'px)', opacity: 0 }],
        { duration: SIDEBAR_SLIDE_MS, easing: 'cubic-bezier(.4,0,.2,1)' });
      out.onfinish = finish;
      out.oncancel = finish;
      setTimeout(finish, SIDEBAR_SLIDE_MS + 300);
      return SIDEBAR_SLIDE_MS;
    }
    /* out of one: in from the left, the content fading in as it lands */
    sidebar.animate(
      [{ transform: 'translateX(' + -w + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: SIDEBAR_SLIDE_MS, easing: 'cubic-bezier(.32,.72,0,1)' });
    return 0;
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
    noteSidebar();

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
      /* No sidebar (e.g. mobile / clock): reveal the page instantly but fade the
         CONTENT in, mirroring the staggered dashboards' content reveal so these
         dashboards get the same gentle initial fade-in. */
      if (view) {
        view.style.opacity    = '0';
        view.style.transition = 'none';
        html.style.transition = 'none';
        html.style.opacity    = '1';
        setTimeout(function () {
          view.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
          view.style.opacity    = '1';
        }, 80);
      } else {
        setTimeout(function () {
          html.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
          html.style.opacity    = '1';
        }, 80);
      }
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
    noteSidebar();
    if (STAGGER_OFFSET_MS <= 0) { hideOv(); return; }
    var sidebar = getSidebarEl();
    var view    = getViewEl();
    if (!sidebar || !view) {
      /* No sidebar (e.g. mobile / clock): fade the CONTENT in (rather than just
         fading the overlay off) so it matches the staggered dashboards. */
      if (view) {
        view.style.opacity    = '0';
        view.style.transition = 'none';
        ov.style.transition = 'none';
        ov.style.opacity    = '0';
        ov.style.display    = 'none';
        setTimeout(function () {
          view.style.transition = 'opacity ' + FADE_MS + 'ms ease-out';
          view.style.opacity    = '1';
        }, 80);
      } else {
        hideOv();
      }
      return;
    }

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
        // mobile-dashboard runs its own (slide) view transition via the
        // persistent-navbar-card, so don't also fade #view here.
        if (curDash === 'mobile-dashboard') return;
        var root = getHuiRoot();
        if (!root || !root.shadowRoot) return;
        var view = root.shadowRoot.getElementById('view');
        if (!view) return;
        view.style.transition = 'none';
        view.style.opacity    = '0';
        void view.offsetWidth;
        /* sidebar-card shows or hides the sidebar on this same event - at once, and its
           listener may run after this one. Look once every listener has run (a microtask:
           still before the next paint), slide it, then fade the content in. */
        queueMicrotask(function () {
          var wait = slideSidebar();
          setTimeout(function () {
            view.style.transition = 'opacity ' + VIEW_FADE_MS + 'ms ease-out';
            view.style.opacity    = '1';
          }, Math.max(VIEW_RENDER_GRACE_MS, wait));
        });
        return;
      }

      if (!dashChanged) return;

      /* ── dashboard switch — only for managed dashboards ──────── */
      if (!isManagedDash(curDash)) return;
      showOv();
      waitForSidebar(function () { setTimeout(staggerReveal, 80); });
    });

    /* Back / Forward: announced, so the fade and sidebar-card's hideOnPath follow it (Home
       Assistant itself moves on popstate without a location-changed). A second event for
       the same place does nothing: nothing changed since the first. */
    window.addEventListener('popstate', function () {
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
    });
  }, 500);

  console.info('[ha-splash] v17 loaded – managed dashboards:', MANAGED_DASHBOARDS.join(', '));
})();