(() => {
  const TEMP_SESSION_KEY = 'tds_temp_session_v1';
  const TEMP_ACCOUNTS_KEY = 'tds_temp_accounts_v1';
  const SHARED_BRIDGE_KEY = 'tds_shared_work_requests_v1';
  const REQUEST_STATUS_KEY = 'tds_client_request_status_v1';
  const ADMIN_STORAGE_KEY = 'tds_admin_dashboard_state_v6';
  const CLIENT_FEED_KEY = 'tds_client_feed_v1';
  const CLIENT_SEED_KEY = 'tds_client_contracts_seeded_v2';
  const CLIENT_APPROVALS_KEY = 'tds_client_approvals_v1';
  const DISMISSED_CLIENTS_KEY = 'tds_dismissed_clients_v1';
  const DIRECTOR_EMAIL = window.TDS_CONFIG?.directorEmail || 'director@typedigitalsolutions.co.za';

  const EMAILJS_CFG = {
    publicKey: window.TDS_CONFIG?.emailjs?.publicKey || 'A2KNyw8KMU-wuzclr',
    serviceId: window.TDS_CONFIG?.emailjs?.serviceId || 'service_xv2hpgf',
    templateId: window.TDS_CONFIG?.emailjs?.templateId || 'template_cd3utob'
  };

  const CLIENT_DIRECTORY = {
    'hello@northstar.example': {
      company: 'Northstar Consulting',
      email: 'hello@northstar.example',
      initials: 'NC'
    },
    'hello@urbanfinds.example': {
      company: 'Urban Finds',
      email: 'hello@urbanfinds.example',
      initials: 'UF'
    },
    'hello@glowstudio.example': {
      company: 'Glow Studio',
      email: 'hello@glowstudio.example',
      initials: 'GS'
    }
  };

  const DEMO_CLIENT_EMAILS = new Set(Object.keys(CLIENT_DIRECTORY));

  const DEFAULT_CLIENT_CONTRACTS = [
    {
      id: '22222222-2222-4222-8222-222222222201',
      name: 'Northstar Consulting',
      email: 'hello@northstar.example',
      project: 'Client Portal & Booking System',
      fee: 18500,
      payment: 'Deposit Paid',
      milestones: [
        { title: 'Wireframes & Architecture', dueDate: '12 Nov 2026', completed: true },
        { title: 'Portal UI & Auth Integration', dueDate: '26 Nov 2026', completed: false }
      ]
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      name: 'Urban Finds',
      email: 'hello@urbanfinds.example',
      project: 'E-Commerce Storefront Redesign',
      fee: 16500,
      payment: 'Deposit Paid',
      milestones: [
        { title: 'Product Catalog Grid', dueDate: '15 Nov 2026', completed: true },
        { title: 'Checkout & Payment Flow', dueDate: '28 Nov 2026', completed: false }
      ]
    },
    {
      id: '22222222-2222-4222-8222-222222222203',
      name: 'Glow Studio',
      email: 'hello@glowstudio.example',
      project: 'Brand Website & Service Showcase',
      fee: 8500,
      payment: 'Paid',
      milestones: [
        { title: 'Visual Design & Copy', dueDate: '10 Nov 2026', completed: true },
        { title: 'Live Launch & SEO', dueDate: '20 Nov 2026', completed: true }
      ]
    }
  ];

  function ensureSeededClientContracts() {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      state.clients = Array.isArray(state.clients) ? state.clients : [];

      let added = false;
      for (const demo of DEFAULT_CLIENT_CONTRACTS) {
        const exists = state.clients.some(
          (c) =>
            String(c.email || '').trim().toLowerCase() === demo.email.toLowerCase() ||
            String(c.name || '').trim().toLowerCase() === demo.name.toLowerCase()
        );
        if (!exists) {
          state.clients.push(demo);
          added = true;
        }
      }

      if (added || localStorage.getItem(CLIENT_SEED_KEY) !== 'true') {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(CLIENT_SEED_KEY, 'true');
      }
    } catch {}
  }

  function resolveClientProfile() {
    try {
      const rawSession = sessionStorage.getItem(TEMP_SESSION_KEY);
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && session.role === 'client') {
          const emailKey = String(session.email || '').trim().toLowerCase();
          const known = CLIENT_DIRECTORY[emailKey];
          const company = (session.company || session.name || known?.company || 'Client Workspace').trim();
          const email = (session.email || known?.email || 'client@tds.co.za').trim();
          const initials =
            session.initials ||
            known?.initials ||
            company
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => (p[0] ? p[0].toUpperCase() : ''))
              .join('') ||
            'CL';
          return { company, email, initials };
        }
      }
    } catch {}

    window.location.replace('login.html');
    return { company: '', email: '', initials: '' };
  }

  ensureSeededClientContracts();

  const CLIENT_PROFILE = resolveClientProfile();
  const CLIENT_SLUG =
    CLIENT_PROFILE.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'client';
  const CLIENT_STORAGE_KEY = `tds_client_${CLIENT_SLUG}_v1`;

  const extraDocs = [
    { title: 'Booking portal wireframes.pdf', date: 'Shared 18 November 2026' },
    { title: 'Maintenance & SLA summary.pdf', date: 'Shared 12 November 2026' }
  ];

  let showAllDocs = false;

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

  function checkDismissedOrRemovedSession() {
    const activeEmail = CLIENT_PROFILE.email.trim().toLowerCase();
    const activeCompany = CLIENT_PROFILE.company.trim().toLowerCase();

    try {
      const dismissedMap = JSON.parse(localStorage.getItem(DISMISSED_CLIENTS_KEY) || '{}');
      const wasDismissed = Object.values(dismissedMap).some((entry) => {
        if (!entry || entry.dismissed === false) return false;
        const eMail = String(entry.email || '').trim().toLowerCase();
        const eComp = String(entry.company || '').trim().toLowerCase();
        return (activeEmail && eMail === activeEmail) || (activeCompany && eComp === activeCompany);
      });
      if (wasDismissed) {
        sessionStorage.removeItem(TEMP_SESSION_KEY);
        window.location.replace('login.html?status=dismissed');
        return true;
      }
    } catch {}

    try {
      const rawSession = sessionStorage.getItem(TEMP_SESSION_KEY);
      if (rawSession) {
        const sess = JSON.parse(rawSession);
        if (sess?.unapprovedRemoved) {
          sessionStorage.removeItem(TEMP_SESSION_KEY);
          window.location.replace('login.html?status=removed');
          return true;
        }
      }
    } catch {}

    return false;
  }

  function isClientApproved() {
    const emailKey = CLIENT_PROFILE.email.trim().toLowerCase();
    if (DEMO_CLIENT_EMAILS.has(emailKey)) return true;
    try {
      const approvals = JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
      return Boolean(approvals[emailKey]?.approved);
    } catch {
      return false;
    }
  }

  function ensurePendingEntryInStorage() {
    if (isClientApproved()) return;
    const emailKey = CLIENT_PROFILE.email.trim().toLowerCase();
    if (!emailKey) return;
    try {
      const approvals = JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
      if (!approvals[emailKey]) {
        approvals[emailKey] = {
          approved: false,
          passwordSetupComplete: false,
          company: CLIENT_PROFILE.company,
          email: CLIENT_PROFILE.email,
          requestedAt: new Date().toISOString()
        };
        localStorage.setItem(CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
      }
    } catch {}
  }

  function updateClientPassword(newPassword) {
    const emailKey = CLIENT_PROFILE.email.trim().toLowerCase();
    if (!emailKey || newPassword.length < 6) return false;
    try {
      const accounts = JSON.parse(localStorage.getItem(TEMP_ACCOUNTS_KEY) || '[]');
      if (Array.isArray(accounts)) {
        const updated = accounts.map((acc) =>
          String(acc.email || '').trim().toLowerCase() === emailKey
            ? { ...acc, password: newPassword, passwordSetupComplete: true }
            : acc
        );
        localStorage.setItem(TEMP_ACCOUNTS_KEY, JSON.stringify(updated));
      }
    } catch {}

    try {
      const approvals = JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
      if (approvals[emailKey]) {
        approvals[emailKey].password = newPassword;
        approvals[emailKey].passwordSetupComplete = true;
        localStorage.setItem(CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
      }
    } catch {}

    return true;
  }

  function readStoredClientContact() {
    const emailKey = CLIENT_PROFILE.email.trim().toLowerCase();
    try {
      const approvals = JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
      const fromApproval = approvals[emailKey];
      const accounts = JSON.parse(localStorage.getItem(TEMP_ACCOUNTS_KEY) || '[]');
      const fromAccount = Array.isArray(accounts)
        ? accounts.find((a) => String(a?.email || '').trim().toLowerCase() === emailKey)
        : null;
      const sessRaw = sessionStorage.getItem(TEMP_SESSION_KEY);
      const sess = sessRaw ? JSON.parse(sessRaw) : {};

      const merged = { ...(fromAccount || {}), ...(fromApproval || {}) };
      const parts = String(merged.name || CLIENT_PROFILE.company || '').trim().split(/\s+/);
      return {
        firstName: merged.firstName || sess.firstName || parts[0] || '',
        surname: merged.surname || sess.surname || parts.slice(1).join(' ') || '',
        email: merged.email || CLIENT_PROFILE.email,
        contact: merged.contact || sess.contact || '',
        company: merged.company || CLIENT_PROFILE.company
      };
    } catch {
      return {
        firstName: '',
        surname: '',
        email: CLIENT_PROFILE.email,
        contact: '',
        company: CLIENT_PROFILE.company
      };
    }
  }

  function populateContactDetailsForm() {
    const firstInput = document.getElementById('clientFirstNameInput');
    const surnameInput = document.getElementById('clientSurnameInput');
    const emailInput = document.getElementById('clientEmailEditInput');
    const phoneInput = document.getElementById('clientPhoneEditInput');
    if (!firstInput && !surnameInput && !emailInput && !phoneInput) return;

    if (document.activeElement && [firstInput, surnameInput, emailInput, phoneInput].includes(document.activeElement)) {
      return;
    }

    const info = readStoredClientContact();
    if (firstInput) firstInput.value = info.firstName;
    if (surnameInput) surnameInput.value = info.surname;
    if (emailInput) emailInput.value = info.email;
    if (phoneInput) phoneInput.value = info.contact;
  }

  function saveClientContactDetails({ firstName, surname, email, contact }) {
    const oldKey = CLIENT_PROFILE.email.trim().toLowerCase();
    const newKey = String(email || '').trim().toLowerCase() || oldKey;
    const fullName = [firstName, surname].filter(Boolean).join(' ').trim() || CLIENT_PROFILE.company;

    try {
      const approvals = JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
      const prev = approvals[oldKey] || approvals[newKey] || {};
      if (oldKey && oldKey !== newKey) delete approvals[oldKey];
      approvals[newKey] = {
        ...prev,
        firstName,
        surname,
        name: fullName,
        email: newKey,
        contact,
        role: 'client',
        approved: prev.approved !== undefined ? prev.approved : true,
        passwordSetupComplete: true,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(CLIENT_APPROVALS_KEY, JSON.stringify(approvals));
    } catch {}

    try {
      const rawAccounts = localStorage.getItem(TEMP_ACCOUNTS_KEY);
      const list = rawAccounts ? JSON.parse(rawAccounts) : [];
      const arr = Array.isArray(list) ? list : [];
      const idx = arr.findIndex(
        (a) => a && a.role === 'client' && String(a.email || '').trim().toLowerCase() === oldKey
      );
      const updatedAcc = {
        ...(idx >= 0 ? arr[idx] : {}),
        firstName,
        surname,
        name: fullName,
        email: newKey,
        contact,
        role: 'client',
        approved: true,
        passwordSetupComplete: true,
        updatedAt: new Date().toISOString()
      };
      if (idx >= 0) {
        arr[idx] = updatedAcc;
      } else {
        arr.unshift(updatedAcc);
      }
      localStorage.setItem(TEMP_ACCOUNTS_KEY, JSON.stringify(arr.slice(0, 40)));
    } catch {}

    try {
      const sessRaw = sessionStorage.getItem(TEMP_SESSION_KEY);
      if (sessRaw) {
        const sess = JSON.parse(sessRaw);
        sessionStorage.setItem(
          TEMP_SESSION_KEY,
          JSON.stringify({
            ...sess,
            firstName,
            surname,
            contact,
            email: newKey
          })
        );
      }
    } catch {}
  }

  function applyPendingClientGate() {
    const approved = isClientApproved();
    const bannerEl = document.getElementById('clientAlertBanner');
    const welcomeEl = document.getElementById('clientWelcomeBanner');
    const form = document.getElementById('clientWorkRequestForm');
    const submitBtn = form?.querySelector('button[type="submit"]');

    if (submitBtn && !submitBtn.dataset.defaultLabel) {
      submitBtn.dataset.defaultLabel = submitBtn.textContent || 'Submit work request';
    }

    if (welcomeEl && approved) {
      welcomeEl.style.display = 'block';
      welcomeEl.innerHTML = `<p style="margin:0;font-size:12px;line-height:1.7"><strong>Welcome to TYPE Digital Solutions, ${escapeHtml(CLIENT_PROFILE.company)}.</strong> Your account is approved. You can submit new work requests below, update your contact details, and change your password anytime.</p>`;
    }

    if (!approved) {
      if (bannerEl) {
        bannerEl.style.display = 'block';
        bannerEl.innerHTML = `<p style="margin:0;font-size:12px;line-height:1.7"><strong>Pending approval.</strong> Your client account for <strong>${escapeHtml(CLIENT_PROFILE.company)}</strong> is awaiting approval from TYPE Digital Solutions.</p>`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Pending Approval';
      }
    } else if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.defaultLabel || 'Submit work request';
    }
  }

  function isSameClient(record) {
    if (!record) return false;
    const recordCompany = String(record.name || record.clientName || record.company || '')
      .trim()
      .toLowerCase();
    const recordEmail = String(record.email || '').trim().toLowerCase();
    const activeCompany = CLIENT_PROFILE.company.trim().toLowerCase();
    const activeEmail = CLIENT_PROFILE.email.trim().toLowerCase();

    return (
      (Boolean(activeCompany) && recordCompany === activeCompany) ||
      (Boolean(activeEmail) && recordEmail === activeEmail)
    );
  }

  function applyClientIdentityToDom() {
    if (!CLIENT_PROFILE.company) return;

    document.title = `${CLIENT_PROFILE.company} Portal | TYPE Digital Solutions`;

    document.querySelectorAll('[data-person-name], [data-client-company]').forEach((el) => {
      el.textContent = CLIENT_PROFILE.company;
    });

    document.querySelectorAll('[data-first-name]').forEach((el) => {
      el.textContent = CLIENT_PROFILE.company.split(/\s+/)[0] || CLIENT_PROFILE.company;
    });

    document.querySelectorAll('[data-user-initials]').forEach((el) => {
      el.textContent = CLIENT_PROFILE.initials;
    });

    document.querySelectorAll('[data-client-email]').forEach((el) => {
      el.textContent = CLIENT_PROFILE.email;
    });

    document.querySelectorAll('h1, h2, h3, p, span, strong, small').forEach((el) => {
      if (el.children.length === 0 && el.textContent.includes('Northstar Consulting')) {
        el.textContent = el.textContent.replace(/Northstar Consulting/g, CLIENT_PROFILE.company);
      }
      if (el.children.length === 0 && el.textContent.includes('hello@northstar.example')) {
        el.textContent = el.textContent.replace(/hello@northstar\.example/g, CLIENT_PROFILE.email);
      }
    });
  }

  function loadClientState() {
    try {
      const raw = localStorage.getItem(CLIENT_STORAGE_KEY);
      if (!raw) return { requests: [] };
      const parsed = JSON.parse(raw);
      return {
        requests: Array.isArray(parsed.requests) ? parsed.requests : []
      };
    } catch {
      return { requests: [] };
    }
  }

  let clientState = loadClientState();

  function saveClientState() {
    try {
      localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clientState));
    } catch {}
  }

  function readAdminState() {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (!raw) return { clients: [] };
      const parsed = JSON.parse(raw);
      return {
        clients: Array.isArray(parsed.clients) ? parsed.clients : []
      };
    } catch {
      return { clients: [] };
    }
  }

  function isSafeNotificationText(notif) {
    const combined = `${notif?.title || ''} ${notif?.detail || ''}`;
    return !combined.includes('Your login password is') && !combined.includes('TDSDirector2026!');
  }

  function readClientFeed() {
    try {
      const raw = localStorage.getItem(CLIENT_FEED_KEY);
      if (!raw) return { notifications: [], completedContracts: [], acceptedWork: [] };
      const parsed = JSON.parse(raw);
      const safeNotifications = Array.isArray(parsed.notifications)
        ? parsed.notifications.filter((n) => isSameClient(n) && isSafeNotificationText(n))
        : [];
      return {
        notifications: safeNotifications,
        completedContracts: Array.isArray(parsed.completedContracts)
          ? parsed.completedContracts.filter(isSameClient)
          : [],
        acceptedWork: Array.isArray(parsed.acceptedWork) ? parsed.acceptedWork.filter(isSameClient) : []
      };
    } catch {
      return { notifications: [], completedContracts: [], acceptedWork: [] };
    }
  }

  function readRequestStatuses() {
    try {
      return JSON.parse(localStorage.getItem(REQUEST_STATUS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function formatZAR(amount) {
    return `R ${sanitizeAmount(amount).toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function getSASTStamp() {
    const now = new Date();
    const datePart = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Johannesburg',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    const headerDate = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(now);

    return {
      year: datePart.slice(0, 4),
      isoDate: datePart,
      time: timePart,
      stamp: `${datePart} · ${timePart}`,
      headerDate: headerDate.toUpperCase()
    };
  }

  function getClientContracts() {
    const admin = readAdminState();
    return admin.clients.filter(isSameClient);
  }

  function computeDueAmount(contracts) {
    let totalDue = 0;
    for (const c of contracts) {
      const fee = sanitizeAmount(c.fee);
      if (c.payment === 'Unpaid') {
        totalDue += fee;
      } else if (c.payment === 'Deposit Paid') {
        totalDue += fee * 0.5;
      }
    }
    return totalDue;
  }

  async function publishToAdminBridge(entry) {
    const adminPayload = {
      id: entry.id,
      company: CLIENT_PROFILE.company,
      email: CLIENT_PROFILE.email,
      project: `${entry.project} — ${entry.subject}`,
      budget: sanitizeAmount(entry.budget),
      priority: entry.priority,
      notes: entry.notes,
      receivedAt: entry.submittedAt
    };

    try {
      const existingBridge = JSON.parse(localStorage.getItem(SHARED_BRIDGE_KEY) || '[]');
      const list = Array.isArray(existingBridge) ? existingBridge : [];
      if (!list.some((item) => String(item.id) === String(adminPayload.id))) {
        list.unshift(adminPayload);
        localStorage.setItem(SHARED_BRIDGE_KEY, JSON.stringify(list.slice(0, 30)));
      }
    } catch {}

    try {
      const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (rawAdmin) {
        const parsedAdmin = JSON.parse(rawAdmin);
        if (parsedAdmin && typeof parsedAdmin === 'object') {
          parsedAdmin.requests = Array.isArray(parsedAdmin.requests) ? parsedAdmin.requests : [];
          if (!parsedAdmin.requests.some((r) => String(r.id) === String(adminPayload.id))) {
            parsedAdmin.requests.unshift(adminPayload);
          }
          parsedAdmin.activities = Array.isArray(parsedAdmin.activities) ? parsedAdmin.activities : [];
          parsedAdmin.activities.unshift({
            id: generateUuid(),
            text: `New work request from <strong>${escapeHtml(adminPayload.company)}</strong>: "${escapeHtml(entry.subject)}" (${formatZAR(adminPayload.budget)}).`,
            time: adminPayload.receivedAt
          });
          parsedAdmin.activities = parsedAdmin.activities.slice(0, 15);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(parsedAdmin));
        }
      }
    } catch {}

    if (
      window.emailjs &&
      typeof window.emailjs.send === 'function' &&
      EMAILJS_CFG.publicKey &&
      EMAILJS_CFG.serviceId &&
      EMAILJS_CFG.templateId
    ) {
      try {
        window.emailjs.init({ publicKey: EMAILJS_CFG.publicKey });
        await window.emailjs.send(EMAILJS_CFG.serviceId, EMAILJS_CFG.templateId, {
          to_email: DIRECTOR_EMAIL,
          cc_email: DIRECTOR_EMAIL,
          subject: `New Work Request from ${CLIENT_PROFILE.company}: ${entry.subject}`,
          message: `Client: ${CLIENT_PROFILE.company} (${CLIENT_PROFILE.email})\nScope: ${entry.project}\nSubject: ${entry.subject}\nBudget: ${formatZAR(entry.budget)}\nPriority: ${entry.priority}\nNotes: ${entry.notes}`
        });
      } catch {}
    }
  }

  async function pushToSupabaseIfAvailable(entry) {
    const sb = window.supabaseClient || window.sb;
    if (!sb || typeof sb.from !== 'function') return;
    try {
      await sb.from('company_requests').insert({
        id: entry.id,
        company: CLIENT_PROFILE.company,
        email: CLIENT_PROFILE.email,
        project: `${entry.project} — ${entry.subject}`,
        budget: sanitizeAmount(entry.budget)
      });
    } catch {}
  }

  function downloadInvoicePdf(contracts, dueAmount) {
    const stamp = getSASTStamp();
    const primary = contracts[0] || {
      id: generateUuid(),
      name: CLIENT_PROFILE.company,
      email: CLIENT_PROFILE.email,
      project: `${CLIENT_PROFILE.company} — Active Scope`,
      fee: dueAmount > 0 ? dueAmount : 8500,
      payment: dueAmount > 0 ? 'Unpaid' : 'Paid'
    };

    const rowsHtml = contracts
      .map((c) => {
        const fee = sanitizeAmount(c.fee);
        const balance = c.payment === 'Paid' ? 0 : c.payment === 'Deposit Paid' ? fee * 0.5 : fee;
        return `<tr>
          <td>${escapeHtml(c.project)}</td>
          <td>${escapeHtml(c.payment)}</td>
          <td>${formatZAR(fee)}</td>
          <td><strong>${formatZAR(balance)}</strong></td>
        </tr>`;
      })
      .join('');

    const pdfHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice PDF - ${escapeHtml(CLIENT_PROFILE.company)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 36px; color: #111; }
  .box { max-width: 760px; margin: auto; border: 1px solid #d1d5db; border-radius: 10px; padding: 30px; }
  .head { display: flex; justify-content: space-between; border-bottom: 2px solid #1a2e26; padding-bottom: 16px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 8px; text-align: left; }
  .due-box { margin-top: 24px; padding: 16px; background: #f3f6f4; border-radius: 8px; display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="box">
    <div class="head">
      <div>
        <h2>TYPE Digital Solutions (Pty) Ltd</h2>
        <p>${escapeHtml(DIRECTOR_EMAIL)}</p>
      </div>
      <div>
        <strong>Statement / Invoice</strong><br>
        Ref: TDS-${escapeHtml(String(primary.id).slice(0, 8).toUpperCase())}-${escapeHtml(stamp.year)}<br>
        Date: ${escapeHtml(stamp.isoDate)}
      </div>
    </div>
    <p><strong>Billed To:</strong> ${escapeHtml(CLIENT_PROFILE.company)} (${escapeHtml(CLIENT_PROFILE.email)})</p>
    <table>
      <thead>
        <tr><th>Project</th><th>Payment Status</th><th>Contract Fee</th><th>Amount Due</th></tr>
      </thead>
      <tbody>${rowsHtml || `<tr><td>${escapeHtml(primary.project)}</td><td>${escapeHtml(primary.payment)}</td><td>${formatZAR(primary.fee)}</td><td><strong>${formatZAR(dueAmount)}</strong></td></tr>`}</tbody>
    </table>
    <div class="due-box">
      <span>Total Due (ZAR)</span>
      <span>${formatZAR(dueAmount)}</span>
    </div>
    <p class="no-print" style="margin-top:20px;font-size:12px;color:#555">Use your browser print dialog and choose <strong>Save as PDF</strong>.</p>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(pdfHtml);
      win.document.close();
    } else {
      const blob = new Blob([pdfHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${CLIENT_PROFILE.company.replace(/\s+/g, '-')}-${stamp.isoDate}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function updateHeaderDate() {
    const el = document.getElementById('clientDateLabel');
    if (el) el.textContent = getSASTStamp().headerDate;
  }

  function renderDocuments() {
    const container = document.getElementById('clientDocumentsList');
    const btn = document.getElementById('toggleAllDocsBtn');
    if (!container) return;

    const baseDocs = [
      { title: `${CLIENT_PROFILE.company} project brief.pdf`, date: 'Shared 6 November 2026' },
      { title: 'Design direction.pdf', date: 'Shared 4 November 2026' }
    ];
    const items = showAllDocs ? [...baseDocs, ...extraDocs] : baseDocs;

    container.innerHTML = items
      .map(
        (d) => `
        <div class="activity">
          <span class="activity-dot"></span>
          <p><strong>${escapeHtml(d.title)}</strong><small>${escapeHtml(d.date)}</small></p>
        </div>
      `
      )
      .join('');

    if (btn) btn.textContent = showAllDocs ? 'Show less' : 'Show all';
  }

  function renderAllClientViews() {
    if (checkDismissedOrRemovedSession()) return;

    applyClientIdentityToDom();
    updateHeaderDate();
    ensurePendingEntryInStorage();
    populateContactDetailsForm();

    const contracts = getClientContracts();
    const feed = readClientFeed();
    const statuses = readRequestStatuses();
    const dueAmount = computeDueAmount(contracts);
    const approved = isClientApproved();

    const activeCountEl = document.getElementById('clientActiveCount');
    const completedCountEl = document.getElementById('clientCompletedCount');
    const dueAmountEl = document.getElementById('clientDueAmount');
    const dueNoteEl = document.getElementById('clientDueNote');
    const notifCountEl = document.getElementById('clientNotifCount');
    const bannerEl = document.getElementById('clientAlertBanner');

    if (activeCountEl) activeCountEl.textContent = String(contracts.length).padStart(2, '0');
    if (completedCountEl) {
      completedCountEl.textContent = String(feed.completedContracts.length).padStart(2, '0');
    }
    if (dueAmountEl) dueAmountEl.textContent = formatZAR(dueAmount);
    if (dueNoteEl) {
      dueNoteEl.textContent = dueAmount > 0 ? 'Alert: Balance due on active work' : 'All balances settled';
    }
    if (notifCountEl) {
      notifCountEl.textContent = String(feed.notifications.length).padStart(2, '0');
    }

    if (bannerEl) {
      const latestNotif = feed.notifications[0];
      if (!approved || dueAmount > 0 || latestNotif) {
        bannerEl.style.display = 'block';
        const pendingAlert = !approved
          ? `<strong>Pending approval.</strong> Your client account for <strong>${escapeHtml(CLIENT_PROFILE.company)}</strong> is awaiting approval from TYPE Digital Solutions.`
          : '';
        const paymentAlert =
          dueAmount > 0
            ? `<strong>Payment Alert:</strong> You have <strong>${formatZAR(dueAmount)}</strong> due with TYPE Digital Solutions.`
            : '';
        const latestLine = latestNotif
          ? `<strong>Latest Update (${escapeHtml(latestNotif.time)}):</strong> ${escapeHtml(latestNotif.title)} — ${escapeHtml(latestNotif.detail)}`
          : '';
        bannerEl.innerHTML = `<p style="margin:0;font-size:12px;line-height:1.7">${[pendingAlert, paymentAlert, latestLine].filter(Boolean).join('<br>')}</p>`;
      } else {
        bannerEl.style.display = 'none';
      }
    }

    const projectsGrid = document.getElementById('clientProjectsGrid');
    if (projectsGrid) {
      const acceptedCards = feed.acceptedWork.map((w) => ({
        status: 'Accepted',
        pillClass: 'pill',
        title: w.project,
        desc: `Accepted on ${w.acceptedAt}. Budget: ${formatZAR(w.budget)}.`,
        progress: 20,
        metaLeft: 'Status: Accepted',
        metaRight: formatZAR(w.budget)
      }));

      const contractCards = contracts.map((c) => {
        const msList = Array.isArray(c.milestones) ? c.milestones : [];
        const completedMs = msList.filter((m) => m.completed).length;
        const pct = msList.length ? Math.round((completedMs / msList.length) * 100) : 45;
        const nextMs = msList.find((m) => !m.completed);
        return {
          status: c.payment,
          pillClass: c.payment === 'Paid' ? 'pill' : c.payment === 'Deposit Paid' ? 'pill blue' : 'pill amber',
          title: c.project,
          desc: `Contract value: ${formatZAR(c.fee)} · Payment: ${c.payment}.`,
          progress: pct,
          metaLeft: nextMs ? `Next: ${nextMs.title}` : 'Active delivery',
          metaRight: nextMs ? nextMs.dueDate : formatZAR(c.fee)
        };
      });

      const cards = [...contractCards, ...acceptedCards];
      projectsGrid.innerHTML = cards.length
        ? cards
            .map(
              (card) => `
            <article class="project-card">
              <span class="${card.pillClass}">${escapeHtml(card.status)}</span>
              <h3>${escapeHtml(card.title)}</h3>
              <p>${escapeHtml(card.desc)}</p>
              <div class="progress-row">
                <div class="progress" style="flex:1"><span style="width:${card.progress}%"></span></div>
                <small>${card.progress}%</small>
              </div>
              <div class="project-meta"><span>${escapeHtml(card.metaLeft)}</span><span>${escapeHtml(card.metaRight)}</span></div>
            </article>
          `
            )
            .join('')
        : '<article class="project-card"><span class="pill grey">Done</span><h3>No active projects</h3><p>Completed contracts appear under Completed / Done.</p></article>';
    }

    const dueListEl = document.getElementById('clientDuePaymentsList');
    if (dueListEl) {
      const dueItems = contracts.filter((c) => c.payment !== 'Paid');
      dueListEl.innerHTML = dueItems.length
        ? dueItems
            .map((c) => {
              const fee = sanitizeAmount(c.fee);
              const bal = c.payment === 'Deposit Paid' ? fee * 0.5 : fee;
              return `
              <div class="activity">
                <span class="activity-dot"></span>
                <p>
                  <strong>${escapeHtml(c.project)}</strong> · Due: <strong>${formatZAR(bal)}</strong>
                  <span class="pill amber">${escapeHtml(c.payment)}</span>
                  <small>Total contract: ${formatZAR(fee)} · Client: ${escapeHtml(c.name)}</small>
                </p>
              </div>
            `;
            })
            .join('')
        : '<p class="muted" style="font-size:12px">No due payments right now.</p>';
    }

    const notifListEl = document.getElementById('clientNotificationsList');
    if (notifListEl) {
      const milestoneItems = [];
      for (const c of contracts) {
        for (const m of c.milestones || []) {
          milestoneItems.push({
            title: `${m.completed ? 'Done' : 'Milestone'}: ${m.title}`,
            detail: `${c.name} · Due ${m.dueDate}`,
            time: m.dueDate
          });
        }
      }

      const merged = [
        ...feed.notifications.map((n) => ({
          title: n.title,
          detail: `${n.clientName} · ${n.detail}`,
          time: n.time
        })),
        ...milestoneItems
      ];

      notifListEl.innerHTML = merged.length
        ? merged
            .slice(0, 8)
            .map(
              (item) => `
            <div class="activity">
              <span class="activity-dot"></span>
              <p><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.time)}</small></p>
            </div>
          `
            )
            .join('')
        : '<p class="muted" style="font-size:12px">No notifications yet.</p>';
    }

    const completedListEl = document.getElementById('clientCompletedList');
    if (completedListEl) {
      completedListEl.innerHTML = feed.completedContracts.length
        ? feed.completedContracts
            .map(
              (done) => `
            <div class="activity">
              <span class="activity-dot"></span>
              <p><strong>Done: ${escapeHtml(done.project)}</strong> <span class="pill grey">Completed</span><small>${escapeHtml(done.clientName)} · ${formatZAR(done.fee)} · ${escapeHtml(done.completedAt)}</small></p>
            </div>
          `
            )
            .join('')
        : '';
    }

    const reqCountEl = document.getElementById('clientRequestCount');
    const reqListEl = document.getElementById('submittedRequestsList');
    if (reqCountEl) {
      reqCountEl.textContent = String(clientState.requests.length).padStart(2, '0');
    }
    if (reqListEl) {
      reqListEl.innerHTML = clientState.requests.length
        ? clientState.requests
            .map((r) => {
              const st = statuses[r.id];
              const badgeClass =
                st?.status === 'Accepted' ? 'pill' : st?.status === 'Dismissed' ? 'pill grey' : 'pill amber';
              const badgeText = st?.status || 'Pending review';
              return `
              <div class="activity">
                <span class="activity-dot"></span>
                <p>
                  <strong>${escapeHtml(r.subject)}</strong> · ${escapeHtml(r.project)} (${formatZAR(r.budget)})
                  <span class="${badgeClass}">${escapeHtml(badgeText)}</span>
                  <small>${escapeHtml(r.priority)} · ${escapeHtml(r.submittedAt)} · ${escapeHtml(r.notes)}</small>
                </p>
              </div>
            `;
            })
            .join('')
        : '<p class="muted" style="font-size:12px">No new work requests submitted yet.</p>';
    }

    renderDocuments();
    applyPendingClientGate();

    const pdfHandler = () => downloadInvoicePdf(contracts, dueAmount);
    const topPdfBtn = document.getElementById('clientDownloadPdfBtn');
    const duePdfBtn = document.getElementById('clientPayPdfBtn');
    if (topPdfBtn) topPdfBtn.onclick = pdfHandler;
    if (duePdfBtn) duePdfBtn.onclick = pdfHandler;
  }

  function initClientDashboard() {
    if (checkDismissedOrRemovedSession()) return;
    renderAllClientViews();
    setInterval(renderAllClientViews, 2000);

    window.addEventListener('storage', (event) => {
      if (
        event.key === REQUEST_STATUS_KEY ||
        event.key === ADMIN_STORAGE_KEY ||
        event.key === CLIENT_FEED_KEY ||
        event.key === CLIENT_STORAGE_KEY ||
        event.key === CLIENT_APPROVALS_KEY ||
        event.key === DISMISSED_CLIENTS_KEY ||
        event.key === TEMP_SESSION_KEY
      ) {
        clientState = loadClientState();
        renderAllClientViews();
      }
    });

    const toggleBtn = document.getElementById('toggleAllDocsBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        showAllDocs = !showAllDocs;
        renderDocuments();
      });
    }

    const menuBtn = document.getElementById('clientMobileMenuBtn');
    const sideNav = document.getElementById('clientSideNav');
    if (menuBtn && sideNav) {
      menuBtn.addEventListener('click', () => {
        const isOpen = sideNav.style.display === 'grid';
        sideNav.style.display = isOpen ? '' : 'grid';
      });
    }

    const contactForm = document.getElementById('clientContactDetailsForm');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const firstName = document.getElementById('clientFirstNameInput')?.value.trim() || '';
        const surname = document.getElementById('clientSurnameInput')?.value.trim() || '';
        const email = document.getElementById('clientEmailEditInput')?.value.trim() || '';
        const contact = document.getElementById('clientPhoneEditInput')?.value.trim() || '';
        const feedbackEl = document.getElementById('clientContactFeedback');

        if (!firstName || !surname || !email || !contact) {
          if (feedbackEl) feedbackEl.textContent = 'Please fill in name, surname, email, and contact details.';
          return;
        }

        saveClientContactDetails({ firstName, surname, email, contact });
        if (feedbackEl) {
          feedbackEl.textContent = 'Contact details saved and updated on your client profile.';
        }
        renderAllClientViews();
      });
    }

    const pwForm = document.getElementById('clientChangePasswordForm');
    if (pwForm) {
      pwForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nextPw = document.getElementById('newClientPasswordInput')?.value || '';
        const feedbackEl = document.getElementById('clientPasswordFeedback');
        if (nextPw.length < 6) {
          if (feedbackEl) feedbackEl.textContent = 'Password must be at least 6 characters.';
          return;
        }
        updateClientPassword(nextPw);
        pwForm.reset();
        if (feedbackEl) {
          feedbackEl.textContent = 'Your login password has been updated.';
        }
      });
    }

    const form = document.getElementById('clientWorkRequestForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (checkDismissedOrRemovedSession()) return;
        if (!isClientApproved()) {
          applyPendingClientGate();
          return;
        }

        const subject = document.getElementById('reqSubjectInput')?.value.trim() || '';
        const project = document.getElementById('reqProjectSelect')?.value || 'New standalone project';
        const budget = sanitizeAmount(document.getElementById('reqBudgetInput')?.value);
        const priority = document.getElementById('reqPrioritySelect')?.value || 'Normal';
        const notes = document.getElementById('reqNotesInput')?.value.trim() || '';
        if (!subject || !notes) return;

        const entry = {
          id: generateUuid(),
          subject,
          project,
          budget,
          priority,
          notes,
          submittedAt: getSASTStamp().stamp
        };

        clientState.requests.unshift(entry);
        saveClientState();
        await publishToAdminBridge(entry);
        renderAllClientViews();
        await pushToSupabaseIfAvailable(entry);
        form.reset();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClientDashboard);
  } else {
    initClientDashboard();
  }
})();