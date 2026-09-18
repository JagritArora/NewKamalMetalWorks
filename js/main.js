initScrollRestore();

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

function initProcessBelt() {
  var track = document.querySelector(".process-track");
  if (!track) return;

  var scene = track.querySelector('.belt-scene[data-scene="blanking"]');
  var svg = track.querySelector(".blanking-svg");
  var stageCopies = track.querySelectorAll(".stage-copy");
  var stageCount = stageCopies.length;
  if (!stageCount) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.innerWidth < 760;
  var gsapReady = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  var api = window.NKMWBlankingScene;

  if (reduceMotion || isMobile || !gsapReady || !api || !svg) {
    track.classList.add("is-static");
    stageCopies.forEach(function (el) { el.classList.add("is-active"); });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C4501C";

  // The whole four-station scene (Blanking -> Punching -> Bending ->
  // Coating/Polishing) is one continuous authored choreography, so the
  // entire scroll track maps straight onto its 0..TOTAL timeline. Clamp at
  // END_T so the finished part just holds on station 04 instead of riding
  // through the authored loop's camera pull-back to press 01.
  var endT = api.END_T || api.TOTAL;
  function update(p) {
    var scaledP = p * stageCount;
    var activeIndex = Math.min(Math.floor(scaledP), stageCount - 1);

    if (scene) scene.classList.add("is-active");
    api.render(svg, Math.min(p * api.TOTAL, endT), { dark: isDark, accent: accent, labels: false });

    stageCopies.forEach(function (el, i) {
      el.classList.toggle("is-active", i === activeIndex);
    });
  }

  var trigger = ScrollTrigger.create({
    trigger: track,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.85,
    onUpdate: function (self) { update(self.progress); }
  });

  update(trigger.progress);
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

  var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C4501C";

  var activeIndex = 0;
  var rafId = null;
  var sectionVisible = false;

  function frame(now) {
    var entry = entries[activeIndex];
    if (entry) {
      var t = (now / 1000) % entry.api.TOTAL;
      entry.api.render(entry.svg, t, { dark: isDark, accent: accent });
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
    saveTimer = setTimeout(save, 120);
  }, { passive: true });
  window.addEventListener("beforeunload", save);

  if (!isReload()) return;

  var saved;
  try { saved = parseInt(sessionStorage.getItem(KEY), 10); } catch (e) { saved = 0; }
  if (!saved) return;

  window.addEventListener("load", function () {
    // Give GSAP's pinned/scrub sections a beat to finish sizing the page
    // before jumping, so the target Y still points at the right spot.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
        window.scrollTo(0, saved);
      });
    });
  });
}
