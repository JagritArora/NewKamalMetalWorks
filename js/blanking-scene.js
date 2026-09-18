/* Vanilla port of the "Sheet Metal Blanking Animation 2" design-tool scene
   (blanking-scene.jsx) — same axonometric projection and choreography, now
   covering all four stations (Blanking, Punching, Bending, Coating +
   Polishing) as one continuous camera move, re-rendered as plain SVG markup
   driven directly by a T value instead of React/the CompositionStage player.
   No iframe, no transport UI: this just writes SVG into an element already
   sitting in the page. */
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

  // ---- geometry (identical to blanking-scene.jsx) ----
  var TH = 10;
  var STRIP_U = 400, STRIP_V = 120;
  var BELT_V = 135;
  var B1 = [-3200, -330], B2 = [-60, 1880], B3 = [2260, 3620], B4 = [4100, 7400];
  var BRIDGE1 = [-360, 120], BRIDGE2 = [1840, 2320], BRIDGE3 = [3580, 4140];
  var S1 = -850, S2 = 900, S3 = 2700, S4 = 5100;
  var ZO2 = 320, ZO3 = 640, ZO4 = 960;
  var BIN = [-470, -300];

  var OUTLINE = [
    [-150, -80], [-60, -80], [-30, -52], [40, -52], [70, -80], [150, -80],
    [150, -30], [112, 0], [150, 30], [150, 80],
    [60, 80], [30, 52], [-40, 52], [-70, 80], [-150, 80],
    [-150, 25], [-112, 0], [-150, -25]
  ].map(function (p) { return [p[0], 0, p[1]]; });

  function circleUV(cu, cv, r, n) {
    var a = [];
    for (var i = 0; i < n; i++) { var th = (i / n) * Math.PI * 2; a.push([cu + r * Math.cos(th), 0, cv + r * Math.sin(th)]); }
    return a;
  }
  function slotUV(cu, cv, hw, r, n) {
    var a = [], i, th;
    for (i = 0; i <= n; i++) { th = -Math.PI / 2 + (i / n) * Math.PI; a.push([cu + hw + r * Math.cos(th), 0, cv + r * Math.sin(th)]); }
    for (i = 0; i <= n; i++) { th = Math.PI / 2 + (i / n) * Math.PI; a.push([cu - hw + r * Math.cos(th), 0, cv + r * Math.sin(th)]); }
    return a;
  }
  var FEATURES = [
    circleUV(-108, -46, 15, 26),
    circleUV(-108, 46, 15, 26),
    circleUV(108, -46, 15, 26),
    circleUV(108, 46, 15, 26),
    slotUV(0, 0, 30, 12, 12)
  ];

  var PROFILE = pathOf(OUTLINE);
  var FEATURE_PATHS = FEATURES.map(function (h) { return pathOf(h); }).join('');
  var PUNCHED = PROFILE + FEATURE_PATHS;
  var STRIP_FULL = pathOf([[-STRIP_U, 0, -STRIP_V], [STRIP_U, 0, -STRIP_V], [STRIP_U, 0, STRIP_V], [-STRIP_U, 0, STRIP_V]]);
  var STRIP_CUT = STRIP_FULL + pathOf(OUTLINE.slice().reverse());

  // ---- stage 3: central bend ----
  var BH = 60;
  var BEND_DROP = 56;
  var DIE3_TOP = 130, DIE3_BOT = 64;

  function splitU(list, h) {
    var out = [], hs = [-h, h];
    for (var i = 0; i < list.length; i++) {
      var a = list[i], b = list[(i + 1) % list.length];
      out.push(a);
      var cuts = [];
      for (var j = 0; j < 2; j++) {
        var hv = hs[j];
        if ((a[0] - hv) * (b[0] - hv) < 0) {
          var f = (hv - a[0]) / (b[0] - a[0]);
          cuts.push([hv, a[2] + (b[2] - a[2]) * f, f]);
        }
      }
      cuts.sort(function (p, q) { return p[2] - q[2]; });
      for (j = 0; j < cuts.length; j++) out.push([cuts[j][0], 0, cuts[j][1]]);
    }
    return out;
  }
  function bendList(list, ang, drop) {
    return splitU(list, BH).map(function (p) {
      var a = Math.abs(p[0]), s = p[0] < 0 ? -1 : 1, L = a - BH;
      if (L <= 0) return [p[0], -drop, p[2]];
      return [s * (BH + L * Math.cos(ang)), -drop + L * Math.sin(ang), p[2]];
    });
  }
  var BENT_CACHE = {};
  function bentPaths(ang, drop) {
    var key = ang.toFixed(3) + ':' + drop.toFixed(1);
    if (BENT_CACHE[key]) return BENT_CACHE[key];
    var d = pathOf(bendList(OUTLINE, ang, drop));
    for (var i = 0; i < FEATURES.length; i++) d += pathOf(bendList(FEATURES[i], ang, drop));
    if (Object.keys(BENT_CACHE).length > 400) BENT_CACHE = {};
    BENT_CACHE[key] = d;
    return d;
  }
  var FOLD_V = (function () {
    var lo = 1e9, hi = -1e9;
    for (var i = 0; i < OUTLINE.length; i++) {
      var a = OUTLINE[i], b = OUTLINE[(i + 1) % OUTLINE.length];
      if ((a[0] - BH) * (b[0] - BH) < 0) {
        var v = a[2] + (b[2] - a[2]) * ((BH - a[0]) / (b[0] - a[0]));
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    return [lo, hi];
  })();

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

  function shade(hex, f) {
    var h = (hex || '#3a3d40').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    var t = f > 0 ? 255 : 0, k = Math.abs(f);
    function m(c) { return Math.round(c + (t - c) * k); }
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function rnd(i, s) { var v = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); }

  function theme(dark) {
    return dark ? {
      bg: '#17181a', ink: '#e8e6e4', grid: 'rgba(255,255,255,0.055)',
      top: '#4c4f52', front: '#32353a', right: '#23262a',
      beltTop: '#2a2c2f', beltEdge: '#1d1f22', slat: '#3a3d41', dieTop: '#3f4347',
      sheet: 'url(#gSheetD)', sheetEdge: '#6f7479', cavity: '#101113', shadow: 'rgba(0,0,0,0.55)'
    } : {
      bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
      top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
      beltTop: '#5f6266', beltEdge: '#43464a', slat: '#74787c', dieTop: '#9b9ea2',
      sheet: 'url(#gSheet)', sheetEdge: '#9ea3a8', cavity: '#6e7276', shadow: 'rgba(32,30,29,0.22)'
    };
  }

  // ---- parts ----
  function floorSvg(k) {
    var lines = [], x, z, p1, p2;
    for (z = -900; z <= 1080; z += 180) {
      p1 = P(-3400, -240, z); p2 = P(5400, -240, z);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    for (x = -3400; x <= 5400; x += 180) {
      p1 = P(x, -240, -900); p2 = P(x, -240, 1080);
      lines.push('<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>');
    }
    return '<g stroke="' + k.grid + '" stroke-width="2" fill="none">' + lines.join('') + '</g>';
  }

  function pressFrameSvg(k, x, z, accent) {
    z = z || 0;
    var F = [k.top, k.front, k.right];
    var s = boxSvg(x - 380, x - 320, -230, 600, z + 150, z + 250, F);
    s += boxSvg(x + 320, x + 380, -230, 600, z + 150, z + 250, F);
    s += boxSvg(x - 430, x + 430, 600, 700, z + 120, z + 280, F);
    s += '<polygon points="' + poly([[x - 220, 638, z + 120], [x + 220, 638, z + 120], [x + 220, 662, z + 120], [x - 220, 662, z + 120]]) + '" fill="' + accent + '" opacity="0.9"/>';
    return s;
  }

  function beltSvg(k, span, legs, phase, spacing, z, clipUrl) {
    z = z || 0;
    var F = [k.top, k.front, k.right];
    var x0 = span[0], x1 = span[1];
    var base = x0 + (((phase % spacing) + spacing) % spacing);
    var slats = '', n = Math.ceil((x1 - x0) / spacing) + 1;
    for (var i = 0; i < n; i++) {
      var x = base + i * spacing;
      if (x > x1 - 7) continue;
      slats += '<polygon points="' + poly([[x, 1, z - BELT_V], [x + 7, 1, z - BELT_V], [x + 7, 1, z + BELT_V], [x, 1, z + BELT_V]]) + '" fill="' + k.slat + '"/>';
    }
    var s = boxSvg(legs[0] - 60, legs[0] + 60, -240, -30, z - 40, z + 60, F);
    s += boxSvg(legs[1] - 60, legs[1] + 60, -240, -30, z - 40, z + 60, F);
    s += boxSvg(x0, x1, -40, 0, z - BELT_V, z + BELT_V, [k.beltTop, k.beltEdge, k.beltEdge]);
    s += '<g clip-path="' + clipUrl + '">' + slats + '</g>';
    s += boxSvg(x0, x1, 0, 16, z + 145, z + 161, F);
    return s;
  }

  function bridgeSvg(k, span, za, zb) {
    var rollers = '';
    for (var x = span[0] + 40; x < span[1] - 20; x += 100) {
      rollers += boxSvg(x, x + 40, -24, -2, za - BELT_V - 20, zb + BELT_V + 20, [k.dieTop, k.right, k.right]);
    }
    return boxSvg(span[0], span[1], -80, -24, za - BELT_V - 20, zb + BELT_V + 20, [k.front, k.right, k.right]) + rollers;
  }

  function scrapChuteSvg(k) {
    var s = boxSvg(BIN[0], BIN[1], -30, 4, -360, -100, [k.right, k.right, k.front]);
    s += boxSvg(BIN[0] - 40, BIN[1] + 40, -240, -30, -430, -170, [k.beltEdge, k.right, k.front]);
    return s;
  }

  function dieSvg(k, x, z, mode) {
    z = z || 0;
    var b = box(x - 290, x + 290, -52, 0, z - 150, z + 172);
    var s = '<polygon points="' + b.right + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + b.front + '" fill="' + k.right + '"/>';
    s += '<g transform="' + tv(x, 0, z) + '">';
    if (mode === 'profile') {
      s += '<path d="' + PROFILE + '" transform="translate(0,34)" fill="' + k.cavity + '"/>';
      s += '<path d="' + PROFILE + '" fill="' + k.cavity + '" opacity="0.9"/>';
    } else {
      s += '<path d="' + FEATURE_PATHS + '" fill-rule="evenodd" transform="translate(0,30)" fill="' + k.cavity + '"/>';
      s += '<path d="' + FEATURE_PATHS + '" fill-rule="evenodd" fill="' + k.cavity + '" opacity="0.9"/>';
    }
    s += '</g>';
    s += '<polygon points="' + b.top + '" fill="' + k.dieTop + '" clip-path="' + (mode === 'profile' ? 'url(#clipDie1)' : 'url(#clipDie2)') + '"/>';
    return s;
  }

  function bendDieSvg(k, x, z) {
    z = z || 0;
    var z0 = z - 150, z1 = z + 172;
    var face = poly([
      [x - 290, -110, z0], [x - 290, 0, z0], [x - DIE3_TOP, 0, z0], [x - DIE3_BOT, -BEND_DROP, z0],
      [x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_TOP, 0, z0], [x + 290, 0, z0], [x + 290, -110, z0]
    ]);
    var s = '<polygon points="' + poly([[x + 290, -110, z0], [x + 290, -110, z1], [x + 290, 0, z1], [x + 290, 0, z0]]) + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + poly([[x - 290, 0, z0], [x - DIE3_TOP, 0, z0], [x - DIE3_TOP, 0, z1], [x - 290, 0, z1]]) + '" fill="' + k.dieTop + '"/>';
    s += '<polygon points="' + poly([[x + DIE3_TOP, 0, z0], [x + 290, 0, z0], [x + 290, 0, z1], [x + DIE3_TOP, 0, z1]]) + '" fill="' + k.dieTop + '"/>';
    s += '<polygon points="' + poly([[x - DIE3_TOP, 0, z0], [x - DIE3_BOT, -BEND_DROP, z0], [x - DIE3_BOT, -BEND_DROP, z1], [x - DIE3_TOP, 0, z1]]) + '" fill="' + k.front + '"/>';
    s += '<polygon points="' + poly([[x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_TOP, 0, z0], [x + DIE3_TOP, 0, z1], [x + DIE3_BOT, -BEND_DROP, z1]]) + '" fill="' + k.right + '"/>';
    s += '<polygon points="' + poly([[x - DIE3_BOT, -BEND_DROP, z0], [x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_BOT, -BEND_DROP, z1], [x - DIE3_BOT, -BEND_DROP, z1]]) + '" fill="' + k.cavity + '"/>';
    s += '<polygon points="' + face + '" fill="' + k.right + '"/>';
    return s;
  }

  function boothSvg(k, x, z, accent) {
    var F = [k.top, k.front, k.right];
    var s = boxSvg(x - 470, x - 410, -230, 600, z + 150, z + 250, F);
    s += boxSvg(x + 410, x + 470, -230, 600, z + 150, z + 250, F);
    s += boxSvg(x - 520, x + 520, 600, 690, z - 40, z + 280, F);
    s += '<polygon points="' + poly([[x - 300, 636, z - 40], [x + 300, 636, z - 40], [x + 300, 660, z - 40], [x - 300, 660, z - 40]]) + '" fill="' + accent + '" opacity="0.9"/>';
    s += boxSvg(x - 470, x + 470, 0, 26, z + 235, z + 251, F);
    s += boxSvg(x - 300, x + 300, -40, 0, z - 150, z + 172, [k.dieTop, k.right, k.right]);
    return s;
  }

  function nozzleSvg(k, x, y, z, accent) {
    var s = boxSvg(x - 340, x - 280, y + 40, 560, z + 60, z + 120, [k.top, k.front, k.right]);
    s += boxSvg(x - 340, x - 40, y + 40, y + 96, z + 60, z + 120, [k.top, k.front, k.right]);
    s += boxSvg(x - 78, x - 30, y, y + 44, z + 66, z + 114, [k.dieTop, k.front, k.right]);
    s += '<polygon points="' + poly([[x - 66, y - 16, z + 74], [x - 42, y - 16, z + 74], [x - 42, y, z + 74], [x - 66, y, z + 74]]) + '" fill="' + accent + '"/>';
    return s;
  }

  function powderSvg(o, x, z, t, tipY, density, color) {
    if (o <= 0.004) return '';
    var tipX = x - 54, tipZ = z + 90;
    var n = Math.max(6, Math.round(density));
    var dots = '';
    for (var i = 0; i < n; i++) {
      var a = rnd(i, 1), b = rnd(i, 2), cc = rnd(i, 3), d = rnd(i, 4);
      var u = ((t * 0.62 + a) % 1);
      var e = u * u * (3 - 2 * u);
      var tx = x + (b * 2 - 1) * 168, tz = z + (cc * 2 - 1) * 92, ty = 96 + d * 46;
      var px = tipX + (tx - tipX) * e + Math.sin(t * 1.9 + a * 6.28) * 34 * (1 - e);
      var pz = tipZ + (tz - tipZ) * e + Math.cos(t * 1.6 + b * 6.28) * 26 * (1 - e);
      var py = tipY + (ty - tipY) * e;
      var fade = Math.min(1, u * 7) * (1 - Math.max(0, (u - 0.72) / 0.28));
      var p = P(px, py, pz);
      dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + ((2.6 + d * 4.4) * (1 - e * 0.45)).toFixed(2) + '" opacity="' + (fade * 0.85) + '"/>';
    }
    var cone = poly([
      [tipX - 16, tipY, tipZ - 14], [tipX + 16, tipY, tipZ + 14],
      [x + 190, 110, z + 108], [x + 150, 110, z - 96], [x - 200, 110, z - 70]
    ]);
    var s = '<g opacity="' + o + '">';
    s += '<polygon points="' + cone + '" fill="' + color + '" opacity="0.07" filter="url(#mist)"/>';
    s += '<polygon points="' + cone + '" fill="' + color + '" opacity="0.035"/>';
    s += '<g fill="' + color + '" filter="url(#mist)">' + dots + '</g>';
    s += '</g>';
    return s;
  }

  function polishHeadSvg(k, x, y, z, o, spin, accent) {
    if (o <= 0.004) return '';
    var ticks = '';
    for (var i = 0; i < 7; i++) {
      var ph = ((spin + i / 7) % 1) * Math.PI * 2;
      var dz = Math.sin(ph) * 60, sc = 0.45 + 0.55 * (Math.cos(ph) * 0.5 + 0.5);
      ticks += '<polyline points="' + poly([[x - 46, y + 8, z + dz], [x + 46, y + 8, z + dz]]) + '" stroke="' + k.dieTop + '" stroke-width="' + (2 + sc * 2.4) + '" opacity="' + (0.35 + sc * 0.45) + '"/>';
    }
    var s = '<g opacity="' + o + '">';
    s += boxSvg(x - 18, x + 18, y + 74, 580, z - 14, z + 26, [k.top, k.front, k.right]);
    s += boxSvg(x - 56, x + 56, y + 20, y + 82, z - 78, z + 78, [k.top, k.front, k.right]);
    s += '<g fill="none" stroke-linecap="round">' + ticks + '</g>';
    s += '<polygon points="' + poly([[x - 56, y + 46, z - 78], [x + 56, y + 46, z - 78], [x + 56, y + 62, z - 78], [x - 56, y + 62, z - 78]]) + '" fill="' + accent + '" opacity="0.85"/>';
    s += '</g>';
    return s;
  }

  function indicatorsSvg(o, x, z, halfU, halfV, accent, bend) {
    if (o <= 0.002) return '';
    z = z || 0;
    var u = halfU, v = halfV, L = Math.min(95, u * 0.4), marks = '';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (sgn) {
      marks += '<polyline points="' + poly([[sgn[0] * u - sgn[0] * L, 0, sgn[1] * v], [sgn[0] * u, 0, sgn[1] * v], [sgn[0] * u, 0, sgn[1] * v - sgn[1] * L]]) + '"/>';
    });
    var s = '<g opacity="' + o + '" transform="' + tv(x, 18, z) + '" stroke="' + accent + '" stroke-width="5" fill="none" stroke-linecap="square">';
    s += marks;
    s += '<polyline points="' + poly([[-46, 0, 0], [46, 0, 0]]) + '" stroke-width="5"/>';
    s += '<polyline points="' + poly([[0, 0, -46], [0, 0, 46]]) + '" stroke-width="5"/>';
    s += '<g opacity="0.5" stroke-width="4" stroke-dasharray="14 12">';
    s += '<polyline points="' + poly([[-u, 0, -168], [-u, 0, 168]]) + '"/>';
    s += '<polyline points="' + poly([[u, 0, -168], [u, 0, 168]]) + '"/>';
    s += '</g>';
    if (bend) {
      s += '<g opacity="0.75" stroke-width="4" stroke-dasharray="18 10">';
      s += '<polyline points="' + poly([[-BH, 0, -150], [-BH, 0, 150]]) + '"/>';
      s += '<polyline points="' + poly([[BH, 0, -150], [BH, 0, 150]]) + '"/>';
      s += '</g>';
    }
    s += '</g>';
    return s;
  }

  function ramSvg(k, x, y, z, mode, accent) {
    z = z || 0;
    var o = mode === 'bend' ? 190 : 60;
    var s = '';
    if (mode === 'bend') {
      s += boxSvg(x - 30, x + 30, y + 48, y + o, z + 20, z + 80, [k.top, k.front, k.right]);
      s += boxSvg(x - 52, x + 52, y, y + 48, z - 100, z + 92, [k.dieTop, k.front, k.right]);
    } else {
      s += '<g transform="' + tv(x, y + 60, z) + '">';
      if (mode === 'profile') {
        s += '<path d="' + PROFILE + '" transform="translate(0,60)" fill="' + k.right + '"/>';
        s += '<path d="' + PROFILE + '" fill="' + k.front + '"/>';
      } else {
        s += '<path d="' + FEATURE_PATHS + '" fill-rule="evenodd" transform="translate(0,60)" fill="' + k.right + '"/>';
        s += '<path d="' + FEATURE_PATHS + '" fill-rule="evenodd" fill="' + k.front + '"/>';
      }
      s += '</g>';
    }
    s += boxSvg(x - 195, x + 195, y + o, y + o + 44, z - 130, z + 168, [k.top, k.front, k.right]);
    s += boxSvg(x - 175, x + 175, y + o + 44, y + o + 158, z - 118, z + 155, [k.top, k.front, k.right]);
    s += '<polygon points="' + poly([[x - 90, y + o + 122, z - 118], [x + 90, y + o + 122, z - 118], [x + 90, y + o + 144, z - 118], [x - 90, y + o + 144, z - 118]]) + '" fill="' + accent + '" opacity="0.9"/>';
    s += boxSvg(x - 320, x - 195, y + o + 50, y + o + 120, z + 140, z + 210, [k.front, k.right, k.right]);
    s += boxSvg(x + 195, x + 320, y + o + 50, y + o + 120, z + 140, z + 210, [k.front, k.right, k.right]);
    return s;
  }

  function workpieceSvg(k, C, total, accent, t, phase, opts) {
    var a = accent, E = Easing;
    var ANG = ((opts && opts.bendAngle) || 42) * Math.PI / 180;
    var local = t - phase * total;
    if (local < -1.35 || local > total + 0.05) return '';

    var cut = C.Blank + 1.0, pierce = C.Punch + 0.9;
    var form0 = C.Bend + 0.55, form1 = C.Bend + 1.45;
    var isCut = local >= cut, isPierced = local >= pierce;

    var stripX = seg(local, -1.3, C.Align1, -3050, S1 - 40, E.easeOutCubic)
      + seg(local, C.Align1 + 0.15, C.Blank - 0.15, 0, 40, E.easeInOutCubic);
    var skelX = stripX + seg(local, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic);
    var skelZ = -seg(local, C.Transfer + 1.35, C.Transfer + 2.0, 0, 230, E.easeInQuad);
    var skelDrop = seg(local, C.Transfer + 1.45, C.Transfer + 2.0, 0, 300, E.easeInQuad);
    var skelO = 1 - seg(local, C.Transfer + 1.6, C.Transfer + 2.0, 0, 1);

    var partZ = seg(local, C.Transfer + 0.25, C.Align2 - 0.05, 0, ZO2, E.easeInOutCubic)
      + seg(local, C.Transfer2 + 0.25, C.Align3 - 0.05, 0, ZO3 - ZO2, E.easeInOutCubic)
      + seg(local, C.Transfer3 + 0.25, C.Align4 - 0.05, 0, ZO4 - ZO3, E.easeInOutCubic);
    var partX = stripX
      + seg(local, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
      + seg(local, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
      + seg(local, C.Transfer2 + 0.1, C.Align3 - 0.05, 0, S3 - S2 - 40, E.easeInOutCubic)
      + seg(local, C.Align3 + 0.1, C.Bend - 0.15, 0, 40, E.easeInOutCubic)
      + seg(local, C.Transfer3 + 0.1, C.Align4 - 0.05, 0, S4 - S3 - 40, E.easeInOutCubic)
      + seg(local, C.Align4 + 0.1, C.Coat - 0.15, 0, 40, E.easeInOutCubic)
      + seg(local, C.Reset + 0.1, total, 0, 1700, E.easeInOutQuad);

    var form = seg(local, form0, form1, 0, 1, E.easeInOutCubic);
    var relax = seg(local, form1 + 0.15, form1 + 0.4, 0, 1, E.easeOutCubic);
    var bendAng = ANG * form * (1 - 0.055 * relax);
    var bendDrop = BEND_DROP * form * (1 - 0.07 * relax);
    var lift = seg(local, C.Exit + 0.05, C.Exit + 0.5, 0, BEND_DROP * 0.93 + 10, E.easeOutCubic)
      - seg(local, C.Exit + 0.5, C.Exit + 0.95, 0, 10, E.easeInOutCubic);

    var partY = 10 - seg(local, cut, cut + 0.12, 0, 6, E.easeOutQuad)
      + seg(local, C.Transfer + 0.12, C.Transfer + 0.4, 0, 6, E.easeOutCubic)
      + lift;
    function flash(t0) { return seg(local, t0, t0 + 0.06, 0, 1) * (1 - seg(local, t0 + 0.3, t0 + 1.2, 0, 1, E.easeOutQuad)); }
    var edge = flash(cut) + flash(pierce);
    var foldO = seg(local, form0 - 0.25, form0 + 0.1, 0, 1) * (1 - seg(local, form1 + 0.5, form1 + 1.1, 0, 1));

    var slugDrop = seg(local, pierce, pierce + 0.5, 0, 210, E.easeInQuad);
    var slugO = (isPierced ? 1 : 0) * (1 - seg(local, pierce + 0.2, pierce + 0.55, 0, 1));

    var bent = bendAng > 0.0015;
    var partPath = bent ? bentPaths(bendAng, bendDrop) : (isPierced ? PUNCHED : PROFILE);

    var coatP = seg(local, C.Coat + 0.3, C.Polish - 0.15, 0, 1, E.easeInOutCubic);
    var polish = seg(local, C.Polish + 0.15, C.Reset - 0.05, 0, 1, E.easeInOutCubic);
    var polished = seg(local, C.Polish + 0.35, C.Reset + 0.1, 0, 1, E.easeOutCubic);
    var coatCol = (opts && opts.coatColor) || '#3a3d40';
    var gloss = (opts && opts.gloss != null) ? opts.gloss : 0.5;
    var idp = 'p' + phase;
    var w0 = Math.max(0, Math.min(0.999, coatP * 1.26 - 0.2));
    var w1 = Math.max(w0 + 0.001, Math.min(1, coatP * 1.26));
    var sh = polish, s0 = sh * 1.3 - 0.15;
    var exitO = 1 - seg(local, total - 0.5, total, 0, 1);

    var coatLayer = coatP <= 0.004 ? '' :
      '<g><defs>' +
      '<linearGradient id="gCoat' + idp + '" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="' + shade(coatCol, 0.3) + '"/>' +
      '<stop offset="0.28" stop-color="' + shade(coatCol, -0.08) + '"/>' +
      '<stop offset="0.52" stop-color="' + shade(coatCol, 0.14) + '"/>' +
      '<stop offset="0.78" stop-color="' + shade(coatCol, -0.26) + '"/>' +
      '<stop offset="1" stop-color="' + shade(coatCol, 0.04) + '"/></linearGradient>' +
      '<linearGradient id="wipe' + idp + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="' + w0.toFixed(3) + '" stop-color="#ffffff" stop-opacity="1"/>' +
      '<stop offset="' + w1.toFixed(3) + '" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
      '<mask id="mCoat' + idp + '" maskContentUnits="objectBoundingBox">' +
      '<rect x="0" y="0" width="1" height="1" fill="url(#wipe' + idp + ')"/></mask>' +
      '<linearGradient id="sheen' + idp + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="' + Math.max(0, Math.min(0.997, s0 - 0.06)).toFixed(3) + '" stop-color="#ffffff" stop-opacity="0"/>' +
      '<stop offset="' + Math.max(0.001, Math.min(0.998, s0)).toFixed(3) + '" stop-color="#ffffff" stop-opacity="1"/>' +
      '<stop offset="' + Math.max(0.002, Math.min(1, s0 + 0.06)).toFixed(3) + '" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
      '<mask id="mSheen' + idp + '" maskContentUnits="objectBoundingBox">' +
      '<rect x="0" y="0" width="1" height="1" fill="url(#sheen' + idp + ')"/></mask>' +
      '</defs>' +
      '<g mask="url(#mCoat' + idp + ')">' +
      '<path d="' + partPath + '" fill-rule="evenodd" transform="translate(0,' + TH + ')" fill="' + shade(coatCol, -0.4) + '"/>' +
      '<path d="' + partPath + '" fill-rule="evenodd" fill="url(#gCoat' + idp + ')"/></g>' +
      (polished > 0.004 ? '<path d="' + partPath + '" fill-rule="evenodd" fill="#ffffff" opacity="' + (polished * gloss * 0.17) + '"/>' : '') +
      (polish > 0.004 && polish < 0.999 ? '<g mask="url(#mSheen' + idp + ')"><path d="' + partPath + '" fill-rule="evenodd" fill="#ffffff" opacity="' + (0.1 + gloss * 0.14) + '"/></g>' : '') +
      '</g>';

    var foldLayer = '';
    if (foldO > 0.01) {
      foldLayer += '<g opacity="' + foldO + '">';
      foldLayer += '<g stroke="' + a + '" stroke-width="4.5" fill="none" stroke-dasharray="20 12">';
      foldLayer += '<polyline points="' + poly([[-BH, -bendDrop, FOLD_V[0]], [-BH, -bendDrop, FOLD_V[1]]]) + '"/>';
      foldLayer += '<polyline points="' + poly([[BH, -bendDrop, FOLD_V[0]], [BH, -bendDrop, FOLD_V[1]]]) + '"/>';
      foldLayer += '</g><g stroke="' + a + '" stroke-width="5" fill="none" stroke-linecap="square">';
      [-1, 1].forEach(function (s) {
        var tipU = s * (BH + 90 * Math.cos(bendAng)), tipY = -bendDrop + 90 * Math.sin(bendAng);
        foldLayer += '<polyline points="' + poly([
          [tipU - s * 26, tipY + 52, -14], [tipU, tipY + 86, -14], [tipU + s * 26, tipY + 52, -14]
        ]) + '"/>';
      });
      foldLayer += '</g></g>';
    }

    var partLayer = '<g transform="' + tv(partX, partY, partZ) + '" opacity="' + (isCut ? exitO : 0) + '">' +
      '<path d="' + partPath + '" fill-rule="evenodd" transform="translate(0,' + TH + ')" fill="' + k.sheetEdge + '"/>' +
      '<path d="' + partPath + '" fill-rule="evenodd" fill="' + k.sheet + '"/>' +
      coatLayer +
      '<path d="' + (bent ? pathOf(bendList(OUTLINE, bendAng, bendDrop)) : PROFILE) + '" fill="none" stroke="' + a + '" stroke-width="5" opacity="' + Math.min(1, edge + foldO * 0.8) + '"/>' +
      foldLayer +
      '</g>';

    var overlay = opts && opts.overlay;
    if (overlay) return bent ? partLayer : '';

    var s = '<g>';
    if (!isCut || skelO > 0.01) {
      s += '<g opacity="' + skelO + '">';
      s += '<g transform="' + tv(skelX + 16, 0.8 - skelDrop, skelZ - 18) + '" opacity="0.45">';
      s += '<path d="' + (isCut ? STRIP_CUT : STRIP_FULL) + '" fill-rule="evenodd" fill="' + k.shadow + '"/>';
      s += '</g>';
      s += '<g transform="' + tv(skelX, 10 - skelDrop, skelZ) + '">';
      s += '<path d="' + (isCut ? STRIP_CUT : STRIP_FULL) + '" fill-rule="evenodd" transform="translate(0,' + TH + ')" fill="' + k.sheetEdge + '"/>';
      s += '<path d="' + (isCut ? STRIP_CUT : STRIP_FULL) + '" fill-rule="evenodd" fill="' + k.sheet + '"/>';
      s += '</g></g>';
    }
    s += bent ? '' : partLayer;
    if (slugO > 0.01) {
      s += '<g transform="' + tv(partX, 4 - slugDrop, partZ) + '" opacity="' + (slugO * 0.8) + '">';
      s += '<path d="' + FEATURE_PATHS + '" fill-rule="evenodd" fill="' + k.cavity + '"/>';
      s += '</g>';
    }
    s += '</g>';
    return s;
  }

  // ---- authored timeline: normalise the raw OM_SCENES durations the same
  // way the CompositionStage engine does, so every hand-tuned offset in the
  // functions above (all written against an 18.2s scene) still lines up. ----
  var OM_DURS = [
    ['Feed', 1.96], ['Align1', 1.04], ['Blank', 2.03], ['Transfer', 3.04], ['Align2', 1.53],
    ['Punch', 1.89], ['Transfer2', 1.61], ['Align3', 1.4], ['Bend', 2.87], ['Exit', 1.19],
    ['Transfer3', 1.61], ['Align4', 1.23], ['Coat', 3.4], ['Polish', 2.1], ['Reset', 1.82]
  ];
  var RAW_CUES = {}, running = 0;
  for (var di = 0; di < OM_DURS.length; di++) { RAW_CUES[OM_DURS[di][0]] = running; running += OM_DURS[di][1]; }
  var RAW_TOTAL = running;
  var AUTHORED = 18.2;
  var R = RAW_TOTAL / AUTHORED;
  var CUES = {};
  for (var ck in RAW_CUES) CUES[ck] = RAW_CUES[ck] / R;
  var TOTAL = AUTHORED;

  function pieceSvg(opts) {
    var dark = opts.dark, accent = opts.accent || '#ec3013', labels = !!opts.labels, T = opts.T;
    var K = theme(dark), C = CUES, total = AUTHORED, E = Easing, a = accent;
    var wpOpts = { bendAngle: opts.bendAngle || 42, coatColor: opts.coatColor || '#2c3a46', gloss: opts.gloss != null ? opts.gloss : 0.85 };

    var cut = C.Blank + 1.0, pierce = C.Punch + 0.9;
    var form0 = C.Bend + 0.55, form1 = C.Bend + 1.45;

    var ram1 = seg(T, C.Blank + 0.2, cut - 0.06, 320, 16, E.easeInQuad) - seg(T, cut - 0.06, cut + 0.02, 0, 12, E.easeInQuad)
      + seg(T, cut + 0.3, C.Transfer - 0.05, 0, 316, E.easeInOutCubic);
    var ram2 = seg(T, C.Punch + 0.1, pierce - 0.06, 320, 16, E.easeInQuad) - seg(T, pierce - 0.06, pierce + 0.02, 0, 12, E.easeInQuad)
      + seg(T, pierce + 0.3, C.Transfer2 + 0.5, 0, 316, E.easeInOutCubic);
    var ram3 = track(T, [
      [C.Bend + 0.1, 320], [form0, 10], [form1, 10 - BEND_DROP],
      [form1 + 0.25, 10 - BEND_DROP + 4], [C.Exit + 0.9, 320]
    ], E.easeInOutCubic);

    function bp1(t) {
      return seg(t, -1.3, C.Align1, -3050, S1 - 40, E.easeOutCubic)
        + seg(t, C.Align1 + 0.15, C.Blank - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic);
    }
    function bp2(t) {
      return seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
        + seg(t, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Transfer2 + 0.1, C.Align3 - 0.05, 0, S3 - S2 - 40, E.easeInOutCubic);
    }
    function bp3(t) {
      return seg(t, C.Transfer2 + 0.1, C.Align3 - 0.05, 0, S3 - S2 - 40, E.easeInOutCubic)
        + seg(t, C.Align3 + 0.1, C.Bend - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Transfer3 + 0.1, C.Align4 - 0.05, 0, S4 - S3 - 40, E.easeInOutCubic);
    }
    function bp4(t) {
      return seg(t, C.Transfer3 + 0.1, C.Align4 - 0.05, 0, S4 - S3 - 40, E.easeInOutCubic)
        + seg(t, C.Align4 + 0.1, C.Coat - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Reset + 0.1, total, 0, 1700, E.easeInOutQuad);
    }
    var sp1 = (bp1(total) - bp1(0)) / 28, sp2 = (bp2(total) - bp2(0)) / 26;
    var sp3 = (bp3(total) - bp3(0)) / 26, sp4 = (bp4(total) - bp4(0)) / 26;

    var gl1 = [C.Transfer + 0.2, C.Align2 - 0.1], gl2 = [C.Transfer2 + 0.2, C.Align3 - 0.1];
    var gl3 = [C.Transfer3 + 0.2, C.Align4 - 0.1];
    var focus = track(T, [[0, S1], [gl1[0], S1], [gl1[1], S2], [gl2[0], S2], [gl2[1], S3], [C.Exit + 0.5, S3],
      [gl3[0], S3], [gl3[1], S4], [C.Reset + 0.2, S4], [C.Reset + 0.6, 2000], [C.Reset + 0.85, 2000], [total, S1]], E.easeInOutCubic);
    var focusY = track(T, [[0, 0], [gl2[1], 0], [C.Bend + 0.5, 170], [C.Bend + 1.95, 170], [C.Exit + 0.6, 0],
      [gl3[1], 70], [C.Polish + 1.0, 70], [C.Reset + 0.6, 0], [total, 0]], E.easeInOutCubic);
    var focusZ = track(T, [[0, 0], [gl1[0], 0], [gl1[1], ZO2], [gl2[0], ZO2], [gl2[1], ZO3], [C.Exit + 0.5, ZO3],
      [gl3[0], ZO3], [gl3[1], ZO4], [C.Reset + 0.2, ZO4], [C.Reset + 0.6, ZO3], [C.Reset + 0.85, ZO3], [total, 0]], E.easeInOutCubic);
    var zoom = track(T, [
      [0, 0.56], [gl1[0], 0.56], [(gl1[0] + gl1[1]) / 2, 0.47], [gl1[1], 0.56],
      [gl2[0], 0.56], [(gl2[0] + gl2[1]) / 2, 0.47], [gl2[1], 0.62], [C.Bend + 0.5, 0.86],
      [C.Bend + 1.95, 0.86], [C.Exit + 0.6, 0.6], [gl3[0], 0.58], [gl3[1], 0.72],
      [C.Coat + 1.2, 0.78], [C.Polish + 1.1, 0.78], [C.Reset + 0.2, 0.66],
      [C.Reset + 0.6, 0.17], [C.Reset + 0.85, 0.17], [total, 0.56]
    ], E.easeInOutCubic);
    var shakeT = Math.min(Math.abs(T - cut), Math.abs(T - pierce));
    var shake = 4 * Math.exp(-shakeT * 13) * Math.sin(shakeT * 78) * (T >= cut ? 1 : 0);
    var press3 = Math.abs(T - form1);
    shake += 2.6 * Math.exp(-press3 * 11) * Math.sin(press3 * 60) * (T >= form1 ? 1 : 0);

    var sub = seg(zoom, 0.24, 0.42, 0, 1);
    var fp = P(focus, focusY, focusZ), ax = 950, ay = 690 + shake;
    function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
    var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

    var ind1 = seg(T, C.Align1 + 0.1, C.Align1 + 0.4, 0, 1) * (1 - seg(T, C.Blank + 0.1, C.Blank + 0.4, 0, 1));
    var ind2 = seg(T, C.Align2 + 0.05, C.Align2 + 0.35, 0, 1) * (1 - seg(T, C.Punch + 0.05, C.Punch + 0.35, 0, 1));
    var ind3 = seg(T, C.Align3 + 0.05, C.Align3 + 0.35, 0, 1) * (1 - seg(T, C.Bend + 0.1, C.Bend + 0.4, 0, 1));
    var ind4 = seg(T, C.Align4 + 0.05, C.Align4 + 0.3, 0, 1) * (1 - seg(T, C.Coat + 0.3, C.Coat + 0.6, 0, 1));
    var sprayO = seg(T, C.Coat + 0.1, C.Coat + 0.5, 0, 1, E.easeOutCubic) * (1 - seg(T, C.Polish - 0.4, C.Polish - 0.05, 0, 1, E.easeInOutCubic));
    var polishO = seg(T, C.Polish + 0.05, C.Polish + 0.3, 0, 1) * (1 - seg(T, C.Reset - 0.2, C.Reset + 0.05, 0, 1));
    var polishX = S4 - 230 + 460 * seg(T, C.Polish + 0.2, C.Reset - 0.05, 0, 1, E.easeInOutCubic);
    var polishY = track(T, [[C.Polish + 0.05, 330], [C.Polish + 0.32, 122], [C.Reset - 0.15, 122], [C.Reset + 0.05, 330]], E.easeInOutCubic);
    var ring1 = { r: seg(T, cut, cut + 0.42, 90, 300, E.easeOutQuart), o: (1 - seg(T, cut, cut + 0.42, 0, 1, E.easeOutQuad)) * (T >= cut ? 0.5 : 0) };
    var ring2 = { r: seg(T, pierce, pierce + 0.42, 70, 240, E.easeOutQuart), o: (1 - seg(T, pierce, pierce + 0.42, 0, 1, E.easeOutQuad)) * (T >= pierce ? 0.5 : 0) };
    var ring3 = { r: seg(T, form1, form1 + 0.5, 80, 270, E.easeOutQuart), o: (1 - seg(T, form1, form1 + 0.5, 0, 1, E.easeOutQuad)) * (T >= form1 ? 0.4 : 0) };

    function pX(t) {
      return S1 + seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
        + seg(t, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Transfer2 + 0.1, C.Align3 - 0.05, 0, S3 - S2 - 40, E.easeInOutCubic)
        + seg(t, C.Align3 + 0.1, C.Bend - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Transfer3 + 0.1, C.Align4 - 0.05, 0, S4 - S3 - 40, E.easeInOutCubic)
        + seg(t, C.Align4 + 0.1, C.Coat - 0.15, 0, 40, E.easeInOutCubic)
        + seg(t, C.Reset + 0.1, total, 0, 1700, E.easeInOutQuad);
    }
    function pZ(t) {
      return seg(t, C.Transfer + 0.25, C.Align2 - 0.05, 0, ZO2, E.easeInOutCubic)
        + seg(t, C.Transfer2 + 0.25, C.Align3 - 0.05, 0, ZO3 - ZO2, E.easeInOutCubic)
        + seg(t, C.Transfer3 + 0.25, C.Align4 - 0.05, 0, ZO4 - ZO3, E.easeInOutCubic);
    }
    var lblBlank = scr(pX(T) - 40 + 130, 24, pZ(T) + 95);
    var lblSkel = scr(S1 + seg(T, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic) - 300, 24, 95);
    var lblPunched = scr(pX(T) - 40 + 130, 24, pZ(T) + 95);
    var lblDone = scr(pX(T) + 130, 24, pZ(T) + 95);
    var lblFin = scr(pX(T) + 130, 24, pZ(T) + 95);
    var show = labels ? 1 : 0;
    var oBlank = show * seg(T, C.Transfer + 0.5, C.Transfer + 0.85, 0, 1) * (1 - seg(T, C.Align2 - 0.4, C.Align2 - 0.05, 0, 1));
    var oSkel = show * seg(T, C.Transfer + 0.4, C.Transfer + 0.7, 0, 1) * (1 - seg(T, C.Transfer + 1.3, C.Transfer + 1.55, 0, 1));
    var oPunched = show * seg(T, C.Transfer2 + 0.45, C.Transfer2 + 0.8, 0, 1) * (1 - seg(T, C.Align3 - 0.4, C.Align3 - 0.05, 0, 1));
    var oDone = show * seg(T, C.Transfer3 + 0.35, C.Transfer3 + 0.7, 0, 1) * (1 - seg(T, C.Align4 - 0.3, C.Align4 - 0.02, 0, 1));
    var oFin = show * seg(T, C.Polish + 0.75, C.Polish + 1.1, 0, 1) * (1 - seg(T, C.Reset + 0.15, C.Reset + 0.45, 0, 1));
    var st1 = scr(S1 - 430, 780, 200), st2 = scr(S2 - 430, 780, ZO2 + 200), st3 = scr(S3 - 430, 780, ZO3 + 200);
    var st4 = scr(S4 - 500, 780, ZO4 + 200);
    var act1 = 0.4 + 0.6 * seg(T, C.Align1, C.Align1 + 0.3, 0, 1) * (1 - seg(T, C.Transfer, C.Transfer + 0.4, 0, 1));
    var act2 = 0.4 + 0.6 * seg(T, C.Align2 - 0.3, C.Align2, 0, 1) * (1 - seg(T, C.Transfer2, C.Transfer2 + 0.4, 0, 1));
    var act3 = 0.4 + 0.6 * seg(T, C.Align3 - 0.3, C.Align3, 0, 1) * (1 - seg(T, C.Exit + 0.2, C.Exit + 0.6, 0, 1));
    var act4 = 0.4 + 0.6 * seg(T, C.Align4 - 0.3, C.Align4, 0, 1) * (1 - seg(T, C.Reset + 0.2, C.Reset + 0.55, 0, 1));

    var vigStop = dark ? '#000000' : '#201e1d';
    var vigOp = dark ? 0.55 : 0.13;
    var shadowFill = dark ? '#000000' : '#201e1d';
    var shadowOp = dark ? 0.45 : 0.16;

    var defs = '<defs>' +
      '<linearGradient id="gSheet" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#fbfbfc"/><stop offset="0.26" stop-color="#dcdee1"/>' +
      '<stop offset="0.5" stop-color="#f2f3f4"/><stop offset="0.74" stop-color="#c9cccf"/>' +
      '<stop offset="1" stop-color="#e6e7e9"/></linearGradient>' +
      '<linearGradient id="gSheetD" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="#8f9498"/><stop offset="0.28" stop-color="#5c6064"/>' +
      '<stop offset="0.52" stop-color="#7e8388"/><stop offset="0.78" stop-color="#4a4e52"/>' +
      '<stop offset="1" stop-color="#6b7074"/></linearGradient>' +
      '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>' +
      '<filter id="mist" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<radialGradient id="vig" cx="0.5" cy="0.46" r="0.74">' +
      '<stop offset="0.55" stop-color="' + K.bg + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + vigStop + '" stop-opacity="' + vigOp + '"/></radialGradient>' +
      '<clipPath id="clipDie1" clip-rule="evenodd"><path d="' +
      (pathOf([[S1 - 290, 0, -150], [S1 + 290, 0, -150], [S1 + 290, 0, 172], [S1 - 290, 0, 172]]) +
        pathOf(OUTLINE.map(function (p) { return [p[0] + S1, 0, p[2]]; }))) +
      '" clip-rule="evenodd"/></clipPath>' +
      '<clipPath id="clipDie2" clip-rule="evenodd"><path d="' +
      (pathOf([[S2 - 290, 0, ZO2 - 150], [S2 + 290, 0, ZO2 - 150], [S2 + 290, 0, ZO2 + 172], [S2 - 290, 0, ZO2 + 172]]) +
        FEATURES.map(function (h) { return pathOf(h.map(function (p) { return [p[0] + S2, 0, p[2] + ZO2]; })); }).join('')) +
      '" clip-rule="evenodd"/></clipPath>' +
      '<clipPath id="clipB1"><polygon points="' + poly([[B1[0], 0, -BELT_V], [B1[1], 0, -BELT_V], [B1[1], 0, BELT_V], [B1[0], 0, BELT_V]]) + '"/></clipPath>' +
      '<clipPath id="clipB2"><polygon points="' + poly([[B2[0], 0, ZO2 - BELT_V], [B2[1], 0, ZO2 - BELT_V], [B2[1], 0, ZO2 + BELT_V], [B2[0], 0, ZO2 + BELT_V]]) + '"/></clipPath>' +
      '<clipPath id="clipB3"><polygon points="' + poly([[B3[0], 0, ZO3 - BELT_V], [B3[1], 0, ZO3 - BELT_V], [B3[1], 0, ZO3 + BELT_V], [B3[0], 0, ZO3 + BELT_V]]) + '"/></clipPath>' +
      '<clipPath id="clipB4"><polygon points="' + poly([[B4[0], 0, ZO4 - BELT_V], [B4[1], 0, ZO4 - BELT_V], [B4[1], 0, ZO4 + BELT_V], [B4[0], 0, ZO4 + BELT_V]]) + '"/></clipPath>' +
      '</defs>';

    var shadows = '';
    [[-2000, 10], [-200, ZO2 * 0.5], [S1 - 350, 200], [S1 + 350, 200], [1700, ZO2 + 10], [S2 - 350, ZO2 + 200], [S2 + 350, ZO2 + 200],
      [2100, ZO3 - 120], [4300, ZO3 + 10], [S3 - 350, ZO3 + 200], [S3 + 350, ZO3 + 200],
      [3900, ZO4 - 130], [6600, ZO4 + 10], [S4 - 440, ZO4 + 200], [S4 + 440, ZO4 + 200]].forEach(function (g) {
        var p = P(g[0], -238, g[1]);
        shadows += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="120" ry="40"/>';
      });
    [[S1, 20, 360], [S2, ZO2 + 20, 360], [S3, ZO3 + 20, 360], [S4, ZO4 + 20, 430]].forEach(function (e) {
      var p = P(e[0], -238, e[1]);
      shadows += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="' + e[2] + '" ry="58" opacity="0.7"/>';
    });

    var scene = '<g transform="' + camT + '">';
    scene += floorSvg(K);
    scene += '<g filter="url(#soft)" fill="' + shadowFill + '" opacity="' + shadowOp + '">' + shadows + '</g>';
    scene += boothSvg(K, S4, ZO4, a);
    scene += bridgeSvg(K, BRIDGE3, ZO3, ZO4);
    scene += beltSvg(K, B4, [S4 - 20, 6900], bp4(T), sp4, ZO4, 'url(#clipB4)');
    scene += indicatorsSvg(ind4, S4, ZO4, 158, 88, a);
    scene += pressFrameSvg(K, S3, ZO3, a);
    scene += beltSvg(K, B3, [S3 - 20, 4600], bp3(T), sp3, ZO3, 'url(#clipB3)');
    scene += bendDieSvg(K, S3, ZO3);
    scene += indicatorsSvg(ind3, S3, ZO3, 158, 88, a, true);
    scene += pressFrameSvg(K, S2, ZO2, a);
    scene += bridgeSvg(K, BRIDGE2, ZO2, ZO3);
    scene += beltSvg(K, B2, [S2 - 20, 1600], bp2(T), sp2, ZO2, 'url(#clipB2)');
    scene += dieSvg(K, S2, ZO2, 'features');
    scene += indicatorsSvg(ind2, S2, ZO2, 158, 88, a);
    scene += pressFrameSvg(K, S1, 0, a);
    scene += bridgeSvg(K, BRIDGE1, 0, ZO2);
    scene += beltSvg(K, B1, [-2500, S1 - 20], bp1(T), sp1, 0, 'url(#clipB1)');
    scene += dieSvg(K, S1, 0, 'profile');
    scene += indicatorsSvg(ind1, S1, 0, STRIP_U, STRIP_V, a);
    scene += workpieceSvg(K, C, total, a, T, 0, wpOpts);
    scene += workpieceSvg(K, C, total, a, T, 1, wpOpts);
    scene += boxSvg(B1[0], B1[1], 0, 16, -161, -145, [K.top, K.front, K.right]);
    scene += boxSvg(B2[0], B2[1], 0, 16, ZO2 - 161, ZO2 - 145, [K.top, K.front, K.right]);
    scene += boxSvg(B3[0], B3[1], 0, 16, ZO3 - 161, ZO3 - 145, [K.top, K.front, K.right]);
    scene += boxSvg(B4[0], B4[1], 0, 16, ZO4 - 161, ZO4 - 145, [K.top, K.front, K.right]);
    scene += scrapChuteSvg(K);
    if (ring1.o > 0.01) scene += '<g transform="' + tv(S1, 12, 0) + '" opacity="' + ring1.o + '"><ellipse cx="0" cy="0" rx="' + ring1.r + '" ry="' + (ring1.r * 0.34) + '" fill="none" stroke="' + a + '" stroke-width="5"/></g>';
    if (ring2.o > 0.01) scene += '<g transform="' + tv(S2, 12, ZO2) + '" opacity="' + ring2.o + '"><ellipse cx="0" cy="0" rx="' + ring2.r + '" ry="' + (ring2.r * 0.34) + '" fill="none" stroke="' + a + '" stroke-width="5"/></g>';
    if (ring3.o > 0.01) scene += '<g transform="' + tv(S3, 12, ZO3) + '" opacity="' + ring3.o + '"><ellipse cx="0" cy="0" rx="' + ring3.r + '" ry="' + (ring3.r * 0.34) + '" fill="none" stroke="' + a + '" stroke-width="5"/></g>';
    scene += ramSvg(K, S1, ram1, 0, 'profile', a);
    scene += ramSvg(K, S2, ram2, ZO2, 'features', a);
    scene += ramSvg(K, S3, ram3, ZO3, 'bend', a);
    scene += workpieceSvg(K, C, total, a, T, 0, { bendAngle: wpOpts.bendAngle, coatColor: wpOpts.coatColor, gloss: wpOpts.gloss, overlay: true });
    scene += workpieceSvg(K, C, total, a, T, 1, { bendAngle: wpOpts.bendAngle, coatColor: wpOpts.coatColor, gloss: wpOpts.gloss, overlay: true });
    scene += nozzleSvg(K, S4, 300, ZO4, a);
    scene += powderSvg(sprayO, S4, ZO4, T, 286, (opts.powder || 80), shade(wpOpts.coatColor, dark ? 0.55 : 0.34));
    scene += polishHeadSvg(K, polishX, polishY, ZO4 + 10, polishO, T * 2.4, a);
    scene += '</g>';

    var vignette = '<rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointer-events="none"/>';

    var textLayer = '<g font-family="Space Grotesk, system-ui, sans-serif" font-size="30" font-weight="600" letter-spacing="3.4">';
    textLayer += '<g opacity="' + act1 + '"><line x1="' + st1[0] + '" y1="' + st1[1] + '" x2="' + (st1[0] + 300) + '" y2="' + st1[1] + '" stroke="' + K.ink + '" stroke-width="2.5"/><text x="' + st1[0] + '" y="' + (st1[1] - 14) + '" fill="' + K.ink + '">01 BLANKING</text></g>';
    textLayer += '<g opacity="' + act2 + '"><line x1="' + st2[0] + '" y1="' + st2[1] + '" x2="' + (st2[0] + 300) + '" y2="' + st2[1] + '" stroke="' + K.ink + '" stroke-width="2.5"/><text x="' + st2[0] + '" y="' + (st2[1] - 14) + '" fill="' + K.ink + '">02 PUNCHING</text></g>';
    textLayer += '<g opacity="' + act3 + '"><line x1="' + st3[0] + '" y1="' + st3[1] + '" x2="' + (st3[0] + 300) + '" y2="' + st3[1] + '" stroke="' + K.ink + '" stroke-width="2.5"/><text x="' + st3[0] + '" y="' + (st3[1] - 14) + '" fill="' + K.ink + '">03 BENDING</text><text x="' + st3[0] + '" y="' + (st3[1] + 34) + '" fill="' + K.ink + '" font-size="21" font-weight="500" letter-spacing="2.6" opacity="' + (0.72 * sub) + '">CENTRAL FORMING</text></g>';
    textLayer += '<g opacity="' + act4 + '"><line x1="' + st4[0] + '" y1="' + st4[1] + '" x2="' + (st4[0] + 300) + '" y2="' + st4[1] + '" stroke="' + K.ink + '" stroke-width="2.5"/><text x="' + st4[0] + '" y="' + (st4[1] - 14) + '" fill="' + K.ink + '">04 FINISHING</text><text x="' + st4[0] + '" y="' + (st4[1] + 34) + '" fill="' + K.ink + '" font-size="21" font-weight="500" letter-spacing="2.6" opacity="' + (0.72 * sub) + '">POWDER COATING + POLISHING</text></g>';
    if (oBlank > 0.01) textLayer += '<g opacity="' + oBlank + '"><line x1="' + lblBlank[0] + '" y1="' + lblBlank[1] + '" x2="' + lblBlank[0] + '" y2="' + (lblBlank[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><line x1="' + lblBlank[0] + '" y1="' + (lblBlank[1] - 96) + '" x2="' + (lblBlank[0] + 66) + '" y2="' + (lblBlank[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><text x="' + (lblBlank[0] + 78) + '" y="' + (lblBlank[1] - 87) + '" fill="' + a + '">BLANK &#183; PROFILE ONLY</text></g>';
    if (oSkel > 0.01) textLayer += '<g opacity="' + oSkel + '"><line x1="' + lblSkel[0] + '" y1="' + lblSkel[1] + '" x2="' + lblSkel[0] + '" y2="' + (lblSkel[1] - 96) + '" stroke="' + K.ink + '" stroke-width="2.5"/><line x1="' + (lblSkel[0] - 66) + '" y1="' + (lblSkel[1] - 96) + '" x2="' + lblSkel[0] + '" y2="' + (lblSkel[1] - 96) + '" stroke="' + K.ink + '" stroke-width="2.5"/><text x="' + (lblSkel[0] - 78) + '" y="' + (lblSkel[1] - 87) + '" fill="' + K.ink + '" text-anchor="end">SKELETON</text></g>';
    if (oPunched > 0.01) textLayer += '<g opacity="' + oPunched + '"><line x1="' + lblPunched[0] + '" y1="' + lblPunched[1] + '" x2="' + lblPunched[0] + '" y2="' + (lblPunched[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><line x1="' + lblPunched[0] + '" y1="' + (lblPunched[1] - 96) + '" x2="' + (lblPunched[0] + 66) + '" y2="' + (lblPunched[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><text x="' + (lblPunched[0] + 78) + '" y="' + (lblPunched[1] - 87) + '" fill="' + a + '">PUNCHED FLAT PART</text></g>';
    if (oDone > 0.01) textLayer += '<g opacity="' + oDone + '"><line x1="' + lblDone[0] + '" y1="' + lblDone[1] + '" x2="' + lblDone[0] + '" y2="' + (lblDone[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><line x1="' + (lblDone[0] - 66) + '" y1="' + (lblDone[1] - 96) + '" x2="' + lblDone[0] + '" y2="' + (lblDone[1] - 96) + '" stroke="' + a + '" stroke-width="2.5"/><text x="' + (lblDone[0] - 78) + '" y="' + (lblDone[1] - 87) + '" fill="' + a + '" text-anchor="end">FORMED PART &#183; TWO WINGS</text></g>';
    if (oFin > 0.01) textLayer += '<g opacity="' + oFin + '"><line x1="' + lblFin[0] + '" y1="' + lblFin[1] + '" x2="' + lblFin[0] + '" y2="' + (lblFin[1] - 118) + '" stroke="' + a + '" stroke-width="2.5"/><line x1="' + (lblFin[0] - 66) + '" y1="' + (lblFin[1] - 118) + '" x2="' + lblFin[0] + '" y2="' + (lblFin[1] - 118) + '" stroke="' + a + '" stroke-width="2.5"/><text x="' + (lblFin[0] - 78) + '" y="' + (lblFin[1] - 109) + '" fill="' + a + '" text-anchor="end">COATED + POLISHED &#183; FINISHED</text></g>';
    textLayer += '</g>';

    return defs + '<rect x="0" y="0" width="1920" height="1080" fill="' + K.bg + '"/>' + scene + vignette + textLayer;
  }

  function render(svgEl, T, opts) {
    if (!svgEl) return;
    svgEl.innerHTML = pieceSvg({
      dark: !!(opts && opts.dark),
      accent: (opts && opts.accent) || '#ec3013',
      labels: !!(opts && opts.labels),
      bendAngle: opts && opts.bendAngle,
      coatColor: opts && opts.coatColor,
      gloss: opts && opts.gloss,
      powder: opts && opts.powder,
      T: T
    });
  }

  // Authored end-of-line: the finished part is still framed on station 04,
  // just before the camera pulls wide and glides back to press 01 for the
  // next loop. A scroll-driven page has no loop, so callers should clamp T
  // here instead of riding through the reset move.
  var END_T = CUES.Reset + 0.2;

  window.NKMWBlankingScene = { render: render, TOTAL: TOTAL, CUES: CUES, END_T: END_T };
})();
