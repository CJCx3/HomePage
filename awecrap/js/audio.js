/* AWECRAP — audio.js
 * Music manager. Every track loops for as long as its screen/fight lasts;
 * switching screens crossfades (~0.9s). Handles the browser autoplay policy:
 * play() before the first user gesture is deferred and fires on unlock.
 *
 * SO.Audio.play(id)        — id from SO.MUSIC ('menu','map','duel_point',...)
 * SO.Audio.trackForDuel(d) — boss id → its theme; else by enemy archetype
 * SO.Audio.sting(id)       — one-shot from SO.SFX ('victory','defeat','boss_down')
 * SO.Audio.setVolume(v)    — 0..1, persisted by the Settings slider
 *
 * Channels: two crossfading music players (_a/_b) + a persistent ambience bed
 * (_amb, loops casino murmur under everything at AMB_SCALE of master) + short
 * one-shot stingers (fresh element per call, GC'd on end).
 */
window.SO = window.SO || {};

(function () {
  const FADE_MS = 900;
  const AMB_SCALE = 0.4;   // casino ambience sits under the music at 40% of master

  const Audio_ = {
    volume: 0.7,
    current: null,      // track id actually playing
    desired: null,      // track id we want (deferred until unlock)
    unlocked: false,
    _a: null, _b: null, // two players; _a is always the active one
    _amb: null,         // ambience bed (loops forever once unlocked)
    _fadeTimer: null,
    _ambFade: null,

    _ensure() {
      if (this._a || typeof Audio === 'undefined') return;
      this._a = new Audio(); this._b = new Audio();
      for (const p of [this._a, this._b]) { p.loop = true; p.preload = 'auto'; p.volume = 0; }
      if (SO.AMBIENCE && SO.AMBIENCE.casino) {
        this._amb = new Audio(); this._amb.loop = true; this._amb.preload = 'auto';
        this._amb.volume = 0; this._amb.src = SO.AMBIENCE.casino;
      }
      const unlock = () => this.unlock();
      document.addEventListener('pointerdown', unlock, { once: false });
      document.addEventListener('keydown', unlock, { once: false });
    },

    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      this._startAmbience();
      if (this.desired) { const id = this.desired; this.desired = null; this.play(id); }
    },

    // fade the casino bed in and leave it looping under whatever plays
    _startAmbience() {
      if (!this._amb) return;
      const target = this.volume * AMB_SCALE;
      const pr = this._amb.play();
      if (pr && pr.catch) pr.catch(() => { this.unlocked = false; }); // retry next gesture
      if (this._ambFade) clearInterval(this._ambFade);
      const start = Date.now();
      this._ambFade = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / FADE_MS);
        this._amb.volume = target * t;
        if (t >= 1) { clearInterval(this._ambFade); this._ambFade = null; this._amb.volume = this.volume * AMB_SCALE; }
      }, 50);
    },

    // short non-looping stinger over the music (victory/defeat/boss_down)
    sting(id) {
      this._ensure();
      if (typeof Audio === 'undefined' || !SO.SFX || !SO.SFX[id]) return;
      if (this.volume <= 0 || !this.unlocked) return;   // muted, or no gesture yet
      const el = new Audio(SO.SFX[id]);
      el.volume = Math.min(1, this.volume);
      el.addEventListener('ended', () => { el.removeAttribute('src'); });
      const pr = el.play();
      if (pr && pr.catch) pr.catch(() => {});
    },

    trackForDuel(duel) {
      const def = duel.opponent.def || {};
      if (duel.isBoss && SO.MUSIC['boss_' + def.id]) return 'boss_' + def.id;
      // an archetype plays its own theme if one exists (e.g. 'come' once music_duel_come
      // lands in SO.MUSIC), else falls back to the Point track.
      if (SO.MUSIC['duel_' + def.archetype]) return 'duel_' + def.archetype;
      const arch = ['point', 'attrition', 'prop', 'control'].includes(def.archetype) ? def.archetype : 'point';
      return 'duel_' + arch;
    },

    play(id) {
      this._ensure();
      if (!this._a || !SO.MUSIC || !SO.MUSIC[id]) return;
      if (id === this.current && !this._a.paused) return;   // already looping this track
      if (!this.unlocked) { this.desired = id; return; }    // wait for first gesture

      // swap players: fade the old out, the new in
      const out = this._a, into = this._b;
      this._a = into; this._b = out;
      into.src = SO.MUSIC[id];
      into.loop = true;
      into.currentTime = 0;
      const p = into.play();
      if (p && p.catch) p.catch(() => { /* autoplay refused — retry on next gesture */ this.unlocked = false; this.desired = id; this.current = null; return; });
      this.current = id;
      this._fade(into, out);
    },

    stop() {
      if (this._fadeTimer) clearInterval(this._fadeTimer);
      for (const p of [this._a, this._b]) if (p) { p.pause(); p.volume = 0; }
      this.current = null; this.desired = null;
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this._a && !this._fadeTimer) this._a.volume = this.volume;
      if (this.volume === 0) { if (this._a) this._a.volume = 0; if (this._b) this._b.volume = 0; }
      if (this._amb && !this._ambFade) this._amb.volume = this.volume * AMB_SCALE;
    },

    // timestamp-based crossfade — correct even when hidden tabs throttle timers
    _fade(into, out) {
      if (this._fadeTimer) clearInterval(this._fadeTimer);
      const start = Date.now();
      const outFrom = out ? out.volume : 0;
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / FADE_MS);
        into.volume = this.volume * t;
        if (out) out.volume = outFrom * (1 - t);
        if (t >= 1) {
          clearInterval(this._fadeTimer); this._fadeTimer = null;
          into.volume = this.volume;
          if (out) { out.pause(); out.volume = 0; out.removeAttribute('src'); out.load(); }
        }
      };
      this._fadeTimer = setInterval(step, 50);
      step();
    },
  };

  SO.Audio = Audio_;
})();
