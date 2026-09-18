
// Embossing cell. A flat sheet rides in on the conveyor from the left and stops
// under the press; a female pressure ring comes down, the male pad below drives
// a raised bevelled boss out of the sheet surface, the tooling retracts and the
// embossed sheet conveys out to the right. One continuous piece — nothing is
// cut and no material is removed.

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
var AUTHORED = 10.3;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
}

// ---- geometry -------------------------------------------------------------
var TH = 10;                 // sheet thickness
var BELT_V = 240;
var BELT = [-2600, 2600];
var SU = 300, SV = 190;      // half-length / half-width of the flat sheet
var BU = 168, BV = 108;      // boss footprint (base of the bevel)
var BEV = 30;                // bevel run, so the top face is inset by this
var FLAT = pathOf([[-SU, 0, -SV], [SU, 0, -SV], [SU, 0, SV], [-SU, 0, SV]]);
var BOSS_BASE = poly([[-BU, 0, -BV], [BU, 0, -BV], [BU, 0, BV], [-BU, 0, BV]]);

// the raised bevelled boss, generated live from the formed height
function bossFaces(h, k, dark) {
  if (h < 0.5) return null;
  var iu = BU - BEV, iv = BV - BEV;
  var f = h / 34;
  return (
    <g>
      <polygon points={poly([[-BU, 0.7, -BV - 26], [BU, 0.7, -BV - 26], [BU + 22, 0.7, BV], [-BU + 22, 0.7, BV]])}
        fill={dark ? '#000000' : '#201e1d'} opacity={0.13 * f} />
      <polygon points={poly([[-iu, h, -iv], [-iu, h, iv], [-BU, 0, BV], [-BU, 0, -BV]])} fill={k.bossL} />
      <polygon points={poly([[iu, h, -iv], [iu, h, iv], [BU, 0, BV], [BU, 0, -BV]])} fill={k.bossR} />
      <polygon points={poly([[-iu, h, -iv], [iu, h, -iv], [BU, 0, -BV], [-BU, 0, -BV]])} fill={k.bossF} />
      <polygon points={poly([[-iu, h, -iv], [iu, h, -iv], [iu, h, iv], [-iu, h, iv]])} fill={k.bossT} />
      <polyline points={poly([[-iu, h, iv], [-iu, h, -iv], [iu, h, -iv]])} fill="none" stroke={k.bossHi} strokeWidth="3" opacity="0.85" />
    </g>
  );
}

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
    beltEdge: '#1d1f22', dieTop: '#3f4347', beltTop: '#2a2c2f', slat: '#3a3d41',
    sheet: 'url(#gSheetD)', sheetEdge: '#6f7479', cavity: '#101113', shadow: 'rgba(0,0,0,0.55)',
    bossT: '#9aa0a5', bossF: '#6e7377', bossL: '#5a5f63', bossR: '#474b4f', bossHi: '#c6cbcf'
  } : {
    bg: '#f3f2f2', ink: '#201e1d', grid: 'rgba(32,30,29,0.07)',
    top: '#d7d8da', front: '#b3b5b8', right: '#95989c',
    beltEdge: '#43464a', dieTop: '#9b9ea2', beltTop: '#5f6266', slat: '#74787c',
    sheet: 'url(#gSheet)', sheetEdge: '#9ea3a8', cavity: '#6e7276', shadow: 'rgba(32,30,29,0.22)',
    bossT: '#fbfbfc', bossF: '#d8dadd', bossL: '#c2c5c9', bossR: '#a9adb1', bossHi: '#ffffff'
  };
}

// ---- parts ----------------------------------------------------------------
function Floor(props) {
  var K = props.k, lines = [], x, z;
  for (z = -720; z <= 720; z += 160) lines.push(<line key={'z' + z} x1={P(-1400, -240, z)[0]} y1={P(-1400, -240, z)[1]} x2={P(1400, -240, z)[0]} y2={P(1400, -240, z)[1]} />);
  for (x = -1400; x <= 1400; x += 160) lines.push(<line key={'x' + x} x1={P(x, -240, -720)[0]} y1={P(x, -240, -720)[1]} x2={P(x, -240, 720)[0]} y2={P(x, -240, 720)[1]} />);
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
      <Box x0={-1760} x1={-1640} y0={-240} y1={-30} z0={-40} z1={60} fills={F} />
      <Box x0={1640} x1={1760} y0={-240} y1={-30} z0={-40} z1={60} fills={F} />
      <Box x0={x0} x1={x1} y0={-40} y1={0} z0={-BELT_V} z1={BELT_V} fills={[K.beltTop, K.beltEdge, K.beltEdge]} />
      <g clipPath="url(#clipBelt)">{slats}</g>
      <Box x0={x0} x1={x1} y0={0} y1={16} z0={-BELT_V - 16} z1={-BELT_V} fills={F} />
    </g>
  );
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

function Bolster(props) {
  var K = props.k;
  return (
    <g>
      <Box x0={-300} x1={300} y0={-240} y1={-56} z0={-110} z1={220} fills={[K.beltEdge, K.front, K.right]} />
      <Box x0={-380} x1={380} y0={-92} y1={-56} z0={-190} z1={260} fills={[K.top, K.front, K.right]} />
    </g>
  );
}

// lower die: a solid table carrying the male form pad, bevelled to match the
// pressure ring above it
function Die(props) {
  var K = props.k;
  var b = box(-330, 330, -56, 0, -210, 240);
  return (
    <g>
      <polygon points={b.right} fill={K.right} />
      <polygon points={b.front} fill={K.right} />
      <polygon points={b.top} fill={K.dieTop} />
      <polygon points={BOSS_BASE} fill={K.top} opacity="0.35" />
      <polygon points={BOSS_BASE} fill="none" stroke={K.beltEdge} strokeWidth="3" opacity="0.5" />
    </g>
  );
}

// upper tooling: a female pressure ring open over the form, so the boss is
// visible rising through it all the way through the stroke
function PressRing(props) {
  var K = props.k, y = props.y, F = [K.top, K.front, K.right], H = 40;
  var ou = 322, ov = 238, iu = BU + 78, iv = BV + 62;
  return (
    <g>
      <Box x0={-ou} x1={-iu} y0={y} y1={y + H} z0={-ov} z1={ov} fills={F} />
      <Box x0={iu} x1={ou} y0={y} y1={y + H} z0={-ov} z1={ov} fills={F} />
      <Box x0={-iu} x1={iu} y0={y} y1={y + H} z0={iv} z1={ov} fills={F} />
      <Box x0={-iu} x1={iu} y0={y} y1={y + H} z0={-ov} z1={-iv} fills={F} />
      <polygon points={poly([[-ou, y + 14, -ov], [-iu, y + 14, -ov], [-iu, y + 30, -ov], [-ou, y + 30, -ov]])} fill={props.accent} opacity="0.9" />
      <polygon points={poly([[iu, y + 14, -ov], [ou, y + 14, -ov], [ou, y + 30, -ov], [iu, y + 30, -ov]])} fill={props.accent} opacity="0.9" />
      <Box x0={-300} x1={-224} y0={y + H} y1={624} z0={130} z1={206} fills={F} />
      <Box x0={224} x1={300} y0={y + H} y1={624} z0={130} z1={206} fills={F} />
    </g>
  );
}

// datum marks on the sheet plus the boss footprint dashed on its surface
function Indicators(props) {
  if (props.o <= 0.003) return null;
  var a = props.accent, marks = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s, i) {
    marks.push(<polyline key={i} points={poly([[s[0] * SU - s[0] * 90, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV], [s[0] * SU, 0, s[1] * SV - s[1] * 90]])} />);
  });
  return (
    <g opacity={props.o} transform={tv(props.x, 22, 0)} stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
      {marks}
      <polygon points={BOSS_BASE} strokeWidth="4" strokeDasharray="20 12" />
    </g>
  );
}

// travel of one sheet through the cell, from feed-in to exit
function railX(local, C, total, E) {
  return seg(local, -1.4, C.Align, -2450, -55, E.easeOutCubic)
    + seg(local, C.Align + 0.15, C.Descend - 0.2, 0, 55, E.easeInOutCubic)
    + seg(local, C.Exit + 0.1, total - 0.1, 0, 2350, E.easeInOutQuad);
}

function Sheet(props) {
  var K = props.k, C = props.cues, a = props.accent, E = window.Easing;
  var total = props.total, dark = props.dark, depth = props.depth;
  var local = props.t - props.phase * total;
  if (local < -1.5 || local > total + 0.05) return null;

  var x = railX(local, C, total, E);
  var form = seg(local, C.Form, C.Dwell, 0, 1, E.easeInOutCubic);
  var relax = seg(local, C.Retract + 0.1, C.Retract + 0.45, 0, 1, E.easeOutCubic);
  var h = depth * form * (1 - 0.07 * relax);
  var y = 10 - seg(local, C.Form, C.Form + 0.2, 0, 4, E.easeOutQuad)
    + seg(local, C.Retract + 0.1, C.Retract + 0.5, 0, 4, E.easeOutCubic);
  var o = (1 - seg(local, total - 0.45, total, 0, 1)) * seg(local, -1.45, -1.3, 0, 1);
  var glow = seg(form, 0.2, 0.85, 0, 1) * (1 - seg(local, C.Retract + 1.1, C.Retract + 2.1, 0, 1, E.easeOutQuad));

  return (
    <g opacity={o}>
      <g transform={tv(x + 16, 0.8, -18)} opacity="0.4">
        <path d={FLAT} fill={K.shadow} />
      </g>
      <g transform={tv(x, y, 0)}>
        <path d={FLAT} transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
        <path d={FLAT} fill={K.sheet} />
        {bossFaces(h, K, dark)}
        {h > 0.5 ? <polygon points={BOSS_BASE} fill="none" stroke={a} strokeWidth="5" opacity={glow} /> : null}
      </g>
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
  var depth = props.embossHeight || 34;

  // the ring seats on the sheet at Form, then presses as the boss is driven up
  var ringY = track(T, [
    [C.Descend + 0.06, 300], [C.Form, 20], [C.Dwell, 6],
    [C.Retract, 6], [C.Retract + 0.2, 13], [C.Reveal + 0.06, 300]
  ], E.easeInOutCubic);
  // the surface deforms in lockstep with the stroke, with a touch of springback
  var form = seg(T, C.Form, C.Dwell, 0, 1, E.easeInOutCubic);
  var relax = seg(T, C.Retract + 0.1, C.Retract + 0.45, 0, 1, E.easeOutCubic);
  var h = depth * form * (1 - 0.07 * relax);
  function bp(t) { return railX(t, C, total, E); }
  var sheetX = bp(T), sp = (bp(total) - bp(0)) / 34;

  // the camera barely moves: a small push-in and lift so the new height reads
  var zoom = track(T, [[0, 0.7], [C.Descend + 0.1, 0.7], [C.Dwell, 0.86], [C.Reveal + 0.6, 0.86], [C.Exit + 0.4, 0.7], [total, 0.7]], E.easeInOutCubic);
  var focus = track(T, [[0, 10], [C.Descend + 0.1, 10], [C.Dwell, 24], [C.Reveal + 0.6, 24], [C.Exit + 0.4, 10], [total, 10]], E.easeInOutCubic);
  var focusY = track(T, [[0, 170], [C.Descend + 0.1, 170], [C.Dwell, 120], [C.Reveal + 0.6, 120], [C.Exit + 0.4, 170], [total, 170]], E.easeInOutCubic);
  var focusZ = track(T, [[0, -20], [C.Descend + 0.1, -20], [C.Dwell, -50], [C.Reveal + 0.6, -50], [C.Exit + 0.4, -20], [total, -20]], E.easeInOutCubic);
  var st = Math.abs(T - C.Dwell);
  var shake = 2.4 * Math.exp(-st * 10) * Math.sin(st * 58) * (T >= C.Dwell ? 1 : 0);

  var fp = P(focus, focusY, focusZ), ax = 950, ay = 620 + shake;
  function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind = seg(T, C.Align + 0.15, C.Align + 0.45, 0, 1) * (1 - seg(T, C.Descend + 0.1, C.Descend + 0.4, 0, 1));
  var ring = { r: seg(T, C.Dwell, C.Dwell + 0.5, 80, 280, E.easeOutQuart), o: (1 - seg(T, C.Dwell, C.Dwell + 0.5, 0, 1, E.easeOutQuad)) * (T >= C.Dwell ? 0.4 : 0) };

  var show = props.labels ? 1 : 0;
  var stl = [230, 140];
  var act = 0.45 + 0.55 * seg(T, C.Align - 0.3, C.Align, 0, 1) * (1 - seg(T, C.Exit + 0.3, C.Exit + 0.7, 0, 1));
  var lbl = scr(sheetX - BU, 26 + h, -BV);
  var oLbl = show * seg(T, C.Retract + 0.5, C.Retract + 0.85, 0, 1) * (1 - seg(T, C.Exit + 0.5, C.Exit + 0.85, 0, 1));
  var lblIn = scr(sheetX - 40, 26, SV + 40);
  var oIn = show * seg(T, 0.6, 0.95, 0, 1) * (1 - seg(T, C.Align - 0.35, C.Align - 0.05, 0, 1));

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
          <clipPath id="clipBelt"><polygon points={poly([[BELT[0], 0, -BELT_V], [BELT[1], 0, -BELT_V], [BELT[1], 0, BELT_V], [BELT[0], 0, BELT_V]])} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            {[[-395, 275], [395, 275], [-1700, 10], [1700, 10]].map(function (g, i) {
              var p = P(g[0], -238, g[1]);
              return <ellipse key={i} cx={p[0]} cy={p[1]} rx="130" ry="42" />;
            })}
            <ellipse cx={P(0, -238, 30)[0]} cy={P(0, -238, 30)[1]} rx="400" ry="64" opacity="0.75" />
          </g>
          <PressFrame k={K} accent={a} />
          <Belt k={K} phase={sheetX} spacing={sp} />
          <Bolster k={K} />
          <Die k={K} />
          <Indicators o={ind} x={sheetX} accent={a} />
          <Sheet k={K} t={T} cues={C} total={total} phase={0} depth={depth} dark={props.dark} accent={a} />
          <Sheet k={K} t={T} cues={C} total={total} phase={1} depth={depth} dark={props.dark} accent={a} />
          {ring.o > 0.01 ? (
            <g transform={tv(sheetX, 16 + h, 0)} opacity={ring.o}>
              <ellipse cx="0" cy="0" rx={ring.r} ry={ring.r * 0.34} fill="none" stroke={a} strokeWidth="5" />
            </g>
          ) : null}
          <PressRing k={K} y={ringY} accent={a} />
        </g>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointerEvents="none" />
        <g fontFamily="Archivo, system-ui, sans-serif" fontSize="30" fontWeight="600" letterSpacing="3.4">
          <g opacity={act}>
            <line x1={stl[0]} y1={stl[1]} x2={stl[0] + 300} y2={stl[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={stl[0]} y={stl[1] - 16} fill={K.ink}>EMBOSSING</text>
          </g>
          <g opacity={oIn}>
            <line x1={lblIn[0]} y1={lblIn[1]} x2={lblIn[0]} y2={lblIn[1] - 104} stroke={K.ink} strokeWidth="2.5" />
            <line x1={lblIn[0] - 66} y1={lblIn[1] - 104} x2={lblIn[0]} y2={lblIn[1] - 104} stroke={K.ink} strokeWidth="2.5" />
            <text x={lblIn[0] - 78} y={lblIn[1] - 95} fill={K.ink} textAnchor="end">FLAT SHEET · CLAMPED</text>
          </g>
          <g opacity={oLbl}>
            <line x1={lbl[0]} y1={lbl[1]} x2={lbl[0]} y2={lbl[1] + 96} stroke={a} strokeWidth="2.5" />
            <line x1={lbl[0] - 78} y1={lbl[1] + 96} x2={lbl[0]} y2={lbl[1] + 96} stroke={a} strokeWidth="2.5" />
            <text x={lbl[0] - 90} y={lbl[1] + 105} fill={a} textAnchor="end">RAISED EMBOSS · FORMED</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function EmbossingStroke() {
  var tw = window.useTweaks(window.TWEAK_DEFAULTS || {});
  var t = tw[0], setTweak = tw[1];
  var CompositionStage = window.CompositionStage;
  var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection;
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor, TweakSlider = window.TweakSlider;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Scene dark={t.dark} labels={t.labels} accent={t.accent} embossHeight={t.embossHeight} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Emboss" />
        <TweakSlider label="Boss height" value={t.embossHeight} min={18} max={52} step={2} onChange={function (v) { setTweak('embossHeight', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.EmbossingStroke = EmbossingStroke;
