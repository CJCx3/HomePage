/* ══════════════════════════  OCR seam — on-device Tesseract  ══════════════════════════
   Swappable OCR interface (PRODUCT.md: engine behind a seam). Everything runs on the
   phone; nothing leaves the device. Tesseract.js + core wasm + the English model are
   bundled under vendor/tesseract/ and cached by the service worker for offline use.
   The library is loaded lazily on first scan so it never blocks app startup. */
(function () {
  const BASE = "vendor/tesseract/";
  let libPromise = null;   // loads tesseract.min.js once
  let worker = null;       // reused across scans
  let workerReady = null;  // promise

  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = BASE + "tesseract.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the OCR engine."));
      document.head.appendChild(s);
    });
    return libPromise;
  }

  async function getWorker(onStatus) {
    if (worker) return worker;
    if (workerReady) return workerReady;
    workerReady = (async () => {
      await loadLib();
      const w = await window.Tesseract.createWorker("eng", 1, {
        workerPath: BASE + "worker.min.js",
        corePath: BASE,
        langPath: BASE + "lang",
        gzip: true,
        logger: m => { if (onStatus && m && m.status) onStatus(m); },
      });
      // Tuned for a column of short list items.
      await w.setParameters({
        tessedit_pageseg_mode: "6",       // assume a uniform block of text (a list)
        preserve_interword_spaces: "1",
      });
      worker = w;
      return w;
    })();
    return workerReady;
  }

  window.OCR = {
    ready: true,          // the engine is available to load on demand
    engine: "tesseract-eng",
    /* recognize(image, {onProgress}) -> { text, confidence }
       image: a canvas, ImageData-bearing canvas, blob URL, or HTMLImageElement. */
    async recognize(image, opts = {}) {
      const w = await getWorker(opts.onProgress);
      const { data } = await w.recognize(image);
      return { text: (data && data.text) || "", confidence: (data && data.confidence) || 0 };
    },
    /* Warm the engine (and prime the SW cache) ahead of the first real scan. */
    async warmup(onStatus) { try { await getWorker(onStatus); } catch (e) { /* stay lazy */ } },
    async dispose() { if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; workerReady = null; } },
  };
})();
