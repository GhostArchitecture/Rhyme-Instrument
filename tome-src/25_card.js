
/* ---------- share card: canvas renderer, drawn from reading(), no DOM ---------- */
const CARD = (() => {
  const FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const cssVar = k => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)) || 0;
  const hex2 = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const mixHex = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = [16, 8, 0].map(sh => Math.round(((pa >> sh & 255) + ((pb >> sh & 255) - (pa >> sh & 255)) * t))); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); };
  const NAMES2 = { ...VOWEL_NAMES, AE: "a", IH: "ih", UH: "ŏŏ" };

  function light() {
    const lx = cssVar("--lx"), ly = cssVar("--ly"), elev = cssVar("--elev"), night = cssVar("--night"), glow = cssVar("--glow") || .6;
    const rs = getComputedStyle(document.documentElement);
    /* 2.42 — THE CARD READS THE PALETTE'S OWN RAMP INSTEAD OF RESTATING IT. `m.m` reached the ground
       radial from 2.27, but the gilt ramp below and the seam were typed hexes, so a palette change
       never touched them and the card painted obsidian's gilt whatever the page was wearing. That is
       BTC's 2.17 `PAL` defect one tool along, and 2.42 is the release that would have made it visible:
       every one of these values moves in this release. `--field` joins them for the same reason one
       release later — it became sundial-written at 2.41 and this canvas kept the literal, so the card's
       ground sat at midnight while the page moved with the day. Resolved through the page exactly as
       `--sub` and `--bone` already are, with the fallback each token's own `:root` declaration carries,
       because jsdom resolves no custom property. */
    const tok = (k, f) => rs.getPropertyValue(k).trim() || f;
    return { lx, ly, elev, night, glow, sub: tok("--sub", "#1b1a22"), subHi: tok("--sub-hi", "#2c2a36"), subLo: tok("--sub-lo", "#0e0d13"), bone: tok("--bone", "#ece3d0"),
      field: tok("--field", "#09080d"), gilt: tok("--gilt-a", "#ffde00"), giltB: tok("--gilt-b", "#cf9a00"), giltC: tok("--gilt-c", "#704b00"), verdLo: tok("--verdigris-lo", "#126557") };
  }

  /* text engraved into the surface: dark cut toward the light, lit lip away from it */
  function engrave(ctx, text, x, y, L, color, size, weight = 400, gilt = false, italic = false) {
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
    ctx.fillStyle = `rgba(0,0,0,.9)`; ctx.fillText(text, x + L.lx * size * .05, y + L.ly * size * .05);
    ctx.fillStyle = `rgba(255,255,255,${(.4 * L.elev + .06).toFixed(3)})`; ctx.fillText(text, x - L.lx * size * .045, y - L.ly * size * .045);
    if (gilt) {
      const g = ctx.createLinearGradient(x, y - size, x + size * 2.5, y + size * .4);
      g.addColorStop(0, L.giltC); g.addColorStop(.35, L.giltB); g.addColorStop(.55, L.gilt); g.addColorStop(.75, L.giltB); g.addColorStop(1, L.giltC);
      ctx.fillStyle = g;
      if (L.night > 0) { ctx.shadowColor = "rgba(255,215,120,.7)"; ctx.shadowBlur = 10 * L.night; }
    } else {
      ctx.fillStyle = color;
      if (L.night > 0) { ctx.shadowColor = "rgba(255,230,170,.45)"; ctx.shadowBlur = 12 * L.night; }
    }
    ctx.fillText(text, x, y); ctx.shadowBlur = 0;
    return ctx.measureText(text).width;
  }

  function stone(ctx, x, y, w, h, v, s, L, m) {
    const c = VOWEL_COLORS[v] || "#777";
    /* under-light */
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = h * 1.1 * (L.glow + .2);
    ctx.fillStyle = hex2(c, .55 * (L.glow + .25)); rr(ctx, x - 3, y - 3, w + 6, h + 6, 6); ctx.fill(); ctx.restore();
    /* translucent body over the glass */
    ctx.fillStyle = hex2(c, s === 0 ? .62 : .8); rr(ctx, x, y, w, h, 4); ctx.fill();
    /* inner light + lip */
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, "rgba(255,255,255,.28)"); g.addColorStop(.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 4); ctx.stroke();
    /* sheen that follows the sun */
    const sx = x + w * .4 - L.lx * w * .18, sy = y + h * .35 - L.ly * h * .18;
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * .45); rg.addColorStop(0, `rgba(255,255,255,${(.55 * (.25 + .55 * L.elev * (1 - L.night))).toFixed(3)})`); rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg; rr(ctx, x + 2, y + 2, w - 4, h - 4, 3); ctx.fill();
    /* label */
    ctx.font = `400 ${Math.round(h * .5)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,.9)"; ctx.fillText(NAMES2[v] || v, x + w / 2, y + h / 2 + 1.2);
    ctx.fillStyle = "#fff8ec"; ctx.fillText(NAMES2[v] || v, x + w / 2, y + h / 2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    /* stress cut beneath */
    const mh = s === 1 ? 6 : s === 2 ? 4 : 1.5;
    ctx.fillStyle = s === 1 ? "#08070a" : L.subLo; rr(ctx, x, y + h + 4, w, mh, 1.5); ctx.fill();
    ctx.fillStyle = hex2(c, .45); ctx.fillRect(x, y + h + 4 + mh, w, 1);
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function slabFace(ctx, x, y, w, h, thick, L, m, heat) {
    /* cast shadow */
    const rake = 10 + 30 * (1 - L.elev);
    ctx.save(); ctx.shadowColor = `rgba(0,0,0,${(.45 + .3 * L.elev).toFixed(2)})`; ctx.shadowBlur = rake * 1.6; ctx.shadowOffsetX = -L.lx * rake; ctx.shadowOffsetY = -L.ly * rake + thick;
    ctx.fillStyle = L.subLo; rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.restore();
    /* edge */
    ctx.fillStyle = "#0b0a10"; rr(ctx, x, y + thick, w, h, 6); ctx.fill();
    /* face */
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, L.subHi); g.addColorStop(.45, L.sub); g.addColorStop(1, L.subLo);
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 6); ctx.fill();
    ctx.save(); rr(ctx, x, y, w, h, 6); ctx.clip();
    const rg = ctx.createRadialGradient(x + w * .9, y + h, 0, x + w * .9, y + h, w * .9); rg.addColorStop(0, hex2(m.mlo, .45)); rg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
    /* veins */
    const R = mulberry32(SESSION ^ 0x51ED27);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      let px = x - 20, py = y + h * (0.15 + R() * 0.7); ctx.beginPath(); ctx.moveTo(px, py);
      for (let k = 0; k < 5; k++) { const nx = px + (w + 40) / 5, ny = Math.max(y + 10, Math.min(y + h - 10, py + (R() - .5) * h * .5)); ctx.bezierCurveTo(px + (nx - px) * .35, py + (R() - .5) * 80, px + (nx - px) * .65, ny + (R() - .5) * 80, nx, ny); px = nx; py = ny; }
      ctx.strokeStyle = hex2(m.lo, .22); ctx.lineWidth = 5 + R() * 4; ctx.stroke(); ctx.strokeStyle = hex2(m.hi, .3); ctx.lineWidth = 1.2 + R() * 1.4; ctx.stroke();
    }
    /* specular band */
    const ang = Math.atan2(L.ly, L.lx) + Math.PI / 2;
    const sg = ctx.createLinearGradient(x + w / 2 - Math.cos(ang) * w, y + h / 2 - Math.sin(ang) * h, x + w / 2 + Math.cos(ang) * w, y + h / 2 + Math.sin(ang) * h);
    sg.addColorStop(0, `rgba(255,255,255,${(.16 * L.elev).toFixed(3)})`); sg.addColorStop(.3, "rgba(255,255,255,0)"); sg.addColorStop(1, `rgba(0,0,0,${(.3 * L.elev).toFixed(3)})`);
    ctx.fillStyle = sg; ctx.fillRect(x, y, w, h);
    if (heat > 0) { const hg = ctx.createLinearGradient(x + w, y, x + w * .4, y); hg.addColorStop(0, `rgba(255,110,30,${(.32 * heat).toFixed(2)})`); hg.addColorStop(.5, `rgba(255,150,50,${(.1 * heat).toFixed(2)})`); hg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = hg; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    /* bevel */
    ctx.strokeStyle = `rgba(255,255,255,${(.3 * L.elev + .06).toFixed(3)})`; ctx.lineWidth = 2; ctx.beginPath();
    if (L.ly > 0) { ctx.moveTo(x + 6, y + 1); ctx.lineTo(x + w - 6, y + 1); } else { ctx.moveTo(x + 6, y + h - 1); ctx.lineTo(x + w - 6, y + h - 1); }
    if (L.lx > 0) { ctx.moveTo(x + 1, y + 6); ctx.lineTo(x + 1, y + h - 6); } else { ctx.moveTo(x + w - 1, y + 6); ctx.lineTo(x + w - 1, y + h - 6); }
    ctx.stroke();
    ctx.strokeStyle = hex2(m.m, .3 * L.elev); ctx.lineWidth = 3; ctx.stroke();
  }

  /* lay one bar's three scripts inside a box; returns height used and word anchor positions */
  function layBar(ctx, bar, x, y, w, size, L, m, opts) {
    const stoneW = Math.round(size * 1.35), stoneH = Math.round(size * .95), gapW = Math.round(size * .32), gapS = 3, lineH = size * 1.32;
    /* text with wrapping, gilt for overrides, italic for uncut */
    let cx = x, cy = y + size, maxW = w;
    const space = size * .3;
    for (const wd of bar.field) {
      const italic = wd.source === "rule";
      ctx.font = `${italic ? "italic " : ""}400 ${size}px ${FONT}`;
      const ww = ctx.measureText(wd.word).width;
      if (cx + ww > x + maxW && cx > x) { cx = x; cy += lineH; }
      engrave(ctx, wd.word, cx, cy, L, italic ? "#9b9284" : L.bone, size, 400, wd.source === "override", italic);
      cx += ww + space;
    }
    /* stones, wrapped by word */
    let sx = x, sy = cy + size * .7; const anchors = {};
    const rowH = stoneH + 4 + 6 + 2 + Math.round(size * .55);
    for (const wd of bar.field) {
      const n = Math.max(1, wd.sylls.length), ww = n * stoneW + (n - 1) * gapS;
      if (sx + ww > x + w && sx > x) { sx = x; sy += rowH; }
      wd.sylls.forEach((s, i) => stone(ctx, sx + i * (stoneW + gapS), sy, stoneW, stoneH, s.v, s.s, L, m));
      anchors[clean2(wd.word)] = anchors[clean2(wd.word)] || []; anchors[clean2(wd.word)].push({ x: sx + ww / 2, y: sy + stoneH + 12 });
      sx += ww + gapW;
    }
    const bottom = sy + rowH;
    /* foot */
    ctx.font = `400 ${Math.round(size * .62)}px ${FONT}`; ctx.fillStyle = "#b7ad9c";
    const foot = `ends on ${NAMES2[bar.end.v] || "—"}${bar.end.coda ? " +" + bar.end.coda.toLowerCase() : ""}`;
    ctx.fillText(foot, x, bottom + size * .1);
    const right = [`${bar.syllables} syl`, bar.filler ? "filler landing" : null, opts.run ? `drone · ${opts.run.len} on ${NAMES2[opts.run.v]}` : null].filter(Boolean).join(" · ");
    ctx.textAlign = "right"; ctx.fillStyle = bar.filler || opts.run ? "#f0c36a" : "#b7ad9c"; ctx.fillText(right, x + w, bottom + size * .1); ctx.textAlign = "left";
    return { height: bottom + size * .55 - y, anchors, lastAnchor: Object.values(anchors).flat().slice(-1)[0] };
  }
  const clean2 = s => (s || "").toLowerCase().replace(/[^a-z']/g, "");

  function render({ reading, bars, format, palette, mark }) {
    const W = 1080, H = format === "story" ? 1920 : 1350;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); const L = light(); const m = PIGMENTS[palette] || PIGMENTS[OCCVM_PIGMENT_DEFAULT];
    /* ground */
    ctx.fillStyle = L.field; ctx.fillRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, -H * .1, 0, W / 2, -H * .1, H * .9); bg.addColorStop(0, hex2(m.m, .22)); bg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    /* binding strip */
    const bh = 92; const bg2 = ctx.createLinearGradient(0, 0, 0, bh); bg2.addColorStop(0, "#d9a866"); bg2.addColorStop(.45, "#8f6a35"); bg2.addColorStop(1, "#4f3a1c"); ctx.fillStyle = bg2; ctx.fillRect(0, 0, W, bh);
    ctx.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < W; i += 3) ctx.fillRect(i, 0, 1, bh);
    ctx.fillStyle = L.verdLo; ctx.fillRect(0, bh - 3, W, 3); ctx.fillStyle = "rgba(63,154,134,.6)"; ctx.fillRect(0, bh - 4, W, 1);
    ctx.font = `400 34px ${FONT}`; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillText("rhyme instrument", 49, 59); ctx.fillStyle = "#fff3da"; ctx.fillText("rhyme instrument", 48, 58);
    const sun = SUN.solar(new Date()); const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    ctx.font = `400 24px ${FONT}`; ctx.textAlign = "right"; ctx.fillStyle = "#e6d2ac";
    ctx.fillText(`${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · sun ${sun.elev >= 0 ? sun.elev.toFixed(0) + "°" : "set"} · ${dirs[Math.round(sun.az / 45) % 8]}`, W - 48, 58); ctx.textAlign = "left";
    /* slabs */
    const chosen = bars.map(i => reading.bars[i]).filter(Boolean);
    const single = chosen.length === 1;
    const margin = single ? 72 : 56, sw = W - margin * 2 - (single ? 0 : 36), gap = single ? 0 : 24;
    let y = bh + 80; const placed = [];
    const avail = H - y - 150;
    /* fit by type size, never by scaling the picture: measure on a scratch context */
    const scratch = document.createElement("canvas").getContext("2d");
    let size = single ? 72 : 36, pad, heights, total;
    const measure = () => { pad = Math.round(size * (single ? 1.1 : .8)); heights = chosen.map(b => layBar(scratch, b, 0, 0, sw - pad * 2, size, L, m, {}).height + pad * 2 + (single ? 6 + b.syllables * 1.6 : 4 + b.syllables * 1.1)); total = heights.reduce((a, b) => a + b + gap, 0) - gap; };
    measure(); while (total > avail && size > 26) { size -= 2; measure(); }
    const scale = total > avail ? avail / total : 1;
    if (single) y += Math.max(0, (avail - total) / 2 - 40);
    else y += Math.max(0, (avail - total) / 2);
    if (scale < 1) { ctx.save(); ctx.translate(margin, y); ctx.scale(scale, scale); ctx.translate(-margin, -y); }
    chosen.forEach((b, k) => {
      const thick = single ? 6 + b.syllables * 1.6 : 4 + b.syllables * 1.1;
      const run = reading.runs.find(r => r.bars.includes(b.i)); const flagged = reading.flagged.includes(b.i);
      const heat = flagged && run ? Math.min(1, (run.bars.indexOf(b.i) - reading.limit + 1) / Math.max(1, run.len - reading.limit)) : 0;
      const h = heights[k] - thick;
      slabFace(ctx, margin, y, sw, h, thick, L, m, heat);
      const lay = layBar(ctx, b, margin + pad, y + pad, sw - pad * 2, size, L, m, { run: flagged ? run : null });
      if (b.scheme && !single) { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = "#b7ad9c"; ctx.fillText(b.scheme, margin + sw + 14, y + 40); }
      if (b.filler) { ctx.save(); ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = 2; ctx.beginPath(); const cx0 = margin + sw * .62; ctx.moveTo(cx0, y + h + thick); [[-2, .88], [2, .79], [-1, .7], [4, .58], [1, .47], [7, .36], [4, .24], [10, .12], [8, 0]].forEach(([dx, t]) => ctx.lineTo(cx0 + dx * 4, y + h * t)); ctx.stroke(); ctx.restore(); }
      placed.push({ bar: b, anchors: lay.anchors, last: lay.lastAnchor, right: margin + sw });
      y += h + thick + (single ? 0 : 34);
    });
    /* threads across the block */
    if (!single) {
      const idx = new Map(placed.map(p => [p.bar.i, p]));
      const nearest = new Map();
      reading.edges.filter(e => e.scope === "terminal" && e.kind !== "loose" && idx.has(e.a) && idx.has(e.b)).forEach(e => { if (!nearest.has(e.b) || nearest.get(e.b).a < e.a) nearest.set(e.b, e); });
      const shown = [...nearest.values(), ...reading.edges.filter(e => e.scope === "internal" && idx.has(e.a) && idx.has(e.b))];
      for (const e of shown) {
        const A = idx.get(e.a), B = idx.get(e.b); if (!A || !B) continue;
        const pa = (e.scope === "terminal" || e.a !== e.b) ? A.last : (A.anchors[clean2(e.words[0])] || [])[0];
        const pb = (e.scope === "terminal" || e.a === e.b) ? B.last : (B.anchors[clean2(e.words[1])] || [])[0];
        if (!pa || !pb) continue;
        ctx.beginPath();
        if (e.a === e.b) { const dip = 16 + Math.abs(pb.x - pa.x) * .08; ctx.moveTo(pa.x, pa.y); ctx.bezierCurveTo(pa.x, pa.y + dip, pb.x, pb.y + dip, pb.x, pb.y); }
        else { const gx = A.right + 22 + Math.min(40, Math.abs(pb.y - pa.y) * .06); ctx.moveTo(pa.x, pa.y); ctx.bezierCurveTo(gx, pa.y, gx, pb.y, pb.x, pb.y); }
        ctx.lineCap = "round"; ctx.setLineDash(e.kind === "loose" ? [6, 8] : []);
        ctx.strokeStyle = hex2(m.lo, e.kind === "loose" ? .3 : .55); ctx.lineWidth = e.kind === "perfect" ? 9 : e.kind === "slant" ? 6 : 4; ctx.stroke();
        ctx.strokeStyle = hex2(m.hi, e.kind === "perfect" ? .95 : e.kind === "slant" ? .8 : .65); ctx.lineWidth = e.kind === "perfect" ? 3 : e.kind === "slant" ? 2 : 1.6; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (scale < 1) ctx.restore();
    /* mark */
    ctx.font = `400 26px ${FONT}`; ctx.fillStyle = "#8a8378"; ctx.fillText(mark || "@theghostcodex", 48, H - 56);
    ctx.textAlign = "right"; ctx.fillStyle = "#6b6674"; ctx.fillText("ghost codex · rhyme instrument", W - 48, H - 56); ctx.textAlign = "left";
    return cv;
  }
  async function share(canvas, name) {
    const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    const file = new File([blob], name + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".png"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return "downloaded";
  }
  return { render, share };
})();
