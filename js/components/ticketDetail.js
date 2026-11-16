// Ticket Detail View with Mobile Bottom-Sheet & Responsive Thread Discussion

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { formatJalali, formatRelative, getDeadlineStatus, toPersianDigits } from '../utils/jalali.js';
import { notificationEngine } from '../notifications.js';

export class TicketDetailComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.replyAttachments = [];
    this.isSubmittingReply = false;
  }

  open(ticketId) {
    state.activeTicketId = ticketId;
    this.replyAttachments = [];
    this.render();
  }

  close() {
    state.activeTicketId = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container || !state.activeTicketId) return;

    const ticket = state.tickets.find(t => t.id === state.activeTicketId);
    if (!ticket) {
      this.close();
      return;
    }

    const creator = state.getUser(ticket.creatorId);
    const assignee = state.getUser(ticket.assigneeId);
    const taggedUsers = (ticket.taggedUserIds || []).map(id => state.getUser(id)).filter(Boolean);
    const deadlineInfo = getDeadlineStatus(ticket.deadline);
    const canDelete = state.hasPermission('delete_ticket');

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto modal-backdrop bg-slate-950/60 transition-opacity">
        <div class="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

          <!-- Mobile drag handle -->
          <div class="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2 shrink-0"></div>

          <!-- Detail Top Header (Wrapping on mobile) -->
          <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-lg">${ticket.id}</span>

              <!-- Status Selector Dropdown -->
              <select id="detail-status-select" class="text-xs font-bold rounded-xl px-2 py-1 focus:ring-2 focus:ring-blue-500 border status-badge-${ticket.status}">
                <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>باز (جدید)</option>
                <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>در حال بررسی</option>
                <option value="waiting" ${ticket.status === 'waiting' ? 'selected' : ''}>در انتظار پاسخ</option>
                <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>حل شده</option>
                <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>بسته شده</option>
              </select>

              <!-- Priority -->
              <span class="text-xs font-bold rounded-xl px-2 py-0.5 priority-${ticket.priority}">
                ${state.getPriorityLabel(ticket.priority)}
              </span>
            </div>

            <div class="flex items-center gap-1.5 mr-auto sm:mr-0">
              ${canDelete ? `
                <button id="btn-delete-ticket" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition" title="حذف تیکت">
                  ${renderIcon('trash', 'w-4 h-4')}
                </button>
              ` : ''}

              <button id="detail-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                ${renderIcon('x', 'w-5 h-5')}
              </button>
            </div>
          </div>

          <!-- Detail Body Scrollable -->
          <div class="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">

            <!-- Title & Deadline -->
            <div>
              <h2 class="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
                ${ticket.title}
              </h2>

              <!-- Deadline Banner -->
              <div class="mt-2.5 flex items-center flex-wrap gap-2">
                <div class="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-xl ${deadlineInfo.badgeClass}">
                  ${renderIcon('clock', 'w-3.5 h-3.5')}
                  <span>مهلت: ${deadlineInfo.label}</span>
                </div>
                ${ticket.deadline ? `
                  <span class="text-[11px] text-slate-400">
                    (${formatJalali(ticket.deadline)})
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Metadata Cards Row -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] text-slate-400 block mb-1">ایجادکننده</span>
                <div class="flex items-center gap-1.5">
                  <img src="${creator?.avatar}" class="w-5 h-5 rounded-full object-cover shrink-0" />
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${creator?.name}</span>
                </div>
              </div>

              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] text-slate-400 block mb-1">مسئول انجام</span>
                <div class="flex items-center gap-1.5">
                  <img src="${assignee?.avatar}" class="w-5 h-5 rounded-full object-cover ring-1 ring-blue-500/40 shrink-0" />
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${assignee?.name}</span>
                </div>
              </div>

              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] text-slate-400 block mb-1">واحد</span>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">${ticket.department}</span>
              </div>

              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] text-slate-400 block mb-1">زمان ثبت</span>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">${formatRelative(ticket.createdAt)}</span>
              </div>
            </div>

            <!-- Tagged People -->
            ${taggedUsers.length > 0 ? `
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] text-slate-400 font-medium">همکاران تگ‌شده:</span>
                ${taggedUsers.map(u => `
                  <span class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    <img src="${u.avatar}" class="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                    <span>${u.name}</span>
                  </span>
                `).join('')}
              </div>
            ` : ''}

            <!-- Original Description Card -->
            <div class="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 rounded-2xl p-3.5 sm:p-5">
              <h4 class="text-xs font-bold text-blue-900 dark:text-blue-300 mb-1.5">شرح کامل تیکت</h4>
              <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                ${ticket.description}
              </p>

              <!-- Ticket Initial Attachments -->
              ${ticket.attachments?.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-900/50">
                  <h5 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                    ${renderIcon('paperclip', 'w-3 h-3')}
                    فایل‌های پیوست تیکت (${toPersianDigits(ticket.attachments.length)})
                  </h5>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${ticket.attachments.map(att => this.renderAttachmentPill(att)).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Conversation / Replies Section -->
            <div class="space-y-3">
              <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  ${renderIcon('messageSquare', 'w-4 h-4 text-blue-600')}
                  گفتگوها و پاسخ‌ها (${toPersianDigits(ticket.replies?.length || 0)})
                </h4>
              </div>

              <!-- Replies List -->
              <div class="space-y-2.5">
                ${(!ticket.replies || ticket.replies.length === 0) ? `
                  <div class="text-center py-4 text-slate-400 text-xs">
                    هنوز پاسخی برای این تیکت ثبت نشده است. اولین پاسخ را در زیر بنویسید.
                  </div>
                ` : ticket.replies.map(rep => {
                  const author = state.getUser(rep.authorId);
                  return `
                    <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 sm:p-4 space-y-1.5">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <img src="${author?.avatar}" class="w-6 h-6 rounded-full object-cover shrink-0" />
                          <span class="text-xs font-bold text-slate-900 dark:text-white">${author?.name}</span>
                          <span class="text-[10px] text-slate-400 hidden sm:inline">${author?.department}</span>
                        </div>
                        <span class="text-[10px] text-slate-400">${formatRelative(rep.createdAt)}</span>
                      </div>
                      <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pr-7 sm:pr-8 whitespace-pre-line">
                        ${rep.content}
                      </p>

                      <!-- Reply Attachments -->
                      ${rep.attachments?.length > 0 ? `
                        <div class="pr-7 sm:pr-8 pt-1.5">
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            ${rep.attachments.map(att => this.renderAttachmentPill(att)).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- History & Audit Trail Accordion -->
            <details class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-2.5 sm:p-3 group">
              <summary class="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer flex items-center justify-between">
                <span>گردش کار (${toPersianDigits(ticket.history?.length || 0)} رویداد)</span>
                ${renderIcon('chevronDown', 'w-4 h-4 transition-transform group-open:rotate-180')}
              </summary>
              <div class="mt-2 space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] sm:text-[11px]">
                ${(ticket.history || []).map(h => {
                  const actor = state.getUser(h.actorId);
                  let desc = '';
                  if (h.action === 'CREATED') desc = 'تیکت را ایجاد کرد.';
                  else if (h.action === 'STATUS_CHANGE') desc = `وضعیت را به "${state.getStatusLabel(h.to)}" تغییر داد.`;
                  else if (h.action === 'REPLY_ADDED') desc = 'پاسخ جدید ثبت کرد.';
                  return `
                    <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span><strong>${actor ? actor.name : 'سیستم'}:</strong> ${desc}</span>
                      <span class="text-[10px]">${formatRelative(h.timestamp)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </details>
          </div>

          <!-- Reply Input Box (Bottom Sticky) -->
          <div class="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 pb-safe">
            <form id="reply-form" class="space-y-2 sm:space-y-3">
              <div>
                <textarea id="reply-text" rows="2" required placeholder="پاسخ خود به این تیکت را بنویسید..." class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white leading-relaxed resize-none"></textarea>
              </div>

              <!-- Pending Reply Attachments -->
              <div id="reply-att-preview" class="flex flex-wrap gap-1.5"></div>

              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <input type="file" id="reply-file-input" multiple class="hidden" />
                  <button type="button" id="btn-reply-attach" class="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1">
                    ${renderIcon('paperclip', 'w-3.5 h-3.5')}
                    <span>پیوست</span>
                  </button>

                  <!-- Quick Status Changer on Reply -->
                  <select id="reply-status-change" class="text-[11px] sm:text-xs px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <option value="">(بدون تغییر وضعیت)</option>
                    <option value="in_progress">در حال بررسی</option>
                    <option value="waiting">در انتظار پاسخ</option>
                    <option value="resolved">حل شده</option>
                  </select>
                </div>

                <button type="submit" id="btn-submit-reply" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 mr-auto">
                  ${renderIcon('send', 'w-3.5 h-3.5')}
                  ارسال
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    this.bindEvents(ticket);
  }

  renderAttachmentPill(att) {
    const isDrive = att.source === 'gdrive' || att.url?.includes('drive.google.com');
    return `
      <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
        <div class="flex items-center gap-2 truncate">
          ${isDrive ? renderIcon('drive', 'w-4 h-4 shrink-0') : renderIcon('file', 'w-4 h-4 text-blue-500 shrink-0')}
          <span class="font-medium text-slate-800 dark:text-slate-200 truncate">${att.name}</span>
          <span class="text-[10px] text-slate-400 shrink-0">(${(att.size / 1024).toFixed(1)} KB)</span>
        </div>
        <a href="${att.url}" target="_blank" download="${att.name}" class="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 transition" title="دانلود / مشاهده">
          ${renderIcon('download', 'w-3.5 h-3.5')}
        </a>
      </div>
    `;
  }

  renderReplyAttachmentPreviews() {
    const container = document.getElementById('reply-att-preview');
    if (!container) return;

    container.innerHTML = this.replyAttachments.map((att, idx) => `
      <span class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-[11px] px-2 py-0.5 rounded-lg text-slate-700 dark:text-slate-300">
        ${renderIcon('file', 'w-3 h-3 text-blue-500')}
        <span class="truncate max-w-[100px]">${att.name}</span>
        <button type="button" class="remove-reply-att text-slate-400 hover:text-rose-500" data-idx="${idx}">
          ${renderIcon('x', 'w-3 h-3')}
        </button>
      </span>
    `).join('');

    container.querySelectorAll('.remove-reply-att').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.replyAttachments.splice(idx, 1);
        this.renderReplyAttachmentPreviews();
      });
    });
  }

  bindEvents(ticket) {
    document.getElementById('detail-close-btn')?.addEventListener('click', () => this.close());

    document.getElementById('detail-status-select')?.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await state.updateTicketStatus(ticket.id, newStatus);
      notificationEngine.triggerToast({
        title: 'وضعیت تیکت تغییر یافت',
        message: `تیکت ${ticket.id} در وضعیت "${state.getStatusLabel(newStatus)}" قرار گرفت.`,
        type: 'info'
      });
      this.render();
    });

    document.getElementById('btn-delete-ticket')?.addEventListener('click', async () => {
      if (confirm(`آیا از حذف کامل تیکت ${ticket.id} اطمینان دارید؟`)) {
        await state.deleteTicket(ticket.id);
        notificationEngine.triggerToast({
          title: 'تیکت حذف شد',
          message: `تیکت ${ticket.id} از سیستم حذف گردید.`,
          type: 'warning'
        });
        this.close();
      }
    });

    const replyFileInput = document.getElementById('reply-file-input');
    document.getElementById('btn-reply-attach')?.addEventListener('click', () => {
      replyFileInput?.click();
    });

    replyFileInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.replyAttachments.push({
            id: 'att-' + Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type,
            url: ev.target.result,
            rawFile: file,
            source: 'local'
          });
          this.renderReplyAttachmentPreviews();
        };
        reader.readAsDataURL(file);
      });
      replyFileInput.value = '';
    });

    const replyForm = document.getElementById('reply-form');
    replyForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmittingReply) return;

      const replyText = document.getElementById('reply-text').value.trim();
      const statusChange = document.getElementById('reply-status-change').value || null;

      if (!replyText) return;

      const submitBtn = document.getElementById('btn-submit-reply');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `در حال ارسال...`;
      this.isSubmittingReply = true;

      try {
        const finalAttachments = [];
        for (const att of this.replyAttachments) {
          if (att.rawFile && state.serverProvider.isLoggedIn()) {
            try {
              const uploaded = await state.serverProvider.uploadFile(att.rawFile);
              finalAttachments.push(uploaded);
            } catch (upErr) {
              console.warn('Server file upload failed, using fallback:', upErr);
              finalAttachments.push(att);
            }
          } else {
            finalAttachments.push(att);
          }
        }

        await state.addReply(ticket.id, replyText, finalAttachments, statusChange);

        notificationEngine.triggerAlert({
          ticketId: ticket.id,
          type: 'reply',
          title: 'پاسخ با موفقیت ثبت شد',
          message: `برای تیکت ${ticket.id}`
        });

        this.replyAttachments = [];
        this.render();
      } catch (err) {
        console.error('Error adding reply:', err);
        alert('خطا در ارسال پاسخ: ' + err.message);
      } finally {
        this.isSubmittingReply = false;
      }
    });
  }
}
