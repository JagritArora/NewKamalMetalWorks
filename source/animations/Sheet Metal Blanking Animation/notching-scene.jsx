
// Single-operation notching press. A finished flat rectangular sheet arrives,
// one open notch is cut out of its near edge, the slug drops into the tray and
// the notched sheet leaves. No other operation is shown.

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
function track(t, ks, ease) {
  if (t <= ks[0][0]) return ks[0][1];
  for (var i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) return seg(t, ks[i - 1][0], ks[i][0], ks[i - 1][1], ks[i][1], ease);
  }
  return ks[ks.length - 1][1];
}
var AUTHORED = 10;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
}

// ---- geometry -------------------------------------------------------------
var TH = 10;                 // sheet thickness
var SU = 300, SV = 190;      // half-length / half-width of the flat sheet
var NC = 90;                 // notch centred on this point of the near edge
var BELT_V = 240;
var BELT = [-2600, 2600];
var PARK = -NC;              // sheet x when the notch sits under the blade

// the open notch is cut out of the near (+z) edge — never a hole in the field
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
    sheet: 'url(#gSheetD)', sheetEdge: '#6f7479', cavity: '#101113', shadow: 'rgba(0,0,0,0.55)'
  } : {
    bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
    top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
    beltTop: '#5f6266', beltEdge: '#43464a', slat: '#74787c', dieTop: '#9b9ea2',
    sheet: 'url(#gSheet)', sheetEdge: '#9ea3a8', cavity: '#6e7276', shadow: 'rgba(32,30,29,0.22)'
  };
}

// ---- parts ----------------------------------------------------------------
function Floor(props) {
  var K = props.k, lines = [], x, z;
  for (z = -700; z <= 900; z += 180) lines.push(<line key={'z' + z} x1={P(-2900, -240, z)[0]} y1={P(-2900, -240, z)[1]} x2={P(2900, -240, z)[0]} y2={P(2900, -240, z)[1]} />);
  for (x = -2900; x <= 2900; x += 180) lines.push(<line key={'x' + x} x1={P(x, -240, -700)[0]} y1={P(x, -240, -700)[1]} x2={P(x, -240, 900)[0]} y2={P(x, -240, 900)[1]} />);
  return <g stroke={K.grid} strokeWidth="2" fill="none">{lines}</g>;
}

function PressFrame(props) {
  var K = props.k, F = [K.top, K.front, K.right];
  return (
    <g>
      <Box x0={-430} x1={-360} y0={-230} y1={620} z0={220} z1={330} fills={F} />
      <Box x0={360} x1={430} y0={-230} y1={620} z0={220} z1={330} fills={F} />
      <Box x0={-490} x1={490} y0={620} y1={720} z0={190} z1={360} fills={F} />
      <polygon points={poly([[-240, 656, 190], [240, 656, 190], [240, 682, 190], [-240, 682, 190]])} fill={props.accent} opacity="0.9" />
    </g>
  );
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
      <Box x0={-1760} x1={-1640} y0={-240} y1={-30} z0={-40} z1={60} fills={F} />
      <Box x0={1640} x1={1760} y0={-240} y1={-30} z0={-40} z1={60} fills={F} />
      <Box x0={x0} x1={x1} y0={-40} y1={0} z0={-BELT_V} z1={BELT_V} fills={[K.beltTop, K.beltEdge, K.beltEdge]} />
      <g clipPath="url(#clipBelt)">{slats}</g>
      <Box x0={x0} x1={x1} y0={0} y1={16} z0={-BELT_V - 16} z1={-BELT_V} fills={F} />
    </g>
  );
}

// lower die: a support table with an opening only under the notch footprint
function Die(props) {
  var K = props.k, w = props.w, d = props.d;
  var b = box(-330, 330, -56, 0, -168, 240);
  return (
    <g>
      <polygon points={b.right} fill={K.right} />
      <polygon points={b.front} fill={K.right} />
      <path d={slugPath(w, d)} transform="translate(0,40)" fill={K.cavity} />
      <path d={slugPath(w, d)} fill={K.cavity} opacity="0.92" />
      <polygon points={b.top} fill={K.dieTop} clipPath="url(#clipDie)" />
    </g>
  );
}

// small scrap chute + tray directly beneath the die opening
function ScrapChute(props) {
  var K = props.k;
  return (
    <g>
      <polygon points={poly([[NC - 118, -52, -96], [NC + 118, -52, -96], [NC + 176, -176, -448], [NC - 176, -176, -448]])} fill={K.right} opacity="0.92" />
      <Box x0={NC - 190} x1={NC + 190} y0={-240} y1={-168} z0={-544} z1={-372} fills={[K.beltEdge, K.right, K.front]} />
      <Box x0={NC - 190} x1={NC + 190} y0={-168} y1={-146} z0={-392} z1={-372} fills={[K.dieTop, K.right, K.front]} />
    </g>
  );
}

// upper notching blade: the punch face is exactly the notch footprint
function Blade(props) {
  var K = props.k, y = props.y, w = props.w, d = props.d, n = notchU(w);
  var cu = (n[0] + n[1]) / 2;
  return (
    <g>
      <g transform={tv(0, y + 54, 0)}>
        <path d={slugPath(w, d)} transform="translate(0,54)" fill={K.right} />
        <path d={slugPath(w, d)} fill={K.front} />
      </g>
      <Box x0={cu - 102} x1={cu + 102} y0={y + 54} y1={y + 100} z0={-SV - 34} z1={-SV + d + 26} fills={[K.top, K.front, K.right]} />
      <Box x0={-180} x1={180} y0={y + 100} y1={y + 148} z0={-SV - 14} z1={92} fills={[K.top, K.front, K.right]} />
      <Box x0={-158} x1={158} y0={y + 148} y1={y + 264} z0={-SV + 6} z1={72} fills={[K.top, K.front, K.right]} />
      <polygon points={poly([[-84, y + 224, -SV + 6], [84, y + 224, -SV + 6], [84, y + 248, -SV + 6], [-84, y + 248, -SV + 6]])} fill={props.accent} opacity="0.9" />
      <Box x0={-350} x1={-210} y0={y + 160} y1={y + 232} z0={230} z1={300} fills={[K.front, K.right, K.right]} />
      <Box x0={210} x1={350} y0={y + 160} y1={y + 232} z0={230} z1={300} fills={[K.front, K.right, K.right]} />
    </g>
  );
}

// datum marks on the sheet plus the notch footprint dashed on the edge
function Indicators(props) {
  if (props.o <= 0.003) return null;
  var a = props.accent, w = props.w, d = props.d, n = notchU(w), marks = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s, i) {
    marks.push(<polyline key={i} points={poly([[s[0] * SU - s[0] * 90, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV - s[1] * 90]])} />);
  });
  return (
    <g opacity={props.o} transform={tv(props.x, 20, 0)} stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
      {marks}
      <g strokeWidth="4.5" strokeDasharray="18 11">
        <polyline points={poly([[n[0], 0, -SV], [n[0], 0, -SV + d], [n[1], 0, -SV + d], [n[1], 0, -SV]])} />
      </g>
    </g>
  );
}

function Sheet(props) {
  var K = props.k, C = props.cues, total = props.total, a = props.accent, E = window.Easing;
  var w = props.w, d = props.d;
  var local = props.t - props.phase * total;
  if (local < -1.5 || local > total + 0.05) return null;

  var cut = C.Notch + 0.9;
  var isCut = local >= cut;
  var x = seg(local, -1.4, C.Align, -2450, PARK - 55, E.easeOutCubic)
    + seg(local, C.Align + 0.15, C.Notch - 0.2, 0, 55, E.easeInOutCubic)
    + seg(local, C.Exit + 0.1, total - 0.1, 0, 2350, E.easeInOutQuad);
  var y = 10 - seg(local, cut, cut + 0.1, 0, 5, E.easeOutQuad) + seg(local, C.Retract + 0.1, C.Retract + 0.45, 0, 5, E.easeOutCubic);
  var o = (1 - seg(local, total - 0.45, total, 0, 1)) * seg(local, -1.45, -1.3, 0, 1);

  var edge = seg(local, cut, cut + 0.07, 0, 1) * (1 - seg(local, cut + 0.35, cut + 1.4, 0, 1, E.easeOutQuad));
  var callout = seg(local, C.Retract + 0.3, C.Retract + 0.6, 0, 1) * (1 - seg(local, C.Exit + 0.5, C.Exit + 0.85, 0, 1));
  var dPath = isCut ? sheetPath(w, d) : FLAT;

  var slugY = seg(local, cut + 0.1, C.Drop + 0.75, 0, 262, E.easeInQuad);
  var slugX = seg(local, cut + 0.1, C.Drop + 0.75, 0, 46, E.easeInQuad);
  var slugZ = -seg(local, cut + 0.1, C.Drop + 0.75, 0, 252, E.easeInQuad);
  var slugO = (isCut ? 1 : 0) * (1 - seg(local, C.Drop + 0.4, C.Drop + 0.8, 0, 1));

  return (
    <g opacity={o}>
      <g transform={tv(x + 16, 0.8, -18)} opacity="0.4">
        <path d={dPath} fill={K.shadow} />
      </g>
      <g transform={tv(x, y, 0)}>
        <path d={dPath} transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
        <path d={dPath} fill={K.sheet} />
        <path d={dPath} fill="none" stroke={a} strokeWidth="5" opacity={edge} />
        {isCut ? (
          <g stroke={a} strokeWidth="4.5" fill="none" opacity={callout * 0.9}>
            <polyline points={poly([[notchU(w)[0], 0, -SV], [notchU(w)[0], 0, -SV + d], [notchU(w)[1], 0, -SV + d], [notchU(w)[1], 0, -SV]])} />
          </g>
        ) : null}
      </g>
      {slugO > 0.01 ? (
        <g transform={tv(x + slugX, y - 2 - slugY, slugZ)} opacity={slugO}>
          <path d={slugPath(w, d)} transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
          <path d={slugPath(w, d)} fill={K.sheet} />
        </g>
      ) : null}
    </g>
  );
}

function Scene(props) {
  var c = window.useComposition();
  var E = window.Easing;
  var R = (c.authoredTotal || AUTHORED) / AUTHORED;
  var T = c.T / R, C = scaleCues(c.CUES, R), total = AUTHORED;
  var K = theme(props.dark);
  var a = props.accent || '#ec3013';
  var w = props.notchWidth || 150, d = props.notchDepth || 105;

  var cut = C.Notch + 0.9;
  var blade = track(T, [
    [C.Notch + 0.05, 360], [cut, -8], [C.Retract + 0.05, -8], [C.Exit + 0.05, 360]
  ], E.easeInOutCubic);

  function bp(t) {
    return seg(t, -1.4, C.Align, -2450, PARK - 55, E.easeOutCubic)
      + seg(t, C.Align + 0.15, C.Notch - 0.2, 0, 55, E.easeInOutCubic)
      + seg(t, C.Exit + 0.1, total - 0.1, 0, 2350, E.easeInOutQuad);
  }
  var sp = (bp(total) - bp(0)) / 34;

  // one close three-quarter view throughout; only a small push-in on the stroke
  var zoom = track(T, [[0, 0.82], [C.Align, 0.82], [C.Notch + 0.35, 0.96], [C.Retract + 0.4, 0.96], [C.Exit + 0.5, 0.82], [total, 0.82]], E.easeInOutCubic);
  var focus = track(T, [[0, -20], [C.Align, -20], [C.Notch + 0.35, 70], [C.Retract + 0.4, 70], [C.Exit + 0.5, -20], [total, -20]], E.easeInOutCubic);
  var focusZ = track(T, [[0, 10], [C.Align, 10], [C.Notch + 0.35, -70], [C.Retract + 0.4, -70], [C.Exit + 0.5, 10], [total, 10]], E.easeInOutCubic);
  var st = Math.abs(T - cut);
  var shake = 3.4 * Math.exp(-st * 13) * Math.sin(st * 76) * (T >= cut ? 1 : 0);

  var fp = P(focus, 0, focusZ), ax = 950, ay = 660 + shake;
  function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind = seg(T, C.Align + 0.15, C.Align + 0.45, 0, 1) * (1 - seg(T, C.Notch + 0.1, C.Notch + 0.4, 0, 1));
  var sheetX = bp(T);
  var ring = { r: seg(T, cut, cut + 0.45, 60, 240, E.easeOutQuart), o: (1 - seg(T, cut, cut + 0.45, 0, 1, E.easeOutQuad)) * (T >= cut ? 0.5 : 0) };

  var show = props.labels ? 1 : 0;
  var stl = [230, 140];   // station caption is frame chrome, not a 3D annotation
  var act = 0.45 + 0.55 * seg(T, C.Align - 0.3, C.Align, 0, 1) * (1 - seg(T, C.Exit + 0.3, C.Exit + 0.7, 0, 1));
  var lbl = scr(sheetX + NC, 26, -SV - 40);
  var oLbl = show * seg(T, C.Retract + 0.35, C.Retract + 0.7, 0, 1) * (1 - seg(T, C.Exit + 0.5, C.Exit + 0.85, 0, 1));
  var lblIn = scr(sheetX - 40, 26, SV + 40);
  var oIn = show * seg(T, 0.5, 0.85, 0, 1) * (1 - seg(T, C.Align - 0.35, C.Align - 0.05, 0, 1));

  return (
    <div style={{ position: 'absolute', inset: 0, background: K.bg }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="gSheet" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#fbfbfc" /><stop offset="0.26" stopColor="#dcdee1" />
            <stop offset="0.5" stopColor="#f2f3f4" /><stop offset="0.74" stopColor="#c9cccf" />
            <stop offset="1" stopColor="#e6e7e9" />
          </linearGradient>
          <linearGradient id="gSheetD" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#8f9498" /><stop offset="0.28" stopColor="#5c6064" />
            <stop offset="0.52" stopColor="#7e8388" /><stop offset="0.78" stopColor="#4a4e52" />
            <stop offset="1" stopColor="#6b7074" />
          </linearGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>
          <radialGradient id="vig" cx="0.5" cy="0.46" r="0.74">
            <stop offset="0.55" stopColor={K.bg} stopOpacity="0" />
            <stop offset="1" stopColor={props.dark ? '#000000' : '#201e1d'} stopOpacity={props.dark ? 0.55 : 0.13} />
          </radialGradient>
          <clipPath id="clipDie" clipRule="evenodd">
            <path d={pathOf([[-330, 0, -168], [330, 0, -168], [330, 0, 240], [-330, 0, 240]]) + pathOf(slugList(w, d).slice().reverse())} clipRule="evenodd" />
          </clipPath>
          <clipPath id="clipBelt"><polygon points={poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]])} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            {[[-1700, 10], [1700, 10], [-395, 270], [395, 270]].map(function (g, i) {
              var p = P(g[0], -238, g[1]);
              return <ellipse key={i} cx={p[0]} cy={p[1]} rx="130" ry="42" />;
            })}
            <ellipse cx={P(0, -238, 40)[0]} cy={P(0, -238, 40)[1]} rx="400" ry="62" opacity="0.7" />
          </g>
          <PressFrame k={K} accent={a} />
          <Belt k={K} phase={bp(T)} spacing={sp} />
          <Die k={K} w={w} d={d} />
          <Indicators o={ind} x={sheetX} w={w} d={d} accent={a} />
          <ScrapChute k={K} />
          <Sheet k={K} t={T} cues={C} total={total} phase={0} accent={a} w={w} d={d} />
          <Sheet k={K} t={T} cues={C} total={total} phase={1} accent={a} w={w} d={d} />
          {ring.o > 0.01 ? (
            <g transform={tv(NC, 14, -SV + d / 2)} opacity={ring.o}>
              <ellipse cx="0" cy="0" rx={ring.r} ry={ring.r * 0.34} fill="none" stroke={a} strokeWidth="5" />
            </g>
          ) : null}
          <Blade k={K} y={blade} w={w} d={d} accent={a} />
        </g>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointerEvents="none" />
        <g fontFamily="Archivo, system-ui, sans-serif" fontSize="30" fontWeight="600" letterSpacing="3.4">
          <g opacity={act}>
            <line x1={stl[0]} y1={stl[1]} x2={stl[0] + 300} y2={stl[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={stl[0]} y={stl[1] - 16} fill={K.ink}>NOTCHING</text>
          </g>
          <g opacity={oIn}>
            <line x1={lblIn[0]} y1={lblIn[1]} x2={lblIn[0]} y2={lblIn[1] - 104} stroke={K.ink} strokeWidth="2.5" />
            <line x1={lblIn[0] - 66} y1={lblIn[1] - 104} x2={lblIn[0]} y2={lblIn[1] - 104} stroke={K.ink} strokeWidth="2.5" />
            <text x={lblIn[0] - 78} y={lblIn[1] - 95} fill={K.ink} textAnchor="end">FLAT SHEET</text>
          </g>
          <g opacity={oLbl}>
            <line x1={lbl[0]} y1={lbl[1]} x2={lbl[0]} y2={lbl[1] + 112} stroke={a} strokeWidth="2.5" />
            <line x1={lbl[0]} y1={lbl[1] + 112} x2={lbl[0] + 66} y2={lbl[1] + 112} stroke={a} strokeWidth="2.5" />
            <text x={lbl[0] + 78} y={lbl[1] + 121} fill={a}>EDGE NOTCH</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function NotchingPress() {
  var tw = window.useTweaks(window.TWEAK_DEFAULTS || {});
  var t = tw[0], setTweak = tw[1];
  var CompositionStage = window.CompositionStage;
  var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection;
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor, TweakSlider = window.TweakSlider;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Scene dark={t.dark} labels={t.labels} accent={t.accent} notchWidth={t.notchWidth} notchDepth={t.notchDepth} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Notch" />
        <TweakSlider label="Width" value={t.notchWidth} min={80} max={230} step={5} onChange={function (v) { setTweak('notchWidth', v); }} />
        <TweakSlider label="Depth" value={t.notchDepth} min={55} max={160} step={5} onChange={function (v) { setTweak('notchDepth', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.NotchingPress = NotchingPress;
