window.addEventListener('error', (event) => {
  if (event && event.filename && event.filename.includes('admin-dashboard.js')) {
    console.warn('Admin dashboard handled error:', event.message);
  }
});

const TDS_STORAGE_KEY = 'tds_admin_dashboard_state_v6';
const TDS_SHARED_REQUESTS_KEY = 'tds_shared_work_requests_v1';
const TDS_REQUEST_STATUS_KEY = 'tds_client_request_status_v1';
const TDS_CLIENT_STORAGE_KEY = 'tds_client_northstar_v1';
const TDS_CLIENT_FEED_KEY = 'tds_client_feed_v1';
const TDS_MONTHLY_BALANCE_KEY = 'tds_monthly_business_balance_v2';
const TDS_DIRECTOR_EMAIL = 'director@typedigitalsolutions.co.za';
const TDS_TIMEZONE = 'Africa/Johannesburg';

const TDS_EMAILJS = {
  publicKey: 'YOUR_EMAILJS_PUBLIC_KEY',
  serviceId: 'YOUR_EMAILJS_SERVICE_ID',
  templateId: 'YOUR_EMAILJS_TEMPLATE_ID'
};

if (window.emailjs && TDS_EMAILJS.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY') {
  try {
    window.emailjs.init({ publicKey: TDS_EMAILJS.publicKey });
  } catch {}
}

let trackedDateIso = '';

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
      email: 'team@urbanfinds.example',
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
      email: 'info@glowstudio.example',
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

function readMonthlyReserve(monthKey) {
  try {
    const map = JSON.parse(localStorage.getItem(TDS_MONTHLY_BALANCE_KEY) || '{}');
    const entry = map[monthKey];
    if (entry && typeof entry === 'object') {
      return {
        setAside: sanitizeAmount(entry.setAside),
        spent: sanitizeAmount(entry.spent),
        note: String(entry.note || 'Reserved for business costs'),
        allocations: Array.isArray(entry.allocations) ? entry.allocations : []
      };
    }
    return { setAside: 0, spent: 0, note: 'Reserved for business costs', allocations: [] };
  } catch {
    return { setAside: 0, spent: 0, note: 'Reserved for business costs', allocations: [] };
  }
}

function saveMonthlyReserve(monthKey, reserveObj) {
  try {
    const map = JSON.parse(localStorage.getItem(TDS_MONTHLY_BALANCE_KEY) || '{}');
    map[monthKey] = {
      setAside: sanitizeAmount(reserveObj.setAside),
      spent: sanitizeAmount(reserveObj.spent),
      note: String(reserveObj.note || 'Reserved for business costs'),
      allocations: Array.isArray(reserveObj.allocations) ? reserveObj.allocations.slice(0, 12) : []
    };
    localStorage.setItem(TDS_MONTHLY_BALANCE_KEY, JSON.stringify(map));
  } catch {}
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

function recordClientCompletedContract(client) {
  try {
    const raw = localStorage.getItem(TDS_CLIENT_FEED_KEY);
    const feed = raw ? JSON.parse(raw) : { notifications: [], completedContracts: [], acceptedWork: [] };
    feed.completedContracts = Array.isArray(feed.completedContracts) ? feed.completedContracts : [];
    feed.completedContracts.unshift({
      id: client.id,
      clientName: client.name,
      email: client.email,
      project: client.project,
      fee: sanitizeAmount(client.fee),
      completedAt: `${getSouthAfricaClock().isoDate} · ${getSouthAfricaClock().time}`
    });
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
  try {
    const raw = localStorage.getItem(TDS_SHARED_REQUESTS_KEY);
    if (!raw) return;
    const incomingList = JSON.parse(raw);
    if (!Array.isArray(incomingList)) return;

    let added = false;
    for (const item of incomingList) {
      if (!item || !item.id) continue;
      const exists = dashState.requests.some((r) => String(r.id) === String(item.id));
      if (!exists) {
        dashState.requests.unshift({
          id: String(item.id),
          company: String(item.company || 'Northstar Consulting'),
          email: String(item.email || 'hello@northstar.example'),
          project: String(item.project || 'Client Work Request'),
          budget: sanitizeAmount(item.budget),
          priority: String(item.priority || 'Normal'),
          notes: String(item.notes || ''),
          receivedAt: String(item.receivedAt || getSouthAfricaClock().isoDate)
        });
        added = true;
      }
    }

    if (added) {
      writeDashboardState();
    }
  } catch {}
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
        milestones: Array.isArray(row.milestones) ? row.milestones : []
      }));
    }

    if (Array.isArray(requestsResult.data)) {
      dashState.requests = requestsResult.data.map((row) => ({
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
            const clock = getSouthAfricaClock();
            dashState.requests.unshift({
              id: incoming.id,
              company: incoming.company,
              email: incoming.email,
              project: incoming.project || incoming.scope || 'Web Development & Landing Pages',
              budget: sanitizeAmount(incoming.budget),
              receivedAt: `${clock.isoDate} · ${clock.time}`
            });
            addLogEntry(`New company request from <strong>${escapeHtml(incoming.company)}</strong>.`);
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

function makeInitials(name) {
  return (
    String(name || 'CL')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ''))
      .join('') || 'CL'
  );
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

async function sendNotificationEmail(clientEmail, subject, message) {
  if (!window.emailjs || TDS_EMAILJS.publicKey === 'YOUR_EMAILJS_PUBLIC_KEY') return;
  try {
    await window.emailjs.send(TDS_EMAILJS.serviceId, TDS_EMAILJS.templateId, {
      to_email: clientEmail,
      cc_email: TDS_DIRECTOR_EMAIL,
      subject,
      message
    });
  } catch {}
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
  let paidSum = 0;
  let pipelineSum = 0;
  let dueSoonSum = 0;

  for (const client of dashState.clients) {
    const fee = sanitizeAmount(client.fee);
    if (client.payment === 'Paid') {
      paidSum += fee;
    } else if (client.payment === 'Deposit Paid') {
      paidSum += fee * 0.5;
      pipelineSum += fee * 0.5;
    } else {
      pipelineSum += fee;
    }

    for (const ms of client.milestones || []) {
      if (!ms.completed && daysUntilTarget(ms.dueDate) <= 3) {
        dueSoonSum += 1;
      }
    }
  }

  const clock = getSouthAfricaClock();
  const reserve = readMonthlyReserve(clock.monthKey);
  const availableAfterCommitments = paidSum - reserve.setAside - reserve.spent;

  const paidEl = document.getElementById('statPaidIncome');
  const pipeEl = document.getElementById('statPipelineNote');
  const clientsEl = document.getElementById('statTotalClients');
  const dueEl = document.getElementById('statDueMilestones');
  const reqEl = document.getElementById('statNewRequests');

  if (paidEl) paidEl.textContent = formatRand(paidSum);
  if (pipeEl) pipeEl.textContent = `Pipeline: ${formatRand(pipelineSum)}`;
  if (clientsEl) clientsEl.textContent = String(dashState.clients.length).padStart(2, '0');
  if (dueEl) dueEl.textContent = String(dueSoonSum).padStart(2, '0');
  if (reqEl) reqEl.textContent = String(dashState.requests.length).padStart(2, '0');

  const periodEl = document.getElementById('monthlyBalancePeriod');
  const collectedEl = document.getElementById('monthlyCollectedValue');
  const setAsideValEl = document.getElementById('monthlySetAsideValue');
  const setAsideNoteEl = document.getElementById('monthlySetAsideNote');
  const spentValEl = document.getElementById('monthlySpentValue');
  const netValEl = document.getElementById('netMonthlyBalanceValue');
  const statusEl = document.getElementById('monthlyBalanceStatus');
  const reserveLogEl = document.getElementById('expenseReserveLog');

  if (periodEl) periodEl.textContent = clock.monthKey;
  if (collectedEl) collectedEl.textContent = formatRand(paidSum);
  if (setAsideValEl) setAsideValEl.textContent = formatRand(reserve.setAside);
  if (setAsideNoteEl) setAsideNoteEl.textContent = reserve.note || 'Reserved for business costs';
  if (spentValEl) spentValEl.textContent = formatRand(reserve.spent);
  if (netValEl) netValEl.textContent = formatRand(availableAfterCommitments);
  if (statusEl) {
    statusEl.textContent =
      availableAfterCommitments >= 0
        ? `Available after reserve & spent (${formatRand(availableAfterCommitments)})`
        : `Over-allocated this month (${formatRand(availableAfterCommitments)})`;
  }

  if (reserveLogEl) {
    reserveLogEl.innerHTML = reserve.allocations.length
      ? reserve.allocations
          .map((a) => {
            const kindTag = a.kind === 'spent' ? 'Spent' : 'Set aside';
            return `<div class="activity"><span class="activity-dot"></span><p><strong>${kindTag}: ${formatRand(a.amount)}</strong> · ${escapeHtml(a.label)}<small>${escapeHtml(a.time)}</small></p></div>`;
          })
          .join('')
      : '<p class="muted" style="font-size:12px">No expense reserve or spent entries logged for this month yet.</p>';
  }
}

function renderClientsSection() {
  const tbody = document.getElementById('clientsTableBody');
  const invSelect = document.getElementById('invoiceClientSelect');

  syncMilestoneDropdown();

  if (!dashState.clients.length) {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4">No active clients. Add one above or accept a request.</td></tr>';
    }
    if (invSelect) invSelect.innerHTML = '<option value="">No active clients</option>';
    renderInvoiceCard(null);
    return;
  }

  const optionsHtml = dashState.clients
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');

  if (invSelect) {
    const prevInv = invSelect.value;
    invSelect.innerHTML = optionsHtml;
    if (prevInv && dashState.clients.some((c) => String(c.id) === String(prevInv))) {
      invSelect.value = prevInv;
    }
  }

  if (tbody) {
    tbody.innerHTML = dashState.clients
      .map((client) => {
        const pillClass =
          client.payment === 'Paid'
            ? 'pill'
            : client.payment === 'Deposit Paid'
              ? 'pill blue'
              : 'pill amber';
        return `
          <tr>
            <td>
              <div class="client-cell">
                <span class="mini-avatar">${escapeHtml(makeInitials(client.name))}</span>
                <div><strong>${escapeHtml(client.name)}</strong><br><small>${escapeHtml(client.email)}</small></div>
              </div>
            </td>
            <td>${escapeHtml(client.project)}<br><strong>${formatRand(client.fee)}</strong></td>
            <td><span class="${pillClass}">${escapeHtml(client.payment)}</span></td>
            <td>
              <button type="button" class="btn" data-action="cycle-payment" data-id="${escapeHtml(client.id)}">Payment</button>
              <button type="button" class="btn" data-action="select-invoice" data-id="${escapeHtml(client.id)}">Invoice</button>
              <button type="button" class="btn" data-action="remove-client" data-id="${escapeHtml(client.id)}">Done</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  const selectedId = invSelect ? invSelect.value : dashState.clients[0].id;
  const activeClient = dashState.clients.find((c) => String(c.id) === String(selectedId)) || dashState.clients[0];
  renderInvoiceCard(activeClient);
}

function renderMilestonesSection() {
  const tbody = document.getElementById('milestonesTableBody');
  if (!tbody) return;

  const list = [];
  for (const client of dashState.clients) {
    for (const ms of client.milestones || []) {
      list.push({
        clientId: client.id,
        milestoneId: ms.id,
        clientName: client.name,
        title: ms.title,
        dueDate: ms.dueDate,
        completed: Boolean(ms.completed),
        days: daysUntilTarget(ms.dueDate)
      });
    }
  }

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4">No milestones logged yet.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      const nearDue = !item.completed && item.days <= 3;
      const statusText = item.completed
        ? 'Completed'
        : item.days < 0
          ? `${Math.abs(item.days)}d overdue`
          : item.days === 0
            ? 'Due today'
            : `${item.days}d left`;
      const pillClass = item.completed ? 'pill grey' : nearDue ? 'pill amber' : 'pill';

      return `
        <tr>
          <td><strong>${escapeHtml(item.title)}</strong></td>
          <td>${escapeHtml(item.clientName)}</td>
          <td>${escapeHtml(item.dueDate)}</td>
          <td>
            <span class="${pillClass}">${escapeHtml(statusText)}</span>
            ${
              item.completed
                ? ''
                : `<button type="button" class="btn" data-action="complete-milestone" data-client-id="${escapeHtml(item.clientId)}" data-milestone-id="${escapeHtml(item.milestoneId)}">Complete</button>`
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderRequestsSection() {
  const container = document.getElementById('requestsList');
  if (!container) return;

  if (!dashState.requests.length) {
    container.innerHTML = '<p class="muted" style="font-size:12px">No pending company requests.</p>';
    return;
  }

  container.innerHTML = dashState.requests
    .map((req) => {
      const extraMeta = [req.priority, req.notes].filter(Boolean).map(escapeHtml).join(' · ');
      return `
      <div class="activity">
        <span class="activity-dot"></span>
        <p>
          <strong>${escapeHtml(req.company)}</strong> · ${escapeHtml(req.project)} (${formatRand(req.budget)})
          <small>${escapeHtml(req.email)} · ${escapeHtml(req.receivedAt || 'Live')}${extraMeta ? ` · ${extraMeta}` : ''}</small>
          <button type="button" class="btn btn-primary" data-action="accept-request" data-id="${escapeHtml(req.id)}">Accept</button>
          <button type="button" class="btn" data-action="dismiss-request" data-id="${escapeHtml(req.id)}">Dismiss</button>
        </p>
      </div>
    `;
    })
    .join('');
}

function renderActivitySection() {
  const container = document.getElementById('activityList');
  if (!container) return;

  container.innerHTML = dashState.activities
    .map(
      (act) => `
      <div class="activity">
        <span class="activity-dot"></span>
        <p>${act.text}<small>${escapeHtml(act.time)}</small></p>
      </div>
    `
    )
    .join('');
}

function renderInvoiceCard(client) {
  const preview = document.getElementById('invoicePreview');
  if (!preview) return;

  if (!client) {
    preview.textContent = 'Select a client to preview or download an invoice.';
    return;
  }

  const clock = getSouthAfricaClock();
  const invNumber = `TDS-${String(client.id).slice(0, 8).toUpperCase()}-${clock.year}`;
  preview.innerHTML = `
    <strong>Invoice #:</strong> ${escapeHtml(invNumber)} · <strong>Date:</strong> ${escapeHtml(clock.isoDate)}<br>
    <strong>Client:</strong> ${escapeHtml(client.name)} (${escapeHtml(client.email)})<br>
    <strong>Project:</strong> ${escapeHtml(client.project)}<br>
    <strong>Status:</strong> ${escapeHtml(client.payment)} · <strong>Total:</strong> ${formatRand(client.fee)}
  `;
}

function triggerInvoiceDownload(client) {
  if (!client) return;
  const clock = getSouthAfricaClock();
  const invNumber = `TDS-${String(client.id).slice(0, 8).toUpperCase()}-${clock.year}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(invNumber)} - ${escapeHtml(client.name)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
  .sheet { max-width: 720px; margin: auto; border: 1px solid #ccc; padding: 28px; border-radius: 8px; }
  .top { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .total { margin-top: 24px; padding-top: 14px; border-top: 2px solid #111; display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div><h2>TYPE Digital Solutions (Pty) Ltd</h2><p>${escapeHtml(TDS_DIRECTOR_EMAIL)}</p></div>
      <div><strong>Invoice #:</strong> ${escapeHtml(invNumber)}<br><strong>Date:</strong> ${escapeHtml(clock.isoDate)}</div>
    </div>
    <p><strong>Client:</strong> ${escapeHtml(client.name)} (${escapeHtml(client.email)})</p>
    <p><strong>Project:</strong> ${escapeHtml(client.project)}</p>
    <p><strong>Payment Status:</strong> ${escapeHtml(client.payment)}</p>
    <div class="total"><span>Total (ZAR)</span><span>${formatRand(client.fee)}</span></div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${invNumber}-${String(client.name).replace(/\s+/g, '-')}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function runMilestoneAlertSweep() {
  let alertsSent = 0;

  for (const client of dashState.clients) {
    for (const ms of client.milestones || []) {
      if (ms.completed) continue;
      const rem = daysUntilTarget(ms.dueDate);
      if (rem <= 3 && !ms.alerted) {
        ms.alerted = true;
        alertsSent += 1;
        const timing = rem < 0 ? `${Math.abs(rem)}d overdue` : rem === 0 ? 'due today' : `due in ${rem}d`;
        addLogEntry(
          `Milestone alert for <strong>${escapeHtml(client.name)}</strong>: "${escapeHtml(ms.title)}" (${escapeHtml(timing)}). Alert sent to ${escapeHtml(client.email)} & ${escapeHtml(TDS_DIRECTOR_EMAIL)}.`
        );
        pushClientNotification(
          client.name,
          `Milestone alert: ${ms.title}`,
          `Scheduled for ${ms.dueDate} (${timing}).`,
          'alert'
        );
        await sendNotificationEmail(
          client.email,
          `Milestone Reminder: ${ms.title} (${client.name})`,
          `Milestone "${ms.title}" for ${client.name} is ${timing} (${ms.dueDate}).`
        );
      }
    }
  }

  if (alertsSent === 0) {
    addLogEntry('Milestone check complete.');
  }

  writeDashboardState();
  renderAllSections();
}

function renderAllSections() {
  syncClientBridgeRequests();
  renderSummaryCards();
  renderClientsSection();
  renderMilestonesSection();
  renderRequestsSection();
  renderActivitySection();
}

function bindFormsAndControls() {
  const menuBtn = document.getElementById('adminMobileMenuBtn');
  const sideNav = document.getElementById('adminSideNav');
  if (menuBtn && sideNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sideNav.style.display === 'grid';
      sideNav.style.display = isOpen ? '' : 'grid';
    });
  }

  const reserveForm = document.getElementById('expenseSetAsideForm');
  if (reserveForm) {
    reserveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amtInput = document.getElementById('setAsideAmountInput');
      const actionTypeEl = document.getElementById('expenseActionTypeSelect');
      const lblInput = document.getElementById('setAsideLabelInput');

      const amount = sanitizeAmount(amtInput ? amtInput.value : 0);
      if (amount <= 0) return;

      const kind = actionTypeEl && actionTypeEl.value === 'spent' ? 'spent' : 'reserve';
      const label =
        (lblInput ? lblInput.value : '').trim() ||
        (kind === 'spent' ? 'Business expense paid' : 'Business expense set-aside');

      const clock = getSouthAfricaClock();
      const current = readMonthlyReserve(clock.monthKey);

      const nextSetAside = kind === 'reserve' ? current.setAside + amount : current.setAside;
      const nextSpent = kind === 'spent' ? current.spent + amount : current.spent;

      const allocations = [
        {
          id: generateUuid(),
          kind,
          amount,
          label,
          time: `${clock.isoDate} · ${clock.time}`
        },
        ...current.allocations
      ].slice(0, 12);

      saveMonthlyReserve(clock.monthKey, {
        setAside: nextSetAside,
        spent: nextSpent,
        note: `Reserved ${formatRand(nextSetAside)} · Spent ${formatRand(nextSpent)}`,
        allocations
      });

      addLogEntry(
        kind === 'spent'
          ? `Recorded spent expense <strong>${formatRand(amount)}</strong> (${escapeHtml(label)}) in ${escapeHtml(clock.monthKey)}.`
          : `Set aside <strong>${formatRand(amount)}</strong> for business expenses (${escapeHtml(label)}) in ${escapeHtml(clock.monthKey)}.`
      );

      if (amtInput) amtInput.value = '';
      if (lblInput) lblInput.value = '';
      renderSummaryCards();
      renderActivitySection();
    });
  }

  const clearReserveBtn = document.getElementById('clearSetAsideBtn');
  if (clearReserveBtn) {
    clearReserveBtn.addEventListener('click', () => {
      const clock = getSouthAfricaClock();
      saveMonthlyReserve(clock.monthKey, {
        setAside: 0,
        spent: 0,
        note: 'Reserved for business costs',
        allocations: []
      });
      addLogEntry(`Reset monthly expense reserve and spent totals for ${escapeHtml(clock.monthKey)}.`);
      renderSummaryCards();
      renderActivitySection();
    });
  }

  const serviceSelect = document.getElementById('clientServiceSelect');
  const customServiceInput = document.getElementById('customServiceInput');

  if (serviceSelect && customServiceInput) {
    serviceSelect.addEventListener('change', () => {
      const isOther = serviceSelect.value === 'Other';
      customServiceInput.hidden = !isOther;
      customServiceInput.required = isOther;
      if (isOther) {
        customServiceInput.focus();
      } else {
        customServiceInput.value = '';
      }
    });
  }

  const addClientForm = document.getElementById('addClientForm');
  if (addClientForm) {
    addClientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('clientNameInput');
      const emailEl = document.getElementById('clientEmailInput');
      const feeEl = document.getElementById('clientFeeInput');
      const paymentEl = document.getElementById('clientPaymentSelect');

      const name = nameEl ? nameEl.value.trim() : '';
      const email = emailEl ? emailEl.value.trim() : '';
      const selectedService = serviceSelect ? serviceSelect.value : '';
      const customService = customServiceInput ? customServiceInput.value.trim() : '';
      const project = selectedService === 'Other' ? customService : selectedService;
      const fee = sanitizeAmount(feeEl ? feeEl.value : 0);
      const payment = paymentEl ? paymentEl.value : 'Unpaid';

      if (!name || !email || !project) return;

      if (selectedService === 'Other' && customService && serviceSelect) {
        const exists = Array.from(serviceSelect.options).some(
          (opt) => opt.value.toLowerCase() === customService.toLowerCase()
        );
        if (!exists) {
          dashState.customServices.push(customService);
          const otherOpt = serviceSelect.querySelector('option[value="Other"]');
          const newOpt = document.createElement('option');
          newOpt.value = customService;
          newOpt.textContent = customService;
          if (otherOpt) {
            serviceSelect.insertBefore(newOpt, otherOpt);
          } else {
            serviceSelect.appendChild(newOpt);
          }
        }
      }

      const newClient = {
        id: generateUuid(),
        name,
        email,
        project,
        fee,
        payment,
        createdAt: new Date().toISOString(),
        milestones: []
      };

      dashState.clients.unshift(newClient);
      addLogEntry(`Added client <strong>${escapeHtml(name)}</strong> · ${escapeHtml(project)} (${formatRand(fee)} · ${escapeHtml(payment)}).`);
      pushClientNotification(
        name,
        `New contract active: ${project}`,
        `Contract value ${formatRand(fee)} · Payment status: ${payment}.`,
        'info'
      );
      writeDashboardState();
      persistRow('clients', newClient);

      addClientForm.reset();
      if (customServiceInput) {
        customServiceInput.hidden = true;
        customServiceInput.required = false;
      }
      renderAllSections();
      const msSelect = document.getElementById('milestoneClientSelect');
      if (msSelect) msSelect.value = newClient.id;
    });
  }

  const milestoneForm = document.getElementById('milestoneForm');
  if (milestoneForm) {
    milestoneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientSelect = document.getElementById('milestoneClientSelect');
      const titleInput = document.getElementById('milestoneTitleInput');
      const dateInput = document.getElementById('milestoneDueDateInput');

      const clientId = clientSelect ? clientSelect.value : '';
      const title = titleInput ? titleInput.value.trim() : '';
      const dueDate = dateInput ? dateInput.value : '';
      const client = dashState.clients.find((c) => String(c.id) === String(clientId));

      if (!client) {
        addLogEntry('Select or add a client before logging a milestone.');
        renderActivitySection();
        return;
      }

      if (!title || !dueDate) return;

      client.milestones = Array.isArray(client.milestones) ? client.milestones : [];
      client.milestones.push({
        id: generateUuid(),
        title,
        dueDate,
        completed: false,
        alerted: false
      });

      addLogEntry(`Logged milestone "${escapeHtml(title)}" for <strong>${escapeHtml(client.name)}</strong> (due ${escapeHtml(dueDate)}).`);
      pushClientNotification(
        client.name,
        `Milestone scheduled: ${title}`,
        `Due date: ${dueDate}.`,
        'info'
      );
      writeDashboardState();
      persistRow('clients', client);

      if (titleInput) titleInput.value = '';
      if (dateInput) dateInput.value = '';
      await runMilestoneAlertSweep();
    });
  }

  const invSelect = document.getElementById('invoiceClientSelect');
  if (invSelect) {
    invSelect.addEventListener('change', () => {
      const selected = dashState.clients.find((c) => String(c.id) === String(invSelect.value)) || null;
      renderInvoiceCard(selected);
    });
  }

  document.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;

      if (action === 'complete-milestone') {
        const clientId = actionBtn.dataset.clientId;
        const milestoneId = actionBtn.dataset.milestoneId;
        const client = dashState.clients.find((c) => String(c.id) === String(clientId));
        const ms = client && Array.isArray(client.milestones)
          ? client.milestones.find((m) => String(m.id) === String(milestoneId))
          : null;
        if (client && ms) {
          ms.completed = true;
          addLogEntry(`Completed milestone "${escapeHtml(ms.title)}" for <strong>${escapeHtml(client.name)}</strong>.`);
          pushClientNotification(
            client.name,
            `Milestone completed: ${ms.title}`,
            'Marked complete by TYPE Digital Solutions.',
            'done'
          );
          writeDashboardState();
          persistRow('clients', client);
          renderAllSections();
        }
        return;
      }

      if (action === 'cycle-payment') {
        const order = ['Unpaid', 'Deposit Paid', 'Paid'];
        const client = dashState.clients.find((c) => String(c.id) === String(id));
        if (client) {
          client.payment = order[(order.indexOf(client.payment) + 1) % order.length];
          addLogEntry(`<strong>${escapeHtml(client.name)}</strong> payment updated to ${escapeHtml(client.payment)}.`);
          pushClientNotification(
            client.name,
            `Payment status: ${client.payment}`,
            `${client.project} (${formatRand(client.fee)}).`,
            client.payment === 'Paid' ? 'done' : 'alert'
          );
          writeDashboardState();
          persistRow('clients', client);
          renderAllSections();
        }
        return;
      }

      if (action === 'select-invoice') {
        if (invSelect) invSelect.value = id;
        const client = dashState.clients.find((c) => String(c.id) === String(id)) || null;
        renderInvoiceCard(client);
        const docsSection = document.getElementById('documents');
        if (docsSection) docsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      if (action === 'remove-client') {
        const client = dashState.clients.find((c) => String(c.id) === String(id));
        dashState.clients = dashState.clients.filter((c) => String(c.id) !== String(id));
        if (client) {
          addLogEntry(`Contract finished and removed <strong>${escapeHtml(client.name)}</strong>.`);
          recordClientCompletedContract(client);
          pushClientNotification(
            client.name,
            `Contract completed: ${client.project}`,
            `Marked Done (${formatRand(client.fee)}).`,
            'done'
          );
          removeRow('clients', id);
        }
        writeDashboardState();
        renderAllSections();
        return;
      }

      if (action === 'accept-request') {
        const req = dashState.requests.find((r) => String(r.id) === String(id));
        if (req) {
          const budgetVal = sanitizeAmount(req.budget);
          const client = {
            id: generateUuid(),
            name: req.company,
            email: req.email,
            project: req.project,
            fee: budgetVal,
            payment: 'Unpaid',
            createdAt: new Date().toISOString(),
            milestones: []
          };
          dashState.clients.unshift(client);
          dashState.requests = dashState.requests.filter((r) => String(r.id) !== String(id));
          removeRequestFromBridge(id);
          writeRequestStatusBack(id, 'Accepted');
          recordClientAcceptedWork(req);
          pushClientNotification(
            req.company,
            `Work request accepted: ${req.project}`,
            `Approved at ${formatRand(budgetVal)} · Balance due: ${formatRand(budgetVal)}.`,
            'done'
          );
          addLogEntry(`Accepted request from <strong>${escapeHtml(req.company)}</strong>.`);
          writeDashboardState();
          persistRow('clients', client);
          removeRow('company_requests', id);
          renderAllSections();
        }
        return;
      }

      if (action === 'dismiss-request') {
        const req = dashState.requests.find((r) => String(r.id) === String(id));
        dashState.requests = dashState.requests.filter((r) => String(r.id) !== String(id));
        removeRequestFromBridge(id);
        writeRequestStatusBack(id, 'Dismissed');
        if (req) {
          pushClientNotification(
            req.company,
            `Work request update: ${req.project}`,
            'Request status set to Dismissed.',
            'info'
          );
        }
        removeRow('company_requests', id);
        writeDashboardState();
        renderAllSections();
        return;
      }
    }

    const targetId = e.target.id;
    if (targetId === 'simulateRequestBtn') {
      const clock = getSouthAfricaClock();
      const sample = {
        id: generateUuid(),
        company: 'Neo Architects',
        email: 'studio@neoarchitects.example',
        project: 'Web Development & Landing Pages',
        budget: 12500,
        receivedAt: `${clock.isoDate} · ${clock.time}`
      };
      dashState.requests.unshift(sample);
      addLogEntry(`New company request from <strong>${escapeHtml(sample.company)}</strong>.`);
      await sendNotificationEmail(
        TDS_DIRECTOR_EMAIL,
        `New Company Request: ${sample.company}`,
        `${sample.company} (${sample.email}) requested "${sample.project}" (${formatRand(sample.budget)}).`
      );
      writeDashboardState();
      renderAllSections();
    } else if (targetId === 'downloadInvoiceBtn') {
      const selectedId = invSelect ? invSelect.value : '';
      const client = dashState.clients.find((c) => String(c.id) === String(selectedId)) || dashState.clients[0] || null;
      triggerInvoiceDownload(client);
    } else if (targetId === 'printInvoiceBtn') {
      window.print();
    } else if (targetId === 'checkAlertsBtn') {
      await runMilestoneAlertSweep();
    }
  });

  window.addEventListener('storage', (event) => {
    if (
      event.key === TDS_SHARED_REQUESTS_KEY ||
      event.key === TDS_STORAGE_KEY ||
      event.key === TDS_CLIENT_STORAGE_KEY ||
      event.key === TDS_MONTHLY_BALANCE_KEY
    ) {
      dashState = readDashboardState();
      renderAllSections();
    }
  });
}

function bootAdminDashboard() {
  try {
    updateLiveClockDisplay();
    setInterval(updateLiveClockDisplay, 30000);
    restoreCustomServiceOptions();
    bindFormsAndControls();
    renderAllSections();
    loadLiveSupabaseData();
    runMilestoneAlertSweep();
  } catch (err) {
    console.warn('Admin dashboard boot issue:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdminDashboard);
} else {
  bootAdminDashboard();
}