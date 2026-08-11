/* Metanoia — engine.js (2D)
 * Reusable systems shared by every scene. Game-specific content lives in
 * content.js. No build step, no modules: everything hangs off window.MET.
 * Rendering is plain HTML5 Canvas 2D, top-down.
 */
(function () {
  "use strict";
  const MET = (window.MET = window.MET || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  MET.util = { clamp, lerp };
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  MET.wait = wait;

  /* ============================================================= *
   *  SETTINGS  — persisted to localStorage; drives volumes + look.
   * ============================================================= */
  const Settings = (MET.settings = {
    master: 0.9, music: 0.6, sfx: 0.85, textSpeed: 1.0, grain: true, vignette: true,
    load() {
      try {
        const s = JSON.parse(localStorage.getItem("metanoia.settings") || "{}");
        Object.assign(this, s);
      } catch (e) {}
    },
    save() {
      try {
        localStorage.setItem("metanoia.settings", JSON.stringify({
          master: this.master, music: this.music, sfx: this.sfx,
          textSpeed: this.textSpeed, grain: this.grain, vignette: this.vignette,
        }));
      } catch (e) {}
    },
    apply() {
      Audio.setVolumes();
      const g = document.getElementById("grain"), v = document.getElementById("vignette");
      if (g) g.style.display = this.grain ? "" : "none";
      if (v) v.style.display = this.vignette ? "" : "none";
    },
  });

  /* ============================================================= *
   *  COLOR GRADE  — the heart of Metanoia.
   * ============================================================= */
  const Grade = (MET.grade = {
    el: null,
    phases: [
      { g: 1.00, s: 0.00, e: 0.00, b: 0.86, c: 0.92, h: 0 },
      { g: 0.55, s: 0.70, e: 0.00, b: 0.95, c: 0.98, h: -6 },
      { g: 0.22, s: 0.90, e: 0.16, b: 1.00, c: 1.00, h: 4 },
      { g: 0.00, s: 1.08, e: 0.00, b: 1.05, c: 1.03, h: 0 },
    ],
    full: { g: 0, s: 1.06, e: 0, b: 1.04, c: 1.02, h: 0 },
    cur: null, from: null, to: null, t: 1, dur: 1,
    init(el) {
      this.el = el;
      this.cur = Object.assign({}, this.phases[0]);
      this.to = Object.assign({}, this.phases[0]);
      this.from = Object.assign({}, this.phases[0]);
      this.apply(this.cur);
    },
    str(p) {
      // When the world is essentially full color, drop the filter entirely so
      // the compositor isn't re-filtering the whole canvas every frame.
      if (p.g < 0.04 && p.e < 0.04) return "none";
      return `grayscale(${p.g.toFixed(3)}) saturate(${p.s.toFixed(3)}) ` +
        `sepia(${p.e.toFixed(3)}) brightness(${p.b.toFixed(3)})`;
    },
    apply(p) {
      const f = this.str(p);
      if (f !== this._last) { this.el.style.setProperty("--grade", f); this._last = f; }
    },
    setPhaseInstant(i) { this.cur = Object.assign({}, this.phases[i]); this.to = Object.assign({}, this.phases[i]); this.apply(this.cur); },
    tweenTo(target, dur) { this.from = Object.assign({}, this.cur); this.to = Object.assign({}, target); this.dur = dur; this.t = 0; },
    toPhase(i, dur) { this.tweenTo(this.phases[i], dur); },
    toFull(dur) { this.tweenTo(this.full, dur); },
    update(dt) {
      if (this.t >= 1) return;
      this.t = clamp(this.t + dt / this.dur, 0, 1);
      const e = this.t < 0.5 ? 2 * this.t * this.t : 1 - Math.pow(-2 * this.t + 2, 2) / 2;
      for (const k of ["g", "s", "e", "b", "c", "h"]) this.cur[k] = lerp(this.from[k], this.to[k], e);
      this.apply(this.cur);
    },
  });

  /* ============================================================= *
   *  BLINK
   * ============================================================= */
  const Blink = (MET.blink = {
    el: null,
    init(el) { this.el = el; },
    blink(opts) {
      opts = opts || {};
      const close = opts.close ?? 110, hold = opts.hold ?? 60, open = opts.open ?? 260;
      const el = this.el;
      return new Promise((resolve) => {
        el.style.transition = `opacity ${close}ms ease-in`;
        el.style.opacity = "1";
        setTimeout(async () => {
          if (opts.atBlack) { try { await opts.atBlack(); } catch (e) {} }
          setTimeout(() => {
            el.style.transition = `opacity ${open}ms ease-out`;
            el.style.opacity = "0";
            setTimeout(resolve, open);
          }, hold);
        }, close);
      });
    },
    async cover(fn, opts) {
      opts = opts || {};
      const el = this.el;
      el.style.transition = `opacity ${opts.close ?? 420}ms ease-in`;
      el.style.opacity = "1";
      await wait(opts.close ?? 420);
      if (fn) await fn();
      await wait(opts.hold ?? 200);
      el.style.transition = `opacity ${opts.open ?? 900}ms ease-out`;
      el.style.opacity = "0";
      await wait(opts.open ?? 900);
    },
  });

  /* ============================================================= *
   *  UI  — prompt, monologue, captions, dialogue, minigame HUD.
   * ============================================================= */
  const UI = (MET.ui = {
    prompt: null, mono: null, cap: null, hint: null, dlg: null, dlgName: null, dlgText: null,
    mgTop: null, mgBottom: null, _monoTimer: null,
    init() {
      this.prompt = document.getElementById("prompt");
      this.mono = document.getElementById("monologue");
      this.cap = document.getElementById("caption");
      this.hint = document.getElementById("hint");
      this.dlg = document.getElementById("dialogue");
      this.dlgName = document.getElementById("dlgName");
      this.dlgText = document.getElementById("dlgText");
      this.mgTop = document.getElementById("mgTop");
      this.mgBottom = document.getElementById("mgBottom");
    },
    focus(label) { if (label) { this.prompt.textContent = label; this.prompt.classList.add("show"); } },
    unfocus() { this.prompt.classList.remove("show"); },
    say(text, dur) {
      this.mono.textContent = text;
      this.mono.classList.add("show");
      clearTimeout(this._monoTimer);
      if (dur !== 0) this._monoTimer = setTimeout(() => this.mono.classList.remove("show"), (dur || 3600) / Settings.textSpeed);
    },
    hush() { this.mono.classList.remove("show"); },
    async card(big, small, holdMs) {
      this.cap.innerHTML = `<div class="big">${big}</div>` + (small ? `<div class="small">${small}</div>` : "");
      this.cap.classList.add("show");
      await wait(holdMs || 3200);
      this.cap.classList.remove("show");
      await wait(1500);
    },
    hideHint() { this.hint.classList.add("hide"); },
    setHint(t) { this.hint.textContent = t; this.hint.classList.remove("hide"); },
    /* A sequence of spoken lines; advance with space/click. entries: {name,text}. */
    converse(entries) {
      return new Promise((resolve) => {
        let i = 0;
        const show = () => {
          const e = entries[i];
          this.dlgName.textContent = e.name || "";
          this.dlgText.textContent = e.text;
          this.dlg.classList.add("show");
        };
        const advance = () => {
          i++;
          if (i >= entries.length) { cleanup(); this.dlg.classList.remove("show"); resolve(); }
          else show();
        };
        const onKey = (ev) => { if (ev.key === " " || ev.key === "Enter" || ev.key.toLowerCase() === "e") { ev.preventDefault(); ev.stopImmediatePropagation(); advance(); } };
        const onClick = (ev) => { if (ev) ev.stopImmediatePropagation(); advance(); };
        const cleanup = () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("mousedown", onClick); };
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("mousedown", onClick);
        show();
      });
    },
    mg(top, bottom) {
      if (top != null) { this.mgTop.textContent = top; this.mgTop.classList.toggle("show", top !== ""); }
      if (bottom != null) { this.mgBottom.textContent = bottom; this.mgBottom.classList.toggle("show", bottom !== ""); }
    },
    mgHide() { this.mgTop.classList.remove("show"); this.mgBottom.classList.remove("show"); },
  });

  /* ============================================================= *
   *  READER  — handwritten letter that bleeds into a world.
   * ============================================================= */
  const Reader = (MET.reader = {
    root: null, paper: null, text: null, hint: null, ink: null,
    init() {
      this.root = document.getElementById("reader");
      this.paper = document.getElementById("paper");
      this.text = document.getElementById("letterText");
      this.hint = document.getElementById("readHint");
      this.ink = document.getElementById("ink");
    },
    async read(pages, signature, opts) {
      opts = opts || {};
      const root = this.root, text = this.text;
      root.classList.remove("hidden"); root.classList.add("show");
      await wait(60);
      let i = 0;
      const renderPage = (s, sig) => {
        text.innerHTML = "";
        const span = document.createElement("span"); text.appendChild(span);
        if (sig) { const sg = document.createElement("span"); sg.className = "sig"; sg.textContent = sig; text.appendChild(sg); }
        return typeOut(span, s);
      };
      await renderPage(pages[0], pages.length === 1 ? signature : null);
      await new Promise((resolve) => {
        const onClick = async () => {
          i++;
          if (i < pages.length) { this.hint.style.opacity = "0"; await renderPage(pages[i], i === pages.length - 1 ? signature : null); this.hint.style.opacity = ""; }
          else { root.removeEventListener("click", onClick); resolve(); }
        };
        root.addEventListener("click", onClick);
      });
      this.hint.style.opacity = "0";
      if (opts.noBleed) return;
      await this.bleed();
    },
    bleed() {
      const ink = this.ink;
      ink.style.transition = "none";
      ink.style.background = "radial-gradient(circle at 50% 58%, #0a0705 0%, #0a0705 0%, transparent 1%)";
      ink.style.opacity = "1"; void ink.offsetWidth;
      ink.style.transition = "background 1500ms ease-in";
      ink.style.background = "radial-gradient(circle at 50% 58%, #0a0705 0%, #0a0705 160%, transparent 200%)";
      return wait(1500);
    },
    async close() { this.root.classList.remove("show"); await wait(1100); this.root.classList.add("hidden"); this.ink.style.opacity = "0"; this.hint.style.opacity = ""; },
    hideNow() { this.root.classList.remove("show"); this.root.classList.add("hidden"); this.ink.style.opacity = "0"; },
  });

  function typeOut(el, str) {
    return new Promise((resolve) => {
      let i = 0;
      const speed = Math.max(4, 14 / Settings.textSpeed);
      const step = () => { i += 2; el.textContent = str.slice(0, i); if (i < str.length) setTimeout(step, speed); else resolve(); };
      step();
    });
  }

  /* ============================================================= *
   *  AUDIO  — core + SFX + procedural music. No files.
   * ============================================================= */
  const Audio = (MET.audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null, ambGain: null, started: false, nodes: {},
    start() {
      if (this.started) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambGain = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.ambGain.connect(this.master);
      // reverb for a sense of space (parallel wet path)
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this._impulse(2.6, 2.4);
      this.revGain = this.ctx.createGain(); this.revGain.gain.value = 0.55;
      this.reverb.connect(this.revGain); this.revGain.connect(this.master);
      this.musRev = this.ctx.createGain(); this.musRev.gain.value = 0.5; this.musicGain.connect(this.musRev); this.musRev.connect(this.reverb);
      this.sfxRev = this.ctx.createGain(); this.sfxRev.gain.value = 0.16; this.sfxGain.connect(this.sfxRev); this.sfxRev.connect(this.reverb);
      this.started = true;
      this.setVolumes();
      Music.ctx = this.ctx; Music.out = this.musicGain;
    },
    _impulse(dur, decay) {
      const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
      const buf = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
      return buf;
    },
    setVolumes() {
      if (!this.started) return;
      this.master.gain.value = Settings.master;
      this.musicGain.gain.value = Settings.music;
      this.sfxGain.gain.value = Settings.sfx;
      this.ambGain.gain.value = Settings.sfx * 0.5;
    },
    resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
    _noiseBuffer() {
      const ctx = this.ctx, len = ctx.sampleRate * 1.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },
    /* very subtle ambient bed under the music */
    setBed(profile) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      for (const k in this.nodes) { try { this.nodes[k].stop && this.nodes[k].stop(); } catch (e) {} try { this.nodes[k].disconnect && this.nodes[k].disconnect(); } catch (e) {} }
      this.nodes = {};
      if (!profile) return;
      const noise = ctx.createBufferSource(); noise.buffer = this._noiseBuffer(); noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      const g = ctx.createGain();
      const cfg = {
        apartment: { f: 240, q: 0.6, lp: 500, g: 0.05 },
        war: { f: 200, q: 0.5, lp: 900, g: 0.09 },
        wind: { f: 560, q: 0.4, lp: 1700, g: 0.14 },
        room: { f: 320, q: 0.7, lp: 900, g: 0.04 },
        outside: { f: 800, q: 0.5, lp: 2000, g: 0.08 },
        office: { f: 180, q: 0.6, lp: 520, g: 0.06 },
        car: { f: 120, q: 0.7, lp: 400, g: 0.10 },
      }[profile] || { f: 300, q: 0.6, lp: 700, g: 0.05 };
      bp.frequency.value = cfg.f; bp.Q.value = cfg.q; lp.frequency.value = cfg.lp; g.gain.value = cfg.g;
      noise.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.ambGain); noise.start();
      this.nodes.noise = noise;
    },
    _env(wave, freq, t0, dur, peak, target) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(target || this.sfxGain); o.start(t0); o.stop(t0 + dur + 0.02);
      return { o, g };
    },
    footstep(soft) {
      if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = soft ? 320 : 700;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(soft ? 0.04 : 0.08, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t); src.stop(t + 0.15);
    },
    sting(kind) {
      if (!this.ctx) return; const t = this.ctx.currentTime;
      const notes = kind === "warm" ? [261.6, 329.6, 392.0] : kind === "sad" ? [220, 261.6, 311.1] : [293.7, 370.0, 440.0];
      notes.forEach((n, i) => this._env("sine", n, t + i * 0.08, 3.2, 0.10, this.sfxGain));
    },
    click() { if (this.ctx) this._env("triangle", 520, this.ctx.currentTime, 0.12, 0.06); },
    success() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((n, i) => this._env("triangle", n, t + i * 0.07, 0.5, 0.10)); },
    error() { if (!this.ctx) return; const t = this.ctx.currentTime; this._env("sawtooth", 150, t, 0.25, 0.08); this._env("sawtooth", 120, t + 0.08, 0.3, 0.08); },
    gunshot() {
      if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 600;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t); src.stop(t + 0.2);
      this._env("square", 90, t, 0.12, 0.12);
    },
    hit() { if (this.ctx) this._env("square", 200, this.ctx.currentTime, 0.18, 0.10); },
    bounce() { if (this.ctx) this._env("sine", 180, this.ctx.currentTime, 0.14, 0.09); },
    swish() { if (!this.ctx) return; const t = this.ctx.currentTime; [784, 988].forEach((n, i) => this._env("sine", n, t + i * 0.05, 0.4, 0.08)); },
  });

  /* ============================================================= *
   *  MUSIC  — a tiny lookahead step-sequencer. Each song is data.
   * ============================================================= */
  const SC = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], minPent: [0, 3, 5, 7, 10], majPent: [0, 2, 4, 7, 9] };
  function d2m(root, scale, d) { if (d == null) return null; const o = Math.floor(d / scale.length); const i = ((d % scale.length) + scale.length) % scale.length; return root + o * 12 + scale[i]; }
  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function mkSong(o) {
    const sc = SC[o.scale];
    return {
      bpm: o.bpm, div: o.div || 2, len: o.mel.length,
      mel: o.mel.map((d) => d2m(o.root, sc, d)),
      bass: (o.bass || []).map((d) => d2m(o.root, sc, d)),
      chords: (o.chords || []).map((ch) => ch.map((d) => d2m(o.root, sc, d))),
      lead: o.lead || "sine", bassWave: o.bassWave || "triangle", padWave: o.padWave || "sine",
      melGain: o.melGain == null ? 0.12 : o.melGain, bassGain: o.bassGain == null ? 0.10 : o.bassGain,
      padGain: o.padGain == null ? 0.05 : o.padGain, barSteps: o.barSteps || 8, perc: o.perc || 0,
    };
  }

  const Music = (MET.music = {
    ctx: null, out: null, timer: null, nextTime: 0, step: 0, song: null, playing: false, name: null,
    songs: {}, _inited: false,
    init() {
      if (this._inited) return;
      this._inited = true;
      const R = 57; // A3
      this.songs.menu = mkSong({ root: R, scale: "minor", bpm: 62, lead: "sine",
        mel: [7, null, 4, null, 5, 4, 2, null, 3, null, 2, null, 0, null, null, null],
        bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 4, null, null, null],
        chords: [[0, 2, 4], [5, 0, 2]], melGain: 0.10, padGain: 0.05 });
      this.songs.marcus = mkSong({ root: 50, scale: "minor", bpm: 82, lead: "triangle", bassWave: "sawtooth", perc: 2,
        mel: [0, null, 0, 2, 3, null, 2, 0, 7, null, 5, null, 3, 2, 0, null],
        bass: [0, null, 0, null, 0, null, 0, null, 5, null, 5, null, 3, null, 3, null],
        chords: [[0, 2, 4], [5, 0, 2]], melGain: 0.10, bassGain: 0.12, padGain: 0.05 });
      this.songs.sofia = mkSong({ root: 64, scale: "majPent", bpm: 92, lead: "sine", div: 2, perc: 4,
        mel: [0, 2, 4, 5, 7, 5, 4, 2, 4, 5, 7, 9, 7, 5, 4, null],
        bass: [0, null, null, null, 3, null, null, null, 4, null, null, null, 2, null, null, null],
        chords: [[0, 2, 4], [3, 5, 0]], melGain: 0.095, bassGain: 0.08, padGain: 0.055 });
      this.songs.david = mkSong({ root: 60, scale: "major", bpm: 74, lead: "sine",
        mel: [0, null, 2, 4, 2, null, 0, null, 4, null, 5, 4, 2, null, 0, null],
        bass: [0, null, null, null, 3, null, null, null, 5, null, null, null, 4, null, null, null],
        chords: [[0, 2, 4], [3, 5, 0]], melGain: 0.10, padGain: 0.06 });
      this.songs.credits = mkSong({ root: 60, scale: "major", bpm: 86, lead: "triangle", perc: 2,
        mel: [0, 2, 4, 7, 9, 7, 4, 2, 5, 4, 2, 0, 4, 2, 0, null],
        bass: [0, null, 4, null, 5, null, 4, null, 3, null, 5, null, 0, null, 0, null],
        chords: [[0, 2, 4], [4, 6, 1]], melGain: 0.105, padGain: 0.065 });
      this.songs.date = mkSong({ root: 65, scale: "major", bpm: 70, lead: "sine", perc: 0,
        mel: [0, null, 2, 4, null, 2, 4, 5, 4, null, 2, null, 0, null, null, null],
        bass: [0, null, null, null, 3, null, null, null, 4, null, null, null, 2, null, null, null],
        chords: [[0, 2, 4], [3, 5, 0]], melGain: 0.10, padGain: 0.06 });
      this.rebuildNate(0);
    },
    /* Nate's theme morphs from sparse minor (numb) to full major (alive). */
    rebuildNate(mood) {
      const minorMel = [
        [0, null, null, null, null, null, 0, null, null, null, null, null, 2, null, null, null],
        [0, null, null, 2, null, null, 0, null, 3, null, null, 2, null, null, 0, null],
      ];
      const majorMel = [
        [0, null, 2, null, 4, null, 2, null, 0, null, 4, null, 5, null, 4, null],
        [0, 2, 4, 2, 4, 5, 7, 5, 4, 2, 4, 0, 2, 4, 0, null],
      ];
      const useMajor = mood >= 2;
      const mel = useMajor ? majorMel[mood - 2] : minorMel[mood];
      this.songs.nate = mkSong({
        root: 53, scale: useMajor ? "major" : "minor", bpm: 52 + mood * 8, lead: "sine",
        mel: mel,
        bass: [0, null, null, null, null, null, null, null, useMajor ? 4 : 5, null, null, null, null, null, null, null],
        chords: useMajor ? [[0, 2, 4], [3, 5, 0]] : [[0, 2, 4], [5, 0, 2]],
        melGain: 0.06 + mood * 0.018, bassGain: 0.08, padGain: 0.03 + mood * 0.012,
        padWave: useMajor ? "triangle" : "sine",
      });
      if (this.name === "nate") this.song = this.songs.nate;
    },
    play(name) {
      if (!this.ctx) return;
      if (this.name === name && this.playing) return;
      this.name = name; this.song = this.songs[name] || name;
      this.step = 0; this.nextTime = this.ctx.currentTime + 0.08; this.playing = true;
      if (!this.timer) this.timer = setInterval(() => this._tick(), 25);
    },
    stop() { this.playing = false; this.name = null; },
    _tick() {
      if (!this.ctx || !this.playing || !this.song) return;
      const s = this.song, stepDur = (60 / s.bpm) / s.div;
      while (this.nextTime < this.ctx.currentTime + 0.18) {
        this._scheduleStep(this.step, this.nextTime, stepDur, s);
        this.nextTime += stepDur; this.step = (this.step + 1) % s.len;
      }
    },
    /* a musical note with soft attack/release and a chorus voice for warmth */
    _mnote(freq, t, dur, gain, wave, out, chorus) {
      const ctx = this.ctx, atk = Math.min(0.06, dur * 0.2), rel = dur * 0.7;
      const make = (f, det) => {
        const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + atk);
        g.gain.setTargetAtTime(0.0001, t + dur * 0.4, rel * 0.5);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + rel + 0.05);
      };
      make(freq, 0);
      if (chorus) { make(freq, 7); make(freq, -6); }
    },
    _perc(t, gain) {
      const ctx = this.ctx; const src = ctx.createBufferSource(); src.buffer = Audio._noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 5000;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f); f.connect(g); g.connect(this.out); src.start(t); src.stop(t + 0.08);
    },
    _scheduleStep(i, t, dur, s) {
      const out = this.out; if (!out) return;
      if (s.mel[i] != null) this._mnote(m2f(s.mel[i]), t, dur * 1.9, s.melGain, s.lead, out, true);
      if (s.bass && s.bass[i] != null) this._mnote(m2f(s.bass[i]) / 2, t, dur * 2.4, s.bassGain, s.bassWave, out, false);
      if (s.perc && i % s.perc === 0) this._perc(t, 0.012);
      // pad/chord on each bar boundary
      if (s.chords && s.chords.length && i % s.barSteps === 0) {
        const ch = s.chords[(Math.floor(i / s.barSteps)) % s.chords.length];
        const barDur = dur * s.barSteps;
        ch.forEach((m) => {
          const o = this.ctx.createOscillator(); o.type = s.padWave; o.frequency.value = m2f(m);
          const o2 = this.ctx.createOscillator(); o2.type = s.padWave; o2.frequency.value = m2f(m); o2.detune.value = 5;
          const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(s.padGain, t + barDur * 0.3);
          g.gain.linearRampToValueAtTime(0.0001, t + barDur * 0.96);
          o.connect(g); o2.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + barDur); o2.stop(t + barDur);
        });
      }
    },
  });

  /* ============================================================= *
   *  OBJECTIVES  — a small tab telling the player what to do next.
   * ============================================================= */
  const Objectives = (MET.objectives = {
    el: null, listEl: null, titleEl: null, items: [], visible: true,
    init() {
      this.el = document.getElementById("objectives");
      this.listEl = document.getElementById("objList");
      this.titleEl = document.getElementById("objHeading");
    },
    /* items: array of {text, done} or plain strings; title optional */
    set(title, items) {
      this.items = (items || []).map((it) => (typeof it === "string" ? { text: it, done: false } : it));
      if (this.titleEl && title) this.titleEl.textContent = title;
      this.render();
    },
    clear() { this.items = []; this.render(); },
    complete(text) {
      const it = this.items.find((i) => i.text === text || (text && i.text.indexOf(text) >= 0));
      if (it) { it.done = true; this.render(); }
    },
    render() {
      if (!this.listEl) return;
      this.listEl.innerHTML = "";
      for (const it of this.items) {
        const li = document.createElement("li");
        li.className = it.done ? "done" : "";
        li.innerHTML = '<span class="obj-box">' + (it.done ? "✓" : "○") + "</span>" + it.text;
        this.listEl.appendChild(li);
      }
      this.updateVisibility();
    },
    updateVisibility() {
      const show = this.visible && this.items.length > 0 && MET.engine.running;
      this.el.classList.toggle("hidden", !show);
    },
    toggle() { this.visible = !this.visible; this.updateVisibility(); },
    show() { this.visible = true; this.updateVisibility(); },
  });

  /* ============================================================= *
   *  ENGINE (2D)  — canvas, top-down player, camera, interaction,
   *  characters, and a tiny minigame harness.
   * ============================================================= */
  const Engine = (MET.engine = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    world: null, running: false, cinematic: false, paused: false,
    keys: {}, _last: 0, scale: 1.45,
    player: { x: 0, y: 0, vx: 0, vy: 0, r: 13, dir: Math.PI / 2, moving: false, bob: 0, stepAcc: 0,
      look: { skin: "#e3b48f", hair: "#4b3a2a", shirt: "#5c616c", long: false } },
    cam: { x: 0, y: 0 }, focusObj: null, minigame: null,

    init() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");
      Grade.init(this.canvas);
      Blink.init(document.getElementById("blink"));
      UI.init(); Reader.init(); Objectives.init();
      this.resize();
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("keydown", (e) => this.onKey(e, true));
      window.addEventListener("keyup", (e) => this.onKey(e, false));
      this.canvas.addEventListener("mousedown", () => {
        if (this.minigame && this.minigame.onClick) { this.minigame.onClick(); return; }
        if (this.running && !this.paused && !this.cinematic && this.focusObj) this.interact();
      });
      window.addEventListener("blur", () => { if (this.running && !this.cinematic && !this.minigame) this.showPause(); });
    },

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.W = window.innerWidth; this.H = window.innerHeight;
      this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
      this.canvas.style.width = this.W + "px"; this.canvas.style.height = this.H + "px";
    },
    ensureSize() { if (this.W !== window.innerWidth || this.H !== window.innerHeight) this.resize(); },

    onKey(e, down) {
      const k = e.key.toLowerCase();
      this.keys[k] = down;
      if (!down) return;
      if (k === "tab") { e.preventDefault(); Objectives.toggle(); return; }
      if (this.minigame && this.minigame.onKey) { this.minigame.onKey(e); return; }
      if (k === "escape" && this.running && !this.cinematic) { this.paused ? this.hidePause() : this.showPause(); }
      if ((k === "e" || k === " ") && this.running && !this.paused && !this.cinematic && this.focusObj) { e.preventDefault(); this.interact(); }
    },

    showPause() { this.paused = true; document.getElementById("pause").classList.remove("hidden", "hide"); },
    hidePause() { this.paused = false; const p = document.getElementById("pause"); p.classList.add("hide"); setTimeout(() => p.classList.add("hidden"), 400); Audio.resume(); },

    async enterWorld(world) {
      this.world = world;
      this.player.x = world.spawn.x; this.player.y = world.spawn.y;
      this.player.vx = this.player.vy = 0;
      this.speed = world.speed || 120;
      this.snapCamera();
      if (world.bed !== undefined && Audio.started) Audio.setBed(world.bed);
      if (world.onEnter) await world.onEnter(this);
    },

    snapCamera() { const t = this.cameraTarget(); this.cam.x = t.x; this.cam.y = t.y; },
    cameraTarget() {
      const w = this.world, hw = (this.W / 2) / this.scale, hh = (this.H / 2) / this.scale;
      let cx, cy;
      if (w.w <= hw * 2) cx = w.w / 2; else cx = clamp(this.player.x, hw, w.w - hw);
      if (w.h <= hh * 2) cy = w.h / 2; else cy = clamp(this.player.y, hh, w.h - hh);
      return { x: cx, y: cy };
    },

    updatePlayer(dt) {
      const p = this.player;
      let ax = 0, ay = 0;
      if (this.keys["w"] || this.keys["arrowup"]) ay -= 1;
      if (this.keys["s"] || this.keys["arrowdown"]) ay += 1;
      if (this.keys["a"] || this.keys["arrowleft"]) ax -= 1;
      if (this.keys["d"] || this.keys["arrowright"]) ax += 1;
      const len = Math.hypot(ax, ay);
      p.moving = len > 0;
      if (p.moving) { ax /= len; ay /= len; p.dir = Math.atan2(ay, ax); }
      const sp = this.speed;
      const tx = p.moving ? ax * sp : 0, ty = p.moving ? ay * sp : 0;
      const k = 1 - Math.pow(0.0005, dt);
      p.vx = lerp(p.vx, tx, k); p.vy = lerp(p.vy, ty, k);
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      [nx, ny] = this.collide(nx, ny); p.x = nx; p.y = ny;
      const speedNow = Math.hypot(p.vx, p.vy);
      if (speedNow > 8) {
        p.bob += dt * speedNow * 0.06; p.stepAcc += speedNow * dt;
        if (p.stepAcc > 34) { p.stepAcc = 0; Audio.footstep(this.world.softSteps); }
      } else p.bob = lerp(p.bob, 0, 1 - Math.pow(0.001, dt));
      const t = this.cameraTarget(), cf = 1 - Math.pow(0.0001, dt);
      this.cam.x = lerp(this.cam.x, t.x, cf); this.cam.y = lerp(this.cam.y, t.y, cf);
    },

    collide(nx, ny) {
      const w = this.world, r = this.player.r;
      nx = clamp(nx, r, w.w - r); ny = clamp(ny, r, w.h - r);
      if (w.walls) for (const rect of w.walls) {
        const cx = clamp(nx, rect.x, rect.x + rect.w), cy = clamp(ny, rect.y, rect.y + rect.h);
        const dx = nx - cx, dy = ny - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 0.0001) { const d = Math.sqrt(d2); const push = r - d; nx += dx / d * push; ny += dy / d * push; }
          else { const l = nx - rect.x, ri = rect.x + rect.w - nx, t = ny - rect.y, b = rect.y + rect.h - ny; const m = Math.min(l, ri, t, b); if (m === l) nx = rect.x - r; else if (m === ri) nx = rect.x + rect.w + r; else if (m === t) ny = rect.y - r; else ny = rect.y + rect.h + r; }
        }
      }
      return [nx, ny];
    },

    updateFocus() {
      const w = this.world; let best = null, bestD = Infinity;
      if (w.interactables) for (const it of w.interactables) {
        if (it.hidden) continue;
        if (it.once && it._used) continue;
        const d = Math.hypot(it.x - this.player.x, it.y - this.player.y);
        if (d < (it.r || 46) && d < bestD) { bestD = d; best = it; }
      }
      if (best !== this.focusObj) { this.focusObj = best; if (best) UI.focus(best.label); else UI.unfocus(); }
    },
    interact() {
      const it = this.focusObj; if (!it) return;
      if (it.once && it._used) return;
      if (!it.repeat) it._used = it.once ? true : it._used;
      Audio.resume();
      if (it.onUse) it.onUse(this);
    },

    /* ---- minigame harness ---- */
    startMinigame(mg) { this.minigame = mg; UI.unfocus(); this.focusObj = null; if (mg.start) mg.start(this); },
    endMinigame() { UI.mgHide(); this.minigame = null; },

    /* ---- character drawing (player + NPCs) ---- a small 3/4 person with
       shading, swinging limbs, hair styles and a simple face. */
    drawCharacter(ctx, x, y, look, dir, bob, phase) {
      bob = bob || 0; dir = dir == null ? Math.PI / 2 : dir; phase = phase || 0;
      const style = look.hairStyle || (look.long ? "long" : "short");
      const swing = Math.sin(phase) * 3.4;
      const breathe = Math.sin(performance.now() / 950 + (x + y) * 0.05) * 0.5;
      const fx = Math.cos(dir);
      const pants = look.pants || "#3a3946";
      const shirt = look.shirt, shirtHi = lighten(shirt, 26), shirtLo = lighten(shirt, -26);
      const skin = look.skin, skinLo = lighten(skin, -26);
      ctx.save();
      // soft contact shadow (two layers)
      ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(x, y + 14, 15, 6.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.beginPath(); ctx.ellipse(x, y + 14, 20, 9, 0, 0, 7); ctx.fill();
      ctx.translate(0, bob + breathe);

      // legs + shoes (swing opposite)
      ctx.fillStyle = pants;
      this._cap(ctx, x - 4, y + 6, x - 4, y + 13 + swing * 0.5, 3.2);
      this._cap(ctx, x + 4, y + 6, x + 4, y + 13 - swing * 0.5, 3.2);
      ctx.fillStyle = "#241f1a";
      ctx.beginPath(); ctx.ellipse(x - 4, y + 14 + swing * 0.5, 3.6, 2.4, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 4, y + 14 - swing * 0.5, 3.6, 2.4, 0, 0, 7); ctx.fill();

      // back arm
      ctx.fillStyle = shirtLo; this._cap(ctx, x - 9, y - 4, x - 12, y + 4 - swing * 0.5, 3.1);
      // torso (flat fill + highlight + outline — no per-frame gradient)
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(x, y, 11, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shirtHi; ctx.beginPath(); ctx.ellipse(x - 3, y - 4, 6, 7.5, -0.3, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 11, 13, 0, 0, 7); ctx.stroke();
      // front arm + hand
      ctx.fillStyle = shirt; this._cap(ctx, x + 9, y - 4, x + 12, y + 4 + swing * 0.5, 3.1);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + 12, y + 4 + swing * 0.5, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x - 12, y + 4 - swing * 0.5, 2.4, 0, 7); ctx.fill();

      // hair behind for long styles
      if (style === "long") { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(x, y - 3, 9.5, 12, 0, 0, 7); ctx.fill(); }
      // neck
      ctx.fillStyle = skinLo; ctx.fillRect(x - 2.5, y - 9, 5, 4);
      // head (flat + small highlight)
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 6, 7.2, 0, 7); ctx.fill();
      ctx.fillStyle = lighten(skin, 16); ctx.beginPath(); ctx.arc(x - 2.2, y - 8, 3, 0, 7); ctx.fill();
      // hair styles
      ctx.fillStyle = look.hair;
      if (style === "bald") { /* none */ }
      else if (style === "afro") { ctx.beginPath(); ctx.arc(x, y - 8, 8.6, 0, 7); ctx.fill(); ctx.fillStyle = lighten(skin, 12); ctx.beginPath(); ctx.arc(x, y - 5, 6.2, 0, 7); ctx.fill(); }
      else if (style === "bun") { ctx.beginPath(); ctx.arc(x, y - 8.5, 7.4, Math.PI, 2 * Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 13.5, 3, 0, 7); ctx.fill(); }
      else if (style === "long") { ctx.beginPath(); ctx.arc(x, y - 8, 7.6, Math.PI * 0.82, Math.PI * 2.18); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x, y - 8, 7.6, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); ctx.fillRect(x - 7.4, y - 9, 2.4, 3); ctx.fillRect(x + 5, y - 9, 2.4, 3); }
      // face: eyes shifted by facing
      const ex = fx * 1.6;
      ctx.fillStyle = "rgba(30,22,18,0.8)";
      ctx.beginPath(); ctx.arc(x - 2.4 + ex, y - 5, 0.95, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 2.4 + ex, y - 5, 0.95, 0, 7); ctx.fill();
      if (look.glasses) { ctx.strokeStyle = "rgba(20,20,20,0.7)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x - 2.4 + ex, y - 5, 1.8, 0, 7); ctx.arc(x + 2.4 + ex, y - 5, 1.8, 0, 7); ctx.stroke(); }
      if (look.beard) { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(x, y - 3.4, 5.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill(); }
      ctx.restore();
    },
    // a rounded "capsule" limb between two points
    _cap(ctx, x1, y1, x2, y2, w) {
      ctx.lineCap = "round"; ctx.lineWidth = w * 2; ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    },
    drawPlayer(ctx) { const p = this.player; this.drawCharacter(ctx, p.x, p.y, p.look, p.dir, Math.sin(p.bob) * -1.3, p.bob); },
    drawGlow(ctx, it, t) {
      const pulse = 0.55 + Math.sin(t * 0.005) * 0.25, r = (it.glowR || 16);
      const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, r);
      g.addColorStop(0, `rgba(255,250,235,${0.55 * pulse})`); g.addColorStop(1, "rgba(255,250,235,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * pulse})`; ctx.beginPath(); ctx.arc(it.x, it.y, 3, 0, 7); ctx.fill();
    },

    applyCamera() {
      const s = this.dpr * this.scale;
      this.ctx.setTransform(s, 0, 0, s, this.dpr * (this.W / 2 - this.cam.x * this.scale), this.dpr * (this.H / 2 - this.cam.y * this.scale));
    },
    render(t) {
      const ctx = this.ctx, w = this.world;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if (!w) return;
      this.applyCamera();
      if (w.drawFloor) w.drawFloor(ctx, t);
      const objs = (w.objects || []).slice().sort((a, b) => (a.y || 0) - (b.y || 0));
      let drew = false;
      for (const o of objs) {
        if (!drew && (o.y || 0) > this.player.y) { if (w.drawPlayer !== false) this.drawPlayer(ctx); drew = true; }
        if (o.visible === false || o.hidden) continue;
        if (o.draw) o.draw(ctx, t);
      }
      if (!drew && w.drawPlayer !== false) this.drawPlayer(ctx);
      if (this.focusObj && !this.cinematic && !this.minigame) this.drawGlow(ctx, this.focusObj, t);
      if (w.drawOverlay) w.drawOverlay(ctx, t, this.cam);
      if (this.minigame && this.minigame.drawWorld) this.minigame.drawWorld(ctx, t);
      if (this.minigame && this.minigame.drawScreen) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.minigame.drawScreen(ctx, this.W, this.H, t);
      }
    },

    loop(now) {
      requestAnimationFrame((n) => this.loop(n));
      const dt = Math.min((now - this._last) / 1000 || 0, 0.05); this._last = now;
      this.ensureSize();
      Grade.update(dt);
      if (this.running) {
        if (!this.paused) {
          if (this.minigame) this.minigame.update(dt, this);
          else if (!this.cinematic) { this.updatePlayer(dt); this.updateFocus(); }
          if (this.world && this.world.onUpdate && !this.minigame) this.world.onUpdate(dt, this);
        }
        this.render(now || 0);
      }
    },
    startLoop() { if (!this._looping) { this._looping = true; requestAnimationFrame((n) => this.loop(n)); } },
    stopGame() { this.running = false; this.world = null; this.minigame = null; this.cinematic = false; this.paused = false; },
  });

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  MET.lighten = lighten;
})();
