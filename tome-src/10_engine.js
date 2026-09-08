/* ==== OCCVM SPINE yield.js — spliced from occvm/yield.js. do not edit. ==== */
/* sha256:45f7621c146e */
/* OCCVM 2.8 — yield. The shared BEHAVIOUR primitive for irreversible actions (OCCVM-L11), second basis.
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * Replaces occvm/fracture.js. A crystal past its limit CLEAVES along a plane its lattice decides; that
 * primitive split the element along aragonite's {110} angle and torqued the halves apart. A fluid has
 * no plane and no angle. What a yield-stress fluid does past its limit is YIELD: below τ₀ it holds and
 * nothing moves, at τ₀ it flows, and a filament of it that is pulled thins at one point — capillary
 * necking — until it PINCHES OFF into two bodies that retract from the break and come to rest. Three
 * phases, hold → neck → pinch-off, and the last is the one that makes the event irreversible: a
 * filament that has pinched does not rejoin.
 *
 * WHAT THE PRIMITIVE KEEPS FROM FRACTURE, because it was right for reasons that survive the substance:
 * a destructive action must not share a physical vocabulary with a reversible one. Everything else in
 * these tools fades, slides or settles, and those are elastic behaviours — elastic behaviour implies
 * the thing could come back. No fade at any point: yielded material does not become transparent, it
 * becomes absent. Two clones carrying the element's RESOLVED style, so an #id-styled element does not
 * pinch blank (1.1b's lesson, kept verbatim). Reduced motion honoured from the spine's rule. Seeded off
 * the element, so a replayed deletion looks the same and the golden set can pin one.
 *
 * WHAT DISTINGUISHES IT FROM THE ELASTIC VOCABULARY, now that speed does not. Fracture claimed "faster
 * than any elastic curve", and a fluid has no reason to be quick. The distinction is the STOP. Every
 * elastic easing in the system approaches rest asymptotically and never technically arrives; a
 * yield-stress fluid stops in finite time, at an exact instant, with the velocity reaching zero rather
 * than tending to it (rheology.js, `cessation`). The retraction here runs on that curve — sampled from
 * the integrated Herschel-Bulkley decay and handed to CSS as `linear()` — and it is the only motion in
 * either tool that ends. That is the vocabulary.
 *
 * WHAT IS AUTHORED, named. The roadmap wanted the duration derived from γ̇ = ((τ−τ₀)/k)^(1/n). With
 * n = 0.19 that exponent is 5.26 and a 100× range in stress spans 1.9e18 in rate: no monotone map from
 * that onto a few hundred milliseconds exists that is not doing all the work itself (rheology.js, 2.5).
 * So the millisecond counts below are authored, as fracture's 220 ms was, and the SHAPE of the
 * retraction is derived. The hold phase is zero for a click-driven action: the click is the stress, and
 * it is above τ₀ by definition — that is what makes it a deletion. A hold that is visible would read as
 * lag, not as a material refusing to move.
 *
 * SCOPE IS THE DISCIPLINE. Irreversible only — delete, discard, disconnect. Never a cancel, never a
 * dismiss, never a close. A vocabulary that marks everything marks nothing.
 */
var OCCVM_YIELD = (function () {
  "use strict";

  /* The substance, resolved at CALL time and never at load. fracture.js captured its dependency into a
     module binding while its IIFE ran; the splicer lands parts in reverse list order, so the binding was
     null in every browser and cleave() threw on every call for a release and a half while Node resolved
     it through require. A lazy read is order-independent, which is the property this needs. No fallback
     to a literal: a curve typed here would be a second copy of the derivation. */
  function substance() {
    var r = (typeof OCCVM_RHEOLOGY !== "undefined" && OCCVM_RHEOLOGY) ? OCCVM_RHEOLOGY
          : (typeof require !== "undefined" ? require("./rheology.js") : null);
    if (!r) throw new Error("occvm yield: rheology.js is not spliced beside this — no substance to yield");
    return r;
  }

  /* Authored, and named as authored: the thinning and the retraction, in milliseconds. */
  var NECK_MS = 140;
  var RETRACT_MS = 260;
  /* v₀ in the model's own units. It fixes the regime (rheology.js: k·v₀ⁿ/τ₀) and with it the exponent of
     the ease-out; at the substance's τ₀ any v₀ under ~3,000 is yield-dominated and the curve is the
     quadratic with a hard stop. Open item #12 stands: nothing maps a click onto this number. */
  var V0 = 1;

  function reduced() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

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

  /* The neck. The filament is the element's width; it thins at one point along it, `at` (percent of
     width), and the two bodies either side taper toward that point. Returned as the two clip polygons,
     in percent, for a given taper `t` (0 = untouched rectangle, 1 = drawn to a point). Same vertex
     count at every t, so CSS interpolates the polygon rather than snapping. */
  function halves(at, t) {
    var tp = 50 * t;                            /* how far each corner at the neck has moved toward mid-height */
    var L = "polygon(0% 0%," + at + "% " + tp + "%," + at + "% 50%," + at + "% " + (100 - tp) + "%,0% 100%)";
    var R = "polygon(100% 0%," + at + "% " + tp + "%," + at + "% 50%," + at + "% " + (100 - tp) + "%,100% 100%)";
    return [L, R];
  }

  /* the retraction's easing, from the substance — the one place the curve is decided */
  function easing() {
    var r = substance();
    return r.cssEasing(r.SUBSTANCE, V0);
  }

  /* pinch(el, done): the element necks at a point along its width, pinches off, and the two bodies
   * retract from the break on the cessation curve and STOP.
   *
   * Cloned twice rather than animated in place, because one box cannot move in two directions. The
   * original is hidden on the same frame the clones appear, so nothing is ever visible twice. */
  function pinch(el, done) {
    if (!el || !el.getBoundingClientRect) { if (done) done(); return; }
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) { if (done) done(); return; }

    if (reduced()) {                       /* the floor is the law's, not this primitive's */
      el.style.visibility = "hidden";
      if (done) done();
      return;
    }

    var seed = hash((el.id || "") + "|" + Math.round(box.width) + "x" + Math.round(box.height));
    var rnd = rng(seed);
    /* the neck forms somewhere in the middle third: a filament thins where it is thinnest, and a
       jittered point keeps two deletions of the same thing from pinching identically */
    var at = 35 + rnd() * 30;
    var whole = halves(at, 0), necked = halves(at, 1);
    var curve = easing();

    var host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:" + box.left + "px;top:" + box.top + "px;width:" +
      box.width + "px;height:" + box.height + "px;pointer-events:none;z-index:9999";

    var computed = window.getComputedStyle(el);
    for (var i = 0; i < 2; i++) {
      var part = el.cloneNode(true);
      part.removeAttribute("id");
      for (var k = 0; k < computed.length; k++) {
        var prop = computed[k];
        part.style.setProperty(prop, computed.getPropertyValue(prop));
      }
      part.style.cssText += ";position:absolute;left:0;top:0;margin:0;width:100%;height:100%" +
        ";clip-path:" + whole[i] +
        ";transition:clip-path " + NECK_MS + "ms linear,transform " + RETRACT_MS + "ms " + curve + " " + NECK_MS + "ms";
      host.appendChild(part);
    }
    document.body.appendChild(host);
    el.style.visibility = "hidden";

    requestAnimationFrame(function () {
      var kids = host.children;
      for (var i = 0; i < kids.length; i++) {
        /* the neck draws in, then each body retracts AWAY from the break along the filament's own axis —
           surface tension pulling a severed thread back into itself. No rotation: a fluid body has no
           edge to torque about. The retraction is a fraction of the body's own length, so a short
           element does not fly. */
        var s = i ? 1 : -1;
        var reach = box.width * (i ? (100 - at) : at) / 100;
        kids[i].style.clipPath = necked[i];
        kids[i].style.transform = "translateX(" + (s * reach * 0.55).toFixed(1) + "px)";
      }
    });

    setTimeout(function () {
      if (host.parentNode) host.parentNode.removeChild(host);
      if (done) done();
    }, NECK_MS + RETRACT_MS + 20);
  }

  return { pinch: pinch, halves: halves, easing: easing, NECK_MS: NECK_MS, RETRACT_MS: RETRACT_MS, V0: V0 };
})();
if (typeof module !== "undefined") module.exports = OCCVM_YIELD;
/* ==== END OCCVM yield.js ==== */

/* ==== OCCVM SPINE rheology.js — spliced from occvm/rheology.js. do not edit. ==== */
/* sha256:3df943fce21b */
/* OCCVM 2.5 — the rheological substance (OCCVM-L12, second basis).
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * Replaces occvm/material.js. The crystal basis (aragonite, orthorhombic) was not wrong and did not fail
 * a measurement; it is retired on the owner's aesthetic judgment, which is a legitimate call and is
 * recorded as one rather than dressed as a defect. What follows is what survives that decision, what
 * does not, and — the part the roadmap got wrong — what ports across intact.
 *
 * ─── the substance ───────────────────────────────────────────────────────────────────────────────
 *
 * Tomato ketchup, as a Herschel-Bulkley fluid: τ = τ₀ + k·γ̇ⁿ. Chosen over Carbopol, the cleaner
 * synthetic yield-stress fluid, because Carbopol is explicitly non-thixotropic while both tools' shipped
 * copy already describes a memory effect ("dilate instantly, contract slowly"). One substance that does
 * both jobs beats two that each do one.
 *
 * Beneath it, Soft Glassy Rheology (Sollich 1997/1998): mesoscopic elements caged in energy wells,
 * escaping by YIELDING over an activation barrier. Not a second substance — the same one, one level down,
 * and the reason `yield` is the right word for a destructive action rather than a metaphor for one.
 *
 * ─── WHAT THE ROADMAP SAID WOULD DIE, AND DOES NOT ───────────────────────────────────────────────
 *
 * The handoff records "elastic tensor and biaxial optics have no fluid equivalent — deleted, not ported."
 * The elastic tensor does die: a fluid has no stiffness, so P1's anisotropic motion goes with it, and
 * P1 shipped nothing anyway (2.1). **The optics do not die, and deleting them would have taken the
 * substrate's colour with them** — since 2.4 the sundial derives `--sub-hi` and `--sub-lo` by calling
 * `faceRatios()` every tick, so a substance with no refractive index does not simplify the tool, it
 * stops it painting.
 *
 * The port works because 2.4's mechanism was never biaxiality. It is that ONE slab presents THREE ANGLES
 * to the viewer, and Fresnel reflectance varies with angle at any fixed index. Aragonite happened to
 * supply three indices as well; that was a bonus, not the mechanism. Measured at L2's cut geometry:
 *
 *      n = 1.381        front 0°  R = 2.56%     chamfer 45°  R = 3.41%     edge 80°  R = 36.23%
 *      spread 14.148×   against aragonite's 9.353× and the 13.881× the tools actually render
 *
 * **The fluid fits the rendered substrate BETTER than the crystal did.** Aragonite needed a legibility
 * exponent of 1.177 to reach what the tools paint; ketchup reaches it at 0.9928 — within 1% of unity,
 * meaning the substance's own optics reproduce the shipped substrate with almost no judgment applied.
 * That is a stronger position than the model it replaces, and it was not the reason for the pivot.
 *
 * ─── why n is the best-sourced number here, and not a convenience ────────────────────────────────
 *
 * Tomato concentrate is graded in degrees Brix, and Brix in tomato products is DEFINED refractometrically
 * — the standard method measures refractive index and reads soluble solids off it. So n is not a property
 * somebody had to go looking for to make this model work; it is the property the industry already
 * measures ketchup by. Commercial ketchup runs ~28–33 °Brix; n = 1.381 is the ICUMSA value at 30 °Brix,
 * 20 °C. The Herschel-Bulkley triple is the control formulation of Koocheki et al. (2009), read off that
 * paper's Table 3 — see the block on it below, and the 2.10 correction that put it there.
 */
var OCCVM_RHEOLOGY = (function () {
  "use strict";

  var RAD = Math.PI / 180;
  var G = 9.81;   /* m/s² — the geometry below is a static balance against weight */
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---- the definition ---------------------------------------------------------------------------
   * Every value published and none chosen to fit: the flow triple from steady-shear rheometry, the
   * index from the refractometric Brix scale the product is graded on, density from composition tables.
   */
  var KETCHUP = {
    name: "ketchup",
    model: "Herschel-Bulkley",
    /* τ = τ₀ + k·γ̇ⁿ — Koocheki et al. 2009, control formulation, Table 3, 25 °C.
     *
     * 2.10 — k AND n WERE MISATTRIBUTED, AND THE PAPER WAS NEVER OPENED. From 2.5 to 2.9 this block
     * carried k = 4.6 and n = 0.19 as "the control formulation of Koocheki et al. (2009), fixed at the
     * published range floor". Checked against the paper: its Herschel-Bulkley consistency k′ ranges
     * **6.56–20.10 Pa·sⁿ** across every formulation and temperature it reports, so **4.6 is below the
     * entire published range and appears in that paper nowhere.** Its flow indices are n 0.189–0.228
     * (power law) and n′ 0.216–0.263 (Herschel-Bulkley); 0.19 is the floor of the POWER-LAW index across
     * hydrocolloid-supplemented samples, and it was being carried as the control's, paired with a
     * Herschel-Bulkley fit that reports 0.250. The control ketchup at 25 °C reads:
     *
     *     Herschel-Bulkley   τ₀ 4.41 Pa    k′ 16.18 Pa·sⁿ    n′ 0.250
     *     power law                        k  19.34 Pa·sⁿ    n  0.228
     *
     * The Herschel-Bulkley row is the one this model is named for, and it is what k and n now are. The
     * roadmap's τ₀ = 0.03 Pa is not in the paper either (its minimum is 2.18); the falsification below
     * stands on the physics regardless of where the figure came from.
     *
     * WHAT THE CORRECTION MOVED, measured rather than assumed (test/rheology.js pins each):
     *
     *     x = 1 − n            0.81 → 0.75      still < 1, so the glass phase and the yield stress hold
     *     1/n                  5.26 → 4.00      a 100× stress range still spans 10⁸ in shear rate, so
     *                                           the roadmap's duration formula stays unusable (#1 closed)
     *     regime at v₀ = 1     0.217 → 0.765    still < 1, so cessation stays yield-dominated and
     *                                           yield.js's curve stays the quadratic with a hard stop
     *     crossover v₀         3070 → 2.92      THE ONE CLAIM THAT CHANGED, and it is not cosmetic: the
     *                                           file used to say the regime was yield-dominated "for any
     *                                           v₀ under ~3,000". At the real constants the margin is
     *                                           2.92, and yield.js runs at v₀ = 1. Still inside it, with
     *                                           a thousandth of the headroom it was documented to have.
     *     trap depth 60s/300s  2.43/3.73 → 2.25/3.45
     *
     * Nothing that does not read k or n moves: λc = 7.15 px, the optical spread 14.148×, renderedContrast
     * 0.9928 and the vein dimension are all unchanged, because none of them is a function of the flow
     * curve. That containment is why the correction is publishable rather than a re-derivation.
     *
     * The lesson is the one this system keeps relearning and had not yet applied to a CITATION: every
     * number here was checked against what renders, and none of these three was checked against its
     * source. A provenance claim is a claim.
     *
     * τ₀ IS NOT THE RANGE FLOOR, AND THE FLOOR IS FALSIFIED BY THE SUBSTANCE'S OWN BEHAVIOUR.
     * The handoff fixes τ₀ at 0.03 Pa, "the published range floor", which reads as the conservative
     * choice and is instead the one value that breaks the model. A layer of yield-stress fluid stands on
     * a plate only while τ₀ ≥ ρgh, so at 0.03 Pa the tallest standing blob is **2.7 µm**: this ketchup
     * would sheet off the plate like water. Ketchup visibly does not. A 5 mm blob — what anybody would
     * call a dollop — needs τ₀ ≥ 55.9 Pa; even 1 mm needs 11.2. Three orders of magnitude, and it
     * matters beyond realism: a Herschel-Bulkley fluid with a negligible yield stress is just a
     * power-law fluid, and SGR's whole mechanism (caging, x < 1, escape over a barrier) needs a real
     * one. The floor deletes the property the model is named for.
     *
     * Re-entered by a consistency criterion rather than by preference or by position in the range: τ₀ is
     * the stress at which the yield-stress height equals the capillary length — the blob is exactly as
     * TALL as surface tension makes it ROUND. τ₀ = ρ·g·λc = 21.15 Pa. Judgment, named as judgment: the
     * criterion is a choice, the arithmetic under it is not.
     *
     * 2.10 — THE BAND THIS USED TO CITE HAD NO CITATION. It read "sits inside the published ~10–40 Pa
     * band without having been chosen from it", and no source for that band exists in either file or was
     * found on searching. What does exist, and what the value is now stated against: stress-ramp and
     * Casson yield stresses on commercial ketchup of 21.88 / 29.02 / 37.10 Pa (Ebatco lab note) and
     * 21.8 Pa (NETZSCH, secondary), and a creep plateau collapsing between ≈28 and ≈32 Pa (TA RH-058,
     * read off a figure — an estimate). 21.15 Pa sits at the foot of those. Note what they are: STATIC
     * yield stresses from ramps and creep, not the DYNAMIC Herschel-Bulkley intercept (4.41 Pa) that
     * k and n come from — the two are different quantities and this file pairs them, which is recorded
     * here rather than resolved, because a static yield stress is the right one for a substance at rest
     * and the wrong one to sit in a flow-curve triple. */
    tau0: 21.15,       /* Pa      — yield stress: below this the substance does not flow at all */
    k: 16.18,          /* Pa·sⁿ   — consistency index k′, Koocheki Table 3, control, 25 °C (was 4.6, 2.10) */
    n: 0.250,          /* —       — flow index n′, same row; n < 1 is shear-thinning (was 0.19, 2.10) */
    brix: 30,          /* °Bx     — soluble solids, the grade ketchup is sold by */
    ri: 1.381,         /* —       — refractive index at 30 °Bx, 20 °C (ICUMSA); see header */
    density: 1.14,     /* g/cm³ */
    /* Surface tension. THE LEAST-SOURCED NUMBER IN THIS FILE and flagged as such: aqueous food systems
       carrying solids and surfactants run well below water's 0.072, and 0.04 N/m is a mid-range estimate
       rather than a measurement of ketchup. It is tolerable because the geometry it feeds goes as √γ:
       being wrong by 2× moves the derived radius by 1.41×, from 7.1 px to 5.7 or 9.6. Stated so nobody
       reads the radius as tighter than its input. */
    gamma: 0.040,      /* N/m — estimate, see note */
    /* THE BODY COLOUR, and it is judgment, named as judgment exactly as the crystal model named its own.
       A fluid's colour comes from what is dissolved in it, not from its flow curve, so no amount of
       rheology produces this. It stays anchored to OCCVM-L1's declared substrate floor — the same anchor,
       for the same reason, and with the same objection standing: fixing a free parameter FROM the tools
       is a fit, and a free parameter has to be fixed from something. */
    body: "#0e0d13"
  };

  /* The substance under its ROLE rather than its identity. The sundial reads this, not `KETCHUP`, so the
     light pipeline names what a thing does in the system instead of what it is made of — and a second
     substance swap costs one splice-list line rather than an edit to every consumer. The pivot from
     aragonite cost more than it should have precisely because the consumers named the mineral. */
  var SUBSTANCE = KETCHUP;

  /* ---- optics: ported from the crystal model, mechanism unchanged --------------------------------
   * Unpolarised Fresnel reflectance. A fluid is isotropic, so one index serves all three faces — and the
   * faces still separate, because the angle is what varies. This is the whole of the port.
   */
  function fresnel(n, thetaDeg) {
    var th = clamp(thetaDeg, 0, 89.9) * RAD;
    var s = Math.sin(th), c = Math.cos(th);
    var k = Math.sqrt(Math.max(0, 1 - (s / n) * (s / n)));
    var rs = Math.pow((c - n * k) / (c + n * k), 2);
    var rp = Math.pow((k - n * c) / (k + n * c), 2);
    return (rs + rp) / 2;
  }

  /* The angles are OCCVM-L2's cut geometry, unchanged from 2.4: the flat front, the chamfer L2 permits,
     and the edge seen near tangent. The crystal model paired each with a principal index and flagged that
     pairing as a convention; a fluid has one index, so THE CONVENTION IS GONE. One fewer authored
     decision, which is a small real gain from the pivot and worth naming as one. */
  var CUT = { front: 0, chamfer: 45, edge: 80 };

  function faces(m) {
    var n = m.ri;
    return {
      front:   { theta: CUT.front,   R: fresnel(n, CUT.front) },
      chamfer: { theta: CUT.chamfer, R: fresnel(n, CUT.chamfer) },
      edge:    { theta: CUT.edge,    R: fresnel(n, CUT.edge) }
    };
  }

  /* ---- resolve ----------------------------------------------------------------------------------
   * A reflectance ratio is a ratio in LINEAR light. Kept verbatim from the crystal model, including the
   * reason: the first version of that resolver scaled sRGB bytes and rendered a 9.35× spread as 116×,
   * the transfer function applied twice, while shifting hue as one channel saturated before another.
   */
  function srgbToLinear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function linearToSrgb(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function parse(h) { return [1, 3, 5].map(function (i) { return srgbToLinear(parseInt(h.substr(i, 2), 16) / 255); }); }
  function hex(c) {
    return "#" + c.map(function (v) {
      return clamp(Math.round(linearToSrgb(clamp(v, 0, 1)) * 255), 0, 255).toString(16).padStart(2, "0");
    }).join("");
  }

  /* The spread the tools actually paint at high sun — a NAMED rendered instant, never the `:root`
     fallback. That distinction is the one 2.3 got wrong and 2.4 corrected, and it carries across the
     pivot unchanged because it is a fact about the tools, not about the substance. */
  var RENDERED_SPREAD_HIGH = 13.881;

  function substrate(m, contrast) {
    var k = contrast === undefined ? renderedContrast(m) : contrast;
    var f = faces(m);
    var base = f.front.R;
    var body = parse(m.body);
    function face(R) {
      var gain = Math.pow(R / base, k);
      return hex(body.map(function (v) { return v * gain; }));
    }
    return {
      hi: face(f.edge.R), mid: face(f.chamfer.R), lo: face(f.front.R),
      R: { front: f.front.R, chamfer: f.chamfer.R, edge: f.edge.R },
      spread: Math.pow(f.edge.R / base, k),
      ratios: [Math.pow(f.edge.R / base, k), Math.pow(f.chamfer.R / base, k), 1]
    };
  }

  /* The legibility exponent, derived rather than typed. It reads 0.991 for ketchup against 1.177 for
     aragonite: the fluid's own optics land within 1% of what the tools paint, so almost no judgment is
     applied. A value this close to unity is worth stating plainly — it means the substance is carrying
     the substrate essentially unaided, which the crystal was not. */
  function renderedContrast(m) {
    var f = faces(m);
    return Math.log(RENDERED_SPREAD_HIGH) / Math.log(f.edge.R / f.front.R);
  }

  /* The two face offsets the sundial applies, relative to the base colour it owns. Same signature as the
     crystal model's, so the sundial needs no change beyond which global it reads. */
  function faceRatios(m, contrast) {
    var r = substrate(m, contrast).ratios;
    return { hi: r[0] / r[1], lo: 1 / r[1] };
  }

  /* ---- flow -------------------------------------------------------------------------------------
   * The Herschel-Bulkley inverse: given an applied stress, the shear rate that results. Below the yield
   * stress there is no flow at all — not slow flow, NONE — which is the property `yield.js` is built on
   * and the reason a destructive action can have an inert phase that is physically real rather than a
   * designed pause.
   */
  function shearRate(m, tau) {
    if (tau <= m.tau0) return 0;
    return Math.pow((tau - m.tau0) / m.k, 1 / m.n);
  }
  function stress(m, gammaDot) {
    return m.tau0 + m.k * Math.pow(Math.max(0, gammaDot), m.n);
  }

  /* ---- geometry: what a fluid puts on an edge --------------------------------------------------
   *
   * OCCVM-L2 reads "a surface is **cut, not rounded**. Corner radius ≤ 4px." That is the most directly
   * crystalline sentence in the law, and it is why swapping the substance changed nothing visible: 2.5
   * step A ported the OPTICS and kept the GEOMETRY, so the tools went on presenting a 45° chamfer and a
   * faceted edge while claiming to be made of a fluid. Changing what a surface is made of while keeping
   * its shape is not a material change, and the measurement said so — the substance reaches 2 of 70
   * rendered tokens, through one gradient stop.
   *
   * A fluid at rest does not present facets. Two real lengths decide its edge, and neither is authored:
   *
   *   CAPILLARY LENGTH  λc = √(γ/ρg) — where surface tension stops losing to gravity. Below it a free
   *   surface is rounded by tension; above it gravity flattens it into a puddle. For this substance
   *   λc = 1.891 mm, which is **7.1 CSS px at 96 dpi**. That number is not fitted and not tuned: it is
   *   what the substance's own density and surface tension produce, and it happens to land in the range
   *   a UI radius lives in. (Contrast the retired electromagnetic layer, whose Debye length came out at
   *   0.43 nm — seven orders too small to be a UI dimension. The difference is not luck about which
   *   physics was picked; it is that capillarity is a millimetre-scale phenomenon and screens are
   *   millimetre-scale objects.)
   *
   *   PUDDLE HEIGHT  h = τ₀/ρg — the tallest layer the yield stress can hold against its own weight.
   *   At the corrected τ₀ this equals λc by construction, which is what fixed τ₀ in the first place.
   *
   * **The radius is therefore larger than the crystal's ceiling, not smaller, and that is the point.**
   * L2 capped radius at 4px because a cut mineral holds a sharp arris. A fluid cannot: surface tension
   * rounds every edge to λc whether the designer wants it or not. 7.1 px against 4 px is the visible
   * consequence of the pivot, and unlike the substrate ramp it lands on every slab, tile, control and
   * binding in both tools rather than on one gradient stop. */
  function capillaryLength(m) { return Math.sqrt(m.gamma / (m.density * 1000 * G)); }
  function puddleHeight(m) { return m.tau0 / (m.density * 1000 * G); }
  /* CSS px at the reference 96 dpi, where 1 px = 25.4/96 mm. A physical length only becomes a UI length
     through a stated conversion; putting it here means the conversion is visible rather than folded into
     a constant somebody later reads as a design choice. */
  var MM_PER_PX = 25.4 / 96;
  function radiusPx(m) { return capillaryLength(m) * 1000 / MM_PER_PX; }
  /* The stress a layer of height h exerts at its own base — the test that falsified the range floor. */
  function standingStress(m, heightMm) { return m.density * 1000 * G * heightMm / 1000; }

  /* ---- Soft Glassy Rheology ----------------------------------------------------------------------
   * CLOSES OPEN ITEM #5, which asked whether SGR's noise temperature x derives from τ₀/k/n or needs a
   * second authored constant. It derives, and the sign is fixed by physics rather than by preference.
   *
   * In Sollich's SGR, x is the effective noise temperature and x = 1 is the glass transition. A yield
   * stress exists ONLY in the glass phase, x < 1; above it the material is a power-law fluid with no
   * yield stress at all. Ketchup has a measured yield stress, so x < 1 is not a choice — it is a
   * constraint the substance imposes, and any value at or above 1 would contradict τ₀ > 0.
   *
   * Near the transition the Herschel-Bulkley exponent and the noise temperature are complementary,
   * n = 1 − x, giving **x = 0.75 for n = 0.250** (it read 0.81 for the misattributed n = 0.19 until 2.10).
   *
   * 2.10 — THIS FILE UNDERSTATED ITS OWN DERIVATION, which is the rarer direction and is corrected for
   * the same reason an overclaim would be. It called n = 1 − x "the exact functional form, the judgment".
   * It is not: it is Sollich's own result — in the SGR glass phase the flow curve goes
   * σ = σ_y + O(γ̇^(1−x)), so identifying the exponent of a Herschel-Bulkley fit with 1 − x is reading
   * the theory, not choosing a form. **The judgment that remains, and it is a real one, is the
   * IDENTIFICATION**: equating an asymptotic SGR exponent with a coefficient fitted over a finite range
   * of shear rates on a real rheometer. That is what is flagged, and it is flagged here rather than
   * where it was. What is not judgment either way: x sits below 1, which is where a substance that
   * yields but only just is supposed to sit.
   */
  function noiseTemperature(m) { return 1 - m.n; }
  function inGlassPhase(m) { return noiseTemperature(m) < 1; }

  /* ---- vein habit --------------------------------------------------------------------------------
   * occvm/veins.js grows by diffusion-limited CLUSTER aggregation since 2.8 — every particle mobile,
   * clusters sticking to clusters — which is how a colloidal suspension actually gels and is what
   * ketchup is: a particulate gel. The {110} twin angle was a fact about a lattice and has no fluid
   * counterpart; nothing replaces it as an INPUT, because DLCA takes no constant from the substance.
   *
   * The fractal dimension is an OUTPUT of the process, and the literature values are recorded here so
   * the generator can be measured against them rather than quoted as if it produced them:
   *
   *   DLCA_D          1.75   three dimensions, gold colloids, Weitz & Oliveria 1984 — the figure the
   *                          roadmap carries. Lin et al. 1989 put the same regime at 1.86 and the
   *                          reaction-limited one at 2.1. None of these is reachable on a 2-D lattice.
   *   DLCA_D_LATTICE  1.44   two dimensions, Meakin 1983 / Kolb, Botet & Jullien 1983 — what a planar
   *                          simulation of the same mechanism produces in the dilute limit, and the
   *                          number test/occvm.js holds the generator to at low density.
   *
   * At the density the tools ship (.3) the suspension is past its gel point and the measured dimension
   * climbs toward 2 above the correlation length, as it must — a gel is space-filling at large scale
   * and fractal only below ξ. Measured 1.61 at .3 against 1.45 at .15 (test/occvm.js). That is not a
   * discrepancy with the literature; it is the difference between a floc and a gel, and the reference
   * surface's L10 specimens now show exactly that transition.
   *
   * The twin angle also fed occvm/fracture.js, which cleaved along it. Retiring the angle retired
   * fracture's geometry with it, which is why occvm/yield.js replaced fracture wholesale (2.8).
   */
  var DLCA_D = 1.75;
  var DLCA_D_LATTICE = 1.44;
  function fractalDimension() { return DLCA_D; }

  /* ---- cessation: how disturbed material comes to rest ---------------------------------------------
   * A Newtonian fluid never stops: its velocity decays exponentially and only approaches zero. A
   * yield-stress fluid STOPS, in finite, provable time (Huilgol, Mena & Piau 2002 for Bingham; the
   * Herschel-Bulkley case follows the same argument). The roadmap's reduced model, unit effective mass:
   *
   *      dv/dt = −(τ₀ + k·vⁿ)
   *
   * with the analytic bracket  v₀/(τ₀ + k·v₀ⁿ) ≤ t_stop ≤ v₀/τ₀. Both are reproduced here and the
   * integration is checked against both (test/rheology.js).
   *
   * WHAT THE DERIVATION ACTUALLY DECIDES, and what it does not. The roadmap read the shape as "normal
   * deceleration, then a linear terminal phase" and attributed the tightness of the lower bound to the
   * yield term dominating. Measured, the opposite holds at the roadmap's τ₀ = 0.03 Pa: the rate term
   * k·vⁿ is larger than τ₀ until v falls to 3e-12, so the yield term governs the last 10⁻¹² of the
   * decay and nothing else — the lower bound is tight because n = 0.19 makes vⁿ nearly flat, so the
   * RATE term stays at its maximum. At the τ₀ this file carries (21.15 Pa), the yield term governs from
   * t = 0 for any v₀ below about 3,000. Two regimes, one ratio deciding between them: k·v₀ⁿ/τ₀.
   *
   * Both regimes stop in finite time and both have a closed form for the POSITION, which is what an
   * easing curve is:
   *
   *      yield-dominated  (k·v₀ⁿ ≪ τ₀)   v = v₀ − τ₀t         s(u) = 1 − (1−u)²
   *      rate-dominated   (k·v₀ⁿ ≫ τ₀)   v^(1−n) linear in t  s(u) = 1 − (1−u)^(1 + 1/(1−n))  = 1 − (1−u)^2.235
   *
   * So the shape is a power ease-out with a HARD STOP — velocity reaches zero exactly at u = 1, which no
   * cubic-bezier keyword does — and the exponent lies between 2 and 2.235. The roadmap's "linear
   * terminal phase" is the yield-dominated velocity, whose position is the quadratic; it is not a third
   * phase. `easing()` samples the integrated curve for CSS `linear()`, which encodes either exactly.
   *
   * WHAT IS AUTHORED, named as such. v₀ is the roadmap's open item #12: no derivation maps a UI
   * disturbance onto an initial velocity, and with v₀ free the regime — hence the exponent — is chosen
   * by choosing v₀. The absolute duration is the same story one step on: t_stop is in the model's own
   * units, and a real millisecond count needs a scale nothing here supplies. The primitive therefore
   * takes its DURATION as an authored constant, exactly as fracture's 220 ms was, and takes its SHAPE
   * from here. That is the honest split: the derivation owns the curve and the hard stop; a person owns
   * how long it lasts. Stating it this way is what keeps the exponent from being quietly tuned to a
   * wanted feel and called physics.
   */
  function decel(m, v) { return m.tau0 + m.k * Math.pow(Math.max(v, 0), m.n); }
  function stoppingBracket(m, v0) { return { lo: v0 / decel(m, v0), hi: v0 / m.tau0 }; }
  function stoppingTime(m, v0, dt) {
    dt = dt || v0 / decel(m, v0) / 2000;
    var v = v0, t = 0;
    while (v > 0) { v -= decel(m, v) * dt; t += dt; }
    return t;
  }
  /* position fraction at `samples` evenly spaced time fractions, 0 → 1 inclusive; the curve CSS needs */
  function easing(m, v0, samples) {
    samples = samples || 17;
    var T = stoppingTime(m, v0), dt = T / 4000, v = v0, t = 0, x = 0, pts = [0], next = 1;
    while (t < T && next < samples) {
      v = Math.max(0, v - decel(m, v) * dt); x += v * dt; t += dt;
      if (t >= T * next / (samples - 1)) { pts.push(x); next++; }
    }
    var X = pts[pts.length - 1] || 1;
    while (pts.length < samples) pts.push(X);
    return pts.map(function (p) { return +(p / X).toFixed(4); });
  }
  /* the regime this v₀ lands in: the ratio that decides the exponent */
  function regime(m, v0) { return m.k * Math.pow(v0, m.n) / m.tau0; }
  function cssEasing(m, v0) {
    return "linear(" + easing(m, v0, 17).join(", ") + ")";
  }

  /* ---- trap depth: CLOSES OPEN ITEM #4 -------------------------------------------------------------
   * The roadmap records "no formula converts a poll interval to an energy". SGR has one: an element
   * caged in a well of depth E escapes at a rate ∝ exp(−E/x), so its residence time is
   * τ = τ_a · exp(E/x) and E = x · ln(τ/τ_a). A cadence is a residence time, and the fastest tier is
   * the attempt time τ_a — the reference from which the others are measured, at depth 0. With x = 1−n:
   *
   *      exchange feeds   3 s      E = 0
   *      CoinGecko       60 s      E = 0.81 · ln 20  = 2.43
   *      Kalshi ladder  300 s      E = 0.81 · ln 100 = 3.73
   *
   * in units of x·kT. Derived, and CONSUMED BY NOTHING — recorded here for the same reason P1's
   * durations were: the arithmetic is right, and wiring it before a surface expresses it would be a
   * token nobody reads (OCCVM-D12). The roadmap's item #7, the scale mismatch of applying ensemble
   * statistics to six named elements, stands and is not answered by this.
   */
  function trapDepth(m, periodMs, attemptMs) {
    return noiseTemperature(m) * Math.log(periodMs / attemptMs);
  }

  return {
    KETCHUP: KETCHUP, SUBSTANCE: SUBSTANCE, CUT: CUT, RENDERED_SPREAD_HIGH: RENDERED_SPREAD_HIGH, DLCA_D: DLCA_D,
    fresnel: fresnel, faces: faces, substrate: substrate,
    renderedContrast: renderedContrast, faceRatios: faceRatios,
    shearRate: shearRate, stress: stress,
    capillaryLength: capillaryLength, puddleHeight: puddleHeight,
    radiusPx: radiusPx, standingStress: standingStress, MM_PER_PX: MM_PER_PX,
    noiseTemperature: noiseTemperature, inGlassPhase: inGlassPhase,
    DLCA_D_LATTICE: DLCA_D_LATTICE, fractalDimension: fractalDimension,
    decel: decel, stoppingBracket: stoppingBracket, stoppingTime: stoppingTime, easing: easing,
    regime: regime, cssEasing: cssEasing, trapDepth: trapDepth
  };
})();
if (typeof module !== "undefined") module.exports = OCCVM_RHEOLOGY;
/* ==== END OCCVM rheology.js ==== */

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
/* sha256:f96ae350d96b */
/* OCCVM 1.1 → 2.8 — the vein generator. One implementation, shared by every conforming tool (OCCVM-L10).
 *
 * Authored in occvm/SPINE.md; spliced into a tool by occvm/tools/splice-spine.js. Do not hand-edit the
 * spliced copy — the next splice reverts it silently.
 *
 * Veins are GROWN, not drawn. Both tools drew three displaced cubic beziers and called the result a
 * mineral vein; a bezier is a shape that resembles the outcome, and the eye eventually catches the
 * smooth curvature because nothing in a real aggregate is smooth at every scale.
 *
 * 2.8 — THE MECHANISM CHANGED WITH THE SUBSTANCE. From 1.1 to 2.7 this was particle-cluster DLA: a
 * fixed aggregate seeded at a few nuclei, walkers arriving one at a time and sticking. That is how a
 * crystal grows from a nucleation point, and it was grown as one — aragonite's cyclic twin, with the
 * {110} angle read from the material's unit cell. A fluid has no lattice, no nucleus and no angle, and
 * a colloidal suspension does not aggregate that way. Ketchup is a particulate gel: tomato cell-wall
 * fragments in suspension, every one of them diffusing, sticking to each other on contact, the clusters
 * they form diffusing in turn until the whole suspension has joined into one network. That is
 * DIFFUSION-LIMITED CLUSTER AGGREGATION (Meakin 1983; Kolb, Botet & Jullien 1983), and it is what this
 * file now simulates: every particle starts mobile, every cluster moves as a rigid body with a mobility
 * that falls with its size, and two clusters that touch become one.
 *
 * What that does to the picture, measured rather than asserted (test/occvm.js): the vein layer stops
 * being a few dendrites radiating from points in clear matrix and becomes a network SUSPENDED IN the
 * material — open, tenuous, everywhere at once. The roadmap's own visual note (§5.4) asked for exactly
 * that, and it turns out not to be a rendering choice; it is what the mechanism produces at the density
 * the tools already ship. At `--vein-density .3` the suspension is above its gel point and the clusters
 * span the field; at .15 they are separate flocs with matrix between them; at .08 they are isolated.
 * The axis a fluid has is CONCENTRATION, and the reference surface's specimens now run along it.
 *
 * `--vein-habit` IS RETIRED, and the reason is a measurement, not a preference. The crystal's habit was
 * attachment anisotropy — which crystallographic directions accept a particle — and a fluid has no
 * directions to be anisotropic along. The one axis colloid science does offer, the sticking probability
 * that separates diffusion-limited from reaction-limited aggregation (Lin et al. 1989: D_f 1.86 → 2.1
 * in three dimensions), was tried here as the token's new meaning and DOES NOT EXPRESS on this lattice:
 * at the shipped density the mass-radius dimension moved 1.61 → 1.54 across a 20× range in sticking
 * probability, and in the dilute regime 1.38 → 1.39, inside the estimator's own error both times. A
 * token whose effect is below measurement is OCCVM-D12 with a physical story attached. `field()` still
 * accepts `habit` and ignores it, so a caller written against 1.1 does not throw; the spine carries the
 * declaration one minor cycle marked deprecated per its versioning contract, and nothing reads it.
 *
 * Seeded and pure. Same seed plus same parameters yields the same bytes, which is what the golden set
 * and the injected session seed exist for (SPINE.md section 4). No substance module is read: DLCA takes
 * no constant from the fluid, and the fractal dimension is an OUTPUT of the process, measured in the
 * tests against the literature, never an input to it. That also removes the load-order dependency that
 * had material.js needing to precede this file.
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

  /* grow(): cluster-cluster aggregation on a lattice.
   *
   *   w, h     lattice; the surface wraps vertically and has walls at the sides, as before
   *   n        particle count — the volume fraction times the lattice
   *   seed     mulberry32 seed
   *   stick    probability that a contact becomes a bond (1 = diffusion-limited). Accepted, measured,
   *            and not exposed as a token — see the header.
   *   target   stop when this many clusters remain. The suspension is not driven to a single cluster,
   *            because a gel is a network of many flocs that have joined, and the last few merges are
   *            the slowest by a wide margin (a cluster's mobility falls as s^-½).
   *   budget   a hard cap on steps, so a pathological seed cannot hang a page
   *
   * Every particle begins as its own cluster at a random empty site. Each step picks a cluster at
   * random, moves it one lattice step in a random direction as a rigid body — accepted with probability
   * s^-½, the standard size-dependent mobility, so a monomer moves every time it is picked and a cluster
   * of a hundred moves one time in ten — and then looks for contact with any other cluster on the Moore
   * neighbourhood of every particle it moved. A contact merges the two with probability `stick`. The
   * bond recorded is the pair of particles that touched, kept as INDICES rather than coordinates: the
   * clusters keep moving after they join, and a bond stored as a position at the moment of contact is
   * wrong the next time either of its ends moves (the prototype did exactly that and rendered confetti).
   */
  function grow(o) {
    var w = o.w | 0, h = o.h | 0;
    var n = o.n | 0;
    var stick = o.stick === undefined ? 1 : Math.max(0.005, Math.min(1, o.stick));
    var target = o.target === undefined ? 8 : Math.max(1, o.target | 0);
    var budget = o.budget === undefined ? 400000 : o.budget | 0;
    var rnd = mulberry32(o.seed >>> 0);

    var occ = new Int32Array(w * h);            /* particle index + 1, or 0 */
    var px = new Int16Array(n), py = new Int16Array(n), cid = new Int32Array(n);
    var members = [];                           /* cluster id -> array of particle indices, or null */
    var placed = 0, tries = 0, i, m, q;
    while (placed < n && tries < n * 50) {
      tries++;
      var x = 1 + ((rnd() * (w - 2)) | 0), y = (rnd() * h) | 0, k = y * w + x;
      if (occ[k]) continue;
      occ[k] = placed + 1; px[placed] = x; py[placed] = y; cid[placed] = placed;
      members.push([placed]); placed++;
    }
    n = placed;
    var alive = [];
    for (i = 0; i < n; i++) alive.push(i);

    var bonds = [], clusters = n, steps = 0;
    var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    function wrapY(v) { return v < 0 ? v + h : (v >= h ? v - h : v); }

    while (clusters > target && steps < budget) {
      steps++;
      var ai = (rnd() * alive.length) | 0, c = alive[ai], mem = members[c], s = mem.length;
      if (s > 1 && rnd() > 1 / Math.sqrt(s)) continue;   /* mobility ∝ s^-½ */
      var d = (rnd() * 4) | 0, dx = DX[d], dy = DY[d];

      /* can the whole cluster take the step? a wall or another cluster in the way blocks it */
      var blocked = false, contacts = [];
      for (m = 0; m < s; m++) {
        q = mem[m];
        var nx = px[q] + dx, ny = wrapY(py[q] + dy);
        if (nx < 1 || nx > w - 2) { blocked = true; break; }
        var o2 = occ[ny * w + nx];
        if (o2 && cid[o2 - 1] !== c) { blocked = true; contacts.push(q, o2 - 1); }
      }
      if (!blocked) {
        for (m = 0; m < s; m++) { q = mem[m]; occ[py[q] * w + px[q]] = 0; }
        for (m = 0; m < s; m++) { q = mem[m]; px[q] += dx; py[q] = wrapY(py[q] + dy); occ[py[q] * w + px[q]] = q + 1; }
        /* Moore contact: diagonal touch bonds too, or the network reads as circuit routing (1.1) */
        for (m = 0; m < s; m++) {
          q = mem[m];
          for (var j = 0; j < 8; j++) {
            var ddx = (j === 0 || j === 3 || j === 5) ? -1 : (j === 2 || j === 4 || j === 7) ? 1 : 0;
            var ddy = (j === 0 || j === 1 || j === 2) ? -1 : (j === 5 || j === 6 || j === 7) ? 1 : 0;
            var xx = px[q] + ddx, yy = wrapY(py[q] + ddy);
            if (xx < 0 || xx >= w) continue;
            var o3 = occ[yy * w + xx];
            if (o3 && cid[o3 - 1] !== c) contacts.push(q, o3 - 1);
          }
        }
      }
      if (contacts.length && rnd() < stick) {
        var seen = {};
        for (var t = 0; t < contacts.length; t += 2) {
          var a = contacts[t], b = contacts[t + 1], cb = cid[b];
          if (cb === c || seen[cb]) continue;
          seen[cb] = 1;
          bonds.push(a, b);
          var mb = members[cb];
          for (m = 0; m < mb.length; m++) { cid[mb[m]] = c; mem.push(mb[m]); }
          members[cb] = null; clusters--;
          var idx = alive.indexOf(cb);
          alive[idx] = alive[alive.length - 1]; alive.pop();
        }
      }
    }

    /* resolve bonds to where the particles ENDED, not where they met */
    var segs = [];
    for (i = 0; i < bonds.length; i += 2) {
      var A = bonds[i], B = bonds[i + 1];
      segs.push(px[A], py[A], px[B], py[B]);
    }
    return { segs: segs, bonds: bonds, w: w, h: h, particles: n, clusters: clusters, steps: steps,
             px: px, py: py, cid: cid, members: members };
  }

  /* paths(): trace the aggregate. Every stroke is a straight segment between two particles that bonded
   * — the record of how it formed. No curve is fitted over it, because a fitted curve is the bezier
   * coming back in through the renderer.
   */
  function paths(g, o) {
    var sc = o.scale || 1, jx = o.ox || 0, jy = o.oy || 0;
    /* The lattice is a discretisation of the walk, not a fact about the substance, so the trace carries
       a deterministic sub-cell offset per particle. It breaks the grid without fitting a curve. */
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

  /* field(): the whole vein layer as raw SVG, so both tools share the assembly and not just the growth.
   *
   * Two strokes over one path, as since 1.1 — but the wide, deep one is now BLURRED and the fine one
   * sits lower in opacity. A crystal vein is a seam in a solid and reads crisp; a floc is suspended in
   * a fluid and has no hard boundary against it. `soft` is the blur's standard deviation in viewBox
   * units; 0 restores the seam. This is the one authored rendering value in the file and is named as
   * one — the mechanism gives the structure, not the focus.
   *
   * density is the volume fraction: the particle count as a fraction of the lattice. It is the same
   * number `--vein-density` has always been (a walker budget was the same fraction under the old
   * mechanism); only what it means physically has sharpened. `habit` is accepted and ignored (header).
   *
   * RETURNS RAW SVG. The caller must encodeURIComponent it before putting it in a url(). Both the
   * fragment references and the colours carry a literal "#", and a "#" left raw inside a data: URI ends
   * the URI at a fragment — while pre-encoding it to %23 leaves the parsed SVG holding the two literal
   * characters "%23", so href="%23v" resolves to nothing and the layer renders empty. That failure is
   * invisible to a token diff and to any check that only looks for the string: it has to be looked at.
   */
  function field(o) {
    var w = o.w || 110, h = o.h || 70;
    var density = o.density === undefined ? 0.3 : Math.max(0.02, Math.min(0.6, o.density));
    var g = grow({ w: w, h: h, n: Math.round(w * h * density), seed: o.seed, stick: o.stick, target: o.target });
    if (g.segs.length < 8) throw new Error("occvm veins: suspension did not aggregate");
    var d = paths(g, { scale: (o.viewW || 1200) / w, seed: o.seed });
    var soft = o.soft === undefined ? 1.4 : Math.max(0, o.soft);
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + (o.viewW || 1200) + " " +
      (o.viewH || Math.round((o.viewW || 1200) * h / w)) + "' preserveAspectRatio='none'>" +
      "<defs><path id='v' d='" + d + "'/>" +
      (soft > 0 ? "<filter id='s' x='-3%' y='-3%' width='106%' height='106%'><feGaussianBlur stdDeviation='" + soft + "'/></filter>" : "") +
      "</defs>" +
      "<g fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
      "<use href='#v' stroke='" + (o.lo || "#1c6a45") + "' stroke-width='" + (o.wide || 4.5) + "' opacity='.55'" + (soft > 0 ? " filter='url(#s)'" : "") + "/>" +
      "<use href='#v' stroke='" + (o.hi || "#3fbf7e") + "' stroke-width='" + (o.fine || 1.3) + "' opacity='.7'/>" +
      "</g></svg>";
    return { svg: svg, particles: g.particles, clusters: g.clusters, bonds: g.segs.length / 4 };
  }

  return { grow: grow, paths: paths, field: field, mulberry32: mulberry32 };
})();
if (typeof module !== "undefined") module.exports = OCCVM_VEINS;
/* ==== END OCCVM veins.js ==== */

/* ==== OCCVM SPINE sundial.js — spliced from occvm/sundial.js. do not edit. ==== */
/* sha256:53ee71c1edf1 */
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


  /* ── OCCVM-L12 adopted, 2.4 — the substrate's two face offsets are the material's, not authored ──
   *
   * Until 2.4 these were `0.14 * (0.5 + e)` toward white and a flat `0.42` toward black: two magic
   * numbers with no derivation, and the last authored values in the substrate. The material supplies
   * them now, as luminance ratios relative to the base colour this file owns.
   *
   * THE DIVISION OF LABOUR IS 2.0's AND IS UNCHANGED: the material owns STRUCTURE — how far the lit and
   * shaded faces sit from the base — and the sundial owns MAGNITUDE, which is the base colour itself and
   * the `(0.5 + e)` directionality term kept below. That term is not decoration: specular contrast
   * between faces genuinely depends on how directional the light is, so a face ratio that ignored the sun
   * would flatten the day. Measured, adopting the material's ratio WITHOUT it moves the noon highlight
   * -7.9 L* and raises night contrast +8.0 — it does not flatten uniformly, it inverts the day.
   *
   * THE OPERATION STAYS A MIX TOWARD THE LIGHT, not a uniform scale of the base. On a dielectric the
   * specular return carries the SOURCE's colour, so a highlight desaturates; scaling the base's own
   * linear RGB would keep its hue and make the highlight look like tinted glass. The material sets how
   * far, this file still decides toward what.
   *
   * Solved by bisection because lum(mix(a, b, t)) has no closed form through the sRGB transfer function.
   * It is monotone in t, 24 iterations resolve past 8-bit, and it runs once a minute. */
  function relLum(c) {
    var p = [0, 1, 2].map(function (i) {
      var v = c[i] / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  }
  /* THE SUBSTANCE, read lazily and by ROLE (2.5). Lazily because the splicer inserts parts in reverse
     list order, and capturing a sibling at IIFE time is what had fracture.js throwing in the browser from
     1.1b to 2.0. By role because this file has no business knowing which substance it is standing on: it
     asks for `SUBSTANCE` and for `faceRatios`, and the substance module answers. Before 2.5 it named the
     mineral — `m.faceRatios(m.ARAGONITE)` — and that is a real part of why swapping the substance was
     more expensive than it should have been.
     NO FALLBACK to the retired material.js. A fallback that quietly answers with the other substance is
     the `|| 116.209` defect again: it would render a crystal substrate while every assertion passed. */
  function substance() {
    return (typeof OCCVM_RHEOLOGY !== "undefined" && OCCVM_RHEOLOGY) ? OCCVM_RHEOLOGY
         : (typeof require !== "undefined" ? require("./rheology.js") : null);
  }
  var MAT_HI = "hi", MAT_LO = "lo";
  function faceMix(base, toward, which, e) {
    var m = substance();
    if (!m) throw new Error("occvm sundial: rheology.js is not spliced beside this — no face ratios");
    var want = m.faceRatios(m.SUBSTANCE)[which];
    /* directionality: the substance's ratio is the full-light value; diffuse light flattens toward 1 */
    var dir = (0.5 + e) / 1.5;
    want = 1 + (want - 1) * dir;
    var L0 = relLum(base), lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var t = (lo + hi) / 2;
      if (relLum(mix(base, toward, t)) / L0 < want) { if (want > 1) lo = t; else hi = t; }
      else { if (want > 1) hi = t; else lo = t; }
    }
    return (lo + hi) / 2;
  }

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
       the fill is 0.630 there, not because elevation is pretended to be 0.15 (D2). */
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
      "--sub-hi": hex(mix(sub, [255, 255, 255], faceMix(sub, [255, 255, 255], MAT_HI, e))),
      "--sub-lo": hex(mix(sub, [0, 0, 0], faceMix(sub, [0, 0, 0], MAT_LO, e))),
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
    /* 2.8 — no habit argument: a suspension has no direction to be anisotropic along, and --vein-habit is
       retired (SPINE.md L10). density is the volume fraction. */
    svg = OCCVM_VEINS.field({ seed, w: 80, h: 34, viewW: 480, viewH: 200,
      density: num("--vein-density", 0.3),
      lo: lo, hi: hi, wide: 5, fine: 1.4 }).svg;   /* raw hex: encodeURIComponent below escapes them */
  } catch (e) { svg = veinSVGLegacy(mineral, face); }
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  VEIN_CACHE.set(key, url); return url;
}
