const webpush = require('web-push');
const db = require('./db');

class PushService {
  constructor() {
    this.init();
  }

  init() {
    let settings = db.data.system_settings;
    if (!settings.vapid_public_key || !settings.vapid_private_key) {
      console.log('Generating new VAPID keys for Web-Push...');
      const vapidKeys = webpush.generateVAPIDKeys();
      settings.vapid_public_key = vapidKeys.publicKey;
      settings.vapid_private_key = vapidKeys.privateKey;
      settings.vapid_email = 'mailto:admin@company.com';
      db.save();
    }

    try {
      webpush.setVapidDetails(
        settings.vapid_email || 'mailto:admin@company.com',
        settings.vapid_public_key,
        settings.vapid_private_key
      );
      console.log('Web-Push VAPID configured successfully.');
    } catch (err) {
      console.error('Error configuring Web-Push VAPID:', err);
    }
  }

  getPublicKey() {
    return db.data.system_settings.vapid_public_key;
  }

  async sendToSubscription(sub, payload) {
    try {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: sub.keys
      };
      const dataString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      await webpush.sendNotification(pushConfig, dataString);
      return true;
    } catch (err) {
      // 410 Gone or 404 Not Found means the subscription is expired or revoked
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`Removing expired push subscription (${sub.endpoint.slice(0, 30)}...)`);
        db.removePushSubscription(sub.endpoint);
      } else {
        console.warn('Push delivery error:', err.message);
      }
      return false;
    }
  }

  async sendToUsers(userIds, payload) {
    if (!userIds || userIds.length === 0) return { sent: 0, failed: 0 };
    const subscriptions = db.getUserPushSubscriptions(userIds);
    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const ok = await this.sendToSubscription(sub, payload);
        if (ok) sent++;
        else failed++;
      })
    );

    return { sent, failed };
  }
}

module.exports = new PushService();
