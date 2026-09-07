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
  assert.ok(eng.includes("--vein-density") && eng.includes("--vein-habit"), "it must read the spine's tokens");
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

test("veins reads the material's cell rather than restating it", () => {
  const V = require(path.join(ROOT, "occvm", "veins.js"));
  const M = require(path.join(ROOT, "occvm", "material.js"));
  assert.equal(V.CELL, M.ARAGONITE.cell, "one lattice, one owner — not two copies of three numbers");
  assert.equal(M.twinAngle, undefined, "the material must not derive the angle a second time");
});

test("fracture resolves its angle under the PAGE's load order, with no require", () => {
  /* The bug this pins was live in this tool from 1.1b until 2.0, and it was not cosmetic. The splicer
   * inserts every part after one anchor, so parts land in reverse list order and fracture.js is evaluated
   * BEFORE veins.js is assigned. The old code captured OCCVM_VEINS into a module binding at that moment,
   * got null, and threw on every cleave() — and because this tool calls
   *     OCCVM_FRACTURE.cleave(row, () => removeDraft(d.id))
   * the throw happened before `done` ran, so DELETING A DRAFT SILENTLY DID NOTHING for anyone not on
   * reduced motion. Node resolved it through require, so every assertion passed. This test loads the
   * built artifact's own blocks, in the artifact's own order, with no require in scope. */
  const fs = require("fs"), vm = require("vm");
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const blk = n => { const i = src.indexOf("var " + n + " ="); return src.slice(i, src.indexOf("\nif (typeof module", i)); };
  const iMat = src.indexOf("var OCCVM_MATERIAL ="), iVein = src.indexOf("var OCCVM_VEINS ="), iFrac = src.indexOf("var OCCVM_FRACTURE =");
  assert.ok(iMat > 0, "material.js must be spliced into the built artifact");
  assert.ok(iMat < iVein, "material.js must precede veins.js — veins reads the cell at load");
  assert.ok(iFrac < iVein, "fracture before veins is the real order, and what makes this guard meaningful");
  const ctx = vm.createContext({ Math, console });
  for (const n of ["OCCVM_MATERIAL", "OCCVM_FRACTURE", "OCCVM_VEINS"]) vm.runInContext(blk(n), ctx);
  assert.ok(Math.abs(ctx.OCCVM_FRACTURE.twinAngle() - 116.209) < 1e-3,
    "cleave() must be able to reach the twin angle in a page");
});

test("the substrate is derived in linear light, ordered, and hue-preserving", () => {
  const M = require(path.join(ROOT, "occvm", "material.js")), A = M.ARAGONITE;
  const lin = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = h => { const p = lin(h); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
  const s = M.substrate(A, 1);
  assert.ok(lum(s.hi) > lum(s.mid) && lum(s.mid) > lum(s.lo), "hi > mid > lo");
  /* the double-gamma guard: scaling sRGB bytes rendered a 9.35x optical spread as 116x */
  assert.ok(Math.abs(lum(s.hi) / lum(s.lo) / s.spread - 1) < 0.02,
    "the rendered spread must equal the optical ratio in linear light");
  const hue = h => { const p = lin(h), m = Math.max(...p) || 1; return p.map(v => v / m); };
  hue(A.body).forEach((v, i) => assert.ok(Math.abs(v - hue(s.hi)[i]) < 0.02, "one gain, no hue shift"));
  assert.equal(M.substrate(A, 0).lo, A.body, "contrast 0 collapses to the body colour");
});
