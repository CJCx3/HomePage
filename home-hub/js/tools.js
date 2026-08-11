/* ═══════════════════════════════════════
   TOOLS.JS — Calculator, Unit Converter, Color Tool
   ═══════════════════════════════════════ */

/* ─── CALCULATOR ─── */
let _cExpr = '', _cHistory = [];

function calculatorInit() {
  _cHistory = HUB.get('calcHistory', []);
  renderCalcHistory();
}

function cPress(v) {
  _cExpr += v;
  const expr = document.getElementById('calc-expr');
  if (expr) expr.textContent = _cExpr;
}
function cClear() {
  _cExpr = '';
  document.getElementById('calc-expr') && (document.getElementById('calc-expr').textContent = '');
  document.getElementById('calc-result') && (document.getElementById('calc-result').textContent = '0');
}
function cBack() {
  _cExpr = _cExpr.slice(0, -1);
  document.getElementById('calc-expr') && (document.getElementById('calc-expr').textContent = _cExpr);
}
function cEval() {
  if (!_cExpr) return;
  try {
    const result = Function('"use strict"; return (' + _cExpr + ')')();
    const rounded = +result.toFixed(10);
    document.getElementById('calc-result') && (document.getElementById('calc-result').textContent = rounded);
    // History
    _cHistory.unshift({ expr: _cExpr, result: rounded, time: Date.now() });
    _cHistory = _cHistory.slice(0, 20);
    HUB.set('calcHistory', _cHistory);
    renderCalcHistory();
    _cExpr = String(rounded);
    document.getElementById('calc-expr') && (document.getElementById('calc-expr').textContent = _cExpr);
  } catch {
    document.getElementById('calc-result') && (document.getElementById('calc-result').textContent = 'Error');
  }
}
function calcPercent() { _cExpr += '/100'; cEval(); }
function calcSqrt()    { _cExpr = `Math.sqrt(${_cExpr || 0})`; cEval(); }
function renderCalcHistory() {
  const el = document.getElementById('calc-history');
  if (!el) return;
  if (!_cHistory.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.8rem;text-align:center;padding:10px;">No history yet</div>'; return; }
  el.innerHTML = _cHistory.slice(0,8).map(h => `
    <div onclick="useCalcHistory('${h.result}')" style="display:flex;justify-content:space-between;padding:7px 10px;border-radius:9px;cursor:pointer;transition:background .12s;" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span style="color:var(--muted);font-size:.78rem;">${HUB.esc(String(h.expr))}</span>
      <span style="font-family:monospace;font-size:.88rem;">${h.result}</span>
    </div>`).join('');
}
function useCalcHistory(val) { _cExpr = String(val); document.getElementById('calc-expr') && (document.getElementById('calc-expr').textContent = _cExpr); }

/* ─── KEYBOARD FOR CALCULATOR ─── */
document.addEventListener('keydown', e => {
  const focus = document.activeElement?.tagName;
  if (focus === 'INPUT' || focus === 'TEXTAREA' || focus === 'SELECT') return;
  if (!document.getElementById('tab-tools')?.classList.contains('active')) return;
  if ('0123456789.+-*/()'.includes(e.key)) { cPress(e.key); e.preventDefault(); }
  else if (e.key === 'Enter') { cEval(); e.preventDefault(); }
  else if (e.key === 'Backspace') { cBack(); e.preventDefault(); }
  else if (e.key === 'Escape') { cClear(); }
});

/* ─── UNIT CONVERTER ─── */
const _UNITS = {
  len:  { km:1000, m:1, cm:.01, mm:.001, mi:1609.34, ft:.3048, in:.0254, yd:.9144 },
  wt:   { kg:1, g:.001, lb:.453592, oz:.0283495, t:1000, st:6.35029 },
  area: { km2:1e6, m2:1, cm2:.0001, ft2:.0929, acre:4046.86, ha:1e4 },
  vol:  { L:1, mL:.001, gal:3.78541, qt:.946353, pt:.473176, cup:.236588, floz:.0295735 },
  speed:{ mph:1, kph:1.60934, ms:3.6, knot:1.85200, fps:.681818 },
  data: { B:1, KB:1024, MB:1048576, GB:1073741824, TB:1099511627776 },
};
const _UNIT_LABELS = {
  len:  ['km','m','cm','mm','mi','ft','in','yd'],
  wt:   ['kg','g','lb','oz','t','st'],
  area: ['km2','m2','cm2','ft2','acre','ha'],
  vol:  ['L','mL','gal','qt','pt','cup','floz'],
  speed:['mph','kph','ms','knot','fps'],
  data: ['B','KB','MB','GB','TB'],
  temp: ['°C','°F','K'],
};

function converterInit() { convCatChange(); }

function convCatChange() {
  const cat  = document.getElementById('conv-cat')?.value || 'len';
  const opts = (_UNIT_LABELS[cat] || []).map(u => `<option value="${u}">${u}</option>`).join('');
  const from = document.getElementById('conv-from'); if (from) from.innerHTML = opts;
  const to   = document.getElementById('conv-to');   if (to) { to.innerHTML = opts; to.selectedIndex = 1; }
  convert();
}

function convert() {
  const cat  = document.getElementById('conv-cat')?.value || 'len';
  const from = document.getElementById('conv-from')?.value;
  const to   = document.getElementById('conv-to')?.value;
  const val  = parseFloat(document.getElementById('conv-val')?.value);
  if (isNaN(val)) { document.getElementById('conv-result') && (document.getElementById('conv-result').textContent = '—'); return; }
  let r;
  if (cat === 'temp') {
    let c = from === '°C' ? val : from === '°F' ? (val-32)*5/9 : val-273.15;
    r = to === '°C' ? c : to === '°F' ? c*9/5+32 : c+273.15;
  } else {
    const u = _UNITS[cat]; if (!u) return;
    r = val * u[from] / u[to];
  }
  const fmt = Math.abs(r) < 0.0001 || Math.abs(r) > 1e9 ? r.toExponential(4) : (+r.toFixed(6)).toLocaleString();
  document.getElementById('conv-result') && (document.getElementById('conv-result').textContent = fmt + ' ' + to);
}

/* ─── COLOR TOOL ─── */
function colorToolInit() { colorUp('#38bdf8'); }

function colorUp(hex) {
  const el = document.getElementById('cpick'); if (el) el.value = hex;
  const sw = document.getElementById('color-swatch'); if (sw) sw.style.background = hex;

  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const hsl = _toHsl(r,g,b);
  const hslStr = `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
  const rgbStr = `rgb(${r}, ${g}, ${b})`;
  // Complementary color
  const compR = 255-r, compG = 255-g, compB = 255-b;
  const compHex = '#' + [compR,compG,compB].map(x => x.toString(16).padStart(2,'0')).join('');

  const info = document.getElementById('color-info');
  if (!info) return;
  info.innerHTML = [['HEX', hex], ['RGB', rgbStr], ['HSL', hslStr]].map(([l,v]) => `
    <div class="color-row">
      <span class="color-lbl">${l}</span>
      <span class="color-val">${v}</span>
      <button class="btn btn-secondary btn-xs" onclick="navigator.clipboard.writeText('${v}');HUB.toast('${l} copied!','success')">📋</button>
    </div>`).join('') +
    `<div style="margin-top:10px;font-size:.8rem;color:var(--muted);font-weight:700;">Complementary</div>
     <div style="height:36px;border-radius:10px;background:${compHex};border:1px solid var(--border);margin-top:6px;cursor:pointer;" onclick="colorUp('${compHex}')" title="Click to use ${compHex}"></div>`;
}

function _toHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);
  switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h/=6;}
  return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}

/* ─── COPY SHARE PATH ─── */
function copyShare() {
  navigator.clipboard.writeText('\\\\SERVER');
  HUB.toast('\\\\SERVER copied to clipboard ✔', 'success');
}
