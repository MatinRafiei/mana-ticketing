// Auto-Resend Scheduler for Unacknowledged Telegram Deliveries

const db = require('./db');
const telegramService = require('./telegram');

class ReminderScheduler {
  constructor() {
    this.timer = null;
    this.intervalMs = 60 * 1000; // Check every 1 minute
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkAndResend(), this.intervalMs);
    console.log('⏰ زمان‌بندی یادآوری خودکار اعلانات بدون تایید فعال شد.');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkAndResend() {
    const settings = db.data.system_settings;
    if (!settings.telegram_auto_resend_enabled) return;
    if (!settings.telegram_bot_token) return;

    const intervalMins = settings.telegram_resend_interval_mins || 30;
    const maxResends = settings.telegram_max_resends || 3;
    const now = Date.now();
    const thresholdMs = intervalMins * 60 * 1000;

    for (const group of db.data.deliveries) {
      for (const r of group.recipients) {
        // Only target pending or sent that are NOT acknowledged
        if (r.status !== 'acknowledged' && r.telegramChatId) {
          const resendsSoFar = r.resendCount || 0;
          if (resendsSoFar >= maxResends) {
            continue; // Reached maximum reminders
          }

          const lastSentTime = r.lastSentAt ? new Date(r.lastSentAt).getTime() : new Date(group.createdAt).getTime();
          if (now - lastSentTime >= thresholdMs) {
            await telegramService.resendReminder({
              deliveryId: group.id,
              userId: r.userId,
              title: group.title,
              message: group.message
            });
          }
        }
      }
    }
  }
}

module.exports = new ReminderScheduler();
