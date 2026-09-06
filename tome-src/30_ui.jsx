
/* ---------- tome UI ---------- */
const { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } = React;
const NAMES = { ...VOWEL_NAMES, AE: "a", IH: "ih", UH: "ŏŏ" };
const clean = s => (s || "").toLowerCase().replace(/[^a-z']/g, "");

function Stone({ v, s = 1, onClick, chosen }) {
  return <span className={`stone s${s}${onClick ? " pickable" : ""}${chosen ? " chosen" : ""}`}
    style={{ "--c": VOWEL_COLORS[v] || "#777" }} onClick={onClick}>{NAMES[v] || (v || "").toLowerCase()}</span>;
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
            <div key={i} className={"stones read" + (same(r) ? " cur" : "")} onClick={() => { commit(r); onClose(); }}>
              {r.map((x, k) => <Stone key={k} v={x.v} s={x.s} />)}
            </div>
          ))}
        </div>
      )}
      <div className="who">cut <i>{word}</i> by syllable — pick a stone, then the vowel your mouth uses</div>
      <div className="stones read" style={{ marginBottom: 8 }}>
        {cur.map((x, i) => <Stone key={i} v={x.v} s={x.s} chosen={i === sel} onClick={() => setSel(i)} />)}
        <span className="clear" onClick={cutStress}>{cur[sel] && cur[sel].s > 0 ? "stressed" : "unstressed"}</span>
      </div>
      <div className="stones">
        {Object.keys(VOWEL_NAMES).map(v => <Stone key={v} v={v} chosen={cur[sel] && cur[sel].v === v} onClick={() => { cutVowel(v); }} />)}
        {has && <span className="clear" onClick={() => { setOverride(word, null); onClose(); }}>clear all cuts</span>}
        <span className="clear" onClick={onClose}>done</span>
      </div>
    </div>
  );
}
function Cast({ on, children, onClick, patina, style }) {
  return <div className={`cast${on ? " on" : ""}${patina ? " patina" : ""}`} onClick={onClick} style={style}>{children}</div>;
}

/* ---- draft: the Rosetta face ---- */
function BarCut({ value, onChange, onReturn, onBackspaceEmpty, onDone }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  return <input ref={ref} className="cut barcut" value={value} onChange={e => onChange(e.target.value)} enterKeyHint="next" autoCapitalize="sentences" autoCorrect="off" spellCheck={false}
    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onReturn(); } else if (e.key === "Backspace" && !value) { e.preventDefault(); onBackspaceEmpty(); } else if (e.key === "Escape") onDone(); }}
    onBlur={onDone} />;
}
function Bar({ bar, reading, overrides, setOverride, pick, setPick, editing, edit }) {
  const run = reading.runs.find(r => r.bars.includes(bar.i));
  const flagged = reading.flagged.includes(bar.i);
  const heat = flagged && run ? Math.min(1, (run.bars.indexOf(bar.i) - reading.limit + 1) / Math.max(1, run.len - reading.limit)) : 0;
  return (
    <div className="bar" data-bar={bar.i} data-heat={flagged ? "" : undefined}
      style={{ "--bthick": (5 + bar.syllables * 1.1).toFixed(0) + "px", "--heat": heat.toFixed(2) }}>
      {editing ? <BarCut value={bar.text} onChange={v => edit.change(bar.i, v)} onReturn={() => edit.next(bar.i)} onBackspaceEmpty={() => edit.remove(bar.i)} onDone={() => edit.done(bar.i)} />
      : <p className="text" style={{ margin: 0 }} onClick={() => edit.start(bar.i)}>
        {bar.field.map((w, i) => <React.Fragment key={i}><span className={"w " + w.source}>{w.word}</span>{i < bar.field.length - 1 ? " " : ""}</React.Fragment>)}
      </p>}
      <div className="field">
        {bar.field.map((w, i) => {
          const key = clean(w.word);
          const open = pick && pick.bar === bar.i && pick.word === key && pick.idx === i;
          return (
            <div key={i} className={"word" + (open ? " pick" : "")} data-word={key}>
              <div className="stones" onClick={() => setPick(open ? null : { bar: bar.i, word: key, idx: i })}>
                {w.sylls.map((s, k) => <Stone key={k} v={s.v} s={s.s} />)}
              </div>
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
        <span>{bar.syllables} syl{bar.drift ? <span className="warn"> · meter {bar.drift > 0 ? "+" : ""}{bar.drift}</span> : null}{bar.filler ? <span className="bad"> · filler landing</span> : null}
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
        <Cast on onClick={() => setOpen(!open)} style={{ flex: 2, textAlign: "left" }}>{cur ? cur.name : "untitled"} <span className="dim">· {shelf.length} on the shelf</span></Cast>
        <Cast onClick={() => { const n = prompt("name this draft", cur ? cur.name : ""); if (n != null && n.trim()) renameDraft(current, n.trim()); }}>name</Cast>
        <Cast patina on onClick={newDraft}>new</Cast>
      </div>
      {open && (
        <div className="shelflist">
          {shelf.slice().sort((a, b) => b.updated - a.updated).map(d => (
            <div key={d.id} className={"bankrow" + (d.id === current ? " cur" : "")}>
              <span className="wd" onClick={() => { setCurrent(d.id); setOpen(false); }}>{d.name}<span className="dim"> · {d.text.split("\n").filter(l => l.trim()).length} bars · {when(d.updated)}</span></span>
              {shelf.length > 1 && <span className="rm" onClick={() => { if (confirm(`remove “${d.name}” from the shelf?`)) removeDraft(d.id); }}>remove</span>}
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
        <div className="picklist">{filled.map(b => <div key={b.i} className={"pl" + (b.i === one ? " on" : "")} onClick={() => setOne(b.i)}>{b.text}</div>)}</div>
      ) : (
        <div>
          <div className="label">start at</div>
          <div className="picklist">{filled.map(b => <div key={b.i} className={"pl" + (b.i === start ? " on" : "")} onClick={() => setStart(b.i)}>{b.text}</div>)}</div>
          <div className="row">{[4, 5, 6, 7, 8].map(n => <Cast key={n} on={len === n} onClick={() => setLen(n)}>{n}</Cast>)}</div>
        </div>
      )}
      <div ref={holder} className="preview" />
      <div className="row">
        <Cast patina on onClick={async () => { setStatus("…"); setStatus(await CARD.share(canvasRef.current, "rhyme-instrument-" + Date.now())); }}>share</Cast>
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
function Draft({ draft, setDraft, overrides, setOverride, pop, setPop, eng, shelfProps, mineral }) {
  const [pick, setPick] = useState(null);
  const [editing, setEditing] = useState(null);           // line index being cut
  const [quarry, setQuarry] = useState(false);
  const [share, setShare] = useState(false);
  const [meterOpen, setMeterOpen] = useState(false);
  const host = useRef(null);
  const reading = useMemo(() => E2.reading(draft, { pop }), [draft, pop, overrides, eng]);
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
      <div className="row wrap" style={{ marginTop: 0 }}>
        <Cast on={pop === "rap"} onClick={() => setPop("rap")}>rap · drone past 3</Cast>
        <Cast on={pop === "melodic"} onClick={() => setPop("melodic")}>melodic · drone past 6</Cast>
        <Cast on={quarry} patina onClick={() => setQuarry(!quarry)}>quarry</Cast>
        <Cast on={meterOpen} patina onClick={() => setMeterOpen(!meterOpen)} style={{ flex: .8 }}>meter</Cast>
        <Cast on={share} patina onClick={() => setShare(!share)} style={{ flex: .8 }}>share</Cast>
      </div>
      {quarry && <textarea className="cut" style={{ marginTop: 10 }} value={draft} onChange={e => setDraft(e.target.value)} placeholder="paste or cut the whole draft here — one bar per line" rows={9} spellCheck={false} />}
      {meterOpen && <MeterPanel reading={reading} shelf={shelfProps.shelf} pop={pop} onClose={() => setMeterOpen(false)} />}
      {share && reading.bars.some(Boolean) && <SharePanel reading={reading} mineral={mineral} onClose={() => setShare(false)} />}
      <div style={{ marginTop: 16 }}>
        {reading.maxRun > limit && <div className="drone">drone: {reading.maxRun} straight bars on one vowel — past the {pop} line of {limit}.</div>}
        <div className="bars" ref={host}>
          {lines.map((ln, i) => reading.bars[i]
            ? <Bar key={i} bar={reading.bars[i]} reading={reading} overrides={overrides} setOverride={setOverride} pick={pick} setPick={setPick} editing={editing === i} edit={edit} />
            : (editing === i
              ? <div key={i} className="bar" data-bar={i}><BarCut value={ln} onChange={v => edit.change(i, v)} onReturn={() => edit.next(i)} onBackspaceEmpty={() => edit.remove(i)} onDone={() => edit.done(i)} /></div>
              : (lines.length > 1 || ln ? <div key={i} className="break" onClick={() => edit.start(i)}><span>break</span></div> : null)))}
          {reading.bars.some(Boolean) && <Threads reading={reading} host={host} quiet={editing != null} />}
          <div className="ghost" onClick={edit.append}>{reading.bars.some(Boolean) ? "+ bar" : "tap to cut the first bar"}</div>
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
                {list.slice(0, 90).map(it => <span key={it.word} className={`inlay t${it.tier}${banked.has(it.word) ? " banked" : ""}`} onClick={() => toggle(it.word)}>{it.word}</span>)}
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
function Bank({ bank, setBank, overrides, setOverride, eng }) {
  const [add, setAdd] = useState(""); const [pick, setPick] = useState(null);
  const commit = () => { const w = add.trim(); if (!w) return; if (!bank.some(b => clean(b) === clean(w))) setBank([...bank, w]); setAdd(""); };
  return (
    <div>
      <input className="cut" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => e.key === "Enter" && commit()} placeholder="add a word — names, slang, coinages" autoCapitalize="off" autoCorrect="off" />
      <div className="row"><Cast on onClick={commit} patina>add</Cast></div>
      <div className="note">every banked word joins lookup. tap its stones to cut the vowel your mouth uses; the cut carries everywhere the word appears.</div>
      {bank.length === 0 && <div className="empty">nothing banked yet.</div>}
      {bank.map(w => {
        const key = clean(w), p = E2.pronounce(w), open = pick === key;
        return (
          <div key={w}>
            <div className="bankrow">
              <span className={"wd" + (overrides[key] ? " override" : "")}>{w}</span>
              <div className={"word" + (open ? " pick" : "")} style={{ flex: 1, alignItems: "flex-end" }}>
                <div className="stones" onClick={() => setPick(open ? null : key)}>{p.sylls.map((s, k) => <Stone key={k} v={s.v} s={s.s} />)}</div>
              </div>
              <span className="rm" onClick={() => setBank(bank.filter(b => b !== w))}>remove</span>
            </div>
            {open && <Picker word={key} overrides={overrides} setOverride={setOverride} onClose={() => setPick(null)} />}
          </div>
        );
      })}
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
        <Cast on onClick={onExport}>download backup</Cast>
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
    draft: <Draft draft={draft} setDraft={setDraft} overrides={overrides} setOverride={setOverride} pop={pop} setPop={setPop} eng={eng} shelfProps={shelfProps} mineral={prefs.mineral} />,
    lookup: <Lookup bank={bank} setBank={setBank} eng={eng} />,
    check: <Check eng={eng} />,
    bank: <Bank bank={bank} setBank={setBank} overrides={overrides} setOverride={setOverride} eng={eng} />,
    tune: <Tune prefs={prefs} setPrefs={setPrefs} engStatus={engStatus} migrated={migrated} onExport={exportBackup} onImport={importBackup} />,
  }[id]);
  const idx = FACES.findIndex(f => f.id === open);
  return (
    <div>
      <header className="binding">
        <h1 onClick={() => setOpen(null)}>rhyme instrument</h1>
        {sun && <div className="sun"><b>{sun.time}</b> · sun {sun.elev >= 0 ? sun.elev.toFixed(0) + "°" : "set"} · {sun.dir}</div>}
      </header>
      {!loaded ? <div className="stack note">opening</div> : (
        <div className={"stack" + (open ? " open" : "")}>
          {open && (
            <section key={open} className={"slab rise"} style={{ "--veins": veinSVG(prefs.mineral, idx), "--thick": "16px" }}>
              <div className="head" onClick={() => setOpen(null)}><h2>{open}</h2><span className="hint">tap to close</span></div>
              {face(open)}
            </section>
          )}
          {FACES.filter(f => f.id !== open).map((f, i) => (
            <div key={f.id} className="edge" onClick={() => setOpen(f.id)}>
              <span className="name">{f.name}</span><span className="sum">{sums[f.id]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<Tome />);
