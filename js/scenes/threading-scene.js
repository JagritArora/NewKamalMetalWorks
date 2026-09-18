/* Vanilla port of the "Threading Press" design-tool scene (threading-scene.jsx)
   — same axonometric projection, real geometry (thick component, existing
   bore, tap forming an internal thread) and the same authored choreography
   (Feed/Align/Tap/Dwell/Withdraw/Reveal/Exit/Reset, durations from the
   design tool's OM_SCENES: 2.2/0.8/2.5/0.7/1.3/1.2/1.8/0.8s), re-rendered as
   plain SVG markup driven directly by a T value instead of React/the
   CompositionStage player.

   This is a small looping "hero" tile (~20:7), not the full-page scroll
   scene, so the camera is cropped tight around the tap head + bore + the
   part directly under it, and the long conveyor-travel portions (Feed/Exit)
   are shortened — the plunge/form/withdraw core (Align through Withdraw)
   keeps its authored durations exactly. No iframe, no transport UI: this
   just writes SVG into an element already sitting in the page. */
(function () {
  "use strict";

  var EX = [1, 0.13], EY = [0, -1], EZ = [0.5, -0.34];
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
  function line(list) {
    var s = '';
    for (var i = 0; i < list.length; i++) {
      var p = P(list[i][0], list[i][1] || 0, list[i][2]);
      s += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    return s;
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

  // ---- geometry (identical constants to threading-scene.jsx) ----
  var SU = 300, SV = 200;     // half-length / half-width of the component
  var TH = 74;                // section thickness — enough for real engagement
  var R = 110;                // radius of the existing hole
  var PITCH = 11;             // thread pitch
  var TR = 64;                // tap radius (drawn under size so the forming
                               // thread stays visible inside the bore)
  var TAU = Math.PI * 2;
  var YB = -TH;                // belt surface: the component rides on it
  var BORE_A0 = Math.PI * 0.25, BORE_A1 = Math.PI * 1.25;
  var TURNS = 4;                // thread-forming rotations per stroke (authored default)

  // travel is cropped/shortened for the small tile — the part starts and
  // ends fully off-frame so a hard loop cut reads clean
  var FEED_DIST = 1250, EXIT_DIST = 1250, CREEP = 55;
  var BELT_V = 250, BELT = [-1650, 1650];
  var LEG_X = [-760, 760];

  function arc(r, a0, a1, y, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      out.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
    return out;
  }
  function ring(r, y) { return arc(r, 0, TAU, y, 48); }

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
      beltEdge: '#1d1f22', dieTop: '#3f4347', cavity: '#0d0e10', shadow: 'rgba(0,0,0,0.55)',
      beltTop: '#2a2c2f', slat: '#3a3d41',
      part: 'url(#thrGPartD)', partEdge: '#585d61', partSide: '#44484c',
      bore: 'url(#thrGBoreD)', boreDeep: '#0c0d0e', thread: '#c4cace', threadLo: '#24272a',
      tap: 'url(#thrGTapD)', tapEdge: '#8d9398', tapHi: '#cfd4d8'
    } : {
      bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
      top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
      beltEdge: '#43464a', dieTop: '#9b9ea2', cavity: '#5c6064', shadow: 'rgba(32,30,29,0.22)',
      beltTop: '#5f6266', slat: '#74787c',
      part: 'url(#thrGPart)', partEdge: '#9ea3a8', partSide: '#aeb2b6',
      bore: 'url(#thrGBore)', boreDeep: '#3d4145', thread: '#ffffff', threadLo: '#75797e',
      tap: 'url(#thrGTap)', tapEdge: '#8f9499', tapHi: '#ffffff'
    };
  }

  // ---- parts ----
  function floorSvg(k) {
    var lines = [], x, z, p1, p2;
    for (z = -600; z <= 600; z += 150) {
      p1 = P(-1700, -240, z); p2 = P(1700, -240, z);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    for (x = -1700; x <= 1700; x += 170) {
      p1 = P(x, -240, -600); p2 = P(x, -240, 600);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    return '<g stroke="' + k.grid + '" stroke-width="2" fill="none">' + lines.join('') + '</g>';
  }

  function machineFrameSvg(k, accent) {
    var F = [k.top, k.front, k.right];
    var s = boxSvg(-420, -350, -240, 640, 250, 360, F);
    s += boxSvg(350, 420, -240, 640, 250, 360, F);
    s += boxSvg(-480, 480, 640, 740, 220, 390, F);
    s += '<polygon points="' + poly([[-230, 676, 220], [230, 676, 220], [230, 702, 220], [-230, 702, 220]]) + '" fill="' + accent + '" opacity="0.9"/>';
    return s;
  }

  // the conveyor the component rides in and out on
  function beltSvg(k, phase, spacing, clipUrl) {
    var F = [k.top, k.front, k.right];
    var x0 = BELT[0], x1 = BELT[1];
    var base = x0 + (((phase % spacing) + spacing) % spacing);
    var slats = '', n = Math.ceil((x1 - x0) / spacing) + 1;
    for (var i = 0; i < n; i++) {
      var x = base + i * spacing;
      if (x > x1 - 8) continue;
      slats += '<polygon points="' + poly([[x, YB + 1, -BELT_V], [x + 8, YB + 1, -BELT_V], [x + 8, YB + 1, BELT_V], [x, YB + 1, BELT_V]]) + '" fill="' + k.slat + '"/>';
    }
    var s = boxSvg(LEG_X[0] - 60, LEG_X[0] + 60, -250, YB - 34, -40, 60, F);
    s += boxSvg(LEG_X[1] - 60, LEG_X[1] + 60, -250, YB - 34, -40, 60, F);
    s += boxSvg(x0, x1, YB - 44, YB, -BELT_V, BELT_V, [k.beltTop, k.beltEdge, k.beltEdge]);
    s += '<g clip-path="' + clipUrl + '">' + slats + '</g>';
    s += boxSvg(x0, x1, YB, YB + 16, -BELT_V - 16, -BELT_V, F);
    return s;
  }

  function clampsSvg(k, y, accent) {
    var F = [k.top, k.front, k.right];
    var s = '';
    [-232, 232].forEach(function (x) {
      s += boxSvg(x - 44, x + 44, y, y + 24, -56, 64, [k.dieTop, k.front, k.right]);
      s += boxSvg(x - 28, x + 28, y + 24, y + 250, -34, 40, F);
      s += '<polygon points="' + poly([[x - 28, y + 198, -34], [x + 28, y + 198, -34], [x + 28, y + 218, -34], [x - 28, y + 218, -34]]) + '" fill="' + accent + '" opacity="0.85"/>';
    });
    return s;
  }

  // the component: thick section, existing hole, and the internal thread
  // that develops on the visible inner wall as the tap goes down. p is the
  // 0..1 forming progress (depth achieved so far).
  function componentSvg(k, accent, x, p) {
    var a = accent;
    var topFace = pathOf([[-SU, 0, -SV], [SU, 0, -SV], [SU, 0, SV], [-SU, 0, SV]]) + pathOf(ring(R, 0).slice().reverse());
    var wall = arc(R, BORE_A0, BORE_A1, 0, 40).concat(arc(R, BORE_A1, BORE_A0, -TH, 40));
    var depth = p * TH;

    var turns = '', front = '';
    var n = Math.ceil(TH / PITCH) + 1;
    for (var i = 0; i < n; i++) {
      var y0 = -i * PITCH - 3;
      if (-y0 > TH - 2) break;
      var span = BORE_A1 - BORE_A0;
      var pts = [], lo = [];
      for (var j = 0; j <= 30; j++) {
        var u = j / 30, aa = BORE_A0 + span * u, yy = y0 - PITCH * u * 0.5;
        if (-yy > depth || -yy > TH - 1) break;
        pts.push([(R - 3) * Math.cos(aa), yy, (R - 3) * Math.sin(aa)]);
        lo.push([(R - 3) * Math.cos(aa), yy - 3.4, (R - 3) * Math.sin(aa)]);
      }
      if (pts.length > 1) {
        turns += '<path d="' + line(lo) + '" stroke="' + k.threadLo + '" stroke-width="4" fill="none"/>';
        turns += '<path d="' + line(pts) + '" stroke="' + k.thread + '" stroke-width="3.4" fill="none" opacity="0.92"/>';
        if (-pts[pts.length - 1][1] > depth - PITCH * 0.6 && p > 0.02 && p < 0.999) {
          front = '<path d="' + line(pts.slice(Math.max(0, pts.length - 9))) + '" stroke="' + a + '" stroke-width="5" fill="none"/>';
        }
      }
    }

    var s = '<g transform="' + tv(x, 0, 0) + '">';
    s += '<path d="' + pathOf(ring(R, 0)) + '" fill="' + k.boreDeep + '"/>';
    s += '<polygon points="' + poly(wall) + '" fill="' + k.bore + '"/>';
    s += '<g>' + turns + front + '</g>';
    s += '<polygon points="' + poly([[-SU, 0, -SV], [SU, 0, -SV], [SU, -TH, -SV], [-SU, -TH, -SV]]) + '" fill="' + k.partSide + '"/>';
    s += '<polygon points="' + poly([[SU, 0, -SV], [SU, 0, SV], [SU, -TH, SV], [SU, -TH, -SV]]) + '" fill="' + k.partEdge + '"/>';
    s += '<path d="' + topFace + '" fill-rule="evenodd" fill="' + k.part + '"/>';
    s += '<path d="' + pathOf(ring(R, 0)) + '" fill="none" stroke="' + k.partEdge + '" stroke-width="3" opacity="0.8"/>';
    s += '</g>';
    return s;
  }

  // the tap: a rotating cylinder with flutes and its own thread form, on a
  // spindle. Only the front half of the body is visible, so the bore wall
  // behind it stays readable — clipped against #thrClipTapBody (defined per
  // frame in the scene defs, since it depends on the current tap height).
  function tapSvg(k, y, spin, accent) {
    var a = accent;
    var L = 300, top = y + L, lead = y + 34;
    var f0 = Math.PI * 1.25, f1 = Math.PI * 2.25;   // visible front half
    var side = arc(TR, f0, f1, top, 30).concat(arc(TR, f1, f0, lead, 30));
    var cone = arc(TR, f0, f1, lead, 24).concat([[0, y - 6, 0]]);

    var flutes = '', i;
    for (i = 0; i < 3; i++) {
      var ang = spin * TAU + i * TAU / 3;
      var w = ((ang % TAU) + TAU) % TAU;
      if (w < f0 - Math.PI * 2 || w > f1) { if (!(w >= f0 && w <= f1) && !(w + TAU >= f0 && w + TAU <= f1)) continue; }
      var cx = TR * Math.cos(w), cz = TR * Math.sin(w);
      flutes += '<path d="' + line([[cx, lead, cz], [cx, top - 40, cz]]) + '" stroke="' + k.tapEdge + '" stroke-width="3" fill="none" opacity="0.7"/>';
    }

    var th = '';
    for (i = 0; i < 9; i++) {
      var y0 = lead + i * PITCH;
      if (y0 > lead + 150) break;
      var pts = [];
      for (var j = 0; j <= 24; j++) {
        var u = j / 24, aa = f0 + (f1 - f0) * u + spin * TAU;
        pts.push([TR * Math.cos(aa), y0 + PITCH * u * 0.5, TR * Math.sin(aa)]);
      }
      th += '<path d="' + line(pts) + '" stroke="' + k.tapHi + '" stroke-width="2.6" fill="none" opacity="0.5"/>';
    }

    var s = '<polygon points="' + poly(cone) + '" fill="' + k.tapEdge + '"/>';
    s += '<polygon points="' + poly(side) + '" fill="' + k.tap + '"/>';
    s += '<g clip-path="url(#thrClipTapBody)">' + th + '</g>';
    s += flutes;
    s += '<path d="' + pathOf(ring(TR, top)) + '" fill="' + k.tapHi + '" opacity="0.35"/>';
    s += boxSvg(-86, 86, top, top + 92, -86, 86, [k.top, k.front, k.right]);
    s += '<polygon points="' + poly([[-86, top + 34, -86], [86, top + 34, -86], [86, top + 56, -86], [-86, top + 56, -86]]) + '" fill="' + a + '" opacity="0.9"/>';
    s += boxSvg(-46, 46, top + 92, 644, -46, 46, [k.top, k.front, k.right]);
    return s;
  }

  // rotation cue: a short arc with a head, flipping direction on withdrawal
  function spinCueSvg(o, y, dir, accent) {
    if (o <= 0.004) return '';
    var r = TR + 74, a = accent;
    var a0 = -0.15, a1 = 2.5;
    var pts = arc(r, a0, a1, y, 24);
    var tipA = dir > 0 ? a1 : a0, s2 = dir > 0 ? 1 : -1;
    var tx = r * Math.cos(tipA), tz = r * Math.sin(tipA);
    var hx = -Math.sin(tipA) * s2, hz = Math.cos(tipA) * s2;
    var out = '<g opacity="' + o + '" stroke="' + a + '" fill="none" stroke-width="5" stroke-linecap="round">';
    out += '<path d="' + line(pts) + '"/>';
    out += '<path d="' + line([
      [tx + (hx * 26 - Math.cos(tipA) * 18), y, tz + (hz * 26 - Math.sin(tipA) * 18)], [tx, y, tz],
      [tx + (hx * 26 + Math.cos(tipA) * 18), y, tz + (hz * 26 + Math.sin(tipA) * 18)]
    ]) + '"/>';
    out += '</g>';
    return out;
  }

  function indicatorsSvg(o, x, accent) {
    if (o <= 0.003) return '';
    var a = accent, marks = '';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (sgn) {
      marks += '<polyline points="' + poly([[sgn[0] * SU - sgn[0] * 88, 0, sgn[1] * SV], [sgn[0] * SU, 0, sgn[1] * SV], [sgn[0] * SU, 0, sgn[1] * SV - sgn[1] * 88]]) + '"/>';
    });
    var out = '<g opacity="' + o + '" transform="' + tv(x, 14, 0) + '" stroke="' + a + '" stroke-width="5" fill="none" stroke-linecap="square">';
    out += marks;
    out += '<path d="' + pathOf(ring(R + 22, 0)) + '" stroke-width="4" stroke-dasharray="18 12"/>';
    out += '</g>';
    return out;
  }

  // ---- authored timeline -----------------------------------------------
  // Durations from the design tool's OM_SCENES for this cell: Feed 2.2,
  // Align 0.8, Tap 2.5, Dwell 0.7, Withdraw 1.3, Reveal 1.2, Exit 1.8,
  // Reset 0.8 (raw total 11.3s). For this small looping tile, Feed/Exit
  // (long conveyor travel) and Reveal/Reset (epilogue) are shortened; the
  // real forming action — Align through Withdraw — keeps its authored
  // durations exactly, so the plunge/form/dwell/retract choreography and
  // its relative timing are unchanged.
  var DURS = [
    ['Feed', 1.3], ['Align', 0.8], ['Tap', 2.5], ['Dwell', 0.7],
    ['Withdraw', 1.3], ['Reveal', 1.0], ['Exit', 1.1], ['Reset', 0.6]
  ];
  var CUES = {}, running = 0;
  for (var di = 0; di < DURS.length; di++) { CUES[DURS[di][0]] = running; running += DURS[di][1]; }
  var TOTAL = running;

  // ---- camera -------------------------------------------------------------
  // Tight, mostly locked-off framing on the station (world x = 0): the part
  // slides through underneath while the camera holds on the tap/bore, with
  // a small push-in during the plunge and a slight top-down tilt for the
  // finished-thread reveal.
  var VIEW_W = 1000, VIEW_H = 350;
  var ANCHOR_X = 500, ANCHOR_Y = 175;
  var BASE_ZOOM = 0.64, ZOOM_PEAK = 0.70, ZOOM_SETTLE = 0.67;
  var FOCUS_BASE = 50, FOCUS_MID = 35, FOCUS_DEEP = 15;

  function railX(t, C, total, E) {
    return seg(t, 0, C.Align, -FEED_DIST, -CREEP, E.easeOutCubic)
      + seg(t, C.Align + 0.15, C.Tap - 0.2, 0, CREEP, E.easeInOutCubic)
      + seg(t, C.Exit + 0.1, total - 0.1, 0, EXIT_DIST, E.easeInOutQuad);
  }

  function sceneSvg(opts) {
    var dark = opts.dark, accent = opts.accent || '#ec3013', T = opts.T;
    var K = theme(dark), C = CUES, total = TOTAL, E = Easing, a = accent;

    // a small tilt toward top-down for the final reveal, so the finished
    // thread inside the bore is unmistakable
    var tilt = seg(T, C.Reveal + 0.1, C.Reveal + 0.8, 0, 1, E.easeInOutCubic) * (1 - seg(T, total - 0.45, total - 0.05, 0, 1, E.easeInOutCubic));
    EZ[1] = -0.34 - 0.13 * tilt;

    var tapY = track(T, [
      [0, 230], [C.Align + 0.1, 230], [C.Align + 0.6, 26], [C.Tap + 0.1, 26],
      [C.Dwell, -TH + 4], [C.Withdraw, -TH + 4], [C.Reveal, 230]
    ], E.easeInOutCubic);
    // rotation is tied to the feed: one turn per thread pitch, reversed on
    // the way out
    var spin = TURNS * seg(T, C.Tap + 0.1, C.Dwell, 0, 1, E.easeInOutCubic)
      + 0.5 * seg(T, C.Align + 0.1, C.Tap + 0.1, 0, 1, E.easeInOutCubic)
      - (TURNS + 0.5) * seg(T, C.Withdraw, C.Reveal, 0, 1, E.easeInOutCubic);

    var partX = railX(T, C, total, E);
    var sp = (railX(total, C, total, E) - railX(0, C, total, E)) / 34;
    var clampY = track(T, [[0, 40], [C.Align + 0.1, 40], [C.Align + 0.45, 0], [C.Reveal + 0.4, 0], [C.Exit - 0.1, 40]], E.easeInOutCubic);

    var zoom = track(T, [
      [0, BASE_ZOOM], [C.Align + 0.1, BASE_ZOOM], [C.Tap + 0.5, ZOOM_PEAK], [C.Withdraw, ZOOM_PEAK],
      [C.Reveal + 0.5, ZOOM_SETTLE], [C.Exit + 0.4, BASE_ZOOM], [total, BASE_ZOOM]
    ], E.easeInOutCubic);
    var focusY = track(T, [
      [0, FOCUS_BASE], [C.Align + 0.1, FOCUS_BASE], [C.Tap + 0.5, FOCUS_MID],
      [C.Reveal + 0.5, FOCUS_DEEP], [C.Exit + 0.4, FOCUS_BASE], [total, FOCUS_BASE]
    ], E.easeInOutCubic);
    var hum = 1.1 * Math.sin(T * 44) * seg(T, C.Tap, C.Tap + 0.3, 0, 1) * (1 - seg(T, C.Dwell, C.Dwell + 0.25, 0, 1));

    var fp = P(0, focusY, 0), ax = ANCHOR_X, ay = ANCHOR_Y + hum;
    var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

    var p = seg(T, C.Tap + 0.12, C.Dwell, 0, 1, E.easeInOutCubic);
    var ind = seg(T, C.Align + 0.12, C.Align + 0.42, 0, 1) * (1 - seg(T, C.Tap + 0.1, C.Tap + 0.4, 0, 1));
    var cueO = seg(T, C.Align + 0.2, C.Align + 0.5, 0, 1) * (1 - seg(T, C.Reveal - 0.35, C.Reveal - 0.05, 0, 1));
    var cueDir = T < C.Withdraw ? 1 : -1;

    var vigStop = dark ? '#000000' : '#201e1d';
    var vigOp = dark ? 0.55 : 0.13;
    var shadowFill = dark ? '#000000' : '#201e1d';
    var shadowOp = dark ? 0.45 : 0.16;

    var defs = '<defs>' +
      '<linearGradient id="thrGPart" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#fbfbfc"/><stop offset="0.3" stop-color="#dcdee1"/>' +
      '<stop offset="0.56" stop-color="#f0f1f2"/><stop offset="1" stop-color="#cbced1"/></linearGradient>' +
      '<linearGradient id="thrGPartD" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#8d9297"/><stop offset="0.3" stop-color="#5c6064"/>' +
      '<stop offset="0.56" stop-color="#7c8186"/><stop offset="1" stop-color="#4a4e52"/></linearGradient>' +
      '<linearGradient id="thrGBore" x1="0" y1="0" x2="0.2" y2="1">' +
      '<stop offset="0" stop-color="#adb1b5"/><stop offset="1" stop-color="#6b6f73"/></linearGradient>' +
      '<linearGradient id="thrGBoreD" x1="0" y1="0" x2="0.2" y2="1">' +
      '<stop offset="0" stop-color="#585d61"/><stop offset="1" stop-color="#2b2e31"/></linearGradient>' +
      '<linearGradient id="thrGTap" x1="0" y1="0" x2="1" y2="0.3">' +
      '<stop offset="0" stop-color="#7e8388"/><stop offset="0.42" stop-color="#d3d7da"/>' +
      '<stop offset="0.72" stop-color="#9aa0a5"/><stop offset="1" stop-color="#6e7377"/></linearGradient>' +
      '<linearGradient id="thrGTapD" x1="0" y1="0" x2="1" y2="0.3">' +
      '<stop offset="0" stop-color="#4c5155"/><stop offset="0.42" stop-color="#9aa0a5"/>' +
      '<stop offset="0.72" stop-color="#6b7074"/><stop offset="1" stop-color="#404448"/></linearGradient>' +
      '<filter id="thrSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>' +
      '<radialGradient id="thrVig" cx="0.5" cy="0.46" r="0.74">' +
      '<stop offset="0.55" stop-color="' + K.bg + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + vigStop + '" stop-opacity="' + vigOp + '"/></radialGradient>' +
      '<clipPath id="thrClipBelt"><polygon points="' + poly([[BELT[0], YB, -BELT_V], [BELT[1], YB, -BELT_V], [BELT[1], YB, BELT_V], [BELT[0], YB, BELT_V]]) + '"/></clipPath>' +
      '<clipPath id="thrClipTapBody"><polygon points="' + poly(arc(TR, Math.PI * 1.25, Math.PI * 2.25, tapY + 300, 30).concat(arc(TR, Math.PI * 2.25, Math.PI * 1.25, tapY + 34, 30))) + '"/></clipPath>' +
      '</defs>';

    var shadows = '';
    [[0, -258, 40, 380, 70, 0.8], [-385, -258, 305, 120, 40, 1], [385, -258, 305, 120, 40, 1],
      [LEG_X[0], -258, 10, 110, 36, 1], [LEG_X[1], -258, 10, 110, 36, 1]].forEach(function (g) {
      var pp = P(g[0], g[1], g[2]);
      shadows += '<ellipse cx="' + pp[0].toFixed(1) + '" cy="' + pp[1].toFixed(1) + '" rx="' + g[3] + '" ry="' + g[4] + '" opacity="' + g[5] + '"/>';
    });

    // Corrective fit transform: measured via getBBox across the full loop —
    // the tap/bore mechanism otherwise overflows the 1000x350 tile frame at
    // every sampled point, so an outer scale+center sits on top of the
    // existing camera transform. Requested scale 0.5 (up from the
    // no-crop-safe 0.294) — tallest/widest moments now crop past the frame
    // edges for a tighter hero-shot crop.
    var FIT = 'translate(250,125.175) scale(0.5)';
    var scene = '<g transform="' + FIT + ' ' + camT + '">';
    scene += floorSvg(K);
    scene += '<g filter="url(#thrSoft)" fill="' + shadowFill + '" opacity="' + shadowOp + '">' + shadows + '</g>';
    scene += machineFrameSvg(K, a);
    scene += beltSvg(K, partX, sp, 'url(#thrClipBelt)');
    scene += indicatorsSvg(ind, partX, a);
    scene += componentSvg(K, a, partX, p);
    scene += clampsSvg(K, clampY, a);
    scene += tapSvg(K, tapY, spin, a);
    scene += spinCueSvg(cueO, tapY + 318, cueDir, a);
    scene += '</g>';

    var vignette = '<rect x="0" y="0" width="' + VIEW_W + '" height="' + VIEW_H + '" fill="url(#thrVig)" pointer-events="none"/>';

    return defs + '<rect x="0" y="0" width="' + VIEW_W + '" height="' + VIEW_H + '" fill="' + K.bg + '"/>' + scene + vignette;
  }

  function render(svgEl, T, opts) {
    if (!svgEl) return;
    svgEl.innerHTML = sceneSvg({
      dark: !!(opts && opts.dark),
      accent: (opts && opts.accent) || '#ec3013',
      T: T
    });
  }

  window.NKMWThreadingScene = { render: render, TOTAL: TOTAL, VIEWBOX: '0 0 ' + VIEW_W + ' ' + VIEW_H };
})();
