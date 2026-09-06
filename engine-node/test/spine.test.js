/* The OCCVM spine: spliced into the source stylesheet, matching occvm/spine.css, and reaching the
 * assembled artifact through the build.
 *
 * The source is tome-src/20_style.css, never the assembled index.html — migration section 0b#2, the
 * generator's input is the source. Splicing the artifact would put the block in twice and lose it on
 * the next build.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const { block, OPEN, CLOSE } = require(path.join(ROOT, "occvm", "tools", "splice-spine.js"));
const spine = fs.readFileSync(path.join(ROOT, "occvm", "spine.css"), "utf8");
const src = fs.readFileSync(path.join(ROOT, "tome-src", "20_style.css"), "utf8");
const built = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("the spine is spliced into the source stylesheet exactly once", () => {
  assert.equal(src.split(OPEN).length - 1, 1);
  assert.equal(src.split(CLOSE).length - 1, 1);
});

test("the spliced block matches occvm/spine.css", () => {
  const i = src.indexOf(OPEN), j = src.indexOf(CLOSE);
  assert.equal(src.slice(i, j + CLOSE.length), block(spine));
});

test("the assembled artifact carries the spine, once, from the build", () => {
  assert.equal(built.split(OPEN).length - 1, 1);
});

test("the spine sits above the tool's own :root", () => {
  /* 1.0 is a no-op because the tool wins every collision by ordinary cascade order (migration 3.2).
     If the block moves below the tool's declarations it stops being inert and starts overriding. */
  assert.ok(src.indexOf(OPEN) < src.indexOf("--mineral:"));
});

test("the artifact carries a build stamp", () => {
  assert.match(built, /<!-- build-\d{14} -->/);
});
