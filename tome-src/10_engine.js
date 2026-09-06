
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
  return { pronounce, variants, skeleton, classify, lookup, mosaic, reading, meter, load, setOwn,
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
const SUN = (() => {
  const DAYTON = { lat: 39.7589, lon: -84.1916, name: "Dayton, Ohio" };
  let LAT = DAYTON.lat, LON = DAYTON.lon;
  function setPlace(p) { LAT = p && isFinite(p.lat) ? p.lat : DAYTON.lat; LON = p && isFinite(p.lon) ? p.lon : DAYTON.lon; }
  function solar(date) {
    const r = Math.PI / 180;
    const start = new Date(date.getFullYear(), 0, 0);
    const doy = Math.floor((date - start) / 864e5);
    const hr = date.getHours() + date.getMinutes() / 60;
    const g = 2 * Math.PI / 365 * (doy - 1 + (hr - 12) / 24);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const tz = -date.getTimezoneOffset() / 60;
    const tst = hr * 60 + eqt + 4 * LON - 60 * tz;
    const ha = (tst / 4 - 180) * r, lat = LAT * r;
    const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const elev = 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / r;
    let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / r + 180;
    return { elev, az: (az + 360) % 360 };
  }
  function apply(date) {
    const { elev, az } = solar(date);
    const rs = document.documentElement.style;
    const a = az * Math.PI / 180;
    const lx = elev > -6 ? Math.sin(a) : 0, ly = elev > -6 ? -Math.cos(a) : 1;
    const e = Math.max(0, Math.min(1, Math.sin(Math.max(0, elev) * Math.PI / 180) * 1.25));
    const night = Math.max(0, Math.min(1, (-elev - 2) / 8));
    const twilight = 1 - Math.max(0, Math.min(1, Math.abs(elev) / 14));
    const rake = elev > 0 ? Math.min(22, 4 + 14 / Math.max(.25, Math.tan(elev * Math.PI / 180)) / 6) : 4;
    const amb = 0.45 + 0.55 * e * (1 - night) + 0.18 * night;
    const set = (k, v) => rs.setProperty(k, v);
    set("--lx", lx.toFixed(3)); set("--ly", ly.toFixed(3)); set("--elev", e.toFixed(3)); set("--night", night.toFixed(3)); set("--amb", amb.toFixed(3));
    set("--rake", rake.toFixed(1) + "px");
    set("--glow", (0.45 + 0.25 * (1 - e) + 0.30 * night).toFixed(2)); set("--sheen", (0.25 + 0.55 * e * (1 - night)).toFixed(2));
    set("--lxpx", (lx * .9).toFixed(2) + "px"); set("--lypx", (ly * .9).toFixed(2) + "px");
    set("--nglow", (6 * night).toFixed(1) + "px"); set("--nglow-s", (3 * night).toFixed(1) + "px");
    set("--hi-a", (0.30 * e + 0.06).toFixed(3)); set("--cut-a", (0.40 * e + 0.06).toFixed(3)); set("--shade-a", (0.45 + 0.3 * e).toFixed(3));
    const mix = (p, q, t) => p.map((c, i) => Math.round(c + (q[i] - c) * t));
    const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
    let sub = mix([28, 26, 36], [40, 28, 30], twilight * (1 - night)); sub = mix(sub, [14, 14, 26], night);
    set("--sub", hex(sub)); set("--sub-hi", hex(mix(sub, [255, 255, 255], .14 * (0.5 + e)))); set("--sub-lo", hex(mix(sub, [0, 0, 0], .42)));
    set("--bone", hex(mix(mix([236, 227, 208], [244, 214, 170], twilight * (1 - night)), [204, 208, 224], night)));
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return { elev, az, dir: dirs[Math.round(az / 45) % 8], night, time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) };
  }
  return { solar, apply, setPlace, DAYTON };
})();

/* ---------- veins: seeded per session, derived per face ---------- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SESSION = (() => { const fresh = () => String((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  try { let k = sessionStorage.getItem("tome:seed"); if (!k) { k = fresh(); sessionStorage.setItem("tome:seed", k); } return +k; } catch (e) { return +fresh(); } })();
const MINERALS = {
  amethyst:  { hi: "#c9a6ff", lo: "#5a36a8", m: "#8d5cf0", mlo: "#4a2a8c" },
  malachite: { hi: "#9ff0c5", lo: "#1f7a50", m: "#3fbf7e", mlo: "#1c6a45" },
};
const VEIN_CACHE = new Map();
function veinSVG(mineral, face) {
  const key = mineral + ":" + face;
  if (VEIN_CACHE.has(key)) return VEIN_CACHE.get(key);
  const { hi, lo } = MINERALS[mineral];
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
      if (R() < .35) { const bx = nx + rnd(-40, 40), by = ny + rnd(-45, 45);
        strokes += `<path d='M${nx.toFixed(0)} ${ny.toFixed(0)} Q ${((nx + bx) / 2 + rnd(-15, 15)).toFixed(0)} ${((ny + by) / 2 + rnd(-15, 15)).toFixed(0)} ${bx.toFixed(0)} ${by.toFixed(0)}' stroke='${hi}' stroke-width='${rnd(.5, 1).toFixed(2)}' opacity='${rnd(.2, .45).toFixed(2)}'/>`; }
      x = nx; y = ny;
    }
    strokes += `<path d='${d}' stroke='${lo}' stroke-width='${rnd(2.5, 6.5).toFixed(1)}' opacity='${rnd(.2, .4).toFixed(2)}'/><path d='${d}' stroke='${hi}' stroke-width='${rnd(.9, 2.1).toFixed(1)}' opacity='${rnd(.35, .6).toFixed(2)}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><defs><filter id='v' x='-10%' y='-20%' width='120%' height='140%'><feTurbulence type='fractalNoise' baseFrequency='${rnd(.008, .018).toFixed(3)} ${rnd(.025, .06).toFixed(3)}' numOctaves='3' seed='${Math.floor(R() * 999)}'/><feDisplacementMap in='SourceGraphic' scale='${rnd(16, 34).toFixed(0)}' xChannelSelector='R' yChannelSelector='G'/><feGaussianBlur stdDeviation='.5'/></filter></defs><g fill='none' stroke-linecap='round' filter='url(%23v)'>${strokes}</g></svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  VEIN_CACHE.set(key, url); return url;
}
