
// Knurling station. A finished smooth cylinder rides in from the left, lifts
// onto two driven rollers, and a patterned wheel presses in and rolls a diamond
// knurl into the middle of its surface. Cold forming only — the metal is
// displaced, never cut, and nothing leaves the part.

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
function track(t, ks, ease) {
  if (t <= ks[0][0]) return ks[0][1];
  for (var i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) return seg(t, ks[i - 1][0], ks[i][0], ks[i - 1][1], ks[i][1], ease);
  }
  return ks[ks.length - 1][1];
}
var AUTHORED = 11;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
}
function hx(c) {
  var h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(c0, c1, t) {
  var a = hx(c0), b = hx(c1);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
}

// ---- geometry -------------------------------------------------------------
var TAU = Math.PI * 2;
var CR = 92, CL = 200;        // workpiece radius / half-length
var KB = 112;                 // knurled band half-length (ends stay smooth)
var WR = 58, WT = 17;         // knurl wheel radius / half-thickness
var RR = 26, RZ = 62;         // support roller radius / offset from centre
var RY = 18;
var CY0 = CR;                                            // resting on the belt
var CY1 = RY + Math.sqrt((CR + RR) * (CR + RR) - RZ * RZ); // seated in the rollers
var BELT_V = 250, BELT = [-2600, 2600];
// a convex cylinder with its axis along x shows this half of its surface
var A0 = -Math.PI * 0.75, A1 = Math.PI * 0.25;
var NA = 26, NX = 7;          // knurl lattice divisions

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
function Box(props) {
  var b = box(props.x0, props.x1, props.y0, props.y1, props.z0, props.z1), f = props.fills;
  return (
    <g>
      <polygon points={b.right} fill={f[2]} />
      <polygon points={b.front} fill={f[1]} />
      <polygon points={b.top} fill={f[0]} />
    </g>
  );
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

// ---- parts ----------------------------------------------------------------
function Floor(props) {
  var K = props.k, lines = [], x, z;
  for (z = -680; z <= 680; z += 150) lines.push(<line key={'z' + z} x1={P(-1500, -240, z)[0]} y1={P(-1500, -240, z)[1]} x2={P(1500, -240, z)[0]} y2={P(1500, -240, z)[1]} />);
  for (x = -1500; x <= 1500; x += 150) lines.push(<line key={'x' + x} x1={P(x, -240, -680)[0]} y1={P(x, -240, -680)[1]} x2={P(x, -240, 680)[0]} y2={P(x, -240, 680)[1]} />);
  return <g stroke={K.grid} strokeWidth="2" fill="none">{lines}</g>;
}

function Belt(props) {
  var K = props.k, F = [K.top, K.front, K.right], sp = props.spacing;
  var x0 = BELT[0], x1 = BELT[1];
  var base = x0 + (((props.phase % sp) + sp) % sp);
  var slats = [], n = Math.ceil((x1 - x0) / sp) + 1;
  for (var i = 0; i < n; i++) {
    var x = base + i * sp;
    if (x > x1 - 8) continue;
    slats.push(<polygon key={i} points={poly([[x, 1, -BELT_V], [x + 8, 1, -BELT_V], [x + 8, 1, BELT_V], [x, 1, BELT_V]])} fill={K.slat} />);
  }
  return (
    <g>
      <Box x0={-1720} x1={-1600} y0={-250} y1={-34} z0={-40} z1={60} fills={F} />
      <Box x0={1600} x1={1720} y0={-250} y1={-34} z0={-40} z1={60} fills={F} />
      <Box x0={x0} x1={x1} y0={-44} y1={0} z0={-BELT_V} z1={BELT_V} fills={[K.beltTop, K.beltEdge, K.beltEdge]} />
      <g clipPath="url(#clipBelt)">{slats}</g>
      <Box x0={x0} x1={x1} y0={0} y1={16} z0={-BELT_V - 16} z1={-BELT_V} fills={F} />
    </g>
  );
}

function StationFrame(props) {
  var K = props.k, F = [K.top, K.front, K.right];
  return (
    <g>
      <Box x0={-420} x1={-350} y0={-240} y1={620} z0={270} z1={380} fills={F} />
      <Box x0={350} x1={420} y0={-240} y1={620} z0={270} z1={380} fills={F} />
      <Box x0={-480} x1={480} y0={620} y1={716} z0={240} z1={410} fills={F} />
      <polygon points={poly([[-230, 654, 240], [230, 654, 240], [230, 680, 240], [-230, 680, 240]])} fill={props.accent} opacity="0.9" />
    </g>
  );
}

// two driven rollers that seat and spin the workpiece at the station
function Rollers(props) {
  var K = props.k, spin = props.spin, out = [];
  [-RZ, RZ].forEach(function (z, idx) {
    var strips = [], i, RL = 138;
    for (i = 0; i < 8; i++) {
      var p0 = A0 + (A1 - A0) * (i / 8), p1 = A0 + (A1 - A0) * ((i + 1) / 8);
      var mid = (p0 + p1) / 2, lum = 0.5 + 0.5 * Math.cos(mid + 0.55);
      strips.push(<polygon key={i} points={poly([[-RL, RY + RR * Math.cos(p0), z + RR * Math.sin(p0)], [RL, RY + RR * Math.cos(p0), z + RR * Math.sin(p0)],
        [RL, RY + RR * Math.cos(p1), z + RR * Math.sin(p1)], [-RL, RY + RR * Math.cos(p1), z + RR * Math.sin(p1)]])} fill={mix(K.right, K.dieTop, lum)} />);
    }
    var ticks = [];
    for (i = 0; i < 8; i++) {
      var aa = wrapPi(spin + i * TAU / 8);
      if (aa < A0 + 0.06 || aa > A1 - 0.06) continue;
      ticks.push(<path key={i} d={line([[-RL, RY + RR * Math.cos(aa), z + RR * Math.sin(aa)], [RL, RY + RR * Math.cos(aa), z + RR * Math.sin(aa)]])}
        stroke={K.beltEdge} strokeWidth="2.4" fill="none" opacity="0.55" />);
    }
    out.push(
      <g key={idx}>
        <g>{strips}</g>
        {ticks}
        <polygon points={poly(capRing(RL, RY, RR).map(function (p) { return [p[0], p[1], p[2] + z]; }))} fill={K.right} />
      </g>
    );
    out.push(<Box key={'b' + idx} x0={-186} x1={-RL} y0={RY - 42} y1={RY + 34} z0={z - 30} z1={z + 30} fills={[K.dieTop, K.front, K.right]} />);
    out.push(<Box key={'c' + idx} x0={RL} x1={186} y0={RY - 42} y1={RY + 34} z0={z - 30} z1={z + 30} fills={[K.dieTop, K.front, K.right]} />);
  });
  return <g>{out}</g>;
}

// the workpiece: a smooth cylinder whose middle band takes the diamond knurl as
// it rolls under the wheel. Every lattice cell is displaced material, not a cut.
function Workpiece(props) {
  var K = props.k, a = props.accent, cy = props.cy, rot = props.rot, formed = props.formed;
  var strips = [], i, j;
  var N = 13;
  for (i = 0; i < N; i++) {
    var p0 = A0 + (A1 - A0) * (i / N), p1 = A0 + (A1 - A0) * ((i + 1) / N);
    var mid = (p0 + p1) / 2, lum = Math.pow(Math.max(0, Math.cos(mid + 0.55)), 0.9);
    strips.push(<polygon key={i} points={poly([surf(-CL, p0, cy, CR), surf(CL, p0, cy, CR), surf(CL, p1, cy, CR), surf(-CL, p1, cy, CR)])}
      fill={mix(K.metalLo, K.metalHi, 0.12 + 0.88 * lum)} />);
  }

  // diamond lattice in material coordinates; a cell is formed once it has
  // passed under the contact point at the top of the cylinder
  var cells = [], dth = (TAU / NA) * 0.44, dx = (2 * KB / NX) * 0.46;
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
      cells.push(<polygon key={j + '_' + i} points={poly(pts)}
        fill={fresh ? a : mix(K.knurlLo, K.knurlHi, 0.2 + 0.8 * lum2)} opacity={fresh ? 0.95 : 0.9} />);
      cells.push(<path key={'s' + j + '_' + i} d={line([pts[1], pts[2], pts[3]])} stroke={K.knurlLo} strokeWidth="1.6" fill="none" opacity="0.55" />);
    }
  }

  return (
    <g>
      <g>{strips}</g>
      <g>{cells}</g>
      {formed > 0.03 ? (
        <g fill="none" stroke={K.knurlLo} strokeWidth="2.2" opacity="0.5">
          <path d={line(arcAt(-KB, A0 + 0.1, A1 - 0.1, cy, CR + 2.4, 16))} />
          <path d={line(arcAt(KB, A0 + 0.1, A1 - 0.1, cy, CR + 2.4, 16))} />
        </g>
      ) : null}
      <polygon points={poly(capRing(CL, cy, CR))} fill={K.cap} />
      <polygon points={poly(capRing(CL, cy, CR * 0.42))} fill={K.capIn} opacity="0.85" />
    </g>
  );
}

// the forming tool: a hardened wheel with patterned teeth on a pressure arm
function Wheel(props) {
  var K = props.k, cy = props.cy, spin = props.spin, a = props.accent, i;
  var strips = [], N = 9;
  for (i = 0; i < N; i++) {
    var p0 = A0 + (A1 - A0) * (i / N), p1 = A0 + (A1 - A0) * ((i + 1) / N);
    var mid = (p0 + p1) / 2, lum = Math.max(0, Math.cos(mid + 0.55));
    strips.push(<polygon key={i} points={poly([surf(-WT, p0, cy, WR), surf(WT, p0, cy, WR), surf(WT, p1, cy, WR), surf(-WT, p1, cy, WR)])}
      fill={mix(K.wheelLo, K.wheelHi, 0.15 + 0.85 * lum)} />);
  }
  var teeth = [];
  for (i = 0; i < 24; i++) {
    var ang = wrapPi(spin + i * TAU / 24);
    if (ang < A0 + 0.05 || ang > A1 - 0.05) continue;
    teeth.push(<path key={i} d={line([surf(-WT, ang, cy, WR + 2.4), surf(WT, ang + 0.26, cy, WR + 2.4)])} stroke={K.tooth} strokeWidth="3" fill="none" opacity="0.7" />);
    teeth.push(<path key={'b' + i} d={line([surf(-WT, ang + 0.26, cy, WR + 2.4), surf(WT, ang, cy, WR + 2.4)])} stroke={K.wheelLo} strokeWidth="2.4" fill="none" opacity="0.45" />);
  }
  return (
    <g>
      <g>{strips}</g>
      {teeth}
      <polygon points={poly(capRing(WT, cy, WR))} fill={K.cap} />
      <polygon points={poly(capRing(WT, cy, 15))} fill={K.capIn} />
      <Box x0={-34} x1={34} y0={cy - 26} y1={cy + 250} z0={130} z1={196} fills={[K.top, K.front, K.right]} />
      <Box x0={-120} x1={120} y0={cy + 250} y1={cy + 318} z0={110} z1={216} fills={[K.top, K.front, K.right]} />
      <polygon points={poly([[-120, cy + 278, 110], [120, cy + 278, 110], [120, cy + 300, 110], [-120, cy + 300, 110]])} fill={a} opacity="0.9" />
      <Box x0={-46} x1={46} y0={cy + 318} y1={624} z0={140} z1={186} fills={[K.top, K.front, K.right]} />
    </g>
  );
}

function Indicators(props) {
  if (props.o <= 0.003) return null;
  var a = props.accent, marks = [];
  [-1, 1].forEach(function (s, i) {
    marks.push(<path key={i} d={line([[s * KB, props.cy + CR + 44, -70], [s * KB, props.cy + CR + 14, -70]])} />);
  });
  return (
    <g opacity={props.o} stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
      {marks}
      <path d={line([[-KB, props.cy + CR + 44, -70], [KB, props.cy + CR + 44, -70]])} strokeWidth="4" strokeDasharray="18 12" />
    </g>
  );
}

function Part(props) {
  var C = props.cues, total = props.total, E = window.Easing, wraps = props.wraps;
  var local = props.t - props.phase * total;
  if (local < -1.6 || local > total + 0.05) return null;

  var x = seg(local, -1.5, C.Align, -2500, -60, E.easeOutCubic)
    + seg(local, C.Align + 0.12, C.Engage, 0, 60, E.easeInOutCubic)
    + seg(local, C.Exit + 0.1, total - 0.1, 0, 2400, E.easeInOutQuad);
  var cy = track(local, [[0, CY0], [C.Align + 0.1, CY0], [C.Align + 0.5, CY1], [C.Retract + 0.55, CY1], [C.Exit, CY0]], E.easeInOutCubic);
  var rot = track(local, [
    [C.Engage + 0.15, 0], [C.Knurl, 0.1 * TAU], [C.Retract - 0.1, wraps * TAU], [C.Retract + 0.35, (wraps + 0.05) * TAU]
  ], E.easeInOutCubic);
  var vis = (1 - seg(local, total - 0.45, total, 0, 1)) * seg(local, -1.55, -1.4, 0, 1);

  return (
    <g opacity={vis} transform={tv(x, 0, 0)}>
      <Workpiece k={props.k} accent={props.accent} cy={cy} rot={rot} formed={Math.min(TAU, rot)} />
      {props.contact > 0.01 ? (
        <path d={line([[-KB, cy + CR + 3, 0], [KB, cy + CR + 3, 0]])} stroke={props.accent} strokeWidth="5" fill="none" opacity={props.contact * 0.85} />
      ) : null}
    </g>
  );
}

function Scene(props) {
  var c = window.useComposition();
  var E = window.Easing;
  var Rt = (c.authoredTotal || AUTHORED) / AUTHORED;
  var T = c.T / Rt, C = scaleCues(c.CUES, Rt), total = AUTHORED;
  var K = theme(props.dark);
  var a = props.accent || '#ec3013';
  var wraps = props.wraps || 1.15;

  function railX(t) {
    return seg(t, -1.5, C.Align, -2500, -60, E.easeOutCubic)
      + seg(t, C.Align + 0.12, C.Engage, 0, 60, E.easeInOutCubic)
      + seg(t, C.Exit + 0.1, total - 0.1, 0, 2400, E.easeInOutQuad);
  }
  var partX = railX(T), sp = (railX(total) - railX(0)) / 34;

  // seat in the rollers, spin, form, retract
  var cy = track(T, [[0, CY0], [C.Align + 0.1, CY0], [C.Align + 0.5, CY1], [C.Retract + 0.55, CY1], [C.Exit, CY0]], E.easeInOutCubic);
  var rot = track(T, [
    [C.Engage + 0.15, 0], [C.Knurl, 0.1 * TAU], [C.Retract - 0.1, wraps * TAU], [C.Retract + 0.35, (wraps + 0.05) * TAU]
  ], E.easeInOutCubic);
  var formed = Math.min(TAU, rot);
  // the wheel rolls on the workpiece, so its surface speed matches
  var wheelSpin = -rot * (CR / WR);
  var press = track(T, [
    [C.Engage, 34], [C.Knurl, -5], [C.Retract, -5], [C.Retract + 0.7, 40], [C.Exit + 0.2, 150]
  ], E.easeInOutCubic);
  var wheelCy = cy + CR + WR + press;

  var zoom = track(T, [[0, 0.78], [C.Align + 0.1, 0.78], [C.Knurl + 0.3, 0.94], [C.Retract, 0.94], [C.Exit + 0.4, 0.78], [total, 0.78]], E.easeInOutCubic);
  var focusY = track(T, [[0, 170], [C.Align + 0.1, 170], [C.Knurl + 0.3, 150], [C.Retract, 150], [C.Exit + 0.4, 170], [total, 170]], E.easeInOutCubic);
  var hum = 0.9 * Math.sin(T * 40) * seg(T, C.Knurl - 0.2, C.Knurl + 0.2, 0, 1) * (1 - seg(T, C.Retract - 0.2, C.Retract + 0.1, 0, 1));

  var fp = P(0, focusY, 0), ax = 950, ay = 610 + hum;
  function scr(x, y, z) { var q = P(x, y, z); return [ax + (q[0] - fp[0]) * zoom, ay + (q[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind = seg(T, C.Align + 0.15, C.Align + 0.45, 0, 1) * (1 - seg(T, C.Knurl - 0.1, C.Knurl + 0.2, 0, 1));
  var contact = seg(T, C.Knurl - 0.1, C.Knurl + 0.15, 0, 1) * (1 - seg(T, C.Retract - 0.15, C.Retract + 0.1, 0, 1));

  var show = props.labels ? 1 : 0;
  var stl = [230, 140];
  var act = 0.45 + 0.55 * seg(T, C.Align - 0.3, C.Align, 0, 1) * (1 - seg(T, C.Exit + 0.3, C.Exit + 0.7, 0, 1));
  var lblIn = scr(partX - CL - 20, cy + CR * 0.4, -CR - 20);
  var oIn = show * seg(T, 0.7, 1.05, 0, 1) * (1 - seg(T, C.Align - 0.3, C.Align - 0.02, 0, 1));
  var lblOut = scr(partX - KB, cy + CR + 18, -40);
  var oOut = show * seg(T, C.Retract + 0.55, C.Retract + 0.9, 0, 1) * (1 - seg(T, C.Exit + 0.6, C.Exit + 0.95, 0, 1));

  return (
    <div style={{ position: 'absolute', inset: 0, background: K.bg }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ display: 'block' }}>
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
          <radialGradient id="vig" cx="0.5" cy="0.46" r="0.74">
            <stop offset="0.55" stopColor={K.bg} stopOpacity="0" />
            <stop offset="1" stopColor={props.dark ? '#000000' : '#201e1d'} stopOpacity={props.dark ? 0.55 : 0.13} />
          </radialGradient>
          <clipPath id="clipBelt"><polygon points={poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]])} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            <ellipse cx={P(0, -248, 40)[0]} cy={P(0, -248, 40)[1]} rx="340" ry="58" opacity="0.8" />
            <ellipse cx={P(-385, -248, 325)[0]} cy={P(-385, -248, 325)[1]} rx="120" ry="40" />
            <ellipse cx={P(385, -248, 325)[0]} cy={P(385, -248, 325)[1]} rx="120" ry="40" />
            <ellipse cx={P(-1660, -248, 10)[0]} cy={P(-1660, -248, 10)[1]} rx="130" ry="42" />
            <ellipse cx={P(1660, -248, 10)[0]} cy={P(1660, -248, 10)[1]} rx="130" ry="42" />
          </g>
          <StationFrame k={K} accent={a} />
          <Belt k={K} phase={partX} spacing={sp} />
          <Rollers k={K} spin={-rot * (CR / RR)} />
          <Part k={K} accent={a} t={T} cues={C} total={total} phase={0} wraps={wraps} contact={contact} />
          <Part k={K} accent={a} t={T} cues={C} total={total} phase={1} wraps={wraps} contact={0} />
          <Indicators o={ind} cy={cy} accent={a} />
          <Wheel k={K} cy={wheelCy} spin={wheelSpin} accent={a} />
        </g>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointerEvents="none" />
        <g fontFamily="Archivo, system-ui, sans-serif" fontSize="30" fontWeight="600" letterSpacing="3.4">
          <g opacity={act}>
            <line x1={stl[0]} y1={stl[1]} x2={stl[0] + 300} y2={stl[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={stl[0]} y={stl[1] - 16} fill={K.ink}>KNURLING</text>
            <text x={stl[0]} y={stl[1] + 38} fill={K.ink} fontSize="21" fontWeight="500" letterSpacing="2.6" opacity="0.72">COLD FORMING</text>
          </g>
          <g opacity={oIn}>
            <line x1={lblIn[0]} y1={lblIn[1]} x2={lblIn[0]} y2={lblIn[1] + 88} stroke={K.ink} strokeWidth="2.5" />
            <line x1={lblIn[0] - 72} y1={lblIn[1] + 88} x2={lblIn[0]} y2={lblIn[1] + 88} stroke={K.ink} strokeWidth="2.5" />
            <text x={lblIn[0] - 84} y={lblIn[1] + 97} fill={K.ink} textAnchor="end">SMOOTH CYLINDER</text>
          </g>
          <g opacity={oOut}>
            <line x1={lblOut[0]} y1={lblOut[1]} x2={lblOut[0]} y2={lblOut[1] - 104} stroke={a} strokeWidth="2.5" />
            <line x1={lblOut[0] - 72} y1={lblOut[1] - 104} x2={lblOut[0]} y2={lblOut[1] - 104} stroke={a} strokeWidth="2.5" />
            <text x={lblOut[0] - 84} y={lblOut[1] - 113} fill={a} textAnchor="end">DIAMOND KNURL · FORMED</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function KnurlingStation() {
  var tw = window.useTweaks(window.TWEAK_DEFAULTS || {});
  var t = tw[0], setTweak = tw[1];
  var CompositionStage = window.CompositionStage;
  var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection;
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor, TweakSlider = window.TweakSlider;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Scene dark={t.dark} labels={t.labels} accent={t.accent} wraps={t.wraps} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Knurl" />
        <TweakSlider label="Wraps per pass" value={t.wraps} min={1} max={2.4} step={0.05} onChange={function (v) { setTweak('wraps', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.KnurlingStation = KnurlingStation;
