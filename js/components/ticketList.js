// Ticket List Component with Advanced Search, Dynamic Filters & Responsive Mobile Cards

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { formatRelative, getDeadlineStatus, toPersianDigits } from '../utils/jalali.js';

export class TicketListComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  getFilteredTickets() {
    const curUserId = state.currentUser?.id;
    const now = new Date();

    return state.tickets.filter(ticket => {
      // 1. Tab filter
      if (state.activeTab === 'assigned' && ticket.assigneeId !== curUserId) return false;
      if (state.activeTab === 'created' && ticket.creatorId !== curUserId) return false;
      if (state.activeTab === 'tagged' && !ticket.taggedUserIds?.includes(curUserId)) return false;
      if (state.activeTab === 'overdue') {
        const isNotClosed = ticket.status !== 'resolved' && ticket.status !== 'closed';
        const isOverdue = ticket.deadline && new Date(ticket.deadline) < now;
        if (!isNotClosed || !isOverdue) return false;
      }

      // 2. Status filter
      if (state.statusFilter !== 'all' && ticket.status !== state.statusFilter) return false;

      // 3. Priority filter
      if (state.priorityFilter !== 'all' && ticket.priority !== state.priorityFilter) return false;

      // 4. Department filter
      if (state.departmentFilter !== 'all' && ticket.department !== state.departmentFilter) return false;

      // 5. Search query
      if (state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase();
        const matchTitle = ticket.title.toLowerCase().includes(q);
        const matchDesc = ticket.description.toLowerCase().includes(q);
        const matchId = ticket.id.toLowerCase().includes(q);
        const matchAssignee = state.getUserName(ticket.assigneeId).toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchId && !matchAssignee) return false;
      }

      return true;
    });
  }

  getTabCounts() {
    const curId = state.currentUser?.id;
    const now = new Date();
    let assigned = 0, created = 0, tagged = 0, overdue = 0;

    state.tickets.forEach(t => {
      if (t.assigneeId === curId) assigned++;
      if (t.creatorId === curId) created++;
      if (t.taggedUserIds?.includes(curId)) tagged++;
      if (t.status !== 'resolved' && t.status !== 'closed' && t.deadline && new Date(t.deadline) < now) {
        overdue++;
      }
    });

    return { total: state.tickets.length, assigned, created, tagged, overdue };
  }

  render() {
    if (!this.container) return;

    const filteredTickets = this.getFilteredTickets();
    const counts = this.getTabCounts();
    const departments = Array.from(new Set(state.tickets.map(t => t.department))).filter(Boolean);

    this.container.innerHTML = `
      <div class="space-y-4 sm:space-y-6 pb-20 md:pb-6">

        <!-- Header / Filters Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm">

          <!-- Top Row: Horizontal Swipeable Tab Navigation -->
          <div class="overflow-x-auto no-scrollbar pb-2 sm:pb-3 border-b border-slate-100 dark:border-slate-800 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            <div class="flex items-center gap-1.5 flex-nowrap min-w-max">
              <button class="tab-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${state.activeTab === 'all' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}" data-tab="all">
                همه تیکت‌ها
                <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">${toPersianDigits(counts.total)}</span>
              </button>

              <button class="tab-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${state.activeTab === 'assigned' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}" data-tab="assigned">
                ارجاع به من
                <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.activeTab === 'assigned' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}">${toPersianDigits(counts.assigned)}</span>
              </button>

              <button class="tab-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${state.activeTab === 'created' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}" data-tab="created">
                ایجادشده من
                <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.activeTab === 'created' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">${toPersianDigits(counts.created)}</span>
              </button>

              <button class="tab-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${state.activeTab === 'tagged' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}" data-tab="tagged">
                تگ‌شده‌ها
                <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.activeTab === 'tagged' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'}">${toPersianDigits(counts.tagged)}</span>
              </button>

              <button class="tab-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${state.activeTab === 'overdue' ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20' : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'}" data-tab="overdue">
                تاخیر خورده
                ${counts.overdue > 0 ? `
                  <span class="px-1.5 py-0.5 rounded-full text-[10px] ${state.activeTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold'}">${toPersianDigits(counts.overdue)}</span>
                ` : ''}
              </button>
            </div>
          </div>

          <!-- Bottom Row: Search & Filters Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3">

            <!-- Search Field -->
            <div class="relative">
              <span class="absolute inset-y-0 right-3 flex items-center text-slate-400 pointer-events-none">
                ${renderIcon('search', 'w-4 h-4')}
              </span>
              <input type="text" id="filter-search" value="${state.searchQuery}" placeholder="جستجو در تیکت‌ها..." class="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white" />
            </div>

            <!-- Status Dropdown -->
            <select id="filter-status" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
              <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>همه وضعیت‌ها</option>
              <option value="open" ${state.statusFilter === 'open' ? 'selected' : ''}>باز (جدید)</option>
              <option value="in_progress" ${state.statusFilter === 'in_progress' ? 'selected' : ''}>در حال بررسی</option>
              <option value="waiting" ${state.statusFilter === 'waiting' ? 'selected' : ''}>در انتظار پاسخ</option>
              <option value="resolved" ${state.statusFilter === 'resolved' ? 'selected' : ''}>حل شده</option>
              <option value="closed" ${state.statusFilter === 'closed' ? 'selected' : ''}>بسته شده</option>
            </select>

            <!-- Priority Dropdown -->
            <select id="filter-priority" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
              <option value="all" ${state.priorityFilter === 'all' ? 'selected' : ''}>همه اولویت‌ها</option>
              <option value="urgent" ${state.priorityFilter === 'urgent' ? 'selected' : ''}>فوری</option>
              <option value="high" ${state.priorityFilter === 'high' ? 'selected' : ''}>بالا</option>
              <option value="normal" ${state.priorityFilter === 'normal' ? 'selected' : ''}>عادی</option>
              <option value="low" ${state.priorityFilter === 'low' ? 'selected' : ''}>کم</option>
            </select>

            <!-- Department Dropdown -->
            <select id="filter-department" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
              <option value="all" ${state.departmentFilter === 'all' ? 'selected' : ''}>همه واحدها</option>
              ${departments.map(d => `<option value="${d}" ${state.departmentFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Tickets Cards List -->
        <div class="space-y-3">
          ${filteredTickets.length === 0 ? `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
              <div class="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                ${renderIcon('ticket', 'w-7 h-7')}
              </div>
              <h3 class="text-sm sm:text-base font-bold text-slate-800 dark:text-white">هیچ تیکتی یافت نشد</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">فیلترها را بررسی کرده یا اولین تیکت را برای یکی از همکاران ثبت نمایید.</p>
              <button id="btn-empty-new-ticket" class="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20">
                ${renderIcon('plus', 'w-4 h-4')}
                ثبت تیکت جدید
              </button>
            </div>
          ` : filteredTickets.map(ticket => this.renderTicketCard(ticket)).join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderTicketCard(ticket) {
    const assignee = state.getUser(ticket.assigneeId);
    const creator = state.getUser(ticket.creatorId);
    const deadlineInfo = getDeadlineStatus(ticket.deadline);
    const statusLabel = state.getStatusLabel(ticket.status);
    const priorityLabel = state.getPriorityLabel(ticket.priority);
    const replyCount = ticket.replies?.length || 0;
    const attachmentCount = (ticket.attachments?.length || 0) +
      (ticket.replies?.reduce((acc, r) => acc + (r.attachments?.length || 0), 0) || 0);

    const taggedUsers = (ticket.taggedUserIds || []).map(id => state.getUser(id)).filter(Boolean);

    return `
      <div class="ticket-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group" data-ticket-id="${ticket.id}">

        <!-- Top Badges Row (Wrapping cleanly on small screens) -->
        <div class="flex items-center flex-wrap gap-1.5 mb-2">
          <span class="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">${ticket.id}</span>
          <span class="text-[11px] px-2 py-0.5 rounded-lg font-bold status-badge-${ticket.status}">
            ${statusLabel}
          </span>
          <span class="text-[11px] px-2 py-0.5 rounded-lg font-bold priority-${ticket.priority}">
            ${priorityLabel}
          </span>
          <span class="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-md truncate max-w-[120px]">
            ${ticket.department}
          </span>

          <!-- Deadline Badge -->
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${deadlineInfo.badgeClass} mr-auto">
            ${renderIcon('clock', 'w-3 h-3')}
            ${deadlineInfo.label}
          </span>
        </div>

        <!-- Title -->
        <h3 class="font-bold text-xs sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-1">
          ${ticket.title}
        </h3>

        <!-- Description snippet -->
        <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          ${ticket.description}
        </p>

        <!-- Bottom Info Row: Assignee, Tagged & Stats (Fully Responsive Wrap) -->
        <div class="flex items-center justify-between flex-wrap gap-2 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800">

          <!-- Left: Assignee & Tagged -->
          <div class="flex items-center gap-2 min-w-0">
            <!-- Assignee Badge -->
            <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <img src="${assignee ? assignee.avatar : ''}" class="w-5 h-5 rounded-full object-cover ring-1 ring-blue-500/40 shrink-0" />
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px] sm:max-w-none">${assignee ? assignee.name : '—'}</span>
            </div>

            <!-- Tagged Users Stack -->
            ${taggedUsers.length > 0 ? `
              <div class="flex items-center -space-x-1 space-x-reverse shrink-0" title="افراد تگ‌شده: ${taggedUsers.map(u => u.name).join('، ')}">
                ${taggedUsers.slice(0, 2).map(u => `
                  <img src="${u.avatar}" class="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-slate-900" alt="${u.name}" />
                `).join('')}
                ${taggedUsers.length > 2 ? `
                  <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center">
                    +${toPersianDigits(taggedUsers.length - 2)}
                  </span>
                ` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Right: Stats & Relative Date -->
          <div class="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            ${attachmentCount > 0 ? `
              <span class="flex items-center gap-0.5" title="${toPersianDigits(attachmentCount)} فایل پیوست">
                ${renderIcon('paperclip', 'w-3 h-3')}
                <span class="font-bold">${toPersianDigits(attachmentCount)}</span>
              </span>
            ` : ''}

            <span class="flex items-center gap-0.5" title="${toPersianDigits(replyCount)} پاسخ">
              ${renderIcon('messageSquare', 'w-3 h-3')}
              <span class="font-bold">${toPersianDigits(replyCount)}</span>
            </span>

            <span class="text-slate-300 dark:text-slate-700">|</span>
            <span>${formatRelative(ticket.createdAt)}</span>
          </div>
        </div>

      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    const searchInput = document.getElementById('filter-search');
    searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      this.render();
    });

    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      this.render();
    });

    document.getElementById('filter-priority')?.addEventListener('change', (e) => {
      state.priorityFilter = e.target.value;
      this.render();
    });

    document.getElementById('filter-department')?.addEventListener('change', (e) => {
      state.departmentFilter = e.target.value;
      this.render();
    });

    this.container.querySelectorAll('.ticket-card').forEach(card => {
      card.addEventListener('click', () => {
        const ticketId = card.getAttribute('data-ticket-id');
        if (ticketId) {
          state.activeTicketId = ticketId;
          state.emit('open_ticket_detail', ticketId);
        }
      });
    });

    document.getElementById('btn-empty-new-ticket')?.addEventListener('click', () => {
      state.isTicketModalOpen = true;
      state.emit('open_ticket_modal');
    });
  }
}
