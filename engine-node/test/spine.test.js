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
  assert.ok(css.indexOf(fence("spine.css").open) < css.indexOf("--mineral:"));
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
test("the vein generator is spliced and the previous one is kept as the fallback", () => {
  const eng = fs.readFileSync(path.join(ROOT, "tome-src", "10_engine.js"), "utf8");
  assert.ok(eng.includes("OCCVM_VEINS.field"), "veinSVG must use the shared generator");
  assert.match(eng, /function veinSVGLegacy\(/, "the bezier generator stays as the fallback");
  assert.match(eng, /catch \(e\) \{ svg = veinSVGLegacy/, "growth must be guarded");
  assert.ok(eng.includes("--vein-density"), "it must read the spine's density token");
  assert.ok(!/"--vein-habit"/.test(eng), "and not the habit token, retired at 2.8 — a suspension has no direction");
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
  const ctx2 = vm.createContext({ Math, console });
  vm.runInContext(blk("OCCVM_VEINS"), ctx2);
  assert.ok(ctx2.OCCVM_VEINS.grow({ w: 20, h: 12, n: 24, seed: 1 }).particles === 24, "veins aggregates with nothing spliced before it");
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
