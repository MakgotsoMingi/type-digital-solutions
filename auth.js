(() => {
  const TEMP_SESSION_KEY = 'tds_temp_session_v1';
  const TEMP_ACCOUNTS_KEY = 'tds_temp_accounts_v1';

  const DEMO_CREDENTIALS = {
    admin_makgotso: {
      role: 'admin',
      name: 'Makgotso Seopa',
      firstName: 'Makgotso',
      initials: 'MS',
      email: 'director@typedigitalsolutions.co.za',
      password: 'TDSDirector2026!',
      company: 'TYPE Digital Solutions',
      redirect: 'admin_dashboard.html'
    },
    client_northstar: {
      role: 'client',
      name: 'Northstar Consulting',
      firstName: 'Northstar',
      initials: 'NC',
      email: 'hello@northstar.example',
      password: 'Northstar2026!',
      company: 'Northstar Consulting',
      redirect: 'client_dashboard.html'
    },
    client_urban_finds: {
      role: 'client',
      name: 'Urban Finds',
      firstName: 'Urban',
      initials: 'UF',
      email: 'hello@urbanfinds.example',
      password: 'UrbanFinds2026!',
      company: 'Urban Finds',
      redirect: 'client_dashboard.html'
    },
    client_glow_studio: {
      role: 'client',
      name: 'Glow Studio',
      firstName: 'Glow',
      initials: 'GS',
      email: 'hello@glowstudio.example',
      password: 'GlowStudio2026!',
      company: 'Glow Studio',
      redirect: 'client_dashboard.html'
    },
    client_neo_architects: {
      role: 'client',
      name: 'Neo Architects',
      firstName: 'Neo',
      initials: 'NA',
      email: 'hello@neoarchitects.example',
      password: 'NeoArch2026!',
      company: 'Neo Architects',
      redirect: 'client_dashboard.html'
    },
    client_partner_5: {
      role: 'client',
      name: 'Client Partner 5',
      firstName: 'Partner',
      initials: 'P5',
      email: 'partner5@tdsclient.example',
      password: 'PartnerFive2026!',
      company: 'Client Partner 5',
      redirect: 'client_dashboard.html'
    },
    client_partner_6: {
      role: 'client',
      name: 'Client Partner 6',
      firstName: 'Partner',
      initials: 'P6',
      email: 'partner6@tdsclient.example',
      password: 'PartnerSix2026!',
      company: 'Client Partner 6',
      redirect: 'client_dashboard.html'
    }
  };

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
      const list = readAccounts().filter(
        (acc) => String(acc.email || '').toLowerCase() !== String(account.email || '').toLowerCase()
      );
      list.unshift(account);
      localStorage.setItem(TEMP_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 25)));
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
    }
  }

  function setActiveAuthTab(mode) {
    const heading = document.getElementById('authHeading');
    const subtext = document.getElementById('authSubtext');
    const feedback = document.getElementById('authFeedback');
    const signInForm = document.getElementById('tempLoginForm');
    const registerForm = document.getElementById('createAccountForm');
    const forgotForm = document.getElementById('forgotAccountForm');

    const tabs = [
      { id: 'tabSignInBtn', key: 'signin' },
      { id: 'tabRegisterBtn', key: 'register' },
      { id: 'tabForgotBtn', key: 'forgot' }
    ];

    tabs.forEach((t) => {
      const btn = document.getElementById(t.id);
      if (btn) {
        btn.classList.toggle('btn-primary', t.key === mode);
      }
    });

    if (signInForm) signInForm.hidden = mode !== 'signin';
    if (registerForm) registerForm.hidden = mode !== 'register';
    if (forgotForm) forgotForm.hidden = mode !== 'forgot';
    if (feedback) feedback.textContent = '';

    if (mode === 'register') {
      if (heading) heading.textContent = 'Create an account';
      if (subtext) subtext.textContent = 'Set up a temporary workspace account for testing before connecting Supabase.';
    } else if (mode === 'forgot') {
      if (heading) heading.textContent = 'Forgot account';
      if (subtext) subtext.textContent = 'Enter your email address to check your account status or request a recovery link.';
    } else {
      if (heading) heading.textContent = 'Sign in to workspace';
      if (subtext) subtext.textContent = 'Sign in with your business or client account credentials to open your dashboard.';
    }
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

    if (!password) {
      if (feedback) feedback.textContent = 'Please enter your password.';
      if (passEl) passEl.focus();
      return;
    }

    const demoByEmail = Object.values(DEMO_CREDENTIALS).find(
      (cred) => cred.email.toLowerCase() === email.toLowerCase()
    );

    if (demoByEmail) {
      if (demoByEmail.password !== password) {
        if (feedback) {
          feedback.textContent = `Incorrect password for ${demoByEmail.company}. Check that account's password and try again.`;
        }
        if (passEl) passEl.focus();
        return;
      }

      const displayName = companyInput || demoByEmail.name;
      const session = {
        role: demoByEmail.role,
        name: displayName,
        firstName: displayName.split(/\s+/)[0] || demoByEmail.firstName,
        initials: buildInitials(displayName),
        email: demoByEmail.email,
        company: demoByEmail.role === 'client' ? displayName : demoByEmail.company,
        redirect: demoByEmail.redirect
      };
      setSession(session);
      window.location.href = session.redirect;
      return;
    }

    const matchedAccount = readAccounts().find(
      (acc) => String(acc.email || '').toLowerCase() === email.toLowerCase()
    );

    if (matchedAccount && matchedAccount.password && matchedAccount.password !== password) {
      if (feedback) feedback.textContent = 'Incorrect password for this account.';
      if (passEl) passEl.focus();
      return;
    }

    const resolvedRole = matchedAccount?.role || selectedRole;
    const displayName =
      matchedAccount?.name ||
      (resolvedRole === 'admin'
        ? companyInput || 'Makgotso Seopa'
        : companyInput || email.split('@')[0] || 'Client Account');

    const session = {
      role: resolvedRole,
      name: displayName,
      firstName: displayName.split(/\s+/)[0] || 'User',
      initials: buildInitials(displayName),
      email,
      company: resolvedRole === 'client' ? displayName : 'TYPE Digital Solutions',
      redirect: resolvedRole === 'admin' ? 'admin_dashboard.html' : 'client_dashboard.html'
    };

    setSession(session);
    window.location.href = session.redirect;
  }

  function bindAuthEvents() {
    document.querySelectorAll('[data-signout]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        window.location.href = 'login.html';
      });
    });

    document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveAuthTab(btn.dataset.authTab || 'signin');
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
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regNameInput')?.value.trim() || '';
        const email = document.getElementById('regEmailInput')?.value.trim() || '';
        const role = document.getElementById('regRoleSelect')?.value === 'admin' ? 'admin' : 'client';
        const password = document.getElementById('regPasswordInput')?.value || '';
        const feedback = document.getElementById('authFeedback');

        if (!name || !email || password.length < 6) {
          if (feedback) feedback.textContent = 'Enter your name, valid email, and a password of at least 6 characters.';
          return;
        }

        const account = {
          name,
          email,
          role,
          password,
          createdAt: new Date().toISOString()
        };
        saveAccount(account);

        const session = {
          role,
          name,
          firstName: name.split(/\s+/)[0] || 'User',
          initials: buildInitials(name),
          email,
          company: role === 'client' ? name : 'TYPE Digital Solutions',
          redirect: role === 'admin' ? 'admin_dashboard.html' : 'client_dashboard.html'
        };

        setSession(session);
        window.location.href = session.redirect;
      });
    }

    const forgotForm = document.getElementById('forgotAccountForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmailInput')?.value.trim() || '';
        const feedback = document.getElementById('authFeedback');
        if (!email) return;

        const demoFound = Object.values(DEMO_CREDENTIALS).find(
          (cred) => cred.email.toLowerCase() === email.toLowerCase()
        );
        const found =
          demoFound ||
          readAccounts().find((acc) => String(acc.email || '').toLowerCase() === email.toLowerCase());

        if (feedback) {
          feedback.textContent = found
            ? `Account found for ${found.email} (${found.role}). Once Supabase Auth is enabled, reset links will be sent automatically.`
            : `No local temp account found for ${email}. You can use "Create account" to register a test account.`;
        }
      });
    }
  }

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