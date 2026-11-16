// Client logic for Superadmin Control Panel

const API_BASE = window.location.origin;
let authToken = localStorage.getItem('mana_superadmin_token') || '';
let currentUsers = [];
let currentRoles = [];
let activeUserIdForPwd = null;

// Helpers
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };
}

function formatJalaliTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

// -------------------------------------------------------------
// Authentication & Initialization
// -------------------------------------------------------------
async function init() {
  if (authToken) {
    const valid = await checkAuth();
    if (valid) {
      showDashboard();
      return;
    }
  }
  showLogin();
}

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/status`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      renderMetrics(data);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function showLogin() {
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('dashboard-container').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('dashboard-container').classList.remove('hidden');
  loadDashboardData();
}

// -------------------------------------------------------------
// Dashboard Data Fetchers
// -------------------------------------------------------------
async function loadDashboardData() {
  await Promise.all([
    fetchStatus(),
    fetchUsers(),
    fetchLogs(),
    fetchRoles()
  ]);
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/status`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      renderMetrics(data);
    }
  } catch (e) {
    console.warn('Error fetching status:', e);
  }
}

function renderMetrics(data) {
  document.getElementById('metric-uptime').textContent = data.serverUptime || 'آنلاین';
  document.getElementById('metric-memory').textContent = `${data.memory?.percent || 0}٪`;
  document.getElementById('metric-memory-detail').textContent = `${data.memory?.usedMb || 0} / ${data.memory?.totalMb || 0} مگابایت`;
  document.getElementById('metric-users').textContent = data.counts?.users || 0;
  document.getElementById('metric-users-detail').textContent = `${data.counts?.restrictedUsers || 0} کاربر مسدود`;
  document.getElementById('metric-push').textContent = data.counts?.pushSubscriptions || 0;
}

// -------------------------------------------------------------
// Users Management
// -------------------------------------------------------------
async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/users`, { headers: authHeaders() });
    if (res.ok) {
      currentUsers = await res.json();
      renderUsersTable();
    }
  } catch (e) {
    console.warn('Error fetching users:', e);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (currentUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">هیچ کاربری تعریف نشده است.</td></tr>';
    return;
  }

  tbody.innerHTML = currentUsers.map(u => {
    const roleName = currentRoles.find(r => r.id === u.roleId)?.name || u.roleId || 'پرسنل';
    const isBlocked = u.isRestricted;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <img src="${u.avatar || './icons/company_logo.png'}" class="w-7 h-7 rounded-full object-cover border border-slate-700" />
            <div>
              <span class="font-bold text-white block">${u.name}</span>
              <span class="text-[10px] text-slate-500 font-mono">${u.initials || ''}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 font-mono text-slate-300">${u.email}</td>
        <td class="py-3 px-4 text-slate-400">${u.department || '—'}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
            ${roleName}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          ${isBlocked ? `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
              مسدود شده
            </span>
          ` : `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              فعال و مجاز
            </span>
          `}
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5 flex-wrap">
            <button class="btn-toggle-restrict px-2 py-1 rounded-lg text-[11px] font-bold transition ${isBlocked ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-800' : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-800'}" data-id="${u.id}" data-restricted="${isBlocked ? 'true' : 'false'}">
              ${isBlocked ? 'رفع مسدودیت' : 'محدودسازی'}
            </button>
            <button class="btn-open-pwd px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700" data-id="${u.id}" data-name="${u.name}">
              تغییر رمز
            </button>
            <button class="btn-del-user p-1 text-slate-500 hover:text-rose-400 rounded-lg transition" data-id="${u.id}" data-name="${u.name}" title="حذف کاربر">
              حذف
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindUserRowActions();
}

function bindUserRowActions() {
  document.querySelectorAll('.btn-toggle-restrict').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const wasRestricted = btn.getAttribute('data-restricted') === 'true';
      const actionTitle = wasRestricted ? 'رفع مسدودیت' : 'مسدودسازی';

      if (confirm(`آیا از ${actionTitle} این کاربر اطمینان دارید؟`)) {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}/restrict`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ isRestricted: !wasRestricted })
        });
        if (res.ok) {
          fetchUsers();
          fetchStatus();
        } else {
          alert('خطا در اعمال تغییرات');
        }
      }
    });
  });

  document.querySelectorAll('.btn-open-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      activeUserIdForPwd = btn.getAttribute('data-id');
      const userName = btn.getAttribute('data-name');
      document.getElementById('reset-pwd-target-user').textContent = `کاربر: ${userName}`;
      document.getElementById('reset-pwd-new-val').value = '';
      document.getElementById('modal-reset-user-pwd').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.btn-del-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`آیا از حذف کامل «${name}» از سرور اطمینان دارید؟`)) {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        if (res.ok) {
          fetchUsers();
          fetchStatus();
        } else {
          const err = await res.json();
          alert(err.error || 'خطا در حذف کاربر');
        }
      }
    });
  });
}

// -------------------------------------------------------------
// Login Audit Logs
// -------------------------------------------------------------
async function fetchLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/logs?limit=150`, { headers: authHeaders() });
    if (res.ok) {
      const logs = await res.json();
      renderLogsTable(logs);
    }
  } catch (e) {
    console.warn('Error fetching logs:', e);
  }
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">هیچ لاگی ثبت نشده است.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">موفق</span>';
    if (l.status === 'FAILED') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">ناموفق</span>';
    } else if (l.status === 'BLOCKED') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">مسدود</span>';
    }

    return `
      <tr class="hover:bg-slate-800/40 text-[11px] transition">
        <td class="py-2.5 px-4 text-slate-400 font-sans">${formatJalaliTime(l.timestamp)}</td>
        <td class="py-2.5 px-4 font-bold text-white">${l.email || '—'}</td>
        <td class="py-2.5 px-4 text-slate-300">${l.ip || '—'}</td>
        <td class="py-2.5 px-4">
          <span class="text-[10px] ${l.type === 'SUPERADMIN' ? 'text-amber-400 font-bold' : 'text-slate-400'}">
            ${l.type === 'SUPERADMIN' ? 'مدیر ارشد' : 'کاربر عادی'}
          </span>
        </td>
        <td class="py-2.5 px-4 text-center">${statusBadge}</td>
        <td class="py-2.5 px-4 text-slate-400 truncate max-w-[200px]" title="${l.userAgent}">${l.userAgent || '—'}</td>
        <td class="py-2.5 px-4 text-slate-400 font-sans">${l.message || '—'}</td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Roles
// -------------------------------------------------------------
async function fetchRoles() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/roles`, { headers: authHeaders() });
    if (res.ok) {
      currentRoles = await res.json();
      renderRolesGrid();
      populateRoleSelect();
    }
  } catch (e) {
    console.warn('Error fetching roles:', e);
  }
}

function renderRolesGrid() {
  const grid = document.getElementById('roles-grid');
  if (!grid) return;

  grid.innerHTML = currentRoles.map(r => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-sm text-white">${r.name}</h4>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">${r.id}</span>
      </div>
      <p class="text-xs text-slate-400">${r.description || 'بدون توضیحات'}</p>
      <div class="pt-2 border-t border-slate-800 flex flex-wrap gap-1">
        ${(r.permissions || []).map(p => `
          <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">${p}</span>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function populateRoleSelect() {
  const sel = document.getElementById('new-user-role');
  if (!sel) return;
  sel.innerHTML = currentRoles.map(r => `
    <option value="${r.id}">${r.name}</option>
  `).join('');
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Superadmin Login Form
  document.getElementById('superadmin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const alertEl = document.getElementById('login-error-alert');
    alertEl.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        alertEl.textContent = data.error || 'خطا در ورود';
        alertEl.classList.remove('hidden');
        return;
      }

      authToken = data.token;
      localStorage.setItem('mana_superadmin_token', authToken);
      showDashboard();
    } catch (err) {
      alertEl.textContent = 'خطا در ارتباط با سرور لینوکس: ' + err.message;
      alertEl.classList.remove('hidden');
    }
  });

  // Logout
  document.getElementById('btn-superadmin-logout')?.addEventListener('click', () => {
    localStorage.removeItem('mana_superadmin_token');
    authToken = '';
    showLogin();
  });

  // Tab switching
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-blue-600', 'text-white', 'shadow');
      btn.classList.remove('text-slate-400');

      const tab = btn.getAttribute('data-tab');
      ['users', 'logs', 'roles', 'system'].forEach(t => {
        const sec = document.getElementById(`tab-sec-${t}`);
        if (sec) sec.classList.toggle('hidden', t !== tab);
      });
    });
  });

  // Add User Box Toggle
  document.getElementById('btn-show-add-user')?.addEventListener('click', () => {
    document.getElementById('box-add-user').classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-add-user')?.addEventListener('click', () => {
    document.getElementById('box-add-user').classList.add('hidden');
  });

  // Create User Form Submit
  document.getElementById('form-create-user')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-pwd').value.trim();
    const department = document.getElementById('new-user-dept').value.trim();
    const roleId = document.getElementById('new-user-role').value;

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email, password, department, roleId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'خطا در ثبت کاربر');
        return;
      }
      document.getElementById('box-add-user').classList.add('hidden');
      document.getElementById('form-create-user').reset();
      fetchUsers();
      fetchStatus();
      alert(`کاربر ${name} با موفقیت افزوده شد.`);
    } catch (err) {
      alert('خطا در ارسال اطلاعات: ' + err.message);
    }
  });

  // Reset User Password Modal
  document.getElementById('btn-cancel-reset-pwd')?.addEventListener('click', () => {
    document.getElementById('modal-reset-user-pwd').classList.add('hidden');
    activeUserIdForPwd = null;
  });

  document.getElementById('btn-submit-reset-pwd')?.addEventListener('click', async () => {
    const newPassword = document.getElementById('reset-pwd-new-val').value.trim();
    if (!newPassword || newPassword.length < 6) {
      alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (!activeUserIdForPwd) return;

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/users/${activeUserIdForPwd}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        alert('رمز عبور کاربر با موفقیت بروزرسانی شد.');
        document.getElementById('modal-reset-user-pwd').classList.add('hidden');
        activeUserIdForPwd = null;
      } else {
        const d = await res.json();
        alert(d.error || 'خطا در تغییر رمز');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // Superadmin Master Password Change Modal
  document.getElementById('btn-open-pwd-modal')?.addEventListener('click', () => {
    document.getElementById('modal-change-superadmin-pwd').classList.remove('hidden');
  });
  document.getElementById('btn-cancel-superadmin-pwd')?.addEventListener('click', () => {
    document.getElementById('modal-change-superadmin-pwd').classList.add('hidden');
  });
  document.getElementById('btn-submit-superadmin-pwd')?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('input-curr-superadmin-pwd').value;
    const newPassword = document.getElementById('input-new-superadmin-pwd').value;
    if (!newPassword || newPassword.length < 6) {
      alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    const res = await fetch(`${API_BASE}/api/superadmin/change-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const d = await res.json();
    if (res.ok) {
      alert('رمز عبور مدیر ارشد با موفقیت تغییر کرد.');
      document.getElementById('modal-change-superadmin-pwd').classList.add('hidden');
    } else {
      alert(d.error || 'خطا در تغییر رمز');
    }
  });

  // Factory Reset
  document.getElementById('btn-show-factory-reset')?.addEventListener('click', async () => {
    const confirmPwd = prompt('جهت تایید بازنشانی کارخانه، رمز عبور مدیر ارشد سرور را وارد نمایید:');
    if (!confirmPwd) return;

    const res = await fetch(`${API_BASE}/api/superadmin/factory-reset`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ confirmPassword: confirmPwd })
    });
    const d = await res.json();
    if (res.ok) {
      alert('سامانه با موفقیت ریست کارخانه شد.');
      loadDashboardData();
    } else {
      alert(d.error || 'خطا در بازنشانی');
    }
  });

  // Refresh Logs
  document.getElementById('btn-refresh-logs')?.addEventListener('click', () => {
    fetchLogs();
  });
});
