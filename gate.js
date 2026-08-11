/* =========================================================================
   Site password gate — "Made by Connor"
   A soft entry barrier shown on first visit each session. The password is
   stored only as a SHA-256 hash (no plaintext here), checked in-browser.

   NOTE: this is a *client-side* gate on a *public* site. It deters casual
   visitors, but it is NOT real security — anyone can read the page source or
   the public repo. Real protection = don't publish sensitive data (the repo's
   personal data has been scrubbed) or host from a private repo.

   Requires a secure context (HTTPS / localhost) for crypto.subtle — GitHub
   Pages serves HTTPS, so it works there.
   ========================================================================= */
(function () {
  "use strict";
  var HASH = "d12df13aa9a4dccaef29a7c46de2fa4e90f87d5357b19fafa8e3e7ef30ecd5b1";
  var KEY = "mbc_gate_v1";

  try { if (sessionStorage.getItem(KEY) === "ok") return; } catch (e) {}

  var de = document.documentElement;
  de.classList.add("gate-locked");

  var st = document.createElement("style");
  st.textContent =
    ".gate-locked body{visibility:hidden!important}" +
    ".gate-locked .gate{visibility:visible!important}" +
    ".gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:radial-gradient(120% 100% at 50% -10%,#1b1230,#0a0710 75%);" +
      "font-family:'Archivo',system-ui,-apple-system,sans-serif}" +
    ".gate__card{width:min(400px,90vw);text-align:center;padding:34px 28px;border-radius:18px;" +
      "background:#140d20;border:1px solid #2a1f3d;box-shadow:0 30px 80px -30px #000}" +
    ".gate__mark{font-family:'Bungee',system-ui,sans-serif;color:#ffd23f;font-size:1.5rem;line-height:1.1;" +
      "text-shadow:0 0 18px rgba(255,210,63,.5)}" +
    ".gate__sub{color:#cdbfe4;font-size:.92rem;margin:.7em 0 1.4em}" +
    ".gate__form{display:flex;flex-direction:column;gap:10px}" +
    ".gate__in{padding:.85em 1em;border-radius:10px;border:1px solid #2a1f3d;background:#0c0814;color:#f6f1ff;" +
      "font-size:1rem;text-align:center;letter-spacing:.14em}" +
    ".gate__in:focus{outline:2px solid #ffd23f;outline-offset:1px}" +
    ".gate__btn{font-family:'Bungee',system-ui,sans-serif;cursor:pointer;padding:.8em 1em;border:0;border-radius:10px;" +
      "color:#160c02;background:#ffd23f;font-size:.95rem}" +
    ".gate__btn:hover{filter:brightness(1.06)}" +
    ".gate__err{color:#ff7a90;font-size:.85rem;min-height:1.2em}";
  (document.head || de).appendChild(st);

  function sha256Hex(str) {
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  function build() {
    var g = document.createElement("div");
    g.className = "gate";
    g.innerHTML =
      '<div class="gate__card" role="dialog" aria-modal="true" aria-label="Password required">' +
        '<div class="gate__mark">MADE&nbsp;BY&nbsp;CONNOR</div>' +
        '<div class="gate__sub">Enter the password to continue.</div>' +
        '<form class="gate__form" autocomplete="off">' +
          '<input class="gate__in" type="password" inputmode="text" autocomplete="off" placeholder="Password" aria-label="Password" />' +
          '<button class="gate__btn" type="submit">Enter</button>' +
          '<div class="gate__err" role="alert"></div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(g);

    var form = g.querySelector("form");
    var input = g.querySelector("input");
    var err = g.querySelector(".gate__err");
    input.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!(window.crypto && crypto.subtle)) {
        err.textContent = "This page must be opened over HTTPS to unlock.";
        return;
      }
      sha256Hex(input.value).then(function (h) {
        if (h === HASH) {
          try { sessionStorage.setItem(KEY, "ok"); } catch (e) {}
          de.classList.remove("gate-locked");
          g.remove();
        } else {
          err.textContent = "Nope. Try again.";
          input.value = "";
          input.focus();
        }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
