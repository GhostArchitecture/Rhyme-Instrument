
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
      setPhase(u < 0.18 ? 1 - u / 0.18 : 0);   /* a strike and a decay, not a sine: a beat is an onset */
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
function Bar({ bar, reading, overrides, setOverride, pick, setPick, editing, edit, pace }) {
  const run = reading.runs.find(r => r.bars.includes(bar.i));
  const flagged = reading.flagged.includes(bar.i);
  const heat = flagged && run ? Math.min(1, (run.bars.indexOf(bar.i) - reading.limit + 1) / Math.max(1, run.len - reading.limit)) : 0;
  return (
    <div className="bar" data-bar={bar.i} data-heat={flagged ? "" : undefined}
      style={{ "--bthick": (5 + bar.syllables * 1.1).toFixed(0) + "px", "--heat": heat.toFixed(2) }}>
      {editing ? <BarCut value={bar.text} onChange={v => edit.change(bar.i, v)} onReturn={() => edit.next(bar.i)} onBackspaceEmpty={() => edit.remove(bar.i)} onDone={() => edit.done(bar.i)} />
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
function SharePanel({ reading, mineral, onClose }) {
  const filled = reading.bars.filter(Boolean);
  const [scope, setScope] = useState("one"); const [format, setFormat] = useState("feed");
  const [one, setOne] = useState(filled.length ? filled[filled.length - 1].i : 0);
  const [start, setStart] = useState(filled.length ? filled[0].i : 0); const [len, setLen] = useState(Math.min(6, Math.max(4, filled.length)));
  const [status, setStatus] = useState("");
  const holder = useRef(null); const canvasRef = useRef(null);
  const chosen = scope === "one" ? [one] : filled.filter(b => b.i >= start).slice(0, len).map(b => b.i);
  useEffect(() => {
    const cv = CARD.render({ reading, bars: chosen, format: format === "story" ? "story" : "feed", mineral });
    canvasRef.current = cv; const h = holder.current; if (!h) return;
    h.innerHTML = ""; cv.style.width = "100%"; cv.style.height = "auto"; cv.style.display = "block"; cv.style.borderRadius = "4px"; h.appendChild(cv);
  }, [reading, scope, format, one, start, len, mineral]);
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
function Draft({ draft, setDraft, overrides, setOverride, pop, setPop, eng, shelfProps, mineral, tempo, setTempo }) {
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
    <div>
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
      {share && reading.bars.some(Boolean) && <SharePanel reading={reading} mineral={mineral} onClose={() => setShare(false)} />}
      <div style={{ marginTop: 16 }}>
        {reading.maxRun > limit && <div className="drone">drone: {reading.maxRun} straight bars on one vowel — past the {pop} line of {limit}.</div>}
        <div className="bars" ref={host}>
          {lines.map((ln, i) => reading.bars[i]
            ? <Bar key={i} bar={reading.bars[i]} reading={reading} overrides={overrides} setOverride={setOverride} pick={pick} setPick={setPick} editing={editing === i} edit={edit} pace={paceBy.get(i)} />
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
      <div className="label">mineral</div>
      <div className="row">
        {Object.keys(MINERALS).map(m => <Cast key={m} on={prefs.mineral === m} onClick={() => setPrefs({ ...prefs, mineral: m })} style={{ "--m": MINERALS[m].m }}>{m}</Cast>)}
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
  const [prefs, setPrefs_] = useState({ mineral: "amethyst", density: "comfy", motion: "on" });
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
    setPrefs_(STORE.get("prefs", { mineral: "amethyst", density: "comfy", motion: "on" })); setPop_(STORE.get("pop", "rap"));
    setLoaded(true); E2.load(setEngStatus);
  }, []);
  useEffect(() => { const t = () => setSun(SUN.apply(new Date())); t(); const id = setInterval(t, 60000); return () => clearInterval(id); }, []);
  useEffect(() => { SUN.setPlace(prefs.place); setSun(SUN.apply(new Date())); }, [prefs.place]);
  useEffect(() => { E2.setOwn([...bank, ...shelf.flatMap(d => d.text.split(/\s+/))]); }, [bank, shelf]);
  useEffect(() => {
    const m = MINERALS[prefs.mineral] || MINERALS.amethyst, rs = document.documentElement.style;
    rs.setProperty("--mineral", m.m); rs.setProperty("--mineral-lo", m.mlo); rs.setProperty("--vein-hi", m.hi); rs.setProperty("--vein-lo", m.lo);
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
    tune: `${prefs.mineral} · ${prefs.density}`,
  };
  const face = id => ({
    draft: <Draft draft={draft} setDraft={setDraft} overrides={overrides} setOverride={setOverride} pop={pop} setPop={setPop} eng={eng} shelfProps={shelfProps} mineral={prefs.mineral} tempo={tempo} setTempo={setTempo} />,
    lookup: <Lookup bank={bank} setBank={setBank} eng={eng} />,
    check: <Check eng={eng} />,
    bank: <Bank bank={bank} setBank={setBank} overrides={overrides} setOverride={setOverride} eng={eng} />,
    tune: <Tune prefs={prefs} setPrefs={setPrefs} engStatus={engStatus} migrated={migrated} onExport={exportBackup} onImport={importBackup} />,
  }[id]);
  const idx = FACES.findIndex(f => f.id === open);
  return (
    <div>
      <header className="binding">
        <h1><button type="button" className="occvm-act" onClick={() => setOpen(null)}>rhyme instrument</button></h1>
        {sun && <div className="sun"><b>{sun.time}</b> · sun {sun.elev >= 0 ? sun.elev.toFixed(0) + "°" : "set"} · {sun.dir}</div>}
      </header>
      {!loaded ? <div className="stack note">opening</div> : (
        <div className={"stack" + (open ? " open" : "")}>
          {open && (
            <section key={open} className={"slab rise"} style={{ "--veins": veinSVG(prefs.mineral, idx), "--thick": "16px" }}>
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
