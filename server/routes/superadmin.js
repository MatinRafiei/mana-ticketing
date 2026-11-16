const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const os = require('os');
const db = require('../db');
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
      logs: db.data.login_logs.length
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
    const { isRestricted } = req.body;
    const user = db.setUserRestricted(req.params.id, isRestricted);
    const { password_hash, ...sanitized } = user;
    res.json(sanitized);
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
    if (!name) return res.status(400).json({ error: 'نام نقش الزامی است.' });
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
  res.json(db.getLoginLogs(limit));
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
