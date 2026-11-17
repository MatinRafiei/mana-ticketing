// Telegram Bot Integration Engine with Handshake, Two-Way Ticket Replies, File Downloads & Proxy Support

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
    // Maps telegram chatId -> { ticketId, expiresAt }
    this.userReplyState = new Map();
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

    // If it's a ticket, provide direct Reply via Telegram button
    if (ticketId) {
      inlineKeyboard.push([
        {
          text: '💬 پاسخ به این تیکت در تلگرام',
          callback_data: `reply:${ticketId}`
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
          callback_data: `reply:${group.referenceId}`
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

        // Find delivery to check if it has ticket reply button
        const group = db.data.deliveries.find(d => d.id === deliveryId);
        const replyButtons = [];

        if (group && group.type === 'ticket' && group.referenceId) {
          replyButtons.push([
            {
              text: '💬 پاسخ به این تیکت در تلگرام',
              callback_data: `reply:${group.referenceId}`
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

    // B: Reply to Ticket button click: reply:<ticketId>
    if (data.startsWith('reply:')) {
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

      // Set user in Reply Mode for this ticket (valid for 15 minutes)
      this.userReplyState.set(chatId, {
        ticketId: ticket.id,
        expiresAt: Date.now() + 15 * 60 * 1000
      });

      await this.callApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: `در حال نوشتن پاسخ برای تیکت ${ticket.id}...`
      });

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `💬 *ثبت پاسخ برای تیکت:* \`${ticket.id}\`\n*عنوان:* ${this.escapeMarkdown(ticket.title)}\n\n` +
              `✍️ لطفاً پیام متنی، عکس، فایل پیوست یا پیام صوتی خود را ارسال فرمایید تا مستقیماً در سامانه ثبت شود.\n\n` +
              `_(برای انصراف عبارت /cancel را بفرستید)_`,
        parse_mode: 'Markdown'
      });
      return;
    }
  }

  async handleIncomingMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const caption = (msg.caption || '').trim();
    const username = msg.from?.username || msg.from?.first_name || '';

    // Check cancel command
    if (text === '/cancel') {
      if (this.userReplyState.has(chatId)) {
        this.userReplyState.delete(chatId);
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: 'عملیات ارسال پاسخ لغو شد.'
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
                  `اکنون تمام تیکت‌ها، پاسخ‌ها و اعلانات سازمانی برای شما ارسال شده و می‌توانید با زدن دکمه «پاسخ به این تیکت»، مستقیماً از تلگرام فایل و پاسخ بفرستید.`,
            parse_mode: 'Markdown'
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
          text: `سلام *${existingUser.name}* عزیز 👋\nاکانت تلگرام شما متصل است. تیکت‌ها برای شما ارسال می‌شوند و می‌توانید به آنها پاسخ دهید یا عکس/فایل ضمیمه کنید.`,
          parse_mode: 'Markdown'
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
          parse_mode: 'Markdown'
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

    // -----------------------------------------------------------------
    // TICKET REPLY HANDLING (Via Active Reply Mode OR Native Telegram Reply)
    // -----------------------------------------------------------------
    let targetTicketId = null;

    // Check 1: User is currently in "Reply Mode"
    if (this.userReplyState.has(chatId)) {
      const state = this.userReplyState.get(chatId);
      if (Date.now() <= state.expiresAt) {
        targetTicketId = state.ticketId;
      } else {
        this.userReplyState.delete(chatId);
      }
    }

    // Check 2: Native Telegram Swipe-to-Reply on bot's message
    if (!targetTicketId && msg.reply_to_message) {
      const repliedMsgId = msg.reply_to_message.message_id;
      // Search in deliveries for which ticket this message belongs to
      for (const group of db.data.deliveries) {
        if (group.type === 'ticket' && group.referenceId) {
          const rec = group.recipients.find(r => r.telegramMessageId === repliedMsgId);
          if (rec) {
            targetTicketId = group.referenceId;
            break;
          }
        }
      }
    }

    // If target ticket is identified, process the reply!
    if (targetTicketId) {
      await this.processTicketReply(chatId, targetTicketId, msg);
      return;
    }

    // Default Fallback
    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `پیام دریافت شد. جهت پاسخ به یک تیکت، دکمه «💬 پاسخ به این تیکت» زیر پیام تیکت را بزنید یا مستقیماً روی پیام تیکت Reply کنید.`
    });
  }

  async processTicketReply(chatId, ticketId, msg) {
    const user = db.findUserByTelegramChatId(chatId);
    if (!user) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '❌ حساب شما متصل نیست. لطفاً ابتدا کد ۶ رقمی را ارسال کنید.'
      });
      return;
    }

    const ticket = db.data.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: '❌ تیکت مورد نظر در سامانه یافت نشد.'
      });
      this.userReplyState.delete(chatId);
      return;
    }

    const attachments = [];
    let replyText = (msg.text || msg.caption || '').trim();

    try {
      // 1. Process Photos
      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        // Take the highest resolution photo (last element)
        const photo = msg.photo[msg.photo.length - 1];
        const att = await this.downloadTelegramFile(photo.file_id, 'photo.jpg');
        attachments.push(att);
        if (!replyText) replyText = 'تصویر ارسالی از تلگرام';
      }
      // 2. Process Document
      else if (msg.document) {
        const att = await this.downloadTelegramFile(msg.document.file_id, msg.document.file_name || 'document');
        attachments.push(att);
        if (!replyText) replyText = `فایل ضمیمه: ${msg.document.file_name || 'سند'}`;
      }
      // 3. Process Voice / Audio Note
      else if (msg.voice) {
        const att = await this.downloadTelegramFile(msg.voice.file_id, 'voice_message.ogg');
        attachments.push(att);
        if (!replyText) replyText = 'پیام صوتی ارسالی از تلگرام';
      } else if (msg.audio) {
        const att = await this.downloadTelegramFile(msg.audio.file_id, msg.audio.file_name || 'audio.mp3');
        attachments.push(att);
        if (!replyText) replyText = `صدا: ${msg.audio.file_name || 'فایل صوتی'}`;
      }

      if (!replyText && attachments.length === 0) {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: '⚠️ لطفاً متن، عکس یا فایل ارسال نمایید.'
        });
        return;
      }

      // Create formal reply
      const reply = {
        id: 'rep_tg_' + Date.now(),
        authorId: user.id,
        content: replyText,
        attachments: attachments,
        createdAt: new Date().toISOString()
      };

      ticket.replies.push(reply);
      ticket.updatedAt = new Date().toISOString();
      db.save();

      // Clear user reply state
      this.userReplyState.delete(chatId);

      // 1. Broadcast to all open Web and Mobile Dashboards (<50ms real-time sync!)
      this.broadcastWs({
        type: 'TICKET_REPLY_ADDED',
        ticketId: ticket.id,
        reply,
        ticket
      });

      // 2. Dispatch notifications to other participants
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

      // 3. Confirm to the sender in Telegram
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `✅ *پاسخ شما با موفقیت در تیکت ثبت شد!*\n\n` +
              `📌 تیکت: \`${ticket.id}\`\n` +
              `📝 متن: ${this.escapeMarkdown(replyText)}\n` +
              (attachments.length > 0 ? `📎 تعداد پیوست: ${attachments.length} فایل\n` : '') +
              `⚡️ پاسخ بلافاصله روی پنل وب و سامانه پرسنل نمایش داده شد.`,
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('Failed to process Telegram reply:', err);
      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `❌ خطا در ذخیره پاسخ: ${err.message}`
      });
    }
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}

module.exports = new TelegramService();
