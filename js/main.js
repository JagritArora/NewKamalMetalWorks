initScrollRestore();

// Shared live theme state for every SVG-rendered animation on the page
// (process belt, capability scenes). CSS handles color for ordinary
// elements automatically via prefers-color-scheme, but these are re-drawn
// by JS from raw hex values, so a theme flip needs to be pushed to them
// explicitly instead of only being read once at page load.
var NKMWTheme = (function () {
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function readAccent() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return v || (mq.matches ? "#E06A3A" : "#C4501C");
  }
  var state = { isDark: mq.matches, accent: readAccent() };
  var listeners = [];
  function handleChange() {
    state = { isDark: mq.matches, accent: readAccent() };
    listeners.slice().forEach(function (fn) { fn(state); });
  }
  if (mq.addEventListener) mq.addEventListener("change", handleChange);
  else if (mq.addListener) mq.addListener(handleChange); // older Safari

  return {
    get: function () { return state; },
    // Returns an unsubscribe function.
    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    }
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { navLinks.classList.remove("open"); });
    });
  }

  initNavShadow();
  initActiveNav();
  initReveal();
  initProcessBelt();
  initCapabilitiesSlider();
  initCapabilityScenes();
});

function initNavShadow() {
  var nav = document.querySelector(".site-nav");
  if (!nav) return;
  var onScroll = function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Highlights the nav link for whichever section is currently crossing the
// midline of the viewport, so the nav reflects scroll position rather than
// only responding to hover.
function initActiveNav() {
  var navLinks = document.querySelectorAll(".nav-links a");
  if (!navLinks.length || typeof IntersectionObserver === "undefined") return;

  var sections = [];
  navLinks.forEach(function (link) {
    var id = (link.getAttribute("href") || "").replace("#", "");
    var section = id && document.getElementById(id);
    if (section) sections.push(section);
  });
  if (!sections.length) return;

  var current = null;
  function setActive(id) {
    if (id === current) return;
    current = id;
    navLinks.forEach(function (link) {
      var active = id !== null && link.getAttribute("href") === "#" + id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  // Tracked separately from the observer callback's own entry batch, since
  // each entry only reports what changed -- not the full set of sections
  // currently crossing the band.
  var intersecting = new Set();

  function pickActive() {
    if (intersecting.size) {
      for (var i = 0; i < sections.length; i++) {
        if (intersecting.has(sections[i].id)) { setActive(sections[i].id); return; }
      }
    }
    // Nothing is crossing the band right now. Above the first section (still
    // in the hero) clears the nav; anywhere past that -- e.g. the footer,
    // below the last section -- leaves the last active link as it was,
    // rather than going stale on whatever fired last.
    var firstTop = sections[0].getBoundingClientRect().top + window.scrollY;
    if (window.scrollY < firstTop) setActive(null);
  }

  // A thin band through the middle of the viewport. Whichever section is
  // crossing it counts as "current" -- this tracks scroll position more
  // naturally than triggering the moment a section merely enters the screen.
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) intersecting.add(entry.target.id);
      else intersecting.delete(entry.target.id);
    });
    pickActive();
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

  sections.forEach(function (s) { observer.observe(s); });
}

function initReveal() {
  var items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (typeof IntersectionObserver === "undefined") {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -60px 0px" });

  items.forEach(function (el) { observer.observe(el); });
}

// Switches live between the desktop pinned/scroll-scrubbed scene and the
// static/mobile looping-preview fallback as the viewport crosses 760px --
// dragging a window narrower or rotating a tablet no longer needs a reload
// to pick up the right layout.
function initProcessBelt() {
  var track = document.querySelector(".process-track");
  if (!track) return;

  var scene = track.querySelector('.belt-scene[data-scene="blanking"]');
  var svg = track.querySelector(".blanking-svg");
  var stageCopies = track.querySelectorAll(".stage-copy");
  var stageCount = stageCopies.length;
  if (!stageCount) return;

  var api = window.NKMWBlankingScene;
  var gsapReady = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  if (gsapReady) gsap.registerPlugin(ScrollTrigger);

  var currentMode = null; // "desktop" | "static"
  var scrollTrigger = null;
  var staticController = null;
  var offDesktopTheme = null;

  function teardown() {
    if (scrollTrigger) { scrollTrigger.kill(); scrollTrigger = null; }
    if (offDesktopTheme) { offDesktopTheme(); offDesktopTheme = null; }
    if (staticController) { staticController.stop(); staticController = null; }
    track.classList.remove("is-static");
    if (scene) scene.classList.remove("is-active");
    stageCopies.forEach(function (el) { el.classList.remove("is-active"); });
  }

  function setupDesktop() {
    // The whole four-station scene (Blanking -> Punching -> Bending ->
    // Coating/Polishing) is one continuous authored choreography, so the
    // entire scroll track maps straight onto its 0..TOTAL timeline. Clamp
    // at END_T so the finished part just holds on station 04 instead of
    // riding through the authored loop's camera pull-back to press 01.
    var endT = api.END_T || api.TOTAL;
    function update(p) {
      var theme = NKMWTheme.get();
      var scaledP = p * stageCount;
      var activeIndex = Math.min(Math.floor(scaledP), stageCount - 1);

      if (scene) scene.classList.add("is-active");
      api.render(svg, Math.min(p * api.TOTAL, endT), { dark: theme.isDark, accent: theme.accent, labels: false });

      stageCopies.forEach(function (el, i) {
        el.classList.toggle("is-active", i === activeIndex);
      });
    }

    scrollTrigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.85,
      onUpdate: function (self) { update(self.progress); }
    });
    update(scrollTrigger.progress);

    offDesktopTheme = NKMWTheme.onChange(function () {
      if (currentMode === "desktop") update(scrollTrigger.progress);
    });
  }

  function setupStatic() {
    track.classList.add("is-static");
    stageCopies.forEach(function (el) { el.classList.add("is-active"); });
    staticController = initStaticBeltScene(scene, svg, api);
  }

  function evaluateMode() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var isMobile = window.innerWidth < 480;
    var wantDesktop = gsapReady && !!api && !!svg && !reduceMotion && !isMobile;
    var wantMode = wantDesktop ? "desktop" : "static";
    if (wantMode === currentMode) return;

    teardown();
    currentMode = wantMode;
    if (wantMode === "desktop") setupDesktop(); else setupStatic();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }

  evaluateMode();

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(evaluateMode, 200);
  });

  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotionQuery.addEventListener) reduceMotionQuery.addEventListener("change", evaluateMode);
  else if (reduceMotionQuery.addListener) reduceMotionQuery.addListener(evaluateMode);
}

// The static/mobile fallback still shows the press-line scene -- just as a
// small looping preview above the stacked station cards instead of a
// scroll-scrubbed, viewport-pinned background, since pinning a 600vh track
// doesn't translate to normal phone scrolling. Runs the same render()
// the desktop version uses, looping across the full authored timeline
// (including its camera-reset move) so it plays as a seamless loop, only
// while the panel is actually on screen. Returns a controller with a
// stop() method so the caller can tear it down cleanly if the layout
// switches back to the desktop pinned version.
function initStaticBeltScene(scene, svg, api) {
  var controller = { stop: function () {} };
  if (!scene || !svg || !api) return controller;
  scene.classList.add("is-active");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    function renderHeld() {
      var theme = NKMWTheme.get();
      api.render(svg, (api.END_T || api.TOTAL) * 0.5, { dark: theme.isDark, accent: theme.accent, labels: false });
    }
    renderHeld();
    var offTheme = NKMWTheme.onChange(renderHeld);
    controller.stop = offTheme;
    return controller;
  }

  var rafId = null;
  var visible = false;
  var startTime = null;
  var io = null;

  function frame(now) {
    if (startTime === null) startTime = now;
    var t = ((now - startTime) / 1000) % api.TOTAL;
    var theme = NKMWTheme.get();
    api.render(svg, t, { dark: theme.isDark, accent: theme.accent, labels: false });
    rafId = requestAnimationFrame(frame);
  }
  function play() { if (!rafId && visible) rafId = requestAnimationFrame(frame); }
  function pause() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (visible) play(); else pause();
      });
    }, { threshold: 0.1 });
    io.observe(scene);
  } else {
    visible = true;
    play();
  }

  controller.stop = function () {
    pause();
    if (io) io.disconnect();
  };
  return controller;
}

// Shared lookup so both the carousel's autoplay timing and the scene
// renderer resolve a tile's animation from the same place.
function capSceneApi(op) {
  switch (op) {
    case "embossing": return window.NKMWEmbossingScene;
    case "threading": return window.NKMWThreadingScene;
    case "notching": return window.NKMWNotchingScene;
    case "knurling": return window.NKMWKnurlingScene;
    default: return null;
  }
}

function initCapabilitiesSlider() {
  var root = document.querySelector(".capabilities");
  if (!root) return;

  var track = root.querySelector(".cap-track");
  var panels = root.querySelectorAll(".cap-panel");
  var dots = root.querySelectorAll(".cap-dot");
  var playBtn = root.querySelector(".cap-play");
  if (!track || !panels.length) return;

  var current = 0;
  var autoplayTimer = null;
  var isPlaying = false;
  var AUTOPLAY_MS = 4200;
  var AUTOPLAY_GAP_MS = 350; // brief pause on the finished frame before advancing

  // Autoplay waits out the active tile's own animation loop (not a fixed
  // interval), so a tile always finishes playing before the carousel moves on.
  function currentDwellMs() {
    var panel = panels[current];
    var visual = panel && panel.querySelector(".cap-visual");
    var op = visual && visual.getAttribute("data-op");
    var api = op && capSceneApi(op);
    return api && api.TOTAL ? api.TOTAL * 1000 + AUTOPLAY_GAP_MS : AUTOPLAY_MS;
  }

  // Distance uses getBoundingClientRect rather than offsetLeft, so it stays
  // correct regardless of which ancestor ends up as the offsetParent.
  function centerOffset(i) {
    var panelRect = panels[i].getBoundingClientRect();
    var trackRect = track.getBoundingClientRect();
    var panelLeft = panelRect.left - trackRect.left + track.scrollLeft;
    return panelLeft - (track.clientWidth - panelRect.width) / 2;
  }

  function setActive(i) {
    current = i;
    dots.forEach(function (dot, idx) {
      var active = idx === i;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });
    root.dispatchEvent(new CustomEvent("capabilities:active-change", { detail: { index: i } }));
  }

  function goTo(i, behavior) {
    i = (i + panels.length) % panels.length;
    track.scrollTo({ left: centerOffset(i), behavior: behavior || "smooth" });
    setActive(i);
  }

  function scheduleNext() {
    autoplayTimer = setTimeout(function () {
      goTo(current + 1);
      if (isPlaying) scheduleNext();
    }, currentDwellMs());
  }
  function stopAutoplay() {
    if (!isPlaying) return;
    isPlaying = false;
    if (autoplayTimer) { clearTimeout(autoplayTimer); autoplayTimer = null; }
    if (playBtn) playBtn.classList.remove("is-playing");
  }
  function startAutoplay() {
    if (isPlaying) return;
    isPlaying = true;
    if (playBtn) playBtn.classList.add("is-playing");
    scheduleNext();
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () { stopAutoplay(); goTo(i); });
  });
  if (playBtn) {
    playBtn.addEventListener("click", function () {
      if (isPlaying) stopAutoplay(); else startAutoplay();
    });
  }
  track.addEventListener("pointerdown", stopAutoplay);

  var scrollTimer;
  track.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var mid = track.scrollLeft + track.clientWidth / 2;
      var closest = 0, closestDist = Infinity;
      panels.forEach(function (panel, idx) {
        var rect = panel.getBoundingClientRect();
        var trackRect = track.getBoundingClientRect();
        var center = rect.left - trackRect.left + track.scrollLeft + rect.width / 2;
        var dist = Math.abs(center - mid);
        if (dist < closestDist) { closestDist = dist; closest = idx; }
      });
      if (closest !== current) setActive(closest);
    }, 100);
  }, { passive: true });

  setActive(0);
}

// Renders a tight, continuously-looping close-up animation into each
// capability tile's own <svg>, ported from the same design-tool source as
// the process-belt scene. Only the currently active panel is animated (and
// only while the section is on-screen), so idle panels cost nothing.
function initCapabilityScenes() {
  var root = document.querySelector(".capabilities");
  if (!root) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var panels = root.querySelectorAll(".cap-panel");
  var entries = [];
  panels.forEach(function (panel, i) {
    var visual = panel.querySelector(".cap-visual");
    if (!visual) return;
    var op = visual.getAttribute("data-op");
    var api = capSceneApi(op);
    var svg = visual.querySelector(".cap-visual-scene");
    if (!api || !svg) return;

    svg.setAttribute("viewBox", api.VIEWBOX);
    visual.classList.add("has-scene");
    entries[i] = { svg: svg, api: api };
  });
  if (!entries.length) return;

  // has-scene hides each panel's static fallback icon immediately above, but
  // the rAF loop below only ever draws the *active* panel. Without this, every
  // other panel's <svg> sits empty (blank) until it becomes active at least
  // once -- reading as "missing" rather than just idle -- so every panel gets
  // one frame drawn up front.
  (function paintInitialFrames() {
    var theme = NKMWTheme.get();
    entries.forEach(function (entry) {
      if (entry) entry.api.render(entry.svg, 0, { dark: theme.isDark, accent: theme.accent });
    });
  })();

  var activeIndex = 0;
  var rafId = null;
  var sectionVisible = false;

  function frame(now) {
    var entry = entries[activeIndex];
    if (entry) {
      var theme = NKMWTheme.get();
      var t = (now / 1000) % entry.api.TOTAL;
      entry.api.render(entry.svg, t, { dark: theme.isDark, accent: theme.accent });
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (rafId || !sectionVisible) return;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (typeof IntersectionObserver !== "undefined") {
    var io = new IntersectionObserver(function (obs) {
      obs.forEach(function (e) {
        sectionVisible = e.isIntersecting;
        if (sectionVisible) start(); else stop();
      });
    }, { threshold: 0.1 });
    io.observe(root);
  } else {
    sectionVisible = true;
    start();
  }

  root.addEventListener("capabilities:active-change", function (e) {
    activeIndex = e.detail.index;
  });
}

// Reloading the page restores wherever you actually were scrolled to --
// not the top, and not wherever an earlier-clicked nav link's #hash still
// happens to point (that hash goes stale the moment you scroll away from
// it without clicking another link, since plain scrolling never updates
// it -- so it's cleared here rather than trusted). The one true source of
// "where you were" is the scroll position itself, tracked continuously.
//
// A blocking inline script in <head> (before first paint) hides the page
// the instant it detects a reload with a remembered position, so this
// never shows a flash of the top of the page before snapping down --
// that flash was what read as an unwanted "redirect" in the first place.
// This function is what actually restores the position and reveals the
// page again; see that inline script for its side of the handshake.
function initScrollRestore() {
  if ("scrollRestoration" in history) {
    // Stop the browser's own (unreliable on this page's pinned GSAP
    // sections) restore attempt so ours is the only one that runs.
    history.scrollRestoration = "manual";
  }

  var KEY = "nkmw-scroll-y";

  function isReload() {
    try {
      var entries = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (entries && entries[0]) return entries[0].type === "reload";
    } catch (e) {}
    return false;
  }

  function save() {
    try { sessionStorage.setItem(KEY, String(window.scrollY)); } catch (e) {}
  }

  var saveTimer;
  window.addEventListener("scroll", function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 150);
  }, { passive: true });
  window.addEventListener("beforeunload", save);
  // Mobile Safari and bfcache navigations don't always fire beforeunload.
  window.addEventListener("pagehide", save);

  function reveal() {
    document.documentElement.style.visibility = "";
  }

  var reload = isReload();
  var saved = 0;
  if (reload) {
    try { saved = parseInt(sessionStorage.getItem(KEY), 10) || 0; } catch (e) { saved = 0; }

    // A stale #hash from an earlier nav click would otherwise silently
    // override the restored position on this and every future reload.
    // This only applies to an actual reload -- a fresh incoming
    // navigation with a #hash (e.g. a "Contact us" link from another
    // page) is a real, intentional target and must be left alone so the
    // browser's native scroll-to-fragment can do its job below.
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  if (!reload || !saved) {
    reveal();
    return;
  }

  window.addEventListener("load", function () {
    // Give GSAP's pinned/scrub sections a beat to finish sizing the page
    // before jumping, so the target Y still points at the right spot.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
        window.scrollTo(0, saved);
        reveal();
      });
    });
  });
}
