// Settings & Google Drive Configuration Modal with Step-by-Step Persian Guide

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { notificationEngine } from '../notifications.js';

export class SettingsModalComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  open() {
    state.isSettingsModalOpen = true;
    this.render();
  }

  close() {
    state.isSettingsModalOpen = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container) return;

    const gdrive = state.gdriveProvider;
    const isConnected = gdrive.isConnected();
    const currentMode = state.storageMode;
    const gUser = gdrive.googleUser;

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto modal-backdrop bg-slate-950/60 transition-opacity">
        <div class="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

          <!-- Mobile drag handle -->
          <div class="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2 shrink-0"></div>

          <!-- Header -->
          <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                ${renderIcon('settings', 'w-4 h-4 sm:w-5 sm:h-5')}
              </div>
              <div class="truncate">
                <h3 class="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white truncate">تنظیمات اتصال و گوگل درایو</h3>
                <p class="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">پیکربندی ذخیره‌سازی ابری بدون سرور و پایداری نشست</p>
              </div>
            </div>
            <button id="settings-close-btn" class="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              ${renderIcon('x', 'w-5 h-5')}
            </button>
          </div>

          <!-- Body Scrollable -->
          <div class="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">

            <!-- Storage Mode Switcher -->
            <div class="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">حالت فعال ذخیره‌سازی:</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label class="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer transition ${currentMode === 'local' ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}">
                  <input type="radio" name="storage_mode" value="local" ${currentMode === 'local' ? 'checked' : ''} class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <span class="text-xs font-bold text-slate-900 dark:text-white block">حالت لوکال / تستی</span>
                    <span class="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">بدون نیاز به API، تست بین تب‌ها</span>
                  </div>
                </label>

                <label class="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border-2 cursor-pointer transition ${currentMode === 'gdrive' ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}">
                  <input type="radio" name="storage_mode" value="gdrive" ${currentMode === 'gdrive' ? 'checked' : ''} class="mt-0.5 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <span class="text-xs font-bold text-slate-900 dark:text-white block flex items-center gap-1">
                      ${renderIcon('drive', 'w-3.5 h-3.5')}
                      گوگل درایو (ابری)
                    </span>
                    <span class="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">پایش ۱۰-۱۵ ثانیه‌ای و آپلود فایل در درایو</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Connected Account Card (If logged in) -->
            ${isConnected ? `
              <div class="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3">
                  <img src="${gUser?.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}" class="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/50" />
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-extrabold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">${gUser?.name || 'حساب گوگل متصل'}</span>
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    </div>
                    <span class="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono block">${gUser?.email || ''}</span>
                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400">نشست ورود در مرورگر ذخیره شده است</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 mr-auto sm:mr-0">
                  <button type="button" id="btn-sync-now" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1">
                    ${renderIcon('refresh', 'w-3.5 h-3.5')}
                    <span>همگام‌سازی فوری</span>
                  </button>

                  <button type="button" id="btn-logout-google" class="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition">
                    خروج از حساب
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Shared Organization Database Card (Multi-user Sync Engine) -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    ${renderIcon('share', 'w-4 h-4')}
                  </span>
                  <div>
                    <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">پایگاه داده مشترک سازمانی (سینک همکاران)</h4>
                    <p class="text-[11px] text-slate-600 dark:text-slate-300">اتصال همه اعضای تیم به یک پایگاه داده یکسان در گوگل درایو</p>
                  </div>
                </div>
                ${gdrive.fileId ? `
                  <span class="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-lg">
                    دیتابیس متصل است
                  </span>
                ` : `
                  <span class="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-1 rounded-lg">
                    هنوز فایلی متصل نشده
                  </span>
                `}
              </div>

              <!-- Database File ID & Switcher -->
              <div class="space-y-1">
                <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  شناسه فایل دیتابیس در گوگل درایو (File ID):
                </label>
                <div class="flex items-center gap-2">
                  <input type="text" id="input-shared-file-id" value="${gdrive.fileId || ''}" placeholder="شناسه فایل یا اتصال خودکار..." class="flex-1 px-3 py-1.5 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  <button type="button" id="btn-apply-file-id" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-bold transition">
                    اتصال به این فایل
                  </button>
                </div>
              </div>

              <!-- Quick Action Buttons -->
              <div class="flex items-center gap-2 flex-wrap pt-1 border-t border-blue-200 dark:border-blue-800/60">
                <button type="button" id="btn-copy-invite-link" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5">
                  ${renderIcon('copy', 'w-4 h-4')}
                  <span>کپی لینک دعوت همکاران (اتصال فوری)</span>
                </button>

                <button type="button" id="btn-make-file-shared" class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5">
                  ${renderIcon('shield', 'w-4 h-4 text-emerald-500')}
                  <span>عمومی‌سازی دسترسی فایل (اشتراک با لینک)</span>
                </button>
              </div>
            </div>

            <!-- Google Drive API Credentials Form -->
            <div class="space-y-3 sm:space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  ${renderIcon('shield', 'w-4 h-4 text-blue-600')}
                  مشخصات دسترسی Google OAuth
                </h4>
                <div class="flex items-center gap-1.5 text-[11px]">
                  <span class="w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}"></span>
                  <span class="${isConnected ? 'text-emerald-600 font-bold' : 'text-slate-500'}">
                    ${isConnected ? 'متصل و فعال' : 'قطع ارتباط'}
                  </span>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Google Client ID (کلاینت آی‌دی وب)
                </label>
                <input type="text" id="gdrive-client-id" value="${gdrive.clientId || ''}" placeholder="مثال: 123456789-xxxx.apps.googleusercontent.com" class="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Google API Key (اختیاری)
                  </label>
                  <input type="text" id="gdrive-api-key" value="${gdrive.apiKey || ''}" placeholder="AIzaSy..." class="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    بازه زمانی پایش اعلان‌ها
                  </label>
                  <select id="gdrive-poll-interval" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500">
                    <option value="10" ${gdrive.pollIntervalMs === 10000 ? 'selected' : ''}>هر ۱۰ ثانیه (سریع‌ترین)</option>
                    <option value="12" ${gdrive.pollIntervalMs === 12000 ? 'selected' : ''}>هر ۱۲ ثانیه (پیش‌فرض)</option>
                    <option value="15" ${gdrive.pollIntervalMs === 15000 ? 'selected' : ''}>هر ۱۵ ثانیه (بهینه)</option>
                  </select>
                </div>
              </div>

              <!-- Connect / Sign in Button -->
              <div class="flex items-center gap-2 flex-wrap pt-1">
                <button type="button" id="btn-save-gdrive-config" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition">
                  ذخیره تنظیمات
                </button>

                <button type="button" id="btn-login-google" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition">
                  ${renderIcon('drive', 'w-4 h-4')}
                  <span>${isConnected ? 'احراز هویت مجدد' : 'ورود با حساب گوگل و اتصال درایو'}</span>
                </button>
              </div>
            </div>

            <!-- Persian Setup Guide -->
            <div class="bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <h5 class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                ${renderIcon('alertCircle', 'w-4 h-4 text-blue-500')}
                راهنمای کنسول گوگل (بدون نیاز به سرور):
              </h5>
              <ol class="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed pr-1 text-[11px]">
                <li>وارد <a href="https://console.cloud.google.com" target="_blank" class="text-blue-600 dark:text-blue-400 underline font-bold">Google Cloud Console</a> شوید.</li>
                <li>در <strong>APIs & Services &gt; Library</strong>، سرویس <strong>Google Drive API</strong> را <strong>Enable</strong> نمایید.</li>
                <li>در <strong>OAuth consent screen &gt; Test Users</strong>، ایمیل‌های همکاران شرکت را ثبت کنید.</li>
                <li>در <strong>Credentials &gt; OAuth client ID</strong>، نوع <strong>Web application</strong> را برگزیده و در <strong>Authorized JavaScript origins</strong> آدرس سایت بدون مسیر را بنویسید (مثال: <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://matinrafiei.github.io</code>).</li>
                <li>کد <strong>Client ID</strong> را کپی کرده و در کادر بالا ذخیره کنید.</li>
              </ol>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end pb-safe">
            <button type="button" id="btn-close-settings-footer" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20">
              بستن
            </button>
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('settings-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('btn-close-settings-footer')?.addEventListener('click', () => this.close());

    this.container.querySelectorAll('input[name="storage_mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.storageMode = e.target.value;
        localStorage.setItem('storage_mode', e.target.value);
        notificationEngine.triggerToast({
          title: 'حالت ذخیره‌سازی تغییر یافت',
          message: e.target.value === 'gdrive' ? 'حالت گوگل درایو فعال شد.' : 'حالت پیش‌نمایش لوکال فعال شد.',
          type: 'info'
        });
        state.emit('state_updated');
        this.render();
      });
    });

    document.getElementById('btn-save-gdrive-config')?.addEventListener('click', () => {
      const clientId = document.getElementById('gdrive-client-id').value;
      const apiKey = document.getElementById('gdrive-api-key').value;
      const pollSec = document.getElementById('gdrive-poll-interval').value;

      state.gdriveProvider.saveConfig(clientId, apiKey, pollSec);
      notificationEngine.triggerToast({
        title: 'تنظیمات ذخیره شد',
        message: 'تنظیمات اتصال با موفقیت بروز گردید.',
        type: 'success'
      });
    });

    // Google Sign Out
    document.getElementById('btn-logout-google')?.addEventListener('click', () => {
      if (confirm('آیا مایل به خروج از حساب گوگل هستید؟')) {
        state.gdriveProvider.signOut();
        notificationEngine.triggerToast({
          title: 'خروج از حساب گوگل',
          message: 'نشست ورود با موفقیت پاک شد.',
          type: 'info'
        });
        this.render();
      }
    });

    // Sync Now
    document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-now');
      btn.disabled = true;
      btn.innerHTML = 'در حال همگام‌سازی...';
      try {
        await state.persistCurrentData();
        const fresh = await state.gdriveProvider.load();
        if (fresh) {
          state.handleRemoteData(fresh, 'gdrive');
        }
        notificationEngine.triggerToast({
          title: 'همگام‌سازی موفق',
          message: 'اطلاعات با گوگل درایو همگام شد.',
          type: 'success'
        });
      } catch (e) {
        alert('خطا در همگام‌سازی: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'همگام‌سازی فوری';
      }
    });

    document.getElementById('btn-login-google')?.addEventListener('click', async () => {
      const clientId = document.getElementById('gdrive-client-id').value.trim();
      if (!clientId) {
        alert('لطفاً ابتدا Client ID گوگل را وارد نمایید.');
        return;
      }
      state.gdriveProvider.saveConfig(clientId, document.getElementById('gdrive-api-key').value, document.getElementById('gdrive-poll-interval').value);

      const btn = document.getElementById('btn-login-google');
      btn.disabled = true;
      btn.innerHTML = 'در حال ارتباط...';

      try {
        await state.gdriveProvider.signIn();
        state.storageMode = 'gdrive';
        localStorage.setItem('storage_mode', 'gdrive');

        notificationEngine.triggerToast({
          title: 'اتصال به گوگل درایو برقرار شد',
          message: 'نشست ورود شما ذخیره شد و با رفرش صفحه از بین نخواهد رفت.',
          type: 'success'
        });

        // Always attempt to load existing database first
        const remoteData = await state.gdriveProvider.load();
        if (remoteData && remoteData.tickets) {
          state.handleRemoteData(remoteData, 'gdrive');
          state.syncGoogleUserWithCurrent();
          notificationEngine.triggerToast({
            title: 'همگام‌سازی سازمانی انجام شد',
            message: 'تیکت‌ها و پرسنل از پایگاه داده مشترک بارگذاری شدند.',
            type: 'success'
          });
        } else {
          // If no remote database existed yet, save current data & share it
          await state.persistCurrentData();
          await state.gdriveProvider.makeFileShared();
        }

        this.render();
      } catch (err) {
        console.error('Google Sign-In Error:', err);
        alert('خطا در ورود به گوگل: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'ورود با حساب گوگل';
      }
    });

    // Copy Invite Link
    document.getElementById('btn-copy-invite-link')?.addEventListener('click', () => {
      const inviteLink = state.gdriveProvider.getInviteLink();
      navigator.clipboard.writeText(inviteLink).then(() => {
        notificationEngine.triggerToast({
          title: 'لینک اتصال مشترک کپی شد',
          message: 'این لینک را در گوشی باز کنید یا برای همکارانتان بفرستید تا فوراً به همین پایگاه داده متصل شوند.',
          type: 'success'
        });
      }).catch(() => {
        prompt('لینک زیر را کپی کنید:', inviteLink);
      });
    });

    // Apply specific File ID
    document.getElementById('btn-apply-file-id')?.addEventListener('click', async () => {
      const fileIdInput = document.getElementById('input-shared-file-id');
      const newFileId = fileIdInput?.value.trim();
      if (!newFileId) {
        alert('لطفاً شناسه فایل دیتابیس را وارد نمایید.');
        return;
      }
      state.gdriveProvider.setFileId(newFileId);
      state.storageMode = 'gdrive';
      localStorage.setItem('storage_mode', 'gdrive');
      notificationEngine.triggerToast({
        title: 'شناسه پایگاه داده تغییر یافت',
        message: 'در حال بارگذاری اطلاعات از فایل مشترک...',
        type: 'info'
      });
      if (state.gdriveProvider.isConnected()) {
        const fresh = await state.gdriveProvider.load();
        if (fresh) state.handleRemoteData(fresh, 'gdrive');
      }
      this.render();
    });

    // Make File Shared with Link
    document.getElementById('btn-make-file-shared')?.addEventListener('click', async () => {
      if (!state.gdriveProvider.isConnected()) {
        alert('ابتدا باید با حساب گوگل وارد شوید.');
        return;
      }
      const ok = await state.gdriveProvider.makeFileShared();
      if (ok) {
        notificationEngine.triggerToast({
          title: 'دسترسی همگانی فعال شد',
          message: 'فایل پایگاه داده اکنون برای همه همکاران دارای لینک قابل خواندن و نوشتن است.',
          type: 'success'
        });
      } else {
        notificationEngine.triggerToast({
          title: 'خطا در فعال‌سازی',
          message: 'امکان تغییر دسترسی فایل در درایو فراهم نشد.',
          type: 'error'
        });
      }
    });
  }
}
