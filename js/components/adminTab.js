// Management & Roles Tab: Fully Responsive Analytics, Mobile Cards & RBAC Controls

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { formatJalali, formatRelative, getDeadlineStatus, toPersianDigits } from '../utils/jalali.js';
import { notificationEngine } from '../notifications.js';

export class AdminTabComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeSection = 'overview'; // overview, roles, users
    this.isCreatingRole = false;
    this.isAddingUser = false;
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

        <!-- Top Header & Horizontal Scrollable Sub-Tabs -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              ${renderIcon('shield', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white">پنل مدیریت و پایش</h2>
              <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">نظارت بر تیکت‌ها، نقش‌ها و دسترسی‌ها</p>
            </div>
          </div>

          <!-- Section Switcher (Scrollable on small mobile screens) -->
          <div class="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl min-w-max">
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'overview' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="overview">
                پایش تیکت‌ها
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'roles' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="roles">
                نقش‌ها و دسترسی
              </button>
              <button class="admin-sec-btn px-3 py-1.5 text-xs font-bold rounded-xl transition ${this.activeSection === 'users' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}" data-sec="users">
                پرسنل و همکاران
              </button>
            </div>
          </div>
        </div>

        <!-- Section 1: Overview & Master Tickets -->
        ${this.activeSection === 'overview' ? `
          <!-- KPI Metrics Row -->
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
              <div class="flex items-center gap-2 flex-wrap">
                <button id="btn-clear-demo-tickets" class="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition flex items-center gap-1">
                  ${renderIcon('trash', 'w-3.5 h-3.5')}
                  <span>پاک‌سازی تیکت‌های دمو</span>
                </button>
                <button id="btn-export-data" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1">
                  ${renderIcon('download', 'w-3.5 h-3.5 text-slate-500')}
                  <span>خروجی JSON</span>
                </button>
              </div>
            </div>

            <!-- Mobile View: Responsive Cards List -->
            <div class="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2">
              ${state.tickets.map(ticket => {
                const assignee = state.getUser(ticket.assigneeId);
                const deadlineInfo = getDeadlineStatus(ticket.deadline);
                return `
                  <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <span class="font-mono text-[10px] font-bold text-slate-500">${ticket.id}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md font-bold status-badge-${ticket.status}">${state.getStatusLabel(ticket.status)}</span>
                      </div>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${deadlineInfo.badgeClass}">${deadlineInfo.label}</span>
                    </div>

                    <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${ticket.title}</div>

                    <div class="flex items-center justify-between text-[11px] text-slate-500">
                      <div class="flex items-center gap-1.5">
                        <img src="${assignee?.avatar}" class="w-4 h-4 rounded-full object-cover" />
                        <span>${assignee?.name}</span>
                      </div>
                      <button class="text-blue-600 dark:text-blue-400 font-bold hover:underline master-view-btn" data-id="${ticket.id}">
                        بررسی و تاریخچه
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Desktop View: Full Table -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-right text-xs">
                <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th class="py-3 px-4 font-bold">کد</th>
                    <th class="py-3 px-4 font-bold">عنوان تیکت</th>
                    <th class="py-3 px-4 font-bold">مسئول انجام</th>
                    <th class="py-3 px-4 font-bold">ایجادکننده</th>
                    <th class="py-3 px-4 font-bold">وضعیت</th>
                    <th class="py-3 px-4 font-bold">اولویت</th>
                    <th class="py-3 px-4 font-bold">مهلت</th>
                    <th class="py-3 px-4 font-bold">پاسخ‌ها</th>
                    <th class="py-3 px-4 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${state.tickets.map(ticket => {
                    const assignee = state.getUser(ticket.assigneeId);
                    const creator = state.getUser(ticket.creatorId);
                    const deadlineInfo = getDeadlineStatus(ticket.deadline);
                    return `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td class="py-3 px-4 font-mono font-bold text-slate-600 dark:text-slate-300">${ticket.id}</td>
                        <td class="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title="${ticket.title}">${ticket.title}</td>
                        <td class="py-3 px-4">
                          <div class="flex items-center gap-1.5">
                            <img src="${assignee?.avatar}" class="w-5 h-5 rounded-full object-cover" />
                            <span>${assignee?.name}</span>
                          </div>
                        </td>
                        <td class="py-3 px-4 text-slate-500">${creator?.name}</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold status-badge-${ticket.status}">
                            ${state.getStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold priority-${ticket.priority}">
                            ${state.getPriorityLabel(ticket.priority)}
                          </span>
                        </td>
                        <td class="py-3 px-4">
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg ${deadlineInfo.badgeClass}">
                            ${deadlineInfo.label}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-slate-500 font-bold">${toPersianDigits(ticket.replies?.length || 0)}</td>
                        <td class="py-3 px-4">
                          <button class="text-blue-600 dark:text-blue-400 hover:underline font-bold master-view-btn" data-id="${ticket.id}">
                            بررسی
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

        <!-- Section 2: Roles & Permissions -->
        ${this.activeSection === 'roles' ? `
          <div class="space-y-4 sm:space-y-6">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">نقش‌ها و دسترسی‌های سازمانی</h3>
                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">تعریف نقش‌های اختصاصی و سطوح دسترسی</p>
              </div>
              <button id="btn-show-create-role" class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20">
                ${renderIcon('plus', 'w-4 h-4')}
                تعریف نقش جدید
              </button>
            </div>

            <!-- Create New Role Box -->
            <div id="create-role-box" class="${this.isCreatingRole ? 'block' : 'hidden'} bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-3">تعریف نقش سفارشی جدید</h4>
              <form id="new-role-form" class="space-y-3 sm:space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام نقش <span class="text-rose-500">*</span></label>
                    <input type="text" id="role-name" required placeholder="مثال: کارشناس ارشد، بازرس..." class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">توضیحات</label>
                    <input type="text" id="role-desc" placeholder="توضیح مسئولیت‌های نقش..." class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">مجوزها و دسترسی‌ها:</label>
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="view_all_tickets" class="rounded text-blue-600 focus:ring-blue-500" />
                      مشاهده همه تیکت‌ها
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="create_ticket" checked class="rounded text-blue-600 focus:ring-blue-500" />
                      ثبت تیکت جدید
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="edit_all_tickets" class="rounded text-blue-600 focus:ring-blue-500" />
                      ویرایش تیکت دیگران
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="delete_ticket" class="rounded text-blue-600 focus:ring-blue-500" />
                      حذف تیکت
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="reassign_ticket" class="rounded text-blue-600 focus:ring-blue-500" />
                      ارجاع مجدد
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="manage_roles" class="rounded text-blue-600 focus:ring-blue-500" />
                      مدیریت نقش‌ها
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="manage_users" class="rounded text-blue-600 focus:ring-blue-500" />
                      مدیریت کاربران
                    </label>
                    <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" name="role_perm" value="view_reports" class="rounded text-blue-600 focus:ring-blue-500" />
                      مشاهده گزارشات
                    </label>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button type="button" id="btn-cancel-create-role" class="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition">
                    انصراف
                  </button>
                  <button type="submit" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20">
                    ذخیره نقش
                  </button>
                </div>
              </form>
            </div>

            <!-- Existing Roles Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              ${state.roles.map(r => `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5">
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">${r.name}</h4>
                        ${r.isSystem ? `<span class="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-md">سیستمی</span>` : `<span class="bg-emerald-100 dark:bg-emerald-950/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">سفارشی</span>`}
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">${r.description}</p>
                    </div>
                  </div>

                  <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span class="text-[10px] font-bold text-slate-400 block mb-1">مجوزها:</span>
                    <div class="flex flex-wrap gap-1">
                      ${r.id === 'admin' ? `
                        <span class="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md">دسترسی تام به کلیه بخش‌ها</span>
                      ` : (r.permissions || []).map(p => `
                        <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                          ${this.getPermLabel(p)}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Section 3: Users Directory -->
        ${this.activeSection === 'users' ? `
          <div class="space-y-4 sm:space-y-6">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">اعضای تیم و پرسنل</h3>
                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">تخصیص نقش‌ها و ایمیل‌های حساب گوگل</p>
              </div>
              <button id="btn-show-add-user" class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20">
                ${renderIcon('plus', 'w-4 h-4')}
                افزودن عضو جدید
              </button>
            </div>

            <!-- Add User Form -->
            <div id="add-user-box" class="${this.isAddingUser ? 'block' : 'hidden'} bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-3">افزودن همکار به سامانه</h4>
              <form id="new-user-form" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام و نام خانوادگی <span class="text-rose-500">*</span></label>
                    <input type="text" id="user-name" required placeholder="مثال: رضا صادقی" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ایمیل گوگل <span class="text-rose-500">*</span></label>
                    <input type="email" id="user-email" required placeholder="name@gmail.com" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">واحد سازمانی</label>
                    <input type="text" id="user-dept" placeholder="مثال: بازرگانی و فروش" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نقش سازمانی</label>
                    <select id="user-role-select" class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white">
                      ${state.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button type="button" id="btn-cancel-add-user" class="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition">
                    انصراف
                  </button>
                  <button type="submit" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20">
                    ثبت همکار
                  </button>
                </div>
              </form>
            </div>

            <!-- Users Directory List / Table -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
              <!-- Mobile Card View -->
              <div class="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2">
                ${state.users.map(user => `
                  <div class="p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <img src="${user.avatar}" class="w-7 h-7 rounded-full object-cover" />
                        <div>
                          <div class="font-bold text-xs text-slate-900 dark:text-white">${user.name}</div>
                          <div class="text-[10px] text-slate-400 font-mono">${user.email}</div>
                        </div>
                      </div>
                      <span class="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">${user.department}</span>
                    </div>

                    <div class="flex items-center justify-between pt-1">
                      <span class="text-[10px] text-slate-400 font-bold">نقش:</span>
                      <select class="role-changer-select text-xs px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" data-user-id="${user.id}">
                        ${state.roles.map(r => `
                          <option value="${r.id}" ${r.id === user.roleId ? 'selected' : ''}>${r.name.split(' ')[0]}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Desktop Table View -->
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-right text-xs">
                  <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th class="py-3 px-4 font-bold">عضو تیم</th>
                      <th class="py-3 px-4 font-bold">ایمیل سازمانی / گوگل</th>
                      <th class="py-3 px-4 font-bold">واحد</th>
                      <th class="py-3 px-4 font-bold">نقش کنونی</th>
                      <th class="py-3 px-4 font-bold">تغییر نقش</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${state.users.map(user => `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div class="flex items-center gap-2.5">
                            <img src="${user.avatar}" class="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200" />
                            <div>
                              <span>${user.name}</span>
                              <span class="text-[10px] text-slate-400 block">${user.initials}</span>
                            </div>
                          </div>
                        </td>
                        <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">${user.email}</td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${user.department}</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                            ${state.roles.find(r => r.id === user.roleId)?.name || 'عادی'}
                          </span>
                        </td>
                        <td class="py-3 px-4">
                          <select class="role-changer-select text-xs px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" data-user-id="${user.id}">
                            ${state.roles.map(r => `
                              <option value="${r.id}" ${r.id === user.roleId ? 'selected' : ''}>${r.name.split(' ')[0]}</option>
                            `).join('')}
                          </select>
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

  getPermLabel(perm) {
    switch (perm) {
      case 'view_all_tickets': return 'مشاهده همه تیکت‌ها';
      case 'create_ticket': return 'ثبت تیکت';
      case 'edit_all_tickets': return 'ویرایش تیکت‌های دیگران';
      case 'delete_ticket': return 'حذف تیکت';
      case 'reassign_ticket': return 'ارجاع مجدد';
      case 'manage_roles': return 'مدیریت نقش‌ها';
      case 'manage_users': return 'مدیریت کاربران';
      case 'view_reports': return 'گزارشات';
      default: return perm;
    }
  }

  bindEvents() {
    this.container.querySelectorAll('.admin-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSection = btn.getAttribute('data-sec');
        this.render();
      });
    });

    this.container.querySelectorAll('.master-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticketId = btn.getAttribute('data-id');
        if (ticketId) {
          state.activeTicketId = ticketId;
          state.emit('open_ticket_detail', ticketId);
        }
      });
    });

    document.getElementById('btn-clear-demo-tickets')?.addEventListener('click', async () => {
      if (confirm('آیا مطمئن هستید که می‌خواهید کلیه تیکت‌های تستی را پاک کنید و سامانه را از صفر آغاز نمایید؟')) {
        await state.clearAllTickets();
        notificationEngine.triggerToast({
          title: 'تیکت‌های دمو پاک شدند',
          message: 'سامانه اکنون کاملاً تمیز و آماده ثبت تیکت‌های واقعی است.',
          type: 'success'
        });
        this.render();
      }
    });

    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      const dump = {
        exportedAt: new Date().toISOString(),
        tickets: state.tickets,
        users: state.users,
        roles: state.roles
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticketing_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-show-create-role')?.addEventListener('click', () => {
      this.isCreatingRole = !this.isCreatingRole;
      this.render();
    });

    document.getElementById('btn-cancel-create-role')?.addEventListener('click', () => {
      this.isCreatingRole = false;
      this.render();
    });

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
        message: `نقش "${name}" با موفقیت به سیستم اضافه گردید.`,
        type: 'success'
      });
      this.isCreatingRole = false;
      this.render();
    });

    document.getElementById('btn-show-add-user')?.addEventListener('click', () => {
      this.isAddingUser = !this.isAddingUser;
      this.render();
    });

    document.getElementById('btn-cancel-add-user')?.addEventListener('click', () => {
      this.isAddingUser = false;
      this.render();
    });

    const userForm = document.getElementById('new-user-form');
    userForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const department = document.getElementById('user-dept').value.trim();
      const roleId = document.getElementById('user-role-select').value;

      if (!name || !email) return;

      await state.addUser({ name, email, department, roleId });
      notificationEngine.triggerToast({
        title: 'عضو جدید اضافه شد',
        message: `${name} با نقش انتخاب شده افزوده شد.`,
        type: 'success'
      });
      this.isAddingUser = false;
      this.render();
    });

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
  }
}
