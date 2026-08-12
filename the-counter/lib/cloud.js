/* ══════════════════════════  Smart reader — Google Gemini (free tier)  ══════════════════════════
   Reads a photo of the fridge board with a vision model and returns
   { grocery:[], chores:[] } — it handles glare, handwriting, the printed grid,
   and it splits the two columns itself. Key is stored locally (entered in
   Settings); the image is sent to Google to be read. On any failure the scan
   flow falls back to the fully on-device reader.

   Model is auto-discovered from the key (different free-tier keys expose
   different model names), then cached, so we never hard-code one that 404s. */
(function () {
  "use strict";
  const KEY_STORE   = "thecounter.geminiKey";
  const MODEL_STORE = "thecounter.geminiModel";
  const BASE = "https://generativelanguage.googleapis.com/v1beta";
  // preference order when the key offers several — newest & cheapest vision flash first
  const PREFERRED = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-1.5-flash", "gemini-flash-latest"];

  function getKey()    { try { return (localStorage.getItem(KEY_STORE) || "").trim(); } catch (e) { return ""; } }
  function setKey(k)   { try { localStorage.setItem(KEY_STORE, (k || "").trim()); } catch (e) {} }
  function clearKey()  { try { localStorage.removeItem(KEY_STORE); localStorage.removeItem(MODEL_STORE); } catch (e) {} }
  function hasKey()    { return !!getKey(); }
  function getModel()  { try { return localStorage.getItem(MODEL_STORE) || ""; } catch (e) { return ""; } }
  function setModel(m) { try { localStorage.setItem(MODEL_STORE, m); } catch (e) {} }
  function clearModel(){ try { localStorage.removeItem(MODEL_STORE); } catch (e) {} }

  const PROMPT =
`You are extracting items from a photo of a dry-erase list board (usually on a fridge).
It typically has two columns: a chores column on the left and a grocery/shopping list on the right,
with pre-printed ruled lines and empty checkboxes.

Return ONLY the words a person actually handwrote:
- IGNORE the pre-printed column headers (e.g. "Chores", "Grocery List"), the checkboxes, the ruled
  lines, blank rows, glare and reflections.
- Put grocery/shopping items in "grocery" and household tasks in "chores".
- Fix obvious misspellings from messy handwriting to the most likely intended word.
- If the board is not clearly two columns, put every readable handwritten item in "grocery" and leave "chores" empty.
- If nothing is readable, return empty arrays.

Respond as JSON: {"grocery": string[], "chores": string[]}.`;

  function toJpegBase64(canvas, maxDim, quality) {
    maxDim = maxDim || 1600; quality = quality || 0.85;
    const md = Math.max(canvas.width, canvas.height) || 1;
    const s = Math.min(1, maxDim / md);
    const w = Math.max(1, Math.round(canvas.width * s)), h = Math.max(1, Math.round(canvas.height * s));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(canvas, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality).split(",")[1];
  }

  function friendlyError(status, text) {
    if (status === 400 && /API[_ ]?key not valid|API_KEY_INVALID/i.test(text)) return new Error("BAD_KEY");
    if (status === 401 || status === 403) return new Error("BAD_KEY");
    if (status === 429) return new Error("QUOTA");
    return new Error("HTTP_" + status);
  }

  const NEG = /(embedding|aqa|vision|imagen|image-generation|tts|audio|thinking|-exp|experimental|learnlm|gemma)/i;

  function orderCandidates(names) {
    const score = n => {
      const pi = PREFERRED.indexOf(n);
      if (pi >= 0) return pi;                 // preferred, in order
      if (/flash/i.test(n)) return 100;       // then any other flash
      return 200;                              // then anything else
    };
    return names.slice().sort((a, b) => score(a) - score(b));
  }

  /* every model this key can call for generateContent, best-first */
  async function listGenModels(key) {
    let res;
    try { res = await fetch(BASE + "/models?pageSize=1000", { headers: { "x-goog-api-key": key } }); }
    catch (e) { throw new Error("OFFLINE"); }
    if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ""));
    const data = await res.json();
    const names = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => (m.name || "").replace(/^models\//, ""))
      .filter(n => n && !NEG.test(n));
    return orderCandidates(names);
  }

  async function generate(body) {
    const key = getKey();
    if (!key) throw new Error("NO_KEY");
    const order = [];
    const cached = getModel();
    if (cached) order.push(cached);
    let discovered = [];
    try { discovered = await listGenModels(key); }
    catch (e) { if (!cached) throw e; }        // tolerate a list failure only if we have a cached model
    discovered.forEach(m => { if (!order.includes(m)) order.push(m); });
    if (!order.length) throw new Error("NO_MODEL");

    for (const model of order) {
      let res;
      try {
        res = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
        });
      } catch (e) { throw new Error("OFFLINE"); }
      if (res.status === 404) continue;                 // this model isn't callable — try the next
      if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ""));
      setModel(model);
      return res.json();
    }
    clearModel();
    throw new Error("NO_MODEL");
  }

  /* what does this key actually expose? used by the Test button when things fail */
  async function diagnose() {
    const key = getKey();
    if (!key) return { ok: false, msg: "no key" };
    let models;
    try { models = await listGenModels(key); }
    catch (e) { return { ok: false, msg: "list=" + (e.message || "err") }; }
    const tried = [];
    for (const m of models.slice(0, 8)) {
      let r;
      try {
        r = await fetch(`${BASE}/models/${m}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
        });
      } catch (e) { tried.push(m + "=net"); continue; }
      tried.push(m + "=" + r.status);
      if (r.ok) return { ok: true, model: m, count: models.length };
    }
    return { ok: false, count: models.length, tried };
  }

  /* readBoard(canvas) -> { grocery:[], chores:[] } */
  async function readBoard(canvas) {
    const body = {
      contents: [{ parts: [
        { text: PROMPT },
        { inlineData: { mimeType: "image/jpeg", data: toJpegBase64(canvas) } },
      ] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            grocery: { type: "ARRAY", items: { type: "STRING" } },
            chores:  { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["grocery", "chores"],
        },
      },
    };
    const data = await generate(body);
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = (parts || []).map(p => p.text || "").join("").trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error("BAD_RESPONSE"); }
    const clean = a => Array.isArray(a) ? a.map(s => String(s).trim()).filter(Boolean) : [];
    return { grocery: clean(parsed.grocery), chores: clean(parsed.chores) };
  }

  /* verify a key works (used by the Settings "Test" button) — also resolves the model */
  async function test() {
    const c = document.createElement("canvas"); c.width = 16; c.height = 16;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 16, 16);
    x.fillStyle = "#000"; x.font = "10px sans-serif"; x.fillText("ok", 1, 11);
    await readBoard(c);
    return getModel() || true;
  }

  window.Cloud = { getKey, setKey, clearKey, hasKey, readBoard, test, diagnose, getModel, resetModel: clearModel };
})();
