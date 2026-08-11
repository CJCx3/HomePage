/* =========================================================================
   Site password gate — "Made by Connor" (comic-book styling)
   Shown on entry AND on every refresh. The password is stored only as a
   SHA-256 hash (no plaintext here) and checked in-browser.

   NOTE: a *client-side* gate on a *public* site deters casual visitors but is
   NOT real security — the source and public repo are readable. Real protection
   is that no sensitive data is published (Home Hub was scrubbed). Requires a
   secure context (HTTPS / localhost) for crypto.subtle — GitHub Pages is HTTPS.
   ========================================================================= */
(function () {
  "use strict";
  var HASH = "d12df13aa9a4dccaef29a7c46de2fa4e90f87d5357b19fafa8e3e7ef30ecd5b1";
  var KEY = "mbc_gate_v1";

  /* Re-prompt after a refresh: a reload clears the session unlock, while normal
     navigation between pages keeps it (so you don't retype on every click). */
  try {
    var navType = "";
    var entries = performance.getEntriesByType && performance.getEntriesByType("navigation");
    if (entries && entries.length) navType = entries[0].type;
    else if (performance.navigation) navType = performance.navigation.type === 1 ? "reload" : "";
    if (navType === "reload") sessionStorage.removeItem(KEY);
  } catch (e) {}

  try { if (sessionStorage.getItem(KEY) === "ok") return; } catch (e) {}

  var de = document.documentElement;
  de.classList.add("gate-locked");

  /* make sure the comic fonts are available even on project pages */
  if (!document.querySelector("link[data-gate-fonts]")) {
    var lf = document.createElement("link");
    lf.rel = "stylesheet";
    lf.setAttribute("data-gate-fonts", "");
    lf.href = "https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@700&display=swap";
    (document.head || de).appendChild(lf);
  }

  var st = document.createElement("style");
  st.textContent =
    ".gate-locked body{visibility:hidden!important}" +
    ".gate-locked .gate{visibility:visible!important}" +
    ".gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;" +
      "font-family:'Comic Neue',system-ui,sans-serif;background:#f3e6c2;" +
      "background-image:radial-gradient(rgba(23,19,13,.2) 1.3px,transparent 1.5px);background-size:9px 9px}" +
    ".gate__card{position:relative;width:min(400px,92vw);text-align:center;padding:30px 26px;background:#fffdf6;" +
      "border:3px solid #17130d;border-radius:6px;box-shadow:9px 9px 0 #17130d;transform:rotate(-1deg)}" +
    ".gate__mark{font-family:'Bangers',system-ui,sans-serif;color:#ff3b3b;font-size:2.1rem;line-height:1;letter-spacing:.02em;" +
      "-webkit-text-stroke:2px #17130d;paint-order:stroke fill;text-shadow:3px 3px 0 #17130d}" +
    ".gate__sub{color:#17130d;font-weight:700;font-size:.95rem;margin:.7em auto 1.4em;max-width:26ch}" +
    ".gate__form{display:flex;flex-direction:column;gap:12px}" +
    ".gate__in{font-family:'Comic Neue',sans-serif;font-weight:700;padding:.8em 1em;border-radius:6px;border:3px solid #17130d;" +
      "background:#fff;color:#17130d;font-size:1rem;text-align:center;letter-spacing:.14em}" +
    ".gate__in:focus{outline:3px solid #2b7fff;outline-offset:1px}" +
    ".gate__btn{font-family:'Bangers',system-ui,sans-serif;cursor:pointer;padding:.5em 1em;border:3px solid #17130d;border-radius:6px;" +
      "color:#fff;-webkit-text-stroke:1px #17130d;paint-order:stroke fill;background:#ff3b3b;font-size:1.3rem;letter-spacing:.05em;" +
      "box-shadow:4px 4px 0 #17130d;transition:transform .1s,box-shadow .1s}" +
    ".gate__btn:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 #17130d}" +
    ".gate__btn:active{transform:translate(2px,2px);box-shadow:0 0 0 #17130d}" +
    ".gate__err{color:#d21f2f;font-weight:700;font-size:.9rem;min-height:1.2em}";
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
        '<div class="gate__sub">Say the magic word to read on.</div>' +
        '<form class="gate__form" autocomplete="off">' +
          '<input class="gate__in" type="password" inputmode="text" autocomplete="off" placeholder="Password" aria-label="Password" />' +
          '<button class="gate__btn" type="submit">Enter!</button>' +
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
        err.textContent = "Open this over HTTPS to unlock.";
        return;
      }
      sha256Hex(input.value).then(function (h) {
        if (h === HASH) {
          try { sessionStorage.setItem(KEY, "ok"); } catch (e) {}
          de.classList.remove("gate-locked");
          g.remove();
        } else {
          err.textContent = "Nope! Try again.";
          input.value = "";
          input.focus();
        }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
