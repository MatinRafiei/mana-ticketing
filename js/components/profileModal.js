// User Profile Modal Component (Edit Name, Upload Avatar, Change Password, Telegram Bot Link & Push Notification)

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { notificationEngine } from '../notifications.js';

export class ProfileModalComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isOpen = false;
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
  }

  open() {
    this.isOpen = true;
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
    this.render();
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container || !this.isOpen) return;

    const u = state.currentUser || {
      name: 'کاربر سیستم',
      email: '',
      department: 'عمومی',
      avatar: './icons/company_logo.png',
      telegramChatId: null,
      telegramAuthCode: '------'
    };
    const role = state.getCurrentUserRole() || { name: 'کاربر سیستم' };
    const displayAvatar = this.avatarPreviewUrl || u.avatar || './icons/company_logo.png';
    const isTelegramLinked = Boolean(u.telegramChatId);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto modal-backdrop bg-slate-950/70 backdrop-blur-sm transition-opacity">
        <div class="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

          <!-- Mobile handle -->
          <div class="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2 shrink-0"></div>

          <!-- Header -->
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                ${renderIcon('user', 'w-5 h-5')}
              </div>
              <div>
                <h3 class="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">پروفایل کاربری و حساب من</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">ویرایش مشخصات فردی، عکس و امنیت حساب</p>
              </div>
            </div>
            <button id="profile-close-btn" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              ${renderIcon('x', 'w-5 h-5')}
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">

            <!-- Avatar Upload Section -->
            <div class="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div class="relative group shrink-0">
                <img id="avatar-preview-img" src="${displayAvatar}" class="w-20 h-20 rounded-full object-cover ring-4 ring-blue-500/30 shadow-md" />
                <label for="input-avatar-file" class="absolute inset-0 bg-slate-950/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  ${renderIcon('camera', 'w-5 h-5 mb-0.5')}
                  <span class="text-[9px] font-bold">تغییر عکس</span>
                </label>
                <input type="file" id="input-avatar-file" accept="image/*" class="hidden" />
              </div>

              <div class="text-center sm:text-right space-y-1">
                <h4 class="font-bold text-sm text-slate-900 dark:text-white">${u.name}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${u.email || 'حساب بدون ایمیل'}</p>
                <div class="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <label for="input-avatar-file" class="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition shadow-sm">
                    آپلود عکس جدید
                  </label>
                  <span class="text-[10px] text-slate-400">حداکثر ۵ مگابایت (JPG, PNG)</span>
                </div>
              </div>
            </div>

            <!-- Profile Info Form -->
            <form id="profile-edit-form" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام و نام خانوادگی</label>
                  <input type="text" id="profile-name" value="${u.name || ''}" required class="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">واحد سازمانی</label>
                  <select id="profile-dept" class="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500">
                    <option value="مدیریت" ${u.department === 'مدیریت' ? 'selected' : ''}>مدیریت</option>
                    <option value="مهندسی" ${u.department === 'مهندسی' ? 'selected' : ''}>مهندسی</option>
                    <option value="مالی و حسابداری" ${u.department === 'مالی و حسابداری' ? 'selected' : ''}>مالی و حسابداری</option>
                    <option value="پشتیبانی" ${u.department === 'پشتیبانی' ? 'selected' : ''}>پشتیبانی</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نقش سازمانی کنونی</label>
                <div class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>${role.name}</span>
                  <span class="text-[10px] text-slate-400 font-normal">تعیین شده توسط مدیر سامانه</span>
                </div>
              </div>

              <!-- Telegram Bot Connection Box (Handshake & Notifications) -->
              <div class="p-3.5 rounded-2xl border transition-all ${isTelegramLinked ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800'}">
                <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">✈️</span>
                    <div>
                      <h4 class="text-xs font-extrabold ${isTelegramLinked ? 'text-emerald-900 dark:text-emerald-300' : 'text-sky-900 dark:text-sky-300'}">
                        اتصال به ربات تلگرام مانا
                      </h4>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">
                        ${isTelegramLinked ? 'اکانت تلگرام شما متصل است و اعلان‌ها به همراه دکمه تایید ارسال می‌گردد.' : 'برای دریافت اعلان‌ها و ثبت تاییدیه دریافت در تلگرام متصل شوید.'}
                      </p>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isTelegramLinked ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'}">
                    ${isTelegramLinked ? 'متصل شد' : 'عدم اتصال'}
                  </span>
                </div>

                ${isTelegramLinked ? `
                  <div class="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-900/60 text-xs">
                    <span class="text-slate-600 dark:text-slate-400 font-mono text-[11px]">Chat ID: ${u.telegramChatId}</span>
                    <button type="button" id="btn-unlink-telegram" class="text-rose-600 dark:text-rose-400 hover:underline font-bold text-[11px]">
                      قطع اتصال تلگرام
                    </button>
                  </div>
                ` : `
                  <div class="pt-2 border-t border-sky-100 dark:border-sky-900/60 space-y-2">
                    <div class="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-sky-200/60 dark:border-sky-800/60 text-xs">
                      <div>
                        <span class="text-slate-500 dark:text-slate-400 block text-[10px]">کد اختصاصی اتصال شما:</span>
                        <span class="font-mono font-black text-sm tracking-widest text-blue-600 dark:text-blue-400 select-all" id="text-auth-code">${u.telegramAuthCode || '------'}</span>
                      </div>
                      <button type="button" id="btn-copy-auth-code" class="px-3 py-1 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 font-bold text-[11px] hover:bg-sky-200 transition">
                        کپی کد
                      </button>
                    </div>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      کافیست وارد ربات شرکت در تلگرام شوید و دستور <code class="font-mono bg-white dark:bg-slate-800 px-1 rounded">/start ${u.telegramAuthCode || ''}</code> یا خود کد ۶ رقمی را ارسال نمایید.
                    </p>
                  </div>
                `}
              </div>

              <!-- Change Password Collapsible Section -->
              <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" id="btn-toggle-pwd-box" class="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                  ${renderIcon('shield', 'w-3.5 h-3.5')}
                  <span>تغییر رمز عبور حساب کاربری</span>
                </button>

                <div id="pwd-box" class="hidden mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رمز عبور فعلی</label>
                    <input type="password" id="profile-curr-pwd" placeholder="••••••••" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono" />
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رمز عبور جدید (حداقل ۶ کاراکتر)</label>
                      <input type="password" id="profile-new-pwd" placeholder="••••••••" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono" />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تکرار رمز عبور جدید</label>
                      <input type="password" id="profile-new-pwd-confirm" placeholder="••••••••" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Push Notification Status Section -->
              <div class="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl flex items-center justify-between flex-wrap gap-2.5">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    ${renderIcon('bell', 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <span class="text-xs font-bold text-slate-900 dark:text-white block">اعلان‌های بلادرنگ روی این دستگاه</span>
                    <span class="text-[10px] text-slate-500 dark:text-slate-400 block">دریافت زنگ و نوتیفیکیشن مرورگر</span>
                  </div>
                </div>
                <button type="button" id="btn-test-push" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm">
                  ${renderIcon('bellRing', 'w-3.5 h-3.5')}
                  <span>تست اعلان صوتی</span>
                </button>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" id="btn-profile-logout" class="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition">
                  خروج از این حساب
                </button>

                <div class="flex items-center gap-2">
                  <button type="button" id="btn-cancel-profile" class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                    انصراف
                  </button>
                  <button type="submit" id="btn-save-profile" class="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition">
                    ذخیره تغییرات
                  </button>
                </div>
              </div>
            </form>

          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('profile-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-profile')?.addEventListener('click', () => this.close());

    // Copy Auth Code
    document.getElementById('btn-copy-auth-code')?.addEventListener('click', () => {
      const code = document.getElementById('text-auth-code')?.innerText;
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          notificationEngine.triggerToast({
            title: 'کد کپی شد',
            message: `کد ${code} در کلیپ‌بورد کپی شد. اکنون آن را به ربات تلگرام بفرستید.`,
            type: 'success'
          });
        });
      }
    });

    // Unlink Telegram
    document.getElementById('btn-unlink-telegram')?.addEventListener('click', async () => {
      if (confirm('آیا مایل به قطع اتصال اکانت تلگرام از سامانه هستید؟')) {
        try {
          const token = localStorage.getItem('mana_user_token') || localStorage.getItem('token');
          const res = await fetch('/api/profile/telegram', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (data.user) {
            state.currentUser = data.user;
            this.render();
            notificationEngine.triggerToast({
              title: 'اتصال تلگرام قطع شد',
              message: 'حساب تلگرام شما از سامانه جدا گردید.',
              type: 'info'
            });
          }
        } catch (err) {
          alert('خطا در قطع اتصال تلگرام: ' + err.message);
        }
      }
    });

    // Toggle Password Box
    document.getElementById('btn-toggle-pwd-box')?.addEventListener('click', () => {
      document.getElementById('pwd-box')?.classList.toggle('hidden');
    });

    // Avatar File Picker & Instant Preview
    const avatarInput = document.getElementById('input-avatar-file');
    avatarInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert('حجم عکس نباید بیشتر از ۵ مگابایت باشد.');
          return;
        }
        this.selectedAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (re) => {
          this.avatarPreviewUrl = re.target.result;
          const previewImg = document.getElementById('avatar-preview-img');
          if (previewImg) previewImg.src = this.avatarPreviewUrl;
        };
        reader.readAsDataURL(file);
      }
    });

    // Test Web-Push Notification
    document.getElementById('btn-test-push')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-push');
      btn.disabled = true;
      btn.innerHTML = 'در حال ارسال تست...';
      try {
        if (state.serverProvider && state.serverProvider.isLoggedIn()) {
          await state.serverProvider.testPushNotification();
          notificationEngine.triggerToast({
            title: 'سیگنال تست ارسال شد',
            message: `اعلان به دستگاه‌های ثبت‌شده شما با موفقیت ارسال گردید.`,
            type: 'success'
          });
        }
      } catch (err) {
        alert('خطا در تست پوش: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'تست اعلان صوتی';
      }
    });

    // Logout
    document.getElementById('btn-profile-logout')?.addEventListener('click', () => {
      if (confirm('آیا مایل به خروج از حساب کاربری هستید؟')) {
        state.logout();
        this.close();
      }
    });

    // Submit Form
    const form = document.getElementById('profile-edit-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name').value.trim();
      const department = document.getElementById('profile-dept').value.trim();
      const currentPassword = document.getElementById('profile-curr-pwd')?.value || '';
      const newPassword = document.getElementById('profile-new-pwd')?.value || '';
      const confirmPassword = document.getElementById('profile-new-pwd-confirm')?.value || '';

      if (newPassword) {
        if (newPassword.length < 6) {
          alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
          return;
        }
        if (newPassword !== confirmPassword) {
          alert('رمز عبور جدید و تکرار آن یکسان نیستند.');
          return;
        }
      }

      const saveBtn = document.getElementById('btn-save-profile');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'در حال ذخیره...';

      try {
        if (this.selectedAvatarFile) {
          const avatarRes = await state.serverProvider.uploadAvatar(this.selectedAvatarFile);
          if (avatarRes && avatarRes.user) {
            state.currentUser = avatarRes.user;
          }
        }

        const updates = { name, department };
        if (newPassword) {
          updates.currentPassword = currentPassword;
          updates.newPassword = newPassword;
        }

        const updatedUser = await state.serverProvider.updateProfile(updates);
        if (updatedUser) {
          state.currentUser = updatedUser;
        }

        notificationEngine.triggerToast({
          title: 'پروفایل با موفقیت ویرایش شد',
          message: 'تغییرات شما ذخیره گردید.',
          type: 'success'
        });

        this.close();
        state.emit('user_changed', state.currentUser);
      } catch (err) {
        alert('خطا در ذخیره پروفایل: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = 'ذخیره تغییرات';
        }
      }
    });
  }
}
