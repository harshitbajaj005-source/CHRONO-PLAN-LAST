(() => {
  let csrfToken =
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  let currentUser = null;
  let activeDay = 'Mon';
  let allSlots = [];

  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const topbarUser = document.getElementById('topbar-user');
  const userSummary = document.getElementById('user-summary');
  const adminSetupBanner = document.getElementById('admin-setup-banner');
  const adminSetupForm = document.getElementById('admin-setup-form');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginSuccess = document.getElementById('login-success');
  const setupError = document.getElementById('setup-error');

  const generatorPanel = document.getElementById('generator-panel');
  const facultyAssignPanel = document.getElementById('faculty-assign-panel');
  const adminPanel = document.getElementById('admin-panel');
  const conflictsCard = document.getElementById('conflicts-card');

  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.method && options.method !== 'GET') {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (data.csrf_token) {
      csrfToken = data.csrf_token;
    }
    if (!res.ok) {
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }

  function showAuth(needsAdminSetup) {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    topbarUser.classList.add('hidden');

    if (needsAdminSetup) {
      adminSetupBanner.classList.remove('hidden');
      adminSetupForm.classList.remove('hidden');
    } else {
      adminSetupBanner.classList.add('hidden');
      adminSetupForm.classList.add('hidden');
    }
  }

  function showWorkspace(user) {
    currentUser = user;
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    topbarUser.classList.remove('hidden');

    userSummary.textContent = `${user.full_name} (${user.role})`;
    document.getElementById('role-subtitle').textContent =
      user.role === 'admin'
        ? 'Administrator Workspace · Timetable & Accounts'
        : user.role === 'faculty'
        ? `Faculty Schedule · ${user.department || 'Department'}`
        : `Student Schedule · Section ${user.section || 'CSE-4B'}`;
    document.getElementById('welcome-heading').textContent = `Welcome back, ${
      user.full_name.split(' ')[0]
    }!`;

    generatorPanel.classList.toggle('hidden', user.role === 'student');
    facultyAssignPanel.classList.toggle('hidden', user.role === 'student');
    adminPanel.classList.toggle('hidden', user.role !== 'admin');

    loadTimetable();
  }

  function renderDaySlots() {
    const listEl = document.getElementById('timetable-list');
    listEl.innerHTML = '';

    const daySlots = allSlots
      .filter((s) => s.day === activeDay)
      .sort((a, b) => a.slot_index - b.slot_index);

    if (daySlots.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = `No classes scheduled for ${activeDay} yet.`;
      listEl.appendChild(empty);
      return;
    }

    let middayRendered = false;
    let lunchRendered = false;
    daySlots.forEach((slot) => {
      if (activeDay === 'Sat' && !middayRendered && slot.slot_index >= 2) {
        const brk = document.createElement('div');
        brk.className = 'lunch-divider';
        brk.textContent = '12:00 PM – 12:30 PM · 30-Min Midday Break';
        listEl.appendChild(brk);
        middayRendered = true;
      }
      if (activeDay === 'Sat' && !lunchRendered && slot.slot_index >= 3) {
        const lunch = document.createElement('div');
        lunch.className = 'lunch-divider';
        lunch.textContent = '02:00 PM – 02:50 PM · 50-Min Lunch Break Preserved';
        listEl.appendChild(lunch);
        lunchRendered = true;
      }

      const item = document.createElement('div');
      item.className = 'period-item';

      const time = document.createElement('div');
      time.className = 'period-time';
      time.textContent = slot.slot_label.split(' - ')[0];

      const meta = document.createElement('div');
      meta.className = 'period-meta';

      const title = document.createElement('div');
      title.className = 'period-title';
      title.textContent = `${slot.course_code} · ${slot.course_title}`;

      const sub = document.createElement('div');
      sub.className = 'period-sub';
      sub.textContent = `${slot.section_code} · ${slot.room_code} · ${slot.faculty_name}`;

      meta.appendChild(title);
      meta.appendChild(sub);
      item.appendChild(time);
      item.appendChild(meta);
      listEl.appendChild(item);
    });
  }

  async function loadTimetable() {
    try {
      const data = await apiFetch('/api/timetable');
      allSlots = data.slots || [];
      renderDaySlots();
    } catch (err) {
      console.error(err);
    }
  }

  async function bootstrapSession() {
    try {
      const data = await apiFetch('/api/auth/me');
      if (data.authenticated && data.user) {
        showWorkspace(data.user);
      } else {
        showAuth(Boolean(data.needs_admin_setup));
      }
    } catch {
      showAuth(false);
    }
  }

  adminSetupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setupError.classList.add('hidden');
    try {
      const data = await apiFetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({
          username: document.getElementById('setup-username').value,
          full_name: document.getElementById('setup-fullname').value,
          email: document.getElementById('setup-email').value,
          password: document.getElementById('setup-password').value,
        }),
      });
      adminSetupBanner.classList.add('hidden');
      adminSetupForm.classList.add('hidden');
      loginSuccess.textContent = data.message;
      loginSuccess.classList.remove('hidden');
    } catch (err) {
      setupError.textContent = err.message;
      setupError.classList.remove('hidden');
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    loginSuccess.classList.add('hidden');
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: document.getElementById('login-identifier').value,
          password: document.getElementById('login-password').value,
        }),
      });
      loginForm.reset();
      showWorkspace(data.user);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore error on sign out
    }
    currentUser = null;
    allSlots = [];
    bootstrapSession();
  });

  document.getElementById('day-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    activeDay = btn.getAttribute('data-day');
    document.querySelectorAll('.day-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderDaySlots();
  });

  async function runGenerator(mode) {
    const statusEl = document.getElementById('generator-status');
    statusEl.textContent = 'Running M3 clash solver...';
    try {
      const payload =
        mode === 'benchmark'
          ? { mode: 'benchmark', num_students: 1500, num_sections: 120 }
          : { mode: 'database' };
      const data = await apiFetch('/api/timetable/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      statusEl.textContent = `Scheduled ${data.stats.scheduled_sessions} sessions in ${data.stats.generation_ms} ms (${data.stats.unscheduled_count} unscheduled).`;
      conflictsCard.classList.remove('hidden');
      document.getElementById('generation-stats').textContent =
        `${data.stats.generation_ms} ms · ${data.stats.scheduled_sessions} sessions`;
      document.getElementById('algorithm-note').textContent = data.algorithm_notes;

      const unList = document.getElementById('unscheduled-list');
      unList.innerHTML = '';
      if (data.unscheduled.length === 0) {
        const ok = document.createElement('p');
        ok.className = 'success-text';
        ok.textContent = 'All requested courses scheduled with zero student, faculty, or room clashes.';
        unList.appendChild(ok);
      } else {
        data.unscheduled.slice(0, 20).forEach((item) => {
          const row = document.createElement('div');
          row.className = 'period-item';
          row.textContent = `${item.section_code} · ${item.course_code}: ${item.reason}`;
          unList.appendChild(row);
        });
      }

      if (mode === 'database') {
        await loadTimetable();
      }
    } catch (err) {
      statusEl.textContent = err.message;
    }
  }

  document.getElementById('generate-db-btn').addEventListener('click', () => runGenerator('database'));
  document.getElementById('generate-bench-btn').addEventListener('click', () => runGenerator('benchmark'));

  document.getElementById('faculty-assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('assign-feedback');
    fb.textContent = '';
    try {
      const data = await apiFetch('/api/faculty/assign-subject', {
        method: 'POST',
        body: JSON.stringify({
          course_code: document.getElementById('assign-code').value,
          title: document.getElementById('assign-title').value,
          section_code: document.getElementById('assign-section').value,
          room_code: document.getElementById('assign-room').value,
          day: document.getElementById('assign-day').value,
          slot_index: Number(document.getElementById('assign-slot').value),
        }),
      });
      fb.textContent = data.message;
      await loadTimetable();
    } catch (err) {
      fb.textContent = err.message;
    }
  });

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('upload-feedback');
    const fileInput = document.getElementById('upload-file');
    if (!fileInput.files.length) return;
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
      const data = await apiFetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      fb.textContent = `${data.message} Rooms: ${data.imported.rooms}, Courses: ${data.imported.courses}, Sections: ${data.imported.sections}`;
    } catch (err) {
      fb.textContent = err.message;
    }
  });

  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('create-user-feedback');
    const role = document.getElementById('new-role').value;
    const deptOrSec = document.getElementById('new-dept').value;
    try {
      const data = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          role,
          username: document.getElementById('new-username').value,
          full_name: document.getElementById('new-fullname').value,
          email: document.getElementById('new-email').value,
          department: role === 'faculty' ? deptOrSec : '',
          section: role === 'student' ? deptOrSec : '',
          password: document.getElementById('new-password').value,
        }),
      });
      fb.textContent = data.message;
      e.target.reset();
    } catch (err) {
      fb.textContent = err.message;
    }
  });

  const assignDaySelect = document.getElementById('assign-day');
  const assignSlotSelect = document.getElementById('assign-slot');

  function syncAssignSlotOptions() {
    if (!assignDaySelect || !assignSlotSelect) return;
    const isSat = assignDaySelect.value === 'Sat';
    const slots = isSat
      ? [
          ['0', '09:00 AM - 10:30 AM (Sat)'],
          ['1', '10:45 AM - 12:00 PM (Sat)'],
          ['2', '12:30 PM - 02:00 PM (Sat)'],
          ['3', '02:50 PM - 03:40 PM (Sat)'],
          ['4', '04:00 PM - 04:50 PM (Sat)'],
        ]
      : [['5', '04:30 PM - 06:00 PM (Mon–Fri)']];
    assignSlotSelect.innerHTML = '';
    slots.forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      assignSlotSelect.appendChild(opt);
    });
  }

  if (assignDaySelect) {
    assignDaySelect.addEventListener('change', syncAssignSlotOptions);
    syncAssignSlotOptions();
  }

  bootstrapSession();
})();
