// Themed dropdowns -- a native <select> list can't be styled, so each one
// gets a site-themed button + popover list layered over it. The native
// <select> stays in the DOM (visually hidden) as the single source of
// truth: page scripts keep reading/setting .value, rebuilding options and
// listening for "change" exactly as before, and this only mirrors that
// state and writes user picks back through it (firing a real "change").
//
// The popover is attached to <body> with fixed positioning while open, so
// a scrolling table or card around the select never clips it. Selects
// added later (e.g. new invoice rows) are picked up automatically.
(function () {
  var valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  var indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  var finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var SEARCH_THRESHOLD = 8;
  var CHEVRON = '<svg class="nks-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK = '<svg class="nks-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  var openInst = null;
  var uid = 0;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  function enhance(sel) {
    if (sel.__nks || sel.multiple || sel.size > 1 || sel.hasAttribute("data-native")) return;
    sel.__nks = true;
    var id = "nks-" + (++uid);

    var wrap = document.createElement("div");
    wrap.className = "nks";
    if (sel.closest(".billing-items-table, .billing-ratecard-table")) wrap.classList.add("nks--compact");
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add("nks-native");
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "nks-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<span class="nks-label"></span>' + CHEVRON;
    wrap.appendChild(trigger);
    var labelEl = trigger.querySelector(".nks-label");
    if (sel.id) {
      var lbl = document.querySelector('label[for="' + sel.id + '"]');
      if (lbl) {
        if (!lbl.id) lbl.id = id + "-label";
        trigger.setAttribute("aria-labelledby", lbl.id + " " + id + "-value");
      }
    }
    labelEl.id = id + "-value";

    var pop = null, list = null, search = null, items = [], active = -1;

    function refresh() {
      var opt = sel.options[indexDesc.get.call(sel)];
      var text = opt ? opt.textContent : "";
      labelEl.textContent = text || " ";
      wrap.classList.toggle("is-placeholder", !opt || opt.value === "");
      trigger.disabled = sel.disabled;
      wrap.classList.toggle("is-disabled", sel.disabled);
      wrap.hidden = sel.hidden;
      if (pop) renderList(search ? search.value : "");
    }

    Object.defineProperty(sel, "value", {
      configurable: true,
      get: function () { return valueDesc.get.call(sel); },
      set: function (v) { valueDesc.set.call(sel, v); refresh(); }
    });
    Object.defineProperty(sel, "selectedIndex", {
      configurable: true,
      get: function () { return indexDesc.get.call(sel); },
      set: function (v) { indexDesc.set.call(sel, v); refresh(); }
    });
    new MutationObserver(refresh).observe(sel, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["disabled", "hidden", "selected", "label"]
    });
    sel.addEventListener("change", refresh);
    sel.addEventListener("focus", function () { trigger.focus(); });
    refresh();

    function renderList(query) {
      var q = (query || "").trim().toLowerCase();
      var current = indexDesc.get.call(sel);
      var html = "";
      items = [];
      var lastGroup = null;
      Array.prototype.forEach.call(sel.options, function (o, i) {
        if (o.hidden) return;
        var text = o.textContent;
        if (q && text.toLowerCase().indexOf(q) === -1) return;
        var group = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
        if (group && group !== lastGroup) html += '<div class="nks-group">' + escapeHtml(group) + "</div>";
        lastGroup = group;
        var cls = "nks-opt";
        if (i === current) cls += " is-selected";
        if (o.disabled) cls += " is-disabled";
        if (o.value === "") cls += " is-placeholder";
        html += '<div class="' + cls + '" role="option" id="' + id + "-o" + i + '" data-index="' + i + '" aria-selected="' + (i === current) + '">' +
          '<span class="nks-opt-text">' + escapeHtml(text) + "</span>" + CHECK + "</div>";
        if (!o.disabled) items.push(i);
      });
      list.innerHTML = html || '<div class="nks-empty">No matches</div>';
      var startAt = items.indexOf(current);
      setActive(startAt === -1 ? (q ? 0 : -1) : startAt, true);
    }

    function setActive(pos, center) {
      var prev = list.querySelector(".is-active");
      if (prev) prev.classList.remove("is-active");
      active = pos;
      if (pos < 0 || pos >= items.length) { trigger.removeAttribute("aria-activedescendant"); return; }
      var el = list.querySelector('[data-index="' + items[pos] + '"]');
      if (!el) return;
      el.classList.add("is-active");
      trigger.setAttribute("aria-activedescendant", el.id);
      var top = el.offsetTop, bottom = top + el.offsetHeight;
      if (center) list.scrollTop = Math.max(0, top - list.clientHeight / 2 + el.offsetHeight / 2);
      else if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }

    function position() {
      if (!pop) return;
      if (!document.body.contains(trigger)) { close(); return; }
      var r = trigger.getBoundingClientRect();
      pop.style.minWidth = Math.max(r.width, 200) + "px";
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
      var top = r.bottom + 8;
      var above = top + ph > window.innerHeight - 12 && r.top - ph - 8 > 12;
      if (above) top = r.top - ph - 8;
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.classList.toggle("is-above", above);
    }

    function open() {
      if (sel.disabled) return;
      if (openInst && openInst !== inst) openInst.close();
      pop = document.createElement("div");
      pop.className = "nks-pop";
      var withSearch = sel.options.length > SEARCH_THRESHOLD;
      pop.innerHTML = (withSearch ? '<label class="nks-search">' + SEARCH + '<input type="text" placeholder="Search…" autocomplete="off" spellcheck="false" /></label>' : "") +
        '<div class="nks-list" role="listbox" id="' + id + '-list"></div>';
      document.body.appendChild(pop);
      list = pop.querySelector(".nks-list");
      search = pop.querySelector(".nks-search input");
      trigger.setAttribute("aria-controls", id + "-list");
      renderList("");
      position();
      requestAnimationFrame(function () { if (pop) pop.classList.add("is-open"); });
      trigger.setAttribute("aria-expanded", "true");
      wrap.classList.add("is-open");
      openInst = inst;

      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      list.addEventListener("click", function (e) {
        var o = e.target.closest(".nks-opt");
        if (!o || o.classList.contains("is-disabled")) return;
        choose(+o.dataset.index);
      });
      list.addEventListener("mousemove", function (e) {
        var o = e.target.closest(".nks-opt");
        if (!o) return;
        var pos = items.indexOf(+o.dataset.index);
        if (pos !== -1 && pos !== active) setActive(pos, false);
      });
      if (search) {
        search.addEventListener("input", function () { renderList(search.value); position(); });
        search.addEventListener("keydown", onKey);
        if (finePointer) search.focus({ preventScroll: true });
      }
    }

    function close() {
      if (!pop) return;
      var p = pop;
      pop = null;
      p.classList.remove("is-open");
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 180);
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      wrap.classList.remove("is-open");
      if (openInst === inst) openInst = null;
    }

    function choose(i) {
      var changed = indexDesc.get.call(sel) !== i;
      indexDesc.set.call(sel, i);
      close();
      trigger.focus({ preventScroll: true });
      refresh();
      if (changed) {
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    var typed = "", typedAt = 0;
    function onKey(e) {
      if (!pop) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); close(); trigger.focus(); return; }
      if (e.key === "Tab") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1), false); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, active - 1), false); return; }
      if (e.key === "Home") { e.preventDefault(); setActive(0, false); return; }
      if (e.key === "End") { e.preventDefault(); setActive(items.length - 1, false); return; }
      if (e.key === "Enter" || (e.key === " " && !search)) {
        e.preventDefault();
        if (active >= 0) choose(items[active]);
        return;
      }
      if (!search && e.key.length === 1) {
        var now = Date.now();
        typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
        typedAt = now;
        for (var k = 0; k < items.length; k++) {
          if (sel.options[items[k]].textContent.toLowerCase().indexOf(typed) === 0) { setActive(k, false); break; }
        }
      }
    }

    trigger.addEventListener("click", function () { if (pop) close(); else open(); });
    trigger.addEventListener("keydown", onKey);

    var inst = {
      close: close,
      position: position,
      owns: function (node) { return wrap.contains(node) || (pop && pop.contains(node)); }
    };
  }

  function scan(root) {
    if (root.tagName === "SELECT") enhance(root);
    else if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll("select"), enhance);
  }

  document.addEventListener("mousedown", function (e) {
    if (openInst && !openInst.owns(e.target)) openInst.close();
  });
  window.addEventListener("scroll", function (e) {
    if (!openInst) return;
    if (e.target && e.target.classList && e.target.classList.contains("nks-list")) return;
    openInst.position();
  }, true);
  window.addEventListener("resize", function () { if (openInst) openInst.position(); });

  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
