window.addEventListener('error', (event) => {
  if (event && event.filename && event.filename.includes('admin-dashboard.js')) {
    console.warn('Admin dashboard handled error:', event.message);
  }
});

const TDS_CONFIG = window.TDS_CONFIG || {};
const TDS_STORAGE_KEY = 'tds_admin_dashboard_state_v6';
const TDS_SHARED_REQUESTS_KEY = 'tds_shared_work_requests_v1';
const TDS_REQUEST_STATUS_KEY = 'tds_client_request_status_v1';
const TDS_CLIENT_FEED_KEY = 'tds_client_feed_v1';
const TDS_MONTHLY_BALANCE_KEY = 'tds_monthly_business_balance_v2';
const TDS_CLIENT_APPROVALS_KEY = 'tds_client_approvals_v1';
const TDS_DISMISSED_CLIENTS_KEY = 'tds_dismissed_clients_v1';
const TDS_TEMP_ACCOUNTS_KEY = 'tds_temp_accounts_v1';
const TDS_TEMP_SESSION_KEY = 'tds_temp_session_v1';
const TDS_DIRECTOR_EMAIL = TDS_CONFIG.directorEmail || 'typedigitalsolutions@outlook.com';
const TDS_TIMEZONE = TDS_CONFIG.timezone || 'Africa/Johannesburg';

const TDS_DEMO_CLIENT_EMAILS = new Set([
  'hello@northstar.example',
  'hello@urbanfinds.example',
  'hello@glowstudio.example'
]);

const TDS_EMAILJS = {
  publicKey: TDS_CONFIG.emailjs?.publicKey || 'mDlKpULhhlpXDYf6J',
  serviceId: TDS_CONFIG.emailjs?.serviceId || 'service_duwrjdp',
  templateId: TDS_CONFIG.emailjs?.templateId || 'template_cd3utob',
  resetPasswordTemplateId: TDS_CONFIG.emailjs?.resetPasswordTemplateId || 'template_w43k4q7'
};

function isEmailJsConfigured(templateOverride = '') {
  const tpl = templateOverride || TDS_EMAILJS.templateId;
  return Boolean(
    window.emailjs &&
      typeof window.emailjs.send === 'function' &&
      TDS_EMAILJS.publicKey &&
      !TDS_EMAILJS.publicKey.startsWith('YOUR_') &&
      TDS_EMAILJS.serviceId &&
      !TDS_EMAILJS.serviceId.startsWith('YOUR_') &&
      tpl &&
      !tpl.startsWith('YOUR_')
  );
}

if (isEmailJsConfigured()) {
  try {
    window.emailjs.init({ publicKey: TDS_EMAILJS.publicKey });
  } catch {}
}

let trackedDateIso = '';
let activePaymentFilter = 'All';
let selectedFinanceMonthKey = '';
let selectedCalendarDateIso = '';

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeAmount(val) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function normalizePaymentStatus(status) {
  const clean = String(status || '').trim().toLowerCase();
  if (clean === 'paid') return 'Paid';
  if (clean === 'deposit paid' || clean === 'deposit') return 'Deposit Paid';
  return 'Unpaid';
}

function getSouthAfricaClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TDS_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TDS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  return {
    weekday: (map.weekday || '').toUpperCase(),
    day: map.day || '',
    month: (map.month || '').toUpperCase(),
    year: map.year || String(now.getFullYear()),
    monthKey: isoDate.slice(0, 7),
    hour: Number(map.hour || 0),
    time: `${map.hour || '00'}:${map.minute || '00'}`,
    isoDate
  };
}

function shiftMonthKey(monthKey, deltaMonths) {
  const [yStr, mStr] = String(monthKey || '2026-11').split('-');
  const d = new Date(Date.UTC(Number(yStr) || 2026, (Number(mStr) || 11) - 1 + deltaMonths, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function ensureFinanceSelectionDefaults() {
  const clock = getSouthAfricaClock();
  if (!selectedFinanceMonthKey) {
    selectedFinanceMonthKey = clock.monthKey;
  }
  if (!selectedCalendarDateIso || !selectedCalendarDateIso.startsWith(selectedFinanceMonthKey)) {
    selectedCalendarDateIso =
      clock.isoDate && clock.isoDate.startsWith(selectedFinanceMonthKey)
        ? clock.isoDate
        : `${selectedFinanceMonthKey}-01`;
  }
}

function futureDateIso(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().slice(0, 10);
}

const defaultDashboardState = {
  clients: [
    {
      id: generateUuid(),
      name: 'Northstar Consulting',
      email: 'hello@northstar.example',
      contact: '',
      project: 'Website Redesign & Maintenance',
      fee: 18500,
      payment: 'Deposit Paid',
      createdAt: new Date().toISOString(),
      milestones: [
        {
          id: generateUuid(),
          title: 'Frontend layout & staging review',
          dueDate: futureDateIso(2),
          completed: false,
          alerted: false
        }
      ]
    },
    {
      id: generateUuid(),
      name: 'Urban Finds',
      email: 'hello@urbanfinds.example',
      contact: '',
      project: 'E-Commerce & Online Stores',
      fee: 24000,
      payment: 'Paid',
      createdAt: new Date().toISOString(),
      milestones: [
        {
          id: generateUuid(),
          title: 'Checkout & payment gateway QA',
          dueDate: futureDateIso(7),
          completed: false,
          alerted: false
        }
      ]
    }
  ],
  customServices: [],
  requests: [
    {
      id: generateUuid(),
      company: 'Glow Studio',
      email: 'hello@glowstudio.example',
      contact: '',
      project: 'Client Portals & Management Systems',
      budget: 14500,
      receivedAt: 'Live'
    }
  ],
  activities: [
    {
      id: generateUuid(),
      text: 'TYPE Digital Solutions dashboard initialized.',
      time: 'Live'
    }
  ]
};

function readDashboardState() {
  try {
    const raw = localStorage.getItem(TDS_STORAGE_KEY);
    if (!raw) {
      return JSON.parse(JSON.stringify(defaultDashboardState));
    }
    const parsed = JSON.parse(raw);
    return {
      clients: Array.isArray(parsed.clients)
        ? parsed.clients.map((c) => ({
            ...c,
            id: c.id || generateUuid(),
            fee: sanitizeAmount(c.fee),
            payment: normalizePaymentStatus(c.payment),
            milestones: Array.isArray(c.milestones)
              ? c.milestones.map((m) => ({ ...m, id: m.id || generateUuid() }))
              : []
          }))
        : JSON.parse(JSON.stringify(defaultDashboardState.clients)),
      customServices: Array.isArray(parsed.customServices) ? parsed.customServices : [],
      requests: Array.isArray(parsed.requests)
        ? parsed.requests.map((r) => ({ ...r, id: r.id || generateUuid(), budget: sanitizeAmount(r.budget) }))
        : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : []
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultDashboardState));
  }
}

let dashState = readDashboardState();

function writeDashboardState() {
  try {
    localStorage.setItem(TDS_STORAGE_KEY, JSON.stringify(dashState));
  } catch {}
}

function readClientApprovals() {
  try {
    return JSON.parse(localStorage.getItem(TDS_CLIENT_APPROVALS_KEY) || '{}');
  } catch {
    return {};
  }
}

function readDismissedClients() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TDS_DISMISSED_CLIENTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissedClients(map) {
  try {
    localStorage.setItem(TDS_DISMISSED_CLIENTS_KEY, JSON.stringify(map || {}));
  } catch {}
}

function normalizeDismissedEntry(key, entry) {
  if (!entry) return null;
  if (typeof entry === 'boolean') {
    if (!entry) return null;
    const isEmailKey = String(key).includes('@');
    return {
      key,
      email: isEmailKey ? String(key).trim().toLowerCase() : '',
      name: key,
      company: isEmailKey ? '' : String(key).trim(),
      contact: '',
      dismissedAt: ''
    };
  }
  if (entry.dismissed === false) return null;
  const email = String(entry.email || (String(key).includes('@') ? key : '')).trim().toLowerCase();
  const company = String(entry.company || (!String(key).includes('@') ? key : '')).trim();
  return {
    key,
    email,
    name: entry.name || company || email || key,
    company,
    contact: entry.contact || '',
    dismissedAt: entry.dismissedAt || ''
  };
}

function getDismissedClientsList() {
  if (window.TDS_AUTH?.getDismissedClientsList) {
    return window.TDS_AUTH.getDismissedClientsList();
  }
  const dismissed = readDismissedClients();
  const list = [];
  for (const [key, entry] of Object.entries(dismissed)) {
    const norm = normalizeDismissedEntry(key, entry);
    if (norm) list.push(norm);
  }
  return list;
}

function isAnyDismissedMatch(email = '', companyName = '') {
  const emailKey = String(email || '').trim().toLowerCase();
  const companyKey = String(companyName || '').trim().toLowerCase();
  if (!emailKey && !companyKey) return false;
  for (const item of getDismissedClientsList()) {
    const eMail = String(item.email || '').trim().toLowerCase();
    const eComp = String(item.company || '').trim().toLowerCase();
    if (emailKey && eMail && eMail === emailKey) return true;
    if (companyKey && eComp && eComp === companyKey) return true;
  }
  return false;
}

function permanentlyDismissClient(email = '', companyName = '', clientName = '', contact = '') {
  const emailKey = String(email || '').trim().toLowerCase();
  const companyClean = String(companyName || '').trim();
  const companyKey = companyClean.toLowerCase();
  const blockKey = emailKey || companyKey;
  if (!blockKey) return;

  if (window.TDS_AUTH?.dismissClientRecord) {
    window.TDS_AUTH.dismissClientRecord({
      email: emailKey,
      name: clientName || companyClean || emailKey,
      company: companyClean,
      contact
    });
  } else {
    const dismissed = readDismissedClients();
    dismissed[blockKey] = {
      dismissed: true,
      email: emailKey,
      name: clientName || companyClean || emailKey,
      company: companyClean,
      contact,
      dismissedAt: new Date().toISOString()
    };
    writeDismissedClients(dismissed);
  }

  try {
    const approvals = readClientApprovals();
    if (emailKey && approvals[emailKey]) {
      delete approvals[emailKey];
      localStorage.setItem(TDS_CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
    }
  } catch {}

  try {
    const rawAccounts = localStorage.getItem(TDS_TEMP_ACCOUNTS_KEY);
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        const filtered = accounts.filter((acc) => {
          if (!acc || acc.role !== 'client') return true;
          const accEmail = String(acc.email || '').trim().toLowerCase();
          const accName = String(acc.name || acc.company || '').trim().toLowerCase();
          return !(emailKey && accEmail === emailKey) && !(companyKey && accName === companyKey);
        });
        localStorage.setItem(TDS_TEMP_ACCOUNTS_KEY, JSON.stringify(filtered));
      }
    }
  } catch {}

  try {
    const rawSession = sessionStorage.getItem(TDS_TEMP_SESSION_KEY);
    if (rawSession) {
      const sess = JSON.parse(rawSession);
      const sessEmail = String(sess?.email || '').trim().toLowerCase();
      const sessCompany = String(sess?.company || sess?.name || '').trim().toLowerCase();
      if (
        sess?.role === 'client' &&
        ((emailKey && sessEmail === emailKey) || (companyKey && sessCompany === companyKey))
      ) {
        sessionStorage.removeItem(TDS_TEMP_SESSION_KEY);
      }
    }
  } catch {}
}

function forgetDismissedClient(email = '', companyName = '', name = '') {
  const emailKey = String(email || '').trim().toLowerCase();
  const companyClean = String(companyName || '').trim();
  const companyKey = companyClean.toLowerCase();
  const nameKey = String(name || '').trim().toLowerCase();
  if (!emailKey && !companyKey && !nameKey) return;

  if (window.TDS_AUTH?.forgetDismissedClient) {
    window.TDS_AUTH.forgetDismissedClient(emailKey, companyClean, name);
  } else {
    const dismissed = readDismissedClients();
    for (const [key, entry] of Object.entries(dismissed)) {
      const norm = normalizeDismissedEntry(key, entry);
      const kLower = String(key || '').trim().toLowerCase();
      const eMail = String(norm?.email || '').trim().toLowerCase();
      const eComp = String(norm?.company || '').trim().toLowerCase();
      const eName = String(norm?.name || '').trim().toLowerCase();
      if (
        (emailKey && (eMail === emailKey || kLower === emailKey)) ||
        (companyKey && (eComp === companyKey || kLower === companyKey)) ||
        (nameKey && (eName === nameKey || kLower === nameKey))
      ) {
        delete dismissed[key];
      }
    }
    writeDismissedClients(dismissed);
  }

  try {
    const approvals = readClientApprovals();
    let changed = false;
    for (const [key, entry] of Object.entries(approvals)) {
      const kLower = String(key || '').trim().toLowerCase();
      const aMail = String(entry?.email || '').trim().toLowerCase();
      const aComp = String(entry?.company || '').trim().toLowerCase();
      if (
        (emailKey && (aMail === emailKey || kLower === emailKey)) ||
        (companyKey && aComp === companyKey)
      ) {
        delete approvals[key];
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(TDS_CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
    }
  } catch {}

  try {
    const rawAccounts = localStorage.getItem(TDS_TEMP_ACCOUNTS_KEY);
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        const filtered = accounts.filter((acc) => {
          const accEmail = String(acc?.email || '').trim().toLowerCase();
          const accComp = String(acc?.company || '').trim().toLowerCase();
          const accName = String(acc?.name || '').trim().toLowerCase();
          return !(
            (emailKey && accEmail === emailKey) ||
            (companyKey && (accComp === companyKey || accName === companyKey))
          );
        });
        localStorage.setItem(TDS_TEMP_ACCOUNTS_KEY, JSON.stringify(filtered));
      }
    }
  } catch {}

  dashState.requests = dashState.requests.filter((r) => {
    const rEmail = String(r?.email || '').trim().toLowerCase();
    const rComp = String(r?.company || '').trim().toLowerCase();
    const rName = String(r?.clientName || '').trim().toLowerCase();
    return !(
      (emailKey && rEmail === emailKey) ||
      (companyKey && (rComp === companyKey || rName === companyKey))
    );
  });

  dashState.clients = dashState.clients.filter((c) => {
    const cEmail = String(c?.email || '').trim().toLowerCase();
    const cComp = String(c?.company || '').trim().toLowerCase();
    const cName = String(c?.name || '').trim().toLowerCase();
    return !(
      (emailKey && cEmail === emailKey) ||
      (companyKey && (cComp === companyKey || cName === companyKey))
    );
  });

  writeDashboardState();
}

function removeDismissedClient(email = '', companyName = '', name = '') {
  forgetDismissedClient(email, companyName, name);
}

function approveClientForPasswordSetup(email, reqItem = {}) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) return;

  forgetDismissedClient(key, reqItem.company || reqItem.clientName || '', reqItem.clientName || '');

  try {
    const approvals = readClientApprovals();
    const prev = approvals[key] || {};
    const firstName = prev.firstName || reqItem.firstName || '';
    const surname = prev.surname || reqItem.surname || '';
    const fullName =
      [firstName, surname].filter(Boolean).join(' ').trim() ||
      prev.name ||
      reqItem.clientName ||
      reqItem.company ||
      key;

    const updated = {
      ...prev,
      email: key,
      firstName,
      surname,
      name: fullName,
      company: prev.company || reqItem.company || fullName,
      contact: prev.contact || reqItem.contact || '',
      role: 'client',
      approved: true,
      passwordSetupComplete: false,
      password: '',
      updatedAt: new Date().toISOString()
    };

    approvals[key] = updated;
    localStorage.setItem(TDS_CLIENT_APPROVALS_KEY, JSON.stringify(approvals));

    const rawAccounts = localStorage.getItem(TDS_TEMP_ACCOUNTS_KEY);
    const list = rawAccounts ? JSON.parse(rawAccounts) : [];
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(
      (a) => a && a.role === 'client' && String(a.email || '').trim().toLowerCase() === key
    );
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...updated };
    } else {
      arr.unshift(updated);
    }
    localStorage.setItem(TDS_TEMP_ACCOUNTS_KEY, JSON.stringify(arr.slice(0, 40)));
  } catch {}
}

function scrubExposedPasswordNotifications() {
  try {
    const raw = localStorage.getItem(TDS_CLIENT_FEED_KEY);
    if (!raw) return;
    const feed = JSON.parse(raw);
    if (!feed || typeof feed !== 'object') return;
    if (Array.isArray(feed.notifications)) {
      feed.notifications = feed.notifications.filter((n) => {
        const combined = `${n?.title || ''} ${n?.detail || ''}`;
        return !combined.includes('Your login password is') && !combined.includes('TDSDirector2026!');
      });
      localStorage.setItem(TDS_CLIENT_FEED_KEY, JSON.stringify(feed));
    }
  } catch {}
}

function readMonthlyStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TDS_MONTHLY_BALANCE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readMonthlyReserve(monthKey) {
  const map = readMonthlyStore();
  const entry = map[monthKey];
  if (entry && typeof entry === 'object') {
    return {
      extraIncome: sanitizeAmount(entry.extraIncome),
      setAside: sanitizeAmount(entry.setAside),
      spent: sanitizeAmount(entry.spent),
      note: String(entry.note || 'Reserved for business costs'),
      allocations: Array.isArray(entry.allocations) ? entry.allocations : [],
      dayEntries: Array.isArray(entry.dayEntries) ? entry.dayEntries : [],
      platformExpenses: Array.isArray(entry.platformExpenses) ? entry.platformExpenses : []
    };
  }
  return {
    extraIncome: 0,
    setAside: 0,
    spent: 0,
    note: 'Reserved for business costs',
    allocations: [],
    dayEntries: [],
    platformExpenses: []
  };
}

function saveMonthlyReserve(monthKey, reserveObj) {
  try {
    const map = readMonthlyStore();
    map[monthKey] = {
      extraIncome: sanitizeAmount(reserveObj.extraIncome),
      setAside: sanitizeAmount(reserveObj.setAside),
      spent: sanitizeAmount(reserveObj.spent),
      note: String(reserveObj.note || 'Reserved for business costs'),
      allocations: Array.isArray(reserveObj.allocations) ? reserveObj.allocations.slice(0, 12) : [],
      dayEntries: Array.isArray(reserveObj.dayEntries) ? reserveObj.dayEntries : [],
      platformExpenses: Array.isArray(reserveObj.platformExpenses) ? reserveObj.platformExpenses : []
    };
    localStorage.setItem(TDS_MONTHLY_BALANCE_KEY, JSON.stringify(map));
  } catch {}
}

function computeMonthTotals(monthKey, reserve) {
  let projectCollected = 0;
  for (const client of dashState.clients) {
    const fee = sanitizeAmount(client.fee);
    const status = normalizePaymentStatus(client.payment);
    if (status === 'Paid') {
      projectCollected += fee;
    } else if (status === 'Deposit Paid') {
      projectCollected += fee * 0.5;
    }
  }

  let dayIncome = 0;
  let dayExpense = 0;
  for (const item of reserve.dayEntries || []) {
    const amt = sanitizeAmount(item.amount);
    if (item.type === 'income') dayIncome += amt;
    else dayExpense += amt;
  }

  let platformCost = 0;
  for (const plat of reserve.platformExpenses || []) {
    platformCost += sanitizeAmount(plat.amount);
  }

  const totalIncome = projectCollected + sanitizeAmount(reserve.extraIncome) + dayIncome;
  const totalExpenses = sanitizeAmount(reserve.setAside) + sanitizeAmount(reserve.spent) + dayExpense + platformCost;
  const availableBalance = totalIncome - totalExpenses;

  return {
    projectCollected,
    dayIncome,
    dayExpense,
    platformCost,
    totalIncome,
    totalExpenses,
    availableBalance
  };
}

function pushClientNotification(clientName, title, detail, type = 'info') {
  try {
    const raw = localStorage.getItem(TDS_CLIENT_FEED_KEY);
    const feed = raw ? JSON.parse(raw) : { notifications: [], completedContracts: [], acceptedWork: [] };
    feed.notifications = Array.isArray(feed.notifications) ? feed.notifications : [];
    feed.completedContracts = Array.isArray(feed.completedContracts) ? feed.completedContracts : [];
    feed.acceptedWork = Array.isArray(feed.acceptedWork) ? feed.acceptedWork : [];

    const stamp = `${getSouthAfricaClock().isoDate} · ${getSouthAfricaClock().time}`;
    feed.notifications.unshift({
      id: generateUuid(),
      clientName: String(clientName || 'Northstar Consulting'),
      title: String(title || ''),
      detail: String(detail || ''),
      type,
      time: stamp
    });
    feed.notifications = feed.notifications.slice(0, 20);
    localStorage.setItem(TDS_CLIENT_FEED_KEY, JSON.stringify(feed));
  } catch {}
}

function recordClientAcceptedWork(reqItem) {
  try {
    const raw = localStorage.getItem(TDS_CLIENT_FEED_KEY);
    const feed = raw ? JSON.parse(raw) : { notifications: [], completedContracts: [], acceptedWork: [] };
    feed.acceptedWork = Array.isArray(feed.acceptedWork) ? feed.acceptedWork : [];
    feed.acceptedWork.unshift({
      id: reqItem.id,
      clientName: reqItem.company,
      email: reqItem.email,
      project: reqItem.project,
      budget: sanitizeAmount(reqItem.budget),
      acceptedAt: `${getSouthAfricaClock().isoDate} · ${getSouthAfricaClock().time}`
    });
    localStorage.setItem(TDS_CLIENT_FEED_KEY, JSON.stringify(feed));
  } catch {}
}

function writeRequestStatusBack(requestId, statusLabel) {
  try {
    const current = JSON.parse(localStorage.getItem(TDS_REQUEST_STATUS_KEY) || '{}');
    current[requestId] = {
      status: statusLabel,
      updatedAt: `${getSouthAfricaClock().isoDate} · ${getSouthAfricaClock().time}`
    };
    localStorage.setItem(TDS_REQUEST_STATUS_KEY, JSON.stringify(current));
  } catch {}
}

function removeRequestFromBridge(requestId) {
  try {
    const raw = localStorage.getItem(TDS_SHARED_REQUESTS_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const filtered = list.filter((item) => String(item.id) !== String(requestId));
    localStorage.setItem(TDS_SHARED_REQUESTS_KEY, JSON.stringify(filtered));
  } catch {}
}

function syncClientBridgeRequests() {
  let added = false;

  try {
    const raw = localStorage.getItem(TDS_SHARED_REQUESTS_KEY);
    if (raw) {
      const incomingList = JSON.parse(raw);
      if (Array.isArray(incomingList)) {
        for (const item of incomingList) {
          if (!item || !item.id || isAnyDismissedMatch(item.email, item.company)) continue;
          const exists = dashState.requests.some((r) => String(r.id) === String(item.id));
          if (!exists) {
            dashState.requests.unshift({
              id: String(item.id),
              company: String(item.company || 'Client Workspace'),
              email: String(item.email || ''),
              contact: String(item.contact || ''),
              project: String(item.project || 'Client Work Request'),
              budget: sanitizeAmount(item.budget),
              priority: String(item.priority || 'Normal'),
              notes: String(item.notes || ''),
              receivedAt: String(item.receivedAt || getSouthAfricaClock().isoDate)
            });
            added = true;
          }
        }
      }
    }
  } catch {}

  try {
    const approvals = readClientApprovals();
    const rawAccounts = localStorage.getItem(TDS_TEMP_ACCOUNTS_KEY);
    const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        if (!acc || acc.role !== 'client' || !acc.email) continue;
        const emailKey = String(acc.email).trim().toLowerCase();
        if (TDS_DEMO_CLIENT_EMAILS.has(emailKey) || isAnyDismissedMatch(emailKey, acc.company || acc.name)) continue;
        if (!approvals[emailKey]) {
          approvals[emailKey] = {
            approved: Boolean(acc.approved),
            passwordSetupComplete: Boolean(acc.passwordSetupComplete),
            firstName: acc.firstName || '',
            surname: acc.surname || '',
            name: acc.name || emailKey,
            company: acc.company || acc.name || emailKey,
            contact: acc.contact || '',
            email: emailKey,
            password: acc.password && acc.password !== 'TDSDirector2026!' ? acc.password : '',
            requestedAt: acc.createdAt || new Date().toISOString()
          };
        }
      }
      localStorage.setItem(TDS_CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
    }

    for (const entry of Object.values(approvals)) {
      if (!entry || !entry.email || entry.approved) continue;
      const emailKey = String(entry.email).trim().toLowerCase();
      if (TDS_DEMO_CLIENT_EMAILS.has(emailKey) || isAnyDismissedMatch(emailKey, entry.company || entry.name)) continue;

      const fullName =
        [entry.firstName, entry.surname].filter(Boolean).join(' ').trim() ||
        entry.name ||
        entry.company ||
        emailKey;
      const reqId = `approval_${emailKey}`;
      const alreadyQueued = dashState.requests.some((r) => String(r.id) === reqId);
      const alreadyClient = dashState.clients.some(
        (c) => String(c.email || '').trim().toLowerCase() === emailKey
      );

      if (!alreadyQueued && !alreadyClient) {
        dashState.requests.unshift({
          id: reqId,
          company: String(entry.company || fullName),
          clientName: fullName,
          firstName: entry.firstName || '',
          surname: entry.surname || '',
          contact: entry.contact || '',
          email: emailKey,
          project: 'New Client Account Request',
          budget: 0,
          priority: 'Pending Approval',
          notes: `Name: ${fullName} · Contact: ${entry.contact || 'Not provided'}`,
          receivedAt: getSouthAfricaClock().isoDate
        });
        added = true;
      }
    }
  } catch {}

  if (added) {
    writeDashboardState();
  }
}

function deleteAllUnapprovedClients() {
  let removedCount = 0;
  const unapprovedEmails = new Set();

  try {
    const approvals = readClientApprovals();
    const keptApprovals = {};

    for (const [key, entry] of Object.entries(approvals)) {
      const emailKey = String(entry?.email || key).trim().toLowerCase();
      if (!emailKey) continue;
      if (entry?.approved || TDS_DEMO_CLIENT_EMAILS.has(emailKey)) {
        keptApprovals[key] = entry;
      } else {
        unapprovedEmails.add(emailKey);
        removedCount += 1;
      }
    }
    localStorage.setItem(TDS_CLIENT_APPROVALS_KEY, JSON.stringify(keptApprovals));
  } catch {}

  try {
    const rawAccounts = localStorage.getItem(TDS_TEMP_ACCOUNTS_KEY);
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        const approvals = readClientApprovals();
        const remainingAccounts = accounts.filter((acc) => {
          if (!acc || acc.role !== 'client') return true;
          const emailKey = String(acc.email || '').trim().toLowerCase();
          const approved =
            Boolean(acc.approved) ||
            Boolean(approvals[emailKey]?.approved) ||
            TDS_DEMO_CLIENT_EMAILS.has(emailKey);
          if (!approved) {
            unapprovedEmails.add(emailKey);
            removedCount += 1;
            return false;
          }
          return true;
        });
        localStorage.setItem(TDS_TEMP_ACCOUNTS_KEY, JSON.stringify(remainingAccounts));
      }
    }
  } catch {}

  try {
    const rawSession = sessionStorage.getItem(TDS_TEMP_SESSION_KEY);
    if (rawSession) {
      const sess = JSON.parse(rawSession);
      const sessEmail = String(sess?.email || '').trim().toLowerCase();
      if (sess?.role === 'client' && (unapprovedEmails.has(sessEmail) || !sess?.approved)) {
        sessionStorage.setItem(
          TDS_TEMP_SESSION_KEY,
          JSON.stringify({ ...sess, unapprovedRemoved: true })
        );
      }
    }
  } catch {}

  dashState.requests = dashState.requests.filter((req) => {
    const reqEmail = String(req.email || '').trim().toLowerCase();
    const isApprovalReq =
      String(req.id).startsWith('approval_') ||
      req.project === 'New Client Account Approval' ||
      req.project === 'New Client Account Registration' ||
      req.project === 'New Client Account Request';
    if (isApprovalReq && reqEmail && !TDS_DEMO_CLIENT_EMAILS.has(reqEmail)) {
      unapprovedEmails.add(reqEmail);
      removeRequestFromBridge(req.id);
      return false;
    }
    return true;
  });

  dashState.clients = dashState.clients.filter((client) => {
    const clientEmail = String(client.email || '').trim().toLowerCase();
    return !(clientEmail && unapprovedEmails.has(clientEmail));
  });

  addLogEntry(
    `Removed all unapproved client accounts (${removedCount} account${removedCount === 1 ? '' : 's'} cleared).`
  );
  writeDashboardState();
  renderAllSections();
}

function getSupabaseHandle() {
  return window.supabaseClient || window.sb || null;
}

async function persistRow(table, record) {
  const sb = getSupabaseHandle();
  if (!sb || typeof sb.from !== 'function') return;
  try {
    await sb.from(table).upsert(record);
  } catch {}
}

async function removeRow(table, id) {
  const sb = getSupabaseHandle();
  if (!sb || typeof sb.from !== 'function') return;
  try {
    await sb.from(table).delete().eq('id', id);
  } catch {}
}

async function loadLiveSupabaseData() {
  const sb = getSupabaseHandle();
  if (!sb || typeof sb.from !== 'function') return;

  try {
    const [clientsResult, requestsResult] = await Promise.all([
      sb.from('clients').select('*'),
      sb.from('company_requests').select('*')
    ]);

    if (Array.isArray(clientsResult.data) && clientsResult.data.length > 0) {
      dashState.clients = clientsResult.data.map((row) => ({
        ...row,
        fee: sanitizeAmount(row.fee),
        payment: normalizePaymentStatus(row.payment),
        milestones: Array.isArray(row.milestones) ? row.milestones : []
      }));
    }

    if (Array.isArray(requestsResult.data)) {
      dashState.requests = requestsResult.data
        .filter((row) => !isAnyDismissedMatch(row.email, row.company))
        .map((row) => ({
          ...row,
          project: row.project || row.scope || 'Web Development & Landing Pages',
          budget: sanitizeAmount(row.budget)
        }));
    }

    writeDashboardState();
    renderAllSections();
  } catch {}

  if (typeof sb.channel === 'function') {
    try {
      sb.channel('tds-live-company-requests')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'company_requests' },
          (payload) => {
            const incoming = payload.new;
            if (!incoming || dashState.requests.some((r) => r.id === incoming.id)) return;
            if (isAnyDismissedMatch(incoming.email, incoming.company)) return;
            const clock = getSouthAfricaClock();
            dashState.requests.unshift({
              id: incoming.id,
              company: incoming.company,
              email: incoming.email,
              project: incoming.project || incoming.scope || 'Web Development & Landing Pages',
              budget: sanitizeAmount(incoming.budget),
              receivedAt: `${clock.isoDate} · ${clock.time}`
            });
            addLogEntry(`New client request from <strong>${escapeHtml(incoming.company)}</strong>.`);
            writeDashboardState();
            renderAllSections();
          }
        )
        .subscribe();
    } catch {}
  }
}

function formatRand(num) {
  return `R ${sanitizeAmount(num).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function daysUntilTarget(dateStr) {
  if (!dateStr) return 999;
  const clock = getSouthAfricaClock();
  const today = new Date(`${clock.isoDate}T00:00:00`);
  const due = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 999;
  return Math.ceil((due - today) / 86400000);
}

function addLogEntry(html) {
  const clock = getSouthAfricaClock();
  dashState.activities.unshift({
    id: generateUuid(),
    text: html,
    time: `${clock.isoDate} · ${clock.time}`
  });
  dashState.activities = dashState.activities.slice(0, 15);
  writeDashboardState();
}

function setClientPaymentStatus(clientId, newStatus) {
  const normalized = normalizePaymentStatus(newStatus);
  const client = dashState.clients.find((c) => String(c.id) === String(clientId));
  if (!client) return;
  client.payment = normalized;
  persistRow('clients', client);
  addLogEntry(
    `Updated project payment status for <strong>${escapeHtml(client.name)}</strong> (${escapeHtml(client.project || 'Project')}) to <strong>${escapeHtml(normalized)}</strong>.`
  );
  writeDashboardState();
  renderAllSections();
}

async function sendNotificationEmail(clientEmail, subject, message, extraParams = {}) {
  if (window.TDS_AUTH?.dispatchPortalEmail) {
    const res = await window.TDS_AUTH.dispatchPortalEmail(
      clientEmail,
      subject,
      message,
      extraParams.link || '',
      extraParams.name || clientEmail,
      extraParams.templateId || TDS_EMAILJS.templateId,
      extraParams
    );
    return Boolean(res?.sent);
  }
  if (!isEmailJsConfigured(extraParams.templateId)) return false;
  try {
    await window.emailjs.send(
      TDS_EMAILJS.serviceId,
      extraParams.templateId || TDS_EMAILJS.templateId,
      {
        email: clientEmail,
        to_email: clientEmail,
        cc_email: TDS_DIRECTOR_EMAIL,
        reply_to: TDS_DIRECTOR_EMAIL,
        subject,
        message,
        ...extraParams
      }
    );
    return true;
  } catch {
    return false;
  }
}

async function sendClientApprovedCreatePasswordEmail(reqItem, isResend = false) {
  const cleanEmail = String(reqItem.email || '').trim();
  const cleanName =
    [reqItem.firstName, reqItem.surname].filter(Boolean).join(' ').trim() ||
    reqItem.clientName ||
    reqItem.company ||
    cleanEmail ||
    'Client';

  if (!cleanEmail) return false;

  if (isAnyDismissedMatch(cleanEmail, reqItem.company || cleanName)) {
    addLogEntry(
      `Skipped sending approval email to dismissed client <strong>${escapeHtml(cleanName)}</strong> (${escapeHtml(cleanEmail)}).`
    );
    writeDashboardState();
    renderAllSections();
    return false;
  }

  approveClientForPasswordSetup(cleanEmail, reqItem);

  const loginUrl = new URL('login.html', window.location.href).href;
  const approvalStatement = 'Client approved — create password';
  const subjectLine = isResend
    ? `${approvalStatement} (Resent) — TYPE Digital Solutions`
    : `${approvalStatement} — TYPE Digital Solutions`;

  const bodyText =
    `Hello ${cleanName},\n\n` +
    `${approvalStatement}.\n\n` +
    `Your client account with TYPE Digital Solutions has been approved. ` +
    `Visit ${loginUrl}, enter your email (${cleanEmail}) under Client login, and complete Create password and Confirm password to access your dashboard.`;

  const emailed = await sendNotificationEmail(cleanEmail, subjectLine, bodyText, {
    name: cleanName,
    link: loginUrl
  });

  pushClientNotification(
    reqItem.company || cleanName,
    approvalStatement,
    `Your account (${cleanEmail}) is approved. Open the sign-in page to create and confirm your password.`,
    'info'
  );

  addLogEntry(
    `${isResend ? 'Resent' : 'Sent'} "${escapeHtml(approvalStatement)}" email to <strong>${escapeHtml(cleanName)}</strong> (${escapeHtml(cleanEmail)})${emailed ? ' via EmailJS' : ' (queued locally)'}.`
  );
  writeDashboardState();
  renderAllSections();
  return emailed;
}

async function sendRemovedFromDismissedEmail(item, requestTitle = 'Account Re-registration Access') {
  const cleanEmail = String(item.email || '').trim();
  const recipientName = item.name || item.company || cleanEmail || 'Client';
  const createAccountUrl = new URL(
    `createAcc.html${cleanEmail ? `?email=${encodeURIComponent(cleanEmail)}` : ''}`,
    window.location.href
  ).href;

  if (window.TDS_AUTH?.notifyClientRemovedFromDismissed && cleanEmail) {
    const res = await window.TDS_AUTH.notifyClientRemovedFromDismissed({
      email: cleanEmail,
      name: recipientName,
      company: item.company || '',
      title: requestTitle
    });
    return Boolean(res?.sent);
  }

  const bodyText =
    `Hi ${recipientName},\n\n` +
    `Thank you for reaching out to us! We have received your request: "${requestTitle}", and we'll do our best to process it within 3 business days.\n\n` +
    `Best regards,\nTYPE Digital Solutions`;

  if (!cleanEmail) return false;
  return sendNotificationEmail(
    cleanEmail,
    `Request Received — ${requestTitle}`,
    bodyText,
    {
      name: recipientName,
      title: requestTitle,
      link: createAccountUrl
    }
  );
}

function updateLiveClockDisplay() {
  const clock = getSouthAfricaClock();
  const todayEl = document.querySelector('[data-today]');
  const greetingEl = document.querySelector('[data-greeting]');

  if (todayEl) {
    todayEl.textContent = `${clock.weekday}, ${clock.day} ${clock.month} ${clock.year} · ${clock.time}`;
  }

  if (greetingEl) {
    greetingEl.textContent =
      clock.hour < 12 ? 'Good morning' : clock.hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  if (trackedDateIso && trackedDateIso !== clock.isoDate) {
    trackedDateIso = clock.isoDate;
    renderAllSections();
    runMilestoneAlertSweep();
  } else if (!trackedDateIso) {
    trackedDateIso = clock.isoDate;
  }
}

function restoreCustomServiceOptions() {
  const select = document.getElementById('clientServiceSelect');
  if (!select || !Array.isArray(dashState.customServices)) return;
  const otherOption = select.querySelector('option[value="Other"]');

  for (const label of dashState.customServices) {
    const exists = Array.from(select.options).some(
      (opt) => opt.value.toLowerCase() === String(label).toLowerCase()
    );
    if (!exists) {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      if (otherOption) {
        select.insertBefore(option, otherOption);
      } else {
        select.appendChild(option);
      }
    }
  }
}

function syncMilestoneDropdown() {
  const msSelect = document.getElementById('milestoneClientSelect');
  if (!msSelect) return;

  msSelect.disabled = false;
  msSelect.style.pointerEvents = 'auto';

  const prevSelected = msSelect.value;
  msSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = dashState.clients.length ? 'Select client...' : 'No clients available';
  msSelect.appendChild(placeholder);

  for (const client of dashState.clients) {
    const opt = document.createElement('option');
    opt.value = String(client.id);
    opt.textContent = `${client.name} — ${client.project}`;
    msSelect.appendChild(opt);
  }

  if (prevSelected && dashState.clients.some((c) => String(c.id) === String(prevSelected))) {
    msSelect.value = prevSelected;
  } else if (dashState.clients.length > 0) {
    msSelect.value = String(dashState.clients[0].id);
  } else {
    msSelect.value = '';
  }
}

function renderSummaryCards() {
  ensureFinanceSelectionDefaults();
  const reserve = readMonthlyReserve(selectedFinanceMonthKey);
  const totals = computeMonthTotals(selectedFinanceMonthKey, reserve);

  let pipelineSum = 0;
  let dueSoonSum = 0;

  for (const client of dashState.clients) {
    const fee = sanitizeAmount(client.fee);
    const status = normalizePaymentStatus(client.payment);
    if (status === 'Deposit Paid') {
      pipelineSum += fee * 0.5;
    } else if (status === 'Unpaid') {
      pipelineSum += fee;
    }

    for (const ms of client.milestones || []) {
      if (!ms.completed && daysUntilTarget(ms.dueDate) <= 3) {
        dueSoonSum += 1;
      }
    }
  }

  const paidEl = document.getElementById('statPaidIncome');
  const pipeEl = document.getElementById('statPipelineNote');
  const clientsEl = document.getElementById('statTotalClients');
  const dueEl = document.getElementById('statDueMilestones');
  const reqEl = document.getElementById('statNewRequests');

  if (paidEl) paidEl.textContent = formatRand(totals.totalIncome);
  if (pipeEl) pipeEl.textContent = `Pipeline: ${formatRand(pipelineSum)}`;
  if (clientsEl) clientsEl.textContent = String(dashState.clients.length).padStart(2, '0');
  if (dueEl) dueEl.textContent = String(dueSoonSum).padStart(2, '0');
  if (reqEl) reqEl.textContent = String(dashState.requests.length).padStart(2, '0');

  const periodEl = document.getElementById('monthlyBalancePeriod');
  const collectedEl = document.getElementById('monthlyCollectedValue');
  const setAsideValEl = document.getElementById('monthlySetAsideValue');
  const spentValEl = document.getElementById('monthlySpentValue');
  const availableValEl = document.getElementById('netMonthlyBalanceValue');
  const noteInput = document.getElementById('setAsideLabelInput');

  if (periodEl) periodEl.textContent = selectedFinanceMonthKey;
  if (collectedEl) collectedEl.textContent = formatRand(totals.totalIncome);
  if (setAsideValEl) setAsideValEl.textContent = formatRand(reserve.setAside);
  if (spentValEl) spentValEl.textContent = formatRand(totals.totalExpenses);
  if (availableValEl) availableValEl.textContent = formatRand(totals.availableBalance);
  if (noteInput && document.activeElement !== noteInput && !noteInput.value) {
    noteInput.value = reserve.note || '';
  }
}

function renderMonthlyGraphAndCalendar() {
  ensureFinanceSelectionDefaults();
  const reserve = readMonthlyReserve(selectedFinanceMonthKey);
  const totals = computeMonthTotals(selectedFinanceMonthKey, reserve);

  const netPill = document.getElementById('monthlyGraphNetPill');
  if (netPill) {
    netPill.textContent = `Net: ${formatRand(totals.availableBalance)}`;
  }

  const graphEl = document.getElementById('monthlyFinanceGraph');
  if (graphEl) {
    const store = readMonthlyStore();
    const monthKeys = Object.keys(store).sort();
    if (!monthKeys.includes(selectedFinanceMonthKey)) {
      monthKeys.push(selectedFinanceMonthKey);
      monthKeys.sort();
    }
    const recentMonths = monthKeys.slice(-6);
    const maxScale = Math.max(
      100,
      ...recentMonths.map((mk) => {
        const r = readMonthlyReserve(mk);
        const t = computeMonthTotals(mk, r);
        return Math.max(t.totalIncome, t.totalExpenses);
      })
    );

    graphEl.innerHTML = recentMonths
      .map((mk) => {
        const r = readMonthlyReserve(mk);
        const t = computeMonthTotals(mk, r);
        const incPct = Math.min(100, Math.round((t.totalIncome / maxScale) * 100));
        const expPct = Math.min(100, Math.round((t.totalExpenses / maxScale) * 100));
        const isCurrent = mk === selectedFinanceMonthKey;
        return `
          <div class="finance-graph-row" data-select-month="${escapeHtml(mk)}" style="margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid ${isCurrent ? 'currentColor' : 'rgba(128,128,128,0.25)'};cursor:pointer">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
              <strong>${escapeHtml(mk)}</strong>
              <span>Income: <strong>${formatRand(t.totalIncome)}</strong> · Expenses: <strong>${formatRand(t.totalExpenses)}</strong></span>
            </div>
            <div style="height:8px;background:rgba(128,128,128,0.14);border-radius:4px;overflow:hidden;margin-bottom:4px">
              <div style="height:100%;width:${incPct}%;background:#16a34a"></div>
            </div>
            <div style="height:8px;background:rgba(128,128,128,0.14);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${expPct}%;background:#dc2626"></div>
            </div>
          </div>
        `;
      })
      .join('');

    graphEl.querySelectorAll('[data-select-month]').forEach((row) => {
      row.addEventListener('click', () => {
        selectedFinanceMonthKey = row.dataset.selectMonth || selectedFinanceMonthKey;
        selectedCalendarDateIso = `${selectedFinanceMonthKey}-01`;
        renderAllSections();
      });
    });
  }

  const calGrid = document.getElementById('monthlyFinanceCalendarGrid');
  const selectedDateLabel = document.getElementById('selectedCalendarDateLabel');
  const dateInput = document.getElementById('calendarEntryDateInput');

  if (selectedDateLabel) {
    selectedDateLabel.textContent = selectedCalendarDateIso;
  }
  if (dateInput && document.activeElement !== dateInput) {
    dateInput.value = selectedCalendarDateIso;
  }

  if (calGrid) {
    const [yStr, mStr] = selectedFinanceMonthKey.split('-');
    const year = Number(yStr) || 2026;
    const monthIdx = (Number(mStr) || 11) - 1;
    const firstWeekday = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

    const dayTotals = {};
    for (const entry of reserve.dayEntries || []) {
      const dKey = String(entry.date || '').trim();
      if (!dKey) continue;
      if (!dayTotals[dKey]) dayTotals[dKey] = { income: 0, expense: 0 };
      if (entry.type === 'income') dayTotals[dKey].income += sanitizeAmount(entry.amount);
      else dayTotals[dKey].expense += sanitizeAmount(entry.amount);
    }

    const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map(
        (wd) =>
          `<div style="text-align:center;font-weight:600;font-size:0.78rem;padding:4px;opacity:0.75">${wd}</div>`
      )
      .join('');

    const blanks = Array.from({ length: firstWeekday }, () => `<div style="padding:6px"></div>`).join('');

    const daysHtml = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const iso = `${selectedFinanceMonthKey}-${String(dayNum).padStart(2, '0')}`;
      const info = dayTotals[iso] || { income: 0, expense: 0 };
      const isSelected = iso === selectedCalendarDateIso;
      return `
        <button
          type="button"
          class="btn"
          data-cal-day="${escapeHtml(iso)}"
          style="display:flex;flex-direction:column;align-items:flex-start;padding:6px;min-height:54px;text-align:left;border-width:${isSelected ? '2px' : '1px'}"
        >
          <strong>${dayNum}</strong>
          ${info.income > 0 ? `<small style="color:#16a34a">+R${Math.round(info.income)}</small>` : ''}
          ${info.expense > 0 ? `<small style="color:#dc2626">-R${Math.round(info.expense)}</small>` : ''}
        </button>
      `;
    }).join('');

    calGrid.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">
        ${weekdayHeaders}
        ${blanks}
        ${daysHtml}
      </div>
    `;

    calGrid.querySelectorAll('[data-cal-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCalendarDateIso = btn.dataset.calDay || selectedCalendarDateIso;
        if (dateInput) dateInput.value = selectedCalendarDateIso;
        renderMonthlyGraphAndCalendar();
      });
    });
  }

  const dayEntriesEl = document.getElementById('calendarDayEntriesList');
  if (dayEntriesEl) {
    const entriesForDate = (reserve.dayEntries || []).filter(
      (e) => String(e.date || '') === String(selectedCalendarDateIso)
    );
    if (!entriesForDate.length) {
      dayEntriesEl.innerHTML = `<p>No income or expense entries recorded for ${escapeHtml(selectedCalendarDateIso)}.</p>`;
    } else {
      dayEntriesEl.innerHTML = entriesForDate
        .map(
          (e) => `
          <div class="activity-item">
            <div>
              <strong>${escapeHtml(e.type === 'income' ? 'Income' : 'Expense')}</strong> · ${escapeHtml(e.title || '')}
              <div><small>${escapeHtml(e.date)} · ${formatRand(e.amount)}</small></div>
            </div>
            <button type="button" class="btn" data-delete-day-entry="${escapeHtml(e.id)}">Remove</button>
          </div>
        `
        )
        .join('');

      dayEntriesEl.querySelectorAll('[data-delete-day-entry]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const eid = btn.dataset.deleteDayEntry;
          const cur = readMonthlyReserve(selectedFinanceMonthKey);
          cur.dayEntries = (cur.dayEntries || []).filter((item) => String(item.id) !== String(eid));
          saveMonthlyReserve(selectedFinanceMonthKey, cur);
          renderAllSections();
        });
      });
    }
  }

  const platBadge = document.getElementById('platformExpenseTotalBadge');
  if (platBadge) {
    platBadge.textContent = formatRand(totals.platformCost);
  }

  const platTbody = document.getElementById('platformExpensesTableBody');
  if (platTbody) {
    const plats = reserve.platformExpenses || [];
    if (!plats.length) {
      platTbody.innerHTML = '<tr><td colspan="4">No platform expenses added for this month.</td></tr>';
    } else {
      platTbody.innerHTML = plats
        .map(
          (p) => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.cycle || 'Monthly')}</td>
            <td>${formatRand(p.amount)}</td>
            <td><button type="button" class="btn" data-remove-platform="${escapeHtml(p.id)}">Remove</button></td>
          </tr>
        `
        )
        .join('');

      platTbody.querySelectorAll('[data-remove-platform]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.dataset.removePlatform;
          const cur = readMonthlyReserve(selectedFinanceMonthKey);
          cur.platformExpenses = (cur.platformExpenses || []).filter(
            (item) => String(item.id) !== String(pid)
          );
          saveMonthlyReserve(selectedFinanceMonthKey, cur);
          addLogEntry(`Removed platform expense for <strong>${escapeHtml(selectedFinanceMonthKey)}</strong>.`);
          renderAllSections();
        });
      });
    }
  }
}

function renderPaymentProjectsSection() {
  let paidTotal = 0;
  let paidCount = 0;
  let depositTotal = 0;
  let depositCount = 0;
  let unpaidTotal = 0;
  let unpaidCount = 0;

  for (const client of dashState.clients) {
    const fee = sanitizeAmount(client.fee);
    const status = normalizePaymentStatus(client.payment);
    if (status === 'Paid') {
      paidTotal += fee;
      paidCount += 1;
    } else if (status === 'Deposit Paid') {
      depositTotal += fee;
      depositCount += 1;
    } else {
      unpaidTotal += fee;
      unpaidCount += 1;
    }
  }

  const paidTotEl = document.getElementById('paidProjectsTotal');
  const paidCntEl = document.getElementById('paidProjectsCountNote');
  const depTotEl = document.getElementById('depositPaidProjectsTotal');
  const depCntEl = document.getElementById('depositPaidProjectsCountNote');
  const unpTotEl = document.getElementById('unpaidProjectsTotal');
  const unpCntEl = document.getElementById('unpaidProjectsCountNote');
  const badgeEl = document.getElementById('paymentProjectsCountBadge');

  if (paidTotEl) paidTotEl.textContent = formatRand(paidTotal);
  if (paidCntEl) paidCntEl.textContent = `${paidCount} project${paidCount === 1 ? '' : 's'}`;
  if (depTotEl) depTotEl.textContent = formatRand(depositTotal);
  if (depCntEl) depCntEl.textContent = `${depositCount} project${depositCount === 1 ? '' : 's'}`;
  if (unpTotEl) unpTotEl.textContent = formatRand(unpaidTotal);
  if (unpCntEl) unpCntEl.textContent = `${unpaidCount} project${unpaidCount === 1 ? '' : 's'}`;

  const projectSelect = document.getElementById('paymentProjectClientSelect');
  const statusSelect = document.getElementById('paymentProjectStatusSelect');
  if (projectSelect) {
    const prevVal = projectSelect.value;
    projectSelect.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = dashState.clients.length ? 'Select client project...' : 'No projects available';
    projectSelect.appendChild(ph);

    for (const c of dashState.clients) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = `${c.name} — ${c.project || 'Project'} (${normalizePaymentStatus(c.payment)})`;
      projectSelect.appendChild(opt);
    }

    if (prevVal && dashState.clients.some((c) => String(c.id) === String(prevVal))) {
      projectSelect.value = prevVal;
    } else if (dashState.clients.length > 0) {
      projectSelect.value = String(dashState.clients[0].id);
    }

    if (statusSelect && projectSelect.value) {
      const chosen = dashState.clients.find((c) => String(c.id) === String(projectSelect.value));
      if (chosen) statusSelect.value = normalizePaymentStatus(chosen.payment);
    }
  }

  document.querySelectorAll('#paymentStatusFilterBar [data-payment-filter]').forEach((btn) => {
    const isSelected = btn.dataset.paymentFilter === activePaymentFilter;
    btn.classList.toggle('btn-primary', isSelected);
  });

  const filteredClients =
    activePaymentFilter === 'All'
      ? dashState.clients
      : dashState.clients.filter((c) => normalizePaymentStatus(c.payment) === activePaymentFilter);

  if (badgeEl) {
    badgeEl.textContent = String(filteredClients.length).padStart(2, '0');
  }

  const tbody = document.getElementById('paymentProjectsTableBody');
  if (!tbody) return;

  if (!filteredClients.length) {
    tbody.innerHTML = `<tr><td colspan="4">No ${escapeHtml(activePaymentFilter === 'All' ? '' : `${activePaymentFilter.toLowerCase()} `)}projects found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredClients
    .map((c) => {
      const currentStatus = normalizePaymentStatus(c.payment);
      return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.project || 'Project')}</small></td>
          <td>${formatRand(c.fee)}</td>
          <td><strong>${escapeHtml(currentStatus)}</strong></td>
          <td>
            <select aria-label="Set payment status for ${escapeHtml(c.name)}" data-row-payment-select="${escapeHtml(c.id)}">
              <option value="Paid" ${currentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
              <option value="Deposit Paid" ${currentStatus === 'Deposit Paid' ? 'selected' : ''}>Deposit Paid</option>
              <option value="Unpaid" ${currentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-row-payment-select]').forEach((sel) => {
    sel.addEventListener('change', () => {
      setClientPaymentStatus(sel.dataset.rowPaymentSelect, sel.value);
    });
  });
}

function renderClientsAndMilestones() {
  const clientsTableBody = document.getElementById('clientsTableBody');
  if (clientsTableBody) {
    if (!dashState.clients.length) {
      clientsTableBody.innerHTML = '<tr><td colspan="4">No clients added yet.</td></tr>';
    } else {
      clientsTableBody.innerHTML = dashState.clients
        .map(
          (c) => `
          <tr>
            <td><strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.email || '')}</small></td>
            <td>${escapeHtml(c.project || '')}<br><small>${formatRand(c.fee)}</small></td>
            <td>${escapeHtml(normalizePaymentStatus(c.payment))}</td>
            <td>
              <button
                type="button"
                class="btn"
                data-dismiss-client-id="${escapeHtml(c.id)}"
              >
                Dismiss
              </button>
            </td>
          </tr>
        `
        )
        .join('');

      clientsTableBody.querySelectorAll('[data-dismiss-client-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.dismissClientId;
          const target = dashState.clients.find((c) => String(c.id) === String(cid));
          if (!target) return;
          permanentlyDismissClient(
            target.email,
            target.company || target.name,
            target.name,
            target.contact || ''
          );
          dashState.clients = dashState.clients.filter((c) => String(c.id) !== String(cid));
          removeRow('clients', cid);
          addLogEntry(`Dismissed client <strong>${escapeHtml(target.name)}</strong>.`);
          writeDashboardState();
          renderAllSections();
        });
      });
    }
  }

  const contactsBadge = document.getElementById('clientContactsCountBadge');
  if (contactsBadge) {
    contactsBadge.textContent = String(dashState.clients.length).padStart(2, '0');
  }

  const contactsTableBody = document.getElementById('clientContactsTableBody');
  if (contactsTableBody) {
    if (!dashState.clients.length) {
      contactsTableBody.innerHTML = '<tr><td colspan="4">No active client contacts.</td></tr>';
    } else {
      contactsTableBody.innerHTML = dashState.clients
        .map(
          (c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.email || '—')}</td>
            <td>${escapeHtml(c.contact || '—')}</td>
            <td>${escapeHtml(normalizePaymentStatus(c.payment))}</td>
          </tr>
        `
        )
        .join('');
    }
  }

  const msTableBody = document.getElementById('milestonesTableBody');
  if (msTableBody) {
    const rows = [];
    for (const client of dashState.clients) {
      for (const ms of client.milestones || []) {
        rows.push({ client, ms });
      }
    }
    if (!rows.length) {
      msTableBody.innerHTML = '<tr><td colspan="4">No milestones logged yet.</td></tr>';
    } else {
      msTableBody.innerHTML = rows
        .map(
          ({ client, ms }) => `
          <tr>
            <td>${escapeHtml(ms.title)}</td>
            <td>${escapeHtml(client.name)}</td>
            <td>${escapeHtml(ms.dueDate || '—')}</td>
            <td>
              <button
                type="button"
                class="btn"
                data-toggle-ms-client="${escapeHtml(client.id)}"
                data-toggle-ms-id="${escapeHtml(ms.id)}"
              >
                ${ms.completed ? 'Completed (Reopen)' : 'Open (Complete)'}
              </button>
            </td>
          </tr>
        `
        )
        .join('');

      msTableBody.querySelectorAll('[data-toggle-ms-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const client = dashState.clients.find((c) => String(c.id) === String(btn.dataset.toggleMsClient));
          const ms = client?.milestones?.find((m) => String(m.id) === String(btn.dataset.toggleMsId));
          if (!ms || !client) return;
          ms.completed = !ms.completed;
          addLogEntry(
            `${ms.completed ? 'Completed' : 'Reopened'} milestone <strong>${escapeHtml(ms.title)}</strong> for <strong>${escapeHtml(client.name)}</strong>.`
          );
          persistRow('clients', client);
          writeDashboardState();
          renderAllSections();
        });
      });
    }
  }
}

function renderRequestsAndDismissed() {
  const reqListEl = document.getElementById('requestsList');
  if (reqListEl) {
    if (!dashState.requests.length) {
      reqListEl.innerHTML = '<p>No pending client requests or enquiries.</p>';
    } else {
      reqListEl.innerHTML = dashState.requests
        .map(
          (req) => `
          <div class="activity-item" data-req-id="${escapeHtml(req.id)}">
            <div>
              <strong>${escapeHtml(req.clientName || req.company || req.email || 'Request')}</strong>
              <div>${escapeHtml(req.email || 'No email')} · ${escapeHtml(req.contact || 'No contact')}</div>
              <div>${escapeHtml(req.project || 'Request')}${req.budget ? ` · ${formatRand(req.budget)}` : ''}</div>
            </div>
            <div>
              <button type="button" class="btn btn-primary" data-approve-req="${escapeHtml(req.id)}">Approve</button>
              <button type="button" class="btn" data-dismiss-req="${escapeHtml(req.id)}">Dismiss</button>
            </div>
          </div>
        `
        )
        .join('');

      reqListEl.querySelectorAll('[data-approve-req]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const reqId = btn.dataset.approveReq;
          const idx = dashState.requests.findIndex((r) => String(r.id) === String(reqId));
          if (idx < 0) return;
          const reqItem = dashState.requests[idx];
          const displayName = reqItem.clientName || reqItem.company || reqItem.email || 'Client';

          forgetDismissedClient(reqItem.email, reqItem.company, displayName);

          dashState.clients.unshift({
            id: generateUuid(),
            name: displayName,
            company: reqItem.company || displayName,
            email: reqItem.email || '',
            contact: reqItem.contact || '',
            project:
              reqItem.project === 'New Client Account Request'
                ? 'Client Portal Account'
                : reqItem.project || 'Client Portal Account',
            fee: sanitizeAmount(reqItem.budget),
            payment: 'Unpaid',
            createdAt: new Date().toISOString(),
            milestones: []
          });

          dashState.requests.splice(idx, 1);
          removeRequestFromBridge(reqId);
          writeRequestStatusBack(reqId, 'Approved');
          recordClientAcceptedWork({ ...reqItem, company: displayName });
          addLogEntry(`Approved client <strong>${escapeHtml(displayName)}</strong>.`);
          writeDashboardState();
          renderAllSections();

          await sendClientApprovedCreatePasswordEmail({ ...reqItem, clientName: displayName }, false);
        });
      });

      reqListEl.querySelectorAll('[data-dismiss-req]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const reqId = btn.dataset.dismissReq;
          const idx = dashState.requests.findIndex((r) => String(r.id) === String(reqId));
          if (idx < 0) return;
          const reqItem = dashState.requests[idx];
          const displayName = reqItem.clientName || reqItem.company || reqItem.email || 'Client';
          permanentlyDismissClient(
            reqItem.email,
            reqItem.company,
            displayName,
            reqItem.contact || ''
          );
          dashState.requests.splice(idx, 1);
          removeRequestFromBridge(reqId);
          writeRequestStatusBack(reqId, 'Dismissed');
          addLogEntry(`Dismissed client <strong>${escapeHtml(displayName)}</strong>.`);
          writeDashboardState();
          renderAllSections();
        });
      });
    }
  }

  const dismissedList = getDismissedClientsList();
  const dismissedBadge = document.getElementById('dismissedClientsCountBadge');
  if (dismissedBadge) {
    dismissedBadge.textContent = String(dismissedList.length).padStart(2, '0');
  }

  const dismissedTableBody = document.getElementById('dismissedClientsTableBody');
  if (dismissedTableBody) {
    if (!dismissedList.length) {
      dismissedTableBody.innerHTML = '<tr><td colspan="4">No dismissed clients.</td></tr>';
    } else {
      dismissedTableBody.innerHTML = dismissedList
        .map(
          (item) => `
          <tr>
            <td><strong>${escapeHtml(item.name || item.company || item.email)}</strong>${item.company && item.company !== item.name ? `<br><small>${escapeHtml(item.company)}</small>` : ''}</td>
            <td>${escapeHtml(item.email || '—')}</td>
            <td>${escapeHtml(item.dismissedAt ? item.dismissedAt.slice(0, 10) : 'Dismissed')}</td>
            <td>
              <button
                type="button"
                class="btn btn-primary tds-btn-accept-dismissed"
                data-accept-dismissed-email="${escapeHtml(item.email || '')}"
                data-accept-dismissed-company="${escapeHtml(item.company || '')}"
                data-accept-dismissed-name="${escapeHtml(item.name || item.company || item.email || '')}"
                data-accept-dismissed-contact="${escapeHtml(item.contact || '')}"
              >
                Accept
              </button>
              <button
                type="button"
                class="btn tds-btn-remove-dismissed"
                data-remove-dismissed-email="${escapeHtml(item.email || '')}"
                data-remove-dismissed-company="${escapeHtml(item.company || '')}"
                data-remove-dismissed-name="${escapeHtml(item.name || item.company || item.email || '')}"
              >
                Remove
              </button>
            </td>
          </tr>
        `
        )
        .join('');

      dismissedTableBody.querySelectorAll('.tds-btn-accept-dismissed').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const email = btn.dataset.acceptDismissedEmail || '';
          const company = btn.dataset.acceptDismissedCompany || '';
          const name = btn.dataset.acceptDismissedName || company || email;
          const contact = btn.dataset.acceptDismissedContact || '';

          forgetDismissedClient(email, company, name);

          dashState.clients.unshift({
            id: generateUuid(),
            name,
            company: company || name,
            email,
            contact,
            project: 'Client Portal Account',
            fee: 0,
            payment: 'Unpaid',
            createdAt: new Date().toISOString(),
            milestones: []
          });

          addLogEntry(
            `Accepted dismissed client <strong>${escapeHtml(name)}</strong> (${escapeHtml(email || 'no email')}).`
          );
          writeDashboardState();
          renderAllSections();

          if (email) {
            await sendClientApprovedCreatePasswordEmail(
              { email, clientName: name, company: company || name, contact },
              false
            );
          }
        });
      });

      dismissedTableBody.querySelectorAll('.tds-btn-remove-dismissed').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const email = btn.dataset.removeDismissedEmail || '';
          const company = btn.dataset.removeDismissedCompany || '';
          const name = btn.dataset.removeDismissedName || company || email;
          const requestTitle = 'Account Re-registration Access';

          forgetDismissedClient(email, company, name);
          addLogEntry(
            `Forgot &amp; removed dismissed user <strong>${escapeHtml(name)}</strong> so they can create a new account again.`
          );
          writeDashboardState();
          renderAllSections();

          if (email) {
            await sendRemovedFromDismissedEmail({ email, company, name }, requestTitle);
          }
        });
      });
    }
  }
}

function renderActivityLog() {
  const logEl = document.getElementById('activityList');
  if (!logEl) return;
  if (!dashState.activities.length) {
    logEl.innerHTML = '<p>No recent activity.</p>';
    return;
  }
  logEl.innerHTML = dashState.activities
    .map(
      (act) => `
      <div class="activity-item">
        <div>${act.text}</div>
        <small>${escapeHtml(act.time || '')}</small>
      </div>
    `
    )
    .join('');
}

function runMilestoneAlertSweep() {
  let changed = false;
  for (const client of dashState.clients) {
    for (const ms of client.milestones || []) {
      const daysLeft = daysUntilTarget(ms.dueDate);
      if (!ms.completed && !ms.alerted && daysLeft <= 2) {
        ms.alerted = true;
        changed = true;
        pushClientNotification(
          client.name,
          `Milestone Due Soon: ${ms.title}`,
          `${client.name} has "${ms.title}" due on ${ms.dueDate}.`,
          'warning'
        );
      }
    }
  }
  if (changed) {
    writeDashboardState();
  }
}

function renderAllSections() {
  ensureFinanceSelectionDefaults();
  updateLiveClockDisplay();
  restoreCustomServiceOptions();
  syncMilestoneDropdown();
  renderSummaryCards();
  renderMonthlyGraphAndCalendar();
  renderPaymentProjectsSection();
  renderClientsAndMilestones();
  renderRequestsAndDismissed();
  renderActivityLog();
}

function bindDashboardForms() {
  const serviceSelect = document.getElementById('clientServiceSelect');
  const customServiceInput = document.getElementById('customServiceInput');
  if (serviceSelect && customServiceInput) {
    serviceSelect.addEventListener('change', () => {
      customServiceInput.hidden = serviceSelect.value !== 'Other';
    });
  }

  const clientForm = document.getElementById('addClientForm');
  if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('clientNameInput')?.value.trim() || '';
      const email = document.getElementById('clientEmailInput')?.value.trim() || '';
      let project = serviceSelect?.value || 'Web Development & Landing Pages';
      if (project === 'Other' && customServiceInput?.value.trim()) {
        project = customServiceInput.value.trim();
        if (!dashState.customServices.includes(project)) {
          dashState.customServices.push(project);
        }
      }
      const fee = sanitizeAmount(document.getElementById('clientFeeInput')?.value);
      const payment = normalizePaymentStatus(document.getElementById('clientPaymentSelect')?.value);
      const dueDate = document.getElementById('clientDueDateInput')?.value || '';

      if (!name) return;

      forgetDismissedClient(email, name, name);

      const newClient = {
        id: generateUuid(),
        name,
        company: name,
        email,
        contact: '',
        project,
        fee,
        payment,
        createdAt: new Date().toISOString(),
        milestones: dueDate
          ? [
              {
                id: generateUuid(),
                title: 'Kickoff deliverable',
                dueDate,
                completed: false,
                alerted: false
              }
            ]
          : []
      };

      dashState.clients.unshift(newClient);
      persistRow('clients', newClient);
      addLogEntry(
        `Added client <strong>${escapeHtml(name)}</strong> (${escapeHtml(project)} · <strong>${escapeHtml(payment)}</strong>).`
      );
      writeDashboardState();
      clientForm.reset();
      if (customServiceInput) customServiceInput.hidden = true;
      renderAllSections();
    });
  }

  const updatePaymentForm = document.getElementById('updateProjectPaymentForm');
  const projectPaymentSelect = document.getElementById('paymentProjectClientSelect');
  const projectStatusSelect = document.getElementById('paymentProjectStatusSelect');
  if (projectPaymentSelect && projectStatusSelect) {
    projectPaymentSelect.addEventListener('change', () => {
      const chosen = dashState.clients.find((c) => String(c.id) === String(projectPaymentSelect.value));
      if (chosen) {
        projectStatusSelect.value = normalizePaymentStatus(chosen.payment);
      }
    });
  }
  if (updatePaymentForm) {
    updatePaymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cid = projectPaymentSelect?.value || '';
      const status = projectStatusSelect?.value || 'Unpaid';
      if (!cid) return;
      setClientPaymentStatus(cid, status);
    });
  }

  document.querySelectorAll('#paymentStatusFilterBar [data-payment-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePaymentFilter = btn.dataset.paymentFilter || 'All';
      renderPaymentProjectsSection();
    });
  });

  const prevMonthBtn = document.getElementById('prevFinanceMonthBtn');
  const nextMonthBtn = document.getElementById('nextFinanceMonthBtn');
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      selectedFinanceMonthKey = shiftMonthKey(selectedFinanceMonthKey, -1);
      selectedCalendarDateIso = `${selectedFinanceMonthKey}-01`;
      renderAllSections();
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      selectedFinanceMonthKey = shiftMonthKey(selectedFinanceMonthKey, 1);
      selectedCalendarDateIso = `${selectedFinanceMonthKey}-01`;
      renderAllSections();
    });
  }

  const msForm = document.getElementById('addMilestoneForm');
  if (msForm) {
    msForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = document.getElementById('milestoneClientSelect')?.value || '';
      const title = document.getElementById('milestoneTitleInput')?.value.trim() || '';
      const dueDate = document.getElementById('milestoneDueDateInput')?.value || '';
      if (!clientId || !title) return;

      const client = dashState.clients.find((c) => String(c.id) === String(clientId));
      if (!client) return;

      client.milestones = Array.isArray(client.milestones) ? client.milestones : [];
      client.milestones.push({
        id: generateUuid(),
        title,
        dueDate,
        completed: false,
        alerted: false
      });

      persistRow('clients', client);
      addLogEntry(`Added milestone <strong>${escapeHtml(title)}</strong> for <strong>${escapeHtml(client.name)}</strong>.`);
      writeDashboardState();
      msForm.reset();
      renderAllSections();
    });
  }

  const reserveForm = document.getElementById('expenseSetAsideForm');
  if (reserveForm) {
    reserveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      ensureFinanceSelectionDefaults();
      const amount = sanitizeAmount(document.getElementById('setAsideAmountInput')?.value);
      const actionType = document.getElementById('expenseActionTypeSelect')?.value || 'reserve';
      const note = document.getElementById('setAsideLabelInput')?.value.trim() || 'Reserved for business costs';
      const current = readMonthlyReserve(selectedFinanceMonthKey);

      if (actionType === 'spent') {
        current.spent = sanitizeAmount(current.spent + amount);
      } else if (actionType === 'income') {
        current.extraIncome = sanitizeAmount(current.extraIncome + amount);
      } else {
        current.setAside = sanitizeAmount(current.setAside + amount);
      }
      current.note = note;
      saveMonthlyReserve(selectedFinanceMonthKey, current);
      addLogEntry(`Updated monthly balance (${escapeHtml(actionType)}) for <strong>${escapeHtml(selectedFinanceMonthKey)}</strong>.`);
      reserveForm.reset();
      renderAllSections();
    });
  }

  const clearReserveBtn = document.getElementById('clearSetAsideBtn');
  if (clearReserveBtn) {
    clearReserveBtn.addEventListener('click', () => {
      ensureFinanceSelectionDefaults();
      saveMonthlyReserve(selectedFinanceMonthKey, {
        extraIncome: 0,
        setAside: 0,
        spent: 0,
        note: 'Reserved for business costs',
        allocations: [],
        dayEntries: [],
        platformExpenses: []
      });
      addLogEntry(`Reset monthly reserve for <strong>${escapeHtml(selectedFinanceMonthKey)}</strong>.`);
      renderAllSections();
    });
  }

  const calDayForm = document.getElementById('calendarDayEntryForm');
  if (calDayForm) {
    calDayForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateVal = document.getElementById('calendarEntryDateInput')?.value || selectedCalendarDateIso;
      const typeVal = document.getElementById('calendarEntryTypeSelect')?.value === 'income' ? 'income' : 'expense';
      const amtVal = sanitizeAmount(document.getElementById('calendarEntryAmountInput')?.value);
      const titleVal = document.getElementById('calendarEntryTitleInput')?.value.trim() || 'Cashflow item';
      if (!dateVal || !amtVal) return;

      const targetMonth = dateVal.slice(0, 7);
      selectedFinanceMonthKey = targetMonth;
      selectedCalendarDateIso = dateVal;

      const cur = readMonthlyReserve(targetMonth);
      cur.dayEntries = Array.isArray(cur.dayEntries) ? cur.dayEntries : [];
      cur.dayEntries.unshift({
        id: generateUuid(),
        date: dateVal,
        type: typeVal,
        amount: amtVal,
        title: titleVal
      });
      saveMonthlyReserve(targetMonth, cur);
      addLogEntry(
        `Logged ${escapeHtml(typeVal)} (${formatRand(amtVal)}) on <strong>${escapeHtml(dateVal)}</strong>.`
      );
      calDayForm.reset();
      renderAllSections();
    });
  }

  const platForm = document.getElementById('platformExpenseForm');
  if (platForm) {
    platForm.addEventListener('submit', (e) => {
      e.preventDefault();
      ensureFinanceSelectionDefaults();
      const name = document.getElementById('platformNameInput')?.value.trim() || '';
      const amount = sanitizeAmount(document.getElementById('platformAmountInput')?.value);
      const cycle = document.getElementById('platformBillingCycleSelect')?.value || 'Monthly';
      if (!name || !amount) return;

      const cur = readMonthlyReserve(selectedFinanceMonthKey);
      cur.platformExpenses = Array.isArray(cur.platformExpenses) ? cur.platformExpenses : [];
      cur.platformExpenses.unshift({
        id: generateUuid(),
        name,
        amount,
        cycle
      });
      saveMonthlyReserve(selectedFinanceMonthKey, cur);
      addLogEntry(
        `Added platform expense <strong>${escapeHtml(name)}</strong> (${formatRand(amount)}) for <strong>${escapeHtml(selectedFinanceMonthKey)}</strong>.`
      );
      platForm.reset();
      renderAllSections();
    });
  }

  const purgeUnapprovedBtn = document.getElementById('deleteUnapprovedClientsBtn');
  if (purgeUnapprovedBtn) {
    purgeUnapprovedBtn.addEventListener('click', deleteAllUnapprovedClients);
  }

  const alertBtn = document.getElementById('runMilestoneAlertsBtn');
  if (alertBtn) {
    alertBtn.addEventListener('click', () => {
      runMilestoneAlertSweep();
      addLogEntry('Ran milestone due-date alert check.');
      renderAllSections();
    });
  }
}

window.TDS_ADMIN = Object.freeze({
  directorEmail: TDS_DIRECTOR_EMAIL,
  renderAllSections,
  deleteAllUnapprovedClients,
  removeDismissedClient,
  forgetDismissedClient,
  sendRemovedFromDismissedEmail,
  setClientPaymentStatus
});

scrubExposedPasswordNotifications();
syncClientBridgeRequests();
renderAllSections();
runMilestoneAlertSweep();
bindDashboardForms();
loadLiveSupabaseData();
setInterval(updateLiveClockDisplay, 15000);