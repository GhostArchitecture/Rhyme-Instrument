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

test("P1 stays unwired: no animated horizontal motion exists to be anisotropic against", () => {
  /* The self-retiring guard, over THIS repository's own files. P1 derives a settling time per crystal
   * axis (1/sqrt(k): a 0.7584, b 0.9454, c 1.0000) and ships no token, because anisotropy is only
   * observable as a difference between two directions in the same view and nothing here animates
   * horizontally. When somebody adds a horizontal motion this fails and says P1 has become expressible.
   *
   * BTC carries the same guard over its own files rather than one repo censusing both: reaching across
   * to a sibling checkout makes the verdict depend on what happens to be on disk, which is the
   * partial-checkout trap already fixed once in the token audit and once in the golden recorder. */
  const fs = require("fs");
  const files = [["index.html"], ["tome-src", "20_style.css"], ["tome-src", "30_ui.jsx"], ["occvm", "spine.css"]];
  let x = 0, seen = 0;
  for (const g of files) {
    const f = path.join(ROOT, ...g);
    if (!fs.existsSync(f)) continue;
    seen++;
    for (const line of fs.readFileSync(f, "utf8").split("\n"))
      if (/translateX|translate3d\(\s*[^0]/.test(line) && /transition|animation|keyframes/.test(line)) x++;
  }
  assert.equal(seen, files.length, "the census must actually read every file — a zero from an empty sweep proves nothing");
  assert.equal(x, 0, `${x} animated horizontal motion site(s): P1 is now expressible — wire --dur-a/--dur-b/--dur-c`);

  const M = require(path.join(ROOT, "occvm", "material.js"));
  const mo = M.motion(M.ARAGONITE);
  assert.ok(Math.abs(mo.a - 0.7584) < 1e-3, "duration scales as 1/sqrt(k), the oscillator period");
  assert.ok(mo.a < mo.b && mo.b < mo.c, "a stiffer axis settles faster");
  assert.ok(!fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8").includes("--dur-a"),
    "no P1 token may ship while P1 is unexpressed — that would be OCCVM-D12 again");
});

test("P4 stays unwired, and the golden ratio is rejected by name", () => {
  /* The cell gives a spacing triple a 1.0000 : c 1.1573 : b 1.6069, and it ships nothing: it does not
   * describe either tool (213 declarations censused, 10.79% mean error, worse coverage than a 4px grid)
   * and it does not survive integer-pixel rounding at the sizes 84.5% of spacing uses.
   *
   * The guard ships anyway, because 1.6069 and the golden ratio 1.6180 differ by 0.04px at step 1 and do
   * not reach a whole pixel until step 5 — past the largest spacing either tool uses. They are the same
   * number on screen, so somebody will eventually "correct" one to the other. It is not a typo for phi;
   * it is 7.97/4.96, and the point of OCCVM-L12 is that a value has a reason. */
  const fs = require("fs");
  const M = require(path.join(ROOT, "occvm", "material.js"));
  const sp = M.spacing(M.ARAGONITE);
  assert.ok(Math.abs(sp.b - 1.6069) < 1e-3, "b/a is the cell's ratio");
  assert.ok(Math.abs(M.GOLDEN_RATIO - sp.b) > 0.01, "phi is not the cell's ratio");

  /* the rendered ratio is a function of the base, not the material */
  const step = b => Math.round(b * sp.c) / b;
  const steps = [4, 6, 8, 10, 12, 16].map(step);
  assert.ok(Math.max(...steps) - Math.min(...steps) > 0.1,
    `the rendered c-step must wander with the base: ${steps.map(v => v.toFixed(3)).join(" ")}`);
  assert.ok(steps.every(v => Math.abs(v - sp.c) > 1e-6), "no base renders the cell's c-step exactly");

  for (const f of ["occvm/spine.css", "tome-src/20_style.css"]) {
    const body = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/1\.618/.test(body), `${f} must carry no golden-ratio constant`);
  }
  assert.ok(!/--s[abc]\b|--space-[abc]\b/.test(fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8")),
    "no P4 spacing token may ship while P4 is unexpressed");
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

  /* the sundial owns these, and the offsets it applies are the real L12 adoption target */
  const eng = fs.readFileSync(path.join(ROOT, "occvm", "sundial.js"), "utf8");
  assert.ok(/"--sub":\s*hex\(sub\)/.test(eng), "the sundial writes the substrate base");
  assert.ok(/0\.14 \* \(0\.5 \+ e\)/.test(eng) && /\[0, 0, 0\], 0\.42/.test(eng),
    "and applies two AUTHORED face offsets — the thing OCCVM-L12 exists to replace");

  const M = require(path.join(ROOT, "occvm", "material.js"));
  assert.equal(M.ARAGONITE.body, "#0e0d13", "the body anchoring stays: it matches L1's declared floor");
});
