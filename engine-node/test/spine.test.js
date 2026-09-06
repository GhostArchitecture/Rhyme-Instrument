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
