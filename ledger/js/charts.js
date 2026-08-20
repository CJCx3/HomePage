/* ══════════════════════════════════════════════════════════════════════════
   Ledger · charts.js — dependency-free SVG charts.
   All return HTML strings. Colors come from CSS custom props via inline style,
   so they re-theme automatically in light/dark.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const L = (window.L = window.L || {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ── donut: segments [{value,color,label}] ── */
  function donut(segments, opts) {
    opts = opts || {};
    const size = 160, r = 62, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, sw = 22;
    const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
    let off = 0;
    let arcs = "";
    if (total <= 0) {
      arcs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:var(--track)"/>`;
    } else {
      segments.forEach((seg) => {
        const frac = Math.max(0, seg.value) / total;
        if (frac <= 0) return;
        const len = frac * C;
        arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" stroke-linecap="butt"><title>${esc(seg.label || "")}</title></circle>`;
        off += len;
      });
    }
    const center = opts.center
      ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut__big">${esc(opts.center)}</text>
         <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut__sub">${esc(opts.sub || "")}</text>`
      : "";
    return `<svg viewBox="0 0 ${size} ${size}" class="chart chart--donut" role="img" aria-label="${esc(opts.aria || "Breakdown")}">
      <g transform="rotate(-90 ${cx} ${cy})">${arcs}</g>${center}</svg>`;
  }

  /* ── grouped bars: data [{label, income, expense}] ── */
  function incomeExpenseBars(data, opts) {
    opts = opts || {};
    const W = Math.max(320, data.length * 62), H = 190, padB = 26, padT = 12, padL = 6, padR = 6;
    const plotH = H - padB - padT;
    const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
    const groupW = (W - padL - padR) / data.length;
    const barW = Math.min(16, groupW / 3.2);
    let bars = "", labels = "";
    data.forEach((d, i) => {
      const gx = padL + i * groupW + groupW / 2;
      const ih = (d.income / max) * plotH, eh = (d.expense / max) * plotH;
      const iy = padT + plotH - ih, ey = padT + plotH - eh;
      bars += `<rect x="${gx - barW - 2}" y="${iy}" width="${barW}" height="${Math.max(0, ih)}" rx="3" style="fill:var(--pos)"><title>${esc(d.label)} income: ${L.money.fmt(d.income)}</title></rect>`;
      bars += `<rect x="${gx + 2}" y="${ey}" width="${barW}" height="${Math.max(0, eh)}" rx="3" style="fill:var(--neg)"><title>${esc(d.label)} spending: ${L.money.fmt(d.expense)}</title></rect>`;
      labels += `<text x="${gx}" y="${H - 8}" text-anchor="middle" class="axis">${esc(d.label)}</text>`;
    });
    // baseline
    const base = padT + plotH;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart chart--bars" role="img" aria-label="Income versus spending by month">
      <line x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" class="axisline"/>${bars}${labels}</svg>`;
  }

  /* ── line: points [{label, value(cents)}] ── */
  function line(points, opts) {
    opts = opts || {};
    const W = Math.max(320, points.length * 54), H = 180, padB = 24, padT = 14, padL = 8, padR = 10;
    const plotH = H - padB - padT, plotW = W - padL - padR;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals, 0), max = Math.max(...vals, 1);
    if (min === max) max = min + 1;
    const x = (i) => padL + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v) => padT + plotH - ((v - min) / (max - min)) * plotH;
    let d = "", area = "", dots = "", labels = "";
    points.forEach((p, i) => {
      const px = x(i), py = y(p.value);
      d += (i ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1) + " ";
      dots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" style="fill:var(--accent)"><title>${esc(p.label)}: ${L.money.fmt(p.value)}</title></circle>`;
      if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0)
        labels += `<text x="${px.toFixed(1)}" y="${H - 6}" text-anchor="middle" class="axis">${esc(p.label)}</text>`;
    });
    area = d + `L${x(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
    const zeroY = y(0);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart chart--line" role="img" aria-label="Net worth trend">
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" class="axisline"/>
      <path d="${area}" class="area"/>
      <path d="${d}" fill="none" class="spark" style="stroke:var(--accent)"/>
      ${dots}${labels}</svg>`;
  }

  /* ── small progress ring 0..1 (over>1 tints red) ── */
  function ring(frac, opts) {
    opts = opts || {};
    const size = opts.size || 40, r = size / 2 - 4, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, sw = opts.sw || 5;
    const over = frac > 1;
    const p = Math.max(0, Math.min(1, frac));
    const len = p * C;
    const color = over ? "var(--neg)" : opts.color || "var(--accent)";
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ring">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:var(--track)"/>
      <g transform="rotate(-90 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:${color}" stroke-dasharray="${len} ${C - len}" stroke-linecap="round"/></g>
    </svg>`;
  }

  /* ── horizontal meter used in budget/category rows ── */
  function meter(frac, over) {
    const p = Math.max(0, Math.min(1, frac)) * 100;
    const cls = over ? "meter__fill meter__fill--over" : frac > 0.85 ? "meter__fill meter__fill--warn" : "meter__fill";
    return `<div class="meter"><div class="${cls}" style="width:${p}%"></div></div>`;
  }

  L.charts = { donut, incomeExpenseBars, line, ring, meter };
})();
