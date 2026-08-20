/* ══════════════════════════════════════════════════════════════════════════
   Ledger · ui.js — view rendering, forms, modals, toast.
   Each view renderer receives its container element and fills it.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const L = (window.L = window.L || {});
  const money = L.money, D = L.D, S = L.S, M = L.M, charts = L.charts, icon = L.icon;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const ui = (L.ui = {
    month: D.monthKey(new Date()),
    txFilter: { account: "", category: "", type: "", search: "", scope: "month" },
    reportMonths: 6,
  });

  /* mini svg action glyphs */
  const G = {
    edit: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 20h4L18 10l-4-4L4 16v4ZM14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="13" height="13"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  };

  /* ─────────────────────────  toast + modal  ───────────────────────── */
  let toastTimer;
  ui.toast = function (msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("is-in");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("is-in");
      setTimeout(() => (t.hidden = true), 200);
    }, 2200);
  };

  ui.openModal = function (title, bodyHTML, setup) {
    document.getElementById("modalTitle").textContent = title;
    const body = document.getElementById("modalBody");
    body.innerHTML = bodyHTML;
    const modal = document.getElementById("modal");
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    if (setup) setup(body);
    const first = body.querySelector("input,select,textarea,button");
    if (first && first.type !== "button") setTimeout(() => first.focus(), 60);
  };
  ui.closeModal = function () {
    const modal = document.getElementById("modal");
    modal.classList.remove("is-open");
    setTimeout(() => (modal.hidden = true), 200);
  };

  /* ─────────────────────────  small builders  ──────────────────────── */
  function chip(color, iconKey, size) {
    return `<span class="chip" style="--c:${color}">${icon(iconKey, size || 18)}</span>`;
  }
  function amountClass(type) {
    return type === "income" ? "amt amt--pos" : type === "transfer" ? "amt amt--muted" : "amt amt--neg";
  }
  function signedAmount(t) {
    if (t.type === "income") return money.fmt(t.amount, { sign: true });
    if (t.type === "transfer") return money.fmt(t.amount);
    return "−" + money.fmt(t.amount);
  }
  function sectionHead(title, actionHTML) {
    return `<div class="section-head"><h2 class="section-head__title">${esc(title)}</h2>${actionHTML || ""}</div>`;
  }
  function empty(iconKey, title, sub, actionHTML) {
    return `<div class="empty">${icon(iconKey, 40)}<p class="empty__title">${esc(title)}</p><p class="empty__sub">${esc(sub || "")}</p>${actionHTML || ""}</div>`;
  }

  /* ═══════════════════════════  OVERVIEW  ═══════════════════════════ */
  ui.overview = function (el) {
    const mk = ui.month;
    const income = S.monthIncome(mk), expense = S.monthExpense(mk), net = income - expense;
    const budgetTotal = S.budgetTotal(mk);
    const spentByCat = S.spentByCategory(mk);
    const spentTotal = Object.values(spentByCat).reduce((s, v) => s + v, 0);
    const budgetRemaining = budgetTotal - spentTotal;
    const netWorth = S.netWorth();
    const hasData = L.state.transactions.length || L.state.accounts.length;

    if (!hasData) {
      el.innerHTML = empty(
        "wallet",
        "Welcome to Ledger",
        "A private budgeting app that keeps every number on this device. Add an account, or load sample data from Settings to explore.",
        `<div class="empty__actions"><button class="btn btn--primary" data-act="add-account">${G.plus}<span>Add an account</span></button><button class="btn btn--ghost" data-act="load-sample">Load sample data</button></div>`
      );
      return;
    }

    // top spending categories this month
    const cats = Object.keys(spentByCat)
      .map((cid) => ({ cid, val: spentByCat[cid], cat: cid === "__none" ? null : S.cat(cid) }))
      .filter((x) => x.val > 0)
      .sort((a, b) => b.val - a.val);
    const donutSegs = cats.slice(0, 6).map((x) => ({ value: x.val, color: x.cat ? x.cat.color : "#8b8f98", label: (x.cat ? x.cat.name : "Uncategorized") + " · " + money.fmt(x.val) }));
    if (cats.length > 6) donutSegs.push({ value: cats.slice(6).reduce((s, x) => s + x.val, 0), color: "#6b7280", label: "Other" });

    const recent = S.sortedTx().slice(0, 7);

    el.innerHTML = `
      <div class="stat-hero">
        <div class="stat"><span class="stat__k">Income</span><span class="stat__v amt--pos">${money.fmt(income)}</span></div>
        <div class="stat"><span class="stat__k">Spending</span><span class="stat__v amt--neg">${money.fmt(expense)}</span></div>
        <div class="stat stat--net"><span class="stat__k">Net this month</span><span class="stat__v ${net >= 0 ? "amt--pos" : "amt--neg"}">${money.fmt(net, { sign: true })}</span></div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          ${sectionHead("Budget", `<button class="link" data-nav="budget">Manage ${G.chevron}</button>`)}
          <div class="budget-summary">
            ${charts.ring(budgetTotal ? spentTotal / budgetTotal : 0, { size: 92, sw: 10 })}
            <div class="budget-summary__nums">
              <div><span class="k">Budgeted</span><span class="v">${money.fmt(budgetTotal)}</span></div>
              <div><span class="k">Spent</span><span class="v">${money.fmt(spentTotal)}</span></div>
              <div><span class="k">${budgetRemaining >= 0 ? "Remaining" : "Over"}</span><span class="v ${budgetRemaining >= 0 ? "amt--pos" : "amt--neg"}">${money.fmt(Math.abs(budgetRemaining))}</span></div>
            </div>
          </div>
          ${budgetTotal === 0 ? `<button class="btn btn--ghost btn--block" data-nav="budget">Set up this month’s budget</button>` : ""}
        </div>

        <div class="card">
          ${sectionHead("Where it went", `<button class="link" data-nav="reports">Reports ${G.chevron}</button>`)}
          <div class="donut-wrap">
            ${charts.donut(donutSegs, { center: money.fmt(spentTotal), sub: "spent", aria: "Spending by category" })}
            <ul class="legend">
              ${cats.slice(0, 5).map((x) => `<li><span class="legend__dot" style="background:${x.cat ? x.cat.color : "#8b8f98"}"></span><span class="legend__name">${esc(x.cat ? x.cat.name : "Uncategorized")}</span><span class="legend__val">${money.fmt(x.val)}</span></li>`).join("") || `<li class="legend__none">No spending yet this month</li>`}
            </ul>
          </div>
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          ${sectionHead("Accounts", `<button class="link" data-nav="accounts">All ${G.chevron}</button>`)}
          <div class="networth"><span class="networth__k">Net worth</span><span class="networth__v ${netWorth >= 0 ? "" : "amt--neg"}">${money.fmt(netWorth)}</span></div>
          <ul class="acct-mini">
            ${S.activeAccounts().slice(0, 5).map((a) => { const b = S.accountBalance(a.id); return `<li>${chip(a.color, L.accountIcon(a.type), 16)}<span class="acct-mini__name">${esc(a.name)}</span><span class="acct-mini__bal ${b < 0 ? "amt--neg" : ""}">${money.fmt(b)}</span></li>`; }).join("") || `<li class="legend__none">No accounts yet</li>`}
          </ul>
        </div>

        <div class="card">
          ${sectionHead("Recent activity", `<button class="link" data-nav="transactions">Ledger ${G.chevron}</button>`)}
          <ul class="txlist txlist--compact">
            ${recent.map(txRow).join("") || `<li class="legend__none">No transactions yet</li>`}
          </ul>
        </div>
      </div>`;
  };

  /* single transaction row */
  function txRow(t) {
    const isTransfer = t.type === "transfer";
    const cat = isTransfer ? null : S.cat(t.categoryId);
    const color = isTransfer ? "#7d86b8" : cat ? cat.color : "#8b8f98";
    const iconKey = isTransfer ? "repeat" : cat ? cat.icon : "dots";
    const title = t.payee || (isTransfer ? "Transfer" : cat ? cat.name : "Uncategorized");
    const sub = isTransfer
      ? `${esc(S.accountName(t.accountId))} → ${esc(S.accountName(t.toAccountId))}`
      : `${esc(cat ? cat.name : "Uncategorized")} · ${esc(S.accountName(t.accountId))}`;
    return `<li class="tx" data-tx="${t.id}" tabindex="0">
      ${chip(color, iconKey, 18)}
      <div class="tx__main"><span class="tx__title">${esc(title)}</span><span class="tx__sub">${sub}</span></div>
      <div class="tx__right"><span class="${amountClass(t.type)}">${signedAmount(t)}</span><span class="tx__date">${D.prettyDateShort(t.date)}${t.cleared ? ` <span class="tx__cleared" title="Cleared">${G.check}</span>` : ""}</span></div>
    </li>`;
  }

  /* ═══════════════════════════  ACCOUNTS  ═══════════════════════════ */
  ui.accounts = function (el) {
    const accts = S.activeAccounts();
    const archived = L.state.accounts.filter((a) => a.archived);
    const netWorth = S.netWorth();
    const assets = accts.filter((a) => S.accountBalance(a.id) >= 0).reduce((s, a) => s + S.accountBalance(a.id), 0);
    const debts = accts.filter((a) => S.accountBalance(a.id) < 0).reduce((s, a) => s + S.accountBalance(a.id), 0);

    el.innerHTML = `
      ${sectionHead("Accounts", `<button class="btn btn--primary btn--sm" data-act="add-account">${G.plus}<span>Add</span></button>`)}
      <div class="stat-hero">
        <div class="stat"><span class="stat__k">Assets</span><span class="stat__v amt--pos">${money.fmt(assets)}</span></div>
        <div class="stat"><span class="stat__k">Debts</span><span class="stat__v amt--neg">${money.fmt(Math.abs(debts))}</span></div>
        <div class="stat stat--net"><span class="stat__k">Net worth</span><span class="stat__v ${netWorth >= 0 ? "" : "amt--neg"}">${money.fmt(netWorth)}</span></div>
      </div>
      ${accts.length
        ? `<div class="acct-grid">${accts.map(accountCard).join("")}</div>`
        : empty("bank", "No accounts", "Add checking, savings, cash, or a credit card to start tracking balances.", `<button class="btn btn--primary" data-act="add-account">${G.plus}<span>Add account</span></button>`)}
      ${archived.length ? `<details class="archived"><summary>Archived (${archived.length})</summary>${archived.map(accountCard).join("")}</details>` : ""}`;
  };

  function accountCard(a) {
    const bal = S.accountBalance(a.id);
    const cleared = clearedBalance(a.id);
    const typeLabel = { checking: "Checking", savings: "Savings", credit: "Credit card", cash: "Cash", investment: "Investment" }[a.type] || a.type;
    const goal = S.goal(a.id);
    return `<div class="acct-card" data-account="${a.id}" style="--c:${a.color}" role="button" tabindex="0">
      <div class="acct-card__top">${chip(a.color, L.accountIcon(a.type), 20)}<span class="acct-card__type">${esc(typeLabel)}</span><button class="iconbtn iconbtn--sm acct-card__edit" data-edit-account="${a.id}" aria-label="Edit ${esc(a.name)}">${G.edit}</button></div>
      <div class="acct-card__name">${esc(a.name)}</div>
      <div class="acct-card__bal ${bal < 0 ? "amt--neg" : ""}">${money.fmt(bal)}</div>
      <div class="acct-card__sub">${cleared !== bal ? `${money.fmt(cleared)} cleared` : "&nbsp;"}</div>
      ${goal ? goalBlock(goal) : ""}
    </div>`;
  }

  function goalBlock(g) {
    const pct = Math.round(Math.min(1, g.frac) * 100);
    const dateStr = g.date ? " · by " + D.monthLabel(D.monthKey(g.date)) : "";
    const fill = g.reached ? "var(--pos)" : "var(--c)";
    const sub = g.reached
      ? `<span class="acct-goal__done">${G.check} Goal reached</span>`
      : `<span>${money.fmt(g.remaining)} to go</span>${g.perMonth ? `<span class="acct-goal__pace">~${money.fmt(g.perMonth)}/mo</span>` : ""}`;
    return `<div class="acct-goal">
      <div class="acct-goal__top"><span class="acct-goal__label">${G.target} Goal${dateStr}</span><span class="acct-goal__pct">${pct}%</span></div>
      <div class="meter"><div class="meter__fill" style="width:${pct}%;background:${fill}"></div></div>
      <div class="acct-goal__sub">${sub}</div>
    </div>`;
  }
  function clearedBalance(id) {
    const a = S.account(id);
    let bal = a.startingBalance || 0;
    for (const t of L.state.transactions) {
      if (!t.cleared) continue;
      if (t.type === "income" && t.accountId === id) bal += t.amount;
      else if (t.type === "expense" && t.accountId === id) bal -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === id) bal -= t.amount;
        if (t.toAccountId === id) bal += t.amount;
      }
    }
    return bal;
  }

  /* ═══════════════════════════  TRANSACTIONS  ═══════════════════════ */
  ui.transactions = function (el) {
    const f = ui.txFilter;
    let list = S.sortedTx();
    if (f.scope === "month") list = list.filter((t) => t.date.slice(0, 7) === ui.month);
    if (f.account) list = list.filter((t) => t.accountId === f.account || t.toAccountId === f.account);
    if (f.category) list = list.filter((t) => t.categoryId === f.category);
    if (f.type) list = list.filter((t) => t.type === f.type);
    if (f.search) {
      const q = f.search.toLowerCase();
      list = list.filter((t) => (t.payee || "").toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q) || S.catName(t.categoryId).toLowerCase().includes(q));
    }

    const inflow = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const outflow = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    const accountOpts = `<option value="">All accounts</option>` + S.activeAccounts().map((a) => `<option value="${a.id}" ${f.account === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
    const catOpts = `<option value="">All categories</option>` + S.activeCategories().map((c) => `<option value="${c.id}" ${f.category === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("");

    // group by date
    const groups = {};
    list.forEach((t) => { (groups[t.date] = groups[t.date] || []).push(t); });
    const dates = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

    el.innerHTML = `
      ${sectionHead("Ledger", `<button class="btn btn--primary btn--sm" data-act="add-tx">${G.plus}<span>Add</span></button>`)}
      <div class="filters">
        <div class="search"><svg viewBox="0 0 24 24" width="17" height="17"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><input id="txSearch" type="search" placeholder="Search payee, note, category…" value="${esc(f.search)}" /></div>
        <div class="seg seg--scope">
          <button class="seg__btn ${f.scope === "month" ? "is-on" : ""}" data-scope="month">${esc(D.monthLabel(ui.month))}</button>
          <button class="seg__btn ${f.scope === "all" ? "is-on" : ""}" data-scope="all">All time</button>
        </div>
        <select id="txAccount" class="select">${accountOpts}</select>
        <select id="txCategory" class="select">${catOpts}</select>
        <select id="txType" class="select">
          <option value="">All types</option>
          <option value="expense" ${f.type === "expense" ? "selected" : ""}>Expense</option>
          <option value="income" ${f.type === "income" ? "selected" : ""}>Income</option>
          <option value="transfer" ${f.type === "transfer" ? "selected" : ""}>Transfer</option>
        </select>
        ${f.account || f.category || f.type || f.search ? `<button class="link" data-act="clear-filters">Clear</button>` : ""}
      </div>
      <div class="ledger-summary"><span>${list.length} transaction${list.length === 1 ? "" : "s"}</span><span class="amt--pos">${money.fmt(inflow)} in</span><span class="amt--neg">${money.fmt(outflow)} out</span></div>
      ${dates.length
        ? dates.map((d) => `<div class="daygroup"><div class="daygroup__head"><span>${D.prettyDate(d)}</span><span>${money.fmt(groups[d].reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0), { sign: true })}</span></div><ul class="txlist">${groups[d].map(txRow).join("")}</ul></div>`).join("")
        : empty("dots", "No transactions", f.search || f.account || f.category || f.type ? "Nothing matches these filters." : "Add your first transaction to start the ledger.", `<button class="btn btn--primary" data-act="add-tx">${G.plus}<span>Add transaction</span></button>`)}`;

    // wire filters
    const q = (id) => el.querySelector(id);
    q("#txSearch").addEventListener("input", (e) => { f.search = e.target.value; debouncedRerender(); });
    q("#txAccount").addEventListener("change", (e) => { f.account = e.target.value; L.render("transactions"); });
    q("#txCategory").addEventListener("change", (e) => { f.category = e.target.value; L.render("transactions"); });
    q("#txType").addEventListener("change", (e) => { f.type = e.target.value; L.render("transactions"); });
  };
  let rerenderTimer;
  function debouncedRerender() {
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      const el = document.getElementById("view-transactions");
      const active = document.activeElement;
      const val = active && active.id === "txSearch" ? active.value : null;
      const pos = active && active.selectionStart;
      ui.transactions(el);
      if (val !== null) {
        const s = el.querySelector("#txSearch");
        if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch (e) {} }
      }
    }, 180);
  }

  /* ═══════════════════════════  BUDGET  ═══════════════════════════ */
  ui.budget = function (el) {
    const mk = ui.month;
    const income = S.monthIncome(mk);
    const budgets = S.budgetsFor(mk);
    const spentByCat = S.spentByCategory(mk);
    const budgetTotal = S.budgetTotal(mk);
    const spentTotal = S.monthExpense(mk);
    const toBudget = income - budgetTotal;

    const expCats = S.expenseCategories();
    const groups = {};
    expCats.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });
    const groupOrder = Object.keys(groups);

    el.innerHTML = `
      ${sectionHead("Budget", `<div class="head-actions"><button class="btn btn--ghost btn--sm" data-act="copy-budget">Copy last month</button><button class="btn btn--ghost btn--sm" data-act="auto-budget">Auto-budget</button></div>`)}
      <div class="stat-hero">
        <div class="stat"><span class="stat__k">Income</span><span class="stat__v amt--pos">${money.fmt(income)}</span></div>
        <div class="stat"><span class="stat__k">Budgeted</span><span class="stat__v">${money.fmt(budgetTotal)}</span></div>
        <div class="stat stat--net"><span class="stat__k">${toBudget >= 0 ? "Left to budget" : "Over-allocated"}</span><span class="stat__v ${toBudget >= 0 ? "amt--pos" : "amt--neg"}">${money.fmt(Math.abs(toBudget))}</span></div>
      </div>
      <div class="budget-bar-wrap">
        <div class="budget-bar"><div class="budget-bar__spent" style="width:${budgetTotal ? Math.min(100, (spentTotal / budgetTotal) * 100) : 0}%"></div></div>
        <div class="budget-bar__labels"><span>Spent ${money.fmt(spentTotal)}</span><span>of ${money.fmt(budgetTotal)} budgeted</span></div>
      </div>
      ${groupOrder.map((g) => budgetGroup(g, groups[g], budgets, spentByCat)).join("")}
      <p class="hint">Tip: set an amount next to each category. Auto-budget averages your last 3 months of spending.</p>`;

    // wire inline budget inputs
    el.querySelectorAll(".binput").forEach((inp) => {
      inp.addEventListener("focus", (e) => e.target.select());
      inp.addEventListener("change", (e) => {
        M.setBudget(mk, e.target.dataset.cat, money.toCents(e.target.value));
        L.render("budget");
      });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
    });
  };

  function budgetGroup(name, cats, budgets, spentByCat) {
    const gBudget = cats.reduce((s, c) => s + (budgets[c.id] || 0), 0);
    const gSpent = cats.reduce((s, c) => s + (spentByCat[c.id] || 0), 0);
    return `<div class="bgroup">
      <div class="bgroup__head"><span>${esc(name)}</span><span class="bgroup__nums">${money.fmt(gSpent)} / ${money.fmt(gBudget)}</span></div>
      <div class="brows">${cats.map((c) => budgetRow(c, budgets[c.id] || 0, spentByCat[c.id] || 0)).join("")}</div>
    </div>`;
  }
  function budgetRow(c, budget, spent) {
    const remaining = budget - spent;
    const frac = budget ? spent / budget : spent > 0 ? 1.001 : 0;
    const over = spent > budget && budget > 0;
    return `<div class="brow">
      ${chip(c.color, c.icon, 18)}
      <div class="brow__main">
        <div class="brow__top"><span class="brow__name">${esc(c.name)}</span>
          <span class="brow__rem ${over ? "amt--neg" : remaining > 0 ? "amt--muted" : ""}">${budget ? (over ? money.fmt(-remaining) + " over" : money.fmt(remaining) + " left") : (spent > 0 ? money.fmt(spent) + " unbudgeted" : "")}</span></div>
        ${charts.meter(frac, over)}
        <div class="brow__bottom"><span>${money.fmt(spent)} spent</span></div>
      </div>
      <div class="brow__budget"><span class="cur">${money.fmt(0).replace(/[\d.,\s]/g, "") || "$"}</span><input class="binput" data-cat="${c.id}" inputmode="decimal" value="${budget ? (budget / 100).toFixed(2) : ""}" placeholder="0.00" aria-label="Budget for ${esc(c.name)}" /></div>
    </div>`;
  }

  /* ═══════════════════════════  REPORTS  ═══════════════════════════ */
  ui.reports = function (el) {
    const n = ui.reportMonths;
    const keys = [];
    for (let i = n - 1; i >= 0; i--) keys.push(D.addMonths(ui.month, -i));

    const barData = keys.map((k) => ({ label: D.monthLabel(k).split(" ")[0], income: S.monthIncome(k), expense: S.monthExpense(k) }));
    const avgIncome = Math.round(barData.reduce((s, d) => s + d.income, 0) / n);
    const avgExpense = Math.round(barData.reduce((s, d) => s + d.expense, 0) / n);
    const savingsRate = avgIncome > 0 ? Math.round(((avgIncome - avgExpense) / avgIncome) * 100) : 0;

    // net worth trend: balance at end of each month
    const trend = keys.map((k) => ({ label: D.monthLabel(k).split(" ")[0], value: netWorthAt(endOfMonth(k)) }));

    // spending by category over range
    const catTotals = {};
    keys.forEach((k) => { const sp = S.spentByCategory(k); Object.keys(sp).forEach((cid) => (catTotals[cid] = (catTotals[cid] || 0) + sp[cid])); });
    const catRows = Object.keys(catTotals).map((cid) => ({ cid, val: catTotals[cid], cat: cid === "__none" ? null : S.cat(cid) })).filter((x) => x.val > 0).sort((a, b) => b.val - a.val);
    const totalSpent = catRows.reduce((s, x) => s + x.val, 0);
    const donutSegs = catRows.slice(0, 7).map((x) => ({ value: x.val, color: x.cat ? x.cat.color : "#8b8f98", label: (x.cat ? x.cat.name : "Uncategorized") }));
    if (catRows.length > 7) donutSegs.push({ value: catRows.slice(7).reduce((s, x) => s + x.val, 0), color: "#6b7280", label: "Other" });

    el.innerHTML = `
      ${sectionHead("Reports", `<div class="seg">${[3, 6, 12].map((m) => `<button class="seg__btn ${n === m ? "is-on" : ""}" data-months="${m}">${m}m</button>`).join("")}</div>`)}
      <div class="stat-hero">
        <div class="stat"><span class="stat__k">Avg income / mo</span><span class="stat__v amt--pos">${money.fmt(avgIncome)}</span></div>
        <div class="stat"><span class="stat__k">Avg spending / mo</span><span class="stat__v amt--neg">${money.fmt(avgExpense)}</span></div>
        <div class="stat stat--net"><span class="stat__k">Savings rate</span><span class="stat__v ${savingsRate >= 0 ? "amt--pos" : "amt--neg"}">${savingsRate}%</span></div>
      </div>

      <div class="card">
        ${sectionHead("Income vs spending")}
        <div class="chart-scroll">${charts.incomeExpenseBars(barData)}</div>
        <div class="legend legend--row"><li><span class="legend__dot" style="background:var(--pos)"></span>Income</li><li><span class="legend__dot" style="background:var(--neg)"></span>Spending</li></div>
      </div>

      <div class="card">
        ${sectionHead("Net worth trend")}
        <div class="chart-scroll">${charts.line(trend)}</div>
      </div>

      <div class="card">
        ${sectionHead(`Spending by category · last ${n} mo`)}
        <div class="donut-wrap donut-wrap--wide">
          ${charts.donut(donutSegs, { center: money.fmt(totalSpent), sub: "total", aria: "Spending by category" })}
          <ul class="ranklist">
            ${catRows.slice(0, 10).map((x) => { const pct = totalSpent ? (x.val / totalSpent) * 100 : 0; return `<li><span class="legend__dot" style="background:${x.cat ? x.cat.color : "#8b8f98"}"></span><span class="ranklist__name">${esc(x.cat ? x.cat.name : "Uncategorized")}</span><span class="ranklist__bar"><span style="width:${pct}%;background:${x.cat ? x.cat.color : "#8b8f98"}"></span></span><span class="ranklist__val">${money.fmt(x.val)}</span></li>`; }).join("") || `<li class="legend__none">No spending in range</li>`}
          </ul>
        </div>
      </div>`;
  };

  function endOfMonth(key) {
    const [y, m] = key.split("-").map(Number);
    return D.iso(new Date(y, m, 0));
  }
  function netWorthAt(iso) {
    let total = 0;
    for (const a of S.activeAccounts()) {
      let bal = a.startingBalance || 0;
      for (const t of L.state.transactions) {
        if (t.date > iso) continue;
        if (t.type === "income" && t.accountId === a.id) bal += t.amount;
        else if (t.type === "expense" && t.accountId === a.id) bal -= t.amount;
        else if (t.type === "transfer") { if (t.accountId === a.id) bal -= t.amount; if (t.toAccountId === a.id) bal += t.amount; }
      }
      total += bal;
    }
    return total;
  }

  /* ═══════════════════════════  SETTINGS  ═══════════════════════════ */
  ui.settings = function (el) {
    const s = L.state.settings;
    const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "MXN", "BRL", "CHF", "CNY", "SEK", "NOK", "NZD", "ZAR", "SGD"];
    el.innerHTML = `
      ${sectionHead("Settings")}
      <div class="card">
        <h3 class="card__title">Preferences</h3>
        <div class="field"><label for="setName">Budget name</label><input id="setName" class="input" value="${esc(s.name)}" /></div>
        <div class="field-row">
          <div class="field"><label for="setCurrency">Currency</label><select id="setCurrency" class="select">${currencies.map((c) => `<option value="${c}" ${s.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label for="setTheme">Theme</label><select id="setTheme" class="select">${["auto", "light", "dark"].map((t) => `<option value="${t}" ${s.theme === t ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></div>
        </div>
      </div>

      <div class="card">
        ${sectionHead("Categories", `<button class="btn btn--ghost btn--sm" data-act="add-category">${G.plus}<span>New</span></button>`)}
        <div class="cat-manage">${manageCategoriesHTML()}</div>
      </div>

      <div class="card">
        ${sectionHead("Recurring transactions", `<button class="btn btn--ghost btn--sm" data-act="add-recurring">${G.plus}<span>New</span></button>`)}
        ${L.state.recurring.length ? `<ul class="reclist">${L.state.recurring.map(recurringRow).join("")}</ul>` : `<p class="muted">Automate rent, paychecks, subscriptions — they post automatically when due.</p>`}
      </div>

      <div class="card">
        <h3 class="card__title">Your data</h3>
        <p class="muted">Everything is stored only in this browser, on this device. Back it up with an export.</p>
        <div class="btn-cluster">
          <button class="btn btn--ghost" data-act="export-json">Export backup (JSON)</button>
          <button class="btn btn--ghost" data-act="export-csv">Export transactions (CSV)</button>
          <button class="btn btn--ghost" data-act="import-json">Import backup…</button>
          <button class="btn btn--ghost" data-act="load-sample">Load sample data</button>
        </div>
        <div class="btn-cluster">
          <button class="btn btn--danger" data-act="reset-all">Erase everything</button>
        </div>
      </div>

      <p class="foot">Ledger · private, offline budgeting. Built for Connor. Data never leaves this device.</p>`;

    el.querySelector("#setName").addEventListener("change", (e) => { s.name = e.target.value.trim() || "My Budget"; L.store.save(); });
    el.querySelector("#setCurrency").addEventListener("change", (e) => { s.currency = e.target.value; L.store.save(); L.renderAll(); ui.toast("Currency set to " + e.target.value); });
    el.querySelector("#setTheme").addEventListener("change", (e) => { s.theme = e.target.value; L.store.save(); L.applyTheme(); });
  };

  function manageCategoriesHTML() {
    const groups = {};
    L.state.categories.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });
    return Object.keys(groups).map((g) => `<div class="cat-group"><div class="cat-group__name">${esc(g)}</div>${groups[g].map((c) => `<div class="cat-item ${c.archived ? "is-archived" : ""}">${chip(c.color, c.icon, 16)}<span class="cat-item__name">${esc(c.name)}</span><span class="cat-item__type">${c.type}</span><button class="iconbtn iconbtn--sm" data-edit-cat="${c.id}" aria-label="Edit ${esc(c.name)}">${G.edit}</button><button class="iconbtn iconbtn--sm" data-del-cat="${c.id}" aria-label="Delete ${esc(c.name)}">${G.trash}</button></div>`).join("")}</div>`).join("");
  }
  function recurringRow(r) {
    const freq = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" }[r.freq] || r.freq;
    return `<li class="rec">${chip(r.type === "income" ? "#3aa76d" : r.type === "transfer" ? "#7d86b8" : "#d3574e", r.type === "income" ? "wage" : r.type === "transfer" ? "repeat" : "receipt", 18)}
      <div class="rec__main"><span class="rec__name">${esc(r.name)}</span><span class="rec__sub">${esc(freq)} · next ${D.prettyDateShort(r.nextDate)} · ${esc(S.accountName(r.accountId))}</span></div>
      <span class="${amountClass(r.type)}">${signedAmount(r)}</span>
      <button class="iconbtn iconbtn--sm" data-edit-rec="${r.id}" aria-label="Edit">${G.edit}</button>
      <button class="iconbtn iconbtn--sm" data-del-rec="${r.id}" aria-label="Delete">${G.trash}</button></li>`;
  }

  /* ═══════════════════════════  FORMS  ═══════════════════════════ */
  function accountTypeOpts(sel) {
    return [["checking", "Checking"], ["savings", "Savings"], ["credit", "Credit card"], ["cash", "Cash"], ["investment", "Investment"]]
      .map(([v, l]) => `<option value="${v}" ${sel === v ? "selected" : ""}>${l}</option>`).join("");
  }
  const ACCT_COLORS = ["#6a8cff", "#37b98f", "#d3574e", "#e0913a", "#8a7fd6", "#4bb2c7", "#c368d8", "#d85f8f"];
  function colorPicker(name, current, list) {
    list = list || ACCT_COLORS;
    return `<div class="colorpick" data-color-field="${name}">${list.map((c) => `<button type="button" class="swatch ${c === current ? "is-on" : ""}" style="background:${c}" data-color="${c}" aria-label="color"></button>`).join("")}<input type="hidden" name="${name}" value="${current}"></div>`;
  }
  function wireColorPickers(root) {
    root.querySelectorAll(".colorpick").forEach((cp) => {
      cp.addEventListener("click", (e) => {
        const b = e.target.closest(".swatch");
        if (!b) return;
        e.preventDefault();
        cp.querySelectorAll(".swatch").forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on");
        cp.querySelector("input").value = b.dataset.color;
      });
    });
  }

  ui.accountForm = function (acct) {
    const edit = !!acct;
    acct = acct || { name: "", type: "checking", startingBalance: 0, color: "#6a8cff", goalEnabled: false, goalTarget: 0, goalDate: "" };
    ui.openModal(edit ? "Edit account" : "New account", `
      <form id="acctForm" class="form">
        <div class="field"><label>Name</label><input class="input" name="name" value="${esc(acct.name)}" placeholder="Checking" required></div>
        <div class="field-row">
          <div class="field"><label>Type</label><select class="select" name="type">${accountTypeOpts(acct.type)}</select></div>
          <div class="field"><label>${edit ? "Current" : "Starting"} balance</label><input class="input" name="startingBalance" inputmode="decimal" value="${acct.startingBalance ? (acct.startingBalance / 100).toFixed(2) : ""}" placeholder="0.00"></div>
        </div>
        <div class="field"><label>Color</label>${colorPicker("color", acct.color)}</div>

        <div class="goalbox">
          <label class="check"><input type="checkbox" name="goalEnabled" id="goalToggle" ${acct.goalEnabled ? "checked" : ""}><span class="check__box">${G.check}</span> Track a savings goal</label>
          <div class="goal-fields" id="goalFields" ${acct.goalEnabled ? "" : "hidden"}>
            <div class="field-row">
              <div class="field"><label>Target amount</label><input class="input" name="goalTarget" inputmode="decimal" value="${acct.goalTarget ? (acct.goalTarget / 100).toFixed(2) : ""}" placeholder="10,000.00"></div>
              <div class="field"><label>Target date <span class="opt">(optional)</span></label><input class="input" type="date" name="goalDate" value="${esc(acct.goalDate || "")}"></div>
            </div>
            <p class="hint hint--tight">Progress shows on the account card as you save toward it.</p>
          </div>
        </div>

        <div class="form__actions">
          ${edit ? `<button type="button" class="btn btn--danger-ghost" data-del-account="${acct.id}">Delete</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">${edit ? "Save" : "Add account"}</button>
        </div>
      </form>`, (body) => {
      wireColorPickers(body);
      const toggle = body.querySelector("#goalToggle");
      const fields = body.querySelector("#goalFields");
      toggle.addEventListener("change", () => {
        fields.hidden = !toggle.checked;
        if (toggle.checked) { const t = fields.querySelector('[name="goalTarget"]'); if (t) t.focus(); }
      });
      body.querySelector("#acctForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const goalEnabled = !!fd.get("goalEnabled");
        const data = {
          name: (fd.get("name") || "").trim() || "Account",
          type: fd.get("type"),
          startingBalance: money.toCents(fd.get("startingBalance")),
          color: fd.get("color"),
          goalEnabled,
          goalTarget: goalEnabled ? money.toCents(fd.get("goalTarget")) : 0,
          goalDate: goalEnabled ? (fd.get("goalDate") || "") : "",
        };
        if (goalEnabled && !data.goalTarget) { ui.toast("Set a target amount for the goal"); return; }
        if (edit) { M.updateAccount(acct.id, data); ui.toast("Account updated"); }
        else { M.addAccount(data); ui.toast("Account added"); }
        ui.closeModal();
        L.renderAll();
      });
    });
  };

  ui.txForm = function (tx) {
    const edit = !!tx;
    tx = tx || { type: "expense", date: D.iso(), amount: 0, accountId: (S.activeAccounts()[0] || {}).id, categoryId: (S.expenseCategories()[0] || {}).id, toAccountId: "", payee: "", note: "", cleared: false };
    const accs = S.activeAccounts();
    if (!accs.length) { ui.toast("Add an account first"); ui.accountForm(); return; }

    const accSel = (name, sel) => `<select class="select" name="${name}">${accs.map((a) => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
    const catSel = (sel, type) => `<select class="select" name="categoryId">${(type === "income" ? S.incomeCategories() : S.expenseCategories()).map((c) => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`;

    ui.openModal(edit ? "Edit transaction" : "Add transaction", `
      <form id="txForm" class="form">
        <div class="seg seg--type" role="group">
          ${["expense", "income", "transfer"].map((t) => `<button type="button" class="seg__btn ${tx.type === t ? "is-on" : ""}" data-type="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
        </div>
        <input type="hidden" name="type" value="${tx.type}">
        <div class="amount-field"><span class="amount-field__cur">${money.fmt(0).replace(/[\d.,\s]/g, "") || "$"}</span><input class="amount-input" name="amount" inputmode="decimal" value="${tx.amount ? (tx.amount / 100).toFixed(2) : ""}" placeholder="0.00" required></div>

        <div class="field" data-when="expense income"><label>Payee</label><input class="input" name="payee" value="${esc(tx.payee)}" placeholder="Who / what" list="payeeList"></div>
        <datalist id="payeeList">${payeeSuggestions()}</datalist>

        <div class="field" data-when="expense" id="fieldCatExpense"><label>Category</label>${catSel(tx.type === "expense" ? tx.categoryId : (S.expenseCategories()[0] || {}).id, "expense")}</div>
        <div class="field" data-when="income" id="fieldCatIncome" hidden><label>Category</label>${catSel(tx.type === "income" ? tx.categoryId : (S.incomeCategories()[0] || {}).id, "income")}</div>

        <div class="field-row">
          <div class="field" data-when="expense income transfer"><label id="lblAccount">Account</label>${accSel("accountId", tx.accountId)}</div>
          <div class="field" data-when="transfer" id="fieldTo" ${tx.type === "transfer" ? "" : "hidden"}><label>To account</label>${accSel("toAccountId", tx.toAccountId || (accs[1] || accs[0]).id)}</div>
          <div class="field" data-when="expense income"><label>Date</label><input class="input" type="date" name="date" value="${tx.date}"></div>
        </div>
        <div class="field" data-when="transfer" hidden id="fieldDateTransfer"><label>Date</label><input class="input" type="date" name="dateT" value="${tx.date}"></div>

        <div class="field"><label>Note <span class="opt">(optional)</span></label><input class="input" name="note" value="${esc(tx.note)}" placeholder="Add a note"></div>
        <label class="check"><input type="checkbox" name="cleared" ${tx.cleared ? "checked" : ""}><span class="check__box">${G.check}</span> Cleared / reconciled</label>

        <div class="form__actions">
          ${edit ? `<button type="button" class="btn btn--danger-ghost" data-del-tx="${tx.id}">Delete</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">${edit ? "Save" : "Add"}</button>
        </div>
      </form>`, (body) => {
      const form = body.querySelector("#txForm");
      const typeInput = form.querySelector('input[name="type"]');
      function applyType(t) {
        typeInput.value = t;
        form.querySelectorAll(".seg--type .seg__btn").forEach((b) => b.classList.toggle("is-on", b.dataset.type === t));
        form.querySelectorAll("[data-when]").forEach((elm) => { elm.hidden = !elm.dataset.when.split(" ").includes(t); });
        form.querySelector("#lblAccount").textContent = t === "transfer" ? "From account" : t === "income" ? "To account" : "Account";
      }
      form.querySelectorAll(".seg--type .seg__btn").forEach((b) => b.addEventListener("click", () => applyType(b.dataset.type)));
      applyType(tx.type);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const type = fd.get("type");
        const amount = money.toCents(fd.get("amount"));
        if (!amount) { ui.toast("Enter an amount"); return; }
        const data = {
          type, amount,
          accountId: fd.get("accountId"),
          payee: (fd.get("payee") || "").trim(),
          note: (fd.get("note") || "").trim(),
          cleared: !!fd.get("cleared"),
        };
        if (type === "transfer") {
          data.toAccountId = fd.get("toAccountId");
          data.date = fd.get("dateT") || D.iso();
          data.categoryId = null;
          if (data.accountId === data.toAccountId) { ui.toast("Pick two different accounts"); return; }
        } else {
          data.categoryId = fd.get("categoryId");
          data.date = fd.get("date") || D.iso();
        }
        if (edit) { M.updateTx(tx.id, data); ui.toast("Transaction updated"); }
        else { M.addTx(data); ui.toast(type === "income" ? "Income added" : type === "transfer" ? "Transfer added" : "Expense added"); }
        ui.closeModal();
        L.renderAll();
      });
    });
  };
  function payeeSuggestions() {
    const seen = {};
    S.sortedTx().forEach((t) => { if (t.payee) seen[t.payee] = 1; });
    return Object.keys(seen).slice(0, 40).map((p) => `<option value="${esc(p)}">`).join("");
  }

  ui.categoryForm = function (cat) {
    const edit = !!cat;
    cat = cat || { name: "", group: "Other", type: "expense", icon: "dots", color: "#8b8f98" };
    const groups = Array.from(new Set(L.state.categories.map((c) => c.group).concat(["Income", "Essentials", "Lifestyle", "Financial", "Other"])));
    const catColors = ["#6a8cff", "#4bb2c7", "#4caf7d", "#e0913a", "#8a7fd6", "#e46a8b", "#c368d8", "#d85f8f", "#37b98f", "#d3574e", "#9a8b7a", "#8b8f98"];
    ui.openModal(edit ? "Edit category" : "New category", `
      <form id="catForm" class="form">
        <div class="field"><label>Name</label><input class="input" name="name" value="${esc(cat.name)}" placeholder="Category name" required></div>
        <div class="field-row">
          <div class="field"><label>Group</label><input class="input" name="group" value="${esc(cat.group)}" list="groupList"><datalist id="groupList">${groups.map((g) => `<option value="${esc(g)}">`).join("")}</datalist></div>
          <div class="field"><label>Type</label><select class="select" name="type"><option value="expense" ${cat.type === "expense" ? "selected" : ""}>Expense</option><option value="income" ${cat.type === "income" ? "selected" : ""}>Income</option></select></div>
        </div>
        <div class="field"><label>Color</label>${colorPicker("color", cat.color, catColors)}</div>
        <div class="field"><label>Icon</label><div class="iconpick" data-icon-field>${L.ICON_KEYS.map((k) => `<button type="button" class="iconopt ${k === cat.icon ? "is-on" : ""}" data-icon="${k}" aria-label="${k}">${icon(k, 20)}</button>`).join("")}<input type="hidden" name="icon" value="${cat.icon}"></div></div>
        <div class="form__actions">
          ${edit ? `<button type="button" class="btn btn--danger-ghost" data-del-cat="${cat.id}">Delete</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">${edit ? "Save" : "Add"}</button>
        </div>
      </form>`, (body) => {
      wireColorPickers(body);
      const ip = body.querySelector(".iconpick");
      ip.addEventListener("click", (e) => {
        const b = e.target.closest(".iconopt"); if (!b) return; e.preventDefault();
        ip.querySelectorAll(".iconopt").forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on"); ip.querySelector("input").value = b.dataset.icon;
      });
      body.querySelector("#catForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = { name: (fd.get("name") || "").trim() || "Category", group: (fd.get("group") || "Other").trim() || "Other", type: fd.get("type"), icon: fd.get("icon"), color: fd.get("color") };
        if (edit) { M.updateCategory(cat.id, data); ui.toast("Category saved"); }
        else { M.addCategory(data); ui.toast("Category added"); }
        ui.closeModal();
        L.render("settings");
      });
    });
  };

  ui.recurringForm = function (rec) {
    const edit = !!rec;
    const accs = S.activeAccounts();
    if (!accs.length) { ui.toast("Add an account first"); ui.accountForm(); return; }
    rec = rec || { name: "", type: "expense", amount: 0, accountId: accs[0].id, toAccountId: (accs[1] || accs[0]).id, categoryId: (S.expenseCategories()[0] || {}).id, payee: "", freq: "monthly", nextDate: D.iso() };
    const accSel = (name, sel) => `<select class="select" name="${name}">${accs.map((a) => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`;
    ui.openModal(edit ? "Edit recurring" : "New recurring", `
      <form id="recForm" class="form">
        <div class="seg seg--type"><input type="hidden" name="type" value="${rec.type}">
          ${["expense", "income", "transfer"].map((t) => `<button type="button" class="seg__btn ${rec.type === t ? "is-on" : ""}" data-rtype="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
        </div>
        <div class="field"><label>Name</label><input class="input" name="name" value="${esc(rec.name)}" placeholder="Rent, Paycheck, Netflix…" required></div>
        <div class="amount-field"><span class="amount-field__cur">${money.fmt(0).replace(/[\d.,\s]/g, "") || "$"}</span><input class="amount-input" name="amount" inputmode="decimal" value="${rec.amount ? (rec.amount / 100).toFixed(2) : ""}" placeholder="0.00" required></div>
        <div class="field-row">
          <div class="field"><label>Frequency</label><select class="select" name="freq">${[["weekly", "Weekly"], ["biweekly", "Every 2 weeks"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["yearly", "Yearly"]].map(([v, l]) => `<option value="${v}" ${rec.freq === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="field"><label>Next date</label><input class="input" type="date" name="nextDate" value="${rec.nextDate}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label id="recLblAcct">Account</label>${accSel("accountId", rec.accountId)}</div>
          <div class="field" id="recTo" ${rec.type === "transfer" ? "" : "hidden"}><label>To account</label>${accSel("toAccountId", rec.toAccountId)}</div>
          <div class="field" id="recCat" ${rec.type === "transfer" ? "hidden" : ""}><label>Category</label><select class="select" name="categoryId">${S.activeCategories().map((c) => `<option value="${c.id}" ${rec.categoryId === c.id ? "selected" : ""}>${esc(c.name)} (${c.type})</option>`).join("")}</select></div>
        </div>
        <div class="form__actions">
          ${edit ? `<button type="button" class="btn btn--danger-ghost" data-del-rec="${rec.id}">Delete</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">${edit ? "Save" : "Add"}</button>
        </div>
      </form>`, (body) => {
      const form = body.querySelector("#recForm");
      const typeInput = form.querySelector('input[name="type"]');
      form.querySelectorAll("[data-rtype]").forEach((b) => b.addEventListener("click", () => {
        const t = b.dataset.rtype; typeInput.value = t;
        form.querySelectorAll("[data-rtype]").forEach((x) => x.classList.toggle("is-on", x === b));
        form.querySelector("#recTo").hidden = t !== "transfer";
        form.querySelector("#recCat").hidden = t === "transfer";
        form.querySelector("#recLblAcct").textContent = t === "transfer" ? "From account" : "Account";
      }));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const type = fd.get("type");
        const data = { name: (fd.get("name") || "").trim(), type, amount: money.toCents(fd.get("amount")), accountId: fd.get("accountId"), freq: fd.get("freq"), nextDate: fd.get("nextDate") || D.iso(), payee: (fd.get("name") || "").trim() };
        if (type === "transfer") { data.toAccountId = fd.get("toAccountId"); data.categoryId = null; }
        else data.categoryId = fd.get("categoryId");
        if (edit) { M.updateRecurring(rec.id, data); ui.toast("Recurring saved"); }
        else { M.addRecurring(data); ui.toast("Recurring added"); }
        ui.closeModal();
        const posted = L.store.runRecurring();
        L.render("settings");
        if (posted) ui.toast(posted + " past occurrence" + (posted > 1 ? "s" : "") + " posted");
      });
    });
  };

  /* confirm dialog */
  ui.confirm = function (title, msg, confirmLabel, onYes, danger) {
    ui.openModal(title, `
      <p class="confirm-msg">${esc(msg)}</p>
      <div class="form__actions"><span class="spacer"></span>
        <button type="button" class="btn btn--ghost" data-close>Cancel</button>
        <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" id="confirmYes">${esc(confirmLabel || "Confirm")}</button>
      </div>`, (body) => {
      body.querySelector("#confirmYes").addEventListener("click", () => { onYes(); });
    });
  };
})();
