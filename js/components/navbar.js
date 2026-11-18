// Top Navigation Header & Mobile Bottom Navigation with True Responsive Layout

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { sound } from '../utils/audio.js';
import { notificationEngine } from '../notifications.js';
import { formatRelative, toPersianDigits } from '../utils/jalali.js';

export class NavbarComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isNotifOpen = false;
    this.isUserMenuOpen = false;
  }

  render() {
    if (!this.container) return;

    const u = state.currentUser || {
      name: 'کاربر سیستم',
      email: '',
      avatar: './icons/company_logo.png',
      roleId: 'member'
    };
    const role = state.getCurrentUserRole() || { name: 'کاربر سیستم' };
    const unread = state.unreadCount;
    const isDark = document.documentElement.classList.contains('dark');
    const soundEnabled = sound.enabled;
    const isConnected = state.serverConnected;

    this.container.innerHTML = `
      <!-- Top Header Bar -->
      <header class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-14 sm:h-16 gap-2">

            <!-- Right: Logo & Desktop Navigation Tabs -->
            <div class="flex items-center gap-3 sm:gap-6 min-w-0">
              <div class="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0" id="nav-logo">
                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-800 p-0.5 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 shadow-sm">
                  <img src="./icons/company_logo.png" alt="مانا" class="w-full h-full object-contain rounded-lg" />
                </div>
                <div class="truncate">
                  <div class="flex items-center gap-1.5">
                    <span class="font-extrabold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">تیکتینگ مانا</span>
                    <span class="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">سازمانی</span>
                  </div>
                  <p class="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">سیستم هماهنگی و پیگیری کارها</p>
                </div>
              </div>

              <!-- Desktop Navigation Tabs (Hidden on mobile; mobile uses thumb-friendly bottom nav) -->
              <nav class="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button id="tab-tickets" class="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${state.currentView === 'tickets' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                  ${renderIcon('ticket', 'w-4 h-4')}
                  <span>تیکت‌ها</span>
                </button>
                <button id="tab-admin" class="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${state.currentView === 'admin' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
                  ${renderIcon('shield', 'w-4 h-4')}
                  <span>مدیریت</span>
                </button>
              </nav>
            </div>

            <!-- Left: Actions, Server Status, Notifications & User -->
            <div class="flex items-center gap-1 sm:gap-2 shrink-0">

              <!-- Server Connection Status Pill -->
              <div class="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-medium border transition-all ${isConnected ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}" title="${isConnected ? 'متصل به سرور لینوکس' : 'در حال تلاش برای اتصال به سرور...'}">
                <span class="w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'}"></span>
                <span class="hidden sm:inline text-[11px]">${isConnected ? 'سرور متصل' : 'قطع ارتباط'}</span>
              </div>

              <!-- Sound Toggle (Desktop/Tablet) -->
              <button id="btn-toggle-sound" class="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="${soundEnabled ? 'صدای اعلان فعال است' : 'صدا قطع است'}">
                ${soundEnabled ? renderIcon('volume2', 'w-4 h-4 sm:w-5 sm:h-5') : renderIcon('volumeX', 'w-4 h-4 sm:w-5 sm:h-5 text-rose-500')}
              </button>

              <!-- Dark Mode Toggle (Desktop/Tablet) -->
              <button id="btn-toggle-dark" class="hidden sm:flex p-1.5 sm:p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="حالت شب/روز">
                ${isDark ? renderIcon('sun', 'w-4 h-4 sm:w-5 sm:h-5 text-amber-400') : renderIcon('moon', 'w-4 h-4 sm:w-5 sm:h-5')}
              </button>

              <!-- Notifications Bell -->
              <div class="relative">
                <button id="btn-notifications" class="relative p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  ${unread > 0 ? renderIcon('bellRing', 'w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400') : renderIcon('bell', 'w-4 h-4 sm:w-5 sm:h-5')}
                  ${unread > 0 ? `
                    <span class="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 flex h-3.5 sm:h-4 min-w-[14px] sm:min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-bold text-white shadow-sm animate-bounce">
                      ${toPersianDigits(unread)}
                    </span>
                  ` : ''}
                </button>

                <!-- Notifications Dropdown (Responsive: Full-width on mobile, anchored on desktop) -->
                <div id="dropdown-notifications" class="${this.isNotifOpen ? 'block' : 'hidden'} fixed sm:absolute inset-x-2 sm:inset-x-auto sm:left-0 top-16 sm:top-auto sm:mt-2 sm:w-96 max-w-none sm:max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div class="p-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-xs text-slate-900 dark:text-white">اعلان‌های فوری</span>
                      ${unread > 0 ? `<span class="bg-rose-100 dark:bg-rose-900/60 text-rose-750 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${toPersianDigits(unread)} خوانده‌نشده</span>` : ''}
                    </div>
                    ${state.notifications.length > 0 ? `
                      <button id="btn-mark-all-read" class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                        علامت‌گذاری همه
                      </button>
                    ` : ''}
                  </div>

                  <!-- Permission Warning if not enabled -->
                  ${Notification.permission !== 'granted' ? `
                    <div class="p-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between text-[11px] text-blue-800 dark:text-blue-300">
                      <span>فعال‌سازی اعلان‌های گوشی:</span>
                      <button id="btn-request-perm" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-[10px]">
                        فعال‌سازی
                      </button>
                    </div>
                  ` : ''}

                  <!-- List of Notifications -->
                  <div class="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                    ${state.notifications.length === 0 ? `
                      <div class="p-6 text-center text-slate-400 dark:text-slate-500">
                        <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-2 text-slate-400">
                          ${renderIcon('bell', 'w-5 h-5')}
                        </div>
                        <p class="text-xs">هیچ اعلان جدیدی وجود ندارد</p>
                      </div>
                    ` : state.notifications.map(n => `
                      <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition notif-item ${!n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}" data-id="${n.id}" data-ticket-id="${n.ticketId || ''}">
                        <div class="flex items-start gap-2.5">
                          <div class="mt-0.5 text-blue-600 dark:text-blue-400 shrink-0">
                            ${n.type === 'deadline_overdue' ? renderIcon('alertTriangle', 'w-4 h-4 text-rose-500') : renderIcon('ticket', 'w-4 h-4')}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                              <h5 class="text-xs font-bold text-slate-900 dark:text-white truncate">${n.title}</h5>
                              <span class="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">${formatRelative(n.createdAt)}</span>
                            </div>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">${n.message}</p>
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Active User Profile & Menu -->
              <div class="relative">
                <button id="btn-user-menu" class="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  <img src="${u.avatar || './icons/company_logo.png'}" alt="${u.name}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-blue-500/30" />
                  <div class="text-right hidden sm:block">
                    <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      ${u.name}
                      ${renderIcon('chevronDown', 'w-3 h-3 text-slate-400')}
                    </div>
                    <div class="text-[10px] text-slate-500 dark:text-slate-400">${role.name.split(' ')[0]}</div>
                  </div>
                </button>

                <!-- User Profile & Action Dropdown -->
                <div id="dropdown-user" class="${this.isUserMenuOpen ? 'block' : 'hidden'} fixed sm:absolute inset-x-2 sm:inset-x-auto sm:left-0 top-16 sm:top-auto sm:mt-2 sm:w-72 max-w-none sm:max-w-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div class="p-3 bg-slate-50/60 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/60">
                    <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1">حساب کاربری فعال:</p>
                    <div class="flex items-center gap-2.5">
                      <img src="${u.avatar || './icons/company_logo.png'}" class="w-9 h-9 rounded-full object-cover" />
                      <div class="min-w-0 flex-1">
                        <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${u.name}</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400 truncate">${u.email}</div>
                      </div>
                    </div>
                    <div class="mt-2 flex items-center justify-between">
                      <span class="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                        ${role.name}
                      </span>
                      <span class="text-[10px] text-slate-400">${u.department || 'عمومی'}</span>
                    </div>
                  </div>

                  <!-- Profile & Actions -->
                  <div class="p-2 space-y-1">
                    <button id="btn-open-profile-menu" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
                      ${renderIcon('user', 'w-4 h-4 text-blue-600 dark:text-blue-400')}
                      <span>پروفایل و مشخصات من</span>
                    </button>

                    <button id="btn-install-pwa-menu" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition">
                      ${renderIcon('download', 'w-4 h-4 text-emerald-500')}
                      <span>نصب اپلیکیشن روی گوشی (PWA)</span>
                    </button>

                    <button id="btn-dropdown-admin" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
                      ${renderIcon('shield', 'w-4 h-4 text-indigo-500')}
                      <span>مدیریت تیکت‌ها و نقش‌ها</span>
                    </button>

                    <a href="./superadmin.html" target="_blank" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition">
                      ${renderIcon('cpu', 'w-4 h-4 text-amber-500')}
                      <span>پنل مدیریت ارشد سرور (Superadmin)</span>
                    </a>
                  </div>

                  <!-- Mobile Audio/Dark Controls -->
                  <div class="sm:hidden p-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-around gap-2 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                    <button id="btn-mobile-sound" class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-medium">
                      ${soundEnabled ? renderIcon('volume2', 'w-4 h-4 text-blue-600') : renderIcon('volumeX', 'w-4 h-4 text-rose-500')}
                      <span>${soundEnabled ? 'صدا روشن' : 'صدا قطع'}</span>
                    </button>
                    <button id="btn-mobile-dark" class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-medium">
                      ${isDark ? renderIcon('sun', 'w-4 h-4 text-amber-400') : renderIcon('moon', 'w-4 h-4 text-slate-400')}
                      <span>${isDark ? 'روز' : 'شب'}</span>
                    </button>
                  </div>

                  <!-- Logout Button -->
                  <div class="p-2 border-t border-slate-100 dark:border-slate-700/60">
                    <button id="btn-dropdown-logout" class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">
                      ${renderIcon('logOut', 'w-4 h-4 text-rose-500')}
                      <span>خروج از حساب کاربری</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Create Ticket Desktop Primary Button -->
              <button id="btn-new-ticket" class="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all transform active:scale-95">
                ${renderIcon('plus', 'w-4 h-4')}
                ثبت تیکت
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Mobile Fixed Bottom Navigation Bar -->
      <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl pb-safe">
        <!-- Tickets Tab -->
        <button id="bottom-tab-tickets" class="flex flex-col items-center justify-center py-1 px-3 text-[11px] font-bold rounded-xl transition ${state.currentView === 'tickets' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}">
          ${renderIcon('ticket', 'w-5 h-5 mb-0.5')}
          <span>تیکت‌ها</span>
        </button>

        <!-- Floating Center New Ticket Button (FAB) -->
        <button id="bottom-btn-new-ticket" class="flex items-center justify-center -mt-6 w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/40 border-2 border-white dark:border-slate-900 transform active:scale-90 transition">
          ${renderIcon('plus', 'w-6 h-6')}
        </button>

        <!-- Admin Management Tab -->
        <button id="bottom-tab-admin" class="flex flex-col items-center justify-center py-1 px-3 text-[11px] font-bold rounded-xl transition ${state.currentView === 'admin' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}">
          ${renderIcon('shield', 'w-5 h-5 mb-0.5')}
          <span>مدیریت</span>
        </button>

        <!-- Profile Tab -->
        <button id="bottom-tab-profile" class="flex flex-col items-center justify-center py-1 px-3 text-[11px] font-bold rounded-xl transition text-slate-500 dark:text-slate-400">
          ${renderIcon('user', 'w-5 h-5 mb-0.5')}
          <span>پروفایل</span>
        </button>
      </nav>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Nav Logo click -> return to tickets view
    document.getElementById('nav-logo')?.addEventListener('click', () => {
      state.currentView = 'tickets';
      state.emit('view_changed', 'tickets');
    });

    // View Navigation Handlers
    const setView = (v) => {
      state.currentView = v;
      state.emit('view_changed', v);
      this.render();
    };

    document.getElementById('tab-tickets')?.addEventListener('click', () => setView('tickets'));
    document.getElementById('tab-admin')?.addEventListener('click', () => setView('admin'));
    document.getElementById('bottom-tab-tickets')?.addEventListener('click', () => setView('tickets'));
    document.getElementById('bottom-tab-admin')?.addEventListener('click', () => setView('admin'));
    document.getElementById('btn-dropdown-admin')?.addEventListener('click', () => {
      this.isUserMenuOpen = false;
      setView('admin');
    });

    // Profile Modals
    const openProfile = () => {
      this.isUserMenuOpen = false;
      state.emit('open_profile_modal');
    };
    document.getElementById('btn-open-profile-menu')?.addEventListener('click', openProfile);
    document.getElementById('bottom-tab-profile')?.addEventListener('click', openProfile);

    // Logout
    document.getElementById('btn-dropdown-logout')?.addEventListener('click', () => {
      this.isUserMenuOpen = false;
      if (confirm('آیا مایل به خروج از حساب کاربری هستید؟')) {
        state.logout();
      }
    });

    // PWA Install Button in User Menu
    document.getElementById('btn-install-pwa-menu')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.isUserMenuOpen = false;
      this.render();

      if (window.deferredPWAInstallPrompt) {
        window.deferredPWAInstallPrompt.prompt();
        const { outcome } = await window.deferredPWAInstallPrompt.userChoice;
        console.log('PWA User choice from menu:', outcome);
      } else {
        alert('برای نصب اپلیکیشن:\nدر مرورگر کروم دکمه سه نقطه (⋮) بالای صفحه را بزنید و گزینه «افزودن به صفحه اصلی» یا «Install app» را انتخاب فرمایید.');
      }
    });

    // New Ticket Buttons (Desktop + Mobile Center FAB)
    const openNewTicket = () => {
      state.isTicketModalOpen = true;
      state.emit('open_ticket_modal');
    };
    document.getElementById('btn-new-ticket')?.addEventListener('click', openNewTicket);
    document.getElementById('bottom-btn-new-ticket')?.addEventListener('click', openNewTicket);

    // Sound Toggle (Desktop & Mobile)
    const toggleSound = () => {
      sound.toggle(!sound.enabled);
      if (sound.enabled) sound.playNotification();
      this.render();
    };
    document.getElementById('btn-toggle-sound')?.addEventListener('click', toggleSound);
    document.getElementById('btn-mobile-sound')?.addEventListener('click', toggleSound);

    // Dark Mode Toggle (Desktop & Mobile)
    const toggleDarkMode = () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      this.render();
    };
    document.getElementById('btn-toggle-dark')?.addEventListener('click', toggleDarkMode);
    document.getElementById('btn-mobile-dark')?.addEventListener('click', toggleDarkMode);

    // Notifications Dropdown Toggle
    document.getElementById('btn-notifications')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isNotifOpen = !this.isNotifOpen;
      this.isUserMenuOpen = false;
      this.render();
    });

    // Mark All Read
    document.getElementById('btn-mark-all-read')?.addEventListener('click', (e) => {
      e.stopPropagation();
      state.markAllNotificationsRead();
      this.render();
    });

    // Request Notification Permission
    document.getElementById('btn-request-perm')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await notificationEngine.requestPermission();
      this.render();
    });

    // Click on individual notification
    this.container.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        const notifId = el.getAttribute('data-id');
        const ticketId = el.getAttribute('data-ticket-id');
        state.markNotificationRead(notifId);
        if (ticketId) {
          state.activeTicketId = ticketId;
          state.emit('open_ticket_detail', ticketId);
        }
        this.isNotifOpen = false;
        this.render();
      });
    });

    // User Menu Toggle
    document.getElementById('btn-user-menu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isUserMenuOpen = !this.isUserMenuOpen;
      this.isNotifOpen = false;
      this.render();
    });

    // Close menus on outside click
    document.addEventListener('click', (e) => {
      if (this.isNotifOpen || this.isUserMenuOpen) {
        if (!e.target.closest('#btn-notifications') && !e.target.closest('#dropdown-notifications') &&
            !e.target.closest('#btn-user-menu') && !e.target.closest('#dropdown-user')) {
          this.isNotifOpen = false;
          this.isUserMenuOpen = false;
          this.render();
        }
      }
    });
  }
}
