/* =========================================================================
   MADE BY CONNOR — arcade hub
   Tiny progressive-enhancement layer:
     · counts how many cabinets are plugged in (data-live="true") and lights
       the "online" chip green when any are;
     · intercepts clicks on cabinets that aren't wired up yet and pops an
       arcade "insert coin" toast instead of following a dead link.
   The page is fully legible and styled without any of this.
   ========================================================================= */
(function () {
  "use strict";

  var doc = document;

  /* power-on reveal without fighting :hover — see styles.css */
  doc.documentElement.classList.add("is-loading");
  window.addEventListener("load", function () {
    requestAnimationFrame(function () {
      doc.documentElement.classList.remove("is-loading");
    });
  });

  var cabs = Array.prototype.slice.call(doc.querySelectorAll(".cab"));

  /* ---- online counter ---- */
  var online = cabs.filter(function (c) { return c.getAttribute("data-live") === "true"; }).length;
  var countEl = doc.querySelector("[data-online-count]");
  if (countEl) countEl.textContent = String(online);
  var liveChip = doc.querySelector(".chip--live");
  if (liveChip && online > 0) {
    var led = liveChip.querySelector(".led");
    if (led) led.style.setProperty("--led", "#37e29a");
  }

  /* ---- toast for cabinets that aren't plugged in yet ---- */
  var toast = doc.querySelector(".toast");
  var toastTimer = null;
  function pop(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-on");
    }, 2200);
  }

  cabs.forEach(function (cab) {
    cab.addEventListener("click", function (e) {
      if (cab.getAttribute("data-live") === "true") return; // real link, let it go
      e.preventDefault();
      var name = (cab.querySelector(".cab__title") || {}).textContent || "This cabinet";
      pop("⚡ " + name + " isn't plugged in yet");
    });
  });
})();
