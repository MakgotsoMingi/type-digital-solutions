(() => {
  const SHARED_BRIDGE_KEY = 'tds_shared_work_requests_v1';
  const ADMIN_STORAGE_KEY = 'tds_admin_dashboard_state_v6';
  const SEED_KEY = 'tds_demo_seeded_v1';

  const DEFAULT_DEMO_REQUESTS = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      company: 'Northstar Consulting',
      email: 'hello@northstar.example',
      project: 'Client Portal',
      budget: 18000,
      priority: 'High',
      notes: 'Client portal for milestone tracking and document sharing.',
      receivedAt: '2026-11-20 · 09:30'
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      company: 'Urban Finds',
      email: 'hello@urbanfinds.example',
      project: 'E-commerce',
      budget: 16500,
      priority: 'High',
      notes: 'Online store refresh with mobile product grid and checkout.',
      receivedAt: '2026-11-21 · 14:15'
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      company: 'Glow Studio',
      email: 'hello@glowstudio.example',
      project: 'Website Development',
      budget: 8500,
      priority: 'Normal',
      notes: 'Service showcase site with enquiry flow.',
      receivedAt: '2026-11-22 · 11:05'
    },
    {
      id: '11111111-1111-4111-8111-111111111104',
      company: 'Neo Architects',
      email: 'hello@neoarchitects.example',
      project: 'Custom Solution',
      budget: 14000,
      priority: 'Normal',
      notes: 'Custom project archive and client intake workflow.',
      receivedAt: '2026-11-23 · 16:40'
    },
    {
      id: '11111111-1111-4111-8111-111111111105',
      company: 'Client Partner 5',
      email: 'partner5@tdsclient.example',
      project: 'Website Development',
      budget: 9500,
      priority: 'Normal',
      notes: 'Landing page build and contact workflow.',
      receivedAt: '2026-11-24 · 08:20'
    },
    {
      id: '11111111-1111-4111-8111-111111111106',
      company: 'Client Partner 6',
      email: 'partner6@tdsclient.example',
      project: 'Other',
      budget: 7500,
      priority: 'Normal',
      notes: 'Digital intake setup and support portal.',
      receivedAt: '2026-11-24 · 10:15'
    }
  ];

  const BASE_PRICES = {
    'Website Development': 8500,
    'E-commerce': 16500,
    'Client Portal': 18000,
    'Custom Solution': 14000,
    'Other': 7500
  };

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

  function formatZar(amount) {
    return `R${Number(amount || 0).toLocaleString('en-ZA')}`;
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
    return `${datePart} · ${timePart}`;
  }

  function ensureSeededSharedRequests() {
    try {
      if (localStorage.getItem(SEED_KEY) === 'true') return;
      const raw = localStorage.getItem(SHARED_BRIDGE_KEY);
      const current = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(current) || current.length === 0) {
        localStorage.setItem(SHARED_BRIDGE_KEY, JSON.stringify(DEFAULT_DEMO_REQUESTS));
      }
      localStorage.setItem(SEED_KEY, 'true');
    } catch {}
  }

  function publishInquiryToAdmin(payload) {
    try {
      const existingBridge = JSON.parse(localStorage.getItem(SHARED_BRIDGE_KEY) || '[]');
      const list = Array.isArray(existingBridge) ? existingBridge : [];
      if (!list.some((item) => String(item.id) === String(payload.id))) {
        list.unshift(payload);
        localStorage.setItem(SHARED_BRIDGE_KEY, JSON.stringify(list.slice(0, 30)));
      }
    } catch {}

    try {
      const rawAdmin = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (rawAdmin) {
        const parsedAdmin = JSON.parse(rawAdmin);
        if (parsedAdmin && typeof parsedAdmin === 'object') {
          parsedAdmin.requests = Array.isArray(parsedAdmin.requests) ? parsedAdmin.requests : [];
          if (!parsedAdmin.requests.some((r) => String(r.id) === String(payload.id))) {
            parsedAdmin.requests.unshift(payload);
          }
          parsedAdmin.activities = Array.isArray(parsedAdmin.activities) ? parsedAdmin.activities : [];
          parsedAdmin.activities.unshift({
            id: generateUuid(),
            text: `Website inquiry from <strong>${escapeHtml(payload.company)}</strong> (${escapeHtml(payload.project)} · ${formatZar(payload.budget)}).`,
            time: payload.receivedAt
          });
          parsedAdmin.activities = parsedAdmin.activities.slice(0, 15);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(parsedAdmin));
        }
      }
    } catch {}
  }

  ensureSeededSharedRequests();

  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('open', !expanded);
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menuToggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('open');
      });
    });
  }

  const serviceSelect = document.getElementById('service');
  const budgetInput = document.getElementById('budget');
  const supportForm = document.getElementById('supportForm');
  const formStatus = document.getElementById('formStatus');
  let resetEstimatorLabel = () => {};

  if (supportForm && serviceSelect && budgetInput) {
    const estimatorBox = document.createElement('div');
    estimatorBox.id = 'quoteEstimator';
    estimatorBox.style.cssText =
      'background:#090c0b;border:1px solid rgba(156,175,136,0.22);border-radius:12px;padding:16px;display:grid;gap:12px;';

    estimatorBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CAF88;">Quick Scope Estimate</span>
        <strong id="estimatedTotalLabel" style="font-size:18px;color:#f3f6f4;">Select a service</strong>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;font-size:13px;color:#93a19a;">
        <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;">
          <input type="checkbox" class="scope-addon" data-cost="3500" data-label="Admin / CMS Panel">
          <span>Admin Panel (+R3,500)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;">
          <input type="checkbox" class="scope-addon" data-cost="2500" data-label="SEO & Analytics">
          <span>SEO &amp; Analytics (+R2,500)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;">
          <input type="checkbox" class="scope-addon" data-cost="4000" data-label="Priority 1-Week Turnaround">
          <span>Fast Track (+R4,000)</span>
        </label>
      </div>
      <button type="button" class="btn-outline" id="applyEstimateBtn" style="justify-self:start;">Apply Estimate to Budget</button>
    `;

    serviceSelect.insertAdjacentElement('afterend', estimatorBox);

    const estimatedTotalLabel = document.getElementById('estimatedTotalLabel');
    const applyEstimateBtn = document.getElementById('applyEstimateBtn');

    function calculateEstimate() {
      const base = BASE_PRICES[serviceSelect.value] || 0;
      let addonsTotal = 0;
      const selectedAddons = [];

      estimatorBox.querySelectorAll('.scope-addon:checked').forEach((cb) => {
        addonsTotal += Number(cb.dataset.cost || 0);
        if (cb.dataset.label) selectedAddons.push(cb.dataset.label);
      });

      const total = base + addonsTotal;
      if (estimatedTotalLabel) {
        estimatedTotalLabel.textContent = total > 0 ? `${formatZar(total)} est.` : 'Select a service';
      }
      return { total, selectedAddons };
    }

    resetEstimatorLabel = () => {
      if (estimatedTotalLabel) {
        estimatedTotalLabel.textContent = 'Select a service';
      }
    };

    serviceSelect.addEventListener('change', calculateEstimate);
    estimatorBox.querySelectorAll('.scope-addon').forEach((cb) => {
      cb.addEventListener('change', calculateEstimate);
    });

    if (applyEstimateBtn) {
      applyEstimateBtn.addEventListener('click', () => {
        const { total, selectedAddons } = calculateEstimate();
        if (total > 0) {
          budgetInput.value = String(total);
          const msgEl = document.getElementById('message');
          if (msgEl) {
            const cleaned = msgEl.value.replace(/\n*Add-ons:.*$/m, '').trim();
            if (selectedAddons.length > 0) {
              const addonLine = `Add-ons: ${selectedAddons.join(', ')}.`;
              msgEl.value = cleaned ? `${cleaned}\n\n${addonLine}` : addonLine;
            } else {
              msgEl.value = cleaned;
            }
          }
        }
      });
    }

    document.querySelectorAll('.prj-card .card-link').forEach((link) => {
      link.addEventListener('click', () => {
        const cardTitle = link.closest('.prj-card')?.querySelector('h3')?.textContent.trim() || '';
        const matchingOption = Array.from(serviceSelect.options).find(
          (opt) => opt.value.toLowerCase() === cardTitle.toLowerCase()
        );
        if (matchingOption) {
          serviceSelect.value = matchingOption.value;
          calculateEstimate();
        }
      });
    });
  }

  if (supportForm) {
    supportForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const company = document.getElementById('name')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim() || '';
      const service = document.getElementById('service')?.value || 'Custom Solution';
      const budget = sanitizeAmount(document.getElementById('budget')?.value);
      const notes = document.getElementById('message')?.value.trim() || '';
      const consentCheckbox = document.getElementById('popiaConsent');
      const consented = Boolean(consentCheckbox?.checked);

      if (!company || !email || !notes || !consented) {
        if (formStatus) {
          formStatus.textContent = 'Please complete all required fields and accept the POPIA consent box.';
        }
        if (!consented && consentCheckbox) {
          consentCheckbox.focus();
        }
        return;
      }

      const entry = {
        id: generateUuid(),
        company,
        email,
        project: service,
        budget,
        priority: budget >= 15000 ? 'High' : 'Normal',
        notes,
        receivedAt: getSASTStamp()
      };

      publishInquiryToAdmin(entry);

      if (formStatus) {
        formStatus.textContent = `Thank you, ${company}. Your enquiry${budget > 0 ? ` (${formatZar(budget)})` : ''} has been logged for TYPE Digital Solutions.`;
      }

      supportForm.reset();
      resetEstimatorLabel();
    });
  }
})();