// User Login Modal Component for Persian In-Company Ticketing

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { notificationEngine } from '../notifications.js';

export class LoginModalComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  open() {
    this.render();
  }

  close() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div id="login-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">

          <!-- Header -->
          <div class="text-center space-y-2">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white dark:bg-slate-800 p-2 mx-auto border border-slate-200 dark:border-slate-700 shadow-md">
              <img src="./icons/company_logo.png" alt="لوگو مانا" class="w-full h-full object-contain" />
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">ورود به سامانه تیکتینگ مانا</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">سیستم هماهنگی کارها و اعلان‌های بلادرنگ سازمانی</p>
          </div>

          <div id="login-form-error" class="hidden p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs"></div>

          <!-- Form -->
          <form id="client-login-form" class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ایمیل یا جیمیل سازمانی</label>
              <input type="email" id="login-email-input" required placeholder="name@company.com" class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رمز عبور</label>
              <input type="password" id="login-pwd-input" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono focus:ring-2 focus:ring-blue-500" />
              <span class="text-[10px] text-slate-400 mt-1 block">رمز عبور توسط مدیر سرور به شما اختصاص می‌یابد.</span>
            </div>

            <button type="submit" id="btn-submit-client-login" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition">
              ورود به حساب کاربری
            </button>
          </form>

          <!-- Superadmin link & Footer -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>مدیر ارشد سرور هستید؟</span>
            <a href="./superadmin.html" class="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
              ${renderIcon('shield', 'w-3.5 h-3.5')}
              ورود به پنل سرور
            </a>
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const form = document.getElementById('client-login-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email-input').value.trim();
      const password = document.getElementById('login-pwd-input').value;
      const errBox = document.getElementById('login-form-error');
      const submitBtn = document.getElementById('btn-submit-client-login');

      errBox.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'در حال بررسی...';

      try {
        await state.loginWithServer(email, password);
        this.close();
        notificationEngine.triggerToast({
          title: `خوش آمدید ${state.currentUser?.name || ''}`,
          message: 'اتصال به سرور لینوکس و سیستم اعلان بلادرنگ برقرار گردید.',
          type: 'success'
        });
      } catch (err) {
        errBox.textContent = err.message || 'خطا در ورود';
        errBox.classList.remove('hidden');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'ورود به حساب کاربری';
        }
      }
    });
  }
}
