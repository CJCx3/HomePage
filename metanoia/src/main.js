/* Metanoia — main.js
 * Boot: init engine, wire menu + settings + pause + board, begin. */
(function () {
  "use strict";
  const MET = window.MET, E = MET.engine, S = MET.settings, Audio = MET.audio, Music = MET.music;
  const $ = (id) => document.getElementById(id);

  function syncSettingsUI() {
    $("setMaster").value = Math.round(S.master * 100);
    $("setMusic").value = Math.round(S.music * 100);
    $("setSfx").value = Math.round(S.sfx * 100);
    $("setText").value = Math.round(S.textSpeed * 100);
    $("setGrain").checked = !!S.grain;
    $("setVignette").checked = !!S.vignette;
  }
  function openSettings() { syncSettingsUI(); $("settings").classList.remove("hidden"); }
  function closeSettings() { S.save(); $("settings").classList.add("hidden"); }

  let audioReady = false;
  function ensureAudio(playMenu) {
    if (!audioReady) {
      Audio.start(); Music.init(); audioReady = true; S.apply();
    }
    Audio.resume();
    if (playMenu && $("title") && !$("title").classList.contains("hide")) Music.play("menu");
  }

  function boot() {
    S.load();
    E.init();
    S.apply();

    // Start audio + menu music on the first user interaction (autoplay policy).
    const firstGesture = () => { ensureAudio(true); window.removeEventListener("pointerdown", firstGesture); window.removeEventListener("keydown", firstGesture); };
    window.addEventListener("pointerdown", firstGesture);
    window.addEventListener("keydown", firstGesture);

    // --- Title menu ---
    $("beginBtn").addEventListener("click", () => { ensureAudio(false); Music.stop(); MET.game.start(); });
    $("settingsBtn").addEventListener("click", openSettings);
    $("quitBtn").addEventListener("click", () => {
      window.open("", "_self"); window.close();
      setTimeout(() => { document.body.innerHTML = "<div style='color:#9a9488;font-family:Georgia,serif;display:flex;height:100vh;align-items:center;justify-content:center;font-style:italic;letter-spacing:0.1em'>You can close this tab now. Thank you for noticing.</div>"; }, 120);
    });

    // --- Settings panel ---
    $("settingsClose").addEventListener("click", closeSettings);
    const bind = (id, fn) => $(id).addEventListener("input", () => { fn($(id)); S.apply(); S.save(); });
    bind("setMaster", (el) => S.master = el.value / 100);
    bind("setMusic", (el) => S.music = el.value / 100);
    bind("setSfx", (el) => S.sfx = el.value / 100);
    bind("setText", (el) => S.textSpeed = el.value / 100);
    bind("setGrain", (el) => S.grain = el.checked);
    bind("setVignette", (el) => S.vignette = el.checked);

    // --- Pause menu ---
    $("resumeBtn").addEventListener("click", () => { E.hidePause(); });
    $("pause").addEventListener("click", (e) => { if (e.target.id === "pause") E.hidePause(); });
    $("pauseSettingsBtn").addEventListener("click", openSettings);
    $("pauseQuitBtn").addEventListener("click", () => { $("pause").classList.add("hidden"); MET.game.quitToMenu(); });

    // --- Board ---
    $("boardClose").addEventListener("click", () => MET.game.closeBoard());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
