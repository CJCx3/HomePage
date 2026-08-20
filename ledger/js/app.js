/* ══════════════════════════════════════════════════════════════════════════
   Ledger · app.js — bootstrap, routing, theme, and global event handling.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const L = window.L;
  const ui = L.ui, D = L.D, S = L.S, M = L.M, money = L.money;

  let currentView = "overview";
  const renderers = {
    overview: ui.overview,
    accounts: ui.accounts,
    transactions: ui.transactions,
    budget: ui.budget,
    reports: ui.reports,
    settings: ui.settings,
  };

  /* ───────────────────────  render / routing  ─────────────────────── */
  L.render = function (view) {
    view = view || currentView;
    currentView = view;
    document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== view));
    document.querySelectorAll(".nav__item").forEach((n) => n.classList.toggle("is-active", n.dataset.nav === view));
    const el = document.getElementById("view-" + view);
    if (renderers[view]) renderers[view](el);
    updateMonthLabel();
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  };
  L.renderAll = function () {
    L.render(currentView);
  };
  L.go = function (view) {
    L.render(view);
  };
  L.app = { go: L.go };

  function updateMonthLabel() {
    document.getElementById("monthLabel").textContent = D.monthLabel(ui.month, true);
  }

  /* ───────────────────────────  theme  ────────────────────────────── */
  L.applyTheme = function () {
    const t = L.state.settings.theme || "auto";
    const root = document.documentElement;
    if (t === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    const dark = t === "dark" || (t === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0f1216" : "#f4f1ea");
  };
  function toggleTheme() {
    const cur = L.state.settings.theme || "auto";
    // topbar quick toggle: light <-> dark based on what's showing now
    const dark = cur === "dark" || (cur === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    L.state.settings.theme = dark ? "light" : "dark";
    L.store.save();
    L.applyTheme();
    if (currentView === "settings") L.render("settings");
  }

  /* ───────────────────────────  month nav  ────────────────────────── */
  function shiftMonth(n) {
    ui.month = D.addMonths(ui.month, n);
    L.renderAll();
  }

  /* ───────────────────────  file helpers  ─────────────────────────── */
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }
  function pickFile(cb) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.addEventListener("change", () => {
      const file = inp.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => cb(r.result);
      r.readAsText(file);
    });
    inp.click();
  }
  function stamp() {
    return D.iso().replace(/-/g, "");
  }

  /* ───────────────────────  action handlers  ──────────────────────── */
  const actions = {
    "add-tx": () => ui.txForm(),
    "add-account": () => ui.accountForm(),
    "add-category": () => ui.categoryForm(),
    "add-recurring": () => ui.recurringForm(),
    "clear-filters": () => { ui.txFilter = { account: "", category: "", type: "", search: "", scope: ui.txFilter.scope }; L.render("transactions"); },
    "copy-budget": () => {
      const prev = D.addMonths(ui.month, -1);
      const n = M.copyBudget(prev, ui.month);
      L.render("budget");
      ui.toast(n ? `Copied ${n} amounts from ${D.monthLabel(prev)}` : `Nothing budgeted in ${D.monthLabel(prev)}`);
    },
    "auto-budget": () => {
      ui.confirm("Auto-budget", "Fill this month's budget with your average spending from the last 3 months? This overwrites current amounts.", "Auto-budget", () => {
        const n = M.autoBudget(ui.month, 3);
        ui.closeModal();
        L.render("budget");
        ui.toast(n ? `Budgeted ${n} categories` : "No spending history to average yet");
      });
    },
    "export-json": () => { download(`ledger-backup-${stamp()}.json`, L.store.exportJSON()); ui.toast("Backup downloaded"); },
    "export-csv": () => { download(`ledger-transactions-${stamp()}.csv`, L.store.exportCSV(), "text/csv"); ui.toast("CSV downloaded"); },
    "import-json": () => {
      pickFile((text) => {
        try {
          L.store.importJSON(text);
          L.applyTheme();
          L.store.runRecurring();
          L.renderAll();
          ui.toast("Backup imported");
        } catch (e) { ui.toast("Couldn’t read that file"); }
      });
    },
    "load-sample": () => {
      const act = () => { L.store.loadSample(); ui.closeModal(); ui.month = D.monthKey(new Date()); L.applyTheme(); L.renderAll(); ui.toast("Sample data loaded"); };
      if (L.state.transactions.length || L.state.accounts.length)
        ui.confirm("Load sample data", "This replaces your current data with a demo budget. Export a backup first if you want to keep it.", "Replace with sample", act, true);
      else act();
    },
    "reset-all": () => {
      ui.confirm("Erase everything", "Permanently delete all accounts, transactions, budgets, and settings on this device. This cannot be undone.", "Erase everything", () => {
        L.store.resetAll();
        ui.closeModal();
        ui.month = D.monthKey(new Date());
        L.applyTheme();
        L.renderAll();
        ui.toast("All data erased");
      }, true);
    },
  };

  /* ───────────────────────  global click delegation  ───────────────── */
  document.addEventListener("click", (e) => {
    const t = e.target;

    // close modal
    if (t.closest("[data-close]")) { ui.closeModal(); return; }

    // nav
    const nav = t.closest("[data-nav]");
    if (nav) { L.render(nav.dataset.nav); return; }

    // actions
    const act = t.closest("[data-act]");
    if (act && actions[act.dataset.act]) { actions[act.dataset.act](); return; }

    // month scope on ledger
    const scope = t.closest("[data-scope]");
    if (scope) { ui.txFilter.scope = scope.dataset.scope; L.render("transactions"); return; }

    // report range
    const months = t.closest("[data-months]");
    if (months) { ui.reportMonths = +months.dataset.months; L.render("reports"); return; }

    // account: edit
    const editAcct = t.closest("[data-edit-account]");
    if (editAcct) { ui.accountForm(S.account(editAcct.dataset.editAccount)); return; }
    // account: delete (from form)
    const delAcct = t.closest("[data-del-account]");
    if (delAcct) {
      const a = S.account(delAcct.dataset.delAccount);
      const count = S.txForAccount(a.id).length;
      ui.confirm("Delete account", `Delete “${a.name}”?${count ? ` Its ${count} transaction${count > 1 ? "s" : ""} will also be removed.` : ""}`, "Delete", () => {
        M.deleteAccount(a.id, true); ui.closeModal(); L.renderAll(); ui.toast("Account deleted");
      }, true);
      return;
    }
    // account card → view its ledger
    const acctCard = t.closest("[data-account]");
    if (acctCard) {
      ui.txFilter = { account: acctCard.dataset.account, category: "", type: "", search: "", scope: "all" };
      L.render("transactions");
      return;
    }

    // transaction row → edit
    const txEl = t.closest("[data-tx]");
    if (txEl) { const tx = L.state.transactions.find((x) => x.id === txEl.dataset.tx); if (tx) ui.txForm(tx); return; }
    const delTx = t.closest("[data-del-tx]");
    if (delTx) { M.deleteTx(delTx.dataset.delTx); ui.closeModal(); L.renderAll(); ui.toast("Transaction deleted"); return; }

    // category manage
    const editCat = t.closest("[data-edit-cat]");
    if (editCat) { ui.categoryForm(S.cat(editCat.dataset.editCat)); return; }
    const delCat = t.closest("[data-del-cat]");
    if (delCat) {
      const c = S.cat(delCat.dataset.delCat);
      const used = L.state.transactions.filter((x) => x.categoryId === c.id).length;
      ui.confirm("Delete category", `Delete “${c.name}”?${used ? ` ${used} transaction${used > 1 ? "s" : ""} will become uncategorized.` : ""}`, "Delete", () => {
        M.deleteCategory(c.id); ui.closeModal(); L.render("settings"); ui.toast("Category deleted");
      }, true);
      return;
    }

    // recurring manage
    const editRec = t.closest("[data-edit-rec]");
    if (editRec) { ui.recurringForm(L.state.recurring.find((r) => r.id === editRec.dataset.editRec)); return; }
    const delRec = t.closest("[data-del-rec]");
    if (delRec) {
      const r = L.state.recurring.find((x) => x.id === delRec.dataset.delRec);
      ui.confirm("Delete recurring", `Stop “${r.name}”? Transactions already posted stay in your ledger.`, "Delete", () => {
        M.deleteRecurring(r.id); ui.closeModal(); L.render("settings"); ui.toast("Recurring deleted");
      }, true);
      return;
    }
  });

  // keyboard: Enter/Space on tx rows, Escape closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("modal").hidden) { ui.closeModal(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("tx")) {
      e.preventDefault();
      const tx = L.state.transactions.find((x) => x.id === e.target.dataset.tx);
      if (tx) ui.txForm(tx);
    }
    // quick add with "n"
    if (e.key === "n" && document.getElementById("modal").hidden && !/input|textarea|select/i.test((e.target.tagName || ""))) {
      ui.txForm();
    }
  });

  /* ───────────────────────  static controls  ──────────────────────── */
  document.getElementById("addBtn").addEventListener("click", () => ui.txForm());
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
  document.getElementById("monthPrev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("monthNext").addEventListener("click", () => shiftMonth(1));
  document.getElementById("monthLabel").addEventListener("click", () => {
    const cur = D.monthKey(new Date());
    if (ui.month !== cur) { ui.month = cur; L.renderAll(); ui.toast("Jumped to " + D.monthLabel(cur)); }
  });

  // react to system theme changes when in auto
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if ((L.state.settings.theme || "auto") === "auto") L.applyTheme();
    });
  }

  /* ───────────────────────────  init  ─────────────────────────────── */
  function init() {
    L.store.load();
    L.applyTheme();
    const posted = L.store.runRecurring();
    document.getElementById("app").hidden = false;
    L.render("overview");
    if (posted) ui.toast(posted + " recurring transaction" + (posted > 1 ? "s" : "") + " posted");

    // service worker (only works when served over http/https; no-op on file://)
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
