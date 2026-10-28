(() => {
  const tokenKey = 'kwms_session_token';
  const userKey = 'kwms_session_user';
  const $ = (selector) => document.querySelector(selector);
  const loginView = $('#login-view');
  const appView = $('#app-view');
  const detailOverlay = $('#detail-overlay');
  const state = { token: sessionStorage.getItem(tokenKey), user: null, employeeAccount: false, employments: [], selected: null, toastTimer: null };

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
    $('#nav-title').textContent = state.employeeAccount ? 'My employment' : 'Staff records';
    $('#page-title').textContent = state.employeeAccount ? 'My employment' : 'Staff records';
    $('#page-description').textContent = state.employeeAccount ? 'Your employment details and important work history.' : 'Search and review employment details within your access.';
    $('#table-title').textContent = state.employeeAccount ? 'My employment records' : 'Employment directory';
    $('#table-description').textContent = state.employeeAccount ? 'Select a record to review your details.' : 'Select a record to see its employment history.';
    $('#search-input').placeholder = state.employeeAccount ? 'Search your employment records…' : 'Search name, number, organization…';
    $('#today-date').textContent = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
    loadEmployments();
    if (state.employeeAccount) loadAttendance();
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
          accuracy: coords.accuracy,
          locationCapturedAt: timestamp,
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
        state.employments = (portal.employments || []).map((employment) => ({
          ...employment,
          person: portal.person,
        }));
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

  function positionFor(employment) {
    const today = new Date().toISOString().slice(0, 10);
    const assignment = employment.positionAssignments?.find((item) => {
      const from = String(item.effectiveFrom || '').slice(0, 10);
      const to = item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : null;
      return from <= today && (!to || to >= today);
    }) || employment.positionAssignments?.[0];
    return assignment?.position || null;
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

  function renderEmploymentDetails(employment, postings, positions, compensation) {
    const name = fullName(employment.person);
    const postingsAllowed = postings !== null;
    const positionsAllowed = positions !== null;
    const compensationAllowed = compensation !== null;
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
    return `<div class="detail-hero"><div class="detail-avatar">${escapeHtml(initials(name))}</div><div><h2 id="detail-name">${escapeHtml(name)}</h2><p>${escapeHtml(employment.employmentNumber)} · ${escapeHtml(employment.organization?.name || 'Organization unavailable')}</p></div><span class="status-pill detail-status ${employment.status === 'ACTIVE' ? '' : 'inactive'}">${escapeHtml(employment.status)}</span></div>
      ${recordSection('Employment details', baseDetails)}
      ${currentPosition ? recordSection('Current position', `<div class="detail-grid">${detailField('Rank / grade', currentPosition.level?.title || currentPosition.title)}${detailField('Position code', currentPosition.code)}${detailField('Framework', currentPosition.framework?.name)}${detailField('Authorized slots', currentPosition.authorizedSlots)}</div>`) : ''}
      ${positionsAllowed ? recordSection('Position history', positionsContent) : ''}
      ${postingsAllowed ? recordSection('Posting history', postingsContent) : ''}
      ${compensationAllowed ? recordSection('Compensation history', compensationContent) : ''}
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
      ]);
      const employment = requests[0].status === 'fulfilled' ? requests[0].value : baseRecord;
      if (requests[0].status === 'rejected' && requests[0].reason.status === 401) return showLogin();
      const postings = requests[1].status === 'fulfilled' ? requests[1].value : (requests[1].reason.status === 403 ? null : []);
      const positions = requests[2].status === 'fulfilled' ? requests[2].value : (requests[2].reason.status === 403 ? null : []);
      const compensation = requests[3].status === 'fulfilled' ? requests[3].value : (requests[3].reason.status === 403 ? null : []);
      if (requests.slice(1).some((request) => request.status === 'rejected' && request.reason.status === 401)) return showLogin();
      const normalize = (value) => Array.isArray(value) ? value : (value?.value || []);
      $('#detail-content').innerHTML = renderEmploymentDetails(employment, postings === null ? null : normalize(postings), positions === null ? null : normalize(positions), compensation === null ? null : normalize(compensation));
      const inviteButton = $('#invite-employee-button');
      if (inviteButton) inviteButton.addEventListener('click', () => issueEmployeeInvite(employment.personId));
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
  $('#refresh-button').addEventListener('click', () => {
    loadEmployments();
    if (state.employeeAccount) loadAttendance();
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
