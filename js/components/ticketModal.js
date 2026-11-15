// Create Ticket Modal with Responsive Mobile Bottom-Sheet Layout

import { state } from '../state.js';
import { renderIcon } from '../icons.js';
import { notificationEngine } from '../notifications.js';

export class TicketModalComponent {
  constructor(modalContainerId) {
    this.container = document.getElementById(modalContainerId);
    this.selectedTaggedIds = new Set();
    this.pendingAttachments = [];
    this.isSubmitting = false;
  }

  open() {
    this.selectedTaggedIds.clear();
    this.pendingAttachments = [];
    this.isSubmitting = false;
    this.render();
  }

  close() {
    state.isTicketModalOpen = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container) return;

    const users = state.users;
    const defaultAssignee = users.find(u => u.id !== state.currentUser?.id) || users[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    const defaultDeadlineStr = tomorrow.toISOString().slice(0, 16);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto modal-backdrop bg-slate-950/60 transition-opacity">
        <div class="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

          <!-- Mobile drag handle indicator -->
          <div class="sm:hidden w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2"></div>

          <!-- Modal Header -->
          <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                ${renderIcon('ticket', 'w-4 h-4 sm:w-5 sm:h-5')}
              </div>
              <div class="truncate">
                <h3 class="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">ثبت تیکت کاری جدید</h3>
                <p class="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">تیکت به همراه اعلان فوری برای مسئول و همکاران ارسال می‌شود</p>
              </div>
            </div>
            <button id="modal-close-btn" class="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              ${renderIcon('x', 'w-5 h-5')}
            </button>
          </div>

          <!-- Modal Form Scrollable -->
          <form id="ticket-form" class="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

            <!-- Title -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عنوان تیکت <span class="text-rose-500">*</span>
              </label>
              <input type="text" id="ticket-title" required placeholder="مثال: بررسی اختلال سرور، تهیه گزارش..." class="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white" />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شرح و توضیحات <span class="text-rose-500">*</span>
              </label>
              <textarea id="ticket-desc" rows="3" required placeholder="جزئیات دقیق کار و نیازمندی‌ها..." class="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white leading-relaxed"></textarea>
            </div>

            <!-- Responsive Columns: Assignee & Priority -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <!-- Assignee -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ارجاع به (مسئول اصلی) <span class="text-rose-500">*</span>
                </label>
                <select id="ticket-assignee" class="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
                  ${users.map(u => `
                    <option value="${u.id}" ${u.id === defaultAssignee.id ? 'selected' : ''}>
                      ${u.name} (${u.department})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Priority -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اولویت تیکت
                </label>
                <select id="ticket-priority" class="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
                  <option value="normal" selected>عادی</option>
                  <option value="high">بالا</option>
                  <option value="urgent">فوری و اضطراری</option>
                  <option value="low">کم</option>
                </select>
              </div>
            </div>

            <!-- Responsive Columns: Department & Deadline -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <!-- Department -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  واحد سازمانی
                </label>
                <select id="ticket-department" class="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
                  <option value="فناوری اطلاعات و زیرساخت">فناوری اطلاعات و زیرساخت</option>
                  <option value="توسعه نرم‌افزار">توسعه نرم‌افزار</option>
                  <option value="پشتیبانی مشتریان و عملیات">پشتیبانی مشتریان و عملیات</option>
                  <option value="مارکتینگ و فروش">مارکتینگ و فروش</option>
                  <option value="منابع انسانی و اداری">منابع انسانی و اداری</option>
                  <option value="مالی و حسابداری">مالی و حسابداری</option>
                  <option value="عمومی" selected>عمومی</option>
                </select>
              </div>

              <!-- Deadline -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مهلت انجام (Deadline)
                </label>
                <input type="datetime-local" id="ticket-deadline" value="${defaultDeadlineStr}" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white" />
              </div>
            </div>

            <!-- Multi-Person Tagging -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                تگ کردن همکاران دیگر (مطلعین)
              </label>

              <!-- Selected Tagged Pills -->
              <div id="tagged-pills" class="flex flex-wrap gap-1.5 mb-2"></div>

              <!-- Dropdown to add tags -->
              <select id="select-add-tag" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white">
                <option value="">+ افزودن همکار به لیست تگ‌شده‌ها...</option>
                ${users.map(u => `
                  <option value="${u.id}">${u.name} — ${u.department}</option>
                `).join('')}
              </select>
            </div>

            <!-- File Uploads (Drag & Drop) -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                پیوست فایل و مستندات
              </label>

              <div id="drop-zone" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/30">
                <input type="file" id="file-input" multiple class="hidden" />
                <div class="flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-slate-400">
                  <div class="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    ${renderIcon('paperclip', 'w-3.5 h-3.5')}
                  </div>
                  <p class="text-xs font-medium">
                    <span class="text-blue-600 dark:text-blue-400 font-bold hover:underline">انتخاب فایل</span> یا رها کردن فایل‌ها اینجا
                  </p>
                </div>
              </div>

              <!-- Pending Attachments List -->
              <div id="attachments-preview" class="space-y-1.5 mt-2"></div>
            </div>

            <!-- Footer Actions (Sticky bottom on mobile) -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 pb-safe">
              <button type="button" id="btn-cancel" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                انصراف
              </button>
              <button type="submit" id="btn-submit-ticket" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-2">
                ${renderIcon('send', 'w-4 h-4')}
                ثبت و ارسال تیکت
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderTaggedPills();
    this.renderAttachmentPreviews();
  }

  renderTaggedPills() {
    const pillsContainer = document.getElementById('tagged-pills');
    if (!pillsContainer) return;

    if (this.selectedTaggedIds.size === 0) {
      pillsContainer.innerHTML = `<span class="text-[11px] text-slate-400">فرد دیگری تگ نشده است.</span>`;
      return;
    }

    pillsContainer.innerHTML = Array.from(this.selectedTaggedIds).map(userId => {
      const u = state.getUser(userId);
      if (!u) return '';
      return `
        <span class="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-xl font-medium">
          <img src="${u.avatar}" class="w-3.5 h-3.5 rounded-full object-cover" />
          <span>${u.name}</span>
          <button type="button" class="remove-tag-btn hover:text-rose-500 text-blue-400" data-user-id="${u.id}">
            ${renderIcon('x', 'w-3 h-3')}
          </button>
        </span>
      `;
    }).join('');

    pillsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        this.selectedTaggedIds.delete(uid);
        this.renderTaggedPills();
      });
    });
  }

  renderAttachmentPreviews() {
    const list = document.getElementById('attachments-preview');
    if (!list) return;

    if (this.pendingAttachments.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = this.pendingAttachments.map((att, idx) => `
      <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
        <div class="flex items-center gap-2 truncate">
          ${renderIcon('file', 'w-3.5 h-3.5 text-blue-500 shrink-0')}
          <span class="font-medium text-slate-800 dark:text-slate-200 truncate">${att.name}</span>
          <span class="text-[10px] text-slate-400 shrink-0">(${(att.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button type="button" class="text-slate-400 hover:text-rose-500 p-1 remove-att-btn" data-index="${idx}">
          ${renderIcon('trash', 'w-3.5 h-3.5')}
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.remove-att-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        this.pendingAttachments.splice(index, 1);
        this.renderAttachmentPreviews();
      });
    });
  }

  bindEvents() {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel')?.addEventListener('click', () => this.close());

    const tagSelect = document.getElementById('select-add-tag');
    tagSelect?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        this.selectedTaggedIds.add(val);
        e.target.value = '';
        this.renderTaggedPills();
      }
    });

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone?.addEventListener('click', () => fileInput?.click());

    ['dragenter', 'dragover'].forEach(name => {
      dropZone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone?.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      this.handleFiles(files);
    });

    fileInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleFiles(files);
      fileInput.value = '';
    });

    const form = document.getElementById('ticket-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.isSubmitting) return;

      const title = document.getElementById('ticket-title').value.trim();
      const description = document.getElementById('ticket-desc').value.trim();
      const assigneeId = document.getElementById('ticket-assignee').value;
      const priority = document.getElementById('ticket-priority').value;
      const department = document.getElementById('ticket-department').value;
      const deadline = document.getElementById('ticket-deadline').value;

      if (!title || !description || !assigneeId) {
        alert('لطفاً عنوان، شرح و مسئول انجام را تکمیل نمایید.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-ticket');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `در حال ثبت...`;
      this.isSubmitting = true;

      try {
        const finalAttachments = [];
        for (const att of this.pendingAttachments) {
          if (state.storageMode === 'gdrive' && state.gdriveProvider.isConnected() && att.rawFile) {
            try {
              const driveFile = await state.gdriveProvider.uploadAttachment(att.rawFile);
              finalAttachments.push(driveFile);
            } catch (upErr) {
              console.warn('Google Drive upload failed, using local preview:', upErr);
              finalAttachments.push(att);
            }
          } else {
            finalAttachments.push(att);
          }
        }

        const newTicket = await state.createTicket({
          title,
          description,
          assigneeId,
          taggedUserIds: Array.from(this.selectedTaggedIds),
          priority,
          department,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          attachments: finalAttachments
        });

        notificationEngine.triggerAlert({
          ticketId: newTicket.id,
          type: 'assigned',
          title: `تیکت ${newTicket.id} ثبت شد`,
          message: `برای ${state.getUserName(assigneeId)} ارجاع داده شد.`
        });

        this.close();
      } catch (err) {
        console.error('Error creating ticket:', err);
        alert('خطا در ثبت تیکت: ' + err.message);
      } finally {
        this.isSubmitting = false;
      }
    });
  }

  handleFiles(files) {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.pendingAttachments.push({
          id: 'att-' + Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: e.target.result,
          rawFile: file,
          source: 'local'
        });
        this.renderAttachmentPreviews();
      };
      reader.readAsDataURL(file);
    });
  }
}
