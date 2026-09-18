
// Notching stroke only. The flat sheet is already clamped on the die when the
// loop opens; one open notch is cut out of its near edge, the slug drops into
// the tray, the tool retracts and the finished notch is held. Nothing else.

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
var AUTHORED = 6.55;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
}

// ---- geometry -------------------------------------------------------------
var TH = 10;                 // sheet thickness
var SU = 300, SV = 190;      // half-length / half-width of the flat sheet
var NC = 60;                 // notch centred on this point of the near edge


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
  for (z = -720; z <= 720; z += 160) lines.push(<line key={'z' + z} x1={P(-1400, -240, z)[0]} y1={P(-1400, -240, z)[1]} x2={P(1400, -240, z)[0]} y2={P(1400, -240, z)[1]} />);
  for (x = -1400; x <= 1400; x += 160) lines.push(<line key={'x' + x} x1={P(x, -240, -720)[0]} y1={P(x, -240, -720)[1]} x2={P(x, -240, 720)[0]} y2={P(x, -240, 720)[1]} />);
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

// bolster + pedestal the die sits on
function Bolster(props) {
  var K = props.k, F = [K.top, K.front, K.right];
  return (
    <g>
      <Box x0={-300} x1={300} y0={-240} y1={-56} z0={-110} z1={220} fills={[K.beltEdge, K.front, K.right]} />
      <Box x0={-380} x1={380} y0={-92} y1={-56} z0={-190} z1={260} fills={F} />
    </g>
  );
}

// hold-downs that keep the sheet flat and still through the stroke
function Clamps(props) {
  var K = props.k, y = props.y, F = [K.top, K.front, K.right];
  return (
    <g>
      {[-236, 196].map(function (x, i) {
        return (
          <g key={i}>
            <Box x0={x - 46} x1={x + 46} y0={y} y1={y + 26} z0={40} z1={150} fills={[K.dieTop, K.front, K.right]} />
            <Box x0={x - 30} x1={x + 30} y0={y + 26} y1={y + 250} z0={62} z1={128} fills={F} />
            <polygon points={poly([[x - 30, y + 196, 62], [x + 30, y + 196, 62], [x + 30, y + 216, 62], [x - 30, y + 216, 62]])} fill={props.accent} opacity="0.85" />
          </g>
        );
      })}
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
      <Box x0={NC - 92} x1={NC + 92} y0={-186} y1={-56} z0={-262} z1={-130} fills={[K.cavity, K.beltEdge, K.beltEdge]} />
      <Box x0={NC - 138} x1={NC + 138} y0={-240} y1={-186} z0={-320} z1={-108} fills={[K.cavity, K.front, K.right]} />
      <Box x0={NC - 138} x1={NC + 138} y0={-186} y1={-168} z0={-320} z1={-300} fills={[K.dieTop, K.front, K.right]} />
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
  var K = props.k, C = props.cues, a = props.accent, E = window.Easing;
  var w = props.w, d = props.d, T = props.t;

  var cut = C.Stroke + 1.15;
  var isCut = T >= cut;
  var y = 10 - seg(T, cut, cut + 0.1, 0, 5, E.easeOutQuad) + seg(T, C.Retract + 0.1, C.Retract + 0.45, 0, 5, E.easeOutCubic);

  // the finished part hands over to the next flat sheet while the tool is up
  var swap = seg(T, C.Reset + 0.02, C.Reset + 0.3, 0, 1, E.easeInOutCubic);
  var oNotched = (isCut ? 1 : 0) * (1 - swap);
  var oFlat = isCut ? swap : 1;

  var edge = seg(T, cut, cut + 0.07, 0, 1) * (1 - seg(T, cut + 0.35, cut + 1.5, 0, 1, E.easeOutQuad));
  var callout = seg(T, C.Retract + 0.35, C.Retract + 0.7, 0, 1) * (1 - seg(T, C.Reset - 0.15, C.Reset + 0.05, 0, 1));
  var notched = sheetPath(w, d);

  var slugY = seg(T, cut + 0.1, C.Drop + 0.7, 0, 262, E.easeInQuad);
  var slugX = seg(T, cut + 0.1, C.Drop + 0.7, 0, 46, E.easeInQuad);
  var slugZ = -seg(T, cut + 0.1, C.Drop + 0.7, 0, 252, E.easeInQuad);
  var slugO = (isCut ? 1 : 0) * (1 - seg(T, C.Drop + 0.35, C.Drop + 0.75, 0, 1));

  return (
    <g>
      <g transform={tv(16, 0.8, -18)} opacity="0.4">
        <path d={oNotched > 0.5 ? notched : FLAT} fill={K.shadow} />
      </g>
      <g transform={tv(0, y, 0)}>
        <g opacity={oFlat}>
          <path d={FLAT} transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
          <path d={FLAT} fill={K.sheet} />
        </g>
        <g opacity={oNotched}>
          <path d={notched} transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
          <path d={notched} fill={K.sheet} />
        </g>
        <path d={oNotched > 0.5 ? notched : FLAT} fill="none" stroke={a} strokeWidth="5" opacity={edge} />
        {isCut ? (
          <g stroke={a} strokeWidth="4.5" fill="none" opacity={callout * 0.9}>
            <polyline points={poly([[notchU(w)[0], 0, -SV], [notchU(w)[0], 0, -SV + d], [notchU(w)[1], 0, -SV + d], [notchU(w)[1], 0, -SV]])} />
          </g>
        ) : null}
      </g>
      {slugO > 0.01 ? (
        <g transform={tv(slugX, y - 2 - slugY, slugZ)} opacity={slugO}>
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

  var cut = C.Stroke + 1.15;
  // short controlled stroke, dwell at the bottom while the slug clears, retract
  var blade = track(T, [
    [C.Stroke + 0.08, 330], [cut, -8], [C.Retract + 0.05, -8], [C.Reveal + 0.05, 330]
  ], E.easeInOutCubic);
  // hold-downs settle onto the sheet just before the stroke and stay down
  var clampY = track(T, [[0, 30], [C.Stroke + 0.05, 30], [C.Stroke + 0.35, 20], [C.Reveal + 0.35, 20], [C.Reset + 0.02, 30]], E.easeInOutCubic);

  // the camera barely moves: a subtle push-in across the stroke only
  var zoom = track(T, [[0, 0.74], [C.Stroke + 0.1, 0.74], [cut, 0.84], [C.Reveal + 0.5, 0.84], [C.Reset + 0.02, 0.74], [total, 0.74]], E.easeInOutCubic);
  var focus = track(T, [[0, 10], [C.Stroke + 0.1, 10], [cut, 55], [C.Reveal + 0.5, 55], [C.Reset + 0.02, 10], [total, 10]], E.easeInOutCubic);
  var focusZ = track(T, [[0, -20], [C.Stroke + 0.1, -20], [cut, -75], [C.Reveal + 0.5, -75], [C.Reset + 0.02, -20], [total, -20]], E.easeInOutCubic);
  var st = Math.abs(T - cut);
  var shake = 3.4 * Math.exp(-st * 13) * Math.sin(st * 76) * (T >= cut ? 1 : 0);

  var fp = P(focus, 170, focusZ), ax = 950, ay = 620 + shake;
  function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind = seg(T, 0.3, 0.6, 0, 1) * (1 - seg(T, C.Stroke + 0.1, C.Stroke + 0.4, 0, 1));
  var ring = { r: seg(T, cut, cut + 0.45, 60, 240, E.easeOutQuart), o: (1 - seg(T, cut, cut + 0.45, 0, 1, E.easeOutQuad)) * (T >= cut ? 0.5 : 0) };

  var show = props.labels ? 1 : 0;
  var stl = [230, 140];   // station caption is frame chrome, not a 3D annotation
  var act = 0.5 + 0.5 * seg(T, C.Stroke - 0.35, C.Stroke, 0, 1) * (1 - seg(T, C.Reset - 0.2, C.Reset + 0.05, 0, 1));
  var lbl = scr(NC, 26, -SV - 40);
  var oLbl = show * seg(T, C.Retract + 0.4, C.Retract + 0.75, 0, 1) * (1 - seg(T, C.Reset - 0.2, C.Reset + 0.04, 0, 1));
  var lblIn = scr(-40, 26, SV + 40);
  var oIn = show * seg(T, 0.25, 0.6, 0, 1) * (1 - seg(T, C.Stroke - 0.3, C.Stroke, 0, 1));

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
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            {[[-395, 275], [395, 275]].map(function (g, i) {
              var p = P(g[0], -238, g[1]);
              return <ellipse key={i} cx={p[0]} cy={p[1]} rx="130" ry="42" />;
            })}
            <ellipse cx={P(0, -238, 30)[0]} cy={P(0, -238, 30)[1]} rx="400" ry="64" opacity="0.75" />
          </g>
          <PressFrame k={K} accent={a} />
          <Bolster k={K} />
          <Die k={K} w={w} d={d} />
          <Indicators o={ind} x={0} w={w} d={d} accent={a} />
          <ScrapChute k={K} />
          <Sheet k={K} t={T} cues={C} accent={a} w={w} d={d} />
          <Clamps k={K} y={clampY} accent={a} />
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
            <text x={lblIn[0] - 78} y={lblIn[1] - 95} fill={K.ink} textAnchor="end">FLAT SHEET · CLAMPED</text>
          </g>
          <g opacity={oLbl}>
            <line x1={lbl[0]} y1={lbl[1]} x2={lbl[0]} y2={lbl[1] + 88} stroke={a} strokeWidth="2.5" />
            <line x1={lbl[0] - 78} y1={lbl[1] + 88} x2={lbl[0]} y2={lbl[1] + 88} stroke={a} strokeWidth="2.5" />
            <text x={lbl[0] - 90} y={lbl[1] + 97} fill={a} textAnchor="end">EDGE NOTCH</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function NotchingStroke() {
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

window.NotchingStroke = NotchingStroke;
