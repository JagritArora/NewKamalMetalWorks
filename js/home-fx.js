// Homepage motion + data visuals. Everything here is progressive: with
// JS off the page reads exactly the same, just without the movement.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = typeof IntersectionObserver !== "undefined";
  var thisYear = new Date().getFullYear();
  var FOUNDED = 1999;

  function onVisible(els, cb, opts) {
    if (!hasIO) { els.forEach(cb); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { cb(e.target); io.unobserve(e.target); }
      });
    }, opts || { threshold: 0.35 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---- Split headings into masked words that rise in, one after another.
  var HEADINGS = ".hero-headline, .section-heading, .mat-panel-title, .tooling-title, .qual-title, .profile-title, .contact-title, .footer-cta-title";
  function splitWords(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span");
            w.className = "w";
            var inner = document.createElement("span");
            inner.className = "wi";
            inner.style.setProperty("--wi", i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    })(el);
    el.classList.add("split");
  }
  if (!reduce) {
    var heads = Array.prototype.slice.call(document.querySelectorAll(HEADINGS));
    heads.forEach(splitWords);
    var hero = document.querySelector(".hero-headline");
    if (hero) requestAnimationFrame(function () { hero.classList.add("in-view"); });
    onVisible(heads.filter(function (h) { return h !== hero; }), function (h) { h.classList.add("in-view"); }, { threshold: 0.4 });
  }

  // ---- Generic "in view" flag for CSS-driven visuals (timelines, seals, steps).
  onVisible(Array.prototype.slice.call(document.querySelectorAll(".stat-card, .tooling-flow")), function (el) {
    el.classList.add("in-view");
  }, { threshold: 0.3 });

  // ---- Counters.
  function countUp(el) {
    var target = el.dataset.count === "years" ? thisYear - FOUNDED : parseInt(el.dataset.count, 10);
    if (reduce || isNaN(target)) { el.textContent = String(target); return; }
    var start = null, dur = 1400;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.max(0, Math.min(1, (now - start) / dur));
      var eased = 1 - Math.pow(1 - t, 4);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  onVisible(Array.prototype.slice.call(document.querySelectorAll("[data-count]")), countUp, { threshold: 0.6 });
  document.querySelectorAll("[data-year-now]").forEach(function (el) { el.textContent = String(thisYear); });

  // ---- Marquee: duplicate the track so it loops seamlessly.
  document.querySelectorAll("[data-marquee] .marquee-track").forEach(function (track) {
    var copy = track.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    track.parentNode.appendChild(copy);
  });

  // ---- Materials: filter by what the part needs.
  var chips = document.querySelectorAll(".mat-chip");
  var tiles = document.querySelectorAll(".mat-tile[data-traits]");
  var countEl = document.querySelector(".mat-filter-count");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var trait = chip.dataset.trait;
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var n = 0;
      tiles.forEach(function (t) {
        var match = trait === "all" || (" " + t.dataset.traits + " ").indexOf(" " + trait + " ") !== -1;
        t.classList.toggle("is-dim", !match);
        t.classList.toggle("is-match", match && trait !== "all");
        if (match) n++;
      });
      if (countEl) countEl.textContent = trait === "all" ? "" : n + (n === 1 ? " match" : " matches");
    });
  });

  // ---- Certification countdown.
  document.querySelectorAll("[data-valid-until]").forEach(function (box) {
    var until = new Date(box.dataset.validUntil + "T00:00:00");
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.max(0, Math.round((until - today) / 86400000));
    var num = box.querySelector("[data-days-left]");
    if (!num) return;
    if (reduce || !hasIO) { num.textContent = days.toLocaleString("en-IN"); return; }
    num.textContent = "0";
    onVisible([box], function () {
      var start = null;
      function frame(now) {
        if (start === null) start = now;
        var t = Math.max(0, Math.min(1, (now - start) / 1600));
        num.textContent = Math.round(days * (1 - Math.pow(1 - t, 4))).toLocaleString("en-IN");
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }, { threshold: 0.5 });
  });

  // ---- Cursor spotlight on cards.
  var queued = false, last = null;
  document.addEventListener("pointermove", function (e) {
    last = e;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var card = last.target.closest && last.target.closest(".spot");
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (last.clientX - r.left) + "px");
      card.style.setProperty("--my", (last.clientY - r.top) + "px");
    });
  }, { passive: true });

  // ---- Touch screens have no hover, so whichever card sits in the middle
  // band of the screen gets the same lit-up treatment instead.
  var noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
  if (noHover && hasIO && !reduce) {
    var focusables = document.querySelectorAll(".spot, .stat-card, .tooling-tile, .qtl-card, .profile-facts li");
    var focusIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("is-focus", e.isIntersecting); });
    }, { rootMargin: "-38% 0px -38% 0px", threshold: 0 });
    focusables.forEach(function (el) { focusIO.observe(el); });
  }

  // ---- Mobile menu: mirror the open state onto the toggle so it can
  // morph into a close icon (main.js owns the actual open/close).
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (navToggle && navLinks && typeof MutationObserver !== "undefined") {
    var syncNav = function () {
      var open = navLinks.classList.contains("open");
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    new MutationObserver(syncNav).observe(navLinks, { attributes: true, attributeFilter: ["class"] });
    syncNav();
  }

  // ---- Scroll-linked values: page progress, quality timeline fill,
  // and the drifting "1999" watermark.
  var qtl = document.querySelector("[data-qtl]");
  var qSteps = qtl ? qtl.querySelectorAll(".qtl-step") : [];
  var watermark = document.querySelector("[data-parallax]");
  var ticking = false;
  function update() {
    ticking = false;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    root.style.setProperty("--scroll", Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4));

    var vh = window.innerHeight;
    if (qtl) {
      var r = qtl.getBoundingClientRect();
      var mark = vh * 0.6;
      var p = Math.min(1, Math.max(0, (mark - r.top) / Math.max(1, r.height)));
      qtl.style.setProperty("--p", p.toFixed(4));
      qSteps.forEach(function (step) {
        var node = step.querySelector(".qtl-node");
        var nr = node.getBoundingClientRect();
        step.classList.toggle("is-on", nr.top + nr.height / 2 <= mark);
      });
    }
    if (watermark && !reduce) {
      var wr = watermark.parentNode.getBoundingClientRect();
      var rel = (wr.top + wr.height / 2 - vh / 2) / vh;
      watermark.style.setProperty("--drift", (rel * 80).toFixed(1) + "px");
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
