/* ══════════════════════════  THE COUNTER — scan flow  ══════════════════════════
   Capture a photo → drag a divider to split chores from shopping → read each side
   on-device (lib/ocr.js) → review & fix → commit. Calls window.Counter.commitList().
   All processing is local; nothing leaves the phone. */
(function () {
  "use strict";

  const app        = document.getElementById("app");
  const vList       = document.getElementById("view-list");
  const vDivider    = document.getElementById("view-divider");
  const vReview     = document.getElementById("view-review");

  // divider + source state
  let srcCanvas = null;         // full-resolution source image
  let natW = 0, natH = 0;
  let dispScale = 1;            // displayed px per natural px
  const dv = { orient: "v", frac: 0.5, shopSide: "b", noChores: false };

  /* ───────────────────────────  helpers  ─────────────────────────── */
  function h(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === "class") n.className = props[k];
      else if (k === "html") n.innerHTML = props[k];
      else if (k.startsWith("on") && typeof props[k] === "function") n.addEventListener(k.slice(2), props[k]);
      else if (props[k] != null) n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  function show(view) {
    [vList, vDivider, vReview].forEach(v => { v.hidden = v !== view; });
    app.dataset.view = view === vList ? "list" : view === vDivider ? "divider" : "review";
    window.scrollTo(0, 0);
  }

  const SVG_BACK  = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const SVG_PLUS  = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const SVG_X     = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const SVG_SWAP  = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 8h11l-3-3M17 16H6l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ───────────────────────────  1. capture  ─────────────────────────── */
  const fileInput = h("input", { type: "file", accept: "image/*", class: "sr-only",
    onchange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) loadPhoto(f); } });
  document.body.appendChild(fileInput);

  function start() { fileInput.click(); }

  async function loadPhoto(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      bmp = await new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej;
        im.src = URL.createObjectURL(file);
      });
    }
    natW = bmp.width || bmp.naturalWidth;
    natH = bmp.height || bmp.naturalHeight;
    srcCanvas = document.createElement("canvas");
    srcCanvas.width = natW; srcCanvas.height = natH;
    srcCanvas.getContext("2d").drawImage(bmp, 0, 0, natW, natH);
    dv.orient = natW >= natH ? "v" : "v";   // default vertical split (chores | shopping)
    dv.frac = 0.5; dv.shopSide = "b"; dv.noChores = false;
    renderDivider();
    show(vDivider);
  }

  /* ───────────────────────────  2. divider  ─────────────────────────── */
  function renderDivider() {
    // fit the image into the available stage box
    const maxW = Math.min(window.innerWidth - 32, 640);
    const maxH = window.innerHeight - 250;
    dispScale = Math.min(maxW / natW, maxH / natH, 1.4);
    const dw = Math.round(natW * dispScale), dh = Math.round(natH * dispScale);

    const canvas = h("canvas", { id: "dvCanvas", width: dw, height: dh, class: "dv__canvas" });
    canvas.getContext("2d").drawImage(srcCanvas, 0, 0, dw, dh);

    const zoneA = h("div", { class: "dv__zone dv__zone--a" }, [h("span", { class: "dv__tag" })]);
    const zoneB = h("div", { class: "dv__zone dv__zone--b" }, [h("span", { class: "dv__tag" })]);
    const handle = h("div", { class: "dv__handle", id: "dvHandle" }, [h("span", { class: "dv__grip" })]);

    const stage = h("div", { class: "dv__stage", id: "dvStage", style: `width:${dw}px;height:${dh}px` },
      [canvas, zoneA, zoneB, handle]);

    const controls = h("div", { class: "dv__controls" }, [
      pill("Split", [
        segBtn("Left / right", () => dv.orient === "v", () => { dv.orient = "v"; layout(); }),
        segBtn("Top / bottom", () => dv.orient === "h", () => { dv.orient = "h"; layout(); }),
      ]),
      h("div", { class: "dv__row" }, [
        h("button", { class: "chip-btn", onclick: () => { dv.shopSide = dv.shopSide === "b" ? "a" : "b"; layout(); },
          html: SVG_SWAP + "<span>Swap sides</span>" }),
        h("label", { class: "chip-check" }, [
          h("input", { type: "checkbox", onchange: e => { dv.noChores = e.target.checked; layout(); } }),
          h("span", {}, ["No chores — all shopping"]),
        ]),
      ]),
    ]);

    vDivider.replaceChildren(
      topbar("Split the chart", cancelToList, "Point the divider so chores sit on one side, groceries on the other."),
      stage,
      controls,
      h("div", { class: "flow-cta" }, [
        h("button", { class: "btn btn--scan btn--wide", onclick: runRead, html:
          `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Read the list</span>` }),
      ]),
    );
    dragBind(handle, stage);
    layout();
    refreshSeg();
  }

  function layout() {
    const stage = document.getElementById("dvStage");
    if (!stage) return;
    const a = stage.querySelector(".dv__zone--a"), b = stage.querySelector(".dv__zone--b");
    const handle = stage.querySelector(".dv__handle");
    const tagA = a.querySelector(".dv__tag"), tagB = b.querySelector(".dv__tag");
    stage.dataset.orient = dv.orient;
    stage.classList.toggle("is-nochores", dv.noChores);

    // "No chores": the whole photo is shopping — zone B covers everything.
    if (dv.noChores) {
      handle.style.display = "none";
      a.style.cssText = "left:0;right:0;top:0;bottom:0"; a.style.opacity = "0";
      b.style.cssText = "left:0;right:0;top:0;bottom:0";
      a.classList.remove("is-shop", "is-chore");
      b.classList.add("is-shop"); b.classList.remove("is-chore");
      tagA.textContent = ""; tagB.textContent = "Shopping";
      return;
    }

    handle.style.display = ""; a.style.opacity = "";
    const pct = (dv.frac * 100).toFixed(1) + "%";
    if (dv.orient === "v") {
      a.style.cssText = `left:0;top:0;bottom:0;width:${pct}`;
      b.style.cssText = `right:0;top:0;bottom:0;left:${pct}`;
      handle.style.cssText = `left:${pct};top:0;bottom:0;width:3px;transform:translateX(-50%)`;
    } else {
      a.style.cssText = `left:0;right:0;top:0;height:${pct}`;
      b.style.cssText = `left:0;right:0;bottom:0;top:${pct}`;
      handle.style.cssText = `top:${pct};left:0;right:0;height:3px;transform:translateY(-50%)`;
    }
    const shopIsB = dv.shopSide === "b";
    tagA.textContent = shopIsB ? "Chores" : "Shopping";
    tagB.textContent = shopIsB ? "Shopping" : "Chores";
    a.classList.toggle("is-shop", !shopIsB);
    b.classList.toggle("is-shop", shopIsB);
    a.classList.toggle("is-chore", shopIsB);
    b.classList.toggle("is-chore", !shopIsB);
  }

  function dragBind(handle, stage) {
    let dragging = false;
    const toFrac = e => {
      const r = stage.getBoundingClientRect();
      const p = dv.orient === "v" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      dv.frac = Math.max(0.12, Math.min(0.88, p));
      layout();
    };
    handle.addEventListener("pointerdown", e => { dragging = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
    handle.addEventListener("pointermove", e => { if (dragging) toFrac(e); });
    handle.addEventListener("pointerup", () => { dragging = false; });
    handle.addEventListener("pointercancel", () => { dragging = false; });
    // tap anywhere on the stage to move the divider there too
    stage.addEventListener("pointerdown", e => { if (e.target === handle || handle.contains(e.target)) return; if (!dv.noChores) toFrac(e); });
  }

  /* ───────────────────────────  3. read  ─────────────────────────── */
  async function runRead() {
    const overlay = readingOverlay();
    document.body.appendChild(overlay);
    const setPct = (label, frac) => {
      overlay.querySelector(".reading__label").textContent = label;
      overlay.querySelector(".reading__bar > i").style.transform = "scaleX(" + Math.max(0.02, Math.min(1, frac)) + ")";
    };
    try {
      const zones = cropZones();  // [{key, canvas}]
      const results = { shopping: [], chores: [] };
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const base = i / zones.length;
        setPct(zones.length > 1 ? `Reading the ${z.key} side…` : "Reading your list…", base + 0.03);
        const { text } = await window.OCR.recognize(z.canvas, {
          onProgress: m => { if (m.status === "recognizing text") setPct(
            zones.length > 1 ? `Reading the ${z.key} side…` : "Reading your list…", base + (m.progress || 0) / zones.length); },
        });
        results[z.key] = cleanLines(text);
      }
      overlay.remove();
      showReview(results.shopping, results.chores);
    } catch (err) {
      setPct("Couldn't read the photo.", 1);
      overlay.querySelector(".reading__sub").textContent = "You can type the list instead.";
      const box = overlay.querySelector(".reading__actions");
      box.hidden = false;
      box.querySelector("button").onclick = () => { overlay.remove(); showReview([], []); };
    }
  }

  function cropZones() {
    if (dv.noChores) return [{ key: "shopping", canvas: preprocess(cut(0, 0, natW, natH)) }];
    const cutV = dv.orient === "v";
    const split = Math.round((cutV ? natW : natH) * dv.frac);
    const rectA = cutV ? [0, 0, split, natH] : [0, 0, natW, split];
    const rectB = cutV ? [split, 0, natW - split, natH] : [0, split, natW, natH - split];
    const shopIsB = dv.shopSide === "b";
    return [
      { key: "shopping", canvas: preprocess(cut(...(shopIsB ? rectB : rectA))) },
      { key: "chores",   canvas: preprocess(cut(...(shopIsB ? rectA : rectB))) },
    ];
  }
  function cut(x, y, w, h2) {
    const c = document.createElement("canvas"); c.width = w; c.height = h2;
    c.getContext("2d").drawImage(srcCanvas, x, y, w, h2, 0, 0, w, h2);
    return c;
  }

  /* handwriting-friendly: upscale small crops, grayscale, stretch contrast (let
     Tesseract do its own binarization — hard thresholding eats pencil strokes). */
  function preprocess(canvas) {
    const target = 1700;
    const maxDim = Math.max(canvas.width, canvas.height) || 1;
    const s = Math.min(2.5, target / maxDim);   // downscale big phone photos, upscale small crops
    const w = Math.max(1, Math.round(canvas.width * s)), hh = Math.max(1, Math.round(canvas.height * s));
    const out = document.createElement("canvas"); out.width = w; out.height = hh;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, w, hh);
    const img = ctx.getImageData(0, 0, w, hh), d = img.data;
    // grayscale + collect histogram
    let lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g; if (g > hi) hi = g;
    }
    // contrast stretch (robust-ish; guard against flat images)
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      let v = (d[i] - lo) * 255 / span;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /* section titles that are commonly written at the top of a fridge chart —
     they read as items but are labels, and the user already chose the sides. */
  const HEADERS = new Set([
    "shopping","shopping list","groceries","grocery","grocery list","food","to buy",
    "things to buy","need","needs","need to buy","chores","chore","chore list","chart",
    "to do","to-do","todo","to do list","tasks","task list","jobs","errands","housework",
    "list","the list","market","store","fridge","this week","weekly","home",
  ]);

  /* OCR text → candidate item lines (noise-tolerant). */
  function cleanLines(text) {
    const seen = new Set(), out = [];
    (text || "").split(/\r?\n/).forEach(raw => {
      let s = raw.replace(/\s+/g, " ").trim();
      s = s.replace(/^[\-\–\—•*·▢☐□○o¤»>\]\[\)\(\.\,\s]+/i, "");   // bullets / checkboxes
      s = s.replace(/^\d+[\.\)]\s*/, "");                            // "1." / "2)"
      s = s.replace(/[|_]{2,}/g, " ").replace(/\s+/g, " ").trim();
      const letters = (s.match(/[a-z]/gi) || []).length;
      if (letters < 2) return;                    // drop noise/punctuation-only
      const norm = s.toLowerCase().replace(/[:.\-–—]+$/, "").trim();
      if (HEADERS.has(norm)) return;              // drop leaked section headers
      if (s.length > 60) s = s.slice(0, 60);
      const key = s.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key); out.push(s);
    });
    return out;
  }

  /* ───────────────────────────  4. review  ─────────────────────────── */
  function showReview(shopping, chores) {
    const shopWrap = h("div", { class: "rv__items", id: "rvShop" });
    const choreWrap = h("div", { class: "rv__items", id: "rvChore" });
    shopping.forEach(t => shopWrap.appendChild(reviewRow(t, "shop")));
    chores.forEach(t => choreWrap.appendChild(reviewRow(t, "chore")));

    const nothing = shopping.length === 0 && chores.length === 0;

    vReview.replaceChildren(
      topbar("Check the read", cancelToList,
        nothing ? "The camera didn't catch anything readable — add your items by hand."
                : "Fix anything misread, delete the junk, add what's missing."),
      section("On the shopping list", shopWrap, () => shopWrap.appendChild(focusRow(reviewRow("", "shop")))),
      section("Set aside — chores", choreWrap, () => choreWrap.appendChild(focusRow(reviewRow("", "chore"))), true),
      h("div", { class: "flow-cta flow-cta--split" }, [
        h("button", { class: "btn btn--ghost btn--wide", onclick: () => start() }, ["Retake"]),
        h("button", { class: "btn btn--scan btn--wide", onclick: buildList }, ["Build my list"]),
      ]),
    );
    show(vReview);
  }

  function reviewRow(text, kind) {
    const input = h("input", { class: "rv__input", type: "text", value: text, "aria-label": "Item", autocomplete: "off" });
    const del = h("button", { class: "rv__del", "aria-label": "Remove", html: SVG_X, onclick: () => row.remove() });
    const row = h("div", { class: "rv__row", "data-kind": kind }, [input, del]);
    return row;
  }
  function focusRow(row) { setTimeout(() => row.querySelector("input").focus(), 40); return row; }

  function section(title, wrap, onAdd, muted) {
    return h("div", { class: "rv__section" + (muted ? " rv__section--muted" : "") }, [
      h("h2", { class: "rv__title" }, [title]),
      wrap,
      h("button", { class: "rv__add", onclick: onAdd, html: SVG_PLUS + "<span>Add item</span>" }),
    ]);
  }

  function buildList() {
    const grab = id => Array.from(document.getElementById(id).querySelectorAll("input"))
      .map(i => i.value.trim()).filter(Boolean);
    const shopping = grab("rvShop");
    const chores = grab("rvChore");
    if (shopping.length === 0) { // don't wipe the current list for an empty read
      const back = confirm("No shopping items yet. Go back and add some?");
      if (back) return;
    }
    window.Counter.commitList(shopping, chores);
    show(vList);
  }

  /* ───────────────────────────  chrome bits  ─────────────────────────── */
  function topbar(title, onCancel, sub) {
    return h("header", { class: "flow-top" }, [
      h("button", { class: "flow-back", "aria-label": "Cancel", html: SVG_BACK, onclick: onCancel }),
      h("div", { class: "flow-heads" }, [
        h("h1", { class: "flow-title" }, [title]),
        sub ? h("p", { class: "flow-sub" }, [sub]) : document.createComment(""),
      ]),
    ]);
  }
  function pill(label, kids) {
    return h("div", { class: "seg" }, [h("span", { class: "seg__label" }, [label]), h("div", { class: "seg__opts" }, kids)]);
  }
  function segBtn(label, isOn, onClick) {
    const b = h("button", { class: "seg__btn", onclick: () => { onClick(); refreshSeg(); } }, [label]);
    b._isOn = isOn; return b;
  }
  function refreshSeg() { document.querySelectorAll(".seg__btn").forEach(b => b.classList.toggle("is-on", !!(b._isOn && b._isOn()))); }
  function cancelToList() { show(vList); }

  function readingOverlay() {
    return h("div", { class: "reading" }, [
      h("div", { class: "reading__card" }, [
        h("div", { class: "reading__spin", "aria-hidden": "true" }),
        h("p", { class: "reading__label" }, ["Reading your list…"]),
        h("div", { class: "reading__bar" }, [h("i", {})]),
        h("p", { class: "reading__sub" }, ["Working on your phone — nothing is uploaded."]),
        h("div", { class: "reading__actions", hidden: "hidden" }, [h("button", { class: "btn btn--scan btn--wide" }, ["Type it instead"])]),
      ]),
    ]);
  }

  window.Scan = { start };
})();
