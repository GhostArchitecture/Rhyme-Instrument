
/* ---------- tome UI ---------- */
const { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } = React;
const NAMES = { ...VOWEL_NAMES, AE: "a", IH: "ih", UH: "ŏŏ" };
const clean = s => (s || "").toLowerCase().replace(/[^a-z']/g, "");

/* OCCVM-L8 — a stone that can be picked is a real control; one that only displays a vowel is not and must
   not enter the tab order. The 44px floor does not apply: a stone sits inline inside a word inside a line
   of a poem, which is the flow-of-text exemption the law states. */
function Stone({ v, s = 1, onClick, chosen }) {
  const cls = `stone s${s}${onClick ? " pickable occvm-act" : ""}${chosen ? " chosen" : ""}`;
  const style = { "--c": VOWEL_COLORS[v] || "#777" };
  const label = NAMES[v] || (v || "").toLowerCase();
  if (!onClick) return <span className={cls} style={style}>{label}</span>;
  return <button type="button" className={cls} style={style} onClick={onClick}
    aria-pressed={chosen === undefined ? undefined : !!chosen}
    aria-label={`vowel ${label}${s > 0 ? ", stressed" : ""}`}>{label}</button>;
}
function Mark({ v, s }) { return <span className={`mark p${s}`} style={{ "--c": VOWEL_COLORS[v] || "#777" }} />; }
function Skeleton({ sk }) {
  if (!sk || !sk.vowels.length) return null;
  return <span className="skel">{sk.vowels.map((v, i) => <Stone key={i} v={v} s={sk.stress ? sk.stress[i] : 1} />)}
    {sk.coda ? <span>+{sk.coda.toLowerCase()}</span> : null}</span>;
}
function Picker({ word, overrides, setOverride, onClose }) {
  const cur = E2.pronounce(word).sylls;
  const [sel, setSel] = useState(Math.max(0, cur.length - 1));
  const reads = E2.variants(word);
  const has = !!overrides[word];
  const same = (r) => r.length === cur.length && r.every((x, i) => x.v === cur[i].v && x.s === cur[i].s);
  const commit = (sylls) => setOverride(word, { vowels: sylls.map(x => x.v), stress: sylls.map(x => x.s), coda: sylls[sylls.length - 1] ? sylls[sylls.length - 1].c : "" });
  const cutVowel = v => { const n = cur.map(x => ({ ...x })); n[sel].v = v; commit(n); };
  const cutStress = () => { const n = cur.map(x => ({ ...x })); n[sel].s = n[sel].s > 0 ? 0 : 1; commit(n); };
  return (
    <div className="picker">
      {reads.length > 1 && (
        <div className="reads">
          <div className="who">the dictionary carries {reads.length} reads of <i>{word}</i> — tap one</div>
          {reads.map((r, i) => (
            <button type="button" key={i} className={"stones read occvm-act" + (same(r) ? " cur" : "")} onClick={() => { commit(r); onClose(); }}>
              {r.map((x, k) => <Stone key={k} v={x.v} s={x.s} />)}
            </button>
          ))}
        </div>
      )}
      <div className="who">cut <i>{word}</i> by syllable — pick a stone, then the vowel your mouth uses</div>
      <div className="stones read" style={{ marginBottom: 8 }}>
        {cur.map((x, i) => <Stone key={i} v={x.v} s={x.s} chosen={i === sel} onClick={() => setSel(i)} />)}
        <button type="button" className="clear occvm-act" onClick={cutStress}>{cur[sel] && cur[sel].s > 0 ? "stressed" : "unstressed"}</button>
      </div>
      <div className="stones">
        {Object.keys(VOWEL_NAMES).map(v => <Stone key={v} v={v} chosen={cur[sel] && cur[sel].v === v} onClick={() => { cutVowel(v); }} />)}
        {has && <button type="button" className="clear occvm-act" onClick={() => { setOverride(word, null); onClose(); }}>clear all cuts</button>}
        <button type="button" className="clear occvm-act" onClick={onClose}>done</button>
      </div>
    </div>
  );
}
/* OCCVM-L13 (2.18) — the metronome pulse, Reading A. GATED motion, not the ambient floor: it runs only
   while a real tempo is set, which is a state a person actively created, and it stops the moment the tempo
   is cleared. L13's gated-motion clause is the one that governs it, and that clause has one sentence this
   hook exists to obey:

     THE GATE IS THE ACTUAL VALUE, NEVER ITS DISPLAY FALLBACK.

   TempoPanel keeps `const t = tempo || { bpm: 90, ... }` so the panel has something to render before a
   tempo exists. Reading `t` here would leave the pulse beating at 90 forever under a default nobody set —
   a tool asserting a tempo it was never given. This takes `tempo` and nothing else; null means silent.

   The clock is performance.now(), never a frame count: a backgrounded tab throttles rAF and a counted
   pulse would drift out of phase with the beat it claims to mark, then silently recover at the wrong
   place. Reading the wall clock each frame means a resumed tab lands on the correct beat immediately.

   Reduced motion stops it entirely rather than slowing it — L8 is untouched by L13, and a degraded
   metronome is a wrong metronome. It pulses the BEAT: swing displaces the sixteenths inside a beat, not
   the beats themselves, so a beat pulse reads identically under all three feels and claims nothing about
   the displacement. What the feel actually does is stated numerically in the panel, where it can be read
   rather than inferred from a flash. */
var PULSE_STRIKE = 0.32;   /* authored: the fraction of each beat the strike takes to decay */
function useBeatPulse(tempo) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (!tempo || !isFinite(tempo.bpm) || tempo.bpm <= 0) { setPhase(0); return; }
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (reduce) { setPhase(0); return; }
    const beatMs = 60000 / tempo.bpm, t0 = performance.now();
    let raf = 0;
    const step = () => {
      const u = ((performance.now() - t0) % beatMs) / beatMs;
      /* a strike and a decay, not a sine: a beat is an onset. The window was 0.18 of the beat — at 95
         bpm a 114 ms decay, about seven frames — and the owner reported no visible effect. 0.32 keeps the
         instant attack and gives the decay ~200 ms at that tempo. Authored; PULSE_STRIKE names it. */
      setPhase(u < PULSE_STRIKE ? 1 - u / PULSE_STRIKE : 0);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tempo && tempo.bpm]);
  return phase;
}

/* OCCVM-L11 / 2.21 — the swipe test bed, bank rows only.

   The gesture is the yield criterion rendered directly, with ONE authored anchor. Finger travel maps to
   applied stress at SWIPE_YIELD_PX — the distance at which the stress reaches the substance's own τ₀ —
   because SPINE.md §10 P-2 says no derivation carries px into a substance's units and each consumer must
   name its own anchor. Everything the row then does follows from Herschel-Bulkley and from nothing else:

     τ(d)   = τ₀ · d / SWIPE_YIELD_PX                the authored map, and the only authored step
     γ̇      = ((τ − τ₀)/k)^(1/n), exactly 0 below τ₀   OCCVM_RHEOLOGY.shearRate
     offset = d · (τ − τ₀)/τ  =  d − SWIPE_YIELD_PX     the transmitted fraction of the imposed travel

   So the row does not move at all for the first SWIPE_YIELD_PX and tracks the finger 1:1 after it. The
   dead band is not a tap/swipe heuristic bolted on beside the physics — it IS the yield stress, and it is
   what keeps tap-to-remove and the stones button live through the whole gesture: inside the band there is
   no movement to capture and no default to prevent.

   The ceiling is derived, not chosen. The crossover this system has tracked since 2.10 is k·γ̇ⁿ = τ₀,
   which is τ = 2τ₀ — exactly 2·SWIPE_YIELD_PX of finger travel under the map above. Committing at an
   offset below SWIPE_YIELD_PX therefore keeps the entire gesture yield-dominated. At the shipped numbers
   commit lands at 0.867 of the crossover: 13.3% of headroom, the discipline 2.16 applied to LOCK_V0_MAX.

   Released short of commit, the row returns — and the return is a DRIVEN FLOW, not a recoil. Flow past
   τ₀ is irreversible; a spring-back would be the material claiming an elasticity it does not have. What
   returns the row is the same yield law driven the other way, so it plays on the substance's cessation
   easing and its duration scales with the distance it has to cover. SWIPE_RETURN_MS is that duration at
   full commit distance, authored and named as authored.

   Reduced motion (L8): the row never translates and the gesture still commits at the same distance — a
   static frame, never a smaller travel or a slower one. */
var SWIPE_YIELD_PX = 30;     /* authored: finger travel at which the applied stress reaches τ₀ */
var SWIPE_COMMIT_PX = 26;    /* authored: row offset that commits; < SWIPE_YIELD_PX by the derivation above */
var SWIPE_RETURN_MS = 260;   /* authored: the return flow's duration at full commit distance */

function useSwipeYield(onCommit) {
  const [off, setOff] = React.useState(0);
  const [ret, setRet] = React.useState(0);          /* ms of return flow in flight; 0 = under the finger */
  const g = React.useRef(null);
  const reduce = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  const sub = () => (typeof OCCVM_RHEOLOGY === "undefined" ? null : OCCVM_RHEOLOGY);
  /* the transmitted travel: 0 below τ₀, d − yield above. Read through shearRate so the gate is the
     substance's own function rather than a re-typed inequality — L3, one owner per fact. */
  const flowed = d => {
    const R = sub(); if (!R) return 0;
    const m = R.SUBSTANCE, tau = m.tau0 * Math.abs(d) / SWIPE_YIELD_PX;
    if (!(R.shearRate(m, tau) > 0)) return 0;
    return Math.sign(d) * Math.abs(d) * (tau - m.tau0) / tau;
  };

  const down = e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest && e.target.closest("button, input, textarea, a")) return;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false, dead: false };
    setRet(0);
  };
  const move = e => {
    const s = g.current; if (!s || s.dead || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.live) {
      /* the page scrolls vertically; a gesture that leaves the dead band downward was never a swipe */
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { s.dead = true; return; }
      if (Math.abs(dx) <= SWIPE_YIELD_PX) return;   /* held: below τ₀ nothing moves, and the tap survives */
      s.live = true;
      try { e.currentTarget.setPointerCapture(s.id); } catch (err) {}
    }
    e.preventDefault();
    setOff(flowed(dx));
  };
  const up = e => {
    const s = g.current; g.current = null;
    if (!s || s.dead || !s.live) { setOff(0); return; }
    const now = flowed(e.clientX - s.x);
    if (Math.abs(now) >= SWIPE_COMMIT_PX) { setOff(now); onCommit(); return; }
    setRet(Math.max(60, Math.round(SWIPE_RETURN_MS * Math.abs(now) / SWIPE_COMMIT_PX)));
    setOff(0);
  };

  const R = sub();
  const style = { "--slide": (reduce() ? 0 : off).toFixed(1) + "px" };
  if (ret && !reduce()) {
    style.transition = "transform " + ret + "ms";
    if (R) style.transitionTimingFunction = R.cssEasing(R.SUBSTANCE, 1);
  }
  return { style, past: Math.abs(off) >= SWIPE_COMMIT_PX,
           handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

/* OCCVM-L8 — the patina control. 28 call sites reach the interaction floor through this one component.
   aria-pressed is emitted only when the caller passes `on` AND has not marked the control `action`: five
   sites write a bare `on` to mean "styled active", and a button that claims to be a pressed toggle
   announces a state it does not have. */
function Cast({ on, children, onClick, patina, style, label, action }) {
  return <button type="button" className={`cast${on ? " on" : ""}${patina ? " patina" : ""} occvm-act`}
    onClick={onClick} style={style} aria-label={label}
    aria-pressed={action || on === undefined ? undefined : !!on}>{children}</button>;
}

/* ---- draft: the Rosetta face ---- */
function BarCut({ value, onChange, onReturn, onBackspaceEmpty, onDone }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  return <input ref={ref} className="cut barcut" value={value} onChange={e => onChange(e.target.value)} enterKeyHint="next" autoCapitalize="sentences" autoCorrect="off" spellCheck={false}
    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onReturn(); } else if (e.key === "Backspace" && !value) { e.preventDefault(); onBackspaceEmpty(); } else if (e.key === "Escape") onDone(); }}
    onBlur={onDone} />;
}
/* `raw` is the line as typed. `bar.text` is what reading() made of it, and reading() trims — so a
   controlled input bound to bar.text erases every trailing space on the keystroke that typed it, and the
   space bar "does not work" from the first character onward. The reading is for reading; the editor edits
   the draft. Found in the field, not by a guard: no test typed a space into a bar and looked. */
function Bar({ bar, raw, reading, overrides, setOverride, pick, setPick, editing, edit, pace }) {
  const run = reading.runs.find(r => r.bars.includes(bar.i));
  const flagged = reading.flagged.includes(bar.i);
  const heat = flagged && run ? Math.min(1, (run.bars.indexOf(bar.i) - reading.limit + 1) / Math.max(1, run.len - reading.limit)) : 0;
  return (
    <div className="bar" data-bar={bar.i} data-heat={flagged ? "" : undefined}
      style={{ "--bthick": (5 + bar.syllables * 1.1).toFixed(0) + "px", "--heat": heat.toFixed(2) }}>
      {editing ? <BarCut value={raw} onChange={v => edit.change(bar.i, v)} onReturn={() => edit.next(bar.i)} onBackspaceEmpty={() => edit.remove(bar.i)} onDone={() => edit.done(bar.i)} />
      : <button type="button" className="text occvm-act" style={{ margin: 0 }} onClick={() => edit.start(bar.i)} aria-label={`edit bar ${bar.i + 1}`}>
        {bar.field.map((w, i) => <React.Fragment key={i}><span className={"w " + w.source}>{w.word}</span>{i < bar.field.length - 1 ? " " : ""}</React.Fragment>)}
      </button>}
      <div className="field">
        {bar.field.map((w, i) => {
          const key = clean(w.word);
          const open = pick && pick.bar === bar.i && pick.word === key && pick.idx === i;
          return (
            <div key={i} className={"word" + (open ? " pick" : "")} data-word={key}>
              <button type="button" className="stones occvm-act" aria-expanded={!!open} aria-label={`syllables of ${key}`} onClick={() => setPick(open ? null : { bar: bar.i, word: key, idx: i })}>
                {w.sylls.map((s, k) => <Stone key={k} v={s.v} s={s.s} />)}
              </button>
              <div className="marks">{w.sylls.map((s, k) => <Mark key={k} v={s.v} s={s.s} />)}</div>
            </div>
          );
        })}
      </div>
      {pick && pick.bar === bar.i && <Picker word={pick.word} overrides={overrides} setOverride={setOverride} onClose={() => setPick(null)} />}
      {bar.filler && (
        <svg className="crack" viewBox="0 0 100 100" preserveAspectRatio="none">
          {["dark", "lit"].map(k => <path key={k} className={k} vectorEffect="non-scaling-stroke" d="M62 100 L60 88 L64 79 L61 70 L66 58 L63 47 L69 36 L66 24 L72 12 L70 0" />)}
        </svg>
      )}
      <div className="foot">
        <span>ends on {NAMES[bar.end.v] || "—"}{bar.end.coda ? " +" + bar.end.coda.toLowerCase() : ""}</span>
        <span>{bar.syllables} syl{bar.drift ? <span className="warn"> · {bar.drift > 0 ? "+" : ""}{bar.drift} vs neighbors</span> : null}
          {pace ? <span> · {pace.rate.toFixed(1)}/sec{pace.room === "over" ? <span className="warn"> · {pace.slotDelta} over grid</span> : null}</span> : null}
          {bar.filler ? <span className="bad"> · filler landing</span> : null}
          {flagged && run ? <span className="warn"> · drone {run.len} on {NAMES[run.v]}</span> : null}</span>
      </div>
      {bar.scheme && <span className="scheme">{bar.scheme}</span>}
    </div>
  );
}
function Threads({ reading, host, quiet }) {
  const ref = useRef(null);
  const draw = useCallback(() => {
    const svg = ref.current, root = host.current; if (!svg || !root) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const base = root.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    const anchor = (barIdx, word, terminal) => {
      const bar = root.querySelector(`.bar[data-bar="${barIdx}"]`); if (!bar) return null;
      const words = [...bar.querySelectorAll(".word")];
      const el = terminal ? words[words.length - 1] : words.find(w => w.dataset.word === clean(word));
      if (!el) return null;
      const st = el.querySelector(".stones").getBoundingClientRect();
      return { x: st.left + st.width / 2 - base.left, y: st.bottom - base.top + 2, right: base.width - 22 + 4 };
    };
    const NS = "http://www.w3.org/2000/svg";
    /* terminal threads: each bar links to its nearest earlier partner only; internal threads all show */
    const nearest = new Map();
    reading.edges.filter(e => e.scope === "terminal" && e.kind !== "loose").forEach(e => { if (!nearest.has(e.b) || nearest.get(e.b).a < e.a) nearest.set(e.b, e); });
    const shown = [...nearest.values(), ...reading.edges.filter(e => e.scope === "internal")];
    for (const e of shown) {
      const A = anchor(e.a, e.words[0], e.scope === "terminal" || e.a !== e.b);
      const B = anchor(e.b, e.words[1], e.scope === "terminal" || e.a === e.b);
      if (!A || !B) continue;
      let d;
      if (e.a === e.b) { const dip = 10 + Math.abs(B.x - A.x) * .08; d = `M${A.x} ${A.y} C ${A.x} ${A.y + dip}, ${B.x} ${B.y + dip}, ${B.x} ${B.y}`; }
      else { const gx = A.right + 6 + Math.min(22, Math.abs(B.y - A.y) * .06); d = `M${A.x} ${A.y} C ${gx} ${A.y}, ${gx} ${B.y}, ${B.x} ${B.y}`; }
      const g = document.createElementNS(NS, "g"); g.setAttribute("class", `${e.kind} ${e.scope}`);
      for (const k of ["body", "thread"]) { const p = document.createElementNS(NS, "path"); p.setAttribute("class", k); p.setAttribute("d", d); g.appendChild(p); }
      svg.appendChild(g);
    }
  }, [reading, host]);
  useLayoutEffect(() => { if (quiet) { const t = setTimeout(draw, 320); return () => clearTimeout(t); } const id = requestAnimationFrame(draw); return () => cancelAnimationFrame(id); });
  useEffect(() => { window.addEventListener("resize", draw); return () => window.removeEventListener("resize", draw); }, [draw]);
  return <svg ref={ref} className="graph" />;
}
function Shelf({ shelf, current, setCurrent, newDraft, renameDraft, removeDraft }) {
  const [open, setOpen] = useState(false);
  const cur = shelf.find(d => d.id === current);
  const when = t => { const d = new Date(t); return d.toLocaleDateString([], { month: "short", day: "numeric" }); };
  return (
    <div className="shelf">
      <div className="row" style={{ marginTop: 0 }}>
        <Cast on action onClick={() => setOpen(!open)} style={{ flex: 2, textAlign: "left" }}>{cur ? cur.name : "untitled"} <span className="dim">· {shelf.length} on the shelf</span></Cast>
        <Cast onClick={() => { const n = prompt("name this draft", cur ? cur.name : ""); if (n != null && n.trim()) renameDraft(current, n.trim()); }}>name</Cast>
        <Cast patina on action onClick={newDraft}>new</Cast>
      </div>
      {open && (
        <div className="shelflist">
          {shelf.slice().sort((a, b) => b.updated - a.updated).map(d => (
            <div key={d.id} className={"bankrow" + (d.id === current ? " cur" : "")}>
              <button type="button" className="wd occvm-act" onClick={() => { setCurrent(d.id); setOpen(false); }}>{d.name}<span className="dim"> · {d.text.split("\n").filter(l => l.trim()).length} bars · {when(d.updated)}</span></button>
              {shelf.length > 1 && <button type="button" className="rm occvm-act" onClick={e => {
                if (!confirm(`remove “${d.name}” from the shelf?`)) return;
                /* OCCVM-L11 — removing a draft is irreversible, so it YIELDS rather than fades: the row
                   necks, pinches off, and the two bodies come to a hard stop (2.8; it cleaved along the
                   crystal's angle from 1.1b to 2.7). The row is gone from the shelf only once the pinch has
                   finished, so the two never overlap. */
                const row = e.currentTarget.closest(".bankrow");
                if (row && typeof OCCVM_YIELD !== "undefined") OCCVM_YIELD.pinch(row, () => removeDraft(d.id));
                else removeDraft(d.id);
              }}>remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function SharePanel({ reading, palette, onClose }) {
  const filled = reading.bars.filter(Boolean);
  const [scope, setScope] = useState("one"); const [format, setFormat] = useState("feed");
  const [one, setOne] = useState(filled.length ? filled[filled.length - 1].i : 0);
  const [start, setStart] = useState(filled.length ? filled[0].i : 0); const [len, setLen] = useState(Math.min(6, Math.max(4, filled.length)));
  const [status, setStatus] = useState("");
  const holder = useRef(null); const canvasRef = useRef(null);
  const chosen = scope === "one" ? [one] : filled.filter(b => b.i >= start).slice(0, len).map(b => b.i);
  useEffect(() => {
    const cv = CARD.render({ reading, bars: chosen, format: format === "story" ? "story" : "feed", palette });
    canvasRef.current = cv; const h = holder.current; if (!h) return;
    h.innerHTML = ""; cv.style.width = "100%"; cv.style.height = "auto"; cv.style.display = "block"; cv.style.borderRadius = "4px"; h.appendChild(cv);
  }, [reading, scope, format, one, start, len, palette]);
  return (
    <div className="share">
      <div className="row" style={{ marginTop: 0 }}>
        <Cast on={scope === "one"} onClick={() => setScope("one")}>one bar</Cast>
        <Cast on={scope === "block"} onClick={() => setScope("block")}>block</Cast>
        <Cast on={format === "feed"} patina onClick={() => setFormat("feed")}>4:5</Cast>
        <Cast on={format === "story"} patina onClick={() => setFormat("story")}>9:16</Cast>
      </div>
      {scope === "one" ? (
        <div className="picklist">{filled.map(b => <button type="button" key={b.i} className={"pl occvm-act" + (b.i === one ? " on" : "")} aria-pressed={b.i === one} onClick={() => setOne(b.i)}>{b.text}</button>)}</div>
      ) : (
        <div>
          <div className="label">start at</div>
          <div className="picklist">{filled.map(b => <button type="button" key={b.i} className={"pl occvm-act" + (b.i === start ? " on" : "")} aria-pressed={b.i === start} onClick={() => setStart(b.i)}>{b.text}</button>)}</div>
          <div className="row">{[4, 5, 6, 7, 8].map(n => <Cast key={n} on={len === n} onClick={() => setLen(n)}>{n}</Cast>)}</div>
        </div>
      )}
      <div ref={holder} className="preview" />
      <div className="row">
        <Cast patina on action onClick={async () => { setStatus("…"); setStatus(await CARD.share(canvasRef.current, "rhyme-instrument-" + Date.now())); }}>share</Cast>
        <Cast onClick={onClose}>close</Cast>
      </div>
      {status && status !== "…" && <div className="note">{status}</div>}
    </div>
  );
}
function MeterPanel({ reading, shelf, pop, onClose }) {
  const [scope, setScope] = useState("draft");
  const m = useMemo(() => {
    if (scope === "draft") return E2.meter(reading);
    /* shelf scope aggregates every draft's bars into one ranking; per-bar callouts are dropped
     * because bar indices only mean something within their own draft. */
    return E2.meter({ bars: shelf.flatMap(d => E2.reading(d.text, { pop }).bars) });
  }, [reading, scope, shelf, pop]);
  const pct = n => Math.round(n * 100);
  return (
    <div className="share">
      <div className="row" style={{ marginTop: 0 }}>
        <Cast on={scope === "draft"} onClick={() => setScope("draft")}>this draft</Cast>
        <Cast on={scope === "shelf"} patina onClick={() => setScope("shelf")}>whole shelf · {shelf.length}</Cast>
        <Cast onClick={onClose} style={{ flex: .6 }}>close</Cast>
      </div>
      {!m.bars ? <div className="empty">nothing written yet to measure.</div> : (
        <div>
          <div className="group">
            <div className="gh">shape · {m.bars} bar{m.bars === 1 ? "" : "s"} measured</div>
            {m.ranked.map((t, k) => (
              <div key={t.name} className={"fit" + (k === 0 ? " top" : "")}>
                <span className="nm">{t.name}</span>
                <span className="syl">{t.syllables} syl</span>
                <span className="track"><span className="fill" style={{ width: pct(t.mean) + "%" }} /></span>
                <span className="pct">{pct(t.mean)}%</span>
              </div>
            ))}
          </div>
          {scope === "draft" && m.weakest.length > 0 && (
            <div className="group">
              <div className="gh">sits furthest from {m.best.name}</div>
              {m.weakest.slice(0, 4).map(w => (
                <div key={w.i} className="weak">
                  <span className="pct">{pct(w.score)}%</span>
                  <span className="ln">{w.text}</span>
                  <span className="why">{w.syllables} syl{pct(w.length) < 100 ? " · length" : ""}{pct(w.stress) < 60 ? " · accents" : ""}</span>
                </div>
              ))}
            </div>
          )}
          <div className="note">
            reading what's written, not prescribing what to write. fit is two things kept apart: how close the
            syllable count sits to the shape, and how often an accent lands where the shape puts one — a bar can
            be the right length with the beats in the wrong places. measured on the spoken line, with function
            words unstressed, not on each word read alone.
          </div>
        </div>
      )}
    </div>
  );
}
function TempoPanel({ tempo, setTempo, pacing, onClose }) {
  const t = tempo || { bpm: 90, timeSig: "4/4", feel: "straight" };
  const set = patch => setTempo({ ...t, ...patch });
  const g = pacing ? pacing.grid : null;
  const rates = pacing ? pacing.bars.map(b => b.rate) : [];
  const peak = rates.length ? Math.max(...rates) : 0;
  return (
    <div className="share">
      <div className="row" style={{ marginTop: 0 }}>
        <Cast onClick={() => set({ bpm: Math.max(40, t.bpm - 5) })}>−5</Cast>
        <Cast on patina style={{ flex: 1.4 }}>{t.bpm} bpm</Cast>
        <Cast onClick={() => set({ bpm: Math.min(220, t.bpm + 5) })}>+5</Cast>
        <Cast onClick={onClose} style={{ flex: .6 }}>close</Cast>
      </div>
      <div className="row wrap">
        {["4/4", "3/4", "6/8"].map(x => <Cast key={x} on={t.timeSig === x} onClick={() => set({ timeSig: x })}>{x}</Cast>)}
        {["straight", "swing", "triplet"].map(x => <Cast key={x} on={t.feel === x} patina onClick={() => set({ feel: x })}>{x}</Cast>)}
      </div>
      {tempo && g && (
        <div>
          <div className="group">
            <div className="gh">{g.slotsPerBar} slots · {g.beats} beats × {g.subdivision} · bar runs {((g.beatMs * g.beats) / 1000).toFixed(2)}s</div>
            {/* what the feel does to TIME, stated rather than implied. Until 2.18 swing produced a grid
                identical to straight and this line could only ever have said "16 slots" either way. */}
            <div className="gh">{g.feel === "swing"
              ? `swung ${Math.round(g.swingRatio * 1000) / 10}% — pairs run ${g.longMs.toFixed(0)}ms long, ${g.shortMs.toFixed(0)}ms short · the short side is ${(1000 / g.shortMs).toFixed(1)}/sec for anything landing on it`
              : `even — every slot runs ${g.meanSlotMs.toFixed(0)}ms (${(1000 / g.meanSlotMs).toFixed(1)}/sec)`}</div>
            {pacing.bars.map(b => (
              <div key={b.i} className="fit">
                <span className="nm" style={{ flex: "0 0 58px" }}>{b.rate.toFixed(1)}/sec</span>
                <span className="syl" style={{ flex: "0 0 52px" }}>{b.syllables} syl</span>
                <span className="track"><span className="fill" style={{ width: (peak ? (b.rate / peak) * 100 : 0) + "%" }} /></span>
                <span className="pct" style={{ flex: "0 0 66px" }}>{b.room === "over" ? b.slotDelta + " over" : b.room === "under" ? -b.slotDelta + " under" : "exact"}</span>
              </div>
            ))}
          </div>
          <div className="note">
            arithmetic, not a measurement. the beat carries the feel — you are writing to it, not swinging
            the writing — so a swung grid gives uneven room and the per-bar rate below is a mean across it.
            the short side of a pair is the real constraint and it is stated above. this is how many
            syllables a second each bar needs to fit the
            grid at this tempo — check it against your own mouth. <b>over grid</b> means the line wants finer
            subdivision than the feel you set, not that it's wrong. where the syllables actually land inside
            a beat is yours; nothing here claims to know it.
          </div>
        </div>
      )}
      {!tempo && <div className="note">no tempo set for this draft yet — pick a bpm and the bars will read against it.</div>}
      <div className="row"><Cast patina on={!!tempo} onClick={() => setTempo(tempo ? null : t)}>{tempo ? "clear tempo" : "set " + t.bpm + " bpm"}</Cast></div>
    </div>
  );
}
function Draft({ draft, setDraft, overrides, setOverride, pop, setPop, eng, shelfProps, palette, tempo, setTempo }) {
  const [pick, setPick] = useState(null);
  const [editing, setEditing] = useState(null);           // line index being cut
  const [quarry, setQuarry] = useState(false);
  const [share, setShare] = useState(false);
  const [meterOpen, setMeterOpen] = useState(false);
  const [tempoOpen, setTempoOpen] = useState(false);
  /* the toggle never unmounts, which is why Reading A lives on it rather than inside the panel */
  const beatPulse = useBeatPulse(tempo);
  const host = useRef(null);
  const reading = useMemo(() => E2.reading(draft, { pop }), [draft, pop, overrides, eng]);
  const pacing = useMemo(() => tempo ? E2.tempo(reading, tempo) : null, [reading, tempo]);
  const paceBy = useMemo(() => new Map((pacing ? pacing.bars : []).map(b => [b.i, b])), [pacing]);
  const limit = reading.limit;
  const lines = draft.split("\n");
  const edit = {
    start: i => { setPick(null); setEditing(i); },
    change: (i, v) => { const l = draft.split("\n"); l[i] = v; setDraft(l.join("\n")); },
    next: i => { const l = draft.split("\n"); l.splice(i + 1, 0, ""); setDraft(l.join("\n")); setEditing(i + 1); },
    remove: i => { const l = draft.split("\n"); if (l.length <= 1) { setEditing(null); return; } l.splice(i, 1); setDraft(l.join("\n")); setEditing(i > 0 ? i - 1 : null); },
    done: i => setEditing(e => (e === i ? null : e)),
    append: () => { const l = draft.split("\n"); if (l.length === 1 && !l[0].trim()) { setEditing(0); return; } l.push(""); setDraft(l.join("\n")); setEditing(l.length - 1); },
  };
  return (
    <div className="draftface" style={{ "--pulse": beatPulse.toFixed(3) }}>
      <Shelf {...shelfProps} />
      <div className="row" style={{ marginTop: 0 }}>
        <Cast on={pop === "rap"} onClick={() => setPop("rap")}>rap · drone past 3</Cast>
        <Cast on={pop === "melodic"} onClick={() => setPop("melodic")}>melodic · drone past 6</Cast>
      </div>
      <div className="row">
        <Cast on={quarry} patina onClick={() => setQuarry(!quarry)}>quarry</Cast>
        <Cast on={meterOpen} patina onClick={() => setMeterOpen(!meterOpen)}>meter</Cast>
        <Cast on={tempoOpen} patina onClick={() => setTempoOpen(!tempoOpen)}
          style={{ "--pulse": beatPulse.toFixed(3) }}>{tempo ? tempo.bpm + " bpm" : "tempo"}</Cast>
        <Cast on={share} patina onClick={() => setShare(!share)}>share</Cast>
      </div>
      {quarry && <textarea className="cut" style={{ marginTop: 10 }} value={draft} onChange={e => setDraft(e.target.value)} placeholder="paste or cut the whole draft here — one bar per line" rows={9} spellCheck={false} />}
      {tempoOpen && <TempoPanel tempo={tempo} setTempo={setTempo} pacing={pacing} onClose={() => setTempoOpen(false)} />}
      {meterOpen && <MeterPanel reading={reading} shelf={shelfProps.shelf} pop={pop} onClose={() => setMeterOpen(false)} />}
      {share && reading.bars.some(Boolean) && <SharePanel reading={reading} palette={palette} onClose={() => setShare(false)} />}
      <div style={{ marginTop: 16 }}>
        {reading.maxRun > limit && <div className="drone">drone: {reading.maxRun} straight bars on one vowel — past the {pop} line of {limit}.</div>}
        <div className="bars" ref={host}>
          {lines.map((ln, i) => reading.bars[i]
            ? <Bar key={i} bar={reading.bars[i]} raw={ln} reading={reading} overrides={overrides} setOverride={setOverride} pick={pick} setPick={setPick} editing={editing === i} edit={edit} pace={paceBy.get(i)} />
            : (editing === i
              ? <div key={i} className="bar" data-bar={i}><BarCut value={ln} onChange={v => edit.change(i, v)} onReturn={() => edit.next(i)} onBackspaceEmpty={() => edit.remove(i)} onDone={() => edit.done(i)} /></div>
              : (lines.length > 1 || ln ? <button type="button" key={i} className="break occvm-act" onClick={() => edit.start(i)} aria-label="edit this break"><span>break</span></button> : null)))}
          {reading.bars.some(Boolean) && <Threads reading={reading} host={host} quiet={editing != null} />}
          <button type="button" className="ghost occvm-act" onClick={edit.append}>{reading.bars.some(Boolean) ? "+ bar" : "tap to cut the first bar"}</button>
        </div>
        {reading.terminal && <div className="terminal">terminal slot reads soft — filler or unpaired vowel on the last bar. the logged pattern: weakest material lands last. check it on purpose.</div>}
      </div>
    </div>
  );
}

/* ---- lookup ---- */
function Lookup({ bank, setBank, eng }) {
  const [q, setQ] = useState(""); const [depth, setDepth] = useState(1);
  const r = useMemo(() => q.trim() ? E2.lookup(q, depth, bank) : null, [q, depth, bank, eng]);
  const mos = useMemo(() => q.trim() && depth >= 2 && E2.ready() ? E2.mosaic(q, depth, 40) : [], [q, depth, eng, bank]);
  const banked = useMemo(() => new Set(bank.map(clean)), [bank]);
  const toggle = w => setBank(banked.has(w) ? bank.filter(b => clean(b) !== w) : [...bank, w]);
  const groups = r ? [["perfect", r.perfect], ["slant — the melodic lane", r.slant], ["reduced — rap-legal", r.loose]] : [];
  return (
    <div>
      <input className="cut" value={q} onChange={e => setQ(e.target.value)} placeholder="a word, or the tail of a phrase" autoCapitalize="off" autoCorrect="off" />
      <div className="row">{[1, 2, 3].map(n => <Cast key={n} on={depth === n} onClick={() => setDepth(n)}>{n} syl</Cast>)}</div>
      {r && (
        <div>
          <Skeleton sk={r.skeleton} />
          {r.reads.length > 1 && <div className="note" style={{ marginTop: 4 }}>searched on {r.reads.length} dictionary reads — cut the word in bank to pin one</div>}
          <div className="note" style={{ marginTop: 6 }}>anchored on the stressed syllable · {E2.ready() ? E2.size().toLocaleString() + " words" : "curated list only — dictionary not loaded"} · <span className="k0">yours</span> · <span className="k1">curated</span> · common · <span className="k3">rest</span> · tap a word to bank it</div>
          {groups.map(([label, list]) => list.length > 0 && (
            <div className="group" key={label}>
              <div className={"gh " + label.split(" ")[0]}>{label} · {list.length}</div>
              <div className="inlays">
                {list.slice(0, 90).map(it => <button type="button" key={it.word} className={`inlay occvm-act t${it.tier}${banked.has(it.word) ? " banked" : ""}`} aria-pressed={banked.has(it.word)} onClick={() => toggle(it.word)}>{it.word}</button>)}
              </div>
            </div>
          ))}
          {mos.length > 0 && (
            <div className="group">
              <div className="gh mosaic">mosaic — two-word tails · {mos.length}</div>
              <div className="inlays">{mos.map(m => <span key={m.phrase} className={"inlay t" + Math.min(3, m.tier) + (m.kind === "slant" ? " slantish" : "")}>{m.phrase}</span>)}</div>
            </div>
          )}
          {r.perfect.length + r.slant.length + r.loose.length === 0 && <div className="empty">nothing at this depth. the anchor is the stressed syllable — try a shallower depth, or bank the word and cut its vowel by hand.</div>}
        </div>
      )}
    </div>
  );
}

/* ---- check ---- */
function Check({ eng }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [depth, setDepth] = useState(2);
  const r = useMemo(() => a.trim() && b.trim() ? E2.classify(a, b, depth, "count") : null, [a, b, depth, eng]);
  const K = { perfect: ["var(--gilt-a)", "perfect — vowels and final coda match"], slant: ["var(--vein-hi)", "slant — vowel skeleton matches, coda free"],
    loose: ["#cdebb8", "reduced — holds if the unstressed vowels collapse. rap-legal."], shallow: ["var(--bone-lo)", "shallow — only the last vowel agrees"],
    identical: ["var(--bone-lo)", "identical — same word, no rhyme credit"], none: ["#e0705a", "no match at this depth"] };
  return (
    <div>
      <input className="cut" value={a} onChange={e => setA(e.target.value)} placeholder="line a" autoCapitalize="off" autoCorrect="off" style={{ marginBottom: 8 }} />
      <input className="cut" value={b} onChange={e => setB(e.target.value)} placeholder="line b" autoCapitalize="off" autoCorrect="off" />
      <div className="row">{[1, 2, 3].map(n => <Cast key={n} on={depth === n} onClick={() => setDepth(n)}>{n} syl</Cast>)}</div>
      {r && (
        <div className="verdict" style={{ "--vk": K[r.kind][0] }}>
          <div className="kind">{K[r.kind][1]}</div>
          <div className="skel"><span>a</span><Skeleton sk={r.sa} /></div>
          <div className="skel"><span>b</span><Skeleton sk={r.sb} /></div>
        </div>
      )}
    </div>
  );
}

/* ---- the ambient floor (OCCVM-L13, 2.22) ------------------------------------------------------

   L13 grants Rhyme a decorative floor on the draft face and withholds it from BTC, and the auditor
   measures that split by this function's NAME. What follows is the whole of what the law permits and
   nothing beyond it.

   WHAT IS DERIVED. The merge is coalescence, and P-3's citation pass ran here, at build time, exactly as
   SPINE.md §10 said it would. Confirmed: in the VISCOUS regime the bridge radius grows LINEARLY in time,
   r ∝ t (Eggers, Lister & Stone, J. Fluid Mech. 401, 293–310, 1999). The √t everyone reaches for is the
   INERTIAL law, r_b = D(γa/ρ)^(1/4)·t^(1/2), and a yield-stress tomato matrix is nowhere near it.
   So the floor merges linearly, and that is not a choice.

   WHAT WAS MEASURED AND DROPPED. ELS carry a logarithmic factor, r_m ~ (γt/πη)·ln[γt/(ηR)]. It is an
   EARLY-TIME asymptotic, valid for t ≪ t_v = ηR/γ, and −t·ln(t/t_v) turns over at t/t_v = 1/e and then
   predicts the bridge SHRINKING. A merge rendered to completion runs straight past that, so carrying the
   log here would be using an asymptotic outside its regime — the class of error 2.8 caught in the 3-D
   fractal dimension on a planar lattice and 2.10 caught in k and n. Linear, without the correction.

   WHAT IS AUTHORED, AND WHY THE ABSOLUTE RATE CANNOT BE DERIVED. The magnitude of the linear rate is
   γ/η, and η is the substance's apparent viscosity, which depends on the shear rate the merge itself
   sets. Measured across a plausible range: γ̇ = 0.01 → η 2,627 Pa·s → 5.8e-5 px/ms; γ̇ = 10 → η 4.99 →
   3.0e-2 px/ms. The same 24 px bridge takes 417 SECONDS at one end and 0.8 s at the other, and nothing
   fixes γ̇ independently of the rate it would produce. That is P-4's η(γ̇) arriving as a consumer and
   showing why it was parked: the arithmetic is right and the input is not determined. Per P-3's own
   disposition, the rate is authored and named as authored — the LOCK_RELAX_MS treatment.

   The DRIFT is authored too, and L13 already made that call: a yield-stress fluid below τ₀ does not
   spontaneously drift, so the floor contradicts the substance and the law records that as the owner's
   aesthetic judgment rather than dressing it as a derivation.

   WHAT THE LAW FORBIDS AND THIS RESPECTS. The floor is a LAYER on the material, never the material
   deforming at rest — it is its own canvas, painted under the bars, and no surface's own geometry moves.
   It never draws over a bar: `.bar` carries --heat, a measured value, and L13 bars a floor from any
   surface carrying one. It takes its colour from the pigment tokens and carries no literal of its own,
   so an unresolved palette paints nothing rather than painting an invented accent (L6). And it is
   lawful at zero modulation: nothing gates it, nothing triggers it, no real value scales it. */
/* 2.24: the floor is the SUBSTRATE LAYER on every slab now, not an underlayer on one face — see the
   slab in App. The count therefore follows the area rather than being a fixed seven, so a tall draft
   and a short lookup face carry the same density. */
/* 2.25: the field itself — density, radius band, seed stream — is OCCVM_GLOBULES' (occvm/globules.js),
   the one generator both tools share now that BTC carries the same field as a still frame. What stays
   here is the LIVE half: drift, merging, the canvas. L13 grants motion to this tool's draft face only,
   and a shared part must not carry what one tool is withheld. */
var FLOOR_MERGE_PX_S = 2.6;   /* authored MAGNITUDE; the linearity above it is derived and confirmed */
/* 2.24: 0.05 shipped as "read at the edge of vision or it is not a floor", measured at a median 0.42 L*,
   and was an underlayer nobody could see while the crystal veins were what showed. As the SUBSTRATE
   LAYER it has to be seen. Measured on a live lookup slab, one frozen load, still frame, canvas toggled:
   0.05 → 0.78 L* mean over the moved 28%; 0.10 → 1.43; 0.16 → 2.20; 0.24 → 3.21; 0.32 → 4.20 (max 24.6,
   competing with the text). 0.24 is chosen: the globules read as a field under the page, above the
   1.08 the diffuse vein wash measures in BTC and below the 4.6 a beat strike reaches on the draft face,
   so the beat still stands out from the ground. Authored, and named as authored. */
var FLOOR_ALPHA = 0.24;
var FLOOR_SEED = 0x0CCF1005;  /* fixed, so the field is the same field every session and can be recorded */

/* ---- 2.28 step 3: the buoyancy cycle ------------------------------------------------------------
 * The build plan's finding that reshapes this: a lava lamp is not one substance getting restless, it
 * is TWO IMMISCIBLE PHASES IN A HEAT-DRIVEN DENSITY RACE. The wax sits very slightly denser at rest;
 * heat expands it more than the carrier; past a crossover it becomes buoyant, rises, cools, becomes
 * dense again, sinks. **The motion is buoyancy. Rheology governs shape and merging, not drive** — which
 * is why the drift that shipped at 2.22 (a random constant direction per drop) was the wrong model
 * rather than a coarse one: it had no bottom, no top, and no turnaround.
 *
 * WHAT IS ADOPTED FROM THE SOURCE IS THE SHAPE. Gyüre & Jánosi, "Basics of lava-lamp convection",
 * Phys. Rev. E 80, 046307 (2009), a real two-fluid lab analog: warm blobs rise from the bottom, ATTACH
 * at the top surface, then sink again — rise, dwell, sink, dwell. They identify two modes, one
 * heat-transport limited and one **viscosity-limited with constant periodicity**; the constant-period
 * mode is the one taken, so every drop shares one period and differs only in phase, which is the
 * field's own seeded number rather than a fresh random per session.
 *
 * WHAT IS AUTHORED IS THE SPEED, AND THE SUBSTANCE SAYS THE SPEED IS ZERO. occvm/globules.js measures
 * it: at the density contrast the 30 px ceiling implies, the buoyant stress on a globule is 1.509 Pa at
 * r = 9 and 5.031 Pa at r = 30, against τ₀ = 21.15 — **14× short at the smallest drop in the field,
 * 4.2× at the largest**, and a globule would need a 126 px radius before buoyancy could move it at all.
 * That is not a reason to abandon the floor; L13 grants it and records the cost. It is a reason to
 * state the number rather than to reach for a derivation that returns zero, and to keep the pace this
 * floor already had rather than inventing a new one alongside a new model.
 *
 * FLOOR_RISE_PX_S is therefore 1.4 — the same magnitude `OCCVM_GLOBULES.DRIFT_PX_S` has carried since
 * 2.22, now vertical and cyclic instead of random. The period FOLLOWS from it and the surface's own
 * height rather than being a second authored number: a drop crosses the face at that speed, so a tall
 * face cycles slowly and a short one quickly, which is what a taller vessel does.
 *
 * The turn at each end rides the substance's OWN cessation curve (OCCVM_RHEOLOGY.easing, derived at
 * 2.8 with its hard stop), not an invented ease: a blob arriving at the top surface decelerates to
 * rest, and this system already owns exactly one curve for coming to rest irreversibly. */
var FLOOR_RISE_PX_S = 1.4;    /* authored: see above — the substance's own answer here is zero */
var FLOOR_DWELL = 0.18;       /* authored: the share of each half-cycle spent attached at an end */

/* The substance's cessation curve, sampled ONCE: `easing` integrates 4,000 steps and the curve is a
   property of the substance, not of the frame, so calling it per drop per frame would be the wrong
   price. Linear interpolation between samples. At module scope with cyclePos because neither is a
   function of a canvas — a pure curve a harness can drive, rather than a closure it has to infer. */
var FLOOR_EASE = (function () {
  try { return OCCVM_RHEOLOGY.easing(OCCVM_RHEOLOGY.SUBSTANCE, 1, 33); } catch (e) { return null; }
})();
function floorEase(x) {
  if (!FLOOR_EASE) return Math.max(0, Math.min(1, x));       /* no substance spliced: straight ramp */
  var t = Math.max(0, Math.min(1, x)) * (FLOOR_EASE.length - 1), i = Math.floor(t), f = t - i;
  return i >= FLOOR_EASE.length - 1 ? FLOOR_EASE[FLOOR_EASE.length - 1]
       : FLOOR_EASE[i] + (FLOOR_EASE[i + 1] - FLOOR_EASE[i]) * f;
}
/* one drop's height in its cycle: 0 at the bottom of the travel, 1 at the top — rise, attach, sink,
   rest, with the turn at each end on the substance's own cessation curve rather than an invented ease.
   It is exactly 0 only while resting at the bottom, which is what lets it BE the coil predicate as
   well as the position: no authored coil height, because step 3 already put one there. */
function cyclePos(u) {
  var half = 0.5, move = half * (1 - FLOOR_DWELL);
  if (u < move) return floorEase(u / move);                      /* rising  */
  if (u < half) return 1;                                        /* attached at the top */
  if (u < half + move) return 1 - floorEase((u - half) / move);  /* sinking */
  return 0;                                                      /* resting at the bottom */
}

/* P-3's confirmed law, on its own so it can be driven rather than read. Linear in t, and the guard
   proves linearity by doubling rather than by matching the source text: r(2t) = 2·r(t), which √t does
   not satisfy and which is the one substitution anybody is likely to make here. */
function bridgeRadius(ms) { return FLOOR_MERGE_PX_S * Math.max(0, ms) / 1000; }

function ambientFloor(canvas, still) {
  if (!canvas || !canvas.getContext) return function () {};
  /* named, not aliased: the L10 auditor measures the consumer by this call */
  if (typeof OCCVM_GLOBULES === "undefined" || !OCCVM_GLOBULES.field) return function () {};

  var ink = (function () {
    try {
      var cs = getComputedStyle(document.documentElement);
      var hi = (cs.getPropertyValue("--vein-hi") || "").trim();
      var lo = (cs.getPropertyValue("--vein-lo") || "").trim();
      return /^#[0-9a-f]{6}$/i.test(hi) && /^#[0-9a-f]{6}$/i.test(lo) ? [hi, lo] : null;
    } catch (e) { return null; }
  })();
  if (!ink) return function () {};

  /* 2.28 — METABALL RENDERING, the build plan's own first recommendation and the same threshold BTC's
     still frame uses. `OCCVM_GLOBULES.gooFilter` is the one definition; here it goes into a hidden
     <svg> in the document and the canvas names it, so the live floor and every still slab cut their
     isosurface at the same level. What it buys is not the silhouette — it is that overlapping fields
     ADD, so two approaching drops join with no merge code at all. The explicit bridge quad this
     replaced was geometry standing in for physics, and worse, it could only ever draw a merge that
     completes; a field-based join is arrested by stopping the approach, which is the only way the
     frozen dumbbell of the plan's §2 can be rendered without a second special case. */
  var gooId = (function () {
    try {
      var id = "occvm-goo";
      if (!document.getElementById(id)) {
        var host = document.createElement("div");
        host.setAttribute("aria-hidden", "true");
        host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
        host.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg'><defs>" +
          OCCVM_GLOBULES.gooFilter({ id: id }) + "</defs></svg>";
        document.body.appendChild(host);
      }
      return id;
    } catch (e) { return null; }
  })();

  var ctx = canvas.getContext("2d"), fld = null;
  var w = 0, h = 0, pw = 0, ph = 0, dpr = 1, drops = [], welds = [], raf = 0, last = 0, clock = 0;

  function count() { return fld ? fld.count() : 3; }
  function spawn(seedEdge) { return fld.spawn(seedEdge); }

  function size() {
    var box = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, Math.round(box.width)); h = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!drops.length) { fld = OCCVM_GLOBULES.field({ seed: FLOOR_SEED, w: w, h: h }); drops = fld.drops.slice(); }
    else if (pw && ph && (pw !== w || ph !== h))
      for (var j = 0; j < drops.length; j++) { drops[j].x *= w / pw; drops[j].y *= h / ph; }
    pw = w; ph = h;
  }

  function blob(c2, d, alpha) {
    var g = c2.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    g.addColorStop(0, ink[0]); g.addColorStop(1, ink[1]);
    c2.globalAlpha = alpha; c2.fillStyle = g;
    c2.beginPath(); c2.arc(d.x, d.y, d.r, 0, Math.PI * 2); c2.fill();
  }

  /* at the coil = resting at the bottom of the cycle, which cyclePos returns exactly 0 for. It reads
     this instance's own clock, so unlike cyclePos it is not a pure curve and stays inside. */
  function atCoil(d, period) {
    if (d.phase === undefined) return true;
    return cyclePos(((clock / period) + d.phase) % 1) === 0;
  }

  function step(dt) {
    var i, j;
    /* 2.28 — the cycle's period follows from the authored speed and the surface's own height, so the
       floor keeps its pace on a face of any size rather than carrying a second authored constant. */
    var travel = Math.max(1, h), period = 2 * (travel / FLOOR_RISE_PX_S) * 1000 / (1 - FLOOR_DWELL);
    clock += dt;
    for (i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.x += d.vx * dt;                                        /* the lateral wander a real lamp shows */
      if (d.x < -d.r * 2) d.x = w + d.r; else if (d.x > w + d.r * 2) d.x = -d.r;
      if (d.merging) continue;                                 /* a welding pair is driven by the weld */
      if (d.lockedTo) continue;                                /* a follower lobe is placed below */
      var u = ((clock / period) + (d.phase === undefined ? 0 : d.phase)) % 1;
      d.y = (h - d.r) - cyclePos(u) * (h - 2 * d.r);
    }
    /* the follower lobes, after every leader has moved: a frozen bridge holds its offset exactly */
    for (i = 0; i < drops.length; i++) {
      var f = drops[i];
      if (f.lockedTo) { f.x = f.lockedTo.x + f.dx; f.y = f.lockedTo.y + f.dy; }
    }
    for (i = 0; i < welds.length; i++) {
      var wd = welds[i];
      wd.t += dt; wd.rb = bridgeRadius(wd.t);              /* r ∝ t — the derived half */
      if (wd.rb >= wd.target) {
        var a = wd.a, b = wd.b;
        if (wd.arrests) {
          /* 2.28 step 5 — IT FREEZES. The bridge reached the height the Bingham number allows and the
             yield stress holds it there: "the effect of the yield stress evident only in its final
             arrested shape". The pair does NOT become one drop. It stays two lobes locked at the
             separation they froze at, which is what a frozen dumbbell IS, and it answers the build
             plan's open accumulation question without inventing a rule: an arrested pair is one stuck
             object, so it drifts off on the cycle rather than piling up at the coil. It also cannot
             grow without bound — a pair that has arrested is done, and a third arrival would need the
             bridge to grow again against a yield stress that already stopped it. */
          a.locked = b.locked = true; a.merging = b.merging = false;
          /* ONE RIGID OBJECT, not two drops that agree to move alike. The first draft gave the follower
             the leader's phase and let it compute its own height — and because that height depends on
             the drop's own radius, two lobes of different size drifted apart over the cycle. A frozen
             bridge does not stretch: the follower's position is the leader's plus the offset they froze
             at, and nothing else. */
          b.lockedTo = a; b.dx = b.x - a.x; b.dy = b.y - a.y;
          welds.splice(i--, 1);
          continue;
        }
        /* 2.28 — the conservation convention is the SHARED part's, not this file's. It shipped here as
           area (r² = r₁² + r₂²); occvm/globules.js decides volume (r³ = r₁³ + r₂³) and records why, and
           the arrest boundaries are computed against that choice, so two conventions would put the
           renderer and the physics on different drops. Centres weight by the same power. */
        var P = OCCVM_GLOBULES.MERGE_POWER;
        var wa = Math.pow(a.r, P), wb = Math.pow(b.r, P), m = wa + wb;
        a.x = (a.x * wa + b.x * wb) / m; a.y = (a.y * wa + b.y * wb) / m;
        a.r = OCCVM_GLOBULES.merged(a.r, b.r); a.merging = false; b.gone = true;
        welds.splice(i--, 1);
        drops = drops.filter(function (x) { return !x.gone; });
        while (drops.length < count()) drops.push(spawn(true));
      }
    }
    /* 2.28 step 4 — RECOMBINATION HAPPENS AT THE COIL, not wherever two globules touch.
       A real lava lamp carries a metallic wire coil at the base acting as a surface-tension breaker,
       recombining cooled wax after it descends; free-floating pairwise merging anywhere on screen is
       the easier build and is not what the object does. The coil determines WHERE globules meet; τ₀
       determines WHAT the meeting produces.
       The coil needs no geometry and no authored height here, because step 3 already put one at the
       bottom: a drop is at the coil exactly when it is in the bottom dwell of its cycle. Two drops can
       only begin a weld while both are resting there, which is also when a real lamp's wax pools. */
    for (i = 0; i < drops.length; i++) for (j = i + 1; j < drops.length; j++) {
      var p = drops[i], q = drops[j];
      if (p.merging || q.merging || p.locked || q.locked) continue;
      if (!atCoil(p, period) || !atCoil(q, period)) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) > p.r + q.r) continue;
      /* the substance decides the outcome BEFORE the bridge starts growing, from the radii alone —
         so the same weld renders a completion or a freeze without a branch appearing mid-merge */
      var reg = OCCVM_GLOBULES.arrestRegime(p.r, q.r);
      var lobe = Math.min(p.r, q.r);
      p.merging = q.merging = true;
      welds.push({ a: p, b: q, t: 0, rb: 0, arrests: reg !== "completes",
                   target: lobe * OCCVM_GLOBULES.arrestedBridge(p.r, q.r) });
    }
  }

  /* THE WEIGHT GOES OUTSIDE THE FILTER, and getting that wrong erases the floor completely.
     The isosurface cuts at alpha 0.5 (Blinn). Drawing the blobs AT `FLOOR_ALPHA` = 0.24 puts the whole
     field below the cut, so the threshold deletes it: measured in Chromium on a 25 px disc, filtered at
     alpha 0.24 gives max alpha 0 over 0 non-zero pixels, against 255 over 1,804 at alpha 1. The first
     version of this shipped that way and the screenshot did not show it — the slab it was measured on
     has the floor behind opaque controls, so "looks the same" and "is gone" were the same picture.
     Caught by probing the pixels rather than by looking.
     BTC's still frame never had the bug because its `<g opacity>` wraps the FILTERED group; the canvas
     needs the same shape, so the field is drawn opaque on an offscreen buffer, thresholded there, and
     composited at the weight. One extra canvas, no extra field. */
  var buf = null, bctx = null;
  function paint() {
    ctx.clearRect(0, 0, w, h);
    var i, filtered = false;
    if (gooId) {
      try {
        if (!buf) { buf = document.createElement("canvas"); bctx = buf.getContext("2d"); }
        if (buf.width !== canvas.width || buf.height !== canvas.height) { buf.width = canvas.width; buf.height = canvas.height; }
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bctx.clearRect(0, 0, w, h);
        bctx.filter = "url(#" + gooId + ")";
        filtered = bctx.filter !== "none";
      } catch (e) { filtered = false; }
    }
    if (filtered) {
      for (i = 0; i < drops.length; i++) blob(bctx, drops[i], 1);
      bctx.filter = "none"; bctx.globalAlpha = 1;
      ctx.globalAlpha = FLOOR_ALPHA;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buf, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      /* no SVG-filter support on a 2D context: the unthresholded field, which is what shipped at 2.25.
         A degradation, never a blank — the same rule L8 applies to reduced motion. */
      for (i = 0; i < drops.length; i++) blob(ctx, drops[i], FLOOR_ALPHA);
    }
    ctx.globalAlpha = 1;
  }

  size();
  if (still) { paint(); return function () {}; }
  last = performance.now();
  var frame = function (t) {
    var dt = Math.min(100, t - last); last = t;
    step(dt); paint();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  /* The face GROWS. `.bars` is nearly empty at mount and gains a row per bar, so a single measurement at
     mount plus a window-resize listener sizes the floor to whatever the draft happened to be when the
     component appeared — measured in Chromium at 356×44 px against a face several times that, a floor
     that every assertion passed and that was the wrong size on screen. A ResizeObserver on the element
     is the measurement that tracks the thing it measures. */
  var onResize = function () { size(); };
  window.addEventListener("resize", onResize);
  var ro = null;
  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(onResize); ro.observe(canvas.parentNode || canvas); }
  return function () {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    if (ro) ro.disconnect();
  };
}

function useAmbientFloor(ref, still, key) {
  useEffect(() => {
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    return ambientFloor(ref.current, reduce || !!still);
  }, [still, key]);
}

/* ---- bank ---- */
/* One removal, one vocabulary. Both paths — the button and the swipe — go through this, because the same
   irreversible action rendering two different physical vocabularies depending on how it was triggered is
   the defect 2.16 named while keeping the lock release below the regime crossover. Removing a banked word
   is as irreversible as removing a draft, so it pinches (OCCVM-L11), exactly as the shelf row does. */
function BankRow({ w, bank, setBank, overrides, setOverride, open, setPick }) {
  const key = clean(w), p = E2.pronounce(w);
  const el = useRef(null);
  const drop = () => setBank(bank.filter(b => b !== w));
  const remove = () => {
    const node = el.current;
    if (node && typeof OCCVM_YIELD !== "undefined") OCCVM_YIELD.pinch(node, drop);
    else drop();
  };
  const sw = useSwipeYield(remove);
  return (
    <div>
      <div ref={el} className={"bankrow" + (sw.past ? " past" : "")} style={sw.style} {...sw.handlers}>
        <span className={"wd" + (overrides[key] ? " override" : "")}>{w}</span>
        <div className={"word" + (open ? " pick" : "")} style={{ flex: 1, alignItems: "flex-end" }}>
          <button type="button" className="stones occvm-act" aria-expanded={!!open} aria-label={`syllables of ${w}`} onClick={() => setPick(open ? null : key)}>{p.sylls.map((s, k) => <Stone key={k} v={s.v} s={s.s} />)}</button>
        </div>
        <button type="button" className="rm occvm-act" onClick={remove}>remove</button>
      </div>
      {open && <Picker word={key} overrides={overrides} setOverride={setOverride} onClose={() => setPick(null)} />}
    </div>
  );
}

function Bank({ bank, setBank, overrides, setOverride, eng }) {
  const [add, setAdd] = useState(""); const [pick, setPick] = useState(null);
  const commit = () => { const w = add.trim(); if (!w) return; if (!bank.some(b => clean(b) === clean(w))) setBank([...bank, w]); setAdd(""); };
  return (
    <div>
      <input className="cut" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => e.key === "Enter" && commit()} placeholder="add a word — names, slang, coinages" autoCapitalize="off" autoCorrect="off" />
      <div className="row"><Cast on action onClick={commit} patina>add</Cast></div>
      <div className="note">every banked word joins lookup. tap its stones to cut the vowel your mouth uses; the cut carries everywhere the word appears. a row holds under a light drag and only slides once you push past it — swipe it clear, or tap remove.</div>
      {bank.length === 0 && <div className="empty">nothing banked yet.</div>}
      {bank.map(w => (
        <BankRow key={w} w={w} bank={bank} setBank={setBank} overrides={overrides} setOverride={setOverride}
          open={pick === clean(w)} setPick={setPick} />
      ))}
    </div>
  );
}

/* ---- tune ---- */
function Tune({ prefs, setPrefs, engStatus, migrated, onExport, onImport }) {
  const [geo, setGeo] = useState("");
  const [backupNote, setBackupNote] = useState("");
  const fileRef = useRef(null);
  const locate = () => {
    if (!navigator.geolocation) { setGeo("no location on this device"); return; }
    setGeo("asking…");
    navigator.geolocation.getCurrentPosition(
      p => { setPrefs({ ...prefs, place: { lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), name: "your location" } }); setGeo(""); },
      e => setGeo("no fix — " + (e.message || "declined")), { timeout: 8000, maximumAge: 600000 });
  };
  const restore = async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    setBackupNote("restoring…");
    try { setBackupNote(await onImport(file)); }
    catch (err) { setBackupNote("couldn't read that file — " + (err.message || "not a tome backup")); }
  };
  const place = prefs.place;
  return (
    <div>
      <div className="label">light</div>
      <div className="row">
        <Cast on={!place} patina onClick={() => setPrefs({ ...prefs, place: null })}>{SUN.DAYTON.name}</Cast>
        <Cast on={!!place} patina onClick={locate}>{place ? `${place.name} · ${place.lat}, ${place.lon}` : "use my location"}</Cast>
      </div>
      {geo && <div className="note" style={{ marginTop: 6 }}>{geo}</div>}
      <div className="label">palette</div>
      <div className="row">
        {/* OCCVM-L6 — each swatch wears the palette it offers through --m (the decorative accent), and
            the selected one is the Cast's own `on` state. Five, not three: the closed mineral set died
            with the crystal at 2.8 and the count now follows occvm/pigments.js rather than this line. */}
        {Object.keys(PIGMENTS).map(k => <Cast key={k} on={prefs.palette === k} onClick={() => setPrefs({ ...prefs, palette: k })} style={{ "--m": PIGMENTS[k].m }}>{k}</Cast>)}
      </div>
      <div className="label">spacing</div>
      <div className="row">{["comfy", "dense"].map(d => <Cast key={d} on={prefs.density === d} patina onClick={() => setPrefs({ ...prefs, density: d })}>{d}</Cast>)}</div>
      <div className="label">motion</div>
      <div className="row">{["on", "off"].map(m => <Cast key={m} on={prefs.motion === m} patina onClick={() => setPrefs({ ...prefs, motion: m })}>{m}</Cast>)}</div>
      <div className="label">backup</div>
      <div className="row">
        <Cast on action onClick={onExport}>download backup</Cast>
        <Cast patina onClick={() => fileRef.current.click()}>restore from backup</Cast>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={restore} />
      </div>
      {backupNote && <div className="note" style={{ marginTop: 6 }}>{backupNote}</div>}
      <div className="note">
        <b>engine 2.0</b> · {engStatus === "ready" ? `${E2.size().toLocaleString()} words, stress carried. your exception table outranks the dictionary; the v1 rules only speak for words neither knows.`
          : engStatus === "loading" ? "loading the dictionary (about 690 KB, once)…"
          : engStatus === "error" ? `dictionary didn't load (${E2.error()}). running on the curated list and the v1 rules until it does.` : "…"}
        <br /><b>light</b> · solar position for {place ? "your location" : SUN.DAYTON.name}, computed on the phone. the coordinates stay in this browser.
        <br /><b>backup</b> · everything lives only in this browser. download a backup before switching phones, wiping storage, or moving to another device, then restore it there — new drafts and bank words merge in, nothing already on the other device gets overwritten.
        {migrated && <><br /><b>carried over</b> · your bank, draft, and vowel cuts from the metro build.</>}
      </div>
    </div>
  );
}

/* ---- the stack ---- */
const FACES = [
  { id: "draft", name: "draft" }, { id: "lookup", name: "lookup" }, { id: "check", name: "check" }, { id: "bank", name: "bank" }, { id: "tune", name: "tune" },
];
function Tome() {
  const [open, setOpen] = useState(null);
  const [bank, setBank_] = useState([]); const [overrides, setOverrides_] = useState({});
  const [shelf, setShelf_] = useState([]); const [current, setCurrent_] = useState(null);
  const [prefs, setPrefs_] = useState({ palette: OCCVM_PIGMENT_DEFAULT, density: "comfy", motion: "on" });
  const [pop, setPop_] = useState("rap");
  const [loaded, setLoaded] = useState(false); const [migrated, setMigrated] = useState(false);
  const [engStatus, setEngStatus] = useState("idle"); const [sun, setSun] = useState(null);
  useEffect(() => {
    setMigrated(STORE.migrate());
    setBank_(STORE.get("bank", []));
    let sh = STORE.get("shelf", null), cur = STORE.get("current", null);
    if (!sh || !sh.length) { sh = [{ id: "d" + Date.now(), name: "first draft", text: STORE.get("draft", ""), updated: Date.now() }]; cur = sh[0].id; STORE.set("shelf", sh); STORE.set("current", cur); }
    if (!sh.some(d => d.id === cur)) cur = sh[0].id;
    setShelf_(sh); setCurrent_(cur);
    const o = STORE.get("overrides", {}); OVERRIDES = o; setOverrides_(o);
    /* 2.27 — a stored `mineral` from before the palettes is read once and resolved to a palette rather
       than left to fall through to the default silently. amethyst was the default and obsidian is the
       palette that preserves it; the other two were accents this tool never mapped to a palette. */
    const sp = STORE.get("prefs", { palette: OCCVM_PIGMENT_DEFAULT, density: "comfy", motion: "on" });
    if (sp.mineral !== undefined && !sp.palette) { sp.palette = OCCVM_PIGMENT_DEFAULT; sp.migratedFrom = { mineral: sp.mineral }; delete sp.mineral; STORE.set("prefs", sp); }
    if (!PIGMENTS[sp.palette]) sp.palette = OCCVM_PIGMENT_DEFAULT;
    setPrefs_(sp); setPop_(STORE.get("pop", "rap"));
    setLoaded(true); E2.load(setEngStatus);
  }, []);
  useEffect(() => { const t = () => setSun(SUN.apply(new Date())); t(); const id = setInterval(t, 60000); return () => clearInterval(id); }, []);
  useEffect(() => { SUN.setPlace(prefs.place); setSun(SUN.apply(new Date())); }, [prefs.place]);
  useEffect(() => { E2.setOwn([...bank, ...shelf.flatMap(d => d.text.split(/\s+/))]); }, [bank, shelf]);
  useEffect(() => {
    /* one call, one part, both tools — see occvm/pigments.js. Before 2.27 this hand-wrote four
       properties here and BTC hand-wrote the same four in its own applyMineral, which is how a shared
       set acquires a local exception. */
    occvmApplyPigment(prefs.palette, document.documentElement.style);
    document.body.className = (prefs.density === "dense" ? "dense " : "") + (prefs.motion === "on" ? "motion" : "");
  }, [prefs]);
  const setBank = v => { setBank_(v); STORE.set("bank", v); };
  const setPrefs = v => { setPrefs_(v); STORE.set("prefs", v); };
  const setPop = v => { setPop_(v); STORE.set("pop", v); };
  const draft = (shelf.find(d => d.id === current) || { text: "" }).text;
  const shelfTimer = useRef(null);
  const setShelf = (v, now) => { setShelf_(v); clearTimeout(shelfTimer.current); if (now) STORE.set("shelf", v); else shelfTimer.current = setTimeout(() => STORE.set("shelf", v), 700); };
  const setDraft = v => setShelf(shelf.map(d => d.id === current ? { ...d, text: v, updated: Date.now() } : d));
  /* tempo lives on the draft, not globally — different songs, different tempos. Riding the shelf
   * entry means backup/restore carries it with no extra handling. */
  const tempo = (shelf.find(d => d.id === current) || {}).tempo || null;
  const setTempo = v => setShelf(shelf.map(d => d.id === current ? { ...d, tempo: v || undefined, updated: Date.now() } : d), true);
  const setCurrent = id => { setCurrent_(id); STORE.set("current", id); };
  const newDraft = () => { const d = { id: "d" + Date.now(), name: "draft " + (shelf.length + 1), text: "", updated: Date.now() }; setShelf([...shelf, d], true); setCurrent(d.id); };
  const renameDraft = (id, name) => setShelf(shelf.map(d => d.id === id ? { ...d, name } : d), true);
  const removeDraft = id => { const rest = shelf.filter(d => d.id !== id); setShelf(rest, true); if (current === id) setCurrent(rest[0].id); };
  const shelfProps = { shelf, current, setCurrent, newDraft, renameDraft, removeDraft };
  const setOverride = (word, v) => { const o = { ...overrides }; if (v) o[word] = v; else delete o[word]; OVERRIDES = o; setOverrides_(o); STORE.set("overrides", o); };
  const exportBackup = () => {
    const payload = { app: "rhyme-instrument", version: 1, exportedAt: new Date().toISOString(), bank, shelf, current, overrides, prefs, pop };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rhyme-instrument-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };
  /* merge, not replace: a newer shelf entry (by `updated`) wins per-draft, bank words union, overrides fill gaps only. */
  const importBackup = async file => {
    const incoming = JSON.parse(await file.text());
    if (!incoming || !Array.isArray(incoming.shelf)) throw new Error("not a tome backup file");
    const seen = new Set(bank.map(clean));
    const mergedBank = [...bank];
    for (const w of incoming.bank || []) if (!seen.has(clean(w))) { mergedBank.push(w); seen.add(clean(w)); }
    const byId = new Map(shelf.map(d => [d.id, d]));
    let added = 0, updated = 0;
    for (const d of incoming.shelf) {
      const local = byId.get(d.id);
      if (!local) { byId.set(d.id, d); added++; }
      else if ((d.updated || 0) > (local.updated || 0)) { byId.set(d.id, d); updated++; }
    }
    setBank(mergedBank);
    setShelf([...byId.values()], true);
    const o = { ...(incoming.overrides || {}), ...overrides }; OVERRIDES = o; setOverrides_(o); STORE.set("overrides", o);
    return `restored: ${added} new draft${added === 1 ? "" : "s"}, ${updated} updated, ${mergedBank.length - bank.length} new bank word${mergedBank.length - bank.length === 1 ? "" : "s"}`;
  };
  const eng = engStatus;
  const bars = draft.split("\n").filter(l => l.trim()).length;
  const nOv = Object.keys(overrides).length;
  const quick = useMemo(() => bars ? E2.reading(draft, { pop }) : null, [draft, pop, overrides, eng]);
  const sums = {
    draft: <>{(shelf.find(d => d.id === current) || {}).name || ""} · {bars ? <>{bars} bar{bars === 1 ? "" : "s"}{quick && quick.maxRun > quick.limit ? <em> · drone {quick.maxRun}</em> : null}</> : "empty"}</>,
    lookup: engStatus === "ready" ? `${E2.size().toLocaleString()} words` : engStatus === "loading" ? "loading…" : "curated list",
    check: "a ~ b",
    bank: `${bank.length} word${bank.length === 1 ? "" : "s"} · ${nOv} cut${nOv === 1 ? "" : "s"}`,
    tune: `${prefs.palette} · ${prefs.density}`,
  };
  const face = id => ({
    draft: <Draft draft={draft} setDraft={setDraft} overrides={overrides} setOverride={setOverride} pop={pop} setPop={setPop} eng={eng} shelfProps={shelfProps} palette={prefs.palette} tempo={tempo} setTempo={setTempo} />,
    lookup: <Lookup bank={bank} setBank={setBank} eng={eng} />,
    check: <Check eng={eng} />,
    bank: <Bank bank={bank} setBank={setBank} overrides={overrides} setOverride={setOverride} eng={eng} />,
    tune: <Tune prefs={prefs} setPrefs={setPrefs} engStatus={engStatus} migrated={migrated} onExport={exportBackup} onImport={importBackup} />,
  }[id]);
  const idx = FACES.findIndex(f => f.id === open);
  const floorRef = useRef(null);
  useAmbientFloor(floorRef, open !== "draft", open);
  return (
    <div>
      <header className="binding">
        <h1><button type="button" className="occvm-act" onClick={() => setOpen(null)}>rhyme instrument</button></h1>
        {sun && <div className="sun"><b>{sun.time}</b> · sun {sun.elev >= 0 ? sun.elev.toFixed(0) + "°" : "set"} · {sun.dir}</div>}
      </header>
      {!loaded ? <div className="stack note">opening</div> : (
        <div className={"stack" + (open ? " open" : "")}>
          {open && (
            <section key={open} className={"slab rise"} style={{ "--thick": "16px" }}>
              {/* 2.24 — the globule field is the slab's substrate layer. It MOVES only on the draft face, which
                  is the whole of L13's grant; every other face gets the same field as a still frame — the
                  reduced-motion shape, used here as a scope. The vein layer this replaces is retired. */}
              <canvas className="floor" ref={floorRef} aria-hidden="true" />
              <button type="button" className="head occvm-act" onClick={() => setOpen(null)}><h2>{open}</h2><span className="hint">tap to close</span></button>
              {face(open)}
            </section>
          )}
          {FACES.filter(f => f.id !== open).map((f, i) => (
            <button type="button" key={f.id} className="edge occvm-act" onClick={() => setOpen(f.id)}>
              <span className="name">{f.name}</span><span className="sum">{sums[f.id]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<Tome />);
