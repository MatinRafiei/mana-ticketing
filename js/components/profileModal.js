// User Profile Modal Component (Edit Name, Upload Avatar, Change Password & Push Notification Status)

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
      avatar: './icons/company_logo.png'
    };
    const role = state.getCurrentUserRole();
    const displayAvatar = this.avatarPreviewUrl || u.avatar || './icons/company_logo.png';

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
                  <input type="text" id="profile-dept" value="${u.department || ''}" placeholder="مثال: توسعه نرم‌افزار" class="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">ایمیل حساب (غیرقابل تغییر)</label>
                  <input type="text" disabled value="${u.email || ''}" class="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-500 font-mono" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">نقش سازمانی</label>
                  <input type="text" disabled value="${role.name || 'پرسنل'}" class="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-500" />
                </div>
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
                    <span class="text-[10px] text-slate-500 dark:text-slate-400 block">دریافت زنگ و نوتیفیکیشن حتی با بسته بودن تب مرورگر</span>
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
          const res = await state.serverProvider.testPushNotification();
          notificationEngine.triggerToast({
            title: 'سیگنال تست ارسال شد',
            message: `اعلان به دستگاه‌های ثبت‌شده شما با موفقیت ارسال گردید.`,
            type: 'success'
          });
        } else {
          notificationEngine.notify({
            title: 'تست موفق اعلان محلی مانا',
            message: 'صدا و اعلان سامانه روی مرورگر شما به درستی کار می‌کند.',
            soundName: 'complete'
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
      const saveBtn = document.getElementById('btn-save-profile');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'در حال ذخیره...';

      try {
        const name = document.getElementById('profile-name').value.trim();
        const department = document.getElementById('profile-dept').value.trim();
        const currPwd = document.getElementById('profile-curr-pwd')?.value;
        const newPwd = document.getElementById('profile-new-pwd')?.value;
        const confirmPwd = document.getElementById('profile-new-pwd-confirm')?.value;

        if (newPwd) {
          if (newPwd !== confirmPwd) {
            alert('رمز عبور جدید و تکرار آن یکسان نیستند.');
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'ذخیره تغییرات';
            return;
          }
          if (newPwd.length < 6) {
            alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'ذخیره تغییرات';
            return;
          }
        }

        // 1. Upload avatar if changed
        let uploadedAvatarUrl = null;
        if (this.selectedAvatarFile && state.serverProvider && state.serverProvider.isLoggedIn()) {
          try {
            uploadedAvatarUrl = await state.serverProvider.uploadAvatar(this.selectedAvatarFile);
          } catch (uploadErr) {
            console.warn('Avatar upload failed, falling back to base64 preview:', uploadErr);
            uploadedAvatarUrl = this.avatarPreviewUrl;
          }
        } else if (this.avatarPreviewUrl) {
          uploadedAvatarUrl = this.avatarPreviewUrl;
        }

        // 2. Update profile on server
        if (state.serverProvider && state.serverProvider.isLoggedIn()) {
          const updatePayload = { name, department };
          if (uploadedAvatarUrl) updatePayload.avatar = uploadedAvatarUrl;
          if (newPwd) {
            updatePayload.currentPassword = currPwd;
            updatePayload.newPassword = newPwd;
          }
          await state.serverProvider.updateProfile(updatePayload);
        }

        // 3. Update local state
        if (state.currentUser) {
          state.currentUser.name = name;
          state.currentUser.department = department;
          if (uploadedAvatarUrl) state.currentUser.avatar = uploadedAvatarUrl;
          state.currentUser.initials = name.split(' ').map(p => p[0]).join('‌');
          state.persistLocal();
          state.emit('user_changed', state.currentUser);
          state.emit('state_updated');
        }

        notificationEngine.triggerToast({
          title: 'پروفایل بروزرسانی شد',
          message: 'تغییرات مشخصات کاربری شما با موفقیت ثبت گردید.',
          type: 'success'
        });

        this.close();
      } catch (err) {
        alert(err.message || 'خطا در ثبت تغییرات');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = 'ذخیره تغییرات';
        }
      }
    });
  }
}
