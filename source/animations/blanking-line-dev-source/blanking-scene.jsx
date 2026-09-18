// Two-station sheet-metal line — blanking (press 01) then punching (press 02).
// World: X along the line (right), Y up, Z depth (back). One axonometric
// projection; shapes are precomputed at the origin and placed by a translate,
// since the projection is linear.

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

// ---- geometry -------------------------------------------------------------
var TH = 10;                       // sheet thickness
var STRIP_U = 400, STRIP_V = 120;  // half-length / half-width of the incoming strip
var BELT_V = 135;
var B1 = [-3200, -330], B2 = [-60, 2900];   // conveyor 1 / conveyor 2 spans
var BRIDGE = [-360, 120];
var S1 = -850, S2 = 900;                    // press 01 / press 02 centres
var ZO = 320;                               // conveyor 2 runs on its own line, further back
var BIN = [-470, -300];

// automotive flat bracket — outer profile only (stage 1 result)
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
// stage 2 features: two bolt holes, one large bore, one oblong slot
var FEATURES = [
  circleUV(-95, -45, 15, 26),
  circleUV(-95, 45, 15, 26),
  circleUV(75, 0, 20, 30),
  slotUV(0, 0, 28, 13, 12)
];
var FEATURE_CENTRES = [[-95, -45], [-95, 45], [75, 0], [0, 0]];

var PROFILE = pathOf(OUTLINE);                                    // blank, no features
var FEATURE_PATHS = FEATURES.map(function (h) { return pathOf(h); }).join('');
var PUNCHED = PROFILE + FEATURE_PATHS;                            // finished component
var STRIP_FULL = pathOf([[-STRIP_U, 0, -STRIP_V], [STRIP_U, 0, -STRIP_V], [STRIP_U, 0, STRIP_V], [-STRIP_U, 0, STRIP_V]]);
var STRIP_CUT = STRIP_FULL + pathOf(OUTLINE.slice().reverse());   // skeleton

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
  for (z = -900; z <= 900; z += 180) lines.push(<line key={'z' + z} x1={P(-3000, -240, z)[0]} y1={P(-3000, -240, z)[1]} x2={P(3000, -240, z)[0]} y2={P(3000, -240, z)[1]} />);
  for (x = -3000; x <= 3000; x += 180) lines.push(<line key={'x' + x} x1={P(x, -240, -900)[0]} y1={P(x, -240, -900)[1]} x2={P(x, -240, 900)[0]} y2={P(x, -240, 900)[1]} />);
  return <g stroke={K.grid} strokeWidth="2" fill="none">{lines}</g>;
}

function PressFrame(props) {
  var K = props.k, F = [K.top, K.front, K.right], x = props.x, z = props.z || 0;
  return (
    <g>
      <Box x0={x - 380} x1={x - 320} y0={-230} y1={600} z0={z + 150} z1={z + 250} fills={F} />
      <Box x0={x + 320} x1={x + 380} y0={-230} y1={600} z0={z + 150} z1={z + 250} fills={F} />
      <Box x0={x - 430} x1={x + 430} y0={600} y1={700} z0={z + 120} z1={z + 280} fills={F} />
      <polygon points={poly([[x - 220, 638, z + 120], [x + 220, 638, z + 120], [x + 220, 662, z + 120], [x - 220, 662, z + 120]])} fill={props.accent} opacity="0.9" />
    </g>
  );
}

function Belt(props) {
  var K = props.k, F = [K.top, K.front, K.right], sp = props.spacing, z = props.z || 0;
  var x0 = props.span[0], x1 = props.span[1];
  var base = x0 + (((props.phase % sp) + sp) % sp);
  var slats = [], n = Math.ceil((x1 - x0) / sp) + 1;
  for (var i = 0; i < n; i++) {
    var x = base + i * sp;
    if (x > x1 - 7) continue;
    slats.push(<polygon key={i} points={poly([[x, 1, z - BELT_V], [x + 7, 1, z - BELT_V], [x + 7, 1, z + BELT_V], [x, 1, z + BELT_V]])} fill={K.slat} />);
  }
  return (
    <g>
      <Box x0={props.legs[0] - 60} x1={props.legs[0] + 60} y0={-240} y1={-30} z0={z - 40} z1={z + 60} fills={F} />
      <Box x0={props.legs[1] - 60} x1={props.legs[1] + 60} y0={-240} y1={-30} z0={z - 40} z1={z + 60} fills={F} />
      <Box x0={x0} x1={x1} y0={-40} y1={0} z0={z - BELT_V} z1={z + BELT_V} fills={[K.beltTop, K.beltEdge, K.beltEdge]} />
      <g clipPath={props.clip}>{slats}</g>
      <Box x0={x0} x1={x1} y0={0} y1={16} z0={z + 145} z1={z + 161} fills={F} />
    </g>
  );
}

function Bridge(props) {
  var K = props.k, rollers = [];
  for (var x = BRIDGE[0] + 40; x < BRIDGE[1] - 20; x += 100) {
    rollers.push(<Box key={x} x0={x} x1={x + 40} y0={-24} y1={-2} z0={-BELT_V - 20} z1={ZO + BELT_V + 20} fills={[K.dieTop, K.right, K.right]} />);
  }
  return (
    <g>
      <Box x0={BRIDGE[0]} x1={BRIDGE[1]} y0={-80} y1={-24} z0={-BELT_V - 20} z1={ZO + BELT_V + 20} fills={[K.front, K.right, K.right]} />
      {rollers}
    </g>
  );
}

function ScrapChute(props) {
  var K = props.k;
  return (
    <g>
      <Box x0={BIN[0]} x1={BIN[1]} y0={-30} y1={4} z0={-360} z1={-100} fills={[K.right, K.right, K.front]} />
      <Box x0={BIN[0] - 40} x1={BIN[1] + 40} y0={-240} y1={-30} z0={-430} z1={-170} fills={[K.beltEdge, K.right, K.front]} />
    </g>
  );
}

function Die(props) {
  var K = props.k, x = props.x, z = props.z || 0;
  var b = box(x - 290, x + 290, -52, 0, z - 150, z + 172);
  return (
    <g>
      <polygon points={b.right} fill={K.right} />
      <polygon points={b.front} fill={K.right} />
      <g transform={tv(x, 0, z)}>
        {props.mode === 'profile'
          ? <path d={PROFILE} transform="translate(0,34)" fill={K.cavity} />
          : <path d={FEATURE_PATHS} fillRule="evenodd" transform="translate(0,30)" fill={K.cavity} />}
        {props.mode === 'profile'
          ? <path d={PROFILE} fill={K.cavity} opacity="0.9" />
          : <path d={FEATURE_PATHS} fillRule="evenodd" fill={K.cavity} opacity="0.9" />}
      </g>
      <polygon points={b.top} fill={K.dieTop} clipPath={props.mode === 'profile' ? 'url(#clipDie1)' : 'url(#clipDie2)'} />
    </g>
  );
}

function Indicators(props) {
  if (props.o <= 0.002) return null;
  var a = props.accent, u = props.halfU, v = props.halfV, L = Math.min(95, u * 0.4), marks = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s, i) {
    marks.push(<polyline key={i} points={poly([[s[0] * u - s[0] * L, 0, s[1] * v], [s[0] * u, 0, s[1] * v], [s[0] * u, 0, s[1] * v - s[1] * L]])} />);
  });
  return (
    <g opacity={props.o} transform={tv(props.x, 18, props.z || 0)} stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
      {marks}
      <polyline points={poly([[-46, 0, 0], [46, 0, 0]])} strokeWidth="5" />
      <polyline points={poly([[0, 0, -46], [0, 0, 46]])} strokeWidth="5" />
      <g opacity="0.5" strokeWidth="4" strokeDasharray="14 12">
        <polyline points={poly([[-u, 0, -168], [-u, 0, 168]])} />
        <polyline points={poly([[u, 0, -168], [u, 0, 168]])} />
      </g>
    </g>
  );
}

// press 01 tool: one profile punch. press 02 tool: only the feature punches.
function Ram(props) {
  var K = props.k, y = props.y, x = props.x, z = props.z || 0;
  return (
    <g>
      <g transform={tv(x, y + 60, z)}>
        {props.mode === 'profile' ? (
          <g>
            <path d={PROFILE} transform="translate(0,60)" fill={K.right} />
            <path d={PROFILE} fill={K.front} />
          </g>
        ) : (
          <g>
            <path d={FEATURE_PATHS} fillRule="evenodd" transform="translate(0,60)" fill={K.right} />
            <path d={FEATURE_PATHS} fillRule="evenodd" fill={K.front} />
          </g>
        )}
      </g>
      <Box x0={x - 195} x1={x + 195} y0={y + 60} y1={y + 104} z0={z - 130} z1={z + 168} fills={[K.top, K.front, K.right]} />
      <Box x0={x - 175} x1={x + 175} y0={y + 104} y1={y + 218} z0={z - 118} z1={z + 155} fills={[K.top, K.front, K.right]} />
      <polygon points={poly([[x - 90, y + 182, z - 118], [x + 90, y + 182, z - 118], [x + 90, y + 204, z - 118], [x - 90, y + 204, z - 118]])} fill={props.accent} opacity="0.9" />
      <Box x0={x - 320} x1={x - 195} y0={y + 110} y1={y + 180} z0={z + 140} z1={z + 210} fills={[K.front, K.right, K.right]} />
      <Box x0={x + 195} x1={x + 320} y0={y + 110} y1={y + 180} z0={z + 140} z1={z + 210} fills={[K.front, K.right, K.right]} />
    </g>
  );
}

// ---- one workpiece cycle --------------------------------------------------
function Workpiece(props) {
  var K = props.k, C = props.cues, total = props.total, a = props.accent, E = window.Easing;
  var local = props.t - props.phase * total;
  if (local < -1.35 || local > total + 0.05) return null;

  var cut = C.Blank + 1.0;        // profile is sheared out
  var pierce = C.Punch + 0.9;     // features are punched
  var isCut = local >= cut, isPierced = local >= pierce;

  // strip in, align, blank
  var stripX = seg(local, -1.3, C.Align1, -3050, S1 - 40, E.easeOutCubic)
    + seg(local, C.Align1 + 0.15, C.Blank - 0.15, 0, 40, E.easeInOutCubic);
  // skeleton runs to the end of belt 1 and tips into the scrap bin
  var skelX = stripX + seg(local, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic);
  var skelZ = -seg(local, C.Transfer + 1.35, C.Transfer + 2.0, 0, 230, E.easeInQuad);
  var skelDrop = seg(local, C.Transfer + 1.45, C.Transfer + 2.0, 0, 300, E.easeInQuad);
  var skelO = 1 - seg(local, C.Transfer + 1.6, C.Transfer + 2.0, 0, 1);
  // blank crosses onto conveyor 2, is aligned, punched, then exits
  var blankZ = seg(local, C.Transfer + 0.25, C.Align2 - 0.05, 0, ZO, E.easeInOutCubic);
  var blankX = stripX
    + seg(local, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
    + seg(local, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
    + seg(local, C.Exit + 0.1, total, 0, 1780, E.easeInOutQuad);
  var blankY = 10 - seg(local, cut, cut + 0.12, 0, 6, E.easeOutQuad)
    + seg(local, C.Transfer + 0.12, C.Transfer + 0.4, 0, 6, E.easeOutCubic);
  var edge = seg(local, cut, cut + 0.06, 0, 1) * (1 - seg(local, cut + 0.3, cut + 1.2, 0, 1, E.easeOutQuad))
    + seg(local, pierce, pierce + 0.06, 0, 1) * (1 - seg(local, pierce + 0.3, pierce + 1.2, 0, 1, E.easeOutQuad));

  var slugDrop = seg(local, pierce, pierce + 0.5, 0, 210, E.easeInQuad);
  var slugO = (isPierced ? 1 : 0) * (1 - seg(local, pierce + 0.2, pierce + 0.55, 0, 1));

  return (
    <g>
      {!isCut || skelO > 0.01 ? (
        <g opacity={skelO}>
          <g transform={tv(skelX + 16, 0.8 - skelDrop, skelZ - 18)} opacity="0.45">
            <path d={isCut ? STRIP_CUT : STRIP_FULL} fillRule="evenodd" fill={K.shadow} />
          </g>
          <g transform={tv(skelX, 10 - skelDrop, skelZ)}>
            <path d={isCut ? STRIP_CUT : STRIP_FULL} fillRule="evenodd" transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
            <path d={isCut ? STRIP_CUT : STRIP_FULL} fillRule="evenodd" fill={K.sheet} />
          </g>
        </g>
      ) : null}
      <g transform={tv(blankX, blankY, blankZ)} opacity={isCut ? 1 : 0}>
        <path d={isPierced ? PUNCHED : PROFILE} fillRule="evenodd" transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
        <path d={isPierced ? PUNCHED : PROFILE} fillRule="evenodd" fill={K.sheet} />
        <path d={PROFILE} fill="none" stroke={a} strokeWidth="5" opacity={Math.min(1, edge)} />
      </g>
      {slugO > 0.01 ? (
        <g transform={tv(blankX, 4 - slugDrop, blankZ)} opacity={slugO * 0.8}>
          <path d={FEATURE_PATHS} fillRule="evenodd" fill={K.cavity} />
        </g>
      ) : null}
    </g>
  );
}

function Piece(props) {
  var c = window.useComposition();
  var E = window.Easing;
  var T = c.T, C = c.CUES, total = c.authoredTotal || 12;
  var K = theme(props.dark);
  var a = props.accent || '#ec3013';

  var cut = C.Blank + 1.0, pierce = C.Punch + 0.9;

  // press strokes
  var ram1 = seg(T, C.Blank + 0.2, cut - 0.06, 320, 16, E.easeInQuad) - seg(T, cut - 0.06, cut + 0.02, 0, 12, E.easeInQuad)
    + seg(T, cut + 0.3, C.Transfer - 0.05, 0, 316, E.easeInOutCubic);
  var ram2 = seg(T, C.Punch + 0.1, pierce - 0.06, 320, 16, E.easeInQuad) - seg(T, pierce - 0.06, pierce + 0.02, 0, 12, E.easeInQuad)
    + seg(T, pierce + 0.3, C.Exit + 0.15, 0, 316, E.easeInOutCubic);

  // belt travel (drives the slats); periodic across the loop seam
  function bp1(t) {
    return seg(t, -1.3, C.Align1, -3050, S1 - 40, E.easeOutCubic)
      + seg(t, C.Align1 + 0.15, C.Blank - 0.15, 0, 40, E.easeInOutCubic)
      + seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic);
  }
  function bp2(t) {
    return seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
      + seg(t, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
      + seg(t, C.Exit + 0.1, total, 0, 1780, E.easeInOutQuad);
  }
  var sp1 = (bp1(total) - bp1(0)) / 21, sp2 = (bp2(total) - bp2(0)) / 20;

  // camera: hold on station 01, glide to station 02 for the punch, return by the seam
  var focus = S1 + seg(T, C.Transfer + 0.2, C.Align2 - 0.1, 0, S2 - S1, E.easeInOutCubic)
    - seg(T, C.Exit + 0.8, total, 0, S2 - S1, E.easeInOutCubic);
  var hump = function (t0, t1) { return T <= t0 || T >= t1 ? 0 : Math.sin(Math.PI * (T - t0) / (t1 - t0)); };
  var zoom = 0.56 - 0.085 * (hump(C.Transfer + 0.2, C.Align2 - 0.1) + hump(C.Exit + 0.8, total));
  var shakeT = Math.min(Math.abs(T - cut), Math.abs(T - pierce));
  var shake = 4 * Math.exp(-shakeT * 13) * Math.sin(shakeT * 78) * (T >= cut ? 1 : 0);

  var focusZ = seg(T, C.Transfer + 0.2, C.Align2 - 0.1, 0, ZO, E.easeInOutCubic) - seg(T, C.Exit + 0.8, total, 0, ZO, E.easeInOutCubic);
  var fp = P(focus, 0, focusZ), ax = 950, ay = 690 + shake;
  function scr(x, y, z) { var p = P(x, y, z); return [ax + (p[0] - fp[0]) * zoom, ay + (p[1] - fp[1]) * zoom]; }
  var camT = 'translate(' + (ax - fp[0] * zoom).toFixed(2) + ',' + (ay - fp[1] * zoom).toFixed(2) + ') scale(' + zoom.toFixed(4) + ')';

  var ind1 = seg(T, C.Align1 + 0.1, C.Align1 + 0.4, 0, 1) * (1 - seg(T, C.Blank + 0.1, C.Blank + 0.4, 0, 1));
  var ind2 = seg(T, C.Align2 + 0.05, C.Align2 + 0.35, 0, 1) * (1 - seg(T, C.Punch + 0.05, C.Punch + 0.35, 0, 1));
  var ring1 = { r: seg(T, cut, cut + 0.42, 90, 300, E.easeOutQuart), o: (1 - seg(T, cut, cut + 0.42, 0, 1, E.easeOutQuad)) * (T >= cut ? 0.5 : 0) };
  var ring2 = { r: seg(T, pierce, pierce + 0.42, 70, 240, E.easeOutQuart), o: (1 - seg(T, pierce, pierce + 0.42, 0, 1, E.easeOutQuad)) * (T >= pierce ? 0.5 : 0) };

  // callouts follow their own part
  var lblBlank = scr(S1 - 40 + seg(T, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic) + 130, 24, seg(T, C.Transfer + 0.25, C.Align2 - 0.05, 0, ZO, E.easeInOutCubic) + 95);
  var lblSkel = scr(S1 + seg(T, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic) - 300, 24, 95);
  var lblDone = scr(S2 + seg(T, C.Exit + 0.1, total, 0, 1780, E.easeInOutQuad) + 130, 24, ZO + 95);
  var show = props.labels ? 1 : 0;
  var oBlank = show * seg(T, C.Transfer + 0.5, C.Transfer + 0.85, 0, 1) * (1 - seg(T, C.Align2 - 0.4, C.Align2 - 0.05, 0, 1));
  var oSkel = show * seg(T, C.Transfer + 0.4, C.Transfer + 0.7, 0, 1) * (1 - seg(T, C.Transfer + 1.3, C.Transfer + 1.55, 0, 1));
  var oDone = show * seg(T, C.Exit + 0.35, C.Exit + 0.7, 0, 1) * (1 - seg(T, total - 0.85, total - 0.5, 0, 1));
  var st1 = scr(S1 - 430, 780, 200), st2 = scr(S2 - 430, 780, ZO + 200);
  var act1 = 0.4 + 0.6 * seg(T, C.Align1, C.Align1 + 0.3, 0, 1) * (1 - seg(T, C.Transfer, C.Transfer + 0.4, 0, 1));
  var act2 = 0.4 + 0.6 * seg(T, C.Align2 - 0.3, C.Align2, 0, 1) * (1 - seg(T, C.Exit, C.Exit + 0.4, 0, 1));

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
          <clipPath id="clipDie1" clipRule="evenodd">
            <path d={pathOf([[S1 - 290, 0, -150], [S1 + 290, 0, -150], [S1 + 290, 0, 172], [S1 - 290, 0, 172]]) + pathOf(OUTLINE.map(function (p) { return [p[0] + S1, 0, p[2]]; }))} clipRule="evenodd" />
          </clipPath>
          <clipPath id="clipDie2" clipRule="evenodd">
            <path d={pathOf([[S2 - 290, 0, ZO - 150], [S2 + 290, 0, ZO - 150], [S2 + 290, 0, ZO + 172], [S2 - 290, 0, ZO + 172]]) + FEATURES.map(function (h) { return pathOf(h.map(function (p) { return [p[0] + S2, 0, p[2] + ZO]; })); }).join('')} clipRule="evenodd" />
          </clipPath>
          <clipPath id="clipB1"><polygon points={poly([[B1[0], 0, -BELT_V], [B1[1], 0, -BELT_V], [B1[1], 0, BELT_V], [B1[0], 0, BELT_V]])} /></clipPath>
          <clipPath id="clipB2"><polygon points={poly([[B2[0], 0, ZO - BELT_V], [B2[1], 0, ZO - BELT_V], [B2[1], 0, ZO + BELT_V], [B2[0], 0, ZO + BELT_V]])} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            {[[-2000, 10], [-200, ZO * 0.5], [S1 - 350, 200], [S1 + 350, 200], [1900, ZO + 10], [S2 - 350, ZO + 200], [S2 + 350, ZO + 200]].map(function (g, i) {
              var p = P(g[0], -238, g[1]);
              return <ellipse key={i} cx={p[0]} cy={p[1]} rx="120" ry="40" />;
            })}
            <ellipse cx={P(S1, -238, 20)[0]} cy={P(S1, -238, 20)[1]} rx="360" ry="58" opacity="0.7" />
            <ellipse cx={P(S2, -238, ZO + 20)[0]} cy={P(S2, -238, ZO + 20)[1]} rx="360" ry="58" opacity="0.7" />
          </g>
          <PressFrame k={K} x={S2} z={ZO} accent={a} />
          <Belt k={K} span={B2} z={ZO} legs={[S2 - 20, 2400]} phase={bp2(T)} spacing={sp2} clip="url(#clipB2)" />
          <Die k={K} x={S2} z={ZO} mode="features" />
          <Indicators o={ind2} x={S2} z={ZO} halfU={158} halfV={88} accent={a} />
          <PressFrame k={K} x={S1} accent={a} />
          <Bridge k={K} />
          <Belt k={K} span={B1} legs={[-2500, S1 - 20]} phase={bp1(T)} spacing={sp1} clip="url(#clipB1)" />
          <Die k={K} x={S1} mode="profile" />
          <Indicators o={ind1} x={S1} halfU={STRIP_U} halfV={STRIP_V} accent={a} />
          <Workpiece k={K} t={T} cues={C} total={total} phase={0} accent={a} />
          <Workpiece k={K} t={T} cues={C} total={total} phase={1} accent={a} />
          <Box x0={B1[0]} x1={B1[1]} y0={0} y1={16} z0={-161} z1={-145} fills={[K.top, K.front, K.right]} />
          <Box x0={B2[0]} x1={B2[1]} y0={0} y1={16} z0={ZO - 161} z1={ZO - 145} fills={[K.top, K.front, K.right]} />
          <ScrapChute k={K} />
          {ring1.o > 0.01 ? <g transform={tv(S1, 12, 0)} opacity={ring1.o}><ellipse cx="0" cy="0" rx={ring1.r} ry={ring1.r * 0.34} fill="none" stroke={a} strokeWidth="5" /></g> : null}
          {ring2.o > 0.01 ? <g transform={tv(S2, 12, ZO)} opacity={ring2.o}><ellipse cx="0" cy="0" rx={ring2.r} ry={ring2.r * 0.34} fill="none" stroke={a} strokeWidth="5" /></g> : null}
          <Ram k={K} x={S1} y={ram1} mode="profile" accent={a} />
          <Ram k={K} x={S2} y={ram2} z={ZO} mode="features" accent={a} />
        </g>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#vig)" pointerEvents="none" />
        <g fontFamily="Archivo, system-ui, sans-serif" fontSize="30" fontWeight="600" letterSpacing="3.4">
          <g opacity={act1}>
            <line x1={st1[0]} y1={st1[1]} x2={st1[0] + 300} y2={st1[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={st1[0]} y={st1[1] - 14} fill={K.ink}>01 BLANKING</text>
          </g>
          <g opacity={act2}>
            <line x1={st2[0]} y1={st2[1]} x2={st2[0] + 300} y2={st2[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={st2[0]} y={st2[1] - 14} fill={K.ink}>02 PUNCHING</text>
          </g>
          <g opacity={oBlank}>
            <line x1={lblBlank[0]} y1={lblBlank[1]} x2={lblBlank[0]} y2={lblBlank[1] - 96} stroke={a} strokeWidth="2.5" />
            <line x1={lblBlank[0]} y1={lblBlank[1] - 96} x2={lblBlank[0] + 66} y2={lblBlank[1] - 96} stroke={a} strokeWidth="2.5" />
            <text x={lblBlank[0] + 78} y={lblBlank[1] - 87} fill={a}>BLANK · PROFILE ONLY</text>
          </g>
          <g opacity={oSkel}>
            <line x1={lblSkel[0]} y1={lblSkel[1]} x2={lblSkel[0]} y2={lblSkel[1] - 96} stroke={K.ink} strokeWidth="2.5" />
            <line x1={lblSkel[0] - 66} y1={lblSkel[1] - 96} x2={lblSkel[0]} y2={lblSkel[1] - 96} stroke={K.ink} strokeWidth="2.5" />
            <text x={lblSkel[0] - 78} y={lblSkel[1] - 87} fill={K.ink} textAnchor="end">SKELETON</text>
          </g>
          <g opacity={oDone}>
            <line x1={lblDone[0]} y1={lblDone[1]} x2={lblDone[0]} y2={lblDone[1] - 96} stroke={a} strokeWidth="2.5" />
            <line x1={lblDone[0] - 66} y1={lblDone[1] - 96} x2={lblDone[0]} y2={lblDone[1] - 96} stroke={a} strokeWidth="2.5" />
            <text x={lblDone[0] - 78} y={lblDone[1] - 87} fill={a} textAnchor="end">FINISHED COMPONENT</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function BlankingLine() {
  var tw = window.useTweaks(window.TWEAK_DEFAULTS || {});
  var t = tw[0], setTweak = tw[1];
  var CompositionStage = window.CompositionStage;
  var TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection;
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Piece dark={t.dark} labels={t.labels} accent={t.accent} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.BlankingLine = BlankingLine;
