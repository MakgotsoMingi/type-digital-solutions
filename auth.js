(() => {
  const TEMP_SESSION_KEY = 'tds_temp_session_v1';
  const TEMP_ACCOUNTS_KEY = 'tds_temp_accounts_v1';
  const CLIENT_APPROVALS_KEY = 'tds_client_approvals_v1';
  const DISMISSED_CLIENTS_KEY = 'tds_dismissed_clients_v1';
  const ADMIN_STORAGE_KEY = 'tds_admin_dashboard_state_v6';

  const TDS_CFG = window.TDS_CONFIG || {};
  const DIRECTOR_EMAIL = TDS_CFG.directorEmail || 'typedigitalsolutions@outlook.com';

  const DEMO_CLIENT_EMAILS = new Set([
    'hello@northstar.example',
    'hello@urbanfinds.example',
    'hello@glowstudio.example'
  ]);

  const EMAILJS_CFG = {
    publicKey: TDS_CFG.emailjs?.publicKey || 'mDlKpULhhlpXDYf6J',
    serviceId: TDS_CFG.emailjs?.serviceId || 'service_duwrjdp',
    templateId: TDS_CFG.emailjs?.templateId || 'template_cd3utob',
    resetPasswordTemplateId:
      TDS_CFG.emailjs?.resetPasswordTemplateId || 'template_w43k4q7',
    fromName: TDS_CFG.emailjs?.defaults?.fromName || TDS_CFG.companyName || 'TYPE Digital Solutions',
    replyTo: TDS_CFG.emailjs?.defaults?.replyTo || DIRECTOR_EMAIL
  };

  const DEMO_CREDENTIALS = {
    admin_makgotso: {
      role: 'admin',
      name: 'Makgotso Seopa',
      firstName: 'Makgotso',
      surname: 'Seopa',
      initials: 'MS',
      email: DIRECTOR_EMAIL,
      password: 'TDSDirector2026!',
      company: 'TYPE Digital Solutions',
      redirect: 'admin_dashboard.html'
    },
    client_northstar: {
      role: 'client',
      name: 'Northstar Consulting',
      firstName: 'Northstar',
      surname: 'Consulting',
      initials: 'NC',
      email: 'hello@northstar.example',
      password: 'Northstar2026!',
      company: 'Northstar Consulting',
      contact: '',
      approved: true,
      passwordSetupComplete: true,
      redirect: 'client_dashboard.html'
    },
    client_urban_finds: {
      role: 'client',
      name: 'Urban Finds',
      firstName: 'Urban',
      surname: 'Finds',
      initials: 'UF',
      email: 'hello@urbanfinds.example',
      password: 'UrbanFinds2026!',
      company: 'Urban Finds',
      contact: '',
      approved: true,
      passwordSetupComplete: true,
      redirect: 'client_dashboard.html'
    },
    client_glow_studio: {
      role: 'client',
      name: 'Glow Studio',
      firstName: 'Glow',
      surname: 'Studio',
      initials: 'GS',
      email: 'hello@glowstudio.example',
      password: 'GlowStudio2026!',
      company: 'Glow Studio',
      contact: '',
      approved: true,
      passwordSetupComplete: true,
      redirect: 'client_dashboard.html'
    }
  };

  let pendingSetupEmail = '';
  let emailJsInitialized = false;

  function ensureEmailJsReady(templateIdToCheck = EMAILJS_CFG.templateId) {
    if (!window.emailjs || typeof window.emailjs.send !== 'function') {
      return { ok: false, reason: 'EmailJS SDK failed to load on the page.' };
    }
    if (!EMAILJS_CFG.publicKey || !EMAILJS_CFG.serviceId || !templateIdToCheck) {
      return { ok: false, reason: 'Missing EmailJS publicKey, serviceId, or templateId.' };
    }
    if (!emailJsInitialized && typeof window.emailjs.init === 'function') {
      try {
        window.emailjs.init({ publicKey: EMAILJS_CFG.publicKey });
        emailJsInitialized = true;
      } catch (err) {
        return { ok: false, reason: err?.text || err?.message || 'EmailJS init failed.' };
      }
    }
    return { ok: true, reason: '' };
  }

  ensureEmailJsReady();

  async function dispatchPortalEmail(
    recipientEmail,
    subject,
    message,
    resetLink = '',
    recipientName = '',
    templateIdOverride = '',
    extraParams = {}
  ) {
    const cleanTo = String(recipientEmail || '').trim();
    if (!cleanTo) {
      return { sent: false, error: 'Recipient email is empty.' };
    }

    const activeTemplateId = templateIdOverride || EMAILJS_CFG.templateId;
    const ready = ensureEmailJsReady(activeTemplateId);
    if (!ready.ok) {
      console.error('EmailJS not ready:', ready.reason);
      return { sent: false, error: ready.reason };
    }

    const templateParams = {
      name: recipientName || cleanTo,
      email: cleanTo,
      to_email: cleanTo,
      recipient_email: cleanTo,
      to_name: recipientName || cleanTo,
      from_name: EMAILJS_CFG.fromName,
      reply_to: EMAILJS_CFG.replyTo,
      cc_email: DIRECTOR_EMAIL,
      subject,
      message,
      link: resetLink,
      reset_link: resetLink,
      ...extraParams
    };

    try {
      const response = await window.emailjs.send(
        EMAILJS_CFG.serviceId,
        activeTemplateId,
        templateParams,
        { publicKey: EMAILJS_CFG.publicKey }
      );
      return { sent: true, status: response?.status || 200, error: '' };
    } catch (err) {
      const detail =
        err?.text ||
        err?.message ||
        (typeof err === 'string' ? err : 'Unknown EmailJS error');
      console.error('EmailJS send failed:', err, {
        serviceId: EMAILJS_CFG.serviceId,
        templateId: activeTemplateId,
        to: cleanTo
      });
      return { sent: false, error: detail };
    }
  }

  function readDismissedClients() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DISMISSED_CLIENTS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDismissedClients(map) {
    try {
      localStorage.setItem(DISMISSED_CLIENTS_KEY, JSON.stringify(map || {}));
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
      dismissedAt: entry.dismissedAt || ''
    };
  }

  function getDismissedClientsList() {
    const dismissed = readDismissedClients();
    const out = [];
    for (const [key, entry] of Object.entries(dismissed)) {
      const norm = normalizeDismissedEntry(key, entry);
      if (norm) out.push(norm);
    }
    return out;
  }

  function dismissClientRecord({ email = '', name = '', company = '' }) {
    const emailKey = String(email || '').trim().toLowerCase();
    const companyClean = String(company || '').trim();
    const companyKey = companyClean.toLowerCase();
    const mapKey = emailKey || companyKey;
    if (!mapKey) return;

    const dismissed = readDismissedClients();
    dismissed[mapKey] = {
      email: emailKey,
      name: name || companyClean || emailKey,
      company: companyClean,
      dismissed: true,
      dismissedAt: new Date().toISOString()
    };
    writeDismissedClients(dismissed);
  }

  function isDismissedClientEmail(email = '', companyName = '') {
    const emailKey = String(email || '').trim().toLowerCase();
    const companyKey = String(companyName || '').trim().toLowerCase();
    if (!emailKey && !companyKey) return false;

    for (const entry of getDismissedClientsList()) {
      const eMail = String(entry.email || '').trim().toLowerCase();
      const eComp = String(entry.company || '').trim().toLowerCase();
      if (emailKey && eMail && eMail === emailKey) return true;
      if (companyKey && eComp && eComp === companyKey) return true;
    }
    return false;
  }

  function forgetDismissedClient(email = '', companyName = '', name = '') {
    const emailKey = String(email || '').trim().toLowerCase();
    const companyKey = String(companyName || '').trim().toLowerCase();
    const nameKey = String(name || '').trim().toLowerCase();
    if (!emailKey && !companyKey && !nameKey) return;

    try {
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
    } catch {}

    try {
      const approvals = readApprovals();
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
        writeApprovals(approvals);
      }
    } catch {}

    try {
      const accounts = readAccounts().filter((acc) => {
        const accEmail = String(acc?.email || '').trim().toLowerCase();
        const accComp = String(acc?.company || '').trim().toLowerCase();
        const accName = String(acc?.name || '').trim().toLowerCase();
        return !(
          (emailKey && accEmail === emailKey) ||
          (companyKey && (accComp === companyKey || accName === companyKey))
        );
      });
      localStorage.setItem(TEMP_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {}

    try {
      const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.requests)) {
            parsed.requests = parsed.requests.filter((r) => {
              const rEmail = String(r?.email || '').trim().toLowerCase();
              const rComp = String(r?.company || '').trim().toLowerCase();
              const rName = String(r?.clientName || '').trim().toLowerCase();
              return !(
                (emailKey && rEmail === emailKey) ||
                (companyKey && (rComp === companyKey || rName === companyKey))
              );
            });
          }
          if (Array.isArray(parsed.clients)) {
            parsed.clients = parsed.clients.filter((c) => {
              const cEmail = String(c?.email || '').trim().toLowerCase();
              const cComp = String(c?.company || '').trim().toLowerCase();
              const cName = String(c?.name || '').trim().toLowerCase();
              return !(
                (emailKey && cEmail === emailKey) ||
                (companyKey && (cComp === companyKey || cName === companyKey))
              );
            });
          }
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {}

    try {
      const rawSess = sessionStorage.getItem(TEMP_SESSION_KEY);
      if (rawSess) {
        const sess = JSON.parse(rawSess);
        const sEmail = String(sess?.email || '').trim().toLowerCase();
        const sComp = String(sess?.company || sess?.name || '').trim().toLowerCase();
        if (
          (emailKey && sEmail === emailKey) ||
          (companyKey && sComp === companyKey)
        ) {
          sessionStorage.removeItem(TEMP_SESSION_KEY);
        }
      }
    } catch {}
  }

  function removeDismissedClient(email = '', companyName = '', name = '') {
    forgetDismissedClient(email, companyName, name);
  }

  function clearDismissedClient(email = '', companyName = '', name = '') {
    forgetDismissedClient(email, companyName, name);
  }

  function readAccounts() {
    try {
      const raw = localStorage.getItem(TEMP_ACCOUNTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveAccount(account) {
    try {
      const clientOnlyAccount = { ...account, role: 'client' };
      const list = readAccounts().filter(
        (acc) => String(acc.email || '').toLowerCase() !== String(clientOnlyAccount.email || '').toLowerCase()
      );
      list.unshift(clientOnlyAccount);
      localStorage.setItem(TEMP_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 40)));
    } catch {}
  }

  function readApprovals() {
    try {
      return JSON.parse(localStorage.getItem(CLIENT_APPROVALS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeApprovals(map) {
    try {
      localStorage.setItem(CLIENT_APPROVALS_KEY, JSON.stringify(map));
    } catch {}
  }

  function upsertClientRecord(record) {
    const key = String(record.email || '').trim().toLowerCase();
    if (!key) return null;

    const approvals = readApprovals();
    const existingApproval = approvals[key] || {};
    const existingAccount =
      readAccounts().find((a) => String(a.email || '').trim().toLowerCase() === key) || {};

    const firstName = record.firstName ?? existingApproval.firstName ?? existingAccount.firstName ?? '';
    const surname = record.surname ?? existingApproval.surname ?? existingAccount.surname ?? '';
    const contact = record.contact ?? existingApproval.contact ?? existingAccount.contact ?? '';
    const fullName =
      record.name ||
      [firstName, surname].filter(Boolean).join(' ').trim() ||
      existingApproval.name ||
      existingAccount.name ||
      key;
    const company =
      record.company ?? existingApproval.company ?? existingAccount.company ?? fullName;
    const approved =
      record.approved !== undefined
        ? Boolean(record.approved)
        : Boolean(existingApproval.approved ?? existingAccount.approved);
    const passwordSetupComplete =
      record.passwordSetupComplete !== undefined
        ? Boolean(record.passwordSetupComplete)
        : Boolean(existingApproval.passwordSetupComplete ?? existingAccount.passwordSetupComplete);
    const password =
      record.password !== undefined
        ? record.password
        : existingApproval.password || existingAccount.password || '';

    const merged = {
      email: key,
      firstName,
      surname,
      name: fullName,
      company,
      contact,
      role: 'client',
      approved,
      passwordSetupComplete,
      password,
      requestedAt: existingApproval.requestedAt || existingAccount.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    approvals[key] = merged;
    writeApprovals(approvals);
    saveAccount(merged);
    return merged;
  }

  function getClientRecord(email) {
    const key = String(email || '').trim().toLowerCase();
    if (!key) return null;
    if (DEMO_CLIENT_EMAILS.has(key)) {
      const demo = Object.values(DEMO_CREDENTIALS).find((c) => c.email.toLowerCase() === key);
      if (demo) {
        return {
          ...demo,
          role: 'client',
          contact: demo.contact || '',
          approved: true,
          passwordSetupComplete: true
        };
      }
    }
    const approvals = readApprovals();
    const fromApprovals = approvals[key];
    const fromAccounts = readAccounts().find(
      (a) => a && String(a.email || '').trim().toLowerCase() === key
    );
    if (!fromApprovals && !fromAccounts) return null;
    return {
      ...(fromAccounts || {}),
      ...(fromApprovals || {}),
      role: 'client',
      email: key
    };
  }

  async function notifyDirectorOfNewRegistration(account) {
    const stamp = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    try {
      const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
      const parsed = rawAdmin ? JSON.parse(rawAdmin) : {};
      const state = parsed && typeof parsed === 'object' ? parsed : {};
      state.clients = Array.isArray(state.clients) ? state.clients : [];
      state.requests = Array.isArray(state.requests) ? state.requests : [];
      state.activities = Array.isArray(state.activities) ? state.activities : [];

      const reqId = `approval_${String(account.email).trim().toLowerCase()}`;
      const detailLine = `Name: ${account.name} · Contact: ${account.contact || 'N/A'} · Email: ${account.email}`;
      const existingIdx = state.requests.findIndex((r) => String(r.id) === reqId);
      const reqEntry = {
        id: reqId,
        company: account.company || account.name,
        clientName: account.name,
        firstName: account.firstName || '',
        surname: account.surname || '',
        contact: account.contact || '',
        email: account.email,
        project: 'New Client Account Request',
        budget: 0,
        priority: 'Pending Approval',
        notes: detailLine,
        receivedAt: stamp
      };
      if (existingIdx >= 0) {
        state.requests[existingIdx] = reqEntry;
      } else {
        state.requests.unshift(reqEntry);
      }

      state.activities.unshift({
        id: `act_${Date.now()}`,
        text: `New client account request from <strong>${account.name}</strong> (${account.email} · ${account.contact || 'no contact'}). Review & approve in Admin Dashboard.`,
        time: stamp
      });
      state.activities = state.activities.slice(0, 15);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
    } catch {}

    return dispatchPortalEmail(
      DIRECTOR_EMAIL,
      `New Client Account Request: ${account.name}`,
      `A new client requested a client account on TYPE Digital Solutions.\nName & Surname: ${account.name}\nEmail: ${account.email}\nContact Details: ${account.contact || 'Not provided'}\nBusiness / Company: ${account.company || account.name}\nSubmitted: ${stamp}\nAction: Approve in Admin Dashboard so the client receives "Client approved — create password".`,
      new URL('admin_dashboard.html', window.location.href).href,
      account.name
    );
  }

  async function notifyClientApproved(client) {
    const cleanEmail = String(client?.email || '').trim();
    if (!cleanEmail) return { sent: false, error: 'Missing client email.' };

    forgetDismissedClient(cleanEmail, client?.company || '', client?.name || '');

    const createPasswordUrl = new URL(
      `createAcc.html?email=${encodeURIComponent(cleanEmail)}&approved=1`,
      window.location.href
    ).href;

    const clientMail = await dispatchPortalEmail(
      cleanEmail,
      'Client approved — create password',
      `Hello ${client.name || cleanEmail},\n\nYour client account with TYPE Digital Solutions has been approved. Use the link below to create your password and access your client portal.`,
      createPasswordUrl,
      client.name || cleanEmail
    );

    if (cleanEmail.toLowerCase() !== DIRECTOR_EMAIL.toLowerCase()) {
      await dispatchPortalEmail(
        DIRECTOR_EMAIL,
        `Client Approved: ${client.name || cleanEmail}`,
        `Approved client account for ${client.name || cleanEmail} (${cleanEmail}) on TYPE Digital Solutions.`,
        createPasswordUrl,
        client.name || cleanEmail
      );
    }

    return clientMail;
  }

  async function notifyClientRemovedFromDismissed(client) {
    const cleanEmail = String(client?.email || '').trim();
    if (!cleanEmail) return { sent: false, error: 'Missing client email.' };

    const recipientName = client?.name || client?.company || cleanEmail;
    const requestTitle = client?.title || 'Account Re-registration Access';
    const createAccountUrl = new URL(
      `createAcc.html?email=${encodeURIComponent(cleanEmail)}`,
      window.location.href
    ).href;

    const messageText = `Hi ${recipientName},\n\nThank you for reaching out to us! We have received your request: "${requestTitle}", and we'll do our best to process it within 3 business days.\n\nBest regards,\nTYPE Digital Solutions`;

    const clientMail = await dispatchPortalEmail(
      cleanEmail,
      `Request Received — ${requestTitle}`,
      messageText,
      createAccountUrl,
      recipientName,
      EMAILJS_CFG.templateId,
      { title: requestTitle }
    );

    if (cleanEmail.toLowerCase() !== DIRECTOR_EMAIL.toLowerCase()) {
      await dispatchPortalEmail(
        DIRECTOR_EMAIL,
        `Dismissed Client Removed: ${recipientName}`,
        `Removed ${recipientName} (${cleanEmail}) from dismissed clients so they can create a new account again.\nRequest: "${requestTitle}"`,
        createAccountUrl,
        recipientName,
        EMAILJS_CFG.templateId,
        { title: requestTitle }
      );
    }

    return clientMail;
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(TEMP_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    try {
      sessionStorage.setItem(TEMP_SESSION_KEY, JSON.stringify(session));
    } catch {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(TEMP_SESSION_KEY);
    } catch {}
  }

  function buildInitials(label) {
    return (
      String(label || 'TD')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => (part[0] ? part[0].toUpperCase() : ''))
        .join('') || 'TD'
    );
  }

  function hydrateTopbar(session) {
    if (!session) return;
    if (session.role === 'client' && isDismissedClientEmail(session.email, session.company || session.name)) {
      clearSession();
      window.location.replace('login.html?status=dismissed');
      return;
    }
    document.querySelectorAll('[data-person-name]').forEach((el) => {
      el.textContent = session.name;
    });
    document.querySelectorAll('[data-first-name]').forEach((el) => {
      el.textContent = session.firstName;
    });
    document.querySelectorAll('[data-user-initials]').forEach((el) => {
      el.textContent = session.initials;
    });
  }

  function enforcePageRole() {
    const requiredRole = document.body?.dataset?.requireRole;
    if (!requiredRole) return;
    const session = getSession();
    if (!session || session.role !== requiredRole) {
      window.location.replace('login.html');
      return;
    }

    if (
      requiredRole === 'client' &&
      (session.unapprovedRemoved || isDismissedClientEmail(session.email, session.company || session.name))
    ) {
      clearSession();
      window.location.replace('login.html?status=dismissed');
    }
  }

  function revealSetPasswordForm(setupEmail) {
    const setPasswordForm = document.getElementById('setPasswordForm');
    if (!setPasswordForm) return;
    pendingSetupEmail = setupEmail || pendingSetupEmail;
    const emailField = document.getElementById('setupEmailDisplay');
    const registerForm = document.getElementById('createAccountForm');
    const forgotForm = document.getElementById('forgotAccountForm');
    const heading = document.getElementById('authHeading');
    const subtext = document.getElementById('authSubtext');

    if (emailField) emailField.value = pendingSetupEmail;
    if (registerForm) registerForm.hidden = true;
    if (forgotForm) forgotForm.hidden = true;
    setPasswordForm.hidden = false;
    if (heading) heading.textContent = 'Create new password';
    if (subtext) subtext.textContent = 'Create password and confirm password below so both match.';

    setTimeout(() => {
      document.getElementById('setupPasswordInput')?.focus();
    }, 30);
  }

  function openClientWorkspaceSession(record, companyOverride = '') {
    const displayName = companyOverride || record.company || record.name || record.email;
    const firstName = record.firstName || displayName.split(/\s+/)[0] || 'Client';
    const session = {
      role: 'client',
      name: displayName,
      firstName,
      surname: record.surname || '',
      contact: record.contact || '',
      initials: buildInitials(displayName),
      email: record.email,
      company: displayName,
      approved: true,
      passwordSetupComplete: true,
      redirect: 'client_dashboard.html'
    };
    setSession(session);
    window.location.href = session.redirect;
  }

  function handleSignIn() {
    const emailEl = document.getElementById('loginEmailInput');
    const passEl = document.getElementById('loginPasswordInput');
    const roleEl = document.getElementById('loginRoleSelect');
    const companyEl = document.getElementById('loginCompanyInput');
    const feedback = document.getElementById('authFeedback');

    const email = emailEl?.value.trim() || '';
    const password = passEl?.value || '';
    const selectedRole = roleEl?.value === 'client' ? 'client' : 'admin';
    const companyInput = companyEl?.value.trim() || '';

    if (!email) {
      if (feedback) feedback.textContent = 'Please enter your email address.';
      if (emailEl) emailEl.focus();
      return;
    }

    if (selectedRole === 'client' && isDismissedClientEmail(email, companyInput)) {
      clearSession();
      if (feedback) {
        feedback.textContent =
          'This client account has been dismissed by TYPE Digital Solutions and is not allowed to log in.';
      }
      return;
    }

    if (selectedRole === 'admin') {
      const adminDemo = DEMO_CREDENTIALS.admin_makgotso;
      if (!password) {
        if (feedback) feedback.textContent = 'Please enter your password.';
        if (passEl) passEl.focus();
        return;
      }
      if (adminDemo.password === password) {
        const businessName = companyInput || 'TYPE Digital Solutions';
        const session = {
          role: 'admin',
          name: businessName,
          firstName: businessName.split(/\s+/)[0] || 'Makgotso',
          initials: buildInitials(businessName),
          email: adminDemo.email,
          company: businessName,
          redirect: 'admin_dashboard.html'
        };
        setSession(session);
        window.location.href = session.redirect;
        return;
      }
      if (feedback) {
        feedback.textContent = 'Incorrect Business / Admin password.';
      }
      if (passEl) passEl.focus();
      return;
    }

    const clientRecord = getClientRecord(email);
    if (!clientRecord) {
      if (feedback) {
        feedback.textContent =
          'No client account found for that email. Click "Create account" to submit your details for approval.';
      }
      return;
    }

    if (!clientRecord.approved) {
      if (feedback) {
        feedback.textContent =
          'Your client account request is still pending approval. Once approved, you will receive an email saying "Client approved — create password".';
      }
      return;
    }

    if (!password) {
      if (feedback) feedback.textContent = 'Please enter your password.';
      if (passEl) passEl.focus();
      return;
    }

    if (clientRecord.password && clientRecord.password !== password) {
      if (feedback) {
        feedback.textContent = 'Incorrect password for this client account.';
      }
      if (passEl) passEl.focus();
      return;
    }

    openClientWorkspaceSession(clientRecord, companyInput);
  }

  function bindAuthEvents() {
    if (window.location.search.includes('status=dismissed')) {
      const feedback = document.getElementById('authFeedback');
      if (feedback) {
        feedback.textContent =
          'Your client account was dismissed by TYPE Digital Solutions and you have been logged out.';
      }
    } else if (window.location.search.includes('status=removed')) {
      const feedback = document.getElementById('authFeedback');
      if (feedback) {
        feedback.textContent = 'Your unapproved client account was removed by TYPE Digital Solutions.';
      }
    }

    const params = new URLSearchParams(window.location.search);
    const approvedParam = params.get('approved');
    const emailParam = (params.get('email') || '').trim();
    if (approvedParam === '1' && emailParam) {
      const existing = getClientRecord(emailParam);
      if (existing && !existing.passwordSetupComplete) {
        revealSetPasswordForm(emailParam);
      } else {
        const regEmailInput = document.getElementById('regEmailInput');
        if (regEmailInput) regEmailInput.value = emailParam;
      }
    } else if (emailParam) {
      const regEmailInput = document.getElementById('regEmailInput');
      if (regEmailInput && !regEmailInput.value) regEmailInput.value = emailParam;
    }

    document.querySelectorAll('[data-signout]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        window.location.href = 'login.html';
      });
    });

    const signInForm = document.getElementById('tempLoginForm');
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignIn();
      });
    }

    const signInBtn = document.getElementById('signInSubmitBtn');
    if (signInBtn) {
      signInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSignIn();
      });
    }

    const registerForm = document.getElementById('createAccountForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const firstName = document.getElementById('regFirstNameInput')?.value.trim() || '';
        const surname = document.getElementById('regSurnameInput')?.value.trim() || '';
        const email = document.getElementById('regEmailInput')?.value.trim() || '';
        const contact = document.getElementById('regContactInput')?.value.trim() || '';
        const companyInput = document.getElementById('regCompanyInput')?.value.trim() || '';
        const feedback = document.getElementById('authFeedback');
        const submitBtn = document.getElementById('submitClientRequestBtn');

        const fullName = [firstName, surname].filter(Boolean).join(' ').trim();
        const company = companyInput || fullName;

        if (!firstName || !surname || !email || !contact) {
          if (feedback) {
            feedback.textContent = 'Please enter your name, surname, email, and contact details.';
          }
          return;
        }

        if (isDismissedClientEmail(email, company)) {
          if (feedback) {
            feedback.textContent =
              'This client email or company was dismissed by TYPE Digital Solutions and cannot register or log in.';
          }
          return;
        }

        const existing = getClientRecord(email);
        if (existing?.approved && !existing?.passwordSetupComplete) {
          revealSetPasswordForm(email);
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (feedback) feedback.textContent = 'Sending client account request...';

        const account = upsertClientRecord({
          firstName,
          surname,
          name: fullName,
          company,
          email,
          contact,
          role: 'client',
          approved: false,
          passwordSetupComplete: false,
          password: ''
        });

        clearSession();
        const mailResult = await notifyDirectorOfNewRegistration(account);
        if (submitBtn) submitBtn.disabled = false;
        registerForm.reset();

        if (feedback) {
          feedback.textContent = mailResult.sent
            ? 'New client request saved and emailed to admin. Once approved, you will receive an email saying "Client approved — create password".'
            : `New client request saved to admin queue, but email failed (${mailResult.error}). Check EmailJS ${EMAILJS_CFG.serviceId} and template settings.`;
        }
      });
    }

    const forgotForm = document.getElementById('forgotAccountForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmailInput')?.value.trim() || '';
        const feedback = document.getElementById('authFeedback');
        const sendBtn = document.getElementById('sendPasswordResetBtn');
        if (!email) return;

        forgetDismissedClient(email);

        if (sendBtn) sendBtn.disabled = true;
        if (feedback) feedback.textContent = `Sending password reset email to ${email}...`;

        const resetUrl = new URL('ForgotPassword.html', window.location.href).href;

        const mailResult = await dispatchPortalEmail(
          email,
          'Create New Password — TYPE Digital Solutions',
          `Hello,\n\nA request was made to create a new password for ${email} on TYPE Digital Solutions.\n\nUse the link below to create and confirm your new password.`,
          resetUrl,
          email,
          EMAILJS_CFG.resetPasswordTemplateId
        );

        if (email.toLowerCase() !== DIRECTOR_EMAIL.toLowerCase()) {
          await dispatchPortalEmail(
            DIRECTOR_EMAIL,
            `Client Password Reset Request: ${email}`,
            `A client requested a password reset on TYPE Digital Solutions.\nClient Email: ${email}\nReset Link: ${resetUrl}`,
            resetUrl,
            email,
            EMAILJS_CFG.templateId
          );
        }

        if (sendBtn) sendBtn.disabled = false;
        forgotForm.reset();
        revealSetPasswordForm(email);

        if (feedback) {
          feedback.textContent = mailResult.sent
            ? `Password reset email sent to ${email}. Enter and confirm your new password below.`
            : `Could not send reset email via EmailJS (${mailResult.error}). You can still create and confirm your new password below.`;
        }
      });
    }

    const setPasswordForm = document.getElementById('setPasswordForm');
    if (setPasswordForm) {
      setPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (document.getElementById('setupEmailDisplay')?.value || pendingSetupEmail || '').trim();
        const pw = document.getElementById('setupPasswordInput')?.value || '';
        const confirmPw = document.getElementById('setupConfirmPasswordInput')?.value || '';
        const feedback = document.getElementById('authFeedback');

        if (!email) return;
        if (pw.length < 6) {
          if (feedback) feedback.textContent = 'Create password must be at least 6 characters.';
          return;
        }
        if (pw !== confirmPw) {
          if (feedback) {
            feedback.textContent = 'Passwords do not match. Create password and confirm password must match.';
          }
          return;
        }

        forgetDismissedClient(email);

        const adminDemo = DEMO_CREDENTIALS.admin_makgotso;
        if (email.toLowerCase() === adminDemo.email.toLowerCase()) {
          adminDemo.password = pw;
          setPasswordForm.reset();
          window.location.href = 'login.html';
          return;
        }

        const updated = upsertClientRecord({
          email,
          approved: true,
          passwordSetupComplete: true,
          password: pw
        });

        if (updated) {
          setPasswordForm.reset();
          openClientWorkspaceSession(updated);
        }
      });
    }
  }

  window.TDS_AUTH = Object.freeze({
    dispatchPortalEmail,
    notifyDirectorOfNewRegistration,
    notifyClientApproved,
    notifyClientRemovedFromDismissed,
    dismissClientRecord,
    removeDismissedClient,
    clearDismissedClient,
    forgetDismissedClient,
    getDismissedClientsList,
    upsertClientRecord,
    getClientRecord,
    getSession,
    clearSession
  });

  enforcePageRole();
  const activeSession = getSession();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hydrateTopbar(activeSession);
      bindAuthEvents();
    });
  } else {
    hydrateTopbar(activeSession);
    bindAuthEvents();
  }
})();