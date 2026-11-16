const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const pushService = require('../push');
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
router.setBroadcast = (fn) => { broadcastWs = fn; };

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
router.get('/auth/me', requireAuth, (req, res) => {
  const { password_hash, ...sanitized } = req.user;
  res.json(sanitized);
});

// Update Profile (Name, Department, Avatar, Password)
router.put('/auth/profile', requireAuth, (req, res) => {
  try {
    const { name, department, avatar, currentPassword, newPassword } = req.body;
    const user = db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد.' });

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'برای تغییر رمز عبور، وارد کردن رمز فعلی الزامی است.' });
      }
      if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
      }
      const salt = bcrypt.genSaltSync(10);
      user.password_hash = bcrypt.hashSync(newPassword, salt);
    }

    if (name) {
      user.name = name.trim();
      user.initials = user.name.split(' ').map(p => p[0]).join('‌');
    }
    if (department) user.department = department.trim();
    if (avatar) user.avatar = avatar;

    user.updatedAt = new Date().toISOString();
    db.save();

    broadcastWs({ type: 'USER_UPDATED', userId: user.id });
    const { password_hash, ...sanitized } = user;
    res.json(sanitized);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload Avatar
router.post('/upload/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'هیچ فایلی ارسال نشده است.' });
  }
  const fileUrl = `./uploads/${req.file.filename}`;
  // Automatically update current user avatar
  const user = db.findUserById(req.user.id);
  if (user) {
    user.avatar = fileUrl;
    user.updatedAt = new Date().toISOString();
    db.save();
    broadcastWs({ type: 'USER_UPDATED', userId: user.id });
  }
  res.json({ url: fileUrl });
});

// Upload Attachment for tickets/replies
router.post('/upload/attachment', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'هیچ فایلی ارسال نشده است.' });
  }
  res.json({
    id: 'att_' + Date.now(),
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    url: `./uploads/${req.file.filename}`
  });
});

// ---------------------------------------------------------------------
// Web-Push Endpoints
// ---------------------------------------------------------------------

// VAPID Public Key for Browser PushSubscription
router.get('/push/public-key', (req, res) => {
  res.json({ publicKey: pushService.getPublicKey() });
});

// Subscribe Device to Web-Push
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

// Get All Initial Data (Tickets, Users, Roles)
router.get('/sync', requireAuth, (req, res) => {
  const sanitizedUsers = db.data.users.map(({ password_hash, ...u }) => u);
  res.json({
    tickets: db.data.tickets,
    users: sanitizedUsers,
    roles: db.data.roles
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

    const nextNum = db.data.tickets.length + 101;
    const newTicket = {
      id: `TCK-${nextNum}`,
      title: title.trim(),
      description: (description || '').trim(),
      creatorId: req.user.id,
      assigneeId: assigneeId,
      taggedUserIds: taggedUserIds || [],
      priority: priority || 'normal',
      status: 'open',
      department: department || 'عمومی',
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: attachments || [],
      replies: [],
      history: [
        {
          action: 'CREATED',
          actorId: req.user.id,
          timestamp: new Date().toISOString()
        }
      ]
    };

    db.data.tickets.unshift(newTicket);
    db.save();

    // Broadcast live to all connected WebSocket clients
    broadcastWs({ type: 'TICKET_CREATED', ticket: newTicket });

    // Send Web-Push to Assignee and Tagged Users (even if tab is closed)
    const notifyUserIds = [assigneeId, ...(taggedUserIds || [])].filter(id => id && id !== req.user.id);
    if (notifyUserIds.length > 0) {
      pushService.sendToUsers(notifyUserIds, {
        title: `تیکت جدید: ${newTicket.title}`,
        body: `توسط ${req.user.name} ارجاع داده شد.`,
        ticketId: newTicket.id,
        url: `./?ticket=${newTicket.id}`
      });
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

  // Web-Push to all participants (creator, assignee, tagged)
  const allParticipants = [ticket.creatorId, ticket.assigneeId, ...(ticket.taggedUserIds || [])];
  const notifyIds = Array.from(new Set(allParticipants)).filter(id => id && id !== req.user.id);

  if (notifyIds.length > 0) {
    pushService.sendToUsers(notifyIds, {
      title: `پاسخ جدید در تیکت: ${ticket.title}`,
      body: `${req.user.name}: ${reply.content.slice(0, 70)}...`,
      ticketId: ticket.id,
      url: `./?ticket=${ticket.id}`
    });
  }

  res.json(reply);
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
