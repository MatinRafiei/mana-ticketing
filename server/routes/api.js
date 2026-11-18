const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const pushService = require('../push');
const telegramService = require('../telegram');
const { getClientIp, getUserAgent, createToken, requireAuth } = require('../auth');

// Multer storage for avatars & ticket attachments
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit
});

// Broadcast Helper (injected from server.js)
let broadcastWs = () => {};
router.setBroadcast = (fn) => {
  broadcastWs = fn;
  telegramService.setBroadcast(fn);
};

// ---------------------------------------------------------------------
// Auth & Profile Endpoints
// ---------------------------------------------------------------------

// User Login
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  if (!email || !password) {
    return res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است.' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    db.addLoginLog({
      email,
      ip,
      userAgent,
      status: 'FAILED',
      type: 'USER',
      message: 'کاربر با این ایمیل یافت نشد'
    });
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
  }

  if (user.isRestricted) {
    db.addLoginLog({
      email,
      ip,
      userAgent,
      status: 'BLOCKED',
      type: 'USER',
      message: 'تلاش برای ورود کاربر مسدودشده'
    });
    return res.status(403).json({ error: 'حساب کاربری شما توسط مدیر سرور مسدود گردیده است. با مدیر سرور تماس بگیرید.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    db.addLoginLog({
      email,
      ip,
      userAgent,
      status: 'FAILED',
      type: 'USER',
      message: 'رمز عبور اشتباه وارد شد'
    });
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
  }

  // Success
  db.addLoginLog({
    email,
    ip,
    userAgent,
    status: 'SUCCESS',
    type: 'USER',
    message: 'ورود موفق به سامانه تیکتینگ'
  });

  const token = createToken({ userId: user.id, email: user.email }, '30d');
  const { password_hash, ...sanitized } = user;
  res.json({ token, user: sanitized });
});

// Current User Profile
router.get('/profile', requireAuth, (req, res) => {
  const { password_hash, ...sanitized } = req.user;
  res.json(sanitized);
});

// Update Profile (Name, Department, Password)
router.put('/profile', requireAuth, (req, res) => {
  try {
    const { name, department, currentPassword, newPassword } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();
    if (department) updates.department = department.trim();

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'جهت تغییر رمز عبور، وارد کردن رمز فعلی الزامی است.' });
      }
      const isMatch = bcrypt.compareSync(currentPassword, req.user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
      }
      updates.password = newPassword;
    }

    const updated = db.updateUser(req.user.id, updates);
    const { password_hash, ...sanitized } = updated;
    broadcastWs({ type: 'USER_UPDATED', user: sanitized });
    res.json(sanitized);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload Avatar
router.post('/profile/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایل تصویری بارگذاری نشد.' });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;
  const updated = db.updateUser(req.user.id, { avatar: avatarUrl });
  const { password_hash, ...sanitized } = updated;

  broadcastWs({ type: 'USER_UPDATED', user: sanitized });
  res.json({ success: true, avatar: avatarUrl, user: sanitized });
});

// Unlink Telegram from Profile
router.delete('/profile/telegram', requireAuth, (req, res) => {
  const updated = db.unlinkUserTelegram(req.user.id);
  const { password_hash, ...sanitized } = updated;
  res.json({ success: true, user: sanitized });
});

// Upload Attachment File (for tickets and replies)
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایل آپلود نشد.' });
  }

  res.json({
    id: 'att_' + Date.now(),
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------
// Push Notifications Endpoints
// ---------------------------------------------------------------------

// Get VAPID Public Key for Client Registration
router.get('/push/vapid-key', (req, res) => {
  const publicKey = pushService.getPublicKey();
  res.json({ publicKey });
});

// Save User Push Subscription
router.post('/push/subscribe', requireAuth, (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'اطلاعات اشتراک نامعتبر است.' });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  db.savePushSubscription(req.user.id, subscription, userAgent, ip);
  res.json({ success: true, message: 'دستگاه شما برای دریافت اعلان‌های آنی ثبت گردید.' });
});

// Test Web-Push on Current User's Devices
router.post('/push/test', requireAuth, async (req, res) => {
  const result = await pushService.sendToUsers([req.user.id], {
    title: 'تست موفق اعلان بلادرنگ مانا',
    body: 'سامانه اعلان‌های آنی روی این دستگاه با موفقیت فعال شد.',
    url: './',
    type: 'test'
  });
  res.json({ success: true, ...result });
});

// ---------------------------------------------------------------------
// Ticketing Endpoints
// ---------------------------------------------------------------------

// Get All Initial Data (Tickets, Users, Roles, Announcements)
router.get('/sync', requireAuth, (req, res) => {
  const sanitizedUsers = db.data.users.map(({ password_hash, ...u }) => u);
  res.json({
    tickets: db.data.tickets,
    users: sanitizedUsers,
    roles: db.data.roles,
    announcements: db.data.announcements
  });
});

// Tickets List
router.get('/tickets', requireAuth, (req, res) => {
  res.json(db.data.tickets);
});

// Create Ticket
router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { title, description, assigneeId, taggedUserIds, priority, department, deadline, attachments } = req.body;
    if (!title || !assigneeId) {
      return res.status(400).json({ error: 'عنوان تیکت و مسئول انجام الزامی است.' });
    }

    const newTicket = db.createTicket({
      title,
      description,
      creatorId: req.user.id,
      assigneeId,
      taggedUserIds,
      priority,
      status: 'open',
      department,
      deadline,
      attachments,
      channel: 'web'
    });

    // Broadcast live to all connected WebSocket clients
    broadcastWs({ type: 'TICKET_CREATED', ticket: newTicket });

    // Target recipients (assignee + tagged)
    const notifyUserIds = [assigneeId, ...(taggedUserIds || [])].filter(id => id && id !== req.user.id);

    // 1. Send Web-Push
    if (notifyUserIds.length > 0) {
      pushService.sendToUsers(notifyUserIds, {
        title: `تیکت جدید: ${newTicket.title}`,
        body: `توسط ${req.user.name} ارجاع داده شد.`,
        ticketId: newTicket.id,
        url: `./?ticket=${newTicket.id}`
      });
    }

    // 2. Create Telegram Delivery Record & Send with Handshake Button
    if (notifyUserIds.length > 0) {
      const delivery = db.createDelivery({
        type: 'ticket',
        referenceId: newTicket.id,
        title: `تیکت جدید (${newTicket.id}): ${newTicket.title}`,
        message: `توسط ${req.user.name} ارجاع گردید.\nتوضیحات: ${(newTicket.description || 'بدون توضیح').slice(0, 150)}`,
        targetUserIds: notifyUserIds,
        creatorId: req.user.id
      });

      for (const targetUid of notifyUserIds) {
        await telegramService.sendNotificationWithHandshake({
          deliveryId: delivery.id,
          userId: targetUid,
          title: `تیکت جدید (${newTicket.id}): ${newTicket.title}`,
          message: `توسط ${req.user.name} ارجاع گردید.\nتوضیحات: ${(newTicket.description || 'بدون توضیح').slice(0, 150)}`,
          ticketId: newTicket.id,
          priority: newTicket.priority
        });
      }
    }

    res.json(newTicket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Ticket Status / Details
router.put('/tickets/:id', requireAuth, async (req, res) => {
  const ticket = db.data.tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد.' });

  const { status, priority, assigneeId, deadline } = req.body;
  let statusChanged = false;

  if (status && status !== ticket.status) {
    ticket.history.push({
      action: 'STATUS_CHANGE',
      from: ticket.status,
      to: status,
      actorId: req.user.id,
      timestamp: new Date().toISOString()
    });
    ticket.status = status;
    statusChanged = true;
  }

  if (priority) ticket.priority = priority;
  if (assigneeId) ticket.assigneeId = assigneeId;
  if (deadline !== undefined) ticket.deadline = deadline;

  ticket.updatedAt = new Date().toISOString();
  db.save();

  broadcastWs({ type: 'TICKET_UPDATED', ticket });

  // Web-Push on status change to creator or assignee
  if (statusChanged) {
    const notifyIds = [ticket.creatorId, ticket.assigneeId].filter(id => id && id !== req.user.id);
    if (notifyIds.length > 0) {
      pushService.sendToUsers(notifyIds, {
        title: `تغییر وضعیت تیکت: ${ticket.title}`,
        body: `وضعیت توسط ${req.user.name} به "${status}" تغییر یافت.`,
        ticketId: ticket.id,
        url: `./?ticket=${ticket.id}`
      });
    }
  }

  res.json(ticket);
});

// Add Reply to Ticket
router.post('/tickets/:id/replies', requireAuth, async (req, res) => {
  try {
    const ticket = db.data.tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'تیکت یافت نشد.' });

    const { content, attachments } = req.body;
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'متن پاسخ یا فایل پیوست الزامی است.' });
    }

    const reply = {
      id: 'rep_' + Date.now(),
      authorId: req.user.id,
      content: (content || '').trim(),
      attachments: attachments || [],
      createdAt: new Date().toISOString()
    };

    ticket.replies.push(reply);
    ticket.updatedAt = new Date().toISOString();
    db.save();

    broadcastWs({ type: 'TICKET_REPLY_ADDED', ticketId: ticket.id, reply, ticket });

    // Auto-acknowledge pending delivery handshakes for this ticket for this user
    try {
      await telegramService.autoAcknowledgeTicketDeliveries(ticket.id, req.user.id);
    } catch (e) {
      console.warn('Auto ack error on reply:', e.message);
    }

    // Web-Push & Telegram to all participants (creator, assignee, tagged)
    const allParticipants = [ticket.creatorId, ticket.assigneeId, ...(ticket.taggedUserIds || [])];
    const notifyIds = Array.from(new Set(allParticipants)).filter(id => id && id !== req.user.id);

    if (notifyIds.length > 0) {
      // 1. Web-Push
      try {
        pushService.sendToUsers(notifyIds, {
          title: `پاسخ جدید در تیکت: ${ticket.title}`,
          body: `${req.user.name}: ${reply.content.slice(0, 70)}...`,
          ticketId: ticket.id,
          url: `./?ticket=${ticket.id}`
        });
      } catch (e) {}

      // 2. Telegram Handshake
      try {
        const delivery = db.createDelivery({
          type: 'ticket',
          referenceId: ticket.id,
          title: `پاسخ جدید در تیکت ${ticket.id}: ${ticket.title}`,
          message: `${req.user.name}: ${reply.content.slice(0, 150)}`,
          targetUserIds: notifyIds,
          creatorId: req.user.id
        });

        for (const targetUid of notifyIds) {
          await telegramService.sendNotificationWithHandshake({
            deliveryId: delivery.id,
            userId: targetUid,
            title: `پاسخ جدید در تیکت ${ticket.id}: ${ticket.title}`,
            message: `${req.user.name}: ${reply.content.slice(0, 150)}`,
            ticketId: ticket.id,
            priority: ticket.priority
          });
        }
      } catch (e) {
        console.warn('Telegram handshake error on reply:', e.message);
      }
    }

    res.json(reply);
  } catch (err) {
    console.error('Error adding reply:', err);
    res.status(500).json({ error: 'خطای داخلی سرور در ثبت پاسخ: ' + err.message });
  }
});

// Delete Ticket
router.delete('/tickets/:id', requireAuth, (req, res) => {
  const index = db.data.tickets.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'تیکت یافت نشد.' });

  db.data.tickets.splice(index, 1);
  db.save();

  broadcastWs({ type: 'TICKET_DELETED', ticketId: req.params.id });
  res.json({ success: true });
});

// Deliveries Tracking (Accessible to Managers & Admins in main app)
router.get('/deliveries', requireAuth, (req, res) => {
  const userRole = db.data.roles.find(r => r.id === req.user.roleId);
  const canView = req.user.roleId === 'admin' || req.user.roleId === 'manager' || userRole?.permissions?.includes('view_reports') || userRole?.permissions?.includes('manage_announcements');

  if (!canView) {
    return res.status(403).json({ error: 'دسترسی مشاهده گزارش تحویل اعلانات برای نقش شما مجاز نیست.' });
  }

  res.json(db.data.deliveries);
});

// Create & Dispatch Organization Announcement (Managers & Admins)
router.post('/announcements', requireAuth, async (req, res) => {
  const userRole = db.data.roles.find(r => r.id === req.user.roleId);
  const canAnnounce = req.user.roleId === 'admin' || req.user.roleId === 'manager' || userRole?.permissions?.includes('manage_announcements');

  if (!canAnnounce) {
    return res.status(403).json({ error: 'دسترسی ارسال اعلانات سازمانی برای شما مجاز نیست.' });
  }

  const { title, content, targetDepartment, priority } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'عنوان و متن اعلان الزامی است.' });
  }

  const ann = db.createAnnouncement({
    title,
    content,
    targetDepartment: targetDepartment || 'all',
    priority: priority || 'normal',
    creatorId: req.user.id
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
    creatorId: req.user.id
  });

  // 1. Web-Push
  pushService.sendToUsers(targetUserIds, {
    title: `بخشنامه سازمانی: ${title}`,
    body: content.slice(0, 90),
    url: './'
  });

  // 2. Telegram with Handshake Button
  for (const u of targetUsers) {
    if (u.telegramChatId) {
      await telegramService.sendNotificationWithHandshake({
        deliveryId: delivery.id,
        userId: u.id,
        title: `📢 بخشنامه سازمانی: ${title}`,
        message: content,
        priority: priority || 'normal'
      });
    }
  }

  broadcastWs({ type: 'ANNOUNCEMENT_CREATED', announcement: ann, delivery });
  res.json({ success: true, announcement: ann, delivery });
});

// Manual Resend from Manager/Admin Tab
router.post('/deliveries/:deliveryId/resend/:userId', requireAuth, async (req, res) => {
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

// Users Directory
router.get('/users', requireAuth, (req, res) => {
  const sanitized = db.data.users.map(({ password_hash, ...u }) => u);
  res.json(sanitized);
});

// Roles Directory
router.get('/roles', requireAuth, (req, res) => {
  res.json(db.data.roles);
});

module.exports = router;
