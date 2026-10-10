// The one list of tools and their order (01, 02, ...). The Welcome page's
// Quick Actions are arranged and numbered from it, and each tool page's
// header badge ("03 · Purchases") reads its number from it -- so moving
// a tool, or adding one, is a change to this list alone (plus the new
// tile in welcome.html, which can sit anywhere in its grid).
(function () {
  var TOOLS = [
    "billing.html",     // Generate a New Invoice (the big tile)
    "supply.html",      // Supply Overview
    "purchases.html",   // Purchase Register
    "payments.html",    // Payment Info
    "inspection.html",  // Inspection Report
    "invoices.html"     // Historical Invoices
  ];
  function pad(n) { return String(n).padStart(2, "0"); }
  function page(href) { return (href || "").split(/[?#]/)[0].split("/").pop().replace(/\.html$/, "") || "index"; }
  var order = TOOLS.map(page);
  function rank(href) {
    var i = order.indexOf(page(href));
    return i === -1 ? order.length : i;
  }

  // A tool page: number its header badge.
  var badge = document.querySelector(".page-hero-index");
  var here = order.indexOf(page(location.pathname));
  if (badge && here !== -1) badge.textContent = pad(here + 1);

  // The Welcome page: put the tiles in list order (tiles not in the list
  // keep their place after those that are), number them, stagger their
  // entrance in that order, and count them in the heading. Danger Zone
  // stays last.
  var grid = document.querySelector(".qa-grid");
  if (!grid) return;
  var danger = grid.querySelector(".qa-card--danger");
  var tiles = Array.prototype.filter.call(grid.children, function (el) {
    return el.classList.contains("qa-card") && el !== danger;
  });
  tiles = tiles.map(function (el, i) { return { el: el, i: i }; })
    .sort(function (a, b) { return rank(a.el.getAttribute("href")) - rank(b.el.getAttribute("href")) || a.i - b.i; })
    .map(function (t) { return t.el; });
  tiles.forEach(function (el, i) {
    grid.insertBefore(el, danger);
    var index = el.querySelector(".qa-index");
    if (index) index.textContent = pad(i + 1);
    el.style.setProperty("--i", i);
  });
  if (danger) danger.style.setProperty("--i", tiles.length);
  var count = document.getElementById("qa-count");
  if (count) count.textContent = pad(tiles.length) + " tools · Billing & Purchases";
})();
