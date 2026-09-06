// build_dict.js — CMUdict (ARPAbet) -> compact per-word syllable strings.
// Output format per word: "CLASS<stress>.CLASS<stress>-FINALCODA"
//   e.g. marmalade -> "AR1.AH0.EY2-D", france -> "AE1-NS", here -> "IY1-R"
// R-colouring: EH+R -> AIR, AA+R -> AR, AO+R -> OR (R consumed). Other V+R keep base class, R stays in coda.
const fs = require("fs");
const VOWELS = new Set(["AA","AE","AH","AO","AW","AY","EH","ER","EY","IH","IY","OW","OY","UH","UW"]);
const RCOLOR = { EH:"AIR", AA:"AR", AO:"OR" };
const out = {};
let n = 0, skipped = 0, variants = 0;
for (const line of fs.readFileSync("cmudict.dict","utf8").split("\n")) {
  if (!line || line.startsWith(";;;")) continue;
  const [wordRaw, ...phRaw] = line.trim().split(/\s+/);
  const isVariant = /\(\d+\)$/.test(wordRaw);                 // (2), (3): alternate reads, kept after a |
  const word = wordRaw.replace(/\(\d+\)$/, "").toLowerCase();
  if (!/^[a-z][a-z']*$/.test(word)) { skipped++; continue; } // drop symbols, digits, junk tokens
  const ph = phRaw.map(p => p.replace(/#.*$/, "")).filter(Boolean);
  const sylls = [];
  let cur = null;
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i], base = p.replace(/\d/, ""), stress = p.match(/\d/) ? +p.match(/\d/)[0] : 0;
    if (VOWELS.has(base)) {
      let cls = base;
      let skipR = false;
      if (RCOLOR[base] && ph[i+1] === "R") { cls = RCOLOR[base]; skipR = true; }
      cur = { v: cls, s: stress, c: "" };
      sylls.push(cur);
      if (skipR) i++;
    } else if (cur) cur.c += base;
    // leading consonants before the first vowel are onset; ignored (not needed for rhyme)
  }
  if (!sylls.length) { skipped++; continue; }
  // V + ER0 with nothing between (fire, hour, flyer, power) reads as one syllable with an R coda in this register
  for (let i = 1; i < sylls.length; i++) {
    const p = sylls[i-1], q = sylls[i];
    if (q.v === "ER" && q.s === 0 && p.c === "" && ["AY","AW","OW","UW","IY","EY","OY"].includes(p.v)) {
      p.c = "R" + q.c; sylls.splice(i, 1); i--;
    }
  }
  // tense V + AH0 + L (jewel, fuel, dial, trial, loyal, towel) reads as one syllable with an L coda
  for (let i = 1; i < sylls.length; i++) {
    const p = sylls[i-1], q = sylls[i];
    if (q.v === "AH" && q.s === 0 && /^L/.test(q.c) && p.c === "" && ["AY","AW","OW","UW","IY","EY","OY"].includes(p.v)) {
      p.c = q.c; sylls.splice(i, 1); i--;
    }
  }
  // only the final coda matters for perfect/slant; intermediate consonants are dropped
  const compact = sylls.map(s => s.v + s.s).join(".") + "-" + sylls[sylls.length-1].c;
  if (isVariant) { if (out[word] && !out[word].split("|").includes(compact)) { out[word] += "|" + compact; variants++; } continue; }
  out[word] = compact;
  n++;
}
fs.writeFileSync("cmu_skel.json", JSON.stringify(out));
const bytes = fs.statSync("cmu_skel.json").size;
console.log(`words: ${n}, variants: ${variants}, skipped: ${skipped}, json: ${(bytes/1024/1024).toFixed(2)} MB`);
for (const w of ["france","marmalade","savion","here","fire","michigan","the","stare","view","hour","sure"])
  console.log(w.padEnd(10), out[w]);
