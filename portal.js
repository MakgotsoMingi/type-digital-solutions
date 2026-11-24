const EMAILJS_PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_EMAILJS_TEMPLATE_ID';
const DIRECTOR_EMAIL = 'director@typedigitalsolutions.co.za';
const STORAGE_KEY = 'tds_portal_state_v1';

if (window.emailjs && EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
  window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const defaultState = {
  clients: [
    {
      id: 'cli_101',
      company: 'Kgotso Logistics (Pty) Ltd',
      email: 'ops@kgotsologistics.co.za',
      project: 'Fleet Dispatch Web Portal',
      amount: 18500,
      status: 'Deposit Paid',
      milestones: [
        {
          id: 'ms_1',
          title: 'Database Schema & Auth Setup',
          dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
          alerted: false
        }
      ]
    }
  ],
  requests: [
    {
      id: 'req_201',
      company: 'Highveld Wellness Studio',
      email: 'bookings@highveldwellness.co.za',
      project: 'Booking Website & Client Intake',
      budget: 12000,
      receivedAt: new Date().toLocaleString('en-ZA')
    }
  ],
  notifications: []
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatZAR(value) {
  return `R ${Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

async function sendAlertEmail({ toEmail, ccEmail, subject, message }) {
  if (!window.emailjs || EMAILJS_PUBLIC_KEY === 'YOUR_EMAILJS_PUBLIC_KEY') {
    return;
  }
  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: toEmail,
    cc_email: ccEmail,
    subject,
    message
  });
}

function pushNotification(text, isAlert = false) {
  state.notifications.unshift({
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    isAlert,
    time: new Date().toLocaleTimeString('en-ZA')
  });
  saveState();
}

function calculateIncome() {
  let paidIncome = 0;
  let pipelineValue = 0;

  for (const client of state.clients) {
    const amt = Number(client.amount) || 0;
    if (client.status === 'Paid') {
      paidIncome += amt;
    } else if (client.status === 'Deposit Paid') {
      paidIncome += amt * 0.5;
      pipelineValue += amt * 0.5;
    } else {
      pipelineValue += amt;
    }
  }

  let dueSoonCount = 0;
  for (const client of state.clients) {
    for (const ms of client.milestones || []) {
      const days = daysUntil(ms.dueDate);
      if (days <= 3) dueSoonCount += 1;
    }
  }

  document.getElementById('paidIncome').textContent = formatZAR(paidIncome);
  document.getElementById('pipelineValue').textContent = formatZAR(pipelineValue);
  document.getElementById('activeClientCount').textContent = String(state.clients.length);
  document.getElementById('dueSoonCount').textContent = String(dueSoonCount);
  document.getElementById('alertCount').textContent = String(
    state.notifications.filter((n) => n.isAlert).length
  );
}

function renderRequests() {
  const container = document.getElementById('requestsFeed');
  if (state.requests.length === 0) {
    container.innerHTML = '<p class="feed-meta">No incoming company requests right now.</p>';
    return;
  }

  container.innerHTML = state.requests
    .map(
      (req) => `
      <div class="feed-item">
        <strong>${req.company}</strong>
        <span>${req.project} — ${formatZAR(req.budget)}</span>
        <span class="feed-meta">${req.email} · ${req.receivedAt}</span>
        <div class="card-actions">
          <button type="button" class="btn-primary" data-accept-req="${req.id}">Convert to Client</button>
          <button type="button" class="btn-secondary" data-dismiss-req="${req.id}">Dismiss</button>
        </div>
      </div>
    `
    )
    .join('');
}

function renderClients() {
  const container = document.getElementById('clientsList');
  const milestoneSelect = document.getElementById('milestoneClient');
  const invoiceSelect = document.getElementById('invoiceClientSelect');

  if (state.clients.length === 0) {
    container.innerHTML = '<p class="feed-meta">No active clients. Add a client or convert a company request.</p>';
    milestoneSelect.innerHTML = '<option value="">No active clients</option>';
    invoiceSelect.innerHTML = '<option value="">No client selected</option>';
    renderInvoice(null);
    return;
  }

  const optionsHtml = state.clients
    .map((c) => `<option value="${c.id}">${c.company} (${c.project})</option>`)
    .join('');

  milestoneSelect.innerHTML = optionsHtml;
  const currentInvoiceId = invoiceSelect.value;
  invoiceSelect.innerHTML = optionsHtml;
  if (currentInvoiceId && state.clients.some((c) => c.id === currentInvoiceId)) {
    invoiceSelect.value = currentInvoiceId;
  }

  container.innerHTML = state.clients
    .map((client) => {
      const msHtml = (client.milestones || [])
        .map((ms) => {
          const days = daysUntil(ms.dueDate);
          const nearClass = days <= 3 ? 'near-due' : '';
          return `
            <div class="milestone-row ${nearClass}">
              <span>${ms.title}</span>
              <span>${ms.dueDate} (${days <= 0 ? 'Due/Overdue' : `${days}d left`})</span>
            </div>
          `;
        })
        .join('');

      return `
        <article class="client-card">
          <div class="client-header">
            <span class="client-title">${client.company}</span>
            <span>${client.project}</span>
            <span class="feed-meta">${client.email} · ${formatZAR(client.amount)} · ${client.status}</span>
          </div>
          <div class="milestone-tag-list">
            ${msHtml || '<span class="feed-meta">No milestones logged yet.</span>'}
          </div>
          <div class="card-actions">
            <button type="button" class="btn-secondary" data-cycle-status="${client.id}">Update Payment</button>
            <button type="button" class="btn-secondary" data-preview-invoice="${client.id}">View Invoice</button>
            <button type="button" class="btn-danger" data-remove-client="${client.id}">Contract Done / Remove</button>
          </div>
        </article>
      `;
    })
    .join('');

  const activeInvoiceClient =
    state.clients.find((c) => c.id === invoiceSelect.value) || state.clients[0];
  renderInvoice(activeInvoiceClient);
}

function renderNotifications() {
  const container = document.getElementById('notificationsLog');
  if (state.notifications.length === 0) {
    container.innerHTML = '<p class="feed-meta">No milestone alerts or live notifications logged yet.</p>';
    return;
  }

  container.innerHTML = state.notifications
    .slice(0, 12)
    .map(
      (n) => `
      <div class="feed-item ${n.isAlert ? 'alert-due' : ''}">
        <span>${n.text}</span>
        <span class="feed-meta">${n.time}</span>
      </div>
    `
    )
    .join('');
}

function buildInvoiceMarkup(client) {
  if (!client) {
    return '<p class="feed-meta">Select a client to generate an invoice.</p>';
  }

  const invoiceNumber = `TDS-${client.id.toUpperCase()}-${new Date().getFullYear()}`;
  const issueDate = new Date().toISOString().slice(0, 10);

  return `
    <div id="printableInvoiceArea">
      <div class="invoice-top">
        <div>
          <h3>TYPE Digital Solutions (Pty) Ltd</h3>
          <p class="feed-meta">Invoice #: ${invoiceNumber}</p>
          <p class="feed-meta">Date: ${issueDate}</p>
        </div>
        <div>
          <strong>Billed To:</strong>
          <p>${client.company}</p>
          <p class="feed-meta">${client.email}</p>
          <p class="feed-meta">Status: ${client.status}</p>
        </div>
      </div>
      <p style="margin-top: 0.85rem;"><strong>Deliverable:</strong> ${client.project}</p>
      <div class="invoice-total-box" style="margin-top: 1rem;">
        <span>Total Amount Due</span>
        <span>${formatZAR(client.amount)}</span>
      </div>
    </div>
  `;
}

function renderInvoice(client) {
  document.getElementById('invoicePreview').innerHTML = buildInvoiceMarkup(client);
}

function downloadInvoiceFile(client) {
  if (!client) return;
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice - ${client.company}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 2rem; color: #111; }
  .box { max-width: 720px; margin: auto; border: 1px solid #ccc; padding: 2rem; border-radius: 8px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 1.5rem; }
  .total { font-size: 1.25rem; font-weight: bold; border-top: 2px solid #111; padding-top: 1rem; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="box">
    <div class="row">
      <div><h2>TYPE Digital Solutions (Pty) Ltd</h2><p>South Africa</p></div>
      <div><strong>Invoice For:</strong><p>${client.company}</p><p>${client.email}</p></div>
    </div>
    <p><strong>Project / Service:</strong> ${client.project}</p>
    <p><strong>Payment Status:</strong> ${client.status}</p>
    <div class="total"><span>Total (ZAR)</span><span>${formatZAR(client.amount)}</span></div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice-${client.company.replace(/\s+/g, '-')}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

async function runMilestoneAlerts() {
  let triggered = 0;

  for (const client of state.clients) {
    for (const ms of client.milestones || []) {
      const days = daysUntil(ms.dueDate);
      if (days <= 3 && !ms.alerted) {
        ms.alerted = true;
        triggered += 1;
        const alertMsg = `Milestone Alert (${days <= 0 ? 'Due Today/Overdue' : `${days} day(s) left`}): "${ms.title}" for ${client.company} (${ms.dueDate}) — notified ${client.email} & ${DIRECTOR_EMAIL}.`;
        pushNotification(alertMsg, true);
        await sendAlertEmail({
          toEmail: client.email,
          ccEmail: DIRECTOR_EMAIL,
          subject: `Milestone Reminder: ${ms.title} (${client.company})`,
          message: alertMsg
        });
      }
    }
  }

  if (triggered === 0) {
    pushNotification('Milestone check complete: no new alerts needed.', false);
  }

  saveState();
  refreshAll();
}

function refreshAll() {
  calculateIncome();
  renderRequests();
  renderClients();
  renderNotifications();
}

document.getElementById('addClientForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const company = document.getElementById('companyName').value.trim();
  const email = document.getElementById('clientEmail').value.trim();
  const project = document.getElementById('projectTitle').value.trim();
  const amount = Number(document.getElementById('contractAmount').value);
  const status = document.getElementById('invoiceStatus').value;

  if (!company || !email || !project) return;

  state.clients.push({
    id: `cli_${Date.now().toString().slice(-4)}`,
    company,
    email,
    project,
    amount,
    status,
    milestones: []
  });

  pushNotification(`Added client "${company}" (${formatZAR(amount)}, ${status}).`, false);
  saveState();
  e.target.reset();
  refreshAll();
});

document.getElementById('milestoneForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const clientId = document.getElementById('milestoneClient').value;
  const title = document.getElementById('milestoneTitle').value.trim();
  const dueDate = document.getElementById('milestoneDueDate').value;
  const client = state.clients.find((c) => c.id === clientId);

  if (!client || !title || !dueDate) return;

  client.milestones.push({
    id: `ms_${Date.now().toString().slice(-5)}`,
    title,
    dueDate,
    alerted: false
  });

  pushNotification(`Logged milestone "${title}" due ${dueDate} for ${client.company}.`, false);
  saveState();
  e.target.reset();
  runMilestoneAlerts();
});

document.getElementById('simulateRequestBtn').addEventListener('click', async () => {
  const sampleCompanies = [
    ['Mpho Retail Group', 'info@mphoretail.co.za', 'Inventory & Ordering Web App', 24000],
    ['Tshwane Events Co', 'hello@tshwaneevents.co.za', 'Event Landing Page & Ticketing Flow', 9500]
  ];
  const pick = sampleCompanies[state.requests.length % sampleCompanies.length];
  const req = {
    id: `req_${Date.now().toString().slice(-4)}`,
    company: pick[0],
    email: pick[1],
    project: pick[2],
    budget: pick[3],
    receivedAt: new Date().toLocaleString('en-ZA')
  };
  state.requests.unshift(req);
  pushNotification(`New company request received from ${req.company} (${req.project}).`, true);

  await sendAlertEmail({
    toEmail: DIRECTOR_EMAIL,
    ccEmail: '',
    subject: `New Company Request: ${req.company}`,
    message: `${req.company} (${req.email}) requested "${req.project}" with budget ${formatZAR(req.budget)}.`
  });

  saveState();
  refreshAll();
});

document.getElementById('checkAlertsBtn').addEventListener('click', runMilestoneAlerts);

document.getElementById('requestsFeed').addEventListener('click', (e) => {
  const acceptId = e.target.dataset.acceptReq;
  const dismissId = e.target.dataset.dismissReq;

  if (acceptId) {
    const req = state.requests.find((r) => r.id === acceptId);
    if (req) {
      state.clients.push({
        id: `cli_${Date.now().toString().slice(-4)}`,
        company: req.company,
        email: req.email,
        project: req.project,
        amount: req.budget,
        status: 'Unpaid',
        milestones: []
      });
      state.requests = state.requests.filter((r) => r.id !== acceptId);
      pushNotification(`Converted request from ${req.company} into an active client.`, false);
      saveState();
      refreshAll();
    }
  }

  if (dismissId) {
    state.requests = state.requests.filter((r) => r.id !== dismissId);
    saveState();
    refreshAll();
  }
});

document.getElementById('clientsList').addEventListener('click', (e) => {
  const statusOrder = ['Unpaid', 'Deposit Paid', 'Paid'];
  const cycleId = e.target.dataset.cycleStatus;
  const previewId = e.target.dataset.previewInvoice;
  const removeId = e.target.dataset.removeClient;

  if (cycleId) {
    const client = state.clients.find((c) => c.id === cycleId);
    if (client) {
      const nextIdx = (statusOrder.indexOf(client.status) + 1) % statusOrder.length;
      client.status = statusOrder[nextIdx];
      pushNotification(`Updated ${client.company} payment status to "${client.status}".`, false);
      saveState();
      refreshAll();
    }
  }

  if (previewId) {
    document.getElementById('invoiceClientSelect').value = previewId;
    const client = state.clients.find((c) => c.id === previewId);
    renderInvoice(client);
  }

  if (removeId) {
    const client = state.clients.find((c) => c.id === removeId);
    state.clients = state.clients.filter((c) => c.id !== removeId);
    if (client) {
      pushNotification(`Contract completed and removed client "${client.company}".`, false);
    }
    saveState();
    refreshAll();
  }
});

document.getElementById('invoiceClientSelect').addEventListener('change', (e) => {
  const client = state.clients.find((c) => c.id === e.target.value);
  renderInvoice(client);
});

document.getElementById('downloadInvoiceBtn').addEventListener('click', () => {
  const id = document.getElementById('invoiceClientSelect').value;
  const client = state.clients.find((c) => c.id === id);
  downloadInvoiceFile(client);
});

document.getElementById('printInvoiceBtn').addEventListener('click', () => {
  window.print();
});

refreshAll();
runMilestoneAlerts();