// Presentation-only effects shared by the signed-in pages: a cursor
// glow on cards, count-up for stat tiles, and a click ripple on buttons.
// Nothing here reads or changes app data -- it only decorates what the
// page scripts already render.
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var GLOW_SELECTOR = ".billing-card, .stat-tile, .tile-card, .login-card, .confirm-dialog";
  var pending = null;
  var queued = false;
  document.addEventListener("pointermove", function (e) {
    pending = e;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var ev = pending;
      if (!ev || !ev.target || !ev.target.closest) return;
      var card = ev.target.closest(GLOW_SELECTOR);
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (ev.clientX - r.left) + "px");
      card.style.setProperty("--my", (ev.clientY - r.top) + "px");
    });
  }, { passive: true });

  var RIPPLE_SELECTOR = ".btn-primary, .btn-danger, .billing-seed-btn, .confirm-dialog-confirm, .insp-view-btn";
  document.addEventListener("pointerdown", function (e) {
    if (reduceMotion || !e.target.closest) return;
    var btn = e.target.closest(RIPPLE_SELECTOR);
    if (!btn || btn.disabled) return;
    var r = btn.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 2;
    var dot = document.createElement("span");
    dot.className = "fx-ripple";
    dot.setAttribute("aria-hidden", "true");
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = (e.clientX - r.left - size / 2) + "px";
    dot.style.top = (e.clientY - r.top - size / 2) + "px";
    btn.appendChild(dot);
    setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 650);
  }, { passive: true });

  // Count-up: whenever a page script writes a new number into a
  // .stat-tile-value, roll from the previous number to the new one while
  // keeping its exact prefix/suffix and decimal places.
  var NUM_RE = /^(\D*?)(-?[\d,]+(?:\.\d+)?)(.*)$/;
  function parse(text) {
    var m = NUM_RE.exec(text || "");
    if (!m) return null;
    var digits = m[2];
    var dot = digits.indexOf(".");
    return {
      prefix: m[1],
      value: parseFloat(digits.replace(/,/g, "")),
      decimals: dot === -1 ? 0 : digits.length - dot - 1,
      suffix: m[3]
    };
  }
  function animateValue(el) {
    var finalText = el.textContent;
    if (finalText === el.__fxLast) return;
    var target = parse(finalText);
    var from = el.__fxValue || 0;
    if (!target || reduceMotion || isNaN(target.value)) {
      el.__fxValue = target ? target.value : 0;
      return;
    }
    if (el.__fxRaf) cancelAnimationFrame(el.__fxRaf);
    var start = null;
    var duration = 750;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.max(0, Math.min(1, (now - start) / duration));
      var eased = 1 - Math.pow(1 - t, 3);
      var v = from + (target.value - from) * eased;
      var text = t < 1
        ? target.prefix + v.toLocaleString("en-IN", { minimumFractionDigits: target.decimals, maximumFractionDigits: target.decimals }) + target.suffix
        : finalText;
      el.__fxLast = text;
      el.textContent = text;
      if (t < 1) el.__fxRaf = requestAnimationFrame(frame);
      else { el.__fxRaf = null; el.__fxValue = target.value; }
    }
    el.__fxRaf = requestAnimationFrame(frame);
  }
  function watch(el) {
    new MutationObserver(function () { animateValue(el); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  document.querySelectorAll(".stat-tile-value").forEach(watch);
})();
