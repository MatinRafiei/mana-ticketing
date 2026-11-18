// Management & Roles Tab: Fully Responsive Analytics, Mobile Cards, RBAC Controls, & Telegram Deliveries Tracking

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { formatJalali, formatRelative, getDeadlineStatus, toPersianDigits } from '../utils/jalali.js';
import { notificationEngine } from '../notifications.js';

export class AdminTabComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeSection = 'overview'; // overview, deliveries, announcements, roles, users
    this.isCreatingRole = false;
    this.isAddingUser = false;
    this.deliveries = [];
    this.isLoadingDeliveries = false;
    this.draftUser = { name: '', email: '', department: '', roleId: 'member' };
    this.draftRole = { name: '', description: '', permissions: ['create_ticket'] };

    // Auto-refresh deliveries when active tab is deliveries
    state.subscribe((eventType) => {
      if (this.activeSection === 'deliveries' && (eventType === 'state_updated' || eventType === 'delivery_acknowledged')) {
        this.fetchDeliveries();
      }
    });
  }

  async fetchDeliveries() {
    this.isLoadingDeliveries = true;
    try {
      const token = localStorage.getItem('mana_user_token') || localStorage.getItem('token');
      const res = await fetch('/api/deliveries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        this.deliveries = await res.json();
      }
    } catch (err) {
      console.warn('Fetch deliveries notice:', err);
    } finally {
      this.isLoadingDeliveries = false;
      this.render();
    }
  }

  render() {
    if (!this.container) return;

    const totalTickets = state.tickets.length;
    const inProgress = state.tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting').length;
    const resolved = state.tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const overdue = state.tickets.filter(t => {
      const isNotClosed = t.status !== 'resolved' && t.status !== 'closed';
      return isNotClosed && t.deadline && new Date(t.deadline) < new Date();
    }).length;

    const resolutionRate = totalTickets > 0 ? Math.round((resolved / totalTickets) * 100) : 0;

    this.container.innerHTML = `
      <div class="space-y-4 sm:space-y-6 pb-20 md:pb-6">

        <!-- Top Header & Sub-Tabs -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              ${renderIcon('shield', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white">پنل مدیریت و پایش تیکتینگ</h2>
              <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">نظارت بر تیکت‌ها، اعلانات تلگرام و تایید دریافت</p>
            </div>
          </div>

          <!-- Section Switcher -->
          <div class="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl min-w-max">
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'overview' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="overview">
                پایش تیکت‌ها
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'deliveries' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="deliveries">
                پایش اعلانات و تلگرام
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'announcements' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="announcements">
                بخشنامه و اعلانات
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'roles' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="roles">
                نقش‌ها
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'users' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="users">
                پرسنل
              </button>
            </div>
          </div>
        </div>

        <!-- Section 1: Overview & Master Tickets -->
        ${this.activeSection === 'overview' ? `
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm">
              <span class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 block mb-1">کل تیکت‌ها</span>
              <div class="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">${toPersianDigits(totalTickets)}</div>
              <span class="text-[10px] text-slate-400 mt-0.5 block">در کل سازمان</span>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm">
              <span class="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 block mb-1">در دست اقدام</span>
              <div class="text-xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">${toPersianDigits(inProgress)}</div>
              <span class="text-[10px] text-slate-400 mt-0.5 block">نیاز به پیگیری</span>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm">
              <span class="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 block mb-1">تاخیر خورده (SLA)</span>
              <div class="text-xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">${toPersianDigits(overdue)}</div>
              <span class="text-[10px] text-rose-500 mt-0.5 block font-medium">${overdue > 0 ? 'اقدام فوری!' : 'نرمال'}</span>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm">
              <span class="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 block mb-1">حل شده</span>
              <div class="text-xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">${toPersianDigits(resolved)}</div>
              <span class="text-[10px] text-emerald-600 mt-0.5 block font-bold">${toPersianDigits(resolutionRate)}٪ نرخ موفقیت</span>
            </div>
          </div>

          <!-- Master Tickets Container -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
            <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">جدول و تاریخچه گردش تیکت‌ها</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">پیشرفت، مهلت‌ها و مسئولین</p>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-right text-xs">
                <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th class="py-3 px-4 font-bold">شناسه و عنوان تیکت</th>
                    <th class="py-3 px-4 font-bold">ارجاع گیرنده</th>
                    <th class="py-3 px-4 font-bold">وضعیت</th>
                    <th class="py-3 px-4 font-bold">اولویت</th>
                    <th class="py-3 px-4 font-bold">مهلت</th>
                    <th class="py-3 px-4 font-bold text-center">مشاهده</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${state.tickets.map(t => {
                    const assignee = state.getUser(t.assigneeId);
                    return `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <span class="font-mono text-[10px] text-blue-600 block">${t.id}</span>
                          ${t.title}
                        </td>
                        <td class="py-3 px-4 text-slate-700 dark:text-slate-300">${assignee ? assignee.name : 'نامشخص'}</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold status-badge-${t.status}">${state.getStatusLabel(t.status)}</span>
                        </td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-400">${state.getPriorityLabel(t.priority)}</td>
                        <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${t.deadline ? formatJalali(t.deadline) : '-'}</td>
                        <td class="py-3 px-4 text-center">
                          <button class="master-view-btn px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-100 transition" data-id="${t.id}">
                            نمایش
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- Section 2: Deliveries & Handshake Interaction Tracking -->
        ${this.activeSection === 'deliveries' ? `
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
            <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>✈️ پایش ارسال و تاییدیه دریافت پیام‌ها در تلگرام</span>
                  <span class="px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full">هندشیک فعال</span>
                </h3>
                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">مشاهده لحظه‌ای وضعیت رویت و لمس دکمه «مشاهده شد» توسط پرسنل</p>
              </div>
              <button id="btn-refresh-deliveries" class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                ${renderIcon('refresh', 'w-3.5 h-3.5')}
                <span>بروزرسانی وضعیت</span>
              </button>
            </div>

            <div>
              ${this.deliveries.length === 0 ? `
                <div class="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  هنوز اعلانی ثبت نشده است یا در حال بارگذاری داده‌ها می‌باشد.
                </div>
              ` : `
                <div class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${this.deliveries.map(group => `
                    <div class="p-4 sm:p-5 space-y-3">
                      <div class="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${group.type === 'announcement' ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}">
                              ${group.type === 'announcement' ? 'بخشنامه سازمانی' : 'تیکت'}
                            </span>
                            <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">${group.title}</h4>
                          </div>
                          <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>✍️ ثبت‌کننده: <strong class="text-slate-700 dark:text-slate-200">${group.creatorName || (state.getUser(group.creatorId)?.name) || 'مدیریت سامانه'}</strong></span>
                          </div>
                          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${group.message}</p>
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono">${formatJalali(group.createdAt)}</span>
                      </div>

                      <!-- Recipients delivery status chips -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        ${group.recipients.map(r => `
                          <div class="p-2.5 rounded-xl border flex items-center justify-between gap-2 ${r.status === 'acknowledged' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}">
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-1.5">
                                <span class="font-bold text-xs text-slate-900 dark:text-white truncate">${r.userName}</span>
                                ${r.telegramChatId ? '<span class="text-[10px] text-sky-500" title="دارای تلگرام">✈️</span>' : '<span class="text-[9px] text-slate-400">(فاقد تلگرام)</span>'}
                              </div>
                              <div class="text-[10px] ${r.status === 'acknowledged' ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-amber-700 dark:text-amber-300'}">
                                ${r.status === 'acknowledged' ? `✅ تایید شد: ${formatRelative(r.acknowledgedAt)}${r.acknowledgedVia === 'reply' ? ' (با ارسال پاسخ)' : ''}` : `⏳ در انتظار تایید (${toPersianDigits(r.resendCount || 0)} بار یادآوری)`}
                              </div>
                            </div>

                            ${r.status !== 'acknowledged' && r.telegramChatId ? `
                              <button class="btn-resend-reminder px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition shrink-0" data-del-id="${group.id}" data-user-id="${r.userId}">
                                یادآوری فوری
                              </button>
                            ` : ''}
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- Section 3: Create Announcement -->
        ${this.activeSection === 'announcements' ? `
          <div class="space-y-4">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 shadow-sm space-y-4">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📢 ارسال بخشنامه و اعلان رسمی درون‌سازمانی</span>
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">پیام به تلگرام و نوتیفیکیشن گوشی پرسنل ارسال شده و تاییدیه رویت ثبت می‌گردد.</p>
              </div>

              <form id="announcement-form" class="space-y-3.5">
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان بخشنامه / اطلاعیه <span class="text-rose-500">*</span></label>
                  <input type="text" id="ann-title" required placeholder="مثال: جلسه عمومی روز سه‌شنبه ساعت ۱۰" class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">گیرندگان (واحد سازمانی)</label>
                    <select id="ann-dept" class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white">
                      <option value="all">تمام پرسنل سازمان</option>
                      <option value="مدیریت">مدیریت</option>
                      <option value="مهندسی">مهندسی</option>
                      <option value="مالی و حسابداری">مالی و حسابداری</option>
                      <option value="پشتیبانی">پشتیبانی</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">درجه اهمیت</label>
                    <select id="ann-priority" class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white">
                      <option value="normal">عادی</option>
                      <option value="high">مهم</option>
                      <option value="urgent">فوری و اضطراری</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">متن کامل اطلاعیه <span class="text-rose-500">*</span></label>
                  <textarea id="ann-content" required rows="4" placeholder="متن پیام و نکات الزامی را اینجا بنویسید..." class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-blue-500"></textarea>
                </div>

                <div class="flex items-center justify-end pt-2">
                  <button type="submit" id="btn-submit-ann" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-1.5">
                    ${renderIcon('send', 'w-4 h-4')}
                    <span>ارسال بخشنامه و دریافت تاییدیه</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ` : ''}

        <!-- Section 4: Roles Directory -->
        ${this.activeSection === 'roles' ? `
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">نقش‌ها و سطوح دسترسی (RBAC)</h3>
                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">تعریف عناوین شغلی و اختیارات</p>
              </div>
              <button id="btn-show-create-role" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                ${renderIcon('plus', 'w-4 h-4')}
                افزودن نقش جدید
              </button>
            </div>

            <!-- Add Role Form -->
            <div id="create-role-box" class="${this.isCreatingRole ? 'block' : 'hidden'} bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 sm:p-5">
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-3">تعریف نقش سازمانی جدید</h4>
              <form id="new-role-form" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام نقش <span class="text-rose-500">*</span></label>
                    <input type="text" id="role-name" required placeholder="مثال: سرپرست انبار" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شرح وظایف</label>
                    <input type="text" id="role-desc" placeholder="توضیح کوتاه درباره دسترسی‌ها" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                </div>

                <div class="pt-2">
                  <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">مجوزهای مجاز برای این نقش:</span>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="create_ticket" checked class="rounded text-blue-600" />
                      <span>ثبت تیکت</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="view_all_tickets" class="rounded text-blue-600" />
                      <span>مشاهده همه تیکت‌ها</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="edit_all_tickets" class="rounded text-blue-600" />
                      <span>ویرایش تیکت‌های دیگران</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="manage_announcements" class="rounded text-blue-600" />
                      <span>ارسال بخشنامه و اعلانات</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="view_reports" class="rounded text-blue-600" />
                      <span>پایش اعلانات و تلگرام</span>
                    </label>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                  <button type="button" id="btn-cancel-create-role" class="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl">انصراف</button>
                  <button type="submit" class="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold">ثبت نقش</button>
                </div>
              </form>
            </div>

            <!-- Roles Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              ${state.roles.map(r => `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                        ${r.name.slice(0, 1)}
                      </div>
                      <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">${r.name}</h4>
                    </div>
                    ${!r.isSystem && r.id !== 'admin' ? `
                      <button class="btn-delete-role p-1 text-slate-400 hover:text-rose-600 rounded-lg transition" data-role-id="${r.id}" data-role-name="${r.name}">
                        ${renderIcon('trash', 'w-4 h-4')}
                      </button>
                    ` : '<span class="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">سیستمی</span>'}
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">${r.description || 'بدون شرح'}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Section 5: Users Directory -->
        ${this.activeSection === 'users' ? `
          <div class="space-y-4">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">اعضای تیم و پرسنل</h3>
                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">تخصیص نقش‌ها، ایمیل و وضعیت اتصال تلگرام</p>
              </div>
              <button id="btn-show-add-user" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                ${renderIcon('plus', 'w-4 h-4')}
                افزودن عضو جدید
              </button>
            </div>

            <!-- Add User Form -->
            <div id="add-user-box" class="${this.isAddingUser ? 'block' : 'hidden'} bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 sm:p-5">
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-3">افزودن همکار به سامانه</h4>
              <form id="new-user-form" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام و نام خانوادگی <span class="text-rose-500">*</span></label>
                    <input type="text" id="user-name" required placeholder="مثال: رضا صادقی" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ایمیل یا جیمیل <span class="text-rose-500">*</span></label>
                    <input type="email" id="user-email" required placeholder="name@company.com" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-mono" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">واحد سازمانی</label>
                    <select id="user-dept" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white">
                      <option value="مدیریت">مدیریت</option>
                      <option value="مهندسی">مهندسی</option>
                      <option value="مالی و حسابداری">مالی و حسابداری</option>
                      <option value="پشتیبانی" selected>پشتیبانی</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نقش سازمانی</label>
                    <select id="user-role-select" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white">
                      ${state.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button type="button" id="btn-cancel-add-user" class="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl">انصراف</button>
                  <button type="submit" class="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold">ثبت همکار</button>
                </div>
              </form>
            </div>

            <!-- Users Table -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
              <div class="overflow-x-auto">
                <table class="w-full text-right text-xs">
                  <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th class="py-3 px-4 font-bold">عضو تیم</th>
                      <th class="py-3 px-4 font-bold">ایمیل سازمانی</th>
                      <th class="py-3 px-4 font-bold">واحد</th>
                      <th class="py-3 px-4 font-bold">وضعیت تلگرام</th>
                      <th class="py-3 px-4 font-bold">تغییر نقش</th>
                      <th class="py-3 px-4 font-bold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${state.users.map(user => `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div class="flex items-center gap-2">
                            <img src="${user.avatar}" class="w-8 h-8 rounded-full object-cover" />
                            <span>${user.name}</span>
                          </div>
                        </td>
                        <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">${user.email}</td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${user.department}</td>
                        <td class="py-3 px-4">
                          ${user.telegramChatId ? `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <span>✈️ متصل</span>
                            </span>
                          ` : `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              <span>عدم اتصال (کد: ${user.telegramAuthCode || '-'})</span>
                            </span>
                          `}
                        </td>
                        <td class="py-3 px-4">
                          <select class="role-changer-select text-xs px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" data-user-id="${user.id}">
                            ${state.roles.map(r => `
                              <option value="${r.id}" ${r.id === user.roleId ? 'selected' : ''}>${r.name.split(' ')[0]}</option>
                            `).join('')}
                          </select>
                        </td>
                        <td class="py-3 px-4 text-center">
                          ${state.users.length > 1 ? `
                            <button class="btn-delete-user p-1 text-slate-400 hover:text-rose-600 rounded-lg transition" data-user-id="${user.id}" data-user-name="${user.name}" title="حذف کاربر">
                              ${renderIcon('trash', 'w-4 h-4')}
                            </button>
                          ` : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.admin-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSection = btn.getAttribute('data-sec');
        if (this.activeSection === 'deliveries') {
          this.fetchDeliveries();
        } else {
          this.render();
        }
      });
    });

    document.getElementById('btn-refresh-deliveries')?.addEventListener('click', () => {
      this.fetchDeliveries();
    });

    // Manual Resend Reminder Button
    this.container.querySelectorAll('.btn-resend-reminder').forEach(btn => {
      btn.addEventListener('click', async () => {
        const delId = btn.getAttribute('data-del-id');
        const userId = btn.getAttribute('data-user-id');
        btn.disabled = true;
        btn.innerHTML = 'در حال ارسال...';
        try {
          const token = localStorage.getItem('mana_user_token') || localStorage.getItem('token');
          const res = await fetch(`/api/deliveries/${delId}/resend/${userId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok) {
            notificationEngine.triggerToast({
              title: 'یادآوری ارسال شد',
              message: 'پیام مجدد به تلگرام همکار ارسال گردید.',
              type: 'success'
            });
            this.fetchDeliveries();
          } else {
            alert(data.error || 'خطا در ارسال یادآوری');
          }
        } catch (err) {
          alert('خطا در برقراری ارتباط: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'یادآوری فوری';
        }
      });
    });

    // Create Announcement Submit
    const annForm = document.getElementById('announcement-form');
    annForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('ann-title').value.trim();
      const targetDepartment = document.getElementById('ann-dept').value;
      const priority = document.getElementById('ann-priority').value;
      const content = document.getElementById('ann-content').value.trim();

      const submitBtn = document.getElementById('btn-submit-ann');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'در حال ارسال بخشنامه...';

      try {
        const token = localStorage.getItem('mana_user_token') || localStorage.getItem('token');
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, content, targetDepartment, priority })
        });
        const data = await res.json();
        if (res.ok) {
          notificationEngine.triggerToast({
            title: 'بخشنامه با موفقیت ارسال شد',
            message: 'پیام در تلگرام پرسنل با دکمه تاییدیه ارسال گردید.',
            type: 'success'
          });
          this.activeSection = 'deliveries';
          this.fetchDeliveries();
        } else {
          alert(data.error || 'خطا در ارسال بخشنامه');
        }
      } catch (err) {
        alert('خطا در برقراری ارتباط: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'ارسال بخشنامه و دریافت تاییدیه';
        }
      }
    });

    // Master View Ticket buttons
    this.container.querySelectorAll('.master-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticketId = btn.getAttribute('data-id');
        if (ticketId) {
          state.activeTicketId = ticketId;
          state.emit('open_ticket_detail', ticketId);
        }
      });
    });

    // Toggle Role Form
    document.getElementById('btn-show-create-role')?.addEventListener('click', () => {
      this.isCreatingRole = !this.isCreatingRole;
      this.render();
    });

    document.getElementById('btn-cancel-create-role')?.addEventListener('click', () => {
      this.isCreatingRole = false;
      this.render();
    });

    // Submit New Role
    const roleForm = document.getElementById('new-role-form');
    roleForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('role-name').value.trim();
      const description = document.getElementById('role-desc').value.trim();
      const checkedBoxes = Array.from(roleForm.querySelectorAll('input[name="role_perm"]:checked'));
      const permissions = checkedBoxes.map(cb => cb.value);

      if (!name) return;

      await state.createRole({ name, description, permissions });
      notificationEngine.triggerToast({
        title: 'نقش جدید ثبت شد',
        message: `نقش "${name}" با موفقیت اضافه شد.`,
        type: 'success'
      });
      this.isCreatingRole = false;
      this.render();
    });

    // Toggle Add User
    document.getElementById('btn-show-add-user')?.addEventListener('click', () => {
      this.isAddingUser = !this.isAddingUser;
      this.render();
    });

    document.getElementById('btn-cancel-add-user')?.addEventListener('click', () => {
      this.isAddingUser = false;
      this.render();
    });

    // Submit New User
    const userForm = document.getElementById('new-user-form');
    userForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const department = document.getElementById('user-dept').value.trim();
      const roleId = document.getElementById('user-role-select').value;

      await state.addUser({ name, email, department, roleId });

      notificationEngine.triggerToast({
        title: 'عضو جدید اضافه شد',
        message: `${name} با نقش انتخاب شده افزوده شد.`,
        type: 'success'
      });
      this.isAddingUser = false;
      this.render();
    });

    // Role changer dropdown
    this.container.querySelectorAll('.role-changer-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const userId = sel.getAttribute('data-user-id');
        const newRoleId = sel.value;
        await state.updateUserRole(userId, newRoleId);
        notificationEngine.triggerToast({
          title: 'نقش کاربر بروز شد',
          message: `نقش جدید با موفقیت اعمال گردید.`,
          type: 'info'
        });
      });
    });

    // Delete User
    this.container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute('data-user-id');
        const userName = btn.getAttribute('data-user-name') || 'همکار';
        if (confirm(`آیا از حذف «${userName}» از سیستم اطمینان دارید؟`)) {
          try {
            await state.deleteUser(userId);
            this.render();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });
  }
}
