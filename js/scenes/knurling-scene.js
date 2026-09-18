/* Vanilla port of the "Sheet Metal Blanking Animation 2" design-tool scene
   (knurling-scene.jsx) — same axonometric projection and real cold-forming
   mechanism (smooth cylinder, two driven rollers, a patterned knurl wheel),
   re-authored as a small continuously looping "hero" tile instead of a
   scroll-driven full-page station. Real mechanism preserved: a finished
   smooth cylinder rides in, lifts onto the rollers, the knurl wheel presses
   in and rolls a diamond pattern into the surface as the cylinder spins,
   then the wheel retracts and the part rolls off. Cold forming only — the
   metal is displaced, never cut, nothing leaves the part, so (unlike the
   punching/notching stations) there is no slug or scrap chute here. The
   long factory-floor belt travel from the original scene has been
   shortened and the camera framed tight on just the rollers/wheel so it
   reads at ~500x175px. No React, no iframe: this writes plain SVG markup
   into an element already sitting in the page. */
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

  // ---- mechanism geometry (identical to knurling-scene.jsx: real
  // cylinder/roller/wheel dimensions, unchanged) ----
  var TAU = Math.PI * 2;
  var CR = 92, CL = 200;        // workpiece radius / half-length
  var KB = 112;                 // knurled band half-length (ends stay smooth)
  var WR = 58, WT = 17;         // knurl wheel radius / half-thickness
  var RR = 26, RZ = 62;         // support roller radius / offset from centre
  var RY = 18;
  var CY0 = CR;                                             // resting on the belt
  var CY1 = RY + Math.sqrt((CR + RR) * (CR + RR) - RZ * RZ); // seated in the rollers
  // a convex cylinder with its axis along x shows this half of its surface
  var A0 = -Math.PI * 0.75, A1 = Math.PI * 0.25;
  var NA = 26, NX = 7;          // knurl lattice divisions
  var WRAPS = 1.15;             // revolutions of the cylinder per forming pass

  function surf(x, phi, cy, r) { return [x, cy + r * Math.cos(phi), r * Math.sin(phi)]; }
  function arcAt(x, a0, a1, cy, r, n) {
    var out = [];
    for (var i = 0; i <= n; i++) out.push(surf(x, a0 + (a1 - a0) * (i / n), cy, r));
    return out;
  }
  function capRing(x, cy, r) {
    var out = [];
    for (var i = 0; i < 44; i++) out.push(surf(x, (i / 44) * TAU, cy, r));
    return out;
  }
  function norm(a) { var v = a % TAU; return v < 0 ? v + TAU : v; }
  function wrapPi(a) { var v = norm(a); return v > Math.PI ? v - TAU : v; }

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

  function hx(c) {
    var h = c.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(c0, c1, t) {
    var a = hx(c0), b = hx(c1);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function theme(dark) {
    return dark ? {
      bg: '#17181a', ink: '#e8e6e4', grid: 'rgba(255,255,255,0.055)',
      top: '#4c4f52', front: '#32353a', right: '#23262a',
      beltTop: '#2a2c2f', beltEdge: '#1d1f22', slat: '#3a3d41', dieTop: '#3f4347',
      shadow: 'rgba(0,0,0,0.55)',
      metalHi: '#aab0b5', metalLo: '#33373b', cap: '#7c8287', capIn: '#4a4e52',
      knurlHi: '#c9cfd4', knurlLo: '#1e2124',
      wheelHi: '#9aa0a5', wheelLo: '#2c3033', tooth: '#d2d7db'
    } : {
      bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
      top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
      beltTop: '#5f6266', beltEdge: '#43464a', slat: '#74787c', dieTop: '#9b9ea2',
      shadow: 'rgba(32,30,29,0.22)',
      metalHi: '#fdfdfe', metalLo: '#83878b', cap: '#d9dcdf', capIn: '#a8acb0',
      knurlHi: '#ffffff', knurlLo: '#6b7075',
      wheelHi: '#e2e5e8', wheelLo: '#6e7377', tooth: '#ffffff'
    };
  }

  // ---- staging: shortened conveyor travel + a compact station frame so
  // the station reads clearly cropped tight at tile size (set-dressing
  // only — none of the mechanism dimensions above are touched) ----
  var BELT_V = 130, BELT = [-760, 760], BELT_LEGS = [-560, 560];
  var TRAVEL_IN = -680, ALIGN_X = -46, ENGAGE_X = 0, TRAVEL_OUT = 680;

  function floorSvg(k) {
    var lines = [], x, z, p1, p2;
    for (z = -300; z <= 300; z += 150) {
      p1 = P(-860, -240, z); p2 = P(860, -240, z);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    for (x = -860; x <= 860; x += 172) {
      p1 = P(x, -240, -300); p2 = P(x, -240, 300);
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
      if (x > x1 - 7) continue;
      slats += '<polygon points="' + poly([[x, 1, -BELT_V], [x + 7, 1, -BELT_V], [x + 7, 1, BELT_V], [x, 1, BELT_V]]) + '" fill="' + k.slat + '"/>';
    }
    var s = boxSvg(BELT_LEGS[0] - 46, BELT_LEGS[0] + 46, -238, -34, -36, 52, F);
    s += boxSvg(BELT_LEGS[1] - 46, BELT_LEGS[1] + 46, -238, -34, -36, 52, F);
    s += boxSvg(x0, x1, -38, 0, -BELT_V, BELT_V, [k.beltTop, k.beltEdge, k.beltEdge]);
    s += '<g clip-path="url(#knuClipBelt)">' + slats + '</g>';
    s += boxSvg(x0, x1, 0, 14, -BELT_V - 14, -BELT_V, F);
    return s;
  }

  // low frame flanking the rollers — the tile camera crops the tall
  // overhead mount out on purpose, only the inner posts and accent
  // crossbar read at this size
  var FRAME_Z0 = 140, FRAME_Z1 = 196;
  function stationFrameSvg(k, accent) {
    var F = [k.top, k.front, k.right];
    var s = boxSvg(-262, -214, -238, 300, FRAME_Z0, FRAME_Z1, F);
    s += boxSvg(214, 262, -238, 300, FRAME_Z0, FRAME_Z1, F);
    s += boxSvg(-300, 300, -46, 2, 118, 224, F);
    s += '<polygon points="' + poly([[-190, -14, 118], [190, -14, 118], [190, 8, 118], [-190, 8, 118]]) + '" fill="' + accent + '" opacity="0.9"/>';
    return s;
  }

  // two driven rollers that seat and spin the workpiece at the station —
  // real roller geometry, unchanged from the design-tool scene
  function rollersSvg(k, spin) {
    var out = '';
    [-RZ, RZ].forEach(function (z) {
      var strips = '', i, RL = 138;
      for (i = 0; i < 8; i++) {
        var p0 = A0 + (A1 - A0) * (i / 8), p1 = A0 + (A1 - A0) * ((i + 1) / 8);
        var mid = (p0 + p1) / 2, lum = 0.5 + 0.5 * Math.cos(mid + 0.55);
        strips += '<polygon points="' + poly([
          [-RL, RY + RR * Math.cos(p0), z + RR * Math.sin(p0)], [RL, RY + RR * Math.cos(p0), z + RR * Math.sin(p0)],
          [RL, RY + RR * Math.cos(p1), z + RR * Math.sin(p1)], [-RL, RY + RR * Math.cos(p1), z + RR * Math.sin(p1)]
        ]) + '" fill="' + mix(k.right, k.dieTop, lum) + '"/>';
      }
      var ticks = '';
      for (i = 0; i < 8; i++) {
        var aa = wrapPi(spin + i * TAU / 8);
        if (aa < A0 + 0.06 || aa > A1 - 0.06) continue;
        ticks += '<path d="' + line([[-RL, RY + RR * Math.cos(aa), z + RR * Math.sin(aa)], [RL, RY + RR * Math.cos(aa), z + RR * Math.sin(aa)]]) +
          '" stroke="' + k.beltEdge + '" stroke-width="2.4" fill="none" opacity="0.55"/>';
      }
      out += '<g>' + strips + ticks +
        '<polygon points="' + poly(capRing(RL, RY, RR).map(function (p) { return [p[0], p[1], p[2] + z]; })) + '" fill="' + k.right + '"/></g>';
      out += boxSvg(-186, -RL, RY - 42, RY + 34, z - 30, z + 30, [k.dieTop, k.front, k.right]);
      out += boxSvg(RL, 186, RY - 42, RY + 34, z - 30, z + 30, [k.dieTop, k.front, k.right]);
    });
    return out;
  }

  // the workpiece: a smooth cylinder whose middle band takes the diamond
  // knurl as it rolls under the wheel — every lattice cell drawn here is
  // displaced material, not a cut. Real lattice geometry, unchanged.
  function cylinderSvg(k, a, cy, rot, formed) {
    var strips = '', i, j, N = 13;
    for (i = 0; i < N; i++) {
      var p0 = A0 + (A1 - A0) * (i / N), p1 = A0 + (A1 - A0) * ((i + 1) / N);
      var mid = (p0 + p1) / 2, lum = Math.pow(Math.max(0, Math.cos(mid + 0.55)), 0.9);
      strips += '<polygon points="' + poly([surf(-CL, p0, cy, CR), surf(CL, p0, cy, CR), surf(CL, p1, cy, CR), surf(-CL, p1, cy, CR)]) +
        '" fill="' + mix(k.metalLo, k.metalHi, 0.12 + 0.88 * lum) + '"/>';
    }

    // diamond lattice in material coordinates; a cell is formed once it has
    // passed under the contact point at the top of the cylinder
    var cells = '', dth = (TAU / NA) * 0.44, dx = (2 * KB / NX) * 0.46;
    for (j = 0; j < NX; j++) {
      var xm = -KB + (2 * KB) * ((j + 0.5) / NX);
      for (i = 0; i < NA; i++) {
        var m = norm((i + (j % 2 ? 0.5 : 0)) * TAU / NA);
        if (TAU - m > formed) continue;
        var phi = wrapPi(m + rot);
        if (phi < A0 + 0.1 || phi > A1 - 0.12) continue;
        var lum2 = Math.pow(Math.max(0, Math.cos(phi + 0.55)), 0.9);
        var pts = [
          surf(xm, phi - dth, cy, CR + 2.4), surf(xm + dx, phi, cy, CR + 2.4),
          surf(xm, phi + dth, cy, CR + 2.4), surf(xm - dx, phi, cy, CR + 2.4)
        ];
        var fresh = (TAU - m) > formed - 0.42 && formed < TAU - 0.02;
        cells += '<polygon points="' + poly(pts) + '" fill="' + (fresh ? a : mix(k.knurlLo, k.knurlHi, 0.2 + 0.8 * lum2)) +
          '" opacity="' + (fresh ? 0.95 : 0.9) + '"/>';
        cells += '<path d="' + line([pts[1], pts[2], pts[3]]) + '" stroke="' + k.knurlLo + '" stroke-width="1.6" fill="none" opacity="0.55"/>';
      }
    }

    var s = '<g>' + strips + '</g><g>' + cells + '</g>';
    if (formed > 0.03) {
      s += '<g fill="none" stroke="' + k.knurlLo + '" stroke-width="2.2" opacity="0.5">';
      s += '<path d="' + line(arcAt(-KB, A0 + 0.1, A1 - 0.1, cy, CR + 2.4, 16)) + '"/>';
      s += '<path d="' + line(arcAt(KB, A0 + 0.1, A1 - 0.1, cy, CR + 2.4, 16)) + '"/>';
      s += '</g>';
    }
    s += '<polygon points="' + poly(capRing(CL, cy, CR)) + '" fill="' + k.cap + '"/>';
    s += '<polygon points="' + poly(capRing(CL, cy, CR * 0.42)) + '" fill="' + k.capIn + '" opacity="0.85"/>';
    return s;
  }

  // the forming tool: a hardened wheel with patterned teeth on a pressure
  // arm — real wheel geometry, unchanged; only the visible stub of its
  // overhead mount is shortened to suit the tight tile crop
  var ARM_Z0 = 130, ARM_Z1 = 196, COLLAR_Z0 = 110, COLLAR_Z1 = 216, MOUNT_TOP = 420;
  function wheelSvg(k, cy, spin, a) {
    var strips = '', i, N = 9;
    for (i = 0; i < N; i++) {
      var p0 = A0 + (A1 - A0) * (i / N), p1 = A0 + (A1 - A0) * ((i + 1) / N);
      var mid = (p0 + p1) / 2, lum = Math.max(0, Math.cos(mid + 0.55));
      strips += '<polygon points="' + poly([surf(-WT, p0, cy, WR), surf(WT, p0, cy, WR), surf(WT, p1, cy, WR), surf(-WT, p1, cy, WR)]) +
        '" fill="' + mix(k.wheelLo, k.wheelHi, 0.15 + 0.85 * lum) + '"/>';
    }
    var teeth = '';
    for (i = 0; i < 24; i++) {
      var ang = wrapPi(spin + i * TAU / 24);
      if (ang < A0 + 0.05 || ang > A1 - 0.05) continue;
      teeth += '<path d="' + line([surf(-WT, ang, cy, WR + 2.4), surf(WT, ang + 0.26, cy, WR + 2.4)]) + '" stroke="' + k.tooth + '" stroke-width="3" fill="none" opacity="0.7"/>';
      teeth += '<path d="' + line([surf(-WT, ang + 0.26, cy, WR + 2.4), surf(WT, ang, cy, WR + 2.4)]) + '" stroke="' + k.wheelLo + '" stroke-width="2.4" fill="none" opacity="0.45"/>';
    }
    var s = '<g>' + strips + '</g>' + teeth;
    s += '<polygon points="' + poly(capRing(WT, cy, WR)) + '" fill="' + k.cap + '"/>';
    s += '<polygon points="' + poly(capRing(WT, cy, 15)) + '" fill="' + k.capIn + '"/>';
    s += boxSvg(-34, 34, cy - 26, cy + 200, ARM_Z0, ARM_Z1, [k.top, k.front, k.right]);
    s += boxSvg(-100, 100, cy + 200, cy + 258, COLLAR_Z0, COLLAR_Z1, [k.top, k.front, k.right]);
    s += '<polygon points="' + poly([[-100, cy + 224, COLLAR_Z0], [100, cy + 224, COLLAR_Z0], [100, cy + 244, COLLAR_Z0], [-100, cy + 244, COLLAR_Z0]]) + '" fill="' + a + '" opacity="0.9"/>';
    s += boxSvg(-40, 40, cy + 258, MOUNT_TOP, ARM_Z0, ARM_Z1, [k.top, k.front, k.right]);
    return s;
  }

  function indicatorsSvg(o, cy, a) {
    if (o <= 0.003) return '';
    var marks = '';
    [-1, 1].forEach(function (s) {
      marks += '<path d="' + line([[s * KB, cy + CR + 40, -66], [s * KB, cy + CR + 12, -66]]) + '"/>';
    });
    var s = '<g opacity="' + o + '" stroke="' + a + '" stroke-width="5" fill="none" stroke-linecap="square">';
    s += marks;
    s += '<path d="' + line([[-KB, cy + CR + 40, -66], [KB, cy + CR + 40, -66]]) + '" stroke-width="4" stroke-dasharray="16 11"/>';
    s += '</g>';
    return s;
  }

  // ---- authored timeline: real knurling cycle stages (Align, Engage,
  // Knurl, Retract, Exit) compressed into a tight 6s loop by shortening
  // the feed/exit travel legs; the seat, spin-and-form and retract beats
  // keep the same relative order and read clearly ----
  var CUES = { Align: 0.90, Engage: 1.20, Knurl: 1.75, Retract: 4.15, Exit: 4.90 };
  var TOTAL = 6.0;

  // two phases of the same cylinder so one is always sliding through while
  // the next is queued, giving the belt a continuous look across the hard
  // loop cut (same trick as the multi-station scene)
  function partSvg(k, a, T, C, total, phase, contact) {
    var E = Easing;
    var local = T - phase * total;
    if (local < -1.05 || local > total + 0.05) return '';

    var x = seg(local, -0.85, C.Align, TRAVEL_IN, ALIGN_X, E.easeOutCubic)
      + seg(local, C.Align + 0.1, C.Engage, 0, ENGAGE_X - ALIGN_X, E.easeInOutCubic)
      + seg(local, C.Exit + 0.1, total - 0.05, 0, TRAVEL_OUT, E.easeInOutQuad);
    var cy = track(local, [[0, CY0], [C.Align + 0.1, CY0], [C.Align + 0.5, CY1], [C.Retract + 0.55, CY1], [C.Exit, CY0]], E.easeInOutCubic);
    var rot = track(local, [
      [C.Engage + 0.15, 0], [C.Knurl, 0.1 * TAU], [C.Retract - 0.1, WRAPS * TAU], [C.Retract + 0.35, (WRAPS + 0.05) * TAU]
    ], E.easeInOutCubic);
    var vis = (1 - seg(local, total - 0.35, total, 0, 1)) * seg(local, -0.95, -0.85, 0, 1);
    if (vis <= 0.002) return '';

    var formed = Math.min(TAU, rot);
    var s = '<g opacity="' + vis + '" transform="' + tv(x, 0, 0) + '">';
    s += cylinderSvg(k, a, cy, rot, formed);
    if (contact > 0.01) {
      s += '<path d="' + line([[-KB, cy + CR + 3, 0], [KB, cy + CR + 3, 0]]) + '" stroke="' + a + '" stroke-width="5" fill="none" opacity="' + (contact * 0.85) + '"/>';
    }
    s += '</g>';
    return s;
  }

  function railX(t, C, total) {
    return seg(t, -0.85, C.Align, TRAVEL_IN, ALIGN_X, Easing.easeOutCubic)
      + seg(t, C.Align + 0.1, C.Engage, 0, ENGAGE_X - ALIGN_X, Easing.easeInOutCubic)
      + seg(t, C.Exit + 0.1, total - 0.05, 0, TRAVEL_OUT, Easing.easeInOutQuad);
  }

  function pieceSvg(opts) {
    var dark = opts.dark, a = opts.accent || '#ec3013', T = opts.T;
    var K = theme(dark), C = CUES, total = TOTAL, E = Easing;

    var partX = railX(T, C, total), sp = (railX(total, C, total) - railX(0, C, total)) / 20;

    // station-level state: whichever cylinder currently occupies the
    // rollers, driven directly off T against the authored cues
    var cy = track(T, [[0, CY0], [C.Align + 0.1, CY0], [C.Align + 0.5, CY1], [C.Retract + 0.55, CY1], [C.Exit, CY0]], E.easeInOutCubic);
    var rot = track(T, [
      [C.Engage + 0.15, 0], [C.Knurl, 0.1 * TAU], [C.Retract - 0.1, WRAPS * TAU], [C.Retract + 0.35, (WRAPS + 0.05) * TAU]
    ], E.easeInOutCubic);
    var wheelSpin = -rot * (CR / WR);
    var press = track(T, [
      [C.Engage, 30], [C.Knurl, -5], [C.Retract, -5], [C.Retract + 0.7, 36], [C.Exit + 0.2, 130]
    ], E.easeInOutCubic);
    var wheelCy = cy + CR + WR + press;

    // one tight three-quarter view throughout; only a small push-in during
    // the forming pass itself — no long camera pan, the tile stays framed
    // on the rollers and wheel
    var zoom = track(T, [
      [0, 0.29], [C.Align, 0.29], [C.Knurl + 0.25, 0.34], [C.Retract + 0.3, 0.34], [C.Exit + 0.35, 0.29], [total, 0.29]
    ], E.easeInOutCubic);
    var focusY = track(T, [
      [0, 30], [C.Align, 30], [C.Knurl + 0.25, 150], [C.Retract + 0.3, 150], [C.Exit + 0.35, 30], [total, 30]
    ], E.easeInOutCubic);
    var st = Math.abs(T - C.Knurl);
    var shake = 1.8 * Math.exp(-st * 15) * Math.sin(st * 70) * (T >= C.Knurl ? 1 : 0);

    var fp = P(0, focusY, 0), ax = 250, ay = 95 + shake;
    var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

    var ind = seg(T, C.Align + 0.15, C.Align + 0.45, 0, 1) * (1 - seg(T, C.Knurl - 0.1, C.Knurl + 0.2, 0, 1));
    var contact = seg(T, C.Knurl - 0.1, C.Knurl + 0.15, 0, 1) * (1 - seg(T, C.Retract - 0.15, C.Retract + 0.1, 0, 1));
    var ring = { r: seg(T, C.Knurl, C.Knurl + 0.35, 30, 120, E.easeOutQuart), o: (1 - seg(T, C.Knurl, C.Knurl + 0.35, 0, 1, E.easeOutQuad)) * (T >= C.Knurl ? 0.45 : 0) };

    var defs = '<defs>' +
      '<filter id="knuSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>' +
      '<radialGradient id="knuVig" cx="0.5" cy="0.46" r="0.74">' +
      '<stop offset="0.55" stop-color="' + K.bg + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + (dark ? '#000000' : '#201e1d') + '" stop-opacity="' + (dark ? 0.5 : 0.12) + '"/></radialGradient>' +
      '<clipPath id="knuClipBelt"><polygon points="' + poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]]) + '"/></clipPath>' +
      '</defs>';

    var shadowFill = dark ? '#000000' : '#201e1d', shadowOp = dark ? 0.4 : 0.15;
    var shadows = '';
    [[-360, 10], [360, 10], [0, -70], [0, 90]].forEach(function (g) {
      var p = P(g[0], -238, g[1]);
      shadows += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="86" ry="28"/>';
    });
    var p0 = P(0, -238, 6);
    shadows += '<ellipse cx="' + p0[0].toFixed(1) + '" cy="' + p0[1].toFixed(1) + '" rx="210" ry="42" opacity="0.7"/>';

    // Corrective fit transform: measured via getBBox across the full loop —
    // the cylinder/roller mechanism otherwise overflows the 500x175 tile
    // frame at every sampled point, so an outer scale+center sits on top of
    // the existing camera transform. Requested scale 0.5 (up from the
    // no-crop-safe 0.448) — tallest/widest moments now crop past the frame
    // edges for a tighter hero-shot crop.
    var FIT = 'translate(125,30.125) scale(0.5)';
    var scene = '<g transform="' + FIT + ' ' + camT + '">';
    scene += floorSvg(K);
    scene += '<g filter="url(#knuSoft)" fill="' + shadowFill + '" opacity="' + shadowOp + '">' + shadows + '</g>';
    scene += stationFrameSvg(K, a);
    scene += beltSvg(K, partX, sp);
    scene += rollersSvg(K, -rot * (CR / RR));
    scene += partSvg(K, a, T, C, total, 0, contact);
    scene += partSvg(K, a, T, C, total, 1, 0);
    scene += indicatorsSvg(ind, cy, a);
    if (ring.o > 0.01) scene += '<g transform="' + tv(0, cy + CR + 6, 0) + '" opacity="' + ring.o + '"><ellipse cx="0" cy="0" rx="' + ring.r + '" ry="' + (ring.r * 0.3) + '" fill="none" stroke="' + a + '" stroke-width="4.5"/></g>';
    scene += wheelSvg(K, wheelCy, wheelSpin, a);
    scene += '</g>';

    var vignette = '<rect x="0" y="0" width="500" height="175" fill="url(#knuVig)" pointer-events="none"/>';

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

  window.NKMWKnurlingScene = { render: render, TOTAL: TOTAL, VIEWBOX: '0 0 500 175' };
})();
