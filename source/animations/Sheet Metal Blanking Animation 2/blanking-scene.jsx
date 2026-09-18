
// Three-station sheet-metal line — blanking (press 01), punching (press 02),
// central bending (press 03).
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
// piecewise keyframe track: ks = [[time, value], ...] in ascending time
function track(t, ks, ease) {
  if (t <= ks[0][0]) return ks[0][1];
  for (var i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) return seg(t, ks[i - 1][0], ks[i][0], ks[i - 1][1], ks[i][1], ease);
  }
  return ks[ks.length - 1][1];
}

// ---- geometry -------------------------------------------------------------
var TH = 10;                       // sheet thickness
var STRIP_U = 400, STRIP_V = 120;  // half-length / half-width of the incoming strip
var BELT_V = 135;
var B1 = [-3200, -330], B2 = [-60, 1880], B3 = [2260, 3620], B4 = [4100, 7400];
var BRIDGE1 = [-360, 120], BRIDGE2 = [1840, 2320], BRIDGE3 = [3580, 4140];
var S1 = -850, S2 = 900, S3 = 2700, S4 = 5100;   // station centres
var ZO2 = 320, ZO3 = 640, ZO4 = 960;        // each conveyor runs on its own depth line
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
// stage 2 features: four bolt holes in the flanges + one central oblong slot.
// All of them sit clear of the stage-3 bend lines at u = ±BH.
var FEATURES = [
  circleUV(-108, -46, 15, 26),
  circleUV(-108, 46, 15, 26),
  circleUV(108, -46, 15, 26),
  circleUV(108, 46, 15, 26),
  slotUV(0, 0, 30, 12, 12)
];

var PROFILE = pathOf(OUTLINE);                                    // blank, no features
var FEATURE_PATHS = FEATURES.map(function (h) { return pathOf(h); }).join('');
var PUNCHED = PROFILE + FEATURE_PATHS;                            // punched flat part
var STRIP_FULL = pathOf([[-STRIP_U, 0, -STRIP_V], [STRIP_U, 0, -STRIP_V], [STRIP_U, 0, STRIP_V], [-STRIP_U, 0, STRIP_V]]);
var STRIP_CUT = STRIP_FULL + pathOf(OUTLINE.slice().reverse());   // skeleton

// ---- stage 3: central bend ------------------------------------------------
// The flat part keeps its profile and its holes; only the sheet deforms.
// Centre band (|u| <= BH) is pressed down into the V-die; the two flanges
// rotate upward about the bend lines at u = ±BH.
var BH = 60;           // half-width of the formed centre band
var BEND_DROP = 56;    // how far the centre band sinks into the die
var DIE3_TOP = 130, DIE3_BOT = 64;   // V-groove opening / floor half-widths

// insert vertices wherever an edge crosses a bend line, so the polygon folds
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
// where the bend lines meet the outer profile (for the fold-line marks)
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

// mix a hex toward white (f > 0) or black (f < 0)
function shade(hex, f) {
  var h = (hex || '#3a3d40').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  var t = f > 0 ? 255 : 0, k = Math.abs(f);
  function m(c) { return Math.round(c + (t - c) * k); }
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}
function rnd(i, s) { var v = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); }

// The scene was authored against an 18.2 s loop. If the timeline is stretched
// or compressed, normalise the clock and the cue table so every beat scales
// uniformly instead of only the cue-bound ones.
var AUTHORED = 18.2;
function scaleCues(C, R) {
  if (R === 1) return C;
  var o = {};
  for (var k in C) o[k] = C[k] / R;
  return o;
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
  for (z = -900; z <= 1080; z += 180) lines.push(<line key={'z' + z} x1={P(-3400, -240, z)[0]} y1={P(-3400, -240, z)[1]} x2={P(5400, -240, z)[0]} y2={P(5400, -240, z)[1]} />);
  for (x = -3400; x <= 5400; x += 180) lines.push(<line key={'x' + x} x1={P(x, -240, -900)[0]} y1={P(x, -240, -900)[1]} x2={P(x, -240, 1080)[0]} y2={P(x, -240, 1080)[1]} />);
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

// short roller transfer between two depth lines
function Bridge(props) {
  var K = props.k, span = props.span, za = props.za, zb = props.zb, rollers = [];
  for (var x = span[0] + 40; x < span[1] - 20; x += 100) {
    rollers.push(<Box key={x} x0={x} x1={x + 40} y0={-24} y1={-2} z0={za - BELT_V - 20} z1={zb + BELT_V + 20} fills={[K.dieTop, K.right, K.right]} />);
  }
  return (
    <g>
      <Box x0={span[0]} x1={span[1]} y0={-80} y1={-24} z0={za - BELT_V - 20} z1={zb + BELT_V + 20} fills={[K.front, K.right, K.right]} />
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

// press 03 bottom tool: a wide V/U forming die. No cutting edges.
function BendDie(props) {
  var K = props.k, x = props.x, z = props.z || 0, z0 = z - 150, z1 = z + 172;
  var face = poly([
    [x - 290, -110, z0], [x - 290, 0, z0], [x - DIE3_TOP, 0, z0], [x - DIE3_BOT, -BEND_DROP, z0],
    [x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_TOP, 0, z0], [x + 290, 0, z0], [x + 290, -110, z0]
  ]);
  return (
    <g>
      <polygon points={poly([[x + 290, -110, z0], [x + 290, -110, z1], [x + 290, 0, z1], [x + 290, 0, z0]])} fill={K.right} />
      <polygon points={poly([[x - 290, 0, z0], [x - DIE3_TOP, 0, z0], [x - DIE3_TOP, 0, z1], [x - 290, 0, z1]])} fill={K.dieTop} />
      <polygon points={poly([[x + DIE3_TOP, 0, z0], [x + 290, 0, z0], [x + 290, 0, z1], [x + DIE3_TOP, 0, z1]])} fill={K.dieTop} />
      <polygon points={poly([[x - DIE3_TOP, 0, z0], [x - DIE3_BOT, -BEND_DROP, z0], [x - DIE3_BOT, -BEND_DROP, z1], [x - DIE3_TOP, 0, z1]])} fill={K.front} />
      <polygon points={poly([[x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_TOP, 0, z0], [x + DIE3_TOP, 0, z1], [x + DIE3_BOT, -BEND_DROP, z1]])} fill={K.right} />
      <polygon points={poly([[x - DIE3_BOT, -BEND_DROP, z0], [x + DIE3_BOT, -BEND_DROP, z0], [x + DIE3_BOT, -BEND_DROP, z1], [x - DIE3_BOT, -BEND_DROP, z1]])} fill={K.cavity} />
      <polygon points={face} fill={K.right} />
    </g>
  );
}

// station 04 — open-fronted coating booth: two posts, an extract hood and a
// low plinth the part sits on. No front rail, so the part is never occluded.
function Booth(props) {
  var K = props.k, x = props.x, z = props.z, F = [K.top, K.front, K.right];
  return (
    <g>
      <Box x0={x - 470} x1={x - 410} y0={-230} y1={600} z0={z + 150} z1={z + 250} fills={F} />
      <Box x0={x + 410} x1={x + 470} y0={-230} y1={600} z0={z + 150} z1={z + 250} fills={F} />
      <Box x0={x - 520} x1={x + 520} y0={600} y1={690} z0={z - 40} z1={z + 280} fills={F} />
      <polygon points={poly([[x - 300, 636, z - 40], [x + 300, 636, z - 40], [x + 300, 660, z - 40], [x - 300, 660, z - 40]])} fill={props.accent} opacity="0.9" />
      <Box x0={x - 470} x1={x + 470} y0={0} y1={26} z0={z + 235} z1={z + 251} fills={F} />
      <Box x0={x - 300} x1={x + 300} y0={-40} y1={0} z0={z - 150} z1={z + 172} fills={[K.dieTop, K.right, K.right]} />
    </g>
  );
}

// electrostatic spray gun on a swan-neck over the part
function Nozzle(props) {
  var K = props.k, x = props.x, z = props.z, y = props.y;
  return (
    <g>
      <Box x0={x - 340} x1={x - 280} y0={y + 40} y1={560} z0={z + 60} z1={z + 120} fills={[K.top, K.front, K.right]} />
      <Box x0={x - 340} x1={x - 40} y0={y + 40} y1={y + 96} z0={z + 60} z1={z + 120} fills={[K.top, K.front, K.right]} />
      <Box x0={x - 78} x1={x - 30} y0={y} y1={y + 44} z0={z + 66} z1={z + 114} fills={[K.dieTop, K.front, K.right]} />
      <polygon points={poly([[x - 66, y - 16, z + 74], [x - 42, y - 16, z + 74], [x - 42, y, z + 74], [x - 66, y, z + 74]])} fill={props.accent} />
    </g>
  );
}

// fine powder: a soft directional cone plus drifting particles that settle on
// the part. Deterministic from the clock, so scrubbing is stable.
function Powder(props) {
  if (props.o <= 0.004) return null;
  var x = props.x, z = props.z, T = props.t, col = props.color;
  var tipY = props.tipY, tipX = x - 54, tipZ = z + 90;
  var n = Math.max(6, Math.round(props.density));
  var dots = [];
  for (var i = 0; i < n; i++) {
    var a = rnd(i, 1), b = rnd(i, 2), cc = rnd(i, 3), d = rnd(i, 4);
    var u = ((T * 0.62 + a) % 1);
    var e = u * u * (3 - 2 * u);
    var tx = x + (b * 2 - 1) * 168, tz = z + (cc * 2 - 1) * 92, ty = 96 + d * 46;
    var px = tipX + (tx - tipX) * e + Math.sin(T * 1.9 + a * 6.28) * 34 * (1 - e);
    var pz = tipZ + (tz - tipZ) * e + Math.cos(T * 1.6 + b * 6.28) * 26 * (1 - e);
    var py = tipY + (ty - tipY) * e;
    var fade = Math.min(1, u * 7) * (1 - Math.max(0, (u - 0.72) / 0.28));
    var p = P(px, py, pz);
    dots.push(<circle key={i} cx={p[0]} cy={p[1]} r={(2.6 + d * 4.4) * (1 - e * 0.45)} opacity={fade * 0.85} />);
  }
  var cone = poly([
    [tipX - 16, tipY, tipZ - 14], [tipX + 16, tipY, tipZ + 14],
    [x + 190, 110, z + 108], [x + 150, 110, z - 96], [x - 200, 110, z - 70]
  ]);
  return (
    <g opacity={props.o}>
      <polygon points={cone} fill={col} opacity="0.07" filter="url(#mist)" />
      <polygon points={cone} fill={col} opacity="0.035" />
      <g fill={col} filter="url(#mist)">{dots}</g>
    </g>
  );
}

// polishing head: a soft rotating brush that sweeps across the formed part
function PolishHead(props) {
  if (props.o <= 0.004) return null;
  var K = props.k, x = props.x, y = props.y, z = props.z, spin = props.spin;
  var ticks = [];
  for (var i = 0; i < 7; i++) {
    var ph = ((spin + i / 7) % 1) * Math.PI * 2;
    var dz = Math.sin(ph) * 60, sc = 0.45 + 0.55 * (Math.cos(ph) * 0.5 + 0.5);
    ticks.push(<polyline key={i} points={poly([[x - 46, y + 8, z + dz], [x + 46, y + 8, z + dz]])} stroke={K.dieTop} strokeWidth={2 + sc * 2.4} opacity={0.35 + sc * 0.45} />);
  }
  return (
    <g opacity={props.o}>
      <Box x0={x - 18} x1={x + 18} y0={y + 74} y1={580} z0={z - 14} z1={z + 26} fills={[K.top, K.front, K.right]} />
      <Box x0={x - 56} x1={x + 56} y0={y + 20} y1={y + 82} z0={z - 78} z1={z + 78} fills={[K.top, K.front, K.right]} />
      <g fill="none" strokeLinecap="round">{ticks}</g>
      <polygon points={poly([[x - 56, y + 46, z - 78], [x + 56, y + 46, z - 78], [x + 56, y + 62, z - 78], [x - 56, y + 62, z - 78]])} fill={props.accent} opacity="0.85" />
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
      {props.bend ? (
        <g opacity="0.75" strokeWidth="4" strokeDasharray="18 10">
          <polyline points={poly([[-BH, 0, -150], [-BH, 0, 150]])} />
          <polyline points={poly([[BH, 0, -150], [BH, 0, 150]])} />
        </g>
      ) : null}
    </g>
  );
}

// press 01 tool: profile punch. press 02: feature punches. press 03: forming blade.
function Ram(props) {
  var K = props.k, y = props.y, x = props.x, z = props.z || 0;
  // the forming tool sits on a tall narrow shank so the shoe never hides the
  // flanges as they rise
  var o = props.mode === 'bend' ? 190 : 60;
  return (
    <g>
      {props.mode === 'bend' ? (
        <g>
          <Box x0={x - 30} x1={x + 30} y0={y + 48} y1={y + o} z0={z + 20} z1={z + 80} fills={[K.top, K.front, K.right]} />
          <Box x0={x - 52} x1={x + 52} y0={y} y1={y + 48} z0={z - 100} z1={z + 92} fills={[K.dieTop, K.front, K.right]} />
        </g>
      ) : (
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
      )}
      <Box x0={x - 195} x1={x + 195} y0={y + o} y1={y + o + 44} z0={z - 130} z1={z + 168} fills={[K.top, K.front, K.right]} />
      <Box x0={x - 175} x1={x + 175} y0={y + o + 44} y1={y + o + 158} z0={z - 118} z1={z + 155} fills={[K.top, K.front, K.right]} />
      <polygon points={poly([[x - 90, y + o + 122, z - 118], [x + 90, y + o + 122, z - 118], [x + 90, y + o + 144, z - 118], [x - 90, y + o + 144, z - 118]])} fill={props.accent} opacity="0.9" />
      <Box x0={x - 320} x1={x - 195} y0={y + o + 50} y1={y + o + 120} z0={z + 140} z1={z + 210} fills={[K.front, K.right, K.right]} />
      <Box x0={x + 195} x1={x + 320} y0={y + o + 50} y1={y + o + 120} z0={z + 140} z1={z + 210} fills={[K.front, K.right, K.right]} />
    </g>
  );
}

// ---- one workpiece cycle --------------------------------------------------
function Workpiece(props) {
  var K = props.k, C = props.cues, total = props.total, a = props.accent, E = window.Easing;
  var ANG = (props.bendAngle || 42) * Math.PI / 180;
  var local = props.t - props.phase * total;
  if (local < -1.35 || local > total + 0.05) return null;

  var cut = C.Blank + 1.0;        // profile is sheared out
  var pierce = C.Punch + 0.9;     // features are punched
  var form0 = C.Bend + 0.55, form1 = C.Bend + 1.45;
  var isCut = local >= cut, isPierced = local >= pierce;

  // strip in, align, blank
  var stripX = seg(local, -1.3, C.Align1, -3050, S1 - 40, E.easeOutCubic)
    + seg(local, C.Align1 + 0.15, C.Blank - 0.15, 0, 40, E.easeInOutCubic);
  // skeleton runs to the end of belt 1 and tips into the scrap bin
  var skelX = stripX + seg(local, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic);
  var skelZ = -seg(local, C.Transfer + 1.35, C.Transfer + 2.0, 0, 230, E.easeInQuad);
  var skelDrop = seg(local, C.Transfer + 1.45, C.Transfer + 2.0, 0, 300, E.easeInQuad);
  var skelO = 1 - seg(local, C.Transfer + 1.6, C.Transfer + 2.0, 0, 1);

  // blank: conveyor 2 -> punch -> conveyor 3 -> bend -> exit
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

  // forming: centre band sinks, flanges rotate up — one linked stroke
  var form = seg(local, form0, form1, 0, 1, E.easeInOutCubic);
  var relax = seg(local, form1 + 0.15, form1 + 0.4, 0, 1, E.easeOutCubic);
  var bendAng = ANG * form * (1 - 0.055 * relax);
  var bendDrop = BEND_DROP * form * (1 - 0.07 * relax);
  // formed part is lifted out of the die and then rides on its centre band
  var lift = seg(local, C.Exit + 0.05, C.Exit + 0.5, 0, BEND_DROP * 0.93 + 10, E.easeOutCubic)
    - seg(local, C.Exit + 0.5, C.Exit + 0.95, 0, 10, E.easeInOutCubic);

  var partY = 10 - seg(local, cut, cut + 0.12, 0, 6, E.easeOutQuad)
    + seg(local, C.Transfer + 0.12, C.Transfer + 0.4, 0, 6, E.easeOutCubic)
    + lift;
  var flash = function (t0) { return seg(local, t0, t0 + 0.06, 0, 1) * (1 - seg(local, t0 + 0.3, t0 + 1.2, 0, 1, E.easeOutQuad)); };
  var edge = flash(cut) + flash(pierce);
  var foldO = seg(local, form0 - 0.25, form0 + 0.1, 0, 1) * (1 - seg(local, form1 + 0.5, form1 + 1.1, 0, 1));

  var slugDrop = seg(local, pierce, pierce + 0.5, 0, 210, E.easeInQuad);
  var slugO = (isPierced ? 1 : 0) * (1 - seg(local, pierce + 0.2, pierce + 0.55, 0, 1));

  var bent = bendAng > 0.0015;
  var partPath = bent ? bentPaths(bendAng, bendDrop) : (isPierced ? PUNCHED : PROFILE);

  // station 04 — the coating builds on the same geometry: a soft left-to-right
  // wipe reveals the coated surface while the powder is spraying, then the
  // polish pass adds a travelling sheen and a residual satin highlight.
  var coatP = seg(local, C.Coat + 0.3, C.Polish - 0.15, 0, 1, E.easeInOutCubic);
  var polish = seg(local, C.Polish + 0.15, C.Reset - 0.05, 0, 1, E.easeInOutCubic);
  var polished = seg(local, C.Polish + 0.35, C.Reset + 0.1, 0, 1, E.easeOutCubic);
  var coatCol = props.coatColor || '#3a3d40';
  var gloss = props.gloss == null ? 0.5 : props.gloss;
  var idp = 'p' + props.phase;
  var w0 = Math.max(0, Math.min(0.999, coatP * 1.26 - 0.2));
  var w1 = Math.max(w0 + 0.001, Math.min(1, coatP * 1.26));
  var sh = polish, s0 = sh * 1.3 - 0.15;
  var exitO = 1 - seg(local, total - 0.5, total, 0, 1);

  var coatLayer = coatP <= 0.004 ? null : (
    <g>
      <defs>
        <linearGradient id={'gCoat' + idp} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={shade(coatCol, 0.3)} />
          <stop offset="0.28" stopColor={shade(coatCol, -0.08)} />
          <stop offset="0.52" stopColor={shade(coatCol, 0.14)} />
          <stop offset="0.78" stopColor={shade(coatCol, -0.26)} />
          <stop offset="1" stopColor={shade(coatCol, 0.04)} />
        </linearGradient>
        <linearGradient id={'wipe' + idp} x1="0" y1="0" x2="1" y2="0">
          <stop offset={w0.toFixed(3)} stopColor="#ffffff" stopOpacity="1" />
          <stop offset={w1.toFixed(3)} stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={'mCoat' + idp} maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill={'url(#wipe' + idp + ')'} />
        </mask>
        <linearGradient id={'sheen' + idp} x1="0" y1="0" x2="1" y2="0">
          <stop offset={Math.max(0, Math.min(0.997, s0 - 0.06)).toFixed(3)} stopColor="#ffffff" stopOpacity="0" />
          <stop offset={Math.max(0.001, Math.min(0.998, s0)).toFixed(3)} stopColor="#ffffff" stopOpacity="1" />
          <stop offset={Math.max(0.002, Math.min(1, s0 + 0.06)).toFixed(3)} stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={'mSheen' + idp} maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill={'url(#sheen' + idp + ')'} />
        </mask>
      </defs>
      <g mask={'url(#mCoat' + idp + ')'}>
        <path d={partPath} fillRule="evenodd" transform={'translate(0,' + TH + ')'} fill={shade(coatCol, -0.4)} />
        <path d={partPath} fillRule="evenodd" fill={'url(#gCoat' + idp + ')'} />
      </g>
      {polished > 0.004 ? <path d={partPath} fillRule="evenodd" fill="#ffffff" opacity={polished * gloss * 0.17} /> : null}
      {polish > 0.004 && polish < 0.999 ? (
        <g mask={'url(#mSheen' + idp + ')'}>
          <path d={partPath} fillRule="evenodd" fill="#ffffff" opacity={0.1 + gloss * 0.14} />
        </g>
      ) : null}
    </g>
  );

  // while the sheet is being formed it draws over the narrow forming tool, so
  // the deforming part stays one continuous piece to the viewer
  var partLayer = (
    <g transform={tv(partX, partY, partZ)} opacity={isCut ? exitO : 0}>
      <path d={partPath} fillRule="evenodd" transform={'translate(0,' + TH + ')'} fill={K.sheetEdge} />
      <path d={partPath} fillRule="evenodd" fill={K.sheet} />
      {coatLayer}
      <path d={bent ? pathOf(bendList(OUTLINE, bendAng, bendDrop)) : PROFILE} fill="none" stroke={a} strokeWidth="5" opacity={Math.min(1, edge + foldO * 0.8)} />
      {foldO > 0.01 ? (
        <g opacity={foldO}>
          <g stroke={a} strokeWidth="4.5" fill="none" strokeDasharray="20 12">
            <polyline points={poly([[-BH, -bendDrop, FOLD_V[0]], [-BH, -bendDrop, FOLD_V[1]]])} />
            <polyline points={poly([[BH, -bendDrop, FOLD_V[0]], [BH, -bendDrop, FOLD_V[1]]])} />
          </g>
          <g stroke={a} strokeWidth="5" fill="none" strokeLinecap="square">
            {[-1, 1].map(function (s, i) {
              var tipU = s * (BH + 90 * Math.cos(bendAng)), tipY = -bendDrop + 90 * Math.sin(bendAng);
              return (
                <polyline key={i} points={poly([
                  [tipU - s * 26, tipY + 52, -14], [tipU, tipY + 86, -14], [tipU + s * 26, tipY + 52, -14]
                ])} />
              );
            })}
          </g>
        </g>
      ) : null}
    </g>
  );
  if (props.overlay) return bent ? partLayer : null;

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
      {bent ? null : partLayer}
      {slugO > 0.01 ? (
        <g transform={tv(partX, 4 - slugDrop, partZ)} opacity={slugO * 0.8}>
          <path d={FEATURE_PATHS} fillRule="evenodd" fill={K.cavity} />
        </g>
      ) : null}
    </g>
  );
}

function Piece(props) {
  var c = window.useComposition();
  var E = window.Easing;
  var R = (c.authoredTotal || AUTHORED) / AUTHORED;
  var T = c.T / R, C = scaleCues(c.CUES, R), total = AUTHORED;
  var K = theme(props.dark);
  var a = props.accent || '#ec3013';

  var cut = C.Blank + 1.0, pierce = C.Punch + 0.9;
  var form0 = C.Bend + 0.55, form1 = C.Bend + 1.45;

  // press strokes
  var ram1 = seg(T, C.Blank + 0.2, cut - 0.06, 320, 16, E.easeInQuad) - seg(T, cut - 0.06, cut + 0.02, 0, 12, E.easeInQuad)
    + seg(T, cut + 0.3, C.Transfer - 0.05, 0, 316, E.easeInOutCubic);
  var ram2 = seg(T, C.Punch + 0.1, pierce - 0.06, 320, 16, E.easeInQuad) - seg(T, pierce - 0.06, pierce + 0.02, 0, 12, E.easeInQuad)
    + seg(T, pierce + 0.3, C.Transfer2 + 0.5, 0, 316, E.easeInOutCubic);
  // forming stroke: approach, then press the centre down in contact with the sheet
  var ram3 = track(T, [
    [C.Bend + 0.1, 320], [form0, 10], [form1, 10 - BEND_DROP],
    [form1 + 0.25, 10 - BEND_DROP + 4], [C.Exit + 0.9, 320]
  ], E.easeInOutCubic);

  // belt travel (drives the slats); periodic across the loop seam
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

  // camera: 01 -> 02 -> 03 -> 04, then a wide line shot across the loop seam
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

  // callouts follow their own part
  var pX = function (t) {
    return S1 + seg(t, C.Transfer + 0.1, C.Align2 - 0.05, 0, S2 - S1 - 40, E.easeInOutCubic)
      + seg(t, C.Align2 + 0.1, C.Punch - 0.15, 0, 40, E.easeInOutCubic)
      + seg(t, C.Transfer2 + 0.1, C.Align3 - 0.05, 0, S3 - S2 - 40, E.easeInOutCubic)
      + seg(t, C.Align3 + 0.1, C.Bend - 0.15, 0, 40, E.easeInOutCubic)
      + seg(t, C.Transfer3 + 0.1, C.Align4 - 0.05, 0, S4 - S3 - 40, E.easeInOutCubic)
      + seg(t, C.Align4 + 0.1, C.Coat - 0.15, 0, 40, E.easeInOutCubic)
      + seg(t, C.Reset + 0.1, total, 0, 1700, E.easeInOutQuad);
  };
  var pZ = function (t) {
    return seg(t, C.Transfer + 0.25, C.Align2 - 0.05, 0, ZO2, E.easeInOutCubic)
      + seg(t, C.Transfer2 + 0.25, C.Align3 - 0.05, 0, ZO3 - ZO2, E.easeInOutCubic)
      + seg(t, C.Transfer3 + 0.25, C.Align4 - 0.05, 0, ZO4 - ZO3, E.easeInOutCubic);
  };
  var lblBlank = scr(pX(T) - 40 + 130, 24, pZ(T) + 95);
  var lblSkel = scr(S1 + seg(T, C.Transfer + 0.1, C.Transfer + 1.5, 0, 480, E.easeInOutCubic) - 300, 24, 95);
  var lblPunched = scr(pX(T) - 40 + 130, 24, pZ(T) + 95);
  var lblDone = scr(pX(T) + 130, 24, pZ(T) + 95);
  var lblFin = scr(pX(T) + 130, 24, pZ(T) + 95);
  var show = props.labels ? 1 : 0;
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
          <filter id="mist" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
          <radialGradient id="vig" cx="0.5" cy="0.46" r="0.74">
            <stop offset="0.55" stopColor={K.bg} stopOpacity="0" />
            <stop offset="1" stopColor={props.dark ? '#000000' : '#201e1d'} stopOpacity={props.dark ? 0.55 : 0.13} />
          </radialGradient>
          <clipPath id="clipDie1" clipRule="evenodd">
            <path d={pathOf([[S1 - 290, 0, -150], [S1 + 290, 0, -150], [S1 + 290, 0, 172], [S1 - 290, 0, 172]]) + pathOf(OUTLINE.map(function (p) { return [p[0] + S1, 0, p[2]]; }))} clipRule="evenodd" />
          </clipPath>
          <clipPath id="clipDie2" clipRule="evenodd">
            <path d={pathOf([[S2 - 290, 0, ZO2 - 150], [S2 + 290, 0, ZO2 - 150], [S2 + 290, 0, ZO2 + 172], [S2 - 290, 0, ZO2 + 172]]) + FEATURES.map(function (h) { return pathOf(h.map(function (p) { return [p[0] + S2, 0, p[2] + ZO2]; })); }).join('')} clipRule="evenodd" />
          </clipPath>
          <clipPath id="clipB1"><polygon points={poly([[B1[0], 0, -BELT_V], [B1[1], 0, -BELT_V], [B1[1], 0, BELT_V], [B1[0], 0, BELT_V]])} /></clipPath>
          <clipPath id="clipB2"><polygon points={poly([[B2[0], 0, ZO2 - BELT_V], [B2[1], 0, ZO2 - BELT_V], [B2[1], 0, ZO2 + BELT_V], [B2[0], 0, ZO2 + BELT_V]])} /></clipPath>
          <clipPath id="clipB3"><polygon points={poly([[B3[0], 0, ZO3 - BELT_V], [B3[1], 0, ZO3 - BELT_V], [B3[1], 0, ZO3 + BELT_V], [B3[0], 0, ZO3 + BELT_V]])} /></clipPath>
          <clipPath id="clipB4"><polygon points={poly([[B4[0], 0, ZO4 - BELT_V], [B4[1], 0, ZO4 - BELT_V], [B4[1], 0, ZO4 + BELT_V], [B4[0], 0, ZO4 + BELT_V]])} /></clipPath>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill={K.bg} />
        <g transform={camT}>
          <Floor k={K} />
          <g filter="url(#soft)" fill={props.dark ? '#000000' : '#201e1d'} opacity={props.dark ? 0.45 : 0.16}>
            {[[-2000, 10], [-200, ZO2 * 0.5], [S1 - 350, 200], [S1 + 350, 200], [1700, ZO2 + 10], [S2 - 350, ZO2 + 200], [S2 + 350, ZO2 + 200],
              [2100, ZO3 - 120], [4300, ZO3 + 10], [S3 - 350, ZO3 + 200], [S3 + 350, ZO3 + 200],
              [3900, ZO4 - 130], [6600, ZO4 + 10], [S4 - 440, ZO4 + 200], [S4 + 440, ZO4 + 200]].map(function (g, i) {
              var p = P(g[0], -238, g[1]);
              return <ellipse key={i} cx={p[0]} cy={p[1]} rx="120" ry="40" />;
            })}
            <ellipse cx={P(S1, -238, 20)[0]} cy={P(S1, -238, 20)[1]} rx="360" ry="58" opacity="0.7" />
            <ellipse cx={P(S2, -238, ZO2 + 20)[0]} cy={P(S2, -238, ZO2 + 20)[1]} rx="360" ry="58" opacity="0.7" />
            <ellipse cx={P(S3, -238, ZO3 + 20)[0]} cy={P(S3, -238, ZO3 + 20)[1]} rx="360" ry="58" opacity="0.7" />
            <ellipse cx={P(S4, -238, ZO4 + 20)[0]} cy={P(S4, -238, ZO4 + 20)[1]} rx="430" ry="62" opacity="0.7" />
          </g>
          <Booth k={K} x={S4} z={ZO4} accent={a} />
          <Bridge k={K} span={BRIDGE3} za={ZO3} zb={ZO4} />
          <Belt k={K} span={B4} z={ZO4} legs={[S4 - 20, 6900]} phase={bp4(T)} spacing={sp4} clip="url(#clipB4)" />
          <Indicators o={ind4} x={S4} z={ZO4} halfU={158} halfV={88} accent={a} />
          <PressFrame k={K} x={S3} z={ZO3} accent={a} />
          <Belt k={K} span={B3} z={ZO3} legs={[S3 - 20, 4600]} phase={bp3(T)} spacing={sp3} clip="url(#clipB3)" />
          <BendDie k={K} x={S3} z={ZO3} />
          <Indicators o={ind3} x={S3} z={ZO3} halfU={158} halfV={88} accent={a} bend />
          <PressFrame k={K} x={S2} z={ZO2} accent={a} />
          <Bridge k={K} span={BRIDGE2} za={ZO2} zb={ZO3} />
          <Belt k={K} span={B2} z={ZO2} legs={[S2 - 20, 1600]} phase={bp2(T)} spacing={sp2} clip="url(#clipB2)" />
          <Die k={K} x={S2} z={ZO2} mode="features" />
          <Indicators o={ind2} x={S2} z={ZO2} halfU={158} halfV={88} accent={a} />
          <PressFrame k={K} x={S1} accent={a} />
          <Bridge k={K} span={BRIDGE1} za={0} zb={ZO2} />
          <Belt k={K} span={B1} legs={[-2500, S1 - 20]} phase={bp1(T)} spacing={sp1} clip="url(#clipB1)" />
          <Die k={K} x={S1} mode="profile" />
          <Indicators o={ind1} x={S1} halfU={STRIP_U} halfV={STRIP_V} accent={a} />
          <Workpiece k={K} t={T} cues={C} total={total} phase={0} accent={a} bendAngle={props.bendAngle} />
          <Workpiece k={K} t={T} cues={C} total={total} phase={1} accent={a} bendAngle={props.bendAngle} />
          <Box x0={B1[0]} x1={B1[1]} y0={0} y1={16} z0={-161} z1={-145} fills={[K.top, K.front, K.right]} />
          <Box x0={B2[0]} x1={B2[1]} y0={0} y1={16} z0={ZO2 - 161} z1={ZO2 - 145} fills={[K.top, K.front, K.right]} />
          <Box x0={B3[0]} x1={B3[1]} y0={0} y1={16} z0={ZO3 - 161} z1={ZO3 - 145} fills={[K.top, K.front, K.right]} />
          <Box x0={B4[0]} x1={B4[1]} y0={0} y1={16} z0={ZO4 - 161} z1={ZO4 - 145} fills={[K.top, K.front, K.right]} />
          <ScrapChute k={K} />
          {ring1.o > 0.01 ? <g transform={tv(S1, 12, 0)} opacity={ring1.o}><ellipse cx="0" cy="0" rx={ring1.r} ry={ring1.r * 0.34} fill="none" stroke={a} strokeWidth="5" /></g> : null}
          {ring2.o > 0.01 ? <g transform={tv(S2, 12, ZO2)} opacity={ring2.o}><ellipse cx="0" cy="0" rx={ring2.r} ry={ring2.r * 0.34} fill="none" stroke={a} strokeWidth="5" /></g> : null}
          {ring3.o > 0.01 ? <g transform={tv(S3, 12, ZO3)} opacity={ring3.o}><ellipse cx="0" cy="0" rx={ring3.r} ry={ring3.r * 0.34} fill="none" stroke={a} strokeWidth="5" /></g> : null}
          <Ram k={K} x={S1} y={ram1} mode="profile" accent={a} />
          <Ram k={K} x={S2} y={ram2} z={ZO2} mode="features" accent={a} />
          <Ram k={K} x={S3} y={ram3} z={ZO3} mode="bend" accent={a} />
          <Workpiece k={K} t={T} cues={C} total={total} phase={0} accent={a} bendAngle={props.bendAngle} coatColor={props.coatColor} gloss={props.gloss} overlay />
          <Workpiece k={K} t={T} cues={C} total={total} phase={1} accent={a} bendAngle={props.bendAngle} coatColor={props.coatColor} gloss={props.gloss} overlay />
          <Nozzle k={K} x={S4} z={ZO4} y={300} accent={a} />
          <Powder t={T} x={S4} z={ZO4} tipY={286} o={sprayO} density={props.powder} color={shade(props.coatColor || '#3a3d40', props.dark ? 0.55 : 0.34)} />
          <PolishHead k={K} x={polishX} y={polishY} z={ZO4 + 10} o={polishO} spin={T * 2.4} accent={a} />
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
          <g opacity={act3}>
            <line x1={st3[0]} y1={st3[1]} x2={st3[0] + 300} y2={st3[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={st3[0]} y={st3[1] - 14} fill={K.ink}>03 BENDING</text>
            <text x={st3[0]} y={st3[1] + 34} fill={K.ink} fontSize="21" fontWeight="500" letterSpacing="2.6" opacity={0.72 * sub}>CENTRAL FORMING</text>
          </g>
          <g opacity={act4}>
            <line x1={st4[0]} y1={st4[1]} x2={st4[0] + 300} y2={st4[1]} stroke={K.ink} strokeWidth="2.5" />
            <text x={st4[0]} y={st4[1] - 14} fill={K.ink}>04 FINISHING</text>
            <text x={st4[0]} y={st4[1] + 34} fill={K.ink} fontSize="21" fontWeight="500" letterSpacing="2.6" opacity={0.72 * sub}>POWDER COATING + POLISHING</text>
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
          <g opacity={oPunched}>
            <line x1={lblPunched[0]} y1={lblPunched[1]} x2={lblPunched[0]} y2={lblPunched[1] - 96} stroke={a} strokeWidth="2.5" />
            <line x1={lblPunched[0]} y1={lblPunched[1] - 96} x2={lblPunched[0] + 66} y2={lblPunched[1] - 96} stroke={a} strokeWidth="2.5" />
            <text x={lblPunched[0] + 78} y={lblPunched[1] - 87} fill={a}>PUNCHED FLAT PART</text>
          </g>
          <g opacity={oDone}>
            <line x1={lblDone[0]} y1={lblDone[1]} x2={lblDone[0]} y2={lblDone[1] - 96} stroke={a} strokeWidth="2.5" />
            <line x1={lblDone[0] - 66} y1={lblDone[1] - 96} x2={lblDone[0]} y2={lblDone[1] - 96} stroke={a} strokeWidth="2.5" />
            <text x={lblDone[0] - 78} y={lblDone[1] - 87} fill={a} textAnchor="end">FORMED PART · TWO WINGS</text>
          </g>
          <g opacity={oFin}>
            <line x1={lblFin[0]} y1={lblFin[1]} x2={lblFin[0]} y2={lblFin[1] - 118} stroke={a} strokeWidth="2.5" />
            <line x1={lblFin[0] - 66} y1={lblFin[1] - 118} x2={lblFin[0]} y2={lblFin[1] - 118} stroke={a} strokeWidth="2.5" />
            <text x={lblFin[0] - 78} y={lblFin[1] - 109} fill={a} textAnchor="end">COATED + POLISHED · FINISHED</text>
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
  var TweakToggle = window.TweakToggle, TweakColor = window.TweakColor, TweakSlider = window.TweakSlider;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={t.dark ? '#17181a' : '#f3f2f2'}>
        <Piece dark={t.dark} labels={t.labels} accent={t.accent} bendAngle={t.bendAngle} coatColor={t.coatColor} gloss={t.gloss} powder={t.powder} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Scene" />
        <TweakToggle label="Dark plant" value={t.dark} onChange={function (v) { setTweak('dark', v); }} />
        <TweakToggle label="Process labels" value={t.labels} onChange={function (v) { setTweak('labels', v); }} />
        <TweakColor label="Accent" value={t.accent} options={['#ec3013', '#201e1d', '#0f62fe', '#f0a202']} onChange={function (v) { setTweak('accent', v); }} />
        <TweakSection label="Station 03" />
        <TweakSlider label="Bend angle" value={t.bendAngle} min={24} max={54} step={1} unit="°" onChange={function (v) { setTweak('bendAngle', v); }} />
        <TweakSection label="Station 04" />
        <TweakColor label="Coating" value={t.coatColor} options={['#3a3d40', '#1f2124', '#2c3a46', '#5a4f46', '#ec3013']} onChange={function (v) { setTweak('coatColor', v); }} />
        <TweakSlider label="Powder density" value={t.powder} min={8} max={90} step={2} onChange={function (v) { setTweak('powder', v); }} />
        <TweakSlider label="Final gloss" value={t.gloss} min={0} max={1} step={0.05} onChange={function (v) { setTweak('gloss', v); }} />
        <TweakSection label="Authoring" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </div>
  );
}

window.BlankingLine = BlankingLine;
