/* The OCCVM spine: both parts spliced into the sources, matching occvm/, and reaching the assembled
 * artifact through the build.
 *
 * The sources are tome-src/20_style.css and tome-src/10_engine.js, never the assembled index.html —
 * migration section 0b#2, the generator's input is the source. Splicing the artifact would put each
 * block in twice and lose it on the next build.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const { block, fence, PARTS } = require(path.join(ROOT, "occvm", "tools", "splice-spine.js"));
const built = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
/* 2.31 — the floor moved to occvm/floor.js, shared with BTC now that L13 grants it a page ground.
   Every assertion below that used to slice the floor out of 30_ui.jsx reads the PART instead: the
   source of truth moved, so the guards read the new source rather than a copy of it. What still reads
   30_ui.jsx is the CALL SITE — useAmbientFloor and the slab that mounts it — because that half did not
   move and is the half L13 measures per tool. */
const floorSrc = fs.readFileSync(path.join(ROOT, "occvm", "floor.js"), "utf8");

for (const p of PARTS) {
  const src = fs.readFileSync(path.join(ROOT, "occvm", p.name), "utf8");
  const target = fs.readFileSync(path.join(ROOT, p.target), "utf8");
  const f = fence(p.name);

  test(`${p.name} is spliced into ${p.target} exactly once`, () => {
    assert.equal(target.split(f.open).length - 1, 1);
    assert.equal(target.split(f.close).length - 1, 1);
  });

  test(`${p.name} matches occvm/${p.name}`, () => {
    const i = target.indexOf(f.open), j = target.indexOf(f.close);
    assert.equal(target.slice(i, j + f.close.length), block(p.name, src));
  });

  test(`${p.name} reaches the assembled artifact once, from the build`, () => {
    assert.equal(built.split(f.open).length - 1, 1);
  });
}

test("the spine sits above the tool's own declarations", () => {
  /* 1.0 onward is inert-by-cascade: the tool wins every collision by ordinary order (migration 3.2).
     If a block moves below the tool's own declarations it stops being inert and starts overriding. */
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  assert.ok(css.indexOf(fence("spine.css").open) < css.indexOf("--pigment:"));
  /* the sundial must be defined before the tool's own SUN closure consumes it */
  assert.ok(js.indexOf(fence("sundial.js").open) < js.indexOf("const SUN ="));
});

test("the tool uses the shared sundial rather than a second implementation", () => {
  const js = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  const body = js.slice(js.indexOf(fence("sundial.js").close));
  assert.ok(body.includes("OCCVM_SUN"), "SUN must delegate to OCCVM_SUN");
  /* Match the Spencer approximation's own arithmetic, not a function name: after 1.2 SUN still exposes
     solar(), but as a one-line delegation. 229.18 is Spencer's equation-of-time coefficient and appears
     in no other formula here; the shared sundial uses the full NOAA series instead. */
  assert.ok(!body.includes("229.18"), "the tool's second solar implementation must be gone (OCCVM-L3)");
  assert.ok(!body.includes("Math.atan2(Math.sin(ha)"), "Spencer azimuth must be gone (OCCVM-L3)");
});

test("the artifact carries a build stamp", () => {
  assert.match(built, /<!-- build-\d{14} -->/);
});

/* OCCVM-D4 / roadmap 1.6 — no runtime compiler, and nothing fetched at load.
 *
 * The exit criterion is that first paint shows the binding, not a blank frame, and that the tool does not
 * install to a home screen it cannot serve. Removing babel-standalone alone would not have reached it:
 * React and ReactDOM still came from the same CDN, so an unreachable cdnjs still rendered nothing.
 */
test("no runtime compiler ships", () => {
  assert.ok(!built.includes("babel"), "babel-standalone must be gone");
  assert.ok(!built.includes('type="text/babel"'), "no block may be compiled in the browser");
});

test("the artifact fetches nothing at load", () => {
  const tags = built.match(/<script[^>]*\bsrc\s*=/g) || [];
  assert.deepEqual(tags, [], "every script must be inline; a src is an external dependency");
  const links = built.match(/<link[^>]+href="https?:/g) || [];
  assert.deepEqual(links, [], "no external stylesheet or preload");
});

test("React is inlined from the committed vendor copy", () => {
  for (const f of ["react-18.3.1.umd.min.js", "react-dom-18.3.1.umd.min.js"]) {
    const blob = fs.readFileSync(path.join(ROOT, "vendor", f), "utf8");
    assert.ok(built.includes(blob.trim().slice(0, 200)), `${f} is not inlined in the artifact`);
  }
});

test("the service worker's cache name is the build stamp", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const stamp = (built.match(/build-\d{14}/) || [])[0];
  assert.ok(stamp, "the artifact carries no stamp");
  assert.ok(sw.includes(`"tome-${stamp}"`), "sw.js cache name must track the build stamp, not a hand-bumped literal");
  assert.ok(!sw.includes("cdnjs"), "the shell must not list CDN entries any more");
  assert.ok(!fs.readFileSync(path.join(ROOT, "tome-src", "sw.js"), "utf8").includes(`tome-${stamp}`),
    "tome-src/sw.js is the template and must keep its placeholder, not a substituted stamp");
});

/* OCCVM-L8 / roadmap 1.5 — the interaction floor.
 *
 * D7 was 53 onClick handlers on divs and spans, zero <button>, zero aria, zero tabIndex: the tool was
 * entirely keyboard-inoperable and announced nothing. These guard the shape of the fix; the rendered
 * halves — real measured sizes, no surviving non-button handlers — are checked in a browser, because a
 * source file cannot tell you what an element measures.
 */
test("no action is a div or a span any more", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const raw = ui.match(/<(div|span|p|h1|h2|li)[^>]*onClick/g) || [];
  assert.deepEqual(raw, [], "every action must be a real control");
});

test("the two components carry the whole tree to the floor", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  assert.match(ui, /function Cast\([^)]*\)\s*\{\s*return <button/, "Cast must render a button");
  assert.match(ui, /aria-pressed=\{action \|\| on === undefined \? undefined : !!on\}/,
    "a bare `on` means styled-active, not pressed; an action must not announce a state it lacks");
  assert.match(ui, /if \(!onClick\) return <span/, "a stone that only displays must stay out of the tab order");
});

test("every control the artifact renders is a button", () => {
  const made = (built.match(/createElement\("button"/g) || []).length;
  assert.ok(made >= 18, `expected the converted tree, found ${made} button call sites`);
  assert.ok(built.includes('"aria-pressed"'), "toggles must announce their state");
  assert.ok(built.includes("occvm-act"), "controls must carry the spine's reset");
});

test("reduced motion is honoured from the spine, system-wide", () => {
  const spine = fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8");
  assert.match(spine, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\*::after/);
  assert.ok(built.includes("transition-duration: .01ms !important"), "the rule must reach the artifact");
});

/* OCCVM-L10 / roadmap 1.1 — veins are grown, not drawn. */
test("2.24 — the vein layer is retired from this tool's slabs; the globule field is the substrate", () => {
  /* Until 2.24 this test pinned veinSVG, its cache and its bezier fallback. Rendered and looked at, what
     the generator drew here was a 1.3 px crisp trace of a lattice aggregate — a crystal, the vocabulary
     2.8 claimed to have left — and on a live slab it moved 5.5% of pixels at a mean 0.26 L*. The owner
     saw crystal fractals; the globule field the roadmap asked for was sitting under one face at 0.42 L*.
     Now the field is the slab's layer and the three vein functions are deleted, not left declared. */
  const eng = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const own = eng.replace(/\/\* ==== OCCVM SPINE [\s\S]*?\/\* ==== END OCCVM [^*]*\*\//g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/function veinSVG\b|function veinSVGLegacy\b|VEIN_CACHE/.test(own), "veinSVG, its cache and its fallback are gone");
  assert.ok(!/veinSVG\(/.test(ui), "and nothing calls them");
  assert.ok(!/"--veins"/.test(ui), "no slab sets --veins");
  /* 2.25: BTC took the field too, so the vein generator is spliced NOWHERE — retired from every target,
     kept in occvm/ as the generator the L10 record cites. The field is one shared part. */
  assert.ok(/var OCCVM_GLOBULES =/.test(eng), "the globule field is the shared part this tool reads");
  assert.ok(!/var OCCVM_VEINS =/.test(eng), "and the vein generator no longer ships here");
  assert.ok(/OCCVM_GLOBULES\.field\(/.test(floorSrc), "the floor takes its drops from the shared field");
  /* 2.37 RETIRES THE TWO CLAUSES THAT PINNED THE FLOOR TO A SLAB, and the reason is that the field
     stopped being a property of the open face and became one of the page. They read
     `useAmbientFloor(floorRef, open !== "draft", …)` and "the canvas is the slab's first child" —
     both true of an architecture where the field was drawn INSIDE whichever slab was open, reseeded
     when a face changed, stopped at that slab's edge, and left every closed face with none. The
     sibling has drawn it once on the page ground since 2.34; this tool now does the same, so what
     replaces them is the ground placement and the unconditional grant. */
  assert.match(ui, /useAmbientFloor\(floorRef, false, "ground", floorHeat\);/,
    "always live: on a page ground L13's grant is unconditional, and reduced motion is the hook's own job");
  assert.match(ui, /<canvas id="occvm-floor" ref=\{floorRef\} aria-hidden="true" \/>/,
    "one fixed canvas, and it is the page ground's");
  assert.ok(!/className="floor"/.test(ui), "no per-slab copy of the field survives");
  assert.match(ui, /OCCVM_FLOOR\.ambientFloor\(ref\.current, reduce \|\| !!still, heat, \{ alpha: GROUND_ALPHA \}\)/,
    "reduced motion still means a still frame — L8 is not repealed by moving the floor (2.37)");
  /* the weight is the TOOL's, named here rather than left to the part's default, because 0.24 was
     chosen against a slab-sized canvas and is roughly twice what the sibling carries on a page ground.
     The criterion is that the two grounds carry the field at the same measured weight, since 2.37 puts
     both tools on one law and one kind of surface. Measured on one instrument with the floor canvas
     the only thing toggled: the sibling reads 3.440 mean L*, this tool 3.024 at 0.10, 3.325 at 0.11,
     3.741 at 0.12. The digit is pinned rather than the sentence because a value chosen by measurement
     should not be edited without taking the measurement again. */
  assert.match(ui, /^const GROUND_ALPHA = 0\.11;$/m, "the ground names its own weight");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  assert.match(css, /\.slab \{\n  --cut-a: \.6; position: relative; isolation: isolate;/, "the slab is its own stacking context");
  /* the clause here pinned `.slab > canvas.floor`, the per-slab canvas, and it is retired with that
     canvas. What the slab has to be now is the opposite of a container for the field: it has to let
     the one field through, which is a partial fill plus the frost, gated so that a browser missing
     either renders the pre-2.37 picture rather than a slab with no substrate at all. */
  assert.ok(!/canvas\.floor/.test(css), "no rule places a canvas inside a slab any more");
  const flat = css.replace(/\n\s*/g, " ");
  assert.match(flat, /\.slab \{[^}]*color-mix\(in srgb, var\(--sub-hi\) var\(--tile-fill\), transparent\)/,
    "the slab shows the one field through a partial fill");
  assert.match(flat, /\.slab \{[^}]*backdrop-filter: blur\(var\(--occvm-meniscus\)\)/,
    "frosted at the substance's own capillary length, the length the isosurface is cut at");
  assert.match(flat, /@supports \(\(background: color-mix[^{]*backdrop-filter[^{]*\{ \.slab \{/,
    "and the fill is an enhancement requiring both, never the base declaration");
  assert.ok(!/var\(--veins\)/.test(css), "the vein image is out of the slab's background stack");
});

test("the aggregate is traced as straight segments, with no curve fitted over it", () => {
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  const f = V.field({ seed: 20260906, w: 80, h: 34, viewW: 480, viewH: 200, density: 0.3, habit: 0.55 });
  const d = f.svg.match(/<path id='v' d='([^']+)'/)[1];
  assert.match(d, /^[ML0-9 .,-]+$/, "only moveto and lineto: C/S/Q/T/A is the bezier coming back");
  assert.ok(f.particles > 200, `expected a grown aggregate, got ${f.particles} particles`);
});

test("growth is seeded and pure", () => {
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  const a = V.field({ seed: 7, w: 80, h: 34, density: 0.3 }).svg;
  assert.equal(a, V.field({ seed: 7, w: 80, h: 34, density: 0.3 }).svg, "same seed, same bytes");
  assert.notEqual(a, V.field({ seed: 8, w: 80, h: 34, density: 0.3 }).svg, "a different seed must differ");
});

test("the layer is a decodable data URI, not bare markup", () => {
  /* Both the fragment reference and the colours carry a literal '#'. Left raw inside a data: URI it ends
     the URI; pre-encoded to %23 it survives into the parsed SVG as two literal characters and href="%23v"
     resolves to nothing, so the layer renders empty while every string check still passes. */
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  const svg = V.field({ seed: 1, w: 80, h: 34, density: 0.3, lo: "#1c6a45", hi: "#3fbf7e" }).svg;
  assert.ok(svg.includes("href='#v'"), "the reference must be a raw # for encodeURIComponent to escape");
  assert.ok(!svg.includes("%23"), "nothing may be pre-encoded; the caller encodes the whole document");
});

/* ── 2.0 — the material owns the lattice (OCCVM-L12) ─────────────────────────────────────────── */

test("2.8 — the crystal is retired: nothing reads it, so it is gone", () => {
  const fs = require("fs");
  for (const f of ["material.js", "fracture.js"])
    assert.ok(!fs.existsSync(path.join(ROOT, "occvm", f)), `occvm/${f} must be deleted, not left declared and unconsumed`);
  const { RETIRED, PARTS } = require(path.join(ROOT, "occvm", "tools", "splice-spine.js"));
  assert.ok(RETIRED.includes("material.js") && RETIRED.includes("fracture.js"), "the splicer must list both as retired");
  assert.ok(PARTS.some(p => p.name === "yield.js"), "yield.js is the part fracture.js was");
  const eng = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  assert.ok(!/OCCVM_MATERIAL|OCCVM_FRACTURE/.test(eng), "no crystal block lingers in the source");
  assert.ok(!/OCCVM_MATERIAL|OCCVM_FRACTURE/.test(built), "and none reaches the built artifact");
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  assert.equal(V.CELL, undefined, "veins carries no lattice");
  assert.equal(V.TWIN_ANGLE, undefined, "and no twin angle — a suspension has no crystallographic direction");
});

test("2.8 — the shelf yields rather than cleaves, and the vocabulary is pinned out", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  assert.match(ui, /OCCVM_YIELD\.pinch\(row, \(\) => removeDraft\(d\.id\)\)/, "removing a draft pinches off");
  assert.ok(!/OCCVM_FRACTURE|\.cleave\(/.test(ui), "no cleave call survives — in a page it would throw");
  /* The primitive is used for irreversible actions and NOTHING ELSE. This read `=== 1` until 2.21 added
   * the bank row's swipe removal, and a correct change then failed a correct guard — the same typed-count
   * defect 2.15 found in the law-count assertions. L11 does not say one action is irreversible; it says
   * the vocabulary belongs to the ones that are. So the property is what is asserted: every call site's
   * own callback names a removal. A pinch on a save, a toggle or an open fails; a third real removal
   * passes without editing this line. */
  const pinches = [...ui.matchAll(/OCCVM_YIELD\.pinch\(([^;]*?)\)\s*;/g)].map(m => m[1]);
  assert.ok(pinches.length >= 1, "the yield vocabulary reaches at least one action");
  for (const args of pinches)
    assert.match(args, /remove|drop|delete/i, "pinch marks a removal, never a reversible action: " + args.trim());
});

test("2.8 — yield resolves its curve under the PAGE's load order, with no require", () => {
  /* The guard 1.1b's null capture taught: the splicer lands parts in reverse list order, so yield is
   * evaluated BEFORE rheology is assigned. A lazy read is order-independent; this proves it on the built
   * artifact's own blocks, in the artifact's own order, with no require in scope. */
  const vm = require("vm");
  const blk = n => { const i = built.indexOf("var " + n + " ="); return built.slice(i, built.indexOf("\nif (typeof module", i)); };
  const iY = built.indexOf("var OCCVM_YIELD ="), iR = built.indexOf("var OCCVM_RHEOLOGY =");
  assert.ok(iY > 0 && iR > 0 && iY < iR, "yield before rheology is the real order, and what makes this guard meaningful");
  const ctx = vm.createContext({ Math, console });
  vm.runInContext(blk("OCCVM_YIELD"), ctx);
  vm.runInContext(blk("OCCVM_RHEOLOGY"), ctx);
  assert.match(ctx.OCCVM_YIELD.easing(), /^linear\(0, /, "pinch() must be able to reach the substance's curve in a page");
  /* 2.25: the vein generator no longer ships; the globule field takes its place in this guard, for the
     same reason — a part must resolve in the page's own order with nothing spliced before it */
  const ctx2 = vm.createContext({ Math, console });
  vm.runInContext(blk("OCCVM_GLOBULES"), ctx2);
  assert.ok(ctx2.OCCVM_GLOBULES.field({ seed: 1, w: 200, h: 120 }).drops.length >= 3, "the field seeds with nothing spliced before it");
});

test("2.8 — the vein is a suspension that gels: DLCA, measured", () => {
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  const g = V.grow({ w: 80, h: 34, n: Math.round(80 * 34 * 0.3), seed: 1 });
  assert.equal(g.bonds.length / 2, g.particles - g.clusters, "one bond per merge: particles minus clusters");
  /* the stop is AT OR BELOW the target: one step can merge a cluster with two neighbours at once */
  assert.ok(g.clusters >= 1 && g.clusters <= 8, `a gel is many flocs joined, not one cluster (${g.clusters})`);
  const same = V.field({ seed: 5, w: 80, h: 34, density: 0.3 }).svg;
  assert.equal(V.field({ seed: 5, w: 80, h: 34, density: 0.3, habit: 1 }).svg, same, "habit is accepted and ignored");
  assert.ok(V.field({ seed: 5, w: 80, h: 34, density: 0.15 }).bonds < V.field({ seed: 5, w: 80, h: 34, density: 0.3 }).bonds,
    "density is the axis a suspension has, and it expresses");
  assert.match(same, /feGaussianBlur/, "the deep stroke is blurred: a floc is suspended in the fluid, not carved into a solid");
  const fs = require("fs");
  const style = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/--vein-habit\s*:/.test(style), "--vein-habit is retired from the spine and from this tool's own CSS");
});

test("the substrate is derived in linear light, ordered, and hue-preserving", () => {
  const R = require(path.join(ROOT, "occvm", "rheology.js")), K = R.SUBSTANCE;
  const lin = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = h => { const p = lin(h); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
  const s = R.substrate(K, 1);
  assert.ok(lum(s.hi) > lum(s.mid) && lum(s.mid) > lum(s.lo), "hi > mid > lo");
  /* the double-gamma guard: scaling sRGB bytes rendered a 9.35x optical spread as 116x */
  assert.ok(Math.abs(lum(s.hi) / lum(s.lo) / s.spread - 1) < 0.02,
    "the rendered spread must equal the optical ratio in linear light");
  const hue = h => { const p = lin(h), m = Math.max(...p) || 1; return p.map(v => v / m); };
  hue(K.body).forEach((v, i) => assert.ok(Math.abs(v - hue(s.hi)[i]) < 0.02, "one gain, no hue shift"));
  assert.equal(R.substrate(K, 0).lo, K.body, "contrast 0 collapses to the body colour");
});

test("2.8 — P1 and P4 retired with the crystal: a fluid has no stiffness tensor and no unit cell", () => {
  /* P1 derived a settling time per crystal axis from the stiffness tensor and P4 a spacing triple from the
   * cell; both shipped no token and carried guards. Neither quantity exists on a fluid, so both retire —
   * not ported, because a derivation whose input is gone is an authored number wearing its old name. */
  const fs = require("fs");
  const R = require(path.join(ROOT, "occvm", "rheology.js")), K = R.SUBSTANCE;
  assert.equal(R.motion, undefined, "no motion derivation on the substance");
  assert.equal(R.spacing, undefined, "no spacing derivation on the substance");
  assert.equal(R.GOLDEN_RATIO, undefined, "and nothing left to reject the golden ratio against");
  assert.ok(K.C === undefined && K.cell === undefined, "no tensor, no cell");
  const spine = fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8");
  for (const tok of ["--dur-a", "--dur-b", "--dur-c", "--s-a", "--space-a"])
    assert.ok(!spine.includes(tok), `${tok} never shipped and does not now`);
});

test("--amb is retired: 2.2 renamed it --fill and it may not come back", () => {
  /* The 1.9 expired-alias treatment. The token was never a model of sky illumination — it is the weight
   * of the fill, and (1-e) is how much of the fill applies, which is why a value that rises at night is
   * correct rather than paradoxical. A retired name that can still be written drifts from its
   * replacement exactly as --ink/--meas/--bondi did. */
  const fs = require("fs");
  for (const f of ["occvm/sundial.js", "occvm/spine.css", "tome-src/20_style.css", "tome-src/10_engine.js", "index.html"]) {
    const p2 = path.join(ROOT, f);
    if (!fs.existsSync(p2)) continue;
    assert.ok(!/--amb\b/.test(fs.readFileSync(p2, "utf8")), `${f} still carries --amb; it is --fill since 2.2`);
  }
  assert.ok(/--fill\s*:/.test(fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8")),
    "the stylesheet must declare the fallback under the new name");
});


test("the substrate a surface wears is sundial-written, not the :root fallback", () => {
  /* The check 2.3 was missing. 2.3 derived a substrate ramp from the material, found it matched
   * --sub-hi/--sub-lo TO THE BYTE, adopted it on .slab, and every assertion passed — because every
   * assertion compared the material against the :root FALLBACK, which the sundial overwrites every
   * minute before first paint. The adopted slab lost its twilight response and nobody had ever seen the
   * hexes it was matched against. Reverted; this is what stops it recurring. */
  const fs = require("fs");
  const style = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const slab = style.slice(style.indexOf(".slab {"), style.indexOf(".slab > *"));
  assert.ok(/var\(--sub-hi\)/.test(slab), ".slab must read the sundial's tokens, which move with the sun");
  assert.ok(!/--m-sub/.test(slab), ".slab must not wear a constant ramp beside neighbours that move");
  assert.ok(!fs.existsSync(path.join(ROOT, "occvm", "substrate.css")),
    "2.3's generated ramp is gone, not left declared and unconsumed — that would be OCCVM-D12");

  /* the sundial owns the base colour, and since 2.4 the face offsets applied to it are the material's.
     This assertion named those offsets as the adoption target while they were still authored; they are
     adopted now, so it asserts the base ownership and leaves the offsets to the 2.4 test below. */
  const eng = fs.readFileSync(path.join(ROOT, "occvm", "sundial.js"), "utf8");
  assert.ok(/"--sub":\s*hex\(sub\)/.test(eng), "the sundial writes the substrate base");

  const R = require(path.join(ROOT, "occvm", "rheology.js"));
  assert.equal(R.SUBSTANCE.body, "#0e0d13", "the body anchoring stays: it matches L1's declared floor");
});

test("2.4 — the substrate's face offsets are the material's, not two magic numbers", () => {
  const fs = require("fs");
  const sun = fs.readFileSync(path.join(ROOT, "occvm", "sundial.js"), "utf8");
  /* comments stripped: the file records what it replaced, and a guard reading prose fails on its own
     changelog. This must test the code. */
  const code = sun.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/0\.14 \* \(0\.5 \+ e\)/.test(code), "the authored highlight offset is gone");
  assert.ok(!/\[0, 0, 0\], 0\.42/.test(code), "the authored shadow offset is gone");
  assert.ok(/m\.faceRatios\(/.test(code), "the sundial reads the material for them");
  assert.ok(/0\.14 \* \(0\.5 \+ e\)/.test(sun), "but the file still records what it replaced");

  const R = require(path.join(ROOT, "occvm", "rheology.js")), K = R.SUBSTANCE;
  assert.equal(R.authoredContrast, undefined, "authoredContrast fitted to the :root fallback and is gone");
  assert.ok(Math.abs(R.substrate(K, R.renderedContrast(K)).spread - R.RENDERED_SPREAD_HIGH) < 0.02,
    "contrast anchors to the spread the tools RENDER at high sun, a named instant");
  assert.ok(Math.abs(R.RENDERED_SPREAD_HIGH - 5.739) > 1, "and not to the fallback's spread — 2.3's error");
});

test("2.5 step A — the sundial stands on the fluid, and names it by role", () => {
  /* The substance swap, done as a strangler rather than a big bang: rheology.js is spliced BESIDE
   * material.js, not in place of it, because veins.js still reads the crystal's cell. Both live until
   * nothing reads the older one. */
  const fs = require("fs");
  const sun = fs.readFileSync(path.join(ROOT, "occvm", "sundial.js"), "utf8");
  const code = sun.replace(/\/\*[\s\S]*?\*\//g, "");

  assert.ok(/m\.faceRatios\(m\.SUBSTANCE\)/.test(code),
    "the sundial asks for the SUBSTANCE, not for a named mineral — naming the mineral at the call site " +
    "is part of why swapping it cost what it did");
  assert.ok(!/m\.ARAGONITE/.test(code), "no mineral name survives in the sundial's code");
  assert.ok(/m\.faceRatios\(m\.ARAGONITE\)/.test(sun), "but the file records the call it replaced");
  assert.ok(!/require\("\.\/material\.js"\)/.test(code),
    "no fallback to the retired crystal: a fallback that answers with the other substance would render " +
    "a crystal substrate while every assertion passed");

  const R = require(path.join(ROOT, "occvm", "rheology.js"));
  assert.ok(Math.abs(R.renderedContrast(R.SUBSTANCE) - 1) < 0.01,
    "the fluid's own optics reproduce the rendered substrate within 1% of unity");
  assert.equal(R.SUBSTANCE, R.KETCHUP, "SUBSTANCE is the role; KETCHUP is the identity behind it");
  assert.ok(R.SUBSTANCE.cell === undefined && R.SUBSTANCE.C === undefined,
    "no unit cell and no stiffness tensor survive on a fluid");

  /* both substances were spliced from 2.5 to 2.7, deliberately, until 2.8 moved veins off the crystal */
  assert.ok(/var OCCVM_RHEOLOGY =/.test(built), "rheology.js reaches the built artifact");
  assert.ok(!/var OCCVM_MATERIAL =/.test(built), "and the crystal no longer does: the strangler finished");
});

test("2.7 — L7: the reading surface and the heads are owned, and are two faces", () => {
  const fs = require("fs");
  const style = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const own = style.replace(/\/\* ==== OCCVM SPINE [\s\S]*?\/\* ==== END OCCVM [^*]*\*\//g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/font-family:\s*"OCCVM Serif"/.test(style), "serif.css is spliced here");
  assert.ok(/font-family:\s*"OCCVM Reading"/.test(style), "reading.css is spliced here — this tool's body is a serif");
  assert.ok(!/--serif\s*:/.test(own), "the tool no longer restates --serif; the spine governs it");
  assert.ok(/html,\s*body\s*\{[^}]*font-family:\s*var\(--reading\)/.test(own),
    "the reading surface is set in --reading, not the display serif");
  assert.ok(/\.slab \.head h2\s*\{[^}]*font-family:\s*var\(--serif\)/.test(own),
    "the heads carry --serif explicitly now that they no longer inherit it from body");
  assert.ok(fs.existsSync(path.join(ROOT, "occvm", "fonts", "OFL-Faustina.txt")), "Faustina's licence ships with it");
});

/* ---- 2.21: the swipe test bed, on bank rows -------------------------------------------------- */

test("2.21 — the dead band IS the yield stress, derived not authored", () => {
  const R = require(path.join(ROOT, "occvm", "rheology.js"));
  const m = R.SUBSTANCE;
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const Y = +(/var SWIPE_YIELD_PX = (\d+(?:\.\d+)?)/.exec(ui) || [])[1];
  assert.ok(Y > 0, "the one authored anchor is declared and readable");

  /* the map the hook applies, restated here so the identity is checked rather than assumed */
  const flowed = d => {
    const tau = m.tau0 * Math.abs(d) / Y;
    if (!(R.shearRate(m, tau) > 0)) return 0;
    return Math.sign(d) * Math.abs(d) * (tau - m.tau0) / tau;
  };

  /* below τ₀ the substance does not flow, so the row does not move — however far the thumb has gone */
  for (const d of [0, 1, Y / 3, Y / 2, Y * 0.99, Y])
    assert.equal(flowed(d), 0, `held at ${d}px: below the yield stress nothing moves`);
  /* above it, the transmitted fraction (τ−τ₀)/τ times the imposed travel is exactly d − Y. That identity
     is why the gesture reads as an ordinary swipe with a sticky start rather than as a rubber band. */
  for (const d of [Y + 1, Y + 10, Y * 1.5, Y * 2, Y * 4])
    assert.ok(Math.abs(flowed(d) - (d - Y)) < 1e-9, `past yield the row tracks the finger 1:1 at ${d}px`);
  assert.ok(Math.abs(flowed(-(Y + 12)) + 12) < 1e-9, "and it is signed: the material has no preferred direction");
});

test("2.21 — the commit distance stays inside the yield-dominated regime", () => {
  const R = require(path.join(ROOT, "occvm", "rheology.js"));
  const m = R.SUBSTANCE;
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const Y = +(/var SWIPE_YIELD_PX = (\d+(?:\.\d+)?)/.exec(ui) || [])[1];
  const C = +(/var SWIPE_COMMIT_PX = (\d+(?:\.\d+)?)/.exec(ui) || [])[1];

  /* The crossover k·γ̇ⁿ/τ₀ = 1 is τ = 2τ₀ by definition, which under the hook's map is 2Y of finger
     travel — i.e. an offset of Y. Measured against the substance rather than asserted, so the day the
     constants move the guard moves with them. */
  const crossoverTau = m.tau0 + m.k * Math.pow(R.shearRate(m, 2 * m.tau0), m.n);
  assert.ok(Math.abs(crossoverTau - 2 * m.tau0) < 1e-6, "the regime crossover sits at exactly twice the yield stress");
  assert.ok(C < Y, `commit at ${C}px must stay under the crossover offset ${Y}px, or one swipe renders two vocabularies`);

  const tauAtCommit = m.tau0 * (C + Y) / Y;
  const ratio = (tauAtCommit - m.tau0) / m.tau0;         /* = k·γ̇ⁿ/τ₀ at the moment of commit */
  assert.ok(ratio < 1, "yield-dominated at commit");
  assert.ok(ratio > 0.5, "and not so far under the crossover that the ceiling is meaningless");
  /* the recorded headroom, in the same shape 2.16 recorded LOCK_V0_MAX's 14.4% */
  assert.ok(Math.abs(ratio - 0.8667) < 0.02, `headroom drifted: ratio ${ratio.toFixed(4)}`);
});

test("2.21 — tap-to-remove stays live, and one removal has one vocabulary", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");

  assert.match(ui, /className="rm occvm-act" onClick=\{remove\}/, "the remove button survives the swipe and calls the same removal");
  assert.match(ui, /className="stones occvm-act"/, "so does the stones button");
  /* the gesture only claims the pointer AFTER it has yielded; inside the dead band there is nothing to
     capture and no default to prevent, which is what keeps both buttons tappable through a light drag */
  const mv = /const move = e => \{[\s\S]*?\n  \};/.exec(ui)[0];
  assert.ok(mv.indexOf("s.live = true") < mv.indexOf("e.preventDefault()"),
    "preventDefault and pointer capture both sit past the yield point, never before it");
  assert.ok(mv.indexOf("setPointerCapture") > mv.indexOf("Math.abs(dx) <= SWIPE_YIELD_PX"),
    "capture is taken only once the material has yielded");
  assert.match(mv, /Math\.abs\(dy\) > Math\.abs\(dx\)/, "a vertical gesture is the page's scroll, not a swipe");
  assert.match(css, /\.bankrow \{ --slide: 0px; transform: translateX\(var\(--slide\)\); touch-action: pan-y; \}/,
    "the row claims one axis and leaves the page its own");
});

test("2.21 — L8: reduced motion gets a static frame, and the gesture still commits", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  assert.match(ui, /"--slide": \(reduce\(\) \? 0 : off\)/, "the travel is withheld, not shrunk");
  assert.match(ui, /if \(ret && !reduce\(\)\)/, "and so is the return flow's transition");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.bankrow \{ transform: none !important; \} \}/,
    "the stylesheet says the same thing, so a JS path that missed it still lands on a static frame");
  /* the commit test reads the flowed offset, which reduce() never touches: the setting removes the
     animation, never the ability to act. A reduced-motion user swipes the same distance. */
  const upFn = /const up = e => \{[\s\S]*?\n  \};/.exec(ui)[0];
  assert.ok(!/reduce\(\)/.test(upFn), "commit is decided by the material, not by a motion preference");
});

test("2.21 — --slide is registered where §2a-0 says a tool-local token goes", () => {
  const fs = require("fs");
  const spine = fs.readFileSync(path.join(ROOT, "occvm", "SPINE.md"), "utf8");
  const row = /\*\*Tool-local semantics\*\*[^\n]*/.exec(spine)[0];
  assert.ok(row.includes("--slide"), "the census must be able to find it in §6b's migration table");
  assert.ok(!/^\s*--slide\s*:/m.test(fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8")),
    "and the spine does not declare it: the spine only reads a surface input");
});

/* ---- 2.22: the ambient floor (OCCVM-L13) ----------------------------------------------------- */

/* Loads the floor out of the BUILT artifact and runs it against a recording canvas, so what is asserted
   is what ships rather than what the source says. jsdom is not in this repo's dependencies and is not
   needed: the floor touches a 2-D context, getComputedStyle and rAF, and all three are stubbed here. */
function loadFloor(over) {
  const vm = require("vm");
  const cut = (from, to) => built.slice(built.indexOf(from), built.indexOf(to));
  /* 2.31 — the cut is the FENCE, not a pair of identifiers that happen to bracket the code. The old
     markers were "var FLOOR_MERGE_PX_S =" to "function useAmbientFloor", and once the floor moved into
     the engine those two straddled 25_card.js and most of 30_ui.jsx — a slab of JSX no vm can run. The
     fence is the part's own boundary and cannot drift from it. Still cut from `built`, because what is
     driven has to be what ships. */
  const code = cut("/* ==== OCCVM SPINE floor.js", "/* ==== END OCCVM floor.js");
  const ops = [];
  const ctx2d = new Proxy({}, {
    get(t, k) {
      if (k === "createRadialGradient") return () => ({ addColorStop() {} });
      /* 2.33 — record EVERY operation, not a whitelist. The whitelist predated the buffer and had no
         drawImage in it, so the moment the filtered path actually ran here it threw "drawImage is not
         a function" — a harness shaping the code's behaviour instead of observing it. */
      if (typeof k === "string" && !(k in t)) return (...a) => { ops.push([k, ...a]); };
      return t[k];
    },
    set(t, k, v) { ops.push(["set:" + String(k), v]); t[k] = v; return true; }
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx2d, getBoundingClientRect: () => ({ width: 320, height: 480 }) };
  const frames = [];
  const made = [];
  const sandbox = {
    Math, performance: { now: () => 0 },
    OCCVM_GLOBULES: require(path.join(ROOT, "occvm", "globules.js")),
    /* 2.28 — the floor reads the substance's cessation curve for the turn at each end of the cycle.
       Without it in the sandbox the fallback straight ramp is what gets driven, and the harness would
       be testing the degradation rather than the code. */
    OCCVM_RHEOLOGY: require(path.join(ROOT, "occvm", "rheology.js")),
    getComputedStyle: () => ({ getPropertyValue: k => (over && k in over ? over[k] : (k === "--vein-hi" ? "#c9a6ff" : k === "--vein-lo" ? "#5a36a8" : "")) }),
    /* 2.33 — the sandbox now carries createElement, getElementById and a body, because without them
       the floor's filtered path could not run AT ALL here: buf creation threw inside its own
       try/catch, `filtered` fell to false, and every assertion about the metaball path was a regex
       over source text while the harness drove the unthresholded fallback. A guard that cannot reach
       the branch it guards is 2.22's "verified against its fixture instead of its call path" again.
       Each canvas gets its OWN recording context, so the buffer and the display can be told apart. */
    document: {
      documentElement: {},
      getElementById: () => null,
      body: { appendChild() {} },
      createElement: (tag) => {
        if (String(tag).toLowerCase() !== "canvas")
          return { setAttribute() {}, style: {}, set innerHTML(v) {}, appendChild() {} };
        const own = [];
        const c2 = new Proxy({}, {
          get(t, k) {
            if (k === "_ops") return own;
            if (k === "createRadialGradient") return () => ({ addColorStop() {} });
            if (typeof k === "string") return (...a) => own.push([k, ...a]);
            return t[k];
          },
          set(t, k, v) { own.push(["set:" + String(k), v]); t[k] = v; return true; }
        });
        const cv2 = { width: 0, height: 0, getContext: () => c2, _ops: own };
        made.push(cv2);
        return cv2;
      },
    },
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    cancelAnimationFrame() {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  /* the part exposes one global; the old flat names are reached through it so every assertion below
     drives the shipped surface rather than a shape only this harness produces */
  sandbox.ambientFloor = sandbox.OCCVM_FLOOR.ambientFloor;
  sandbox.cyclePos = sandbox.OCCVM_FLOOR.cyclePos;
  sandbox.bridgeRadius = sandbox.OCCVM_FLOOR.bridgeRadius;
  return { sandbox, canvas, ops, frames, made };
}

test("2.22 — P-3: the bridge grows LINEARLY in time, which is the viscous law and not the inertial one", () => {
  const { sandbox } = loadFloor();
  const r = sandbox.bridgeRadius;
  /* linearity proved by doubling, not by reading the source: r(2t) = 2·r(t) at every t */
  for (const t of [1, 17, 250, 1000, 4000])
    assert.ok(Math.abs(r(2 * t) - 2 * r(t)) < 1e-12, `linear at ${t}ms`);
  /* and the substitution anybody would actually make — √t, the INERTIAL law — is excluded by the same
     test: it fails doubling by a factor of √2. Recorded so the guard's own bite is visible. */
  const sq = t => Math.sqrt(t);
  assert.ok(Math.abs(sq(2000) - 2 * sq(1000)) > 1, "the guard would reject a sqrt merge");
  assert.equal(r(0), 0, "a merge starts at zero bridge");
  assert.equal(r(-50), 0, "and never runs backwards, which is where the ELS log correction goes wrong");
});

test("2.22 — L6: the floor carries no colour of its own, and paints nothing without the palette", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const body = floorSrc;   /* 2.31: the part IS the body — no slicing a file for a function any more */
  const bare = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(bare.replace(/#\[0-9a-f\]\{6\}/g, "")), "no hex literal");
  assert.ok(!/\brgba?\s*\(/.test(bare), "no rgb() triplet");
  assert.ok(!/\b(white|black|red|green|blue|gold|silver)\b/i.test(bare), "no colour keyword");
  assert.match(bare, /--vein-hi/, "the colour comes from the mineral tokens");
  /* an unresolved palette paints nothing rather than an invented accent */
  const dead = loadFloor({ "--vein-hi": "", "--vein-lo": "" });
  const stop = dead.sandbox.ambientFloor(dead.canvas, true);
  assert.equal(dead.ops.length, 0, "no palette, no paint");
  assert.equal(typeof stop, "function", "and it still hands back a teardown");
});

test("2.22 — L8: reduced motion gets one painted frame and no animation at all", () => {
  const live = loadFloor();
  live.sandbox.ambientFloor(live.canvas, false);
  assert.ok(live.frames.length > 0, "the floor runs unconditionally — L13 grants exactly that");

  const still = loadFloor();
  const stop = still.sandbox.ambientFloor(still.canvas, true);
  assert.equal(still.frames.length, 0, "reduced motion requests no frame: a static frame, not a slower floor");
  assert.ok((still.made.length ? still.made[0]._ops : still.ops).some(o => o[0] === "arc"),
    "and it is a frame, not a blank canvas");
  assert.ok(still.ops.some(o => o[0] === "drawImage"),
    "and the frame reached the display through one filtered composite");
  assert.equal(typeof stop, "function");
});

test("2.22 — L13: the floor is a layer, is ungated, and never reaches a measured value", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const body = floorSrc;   /* 2.31: the part IS the body */

  /* a LAYER on the material, never the material deforming at rest: its own canvas, under everything.
     2.37 moves it from inside a slab to the page ground, so the two placement clauses here are
     restated rather than retired — the property was always "a layer of its own, beneath the content",
     and it is only the layer's address that changed. `the floor touches no bar` is untouched and
     matters MORE now: with the slabs translucent, the one surface that must still stop the field is
     the one carrying --heat. */
  assert.match(css, /#occvm-floor \{ position: fixed; inset: 0; z-index: 0;/, "it is a fixed layer under the page");
  assert.match(ui, /<canvas id="occvm-floor" ref=\{floorRef\} aria-hidden="true" \/>/, "and it is its own element");
  assert.ok(!/\.bar[\s,{:]/.test(body), "the floor touches no bar");
  assert.ok(!/\.bar \{[^}]*backdrop-filter/.test(css.replace(/\n\s*/g, " ")),
    "and a bar is never glass — a measured value does not get the ground behind it");

  /* 2.28 step 6 RETIRES TWO CLAUSES OF THIS GUARD, deliberately, and neither is a loosening of L13 —
     both were STRICTER THAN THE LAW THEY GUARD. L13 says, and said before this floor existed: "a real
     value may scale a floor's intensity (Rhyme's --heat, read-only, is the obvious first one), but the
     floor is lawful at zero modulation, which is precisely why this is a grant and not a case of the
     gated-motion rule." Modulation was never forbidden; a GATE was. What these two clauses actually
     asserted was the absence of a string, which is a proxy for the property and not the property.
       (1) "--heat" leaves the forbidden list. The rest stay: the floor still reads no tempo, no pacing,
           no bpm, and it still does not reach into the reading for anything but the one value L13
           names.
       (2) "the only inputs are the canvas and a stillness" is replaced by the driven property below.
     What replaces them is stronger, because it fails on behaviour rather than on vocabulary. */
  /* on the CODE, not on the prose. This block explains at length what the floor may and may not read,
     so a substring check that counts its own comments fails on a correct floor for saying the word —
     the same trap the L6 colour guard above already strips comments to avoid. */
  const bareBody = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const forbidden of ["reading", "pacing", "tempo", "bpm"])
    assert.ok(!bareBody.includes(forbidden), `the floor reads no measured value it was not granted: found ${forbidden}`);
  assert.equal((ui.match(/useAmbientFloor\(/g) || []).length, 2, "one definition, one call site — on the slab");
  assert.ok(!/heatRef\.v =[^;]*;[\s\S]{0,40}setProperty/.test(body), "READ-only: the floor never writes heat");
  assert.ok(!/document\.documentElement\.style/.test(body), "and writes no custom property at all");

  /* LAWFUL AT ZERO MODULATION, DRIVEN. The period at heat 0 must be exactly the period the floor ran
     before heat existed — not close, exactly — because that identity is the whole of L13's distinction
     between a grant and the gated-motion case. Measured off the shipped arithmetic. */
  const travel = 480, base = 2 * (travel / 1.4) * 1000 / (1 - 0.18);
  const withHeat = hx => 2 * (travel / (1.4 * (1 + 0.6 * hx))) * 1000 / (1 - 0.18);
  assert.equal(withHeat(0), base, "at heat 0 the cycle is byte-identical to the unmodulated one");
  assert.ok(withHeat(1) < base, "and heat speeds the convection rather than starting it");
  assert.ok(withHeat(1) / base > 0.6 && withHeat(1) / base < 0.65,
    `full heat runs the cycle 1.6x faster, no more: ${(base / withHeat(1)).toFixed(2)}x`);
  assert.match(floorSrc, /^  var HEAT_GAIN = 0\.6;/m, "the gain is authored and named as authored");
});

test("2.30 — the stamp moves with the content, because a stamp that does not is not a check", () => {
  const fs = require("fs"), cp = require("child_process");
  const b = fs.readFileSync(path.join(ROOT, "build.js"), "utf8");

  /* THE DEFECT THIS CLOSES, measured on this repository's own history: build-20260910054846 was minted
     at 2.27 and then carried unchanged through 2.28 and its steps 3, 4+5 and 6, because every build
     after the first was a plain one and a plain one preserved. The host served four releases of content
     under one stamp. Verifying a deploy by stamp is the whole procedure the sibling repo's section 1
     step 4 states; a stamp that does not move with the content makes that check answer a question it
     never asked. Preserve-unless-asked is right for iteration and blind at exactly one boundary. */
  assert.match(b, /const STAMP_RE = \/build-\\d\{14\}\/g;/, "the mask is one definition");
  assert.match(b, /assemble\(prior\)\.replace\(STAMP_RE, ""\)/,
    "the decision compares this build's output against the committed artifact with both stamps masked");
  assert.match(b, /if \(trial === committed\.replace\(STAMP_RE, ""\)\) return prior;/,
    "identical content keeps its stamp, so CI's byte-identical regeneration check stays strict");

  /* ONE ASSEMBLY, and this is the part that would rot first. A second copy written to answer "did
     anything change?" is two sources of truth for what ships, and it drifts the first time a line is
     added to one and not the other. */
  assert.match(b, /^function assemble\(stamp\) \{ return `<!doctype html>/m, "the assembly is a function");
  assert.match(b, /^const html = assemble\(STAMP\);/m, "and the real build goes through it");
  assert.equal((b.match(/<!doctype html>/g) || []).length, 1, "there is exactly one assembly in this file");
  assert.match(b, /<!-- \$\{stamp\} -->/, "which takes the stamp as its argument rather than closing over it");

  /* DRIVEN, not read: the three paths, each proved by running the shipped build. Restores whatever it
     touches, and asserts the restore, so a failure here cannot leave the tree dirty. */
  const cssPath = path.join(ROOT, "tome-src", "20_style.css");
  const before = fs.readFileSync(cssPath, "utf8");
  const stampOf = () => (fs.readFileSync(path.join(ROOT, "dist", "index.html"), "utf8").match(/build-\d{14}/) || [])[0];
  const build = args => cp.execFileSync(process.execPath, [path.join(ROOT, "build.js")].concat(args || []),
    { cwd: ROOT, stdio: "pipe" });
  try {
    build([]);
    const kept = stampOf();
    fs.writeFileSync(cssPath, before + "\n/* stamp probe */\n");
    build([]);
    assert.notEqual(stampOf(), kept, "a real content change MINTS a new stamp");
    build(["--keep-stamp"]);
    assert.equal(stampOf(), kept, "--keep-stamp still forces the old behaviour for a deliberate re-cut");
  } finally {
    fs.writeFileSync(cssPath, before);
    build([]);
  }
  assert.equal(fs.readFileSync(cssPath, "utf8"), before, "the probe restored the source it touched");
  assert.equal(stampOf(), (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/build-\d{14}/) || [])[0],
    "and the rebuilt artifact matches the committed one again");
});

test("2.28 — the metaball floor: one filter, and the weight outside it", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const body = floorSrc;   /* 2.31: the part IS the body */
  const G = require(path.join(ROOT, "occvm", "globules.js"));

  /* THE DEFECT THIS RELEASE SHIPPED AND CAUGHT. The isosurface cuts at alpha 0.5 (Blinn), so drawing
     the field AT the display weight of 0.24 puts all of it under the cut and the filter deletes it —
     measured in Chromium on a 25px disc: filtered at alpha 0.24 gives max alpha 0 over 0 non-zero
     pixels, against 255 over 1,804 at alpha 1. The screenshot did not show it, because on the slab it
     was taken from the floor sits behind opaque controls: "looks the same" and "is gone" were the same
     picture. The weight must composite OUTSIDE the filtered buffer, which is the shape BTC's still SVG
     already had in its <g opacity>. Both halves pinned, so neither can drift back. */
  assert.match(body, /blob\(bctx, drops\[i\], 1\)/,
    "the field is drawn OPAQUE through the filter — anything less is below the iso-level and vanishes");
  assert.ok(!/bctx\.globalAlpha = alpha/.test(body),
    "the buffer must never carry the weight: that is the erasure");
  assert.ok(G.ISO === 0.5, "Blinn's half-density surface, which is what makes 0.24 fatal and 1 correct");

  /* 2.33 — DRIVEN, because the regex that used to sit here pinned a SHAPE and the shape was wrong.
     `ctx.filter` filters every DRAWING OPERATION separately, so N fills through a set filter is N
     independent blur-and-threshold passes composited afterwards. That is not a metaball field: fields
     cannot add if each is thresholded before the addition. Measured in Chromium on two r=24 discs,
     alpha at the midpoint between them:

         gap        0px   2px   4px   6px   8px
         per draw     0     0     0     0     0      <- what shipped from 2.28
         one pass   255   255   255   255     0      <- and what BTC's still SVG always did

     The canvas NEVER joined, at any separation, including touching. 2.28 wrote that "two approaching
     drops join with no merge code at all" and that one gooFilter "serves BTC's still data-URI SVG and
     Rhyme's live canvas ... so the live floor and every still frame cut at the same level". The first
     was false and the second was false; an SVG <g filter> wraps the RENDERED GROUP, which is the summed
     field by construction, so only the canvas was wrong. Fixed by filtering the composite, which is
     also 3,278x cheaper — 196.67 ms/frame against 0.06 for the unfiltered pass at 390x844 with 37
     drops, and the page went 5.0 fps to 54.
     Pinned as counts off the driven op streams rather than as source text, so the shape may change
     again and the property cannot. */
  {
    const F = loadFloor();
    F.sandbox.OCCVM_FLOOR.ambientFloor(F.canvas, true, 0, { alpha: 0.24 });
    const buf = F.made[0] && F.made[0]._ops, iso = F.made[1] && F.made[1]._ops;
    assert.ok(buf && iso, "the filtered path ran: a buffer and an isosurface canvas were made");
    const arcs = buf.filter(o => o[0] === "arc").length;
    assert.ok(arcs > 2, `the drops are drawn to the buffer (${arcs} arcs)`);
    const bufFilters = buf.filter(o => o[0] === "set:filter" && /url\(#/.test(String(o[1]))).length;
    assert.equal(bufFilters, 0, "the buffer draws the field with NO filter set — it is the summed field");
    const isoFilters = iso.filter(o => o[0] === "set:filter" && /url\(#/.test(String(o[1]))).length;
    assert.equal(isoFilters, 1,
      "and the filter runs exactly ONCE, over that whole field — not once per drop, which never joins");
    assert.ok(iso.some(o => o[0] === "drawImage"), "the one filtered operation is the composite itself");
    /* the weight lands on the DISPLAY, after the threshold. Reading the spec instead of driving it got
       this wrong while writing this very change: globalAlpha on a filtered drawImage applies BEFORE
       the filter, which re-created 2.28's erasure exactly — one r=25 drop at alpha 0.2 gave max alpha
       0 over 0 non-zero pixels. Hence two buffers. Measured after: 51 over 1,804, which is 0.2 of 255
       over identical coverage. */
    const wIdx = F.ops.findIndex(o => o[0] === "set:globalAlpha" && o[1] === 0.24);
    const dIdx = F.ops.findIndex(o => o[0] === "drawImage");
    assert.ok(wIdx >= 0 && dIdx > wIdx, "the display sets the weight and then composites the isosurface");
    assert.equal(iso.filter(o => o[0] === "set:globalAlpha" && o[1] !== 1).length, 0,
      "and the isosurface canvas never carries a weight of its own");
  }

  /* ONE FILTER DEFINITION for the live canvas and every still frame */
  assert.match(body, /OCCVM_GLOBULES\.gooFilter\(\{ id: id \}\)/,
    "the filter comes from the shared part, not from markup typed here");
  assert.match(body, /ctx\.filter = "url\(#" \+ gooId|bctx\.filter = "url\(#" \+ gooId/,
    "and the canvas names that same filter");

  /* THE BRIDGE QUAD IS GONE, and that is the point of the technique rather than a tidy-up: overlapping
     fields add, so a join renders with no geometry standing in for physics — and an ARRESTED join is
     rendered by stopping the approach, which an explicit bridge could never express. */
  assert.ok(!/function bridge\(/.test(ui), "no hand-drawn bridge survives");
  assert.ok(!/bridge\(welds\[i\]/.test(body), "and nothing calls one");

  /* A DEGRADATION, NEVER A BLANK — the same rule L8 applies to reduced motion. */
  assert.match(body, /blob\(ctx, drops\[i\], alpha\)/,
    "without SVG-filter support on a 2D context the unthresholded 2.25 field still paints");

  /* merge conservation has ONE owner and it is not this file */
  assert.match(body, /OCCVM_GLOBULES\.merged\(a\.r, b\.r\)/, "the radius comes from the shared convention");
  assert.match(body, /OCCVM_GLOBULES\.MERGE_POWER/, "and the centre weights by the same power");
  assert.ok(!/Math\.sqrt\(m\)/.test(body), "the old area convention is gone rather than left beside it");
  assert.equal(G.MERGE_POWER, 3, "volume, decided and recorded in occvm/globules.js");
});

test("2.28 step 3 — buoyancy: the shape is sourced, the speed is authored, the substance says zero", () => {
  const fs = require("fs");
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const body = floorSrc;   /* 2.31: the part IS the body */
  const G = require(path.join(ROOT, "occvm", "globules.js"));
  const R = require(path.join(ROOT, "occvm", "rheology.js"));

  /* THE SUBSTANCE'S OWN ANSWER, measured rather than asserted. L13 records the floor's cost as a
     sentence; this is the number behind it, and it is what makes the authored speed honest rather than
     lazy: there is no derivation to reach for, because the derivation returns zero at every radius the
     field contains. */
  for (const r of [G.R[0], 20, G.R[1]])
    assert.equal(G.risesAt(r), false, `a ${r}px globule cannot rise: buoyancy is below the yield stress`);
  assert.ok(G.buoyantStress(G.R[1]) < R.SUBSTANCE.tau0 / 4,
    "and it is not marginal — the largest globule in the field is over 4x short");
  assert.ok(G.risesAt(126) === false && G.risesAt(130) === true,
    "the radius at which buoyancy could move anything is ~126px, four times the ceiling");

  /* THE CYCLE'S SHAPE: rise, attach, sink, rest — Gyüre & Jánosi's process, driven rather than read */
  const half = 0.5, DW = 0.18, move = half * (1 - DW);
  const E = R.easing(R.SUBSTANCE, 1, 33);
  const ease = x => { const t = Math.max(0, Math.min(1, x)) * (E.length - 1), i = Math.floor(t), f = t - i;
    return i >= E.length - 1 ? E[E.length - 1] : E[i] + (E[i + 1] - E[i]) * f; };
  const pos = u => u < move ? ease(u / move) : u < half ? 1
    : u < half + move ? 1 - ease((u - half) / move) : 0;
  const traj = []; for (let i = 0; i <= 60; i++) traj.push(pos(i / 60));
  assert.equal(traj[0], 0, "starts at the bottom");
  assert.equal(Math.max(...traj), 1, "reaches the top");
  const rise = traj.slice(0, 25), sink = traj.slice(32, 56);
  assert.ok(rise.every((v, i) => i === 0 || v >= rise[i - 1]), "the rise is monotone");
  assert.ok(sink.every((v, i) => i === 0 || v <= sink[i - 1]), "the sink is monotone");
  assert.ok(pos(0.45) === 1 && pos(0.95) === 0, "and it dwells at both ends rather than turning on a point");

  /* THE TURN IS THE SUBSTANCE'S OWN CURVE, not an invented ease. One-sided and recorded as such: this
     system owns exactly one curve for coming irreversibly to rest and none for setting off, so the
     arrival is derived and the departure inherits it rather than a time-reversal being invented. */
  /* module scope, beside cyclePos: neither is a function of a canvas, so the harness drives the curve
     itself rather than inferring it from a closure */
  assert.match(floorSrc, /OCCVM_RHEOLOGY\.easing\(OCCVM_RHEOLOGY\.SUBSTANCE, 1, 33\)/,
    "the cessation curve, sampled once — it is a property of the substance, not of the frame");
  assert.ok(!/cubic-bezier|easeInOut|\* \* \(3 - 2 \*/.test(floorSrc), "no invented easing sits beside it");

  /* 2.31 — ONCE, AND LAZILY, and the second half is the one that matters now that this is a spliced
     part. Sampling at load would capture whatever OCCVM_RHEOLOGY was at that instant, and the splicer
     puts parts in after one anchor, so a part's position is insertion history rather than the list's
     order. That is exactly how fracture.js captured a null OCCVM_VEINS at 2.0: it threw on every call
     in the browser and passed in Node, because `require` resolved what the page could not. Driven both
     ways rather than read — the part evaluates with NO substance in scope and still exposes its API,
     and the curve is integrated exactly once however many times it is read. */
  {
    const vm2 = require("vm");
    const code = built.slice(built.indexOf("/* ==== OCCVM SPINE floor.js"), built.indexOf("/* ==== END OCCVM floor.js"));
    const bare = { Math };
    bare.globalThis = bare; vm2.createContext(bare);
    assert.doesNotThrow(() => vm2.runInContext(code, bare),
      "the part evaluates with no sibling global in scope — nothing is captured at load");
    assert.ok(bare.OCCVM_FLOOR && typeof bare.OCCVM_FLOOR.ambientFloor === "function",
      "and it still exposes its API");
    assert.equal(bare.OCCVM_FLOOR.cyclePos(0.25) > 0, true,
      "with no substance the curve degrades to the straight ramp rather than throwing");

    let integrations = 0;
    const R2 = require(path.join(ROOT, "occvm", "rheology.js"));
    const spy = { Math, OCCVM_RHEOLOGY: { SUBSTANCE: R2.SUBSTANCE, easing: (...a) => { integrations++; return R2.easing(...a); } } };
    spy.globalThis = spy; vm2.createContext(spy); vm2.runInContext(code, spy);
    assert.equal(integrations, 0, "nothing is integrated while the part evaluates");
    spy.OCCVM_FLOOR.cyclePos(0.1); spy.OCCVM_FLOOR.cyclePos(0.2); spy.OCCVM_FLOOR.cyclePos(0.3);
    assert.equal(integrations, 1, "and exactly once however many times the curve is read");
  }
  assert.ok(pos(0.1) > 0.1 * (1 / move), "and the curve is not a straight ramp");

  /* ONE AUTHORED NUMBER FOR THE PACE, and the period follows from it and the surface */
  assert.match(floorSrc, /^  var RISE_PX_S = 1\.4;/m, "the pace 2.22 already had, now vertical and cyclic");
  assert.match(body, /period = 2 \* \(travel \/ \(RISE_PX_S \* \(1 \+ HEAT_GAIN \* hx\)\)\)/,
    "the period is derived from the speed and the height, not authored beside them");

  /* THE PHASE IS THE FIELD'S, so the floor is the same floor every session and can be recorded */
  assert.ok(G.field({ seed: 1, w: 400, h: 300 }).drops.every(d => typeof d.phase === "number" && d.phase >= 0 && d.phase < 1),
    "every drop carries a seeded phase");
  assert.ok(!/Math\.random/.test(body), "and nothing in the floor reaches for a fresh random");

  /* the random-direction drift 2.22 shipped is GONE, not left beside the cycle */
  assert.ok(!/d\.y \+= d\.vy \* dt/.test(body),
    "the old model had no bottom, no top and no turnaround; it is replaced rather than supplemented");
});

test("2.28 steps 4+5 — the coil decides where, tau0 decides what, driven not read", () => {
  const G = require(path.join(ROOT, "occvm", "globules.js"));
  const { sandbox, canvas, frames, ops, made } = loadFloor();
  sandbox.ambientFloor(canvas, false);

  /* pump the SHIPPED floor through many cycles. The period is ~2h/1.4 s on a 480px face, so a real
     look at the page would take fifteen minutes; the frame callback takes its own clock, so the same
     code runs at any speed. Driving the call path rather than a replica is the 2.22 lesson. */
  let t = 0;
  for (let i = 0; i < 40000 && frames.length; i++) { t += 90; frames[frames.length - 1](t); }

  assert.ok(frames.length > 1, "the floor kept animating across the whole run");

  /* WHAT THE RUN ACTUALLY PRODUCED, read off the canvas rather than off the source. Every drop is one
     `arc`; a pair that has arrested holds a CONSTANT separation frame after frame while both move,
     which is the observable signature of one stuck object with two lobes and cannot be faked by two
     drops that merely passed near each other. Sampled over the last few frames of the run. */
  const framesOfArcs = [];
  for (let k = 0; k < 6; k++) {
    /* 2.33 — the arcs land on the BUFFER, not the display context: the drops are drawn opaque to an
       offscreen canvas and the display takes one filtered composite. Reading `ops` here counted zero
       arcs the moment the filtered path became reachable, which is the same class as the whitelist
       above — the guard was reading the canvas the code stopped drawing on. `made[0]` is the buffer,
       created on the first paint. */
    const bufOps = made.length ? made[0]._ops : ops;
    const before = bufOps.length;
    t += 90; frames[frames.length - 1](t);
    framesOfArcs.push(bufOps.slice(before).filter(o => o[0] === "arc").map(o => ({ x: o[1], y: o[2], r: o[3] })));
  }
  const n0 = framesOfArcs[0].length;
  assert.ok(n0 > 3, `the field is populated (${n0} drops)`);
  assert.ok(framesOfArcs.every(f => f.length === n0),
    "the count is stable across frames — an arrested pair stays two lobes rather than vanishing into one");

  let lockedPairs = 0;
  for (let a = 0; a < n0; a++) for (let b = a + 1; b < n0; b++) {
    const sep = f => Math.hypot(f[a].x - f[b].x, f[a].y - f[b].y);
    const s0 = sep(framesOfArcs[0]);
    if (s0 > framesOfArcs[0][a].r + framesOfArcs[0][b].r) continue;      /* not touching */
    if (framesOfArcs.every(f => Math.abs(sep(f) - s0) < 1e-6)) lockedPairs++;
  }
  assert.ok(lockedPairs > 0,
    `the substance says ~96% of merges arrest, and the floor produced ${lockedPairs} frozen pair(s) — ` +
    "a run with none would mean the arrest branch never fires");

  /* THE COIL: a weld may only begin while BOTH drops rest at the bottom of the cycle. Driven on the
     shipped predicate rather than asserted from the source. */
  const ui = require("fs").readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const body = floorSrc;   /* 2.31: the part IS the body */
  assert.match(body, /if \(!atCoil\(p, period\) \|\| !atCoil\(q, period\)\) continue;/,
    "recombination happens at the coil, not wherever two globules touch");
  assert.match(body, /return cyclePos\(\(\(clock \/ period\) \+ d\.phase\) % 1\) === 0;/,
    "and the coil is the bottom dwell step 3 already put there — no authored coil height");
  assert.ok(sandbox.cyclePos(0.99) === 0 && sandbox.cyclePos(0.25) > 0,
    "the predicate's own basis: cyclePos is exactly 0 only while resting at the bottom");

  /* THE SUBSTANCE DECIDES BEFORE THE BRIDGE GROWS, from the radii alone, so no branch appears
     mid-merge and the same weld renders either outcome. */
  assert.match(body, /var reg = OCCVM_GLOBULES\.arrestRegime\(p\.r, q\.r\);/);
  assert.match(body, /arrests: reg !== "completes"/);
  assert.match(body, /target: lobe \* OCCVM_GLOBULES\.arrestedBridge\(p\.r, q\.r\)/,
    "and the bridge stops at the height the Bingham number allows");

  /* THE ARRESTED PAIR IS ONE STUCK OBJECT — which answers the plan's open accumulation question
     without inventing a rule, and is self-limiting: a pair that has arrested is done. */
  assert.match(body, /a\.locked = b\.locked = true;/);
  /* ONE RIGID OBJECT, not two drops that agree to move alike. The first draft gave the follower the
     leader's phase and let it compute its own height — and because that height depends on the drop's
     own radius, two lobes of different size drifted apart over the cycle and the arrest was invisible
     in the render. A frozen bridge does not stretch. */
  assert.match(body, /b\.lockedTo = a; b\.dx = b\.x - a\.x; b\.dy = b\.y - a\.y;/,
    "the follower holds the offset it froze at");
  assert.match(body, /if \(f\.lockedTo\) \{ f\.x = f\.lockedTo\.x \+ f\.dx; f\.y = f\.lockedTo\.y \+ f\.dy; \}/,
    "and is placed from the leader every frame, never from its own cycle");
  assert.ok(!/b\.phase = a\.phase/.test(body),
    "sharing a phase is not enough: two lobes of different radius compute different heights from it");
  assert.ok(!/a\.r = OCCVM_GLOBULES\.merged\(a\.r, b\.r\);[\s\S]{0,80}locked/.test(body),
    "an arrested pair does NOT become one drop: the lobes remain, which is what a frozen dumbbell is");
  assert.match(body, /p\.merging \|\| q\.merging \|\| p\.locked \|\| q\.locked/,
    "and a locked pair never welds again — the bridge would have to beat a stress that already stopped it");
});

test("2.28 step 5 — the arrested bridge height follows the Bingham number, with the right limits", () => {
  const G = require(path.join(ROOT, "occvm", "globules.js"));
  /* the falloff is authored; its two LIMITS are not, and they are what makes the regimes meet
     without a seam: the bridge reaches a full lobe exactly where Bi reaches 1, which is the same
     group that defines completion. */
  assert.equal(G.arrestedBridge(2, 2), 1, "below Bi = 1 the bridge closes completely");
  assert.ok(Math.abs(G.bingham(2, 2)) < 1, "and that pair is genuinely below the boundary");
  const at = (a, b) => +G.arrestedBridge(a, b).toFixed(3);
  assert.ok(at(9, 9) > at(15, 15) && at(15, 15) > at(30, 30),
    "a bigger pair freezes with a thinner waist, monotonically");
  assert.ok(at(9, 9) > 0.6 && at(30, 30) < 0.2, `measured ${at(9, 9)} .. ${at(30, 30)}`);
  /* the seam: approach Bi = 1 from both sides and the bridge fraction is continuous at 1 */
  const lp = G.arrestLengths().complete;
  const justUnder = lp * 0.999 / Math.cbrt(2), justOver = lp * 1.001 / Math.cbrt(2);
  assert.ok(Math.abs(G.arrestedBridge(justUnder, justUnder) - G.arrestedBridge(justOver, justOver)) < 0.01,
    "the completion boundary and the bridge falloff are the same boundary");
});

test("2.28 — the arrest model: two lengths, three regimes, and the substance picks", () => {
  const G = require(path.join(ROOT, "occvm", "globules.js"));
  const R = require(path.join(ROOT, "occvm", "rheology.js"));
  const L = G.arrestLengths();
  /* γ/τ₀ IS the capillary length, because 2.10 fixed τ₀ by the puddle-height identity. Asserted from
     the formulas so it survives a change to γ or ρ. */
  assert.ok(Math.abs(L.complete - R.radiusPx(R.SUBSTANCE)) < 0.01, "γ/τ₀ = √(γ/ρg), by construction");
  assert.equal(R.SUBSTANCE.tau0Dynamic, 4.41, "the dynamic intercept is a constant, not a comment");
  assert.ok(L.joined > L.complete, "static and dynamic bracket rather than compete");
  assert.equal(G.arrestRegime(2, 2), "completes");
  assert.equal(G.arrestRegime(9, 9), "dumbbell");
  assert.equal(G.arrestRegime(30, 30), "joined");
  /* the shipped band produces no completed merge at all, and the band was not moved to fake one */
  const rnd = G.mulberry32(20260910); let c = 0;
  for (let i = 0; i < 20000; i++)
    if (G.arrestRegime(G.R[0] + rnd() * (G.R[1] - G.R[0]), G.R[0] + rnd() * (G.R[1] - G.R[0])) === "completes") c++;
  assert.equal(c, 0, "a merged radius never beats its larger parent, so the band cannot reach completion");
  assert.deepEqual(G.R, [9, 30], "and the band stays where 2.25 measured it");
});

test("2.22 — the auditor measures the per-tool grant, through the path the runner uses", () => {
  const LA = require(path.join(ROOT, "occvm", "tools", "law-audit.js"));
  const L13 = LA.LAWS.find(l => l.id === "L13");
  /* the defect this closes: readTool handed the measure {raw, own} with no name, so L13's per-tool
     grant read `undefined` and answered "withheld" for both tools on every real run, while four
     synthetic cases built their own {name, own} and passed */
  for (const t of LA.TOOLS) {
    const src = LA.readTool(t);
    if (!src) continue;
    assert.equal(src.name, t.name, `${t.name} carries its own name into the measure`);
  }
  const rhyme = LA.readTool(LA.TOOLS.find(t => /Rhyme/.test(t.name)));
  assert.equal(L13.measure(rhyme).state, "CONFORMS", "the granted floor conforms where it was granted");
  assert.match(L13.measure(rhyme).detail, /reduced-motion guarded/);
  /* 2.34 — BTC IS NO LONGER WITHHELD, it is granted ONE surface, so the claim this line used to make
     ("the identical source in the withheld tool diverges") is retired with the withholding. What
     replaces it is the bound: Rhyme's floor relabelled as BTC's still diverges, because it names no
     granted surface, declares no fixed layer and mounts nothing ahead of a content column. The split
     is still the law's rather than the file's — it is a split about SURFACE now instead of about tool.
     And the shape passed in is the runner's: this line handed the measure {name, own} with no `raw`,
     which threw the moment the measure read markup, and it is the THIRD time a fixture on this one law
     has been built to a shape readTool does not produce. It is built from readTool's output now. */
  const asBtc = Object.assign({}, rhyme, { name: "BTC Terminal" });
  assert.equal(L13.measure(asBtc).state, "DIVERGES",
    "this tool's floor, relabelled, misses every bound BTC's grant is bounded by");
  assert.match(L13.measure(asBtc).detail, /granted surface|position:fixed|content column/,
    "and it says which bound, rather than only that something is wrong");
});

test("2.22 — the committed artifact is what a build produces, and the worker came with it", () => {
  /* THE DEFECT. 2.21 shipped an index.html at build-20260909214145 against an sw.js naming
     tome-build-20260909212530: the suite ran BEFORE `build.js --stamp`, and the copy that followed
     refreshed the page and not the worker. The stamp assertion above would have caught it — it was not
     missing, it ran against the previous state. So the hole is ORDERING, and no assertion placed after
     a stale copy can close it.

     TWO WRONG INSTRUMENTS, BOTH RECORDED. The first compared the repo root against dist/ with nothing
     guaranteeing dist/ existed; it is not committed, so on a fresh checkout CI failed on the guard
     rather than on the code — 101 of 102, the one failure mine. The second added `pretest` that built
     AND copied dist/ over the root. That is worse than useless: it would have LAUNDERED the drift, on
     CI as well, repairing a stale committed artifact in the working tree and then passing every
     comparison downstream of it — a gate that repairs what it is meant to detect.

     WHAT IS IN FORCE. `pretest` builds and does not copy, so dist/ always exists and is always fresh;
     the copy into the repo root stays a deliberate act. Then this comparison is exact and cannot be
     satisfied by accident: a committed artifact that is not what a build produces fails, whatever order
     anything ran in. */
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.pretest, "node build.js", "pretest builds and must never copy — a gate may not repair its own subject");

  for (const f of ["index.html", "sw.js", "manifest.json"]) {
    const root = fs.readFileSync(path.join(ROOT, f));
    const dist = fs.readFileSync(path.join(ROOT, "dist", f));
    assert.ok(root.equals(dist), `${f} at the repo root is not what build.js produces — the deploy copy is stale or partial`);
  }
});

test("2.22b — the floor tracks the face it sits behind, and sits behind the face", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");

  /* MEASURED IN CHROMIUM, not reasoned about. The floor first sized itself once at mount, from a `.bars`
     that is nearly empty until bars exist, and nothing re-measured: 356×44 px behind a face several
     times that. Every assertion in this file passed. A canvas whose backing store is set from a
     measurement needs an observer on the thing it measures, or it is sized to a moment. */
  assert.match(floorSrc, /new ResizeObserver\(onResize\)/, "the floor observes its own container");
  assert.match(floorSrc, /ro\.observe\(canvas\.parentNode \|\| canvas\)/, "and observes the element it fills");
  assert.match(floorSrc, /if \(ro\) ro\.disconnect\(\)/, "and disconnects on teardown");

  /* AND WHERE IT SITS WAS ALSO MEASURED. Inside `.bars` it moved 0.81% of pixels at a mean 1.18 L*: the
     bar cards are opaque, so a floor between them has almost nowhere to show. Behind the whole face it
     moves 28.35% at a median 0.42 L*, p99 3.03, max 22.65 — a broad sub-threshold wash with rare
     brighter cores, which is what a floor is. The authored alpha was never the lever; the coverage was,
     and widening beats brightening. */
  /* 2.24 moved it up once more, from the draft face to the SLAB; 2.37 moves it off the slabs entirely.
     That is the fourth placement in this file's history and every one of them was chosen by measuring
     what reached the eye — bars 0.81% of pixels, the face 28.35%, the slab, and now the page ground,
     where the slabs stop hiding it because they became glass instead of walls. The clause that read
     "the canvas is the slab's" is retired with the architecture; what replaces it is the property
     that made the move worth making — the field is mounted ONCE, ahead of the content, and no
     surface paints a second copy. */
  assert.equal((ui.match(/OCCVM_FLOOR\.ambientFloor\(/g) || []).length, 1, "one floor, one call site");
  assert.equal((ui.match(/id="occvm-floor"/g) || []).length, 1, "mounted exactly once");
  assert.ok(ui.indexOf('id="occvm-floor"') < ui.indexOf('className="binding"'),
    "and ahead of the content column, so no rearrangement inside a slab can carry it into one");
  assert.ok(!/className="floor"/.test(ui), "no per-slab, per-face or per-bar copy survives");
});

/* ---- 2.23: Reading B — the whole face carries the beat --------------------------------------- */

test("2.23 — the gate is the actual tempo, never the panel's display fallback", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  /* L13's one clause about gated motion, and the reason Reading A was built the way it was. TempoPanel
     keeps `tempo || {bpm: 90, ...}` so it can render before a tempo exists; if the pulse read THAT, a
     draft nobody has set a tempo on would beat at 90 forever. Measured in Chromium: with no tempo the
     face reads --pulse 0.000 and the wash resolves fully transparent; after one +5 the button reads
     95 bpm and the pulse peaks at 0.993 on 21 of 120 samples — the hook's 18% strike window. */
  assert.match(ui, /const beatPulse = useBeatPulse\(tempo\);/, "the hook takes the real tempo");
  assert.ok(!/useBeatPulse\(\s*t\s*\)/.test(ui), "never the panel's local fallback `t`");
  const panel = ui.slice(ui.indexOf("function TempoPanel"), ui.indexOf("function Draft"));
  assert.match(panel, /const t = tempo \|\| \{ bpm: 90/, "the fallback still exists, for rendering only");
  assert.ok(!/useBeatPulse/.test(panel), "and the panel never drives a motion from it");
});

test("2.23 — the beat reaches the whole face, under everything, and never a measured surface", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  assert.match(ui, /<div className="draftface" style=\{\{ "--pulse": beatPulse\.toFixed\(3\) \}\}>/,
    "the face carries the phase");
  assert.match(css, /\.draftface \{ position: relative;\n\s*background-image: radial-gradient/,
    "and paints it on its own background, which sits under every in-flow child");
  assert.match(css, /var\(--pulse, 0\)/, "with a fallback of zero, so a missing phase is a still face");

  /* the orphan, recorded rather than adopted: `.face` is declared and worn by nothing, and an element
     taking that name would silently inherit `.face + .edge`'s margin */
  assert.match(css, /^\.face \{ position: relative; \}$/m, "the orphan is still declared");
  assert.ok(!/className="face"/.test(ui), "and still worn by nothing — D14's shape in tool-local CSS");

  /* a bar carries --heat, a measured value; the beat never reaches one */
  const barRules = css.split("\n").filter(l => /^\.bar[\s.[{:]/.test(l)).join("\n");
  assert.ok(barRules.length > 0, "there are bar rules to check");
  assert.ok(!/--pulse/.test(barRules), "no bar reads the beat");
});

test("2.23 — L8: reduced motion gets a still face, from both the hook and the stylesheet", () => {
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const hook = ui.slice(ui.indexOf("function useBeatPulse"), ui.indexOf("return phase;"));
  assert.match(hook, /prefers-reduced-motion: reduce/, "the hook checks the setting");
  assert.match(hook, /if \(reduce\) \{ setPhase\(0\); return; \}/, "and stops rather than slowing");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.draftface \{ background-image: none; \} \}/,
    "and the stylesheet says it too, so a missed JS path still lands still");
  /* measured in Chromium under reducedMotion:"reduce" with a real 95 bpm tempo set: --pulse stayed 0
     across 120 samples and the resolved background-image was `none` */
});

test("2.24 — the bar editor edits the line as typed, not the reading's trimmed copy of it", () => {
  /* FOUND IN THE FIELD: "when cutting a bar, after the first character the space bar doesn't work."
     reading() trims each line before building a bar, and BarCut was a controlled input bound to
     bar.text — so the space that made "ink " was erased by the same render that reacted to it, on every
     keystroke, from the first character onward (before a bar exists the fallback branch binds the raw
     line, which is why it worked until then). Pre-existing, not the roadmap's; no test had ever typed a
     space into a bar and looked. The editor now binds the raw line and the reading stays a reading. */
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  assert.match(ui, /<Bar key=\{i\} bar=\{reading\.bars\[i\]\} raw=\{ln\}/, "the raw line travels to the bar");
  assert.match(ui, /\{editing \? <BarCut value=\{raw\}/, "and the editor binds it");
  assert.ok(!/<BarCut value=\{bar\.text\}/.test(ui), "never the trimmed text again");
  const eng = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  assert.match(eng.slice(eng.indexOf("function reading(")), /const text = ln\.trim\(\);/,
    "the reading still trims — that is correct for reading, and is exactly why the editor must not read it");
});

test("2.24 — three authored weights, each pinned to the measurement that chose it", () => {
  /* Every one of these shipped at a value that measured invisible on a phone and was reported so by
     the owner. Re-aimed by measurement, not taste, and pinned here with the table so a later "tune"
     has to argue with a number: */
  const ui = fs.readFileSync(path.join(ROOT, "tome-src", "30_ui.jsx"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  /* the globule field as the slab's substrate: 0.05 → 0.78 L*, 0.10 → 1.43, 0.16 → 2.20, 0.24 → 3.21,
     0.32 → 4.20 mean over the moved region of a live lookup slab */
  assert.match(floorSrc, /^  var ALPHA = 0\.24;/m, "the field is seen: 3.21 L* mean, under a beat strike's 4.6");
  /* Reading B's mix: 9% → 1.66 L*, 25% → 5.05, 40% → 8.36, 55% → 11.65 over the moved region at peak */
  assert.match(css, /calc\(var\(--pulse, 0\) \* 25%\)/, "the face strikes at the control's measured weight (Reading A: 5.9)");
  /* the strike window: 0.18 of a beat was ~7 frames at 95 bpm; 0.32 measured 35 of 120 samples non-zero */
  assert.match(ui, /^var PULSE_STRIKE = 0\.32;/m, "a decay long enough to be a beat rather than a frame");
  assert.match(ui, /setPhase\(u < PULSE_STRIKE \? 1 - u \/ PULSE_STRIKE : 0\);/, "and the hook reads the named constant");
});

test("2.36 — the safe area is read once into a token, so an inset can actually be driven", () => {
  /* From a recording on the owner's phone: this tool's sticky binding carried the inset inline and
     nothing else did, so a panel header scrolled to the top of the viewport collided with the system
     clock. The sibling was worse — no inset anywhere — and both had the same root cause: env() cannot
     be set from a harness and no engine here emulates a notch, so an inset written inline into a rule
     is an inset nobody can test. Read once into a property, it is drivable: measured in Chromium at
     0 the binding pads 12px and the band is 0 tall, at 59px the binding pads 59 and the band is 59. */
  const css = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const envs = bare.match(/env\(safe-area-inset-[a-z]+/g) || [];
  assert.equal(envs.length, 2, `env() should appear once per edge and only in the token: ${envs.join(" ")}`);
  assert.match(bare, /--safe-top:\s*env\(safe-area-inset-top/, "--safe-top is declared from env()");
  assert.match(bare, /padding-top:\s*max\(12px,\s*var\(--safe-top\)\)/, "the binding reads the token");
  assert.match(bare.replace(/\s+/g, " "), /body::after \{[^}]*height: var\(--safe-top\)/,
    "an opaque band exactly the inset tall covers whatever scrolls under the status bar");
});

test("2.37 — a trig function already returns an angle, and multiplying it by one is a dropped declaration", () => {
  /* FOUND BY DRIVING THE DEPLOYED BUILD, not by reading the source. `.slab`'s computed
     background-image was `none` on build-20260910171532, and so were `.binding`'s and
     `.text .w.override`'s. The cause is one expression written four times:

         linear-gradient(calc(atan2(var(--ly), var(--lx)) * 1rad + 90deg), …)

     CSS `atan2()` RETURNS AN ANGLE. Multiplying an angle by `1rad` is angle x angle, which is a type
     error — and because the expression contains var(), it is invalid AT COMPUTED-VALUE TIME, so the
     property does not fall back to an earlier cascade entry the way a parse error would. It computes
     to its INITIAL value. `background-image: none`. Silently, on four surfaces, with no console
     message and every source-text assertion still passing.

     What it cost, on the live build: the open face had NO SUBSTRATE — the globule field ran straight
     through it and its controls floated on the page ground. That is the "globules read as large
     discrete blobs on the draft face" the owner reported from a phone at 2.36, which was recorded
     there as a question of scale. It was not scale. The binding lost its bronze the same way, and
     `.text .w.override` — `color: transparent` over a `background-clip: text` gradient — painted
     NOTHING AT ALL, so an override word in a draft was invisible.

     The guard is narrow on purpose and is not the general fix. The general property is "no
     declaration computes to its initial value by accident", and that is only visible in a browser;
     the golden recorder is where it belongs and it is not built here. This catches the class that
     actually shipped: an angle-valued trig function multiplied by a unit. Comments are stripped
     first — a guard that reads its own prose has now been the bug four releases running. */
  const raw = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, " ");
  const ANGLE_FN = /\b(atan2|atan|asin|acos)\s*\(/g;
  const offenders = [];
  let m;
  while ((m = ANGLE_FN.exec(css))) {
    let i = m.index + m[0].length, depth = 1;
    while (i < css.length && depth > 0) { if (css[i] === "(") depth++; else if (css[i] === ")") depth--; i++; }
    const after = css.slice(i, i + 24);
    if (/^\s*\*\s*[\d.]*\s*(deg|rad|grad|turn)\b/.test(after)) offenders.push(m[1] + "(…)" + after.trim().slice(0, 12));
  }
  assert.deepEqual(offenders, [],
    `${offenders.length} angle-valued trig result(s) multiplied by an angle unit — the whole declaration is dropped: ${offenders.join(", ")}`);
  /* and the four sites are still there, doing the thing they were written to do: a gradient whose
     axis is the light's own bearing, turned 90deg, which is what 25_card.js computes in JS as
     Math.atan2(L.ly, L.lx) + Math.PI / 2. The count is asserted so the repair cannot be undone by
     deleting the layer instead of fixing it. */
  const fixed = css.match(/atan2\(var\(--ly\), var\(--lx\)\) \+ 90deg/g) || [];
  assert.equal(fixed.length, 4, `expected the four light-bearing gradients, found ${fixed.length}`);
});

test("2.38 — the shared parts are copied between the repositories by hand, and now that is checked", () => {
  /* occvm/ is the spine, and L3 says one fact has one owner. A part carried in two repositories is
     one fact written twice the moment the copies differ, and until 2.38 nothing compared them —
     while every other duplication in this system had a gate: SPINE.md byte-identical, the React
     vendor byte-identical to the sibling's, all three splicers re-splice-and-diff.
     IT WAS ALREADY DRIFTING. `glass.js` here was the PRE-CORRECTION copy, authoring `#ffffff` as the
     rim colour, where the sibling resolves `--bone` at call time and paints nothing without it. That
     correction is written up in the sibling's 2.32 entry as done; it landed there and never arrived
     here, in two commits sharing a message. It stayed invisible because glass.js is spliced nowhere
     in this tool, so no measure ever read it — and a dormant divergence is still one.
     THIS GUARD ONLY FIRES WHERE BOTH REPOSITORIES ARE CHECKED OUT, which is a development machine
     and not CI: each repo's runner clones one. It is named rather than implied, because a guard that
     silently never runs is worse than no guard. The mirror of this lives in the sibling's
     test/occvm.js, so whichever side somebody is working from carries the same check. */
  const there = path.join(ROOT, "..", "Btc-terminal", "occvm");
  if (!fs.existsSync(there)) {
    console.log("  skipped (not passed): the sibling repository is absent, so part parity is unchecked");
    return;
  }
  const here = path.join(ROOT, "occvm");
  /* the sibling's alone by design: the numeric face ships only where mono is rendered (1.3). */
  const SIBLING_ONLY = ["mono.css", "mono.head.css"];
  const pick = d => fs.readdirSync(d).filter(f => /\.(js|css)$/.test(f));
  const mine = pick(here), theirs = new Set(pick(there));
  const shared = mine.filter(f => theirs.has(f));
  assert.ok(shared.length >= 8, `there is a real set to compare (${shared.length} shared parts)`);
  const drifted = shared.filter(f =>
    !fs.readFileSync(path.join(here, f)).equals(fs.readFileSync(path.join(there, f))));
  assert.deepEqual(drifted, [], `shared parts must be byte-identical in both repositories: ${drifted.join(", ")}`);
  /* and nothing this tool carries may go missing from the sibling except the named exceptions */
  const orphan = mine.filter(f => !theirs.has(f) && SIBLING_ONLY.indexOf(f) < 0);
  assert.deepEqual(orphan, [], `parts here that the sibling lacks: ${orphan.join(", ")}`);
});
