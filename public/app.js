(() => {
  const tokenKey = 'kwms_session_token';
  const userKey = 'kwms_session_user';
  const $ = (selector) => document.querySelector(selector);
  const loginView = $('#login-view');
  const appView = $('#app-view');
  const detailOverlay = $('#detail-overlay');
  const state = { token: sessionStorage.getItem(tokenKey), user: null, employeeAccount: false, employments: [], accounts: [], roles: [], organizations: [], page: 'workforce', selected: null, toastTimer: null, budgetCoachAvailable: false, budgetCoachConsent: false, coachHistory: [], pensionSchemes: [], pensionCases: [], selectedPensionCaseId: null };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const fullName = (person = {}) => [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') || 'Unnamed person';
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
  const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : '—';
  const moneyLabel = (value, currency = 'KES') => `${currency} ${Number(value).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const apiBaseUrl = String(window.KWMS_API_BASE_URL || '').replace(/\/+$/, '');
    const response = await fetch(apiBaseUrl ? `${apiBaseUrl}${path}` : path, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message || payload || `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showLogin() {
    state.token = null;
    state.user = null;
    state.budgetCoachConsent = false;
    state.coachHistory = [];
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(userKey);
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
    closeDetails();
  }

  function showApp(user) {
    if (window.KWMS_IS_MOBILE_APP && !user.employeeAccount) {
      showLogin();
      $('#login-error').textContent = 'The Kenya Workers app is for employee portal accounts.';
      return;
    }
    state.user = user;
    state.employeeAccount = Boolean(user.employeeAccount);
    $('#user-name').textContent = user.fullName || 'User';
    $('#user-email').textContent = user.email || '';
    $('#user-avatar').textContent = initials(user.fullName || user.email || 'User');
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    $('#attendance-card').classList.toggle('hidden', !state.employeeAccount);
    $('#my-pay-card').classList.toggle('hidden', !state.employeeAccount);
    $('#budget-card').classList.toggle('hidden', !state.employeeAccount);
    $('#nav-title').textContent = state.employeeAccount ? 'My employment' : 'Staff records';
    $('#page-title').textContent = state.employeeAccount ? 'My employment' : 'Staff records';
    $('#page-description').textContent = state.employeeAccount ? 'Your employment details and important work history.' : 'Search and review employment details within your access.';
    $('#table-title').textContent = state.employeeAccount ? 'My employment records' : 'Employment directory';
    $('#table-description').textContent = state.employeeAccount ? 'Select a record to review your details.' : 'Select a record to see its employment history.';
    $('#search-input').placeholder = state.employeeAccount ? 'Search your employment records…' : 'Search name, number, organization…';
    $('#today-date').textContent = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
    $('#nav-accounts').classList.toggle('hidden', !user.permissions?.includes('users.read'));
    $('#nav-pensions').classList.toggle('hidden', !user.permissions?.includes('pensions.read'));
    setPage('workforce');
    loadEmployments();
    if (state.employeeAccount) {
      loadAttendance();
      loadBudget();
    }
  }

  function setPage(page) {
    state.page = page;
    const accountsPage = page === 'accounts';
    const pensionsPage = page === 'pensions';
    $('#workforce-heading').classList.toggle('hidden', accountsPage);
    $('#workforce-heading').classList.toggle('hidden', pensionsPage);
    $('#workforce-view').classList.toggle('hidden', accountsPage || pensionsPage);
    $('#accounts-view').classList.toggle('hidden', !accountsPage);
    $('#pensions-view').classList.toggle('hidden', !pensionsPage);
    $('#nav-item').classList.toggle('active', !accountsPage && !pensionsPage);
    $('#nav-pensions').classList.toggle('active', pensionsPage);
    $('#nav-accounts').classList.toggle('active', accountsPage && state.user?.permissions?.includes('users.read'));
    $('#breadcrumb-title').textContent = pensionsPage ? 'Pension cases' : accountsPage
      ? (state.user?.permissions?.includes('users.read') ? 'Account management' : 'My account')
      : (state.employeeAccount ? 'My employment' : 'Staff records');
    $('#accounts-title').textContent = state.user?.permissions?.includes('users.read')
      ? 'Account management'
      : 'My account';
    $('#accounts-view > .page-heading .muted').textContent = state.user?.permissions?.includes('users.read')
      ? 'Manage your profile, staff access, and employee portal accounts.'
      : 'Manage your profile and sign-in security.';
    $('#account-admin').classList.toggle('hidden', !state.user?.permissions?.includes('users.read'));
    $('#create-account-panel').classList.toggle('hidden', !state.user?.permissions?.includes('users.create'));
    $('#my-account-button').textContent = accountsPage ? 'Back to workspace' : 'My account';
    if (accountsPage) {
      loadMyAccount();
      if (state.user?.permissions?.includes('users.read')) loadAccountDirectory();
    }
    if (pensionsPage) loadPensionPage();
  }

  async function loadAttendance() {
    const card = $('#attendance-card');
    if (!card || !state.employeeAccount) return;
    card.classList.remove('hidden');
    const content = $('#attendance-content');
    content.innerHTML = '<p class="muted">Checking today’s attendance…</p>';
    try {
      const today = await api('/attendance/me/today');
      if (today.attendance) {
        content.innerHTML = `<div class="attendance-status"><span class="status-dot"></span><div><strong>Present marked</strong><small>${escapeHtml(new Intl.DateTimeFormat('en-KE', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(today.attendance.checkInAt)))} · ${escapeHtml(today.station?.name || today.attendance.station?.name || 'Assigned station')}</small></div></div><p class="attendance-note">Location checked within the configured station area. GPS accuracy: ${escapeHtml(Math.round(Number(today.attendance.accuracyMeters)))} m.</p>`;
        return;
      }
      if (!today.station?.configured) {
        content.innerHTML = '<p class="attendance-note">Your assigned station does not have a location boundary set up yet. Contact HR.</p>';
        return;
      }
      content.innerHTML = `<p class="attendance-note">Assigned station: <strong>${escapeHtml(today.station.name)}</strong>. Location is checked only when you tap the button.</p><button id="check-in-button" class="primary-button" type="button">Use GPS and mark present</button><p id="attendance-error" class="error-message" role="alert"></p>`;
      $('#check-in-button').addEventListener('click', markPresent);
    } catch (error) {
      if (error.status === 401) return showLogin();
      content.innerHTML = `<p class="attendance-note">${escapeHtml(error.message)}</p>`;
    }
  }

  async function getCurrentLocation() {
    if (typeof window.KWMS_GET_LOCATION === 'function') {
      return window.KWMS_GET_LOCATION();
    }
    if (!navigator.geolocation) throw new Error('This device does not provide location services.');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: Math.ceil(coords.accuracy * 100) / 100,
          locationCapturedAt: timestamp,
          mockLocationDetected: null,
        }),
        (error) => reject(new Error(error.code === 1 ? 'Location permission was denied.' : error.code === 2 ? 'A location could not be found. Turn on location services and try again.' : 'Location request timed out. Try again outdoors.')),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
      );
    });
  }

  async function markPresent() {
    const button = $('#check-in-button');
    const errorNode = $('#attendance-error');
    button.disabled = true;
    button.textContent = 'Getting a fresh GPS reading…';
    errorNode.textContent = '';
    try {
      const location = await getCurrentLocation();
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        throw new Error('Your device could not provide a valid GPS location. Turn on Location and try again outdoors.');
      }
      if (!Number.isFinite(location.accuracyMeters)) {
        throw new Error('Your device did not provide GPS accuracy. Enable Precise location, turn on Location, and try again outdoors.');
      }
      button.textContent = 'Checking station boundary…';
      await api('/attendance/me/check-in', {
        method: 'POST',
        body: JSON.stringify(location),
      });
      toast('You have been marked present.');
      await loadAttendance();
    } catch (error) {
      errorNode.textContent = error.message;
      button.disabled = false;
      button.textContent = 'Try again';
    }
  }

  async function login(event) {
    event.preventDefault();
    const errorNode = $('#login-error');
    const button = $('#login-form button[type="submit"]');
    errorNode.textContent = '';
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: $('#email').value.trim(), password: $('#password').value }),
      });
      state.token = result.accessToken;
      sessionStorage.setItem(tokenKey, state.token);
      const user = await api('/auth/me');
      sessionStorage.setItem(userKey, JSON.stringify(user));
      $('#password').value = '';
      showApp(user);
    } catch (error) {
      errorNode.textContent = error.message;
      state.token = null;
      sessionStorage.removeItem(tokenKey);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
    }
  }

  async function registerEmployee(event) {
    event.preventDefault();
    const errorNode = $('#register-error');
    const button = $('#register-form button[type="submit"]');
    errorNode.textContent = '';
    if ($('#register-password').value !== $('#register-password-confirm').value) {
      errorNode.textContent = 'The passwords do not match.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Creating account…';
    try {
      const result = await api('/auth/employee-accounts/register', {
        method: 'POST',
        body: JSON.stringify({
          activationToken: $('#activation-token').value.trim(),
          email: $('#register-email').value.trim(),
          password: $('#register-password').value,
        }),
      });
      state.token = result.accessToken;
      sessionStorage.setItem(tokenKey, state.token);
      const user = await api('/auth/me');
      sessionStorage.setItem(userKey, JSON.stringify(user));
      $('#register-password').value = '';
      $('#register-password-confirm').value = '';
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      history.replaceState({}, '', url.pathname);
      showApp(user);
      toast('Your employee portal account is ready.');
    } catch (error) {
      errorNode.textContent = error.message;
      state.token = null;
      sessionStorage.removeItem(tokenKey);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Create account <span aria-hidden="true">→</span>';
    }
  }

  async function loadEmployments() {
    const errorNode = $('#load-error');
    errorNode.classList.add('hidden');
    $('#record-count').textContent = 'Loading records…';
    $('#records-body').innerHTML = '';
    $('#empty-state').classList.add('hidden');
    try {
      if (state.employeeAccount) {
        const portal = await api('/auth/me/employee');
        const employee = portal.person || {};
        state.employments = (portal.employments || employee.employments || []).map((employment) => ({
          ...employment,
          person: employee,
        }));
        renderMyPay();
      } else {
        state.employments = await api('/employments');
        if (!Array.isArray(state.employments)) state.employments = state.employments?.value || [];
      }
      renderRecords();
    } catch (error) {
      if (error.status === 401) return showLogin();
      errorNode.textContent = error.message;
      errorNode.classList.remove('hidden');
      $('#record-count').textContent = 'Records could not be loaded';
    }
  }

  async function loadMyAccount() {
    try {
      const profile = await api('/auth/me');
      state.user = profile;
      const nameInput = $('#profile-form [name="fullName"]');
      if (nameInput) nameInput.value = profile.fullName || '';
      $('#account-email').value = profile.email || '';
    } catch (error) {
      if (error.status === 401) return showLogin();
      $('#profile-feedback').textContent = error.message;
    }
  }

  async function loadAccountDirectory() {
    $('#accounts-error').classList.add('hidden');
    $('#account-count').textContent = 'Loading accounts…';
    try {
      const [accounts, roles, organizations] = await Promise.all([
        api('/auth/users'),
        api('/auth/roles'),
        api('/organizations'),
      ]);
      state.accounts = Array.isArray(accounts) ? accounts : (accounts?.value || []);
      state.roles = Array.isArray(roles) ? roles : (roles?.value || []);
      state.organizations = Array.isArray(organizations) ? organizations : (organizations?.value || []);
      renderAccountDirectory();
      populateRoleOptions();
    } catch (error) {
      if (error.status === 401) return showLogin();
      $('#accounts-error').textContent = error.message;
      $('#accounts-error').classList.remove('hidden');
      $('#account-count').textContent = 'Accounts could not be loaded';
    }
  }

  function roleAssignmentsLabel(account) {
    if (account.personId) return 'Employee self-service';
    if (!account.roleAssignments?.length) return 'No roles assigned';
    return account.roleAssignments.map(({ role, organization }) =>
      `${escapeHtml(role?.name || role?.code || 'Role')} · ${escapeHtml(organization?.name || 'All organizations')}`,
    ).join('<br>');
  }

  function renderAccountDirectory() {
    const search = ($('#account-search')?.value || '').trim().toLowerCase();
    const rows = state.accounts.filter((account) => {
      const text = [account.fullName, account.email, account.person?.personNumber,
        ...(account.roleAssignments || []).flatMap(({ role, organization }) => [role?.name, organization?.name])]
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(search);
    });
    $('#account-count').textContent = `${rows.length} of ${state.accounts.length} accounts`;
    $('#accounts-body').innerHTML = rows.map((account) => {
      const employeeLabel = account.person
        ? `${account.person.personNumber || 'Employee'}${account.person.status === 'INACTIVE' ? ' · record inactive' : ''}`
        : 'Staff sign-in';
      const status = account.isActive ? 'Active' : 'Suspended';
      const canManage = state.user?.permissions?.includes('users.manage');
      const self = account.id === state.user?.id;
      const actions = [];
      if (canManage && !self) {
        actions.push(`<button class="secondary-button account-action" type="button" data-action="status" data-id="${escapeHtml(account.id)}" data-active="${account.isActive}">${account.isActive ? 'Suspend' : 'Reactivate'}</button>`);
        if (!account.personId) actions.push(`<button class="secondary-button account-action" type="button" data-action="roles" data-id="${escapeHtml(account.id)}">Manage roles</button>`);
        if (account.activeSessionCount > 0) actions.push(`<button class="secondary-button account-action" type="button" data-action="sessions" data-id="${escapeHtml(account.id)}">End sessions</button>`);
      }
      return `<tr><td><div class="person-cell"><span class="person-initial">${escapeHtml(initials(account.fullName || account.email))}</span><div><div class="person-name">${escapeHtml(account.fullName || 'Unnamed account')}</div><div class="person-sub">${escapeHtml(account.email)} · ${escapeHtml(employeeLabel)}</div></div></div></td><td>${account.personId ? 'Employee portal' : 'Staff access'}</td><td class="account-roles">${roleAssignmentsLabel(account)}</td><td><span class="status-pill ${account.isActive ? '' : 'inactive'}">${status}</span></td><td>${Number(account.activeSessionCount || 0)}</td><td><div class="account-actions">${actions.join('') || '<span class="muted">—</span>'}</div></td></tr>`;
    }).join('');
    $('#accounts-empty').classList.toggle('hidden', rows.length > 0);
  }

  function populateRoleOptions() {
    const roleSelect = $('#create-account-form [name="roleCode"]');
    const organizationSelect = $('#create-account-form [name="organizationId"]');
    if (!roleSelect || !organizationSelect) return;
    roleSelect.innerHTML = `<option value="">Choose a role</option>${state.roles.map((role) => `<option value="${escapeHtml(role.code)}">${escapeHtml(role.name)}</option>`).join('')}`;
    organizationSelect.innerHTML = `<option value="">Choose an organization</option>${state.organizations.map((organization) => `<option value="${escapeHtml(organization.id)}">${escapeHtml(organization.name)}</option>`).join('')}`;
    roleSelect.onchange = () => updateRoleScope(roleSelect, organizationSelect);
  }

  function updateRoleScope(roleSelect, organizationSelect) {
    const isGlobalRole = roleSelect.value === 'SYSTEM_ADMIN';
    organizationSelect.disabled = isGlobalRole;
    organizationSelect.required = !isGlobalRole;
    if (isGlobalRole) organizationSelect.value = '';
    const globalOption = organizationSelect.querySelector('option[value=""]');
    if (globalOption) globalOption.textContent = isGlobalRole ? 'Global access (system administrator)' : 'Choose an organization';
  }

  async function openAccountRoles(id) {
    const account = state.accounts.find((item) => item.id === id);
    if (!account || account.personId) return;
    const roleOptions = state.roles.map((role) => `<option value="${escapeHtml(role.code)}">${escapeHtml(role.name)}</option>`).join('');
    const organizationOptions = `<option value="">Global access (system administrator)</option>${state.organizations.map((organization) => `<option value="${escapeHtml(organization.id)}">${escapeHtml(organization.name)}</option>`).join('')}`;
    const assignments = account.roleAssignments?.length ? account.roleAssignments : [{}];
    const rowHtml = (assignment = {}) => `<div class="account-role-row"><select class="role-code" aria-label="Role" required><option value="">Choose role</option>${roleOptions}</select><select class="role-organization" aria-label="Organization scope">${organizationOptions}</select><button class="secondary-button remove-role-row" type="button" aria-label="Remove role">Remove</button></div>`;
    $('#detail-content').innerHTML = `<div class="detail-hero"><span class="detail-avatar">${escapeHtml(initials(account.fullName || account.email))}</span><div><h2 id="detail-name">Access for ${escapeHtml(account.fullName)}</h2><p>${escapeHtml(account.email)}</p></div></div><section class="detail-section"><h3 class="section-heading">Role assignments</h3><p class="muted account-help">Every role must be tied to an organization. System Administrator is global.</p><form id="account-role-form"><div id="account-role-rows">${assignments.map((assignment) => rowHtml(assignment)).join('')}</div><button id="add-role-row" class="secondary-button" type="button">Add another role</button><button class="primary-button" type="submit">Save access</button><p id="role-feedback" class="form-feedback" role="status"></p></form></section>`;
    const overlay = $('#detail-overlay');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const initializeRow = (row, assignment) => {
      const roleSelect = row.querySelector('.role-code');
      const organizationSelect = row.querySelector('.role-organization');
      roleSelect.value = assignment.role?.code || '';
      organizationSelect.value = assignment.organizationId || '';
      updateRoleScope(roleSelect, organizationSelect);
      roleSelect.addEventListener('change', () => updateRoleScope(roleSelect, organizationSelect));
      row.querySelector('.remove-role-row').addEventListener('click', () => row.remove());
    };
    [...$('#account-role-rows').children].forEach((row, index) => initializeRow(row, assignments[index]));
    $('#add-role-row').addEventListener('click', () => {
      $('#account-role-rows').insertAdjacentHTML('beforeend', rowHtml());
      initializeRow($('#account-role-rows').lastElementChild, {});
    });
    $('#account-role-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      const feedback = $('#role-feedback');
      const roles = [...$('#account-role-rows').querySelectorAll('.account-role-row')].map((row) => {
        const code = row.querySelector('.role-code').value;
        const organizationId = row.querySelector('.role-organization').value;
        return { code, ...(organizationId ? { organizationId } : {}) };
      });
      if (!roles.length) return feedback.textContent = 'Add at least one role assignment.';
      button.disabled = true;
      try {
        await api(`/auth/users/${id}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) });
        toast('Account access updated.');
        closeDetails();
        await loadAccountDirectory();
      } catch (error) {
        feedback.textContent = error.message;
        button.disabled = false;
      }
    });
  }

  async function handleAccountAction(button) {
    const account = state.accounts.find((item) => item.id === button.dataset.id);
    if (!account) return;
    const action = button.dataset.action;
    if (action === 'roles') return openAccountRoles(account.id);
    if (action === 'status') {
      const isActive = button.dataset.active === 'true';
      const actionLabel = isActive ? 'suspend' : 'reactivate';
      if (!window.confirm(`${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${account.fullName}'s account?${isActive ? ' All active sessions will be ended.' : ''}`)) return;
      button.disabled = true;
      try {
        await api(`/auth/users/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
        toast(isActive ? 'Account suspended and sessions ended.' : 'Account reactivated.');
        await loadAccountDirectory();
      } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    if (action === 'sessions') {
      if (!window.confirm(`End all active sessions for ${account.fullName}? They will need to sign in again.`)) return;
      button.disabled = true;
      try {
        const result = await api(`/auth/users/${account.id}/revoke-sessions`, { method: 'POST' });
        toast(`${result.revokedSessionCount} active session(s) ended.`);
        await loadAccountDirectory();
      } catch (error) { toast(error.message, true); button.disabled = false; }
    }
  }

  async function createStaffAccount(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const feedback = $('#create-account-feedback');
    const button = form.querySelector('[type="submit"]');
    const roles = [{ code: data.roleCode, ...(data.organizationId ? { organizationId: data.organizationId } : {}) }];
    button.disabled = true;
    feedback.textContent = '';
    try {
      await api('/auth/users', { method: 'POST', body: JSON.stringify({ email: data.email, fullName: data.fullName, password: data.password, roles }) });
      form.reset();
      updateRoleScope(form.elements.roleCode, form.elements.organizationId);
      toast('Staff account created. Share the initial password through an approved channel; ask the user to change it after signing in.');
      await loadAccountDirectory();
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  }

  function positionFor(employment) {
    const today = new Date().toISOString().slice(0, 10);
    const assignment = employment.positionAssignments?.find((item) => {
      const from = String(item.effectiveFrom || '').slice(0, 10);
      const to = item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : null;
      return from <= today && (!to || to >= today);
    }) || employment.positionAssignments?.[0];
    return assignment?.position || null;
  }

  function dateKeyInKenya() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Nairobi',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function currentDatedRecord(items) {
    const today = dateKeyInKenya();
    return (items || []).filter((item) => {
      const from = String(item.effectiveFrom || '').slice(0, 10);
      const to = item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : null;
      return from <= today && (!to || to >= today);
    }).sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0] || null;
  }

  function renderMyPay() {
    const card = $('#my-pay-card');
    if (!card || !state.employeeAccount) return;
    const current = state.employments
      .filter((employment) => employment.status === 'ACTIVE')
      .map((employment) => ({ employment, assignment: currentDatedRecord(employment.compensationAssignments) }))
      .filter(({ assignment }) => assignment);
    const content = $('#my-pay-content');
    if (!current.length) {
      content.innerHTML = '<div class="pay-empty"><strong>No current compensation record</strong><p>Your assigned pay grade and step will appear here after HR records them.</p></div><p class="pay-disclaimer">This page shows assigned compensation information. A finalized payslip with allowances, deductions, and take-home pay will appear only when payroll data is available.</p>';
    } else {
      content.innerHTML = current.map(({ employment, assignment }) => {
        const step = assignment.compensationStep || {};
        const scale = step.compensationScale || {};
        const rank = step.jobLevel?.title || 'Grade unavailable';
        const amount = moneyLabel(step.basicSalary, scale.currency || 'KES');
        const provisional = Boolean(scale.isProvisional);
        return `<article class="pay-summary"><div class="pay-summary-top"><div><span class="pay-label">${escapeHtml(employment.organization?.name || 'Employment')}</span><h3>${escapeHtml(rank)} <span>· Step ${escapeHtml(step.stepNumber ?? '—')}</span></h3></div><span class="pay-badge ${provisional ? 'provisional' : ''}">${provisional ? 'PROVISIONAL' : 'ASSIGNED'}</span></div><div class="pay-amount-label">Assigned basic pay</div><div class="pay-amount">${escapeHtml(amount)}</div><div class="pay-meta"><span>${escapeHtml(scale.name || 'Compensation scale')}</span><span>Effective ${escapeHtml(dateLabel(assignment.effectiveFrom))}</span></div>${provisional ? '<p class="pay-provisional-note">Assumed scale figure. This is not an approved or payable salary amount.</p>' : ''}</article>`;
      }).join('') + '<p class="pay-disclaimer">This is your assigned basic compensation record, not a payslip. It does not include allowances, deductions, or net pay.</p>';
    }
    content.insertAdjacentHTML('beforeend', '<section class="payslip-list"><div class="pay-heading"><div><p class="eyebrow">PAY HISTORY</p><h3>My payslips</h3></div></div><div id="my-payslips-content"><p class="muted">Loading payslips…</p></div></section>');
    loadMyPayslips();
  }

  async function loadMyPayslips() {
    const target = $('#my-payslips-content');
    if (!target || !state.employeeAccount) return;
    try {
      const slips = await api('/payroll/me/payslips');
      if (!Array.isArray(slips) || !slips.length) {
        target.innerHTML = '<p class="muted">No finalized payslips are available yet.</p>';
        return;
      }
      target.innerHTML = slips.map((slip) => {
        const month = new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(slip.periodYear, slip.periodMonth - 1, 1)));
        const rows = (slip.lines || []).map((line) => `<div class="payslip-line"><span>${escapeHtml(line.title)}${line.balance != null ? `<small>Balance ${escapeHtml(moneyLabel(line.balance, slip.currency))}</small>` : ''}</span><span>${escapeHtml(moneyLabel(line.amount, slip.currency))}</span></div>`).join('');
        return `<details class="payslip-item"><summary><span><strong>${escapeHtml(month)}</strong><small>Issued ${escapeHtml(dateLabel(slip.issuedAt))}</small></span><span class="payslip-net">${escapeHtml(moneyLabel(slip.netPay, slip.currency))}<small>Net pay</small></span></summary><div class="payslip-lines">${slip.isProvisional ? '<p class="pay-provisional-note">DEMO estimate based on a provisional scale. Not approved or payable.</p>' : ''}${rows}<div class="payslip-total"><span>Total earnings</span><strong>${escapeHtml(moneyLabel(slip.earningsTotal, slip.currency))}</strong></div><div class="payslip-total"><span>Total deductions</span><strong>${escapeHtml(moneyLabel(slip.deductionsTotal, slip.currency))}</strong></div><div class="payslip-total net"><span>Net pay</span><strong>${escapeHtml(moneyLabel(slip.netPay, slip.currency))}</strong></div>${slip.correctionReason ? `<p class="muted">Correction: ${escapeHtml(slip.correctionReason)}</p>` : ''}</div></details>`;
      }).join('');
    } catch (error) {
      if (error.status === 401) return showLogin();
      target.innerHTML = `<p class="muted">Payslips could not be loaded: ${escapeHtml(error.message)}</p>`;
    }
  }

  async function loadPensionPage() {
    const error = $('#pension-error');
    error.classList.add('hidden');
    $('#pension-case-count').textContent = 'Loading pension cases…';
    try {
      const [cases, schemes] = await Promise.all([api('/pensions/cases'), api('/pensions/schemes')]);
      state.pensionCases = Array.isArray(cases) ? cases : [];
      state.pensionSchemes = Array.isArray(schemes) ? schemes : [];
      if (state.user?.permissions?.includes('pensions.manage')) {
        const organizations = await api('/organizations');
        state.organizations = Array.isArray(organizations) ? organizations : [];
        $('#pension-scheme-panel').classList.remove('hidden');
        $('#pension-scheme-form [name="organizationId"]').innerHTML = `<option value="">Choose organization</option>${state.organizations.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`;
      } else $('#pension-scheme-panel').classList.add('hidden');
      $('#pension-case-panel').classList.toggle('hidden', !state.user?.permissions?.includes('pensions.create'));
      const employmentRows = state.employments.length ? state.employments : await api('/employments');
      state.employments = Array.isArray(employmentRows) ? employmentRows : [];
      const employmentSelect = $('#pension-case-form [name="employmentId"]');
      employmentSelect.innerHTML = `<option value="">Choose employee</option>${state.employments.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(fullName(item.person))} · ${escapeHtml(item.employmentNumber)} · ${escapeHtml(item.organization?.name || '')}</option>`).join('')}`;
      $('#pension-case-form [name="schemeId"]').innerHTML = `<option value="">Choose scheme</option>${state.pensionSchemes.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`;
      renderPensionCases();
      if (state.selectedPensionCaseId) renderPensionDetail(state.selectedPensionCaseId);
    } catch (failure) {
      if (failure.status === 401) return showLogin();
      error.textContent = failure.message;
      error.classList.remove('hidden');
      $('#pension-case-count').textContent = 'Pension cases could not be loaded';
    }
  }

  function renderPensionCases() {
    $('#pension-case-count').textContent = `${state.pensionCases.length} case${state.pensionCases.length === 1 ? '' : 's'} in your access scope`;
    $('#pension-empty').classList.toggle('hidden', state.pensionCases.length > 0);
    $('#pension-cases-body').innerHTML = state.pensionCases.map((item) => `<tr data-pension-case-id="${escapeHtml(item.id)}" tabindex="0"><td>${escapeHtml(fullName(item.employment.person))}<small class="pension-sub">${escapeHtml(item.employment.employmentNumber)}</small></td><td>${escapeHtml(item.employment.organization.name)}</td><td>${escapeHtml(item.scheme.name)}</td><td>${escapeHtml(dateLabel(item.retirementDate))}</td><td><span class="status-pill">${escapeHtml(item.status.replaceAll('_', ' '))}</span></td><td>${escapeHtml(item.schedule?.status?.replaceAll('_', ' ') || 'Not approved')}</td></tr>`).join('');
  }

  function renderPensionDetail(caseId) {
    const item = state.pensionCases.find((record) => record.id === caseId);
    const panel = $('#pension-detail');
    if (!item) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const permissions = new Set(state.user?.permissions || []);
    const actionButton = (action, label, cls = 'secondary-button') => `<button class="${cls}" type="button" data-pension-action="${action}" data-case-id="${escapeHtml(item.id)}">${label}</button>`;
    const evidence = (item.evidence || []).map((record) => `<div class="pension-evidence-row"><span><strong>${escapeHtml(record.evidenceType.replaceAll('_', ' '))}</strong><small>Reference: ${escapeHtml(record.documentReference)} · ${escapeHtml(record.status)}</small>${record.reviewNotes ? `<small>${escapeHtml(record.reviewNotes)}</small>` : ''}</span>${record.status === 'PENDING' && record.evidenceType !== 'DEATH_CERTIFICATE' && permissions.has('pensions.review') ? `${actionButton(`verify-evidence:${record.id}`, 'Verify')}${actionButton(`reject-evidence:${record.id}`, 'Reject')}` : ''}</div>`).join('') || '<p class="muted">No evidence references recorded.</p>';
    let actions = '';
    if (item.status === 'DRAFT' && permissions.has('pensions.create')) actions += actionButton('submit-case', 'Submit case', 'primary-button');
    if (item.status === 'SUBMITTED' && permissions.has('pensions.review')) actions += actionButton('begin-review', 'Start review', 'primary-button');
    if (item.status === 'UNDER_REVIEW' && permissions.has('pensions.approve')) actions += actionButton('approve-case', 'Approve and schedule', 'primary-button') + actionButton('reject-case', 'Reject case');
    if (item.status === 'APPROVED' && permissions.has('pensions.review')) actions += actionButton('report-death', 'Report pensioner death');
    if (item.status === 'DEATH_REPORTED' && permissions.has('pensions.death.review')) actions += actionButton('verify-death', 'Verify death and stop schedule', 'primary-button') + actionButton('reject-death', 'Reject report and restore schedule');
    const schedule = item.schedule ? `<div class="pension-schedule"><strong>Payment schedule: ${escapeHtml(item.schedule.status.replaceAll('_', ' '))}</strong><span>${escapeHtml(moneyLabel(item.schedule.monthlyAmount, item.schedule.currency))} monthly from ${escapeHtml(dateLabel(item.schedule.effectiveFrom))}${item.schedule.effectiveTo ? ` until ${escapeHtml(dateLabel(item.schedule.effectiveTo))}` : ''}</span><small>This is a recorded schedule only; no funds are transferred by this system.</small></div>` : '<p class="muted">No payment schedule until an authorized officer approves the case.</p>';
    const canAddEvidence = permissions.has('pensions.create') && ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(item.status);
    panel.innerHTML = `<div class="records-heading"><div><p class="eyebrow">CASE DETAILS</p><h2>${escapeHtml(fullName(item.employment.person))} · ${escapeHtml(item.employment.employmentNumber)}</h2><p class="muted">${escapeHtml(item.employment.organization.name)} · ${escapeHtml(item.scheme.name)}</p></div><button id="close-pension-detail" class="secondary-button" type="button">Close</button></div><div class="pension-detail-grid"><div><span>Case status</span><strong>${escapeHtml(item.status.replaceAll('_', ' '))}</strong></div><div><span>Employment status</span><strong>${escapeHtml(item.employment.status.replaceAll('_', ' '))}</strong></div><div><span>Retirement date</span><strong>${escapeHtml(dateLabel(item.retirementDate))}</strong></div><div><span>Survivor claim review</span><strong>${escapeHtml(item.survivorClaimStatus.replaceAll('_', ' '))}</strong></div></div>${schedule}<div class="pension-section"><h3>Supporting evidence</h3><p class="muted">References only. Store documents in your approved secure records system and verify them there.</p>${evidence}${canAddEvidence ? `<form id="pension-evidence-form" class="pension-form compact" data-case-id="${escapeHtml(item.id)}"><label>Evidence type<select name="evidenceType"><option value="RETIREMENT_NOTICE">Retirement notice</option><option value="SERVICE_RECORD">Service record</option><option value="IDENTITY">Identity verification</option><option value="BENEFICIARY_NOMINATION">Beneficiary nomination</option><option value="OTHER">Other scheme evidence</option></select></label><label>Secure document reference<input name="documentReference" maxlength="255" required placeholder="Reference in approved document store" /></label><button class="secondary-button" type="submit">Add evidence reference</button><p class="form-feedback" role="status"></p></form>` : ''}</div>${item.deathReportedAt ? `<div class="pension-alert"><strong>Death report ${item.status === 'DEATH_REPORTED' ? 'awaiting verification' : item.deathReviewedAt ? `reviewed ${escapeHtml(dateLabel(item.deathReviewedAt))}` : ''}</strong><p>Effective date: ${escapeHtml(dateLabel(item.deathEffectiveDate))}. Certificate reference: ${escapeHtml(item.deathCertificateRef)}.</p>${item.deathReviewNotes ? `<p>${escapeHtml(item.deathReviewNotes)}</p>` : ''}</div>` : ''}<div class="pension-actions">${actions}</div><div class="pension-section"><h3>Case history</h3><ul class="pension-events">${(item.events || []).map((event) => `<li><strong>${escapeHtml(event.action.replaceAll('_', ' '))}</strong><span>${escapeHtml(dateLabel(event.createdAt))} · ${escapeHtml(event.actor.fullName)}</span>${event.note ? `<small>${escapeHtml(event.note)}</small>` : ''}</li>`).join('')}</ul></div>`;
  }

  async function refreshSelectedPensionCase(caseId) {
    state.selectedPensionCaseId = caseId;
    await loadPensionPage();
    renderPensionDetail(caseId);
  }

  async function handlePensionAction(button) {
    const caseId = button.dataset.caseId;
    const action = button.dataset.pensionAction;
    try {
      if (action === 'submit-case') await api(`/pensions/cases/${caseId}/submit`, { method: 'POST', body: '{}' });
      if (action === 'begin-review') await api(`/pensions/cases/${caseId}/review`, { method: 'POST', body: JSON.stringify({ notes: 'Review started in pension administration.' }) });
      if (action === 'approve-case') {
        const amount = window.prompt('Enter the approved monthly amount from the official pension decision:');
        if (amount === null) return;
        const reference = window.prompt('Enter the approval or pension authority reference:');
        if (reference === null) return;
        await api(`/pensions/cases/${caseId}/approve`, { method: 'POST', body: JSON.stringify({ approvedMonthlyAmount: Number(amount), approvalReference: reference.trim() }) });
      }
      if (action === 'reject-case') {
        const reason = window.prompt('Reason for rejecting this case:');
        if (reason === null) return;
        await api(`/pensions/cases/${caseId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      }
      if (action.startsWith('verify-evidence:') || action.startsWith('reject-evidence:')) {
        const decision = action.startsWith('verify-') ? 'VERIFIED' : 'REJECTED';
        const evidenceId = action.split(':')[1];
        const notes = window.prompt(`${decision === 'VERIFIED' ? 'Verification' : 'Rejection'} note (confirm you checked the original document in the approved store):`);
        if (notes === null) return;
        await api(`/pensions/cases/${caseId}/evidence/${evidenceId}/review`, { method: 'POST', body: JSON.stringify({ decision, notes }) });
      }
      if (action === 'report-death') {
        const date = window.prompt('Death effective date (YYYY-MM-DD):');
        if (date === null) return;
        const reference = window.prompt('Reference for the death certificate in the approved secure document store:');
        if (reference === null) return;
        await api(`/pensions/cases/${caseId}/death-report`, { method: 'POST', body: JSON.stringify({ deathEffectiveDate: date, deathCertificateReference: reference }) });
      }
      if (action === 'verify-death' || action === 'reject-death') {
        const decision = action === 'verify-death' ? 'VERIFIED' : 'REJECTED';
        const notes = window.prompt(decision === 'VERIFIED' ? 'Record how the death certificate and identity were independently verified:' : 'Reason the death report was rejected:');
        if (notes === null) return;
        if (!window.confirm(decision === 'VERIFIED' ? 'Confirm: this will stop the pensioner’s payment schedule and flag a dependant claim for separate review.' : 'Confirm: this will reject the death report and restore the pension schedule if its effective date has arrived.')) return;
        await api(`/pensions/cases/${caseId}/death-review`, { method: 'POST', body: JSON.stringify({ decision, notes }) });
      }
      toast('Pension case updated.');
      await refreshSelectedPensionCase(caseId);
    } catch (error) { toast(error.message, true); }
  }

  const budgetCategories = [
    ['HOUSING', 'Housing / rent'], ['FOOD', 'Food'], ['UTILITIES', 'Utilities'],
    ['TRANSPORT', 'Transport'], ['FAMILY_SUPPORT', 'Family support'], ['HEALTH', 'Health'],
    ['EDUCATION', 'Education'], ['DEBT', 'Loan / debt payment'], ['SAVINGS', 'Savings'], ['OTHER', 'Other'],
  ];

  function addBudgetItemRow(item = {}) {
    const container = $('#budget-items');
    if (container.querySelector('.budget-empty')) container.replaceChildren();
    const row = document.createElement('div');
    row.className = 'budget-item-row';
    row.innerHTML = `<label>Category<select class="budget-category" required><option value="">Choose category</option>${budgetCategories.map(([code, label]) => `<option value="${code}">${label}</option>`).join('')}</select></label><label>Label<input class="budget-title" type="text" maxlength="120" placeholder="e.g. Bank loan or home rent" required></label><label>Monthly amount (KES)<input class="budget-amount" type="number" min="0" max="100000000" step="0.01" required></label><label class="budget-balance-field">Remaining loan balance (optional)<input class="budget-balance" type="number" min="0" max="1000000000" step="0.01"></label><button class="secondary-button remove-budget-item" type="button" aria-label="Remove budget item">Remove</button>`;
    row.querySelector('.budget-category').value = item.category || '';
    row.querySelector('.budget-title').value = item.title || '';
    row.querySelector('.budget-amount').value = item.monthlyAmount ?? '';
    row.querySelector('.budget-balance').value = item.outstandingBalance ?? '';
    const balanceField = row.querySelector('.budget-balance-field');
    balanceField.classList.toggle('hidden', row.querySelector('.budget-category').value !== 'DEBT');
    row.querySelector('.budget-category').addEventListener('change', (event) => {
      const isDebt = event.currentTarget.value === 'DEBT';
      balanceField.classList.toggle('hidden', !isDebt);
      if (!isDebt) row.querySelector('.budget-balance').value = '';
    });
    row.querySelector('.remove-budget-item').addEventListener('click', () => row.remove());
    $('#budget-items').appendChild(row);
  }

  async function loadBudget() {
    const overview = $('#budget-overview');
    api('/payroll/me/budget-coach/status').then((status) => {
      state.budgetCoachAvailable = Boolean(status.available);
      $('#coach-unavailable').classList.toggle('hidden', state.budgetCoachAvailable);
      $('#coach-consent-panel').classList.toggle('hidden', !state.budgetCoachAvailable || state.budgetCoachConsent);
    }).catch(() => {
      state.budgetCoachAvailable = false;
      $('#coach-unavailable').classList.remove('hidden');
      $('#coach-consent-panel').classList.add('hidden');
    });
    try {
      const budget = await api('/payroll/me/budget');
      const income = budget.income || {};
      const incomeText = income.amount === null ? 'Not entered' : moneyLabel(income.amount, income.currency || 'KES');
      const sourceLabel = income.source === 'PAYSLIP'
        ? `${income.isProvisional ? 'Provisional payslip' : 'Latest finalized payslip'} · ${String(income.periodMonth).padStart(2, '0')}/${income.periodYear}`
        : income.source === 'SELF_REPORTED' ? 'Your self-reported monthly take-home pay' : 'No income amount available yet';
      const analysis = budget.analysis || {};
      const left = analysis.remaining === null ? '—' : moneyLabel(analysis.remaining, income.currency || 'KES');
      const advice = (analysis.advice || []).map((message) => `<li>${escapeHtml(message)}</li>`).join('');
      overview.innerHTML = `<div class="budget-summary-grid"><article><span>Monthly take-home</span><strong>${escapeHtml(incomeText)}</strong><small>${escapeHtml(sourceLabel)}</small></article><article><span>Planned monthly costs</span><strong>${escapeHtml(moneyLabel(analysis.totalOutgoings || 0, income.currency || 'KES'))}</strong><small>Based on the entries below</small></article><article><span>Left after this plan</span><strong class="${analysis.remaining < 0 ? 'budget-negative' : ''}">${escapeHtml(left)}</strong><small>Before any costs you have not entered</small></article></div><div class="budget-advice"><h3>Your budget review</h3><ul>${advice || '<li>Add your monthly costs and loan payments to see a personalized review.</li>'}</ul></div>`;
      $('#budget-form [name="monthlyTakeHome"]').value = budget.manualMonthlyTakeHome ?? '';
      $('#budget-income-source').textContent = income.source === 'PAYSLIP'
        ? 'A latest issued payslip is used when available. This entry is only a fallback if no issued payslip is available.'
        : 'Enter your estimated monthly take-home amount. You can update it anytime.';
      $('#budget-items').replaceChildren();
      if (budget.items?.length) budget.items.forEach((item) => addBudgetItemRow(item));
      else $('#budget-items').innerHTML = '<p class="budget-empty">No monthly costs entered yet. Add rent, food, family obligations, loans, and other costs that apply to you.</p>';
      $('#budget-feedback').textContent = '';
    } catch (error) {
      if (error.status === 401) return showLogin();
      overview.innerHTML = `<p class="inline-error">Your budget could not be loaded: ${escapeHtml(error.message)}</p>`;
    }
  }

  function startBudgetCoach() {
    if (!state.budgetCoachAvailable || !$('#coach-consent').checked) return;
    state.budgetCoachConsent = true;
    $('#coach-consent-panel').classList.add('hidden');
    $('#coach-chat').classList.remove('hidden');
    $('#coach-feedback').textContent = '';
    if (!state.coachHistory.length) {
      state.coachHistory.push({ role: 'assistant', content: 'I can help you understand the figures you entered and compare simple scenarios. What would you like to look at?' });
      renderBudgetCoachMessages();
    }
    $('#coach-question').focus();
  }

  function renderBudgetCoachMessages() {
    const container = $('#coach-messages');
    container.innerHTML = state.coachHistory.map((message) => `<article class="coach-message ${message.role === 'user' ? 'from-user' : 'from-coach'}"><strong>${message.role === 'user' ? 'You' : 'Money coach'}</strong><p>${escapeHtml(message.content).replace(/\n/g, '<br>')}</p></article>`).join('');
    container.scrollTop = container.scrollHeight;
  }

  async function sendBudgetCoachQuestion(event) {
    event.preventDefault();
    if (!state.budgetCoachConsent) return;
    const form = event.currentTarget;
    const question = form.elements.question.value.trim();
    const feedback = $('#coach-feedback');
    const button = $('#coach-send');
    if (!question || question.length > 1000) return;
    const history = state.coachHistory.filter((message) => message.role !== 'assistant' || message.content !== 'I can help you understand the figures you entered and compare simple scenarios. What would you like to look at?').slice(-10);
    state.coachHistory.push({ role: 'user', content: question });
    renderBudgetCoachMessages();
    form.elements.question.value = '';
    button.disabled = true;
    feedback.textContent = 'The coach is preparing a reply…';
    try {
      const result = await api('/payroll/me/budget-coach', {
        method: 'POST',
        body: JSON.stringify({ consent: true, question, history }),
      });
      state.coachHistory.push({ role: 'assistant', content: result.answer });
      feedback.textContent = '';
      renderBudgetCoachMessages();
    } catch (error) {
      state.coachHistory.pop();
      form.elements.question.value = question;
      feedback.textContent = error.message;
      renderBudgetCoachMessages();
    } finally {
      button.disabled = false;
    }
  }

  function endBudgetCoach() {
    state.budgetCoachConsent = false;
    state.coachHistory = [];
    $('#coach-consent').checked = false;
    $('#coach-start').disabled = true;
    $('#coach-chat').classList.add('hidden');
    $('#coach-consent-panel').classList.toggle('hidden', !state.budgetCoachAvailable);
    $('#coach-messages').replaceChildren();
    $('#coach-feedback').textContent = '';
  }

  async function saveBudget(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const feedback = $('#budget-feedback');
    const rows = [...$('#budget-items').querySelectorAll('.budget-item-row')];
    const items = [];
    for (const row of rows) {
      const category = row.querySelector('.budget-category').value;
      const title = row.querySelector('.budget-title').value.trim();
      const monthlyValue = row.querySelector('.budget-amount').value;
      const balanceValue = row.querySelector('.budget-balance').value;
      if (!category && !title && !monthlyValue && !balanceValue) continue;
      if (!category || !title || monthlyValue === '') {
        feedback.textContent = 'Complete the category, label, and monthly amount for each item, or remove the blank row.';
        return;
      }
      items.push({ category, title, monthlyAmount: Number(monthlyValue), ...(balanceValue !== '' ? { outstandingBalance: Number(balanceValue) } : {}) });
    }
    const incomeValue = form.elements.monthlyTakeHome.value;
    button.disabled = true;
    feedback.textContent = 'Saving your private plan…';
    try {
      await api('/payroll/me/budget', {
        method: 'PUT',
        body: JSON.stringify({ monthlyTakeHome: incomeValue === '' ? null : Number(incomeValue), items }),
      });
      await loadBudget();
      feedback.textContent = 'Your private budget plan was saved.';
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  }

  function filteredRecords() {
    const query = $('#search-input').value.trim().toLowerCase();
    return state.employments.filter((employment) => {
      const position = positionFor(employment);
      const fields = [fullName(employment.person), employment.employmentNumber, employment.person?.personNumber, employment.organization?.name, employment.department?.name, employment.station?.name, position?.level?.title, position?.title, employment.status];
      return fields.some((field) => String(field || '').toLowerCase().includes(query));
    });
  }

  function renderRecords() {
    const list = filteredRecords();
    const tbody = $('#records-body');
    tbody.innerHTML = list.map((employment) => {
      const name = fullName(employment.person);
      const position = positionFor(employment);
      const rank = position?.level?.title || position?.title || 'Not assigned';
      const active = employment.status === 'ACTIVE';
      return `<tr data-employment-id="${escapeHtml(employment.id)}" tabindex="0" aria-label="View ${escapeHtml(name)}">
        <td><div class="person-cell"><div class="person-initial">${escapeHtml(initials(name))}</div><div><div class="person-name">${escapeHtml(name)}</div><div class="person-sub">Person ${escapeHtml(employment.person?.personNumber || 'number unavailable')}</div></div></div></td>
        <td><span class="emp-number">${escapeHtml(employment.employmentNumber)}</span></td>
        <td><div class="org-name">${escapeHtml(employment.organization?.name || '—')}</div></td>
        <td><span class="rank-cell">${escapeHtml(rank)}</span></td>
        <td><span class="status-pill ${active ? '' : 'inactive'}">${escapeHtml(employment.status || 'UNKNOWN')}</span></td>
        <td><span class="row-arrow" aria-hidden="true">›</span></td>
      </tr>`;
    }).join('');
    $('#total-count').textContent = state.employments.length.toLocaleString('en-KE');
    $('#active-count').textContent = state.employments.filter((item) => item.status === 'ACTIVE').length.toLocaleString('en-KE');
    $('#organization-count').textContent = new Set(state.employments.map((item) => item.organizationId).filter(Boolean)).size.toLocaleString('en-KE');
    $('#record-count').textContent = `${list.length} ${list.length === 1 ? 'record' : 'records'}`;
    $('#empty-state').classList.toggle('hidden', list.length > 0);
    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => openDetails(row.dataset.employmentId));
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(row.dataset.employmentId); } });
    });
  }

  function recordSection(title, content, extraClass = '') {
    return `<section class="detail-section ${extraClass}"><h3 class="section-heading">${title}</h3>${content}</section>`;
  }

  function detailField(label, value) {
    return `<div class="detail-field"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || '—')}</strong></div>`;
  }

  function renderTimeline(items, renderItem, emptyMessage) {
    if (!items?.length) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
    return `<div class="timeline">${items.map(renderItem).join('')}</div>`;
  }

  function renderEmploymentDetails(employment, postings, positions, compensation, payrollComponents = null, payrollSlips = null) {
    const name = fullName(employment.person);
    const postingsAllowed = postings !== null;
    const positionsAllowed = positions !== null;
    const compensationAllowed = compensation !== null;
    const payrollReadable = payrollComponents !== null;
    const mayManagePayroll = !state.employeeAccount && state.user?.permissions?.includes('payroll.manage');
    const postingRows = postings || [];
    const positionRows = positions || [];
    const compensationRows = compensation || [];
    const currentPosition = positionFor(employment);
    const positionHistory = positionRows.slice().sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
    const compensationHistory = compensationRows.slice().sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
    const baseDetails = `<div class="detail-grid">
      ${detailField('Employment number', employment.employmentNumber)}
      ${detailField('Person number', employment.person?.personNumber)}
      ${detailField('Organization', employment.organization?.name)}
      ${detailField('Department', employment.department?.name)}
      ${detailField('Station', employment.station?.name)}
      ${detailField('Employment type', String(employment.employmentType || '').replaceAll('_', ' '))}
      ${detailField('Start date', dateLabel(employment.startDate))}
      ${detailField('Appointment date', dateLabel(employment.appointmentDate))}
      ${detailField('End date', dateLabel(employment.endDate))}
    </div>`;
    const positionsContent = renderTimeline(positionHistory, (item) => {
      const position = item.position || {};
      const level = position.level?.title || position.title || 'Position';
      const framework = position.framework?.name || '';
      return `<div class="timeline-item"><div class="timeline-date">${dateLabel(item.effectiveFrom)}<br />to ${item.effectiveTo ? dateLabel(item.effectiveTo) : 'Current'}</div><div><div class="timeline-title">${escapeHtml(level)}</div><div class="timeline-sub">${escapeHtml(position.code || '')}${framework ? ` · ${escapeHtml(framework)}` : ''}</div>${item.reason ? `<div class="timeline-reason">${escapeHtml(item.reason)}</div>` : ''}</div></div>`;
    }, 'No position history recorded.');
    const postingsContent = renderTimeline(postingRows.slice().sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)), (item) => {
      const place = [item.organization?.name, item.department?.name, item.station?.name].filter(Boolean).join(' · ');
      return `<div class="timeline-item"><div class="timeline-date">${dateLabel(item.effectiveFrom)}<br />to ${item.effectiveTo ? dateLabel(item.effectiveTo) : 'Current'}</div><div><div class="timeline-title">${escapeHtml(item.organization?.name || 'Posting')}</div><div class="timeline-sub">${escapeHtml(place)}</div>${item.reason ? `<div class="timeline-reason">${escapeHtml(item.reason)}</div>` : ''}</div></div>`;
    }, 'No posting history recorded.');
    const compensationContent = renderTimeline(compensationHistory, (item) => {
      const step = item.compensationStep || {};
      const scale = step.compensationScale || {};
      const currency = scale.currency || 'KES';
      return `<div class="timeline-item"><div class="timeline-date">${dateLabel(item.effectiveFrom)}<br />to ${item.effectiveTo ? dateLabel(item.effectiveTo) : 'Current'}</div><div><div class="timeline-title">${escapeHtml(step.jobLevel?.title || 'Grade unavailable')} · Step ${escapeHtml(step.stepNumber)}</div><div class="timeline-sub">${escapeHtml(scale.name || 'Compensation scale')}</div><div class="timeline-sub">${escapeHtml(moneyLabel(step.basicSalary, currency))}</div>${scale.isProvisional ? '<div class="provisional-note">Provisional assumed figure. Not an approved salary amount.</div>' : ''}${item.reason ? `<div class="timeline-reason">${escapeHtml(item.reason)}</div>` : ''}</div></div>`;
    }, 'No compensation history recorded.');
    const mayInvite = !state.employeeAccount && state.user?.permissions?.includes('employeeAccounts.invite');
    const inviteSection = mayInvite ? recordSection('Employee portal access', `<p class="muted invite-copy">Create a one-time activation link for this employee. Share it with them through an approved channel; it expires after 72 hours.</p><button id="invite-employee-button" class="secondary-button" type="button">Create activation link</button><div id="invite-result" class="invite-result hidden"></div>`) : '';
    const payrollRows = payrollReadable ? renderTimeline((payrollComponents || []).slice().sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)), (item) => `<div class="timeline-item"><div class="timeline-date">${dateLabel(item.effectiveFrom)}<br />to ${item.effectiveTo ? dateLabel(item.effectiveTo) : 'Current'}</div><div><div class="timeline-title">${escapeHtml(item.title)} · ${escapeHtml(item.type)}</div><div class="timeline-sub">${escapeHtml(moneyLabel(item.amount, item.currency))}${item.frequency === 'MONTHLY' ? ' monthly' : ' once'}${item.balance != null ? ` · balance ${escapeHtml(moneyLabel(item.balance, item.currency))}` : ''}</div>${item.note ? `<div class="timeline-reason">${escapeHtml(item.note)}</div>` : ''}${mayManagePayroll && !item.effectiveTo ? `<button class="secondary-button close-pay-component" data-component-id="${escapeHtml(item.id)}" type="button">End this pay item</button>` : ''}</div></div>`, 'No pay components recorded.') : '';
    const payslipHistory = payrollReadable ? (!(payrollSlips || []).length ? '<p class="muted">No payslips have been issued.</p>' : (payrollSlips || []).map((slip) => `<details class="payslip-item"><summary><span><strong>${escapeHtml(new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(slip.periodYear, slip.periodMonth - 1, 1))))} · Version ${escapeHtml(slip.version)}</strong><small>${escapeHtml(slip.status)} · Issued ${escapeHtml(dateLabel(slip.issuedAt))}${slip.isProvisional ? ' · PROVISIONAL' : ''}</small></span><span class="payslip-net">${escapeHtml(moneyLabel(slip.netPay, slip.currency))}<small>Net pay</small></span></summary><div class="payslip-lines">${(slip.lines || []).map((line) => `<div class="payslip-line"><span>${escapeHtml(line.title)}</span><span>${escapeHtml(moneyLabel(line.amount, slip.currency))}</span></div>`).join('')}<div class="payslip-total"><span>Earnings</span><strong>${escapeHtml(moneyLabel(slip.earningsTotal, slip.currency))}</strong></div><div class="payslip-total"><span>Deductions</span><strong>${escapeHtml(moneyLabel(slip.deductionsTotal, slip.currency))}</strong></div>${slip.correctionReason ? `<p class="muted">Correction: ${escapeHtml(slip.correctionReason)}</p>` : ''}</div></details>`).join('')) : '';
    const payrollForm = mayManagePayroll ? `<div class="payroll-admin"><h4>Update a pay item</h4><p class="muted">Updates take effect from the selected date. Previous versions and issued payslips remain in the record.</p><form id="pay-component-form" class="payroll-form"><label>Code<input name="code" required pattern="[A-Z0-9_-]+" maxlength="50" placeholder="e.g. HOUSING_ALLOWANCE"></label><label>Item name<input name="title" required maxlength="255" placeholder="e.g. Housing allowance"></label><label>Type<select name="type"><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select></label><label>Frequency<select name="frequency"><option value="MONTHLY">Monthly</option><option value="ONE_OFF">One time</option></select></label><label>Amount in KES<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Remaining balance (optional)<input name="balance" type="number" min="0" step="0.01"></label><label>Effective from<input name="effectiveFrom" type="date" required value="${dateKeyInKenya()}"></label><label class="wide">Note<input name="note" maxlength="500" placeholder="Optional admin note"></label><button class="secondary-button" type="submit">Save pay item</button></form><h4>Issue monthly payslip</h4><form id="payslip-form" class="payroll-form"><label>Pay period<input name="period" type="month" required value="${dateKeyInKenya().slice(0, 7)}"></label><label class="wide">Correction reason (only when replacing a slip)<input name="correctionReason" maxlength="500" placeholder="Leave blank for the first issue"></label><button class="primary-button" type="submit">Prepare and issue payslip</button></form><h4>Annual step progression</h4><p id="progression-result" class="muted">Review the employee’s anniversary eligibility before applying an increment.</p><button id="progression-preview" class="secondary-button" type="button">Check annual increment</button></div>` : '';
    const payrollSection = payrollReadable ? recordSection('Payroll details', `${payrollRows}<h4>Payslip history</h4>${payslipHistory}${payrollForm}`) : '';
    return `<div class="detail-hero"><div class="detail-avatar">${escapeHtml(initials(name))}</div><div><h2 id="detail-name">${escapeHtml(name)}</h2><p>${escapeHtml(employment.employmentNumber)} · ${escapeHtml(employment.organization?.name || 'Organization unavailable')}</p></div><span class="status-pill detail-status ${employment.status === 'ACTIVE' ? '' : 'inactive'}">${escapeHtml(employment.status)}</span></div>
      ${recordSection('Employment details', baseDetails)}
      ${currentPosition ? recordSection('Current position', `<div class="detail-grid">${detailField('Rank / grade', currentPosition.level?.title || currentPosition.title)}${detailField('Position code', currentPosition.code)}${detailField('Framework', currentPosition.framework?.name)}${detailField('Authorized slots', currentPosition.authorizedSlots)}</div>`) : ''}
      ${positionsAllowed ? recordSection('Position history', positionsContent) : ''}
      ${postingsAllowed ? recordSection('Posting history', postingsContent) : ''}
      ${compensationAllowed ? recordSection('Compensation history', compensationContent) : ''}
      ${payrollSection}
      ${inviteSection}`;
  }

  async function issueEmployeeInvite(personId) {
    const button = $('#invite-employee-button');
    const resultNode = $('#invite-result');
    button.disabled = true;
    button.textContent = 'Creating link…';
    try {
      const invite = await api('/auth/employee-account-invites', {
        method: 'POST',
        body: JSON.stringify({ personId }),
      });
      const link = new URL(window.location.origin);
      link.searchParams.set('invite', invite.activationToken);
      resultNode.innerHTML = `<label class="invite-label" for="activation-link">Activation link · expires ${escapeHtml(dateLabel(invite.expiresAt))}</label><div class="invite-link-row"><input id="activation-link" type="text" readonly value="${escapeHtml(link.toString())}" /><button id="copy-invite-link" class="secondary-button" type="button">Copy link</button></div><p class="invite-warning">This link can be used once. Creating another link invalidates this one.</p>`;
      resultNode.classList.remove('hidden');
      $('#copy-invite-link').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(link.toString());
          toast('Activation link copied. Share it through an approved channel.');
        } catch (_) {
          $('#activation-link').focus();
          $('#activation-link').select();
          toast('Link selected. Copy it and share through an approved channel.');
        }
      });
      button.textContent = 'Create new activation link';
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
      button.textContent = 'Create activation link';
    }
  }

  async function openDetails(id) {
    const baseRecord = state.employments.find((item) => item.id === id);
    detailOverlay.classList.remove('hidden');
    detailOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#detail-content').innerHTML = '<div class="detail-loading">Loading staff record…</div>';
    if (state.employeeAccount && baseRecord) {
      $('#detail-content').innerHTML = renderEmploymentDetails(
        baseRecord,
        baseRecord.postings || [],
        baseRecord.positionAssignments || [],
        baseRecord.compensationAssignments || [],
      );
      return;
    }
    try {
      const requests = await Promise.allSettled([
        api(`/employments/${id}`),
        api(`/employments/${id}/postings`),
        api(`/employments/${id}/positions`),
        api(`/employments/${id}/compensation`),
        api(`/payroll/employments/${id}/components`),
        api(`/payroll/employments/${id}/payslips`),
      ]);
      const employment = requests[0].status === 'fulfilled' ? requests[0].value : baseRecord;
      if (requests[0].status === 'rejected' && requests[0].reason.status === 401) return showLogin();
      const postings = requests[1].status === 'fulfilled' ? requests[1].value : (requests[1].reason.status === 403 ? null : []);
      const positions = requests[2].status === 'fulfilled' ? requests[2].value : (requests[2].reason.status === 403 ? null : []);
      const compensation = requests[3].status === 'fulfilled' ? requests[3].value : (requests[3].reason.status === 403 ? null : []);
      const payrollComponents = requests[4].status === 'fulfilled' ? requests[4].value : (requests[4].reason.status === 403 ? null : []);
      const payrollSlips = requests[5].status === 'fulfilled' ? requests[5].value : (requests[5].reason.status === 403 ? null : []);
      if (requests.slice(1).some((request) => request.status === 'rejected' && request.reason.status === 401)) return showLogin();
      const normalize = (value) => Array.isArray(value) ? value : (value?.value || []);
      $('#detail-content').innerHTML = renderEmploymentDetails(employment, postings === null ? null : normalize(postings), positions === null ? null : normalize(positions), compensation === null ? null : normalize(compensation), payrollComponents === null ? null : normalize(payrollComponents), payrollSlips === null ? null : normalize(payrollSlips));
      const inviteButton = $('#invite-employee-button');
      if (inviteButton) inviteButton.addEventListener('click', () => issueEmployeeInvite(employment.personId));
      const componentForm = $('#pay-component-form');
      if (componentForm) componentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(componentForm);
        const body = Object.fromEntries(data.entries());
        body.amount = Number(body.amount);
        if (body.balance === '') delete body.balance; else body.balance = Number(body.balance);
        try {
          await api(`/payroll/employments/${id}/components`, { method: 'POST', body: JSON.stringify(body) });
          toast('Pay item saved with its effective date.');
          openDetails(id);
        } catch (error) { toast(error.message, true); }
      });
      document.querySelectorAll('.close-pay-component').forEach((button) => button.addEventListener('click', async () => {
        const effectiveTo = dateKeyInKenya();
        if (!window.confirm(`End this pay item effective ${effectiveTo}? Existing payslips will remain unchanged.`)) return;
        button.disabled = true;
        try {
          await api(`/payroll/components/${button.dataset.componentId}/close`, { method: 'PATCH', body: JSON.stringify({ effectiveTo }) });
          toast('Pay item ended.');
          openDetails(id);
        } catch (error) { toast(error.message, true); button.disabled = false; }
      }));
      const payslipForm = $('#payslip-form');
      if (payslipForm) payslipForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(payslipForm);
        const [periodYear, periodMonth] = String(formData.get('period')).split('-').map(Number);
        const correctionReason = String(formData.get('correctionReason') || '').trim();
        try {
          await api(`/payroll/employments/${id}/payslips`, { method: 'POST', body: JSON.stringify({ periodYear, periodMonth, ...(correctionReason ? { correctionReason } : {}) }) });
          toast('Payslip issued and saved as a month-end snapshot.');
          openDetails(id);
        } catch (error) { toast(error.message, true); }
      });
      const progressionButton = $('#progression-preview');
      if (progressionButton) progressionButton.addEventListener('click', async () => {
        const output = $('#progression-result');
        progressionButton.disabled = true;
        try {
          const preview = await api(`/employments/${id}/compensation/progression`);
          output.textContent = preview.eligible
            ? `${preview.rank}: Step ${preview.currentStep} → Step ${preview.nextStep}, effective ${dateLabel(preview.dueDate)}. Basic pay ${moneyLabel(preview.currentBasicSalary)} → ${moneyLabel(preview.nextBasicSalary)}.`
            : preview.atLimit ? `${preview.reason} (${preview.rank}, Step ${preview.currentStep} of ${preview.maxStep}).` : preview.reason;
          if (preview.eligible && state.user?.permissions?.includes('employmentCompensation.assign')) {
            const apply = document.createElement('button');
            apply.className = 'secondary-button';
            apply.type = 'button';
            apply.textContent = 'Apply reviewed increment';
            output.after(apply);
            apply.addEventListener('click', async () => {
              apply.disabled = true;
              try {
                await api(`/employments/${id}/compensation/progression`, { method: 'POST' });
                toast('Annual step increment applied.');
                openDetails(id);
              } catch (error) { toast(error.message, true); apply.disabled = false; }
            }, { once: true });
          }
        } catch (error) { output.textContent = error.message; }
        finally { progressionButton.disabled = false; }
      });
    } catch (error) {
      $('#detail-content').innerHTML = `<div class="inline-error">${escapeHtml(error.message)}</div>`;
    }
  }

  function closeDetails() {
    detailOverlay.classList.add('hidden');
    detailOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function toast(message, isError = false) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.classList.remove('hidden');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.add('hidden'), 3200);
  }

  $('#pension-scheme-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $('#pension-scheme-feedback');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    feedback.textContent = '';
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      body.requiredEvidenceTypes = [...form.elements.requiredEvidenceTypes.selectedOptions].map((option) => option.value);
      await api('/pensions/schemes', { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      toast('Pension scheme saved.');
      await loadPensionPage();
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#pension-case-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $('#pension-case-feedback');
    const button = form.querySelector('[type="submit"]');
    const body = Object.fromEntries(new FormData(form).entries());
    for (const key of ['qualifyingServiceYears', 'proposedMonthlyAmount']) {
      if (body[key] === '') delete body[key];
      else if (body[key] !== undefined) body[key] = Number(body[key]);
    }
    button.disabled = true;
    feedback.textContent = '';
    try {
      const created = await api('/pensions/cases', { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      form.elements.currency.value = 'KES';
      state.selectedPensionCaseId = created.id;
      toast('Draft pension case opened.');
      await loadPensionPage();
      renderPensionDetail(created.id);
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#pension-cases-body').addEventListener('click', (event) => {
    const row = event.target.closest('[data-pension-case-id]');
    if (row) { state.selectedPensionCaseId = row.dataset.pensionCaseId; renderPensionDetail(state.selectedPensionCaseId); }
  });
  $('#pension-cases-body').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const row = event.target.closest('[data-pension-case-id]');
      if (row) { event.preventDefault(); state.selectedPensionCaseId = row.dataset.pensionCaseId; renderPensionDetail(state.selectedPensionCaseId); }
    }
  });
  $('#pension-detail').addEventListener('click', async (event) => {
    if (event.target.id === 'close-pension-detail') {
      state.selectedPensionCaseId = null;
      $('#pension-detail').classList.add('hidden');
      return;
    }
    const action = event.target.closest('[data-pension-action]');
    if (action) await handlePensionAction(action);
  });
  $('#pension-detail').addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id !== 'pension-evidence-form') return;
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    const feedback = form.querySelector('.form-feedback');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api(`/pensions/cases/${form.dataset.caseId}/evidence`, { method: 'POST', body: JSON.stringify(body) });
      await refreshSelectedPensionCase(form.dataset.caseId);
      toast('Evidence reference added.');
    } catch (error) { feedback.textContent = error.message; button.disabled = false; }
  });
  $('#pension-detail').addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id !== 'pension-death-report-form') return;
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    const feedback = form.querySelector('.form-feedback');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api(`/pensions/cases/${form.dataset.caseId}/death-report`, { method: 'POST', body: JSON.stringify(body) });
      await refreshSelectedPensionCase(form.dataset.caseId);
      toast('Schedule suspended pending death verification.');
    } catch (error) { feedback.textContent = error.message; button.disabled = false; }
  });

  $('#login-form').addEventListener('submit', login);
  $('#register-form').addEventListener('submit', registerEmployee);
  $('#show-register').addEventListener('click', () => {
    $('#login-form').classList.add('hidden');
    $('#register-form').classList.remove('hidden');
    $('#register-email').focus();
  });
  $('#show-login').addEventListener('click', () => {
    $('#register-form').classList.add('hidden');
    $('#login-form').classList.remove('hidden');
    $('#email').focus();
  });
  $('#search-input').addEventListener('input', renderRecords);
  $('#nav-item').addEventListener('click', () => setPage('workforce'));
  $('#nav-pensions').addEventListener('click', () => setPage('pensions'));
  $('#nav-accounts').addEventListener('click', () => setPage('accounts'));
  $('#my-account-button').addEventListener('click', () => setPage(state.page === 'accounts' ? 'workforce' : 'accounts'));
  $('#account-search').addEventListener('input', renderAccountDirectory);
  $('#accounts-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button) handleAccountAction(button);
  });
  $('#refresh-accounts').addEventListener('click', loadAccountDirectory);
  $('#create-account-form').addEventListener('submit', createStaffAccount);
  $('#add-budget-item').addEventListener('click', () => addBudgetItemRow());
  $('#budget-form').addEventListener('submit', saveBudget);
  $('#coach-consent').addEventListener('change', (event) => { $('#coach-start').disabled = !event.currentTarget.checked; });
  $('#coach-start').addEventListener('click', startBudgetCoach);
  $('#coach-form').addEventListener('submit', sendBudgetCoachQuestion);
  $('#coach-end').addEventListener('click', endBudgetCoach);
  $('#refresh-pensions').addEventListener('click', loadPensionPage);
  $('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    const feedback = $('#profile-feedback');
    button.disabled = true;
    feedback.textContent = '';
    try {
      const result = await api('/auth/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: event.currentTarget.elements.fullName.value.trim() }),
      });
      state.user.fullName = result.fullName;
      $('#user-name').textContent = result.fullName;
      $('#user-avatar').textContent = initials(result.fullName);
      sessionStorage.setItem(userKey, JSON.stringify(state.user));
      feedback.textContent = 'Profile saved.';
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $('#password-feedback');
    const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.newPassword !== data.confirmPassword) {
      feedback.textContent = 'The new password and confirmation do not match.';
      return;
    }
    button.disabled = true;
    feedback.textContent = '';
    try {
      const result = await api('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      form.reset();
      feedback.textContent = `Password updated. ${result.otherSessionsRevoked} other session(s) ended.`;
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#refresh-button').addEventListener('click', () => {
    if (state.page === 'accounts') {
      loadMyAccount();
      if (state.user?.permissions?.includes('users.read')) loadAccountDirectory();
    } else {
      loadEmployments();
      if (state.employeeAccount) loadAttendance();
    }
  });
  $('#logout-button').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) { /* Clear the browser session even if the server session expired. */ }
    showLogin();
  });
  detailOverlay.querySelectorAll('[data-close-details]').forEach((button) => button.addEventListener('click', closeDetails));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !detailOverlay.classList.contains('hidden')) closeDetails(); });

  const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
  if (inviteFromUrl) {
    $('#login-form').classList.add('hidden');
    $('#register-form').classList.remove('hidden');
    $('#activation-token').value = inviteFromUrl;
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    history.replaceState({}, '', url.pathname);
  }

  if (state.token) {
    api('/auth/me').then((user) => showApp(user)).catch(() => showLogin());
  }
})();
