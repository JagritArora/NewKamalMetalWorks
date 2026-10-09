// Themed date picker -- replaces the browser's native calendar (which
// can't be styled) with one that matches the site. Values are plain
// "YYYY-MM-DD" strings, the same format an <input type="date"> uses.
//
//   var p = NKDatePicker.create({ value, min, max, placeholder, clearable, onChange });
//   container.appendChild(p.el);  p.value;  p.setMin(v);  p.setMax(v);
//
// The calendar popover is attached to <body> with fixed positioning while
// open, so it's never clipped by a scrolling table or card around it.
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  var PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toKey(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function todayKey() { var t = new Date(); return toKey(t.getFullYear(), t.getMonth(), t.getDate()); }
  function parseKey(k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || "");
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }
  function label(k) {
    var p = parseKey(k);
    return p ? pad(p.d) + " " + MONTHS[p.m].slice(0, 3) + " " + p.y : "";
  }

  var openPicker = null;

  function create(opts) {
    opts = opts || {};
    var state = {
      value: opts.value || "",
      min: opts.min || "",
      max: opts.max || "",
      view: null
    };

    var el = document.createElement("div");
    el.className = "dp" + (opts.compact ? " dp--compact" : "");
    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dp-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = ICON + '<span class="dp-label"></span>';
    el.appendChild(trigger);
    var labelEl = trigger.querySelector(".dp-label");

    var pop = null;

    function syncLabel() {
      labelEl.textContent = state.value ? label(state.value) : (opts.placeholder || "Select date");
      el.classList.toggle("has-value", !!state.value);
    }
    syncLabel();

    function disabled(k) {
      return (state.min && k < state.min) || (state.max && k > state.max);
    }

    function render(direction) {
      var v = state.view;
      var first = new Date(v.y, v.m, 1);
      var offset = (first.getDay() + 6) % 7;
      var daysIn = new Date(v.y, v.m + 1, 0).getDate();
      var today = todayKey();
      var cells = "";
      for (var i = 0; i < offset; i++) cells += '<span class="dp-cell dp-cell--blank"></span>';
      for (var d = 1; d <= daysIn; d++) {
        var k = toKey(v.y, v.m, d);
        var cls = "dp-cell dp-day";
        if (k === state.value) cls += " is-selected";
        if (k === today) cls += " is-today";
        var dis = disabled(k);
        cells += '<button type="button" class="' + cls + '" data-key="' + k + '"' + (dis ? " disabled" : "") + ">" + d + "</button>";
      }
      pop.querySelector(".dp-title").textContent = MONTHS[v.m] + " " + v.y;
      var grid = pop.querySelector(".dp-grid");
      grid.innerHTML = cells;
      grid.classList.remove("dp-slide-left", "dp-slide-right");
      if (direction) {
        void grid.offsetWidth;
        grid.classList.add(direction > 0 ? "dp-slide-left" : "dp-slide-right");
      }
      var todayBtn = pop.querySelector(".dp-today");
      todayBtn.disabled = disabled(today);
    }

    function position() {
      if (!pop) return;
      if (!document.body.contains(trigger)) { close(); return; }
      var r = trigger.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = opts.align === "right" ? r.right - pw : r.left;
      left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
      var top = r.bottom + 8;
      var above = top + ph > window.innerHeight - 12 && r.top - ph - 8 > 12;
      if (above) top = r.top - ph - 8;
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.classList.toggle("is-above", above);
    }

    function open() {
      if (openPicker && openPicker !== api) openPicker.close();
      var base = parseKey(state.value) || parseKey(state.max && state.max < todayKey() ? state.max : todayKey());
      state.view = { y: base.y, m: base.m };
      pop = document.createElement("div");
      pop.className = "dp-pop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Choose a date");
      pop.innerHTML =
        '<div class="dp-head">' +
          '<button type="button" class="dp-nav dp-prev" aria-label="Previous month">' + PREV + "</button>" +
          '<span class="dp-title"></span>' +
          '<button type="button" class="dp-nav dp-next" aria-label="Next month">' + NEXT + "</button>" +
        "</div>" +
        '<div class="dp-weekdays">' + DAYS.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div>" +
        '<div class="dp-grid"></div>' +
        '<div class="dp-foot">' +
          '<button type="button" class="dp-link dp-today">Today</button>' +
          (opts.clearable ? '<button type="button" class="dp-link dp-clear">Clear</button>' : "") +
        "</div>";
      document.body.appendChild(pop);
      render(0);
      position();
      requestAnimationFrame(function () { if (pop) pop.classList.add("is-open"); });
      trigger.setAttribute("aria-expanded", "true");
      el.classList.add("is-open");
      openPicker = api;

      pop.addEventListener("click", function (e) {
        var t = e.target.closest("button");
        if (!t || t.disabled) return;
        if (t.classList.contains("dp-prev")) { shiftMonth(-1); return; }
        if (t.classList.contains("dp-next")) { shiftMonth(1); return; }
        if (t.classList.contains("dp-today")) { choose(todayKey()); return; }
        if (t.classList.contains("dp-clear")) { choose(""); return; }
        if (t.dataset.key) choose(t.dataset.key);
      });
      var sel = pop.querySelector(".is-selected") || pop.querySelector(".is-today:not([disabled])");
      if (sel) sel.focus({ preventScroll: true });
    }

    function shiftMonth(delta) {
      var m = state.view.m + delta;
      state.view = { y: state.view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
      render(delta);
    }

    function choose(k) {
      state.value = k;
      syncLabel();
      close();
      trigger.focus({ preventScroll: true });
      if (opts.onChange) opts.onChange(k);
    }

    function close() {
      if (!pop) return;
      var p = pop;
      pop = null;
      p.classList.remove("is-open");
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 180);
      trigger.setAttribute("aria-expanded", "false");
      el.classList.remove("is-open");
      if (openPicker === api) openPicker = null;
    }

    trigger.addEventListener("click", function () {
      if (el.classList.contains("is-locked")) return;
      if (pop) close(); else open();
    });

    var api = {
      el: el,
      get value() { return state.value; },
      set value(v) { state.value = v || ""; syncLabel(); },
      setMin: function (v) { state.min = v || ""; },
      setMax: function (v) { state.max = v || ""; },
      setLocked: function (locked) {
        el.classList.toggle("is-locked", !!locked);
        trigger.setAttribute("aria-disabled", locked ? "true" : "false");
        if (locked) close();
      },
      focus: function () { trigger.focus({ preventScroll: true }); },
      open: open,
      close: close,
      _position: position,
      _owns: function (node) { return el.contains(node) || (pop && pop.contains(node)); }
    };
    return api;
  }

  document.addEventListener("mousedown", function (e) {
    if (openPicker && !openPicker._owns(e.target)) openPicker.close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openPicker) openPicker.close();
  });
  window.addEventListener("scroll", function () { if (openPicker) openPicker._position(); }, true);
  window.addEventListener("resize", function () { if (openPicker) openPicker._position(); });

  // Upgrade an existing <input type="date"> in place: the native input
  // stays (visually hidden) as the source of truth, so page scripts keep
  // reading/setting .value, toggling readOnly/min/max and listening for
  // "change" exactly as before.
  var inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  function enhance(input) {
    if (input.__nkd || input.hasAttribute("data-native")) return;
    input.__nkd = true;
    var picker = create({
      value: inputValue.get.call(input),
      min: input.min,
      max: input.max,
      placeholder: input.placeholder || "Select date",
      clearable: input.hasAttribute("data-clearable"),
      onChange: function (v) {
        inputValue.set.call(input, v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    input.parentNode.insertBefore(picker.el, input);
    picker.el.appendChild(input);
    input.classList.add("nks-native");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    if (input.id) {
      var lbl = document.querySelector('label[for="' + input.id + '"]');
      if (lbl) {
        if (!lbl.id) lbl.id = input.id + "-dp-label";
        picker.el.querySelector(".dp-trigger").setAttribute("aria-labelledby", lbl.id);
      }
    }
    function sync() {
      picker.value = inputValue.get.call(input);
      picker.setMin(input.min);
      picker.setMax(input.max);
      picker.setLocked(input.readOnly || input.disabled);
      picker.el.hidden = input.hidden;
    }
    Object.defineProperty(input, "value", {
      configurable: true,
      get: function () { return inputValue.get.call(input); },
      set: function (v) { inputValue.set.call(input, v); sync(); }
    });
    new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ["min", "max", "readonly", "disabled", "hidden"] });
    input.addEventListener("change", sync);
    input.addEventListener("focus", function () { picker.focus(); });
    sync();
  }
  function scan(root) {
    if (root.matches && root.matches('input[type="date"]')) enhance(root);
    else if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('input[type="date"]'), enhance);
  }
  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.NKDatePicker = { create: create, enhance: enhance, today: todayKey };
})();
