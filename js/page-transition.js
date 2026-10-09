// Page open/leave transition -- a veil in the page's background colour
// with three "stamping" bars (the brand's loader motif) that lifts on
// load, and drops back in briefly before following a same-site link.
// Loaded synchronously as the first thing in <body> so the veil is in
// place before anything paints. Purely visual: it never blocks clicks
// and removes itself; reduced-motion users skip it entirely.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !document.body) return;

  var veil = document.createElement("div");
  veil.className = "pt-veil is-entering";
  veil.setAttribute("aria-hidden", "true");
  veil.innerHTML = '<div class="pt-mark"><span></span><span></span><span></span></div>';
  document.body.insertBefore(veil, document.body.firstChild);

  function settle() { veil.classList.remove("is-entering", "is-leaving"); }
  veil.addEventListener("animationend", function (e) {
    if (e.target === veil && veil.classList.contains("is-entering")) settle();
  });
  setTimeout(function () { if (veil.classList.contains("is-entering")) settle(); }, 1400);

  // Back/forward cache restores the page exactly as it was left -- veil
  // down -- so lift it again.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      veil.classList.remove("is-leaving");
      void veil.offsetWidth;
      veil.classList.add("is-entering");
    }
  });

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    veil.classList.remove("is-entering");
    void veil.offsetWidth;
    veil.classList.add("is-leaving");
    setTimeout(function () { location.href = url.href; }, 340);
  });
})();
