/* Regression coverage for the rhyme engine (engine_core.js, via engine_v2.js).
 * Run with: node --test engine-node/test/
 * Every expected value here was checked against a live run of the real engine
 * against the real cmu_skel.json/subtlex_rank.txt before being written down —
 * none of these are guessed ARPAbet transcriptions. */
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine_v2.js");

test.before(async () => { await E.load(); });

test("dictionary actually loaded (not running on the curated-only fallback)", () => {
  assert.equal(E.ready(), true);
  assert.ok(E.size() > 100000, `expected the real CMUdict-derived dictionary, got ${E.size()} words`);
});

test("pronunciation precedence: OVERRIDES > EXCEPTIONS > DICT > g2p", () => {
  assert.equal(E.pronounce("jewels").source, "exception", "EXCEPTIONS must outrank DICT");
  assert.equal(E.pronounce("xqzflorb").source, "rule", "unknown word must fall through to g2p");
  assert.ok(["cmu", "exception"].includes(E.pronounce("running").source));
});

test("initialism handling: spelled out only when it's not also a real dictionary word", () => {
  const pda = E.pronounce("PDA");
  assert.equal(pda.source, "initialism");
  assert.deepEqual(pda.sylls.map(s => s.v), ["IY", "IY", "EY"], "P-D-A should read ee-ee-ay");

  const ok = E.pronounce("OK");
  assert.notEqual(ok.source, "initialism", "OK is a real dictionary word (okay) and must not be spelled out letter by letter");
});

test("slang/initialism syllable counts use the reading people actually say, not CMUdict's first-listed variant", () => {
  assert.equal(E.pronounce("asap").sylls.length, 2, "ASAP should read as 2 syllables (\"ay-sap\"), not the 4-syllable letter-spelling");
  assert.equal(E.pronounce("abs").sylls.length, 1, "abs should read as 1 syllable, not spelled-out letters");
  assert.equal(E.pronounce("tac").sylls.length, 1, "tac should read as 1 syllable");
  // url is the control case: its first-listed variant (3 syllables, "you-are-el") IS the
  // natural reading, and must NOT be "corrected" down to the rarer 1-syllable "erl".
  assert.equal(E.pronounce("url").sylls.length, 3, "url's 3-syllable reading is correct as-is — do not shorten it");
});

test("EXCEPTIONS entries carry real per-syllable stress, not a blanket primary", () => {
  const water = E.pronounce("water").sylls.map(s => s.s);
  assert.deepEqual(water, [1, 0], "water is WA-ter — trochee, not two primaries");
  assert.deepEqual(E.pronounce("disappear").sylls.map(s => s.s), [2, 0, 1]);
  assert.deepEqual(E.pronounce("the").sylls.map(s => s.s), [0], "the is unstressed — the one monosyllable where the table contradicted CMUdict");
});

test("untagged EXCEPTIONS entries still default to primary stress (backward compatible)", () => {
  // "ghost" has no stress digit in the table; it must keep reading as stressed.
  assert.deepEqual(E.pronounce("ghost").sylls.map(s => s.s), [1]);
  assert.equal(E.pronounce("ghost").sylls[0].v, "OW", "the vowel class must not absorb a stress digit");
});

test("stress-anchoring now reaches back past the unstressed tail of a multi-syllable exception", () => {
  // Before real stress values, every exception syllable read as primary, so the anchor
  // stopped at the last syllable and "stress" collapsed into "count".
  assert.deepEqual(E.skeleton("water", 1, "count").vowels, ["ER"]);
  assert.deepEqual(E.skeleton("water", 1, "stress").vowels, ["AO", "ER"]);
  assert.deepEqual(E.skeleton("people", 1, "stress").vowels, ["IY", "AH"]);
});

test("metrical stress demotes function words into a separate field", () => {
  const r = E.reading("the way you move from the block to the booth was love", { pop: "rap" });
  const f = r.bars[0].field;
  const metrical = f.flatMap(w => w.sylls.map(s => s.m));
  assert.deepEqual(metrical, [0,1,0,1,0,0,1,0,0,1,0,1], "beats should land on way/move/block/booth/love");
  assert.deepEqual(f.filter(w => w.sylls.some(s => s.m > 0)).map(w => w.word),
    ["way", "move", "block", "booth", "love"]);
});

test("demotion never touches lexical stress — rhyme and anchoring depend on it", () => {
  const r = E.reading("the way you move", { pop: "rap" });
  const byWord = Object.fromEntries(r.bars[0].field.map(w => [w.word, w.sylls]));
  assert.equal(byWord["you"][0].s, 1, "lexical stress stays as the dictionary has it");
  assert.equal(byWord["you"][0].m, 0, "only the metrical field demotes");
  // the invariant that matters: stress-anchoring must be unmoved by any of this
  assert.deepEqual(E.skeleton("water", 1, "stress").vowels, ["AO", "ER"]);
});

test("every syllable of a multi-syllable function word demotes", () => {
  const r = E.reading("being here", { pop: "rap" });
  const being = r.bars[0].field[0];
  assert.deepEqual(being.sylls.map(s => s.s), [1, 0], "lexical: BE-ing");
  assert.deepEqual(being.sylls.map(s => s.m), [0, 0], "metrical: fully demoted");
});

test("content words keep their stress; a function word demotes even bar-final", () => {
  const r = E.reading("chasing the light of", { pop: "rap" });
  const f = r.bars[0].field;
  assert.ok(f[0].sylls.some(s => s.m > 0), "chasing is a content word — keeps its beat");
  assert.equal(f[3].sylls[0].m, 0, "a function word landing last still demotes — the tool already calls that a weak landing");
});

test("FUNCTION_WORDS deliberately excludes the ambiguous cases", () => {
  const { FUNCTION_WORDS } = require("../rule_g2p_v1.js");
  // These carry beats often enough in this register that guessing costs more than skipping.
  for (const w of ["up", "out", "off", "this", "there", "some", "will", "could", "mine"]) {
    assert.equal(FUNCTION_WORDS.has(w), false, `${w} should stay out of the demotion set without POS tagging`);
  }
  for (const w of ["the", "you", "was", "from", "of", "and"]) {
    assert.equal(FUNCTION_WORDS.has(w), true);
  }
});

test("cliche detection has been removed: reading() bars never carry a .cliche field", () => {
  const r = E.reading("she meant to become who she wanted\nyou turn to stoneware every night", { pop: "rap" });
  for (const b of r.bars) {
    if (!b) continue;
    assert.equal(Object.hasOwn(b, "cliche"), false, `bar ${b.i} still carries a .cliche field`);
  }
});

test("classify(): perfect / slant / none on known pairs", () => {
  assert.equal(E.classify("cat", "hat", 1, "count").kind, "perfect");
  assert.equal(E.classify("cat", "cats", 1, "count").kind, "slant", "same vowel, different final coda");
  assert.equal(E.classify("cat", "cot", 1, "count").kind, "none", "different vowel class");
  assert.equal(E.classify("cat", "cat", 1, "count").kind, "identical");
});

test("stress vs. count anchoring genuinely diverge on a word with an unstressed final syllable", () => {
  // "wanted" = WAA1-N-T-IH0-D: primary stress on the FIRST syllable, unstressed second syllable.
  const count = E.skeleton("wanted", 1, "count");
  const stress = E.skeleton("wanted", 1, "stress");
  assert.deepEqual(count.vowels, ["IH"], "count-anchor takes the literal last syllable");
  assert.deepEqual(stress.vowels, ["AO", "IH"], "stress-anchor must walk back to the primary-stressed syllable");
});

test("lookup() returns tiered, non-empty results for a common word", () => {
  const r = E.lookup("feeling", 1);
  const total = r.perfect.length + r.slant.length + r.loose.length;
  assert.ok(total > 50, `expected a healthy hit count for a common word, got ${total}`);
  assert.ok(r.perfect.every(w => w.tier >= 0 && w.tier <= 3));
});

test("mosaic() finds two-word tails for a multi-syllable query", () => {
  const r = E.mosaic("lingerie", 3, 10);
  assert.ok(r.length > 0, "expected at least one two-word rhyme for a 3-syllable query");
  assert.ok(r.every(m => m.phrase.includes(" ")), "every mosaic result must be a two-word phrase");
});

test("reading(): scheme letters union perfect/slant terminal rhymes but not loose ones", () => {
  const draft = ["this bar ends on cat", "another bar ends on hat", "nothing rhymes with orange"].join("\n");
  const r = E.reading(draft, { pop: "rap" });
  assert.equal(r.bars[0].scheme, r.bars[1].scheme, "cat/hat is a perfect terminal rhyme — same scheme letter");
  assert.notEqual(r.bars[1].scheme, r.bars[2].scheme, "orange only has loose edges to cat/hat — must NOT share their scheme letter");
});

test("reading(): meter drift flags a bar that's a syllabic outlier among its neighbors", () => {
  const draft = ["this bar ends on cat", "another bar ends on hat", "nothing rhymes with orange",
    "a much much much much longer bar than the rest of them by quite a lot of extra words"].join("\n");
  const r = E.reading(draft, { pop: "rap" });
  assert.equal(r.bars[0].drift, 0);
  assert.ok(r.bars[3].drift >= 3, "the deliberately padded closing bar should be flagged for drift");
});

test("reading(): drone flags bars past the per-mode run limit on one vowel", () => {
  const draft = Array(5).fill("time to shine and climb and rhyme").join("\n"); // all end on the same vowel (AY)
  const rap = E.reading(draft, { pop: "rap" }); // limit 3
  assert.ok(rap.maxRun >= 5);
  assert.ok(rap.flagged.length > 0, "a 5-bar drone should be flagged under the rap limit of 3");
});
