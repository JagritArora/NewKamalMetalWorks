/* Vanilla port of the "Sheet Metal Blanking Animation" design-tool scene
   (notching-scene.jsx) — same axonometric projection, die/blade/tray
   geometry and cut choreography, re-authored as a small continuously
   looping "hero" tile instead of a scroll-driven full-page station.
   Real mechanism preserved: a flat sheet arrives, the blade descends and
   shears one open notch out of its near edge, the slug drops into the
   tray, the blade retracts and the notched sheet leaves. The long
   factory-floor belt travel from the original 10s scene (sheet feeding in
   from -2450 world units and exiting out to +2350) has been shortened and
   the camera framed tight on just the die/blade/tray so it reads at
   ~500x175px. No React, no iframe: this writes plain SVG markup into an
   element already sitting in the page. */
(function () {
  "use strict";

  var EX = [1, 0.13], EY = [0, -1], EZ = [0.52, -0.32];
  function P(x, y, z) { return [x * EX[0] + y * EY[0] + z * EZ[0], x * EX[1] + y * EY[1] + z * EZ[1]]; }
  function tv(x, y, z) { var p = P(x, y, z); return 'translate(' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + ')'; }
  function poly(list) {
    var s = '';
    for (var i = 0; i < list.length; i++) {
      var p = P(list[i][0], list[i][1] || 0, list[i][2]);
      s += (i ? ' ' : '') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }
    return s;
  }
  function pathOf(list) {
    var s = '';
    for (var i = 0; i < list.length; i++) {
      var p = P(list[i][0], list[i][1] || 0, list[i][2]);
      s += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    return s + 'Z';
  }
  function seg(t, t0, t1, v0, v1, ease) {
    if (t <= t0) return v0;
    if (t >= t1) return v1;
    var u = (t - t0) / (t1 - t0);
    return v0 + (v1 - v0) * (ease ? ease(u) : u);
  }
  // piecewise keyframe track: ks = [[time, value], ...] in ascending time
  function track(t, ks, ease) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) return seg(t, ks[i - 1][0], ks[i][0], ks[i - 1][1], ks[i][1], ease);
    }
    return ks[ks.length - 1][1];
  }

  var Easing = {
    easeInQuad: function (t) { return t * t; },
    easeOutQuad: function (t) { return t * (2 - t); },
    easeInOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    easeOutCubic: function (t) { t = t - 1; return t * t * t + 1; },
    easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    easeOutQuart: function (t) { t = t - 1; return 1 - t * t * t * t; }
  };

  // ---- geometry (identical to notching-scene.jsx: real sheet/notch/die
  // dimensions, unchanged) ----
  var TH = 10;                 // sheet thickness
  var SU = 300, SV = 190;      // half-length / half-width of the flat sheet
  var NC = 90;                 // notch centred on this point of the near edge
  var BELT_V = 240;
  var PARK = -NC;              // sheet x when the notch sits under the blade

  // the open notch is cut out of the near edge — never a hole in the field
  function notchU(w) { return [NC - w / 2, NC + w / 2]; }
  function sheetPath(w, d) {
    var n = notchU(w);
    return pathOf([
      [-SU, 0, SV], [SU, 0, SV], [SU, 0, -SV],
      [n[1], 0, -SV], [n[1], 0, -SV + d], [n[0], 0, -SV + d], [n[0], 0, -SV],
      [-SU, 0, -SV]
    ]);
  }
  var FLAT = pathOf([[-SU, 0, -SV], [SU, 0, -SV], [SU, 0, SV], [-SU, 0, SV]]);
  function slugList(w, d) {
    var n = notchU(w);
    return [[n[0], 0, -SV + d], [n[1], 0, -SV + d], [n[1], 0, -SV - 1], [n[0], 0, -SV - 1]];
  }
  function slugPath(w, d) { return pathOf(slugList(w, d)); }

  function box(x0, x1, y0, y1, z0, z1) {
    return {
      top: poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
      front: poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]),
      right: poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]])
    };
  }
  function boxSvg(x0, x1, y0, y1, z0, z1, fills) {
    var b = box(x0, x1, y0, y1, z0, z1);
    return '<g><polygon points="' + b.right + '" fill="' + fills[2] + '"/>' +
      '<polygon points="' + b.front + '" fill="' + fills[1] + '"/>' +
      '<polygon points="' + b.top + '" fill="' + fills[0] + '"/></g>';
  }

  function theme(dark) {
    return dark ? {
      bg: '#17181a', ink: '#e8e6e4', grid: 'rgba(255,255,255,0.055)',
      top: '#4c4f52', front: '#32353a', right: '#23262a',
      beltTop: '#2a2c2f', beltEdge: '#1d1f22', slat: '#3a3d41', dieTop: '#3f4347',
      sheet: 'url(#ntcGSheetD)', sheetEdge: '#6f7479', cavity: '#101113', shadow: 'rgba(0,0,0,0.55)'
    } : {
      bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
      top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
      beltTop: '#5f6266', beltEdge: '#43464a', slat: '#74787c', dieTop: '#9b9ea2',
      sheet: 'url(#ntcGSheet)', sheetEdge: '#9ea3a8', cavity: '#6e7276', shadow: 'rgba(32,30,29,0.22)'
    };
  }

  // ---- parts ------------------------------------------------------------
  function floorSvg(k) {
    var lines = [], x, z, p1, p2;
    for (z = -320; z <= 320; z += 160) {
      p1 = P(-900, -240, z); p2 = P(900, -240, z);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    for (x = -900; x <= 900; x += 160) {
      p1 = P(x, -240, -320); p2 = P(x, -240, 320);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    return '<g stroke="' + k.grid + '" stroke-width="2" fill="none">' + lines.join('') + '</g>';
  }

  // press housing — same fixed dimensions as the authored scene; the tight
  // tile camera crops most of the tall posts out of frame on purpose, only
  // their inner edges and the accent crossbar read at this size
  function pressFrameSvg(k, accent) {
    var F = [k.top, k.front, k.right];
    var s = boxSvg(-430, -360, -230, 620, 220, 330, F);
    s += boxSvg(360, 430, -230, 620, 220, 330, F);
    s += boxSvg(-490, 490, 620, 720, 190, 360, F);
    s += '<polygon points="' + poly([[-240, 656, 190], [240, 656, 190], [240, 682, 190], [-240, 682, 190]]) + '" fill="' + accent + '" opacity="0.9"/>';
    return s;
  }

  // conveyor — shortened to match the compressed feed/exit travel of the
  // tile loop instead of the factory-floor-length belt of the full scene
  var BELT = [-820, 820];
  var BELT_LEGS = [-620, 620];
  function beltSvg(k, phase, spacing) {
    var F = [k.top, k.front, k.right];
    var x0 = BELT[0], x1 = BELT[1];
    var base = x0 + (((phase % spacing) + spacing) % spacing);
    var slats = '', n = Math.ceil((x1 - x0) / spacing) + 1;
    for (var i = 0; i < n; i++) {
      var x = base + i * spacing;
      if (x > x1 - 8) continue;
      slats += '<polygon points="' + poly([[x, 1, -BELT_V], [x + 8, 1, -BELT_V], [x + 8, 1, BELT_V], [x, 1, BELT_V]]) + '" fill="' + k.slat + '"/>';
    }
    var s = boxSvg(BELT_LEGS[0] - 60, BELT_LEGS[0] + 60, -240, -30, -40, 60, F);
    s += boxSvg(BELT_LEGS[1] - 60, BELT_LEGS[1] + 60, -240, -30, -40, 60, F);
    s += boxSvg(x0, x1, -40, 0, -BELT_V, BELT_V, [k.beltTop, k.beltEdge, k.beltEdge]);
    s += '<g clip-path="url(#ntcClipBelt)">' + slats + '</g>';
    s += boxSvg(x0, x1, 0, 16, -BELT_V - 16, -BELT_V, F);
    return s;
  }

  // lower die: a support table with an opening only under the notch footprint
  function dieSvg(k, w, d) {
    var b = box(-330, 330, -56, 0, -168, 240);
    var s = '<polygon points="' + b.right + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + b.front + '" fill="' + k.right + '"/>';
    s += '<path d="' + slugPath(w, d) + '" transform="translate(0,40)" fill="' + k.cavity + '"/>';
    s += '<path d="' + slugPath(w, d) + '" fill="' + k.cavity + '" opacity="0.92"/>';
    s += '<polygon points="' + b.top + '" fill="' + k.dieTop + '" clip-path="url(#ntcClipDie)"/>';
    return s;
  }

  // small scrap chute + tray directly beneath the die opening — brought in
  // much shallower than the full-station original so the tray bottom
  // stays inside a 175px-tall frame instead of receding far off-screen
  function scrapChuteSvg(k) {
    var s = '<polygon points="' + poly([[NC - 118, -52, -96], [NC + 118, -52, -96], [NC + 150, -150, -205], [NC - 150, -150, -205]]) + '" fill="' + k.right + '" opacity="0.92"/>';
    s += boxSvg(NC - 160, NC + 160, -210, -150, -250, -195, [k.beltEdge, k.right, k.front]);
    s += boxSvg(NC - 160, NC + 160, -150, -130, -205, -195, [k.dieTop, k.right, k.front]);
    return s;
  }

  // upper notching blade: the punch face is exactly the notch footprint
  function bladeSvg(k, y, w, d, accent) {
    var n = notchU(w), cu = (n[0] + n[1]) / 2;
    var s = '<g transform="' + tv(0, y + 54, 0) + '">';
    s += '<path d="' + slugPath(w, d) + '" transform="translate(0,54)" fill="' + k.right + '"/>';
    s += '<path d="' + slugPath(w, d) + '" fill="' + k.front + '"/>';
    s += '</g>';
    s += boxSvg(cu - 102, cu + 102, y + 54, y + 100, -SV - 34, -SV + d + 26, [k.top, k.front, k.right]);
    s += boxSvg(-180, 180, y + 100, y + 148, -SV - 14, 92, [k.top, k.front, k.right]);
    s += boxSvg(-158, 158, y + 148, y + 264, -SV + 6, 72, [k.top, k.front, k.right]);
    s += '<polygon points="' + poly([[-84, y + 224, -SV + 6], [84, y + 224, -SV + 6], [84, y + 248, -SV + 6], [-84, y + 248, -SV + 6]]) + '" fill="' + accent + '" opacity="0.9"/>';
    s += boxSvg(-350, -210, y + 160, y + 232, 230, 300, [k.front, k.right, k.right]);
    s += boxSvg(210, 350, y + 160, y + 232, 230, 300, [k.front, k.right, k.right]);
    return s;
  }

  // datum marks on the sheet plus the notch footprint dashed on the edge
  function indicatorsSvg(o, x, w, d, accent) {
    if (o <= 0.003) return '';
    var n = notchU(w), marks = '';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
      marks += '<polyline points="' + poly([[s[0] * SU - s[0] * 90, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV - s[1] * 90]]) + '"/>';
    });
    var sg = '<g opacity="' + o + '" transform="' + tv(x, 20, 0) + '" stroke="' + accent + '" stroke-width="5" fill="none" stroke-linecap="square">';
    sg += marks;
    sg += '<g stroke-width="4.5" stroke-dasharray="18 11">';
    sg += '<polyline points="' + poly([[n[0], 0, -SV], [n[0], 0, -SV + d], [n[1], 0, -SV + d], [n[1], 0, -SV]]) + '"/>';
    sg += '</g></g>';
    return sg;
  }

  // ---- workpiece: two phases of the same sheet so one is always sliding
  // through while the other is queued, giving the belt a continuous look
  // across the hard loop cut (same trick as the multi-station scene) ----
  function sheetSvg(k, T, C, total, phase, accent, w, d) {
    var E = Easing, a = accent;
    var local = T - phase * total;
    if (local < -1.05 || local > total + 0.05) return '';

    var cut = C.Notch + 0.5;
    var isCut = local >= cut;
    var x = seg(local, -0.85, C.Align, FEED_START, PARK - 30, E.easeOutCubic)
      + seg(local, C.Align + 0.1, C.Notch - 0.15, 0, 30, E.easeInOutCubic)
      + seg(local, C.Exit + 0.1, total - 0.05, 0, EXIT_DIST, E.easeInOutQuad);
    var y = 10 - seg(local, cut, cut + 0.08, 0, 5, E.easeOutQuad)
      + seg(local, C.Retract + 0.1, C.Retract + 0.35, 0, 5, E.easeOutCubic);
    var o = (1 - seg(local, total - 0.35, total, 0, 1)) * seg(local, -0.95, -0.85, 0, 1);

    var edge = seg(local, cut, cut + 0.06, 0, 1) * (1 - seg(local, cut + 0.25, cut + 0.9, 0, 1, E.easeOutQuad));
    var callout = seg(local, C.Retract + 0.15, C.Retract + 0.35, 0, 1) * (1 - seg(local, C.Exit + 0.3, C.Exit + 0.55, 0, 1));
    var dPath = isCut ? sheetPath(w, d) : FLAT;

    var slugY = seg(local, cut + 0.08, C.Drop + 0.45, 0, 132, E.easeInQuad);
    var slugX = seg(local, cut + 0.08, C.Drop + 0.45, 0, 26, E.easeInQuad);
    var slugZ = -seg(local, cut + 0.08, C.Drop + 0.45, 0, 160, E.easeInQuad);
    var slugO = (isCut ? 1 : 0) * (1 - seg(local, C.Drop + 0.25, C.Drop + 0.55, 0, 1));

    var n = notchU(w);
    var s = '<g opacity="' + o + '">';
    s += '<g transform="' + tv(x + 16, 0.8, -18) + '" opacity="0.4"><path d="' + dPath + '" fill="' + k.shadow + '"/></g>';
    s += '<g transform="' + tv(x, y, 0) + '">';
    s += '<path d="' + dPath + '" transform="translate(0,' + TH + ')" fill="' + k.sheetEdge + '"/>';
    s += '<path d="' + dPath + '" fill="' + k.sheet + '"/>';
    s += '<path d="' + dPath + '" fill="none" stroke="' + a + '" stroke-width="5" opacity="' + edge + '"/>';
    if (isCut) {
      s += '<g stroke="' + a + '" stroke-width="4.5" fill="none" opacity="' + (callout * 0.9) + '">';
      s += '<polyline points="' + poly([[n[0], 0, -SV], [n[0], 0, -SV + d], [n[1], 0, -SV + d], [n[1], 0, -SV]]) + '"/>';
      s += '</g>';
    }
    s += '</g>';
    if (slugO > 0.01) {
      s += '<g transform="' + tv(x + slugX, y - 2 - slugY, slugZ) + '" opacity="' + slugO + '">';
      s += '<path d="' + slugPath(w, d) + '" transform="translate(0,' + TH + ')" fill="' + k.sheetEdge + '"/>';
      s += '<path d="' + slugPath(w, d) + '" fill="' + k.sheet + '"/>';
      s += '</g>';
    }
    s += '</g>';
    return s;
  }

  // ---- authored timeline: real notching cycle stages, durations
  // compressed from the design tool's 10s single-station cut (Feed 2.5,
  // Align 1, Notch 1.5, Drop 0.8, Retract 1.2, Exit 2, Reset 1) down to a
  // tight 6s loop by shortening the Feed/Exit travel legs; the cut, drop
  // and retract beats keep the same relative order and read clearly ----
  var CUES = { Feed: 0, Align: 0.85, Notch: 1.35, Drop: 2.10, Retract: 2.65, Exit: 3.35, Reset: 4.85 };
  var TOTAL = 6.0;
  var FEED_START = -750, EXIT_DIST = 750;

  function pieceSvg(opts) {
    var dark = opts.dark, accent = opts.accent || '#ec3013', T = opts.T;
    var K = theme(dark), C = CUES, total = TOTAL, E = Easing, a = accent;
    var w = 150, d = 105;

    var cut = C.Notch + 0.5;
    var blade = track(T, [
      [C.Notch + 0.05, 360], [cut, -8], [C.Retract + 0.05, -8], [C.Exit + 0.05, 360]
    ], E.easeInOutCubic);

    function bp(t) {
      return seg(t, -0.85, C.Align, FEED_START, PARK - 30, E.easeOutCubic)
        + seg(t, C.Align + 0.1, C.Notch - 0.15, 0, 30, E.easeInOutCubic)
        + seg(t, C.Exit + 0.1, total - 0.05, 0, EXIT_DIST, E.easeInOutQuad);
    }
    var sp = (bp(total) - bp(0)) / 22;

    // one close three-quarter view throughout, anchored tight on the
    // die/blade/tray so it fills a 500x175 tile; only a small push-in on
    // the stroke itself — no long camera pan across a factory floor. The
    // blade's fully-raised idle position and the deepest edges of the
    // press housing are deliberately allowed to run past the frame edges,
    // the way a close product shot crops the rig around the working part.
    var zoom = track(T, [[0, 0.40], [C.Align, 0.40], [C.Notch + 0.25, 0.46], [C.Retract + 0.3, 0.46], [C.Exit + 0.35, 0.40], [total, 0.40]], E.easeInOutCubic);
    var focus = track(T, [[0, -30], [C.Align, -30], [C.Notch + 0.25, 40], [C.Retract + 0.3, 40], [C.Exit + 0.35, -30], [total, -30]], E.easeInOutCubic);
    var focusZ = track(T, [[0, -20], [C.Align, -20], [C.Notch + 0.25, -75], [C.Retract + 0.3, -75], [C.Exit + 0.35, -20], [total, -20]], E.easeInOutCubic);
    var st = Math.abs(T - cut);
    var shake = 2.2 * Math.exp(-st * 15) * Math.sin(st * 80) * (T >= cut ? 1 : 0);

    var fp = P(focus, 0, focusZ), ax = 250, ay = 88 + shake;
    function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
    var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

    var ind = seg(T, C.Align + 0.1, C.Align + 0.35, 0, 1) * (1 - seg(T, C.Notch + 0.05, C.Notch + 0.3, 0, 1));
    var sheetX = bp(T);
    var ring = { r: seg(T, cut, cut + 0.35, 35, 150, E.easeOutQuart), o: (1 - seg(T, cut, cut + 0.35, 0, 1, E.easeOutQuad)) * (T >= cut ? 0.5 : 0) };

    var defs = '<defs>' +
      '<linearGradient id="ntcGSheet" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#fbfbfc"/><stop offset="0.26" stop-color="#dcdee1"/>' +
      '<stop offset="0.5" stop-color="#f2f3f4"/><stop offset="0.74" stop-color="#c9cccf"/>' +
      '<stop offset="1" stop-color="#e6e7e9"/></linearGradient>' +
      '<linearGradient id="ntcGSheetD" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#8f9498"/><stop offset="0.28" stop-color="#5c6064"/>' +
      '<stop offset="0.52" stop-color="#7e8388"/><stop offset="0.78" stop-color="#4a4e52"/>' +
      '<stop offset="1" stop-color="#6b7074"/></linearGradient>' +
      '<filter id="ntcSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>' +
      '<radialGradient id="ntcVig" cx="0.5" cy="0.46" r="0.74">' +
      '<stop offset="0.55" stop-color="' + K.bg + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + (dark ? '#000000' : '#201e1d') + '" stop-opacity="' + (dark ? 0.5 : 0.12) + '"/></radialGradient>' +
      '<clipPath id="ntcClipDie" clip-rule="evenodd"><path d="' +
      (pathOf([[-330, 0, -168], [330, 0, -168], [330, 0, 240], [-330, 0, 240]]) + pathOf(slugList(w, d).slice().reverse())) +
      '" clip-rule="evenodd"/></clipPath>' +
      '<clipPath id="ntcClipBelt"><polygon points="' + poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]]) + '"/></clipPath>' +
      '</defs>';

    var shadowFill = dark ? '#000000' : '#201e1d', shadowOp = dark ? 0.4 : 0.15;
    var shadows = '';
    [[-420, 10], [420, 10], [0, 270], [0, -260]].forEach(function (g) {
      var p = P(g[0], -238, g[1]);
      shadows += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="90" ry="30"/>';
    });
    var p0 = P(0, -238, 20);
    shadows += '<ellipse cx="' + p0[0].toFixed(1) + '" cy="' + p0[1].toFixed(1) + '" rx="230" ry="46" opacity="0.7"/>';

    // Corrective fit transform: measured via getBBox across the full loop —
    // the die/blade mechanism otherwise overflows the 500x175 tile frame at
    // every sampled point, so an outer scale+center sits on top of the
    // existing camera transform. Requested scale 0.5 (up from the
    // no-crop-safe 0.266) — tallest/widest moments now crop past the frame
    // edges for a tighter hero-shot crop.
    var FIT = 'translate(125.225,100.95) scale(0.5)';
    var scene = '<g transform="' + FIT + ' ' + camT + '">';
    scene += floorSvg(K);
    scene += '<g filter="url(#ntcSoft)" fill="' + shadowFill + '" opacity="' + shadowOp + '">' + shadows + '</g>';
    scene += pressFrameSvg(K, a);
    scene += beltSvg(K, sheetX, sp);
    scene += dieSvg(K, w, d);
    scene += indicatorsSvg(ind, sheetX, w, d, a);
    scene += scrapChuteSvg(K);
    scene += sheetSvg(K, T, C, total, 0, a, w, d);
    scene += sheetSvg(K, T, C, total, 1, a, w, d);
    if (ring.o > 0.01) scene += '<g transform="' + tv(NC, 14, -SV + d / 2) + '" opacity="' + ring.o + '"><ellipse cx="0" cy="0" rx="' + ring.r + '" ry="' + (ring.r * 0.34) + '" fill="none" stroke="' + a + '" stroke-width="5"/></g>';
    scene += bladeSvg(K, blade, w, d, a);
    scene += '</g>';

    var vignette = '<rect x="0" y="0" width="500" height="175" fill="url(#ntcVig)" pointer-events="none"/>';

    return defs + '<rect x="0" y="0" width="500" height="175" fill="' + K.bg + '"/>' + scene + vignette;
  }

  function render(svgEl, T, opts) {
    if (!svgEl) return;
    svgEl.innerHTML = pieceSvg({
      dark: !!(opts && opts.dark),
      accent: (opts && opts.accent) || '#ec3013',
      T: T
    });
  }

  window.NKMWNotchingScene = { render: render, TOTAL: TOTAL, VIEWBOX: '0 0 500 175' };
})();
