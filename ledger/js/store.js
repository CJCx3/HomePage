/* ══════════════════════════════════════════════════════════════════════════
   Ledger · store.js — state, persistence, and all money/domain logic.
   Money is stored as integer cents everywhere to avoid float drift.
   Everything lives on-device in localStorage. Nothing is ever sent anywhere.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const L = (window.L = window.L || {});

  const KEY = "ledger.v1";

  /* ─────────────────────────────  money  ───────────────────────────── */
  const money = {
    toCents(v) {
      if (typeof v === "number") return Math.round(v * 100);
      if (v == null) return 0;
      const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
      return isNaN(n) ? 0 : Math.round(n * 100);
    },
    fromCents(c) {
      return (c || 0) / 100;
    },
    fmt(cents, opts) {
      const s = L.state ? L.state.settings : { currency: "USD", locale: "en-US" };
      opts = opts || {};
      const val = (cents || 0) / 100;
      try {
        const f = new Intl.NumberFormat(s.locale || "en-US", {
          style: "currency",
          currency: s.currency || "USD",
          signDisplay: opts.sign ? "always" : "auto",
        });
        return f.format(val);
      } catch (e) {
        return (opts.sign && val > 0 ? "+" : "") + "$" + val.toFixed(2);
      }
    },
    /* compact for chart axes: $1.2k */
    fmtShort(cents) {
      const s = L.state ? L.state.settings : { currency: "USD", locale: "en-US" };
      const val = Math.abs((cents || 0) / 100);
      let sym = "$";
      try {
        sym = (0)
          .toLocaleString(s.locale || "en-US", { style: "currency", currency: s.currency || "USD" })
          .replace(/[0-9.,\s]/g, "");
      } catch (e) {}
      const sign = cents < 0 ? "-" : "";
      if (val >= 1e6) return sign + sym + (val / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
      if (val >= 1e3) return sign + sym + (val / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
      return sign + sym + Math.round(val);
    },
  };

  /* ─────────────────────────────  dates  ───────────────────────────── */
  const D = {
    today() {
      return new Date();
    },
    iso(d) {
      d = d || new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },
    monthKey(d) {
      if (typeof d === "string") return d.slice(0, 7);
      d = d || new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
    parse(s) {
      const [y, m, d] = String(s).split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    },
    addMonths(key, n) {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m - 1 + n, 1);
      return D.monthKey(d);
    },
    monthLabel(key, long) {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString(L.state ? L.state.settings.locale : "en-US", {
        month: long ? "long" : "short",
        year: "numeric",
      });
    },
    prettyDate(iso) {
      const d = D.parse(iso);
      return d.toLocaleDateString(L.state ? L.state.settings.locale : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    },
    prettyDateShort(iso) {
      const d = D.parse(iso);
      return d.toLocaleDateString(L.state ? L.state.settings.locale : "en-US", {
        month: "short",
        day: "numeric",
      });
    },
    daysInMonth(key) {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m, 0).getDate();
    },
  };

  const uid = () =>
    (crypto && crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now() + Math.random().toString(16).slice(2));

  /* ───────────────────────  default seed content  ─────────────────── */
  const CAT_COLORS = {
    housing: "#6a8cff", utilities: "#4bb2c7", groceries: "#4caf7d", transport: "#e0913a",
    insurance: "#8a7fd6", health: "#e46a8b", dining: "#e0733a", fun: "#c368d8",
    shopping: "#d85f8f", travel: "#39a0c9", subs: "#7d86b8", fitness: "#4fb06a",
    savings: "#37b98f", debt: "#d3574e", invest: "#3aa76d", fees: "#9a8b7a",
    gifts: "#d06fae", edu: "#5e93d8", misc: "#8b8f98",
    paycheck: "#3aa76d", interest: "#4bb2c7", income: "#57b98a",
  };

  function defaultCategories() {
    const mk = (name, group, type, icon, color) => ({
      id: uid(), name, group, type, icon, color: color || "#8b8f98", archived: false,
    });
    let cats = [
      // income
      mk("Paycheck", "Income", "income", "wage", CAT_COLORS.paycheck),
      mk("Interest", "Income", "income", "coins", CAT_COLORS.interest),
      mk("Other Income", "Income", "income", "gift", CAT_COLORS.income),
      // essentials
      mk("Rent / Mortgage", "Essentials", "expense", "home", CAT_COLORS.housing),
      mk("Utilities", "Essentials", "expense", "bolt", CAT_COLORS.utilities),
      mk("Groceries", "Essentials", "expense", "cart", CAT_COLORS.groceries),
      mk("Transportation", "Essentials", "expense", "car", CAT_COLORS.transport),
      mk("Insurance", "Essentials", "expense", "shield", CAT_COLORS.insurance),
      mk("Health", "Essentials", "expense", "heart", CAT_COLORS.health),
      // lifestyle
      mk("Dining Out", "Lifestyle", "expense", "fork", CAT_COLORS.dining),
      mk("Entertainment", "Lifestyle", "expense", "play", CAT_COLORS.fun),
      mk("Shopping", "Lifestyle", "expense", "bag", CAT_COLORS.shopping),
      mk("Travel", "Lifestyle", "expense", "plane", CAT_COLORS.travel),
      mk("Subscriptions", "Lifestyle", "expense", "repeat", CAT_COLORS.subs),
      mk("Fitness", "Lifestyle", "expense", "dumbbell", CAT_COLORS.fitness),
      // financial
      mk("Savings", "Financial", "expense", "piggy", CAT_COLORS.savings),
      mk("Debt Payment", "Financial", "expense", "minuscircle", CAT_COLORS.debt),
      mk("Investments", "Financial", "expense", "trend", CAT_COLORS.invest),
      mk("Fees", "Financial", "expense", "receipt", CAT_COLORS.fees),
      // other
      mk("Gifts", "Other", "expense", "gift", CAT_COLORS.gifts),
      mk("Education", "Other", "expense", "book", CAT_COLORS.edu),
      mk("Miscellaneous", "Other", "expense", "dots", CAT_COLORS.misc),
    ];
    cats.forEach((c, i) => (c.sort = i));
    return cats;
  }

  function freshState() {
    return {
      version: 1,
      settings: {
        name: "My Budget",
        currency: "USD",
        locale: "en-US",
        theme: "auto",
        monthStartDay: 1,
        firstRun: true,
      },
      accounts: [],
      categories: defaultCategories(),
      transactions: [],
      budgets: {}, // { 'YYYY-MM': { catId: cents } }
      recurring: [],
    };
  }

  /* ───────────────────────  load / save  ─────────────────────────── */
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(L.state));
      } catch (e) {
        console.warn("Ledger save failed", e);
      }
    }, 120);
  }
  function saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(L.state));
    } catch (e) {}
  }

  function load() {
    let s = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s || !s.version) s = freshState();
    // migration / defaults guard
    s.settings = Object.assign(freshState().settings, s.settings || {});
    s.accounts = s.accounts || [];
    s.categories = s.categories && s.categories.length ? s.categories : defaultCategories();
    s.transactions = s.transactions || [];
    s.budgets = s.budgets || {};
    s.recurring = s.recurring || [];
    L.state = s;
    return s;
  }

  /* ───────────────────────  selectors  ─────────────────────────── */
  const S = {
    cat(id) {
      return L.state.categories.find((c) => c.id === id) || null;
    },
    catName(id) {
      const c = S.cat(id);
      return c ? c.name : "Uncategorized";
    },
    account(id) {
      return L.state.accounts.find((a) => a.id === id) || null;
    },
    accountName(id) {
      const a = S.account(id);
      return a ? a.name : "—";
    },
    activeAccounts() {
      return L.state.accounts.filter((a) => !a.archived);
    },
    activeCategories() {
      return L.state.categories.filter((c) => !c.archived);
    },
    expenseCategories() {
      return S.activeCategories().filter((c) => c.type === "expense");
    },
    incomeCategories() {
      return S.activeCategories().filter((c) => c.type === "income");
    },
    sortedTx() {
      return [...L.state.transactions].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },
    txInMonth(key) {
      return L.state.transactions.filter((t) => t.date.slice(0, 7) === key);
    },
    txForAccount(id) {
      return S.sortedTx().filter((t) => t.accountId === id || t.toAccountId === id);
    },

    /* running balance of an account through all history */
    accountBalance(id) {
      const a = S.account(id);
      if (!a) return 0;
      let bal = a.startingBalance || 0;
      for (const t of L.state.transactions) {
        if (t.type === "income" && t.accountId === id) bal += t.amount;
        else if (t.type === "expense" && t.accountId === id) bal -= t.amount;
        else if (t.type === "transfer") {
          if (t.accountId === id) bal -= t.amount;
          if (t.toAccountId === id) bal += t.amount;
        }
      }
      return bal;
    },
    netWorth() {
      return S.activeAccounts().reduce((sum, a) => sum + S.accountBalance(a.id), 0);
    },

    /* savings-goal progress for an account, or null when no goal is set */
    goal(id) {
      const a = S.account(id);
      if (!a || !a.goalEnabled || !a.goalTarget) return null;
      const balance = S.accountBalance(id);
      const target = a.goalTarget;
      const remaining = Math.max(0, target - balance);
      const frac = target > 0 ? balance / target : 0;
      const reached = balance >= target;
      let monthsLeft = null, perMonth = null;
      if (a.goalDate) {
        const now = new Date();
        const t = D.parse(a.goalDate);
        monthsLeft = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
        if (!reached && monthsLeft > 0) perMonth = Math.ceil(remaining / monthsLeft);
      }
      return { target, balance, remaining, frac, reached, date: a.goalDate, monthsLeft, perMonth };
    },

    /* month income / expense (transfers excluded) */
    monthIncome(key) {
      return S.txInMonth(key)
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
    },
    monthExpense(key) {
      return S.txInMonth(key)
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);
    },
    spentByCategory(key) {
      const out = {};
      for (const t of S.txInMonth(key)) {
        if (t.type !== "expense") continue;
        const k = t.categoryId || "__none";
        out[k] = (out[k] || 0) + t.amount;
      }
      return out;
    },
    incomeByCategory(key) {
      const out = {};
      for (const t of S.txInMonth(key)) {
        if (t.type !== "income") continue;
        const k = t.categoryId || "__none";
        out[k] = (out[k] || 0) + t.amount;
      }
      return out;
    },

    /* budget for a month; returns {catId: cents} */
    budgetsFor(key) {
      return L.state.budgets[key] || {};
    },
    budgetTotal(key) {
      const b = S.budgetsFor(key);
      return Object.values(b).reduce((s, v) => s + v, 0);
    },
  };

  /* ───────────────────────  mutations  ─────────────────────────── */
  const M = {
    addAccount(data) {
      const a = {
        id: uid(),
        name: data.name || "Account",
        type: data.type || "checking",
        startingBalance: data.startingBalance || 0,
        color: data.color || "#6a8cff",
        goalEnabled: !!data.goalEnabled,
        goalTarget: data.goalTarget || 0,
        goalDate: data.goalDate || "",
        archived: false,
        createdAt: Date.now(),
      };
      L.state.accounts.push(a);
      save();
      return a;
    },
    updateAccount(id, data) {
      const a = S.account(id);
      if (!a) return;
      Object.assign(a, data);
      save();
    },
    deleteAccount(id, deleteTx) {
      L.state.accounts = L.state.accounts.filter((a) => a.id !== id);
      if (deleteTx) {
        L.state.transactions = L.state.transactions.filter(
          (t) => t.accountId !== id && t.toAccountId !== id
        );
      }
      save();
    },

    addCategory(data) {
      const c = {
        id: uid(),
        name: data.name || "Category",
        group: data.group || "Other",
        type: data.type || "expense",
        icon: data.icon || "dots",
        color: data.color || "#8b8f98",
        archived: false,
        sort: L.state.categories.length,
      };
      L.state.categories.push(c);
      save();
      return c;
    },
    updateCategory(id, data) {
      const c = S.cat(id);
      if (!c) return;
      Object.assign(c, data);
      save();
    },
    deleteCategory(id) {
      L.state.categories = L.state.categories.filter((c) => c.id !== id);
      L.state.transactions.forEach((t) => {
        if (t.categoryId === id) t.categoryId = null;
      });
      Object.keys(L.state.budgets).forEach((mk) => {
        delete L.state.budgets[mk][id];
      });
      save();
    },

    addTx(data) {
      const t = {
        id: uid(),
        date: data.date || D.iso(),
        type: data.type || "expense",
        amount: Math.abs(data.amount || 0),
        accountId: data.accountId || null,
        toAccountId: data.toAccountId || null,
        categoryId: data.type === "transfer" ? null : data.categoryId || null,
        payee: data.payee || "",
        note: data.note || "",
        cleared: !!data.cleared,
        recurringId: data.recurringId || null,
        createdAt: Date.now(),
      };
      L.state.transactions.push(t);
      save();
      return t;
    },
    updateTx(id, data) {
      const t = L.state.transactions.find((x) => x.id === id);
      if (!t) return;
      Object.assign(t, data);
      if (t.type === "transfer") t.categoryId = null;
      if (typeof t.amount === "number") t.amount = Math.abs(t.amount);
      save();
    },
    deleteTx(id) {
      L.state.transactions = L.state.transactions.filter((t) => t.id !== id);
      save();
    },

    setBudget(monthKey, catId, cents) {
      if (!L.state.budgets[monthKey]) L.state.budgets[monthKey] = {};
      if (!cents) delete L.state.budgets[monthKey][catId];
      else L.state.budgets[monthKey][catId] = cents;
      save();
    },
    copyBudget(fromKey, toKey) {
      const src = L.state.budgets[fromKey];
      if (!src) return 0;
      L.state.budgets[toKey] = Object.assign({}, src);
      save();
      return Object.keys(src).length;
    },
    autoBudget(monthKey, monthsBack) {
      // average spend over the last N months → budget
      const keys = [];
      for (let i = 1; i <= monthsBack; i++) keys.push(D.addMonths(monthKey, -i));
      const totals = {};
      keys.forEach((k) => {
        const sp = S.spentByCategory(k);
        Object.keys(sp).forEach((cid) => {
          totals[cid] = (totals[cid] || 0) + sp[cid];
        });
      });
      const b = (L.state.budgets[monthKey] = L.state.budgets[monthKey] || {});
      let n = 0;
      Object.keys(totals).forEach((cid) => {
        if (cid === "__none") return;
        b[cid] = Math.round(totals[cid] / monthsBack);
        n++;
      });
      save();
      return n;
    },

    addRecurring(data) {
      const r = {
        id: uid(),
        name: data.name || data.payee || "Recurring",
        type: data.type || "expense",
        amount: Math.abs(data.amount || 0),
        accountId: data.accountId || null,
        toAccountId: data.toAccountId || null,
        categoryId: data.categoryId || null,
        payee: data.payee || "",
        note: data.note || "",
        freq: data.freq || "monthly",
        interval: data.interval || 1,
        nextDate: data.nextDate || D.iso(),
        active: data.active !== false,
        createdAt: Date.now(),
      };
      L.state.recurring.push(r);
      save();
      return r;
    },
    updateRecurring(id, data) {
      const r = L.state.recurring.find((x) => x.id === id);
      if (!r) return;
      Object.assign(r, data);
      if (typeof r.amount === "number") r.amount = Math.abs(r.amount);
      save();
    },
    deleteRecurring(id) {
      L.state.recurring = L.state.recurring.filter((r) => r.id !== id);
      save();
    },
  };

  function advance(dateStr, freq, interval) {
    const d = D.parse(dateStr);
    interval = interval || 1;
    if (freq === "weekly") d.setDate(d.getDate() + 7 * interval);
    else if (freq === "biweekly") d.setDate(d.getDate() + 14 * interval);
    else if (freq === "monthly") d.setMonth(d.getMonth() + interval);
    else if (freq === "quarterly") d.setMonth(d.getMonth() + 3 * interval);
    else if (freq === "yearly") d.setFullYear(d.getFullYear() + interval);
    else d.setMonth(d.getMonth() + interval);
    return D.iso(d);
  }

  /* materialize any due recurring rules up to today */
  function runRecurring() {
    const todayIso = D.iso();
    let posted = 0;
    for (const r of L.state.recurring) {
      if (!r.active) continue;
      let guard = 0;
      while (r.nextDate <= todayIso && guard < 400) {
        M.addTx({
          date: r.nextDate,
          type: r.type,
          amount: r.amount,
          accountId: r.accountId,
          toAccountId: r.toAccountId,
          categoryId: r.categoryId,
          payee: r.payee,
          note: r.note,
          recurringId: r.id,
        });
        r.nextDate = advance(r.nextDate, r.freq, r.interval);
        posted++;
        guard++;
      }
    }
    if (posted) saveNow();
    return posted;
  }

  /* ───────────────────────  import / export  ─────────────────────── */
  function exportJSON() {
    return JSON.stringify(L.state, null, 2);
  }
  function importJSON(text) {
    const obj = JSON.parse(text);
    if (!obj || !obj.version) throw new Error("Not a Ledger backup file.");
    obj.settings = Object.assign(freshState().settings, obj.settings || {});
    obj.accounts = obj.accounts || [];
    obj.categories = obj.categories || defaultCategories();
    obj.transactions = obj.transactions || [];
    obj.budgets = obj.budgets || {};
    obj.recurring = obj.recurring || [];
    L.state = obj;
    saveNow();
  }
  function exportCSV() {
    const rows = [["Date", "Type", "Account", "To Account", "Category", "Payee", "Amount", "Cleared", "Note"]];
    S.sortedTx().forEach((t) => {
      rows.push([
        t.date,
        t.type,
        S.accountName(t.accountId),
        t.type === "transfer" ? S.accountName(t.toAccountId) : "",
        t.type === "transfer" ? "" : S.catName(t.categoryId),
        t.payee || "",
        money.fromCents(t.amount).toFixed(2),
        t.cleared ? "yes" : "no",
        (t.note || "").replace(/\n/g, " "),
      ]);
    });
    return rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  function resetAll() {
    L.state = freshState();
    L.state.settings.firstRun = false;
    saveNow();
  }

  /* ───────────────────────  sample data  ─────────────────────────── */
  function loadSample() {
    const st = freshState();
    st.settings.firstRun = false;
    L.state = st;
    const acc = {
      checking: M.addAccount({ name: "Checking", type: "checking", startingBalance: money.toCents(3200), color: "#6a8cff" }),
      savings: M.addAccount({ name: "Savings", type: "savings", startingBalance: money.toCents(12500), color: "#37b98f" }),
      card: M.addAccount({ name: "Credit Card", type: "credit", startingBalance: 0, color: "#d3574e" }),
      cash: M.addAccount({ name: "Cash", type: "cash", startingBalance: money.toCents(140), color: "#e0913a" }),
    };
    const cat = {};
    L.state.categories.forEach((c) => (cat[c.name] = c.id));
    const now = new Date();
    const pick = (obj) => obj;
    // generate ~4 months of plausible activity
    for (let mBack = 3; mBack >= 0; mBack--) {
      const base = new Date(now.getFullYear(), now.getMonth() - mBack, 1);
      const y = base.getFullYear(), mo = base.getMonth();
      const dt = (day) => D.iso(new Date(y, mo, Math.min(day, new Date(y, mo + 1, 0).getDate())));
      // income
      M.addTx({ date: dt(1), type: "income", amount: money.toCents(2600), accountId: acc.checking.id, categoryId: cat["Paycheck"], payee: "Employer", cleared: true });
      M.addTx({ date: dt(15), type: "income", amount: money.toCents(2600), accountId: acc.checking.id, categoryId: cat["Paycheck"], payee: "Employer", cleared: true });
      M.addTx({ date: dt(20), type: "income", amount: money.toCents(9 + mBack), accountId: acc.savings.id, categoryId: cat["Interest"], payee: "Bank", cleared: true });
      // fixed expenses
      M.addTx({ date: dt(2), type: "expense", amount: money.toCents(1450), accountId: acc.checking.id, categoryId: cat["Rent / Mortgage"], payee: "Landlord", cleared: true });
      M.addTx({ date: dt(6), type: "expense", amount: money.toCents(120 + mBack * 6), accountId: acc.checking.id, categoryId: cat["Utilities"], payee: "Power & Water", cleared: true });
      M.addTx({ date: dt(3), type: "expense", amount: money.toCents(15.99), accountId: acc.card.id, categoryId: cat["Subscriptions"], payee: "Streaming", cleared: true });
      M.addTx({ date: dt(4), type: "expense", amount: money.toCents(45), accountId: acc.checking.id, categoryId: cat["Fitness"], payee: "Gym", cleared: true });
      M.addTx({ date: dt(5), type: "expense", amount: money.toCents(180), accountId: acc.checking.id, categoryId: cat["Insurance"], payee: "Auto Insurance", cleared: true });
      // variable groceries + dining spread across the month
      const gDays = [3, 9, 14, 21, 27];
      gDays.forEach((d, i) => {
        M.addTx({ date: dt(d), type: "expense", amount: money.toCents(60 + ((i * 17 + mBack * 5) % 55)), accountId: acc.card.id, categoryId: cat["Groceries"], payee: "Market", cleared: true });
      });
      const diner = [7, 12, 18, 24, 29];
      diner.forEach((d, i) => {
        M.addTx({ date: dt(d), type: "expense", amount: money.toCents(18 + ((i * 11 + mBack * 3) % 42)), accountId: acc.card.id, categoryId: cat["Dining Out"], payee: ["Cafe", "Taco Stand", "Sushi", "Diner", "Pizza"][i], cleared: true });
      });
      M.addTx({ date: dt(8), type: "expense", amount: money.toCents(52 + ((mBack * 9) % 40)), accountId: acc.card.id, categoryId: cat["Transportation"], payee: "Gas", cleared: true });
      M.addTx({ date: dt(16), type: "expense", amount: money.toCents(40 + ((mBack * 13) % 90)), accountId: acc.card.id, categoryId: cat["Shopping"], payee: "Store", cleared: true });
      M.addTx({ date: dt(22), type: "expense", amount: money.toCents(25 + ((mBack * 7) % 30)), accountId: acc.checking.id, categoryId: cat["Entertainment"], payee: "Movies", cleared: true });
      // savings transfer + card payoff
      M.addTx({ date: dt(16), type: "transfer", amount: money.toCents(400), accountId: acc.checking.id, toAccountId: acc.savings.id, payee: "Monthly savings", cleared: true });
      M.addTx({ date: dt(25), type: "transfer", amount: money.toCents(300), accountId: acc.checking.id, toAccountId: acc.card.id, payee: "Card payment", cleared: true });
    }
    // budgets for current + previous month = avg of prior activity
    M.autoBudget(D.monthKey(now), 3);
    M.autoBudget(D.addMonths(D.monthKey(now), -1), 2);
    // a couple of recurring rules
    M.addRecurring({ name: "Rent", type: "expense", amount: money.toCents(1450), accountId: acc.checking.id, categoryId: cat["Rent / Mortgage"], payee: "Landlord", freq: "monthly", nextDate: D.addMonths(D.monthKey(now), 1) + "-02" });
    M.addRecurring({ name: "Streaming", type: "expense", amount: money.toCents(15.99), accountId: acc.card.id, categoryId: cat["Subscriptions"], payee: "Streaming", freq: "monthly", nextDate: D.addMonths(D.monthKey(now), 1) + "-03" });
    saveNow();
  }

  /* ───────────────────────  expose  ─────────────────────────── */
  L.money = money;
  L.D = D;
  L.uid = uid;
  L.S = S;
  L.M = M;
  L.store = {
    KEY,
    load,
    save,
    saveNow,
    freshState,
    defaultCategories,
    runRecurring,
    exportJSON,
    importJSON,
    exportCSV,
    resetAll,
    loadSample,
    advance,
  };
})();
