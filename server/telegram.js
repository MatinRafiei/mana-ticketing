// Telegram Bot Integration Engine with Handshake, Webhook/Polling, & Proxy Support (Iran Server Ready)

const https = require('https');
const http = require('http');
const db = require('./db');

class TelegramService {
  constructor() {
    this.pollingTimeout = null;
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.botInfo = null;
    this.broadcastWs = () => {};
  }

  setBroadcast(fn) {
    this.broadcastWs = fn;
  }

  getAgent() {
    const rawProxy = (db.data.system_settings.telegram_proxy_url || '').trim();
    if (!rawProxy) return undefined;

    try {
      // Normalize proxy URL
      let proxyUrl = rawProxy;
      if (!proxyUrl.includes('://')) {
        proxyUrl = 'http://' + proxyUrl;
      }

      if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks5h://') || proxyUrl.startsWith('socks://')) {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        // Force remote DNS resolution on SOCKS5 to prevent local DNS poisoning
        const normalizedSocks = proxyUrl.replace(/^socks5:\/\//, 'socks5h://');
        return new SocksProxyAgent(normalizedSocks, {
          timeout: 20000,
          keepAlive: true
        });
      } else if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        return new HttpsProxyAgent(proxyUrl, {
          timeout: 20000,
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

  async testConnection() {
    const me = await this.callApi('getMe');
    this.botInfo = me;
    return me;
  }

  // --- Dispatch Notification with Handshake Inline Button ---
  async sendNotificationWithHandshake({ deliveryId, userId, title, message, detailsUrl, priority }) {
    const user = db.findUserById(userId);
    if (!user || !user.telegramChatId) {
      return { success: false, reason: 'کاربر به ربات تلگرام متصل نیست' };
    }

    const priorityBadge = priority === 'urgent' ? '🔴 فوری' : (priority === 'high' ? '🟠 بالا' : '🔵 عادی');

    const text = `🔔 *سامانه تیکتینگ و اعلانات مانا*\n\n` +
                 `📌 *${this.escapeMarkdown(title)}*\n` +
                 `🔖 اولویت: ${priorityBadge}\n\n` +
                 `${this.escapeMarkdown(message)}\n\n` +
                 `⚠️ _لطفاً جهت تایید دریافت و مطالعه، دکمه زیر را لمس نمایید._`;

    const inlineKeyboard = [
      [
        {
          text: '✅ مشاهده شد / تایید دریافت',
          callback_data: `ack:${deliveryId}:${userId}`
        }
      ]
    ];

    if (detailsUrl) {
      inlineKeyboard.push([
        {
          text: '🔗 مشاهده در سامانه تیکتینگ',
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

  // --- Long Polling Worker for User Pairing & Button Clicks ---
  startPolling() {
    if (this.isPolling) return;
    const token = db.data.system_settings.telegram_bot_token;
    if (!token) return;

    this.isPolling = true;
    console.log('🤖 سرویس تلگرام مانا فعال شد و در حال شنود رویدادها است...');
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
      this.pollingTimeout = setTimeout(() => this.pollLoop(), 1500);
    }
  }

  async handleUpdate(update) {
    try {
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
        return;
      }

      if (update.message && update.message.text) {
        await this.handleTextMessage(update.message);
      }
    } catch (err) {
      console.error('Error handling Telegram update:', err);
    }
  }

  async handleCallbackQuery(cq) {
    const data = cq.data || '';
    if (!data.startsWith('ack:')) return;

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
            ]
          ]
        }
      });
    } catch (e) {
      // Ignore if identical
    }

    this.broadcastWs({
      type: 'delivery_acknowledged',
      deliveryId,
      userId,
      userName: user ? user.name : 'کاربر',
      acknowledgedAt: now.toISOString(),
      formattedTime: timeStr
    });
  }

  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const username = msg.from?.username || msg.from?.first_name || '';

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
                  `اکنون تمام تیکت‌ها، پاسخ‌ها و اعلانات فوری سازمان مانا بلافاصله در این صفحه برای شما ارسال می‌شود.\n\n` +
                  `با لمس دکمه «تایید دریافت» زیر هر پیام، مدیران از رویت آن مطلع خواهند شد.`,
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
          text: `سلام *${existingUser.name}* عزیز 👋\nاکانت تلگرام شما متصل به سامانه تیکتینگ مانا است و اعلان‌های جدید را در همین گفتگو دریافت خواهید کرد.`,
          parse_mode: 'Markdown'
        });
        return;
      }

      await this.callApi('sendMessage', {
        chat_id: chatId,
        text: `سلام به سامانه اعلانات و تیکتینگ شرکت مانا خوش آمدید 👋\n\n` +
              `برای اتصال حساب کاربری خود:\n` +
              `۱. وارد سامانه تیکتینگ شوید.\n` +
              `۲. روی دکمه «پروفایل من» کلیک کنید.\n` +
              `۳. کد ۶ رقمی تلگرام خود را مشاهده کرده و آن را اینجا ارسال کنید.\n` +
              `مثال: \`123456\``,
        parse_mode: 'Markdown'
      });
      return;
    }

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
      } else {
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: `❌ کد وارد شده نامعتبر است یا منقضی شده است. لطفاً کد صحیح را از بخش پروفایل سامانه بردارید.`
        });
        return;
      }
    }

    await this.callApi('sendMessage', {
      chat_id: chatId,
      text: `پیام دریافت شد. این ربات صرفاً برای ارسال تیکت‌ها و اعلانات رسمی شرکت مانا پرداز طراحی شده است.`
    });
  }

  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}

module.exports = new TelegramService();
