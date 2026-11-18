const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const os = require('os');
const db = require('../db');
const telegramService = require('../telegram');
const { getClientIp, getUserAgent, createToken, requireSuperadmin } = require('../auth');

// Superadmin Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const expectedUser = db.data.system_settings.superadmin_username || 'superadmin';
  const expectedHash = db.data.system_settings.superadmin_password_hash;

  if (!username || !password || username.trim() !== expectedUser) {
    db.addLoginLog({
      email: username || 'unknown',
      ip,
      userAgent,
      status: 'FAILED',
      type: 'SUPERADMIN',
      message: 'نام‌کاربری سوپرادمین نامعتبر'
    });
    return res.status(401).json({ error: 'نام کاربری یا کلمه عبور اشتباه است.' });
  }

  const isMatch = bcrypt.compareSync(password, expectedHash);
  if (!isMatch) {
    db.addLoginLog({
      email: username,
      ip,
      userAgent,
      status: 'FAILED',
      type: 'SUPERADMIN',
      message: 'رمز عبور سوپرادمین اشتباه وارد شد'
    });
    return res.status(401).json({ error: 'نام کاربری یا کلمه عبور اشتباه است.' });
  }

  // Success
  db.addLoginLog({
    email: username,
    ip,
    userAgent,
    status: 'SUCCESS',
    type: 'SUPERADMIN',
    message: 'ورود موفق به پنل مدیریت ارشد سرور'
  });

  const token = createToken({ isSuperadmin: true, username }, '7d');
  res.json({
    token,
    username,
    role: 'superadmin'
  });
});

// Server Status & Metrics
router.get('/status', requireSuperadmin, (req, res) => {
  const uptimeSec = os.uptime();
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);

  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const usedMemMb = totalMemMb - freeMemMb;

  res.json({
    serverUptime: `${days} روز و ${hours} ساعت و ${minutes} دقیقه`,
    memory: {
      usedMb: usedMemMb,
      totalMb: totalMemMb,
      percent: Math.round((usedMemMb / totalMemMb) * 100)
    },
    counts: {
      users: db.data.users.length,
      restrictedUsers: db.data.users.filter(u => u.isRestricted).length,
      tickets: db.data.tickets.length,
      pushSubscriptions: db.data.push_subscriptions.length,
      telegramLinkedUsers: db.data.users.filter(u => u.telegramChatId).length,
      deliveries: db.data.deliveries.length,
      logs: db.data.login_logs.length
    },
    telegram: {
      botTokenSet: Boolean(db.data.system_settings.telegram_bot_token),
      proxyUrlSet: Boolean(db.data.system_settings.telegram_proxy_url),
      autoResendEnabled: db.data.system_settings.telegram_auto_resend_enabled,
      resendIntervalMins: db.data.system_settings.telegram_resend_interval_mins,
      maxResends: db.data.system_settings.telegram_max_resends
    },
    vapidKeyConfigured: Boolean(db.data.system_settings.vapid_public_key)
  });
});

// Users Management
router.get('/users', requireSuperadmin, (req, res) => {
  const sanitizedUsers = db.data.users.map(({ password_hash, ...u }) => u);
  res.json(sanitizedUsers);
});

router.post('/users', requireSuperadmin, (req, res) => {
  try {
    const { email, password, name, department, roleId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'ایمیل الزامی است.' });
    }
    const newUser = db.createUser({ email, password, name, department, roleId });
    const { password_hash, ...sanitized } = newUser;
    res.json(sanitized);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/users/:id', requireSuperadmin, (req, res) => {
  try {
    const updated = db.updateUser(req.params.id, req.body);
    const { password_hash, ...sanitized } = updated;
    res.json(sanitized);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle Restrict / Ban User
router.put('/users/:id/restrict', requireSuperadmin, (req, res) => {
  try {
    const user = db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد.' });

    const updated = db.updateUser(user.id, { isRestricted: !user.isRestricted });
    res.json({
      success: true,
      isRestricted: updated.isRestricted,
      message: updated.isRestricted ? 'دسترسی کاربر مسدود گردید.' : 'دسترسی کاربر فعال شد.'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unlink Telegram Chat
router.delete('/users/:id/telegram', requireSuperadmin, (req, res) => {
  try {
    const updated = db.unlinkUserTelegram(req.params.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', requireSuperadmin, (req, res) => {
  try {
    db.deleteUser(req.params.id);
    res.json({ success: true, message: 'کاربر با موفقیت حذف گردید.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Roles Management
router.get('/roles', requireSuperadmin, (req, res) => {
  res.json(db.data.roles);
});

router.post('/roles', requireSuperadmin, (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const newRole = db.createRole({ name, description, permissions });
    res.json(newRole);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/roles/:id', requireSuperadmin, (req, res) => {
  try {
    db.deleteRole(req.params.id);
    res.json({ success: true, message: 'نقش حذف شد.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login Audit Logs
router.get('/logs', requireSuperadmin, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(db.data.login_logs.slice(0, limit));
});

// ---------------------------------------------------------------------
// Telegram Bot & Announcements Endpoints
// ---------------------------------------------------------------------
router.get('/telegram/settings', requireSuperadmin, (req, res) => {
  const s = db.data.system_settings;
  res.json({
    botToken: s.telegram_bot_token || '',
    proxyUrl: s.telegram_proxy_url || '',
    autoResendEnabled: s.telegram_auto_resend_enabled !== false,
    resendIntervalMins: s.telegram_resend_interval_mins || 30,
    maxResends: s.telegram_max_resends || 3
  });
});

router.post('/telegram/settings', requireSuperadmin, (req, res) => {
  const updated = db.updateTelegramSettings(req.body);
  if (updated.telegram_bot_token) {
    telegramService.startPolling();
  } else {
    telegramService.stopPolling();
  }
  res.json({ success: true, settings: updated });
});

router.post('/telegram/test', requireSuperadmin, async (req, res) => {
  try {
    const bot = await telegramService.testConnection();
    res.json({
      success: true,
      bot: {
        id: bot.id,
        first_name: bot.first_name,
        username: bot.username
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliveries Tracking (Superadmin)
router.get('/deliveries', requireSuperadmin, (req, res) => {
  const enrichedDeliveries = (db.data.deliveries || []).map(d => {
    let creatorName = d.creatorName;
    let creatorDepartment = d.creatorDepartment;
    if (!creatorName && d.creatorId) {
      if (d.creatorId === 'superadmin') {
        creatorName = 'مدیر ارشد سیستم (Superadmin)';
        creatorDepartment = 'مدیریت';
      } else {
        const u = db.findUserById(d.creatorId);
        if (u) {
          creatorName = u.name;
          creatorDepartment = u.department;
        }
      }
    }
    return {
      ...d,
      creatorName: creatorName || 'مدیریت سامانه',
      creatorDepartment: creatorDepartment || ''
    };
  });
  res.json(enrichedDeliveries);
});

// Send Manual Resend
router.post('/deliveries/:deliveryId/resend/:userId', requireSuperadmin, async (req, res) => {
  const { deliveryId, userId } = req.params;
  const group = db.data.deliveries.find(d => d.id === deliveryId);
  if (!group) return res.status(404).json({ error: 'اعلان یافت نشد.' });

  const ok = await telegramService.resendReminder({
    deliveryId,
    userId,
    title: group.title,
    message: group.message
  });

  if (ok) {
    res.json({ success: true, message: 'یادآوری مجدد با موفقیت ارسال شد.' });
  } else {
    res.status(400).json({ error: 'ارسال یادآوری انجام نشد (احتمالاً اکانت کاربر متصل نیست یا تایید شده است).' });
  }
});

// Create & Broadcast Organization Announcement
router.post('/announcements', requireSuperadmin, async (req, res) => {
  try {
    const { title, content, targetDepartment, priority } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'عنوان و متن اعلان الزامی است.' });
    }

    const ann = db.createAnnouncement({
      title,
      content,
      targetDepartment: targetDepartment || 'all',
      priority: priority || 'normal',
      creatorId: 'superadmin',
      creatorName: 'مدیر ارشد سیستم (Superadmin)',
      creatorDepartment: 'مدیریت'
    });

    // Determine target users
    let targetUsers = db.data.users.filter(u => !u.isRestricted);
    if (targetDepartment && targetDepartment !== 'all') {
      targetUsers = targetUsers.filter(u => u.department === targetDepartment);
    }
    const targetUserIds = targetUsers.map(u => u.id);

    // Create delivery group
    const delivery = db.createDelivery({
      type: 'announcement',
      referenceId: ann.id,
      title: `بخشنامه سازمانی: ${title}`,
      message: content,
      targetUserIds,
      creatorId: 'superadmin',
      creatorName: 'مدیر ارشد سیستم (Superadmin)',
      creatorDepartment: 'مدیریت'
    });

    // Send via Telegram with Handshake Button
    for (const u of targetUsers) {
      if (u.telegramChatId) {
        await telegramService.sendNotificationWithHandshake({
          deliveryId: delivery.id,
          userId: u.id,
          title: `📢 بخشنامه سازمانی: ${title}`,
          message: content,
          priority: priority || 'normal',
          creatorName: 'مدیر ارشد سیستم (Superadmin)',
          creatorDept: 'مدیریت'
        });
      }
    }

    res.json({ success: true, announcement: ann, delivery });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Superadmin Master Password Change
router.post('/change-password', requireSuperadmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }

  const expectedHash = db.data.system_settings.superadmin_password_hash;
  if (!bcrypt.compareSync(currentPassword, expectedHash)) {
    return res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
  }

  db.updateSuperadminPassword(newPassword);
  res.json({ success: true, message: 'رمز عبور مدیر ارشد با موفقیت تغییر یافت.' });
});

// Factory Reset Service
router.post('/factory-reset', requireSuperadmin, (req, res) => {
  const { confirmPassword } = req.body;
  const expectedHash = db.data.system_settings.superadmin_password_hash;
  if (!bcrypt.compareSync(confirmPassword, expectedHash)) {
    return res.status(400).json({ error: 'رمز عبور تایید نادرست است. عملیات بازنشانی متوقف شد.' });
  }

  db.factoryReset();
  res.json({ success: true, message: 'سامانه با موفقیت به حالت صفر کارخانه بازنشانی گردید.' });
});

module.exports = router;
