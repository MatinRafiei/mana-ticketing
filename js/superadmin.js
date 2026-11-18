// Client logic for Superadmin Control Panel with Telegram Integration & Delivery Tracking

const API_BASE = window.location.origin;
let authToken = localStorage.getItem('mana_superadmin_token') || '';
let currentUsers = [];
let currentRoles = [];
let currentDeliveries = [];

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
    fetchTelegramSettings(),
    fetchDeliveries(),
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

  document.getElementById('metric-telegram').textContent = data.counts?.telegramLinkedUsers || 0;
  document.getElementById('metric-telegram-detail').textContent = `${data.counts?.deliveries || 0} گردش پیام با هندشیک`;

  document.getElementById('metric-push').textContent = data.counts?.pushSubscriptions || 0;
}

// Users
async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/users`, { headers: authHeaders() });
    if (res.ok) {
      currentUsers = await res.json();
      renderUsersTable(currentUsers);
    }
  } catch (e) {
    console.warn('Error fetching users:', e);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500">هیچ کاربری یافت نشد.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const roleObj = currentRoles.find(r => r.id === u.roleId);
    const roleName = roleObj ? roleObj.name : u.roleId;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
          <img src="${u.avatar || './icons/company_logo.png'}" class="w-7 h-7 rounded-full object-cover" />
          <span>${u.name}</span>
        </td>
        <td class="py-3 px-4 font-mono text-slate-300 text-xs">${u.email}</td>
        <td class="py-3 px-4">
          <select class="select-user-dept bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer transition" data-id="${u.id}">
            <option value="مدیریت" ${u.department === 'مدیریت' ? 'selected' : ''}>مدیریت</option>
            <option value="مهندسی" ${u.department === 'مهندسی' ? 'selected' : ''}>مهندسی</option>
            <option value="مالی و حسابداری" ${u.department === 'مالی و حسابداری' ? 'selected' : ''}>مالی و حسابداری</option>
            <option value="پشتیبانی" ${u.department === 'پشتیبانی' ? 'selected' : ''}>پشتیبانی</option>
          </select>
        </td>
        <td class="py-3 px-4">
          <select class="select-user-role bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-300 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer transition" data-id="${u.id}">
            ${currentRoles.length > 0 ? currentRoles.map(r => `
              <option value="${r.id}" ${r.id === u.roleId ? 'selected' : ''}>${r.name}</option>
            `).join('') : `<option value="${u.roleId}">${roleName}</option>`}
          </select>
        </td>
        <td class="py-3 px-4">
          ${u.telegramChatId ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span>✈️ متصل</span>
              <button class="btn-unlink-user-tg text-slate-500 hover:text-rose-400 text-[10px]" data-id="${u.id}" title="قطع اتصال">(قطع)</button>
            </span>
          ` : `
            <span class="text-slate-500 text-[10px]">کد: <code class="font-mono text-sky-400 font-bold">${u.telegramAuthCode || '-'}</code></span>
          `}
        </td>
        <td class="py-3 px-4 text-center">
          ${u.isRestricted ? `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">مسدود شده</span>
          ` : `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">فعال</span>
          `}
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button class="btn-toggle-restrict px-2 py-1 rounded-lg text-[10px] font-bold ${u.isRestricted ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-700 hover:bg-emerald-600/30' : 'bg-amber-600/20 text-amber-300 border border-amber-700 hover:bg-amber-600/30'}" data-id="${u.id}">
              ${u.isRestricted ? 'رفع مسدودی' : 'مسدودسازی'}
            </button>
            <button class="btn-del-user p-1 text-slate-500 hover:text-rose-400 rounded-lg transition" data-id="${u.id}" data-name="${u.name}" title="حذف کاربر">
              🗑
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind role change dropdown
  document.querySelectorAll('.select-user-role').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-id');
      const newRoleId = sel.value;
      sel.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ roleId: newRoleId })
        });
        if (res.ok) {
          sel.classList.add('ring-2', 'ring-emerald-500');
          setTimeout(() => sel.classList.remove('ring-2', 'ring-emerald-500'), 1500);
        } else {
          const err = await res.json();
          alert(err.error || 'خطا در تغییر نقش کاربر');
          fetchUsers();
        }
      } catch (e) {
        alert('خطا در برقراری ارتباط با سرور');
        fetchUsers();
      } finally {
        sel.disabled = false;
      }
    });
  });

  // Bind department change dropdown
  document.querySelectorAll('.select-user-dept').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-id');
      const newDept = sel.value;
      sel.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ department: newDept })
        });
        if (res.ok) {
          sel.classList.add('ring-2', 'ring-emerald-500');
          setTimeout(() => sel.classList.remove('ring-2', 'ring-emerald-500'), 1500);
        } else {
          const err = await res.json();
          alert(err.error || 'خطا در تغییر واحد کاربر');
          fetchUsers();
        }
      } catch (e) {
        alert('خطا در برقراری ارتباط با سرور');
        fetchUsers();
      } finally {
        sel.disabled = false;
      }
    });
  });

  // Bind restrict buttons
  document.querySelectorAll('.btn-toggle-restrict').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}/restrict`, {
          method: 'PUT',
          headers: authHeaders()
        });
        if (res.ok) {
          fetchUsers();
          fetchStatus();
        }
      } catch (e) {
        alert('خطا در تغییر وضعیت دسترسی');
      }
    });
  });

  // Bind unlink tg buttons
  document.querySelectorAll('.btn-unlink-user-tg').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('آیا از قطع اتصال تلگرام این کاربر اطمینان دارید؟')) {
        await fetch(`${API_BASE}/api/superadmin/users/${id}/telegram`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        fetchUsers();
        fetchStatus();
      }
    });
  });

  // Bind delete buttons
  document.querySelectorAll('.btn-del-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`آیا مطمئن هستید که می‌خواهید کاربر «${name}» را حذف نمایید؟`)) {
        const res = await fetch(`${API_BASE}/api/superadmin/users/${id}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          fetchUsers();
          fetchStatus();
        } else {
          alert(data.error || 'خطا در حذف کاربر');
        }
      }
    });
  });
}

// Telegram Settings
async function fetchTelegramSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/telegram/settings`, { headers: authHeaders() });
    if (res.ok) {
      const s = await res.json();
      document.getElementById('tg-token').value = s.botToken || '';
      document.getElementById('tg-proxy').value = s.proxyUrl || '';
      document.getElementById('tg-auto-resend').checked = s.autoResendEnabled;
      document.getElementById('tg-interval').value = s.resendIntervalMins || 30;
      document.getElementById('tg-max-resends').value = s.maxResends || 3;
    }
  } catch (e) {
    console.warn('Error fetching telegram settings:', e);
  }
}

// Deliveries Tracking
async function fetchDeliveries() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/deliveries`, { headers: authHeaders() });
    if (res.ok) {
      currentDeliveries = await res.json();
      renderDeliveries(currentDeliveries);
    }
  } catch (e) {
    console.warn('Error fetching deliveries:', e);
  }
}

function renderDeliveries(deliveries) {
  const container = document.getElementById('deliveries-container');
  if (!container) return;

  if (deliveries.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
        هنوز پیامی ارسال نشده است.
      </div>
    `;
    return;
  }

  container.innerHTML = deliveries.map(group => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div class="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${group.type === 'announcement' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}">
              ${group.type === 'announcement' ? 'بخشنامه سازمانی' : 'تیکت'}
            </span>
            <h4 class="font-bold text-xs sm:text-sm text-white">${group.title}</h4>
          </div>
          <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span>✍️ ثبت‌کننده: <strong class="text-slate-200">${group.creatorName || 'مدیریت سامانه'}</strong></span>
          </div>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2">${group.message}</p>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">${formatJalaliTime(group.createdAt)}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        ${group.recipients.map(r => `
          <div class="p-2.5 rounded-xl border flex items-center justify-between gap-2 ${r.status === 'acknowledged' ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-amber-950/20 border-amber-800/40'}">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-xs text-white truncate">${r.userName}</span>
                ${r.telegramChatId ? '<span class="text-[10px] text-sky-400">✈️</span>' : '<span class="text-[9px] text-slate-500">(فاقد تلگرام)</span>'}
              </div>
              <div class="text-[10px] ${r.status === 'acknowledged' ? 'text-emerald-400 font-bold' : 'text-amber-400'}">
                ${r.status === 'acknowledged' ? `✅ تایید شد: ${formatJalaliTime(r.acknowledgedAt)}${r.acknowledgedVia === 'reply' ? ' (با ارسال پاسخ)' : ''}` : `⏳ در انتظار تایید (${r.resendCount || 0} بار یادآوری)`}
              </div>
            </div>

            ${r.status !== 'acknowledged' && r.telegramChatId ? `
              <button class="btn-resend-superadmin px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-800/50 text-[10px] font-bold transition shrink-0" data-del-id="${group.id}" data-user-id="${r.userId}">
                یادآوری فوری
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-resend-superadmin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const delId = btn.getAttribute('data-del-id');
      const userId = btn.getAttribute('data-user-id');
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const res = await fetch(`${API_BASE}/api/superadmin/deliveries/${delId}/resend/${userId}`, {
          method: 'POST',
          headers: authHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          alert('یادآوری مجدد در تلگرام ارسال گردید.');
          fetchDeliveries();
        } else {
          alert(data.error || 'خطا در ارسال');
        }
      } catch (e) {
        alert('خطا در ارتباط با سرور');
      } finally {
        btn.disabled = false;
        btn.textContent = 'یادآوری فوری';
      }
    });
  });
}

// Audit Logs
async function fetchLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/logs?limit=100`, { headers: authHeaders() });
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
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500">هیچ لاگی ثبت نشده است.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    let statusBadge = '';
    if (l.status === 'SUCCESS') {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">موفق</span>`;
    } else if (l.status === 'FAILED') {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">ناموفق</span>`;
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">مسدود</span>`;
    }

    return `
      <tr class="hover:bg-slate-800/40 transition text-[11px]">
        <td class="py-2.5 px-4 text-slate-400">${formatJalaliTime(l.timestamp)}</td>
        <td class="py-2.5 px-4 font-bold text-white">${l.email}</td>
        <td class="py-2.5 px-4 text-slate-300 font-mono">${l.ip}</td>
        <td class="py-2.5 px-4 text-slate-400">${l.type || 'USER'}</td>
        <td class="py-2.5 px-4 text-center">${statusBadge}</td>
        <td class="py-2.5 px-4 text-slate-400 truncate max-w-xs" title="${l.userAgent}">${(l.userAgent || '').slice(0, 40)}</td>
        <td class="py-2.5 px-4 text-slate-300">${l.message || '-'}</td>
      </tr>
    `;
  }).join('');
}

// Roles
async function fetchRoles() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/roles`, { headers: authHeaders() });
    if (res.ok) {
      currentRoles = await res.json();
      renderRoles(currentRoles);
      populateRoleSelect(currentRoles);
      if (currentUsers && currentUsers.length > 0) {
        renderUsersTable(currentUsers);
      }
    }
  } catch (e) {
    console.warn('Error fetching roles:', e);
  }
}

function populateRoleSelect(roles) {
  const sel = document.getElementById('new-user-role');
  if (sel) {
    sel.innerHTML = roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  }
}

function renderRoles(roles) {
  const grid = document.getElementById('roles-grid');
  if (!grid) return;

  grid.innerHTML = roles.map(r => `
    <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-sm text-white">${r.name}</h4>
        ${r.isSystem ? '<span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">سیستمی</span>' : ''}
      </div>
      <p class="text-xs text-slate-400">${r.description || 'بدون شرح'}</p>
      <div class="flex flex-wrap gap-1 pt-2">
        ${(r.permissions || []).map(p => `
          <span class="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">${p}</span>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Login Form
  const loginForm = document.getElementById('superadmin-login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error-alert');
    const submitBtn = document.getElementById('btn-login-submit');

    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال بررسی...';

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        authToken = data.token;
        localStorage.setItem('mana_superadmin_token', authToken);
        showDashboard();
      } else {
        errBox.textContent = data.error || 'خطا در ورود';
        errBox.classList.remove('hidden');
      }
    } catch (err) {
      errBox.textContent = 'خطای ارتباط با سرور: ' + err.message;
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ورود امن به پنل سرور';
    }
  });

  // Logout
  document.getElementById('btn-superadmin-logout')?.addEventListener('click', () => {
    localStorage.removeItem('mana_superadmin_token');
    authToken = '';
    showLogin();
  });

  // Sub-tabs navigation
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      document.querySelectorAll('.nav-tab-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-blue-600', 'text-white', 'shadow');
      btn.classList.remove('text-slate-400');

      document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
      const activeSec = document.getElementById(`tab-sec-${target}`);
      if (activeSec) activeSec.classList.remove('hidden');

      if (target === 'deliveries') fetchDeliveries();
      if (target === 'logs') fetchLogs();
      if (target === 'telegram') fetchTelegramSettings();
    });
  });

  // Save Telegram Settings
  const tgForm = document.getElementById('form-telegram-settings');
  tgForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botToken = document.getElementById('tg-token').value.trim();
    const proxyUrl = document.getElementById('tg-proxy').value.trim();
    const autoResendEnabled = document.getElementById('tg-auto-resend').checked;
    const resendIntervalMins = document.getElementById('tg-interval').value;
    const maxResends = document.getElementById('tg-max-resends').value;

    const saveBtn = document.getElementById('btn-save-tg');
    saveBtn.disabled = true;
    saveBtn.textContent = 'در حال ذخیره...';

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/telegram/settings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ botToken, proxyUrl, autoResendEnabled, resendIntervalMins, maxResends })
      });
      if (res.ok) {
        alert('تنظیمات ربات تلگرام با موفقیت ذخیره و فعال شد.');
        fetchStatus();
      } else {
        alert('خطا در ذخیره تنظیمات');
      }
    } catch (err) {
      alert('خطای ارتباط با سرور: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'ذخیره تنظیمات ربات تلگرام';
    }
  });

  // Test Telegram Bot Connection
  document.getElementById('btn-test-telegram')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-telegram');
    const resultBox = document.getElementById('telegram-test-result');
    btn.disabled = true;
    btn.textContent = 'در حال تست ارتباط...';
    resultBox.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/telegram/test`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      resultBox.classList.remove('hidden');

      if (res.ok) {
        resultBox.className = 'p-3 rounded-xl text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-300';
        resultBox.innerHTML = `✅ اتصال با موفقیت برقرار شد! نام ربات: <b>${data.bot.first_name}</b> (@${data.bot.username})`;
      } else {
        resultBox.className = 'p-3 rounded-xl text-xs bg-rose-950/60 border border-rose-800 text-rose-300';
        resultBox.innerHTML = `❌ خطا در ارتباط با تلگرام: ${data.error}`;
      }
    } catch (err) {
      resultBox.className = 'p-3 rounded-xl text-xs bg-rose-950/60 border border-rose-800 text-rose-300';
      resultBox.innerHTML = `❌ خطای شبکه: ${err.message}`;
      resultBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'تست اتصال به تلگرام';
    }
  });

  // Refresh Deliveries & Logs
  document.getElementById('btn-refresh-deliveries')?.addEventListener('click', () => fetchDeliveries());
  document.getElementById('btn-refresh-logs')?.addEventListener('click', () => fetchLogs());

  // Create User Form
  const createUserForm = document.getElementById('form-create-user');
  createUserForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-pwd').value;
    const department = document.getElementById('new-user-dept').value.trim();
    const roleId = document.getElementById('new-user-role').value;

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email, password, department, roleId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`کاربر «${name}» با موفقیت تعریف شد.`);
        document.getElementById('box-add-user').classList.add('hidden');
        createUserForm.reset();
        fetchUsers();
        fetchStatus();
      } else {
        alert(data.error || 'خطا در ثبت کاربر');
      }
    } catch (err) {
      alert('خطای ارتباط با سرور: ' + err.message);
    }
  });

  document.getElementById('btn-show-add-user')?.addEventListener('click', () => {
    document.getElementById('box-add-user').classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-add-user')?.addEventListener('click', () => {
    document.getElementById('box-add-user').classList.add('hidden');
  });

  // ===================================================================
  // CHANGE SUPERADMIN PASSWORD MODAL
  // ===================================================================
  const pwdModal = document.getElementById('modal-change-password');
  const pwdAlert = document.getElementById('pwd-modal-alert');
  const formChangePwd = document.getElementById('form-change-password');

  const openPwdModal = () => {
    pwdAlert?.classList.add('hidden');
    formChangePwd?.reset();
    pwdModal?.classList.remove('hidden');
    pwdModal?.classList.add('flex');
    document.getElementById('input-curr-pwd')?.focus();
  };

  const closePwdModal = () => {
    pwdModal?.classList.add('hidden');
    pwdModal?.classList.remove('flex');
  };

  document.getElementById('btn-open-pwd-modal')?.addEventListener('click', openPwdModal);
  document.getElementById('btn-close-pwd-modal')?.addEventListener('click', closePwdModal);
  document.getElementById('btn-cancel-pwd')?.addEventListener('click', closePwdModal);

  formChangePwd?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const curr = document.getElementById('input-curr-pwd').value;
    const next = document.getElementById('input-new-pwd').value;
    const confirm = document.getElementById('input-confirm-pwd').value;
    const submitBtn = document.getElementById('btn-submit-pwd');

    if (next !== confirm) {
      pwdAlert.className = 'p-3 rounded-xl text-xs bg-rose-950/70 border border-rose-800 text-rose-300';
      pwdAlert.textContent = 'رمز عبور جدید با تکرار آن همخوانی ندارد.';
      pwdAlert.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال ذخیره...';
    pwdAlert.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/change-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: curr, newPassword: next })
      });
      const data = await res.json();
      if (res.ok) {
        alert('رمز عبور مدیر ارشد با موفقیت تغییر یافت. لطفاً با رمز جدید مجدداً وارد شوید.');
        closePwdModal();
        localStorage.removeItem('mana_superadmin_token');
        authToken = '';
        showLogin();
      } else {
        pwdAlert.className = 'p-3 rounded-xl text-xs bg-rose-950/70 border border-rose-800 text-rose-300';
        pwdAlert.textContent = data.error || 'خطا در تغییر رمز عبور';
        pwdAlert.classList.remove('hidden');
      }
    } catch (err) {
      pwdAlert.className = 'p-3 rounded-xl text-xs bg-rose-950/70 border border-rose-800 text-rose-300';
      pwdAlert.textContent = 'خطای ارتباط با سرور: ' + err.message;
      pwdAlert.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ذخیره رمز جدید';
    }
  });

  // ===================================================================
  // FACTORY RESET MODAL & WORKFLOW
  // ===================================================================
  const resetModal = document.getElementById('modal-factory-reset');
  const resetAlert = document.getElementById('reset-modal-alert');
  const formFactoryReset = document.getElementById('form-factory-reset');

  const openResetModal = () => {
    resetAlert?.classList.add('hidden');
    formFactoryReset?.reset();
    resetModal?.classList.remove('hidden');
    resetModal?.classList.add('flex');
    document.getElementById('input-reset-pwd')?.focus();
  };

  const closeResetModal = () => {
    resetModal?.classList.add('hidden');
    resetModal?.classList.remove('flex');
  };

  document.getElementById('btn-open-factory-reset')?.addEventListener('click', openResetModal);
  document.getElementById('btn-close-reset-modal')?.addEventListener('click', closeResetModal);
  document.getElementById('btn-cancel-reset')?.addEventListener('click', closeResetModal);

  formFactoryReset?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const confirmPassword = document.getElementById('input-reset-pwd').value;
    const submitBtn = document.getElementById('btn-submit-reset');

    if (!confirm('آیا از بازنشانی کامل پایگاه داده و حذف کلیه تیکت‌ها و داده‌ها اطمینان قطعی دارید؟')) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال بازنشانی...';
    resetAlert.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/factory-reset`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirmPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert('سامانه با موفقیت به نقطه صفر کارخانه بازنشانی گردید.');
        closeResetModal();
        // Clear all cached tokens & redirect
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      } else {
        resetAlert.className = 'p-3 rounded-xl text-xs bg-rose-950/70 border border-rose-800 text-rose-300';
        resetAlert.textContent = data.error || 'خطا در بازنشانی کارخانه';
        resetAlert.classList.remove('hidden');
      }
    } catch (err) {
      resetAlert.className = 'p-3 rounded-xl text-xs bg-rose-950/70 border border-rose-800 text-rose-300';
      resetAlert.textContent = 'خطای ارتباط با سرور: ' + err.message;
      resetAlert.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'تایید نهایی و ریست فاکتوری';
    }
  });
});
