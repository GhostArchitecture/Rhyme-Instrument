/* ==== OCCVM SPINE material.js — spliced from occvm/material.js. do not edit. ==== */
/* sha256:a56eeb089757 */
/* OCCVM 2.0 — the material model (OCCVM-L12). One definition, shared by every conforming tool.
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * THE BREAK: a hex stops being authored and starts being derived. `--sub-hi`, `--sub` and `--sub-lo` were
 * three separate decisions that happened to look related. They are now one material, one body colour and
 * one cut geometry, and their RATIOS fall out of the arithmetic.
 *
 * ─── three derivations were measured before this one was kept ────────────────────────────────────
 *
 * The roadmap's argument for an orthorhombic system is that a slab has three faces sharing one scaled
 * response today, and that three principal indices give each face its own value from one definition.
 * That argument is right. Two obvious ways to cash it in are wrong, and both were measured:
 *
 *   1. NORMAL-INCIDENCE Fresnel on α/β/γ gives 4.39% / 6.44% / 6.51% — a spread of 1.48×, against the
 *      5.74× linear-luminance spread the tools actually author. Real optics, taken that way, is 3.9×
 *      FLATTER than the design; a substrate derived from it is nearly monochrome and both tools lose the
 *      structure they are read by.
 *
 *   2. Adding the sun and weighting reflectance by incident flux — R(θ)·cos θ, the intuitive fix — is
 *      WORSE, not better: the cosine very nearly cancels the Fresnel rise, and the whole 0–90° sweep
 *      collapses to 1.13×, peaking at 76.9°. Flux-weighting cannot produce a ramp at all. It was tried
 *      because it sounds more physical than what replaced it; it is recorded because the next person to
 *      have that idea should not have to spend the hour.
 *
 * What is kept is the third: on a dark, glossy solid you do not see a diffuse return, you see the
 * SPECULAR one, so a face's brightness tracks R at the angle it presents TO THE VIEWER. Those angles are
 * the slab's own cut geometry — the thing OCCVM-L2 already fixes — not the sun's position:
 *
 *      front  0°  n=α  R= 4.39%      chamfer 45°  n=β  R= 7.60%      edge 80°  n=γ  R=41.04%
 *
 * ─── what that decomposition buys, and it is the reason it is the one kept ───────────────────────
 *
 * The sun DROPS OUT of the ratio. Material owns structure; the sundial owns magnitude, exactly as it has
 * since 1.2. 2.0 therefore does not fight the light pipeline or double-apply it — the failure mode of the
 * elevation-parameterised version, which re-sorted its own faces as the sun moved and let `mid` collide
 * with `hi` at noon and with `lo` at dawn.
 *
 * ─── where the material and the hand disagree, stated rather than fitted ─────────────────────────
 *
 *      optics    edge : chamfer : front  =  9.353 : 1.732 : 1.000
 *      authored  hi   : mid     : lo     =  5.739 : 2.539 : 1.000
 *
 * Same ORDERING, different SHAPE. The material is more convex: it makes the edge carry more of the range
 * and the mid-tone less, which is what a cut mineral does and what a hand-mixed ramp tends not to. This
 * is NOT corrected by fitting a per-face fudge — a per-face correction is three authored numbers wearing
 * a derivation's clothes, which is the exact thing 2.0 exists to remove. The shape is the material's.
 *
 * ─── the one value here that is NOT derived, said plainly ────────────────────────────────────────
 *
 * `contrast` is a legibility parameter, not a material property: an exponent on the optical ratio setting
 * how much of the available range the substrate spends. Physics fixes the order and the shape; it does
 * not know how readable a terminal has to be at 3am. At contrast 1 the substrate is the mineral's;
 * at 0.782 its spread matches what the tools author today (measured: log 5.739 / log 9.353). It is named
 * here, in the material, for the same reason OCCVM-L7 names `--t-num` — a judgment gets called judgment
 * in the place somebody would otherwise mistake it for measurement.
 */
var OCCVM_MATERIAL = (function () {
  "use strict";

  var RAD = Math.PI / 180;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---- the definition ---------------------------------------------------------------------------
   * Aragonite, CaCO₃, orthorhombic, space group Pmcn. Every number is published and none is chosen:
   * cell from diffraction, indices from optical mineralogy, elastic constants from Brillouin
   * spectroscopy on natural single-crystal aragonite at ambient conditions.
   */
  var ARAGONITE = {
    name: "aragonite",
    formula: "CaCO3",
    system: "orthorhombic",
    group: "Pmcn",
    cell: { a: 4.96, b: 7.97, c: 5.74 },              /* Å */
    ri: { alpha: 1.530, beta: 1.680, gamma: 1.685 },  /* biaxial, three principal indices */
    hardness: 3.75,                                   /* Mohs 3.5–4 */
    density: 2.93,                                    /* g/cm³ */
    /* stiffness tensor, GPa — C11/C22/C33 are the three axes P1's motion derives from */
    C: { 11: 171.1, 22: 110.1, 33: 98.4, 44: 39.3, 55: 24.2, 66: 40.2, 12: 60.3, 13: 27.8, 23: 41.9 },
    /* the body colour: what the material absorbs to. NOT derived — a mineral's colour comes from trace
       chemistry and defects, not from its lattice, and OCCVM-L1's obsidian anchor is the tools' own
       subject matter. The material says how light BEHAVES on it; this says what is left after. */
    body: "#12111a",
    luster: "vitreous"
  };

  /* birefringence, derived rather than stated: γ − α */
  function birefringence(m) { return m.ri.gamma - m.ri.alpha; }

  /* The {110} composition-plane angle is NOT computed here, deliberately. occvm/veins.js derives it from
     this file's cell and occvm/fracture.js reads it from veins; adding a third site would be the same
     duplicate-derivation defect those two exist to avoid. The material owns the lattice; the habit and
     the cleavage own the angle. */

  /* ---- optics -----------------------------------------------------------------------------------
   * Unpolarised Fresnel reflectance at an interface, as a function of index and incidence angle.
   * Total internal reflection is not reachable here (light enters from the less dense side), so the
   * square root is always real.
   */
  function fresnel(n, thetaDeg) {
    var th = clamp(thetaDeg, 0, 89.9) * RAD;
    var s = Math.sin(th), c = Math.cos(th);
    var k = Math.sqrt(Math.max(0, 1 - (s / n) * (s / n)));
    var rs = Math.pow((c - n * k) / (c + n * k), 2);
    var rp = Math.pow((k - n * c) / (k + n * c), 2);
    return (rs + rp) / 2;
  }

  /* ---- the three faces --------------------------------------------------------------------------
   * A slab presents three surfaces to the viewer and each takes its own principal index. The angles are
   * the cut geometry OCCVM-L2 already governs — the flat front, the chamfer L2 permits, and the edge seen
   * near tangent — so the faces are fixed by the slab, not by the sun (see the header for what happens
   * when they are not).
   *
   * WHICH INDEX GOES ON WHICH FACE IS A CONVENTION, and is flagged as one here rather than buried. What
   * the crystallography establishes is that there ARE three principal indices and that they differ; it
   * does not tell you how a rendered rectangle is oriented in the lattice, because a rendered rectangle
   * is not in a lattice. α on the front and γ on the edge is chosen so the ordering the optics produces
   * runs the same direction as the ramp the tools already read — the same honesty flag P1 carries about
   * mapping crystal axes onto screen axes.
   */
  var CUT = { front: 0, chamfer: 45, edge: 80 };   /* degrees from the view normal — L2 geometry */

  function faces(m) {
    return {
      front:   { axis: "a", n: m.ri.alpha, theta: CUT.front,   R: fresnel(m.ri.alpha, CUT.front) },
      chamfer: { axis: "b", n: m.ri.beta,  theta: CUT.chamfer, R: fresnel(m.ri.beta,  CUT.chamfer) },
      edge:    { axis: "c", n: m.ri.gamma, theta: CUT.edge,    R: fresnel(m.ri.gamma, CUT.edge) }
    };
  }

  /* ---- resolve ----------------------------------------------------------------------------------
   * material -> the substrate family. A reflectance ratio is a ratio in LINEAR light, so the body colour
   * is decoded out of sRGB, scaled, and re-encoded. The first version scaled the sRGB bytes directly and
   * a 9.35× optical spread rendered as 116× — the transfer function applied twice — and it shifted hue,
   * because saturating one channel before another is a colour change nobody asked the material for. One
   * gain across all three linear channels is hue-preserving by construction.
   */
  function srgbToLinear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function linearToSrgb(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function parse(h) { return [1, 3, 5].map(function (i) { return srgbToLinear(parseInt(h.substr(i, 2), 16) / 255); }); }
  function hex(c) {
    return "#" + c.map(function (v) {
      return clamp(Math.round(linearToSrgb(clamp(v, 0, 1)) * 255), 0, 255).toString(16).padStart(2, "0");
    }).join("");
  }

  /* the authored spread, kept as a measurement of what the tools do today rather than as a target */
  var AUTHORED_SPREAD = 5.739;

  function substrate(m, contrast) {
    var k = contrast === undefined ? 1 : contrast;
    var f = faces(m);
    var base = f.front.R;                       /* the darkest face is the reference, by geometry */
    var body = parse(m.body);
    function face(R) {
      var gain = Math.pow(R / base, k);         /* contrast is an exponent on the optical ratio */
      return hex(body.map(function (v) { return v * gain; }));
    }
    return {
      hi: face(f.edge.R), mid: face(f.chamfer.R), lo: face(f.front.R),
      R: { front: f.front.R, chamfer: f.chamfer.R, edge: f.edge.R },
      spread: Math.pow(f.edge.R / base, k),
      ratios: [Math.pow(f.edge.R / base, k), Math.pow(f.chamfer.R / base, k), 1]
    };
  }

  /* the contrast at which the material's spread equals what the tools author today. Derived, not typed:
     it moves if the material moves, which is the whole point of it being here rather than in a stylesheet. */
  function authoredContrast(m) {
    var f = faces(m);
    return Math.log(AUTHORED_SPREAD) / Math.log(f.edge.R / f.front.R);
  }

  /* ---- what the other properties govern ---------------------------------------------------------
   * Stated as derivations rather than applied here, because each belongs to the law that owns the
   * surface it touches; this file is the material, not the renderer.
   */
  /* OCCVM-L2 — hardness sets how sharply a face can be cut. Mohs 3.5–4 is soft enough to be cut into
     rather than merely faceted, which is the roadmap's own argument for aragonite over topaz. Mapped
     against the 4px ceiling L2 already fixes: softer mineral, larger permissible radius. */
  function edgeRadius(m) { return clamp(4 * (m.hardness / 10), 1, 4); }

  /* OCCVM-L4 — density sets cast weight. Aragonite at 2.93 against a nominal 2.65 (quartz) is the
     reference ratio; a denser material throws a heavier shadow and carries more apparent mass. */
  function castWeight(m) { return m.density / 2.65; }

  /* P1 — anisotropic motion. DERIVED, MEASURED, AND NOT SHIPPED. Read the negative before using it.
   *
   * The stiffness ratio the three axes move at, normalised to the softest (C33):
   *     a 1.7388   b 1.1189   c 1.0000
   */
  function stiffness(m) {
    return { a: m.C[11] / m.C[33], b: m.C[22] / m.C[33], c: 1 };
  }

  /* Duration scalar per axis. A stiffer axis settles faster, and the relation is the oscillator's, not
     the spring's: T = 2π√(m/k), so duration ∝ 1/√k. The alternative — static compliance, 1/k — was the
     other candidate and is wrong for a TEMPORAL quantity; it describes how far a thing deflects, not how
     long it takes. Both are recorded because they differ enough to matter:
         1/√k   a 0.7584   b 0.9454   c 1.0000     ← in force
         1/k    a 0.5751   b 0.8937   c 1.0000     ← rejected, static not temporal            */
  function motion(m) {
    var k = stiffness(m);
    return { a: 1 / Math.sqrt(k.a), b: 1 / Math.sqrt(k.b), c: 1 / Math.sqrt(k.c) };
  }

  /* ---- WHY P1 IS NOT WIRED TO A TOKEN --------------------------------------------------------------
   *
   * Anisotropy is only observable as a DIFFERENCE BETWEEN TWO DIRECTIONS IN THE SAME VIEW. Censused
   * across both tools and the spine at 2.0:
   *
   *     translateX     0 animated sites          <- zero, in either tool
   *     translateY     3 animated sites          (.edge:active 260ms, rise 380ms, and BTC's chevron)
   *     translate(x,y) every site is a STATIC light-vector offset, calc(var(--lx) * Npx), not a motion
   *
   * There is no pair. The one genuinely animated 2D direction anywhere is fracture's separation along
   * the twin normal, and projecting the per-axis scalars onto it gives 194.4ms against the isotropic
   * 220ms — an 11.6% change. But the fracture angle is FIXED: one direction, every time, with nothing
   * beside it to be faster or slower than. That is not anisotropy, it is 220 renamed to 194.
   *
   * Shipping `--dur-a/--dur-b/--dur-c` here would be three tokens computed and consumed by nothing,
   * which is OCCVM-D12 exactly — closed at 1.2a, one release before this one. The arithmetic stays
   * because it is right and cheap; the wiring waits for a second axis to exist. `test/occvm.js` holds a
   * SELF-RETIRING guard: it asserts the translateX count is still zero, so the day somebody animates a
   * horizontal motion the suite fails and says P1 has become expressible.                              */
  /* P4 — unit-cell spacing. DERIVED, MEASURED, AND NOT SHIPPED. Read the negative before using it.
   *
   * The three cell edges, normalised to the shortest, are a spacing triple with a reason behind it where
   * an 8px grid has none:  a 1.0000 : c 1.1573 : b 1.6069.
   *
   * TWO MEASUREMENTS KILL IT, and the second is the one that matters.
   *
   * 1. IT DOES NOT DESCRIBE THE TOOLS. Censused over 213 real padding/margin/gap declarations across both
   *    tools: 19 distinct pixel values, weighted mean error against the cell ladder 10.79%. A plain 4px
   *    grid covers more of them (42.3% within 6%, against 32.4%). Adopting the cell scale would therefore
   *    MOVE 213 declarations by ~11% — a redesign wearing a derivation's coat, and the opposite of what
   *    the substrate did at 2.0, where the material REPRODUCED the authored ramp at a derived contrast.
   *
   * 2. IT DOES NOT SURVIVE TO THE SCREEN. Spacing quantises to whole pixels, and 84.5% of both tools'
   *    spacing is under 12px, where rounding destroys the ratio outright:
   *
   *        base 4  -> 4 / 5 / 6    renders 1.000 : 1.250 : 1.500
   *        base 6  -> 6 / 7 / 10   renders 1.000 : 1.167 : 1.667
   *        base 8  -> 8 / 9 / 13   renders 1.000 : 1.125 : 1.625
   *        base 2  -> 2 / 2 / 3    two of the three steps COLLAPSE
   *
   *    The rendered ratios wander by ±8% and are never the cell's. The derivation is present in the
   *    source and absent from the render, which is a value computed and consumed by nothing wearing a
   *    third disguise.
   *
   * AND THE RATIO IS NOT DISTINGUISHABLE FROM THE ONE IT REPLACES. b/a = 1.6069 against the golden ratio
   * 1.6180 differs by 0.04px at step 1, 0.35px at step 3, and only reaches a whole pixel at step 5 —
   * past the largest spacing either tool uses. Over the range where all the spacing actually lives they
   * are the same number. What the cell buys is provenance, not appearance, and that is worth having; it
   * is not worth 213 moved declarations.
   *
   * THE GUARD SHIPS EVEN THOUGH THE SCALE DOES NOT, and precisely because the two ratios are
   * indistinguishable: somebody will eventually "correct" 1.6069 to 1.6180 on the grounds that it looks
   * like a typo for the golden ratio. It is not. It is 7.97/4.96, and the whole point of L12 is that a
   * value has a reason. `test/occvm.js` fails on the golden ratio appearing as a spacing constant. */
  function spacing(m) {
    var c = m.cell;
    return { a: 1, c: c.c / c.a, b: c.b / c.a };
  }
  var GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;   /* named ONLY so a guard can reject it, never to be used */
  var P4_UNEXPRESSED = {
    reason: "the cell ratio does not survive integer-pixel quantisation at the sizes 84.5% of spacing uses",
    declarationsCensused: 213,
    distinctValues: 19,
    meanErrorVsCellLadder: 0.1079,
    censusedAt: "2.1"
  };

  var P1_UNEXPRESSED = {
    reason: "no animated horizontal motion exists in either tool; anisotropy needs two directions in one view",
    translateXSites: 0,
    fractureProjection: 0.8837,
    censusedAt: "2.0"
  };

  return {
    ARAGONITE: ARAGONITE, CUT: CUT, AUTHORED_SPREAD: AUTHORED_SPREAD,
    fresnel: fresnel, faces: faces, substrate: substrate, authoredContrast: authoredContrast,
    birefringence: birefringence,
    edgeRadius: edgeRadius, castWeight: castWeight, stiffness: stiffness,
    motion: motion, P1_UNEXPRESSED: P1_UNEXPRESSED,
    spacing: spacing, GOLDEN_RATIO: GOLDEN_RATIO, P4_UNEXPRESSED: P4_UNEXPRESSED
  };
})();
if (typeof module !== "undefined") module.exports = OCCVM_MATERIAL;
/* ==== END OCCVM material.js ==== */

/* ==== OCCVM SPINE fracture.js — spliced from occvm/fracture.js. do not edit. ==== */
/* sha256:27859f9cc43a */
/* OCCVM 1.1b — fracture. The first shared BEHAVIOUR primitive (OCCVM-L11).
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * A destructive action should not share a physical vocabulary with a reversible one. Everything else in
 * these tools fades, slides or settles; those are elastic behaviours, and elastic behaviour implies the
 * thing could come back. Aragonite does not deform past its limit — it CLEAVES, along fixed planes, at
 * an angle its own lattice decides, the moment stress exceeds a threshold. That is a different event, and
 * irreversible actions are a different event.
 *
 * THE ANGLE IS NOT CHOSEN. It is 2·arctan(b/a) from the unit cell — the {110} composition-plane angle of
 * the same cyclic twin the vein generator grows — imported from occvm/veins.js rather than recomputed,
 * because two derivations of one angle is the defect OCCVM-L3 exists to prevent, one material down. An
 * eyeballed crack is decoration wearing this primitive's clothes; the whole extension passes its own test
 * only if the angle is the mineral's.
 *
 * SCOPE IS THE DISCIPLINE. Irreversible only — delete, discard, disconnect. Never a cancel, never a
 * dismiss, never a close. A vocabulary that marks everything marks nothing, and this one exists to say
 * "that is not coming back" in a language the rest of the system deliberately does not speak.
 */
var OCCVM_FRACTURE = (function () {
  "use strict";

  var RAD = Math.PI / 180;
  /* The mineral's own angle, from the generator that already derives it — and from NOWHERE ELSE.
   *
   * This began as `... || 116.209`, a fallback for when the generator is absent. A guard written one
   * commit later caught it: that literal is a second copy of the angle, which is the exact thing this
   * primitive's header promises it does not have, and in Node it silently *was* the value while the
   * browser used the real one. A fallback that quietly disagrees with its source is worse than no
   * fallback. If the generator is not spliced beside this, that is a splice failure and it should be
   * loud.
   *
   * RESOLVED AT CALL TIME, NOT AT LOAD. The first version captured OCCVM_VEINS into a module-scope
   * binding while this IIFE ran, and that is wrong in the browser for a reason nothing in Node can show:
   * the splicer inserts each part after the same anchor, so parts land in reverse list order and this
   * file is evaluated BEFORE veins.js is assigned. `typeof OCCVM_VEINS` was therefore "undefined" at
   * capture, the require branch does not exist in a page, and the binding was null — so cleave() threw
   * on every call from the moment 1.1b shipped. Node resolved it through require and every assertion
   * passed. A lazy read is order-independent, which is the property this actually needs. */
  function twinAngle() {
    var v = (typeof OCCVM_VEINS !== "undefined" && OCCVM_VEINS) ? OCCVM_VEINS
          : (typeof require !== "undefined" ? require("./veins.js") : null);
    if (!v || !v.TWIN_ANGLE) throw new Error("occvm fracture: veins.js is not spliced beside this — no angle to cleave on");
    return v.TWIN_ANGLE;
  }

  /* 220ms, fixed, and deliberately faster than any elastic curve in the system. Fracture is sudden by
     definition; sharing a duration with a settle would put it back in the vocabulary it exists to leave. */
  var MS = 220;

  function reduced() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  /* mulberry32 again rather than Math.random: a fracture is seeded off the element so a given deletion
     looks the same if it is replayed, and the golden set can pin one. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(s) {
    var n = 2166136261;
    for (var i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); }
    return n >>> 0;
  }

  /* The split line, in the element's own box: a line at the twin angle through a jittered centre.
   * Returned as the two clip polygons, each a half-plane intersected with the box, in percent. */
  function halves(angleDeg, offset) {
    var t = Math.tan(angleDeg * RAD);
    /* y = t·(x − 50) + (50 + offset), in percent coordinates; solve at both box edges */
    var yAt = function (x) { return t * (x - 50) + (50 + offset); };
    var y0 = yAt(0), y100 = yAt(100);
    /* clamp the traversal to the box and take the two sides of it */
    var a = ["0% " + y0 + "%", "100% " + y100 + "%", "100% -60%", "0% -60%"];
    var b = ["0% " + y0 + "%", "100% " + y100 + "%", "100% 160%", "0% 160%"];
    return ["polygon(" + a.join(",") + ")", "polygon(" + b.join(",") + ")"];
  }

  /* cleave(el, done): the element splits along the mineral's angle and the two halves torque apart.
   *
   * The element is cloned twice rather than animated in place, because one box cannot move in two
   * directions. The original is hidden on the same frame the clones appear, so nothing is ever visible
   * twice. No fade at any point: cleaved material does not become transparent, it becomes absent, and a
   * fade here would put the elastic vocabulary back into the one event that is meant to be without it. */
  function cleave(el, done) {
    if (!el || !el.getBoundingClientRect) { if (done) done(); return; }
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) { if (done) done(); return; }

    if (reduced()) {                       /* the floor is the law's, not this primitive's (L8) */
      el.style.visibility = "hidden";
      if (done) done();
      return;
    }

    var seed = hash((el.id || "") + "|" + Math.round(box.width) + "x" + Math.round(box.height));
    var rnd = rng(seed);
    /* ±8% of the shorter dimension, so two deletions of the same thing do not cleave identically */
    var offset = (rnd() * 16 - 8);
    var ang = twinAngle() - 90;            /* the composition plane, as a screen-space slope */
    var poly = halves(ang, offset);

    var host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:" + box.left + "px;top:" + box.top + "px;width:" +
      box.width + "px;height:" + box.height + "px;pointer-events:none;z-index:9999";

    /* THE CLONE MUST CARRY ITS COMPUTED STYLE, NOT ITS MARKUP.
     *
     * The first version cloned the node and stripped its id — necessary, because two elements with one
     * id is invalid and breaks getElementById — and the halves rendered BLANK. Everything an `#id`
     * selector had been giving the element (its background, its border, its whole surface) was supplied
     * by a rule that no longer matched. Every JS assertion still passed: two clones, opposite torque, no
     * fade, host cleaned up. It was only visible by looking at the frame.
     *
     * Copying the resolved style instead is indifferent to how the element was selected — id, class,
     * inheritance, inline — so a fracture looks like the thing that fractured whatever the tool's CSS
     * happens to be. Layout properties are overridden afterwards, because the halves are positioned by
     * this primitive rather than by the page they came from. */
    var computed = window.getComputedStyle(el);
    var norm = { x: Math.cos(ang * RAD), y: Math.sin(ang * RAD) };
    for (var i = 0; i < 2; i++) {
      var part = el.cloneNode(true);
      part.removeAttribute("id");
      for (var k = 0; k < computed.length; k++) {
        var prop = computed[k];
        part.style.setProperty(prop, computed.getPropertyValue(prop));
      }
      part.style.cssText += ";position:absolute;left:0;top:0;margin:0;width:100%;height:100%" +
        ";clip-path:" + poly[i] + ";transition:transform " + MS + "ms cubic-bezier(.15,.7,.4,1)";
      host.appendChild(part);
    }
    document.body.appendChild(host);
    el.style.visibility = "hidden";

    /* separate along the split normal, each half torquing — real cleavage does not slide parallel */
    requestAnimationFrame(function () {
      var kids = host.children;
      for (var i = 0; i < kids.length; i++) {
        var s = i ? 1 : -1;
        var dx = -norm.y * s * (box.height * 0.22 + 10);
        var dy = norm.x * s * (box.height * 0.22 + 10);
        kids[i].style.transform =
          "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) rotate(" + (s * (2 + rnd() * 4)).toFixed(2) + "deg)";
      }
    });

    setTimeout(function () {
      if (host.parentNode) host.parentNode.removeChild(host);
      if (done) done();
    }, MS + 20);
  }

  return { cleave: cleave, halves: halves, twinAngle: twinAngle, MS: MS };
})();
if (typeof module !== "undefined") module.exports = OCCVM_FRACTURE;
/* ==== END OCCVM fracture.js ==== */

/* ==== OCCVM SPINE minerals.js — spliced from occvm/minerals.js. do not edit. ==== */
/* sha256:6ab675b82831 */
/* OCCVM 1.4 — the mineral set (OCCVM-L6). One implementation, shared by every conforming tool.
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * The set is closed and the meanings are fixed: amethyst is the default field, malachite is affirmed/
 * won/positive, ruby is negated/lost/failed. `m`/`mlo` (accent/deep) are the law-pinned pair — SPINE.md's
 * L6 table states them exactly. `hi`/`lo` are the vein generator's own highlight/shadow tint, derived by
 * eye rather than by a formula (the existing amethyst/malachite pair wasn't built from one either), and
 * are cosmetic: changing them is a design call, not a re-registration.
 *
 * Before this file, each tool that had a mineral concept declared its own copy. Rhyme's carried only two
 * of the three — it had never needed a negative mineral, so ruby was never added — which is exactly the
 * "no local exceptions" gap L6 exists to close (OCCVM-D6's other half: BTC had no mineral system at all).
 */
var OCCVM_MINERALS = {
  amethyst:  { m: "#8d5cf0", mlo: "#4a2a8c", hi: "#c9a6ff", lo: "#5a36a8" },
  malachite: { m: "#3fbf7e", mlo: "#1c6a45", hi: "#9ff0c5", lo: "#1f7a50" },
  ruby:      { m: "#e0475f", mlo: "#6b1a2e", hi: "#f5a3b3", lo: "#8f2740" },
};
if (typeof module !== "undefined") module.exports = OCCVM_MINERALS;
/* ==== END OCCVM minerals.js ==== */

/* ==== OCCVM SPINE veins.js — spliced from occvm/veins.js. do not edit. ==== */
/* sha256:225f96ea3833 */
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

  /* ARAGONITE'S UNIT CELL, and the one number that follows from it (1.1b).
   *
   * a 4.96 Å · b 7.97 Å · c 5.74 Å, orthorhombic, space group Pmcn. The {110} composition planes of the
   * cyclic twin sit at 2·arctan(b/a) = 116.209°, against the 120° a hexagonal relationship would need.
   * The 3.791° deficit is computed here from the cell rather than written down, so the cell is the only
   * thing anyone has to get right — and so that a different mineral, at 2.0, changes one line.
   *
   * MISFIT is that deficit measured against the sector half-width (60°): 0.0632.
   *
   * 2.0 — THE CELL MOVED OUT OF HERE AND IS NOW READ, NOT RESTATED. occvm/material.js is the material
   * definition and owns the lattice; this file grows a habit from it. Until 2.0 the same three lengths
   * were typed here and in the material, which is two copies of one fact — the defect the fracture
   * primitive's own header forbids, one level up, and it would have gone unnoticed until somebody edited
   * one of them. The angle still has exactly one derivation; it just happens where the cell lives. */
  var MAT = (typeof OCCVM_MATERIAL !== "undefined") ? OCCVM_MATERIAL
          : (typeof require !== "undefined" ? require("./material.js") : null);
  if (!MAT) throw new Error("occvm veins: material.js is not spliced beside this — no lattice to grow on");
  var CELL = MAT.ARAGONITE.cell;
  var TWIN_ANGLE = 2 * Math.atan(CELL.b / CELL.a) * 180 / Math.PI;   /* 116.209° */
  var MISFIT = (120 - TWIN_ANGLE) / 60;                              /* 0.0632 */

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

  /* grow(): DLA on a lattice, growing the habit of a named mineral rather than a generic dendrite.
   *
   * THE MINERAL IS ARAGONITE, and since 1.1a that is a decision the generator encodes rather than a label
   * on the output. The 2.0 material model anchors substrate and vein to one crystal (CaCO₃, orthorhombic)
   * on the argument that a vein is not a foreign material embedded in a slab — it is the same crystal
   * grown differently. Aragonite's two expressions are exactly the two this system needs: a blocky
   * orthorhombic form for a cut face, and a fibrous radiating form for a vein. So the vein grows the
   * second one, and it grows it the way aragonite actually does:
   *
   *   - FIBRES RADIATE FROM A NUCLEATION POINT. Not from the screen's left edge, and not along the
   *     screen's horizontal. Until 1.1a the anisotropy was `pH = .5 + habit * .32`, a bias toward
   *     horizontal STEPS — a direction in the viewport, which is a fact about the browser window and not
   *     about the crystal. A crystal has no idea which way the screen is. Direction is now measured from
   *     the growth's own nucleus, which is a direction in the material's frame.
   *
   *   - IT TWINS IN THREES. Aragonite's signature is cyclic twinning on {110}: three individuals meeting
   *     at close to 120°, which mimics a hexagonal prism well enough that the pseudo-hexagonal form is
   *     what the mineral is known for. Each nucleus therefore carries `twin` sectors — three, by default,
   *     because that is what aragonite does — each with its own rotation, and growth is selective along
   *     them. Radiating fibre bundles from one point, grown rather than drawn.
   *
   * habit stays what OCCVM-L10 says it is — the anisotropy of growth — and its ends still mean what the
   * law says: 0 grows the bushy, equant dendrite of a manganese oxide; 1 draws the structure out into an
   * elongated, acicular form. Two things changed under it. The AXIS anisotropy is measured against moved
   * from the viewport's to the crystal's, and the MECHANISM moved from the walk to the attachment (see
   * accept(), below, which records why the first attempt failed). At habit 0 the twin sectors still exist
   * but express nothing, because attachment is then indifferent to direction — which is correct, and is
   * what an equant habit is.
   *
   * Walkers spawn just beyond the frontier rather than at infinity — the standard optimisation, and the
   * reason this finishes in single-digit milliseconds. A walker that strays far outside the frontier is
   * abandoned rather than followed, which is equivalent in the limit and much cheaper.
   *
   * `twin` is a parameter rather than a CSS token deliberately. Twinning is a MATERIAL PROPERTY, and
   * material properties are 2.0's substance — at 2.0 this argument comes from the material definition
   * instead of a default. Adding a `--vein-twin` token now would put a 2.0 property into the 1.x token
   * surface, which is the leak SPINE.md's own 1.4 note warns about. It defaults to aragonite's 3.
   */
  function grow(o) {
    var w = o.w | 0, h = o.h | 0;
    var n = o.n | 0;
    var habit = Math.max(0, Math.min(1, o.habit === undefined ? 0.55 : o.habit));
    var twin = o.twin === undefined ? 3 : Math.max(1, o.twin | 0);
    var rnd = mulberry32(o.seed >>> 0);
    var TAU = 6.283185307179586;

    var occ = new Uint8Array(w * h);
    var segs = [];
    var i, j, y, x;

    /* Nucleation points, scattered across the whole surface rather than banked against one edge: a vein
       layer that fills half the page and stops is a gradient, and the eye reads a gradient as a mistake.
       They compete for the same walkers and screen each other, which is what leaves clear matrix between
       separate growths.

       Each nucleus carries its own twin rotation, so the three sectors do not all point the same way
       across the surface — cyclic twins nucleate independently and there is no reason they would. */
    var nuclei = 6 + ((rnd() * 4) | 0);
    var seeds = [], sites = [], siteGroup = [], groups = [], segOwner = [];
    for (i = 0; i < nuclei; i++) {
      x = 1 + ((rnd() * (w - 3)) | 0);
      y = ((rnd() * h) | 0);
      occ[y * w + x] = 1;
      seeds.push(x, y);
      sites.push(y * w + x);
      siteGroup.push(i);
      groups.push({ cx: x, cy: y, rot: rnd() * TAU });
    }

    var maxSteps = h * 2 + 60;

    /* ATTACHMENT ANISOTROPY — how a crystal actually grows in a direction.
     *
     * The first attempt at this biased the WALKER's drift toward its sector axis, and measurement said
     * it did nothing: twin 1, twin 3 and twin 6 produced identical angular spectra, all dominated by a
     * single lobe. Two reasons, both instructive. A walker pushed radially outward is pushed away from
     * the aggregate, so it wanders off and is abandoned rather than sticking anywhere — the bias spent
     * walkers instead of shaping growth. And snapping an axis to the nearest lattice step collapses
     * three directions 120° apart into at most four, which destroys the threefold signal before it can
     * reach the surface.
     *
     * A real crystal is not anisotropic because the diffusing atom travels differently. It is
     * anisotropic because ATTACHMENT differs by crystallographic direction: some faces accept an atom
     * readily and some do not, and the fast directions become the needles. So the walk stays a pure
     * unbiased random walk — which is what makes this DLA at all — and the anisotropy lives in whether
     * a contact is accepted.
     *
     * `align` is +1 when the candidate site sits exactly on one of the nucleus's `twin` axes and −1
     * exactly between two of them; `cos(twin·(θ−rot))` gives the whole cyclic-twin symmetry in one term.
     * Acceptance falls from certain (habit 0, isotropic, equant) to strongly axis-selective (habit 1),
     * and a rejected walker keeps walking rather than being discarded, so no walker is wasted. */
    function accept(g, px, py) {
      if (habit <= 0) return true;
      var dx = px - g.cx, dy = py - g.cy;
      /* the surface wraps vertically, so take the shorter way round when measuring a bearing */
      if (dy > h / 2) dy -= h; else if (dy < -h / 2) dy += h;
      if (dx === 0 && dy === 0) return true;                  /* at the nucleus itself: no direction yet */
      var align = Math.cos(twin * (Math.atan2(dy, dx) - g.rot));   /* +1 on an axis, -1 between */
      /* Selectivity is the EXPONENT, not a blend against an isotropic floor. The first form here was
         `(1-habit) + habit·p`, which keeps a 0.45 floor of accepting anything at habit .55 — both tools'
         default — and measurement showed the threefold signal absent there: dominant harmonic k=1, the
         twin invisible at exactly the setting that ships. As an exponent the limits are exact (habit 0
         gives p⁰ = 1, accept everything, equant) and selectivity rises smoothly with no dead band. */
      /* 1.1b — THE MISFIT WAS TESTED HERE AND DOES NOT EXPRESS. RECORDED, NOT SHIPPED.
       *
       * Aragonite's {110} composition planes sit at 2·arctan(b/a) = 116.209° where a hexagonal
       * relationship needs 120°, a 3.791° deficit at every boundary. That deficit is the whole reason
       * the habit is called *pseudo*-hexagonal, and a real cyclic twin closes anyway — the misfit is
       * taken up as strain and leaves a RE-ENTRANT ANGLE at each composition plane. Re-entrant angles
       * are preferred attachment sites; it is what drives twinned dendritic growth in ice and in ribbon
       * silicon. So the obvious move is an attachment boost along the seam, at the deficit's own
       * strength: 3.791/60 = 0.0632.
       *
       * IT PRODUCES NOTHING, MEASURED. Folded angular density at the composition plane came back at
       * 0.15× the plain matrix — below it, not above — and stayed flat at 0.15 across a 10× range in
       * particle count and a 9× range in lattice area. It is not a resolution limit; it does not
       * converge. The reason is that DLA is ARRIVAL-limited: the composition plane lies in the screening
       * shadow of the two arms flanking it, so a walker almost never reaches it, and an attachment boost
       * only matters conditional on arrival. The re-entrant effect is real, and it belongs to
       * attachment-limited growth, which this is not.
       *
       * Raising the coefficient until a seam appeared would be fudging a derived number to produce a
       * wanted picture — the exact failure the material model exists to prevent. Shipping the term at
       * its true strength would be worse: a value computed and consumed by nothing, which is `OCCVM-D12`
       * one release after closing it. So the term is not here. The arithmetic stays (it is what P2's
       * fracture angle needs), and the negative result stays with it. */
      return rnd() < Math.pow((1 + align) / 2, habit * 6);
    }

    for (i = 0; i < n; i++) {
      /* Spawn across the whole occupied extent rather than only at the leading edge, so the interior
         keeps thickening while the tips advance. Launching only at the frontier grows one filament and
         leaves the body starved. */
      /* Launch near the aggregate, not at infinity. A walker released far out in the matrix spends most
         of its life wandering empty lattice; released on a small circle around a site already occupied,
         it arrives at the cluster with the same isotropic distribution — this is the standard DLA launch
         radius, and it is why the generator finishes in single-digit milliseconds instead of twenty. */
      var pick = (rnd() * sites.length) | 0;
      var site = sites[pick], group = groups[siteGroup[pick]];
      var ang = rnd() * TAU, rad = 4 + rnd() * 7;
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
        /* a contact only becomes a stick if this direction accepts one (see accept(), above) */
        if (hit >= 0 && accept(group, x, y)) { stuck = hit; break; }

        /* An unbiased lattice walk. The anisotropy is in attachment, not in travel. */
        if (rnd() < 0.5) x += rnd() < 0.5 ? -1 : 1;
        else y += rnd() < 0.5 ? -1 : 1;

        if (y < 0) y = h - 1; else if (y >= h) y = 0;        /* the surface wraps vertically */
        if (x < 1) x = 1; else if (x >= w - 1) x = w - 2;
      }
      if (stuck < 0) continue;

      var kk = y * w + x;
      if (occ[kk]) continue;
      occ[kk] = 1;
      sites.push(kk);
      siteGroup.push(siteGroup[pick]);   /* a fibre belongs to the twin it grew from */
      segOwner.push(siteGroup[pick]);
      segs.push(stuck % w, (stuck / w) | 0, x, y);
    }
    /* `groups` and `segOwner` are returned so the twin can be MEASURED rather than eyeballed: with
       several growths overlapping, assigning a particle to its nearest nucleus misattributes enough of
       them to bury the signal, and a property that can only be checked when it happens to be isolated is
       not really checked. With the true owner and the group's own rotation, the angular harmonic is
       exact — which is what test/occvm.js asserts on. */
    return { segs: segs, w: w, h: h, nuclei: seeds, twin: twin, groups: groups, segOwner: segOwner };
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
    var g = grow({ w: w, h: h, n: Math.round(w * h * density), habit: o.habit, seed: o.seed, twin: o.twin });
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

  /* CELL and TWIN_ANGLE are exported because the fracture primitive needs the same arithmetic, and
     two derivations of one angle is the defect OCCVM-L3 exists to prevent, one material down. */
  return { grow: grow, paths: paths, field: field, mulberry32: mulberry32,
           CELL: CELL, TWIN_ANGLE: TWIN_ANGLE, MISFIT: MISFIT };
})();
if (typeof module !== "undefined") module.exports = OCCVM_VEINS;
/* ==== END OCCVM veins.js ==== */

/* ==== OCCVM SPINE sundial.js — spliced from occvm/sundial.js. do not edit. ==== */
/* sha256:592585a93387 */
/* OCCVM 1.2/1.7 — the sundial. One light, shared by every conforming tool (OCCVM-L3).
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
 * 1.7 adds `--dusk-stage` (day/civil/nautical/astronomical/night, standard elevation boundaries) as a
 * discrete reading additive over the continuous --night ramp above — the ramp is unchanged, this is a
 * second, independent classification for anything that wants to react to the named stage rather than
 * a blend fraction (OCCVM-L9).
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
    /* `lam` — the sun's apparent ecliptic longitude — is returned because the moon's phase is its
       elongation from the sun, and computing the sun's position twice to get it would be two
       implementations of the same thing, which is the defect OCCVM-L3 exists to prevent. */
    return { elev: 90 - zen / RAD, az: az, lam: app };
  }

  /* ---- the moon: a secondary, weaker light, and ink's only other source (1.7) ---------------------
   *
   * OCCVM-L3 says there is exactly one light and it is the sun. That still holds for every SURFACE: the
   * moon casts nothing, bevels nothing, and moves no substrate. What it reaches is ink, and only at
   * night, which is the boundary OCCVM-L9 already draws.
   *
   * Low-precision lunar theory (Meeus ch. 47, principal terms). Accurate to roughly a degree, which is
   * far inside the tolerance of a light vector — the same argument SPINE.md §L3 already makes for
   * permitting a Fourier approximation of the sun's position but not a second implementation of it.
   *
   * ILLUMINATION IS NOT OPTIONAL. A moon above the horizon at new phase delivers no light at all, and a
   * model that lights the page by altitude alone would put a full moon's worth of ink glow into the
   * darkest night of the month. The phase is the elongation from the sun, so the sun's own longitude is
   * an input rather than a second sun.
   */
  function moon(lat, lon, date, sunLam) {
    var d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;   /* days since J2000 */
    var L = 218.316 + 13.176396 * d;                             /* mean longitude */
    var M = 134.963 + 13.064993 * d;                             /* mean anomaly */
    var F = 93.272 + 13.229350 * d;                              /* argument of latitude */
    var lam = (L + 6.289 * Math.sin(M * RAD)) * RAD;             /* ecliptic longitude */
    var bet = (5.128 * Math.sin(F * RAD)) * RAD;                 /* ecliptic latitude */
    var ec = 23.4397 * RAD;

    var dec = Math.asin(Math.sin(bet) * Math.cos(ec) + Math.cos(bet) * Math.sin(ec) * Math.sin(lam));
    var ra = Math.atan2(Math.sin(lam) * Math.cos(ec) - Math.tan(bet) * Math.sin(ec), Math.cos(lam));

    var lst = (280.16 + 360.9856235 * d + lon) * RAD;            /* local sidereal time */
    var H = lst - ra;
    var alt = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(H));
    var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat * RAD) - Math.tan(dec) * Math.cos(lat * RAD));
    az = (az / RAD + 180) % 360;                                  /* from south → clockwise from north */
    if (az < 0) az += 360;

    /* phase: elongation from the sun, illuminated fraction (1 − cos ψ)/2 — 0 at new, 1 at full */
    var elong = Math.abs(((lam / RAD - (sunLam === undefined ? 0 : sunLam)) % 360 + 540) % 360 - 180);
    var illum = (1 - Math.cos(elong * RAD)) / 2;

    return { alt: alt / RAD, az: az, illum: illum, elong: elong };
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

    /* OCCVM-L9, 1.7: the civil / nautical / astronomical dusk stages, additive over the ramp above —
       neither `night` nor `dusk` is redefined by this. Standard elevation boundaries, evaluated against
       the raw solar elevation rather than either compressed display quantity, so a tool can react to the
       actual stage independent of how steeply the surface response happens to be tuned. */
    var stage = elev >= 0 ? "day"
      : elev >= -6 ? "civil"
      : elev >= -12 ? "nautical"
      : elev >= -18 ? "astronomical"
      : "night";

    /* OCCVM-L9, 1.7 — the PHOSPHOR RESPONSE. Ink's answer to darkness is not linear in `night`, and the
       linear ramp it replaced was a placeholder that read as one: the page went on getting steadily more
       lit right through a range where the eye has already fully adapted. A phosphor's emission against
       its excitation saturates, and the standard form for that is 1 − e^(−kx), normalised so the ends
       stay exactly 0 and 1. It rises fast and then stops: 0.58 by a quarter of the way into night, 0.83
       by half, which is what "the tool becomes a night instrument quickly, then holds" looks like as a
       curve rather than as an intention. */
    var phosphor = (1 - Math.exp(-3.2 * night)) / (1 - Math.exp(-3.2));

    /* The moon reaches ink and nothing else (see moon(), above, and OCCVM-L9). Its weight is the product
       of three things that must ALL hold for there to be moonlight: it is above the horizon, it is lit,
       and the sun is gone. Any one of them missing and the term is zero — a moon at new, or below the
       horizon, or at noon, contributes exactly nothing rather than a little. */
    var mAlt = p.moon ? p.moon.alt : -90;
    var mUp = clamp(mAlt / 45, 0, 1);                       /* full weight once it is well up */
    var moonLight = p.moon ? mUp * p.moon.illum * night : 0;
    var mx = (p.moon && mAlt > 0) ? Math.sin(p.moon.az * RAD) : 0;
    var my = (p.moon && mAlt > 0) ? -Math.cos(p.moon.az * RAD) : 0;

    /* The night floor lives in ambient, not in elevation: a bevel stays legible after dark because
       ambient is 0.53 there, not because elevation is pretended to be 0.15 (D2). */
    var amb = 0.45 + 0.55 * e * (1 - night) + 0.18 * night;
    var rake = elev > 0 ? Math.min(22, 4 + 14 / Math.max(0.25, Math.tan(elev * RAD)) / 6) : 4;

    var sub = mix(mix(SUB, SUB_DUSK, dusk), SUB_NIGHT, night);
    var bone = mix(mix(BONE, BONE_DUSK, dusk), BONE_NIGHT, night);
    /* 1.7 — moonlight lifts ink toward its daylight value and nothing else on the page moves with
       it. This is the whole of the moon's authority over the surface (OCCVM-L9), and it is small
       on purpose: a full moon at the zenith recovers about a tenth of the way back toward day. */
    if (moonLight > 0) bone = mix(bone, BONE, 0.30 * moonLight);

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
      "--dusk-stage": stage,
      "--fill": amb.toFixed(3),
      "--rake": rake.toFixed(1) + "px",
      "--sheen": (0.25 + 0.55 * e * (1 - night)).toFixed(2),
      /* OCCVM-D12, closed at 1.2a — AMBIENT FILLS WHAT DIRECT LIGHT DOES NOT.
       *
       * 1.2 recorded that --elev's 0.15 night floor "moved" to --fill. It did not move; it was deleted.
       * --fill was computed, written, and read by nothing, while these two alphas — the bevel the floor
       * existed to hold up — collapsed to 0.060 after dark. The law's claim that "a bevel stays legible
       * after dark because ambient light is 0.53 there" was false in both halves: ambient held nothing
       * up, and the figure was 0.630 rather than 0.53. Found by 1.9's audit, which is what an audit is
       * for; it survived seven releases because a write-only token looks exactly like a working one.
       *
       * `(1 - e)` is the share of the surface direct light is NOT reaching, so ambient is admitted in
       * proportion to what the sun has left uncovered. At full sun the term is worth 0.007 and the
       * daylight frames barely move; after dark it is the whole of the bevel. */
      "--hi-a": (0.30 * e + 0.06 + 0.16 * amb * (1 - e)).toFixed(3),
      "--cut-a": (0.40 * e + 0.06 + 0.20 * amb * (1 - e)).toFixed(3),
      "--shade-a": (0.45 + 0.3 * e).toFixed(3),
      /* OCCVM-L9: the ink bloom, a resolved scalar and never a calc(), so a law can read it (D8). Since
         1.7 it rides the phosphor curve rather than `night` directly, and moonlight lifts it further —
         a lit night is a brighter-inked night, which is the one thing the moon is allowed to do here. */
      /* --glow is consumed as an OPACITY (Rhyme's .stone::before) and already reaches 1.0 on a
         moonless night, so a moon term here would be clamped away invisibly. Moonlight reaches ink
         through --bone and --nglow instead, both of which have headroom. Checked against the
         consumers rather than assumed. */
      "--glow": (0.45 + 0.25 * (1 - e) + 0.30 * phosphor).toFixed(3),
      "--phosphor": phosphor.toFixed(3),
      /* the moon: a secondary vector for ink only. --moon-light is zero unless it is up, lit, and dark. */
      "--moon-alt": mAlt.toFixed(2),
      "--moon-illum": (p.moon ? p.moon.illum : 0).toFixed(3),
      "--moon-light": moonLight.toFixed(3),
      "--moon-x": mx.toFixed(3),
      "--moon-y": my.toFixed(3),
      "--lxpx": (lx * 0.9).toFixed(2) + "px",
      "--lypx": (ly * 0.9).toFixed(2) + "px",
      /* the night halo: a blur radius in px, so it has room to carry the moon as well as the ramp */
      "--nglow": (6 * phosphor + 3 * moonLight).toFixed(2) + "px",
      "--nglow-s": (3 * phosphor + 1.5 * moonLight).toFixed(2) + "px",
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
    var when = date || new Date();
    var p = position(place.lat, place.lon, when);
    p.moon = moon(place.lat, place.lon, when, p.lam);
    var t = respond(p);
    if (el && el.style) for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) el.style.setProperty(k, t[k]);
    return {
      elev: p.elev, az: p.az, tokens: t,
      dir: DIRS[Math.round(p.az / 45) % 8],
      night: parseFloat(t["--night"]),
      stage: t["--dusk-stage"],
      lx: parseFloat(t["--lx"]), ly: parseFloat(t["--ly"]),
      e: parseFloat(t["--elev"]),
      name: place.name || "here"
    };
  }

  return { position: position, moon: moon, respond: respond, tick: tick, DAYTON: DAYTON, DIRS: DIRS };
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
/* OCCVM-L6 — the mineral set is one implementation, occvm/minerals.js, spliced above. This tool
   previously carried its own two-entry copy (no ruby: it had never needed a negative mineral), which was
   the "no local exceptions" gap OCCVM-D6 registered against this file. */
const MINERALS = OCCVM_MINERALS;
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
