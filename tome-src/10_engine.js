/* ==== OCCVM SPINE veins.js — spliced from occvm/veins.js. do not edit. ==== */
/* sha256:49518901f7dc */
/* OCCVM 1.1 — the vein generator. One implementation, shared by every conforming tool (OCCVM-L10).
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * Veins are GROWN, not drawn. Both tools drew three displaced cubic beziers and called the result a
 * mineral vein; a bezier is a shape that resembles the outcome, and the eye eventually catches the
 * smooth curvature because nothing in a real dendrite is smooth at every scale.
 *
 * This is diffusion-limited aggregation: a walker starts in the matrix, moves at random, and sticks the
 * instant it touches the aggregate. Growth is dendritic because a tip that protrudes intercepts walkers
 * before they can reach the shielded interior — the screening effect, which nobody has to author. That
 * is the roadmap's discipline for 2.0 arriving early: simulate the process, never the resulting shape.
 *
 * Seeded and pure. Same seed plus same parameters yields the same bytes, which is what the golden set
 * and the injected session seed exist for (SPINE.md section 4).
 */
var OCCVM_VEINS = (function () {
  "use strict";

  /* the PRNG both tools already use, so a seed means the same thing everywhere */
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* grow(): DLA on a lattice, seeded along the left edge so the aggregate crosses the surface the way a
   * vein does rather than radiating from a point.
   *
   * habit is the anisotropy of the walk, and it is a real mineral term: 0 walks isotropically and grows
   * the bushy, equant dendrite of a manganese oxide; 1 weights horizontal steps and draws the structure
   * out into the elongated, fibrous habit of an acicular growth. It changes how the crystal grows, not
   * what is drawn afterwards.
   *
   * Walkers spawn just beyond the frontier rather than at infinity — the standard optimisation, and the
   * reason this finishes in single-digit milliseconds. A walker that strays far outside the frontier is
   * abandoned rather than followed, which is equivalent in the limit and much cheaper.
   */
  function grow(o) {
    var w = o.w | 0, h = o.h | 0;
    var n = o.n | 0;
    var habit = Math.max(0, Math.min(1, o.habit === undefined ? 0.55 : o.habit));
    var rnd = mulberry32(o.seed >>> 0);

    var occ = new Uint8Array(w * h);
    var segs = [];
    var i, j, y, x;

    /* Seeds are a handful of scattered points, not the whole edge. An edge seed grows a comb — every
       column starts at once and nothing competes — where scattered nuclei compete for the same walkers
       and screen each other, which is what produces separate dendrites with clear matrix between them.
       They are scattered across the whole surface, not banked against one edge: a vein layer that fills
       half the page and stops is a gradient, and the eye reads a gradient as a mistake. */
    var nuclei = 4 + ((rnd() * 4) | 0);
    var seeds = [], sites = [];
    for (i = 0; i < nuclei; i++) {
      x = 1 + ((rnd() * (w - 3)) | 0);
      y = ((rnd() * h) | 0);
      occ[y * w + x] = 1;
      seeds.push(x, y);
      sites.push(y * w + x);
    }

    var maxSteps = h * 2 + 60;
    /* horizontal step probability: .5 is isotropic, rising to .82 at full habit */
    var pH = 0.5 + habit * 0.32;

    for (i = 0; i < n; i++) {
      /* Spawn across the whole occupied extent rather than only at the leading edge, so the interior
         keeps thickening while the tips advance. Launching only at the frontier grows one filament and
         leaves the body starved. */
      /* Launch near the aggregate, not at infinity. A walker released far out in the matrix spends most
         of its life wandering empty lattice; released on a small circle around a site already occupied,
         it arrives at the cluster with the same isotropic distribution — this is the standard DLA launch
         radius, and it is why the generator finishes in single-digit milliseconds instead of twenty. */
      var site = sites[(rnd() * sites.length) | 0];
      var ang = rnd() * 6.283185307, rad = 4 + rnd() * 7;
      x = ((site % w) + Math.cos(ang) * rad) | 0;
      y = (((site / w) | 0) + Math.sin(ang) * rad) | 0;
      if (x < 1) x = 1; else if (x > w - 2) x = w - 2;
      if (y < 0) y += h; else if (y >= h) y -= h;
      var stuck = -1;

      for (var st = 0; st < maxSteps; st++) {
        var k = y * w + x;
        if (occ[k]) break;                                   /* landed inside: discard */
        /* Moore neighbourhood: a walker sticks on diagonal contact too, so the aggregate grows at 45
           degrees as readily as along the axes. Von Neumann sticking is what makes a lattice DLA look
           like circuit routing rather than a mineral. */
        var hit = -1;
        for (j = 0; j < 8 && hit < 0; j++) {
          var dx = (j === 0 || j === 3 || j === 5) ? -1 : (j === 2 || j === 4 || j === 7) ? 1 : 0;
          var dy = (j === 0 || j === 1 || j === 2) ? -1 : (j === 5 || j === 6 || j === 7) ? 1 : 0;
          var nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w) continue;
          if (ny < 0) ny = h - 1; else if (ny >= h) ny = 0;
          if (occ[ny * w + nx]) hit = ny * w + nx;
        }
        if (hit >= 0) { stuck = hit; break; }

        if (rnd() < pH) x += rnd() < 0.5 ? -1 : 1;
        else y += rnd() < 0.5 ? -1 : 1;

        if (y < 0) y = h - 1; else if (y >= h) y = 0;        /* the surface wraps vertically */
        if (x < 1) x = 1; else if (x >= w - 1) x = w - 2;
      }
      if (stuck < 0) continue;

      var kk = y * w + x;
      if (occ[kk]) continue;
      occ[kk] = 1;
      sites.push(kk);
      segs.push(stuck % w, (stuck / w) | 0, x, y);
    }
    return { segs: segs, w: w, h: h, nuclei: seeds };
  }

  /* svg(): trace the aggregate. Every stroke is a straight segment between a particle and the particle
   * it stuck to — the record of how it grew. No curve is fitted over it, because a fitted curve is the
   * bezier coming back in through the renderer.
   */
  function paths(g, o) {
    var sc = o.scale || 1, jx = o.ox || 0, jy = o.oy || 0;
    /* The lattice is a discretisation of the walk, not a fact about the mineral, so the trace carries a
       deterministic sub-cell offset per particle. It breaks the grid without fitting a curve over the
       growth — a fitted curve is the bezier coming back in through the renderer. */
    var jit = o.jitter === undefined ? 0.42 : o.jitter;
    var r = mulberry32((o.seed >>> 0) ^ 0x5bf03635);
    var d = [], i;
    for (i = 0; i < g.segs.length; i += 4) {
      var ay = g.segs[i + 1], by = g.segs[i + 3];
      if (Math.abs(ay - by) > g.h * 0.5) continue;           /* a wrap, not a real neighbour */
      var ax = (g.segs[i] + (r() - 0.5) * jit) * sc + jx;
      var bx = (g.segs[i + 2] + (r() - 0.5) * jit) * sc + jx;
      var ay2 = (ay + (r() - 0.5) * jit) * sc + jy;
      var by2 = (by + (r() - 0.5) * jit) * sc + jy;
      /* Integer coordinates. At the scale these are drawn, a tenth of a pixel is below the stroke width
         and costs a byte per number across thousands of segments. */
      d.push("M" + (ax | 0) + " " + (ay2 | 0) + "L" + (bx | 0) + " " + (by2 | 0));
    }
    return d.join("");
  }

  /* field(): the whole vein layer as a data URI, so both tools share the assembly and not just the
   * growth. Two strokes over one path — a wide deep one and a fine bright one offset by nothing — read
   * as a vein with depth rather than a wire.
   *
   * density is the walker budget as a fraction of the lattice; habit is the growth anisotropy. Both are
   * read from --vein-density and --vein-habit by the caller, so a tool can tune its own surface without
   * a second generator.
   *
   * RETURNS RAW SVG. The caller must encodeURIComponent it before putting it in a url(). Both the
   * fragment reference and the colours carry a literal "#", and a "#" left raw inside a data: URI ends
   * the URI at a fragment — while pre-encoding it to %23 leaves the parsed SVG holding the two literal
   * characters "%23", so href="%23v" resolves to nothing and the layer renders empty. That failure is
   * invisible to a token diff and to any check that only looks for the string: it has to be looked at.
   */
  function field(o) {
    var w = o.w || 110, h = o.h || 70;
    var density = o.density === undefined ? 0.35 : Math.max(0.05, Math.min(1, o.density));
    var g = grow({ w: w, h: h, n: Math.round(w * h * density), habit: o.habit, seed: o.seed });
    if (g.segs.length < 8) throw new Error("occvm veins: aggregate did not grow");
    var d = paths(g, { scale: (o.viewW || 1200) / w, seed: o.seed });
    /* The geometry is written once and referenced twice. Serialising the same few tens of kilobytes of
       path data a second time is the single largest cost in producing this layer. */
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + (o.viewW || 1200) + " " +
      (o.viewH || Math.round((o.viewW || 1200) * h / w)) + "' preserveAspectRatio='none'>" +
      "<defs><path id='v' d='" + d + "'/></defs>" +
      "<g fill='none' stroke-linecap='round'>" +
      "<use href='#v' stroke='" + (o.lo || "#1c6a45") + "' stroke-width='" + (o.wide || 4.5) + "' opacity='.5'/>" +
      "<use href='#v' stroke='" + (o.hi || "#3fbf7e") + "' stroke-width='" + (o.fine || 1.3) + "' opacity='.85'/>" +
      "</g></svg>";
    return { svg: svg, particles: g.segs.length / 4 };
  }

  return { grow: grow, paths: paths, field: field, mulberry32: mulberry32 };
})();
if (typeof module !== "undefined") module.exports = OCCVM_VEINS;
/* ==== END OCCVM veins.js ==== */

/* ==== OCCVM SPINE sundial.js — spliced from occvm/sundial.js. do not edit. ==== */
/* sha256:422bb07f7e07 */
/* OCCVM 1.2 — the sundial. One light, shared by every conforming tool (OCCVM-L3).
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * Before 1.2 each tool carried its own. They agreed on the screen convention and on nothing downstream:
 * different solar algorithms, --elev on two scales, --night a step in one tool and a ramp in the other,
 * --glow a calc() in one and a scalar in the other, and a light vector that kept tracking the sun 39
 * degrees below the horizon. Those were OCCVM-D2, D8, D9 and D10, and one implementation closes all four.
 *
 * The split is deliberate and is registered in SPINE.md section 8: POSITION is the full NOAA algorithm,
 * which BTC carried; RESPONSE is the derivation of surface behaviour from it, which Rhyme carried. Each
 * tool kept its better half and neither keeps a second copy.
 *
 * Everything here is pure: same instant plus same place yields the same bytes. The golden set depends on
 * it (occvm/golden), and so does anything 2.0 resolves at sunTick.
 */
var OCCVM_SUN = (function () {
  "use strict";
  var RAD = Math.PI / 180;
  var DAYTON = { lat: 39.7589, lon: -84.1916, name: "Dayton" };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---- position: NOAA general solar position, evaluated in UTC ------------------------------------
   * Returns elevation in degrees and azimuth in degrees clockwise from north. UTC, not the local clock,
   * so the reading does not move with the viewer's timezone database.
   */
  function position(lat, lon, date) {
    var jd = date.getTime() / 86400000 + 2440587.5, jc = (jd - 2451545) / 36525;
    var gml = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
    var gma = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
    var ecc = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
    var ceq = Math.sin(gma * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
            + Math.sin(2 * gma * RAD) * (0.019993 - 0.000101 * jc)
            + Math.sin(3 * gma * RAD) * 0.000289;
    var app = gml + ceq - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * jc) * RAD);
    var mo = 23 + (26 + ((21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813)))) / 60) / 60;
    var oc = mo + 0.00256 * Math.cos((125.04 - 1934.136 * jc) * RAD);
    var dec = Math.asin(Math.sin(oc * RAD) * Math.sin(app * RAD));
    var y = Math.pow(Math.tan(oc / 2 * RAD), 2);
    var eqt = 4 * (y * Math.sin(2 * gml * RAD) - 2 * ecc * Math.sin(gma * RAD)
            + 4 * ecc * y * Math.sin(gma * RAD) * Math.cos(2 * gml * RAD)
            - 0.5 * y * y * Math.sin(4 * gml * RAD) - 1.25 * ecc * ecc * Math.sin(2 * gma * RAD)) / RAD;
    var minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    var tst = (minutes + eqt + 4 * lon + 1440) % 1440;
    var ha = (tst / 4 < 0) ? tst / 4 + 180 : tst / 4 - 180;
    var cz = Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha * RAD);
    var zen = Math.acos(clamp(cz, -1, 1));
    var az = Math.acos(clamp(((Math.sin(lat * RAD) * Math.cos(zen)) - Math.sin(dec)) / (Math.cos(lat * RAD) * Math.sin(zen)), -1, 1)) / RAD;
    az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
    return { elev: 90 - zen / RAD, az: az };
  }

  /* ---- response: the surface behaviour the position produces -------------------------------------- */

  function mix(p, q, t) { return [0, 1, 2].map(function (i) { return Math.round(p[i] + (q[i] - p[i]) * t); }); }
  function hex(c) { return "#" + c.map(function (v) { return clamp(v, 0, 255).toString(16).padStart(2, "0"); }).join(""); }

  /* The noon anchors SPINE.md OCCVM-L1 records, and the two ends the day carries them toward. */
  var SUB = [27, 26, 34], SUB_DUSK = [40, 28, 30], SUB_NIGHT = [14, 14, 26];
  var BONE = [236, 227, 208], BONE_DUSK = [244, 214, 170], BONE_NIGHT = [204, 208, 224];
  var EDGE = [11, 10, 16];

  function respond(p) {
    var elev = p.elev, az = p.az;

    /* OCCVM-L3: below the horizon the vector does not keep tracking a sun nobody can see. Past civil
       twilight it resolves to neutral overhead. BTC tracked the sun to -39 degrees and beyond (D9). */
    var up = elev > -6;
    var lx = up ? Math.sin(az * RAD) : 0;
    var ly = up ? -Math.cos(az * RAD) : 1;

    var e = clamp(Math.sin(Math.max(0, elev) * RAD) * 1.25, 0, 1);

    /* OCCVM-L9: night is a continuous quantity, 0 at -2 degrees to 1 at -10. A step cannot express the
       dusk stages 1.7 refines this into. */
    var night = clamp((-elev - 2) / 8, 0, 1);
    var twilight = 1 - clamp(Math.abs(elev) / 14, 0, 1);
    var dusk = twilight * (1 - night);

    /* The night floor lives in ambient, not in elevation: a bevel stays legible after dark because
       ambient is 0.53 there, not because elevation is pretended to be 0.15 (D2). */
    var amb = 0.45 + 0.55 * e * (1 - night) + 0.18 * night;
    var rake = elev > 0 ? Math.min(22, 4 + 14 / Math.max(0.25, Math.tan(elev * RAD)) / 6) : 4;

    var sub = mix(mix(SUB, SUB_DUSK, dusk), SUB_NIGHT, night);
    var bone = mix(mix(BONE, BONE_DUSK, dusk), BONE_NIGHT, night);

    /* OCCVM-L1: a derived token derives with its whole family. --bone-lo is --bone carried a quarter of
       the way to --edge, so the pair cannot separate again (D10). At the noon anchor that reads #b4ada0
       against the previously authored #b7ad9c — at most 4/255 in any channel, and the price of the
       relationship being structural instead of remembered. */
    var boneLo = mix(bone, EDGE, 0.25);

    return {
      "--lx": lx.toFixed(3),
      "--ly": ly.toFixed(3),
      "--elev": e.toFixed(3),
      "--night": night.toFixed(3),
      "--amb": amb.toFixed(3),
      "--rake": rake.toFixed(1) + "px",
      "--sheen": (0.25 + 0.55 * e * (1 - night)).toFixed(2),
      "--hi-a": (0.30 * e + 0.06).toFixed(3),
      "--cut-a": (0.40 * e + 0.06).toFixed(3),
      "--shade-a": (0.45 + 0.3 * e).toFixed(3),
      /* OCCVM-L9: the ink bloom, a resolved scalar and never a calc(), so a law can read it (D8). */
      "--glow": (0.45 + 0.25 * (1 - e) + 0.30 * night).toFixed(2),
      "--lxpx": (lx * 0.9).toFixed(2) + "px",
      "--lypx": (ly * 0.9).toFixed(2) + "px",
      "--nglow": (6 * night).toFixed(1) + "px",
      "--nglow-s": (3 * night).toFixed(1) + "px",
      "--sub": hex(sub),
      "--sub-hi": hex(mix(sub, [255, 255, 255], 0.14 * (0.5 + e))),
      "--sub-lo": hex(mix(sub, [0, 0, 0], 0.42)),
      "--bone": hex(bone),
      "--bone-lo": hex(boneLo)
    };
  }

  var DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  /* tick(): position, respond, write. Returns the reading for a tool's own display. */
  function tick(el, loc, date) {
    var place = (loc && isFinite(loc.lat)) ? loc : DAYTON;
    var p = position(place.lat, place.lon, date || new Date());
    var t = respond(p);
    if (el && el.style) for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) el.style.setProperty(k, t[k]);
    return {
      elev: p.elev, az: p.az, tokens: t,
      dir: DIRS[Math.round(p.az / 45) % 8],
      night: parseFloat(t["--night"]),
      lx: parseFloat(t["--lx"]), ly: parseFloat(t["--ly"]),
      e: parseFloat(t["--elev"]),
      name: place.name || "here"
    };
  }

  return { position: position, respond: respond, tick: tick, DAYTON: DAYTON, DIRS: DIRS };
})();
/* ==== END OCCVM sundial.js ==== */


/* ---------- engine 2.0 ---------- */
let OVERRIDES = {};
const E2 = (() => {
  let DICT = null, COMMON = new Map(), INDEX = null, status = "idle", error = "";
  const CURATED = new Set(LEXICON);
  let OWN = new Set();                       // the tier you write in: bank + every shelved draft
  function setOwn(words) { OWN = new Set(words.map(clean).filter(w => w.length > 1)); POOL = null; }
  const RED = new Set(["AH","IH","EH","AE","AA","UH"]);
  const clean = raw => raw.toLowerCase().replace(/[^a-z']/g, "");
  function parseCompact(str) {
    const [vs, coda] = str.split("|")[0].split("-");
    const sylls = vs.split(".").map(t => ({ v: t.replace(/\d/, ""), s: +t.slice(-1), c: "" }));
    sylls[sylls.length-1].c = coda || "";
    sylls.forEach(s => { s.reduced = s.v === "AH" && s.s === 0; });
    return sylls;
  }
  function parseOne(str) {
    const [vs, coda] = str.split("-");
    const sylls = vs.split(".").map(t => ({ v: t.replace(/\d/, ""), s: +t.slice(-1), c: "" }));
    sylls[sylls.length-1].c = coda || "";
    sylls.forEach(s => { s.reduced = s.v === "AH" && s.s === 0; });
    return sylls;
  }
  /* every read the dictionary carries for a word, primary first; [] if unknown */
  function variants(raw) {
    const w = clean(raw);
    if (!DICT || !Object.hasOwn(DICT, w)) return [];
    return DICT[w].split("|").map(parseOne);
  }
  function pronounce(raw) {
    const w = clean(raw);
    if (!w) return { sylls: [], source: "none" };
    const ov = Object.hasOwn(OVERRIDES, w) ? OVERRIDES[w] : null;
    const caps = raw.replace(/[^A-Za-z]/g, "");
    const initialism = caps && caps === caps.toUpperCase() && caps.length <= 4 &&
      (!/[AEIOU]/.test(caps) || !(DICT && Object.hasOwn(DICT, w)));
    let sylls, source;
    if (initialism) {
      sylls = caps.toLowerCase().split("").map(ch => { const [v, c] = LETTERS[ch] || ["AH",""]; return { v, c, s: 1 }; });
      source = "initialism";
    } else if (Object.hasOwn(EXCEPTIONS, w)) {
      /* a trailing digit on the vowel carries CMUdict-style stress (AH0, EY2); no digit means primary, so untagged entries keep their old reading */
      sylls = EXCEPTIONS[w].map(t => {
        const [raw, c] = t.split("-"), tagged = /\d$/.test(raw);
        return { v: tagged ? raw.slice(0, -1) : raw, c: c || "", s: tagged ? +raw.slice(-1) : 1 };
      });
      source = "exception";
    } else if (DICT && Object.hasOwn(DICT, w)) { sylls = parseCompact(DICT[w]); source = "cmu"; }
    else { sylls = g2p(raw).map(s => ({ ...s, s: s.reduced ? 0 : 1 })); source = "rule"; }
    if (ov && sylls.length) {
      if (typeof ov === "string") { sylls[sylls.length-1].v = ov; sylls[sylls.length-1].reduced = false; }
      else {
        const n = Math.min(ov.vowels.length, sylls.length);
        for (let i = 0; i < n; i++) {
          const t = sylls[sylls.length-n+i];
          t.v = ov.vowels[i]; t.reduced = false;
          if (ov.stress && ov.stress[i] != null) t.s = ov.stress[i];
        }
        if (ov.coda != null) sylls[sylls.length-1].c = ov.coda;
      }
      source = "override";
    }
    return { sylls, source };
  }
  function skeleton(text, depth = 1, anchor = "count") {
    const words = text.trim().split(/\s+/).filter(Boolean);
    let sylls = [], source = "none";
    for (let i = words.length - 1; i >= 0 && sylls.length < depth + 4; i--) {
      const p = pronounce(words[i]);
      if (i === words.length - 1) source = p.source;
      sylls = [...p.sylls, ...sylls];
    }
    let tail;
    if (anchor === "stress") {
      let k = sylls.length - 1;
      while (k > 0 && !(sylls[k].s > 0)) k--;
      tail = sylls.slice(Math.min(k, sylls.length - depth));
    } else tail = sylls.slice(-depth);
    const last = tail[tail.length-1];
    return { vowels: tail.map(s => s.v), stress: tail.map(s => s.s),
      coda: last ? last.c : "", reduced: last ? !!last.reduced : false,
      overridden: source === "override", source };
  }
  function tailOf(sylls, depth, anchor) {
    let tail;
    if (anchor === "stress") { let k = sylls.length - 1; while (k > 0 && !(sylls[k].s > 0)) k--; tail = sylls.slice(Math.min(k, sylls.length - depth)); }
    else tail = sylls.slice(-depth);
    const last = tail[tail.length-1];
    return { vowels: tail.map(s => s.v), stress: tail.map(s => s.s), coda: last ? last.c : "", reduced: last ? !!last.reduced : false };
  }
  function compare(sa, sb, same) {
    if (!sa.vowels.length || !sb.vowels.length) return "none";
    const n = Math.min(sa.vowels.length, sb.vowels.length);
    const la = sa.vowels.slice(-n), lb = sb.vowels.slice(-n);
    const exact = la.every((v, i) => v === lb[i]) && sa.vowels.length === sb.vowels.length;
    if (!exact) {
      const lastStrict = la[n-1] === lb[n-1];
      if (lastStrict && n > 1 && la.every((v, i) => v === lb[i] || (RED.has(v) && RED.has(lb[i])))) return "loose";
      if (!lastStrict && (sa.reduced || sb.reduced) && RED.has(la[n-1]) && RED.has(lb[n-1])) return "loose";
      return lastStrict ? "shallow" : "none";
    }
    if (same) return "identical";
    return sa.coda === sb.coda ? "perfect" : "slant";
  }
  function classify(a, b, depth = 1, anchor = "count") {
    const sa = skeleton(a, depth, anchor), sb = skeleton(b, depth, anchor);
    if (!sa.vowels.length || !sb.vowels.length) return { kind: "none", sa, sb };
    const n = Math.min(sa.vowels.length, sb.vowels.length);
    const la = sa.vowels.slice(-n), lb = sb.vowels.slice(-n);
    const exact = la.every((v, i) => v === lb[i]) && sa.vowels.length === sb.vowels.length;
    if (!exact) {
      const lastStrict = la[n-1] === lb[n-1];
      const loose = lastStrict && n > 1 && la.every((v, i) => v === lb[i] || (RED.has(v) && RED.has(lb[i])));
      if (loose) return { kind: "loose", sa, sb };
      if (!lastStrict && (sa.reduced || sb.reduced) && RED.has(la[n-1]) && RED.has(lb[n-1])) return { kind: "loose", sa, sb };
      return { kind: lastStrict ? "shallow" : "none", sa, sb };
    }
    if (clean(a) === clean(b)) return { kind: "identical", sa, sb };
    return { kind: sa.coda === sb.coda ? "perfect" : "slant", sa, sb };
  }
  function buildIndex() {
    INDEX = new Map();
    const push = (key, w) => { const l = INDEX.get(key); if (l) l.push(w); else INDEX.set(key, [w]); };
    for (const w of Object.keys(DICT)) {
      if (w.length < 2 || w.includes("'")) continue;
      for (const s of DICT[w].split("|").map(parseOne)) {
        for (let d = 1; d <= Math.min(3, s.length); d++) push(d + ":" + s.slice(-d).map(x => x.v).join("|"), w);
        let k = s.length - 1; while (k > 0 && !(s[k].s > 0)) k--;
        push("S:" + s.slice(k).map(x => x.v).join("|"), w);
      }
    }
  }
  function lookup(query, depth = 1, extra = [], anchor = "stress") {
    const sq = skeleton(query, depth, anchor);
    if (!sq.vowels.length) return { skeleton: sq, reads: [], perfect: [], slant: [], loose: [] };
    const q = clean(query);
    /* a single word with alternate dictionary reads searches on all of them; a phrase or an overridden word searches on its one read */
    const single = !query.trim().includes(" ") && !Object.hasOwn(OVERRIDES, q);
    const qreads = (single && variants(q).length > 1 ? variants(q) : [pronounce(query.trim().split(/\s+/).pop()).sylls]).map(r => tailOf(r, depth, anchor)).filter(t => t.vowels.length);
    const sqs = single && variants(q).length > 1 ? qreads : [sq];
    let cand;
    if (DICT) {
      if (!INDEX) buildIndex();
      cand = new Set([...extra.map(clean), ...OWN]);
      for (const t of sqs) for (const w of INDEX.get((anchor === "stress" ? "S:" : depth + ":") + t.vowels.join("|")) || []) cand.add(w);
    } else cand = new Set([...LEXICON, ...extra.map(clean), ...OWN]);
    const perfect = [], slant = [], loose = [];
    const ORDER = { perfect: 3, slant: 2, loose: 1 };
    for (const w of cand) {
      if (w === q) continue;
      let best = "none";
      const reads = Object.hasOwn(OVERRIDES, w) ? [pronounce(w).sylls] : (variants(w).length ? variants(w) : [pronounce(w).sylls]);
      for (const t of sqs) for (const r of reads) { const k = compare(t, tailOf(r, t.vowels.length, anchor), false); if ((ORDER[k] || 0) > (ORDER[best] || 0)) best = k; }
      const item = { word: w, tier: OWN.has(w) ? 0 : CURATED.has(w) ? 1 : COMMON.has(w) ? 2 : 3, rank: COMMON.get(w) ?? 1e9 };
      if (best === "perfect") perfect.push(item);
      else if (best === "slant") slant.push(item);
      else if (best === "loose") loose.push(item);
    }
    const rank = (a, b) => a.tier - b.tier || a.rank - b.rank || a.word.localeCompare(b.word);
    return { skeleton: sq, reads: sqs.length > 1 ? sqs : [], perfect: perfect.sort(rank), slant: slant.sort(rank), loose: loose.sort(rank) };
  }
  /* mosaic: two-word tails whose joined skeleton matches a multi-syllable query.
   * pool = your words + curated + the top of the frequency list, so the pairs are ones you'd write. */
  let POOL = null;
  function pool() {
    if (POOL) return POOL;
    const words = new Set([...OWN, ...CURATED]);
    for (const [w, r] of COMMON) if (r >= 160 && r < 6000 && w.length > 2) words.add(w);   /* skip the function-word head of the list */
    const byFull = new Map(), byTail = new Map();
    for (const w of words) {
      const reads = variants(w).length ? variants(w) : [pronounce(w).sylls];
      for (const s of reads) {
        if (!s.length || s.length > 3) continue;
        const full = s.map(x => x.v).join("|");
        if (!byFull.has(full)) byFull.set(full, []); byFull.get(full).push({ w, s });
        for (let d = 1; d <= s.length; d++) { const k = d + ":" + s.slice(-d).map(x => x.v).join("|"); if (!byTail.has(k)) byTail.set(k, []); byTail.get(k).push({ w, s }); }
      }
    }
    return POOL = { byFull, byTail };
  }
  function mosaic(query, depth = 2, limit = 40) {
    const sq = skeleton(query, depth, "count");
    const n = sq.vowels.length; if (n < 2) return [];
    const { byFull, byTail } = pool();
    const q = clean(query), out = [], seen = new Set();
    const used = new Set(query.trim().split(/\s+/).map(clean));
    const tierOf = w => OWN.has(w) ? 0 : CURATED.has(w) ? 1 : 2;
    for (let k = 1; k < n; k++) {
      const heads = byTail.get(k + ":" + sq.vowels.slice(0, k).join("|")) || [];
      const tails = byFull.get(sq.vowels.slice(k).join("|")) || [];
      for (const h of heads) for (const t of tails) {
        if (h.w === t.w || used.has(h.w) || used.has(t.w)) continue;
        const key = h.w + " " + t.w; if (seen.has(key)) continue; seen.add(key);
        const kind = compare(sq, tailOf([...h.s.slice(-k), ...t.s], n, "count"), false);
        if (kind === "perfect" || kind === "slant") out.push({ phrase: key, kind, tier: tierOf(h.w) + tierOf(t.w), rank: (COMMON.get(h.w) ?? 9e4) + (COMMON.get(t.w) ?? 9e4) });
      }
    }
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "perfect" ? -1 : 1) || a.tier - b.tier || a.rank - b.rank);
    return out.slice(0, limit);
  }
  function graph(bars, { window = 8 } = {}) {
    const filled = bars.filter(Boolean);
    const edges = [];
    const tailOf = w => skeleton(w, 1, "stress");
    const link = (a, b, wa, wb, scope) => {
      const ta = tailOf(wa), tb = tailOf(wb);
      if (!ta.vowels.length || !tb.vowels.length) return;
      const depth = Math.max(ta.vowels.length, tb.vowels.length);
      const r = classify(wa, wb, depth, "stress");
      if (r.kind === "perfect" || r.kind === "slant" || r.kind === "loose")
        edges.push({ a, b, kind: r.kind, depth: Math.min(ta.vowels.length, tb.vowels.length), words: [wa, wb], scope });
    };
    for (let i = 0; i < filled.length; i++) {
      const bi = filled[i];
      for (let j = Math.max(0, i - window); j < i; j++) link(filled[j].i, bi.i, filled[j].end.word, bi.end.word, "terminal");
      const inner = bi.field.slice(0, -1).filter(w => w.sylls.some(s => s.s === 1) && !FILLERS.has(w.word.toLowerCase()) && w.word.replace(/[^a-zA-Z]/g, "").length > 2);
      for (const w of inner) {
        const word = w.word.replace(/[^a-zA-Z']/g, "");
        link(bi.i, bi.i, word, bi.end.word, "internal");
        if (i > 0) link(filled[i-1].i, bi.i, filled[i-1].end.word, word, "internal");
      }
    }
    return edges;
  }
  function reading(draft, { pop = "rap" } = {}) {
    const limit = pop === "rap" ? 3 : 6;
    const bars = draft.split("\n").map((ln, i) => {
      const text = ln.trim();
      if (!text) return null;
      const words = text.split(/\s+/);
      /* `s` is lexical stress, straight from the dictionary — rhyme and stress-anchoring read it.
       * `m` is metrical stress: the same value, except a function word demotes to 0 the way it
       * does in a spoken line. Meter scoring reads `m`; nothing that rhymes should touch it. */
      const field = words.map(w => {
        const p = pronounce(w), demoted = FUNCTION_WORDS.has(clean(w));
        return { word: w, source: p.source, sylls: p.sylls.map(s => ({ v: s.v, s: s.s, c: s.c, m: demoted ? 0 : s.s })) };
      });
      const last = words[words.length-1].replace(/[^a-zA-Z']/g, "");
      const end = skeleton(last, 1);
      return { i, text, field, syllables: field.reduce((n, w) => n + w.sylls.length, 0),
        end: { word: last, v: end.vowels[0] || null, coda: end.coda, source: end.source, overridden: end.overridden },
        filler: FILLERS.has(last.toLowerCase()) };
    });
    const runs = []; let cur = null;
    bars.forEach(b => {
      if (!b || !b.end.v) { cur = null; return; }
      if (cur && cur.v === b.end.v) { cur.len++; cur.bars.push(b.i); }
      else { cur = { v: b.end.v, len: 1, bars: [b.i] }; runs.push(cur); }
    });
    const flagged = new Set();
    runs.filter(r => r.len > limit).forEach(r => r.bars.slice(limit).forEach(i => flagged.add(i)));
    const filled = bars.filter(Boolean);
    let terminal = false;
    if (filled.length >= 6) {
      const lastB = filled[filled.length-1], priors = filled.slice(0, -1).slice(-8);
      terminal = lastB.filler || !priors.some(b => b.end.v === lastB.end.v);
    }
    const edges = graph(bars, { window: 8 });
    /* scheme: union-find over terminal edges (perfect + slant); letters in order of first appearance */
    const parent = new Map(filled.map(b => [b.i, b.i]));
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    edges.filter(e => e.scope === "terminal" && e.kind !== "loose").forEach(e => parent.set(find(e.a), find(e.b)));
    const letters = new Map(); let next = 0;
    filled.forEach(b => { const r = find(b.i); if (!letters.has(r)) letters.set(r, String.fromCharCode(65 + (next++ % 26))); b.scheme = letters.get(r); });
    /* meter drift: a bar that sits ±3 syllables off the median of its neighbours */
    filled.forEach((b, k) => {
      const nb = filled.slice(Math.max(0, k - 2), k).concat(filled.slice(k + 1, k + 3)).map(x => x.syllables).sort((p, q) => p - q);
      if (nb.length < 2) { b.drift = 0; return; }
      const med = nb.length % 2 ? nb[(nb.length - 1) / 2] : (nb[nb.length / 2 - 1] + nb[nb.length / 2]) / 2;
      const d = Math.round(b.syllables - med); b.drift = Math.abs(d) >= 3 ? d : 0;
    });
    return { v: 2, pop, limit, bars, runs, edges, flagged: [...flagged], maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0), terminal };
  }
  /* ---------- meter: score written bars against the template library ----------
   * Diagnostic only — this reads what's there and ranks how it sits, it does not prescribe.
   * Scores the METRICAL pattern (function words demoted), never the lexical one: a line's
   * meter is about which syllables take a beat when spoken, not how each word reads alone.
   *
   * Two components, reported separately because they fail differently and the difference is
   * the useful part: `length` is how close the bar's syllable count sits to the template's,
   * `stress` is how often an accent lands where the template puts one. A bar can be the right
   * length with the accents in the wrong places, or accented right but four syllables short. */
  function fitTemplate(pattern, tpl) {
    const n = Math.min(pattern.length, tpl.stress.length);
    let agree = 0;
    for (let i = 0; i < n; i++) if ((pattern[i] > 0) === (tpl.stress[i] > 0)) agree++;
    const stress = n ? agree / n : 0;
    const length = Math.max(0, 1 - Math.abs(pattern.length - tpl.syllables) / tpl.syllables);
    return { stress, length, score: stress * length };
  }
  function metrical(bar) { return bar.field.flatMap(w => w.sylls.map(s => s.m)); }
  function meter(read) {
    const filled = (read.bars || []).filter(Boolean);
    const rows = filled.map(b => {
      const pattern = metrical(b);
      const all = TEMPLATES.map(t => ({ name: t.name, ...fitTemplate(pattern, t) })).sort((x, y) => y.score - x.score);
      return { i: b.i, text: b.text, syllables: pattern.length, pattern, all, best: all[0] };
    });
    const ranked = TEMPLATES.map(t => {
      const scores = rows.map(r => r.all.find(x => x.name === t.name).score);
      return { name: t.name, syllables: t.syllables, mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0 };
    }).sort((a, b) => b.mean - a.mean);
    const best = ranked[0] || null;
    /* weakest fits under the winning template — ranked, not thresholded, so no invented cutoff
     * decides what counts as "wrong"; the reader sees the spread and judges. */
    const weakest = best
      ? rows.map(r => ({ i: r.i, text: r.text, syllables: r.syllables, ...r.all.find(x => x.name === best.name) }))
          .sort((a, b) => a.score - b.score)
      : [];
    return { rows, ranked, best, weakest, bars: rows.length };
  }
  /* ---------- tempo grid ----------
   * Arithmetic, not a model. BPM and time signature give a real slot count per bar; nothing
   * here listens to anything or knows how a line is actually performed.
   *
   * `feel` changes how a beat subdivides: straight and swing both cut it in four (swing shifts
   * where the offbeats sit in time, not how many there are), triplet cuts it in three. */
  const SUBDIVISION = { straight: 4, swing: 4, triplet: 3 };
  function grid(bpm = 90, timeSig = "4/4", feel = "straight") {
    const beats = Math.max(1, parseInt(String(timeSig).split("/")[0], 10) || 4);
    const per = SUBDIVISION[feel] || 4;
    const beatMs = 60000 / Math.max(1, bpm);
    return { bpm, timeSig, feel, beats, subdivision: per, slotsPerBar: beats * per, slotMs: beatMs / per, beatMs };
  }
  /* How a written bar sits against that grid.
   *
   * `room` is syllable count against available slots — under, exact, or over. Over doesn't mean
   * wrong, it means the line needs finer subdivision than the feel you set.
   *
   * `rate` is the physical one and the most useful: syllables per second required to fit this
   * bar at this tempo. That's checkable against a mouth.
   *
   * Accents are reported as a count and a per-beat density, NOT scored against the beat count.
   * Rap routinely puts several accents in a beat; calling that crowded would flag every bar
   * written. The draft's own spread is the reference — there is no target here to miss. */
  function pace(bar, g) {
    const sylls = bar.field.reduce((n, w) => n + w.sylls.length, 0);
    const accents = bar.field.reduce((n, w) => n + w.sylls.filter(s => s.m > 0).length, 0);
    const slotDelta = sylls - g.slotsPerBar;
    const barSeconds = (g.beatMs * g.beats) / 1000;
    return {
      i: bar.i, syllables: sylls, accents,
      slots: g.slotsPerBar, beats: g.beats, slotDelta,
      room: slotDelta === 0 ? "exact" : slotDelta > 0 ? "over" : "under",
      rate: sylls / barSeconds,
      accentsPerBeat: accents / g.beats,
    };
  }
  function tempo(read, opts = {}) {
    const g = grid(opts.bpm, opts.timeSig, opts.feel);
    return { grid: g, bars: (read.bars || []).filter(Boolean).map(b => pace(b, g)) };
  }
  async function load(onChange) {
    if (status === "ready" || status === "loading") return;
    status = "loading"; error = ""; onChange && onChange(status);
    try {
      const [d, f] = await Promise.all([
        fetch("./cmu_skel.json").then(r => { if (!r.ok) throw new Error("cmu_skel.json " + r.status); return r.json(); }),
        fetch("./subtlex_rank.txt").then(r => r.ok ? r.text() : fetch("./google10k.txt").then(r2 => r2.ok ? r2.text() : "")).catch(() => ""),
      ]);
      DICT = d; INDEX = null; POOL = null;
      COMMON = new Map(f.split("\n").filter(Boolean).map((w, i) => [w.trim(), i]));
      status = "ready";
    } catch (e) { status = "error"; error = String(e.message || e); }
    onChange && onChange(status);
  }
  return { pronounce, variants, skeleton, classify, lookup, mosaic, reading, meter, grid, tempo, load, setOwn,
    ready: () => status === "ready", status: () => status, error: () => error,
    size: () => DICT ? Object.keys(DICT).length : LEXICON.length };
})();

/* ---------- storage v2, with a one-time carry from the metro keys ---------- */
const STORE = {
  get(k, fb) { try { const r = localStorage.getItem("tome:" + k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem("tome:" + k, JSON.stringify(v)); } catch (e) {} },
  migrate() {
    try {
      if (localStorage.getItem("tome:migrated")) return false;
      const old = k => { const r = localStorage.getItem("ghostcodex:" + k); return r ? JSON.parse(r) : null; };
      const bank = old("bank"), draft = old("draft"), ov = old("overrides"), mp = old("metroprefs");
      if (bank) STORE.set("bank", bank);
      if (draft) STORE.set("shelf", [{ id: "carried", name: "carried draft", text: draft, updated: Date.now() }]);
      if (draft) STORE.set("current", "carried");
      if (ov) STORE.set("overrides", ov);
      if (mp) STORE.set("prefs", { mineral: mp.accent === "slime" ? "malachite" : "amethyst", density: mp.density || "comfy", motion: mp.motion || "on" });
      localStorage.setItem("tome:migrated", "1");
      return !!(bank || draft || ov);
    } catch (e) { return false; }
  },
};

/* ---------- sundial: NOAA solar position; Middletown by default, no permission asked ---------- */
/* OCCVM-L3 — one light. Position and response both come from the shared sundial (occvm/sundial.js);
   this closure is the tool's own place-handling and display shape around it, and nothing more.
   Before 1.2 it carried a second solar implementation (the Spencer approximation) and its own
   derivation, which is how --elev, --night, --glow and the night light vector came to mean different
   things in the two tools. */
const SUN = (() => {
  const DAYTON = { lat: 39.7589, lon: -84.1916, name: "Dayton, Ohio" };
  let PLACE = DAYTON;
  function setPlace(p) { PLACE = (p && isFinite(p.lat)) ? { lat: p.lat, lon: p.lon, name: p.name || "here" } : DAYTON; }
  function solar(date) { return OCCVM_SUN.position(PLACE.lat, PLACE.lon, date); }
  function apply(date) {
    const r = OCCVM_SUN.tick(document.documentElement, PLACE, date);
    return { elev: r.elev, az: r.az, dir: r.dir, night: r.night,
             time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) };
  }
  return { solar, apply, setPlace, DAYTON };
})();

/* ---------- veins: seeded per session, derived per face ---------- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SESSION = (() => { const fresh = () => String((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  try { let k = sessionStorage.getItem("tome:seed"); if (!k) { k = fresh(); sessionStorage.setItem("tome:seed", k); } return +k; } catch (e) { return +fresh(); } })();
const MINERALS = {
  amethyst:  { hi: "#c9a6ff", lo: "#5a36a8", m: "#8d5cf0", mlo: "#4a2a8c" },
  malachite: { hi: "#9ff0c5", lo: "#1f7a50", m: "#3fbf7e", mlo: "#1c6a45" },
};
const VEIN_CACHE = new Map();
function veinSVGLegacy(mineral, face) {
  /* the pre-1.1 generator: displaced cubic beziers under a turbulence filter. Kept as the fallback
     OCCVM-L10 requires — if growth fails the slab still gets a vein layer rather than nothing. */
  const { hi, lo } = MINERALS[mineral] || MINERALS.amethyst;
  const R = mulberry32(SESSION ^ ((face + 1) * 0x9E3779B1));
  const rnd = (a, b) => a + R() * (b - a);
  const W = 480, H = 200; let strokes = "";
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    let x = rnd(-30, 30), y = rnd(15, H - 15), d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    const segs = 3 + Math.floor(R() * 3), amp = rnd(18, 60), dir = R() < .5 ? -1 : 1;
    for (let k = 0; k < segs; k++) {
      const nx = x + (W + 60) / segs * rnd(.8, 1.2);
      const ny = Math.max(6, Math.min(H - 6, y + dir * rnd(-amp, amp * .4) * (k % 2 ? -1 : 1)));
      d += ` C ${(x + (nx - x) * rnd(.25, .45)).toFixed(0)} ${(y + rnd(-amp, amp)).toFixed(0)}, ${(x + (nx - x) * rnd(.55, .8)).toFixed(0)} ${(ny + rnd(-amp, amp)).toFixed(0)}, ${nx.toFixed(0)} ${ny.toFixed(0)}`;
      x = nx; y = ny;
    }
    strokes += `<path d='${d}' stroke='${lo}' stroke-width='${rnd(2.5, 6.5).toFixed(1)}' opacity='${rnd(.2, .4).toFixed(2)}'/><path d='${d}' stroke='${hi}' stroke-width='${rnd(.9, 2.1).toFixed(1)}' opacity='${rnd(.35, .6).toFixed(2)}'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><g fill='none' stroke-linecap='round'>${strokes}</g></svg>`;
}
function veinSVG(mineral, face) {
  /* OCCVM-L10 — the vein is grown, not drawn. Each face gets its own aggregate from the session seed, so
     two slabs never carry the same growth and a reload carries the same one back. */
  const key = mineral + ":" + face;
  if (VEIN_CACHE.has(key)) return VEIN_CACHE.get(key);
  const { hi, lo } = MINERALS[mineral] || MINERALS.amethyst;
  const seed = (SESSION ^ ((face + 1) * 0x9E3779B1)) >>> 0;
  const cs = getComputedStyle(document.documentElement);
  const num = (k, d) => { const v = parseFloat(cs.getPropertyValue(k)); return isFinite(v) ? v : d; };
  let svg;
  try {
    svg = OCCVM_VEINS.field({ seed, w: 80, h: 34, viewW: 480, viewH: 200,
      density: num("--vein-density", 0.3), habit: num("--vein-habit", 0.55),
      lo: lo, hi: hi, wide: 5, fine: 1.4 }).svg;   /* raw hex: encodeURIComponent below escapes them */
  } catch (e) { svg = veinSVGLegacy(mineral, face); }
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  VEIN_CACHE.set(key, url); return url;
}
