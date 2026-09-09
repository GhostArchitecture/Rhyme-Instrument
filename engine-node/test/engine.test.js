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

test("meter(): scores the metrical pattern, and a straight line reads as straight-8", () => {
  const r = E.reading("cold rain fell on empty streets", { pop: "rap" });
  const m = E.meter(r);
  assert.equal(m.best.name, "straight-8");
  const ranked = m.rows[0].all;
  assert.ok(ranked[0].score > ranked[1].score + 0.2, "the winner should separate clearly, not tie");
});

test("meter(): length fit and stress fit are reported apart, because they fail differently", () => {
  const r = E.reading("cold rain fell on empty streets and colder rain fell after", { pop: "rap" });
  const row = E.meter(r).rows[0];
  const straight8 = row.all.find(t => t.name === "straight-8");
  assert.ok(straight8.length < 1, "a 12-syllable bar is not the length of a straight-8");
  assert.ok(straight8.stress > 0, "but its accents still partly agree — the two must not collapse into one number");
  assert.equal(Math.round(straight8.score * 1000) / 1000, Math.round(straight8.stress * straight8.length * 1000) / 1000);
});

test("meter(): scores the demoted pattern, not the lexical one", () => {
  // "the way you move..." is 9/12 lexically stressed but 5/12 metrically. If meter() were
  // reading `s`, a near-uniform pattern would score very differently.
  const r = E.reading("the way you move from the block to the booth was love", { pop: "rap" });
  const row = E.meter(r).rows[0];
  assert.deepEqual(row.pattern, [0,1,0,1,0,0,1,0,0,1,0,1]);
  assert.equal(row.all.find(t => t.name === "triplet-12").stress, 0.75);
});

test("meter(): empty draft doesn't throw or invent a winner", () => {
  const m = E.meter(E.reading("", { pop: "rap" }));
  assert.equal(m.bars, 0);
  assert.deepEqual(m.weakest, []);
  assert.equal(m.ranked.every(t => t.mean === 0), true);
});

test("templates are named by shape only — no artist or region names", () => {
  const { TEMPLATES } = require("../rule_g2p_v1.js");
  assert.ok(TEMPLATES.length >= 4);
  for (const t of TEMPLATES) {
    assert.equal(t.stress.length, t.syllables, `${t.name}: stress array must match its syllable count`);
    assert.match(t.name, /^[a-z]+(-[a-z]+)*-\d+$/, `${t.name} should read as shape-count`);
  }
});

test("grid(): slot count is beats × subdivision, and feel changes how a beat divides", () => {
  assert.equal(E.grid(90, "4/4", "straight").slotsPerBar, 16);
  assert.equal(E.grid(90, "4/4", "triplet").slotsPerBar, 12);
  assert.equal(E.grid(90, "3/4", "straight").slotsPerBar, 12);
  assert.equal(E.grid(90, "4/4", "swing").slotsPerBar, 16, "swing shifts where offbeats sit, not how many there are");
});

test("grid(): slot duration tracks bpm", () => {
  assert.equal(E.grid(60, "4/4", "straight").beatMs, 1000);
  assert.equal(E.grid(120, "4/4", "straight").beatMs, 500);
  /* `slotMs` until now; renamed because under swing NO slot has the mean's duration and the old
   * name claimed every slot did. These two assertions were its only readers, and a guard on a
   * quantity that tracked bpm correctly is exactly what kept the uniform-slot claim looking true. */
  assert.equal(E.grid(60, "4/4", "straight").meanSlotMs, 250);
  assert.ok(E.grid(140, "4/4").beatMs < E.grid(90, "4/4").beatMs);
});

test("grid(): junk input falls back rather than producing NaN", () => {
  const g = E.grid(undefined, "nonsense", "unknown-feel");
  assert.equal(g.beats, 4);
  assert.equal(g.subdivision, 4);
  assert.ok(Number.isFinite(g.meanSlotMs) && g.meanSlotMs > 0);
  assert.ok(g.onsets.every(Number.isFinite) && g.onsets.length === g.slotsPerBar);
});

/* ---- swing is a displacement in TIME, not a label on a straight grid ----------------------------
 * Until this was written, SUBDIVISION gave straight and swing the same 4 and nothing carried an
 * onset, so `swing` produced a grid byte-identical to `straight`. Every assertion here fails against
 * that engine, which is the only reason to trust them. */

test("grid(): swing actually displaces, and straight does not", () => {
  const s = E.grid(90, "4/4", "straight"), w = E.grid(90, "4/4", "swing");
  assert.notDeepEqual(w.onsets, s.onsets, "swing must differ from straight in time, not only by name");
  /* straight is uniform: every gap equal */
  const gaps = s.onsets.slice(1).map((v, i) => +(v - s.onsets[i]).toFixed(6));
  assert.equal(new Set(gaps).size, 1, "a straight grid has exactly one gap length");
});

test("grid(): a swung pair splits 2:1, which is the notated meaning of swing", () => {
  const w = E.grid(90, "4/4", "swing");
  const pairMs = w.beatMs / (w.subdivision / 2);
  assert.ok(Math.abs(w.longMs / (w.longMs + w.shortMs) - 2 / 3) < 1e-9, "long note takes two thirds");
  assert.ok(Math.abs(w.longMs + w.shortMs - pairMs) < 1e-9, "and the pair still spans one pair");
  assert.equal(w.swingRatio, 2 / 3);
  /* the first pair of beat one, measured rather than described */
  assert.ok(Math.abs(w.onsets[1] - pairMs * 2 / 3) < 1e-9);
  assert.ok(Math.abs(w.onsets[2] - pairMs) < 1e-9);
});

test("grid(): swing changes where, never how many or how long the bar is", () => {
  const s = E.grid(90, "4/4", "straight"), w = E.grid(90, "4/4", "swing");
  assert.equal(w.slotsPerBar, s.slotsPerBar, "swing must not add or remove slots");
  assert.equal(w.beatMs * w.beats, s.beatMs * s.beats, "and the bar must run the same length");
  assert.ok(w.onsets[w.onsets.length - 1] < w.beatMs * w.beats, "no slot may fall outside its bar");
  assert.deepEqual([...w.onsets].sort((a, b) => a - b), w.onsets, "onsets stay in order");
});

test("grid(): triplet is uniform and is never silently swung", () => {
  const t3 = E.grid(90, "4/4", "triplet");
  assert.equal(t3.subdivision, 3);
  assert.equal(t3.swingRatio, 0.5, "an odd subdivision has no pairs to swing");
  assert.equal(t3.longMs, t3.shortMs);
  const gaps = t3.onsets.slice(1).map((v, i) => +(v - t3.onsets[i]).toFixed(6));
  assert.equal(new Set(gaps).size, 1);
});

/* ---- SPINE.md section 11: what this tool models, and what it refuses to -------------------------
 * The beat is arithmetic and may be described. The PERFORMANCE is not this tool's and never will be:
 * which slot a syllable lands in, whether a writer leans early or late, what a line does in a mouth.
 * The engine states the room the beat gives and stops.
 *
 * This guard is deliberately narrow. It catches the ONE shape the rule is most likely to be broken by -
 * a public function handing back an assignment of syllables to onsets - because a broad "does not model
 * performance" assertion cannot be written and a guard that cannot fail is decoration. It fails the day
 * the engine's public surface grows one. */

test("the engine never returns a syllable-to-onset assignment — performance is not modelled", () => {
  const read = E.reading("the quick brown fox jumped over it", { pop: 20 });
  const t = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "swing" });
  /* the grid carries onsets - that is the BEAT, arithmetic, and allowed */
  assert.ok(Array.isArray(t.grid.onsets), "the beat's own onsets are the tool's to describe");
  /* no per-bar row may carry them, because a bar is written material and placing it is performance */
  for (const b of t.bars) {
    for (const [k, v] of Object.entries(b)) {
      assert.ok(!/onset|placement|lands|pocket|ahead|behind/i.test(k),
        `pace() row must not carry a placement field, found "${k}"`);
      assert.ok(!(Array.isArray(v) && v.length === b.syllables),
        `pace() row field "${k}" is one entry per syllable — that is a placement, not a description`);
    }
  }
  /* and nothing public may be named for it */
  for (const k of Object.keys(E)) {
    assert.ok(!/place|perform|pocket|quantize|quantise/i.test(k),
      `the engine's public surface must not name a performance operation, found "${k}"`);
  }
});

/* THE BEAT CARRIES THE FEEL AND THE LINE IS WRITTEN AGAINST IT. 2.18 said swing "changes where, never
 * how many or how fast" and called that a virtue; it is wrong in the way that matters. Half a swung
 * bar's slots are short, and a syllable landing there has a third less room than one on the long side.
 * The bar mean sees none of it, which is the constraint the feel exists to impose. */

test("pace(): a swung beat gives uneven room, and the bar mean hides it", () => {
  const read = E.reading("the quick brown fox jumped over it", { pop: 20 });
  const s = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "straight" }).bars[0];
  const w = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "swing" }).bars[0];
  assert.equal(s.even, true, "a straight beat's slots are interchangeable");
  assert.equal(w.even, false, "a swung beat's are not");
  assert.ok(w.tightMs < s.tightMs, "the short side is tighter than any straight slot");
  assert.ok(w.tightRate > s.tightRate, "and demands more syllables a second to land on");
  /* measured at 90bpm: 111.1ms short against 166.7ms even - 9.0/sec against 6.0/sec */
  assert.ok(Math.abs(w.tightRate - 9) < 0.01 && Math.abs(s.tightRate - 6) < 0.01);
  assert.equal(w.rate, s.rate, "while the bar mean is identical, which is the point");
});

test("grid(): pace() is unmoved by feel — swing changes placement, not count or rate", () => {
  const read = E.reading("the quick brown fox jumped over it", { pop: 20 });
  const a = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "straight" });
  const b = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "swing" });
  assert.deepEqual(b.bars.map(x => x.rate), a.bars.map(x => x.rate));
  assert.deepEqual(b.bars.map(x => x.slotDelta), a.bars.map(x => x.slotDelta));
});

test("tempo(): required syllables-per-second scales with bpm", () => {
  const read = E.reading("chasing every dollar till the morning comes around and back again tonight", { pop: "rap" });
  const slow = E.tempo(read, { bpm: 72, timeSig: "4/4", feel: "straight" }).bars[0];
  const fast = E.tempo(read, { bpm: 140, timeSig: "4/4", feel: "straight" }).bars[0];
  assert.equal(slow.syllables, fast.syllables, "the words don't change, only the time available");
  assert.ok(fast.rate > slow.rate * 1.8, "at nearly double the tempo the line needs nearly double the rate");
  assert.equal(slow.room, "over", "19 syllables want finer than 16ths");
});

test("tempo(): accents are described, never scored against the beat count", () => {
  // Rap routinely puts several accents in one beat. A bar carrying more accents than beats is
  // ordinary, so nothing here may label it a problem.
  const read = E.reading("the way you move from the block to the booth was love", { pop: "rap" });
  const b = E.tempo(read, { bpm: 90, timeSig: "4/4", feel: "straight" }).bars[0];
  assert.ok(b.accents > b.beats, "this bar genuinely carries more accents than beats");
  assert.equal(Object.hasOwn(b, "feel"), false, "no verdict field on accent density");
  assert.equal(b.accentsPerBeat, b.accents / b.beats);
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
