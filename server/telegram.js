// Telegram Bot Integration Engine with Handshake, Multi-Item Reply Draft Sessions, File Downloads & Proxy Support

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

class TelegramService {
  constructor() {
    this.pollingTimeout = null;
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.botInfo = null;
    this.broadcastWs = () => {};
    // Maps telegram chatId -> Draft Session Object:
    // { ticketId, statusMessageId, texts: [], attachments: [], expiresAt }
    this.draftSessions = new Map();
    // Maps telegram chatId -> Ticket Creation Wizard Session:
    // { chatId, user, step, title, department, priority, assigneeId, assigneeName, taggedUserIds, statusMessageId, descriptionLines, attachments, expiresAt }
    this.ticketCreationSessions = new Map();
    // Maps telegram chatId -> Announcement Wizard Session:
    // { chatId, user, step, title, content, targetDepartment, priority, statusMessageId, expiresAt }
    this.announcementSessions = new Map();
  }

  canManageAnnouncements(user) {
    if (!user) return false;
    if (user.roleId === 'admin' || user.roleId === 'manager') return true;
    const userRole = db.data.roles?.find(r => r.id === user.roleId);
    return Boolean(userRole?.permissions?.includes('manage_announcements'));
  }

  setBroadcast(fn) {
    this.broadcastWs = fn;
  }

  getAgent() {
    const rawProxy = (db.data.system_settings.telegram_proxy_url || '').trim();
    if (!rawProxy) return undefined;

    try {
      let proxyUrl = rawProxy;
      if (!proxyUrl.includes('://')) {
        proxyUrl = 'http://' + proxyUrl;
      }

      if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://') || proxyUrl.startsWith('socks://')) {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        const normalizedSocks = proxyUrl.replace(/^socks5:\/\//, 'socks5h://');
        return new SocksProxyAgent(normalizedSocks, {
          timeout: 25000,
          keepAlive: true
        });
      } else if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        return new HttpsProxyAgent(proxyUrl, {
          timeout: 25000,
          keepAlive: true
        });
      }
    } catch (err) {
      console.warn('Proxy agent creation notice:', err.message);
    }
    return undefined;
  }

  async callApi(method, payload = {}) {
    const token = db.data.system_settings.telegram_bot_token;
    if (!token) {
      throw new Error('توکن ربات تلگرام در تنظیمات سیستم تنظیم نشده است.');
    }

    const agent = this.getAgent();
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const postData = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'ManaTicketingBot/3.1'
        },
        timeout: 25000,
        agent: agent
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              resolve(parsed.result);
            } else {
              reject(new Error(parsed.description || 'Telegram API returned error'));
            }
          } catch (err) {
            reject(new Error('Invalid response from Telegram API: ' + data.slice(0, 100)));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`خطای ارتباط با تلگرام (${err.message}). وضعیت اتصال اینترنت یا پروکسی V2Ray سرور را بررسی فرمایید.`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('تایم‌اوت ارتباط با سرورهای تلگرام. لطفاً وضعیت پروکسی سرور را بررسی کنید.'));
      });

      req.write(postData);
      req.end();
    });
  }

  // --- Download File from Telegram Server through Proxy ---
  async downloadTelegramFile(fileId, originalName = 'attachment') {
    const fileInfo = await this.callApi('getFile', { file_id: fileId });
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('فایل در سرور تلگرام یافت نشد.');
    }

    const token = db.data.system_settings.telegram_bot_token;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    const agent = this.getAgent();

    const ext = path.extname(fileInfo.file_path) || path.extname(originalName) || '.dat';
    const filename = `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
    const localFilePath = path.join(uploadDir, filename);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(downloadUrl);
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'ManaTicketingBot/3.1'
        },
        timeout: 30000,
        agent: agent
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`دانلود فایل با کد وضعیت ${res.statusCode} ناموفق بود.`));
        }

        const fileStream = fs.createWriteStream(localFilePath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          const stats = fs.statSync(localFilePath);
          resolve({
            id: 'att_tg_' + Date.now(),
            name: originalName || path.basename(fileInfo.file_path),
            size: stats.size,
            type: this.guessMimeType(ext),
            url: `/uploads/${filename}`,
            uploadedAt: new Date().toISOString()
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(localFilePath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('دانلود فایل با تایم‌اوت مواجه شد.'));
      });
      req.end();
    });
  }

  guessMimeType(ext) {
    const map = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4'
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
  }

  async testConnection() {
    const me = await this.callApi('getMe');
    this.botInfo = me;
    return me;
  }

  // --- Dispatch Notification with Handshake & Reply Inline Buttons ---
  async sendNotificationWithHandshake({ deliveryId, userId, title, message, ticketId, detailsUrl, priority }) {
    const user = db.findUserById(userId);
    if (!user || !user.telegramChatId) {
      return { success: false, reason: 'کاربر به ربات تلگرام متصل نیست' };
    }

    const priorityBadge = priority === 'urgent' ? '🔴 فوری' : (priority === 'high' ? '🟠 بالا' : '🔵 عادی');

    const text = `🔔 *سامانه تیکتینگ و اعلانات مانا*\n\n` +
                 `📌 *${this.escapeMarkdown(title)}*\n` +
                 `🔖 اولویت: ${priorityBadge}\n\n` +
                 `${this.escapeMarkdown(message)}\n\n` +
                 `⚠️ _جهت تایید دریافت، دکمه اول و جهت ارسال پاسخ، دکمه دوم را لمس فرمایید._`;

    const inlineKeyboard = [
      [
        {
          text: '✅ مشاهده شد / تایید دریافت',
          callback_data: `ack:${deliveryId}:${userId}`
        }
      ]
    ];

    if (ticketId) {
      inlineKeyboard.push([
        {
          text: '💬 پاسخ به این تیکت در تلگرام',
          callback_data: `start_reply:${ticketId}`
        }
      ]);
    }

    if (detailsUrl) {
      inlineKeyboard.push([
        {
          text: '🔗 باز کردن در سامانه وب',
          url: detailsUrl
        }
      ]);
    }

    try {
      const res = await this.callApi('sendMessage', {
        chat_id: user.telegramChatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });

      db.updateRecipientStatus(deliveryId, userId, {
        status: 'sent',
        telegramMessageId: res.message_id,
        lastSentAt: new Date().toISOString()
      });

      return { success: true, messageId: res.message_id };
    } catch (err) {
      console.error(`Telegram send failed to user ${user.name}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // --- Resend Reminder for Unacknowledged Deliveries ---
  async resendReminder({ deliveryId, userId, title, message }) {
    const user = db.findUserById(userId);
    if (!user || !user.telegramChatId) return false;

    const group = db.data.deliveries.find(d => d.id === deliveryId);
    const recipient = group?.recipients.find(r => r.userId === userId);
    if (!recipient || recipient.status === 'acknowledged') return false;

    const resendNum = (recipient.resendCount || 0) + 1;

    const text = `⚠️ *یادآوری (${resendNum}): اعلان بدون تایید*\n\n` +
                 `همکار گرامی *${this.escapeMarkdown(user.name)}*،\n` +
                 `شما هنوز مشاهده پیام زیر را تایید نکرده‌اید:\n\n` +
                 `📌 *${this.escapeMarkdown(title)}*\n` +
                 `${this.escapeMarkdown(message.slice(0, 150))}...\n\n` +
                 `👇 _جهت ثبت حضور و دریافت، لطفاً دکمه زیر را بزنید:_`;

    const inlineKeyboard = [
      [
        {
          text: '✅ مشاهده شد / تایید دریافت',
          callback_data: `ack:${deliveryId}:${userId}`
        }
      ]
    ];

    if (group.type === 'ticket' && group.referenceId) {
      inlineKeyboard.push([
        {
          text: '💬 پاسخ به این تیکت در تلگرام',
          callback_data: `start_reply:${group.referenceId}`
        }
      ]);
    }

    try {
      await this.callApi('sendMessage', {
        chat_id: user.telegramChatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });

      db.updateRecipientStatus(deliveryId, userId, {
        resendCount: resendNum,
        lastSentAt: new Date().toISOString()
      });

      this.broadcastWs({
        type: 'delivery_updated',
        deliveryId: deliveryId,
        recipient: {
          userId,
          resendCount: resendNum,
          lastSentAt: new Date().toISOString()
        }
      });

      return true;
    } catch (err) {
      console.warn(`Resend failed to user ${user.name}:`, err.message);
      return false;
    }
  }

  // --- Auto-Acknowledge All Unconfirmed Deliveries for a Ticket upon Reply ---
  async autoAcknowledgeTicketDeliveries(ticketId, userId) {
    try {
      const user = db.findUserById(userId);
      const updated = db.acknowledgeTicketDeliveriesForUser(ticketId, userId);
      if (!updated || updated.length === 0) return;

      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);

      for (const item of updated) {
        // 1. WebSocket broadcast so admin & superadmin panels update immediately
        this.broadcastWs({
          type: 'delivery_acknowledged',
          deliveryId: item.deliveryId,
          userId: userId,
          userName: user ? user.name : item.recipient.userName,
          acknowledgedAt: item.recipient.acknowledgedAt,
          acknowledgedVia: 'reply',
          formattedTime: timeStr
        });

        // 2. If user received a Telegram message for this notification, update its inline button
        if (item.recipient.telegramChatId && item.recipient.telegramMessageId) {
          try {
            await this.callApi('editMessageReplyMarkup', {
              chat_id: item.recipient.telegramChatId,
              message_id: item.recipient.telegramMessageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: `✅ تایید خودکار با ارسال پاسخ (${timeStr})`,
                      callback_data: 'noop'
                    }
                  ],
                  [
                    {
                      text: '💬 ارسال پاسخ تکمیلی در تلگرام',
                      callback_data: `start_reply:${ticketId}`
                    }
                  ]
                ]
              }
            });
          } catch (e) {
            // Ignore Telegram edit errors (message too old or deleted)
          }
        }
      }
    } catch (err) {
      console.warn('Error in autoAcknowledgeTicketDeliveries:', err.message);
    }
  }

  // --- Long Polling Worker for User Pairing, Handshake, & Replies ---
  startPolling() {
    if (this.isPolling) return;
    const token = db.data.system_settings.telegram_bot_token;
    if (!token) return;

    this.isPolling = true;
    console.log('🤖 سرویس تلگرام مانا فعال شد (شنود پیام‌ها، دکمه‌ها و پاسخ به تیکت‌ها)...');
    this.pollLoop();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  async pollLoop() {
    if (!this.isPolling) return;

    try {
      const updates = await this.callApi('getUpdates', {
        offset: this.lastUpdateId + 1,
        timeout: 10,
        limit: 20
      });

      if (Array.isArray(updates)) {
        for (const update of updates) {
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          await this.handleUpdate(update);
        }
      }
    } catch (err) {
      // console.warn('Telegram poll loop notice:', err.message);
    }

    if (this.isPolling) {
      this.pollingTimeout = setTimeout(() => this.pollLoop(), 1000);
    }
  }

  async handleUpdate(update) {
    try {
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
        return;
      }

      if (update.message) {
        await this.handleIncomingMessage(update.message);
      }
    } catch (err) {
      console.error('Error handling Telegram update:', err);
    }
  }

  async handleCallbackQuery(cq) {
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;

    // No-op (already acknowledged button tapped)
    if (data === 'noop' || data.startsWith('noop')) {
      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'ℹ️ این اعلان قبلاً در سامانه تایید گردیده و نیازی به اقدام مجدد ندارد.',
        show_alert: true
      });
      return;
    }

    // A: Handshake button click: ack:<deliveryId>:<userId>
    if (data.startsWith('ack:')) {
      const parts = data.split(':');
      const deliveryId = parts[1];
      const userId = parts[2];

      const user = db.findUserById(userId);
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);

      db.acknowledgeDelivery(deliveryId, userId);

      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: '✅ تایید دریافت با موفقیت در سامانه ثبت گردید.',
        show_alert: false
      });

      try {
        const currentText = cq.message.text || '';
        const updatedText = `${currentText}\n\n✅ *تایید شد توسط شما در تاریخ:* ${timeStr}`;

        const group = db.data.deliveries.find(d => d.id === deliveryId);
        const replyButtons = [];

        if (group && group.type === 'ticket' && group.referenceId) {
          replyButtons.push([
            {
              text: '💬 پاسخ به این تیکت در تلگرام',
              callback_data: `start_reply:${group.referenceId}`
            }
          ]);
        }

        await this.callApi('editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: updatedText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `✅ تایید شده در ${timeStr}`,
                  callback_data: 'noop'
                }
              ],
              ...replyButtons
            ]
          }
        });
      } catch (e) {
        // Ignore edit duplicate
      }

      this.broadcastWs({
        type: 'delivery_acknowledged',
        deliveryId,
        userId,
        userName: user ? user.name : 'کاربر',
        acknowledgedAt: now.toISOString(),
        formattedTime: timeStr
      });
      return;
    }

    // B: Enter Reply Draft Mode: start_reply:<ticketId>
    if (data.startsWith('start_reply:')) {
      const ticketId = data.split(':')[1];
      const ticket = db.data.tickets.find(t => t.id === ticketId);

      if (!ticket) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: cq.id,
          text: '❌ تیکت یافت نشد یا حذف گردیده است.',
          show_alert: true
        });
        return;
      }

      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: `پیش‌نویس پاسخ برای تیکت ${ticket.id} فعال شد.`
      });

      await this.initReplyDraftSession(chatId, ticket.id);
      return;
    }

    // C: Submit Final Draft Reply: submit_reply:<ticketId>
    if (data.startsWith('submit_reply:')) {
      const ticketId = data.split(':')[1];
      await this.submitFinalDraftReply(chatId, ticketId, cq.id);
      return;
    }

    // D: Cancel Draft Reply: cancel_reply:<ticketId>
    if (data.startsWith('cancel_reply:')) {
      this.draftSessions.delete(chatId);
      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'پیش‌نویس پاسخ لغو شد.'
      });
      try {
        await this.callApi('editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: '❌ *عملیات پاسخ‌دهی به تیکت لغو شد.*',
          parse_mode: 'Markdown'
        });
      } catch (e) {}
      return;
    }

    // E: Ticket Creation Wizard - Department Selected
    if (data.startsWith('nt_dept:')) {
      const idx = parseInt(data.split(':')[1], 10);
      const session = this.ticketCreationSessions.get(chatId);
      if (session) {
        const depts = this.getStandardDepartments();
        session.department = depts[idx] || 'عمومی';
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendPrioritySelection(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد تیکت منقضی شده است.', show_alert: true });
      }
      return;
    }

    // F: Ticket Creation Wizard - Priority Selected
    if (data.startsWith('nt_pri:')) {
      const pri = data.split(':')[1];
      const session = this.ticketCreationSessions.get(chatId);
      if (session) {
        session.priority = pri;
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendAssigneeSelection(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد تیکت منقضی شده است.', show_alert: true });
      }
      return;
    }

    // G: Ticket Creation Wizard - Assignee Selected
    if (data.startsWith('nt_asg:')) {
      const asgId = data.split(':')[1];
      const session = this.ticketCreationSessions.get(chatId);
      if (session) {
        if (asgId === 'none') {
          session.assigneeId = null;
          session.assigneeName = 'عمومی (بدون مسئول اختصاصی)';
        } else {
          const target = db.findUserById(asgId);
          session.assigneeId = target ? target.id : null;
          session.assigneeName = target ? `${target.name} (${target.department || 'عمومی'})` : 'عمومی';
        }
        // If assignee was previously tagged, remove from tagged list
        if (session.assigneeId && Array.isArray(session.taggedUserIds)) {
          session.taggedUserIds = session.taggedUserIds.filter(id => id !== session.assigneeId);
        }
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendTaggedUsersSelection(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد تیکت منقضی شده است.', show_alert: true });
      }
      return;
    }

    // G2: Ticket Creation Wizard - Toggle Tagged Colleague: nt_tag:<userId>
    if (data.startsWith('nt_tag:')) {
      const tagUserId = data.split(':')[1];
      const session = this.ticketCreationSessions.get(chatId);
      if (session) {
        if (!Array.isArray(session.taggedUserIds)) {
          session.taggedUserIds = [];
        }
        const existingIdx = session.taggedUserIds.indexOf(tagUserId);
        if (existingIdx >= 0) {
          session.taggedUserIds.splice(existingIdx, 1);
          await this.callApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: 'همکار از لیست مطلعین حذف شد.'
          });
        } else {
          session.taggedUserIds.push(tagUserId);
          const taggedUser = db.findUserById(tagUserId);
          await this.callApi('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: `✅ ${taggedUser ? taggedUser.name : 'همکار'} تگ شد.`
          });
        }
        await this.sendTaggedUsersSelection(chatId, cq.message?.message_id, true);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد تیکت منقضی شده است.', show_alert: true });
      }
      return;
    }

    // G3: Ticket Creation Wizard - Tagged Selection Done: nt_tag_done
    if (data === 'nt_tag_done') {
      const session = this.ticketCreationSessions.get(chatId);
      if (session) {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendNewTicketDraftCard(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد تیکت منقضی شده است.', show_alert: true });
      }
      return;
    }

    // H: Ticket Creation Wizard - Final Submit
    if (data === 'nt_submit') {
      await this.submitNewTicket(chatId, cq.id);
      return;
    }

    // I: Ticket Creation Wizard - Cancel
    if (data === 'nt_cancel') {
      this.ticketCreationSessions.delete(chatId);
      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'ایجاد تیکت لغو شد.'
      });
      try {
        await this.callApi('editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: '❌ *عملیات ایجاد تیکت جدید لغو شد.*',
          parse_mode: 'Markdown'
        });
      } catch (e) {}
      return;
    }

    // J: Announcement Wizard - Department Selected
    if (data.startsWith('na_dept:')) {
      const idx = parseInt(data.split(':')[1], 10);
      const session = this.announcementSessions.get(chatId);
      if (session) {
        if (idx === -1) {
          session.targetDepartment = 'all';
          session.targetDepartmentName = 'کل سازمان (همه واحدها)';
        } else {
          const depts = this.getStandardDepartments();
          session.targetDepartment = depts[idx] || 'all';
          session.targetDepartmentName = depts[idx] || 'کل سازمان (همه واحدها)';
        }
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendAnnouncementPrioritySelection(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد اعلان منقضی شده است.', show_alert: true });
      }
      return;
    }

    // K: Announcement Wizard - Priority Selected
    if (data.startsWith('na_pri:')) {
      const pri = data.split(':')[1];
      const session = this.announcementSessions.get(chatId);
      if (session) {
        session.priority = pri;
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id });
        await this.sendAnnouncementDraftCard(chatId, cq.message?.message_id);
      } else {
        await this.callApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'نشست ایجاد اعلان منقضی شده است.', show_alert: true });
      }
      return;
    }

    // L: Announcement Wizard - Submit Final
    if (data === 'na_submit') {
      await this.submitNewAnnouncement(chatId, cq.id);
      return;
    }

    // M: Announcement Wizard - Cancel
    if (data === 'na_cancel') {
      this.announcementSessions.delete(chatId);
      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'ثبت اعلان لغو شد.'
      });
      try {
        await this.callApi('editMessageText', {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          text: '❌ *عملیات ثبت بخشنامه و اعلان عمومی لغو شد.*',
          parse_mode: 'Markdown'
        });
      } catch (e) {}
      return;
    }

    // Fallback: always answer callback query so Telegram frees the button spinner
    try {
      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id
      });
    } catch (e) {}
  }

  // --- Persistent Main Menu Reply Keyboard ---
  getMainMenuKeyboard(userOrChatId) {
    let user = null;
    if (userOrChatId && typeof userOrChatId === 'object') {
      user = userOrChatId;
    } else if (userOrChatId) {
      user = db.findUserByTelegramChatId(userOrChatId) || db.findUserById(userOrChatId);
    }

    const rows = [
      [{ text: '🎫 ثبت تیکت جدید' }]
    ];

    if (this.canManageAnnouncements(user)) {
      rows.push([{ text: '📢 ثبت بخشنامه و اعلان عمومی' }]);
    }

    rows.push([{ text: '📋 تیکت‌های من' }, { text: '❓ راهنما و وضعیت' }]);

    return {
      keyboard: rows,
      resize_keyboard: true
    };
  }

  getPriorityBadge(priority) {
    switch (priority) {
      case 'urgent': return '🔴 فوری';
      case 'high': return '🟠 بالا';
      case 'low': return '⚪ کم';
      case 'normal':
      default: return '🟢 عادی';
    }
  }

  getStatusBadge(status) {
    switch (status) {
      case 'in_progress': return '🟡 در دست اقدام';
      case 'waiting': return '🟣 منتظر پاسخ';
      case 'resolved': return '🟢 حل شده';
      case 'closed': return '⚫ بسته شده';
      case 'open':
      default: return '🔵 باز';
    }
  }

  getStandardDepartments() {
    return ['مدیریت', 'مهندسی', 'مالی و حسابداری', 'پشتیبانی'];
  }

  // --- Start Ticket Creation Wizard ---
  async startTicketCreationWizard(chatId) {
    const user = db.findUserByTelegramChatId(chatId);
    if (!user) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '⚠️ حساب تلگرام شما هنوز به سامانه متصل نشده است.\nلطفاً ابتدا کد ۶ رقمی موجود در بخش «پروفایل من» در پنل وب را ارسال فرمایید.'
      });
      return;
    }

    // Clear any previous sessions
    this.draftSessions.delete(chatId);
    this.ticketCreationSessions.set(chatId, {
      chatId,
      user,
      step: 'AWAITING_TITLE',
      title: '',
      department: 'مدیریت',
      priority: 'normal',
      assigneeId: null,
      assigneeName: 'عمومی (بدون مسئول اختصاصی)',
      taggedUserIds: [],
      statusMessageId: null,
      descriptionLines: [],
      attachments: [],
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🎫 *ایجاد تیکت جدید (مرحله ۱ از ۵)*\n\n` +
            `همکار گرامی *${this.escapeMarkdown(user.name)}*، لطفاً **عنوان تیکت** خود را بنویسید و ارسال فرمایید:\n\n` +
            `_مثال: عدم اتصال به اینترنت یا درخواست دسترسی به مخزن کد_`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ انصراف از ایجاد تیکت', callback_data: 'nt_cancel' }]
        ]
      }
    });
  }

  // --- Step 2: Department Selection ---
  async sendDepartmentSelection(chatId) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_DEPT';
    const depts = this.getStandardDepartments();
    const inlineKeyboard = [];

    for (let i = 0; i < depts.length; i += 2) {
      const row = [{ text: depts[i], callback_data: `nt_dept:${i}` }];
      if (depts[i + 1]) {
        row.push({ text: depts[i + 1], callback_data: `nt_dept:${i + 1}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: '❌ انصراف', callback_data: 'nt_cancel' }]);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🏢 *انتخاب واحد سازمانی (مرحله ۲ از ۵)*\n\n` +
            `📌 *عنوان تیکت:* ${this.escapeMarkdown(session.title)}\n\n` +
            `لطفاً واحد یا دپارتمان مربوطه را انتخاب کنید:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
  }

  // --- Step 3: Priority Selection ---
  async sendPrioritySelection(chatId, messageId = null) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_PRIORITY';
    const inlineKeyboard = [
      [
        { text: '🔴 فوری (Urgent)', callback_data: 'nt_pri:urgent' },
        { text: '🟠 بالا (High)', callback_data: 'nt_pri:high' }
      ],
      [
        { text: '🟢 عادی (Normal)', callback_data: 'nt_pri:normal' },
        { text: '⚪ کم (Low)', callback_data: 'nt_pri:low' }
      ],
      [
        { text: '❌ انصراف', callback_data: 'nt_cancel' }
      ]
    ];

    const text = `⚡ *تعیین اولویت تیکت (مرحله ۳ از ۵)*\n\n` +
                 `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                 `🏢 *واحد:* ${this.escapeMarkdown(session.department)}\n\n` +
                 `میزان فوریت تیکت را تعیین کنید:`;

    if (messageId) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      } catch (e) {}
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  // --- Step 4: Assignee Selection ---
  async sendAssigneeSelection(chatId, messageId = null) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_ASSIGNEE';
    // Strictly filter active users belonging to the selected department
    const activeUsers = db.data.users.filter(u => !u.isRestricted && u.department === session.department && u.id !== session.user.id);

    const inlineKeyboard = [];
    const targetUsers = activeUsers.slice(0, 10);
    for (let i = 0; i < targetUsers.length; i += 2) {
      const u1 = targetUsers[i];
      const row = [{ text: `👤 ${u1.name}`, callback_data: `nt_asg:${u1.id}` }];
      if (targetUsers[i + 1]) {
        const u2 = targetUsers[i + 1];
        row.push({ text: `👤 ${u2.name}`, callback_data: `nt_asg:${u2.id}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: '👥 بدون مسئول اختصاصی (ارجاع عمومی)', callback_data: 'nt_asg:none' }]);
    inlineKeyboard.push([{ text: '❌ انصراف', callback_data: 'nt_cancel' }]);

    const text = `👤 *انتخاب مسئول انجام (مرحله ۴ از ۵)*\n\n` +
                 `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                 `🏢 *واحد:* ${this.escapeMarkdown(session.department)}\n` +
                 `⚡ *اولویت:* ${this.getPriorityBadge(session.priority)}\n\n` +
                 (activeUsers.length > 0
                   ? `همکاران واحد «*${this.escapeMarkdown(session.department)}*»:\nمسئول پیگیری تیکت را انتخاب فرمایید:`
                   : `ℹ️ همکار دیگری در واحد «*${this.escapeMarkdown(session.department)}*» یافت نشد. تیکت به صورت ارجاع عمومی ثبت خواهد شد:`);

    if (messageId) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      } catch (e) {}
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  // --- Step 5: Tagged Colleagues Selection (Multi-select Toggle) ---
  async sendTaggedUsersSelection(chatId, messageId = null, isToggle = false) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_TAGGED';
    if (!Array.isArray(session.taggedUserIds)) {
      session.taggedUserIds = [];
    }

    // Candidate colleagues across ALL departments (excluding creator and assignee)
    const candidateUsers = db.data.users.filter(u => {
      if (u.isRestricted) return false;
      if (u.id === session.user.id) return false;
      if (session.assigneeId && u.id === session.assigneeId) return false;
      return true;
    });

    // Sort: same department first, then by department and name
    candidateUsers.sort((a, b) => {
      const aSame = a.department === session.department ? 1 : 0;
      const bSame = b.department === session.department ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
      return (a.department || '').localeCompare(b.department || '') || a.name.localeCompare(b.name);
    });

    const inlineKeyboard = [];
    const targetUsers = candidateUsers.slice(0, 20);
    for (let i = 0; i < targetUsers.length; i += 2) {
      const u1 = targetUsers[i];
      const isU1Tagged = session.taggedUserIds.includes(u1.id);
      const u1Dept = u1.department ? ` (${u1.department})` : '';
      const row = [{
        text: `${isU1Tagged ? '✅' : '▫️'} ${u1.name}${u1Dept}`,
        callback_data: `nt_tag:${u1.id}`
      }];

      if (targetUsers[i + 1]) {
        const u2 = targetUsers[i + 1];
        const isU2Tagged = session.taggedUserIds.includes(u2.id);
        const u2Dept = u2.department ? ` (${u2.department})` : '';
        row.push({
          text: `${isU2Tagged ? '✅' : '▫️'} ${u2.name}${u2Dept}`,
          callback_data: `nt_tag:${u2.id}`
        });
      }
      inlineKeyboard.push(row);
    }

    // Bottom action row: Proceed to draft / Skip
    const taggedCount = session.taggedUserIds.length;
    if (taggedCount > 0) {
      inlineKeyboard.push([
        { text: `➡️ تایید مطلعین (${taggedCount} نفر) و مرحله بعد ✍️`, callback_data: 'nt_tag_done' }
      ]);
    } else {
      inlineKeyboard.push([
        { text: '⏩ بدون تگ همکاران (ادامه) ➡️', callback_data: 'nt_tag_done' }
      ]);
    }

    inlineKeyboard.push([{ text: '❌ انصراف', callback_data: 'nt_cancel' }]);

    const taggedNamesText = taggedCount > 0
      ? session.taggedUserIds.map(id => {
          const u = db.findUserById(id);
          return u ? `${u.name} (${u.department || 'عمومی'})` : id;
        }).join('، ')
      : '_(هیچ کاربری تگ نشده است)_';

    const text = `👥 *تگ کردن همکاران مطلع (مرحله ۵ از ۵ - اختیاری)*\n\n` +
                 `📌 *عنوان تیکت:* ${this.escapeMarkdown(session.title)}\n` +
                 `🏢 *واحد:* ${this.escapeMarkdown(session.department)}\n` +
                 `⚡ *اولویت:* ${this.getPriorityBadge(session.priority)}\n` +
                 `👤 *مسئول:* ${this.escapeMarkdown(session.assigneeName)}\n\n` +
                 (candidateUsers.length > 0
                   ? `🏷️ *مطلعین انتخاب‌شده:* ${this.escapeMarkdown(taggedNamesText)}\n\n` +
                     `👇 _برای انتخاب یا حذف هر همکار (از کلیه واحدها)، روی نام او ضربه بزنید. پس از اتمام، دکمه تایید را لمس فرمایید:_`
                   : `ℹ️ همکار دیگری جهت تگ کردن یافت نشد.\nجهت ادامه به مرحله بعد بروید:`);

    if (messageId) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      } catch (e) {
        if (e.message && e.message.includes('message is not modified')) return;
      }
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  // --- Step 6: Send Interactive Draft Card ---
  async sendNewTicketDraftCard(chatId, messageId = null) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) return;

    session.step = 'DRAFT_CONTENT';

    const taggedCount = Array.isArray(session.taggedUserIds) ? session.taggedUserIds.length : 0;
    const taggedNames = taggedCount > 0
      ? session.taggedUserIds.map(id => {
          const u = db.findUserById(id);
          return u ? u.name : id;
        }).join('، ')
      : 'ندارد (بدون تگ)';

    const draftText = `🎫 *پیش‌نویس تیکت جدید*\n\n` +
                      `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                      `🏢 *واحد:* ${this.escapeMarkdown(session.department)}\n` +
                      `⚡ *اولویت:* ${this.getPriorityBadge(session.priority)}\n` +
                      `👤 *مسئول:* ${this.escapeMarkdown(session.assigneeName)}\n` +
                      `👥 *مطلعین (تگ‌شده):* ${this.escapeMarkdown(taggedNames)}\n\n` +
                      `📝 *شرح و توضیحات تیکت:*\n` +
                      `_(هنوز متنی وارد نشده است)_\n\n` +
                      `📎 *فایل‌های پیوست:* (۰ فایل)\n\n` +
                      `👇 *راهنما:* اکنون لطفاً متن کامل توضیحات تیکت را بنویسید و ارسال فرمایید. همچنین می‌توانید چندین عکس، فایل، سند یا وویس ارسال کنید تا به این تیکت ضمیمه شوند.\n` +
                      `پس از تکمیل، دکمه «تایید و ثبت نهایی تیکت» را لمس کنید:`;

    const inlineKeyboard = [
      [
        { text: '📤 تایید و ثبت نهایی تیکت', callback_data: 'nt_submit' }
      ],
      [
        { text: '❌ انصراف و لغو', callback_data: 'nt_cancel' }
      ]
    ];

    if (messageId) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: draftText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        session.statusMessageId = messageId;
        return;
      } catch (e) {}
    }

    const sent = await this.callApi('sendMessage', {
      chat_id: chatId,
      text: draftText,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });

    if (sent && sent.message_id) {
      session.statusMessageId = sent.message_id;
    }
  }

  // --- Live Update of New Ticket Draft Card ---
  async updateNewTicketDraftStatusMessage(chatId) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session || !session.statusMessageId) return;

    const combinedText = session.descriptionLines.join('\n\n');
    const textPreview = combinedText
      ? this.escapeMarkdown(combinedText.slice(0, 300) + (combinedText.length > 300 ? '...' : ''))
      : '_(هنوز متنی وارد نشده)_';

    let filesPreview = '_(۰ فایل)_';
    if (session.attachments.length > 0) {
      filesPreview = session.attachments.map((att, idx) => {
        const sizeKb = Math.round(att.size / 1024);
        return `   ${idx + 1}. 📎 *${this.escapeMarkdown(att.name)}* (${sizeKb} KB)`;
      }).join('\n');
    }

    const taggedCount = Array.isArray(session.taggedUserIds) ? session.taggedUserIds.length : 0;
    const taggedNames = taggedCount > 0
      ? session.taggedUserIds.map(id => {
          const u = db.findUserById(id);
          return u ? u.name : id;
        }).join('، ')
      : 'ندارد (بدون تگ)';

    const draftText = `🎫 *پیش‌نویس تیکت جدید*\n\n` +
                      `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                      `🏢 *واحد:* ${this.escapeMarkdown(session.department)}\n` +
                      `⚡ *اولویت:* ${this.getPriorityBadge(session.priority)}\n` +
                      `👤 *مسئول:* ${this.escapeMarkdown(session.assigneeName)}\n` +
                      `👥 *مطلعین (تگ‌شده):* ${this.escapeMarkdown(taggedNames)}\n\n` +
                      `📝 *شرح و توضیحات تیکت:*\n` +
                      `${textPreview}\n\n` +
                      `📎 *پیوست‌ها (${session.attachments.length} عدد):*\n` +
                      `${filesPreview}\n\n` +
                      `💡 _می‌توانید همچنان توضیحات یا فایل‌های بیشتری بفرستید._\n` +
                      `برای ثبت تیکت، دکمه زیر را لمس فرمایید:`;

    const inlineKeyboard = [
      [
        {
          text: `📤 تایید و ثبت نهایی تیکت (${session.attachments.length} پیوست)`,
          callback_data: 'nt_submit'
        }
      ],
      [
        { text: '❌ انصراف و لغو', callback_data: 'nt_cancel' }
      ]
    ];

    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: session.statusMessageId,
        text: draftText,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } catch (e) {}
  }

  // --- Final Submit New Ticket ---
  async submitNewTicket(chatId, callbackQueryId) {
    const session = this.ticketCreationSessions.get(chatId);
    if (!session) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: 'پیش‌نویس تیکت یافت نشد یا منقضی گردیده است.',
          show_alert: true
        });
      }
      return;
    }

    const user = session.user;
    const finalDesc = session.descriptionLines.join('\n\n') || session.title;
    const taggedUserIds = Array.isArray(session.taggedUserIds) ? session.taggedUserIds : [];
    const taggedCount = taggedUserIds.length;
    const taggedNames = taggedCount > 0
      ? taggedUserIds.map(id => {
          const u = db.findUserById(id);
          return u ? u.name : id;
        }).join('، ')
      : 'ندارد';

    const newTicket = db.createTicket({
      title: session.title,
      description: finalDesc,
      creatorId: user.id,
      assigneeId: session.assigneeId,
      taggedUserIds: taggedUserIds,
      priority: session.priority,
      status: 'open',
      department: session.department,
      deadline: null,
      attachments: [...session.attachments],
      channel: 'telegram'
    });

    const statusMsgId = session.statusMessageId;
    this.ticketCreationSessions.delete(chatId);

    if (callbackQueryId) {
      await this.callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: `✅ تیکت ${newTicket.id} با موفقیت ثبت شد.`
      });
    }

    // 1. Update telegram message
    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: statusMsgId,
        text: `✅ *تیکت شما با شناسه \`${newTicket.id}\` با موفقیت در سامانه ثبت گردید.*\n\n` +
              `📌 *عنوان:* ${this.escapeMarkdown(newTicket.title)}\n` +
              `🏢 *واحد:* ${this.escapeMarkdown(newTicket.department)}\n` +
              `⚡ *اولویت:* ${this.getPriorityBadge(newTicket.priority)}\n` +
              `👤 *مسئول:* ${this.escapeMarkdown(session.assigneeName)}\n` +
              `👥 *مطلعین:* ${this.escapeMarkdown(taggedNames)}\n` +
              `📎 *پیوست‌ها:* ${newTicket.attachments.length} فایل\n\n` +
              `⚡️ این تیکت در لحظه روی سامانه وب تیکتینگ برای همکاران قابل مشاهده شد.`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 ارسال پیام تکمیلی / پاسخ', callback_data: `start_reply:${newTicket.id}` }]
          ]
        }
      });
    } catch (e) {}

    // 2. Real-time broadcast to Web and Mobile Panels (<50ms sync!)
    this.broadcastWs({
      type: 'TICKET_CREATED',
      ticket: newTicket
    });

    // 3. Dispatch Web-Push & Telegram Notification with Handshake to Assignee
    const pushService = require('./push');
    if (newTicket.assigneeId && newTicket.assigneeId !== user.id) {
      try {
        pushService.sendToUsers([newTicket.assigneeId], {
          title: `تیکت جدید: ${newTicket.title}`,
          body: `توسط ${user.name} (از تلگرام) ارجاع گردید.`,
          ticketId: newTicket.id,
          url: `./?ticket=${newTicket.id}`
        });

        const delivery = db.createDelivery({
          type: 'ticket',
          referenceId: newTicket.id,
          title: `تیکت جدید (${newTicket.id}): ${newTicket.title}`,
          message: `توسط ${user.name} (از تلگرام) ارجاع گردید.\nتوضیحات: ${(newTicket.description || '').slice(0, 150)}`,
          targetUserIds: [newTicket.assigneeId],
          creatorId: user.id
        });

        await this.sendNotificationWithHandshake({
          deliveryId: delivery.id,
          userId: newTicket.assigneeId,
          title: `تیکت جدید (${newTicket.id}): ${newTicket.title}`,
          message: `توسط ${user.name} (از تلگرام) ارجاع گردید.\nتوضیحات: ${(newTicket.description || '').slice(0, 150)}`,
          ticketId: newTicket.id,
          priority: newTicket.priority
        });
      } catch (err) {
        console.warn('Notification dispatch error for new ticket assignee:', err.message);
      }
    }

    // 4. Dispatch Web-Push & Telegram Notification with Handshake to Tagged Colleagues
    if (taggedUserIds.length > 0) {
      const validTagged = taggedUserIds.filter(id => id && id !== user.id && id !== newTicket.assigneeId);
      if (validTagged.length > 0) {
        try {
          pushService.sendToUsers(validTagged, {
            title: `تگ در تیکت جدید: ${newTicket.title}`,
            body: `توسط ${user.name} به عنوان همکار مطلع تگ شدید.`,
            ticketId: newTicket.id,
            url: `./?ticket=${newTicket.id}`
          });

          for (const taggedId of validTagged) {
            const delivery = db.createDelivery({
              type: 'ticket',
              referenceId: newTicket.id,
              title: `تگ در تیکت (${newTicket.id}): ${newTicket.title}`,
              message: `توسط ${user.name} به عنوان همکار مطلع در این تیکت تگ شدید.\nمسئول تیکت: ${session.assigneeName}\nتوضیحات: ${(newTicket.description || '').slice(0, 150)}`,
              targetUserIds: [taggedId],
              creatorId: user.id
            });

            await this.sendNotificationWithHandshake({
              deliveryId: delivery.id,
              userId: taggedId,
              title: `تگ در تیکت (${newTicket.id}): ${newTicket.title}`,
              message: `توسط ${user.name} به عنوان همکار مطلع در این تیکت تگ شدید.\nمسئول تیکت: ${session.assigneeName}\nتوضیحات: ${(newTicket.description || '').slice(0, 150)}`,
              ticketId: newTicket.id,
              priority: newTicket.priority
            });
          }
        } catch (err) {
          console.warn('Notification dispatch error for new ticket tagged users:', err.message);
        }
      }
    }
  }

  // =================================================================
  // ANNOUNCEMENT WIZARD (Managers & Admins only)
  // =================================================================

  async startAnnouncementWizard(chatId) {
    const user = db.findUserByTelegramChatId(chatId);
    if (!user) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '⚠️ حساب تلگرام شما متصل نیست. لطفاً ابتدا با ارسال کد ۶ رقمی حساب خود را متصل فرمایید.'
      });
      return;
    }

    if (!this.canManageAnnouncements(user)) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '⛔️ *دسترسی غیرمجاز!*\nامکان ارسال بخشنامه و اعلان عمومی فقط برای مدیران و سرپرستان سیستم مجاز است.',
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard(user)
      });
      return;
    }

    // Clear conflicting sessions
    this.draftSessions.delete(chatId);
    this.ticketCreationSessions.delete(chatId);

    this.announcementSessions.set(chatId, {
      chatId,
      user,
      step: 'AWAITING_TITLE',
      title: '',
      content: '',
      targetDepartment: 'all',
      targetDepartmentName: 'کل سازمان (همه واحدها)',
      priority: 'normal',
      statusMessageId: null,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `📢 *ثبت بخشنامه و اعلان عمومی سازمانی (مرحله ۱ از ۴)*\n\n` +
            `همکار گرامی *${this.escapeMarkdown(user.name)}*، لطفاً **عنوان اعلان عمومی** را ارسال فرمایید:\n\n` +
            `_مثال: تغییر ساعت کاری در روزهای پنجشنبه یا جلسه اضطراری واحد فنی_`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ انصراف', callback_data: 'na_cancel' }]
        ]
      }
    });
  }

  async sendAnnouncementDepartmentSelection(chatId) {
    const session = this.announcementSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_DEPT';
    const depts = this.getStandardDepartments();
    const inlineKeyboard = [
      [{ text: '🌐 کل سازمان (همه پرسنل و واحدها)', callback_data: 'na_dept:-1' }]
    ];

    for (let i = 0; i < depts.length; i += 2) {
      const row = [{ text: depts[i], callback_data: `na_dept:${i}` }];
      if (depts[i + 1]) {
        row.push({ text: depts[i + 1], callback_data: `na_dept:${i + 1}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: '❌ انصراف', callback_data: 'na_cancel' }]);

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `🏢 *انتخاب جامعه هدف اعلان (مرحله ۳ از ۴)*\n\n` +
            `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n\n` +
            `لطفاً مشخص کنید این اعلان برای چه افرادی ارسال شود:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
  }

  async sendAnnouncementPrioritySelection(chatId, messageIdToEdit = null) {
    const session = this.announcementSessions.get(chatId);
    if (!session) return;

    session.step = 'AWAITING_PRIORITY';
    const inlineKeyboard = [
      [
        { text: '🟢 عادی', callback_data: 'na_pri:normal' },
        { text: '🟡 متوسط', callback_data: 'na_pri:low' }
      ],
      [
        { text: '🟠 بالا', callback_data: 'na_pri:high' },
        { text: '🔴 فوری / بحرانی', callback_data: 'na_pri:urgent' }
      ],
      [
        { text: '❌ انصراف', callback_data: 'na_cancel' }
      ]
    ];

    const text = `⚡ *تعیین سطح اهمیت و اولویت اعلان (مرحله ۴ از ۴)*\n\n` +
                 `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                 `👥 *جامعه هدف:* ${this.escapeMarkdown(session.targetDepartmentName)}\n\n` +
                 `اولویت ارسال را انتخاب نمایید:`;

    if (messageIdToEdit) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageIdToEdit,
          text,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        return;
      } catch (e) {}
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  async sendAnnouncementDraftCard(chatId, messageIdToEdit = null) {
    const session = this.announcementSessions.get(chatId);
    if (!session) return;

    session.step = 'DRAFT_CONFIRM';

    const priBadge = this.getPriorityBadge(session.priority);

    // Calculate approximate recipient count
    let targetUsers = db.data.users.filter(u => !u.isRestricted);
    if (session.targetDepartment && session.targetDepartment !== 'all') {
      targetUsers = targetUsers.filter(u => u.department === session.targetDepartment);
    }
    const recipientCount = targetUsers.length;
    const tgCount = targetUsers.filter(u => u.telegramChatId).length;

    const draftText = `📋 *پیش‌نویس نهایی بخشنامه و اعلان عمومی*\n\n` +
                      `📌 *عنوان:* ${this.escapeMarkdown(session.title)}\n` +
                      `👥 *جامعه هدف:* ${this.escapeMarkdown(session.targetDepartmentName)} (${recipientCount} نفر، ${tgCount} تلگرام فعال)\n` +
                      `⚡ *اولویت:* ${priBadge}\n\n` +
                      `📄 *متن کامل اعلان:*\n${this.escapeMarkdown(session.content)}\n\n` +
                      `⚠️ *توجه:* پس از تایید، این اعلان برای تمام افراد فوق ارسال شده و دکمه «تایید دریافت و مشاهده» در تلگرام آن‌ها قرار خواهد گرفت.\n\n` +
                      `جهت ارسال نهایی، دکمه زیر را لمس فرمایید:`;

    const inlineKeyboard = [
      [
        { text: '🚀 تایید و ارسال رسمی اعلان', callback_data: 'na_submit' }
      ],
      [
        { text: '❌ انصراف و لغو', callback_data: 'na_cancel' }
      ]
    ];

    if (messageIdToEdit) {
      try {
        await this.callApi('editMessageText', {
          chat_id: chatId,
          message_id: messageIdToEdit,
          text: draftText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
        session.statusMessageId = messageIdToEdit;
        return;
      } catch (e) {}
    }

    const sent = await this.callApi('sendMessage', {
      chat_id: chatId,
      text: draftText,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    session.statusMessageId = sent.message_id;
  }

  async submitNewAnnouncement(chatId, callbackQueryId) {
    const session = this.announcementSessions.get(chatId);
    if (!session) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: 'پیش‌نویس اعلان یافت نشد یا منقضی گردیده است.',
          show_alert: true
        });
      }
      return;
    }

    const user = session.user;
    if (!this.canManageAnnouncements(user)) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: 'عدم دسترسی!',
          show_alert: true
        });
      }
      return;
    }

    // 1. Create Announcement in Database
    const ann = db.createAnnouncement({
      title: session.title,
      content: session.content,
      targetDepartment: session.targetDepartment || 'all',
      priority: session.priority || 'normal',
      creatorId: user.id
    });

    // Determine target users
    let targetUsers = db.data.users.filter(u => !u.isRestricted);
    if (session.targetDepartment && session.targetDepartment !== 'all') {
      targetUsers = targetUsers.filter(u => u.department === session.targetDepartment);
    }
    const targetUserIds = targetUsers.map(u => u.id);

    // 2. Create Delivery Group with Tracking
    const delivery = db.createDelivery({
      type: 'announcement',
      referenceId: ann.id,
      title: `بخشنامه سازمانی: ${session.title}`,
      message: session.content,
      targetUserIds,
      creatorId: user.id
    });

    const statusMsgId = session.statusMessageId;
    this.announcementSessions.delete(chatId);

    if (callbackQueryId) {
      await this.callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: `✅ بخشنامه با موفقیت برای ${targetUserIds.length} نفر ثبت و ارسال شد.`
      });
    }

    // 3. Edit admin status message
    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: statusMsgId,
        text: `✅ *بخشنامه سازمانی با موفقیت منتشر شد!*\n\n` +
              `📌 *عنوان:* ${this.escapeMarkdown(ann.title)}\n` +
              `👥 *جامعه هدف:* ${this.escapeMarkdown(session.targetDepartmentName)}\n` +
              `⚡ *اولویت:* ${this.getPriorityBadge(session.priority)}\n` +
              `📊 *تعداد مخاطبین:* ${targetUserIds.length} نفر\n\n` +
              `این بخشنامه در پنل وب ثبت و به ربات تلگرام تمام همکاران متصل ارسال شد.`,
        parse_mode: 'Markdown'
      });
    } catch (e) {}

    // 4. Send Web-Push
    try {
      const pushService = require('./push');
      pushService.sendToUsers(targetUserIds, {
        title: `بخشنامه سازمانی: ${session.title}`,
        body: session.content.slice(0, 90),
        url: './'
      });
    } catch (e) {}

    // 5. Broadcast live to Web Panels
    this.broadcastWs({
      type: 'ANNOUNCEMENT_CREATED',
      announcement: ann,
      delivery
    });

    // 6. Send Telegram notification with Handshake button to each recipient
    for (const u of targetUsers) {
      if (u.telegramChatId) {
        try {
          await this.sendNotificationWithHandshake({
            deliveryId: delivery.id,
            userId: u.id,
            title: `📢 بخشنامه سازمانی: ${session.title}`,
            message: session.content,
            priority: session.priority || 'normal'
          });
        } catch (err) {
          console.warn(`Error dispatching announcement to user ${u.id}:`, err.message);
        }
      }
    }
  }
  async handleMyTicketsCommand(chatId) {
    const user = db.findUserByTelegramChatId(chatId);
    if (!user) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '⚠️ ابتدا با ارسال کد ۶ رقمی، حساب خود را متصل نمایید.'
      });
      return;
    }

    const myTickets = db.data.tickets.filter(t => {
      const isCreator = t.creatorId === user.id;
      const isAssignee = t.assigneeId === user.id;
      const isTagged = Array.isArray(t.taggedUserIds) && t.taggedUserIds.includes(user.id);
      return (isCreator || isAssignee || isTagged) && t.status !== 'closed';
    }).slice(0, 8);

    if (myTickets.length === 0) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `همکار گرامی *${this.escapeMarkdown(user.name)}*،\nشما در حال حاضر تیکت باز یا در انتظاری ندارید. 🎉`,
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard(user || chatId)
      });
      return;
    }

    let msgText = `📋 *لیست تیکت‌های فعال شما (${myTickets.length} مورد اخیر):*\n\n`;
    const inlineKeyboard = [];

    myTickets.forEach((t, i) => {
      msgText += `${i + 1}. \`${t.id}\` — *${this.escapeMarkdown(t.title)}*\n` +
                 `   ▫️ وضعیت: ${this.getStatusBadge(t.status)} | ${this.getPriorityBadge(t.priority)}\n` +
                 `   ▫️ واحد: ${this.escapeMarkdown(t.department || 'عمومی')}\n\n`;
      inlineKeyboard.push([
        { text: `💬 پاسخ / پیگیری ${t.id}`, callback_data: `start_reply:${t.id}` }
      ]);
    });

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: msgText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
  }

  // --- Help & Status Handler ---
  async handleHelpCommand(chatId) {
    const user = db.findUserByTelegramChatId(chatId);
    const userInfo = user ? `👤 *حساب متصل:* ${this.escapeMarkdown(user.name)} (${this.escapeMarkdown(user.department)})\n\n` : '';

    let text = `ℹ️ *راهنمای ربات تیکتینگ و اعلانات مانا*\n\n` +
               userInfo +
               `🔹 *ثبت تیکت جدید:* ارسال دستور \`/newticket\` یا دکمه «🎫 ثبت تیکت جدید»\n` +
               `🔹 *مشاهده تیکت‌ها:* ارسال دستور \`/tickets\` یا دکمه «📋 تیکت‌های من»\n` +
               `🔹 *پاسخ‌دهی به تیکت:* لمس دکمه «💬 پاسخ به این تیکت» زیر هر پیام اعلان\n` +
               `🔹 *تایید دریافت:* لمس دکمه «✅ مشاهده شد» زیر پیام‌ها جهت ثبت حضور\n` +
               `🔹 *لغو عملیات جاری:* ارسال \`/cancel\``;

    if (this.canManageAnnouncements(user)) {
      text += `\n\n📢 *دسترسی مدیریت:* ارسال بخشنامه با دستور \`/announce\` یا دکمه «📢 ثبت بخشنامه و اعلان عمومی»`;
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: this.getMainMenuKeyboard(user)
    });
  }

  // --- Initialize Draft Session for Multi-Item Reply ---
  async initReplyDraftSession(chatId, ticketId) {
    const ticket = db.data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const draftText = `📝 *پیش‌نویس پاسخ به تیکت:* \`${ticket.id}\`\n` +
                      `📌 *عنوان تیکت:* ${this.escapeMarkdown(ticket.title)}\n\n` +
                      `▫️ *متن پاسخ:* _(هنوز متنی ارسال نشده)_\n` +
                      `▫️ *فایل‌های پیوست:* _(۰ فایل)_\n\n` +
                      `👇 *راهنما:* اکنون می‌توانید به نوبت پیام‌های متنی، عکس‌ها یا فایل‌های مورد نظرتان را بفرستید. هر پیامی که بفرستید به این پیش‌نویس اضافه خواهد شد.\n` +
                      `پس از اتمام، دکمه «تایید و ارسال نهایی پاسخ» را بزنید:`;

    const inlineKeyboard = [
      [
        {
          text: '📤 تایید و ارسال نهایی پاسخ به تیکت',
          callback_data: `submit_reply:${ticket.id}`
        }
      ],
      [
        {
          text: '❌ لغو و انصراف',
          callback_data: `cancel_reply:${ticket.id}`
        }
      ]
    ];

    const sent = await this.callApi('sendMessage', {
      chat_id: chatId,
      text: draftText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });

    this.draftSessions.set(chatId, {
      ticketId: ticket.id,
      statusMessageId: sent.message_id,
      texts: [],
      attachments: [],
      expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes active
    });
  }

  // --- Live Update of the Draft Status Message in Telegram ---
  async updateDraftStatusMessage(chatId) {
    const session = this.draftSessions.get(chatId);
    if (!session || !session.statusMessageId) return;

    const ticket = db.data.tickets.find(t => t.id === session.ticketId);
    if (!ticket) return;

    const combinedText = session.texts.join('\n\n');
    const textPreview = combinedText ? this.escapeMarkdown(combinedText.slice(0, 300) + (combinedText.length > 300 ? '...' : '')) : '_(هنوز متنی وارد نشده)_';

    let filesPreview = '_(۰ فایل)_';
    if (session.attachments.length > 0) {
      filesPreview = session.attachments.map((att, idx) => {
        const sizeKb = Math.round(att.size / 1024);
        return `   ${idx + 1}. 📎 *${this.escapeMarkdown(att.name)}* (${sizeKb} KB)`;
      }).join('\n');
    }

    const draftText = `📝 *پیش‌نویس پاسخ به تیکت:* \`${ticket.id}\`\n` +
                      `📌 *عنوان تیکت:* ${this.escapeMarkdown(ticket.title)}\n\n` +
                      `▫️ *متن پاسخ:* \n${textPreview}\n\n` +
                      `▫️ *فایل‌های پیوست (${session.attachments.length} عدد):*\n${filesPreview}\n\n` +
                      `💡 _می‌توانید همچنان فایل یا توضیحات دیگری ارسال کنید._\n` +
                      `هر زمان آماده بودید، دکمه زیر را جهت ارسال ثبت نهایی لمس فرمایید:`;

    const inlineKeyboard = [
      [
        {
          text: `📤 تایید و ثبت نهایی (${session.attachments.length} پیوست)`,
          callback_data: `submit_reply:${ticket.id}`
        }
      ],
      [
        {
          text: '❌ لغو و انصراف',
          callback_data: `cancel_reply:${ticket.id}`
        }
      ]
    ];

    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: session.statusMessageId,
        text: draftText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
    } catch (err) {
      // Ignore if identical or edited already
    }
  }

  // --- Submit Final Draft to Ticket & Web Panel ---
  async submitFinalDraftReply(chatId, ticketId, callbackQueryId) {
    const user = db.findUserByTelegramChatId(chatId);
    if (!user) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: '❌ حساب شما متصل نیست.',
          show_alert: true
        });
      }
      return;
    }

    const session = this.draftSessions.get(chatId);
    if (!session || session.ticketId !== ticketId) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: 'پیش‌نویس پاسخ منقضی یا بسته شده است.',
          show_alert: true
        });
      }
      return;
    }

    const ticket = db.data.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: '❌ تیکت یافت نشد.',
          show_alert: true
        });
      }
      this.draftSessions.delete(chatId);
      return;
    }

    const combinedText = session.texts.join('\n\n').trim();
    if (!combinedText && session.attachments.length === 0) {
      if (callbackQueryId) {
        await this.callApi('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: '⚠️ پیش‌نویس شما خالی است! لطفاً حداقل یک متن یا فایل ارسال نمایید.',
          show_alert: true
        });
      }
      return;
    }

    const finalText = combinedText || (session.attachments.length > 0 ? `پیوست‌های ارسالی (${session.attachments.length} فایل)` : 'پاسخ ارسالی از تلگرام');

    // Create formal reply
    const reply = {
      id: 'rep_tg_' + Date.now(),
      authorId: user.id,
      content: finalText,
      attachments: [...session.attachments],
      createdAt: new Date().toISOString()
    };

    ticket.replies.push(reply);
    ticket.updatedAt = new Date().toISOString();
    db.save();

    // Clean up session
    const statusMsgId = session.statusMessageId;
    this.draftSessions.delete(chatId);

    if (callbackQueryId) {
      await this.callApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: '✅ پاسخ با موفقیت روی سرور ذخیره شد.'
      });
    }

    // 1. Update the Telegram status message to confirmed
    try {
      await this.callApi('editMessageText', {
        chat_id: chatId,
        message_id: statusMsgId,
        text: `✅ *پاسخ شما با موفقیت در تیکت ${ticket.id} ثبت گردید.*\n\n` +
              `📝 *متن:* ${this.escapeMarkdown(finalText)}\n` +
              `📎 *پیوست‌ها:* ${reply.attachments.length} فایل\n\n` +
              `⚡️ این پاسخ در لحظه روی سامانه وب تیکتینگ و برای سایر همکاران قابل مشاهده شد.`,
        parse_mode: 'Markdown'
      });
    } catch (e) {}

    // 2. Real-time broadcast to Web and Mobile Panels (<50ms sync!)
    this.broadcastWs({
      type: 'TICKET_REPLY_ADDED',
      ticketId: ticket.id,
      reply,
      ticket
    });

    // 3. Auto-acknowledge pending delivery handshakes for this ticket for this user
    await this.autoAcknowledgeTicketDeliveries(ticket.id, user.id);

    // 4. Dispatch notifications to other participants
    const allParticipants = [ticket.creatorId, ticket.assigneeId, ...(ticket.taggedUserIds || [])];
    const notifyIds = Array.from(new Set(allParticipants)).filter(id => id && id !== user.id);

    if (notifyIds.length > 0) {
      const delivery = db.createDelivery({
        type: 'ticket',
        referenceId: ticket.id,
        title: `پاسخ جدید در تیکت ${ticket.id}: ${ticket.title}`,
        message: `${user.name} (از تلگرام): ${reply.content.slice(0, 150)}`,
        targetUserIds: notifyIds,
        creatorId: user.id
      });

      for (const targetUid of notifyIds) {
        await this.sendNotificationWithHandshake({
          deliveryId: delivery.id,
          userId: targetUid,
          title: `پاسخ جدید در تیکت ${ticket.id}: ${ticket.title}`,
          message: `${user.name} (از تلگرام): ${reply.content.slice(0, 150)}`,
          ticketId: ticket.id,
          priority: ticket.priority
        });
      }
    }
  }

  async handleIncomingMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const caption = (msg.caption || '').trim();
    const username = msg.from?.username || msg.from?.first_name || '';

    // Check cancel command
    if (text === '/cancel' || text === '❌ انصراف') {
      let cancelled = false;
      if (this.announcementSessions.has(chatId)) {
        this.announcementSessions.delete(chatId);
        cancelled = true;
      }
      if (this.ticketCreationSessions.has(chatId)) {
        this.ticketCreationSessions.delete(chatId);
        cancelled = true;
      }
      if (this.draftSessions.has(chatId)) {
        this.draftSessions.delete(chatId);
        cancelled = true;
      }
      if (cancelled) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '❌ عملیات جاری لغو گردید. منوی اصلی در دسترس شماست:',
          reply_markup: this.getMainMenuKeyboard(chatId)
        });
        return;
      }
    }

    // Check Start / Pairing Command
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const code = parts[1] ? parts[1].trim() : null;

      if (code) {
        const matchedUser = db.findUserByTelegramAuthCode(code);
        if (matchedUser) {
          db.linkUserTelegram(matchedUser.id, chatId, username);

          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: `🎉 *حساب شما با موفقیت متصل شد!*\n\n` +
                  `همکار گرامی *${matchedUser.name}* (${matchedUser.department})،\n` +
                  `اکنون تمام تیکت‌ها، پاسخ‌ها و اعلانات سازمانی برای شما ارسال می‌شود. همچنین می‌توانید مستقیماً از طریق منوی زیر اقدام به ثبت تیکت جدید فرمایید.`,
            parse_mode: 'Markdown',
            reply_markup: this.getMainMenuKeyboard(matchedUser)
          });

          this.broadcastWs({
            type: 'user_telegram_linked',
            userId: matchedUser.id,
            userName: matchedUser.name,
            telegramChatId: chatId
          });
          return;
        }
      }

      const existingUser = db.findUserByTelegramChatId(chatId);
      if (existingUser) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `سلام *${existingUser.name}* عزیز 👋\n` +
                `اکانت تلگرام شما متصل است.\n\n` +
                `از طریق گزینه‌های زیر می‌توانید تیکت جدید ثبت کرده یا تیکت‌های خود را مشاهده و پیگیری نمایید:`,
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenuKeyboard(existingUser)
        });
        return;
      }

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `سلام، به سامانه اعلانات و تیکتینگ شرکت مانا خوش آمدید 👋\n\n` +
              `برای اتصال حساب کاربری:\n` +
              `۱. وارد سامانه تیکتینگ شوید.\n` +
              `۲. در بخش «پروفایل من»، کد ۶ رقمی تلگرام را بردارید.\n` +
              `۳. کد را اینجا ارسال کنید (مثال: \`123456\`).`,
        parse_mode: 'Markdown'
      });
      return;
    }

    // Direct 6-digit code entry
    if (/^\d{6}$/.test(text)) {
      const matchedUser = db.findUserByTelegramAuthCode(text);
      if (matchedUser) {
        db.linkUserTelegram(matchedUser.id, chatId, username);

        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `🎉 *اتصال حساب برقرار شد!*\n\nهمکار گرامی *${matchedUser.name}*، اکانت تلگرام شما با موفقیت به سامانه متصل گردید.`,
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenuKeyboard(matchedUser)
        });

        this.broadcastWs({
          type: 'user_telegram_linked',
          userId: matchedUser.id,
          userName: matchedUser.name,
          telegramChatId: chatId
        });
        return;
      }
    }

    // Main Menu Commands / Buttons
    if (text === '🎫 ثبت تیکت جدید' || text === '/newticket' || text === '/new') {
      await this.startTicketCreationWizard(chatId);
      return;
    }

    if (text === '📢 ثبت بخشنامه و اعلان عمومی' || text === '/announce' || text === '/announcement' || text === '/newannouncement') {
      await this.startAnnouncementWizard(chatId);
      return;
    }

    if (text === '📋 تیکت‌های من' || text === '/tickets' || text === '/mytickets') {
      await this.handleMyTicketsCommand(chatId);
      return;
    }

    if (text === '❓ راهنما و وضعیت' || text === '/help' || text === '/menu') {
      await this.handleHelpCommand(chatId);
      return;
    }

    // -----------------------------------------------------------------
    // ANNOUNCEMENT WIZARD MESSAGE HANDLING (Admins & Managers)
    // -----------------------------------------------------------------
    const annSession = this.announcementSessions.get(chatId);
    if (annSession) {
      if (Date.now() > annSession.expiresAt) {
        this.announcementSessions.delete(chatId);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⏱ مهلت ایجاد اعلان به پایان رسید. جهت شروع مجدد، دکمه «📢 ثبت بخشنامه و اعلان عمومی» را لمس کنید.',
          reply_markup: this.getMainMenuKeyboard(chatId)
        });
        return;
      }

      // Step 1: Receiving Announcement Title
      if (annSession.step === 'AWAITING_TITLE') {
        const titleCandidate = text || caption;
        if (!titleCandidate || titleCandidate.length < 3) {
          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: '⚠️ عنوان اعلان باید حداقل ۳ کاراکتر باشد. لطفاً عنوان مناسبی وارد کنید:'
          });
          return;
        }

        annSession.title = titleCandidate.slice(0, 150);
        annSession.step = 'AWAITING_CONTENT';

        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `📝 *متن اعلان عمومی (مرحله ۲ از ۴)*\n\n` +
                `📌 *عنوان:* ${this.escapeMarkdown(annSession.title)}\n\n` +
                `لطفاً **متن کامل بخشنامه یا پیام** خود را بنویسید و ارسال فرمایید:`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ انصراف', callback_data: 'na_cancel' }]
            ]
          }
        });
        return;
      }

      // Step 2: Receiving Announcement Content
      if (annSession.step === 'AWAITING_CONTENT') {
        const contentCandidate = text || caption;
        if (!contentCandidate || contentCandidate.length < 5) {
          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: '⚠️ متن اعلان باید حداقل ۵ کاراکتر باشد. لطفاً متن کامل را وارد فرمایید:'
          });
          return;
        }

        annSession.content = contentCandidate;
        await this.sendAnnouncementDepartmentSelection(chatId);
        return;
      }
    }

    // -----------------------------------------------------------------
    // TICKET CREATION WIZARD MESSAGE HANDLING
    // -----------------------------------------------------------------
    const creationSession = this.ticketCreationSessions.get(chatId);
    if (creationSession) {
      if (Date.now() > creationSession.expiresAt) {
        this.ticketCreationSessions.delete(chatId);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⏱ مهلت ایجاد تیکت به پایان رسید. جهت شروع مجدد، دکمه «🎫 ثبت تیکت جدید» را لمس کنید.',
          reply_markup: this.getMainMenuKeyboard(chatId)
        });
        return;
      }

      // Step 1: Receiving Title
      if (creationSession.step === 'AWAITING_TITLE') {
        const titleCandidate = text || caption;
        if (!titleCandidate || titleCandidate.length < 3) {
          await this.callApi('sendMessage', {
            chat_id: chatId,
            text: '⚠️ عنوان تیکت باید حداقل ۳ کاراکتر باشد. لطفاً عنوان مناسبی وارد کنید:'
          });
          return;
        }

        creationSession.title = titleCandidate.slice(0, 150);
        await this.sendDepartmentSelection(chatId);
        return;
      }

      // Step 5: Draft Content Accumulation (Text, Photo, Document, Voice, Audio)
      if (creationSession.step === 'DRAFT_CONTENT') {
        let addedSomething = false;

        const incomingText = text || caption;
        if (incomingText) {
          creationSession.descriptionLines.push(incomingText);
          addedSomething = true;
        }

        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
          try {
            const photo = msg.photo[msg.photo.length - 1];
            const att = await this.downloadTelegramFile(photo.file_id, 'photo.jpg');
            creationSession.attachments.push(att);
            addedSomething = true;
          } catch (e) {
            console.error('Ticket draft photo download error:', e);
          }
        } else if (msg.document) {
          try {
            const att = await this.downloadTelegramFile(msg.document.file_id, msg.document.file_name || 'document');
            creationSession.attachments.push(att);
            addedSomething = true;
          } catch (e) {
            console.error('Ticket draft document download error:', e);
          }
        } else if (msg.voice) {
          try {
            const att = await this.downloadTelegramFile(msg.voice.file_id, 'voice_message.ogg');
            creationSession.attachments.push(att);
            addedSomething = true;
          } catch (e) {
            console.error('Ticket draft voice download error:', e);
          }
        } else if (msg.audio) {
          try {
            const att = await this.downloadTelegramFile(msg.audio.file_id, msg.audio.file_name || 'audio.mp3');
            creationSession.attachments.push(att);
            addedSomething = true;
          } catch (e) {
            console.error('Ticket draft audio download error:', e);
          }
        }

        if (addedSomething) {
          await this.updateNewTicketDraftStatusMessage(chatId);
          return;
        }
      }
    }

    // -----------------------------------------------------------------
    // ACCUMULATE TEXT & ATTACHMENTS INTO REPLY DRAFT SESSION
    // -----------------------------------------------------------------
    let session = this.draftSessions.get(chatId);

    // If no active draft session, check if user did native Swipe-to-Reply on a ticket message
    if (!session && msg.reply_to_message) {
      const repliedMsgId = msg.reply_to_message.message_id;
      for (const group of db.data.deliveries) {
        if (group.type === 'ticket' && group.referenceId) {
          const rec = group.recipients.find(r => r.telegramMessageId === repliedMsgId);
          if (rec) {
            await this.initReplyDraftSession(chatId, group.referenceId);
            session = this.draftSessions.get(chatId);
            break;
          }
        }
      }
    }

    // If user is inside a draft session, accumulate this message!
    if (session) {
      if (Date.now() > session.expiresAt) {
        this.draftSessions.delete(chatId);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⏱ زمان پیش‌نویس منقضی شد. لطفاً مجدداً دکمه «پاسخ به تیکت» را لمس فرمایید.',
          reply_markup: this.getMainMenuKeyboard(chatId)
        });
        return;
      }

      let addedSomething = false;

      // 1. Accumulate Text / Caption
      const incomingText = text || caption;
      if (incomingText) {
        session.texts.push(incomingText);
        addedSomething = true;
      }

      // 2. Download and accumulate Photos
      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        try {
          const photo = msg.photo[msg.photo.length - 1];
          const att = await this.downloadTelegramFile(photo.file_id, 'photo.jpg');
          session.attachments.push(att);
          addedSomething = true;
        } catch (e) {
          console.error('Photo download error:', e);
        }
      }
      // 3. Download and accumulate Documents
      else if (msg.document) {
        try {
          const att = await this.downloadTelegramFile(msg.document.file_id, msg.document.file_name || 'document');
          session.attachments.push(att);
          addedSomething = true;
        } catch (e) {
          console.error('Document download error:', e);
        }
      }
      // 4. Download and accumulate Voice / Audio
      else if (msg.voice) {
        try {
          const att = await this.downloadTelegramFile(msg.voice.file_id, 'voice_message.ogg');
          session.attachments.push(att);
          addedSomething = true;
        } catch (e) {
          console.error('Voice download error:', e);
        }
      } else if (msg.audio) {
        try {
          const att = await this.downloadTelegramFile(msg.audio.file_id, msg.audio.file_name || 'audio.mp3');
          session.attachments.push(att);
          addedSomething = true;
        } catch (e) {
          console.error('Audio download error:', e);
        }
      }

      if (addedSomething) {
        // Live update the draft preview status message in Telegram!
        await this.updateDraftStatusMessage(chatId);
        return;
      }
    }

    // Default Fallback
    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `سلام همکار گرامی،\nبرای ایجاد تیکت از دکمه «🎫 ثبت تیکت جدید» و برای پاسخ به یک پیام از دکمه «💬 پاسخ به این تیکت» استفاده فرمایید.`,
      reply_markup: this.getMainMenuKeyboard(chatId)
    });
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}

module.exports = new TelegramService();
