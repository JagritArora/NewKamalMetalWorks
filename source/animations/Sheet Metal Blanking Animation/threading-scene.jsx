
// Internal thread tapping cell. A thick sheet-metal component with an existing
// hole rides in on the conveyor from the left and stops under the head; the tap
// rotates down into the hole, forms the internal thread progressively, then
// reverses out and the threaded part conveys away. Nothing else is shown — no
// drilling, punching or cutting anywhere in the loop.

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
var AUTHORED = 11.3;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
}

// ---- geometry -------------------------------------------------------------
var SU = 300, SV = 200;     // half-length / half-width of the component
var TH = 74;                // section thickness — enough for real engagement
var R = 110;                // radius of the existing hole
var PITCH = 11;             // thread pitch
var TR = 64;                // tap radius (drawn under size so the forming
                            // thread stays visible inside the bore)
var TAU = Math.PI * 2;
var BELT_V = 250;
var BELT = [-2600, 2600];
var YB = -TH;               // belt surface: the component rides on it

// arc of a circle in the component plane, at a given height
function arc(r, a0, a1, y, n) {
  var out = [];
  for (var i = 0; i <= n; i++) {
    var a = a0 + (a1 - a0) * (i / n);
    out.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  return out;
}
function ring(r, y) { return arc(r, 0, TAU, y, 48); }

// Visible faces in this projection are +y, -z and +x, so the inner wall of a
// bore reads back-left: normals point inward, visible where sin > cos.
var BORE_A0 = Math.PI * 0.25, BORE_A1 = Math.PI * 1.25;

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
    beltEdge: '#1d1f22', dieTop: '#3f4347', cavity: '#0d0e10', shadow: 'rgba(0,0,0,0.55)',
    beltTop: '#2a2c2f', slat: '#3a3d41',
    part: 'url(#gPartD)', partEdge: '#585d61', partSide: '#44484c',
    bore: 'url(#gBoreD)', boreDeep: '#0c0d0e', thread: '#c4cace', threadLo: '#24272a',
    tap: 'url(#gTapD)', tapEdge: '#8d9398', tapHi: '#cfd4d8'
  } : {
    bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
    top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
    beltEdge: '#43464a', dieTop: '#9b9ea2', cavity: '#5c6064', shadow: 'rgba(32,30,29,0.22)',
    beltTop: '#5f6266', slat: '#74787c',
    part: 'url(#gPart)', partEdge: '#9ea3a8', partSide: '#aeb2b6',
    bore: 'url(#gBore)', boreDeep: '#3d4145', thread: '#ffffff', threadLo: '#75797e',
    tap: 'url(#gTap)', tapEdge: '#8f9499', tapHi: '#ffffff'
  };
}

// ---- parts ----------------------------------------------------------------
function Floor(props) {
  var K = props.k, lines = [], x, z;
  for (z = -640; z <= 640; z += 140) lines.push(<line key={'z' + z} x1={P(-1200, -240, z)[0]} y1={P(-1200, -240, z)[1]} x2={P(1200, -240, z)[0]} y2={P(1200, -240, z)[1]} />);
  for (x = -1200; x <= 1200; x += 140) lines.push(<line key={'x' + x} x1={P(x, -240, -640)[0]} y1={P(x, -240, -640)[1]} x2={P(x, -240, 640)[0]} y2={P(x, -240, 640)[1]} />);
  return <g stroke={K.grid} strokeWidth="2" fill="none">{lines}</g>;
}

function MachineFrame(props) {
  var K = props.k, F = [K.top, K.front, K.right];
  return (
    <g>
      <Box x0={-420} x1={-350} y0={-240} y1={640} z0={250} z1={360} fills={F} />
      <Box x0={350} x1={420} y0={-240} y1={640} z0={250} z1={360} fills={F} />
      <Box x0={-480} x1={480} y0={640} y1={740} z0={220} z1={390} fills={F} />
      <polygon points={poly([[-230, 676, 220], [230, 676, 220], [230, 702, 220], [-230, 702, 220]])} fill={props.accent} opacity="0.9" />
    </g>
  );
}

// the conveyor the component rides in and out on
function Belt(props) {
  var K = props.k, F = [K.top, K.front, K.right], sp = props.spacing;
  var x0 = BELT[0], x1 = BELT[1];
  var base = x0 + (((props.phase % sp) + sp) % sp);
  var slats = [], n = Math.ceil((x1 - x0) / sp) + 1;
  for (var i = 0; i < n; i++) {
    var x = base + i * sp;
    if (x > x1 - 8) continue;
    slats.push(<polygon key={i} points={poly([[x, YB + 1, -BELT_V], [x + 8, YB + 1, -BELT_V], [x + 8, YB + 1, BELT_V], [x, YB + 1, BELT_V]])} fill={K.slat} />);
  }
  return (
    <g>
      <Box x0={-1720} x1={-1600} y0={-250} y1={YB - 34} z0={-40} z1={60} fills={F} />
      <Box x0={1600} x1={1720} y0={-250} y1={YB - 34} z0={-40} z1={60} fills={F} />
      <Box x0={x0} x1={x1} y0={YB - 44} y1={YB} z0={-BELT_V} z1={BELT_V} fills={[K.beltTop, K.beltEdge, K.beltEdge]} />
      <g clipPath="url(#clipBelt)">{slats}</g>
      <Box x0={x0} x1={x1} y0={YB} y1={YB + 16} z0={-BELT_V - 16} z1={-BELT_V} fills={F} />
    </g>
  );
}

function Clamps(props) {
  var K = props.k, y = props.y, F = [K.top, K.front, K.right];
  return (
    <g>
      {[-232, 232].map(function (x, i) {
        return (
          <g key={i}>
            <Box x0={x - 44} x1={x + 44} y0={y} y1={y + 24} z0={-56} z1={64} fills={[K.dieTop, K.front, K.right]} />
            <Box x0={x - 28} x1={x + 28} y0={y + 24} y1={y + 250} z0={-34} z1={40} fills={F} />
            <polygon points={poly([[x - 28, y + 198, -34], [x + 28, y + 198, -34], [x + 28, y + 218, -34], [x - 28, y + 218, -34]])} fill={props.accent} opacity="0.85" />
          </g>
        );
      })}
    </g>
  );
}

// the component: thick section, existing hole, and the internal thread that
// develops on the visible inner wall as the tap goes down
// travel of one component through the cell, from feed-in to exit
function railX(local, C, total, E) {
  return seg(local, -1.4, C.Align, -2450, -55, E.easeOutCubic)
    + seg(local, C.Align + 0.15, C.Tap - 0.2, 0, 55, E.easeInOutCubic)
    + seg(local, C.Exit + 0.1, total - 0.1, 0, 2350, E.easeInOutQuad);
}

function Component(props) {
  var K = props.k, a = props.accent, C = props.cues, total = props.total, E = window.Easing;
  var local = props.t - props.phase * total;
  if (local < -1.5 || local > total + 0.05) return null;
  var x = railX(local, C, total, E);
  var p = seg(local, C.Tap + 0.12, C.Dwell, 0, 1, E.easeInOutCubic);
  var o = 1;
  var vis = (1 - seg(local, total - 0.45, total, 0, 1)) * seg(local, -1.45, -1.3, 0, 1);
  var topFace = pathOf([[-SU, 0, -SV], [SU, 0, -SV], [SU, 0, SV], [-SU, 0, SV]]) + pathOf(ring(R, 0).slice().reverse());
  var wall = arc(R, BORE_A0, BORE_A1, 0, 40).concat(arc(R, BORE_A1, BORE_A0, -TH, 40));
  var depth = p * TH;

  var turns = [], front = null;
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
      turns.push(<path key={'t' + i} d={line(lo)} stroke={K.threadLo} strokeWidth="4" fill="none" />);
      turns.push(<path key={'h' + i} d={line(pts)} stroke={K.thread} strokeWidth="3.4" fill="none" opacity="0.92" />);
      if (-pts[pts.length - 1][1] > depth - PITCH * 0.6 && p > 0.02 && p < 0.999) {
        front = <path d={line(pts.slice(Math.max(0, pts.length - 9)))} stroke={a} strokeWidth="5" fill="none" />;
      }
    }
  }

  return (
    <g opacity={vis} transform={tv(x, 0, 0)}>
      <path d={pathOf(ring(R, 0))} fill={K.boreDeep} />
      <polygon points={poly(wall)} fill={K.bore} />
      <g opacity={o}>{turns}{front}</g>
      <polygon points={poly([[-SU, 0, -SV], [SU, 0, -SV], [SU, -TH, -SV], [-SU, -TH, -SV]])} fill={K.partSide} />
      <polygon points={poly([[SU, 0, -SV], [SU, 0, SV], [SU, -TH, SV], [SU, -TH, -SV]])} fill={K.partEdge} />
      <path d={topFace} fillRule="evenodd" fill={K.part} />
      <path d={pathOf(ring(R, 0))} fill="none" stroke={K.partEdge} strokeWidth="3" opacity="0.8" />
    </g>
  );
}

// the tap: a rotating cylinder with flutes and its own thread form, on a
// spindle. Only the front half of the body is visible, so the bore wall behind
// it stays readable.
function Tap(props) {
  var K = props.k, y = props.y, spin = props.spin, a = props.accent;
  var L = 300, top = y + L, lead = y + 34;
  var f0 = Math.PI * 1.25, f1 = Math.PI * 2.25;   // visible front half
  var side = arc(TR, f0, f1, top, 30).concat(arc(TR, f1, f0, lead, 30));
  var cone = arc(TR, f0, f1, lead, 24).concat([[0, y - 6, 0]]);

  var flutes = [], i;
  for (i = 0; i < 3; i++) {
    var ang = spin * TAU + i * TAU / 3;
    var w = ((ang % TAU) + TAU) % TAU;
    if (w < f0 - Math.PI * 2 || w > f1) { if (!(w >= f0 && w <= f1) && !(w + TAU >= f0 && w + TAU <= f1)) continue; }
    var cx = TR * Math.cos(w), cz = TR * Math.sin(w);
    flutes.push(<path key={i} d={line([[cx, lead, cz], [cx, top - 40, cz]])} stroke={K.tapEdge} strokeWidth="3" fill="none" opacity="0.7" />);
  }

  var th = [];
  for (i = 0; i < 9; i++) {
    var y0 = lead + i * PITCH;
    if (y0 > lead + 150) break;
    var pts = [];
    for (var j = 0; j <= 24; j++) {
      var u = j / 24, aa = f0 + (f1 - f0) * u + spin * TAU;
      pts.push([TR * Math.cos(aa), y0 + PITCH * u * 0.5, TR * Math.sin(aa)]);
    }
    th.push(<path key={'s' + i} d={line(pts)} stroke={K.tapHi} strokeWidth="2.6" fill="none" opacity="0.5" />);
  }

  return (
    <g>
      <polygon points={poly(cone)} fill={K.tapEdge} />
      <polygon points={poly(side)} fill={K.tap} />
      <g clipPath="url(#clipTapBody)">{th}</g>
      {flutes}
      <path d={pathOf(ring(TR, top))} fill={K.tapHi} opacity="0.35" />
      <Box x0={-86} x1={86} y0={top} y1={top + 92} z0={-86} z1={86} fills={[K.top, K.front, K.right]} />
      <polygon points={poly([[-86, top + 34, -86], [86, top + 34, -86], [86, top + 56, -86], [-86, top + 56, -86]])} fill={a} opacity="0.9" />
      <Box x0={-46} x1={46} y0={top + 92} y1={644} z0={-46} z1={46} fills={[K.top, K.front, K.right]} />
    </g>
  );
}

// rotation cue: a short arc with a head, flipping direction on withdrawal
function SpinCue(props) {
  if (props.o <= 0.004) return null;
  var y = props.y, dir = props.dir, r = TR + 74, a = props.accent;
  var a0 = -0.15, a1 = 2.5;
  var pts = arc(r, a0, a1, y, 24);
  var tipA = dir > 0 ? a1 : a0, s = dir > 0 ? 1 : -1;
  var tx = r * Math.cos(tipA), tz = r * Math.sin(tipA);
  var hx = -Math.sin(tipA) * s, hz = Math.cos(tipA) * s;
  return (
    <g opacity={props.o} stroke={a} fill="none" strokeWidth="5" strokeLinecap="round">
      <path d={line(pts)} />
      <path d={line([[tx + (hx * 26 - Math.cos(tipA) * 18), y, tz + (hz * 26 - Math.sin(tipA) * 18)], [tx, y, tz],
        [tx + (hx * 26 + Math.cos(tipA) * 18), y, tz + (hz * 26 + Math.sin(tipA) * 18)]])} />
    </g>
  );
}

function Indicators(props) {
  if (props.o <= 0.003) return null;
  var a = props.accent, marks = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s, i) {
    marks.push(<polyline key={i} points={poly([[s[0] * SU - s[0] * 88, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV - s[1] * 88]])} />);
  });
  return (
    <g opacity={props.o} transform={tv(props.x, 14, 0)} stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
      {marks}
      <path d={pathOf(ring(R + 22, 0))} strokeWidth="4" strokeDasharray="18 12" />
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
  var turns = props.turns || 7;

  // a small tilt toward top-down for the final reveal, so the finished thread
  // inside the bore is unmistakable
  var tilt = seg(T, C.Reveal + 0.1, C.Reveal + 0.8, 0, 1, E.easeInOutCubic) * (1 - seg(T, total - 0.45, total - 0.05, 0, 1, E.easeInOutCubic));
  EZ[1] = -0.34 - 0.13 * tilt;

  var tapY = track(T, [
    [0, 230], [C.Align + 0.1, 230], [C.Align + 0.6, 26], [C.Tap + 0.1, 26],
    [C.Dwell, -TH + 4], [C.Withdraw, -TH + 4], [C.Reveal, 230]
  ], E.easeInOutCubic);
  // rotation is tied to the feed: one turn per thread pitch, reversed on the
  // way out
  var spin = turns * seg(T, C.Tap + 0.1, C.Dwell, 0, 1, E.easeInOutCubic)
    + 0.5 * seg(T, C.Align + 0.1, C.Tap + 0.1, 0, 1, E.easeInOutCubic)
    - (turns + 0.5) * seg(T, C.Withdraw, C.Reveal, 0, 1, E.easeInOutCubic);
  function bp(t) { return railX(t, C, total, E); }
  var partX = bp(T), sp = (bp(total) - bp(0)) / 34;
  var clampY = track(T, [[0, 40], [C.Align + 0.1, 40], [C.Align + 0.45, 0], [C.Reveal + 0.4, 0], [C.Exit - 0.1, 40]], E.easeInOutCubic);

  var zoom = track(T, [[0, 0.86], [C.Align + 0.1, 0.86], [C.Tap + 0.5, 1.04], [C.Withdraw, 1.04], [C.Reveal + 0.7, 1.0], [C.Exit + 0.5, 0.86], [total, 0.86]], E.easeInOutCubic);
  var focusY = track(T, [[0, 160], [C.Align + 0.1, 160], [C.Tap + 0.5, 130], [C.Reveal + 0.7, 104], [C.Exit + 0.5, 160], [total, 160]], E.easeInOutCubic);
  var hum = 1.1 * Math.sin(T * 44) * seg(T, C.Tap, C.Tap + 0.3, 0, 1) * (1 - seg(T, C.Dwell, C.Dwell + 0.25, 0, 1));

  var fp = P(0, focusY, 0), ax = 950, ay = 600 + hum;
  function scr(x, y, z) { var q = P(x, y, z); return [ax + (q[0] - fp[0]) * zoom, ay + (q[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind = seg(T, C.Align + 0.12, C.Align + 0.42, 0, 1) * (1 - seg(T, C.Tap + 0.1, C.Tap + 0.4, 0, 1));
  var cueO = seg(T, C.Align + 0.2, C.Align + 0.5, 0, 1) * (1 - seg(T, C.Reveal - 0.35, C.Reveal - 0.05, 0, 1));
  var cueDir = T < C.Withdraw ? 1 : -1;

  var show = props.labels ? 1 : 0;
  var stl = [230, 140];
  var act = 0.45 + 0.55 * seg(T, C.Align - 0.3, C.Align, 0, 1) * (1 - seg(T, C.Exit + 0.3, C.Exit + 0.7, 0, 1));
  var lblHole = scr(partX - R - 40, 16, -R - 30);
  var oHole = show * seg(T, 0.8, 1.15, 0, 1) * (1 - seg(T, C.Align - 0.3, C.Align - 0.02, 0, 1));
  var lblDone = scr(partX - R - 30, 16, -R - 20);
  var oDone = show * seg(T, C.Reveal + 0.4, C.Reveal + 0.75, 0, 1) * (1 - seg(T, C.Exit + 0.5, C.Exit + 0.85, 0, 1));

  return (
    <div style={{ position: 'absolute', inset: 0, background: K.bg }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="gPart" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#fbfbfc" /><stop offset="0.3" stopColor="#dcdee1" />
            <stop offset="0.56" stopColor="#f0f1f2" /><stop offset="1" stopColor="#cbced1" />
          </linearGradient>
          <linearGradient id="gPartD" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#8d9297" /><stop offset="0.3" stopColor="#5c6064" />
            <stop offset="0.56" stopColor="#7c8186" /><stop offset="1" stopColor="#4a4e52" />
          </linearGradient>
          <linearGradient id="gBore" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor="#adb1b5" /><stop offset="1" stopColor="#6b6f73" />
          </linearGradient>
          <linearGradient id="gBoreD" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor="#585d61" /><stop offset="1" stopColor="#2b2e31" />
          </linearGradient>
          <linearGradient id="gTap" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" stopColor="#7e8388" /><stop offset="0.42" stopColor="#d3d7da" />
            <stop offset="0.72" stopColor="#9aa0a5" /><stop offset="1" stopColor="#6e7377" />
          </linearGradient>
          <linearGradient id="gTapD" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" stopColor="#4c5155" /><stop offset="0.42" stopColor="#9aa0a5" />
            <stop offset="0.72" stopColor="#6b7074" /><stop offset="1" stopColor="#404448" />
          </linearGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
          <radialGradient id="vig" cx="0.5" cy="0.46" r="0.74">
            <stop offset="0.55" stopColor={K.bg} stopOpacity="0" />
            <stop offset="1" stopColor={props.dark ? '#000000' : '#201e1d'} stopOpacity={props.dark ? 0.55 : 0.13} />
          </radialGradient>
          <clipPath id="clipBelt"><polygon points={poly([[BELT[0], YB, -BELT_V], [BELT[1], YB, -BELT_V], [BELT[1], YB, BELT_V], [BELT[0], YB, BELT_V]])} /></clipPath>
          <clipPath id="clipTapBody"><polygon points={poly(arc(TR, Math.PI * 1.25, Math.PI * 2.25, tapY + 300, 30).concat(arc(TR, Math.PI * 2.25, Math.PI * 1.25, tapY + 34, 30)))} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            <ellipse cx={P(0, -258, 40)[0]} cy={P(0, -258, 40)[1]} rx="330" ry="58" opacity="0.8" />
            <ellipse cx={P(-385, -258, 305)[0]} cy={P(-385, -258, 305)[1]} rx="120" ry="40" />
            <ellipse cx={P(385, -258, 305)[0]} cy={P(385, -258, 305)[1]} rx="120" ry="40" />
            <ellipse cx={P(-1660, -258, 10)[0]} cy={P(-1660, -258, 10)[1]} rx="130" ry="42" />
            <ellipse cx={P(1660, -258, 10)[0]} cy={P(1660, -258, 10)[1]} rx="130" ry="42" />
          </g>
          <MachineFrame k={K} accent={a} />
          <Belt k={K} phase={partX} spacing={sp} />
          <Indicators o={ind} x={partX} accent={a} />
          <Component k={K} accent={a} t={T} cues={C} total={total} phase={0} />
          <Component k={K} accent={a} t={T} cues={C} total={total} phase={1} />
          <Clamps k={K} y={clampY} accent={a} />
          <Tap k={K} y={tapY} spin={spin} accent={a} />
          <SpinCue o={cueO} y={tapY + 318} dir={cueDir} accent={a} />
        </g>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointerEvents="none" />
        <g fontFamily="Archivo, system-ui, sans-serif" fontSize="30" fontWeight="600" letterSpacing="3.4">
          <g opacity={act}>
            <line x1={stl[0]} y1={stl[1]} x2={stl[0] + 300} y2={stl[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={stl[0]} y={stl[1] - 16} fill={K.ink}>THREADING</text>
            <text x={stl[0]} y={stl[1] + 38} fill={K.ink} fontSize="21" fontWeight="500" letterSpacing="2.6" opacity="0.72">INTERNAL THREAD FORMING</text>
          </g>
          <g opacity={oHole}>
            <line x1={lblHole[0]} y1={lblHole[1]} x2={lblHole[0]} y2={lblHole[1] + 92} stroke={K.ink} strokeWidth="2.5" />
            <line x1={lblHole[0] - 72} y1={lblHole[1] + 92} x2={lblHole[0]} y2={lblHole[1] + 92} stroke={K.ink} strokeWidth="2.5" />
            <text x={lblHole[0] - 84} y={lblHole[1] + 101} fill={K.ink} textAnchor="end">EXISTING HOLE</text>
          </g>
          <g opacity={oDone}>
            <line x1={lblDone[0]} y1={lblDone[1]} x2={lblDone[0]} y2={lblDone[1] + 116} stroke={a} strokeWidth="2.5" />
            <line x1={lblDone[0] - 72} y1={lblDone[1] + 116} x2={lblDone[0]} y2={lblDone[1] + 116} stroke={a} strokeWidth="2.5" />
            <text x={lblDone[0] - 84} y={lblDone[1] + 125} fill={a} textAnchor="end">INTERNAL THREAD · FORMED</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function ThreadingStroke() {
  var tw = window.useTweaks(window.TWEAK_DEFAULTS || {});
  var t = tw[0], setTweak = tw[1];
  var CompositionStage = window.CompositionStage;
  var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection;
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor, TweakSlider = window.TweakSlider;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Scene dark={t.dark} labels={t.labels} accent={t.accent} turns={t.turns} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Tapping" />
        <TweakSlider label="Turns per stroke" value={t.turns} min={4} max={12} step={1} onChange={function (v) { setTweak('turns', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.ThreadingStroke = ThreadingStroke;
