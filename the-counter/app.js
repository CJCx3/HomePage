/* ══════════════════════════  THE COUNTER — app core  ══════════════════════════
   State, the ticket rail, tap-to-serve, add-by-hand, phone-local persistence.
   Scan → capture → divider → review flow lives in scan.js / lib/ocr.js and calls
   commitList() when the user confirms the read. */

const STORE_KEY = "thecounter.v1";

const state = {
  items: [],        // {id, num, name, meta, done}
  chores: [],       // isolated, not interactive (kept for the record only)
  seq: 0,           // ticket-number sequence
  servedOpen: false,
};

/* ────────────────────────────  persistence  ──────────────────────────── */
function save(){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify({
      items: state.items, chores: state.chores, seq: state.seq,
    }));
  }catch(e){ /* private mode / quota — stay in-memory */ }
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    state.items  = Array.isArray(d.items)  ? d.items  : [];
    state.chores = Array.isArray(d.chores) ? d.chores : [];
    state.seq    = Number.isFinite(d.seq)  ? d.seq    : state.items.length;
  }catch(e){ /* ignore corrupt store */ }
}

/* ────────────────────────────  list model  ───────────────────────────── */
const pad2 = n => String(n).padStart(2, "0");
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function makeItem(name, meta){
  state.seq += 1;
  return { id: uid(), num: state.seq, name: name.trim(), meta: (meta||"").trim(), done:false };
}

/* Replace the whole shopping list (scan-replaces-list). chores kept aside. */
function commitList(shopping, chores){
  state.seq = 0;
  state.items  = shopping.map(s => makeItem(typeof s === "string" ? s : s.name, s.meta));
  state.chores = (chores||[]).map(c => (typeof c === "string" ? c : c.name)).filter(Boolean);
  state.servedOpen = false;
  save(); render();
}

function addItem(name){
  if(!name || !name.trim()) return;
  state.items.push(makeItem(name));
  save(); render();
}

function markDone(id, done){
  const it = state.items.find(i => i.id === id);
  if(!it) return;
  it.done = done;
  save();
}

/* ────────────────────────────  rendering  ────────────────────────────── */
const el = sel => document.querySelector(sel);
const rail        = el("#rail");
const emptyState  = el("#emptyState");
const servedWrap  = el("#served");
const servedList  = el("#servedList");
const servedCount = el("#servedCount");
const servedToggle= el("#servedToggle");
const tally       = el("#tally");
const tallyNum    = el("#tallyNum");
const tallyLabel  = el("#tallyLabel");

const CHK = `<svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
  <circle class="ring" cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
  <path class="tick" d="M9.5 15.5l3.5 3.5 7.5-8.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function activeTicket(it, serving){
  const t = document.createElement("article");
  t.className = "ticket" + (serving ? " is-serving" : "");
  t.dataset.id = it.id;
  t.innerHTML =
    `<span class="flag"><span class="flag__dot"></span>Now serving</span>` +
    `<div class="ticket__stub"><span class="ticket__num">${pad2(it.num)}</span></div>` +
    `<div class="ticket__body"><span class="ticket__name">${escapeHtml(it.name)}</span>` +
      (it.meta ? `<span class="ticket__meta">${escapeHtml(it.meta)}</span>` : ``) +
    `</div>` +
    `<button class="ticket__check" aria-label="Mark ${escapeAttr(it.name)} as got">${CHK}</button>` +
    `<div class="stamp"><span>Got it</span></div>`;
  t.querySelector(".ticket__check").addEventListener("click", () => serveTicket(it.id, t));
  return t;
}

function servedTicket(it){
  const t = document.createElement("article");
  t.className = "ticket ticket--served";
  t.dataset.id = it.id;
  t.innerHTML =
    `<div class="ticket__stub"><span class="ticket__num">${pad2(it.num)}</span></div>` +
    `<div class="ticket__body"><span class="ticket__name">${escapeHtml(it.name)}</span></div>` +
    `<span class="badge-got">Got</span>` +
    `<button class="undo" aria-label="Put ${escapeAttr(it.name)} back on the rail">Put&nbsp;back</button>`;
  t.querySelector(".undo").addEventListener("click", () => { markDone(it.id, false); render(); });
  return t;
}

function render(){
  const active = state.items.filter(i => !i.done);
  const done   = state.items.filter(i =>  i.done);

  // empty vs rail
  const isEmpty = state.items.length === 0;
  emptyState.hidden = !isEmpty;
  rail.hidden = isEmpty;

  // rail (NOW SERVING = first active)
  rail.replaceChildren();
  active.forEach((it, i) => rail.appendChild(activeTicket(it, i === 0)));

  // tally
  tally.hidden = isEmpty;
  tallyNum.textContent = active.length;
  tallyLabel.innerHTML = active.length ? "to&nbsp;go" : "all&nbsp;set";

  // served drawer
  servedWrap.hidden = done.length === 0;
  servedCount.textContent = done.length;
  servedList.hidden = !state.servedOpen;
  servedToggle.setAttribute("aria-expanded", String(state.servedOpen));
  servedList.replaceChildren();
  done.forEach(it => servedList.appendChild(servedTicket(it)));
}

/* tap-to-serve: stamp + flip, then commit */
function serveTicket(id, node){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){ markDone(id, true); render(); return; }
  node.classList.add("is-serving-anim");
  let moved = false;
  const finish = () => { if(moved) return; moved = true; markDone(id, true); render(); };
  // wait for the ticket's own flip to finish — the child stamp's animationend bubbles up first
  node.addEventListener("animationend", e => { if(e.animationName === "flip-away") finish(); });
  setTimeout(finish, 640); // safety net if animationend is missed
}

/* ────────────────────────────  add sheet  ────────────────────────────── */
const addSheet  = el("#addSheet");
const addForm   = el("#addForm");
const addInput  = el("#addInput");

function openAdd(){ addSheet.hidden = false; setTimeout(() => addInput.focus(), 60); }
function closeAdd(){ addSheet.hidden = true; addInput.value = ""; }

addForm.addEventListener("submit", e => { e.preventDefault(); const v = addInput.value; closeAdd(); addItem(v); });
el("#addCancel").addEventListener("click", closeAdd);
addSheet.addEventListener("click", e => { if(e.target === addSheet) closeAdd(); });

/* ────────────────────────────  wiring  ───────────────────────────────── */
el("#addBtn").addEventListener("click", openAdd);
servedToggle.addEventListener("click", () => { state.servedOpen = !state.servedOpen; render(); });
el("#scanBtn").addEventListener("click", () => {
  if(window.Scan && typeof window.Scan.start === "function") window.Scan.start();
  else openAdd(); // graceful fallback before scan.js loads
});

/* expose for the scan/review flow */
window.Counter = { commitList, addItem, state };

/* ────────────────────────────  helpers  ──────────────────────────────── */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }

/* ────────────────────────────  boot  ─────────────────────────────────── */
load();

// design/demo data only when explicitly requested; never ships in the real list
if(location.search.includes("demo") && state.items.length === 0){
  state.seq = 0;
  ["Whole milk","Sourdough loaf","Ripe avocados","Free-range eggs","Sharp cheddar",
   "Roma tomatoes","Ground coffee","Baby spinach"].forEach(n => state.items.push(makeItem(n)));
  state.items[0].meta = "dairy";
  state.items[2].meta = "produce";
  // pre-serve a couple to show the drawer
  state.items[4].done = true; state.items[6].done = true;
  state.chores = ["Take out recycling","Vacuum living room","Water the plants"];
}

render();

/* service worker for offline */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
