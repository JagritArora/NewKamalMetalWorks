/* Vanilla port of the "Embossing Press" design-tool scene (embossing-scene.jsx
   + the OM_SCENES timeline authored in "Embossing Press.dc.html"): a flat
   sheet rides in on the conveyor from the left and stops under the press; a
   female pressure ring comes down, the male pad below drives a raised
   bevelled boss out of the sheet surface, the tooling retracts and the
   embossed sheet conveys out to the right. One continuous piece — nothing is
   cut and no material is removed. Same axonometric projection and real
   choreography as the source, re-rendered as plain SVG markup driven
   directly by a T value instead of React/the CompositionStage player.

   Unlike blanking-scene.js this is NOT a full-page scroll-driven piece: it
   is a small always-looping "hero" tile (~20:7). The camera is framed tight
   around the press head / ring / pad / sheet (the source scene's tall
   overhead frame beam and far mounting points are intentionally cropped out
   of view, the way a close product shot would crop a machine), and the
   long off-screen conveyor travel of the original (sheet entering from
   -2450 and exiting to +2350 world units) is shortened to a much smaller
   excursion so the sheet is visibly sliding across the tile rather than
   popping in from empty space off-camera. The two-phase overlapping-sheet
   trick from the source (one Sheet instance running one full cycle behind
   the other) is preserved as-is because it is what makes the loop cut
   clean at T=0/T=TOTAL. No iframe, no transport UI: this just writes SVG
   into an element already sitting in the page. */
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

  // ---- geometry (identical to embossing-scene.jsx, except BELT/travel
  // distances below which are deliberately shortened for the small tile) ----
  var TH = 10;                 // sheet thickness
  var BELT_V = 240;
  var BELT = [-1050, 1050];    // trimmed from the source's [-2600, 2600]
  var LEG_L = [-710, -660], LEG_R = [660, 710];
  var SU = 300, SV = 190;      // half-length / half-width of the flat sheet
  var BU = 168, BV = 108;      // boss footprint (base of the bevel)
  var BEV = 30;                // bevel run, so the top face is inset by this
  var FLAT = pathOf([[-SU, 0, -SV], [SU, 0, -SV], [SU, 0, SV], [-SU, 0, SV]]);
  var BOSS_BASE = poly([[-BU, 0, -BV], [BU, 0, -BV], [BU, 0, BV], [-BU, 0, BV]]);

  // feed / exit travel — shortened from the source's -2450 / +2350 world
  // units so the sheet slides visibly across the tile instead of spending
  // most of its motion off-camera
  var FEED_FAR = -900, EXIT_FAR = 900;

  // the raised bevelled boss, generated live from the formed height
  function bossFacesSvg(h, k, dark) {
    if (h < 0.5) return '';
    var iu = BU - BEV, iv = BV - BEV, f = h / 34;
    var s = '<g>';
    s += '<polygon points="' + poly([[-BU, 0.7, -BV - 26], [BU, 0.7, -BV - 26], [BU + 22, 0.7, BV], [-BU + 22, 0.7, BV]]) + '" fill="' + (dark ? '#000000' : '#201e1d') + '" opacity="' + (0.13 * f) + '"/>';
    s += '<polygon points="' + poly([[-iu, h, -iv], [-iu, h, iv], [-BU, 0, BV], [-BU, 0, -BV]]) + '" fill="' + k.bossL + '"/>';
    s += '<polygon points="' + poly([[iu, h, -iv], [iu, h, iv], [BU, 0, BV], [BU, 0, -BV]]) + '" fill="' + k.bossR + '"/>';
    s += '<polygon points="' + poly([[-iu, h, -iv], [iu, h, -iv], [BU, 0, -BV], [-BU, 0, -BV]]) + '" fill="' + k.bossF + '"/>';
    s += '<polygon points="' + poly([[-iu, h, -iv], [iu, h, -iv], [iu, h, iv], [-iu, h, iv]]) + '" fill="' + k.bossT + '"/>';
    s += '<polyline points="' + poly([[-iu, h, iv], [-iu, h, -iv], [iu, h, -iv]]) + '" fill="none" stroke="' + k.bossHi + '" stroke-width="3" opacity="0.85"/>';
    s += '</g>';
    return s;
  }

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
      beltEdge: '#1d1f22', dieTop: '#3f4347', beltTop: '#2a2c2f', slat: '#3a3d41',
      sheet: 'url(#embGSheetD)', sheetEdge: '#6f7479', cavity: '#101113', shadow: 'rgba(0,0,0,0.55)',
      bossT: '#9aa0a5', bossF: '#6e7377', bossL: '#5a5f63', bossR: '#474b4f', bossHi: '#c6cbcf'
    } : {
      bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
      top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
      beltEdge: '#43464a', dieTop: '#9b9ea2', beltTop: '#5f6266', slat: '#74787c',
      sheet: 'url(#embGSheet)', sheetEdge: '#9ea3a8', cavity: '#6e7276', shadow: 'rgba(32,30,29,0.22)',
      bossT: '#fbfbfc', bossF: '#d8dadd', bossL: '#c2c5c9', bossR: '#a9adb1', bossHi: '#ffffff'
    };
  }

  // ---- parts ----
  function floorSvg(k) {
    var lines = [], x, z, p1, p2;
    for (z = -720; z <= 720; z += 160) {
      p1 = P(-1400, -240, z); p2 = P(1400, -240, z);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    for (x = -1400; x <= 1400; x += 160) {
      p1 = P(x, -240, -720); p2 = P(x, -240, 720);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    return '<g stroke="' + k.grid + '" stroke-width="2" fill="none">' + lines.join('') + '</g>';
  }

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
    var s = boxSvg(LEG_L[0], LEG_L[1], -240, -30, -40, 60, F);
    s += boxSvg(LEG_R[0], LEG_R[1], -240, -30, -40, 60, F);
    s += boxSvg(x0, x1, -40, 0, -BELT_V, BELT_V, [k.beltTop, k.beltEdge, k.beltEdge]);
    s += '<g clip-path="url(#embClipBelt)">' + slats + '</g>';
    s += boxSvg(x0, x1, 0, 16, -BELT_V - 16, -BELT_V, F);
    return s;
  }

  function pressFrameSvg(k, accent) {
    var F = [k.top, k.front, k.right];
    var s = boxSvg(-430, -360, -230, 620, 220, 330, F);
    s += boxSvg(360, 430, -230, 620, 220, 330, F);
    s += boxSvg(-490, 490, 620, 720, 190, 360, F);
    s += '<polygon points="' + poly([[-240, 656, 190], [240, 656, 190], [240, 682, 190], [-240, 682, 190]]) + '" fill="' + accent + '" opacity="0.9"/>';
    return s;
  }

  function bolsterSvg(k) {
    var s = boxSvg(-300, 300, -240, -56, -110, 220, [k.beltEdge, k.front, k.right]);
    s += boxSvg(-380, 380, -92, -56, -190, 260, [k.top, k.front, k.right]);
    return s;
  }

  // lower die: a solid table carrying the male form pad, bevelled to match
  // the pressure ring above it
  function dieSvg(k) {
    var b = box(-330, 330, -56, 0, -210, 240);
    var s = '<polygon points="' + b.right + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + b.front + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + b.top + '" fill="' + k.dieTop + '"/>';
    s += '<polygon points="' + BOSS_BASE + '" fill="' + k.top + '" opacity="0.35"/>';
    s += '<polygon points="' + BOSS_BASE + '" fill="none" stroke="' + k.beltEdge + '" stroke-width="3" opacity="0.5"/>';
    return s;
  }

  // upper tooling: a female pressure ring open over the form, so the boss is
  // visible rising through it all the way through the stroke
  function pressRingSvg(k, y, accent) {
    var F = [k.top, k.front, k.right], H = 40;
    var ou = 322, ov = 238, iu = BU + 78, iv = BV + 62;
    var s = boxSvg(-ou, -iu, y, y + H, -ov, ov, F);
    s += boxSvg(iu, ou, y, y + H, -ov, ov, F);
    s += boxSvg(-iu, iu, y, y + H, iv, ov, F);
    s += boxSvg(-iu, iu, y, y + H, -ov, -iv, F);
    s += '<polygon points="' + poly([[-ou, y + 14, -ov], [-iu, y + 14, -ov], [-iu, y + 30, -ov], [-ou, y + 30, -ov]]) + '" fill="' + accent + '" opacity="0.9"/>';
    s += '<polygon points="' + poly([[iu, y + 14, -ov], [ou, y + 14, -ov], [ou, y + 30, -ov], [iu, y + 30, -ov]]) + '" fill="' + accent + '" opacity="0.9"/>';
    s += boxSvg(-300, -224, y + H, 624, 130, 206, F);
    s += boxSvg(224, 300, y + H, 624, 130, 206, F);
    return s;
  }

  // datum marks on the sheet plus the boss footprint dashed on its surface
  function indicatorsSvg(o, x, accent) {
    if (o <= 0.003) return '';
    var marks = '';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
      marks += '<polyline points="' + poly([[s[0] * SU - s[0] * 90, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV - s[1] * 90]]) + '"/>';
    });
    var out = '<g opacity="' + o + '" transform="' + tv(x, 22, 0) + '" stroke="' + accent + '" stroke-width="5" fill="none" stroke-linecap="square">';
    out += marks;
    out += '<polygon points="' + BOSS_BASE + '" stroke-width="4" stroke-dasharray="20 12"/>';
    out += '</g>';
    return out;
  }

  // travel of one sheet through the cell, from feed-in to exit
  function railX(local, C, total, E) {
    return seg(local, -1.4, C.Align, FEED_FAR, -55, E.easeOutCubic)
      + seg(local, C.Align + 0.15, C.Descend - 0.2, 0, 55, E.easeInOutCubic)
      + seg(local, C.Exit + 0.1, total - 0.1, 0, EXIT_FAR, E.easeInOutQuad);
  }

  function sheetSvg(k, t, C, total, phase, depth, dark, accent, E) {
    var local = t - phase * total;
    if (local < -1.5 || local > total + 0.05) return '';

    var x = railX(local, C, total, E);
    var form = seg(local, C.Form, C.Dwell, 0, 1, E.easeInOutCubic);
    var relax = seg(local, C.Retract + 0.1, C.Retract + 0.45, 0, 1, E.easeOutCubic);
    var h = depth * form * (1 - 0.07 * relax);
    var y = 10 - seg(local, C.Form, C.Form + 0.2, 0, 4, E.easeOutQuad)
      + seg(local, C.Retract + 0.1, C.Retract + 0.5, 0, 4, E.easeOutCubic);
    var o = (1 - seg(local, total - 0.45, total, 0, 1)) * seg(local, -1.45, -1.3, 0, 1);
    var glow = seg(form, 0.2, 0.85, 0, 1) * (1 - seg(local, C.Retract + 1.1, C.Retract + 2.1, 0, 1, E.easeOutQuad));

    var s = '<g opacity="' + o + '">';
    s += '<g transform="' + tv(x + 16, 0.8, -18) + '" opacity="0.4">';
    s += '<path d="' + FLAT + '" fill="' + k.shadow + '"/>';
    s += '</g>';
    s += '<g transform="' + tv(x, y, 0) + '">';
    s += '<path d="' + FLAT + '" transform="translate(0,' + TH + ')" fill="' + k.sheetEdge + '"/>';
    s += '<path d="' + FLAT + '" fill="' + k.sheet + '"/>';
    s += bossFacesSvg(h, k, dark);
    if (h > 0.5) s += '<polygon points="' + BOSS_BASE + '" fill="none" stroke="' + accent + '" stroke-width="5" opacity="' + glow + '"/>';
    s += '</g>';
    s += '</g>';
    return s;
  }

  // ---- authored timeline: same station names/order as the source
  // OM_SCENES ("Embossing Press.dc.html"), with the Feed/Exit conveyor
  // travel durations shortened for the small looping tile — the forming
  // action itself (Align/Descend/Form/Dwell/Retract/Reveal) keeps close to
  // its original pacing since that's the real mechanism the loop has to
  // read clearly. ----
  var OM_DURS = [
    ['Feed', 0.9], ['Align', 0.5], ['Descend', 0.8], ['Form', 0.8], ['Dwell', 0.45],
    ['Retract', 0.85], ['Reveal', 0.9], ['Exit', 1.1], ['Reset', 0.5]
  ];
  var RAW_CUES = {}, running = 0;
  for (var di = 0; di < OM_DURS.length; di++) { RAW_CUES[OM_DURS[di][0]] = running; running += OM_DURS[di][1]; }
  var RAW_TOTAL = running;
  var AUTHORED = 6.8;
  var R = RAW_TOTAL / AUTHORED;
  var CUES = {};
  for (var ck in RAW_CUES) CUES[ck] = RAW_CUES[ck] / R;
  var TOTAL = AUTHORED;

  // ---- tile framing: viewBox close to 20:7, camera locked tight on the
  // press head / ring / pad / sheet (the tall overhead beam and the far
  // mounting points of the source scene fall outside this crop on purpose)
  var VBW = 1000, VBH = 350;
  var AX = VBW / 2, AY = 205;

  function pieceSvg(opts) {
    var dark = opts.dark, accent = opts.accent || '#ec3013', T = opts.T;
    var K = theme(dark), C = CUES, total = TOTAL, E = Easing, a = accent;
    var depth = opts.embossHeight != null ? opts.embossHeight : 34;

    // the ring seats on the sheet at Form, then presses as the boss is
    // driven up
    var ringY = track(T, [
      [C.Descend + 0.06, 300], [C.Form, 20], [C.Dwell, 6],
      [C.Retract, 6], [C.Retract + 0.2, 13], [C.Reveal + 0.06, 300]
    ], E.easeInOutCubic);
    // the surface deforms in lockstep with the stroke, with a touch of
    // springback
    var form = seg(T, C.Form, C.Dwell, 0, 1, E.easeInOutCubic);
    var relax = seg(T, C.Retract + 0.1, C.Retract + 0.45, 0, 1, E.easeOutCubic);
    var h = depth * form * (1 - 0.07 * relax);
    var sheetX = railX(T, C, total, E);
    var sp = (railX(total, C, total, E) - railX(0, C, total, E)) / 34;

    // the camera barely moves: a small push-in and lift so the new height
    // reads, framed close around the tooling the whole time
    var zoom = track(T, [[0, 0.5], [C.Descend + 0.1, 0.5], [C.Dwell, 0.62], [C.Reveal + 0.6, 0.62], [C.Exit + 0.4, 0.5], [total, 0.5]], E.easeInOutCubic);
    var focus = track(T, [[0, 10], [C.Descend + 0.1, 10], [C.Dwell, 24], [C.Reveal + 0.6, 24], [C.Exit + 0.4, 10], [total, 10]], E.easeInOutCubic);
    var focusY = track(T, [[0, 170], [C.Descend + 0.1, 170], [C.Dwell, 120], [C.Reveal + 0.6, 120], [C.Exit + 0.4, 170], [total, 170]], E.easeInOutCubic);
    var focusZ = track(T, [[0, -20], [C.Descend + 0.1, -20], [C.Dwell, -50], [C.Reveal + 0.6, -50], [C.Exit + 0.4, -20], [total, -20]], E.easeInOutCubic);
    var st = Math.abs(T - C.Dwell);
    var shake = 2.4 * Math.exp(-st * 10) * Math.sin(st * 58) * (T >= C.Dwell ? 1 : 0);

    var fp = P(focus, focusY, focusZ), ax = AX, ay = AY + shake;
    var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

    var ind = seg(T, C.Align + 0.15, C.Align + 0.45, 0, 1) * (1 - seg(T, C.Descend + 0.1, C.Descend + 0.4, 0, 1));
    var ring = { r: seg(T, C.Dwell, C.Dwell + 0.5, 80, 280, E.easeOutQuart), o: (1 - seg(T, C.Dwell, C.Dwell + 0.5, 0, 1, E.easeOutQuad)) * (T >= C.Dwell ? 0.4 : 0) };

    var vigStop = dark ? '#000000' : '#201e1d';
    var vigOp = dark ? 0.55 : 0.13;
    var shadowFill = dark ? '#000000' : '#201e1d';
    var shadowOp = dark ? 0.45 : 0.16;

    var defs = '<defs>' +
      '<linearGradient id="embGSheet" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#fbfbfc"/><stop offset="0.26" stop-color="#dcdee1"/>' +
      '<stop offset="0.5" stop-color="#f2f3f4"/><stop offset="0.74" stop-color="#c9cccf"/>' +
      '<stop offset="1" stop-color="#e6e7e9"/></linearGradient>' +
      '<linearGradient id="embGSheetD" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#8f9498"/><stop offset="0.28" stop-color="#5c6064"/>' +
      '<stop offset="0.52" stop-color="#7e8388"/><stop offset="0.78" stop-color="#4a4e52"/>' +
      '<stop offset="1" stop-color="#6b7074"/></linearGradient>' +
      '<filter id="embSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>' +
      '<radialGradient id="embVig" cx="0.5" cy="0.46" r="0.74">' +
      '<stop offset="0.55" stop-color="' + K.bg + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + vigStop + '" stop-opacity="' + vigOp + '"/></radialGradient>' +
      '<clipPath id="embClipBelt"><polygon points="' + poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]]) + '"/></clipPath>' +
      '</defs>';

    var shadows = '';
    [[-395, 275], [395, 275], [(LEG_L[0] + LEG_L[1]) / 2, 10], [(LEG_R[0] + LEG_R[1]) / 2, 10]].forEach(function (g) {
      var p = P(g[0], -238, g[1]);
      shadows += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="120" ry="40"/>';
    });
    var pMain = P(0, -238, 30);
    shadows += '<ellipse cx="' + pMain[0].toFixed(1) + '" cy="' + pMain[1].toFixed(1) + '" rx="360" ry="60" opacity="0.75"/>';

    // Corrective fit transform: the authored camera math leaves the press/ring/
    // sheet mechanism far larger than the 1000x350 tile frame at every sampled
    // point in its cycle (measured via getBBox across the full loop), so an
    // outer scale+center is applied on top of the existing camera transform
    // rather than reworking that math. Requested scale 0.5 (up from the
    // no-crop-safe 0.345) — the tallest/widest moments of the cycle now crop
    // past the frame edges (press-frame top beam and floor edges), matching
    // a tighter Apple-style hero crop rather than a fully-contained shot.
    var FIT = 'translate(249.375,79.55) scale(0.5)';
    var scene = '<g transform="' + FIT + ' ' + camT + '">';
    scene += floorSvg(K);
    scene += '<g filter="url(#embSoft)" fill="' + shadowFill + '" opacity="' + shadowOp + '">' + shadows + '</g>';
    scene += pressFrameSvg(K, a);
    scene += beltSvg(K, sheetX, sp);
    scene += bolsterSvg(K);
    scene += dieSvg(K);
    scene += indicatorsSvg(ind, sheetX, a);
    scene += sheetSvg(K, T, C, total, 0, depth, dark, a, E);
    scene += sheetSvg(K, T, C, total, 1, depth, dark, a, E);
    if (ring.o > 0.01) scene += '<g transform="' + tv(sheetX, 16 + h, 0) + '" opacity="' + ring.o + '"><ellipse cx="0" cy="0" rx="' + ring.r + '" ry="' + (ring.r * 0.34) + '" fill="none" stroke="' + a + '" stroke-width="5"/></g>';
    scene += pressRingSvg(K, ringY, a);
    scene += '</g>';

    var vignette = '<rect x="0" y="0" width="' + VBW + '" height="' + VBH + '" fill="url(#embVig)" pointer-events="none"/>';

    return defs + '<rect x="0" y="0" width="' + VBW + '" height="' + VBH + '" fill="' + K.bg + '"/>' + scene + vignette;
  }

  function render(svgEl, T, opts) {
    if (!svgEl) return;
    svgEl.innerHTML = pieceSvg({
      dark: !!(opts && opts.dark),
      accent: (opts && opts.accent) || '#ec3013',
      embossHeight: opts && opts.embossHeight,
      T: T
    });
  }

  window.NKMWEmbossingScene = { render: render, TOTAL: TOTAL, VIEWBOX: '0 0 ' + VBW + ' ' + VBH };
})();
