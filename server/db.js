const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'ticketing_db.json');

const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'مدیر سیستم (Admin)',
    description: 'دسترسی کامل به تمامی بخش‌های تیکتینگ، گزارشات، تعریف نقش‌ها، اعلانات و ارجاعات',
    isSystem: true,
    permissions: [
      'view_all_tickets',
      'create_ticket',
      'edit_all_tickets',
      'delete_ticket',
      'reassign_ticket',
      'manage_roles',
      'manage_users',
      'view_reports',
      'manage_announcements'
    ]
  },
  {
    id: 'manager',
    name: 'سرپرست تیم (Supervisor)',
    description: 'امکان مشاهده کلیه تیکت‌ها، ارجاع تیکت و مشاهده داشبورد آماری',
    isSystem: true,
    permissions: [
      'view_all_tickets',
      'create_ticket',
      'edit_all_tickets',
      'reassign_ticket',
      'view_reports'
    ]
  },
  {
    id: 'staff',
    name: 'کارشناس فنی / اجرایی (Staff)',
    description: 'مشاهده تیکت‌های ارجاع‌شده، ایجاد تیکت و پاسخ‌دهی به تیکت‌ها',
    isSystem: true,
    permissions: [
      'create_ticket',
      'edit_assigned_tickets',
      'reassign_ticket'
    ]
  },
  {
    id: 'member',
    name: 'کاربر پرسنلی (Member)',
    description: 'ثبت تیکت برای همکاران و پیگیری تیکت‌های ثبت‌شده خود',
    isSystem: true,
    permissions: [
      'create_ticket'
    ]
  }
];

class Database {
  constructor() {
    this.data = {
      system_settings: {},
      users: [],
      roles: [],
      tickets: [],
      push_subscriptions: [],
      login_logs: [],
      announcements: [],
      deliveries: []
    };
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading DB file, recovering default structure:', err);
      }
    }

    // Initialize System Settings
    if (!this.data.system_settings) this.data.system_settings = {};
    if (!this.data.system_settings.superadmin_username) {
      this.data.system_settings.superadmin_username = 'superadmin';
    }
    if (!this.data.system_settings.superadmin_password_hash) {
      // Default superadmin password: admin123456
      const salt = bcrypt.genSaltSync(10);
      this.data.system_settings.superadmin_password_hash = bcrypt.hashSync('admin123456', salt);
    }
    if (!this.data.system_settings.jwt_secret) {
      this.data.system_settings.jwt_secret = 'mana_secret_' + Math.random().toString(36).slice(2) + Date.now();
    }

    // Telegram Bot Settings Defaults
    if (this.data.system_settings.telegram_bot_token === undefined) {
      this.data.system_settings.telegram_bot_token = '';
    }
    if (this.data.system_settings.telegram_proxy_url === undefined) {
      this.data.system_settings.telegram_proxy_url = ''; // e.g. http://127.0.0.1:10809 or socks5://127.0.0.1:10808
    }
    if (this.data.system_settings.telegram_auto_resend_enabled === undefined) {
      this.data.system_settings.telegram_auto_resend_enabled = true;
    }
    if (this.data.system_settings.telegram_resend_interval_mins === undefined) {
      this.data.system_settings.telegram_resend_interval_mins = 30; // default: 30 minutes
    }
    if (this.data.system_settings.telegram_max_resends === undefined) {
      this.data.system_settings.telegram_max_resends = 3; // default: up to 3 reminders
    }

    // Initialize Default Roles
    if (!this.data.roles || this.data.roles.length === 0) {
      this.data.roles = [...DEFAULT_ROLES];
    } else {
      // Ensure admin has manage_announcements
      const adminRole = this.data.roles.find(r => r.id === 'admin');
      if (adminRole && !adminRole.permissions.includes('manage_announcements')) {
        adminRole.permissions.push('manage_announcements');
      }
    }

const STANDARD_DEPARTMENTS = [
  'مدیریت',
  'مهندسی',
  'مالی و حسابداری',
  'پشتیبانی'
];

    // Initialize default Manager user if no users exist
    if (!this.data.users || this.data.users.length === 0) {
      this.data.users = [];
      const salt = bcrypt.genSaltSync(10);
      const managerUser = {
        id: 'u_manager_1',
        email: 'manager@company.com',
        password_hash: bcrypt.hashSync('123456', salt),
        name: 'مدیر سامانه تیکتینگ',
        department: 'مدیریت',
        roleId: 'admin',
        avatar: './icons/company_logo.png',
        initials: 'م‌س',
        isRestricted: false,
        telegramChatId: null,
        telegramUsername: null,
        telegramAuthCode: this.generateTelegramAuthCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.data.users.push(managerUser);
    } else {
      // Ensure every user has telegramAuthCode and normalize department
      const deptMapping = {
        'مدیریت و فناوری': 'مدیریت',
        'مدیریت': 'مدیریت',
        'منابع انسانی و اداری': 'مدیریت',
        'توسعه نرم‌افزار': 'مهندسی',
        'فناوری اطلاعات و زیرساخت': 'مهندسی',
        'مهندسی': 'مهندسی',
        'مالی و حسابداری': 'مالی و حسابداری',
        'مالی': 'مالی و حسابداری',
        'پشتیبانی مشتریان': 'پشتیبانی',
        'پشتیبانی مشتریان و عملیات': 'پشتیبانی',
        'پشتیبانی': 'پشتیبانی',
        'مارکتینگ و فروش': 'پشتیبانی',
        'عمومی': 'پشتیبانی'
      };

      this.data.users.forEach(u => {
        if (!u.telegramAuthCode) {
          u.telegramAuthCode = this.generateTelegramAuthCode();
        }
        if (u.department && deptMapping[u.department]) {
          u.department = deptMapping[u.department];
        } else if (!STANDARD_DEPARTMENTS.includes(u.department)) {
          u.department = 'پشتیبانی';
        }
      });
    }

    if (!this.data.tickets) this.data.tickets = [];
    if (!this.data.push_subscriptions) this.data.push_subscriptions = [];
    if (!this.data.login_logs) this.data.login_logs = [];
    if (!this.data.announcements) this.data.announcements = [];
    if (!this.data.deliveries) this.data.deliveries = [];

    this.save();
  }

  generateTelegramAuthCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  save() {
    try {
      const tmpFile = DB_FILE + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error saving DB file:', err);
    }
  }

  // --- Login Audit Logs ---
  addLoginLog({ email, ip, userAgent, status, type, message }) {
    const log = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      email: (email || '').toLowerCase().trim(),
      ip: ip || '127.0.0.1',
      userAgent: userAgent || 'Unknown',
      status: status, // 'SUCCESS', 'FAILED', 'BLOCKED'
      type: type || 'USER', // 'SUPERADMIN', 'USER'
      message: message || '',
      timestamp: new Date().toISOString()
    };
    this.data.login_logs.unshift(log);
    if (this.data.login_logs.length > 1000) {
      this.data.login_logs = this.data.login_logs.slice(0, 1000);
    }
    this.save();
    return log;
  }

  // --- Users CRUD ---
  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  findUserByTelegramAuthCode(code) {
    if (!code) return null;
    return this.data.users.find(u => u.telegramAuthCode === code.toString().trim());
  }

  findUserByTelegramChatId(chatId) {
    if (!chatId) return null;
    return this.data.users.find(u => u.telegramChatId && u.telegramChatId.toString() === chatId.toString());
  }

  createUser({ email, password, name, department, roleId }) {
    const existing = this.findUserByEmail(email);
    if (existing) {
      throw new Error('کاربر با این ایمیل از قبل در سامانه تعریف شده است.');
    }

    const salt = bcrypt.genSaltSync(10);
    const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const initials = name ? name.split(' ').map(p => p[0]).join('‌') : 'ک‌ج';

    const newUser = {
      id,
      email: email.toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password || '123456', salt),
      name: name ? name.trim() : email.split('@')[0],
      department: department ? department.trim() : 'عمومی',
      roleId: roleId || 'member',
      avatar: './icons/company_logo.png',
      initials: initials || 'ک‌ج',
      isRestricted: false,
      telegramChatId: null,
      telegramUsername: null,
      telegramAuthCode: this.generateTelegramAuthCode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) throw new Error('کاربر یافت نشد.');

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.department !== undefined) user.department = updates.department.trim();
    if (updates.roleId !== undefined) user.roleId = updates.roleId;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    if (updates.isRestricted !== undefined) user.isRestricted = Boolean(updates.isRestricted);
    if (updates.telegramChatId !== undefined) user.telegramChatId = updates.telegramChatId;
    if (updates.telegramUsername !== undefined) user.telegramUsername = updates.telegramUsername;

    if (updates.password) {
      const salt = bcrypt.genSaltSync(10);
      user.password_hash = bcrypt.hashSync(updates.password, salt);
    }

    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  linkUserTelegram(userId, chatId, username) {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.telegramChatId = chatId.toString();
    user.telegramUsername = username || null;
    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  unlinkUserTelegram(userId) {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.telegramChatId = null;
    user.telegramUsername = null;
    user.telegramAuthCode = this.generateTelegramAuthCode();
    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  deleteUser(id) {
    if (this.data.users.length <= 1) {
      throw new Error('امکان حذف تنها کاربر باقی‌مانده در سامانه وجود ندارد.');
    }
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('کاربر یافت نشد.');
    this.data.users.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Push Subscriptions ---
  savePushSubscription(userId, subscription, userAgent, ip) {
    this.data.push_subscriptions = this.data.push_subscriptions.filter(s => s.endpoint !== subscription.endpoint);
    const newSub = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: userAgent || 'Unknown',
      ip: ip || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    this.data.push_subscriptions.push(newSub);
    this.save();
    return newSub;
  }

  removePushSubscription(endpoint) {
    this.data.push_subscriptions = this.data.push_subscriptions.filter(s => s.endpoint !== endpoint);
    this.save();
  }

  getUserPushSubscriptions(userIds) {
    if (!Array.isArray(userIds)) userIds = [userIds];
    return this.data.push_subscriptions.filter(s => userIds.includes(s.userId));
  }

  // --- Tickets Management ---
  getNextTicketId() {
    let maxNum = 100;
    if (Array.isArray(this.data.tickets)) {
      this.data.tickets.forEach(t => {
        const match = t.id && t.id.match(/^TCK-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }
    return `TCK-${maxNum + 1}`;
  }

  createTicket({ title, description, creatorId, assigneeId, taggedUserIds, priority, status, department, deadline, attachments, channel = 'web' }) {
    const newTicket = {
      id: this.getNextTicketId(),
      title: (title || '').trim(),
      description: (description || '').trim(),
      creatorId: creatorId || 'system',
      assigneeId: assigneeId || null,
      taggedUserIds: Array.isArray(taggedUserIds) ? taggedUserIds : [],
      priority: priority || 'normal',
      status: status || 'open',
      department: department || 'عمومی',
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: Array.isArray(attachments) ? attachments : [],
      replies: [],
      history: [
        {
          action: 'CREATED',
          actorId: creatorId || 'system',
          timestamp: new Date().toISOString(),
          channel: channel || 'web'
        }
      ]
    };

    if (!Array.isArray(this.data.tickets)) {
      this.data.tickets = [];
    }
    this.data.tickets.unshift(newTicket);
    this.save();
    return newTicket;
  }

  // --- Deliveries & Interaction Tracking ---
  createDelivery({ type, referenceId, title, message, targetUserIds, creatorId, creatorName, creatorDepartment }) {
    let resolvedCreatorName = creatorName;
    let resolvedCreatorDept = creatorDepartment;
    if (!resolvedCreatorName && creatorId) {
      if (creatorId === 'superadmin') {
        resolvedCreatorName = 'مدیر ارشد سیستم (Superadmin)';
        resolvedCreatorDept = 'مدیریت';
      } else {
        const u = this.findUserById(creatorId);
        if (u) {
          resolvedCreatorName = u.name;
          resolvedCreatorDept = u.department;
        }
      }
    }

    const deliveryGroup = {
      id: 'del_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: type || 'ticket', // 'ticket' | 'announcement'
      referenceId: referenceId || null,
      title: title || '',
      message: message || '',
      creatorId: creatorId || 'system',
      creatorName: resolvedCreatorName || 'مدیریت سامانه',
      creatorDepartment: resolvedCreatorDept || '',
      createdAt: new Date().toISOString(),
      recipients: []
    };

    targetUserIds.forEach(uid => {
      const u = this.findUserById(uid);
      deliveryGroup.recipients.push({
        userId: uid,
        userName: u ? u.name : 'نامشخص',
        userEmail: u ? u.email : '',
        telegramChatId: u ? u.telegramChatId : null,
        telegramMessageId: null,
        status: 'pending', // 'pending', 'sent', 'acknowledged'
        acknowledgedAt: null,
        resendCount: 0,
        lastSentAt: null
      });
    });

    this.data.deliveries.unshift(deliveryGroup);
    // Keep last 500 deliveries
    if (this.data.deliveries.length > 500) {
      this.data.deliveries = this.data.deliveries.slice(0, 500);
    }
    this.save();
    return deliveryGroup;
  }

  updateRecipientStatus(deliveryId, userId, updates) {
    const group = this.data.deliveries.find(d => d.id === deliveryId);
    if (!group) return null;
    const recipient = group.recipients.find(r => r.userId === userId);
    if (!recipient) return null;

    Object.assign(recipient, updates);
    this.save();
    return { group, recipient };
  }

  acknowledgeDelivery(deliveryId, userId, via = 'button') {
    return this.updateRecipientStatus(deliveryId, userId, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedVia: via
    });
  }

  acknowledgeTicketDeliveriesForUser(ticketId, userId) {
    if (!ticketId || !userId || !this.data.deliveries) return [];
    const updated = [];

    this.data.deliveries.forEach(group => {
      if (group.type === 'ticket' && group.referenceId === ticketId) {
        const recipient = group.recipients.find(r => r.userId === userId);
        if (recipient && recipient.status !== 'acknowledged') {
          recipient.status = 'acknowledged';
          recipient.acknowledgedAt = new Date().toISOString();
          recipient.acknowledgedVia = 'reply';
          updated.push({
            deliveryId: group.id,
            groupTitle: group.title,
            recipient: { ...recipient }
          });
        }
      }
    });

    if (updated.length > 0) {
      this.save();
    }
    return updated;
  }

  // --- Announcements CRUD ---
  createAnnouncement({ title, content, targetDepartment, priority, creatorId, creatorName, creatorDepartment }) {
    let resolvedCreatorName = creatorName;
    let resolvedCreatorDept = creatorDepartment;
    if (!resolvedCreatorName && creatorId) {
      if (creatorId === 'superadmin') {
        resolvedCreatorName = 'مدیر ارشد سیستم (Superadmin)';
        resolvedCreatorDept = 'مدیریت';
      } else {
        const u = this.findUserById(creatorId);
        if (u) {
          resolvedCreatorName = u.name;
          resolvedCreatorDept = u.department;
        }
      }
    }

    const announcement = {
      id: 'ann_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      content: content.trim(),
      targetDepartment: targetDepartment || 'all',
      priority: priority || 'normal', // 'urgent', 'high', 'normal'
      creatorId: creatorId || 'system',
      creatorName: resolvedCreatorName || 'مدیریت سامانه',
      creatorDepartment: resolvedCreatorDept || '',
      createdAt: new Date().toISOString()
    };
    this.data.announcements.unshift(announcement);
    if (this.data.announcements.length > 200) {
      this.data.announcements = this.data.announcements.slice(0, 200);
    }
    this.save();
    return announcement;
  }

  // --- Superadmin Settings ---
  updateSuperadminPassword(newPassword) {
    const salt = bcrypt.genSaltSync(10);
    this.data.system_settings.superadmin_password_hash = bcrypt.hashSync(newPassword, salt);
    this.save();
  }

  updateSuperadminUsername(newUsername) {
    this.data.system_settings.superadmin_username = newUsername.trim();
    this.save();
  }

  updateTelegramSettings({ botToken, proxyUrl, autoResendEnabled, resendIntervalMins, maxResends }) {
    if (botToken !== undefined) this.data.system_settings.telegram_bot_token = (botToken || '').trim();
    if (proxyUrl !== undefined) this.data.system_settings.telegram_proxy_url = (proxyUrl || '').trim();
    if (autoResendEnabled !== undefined) this.data.system_settings.telegram_auto_resend_enabled = Boolean(autoResendEnabled);
    if (resendIntervalMins !== undefined) this.data.system_settings.telegram_resend_interval_mins = parseInt(resendIntervalMins, 10) || 30;
    if (maxResends !== undefined) this.data.system_settings.telegram_max_resends = parseInt(maxResends, 10) || 3;
    this.save();
    return this.data.system_settings;
  }

  // --- Factory Reset ---
  factoryReset() {
    this.data.tickets = [];
    this.data.login_logs = [];
    this.data.push_subscriptions = [];
    this.data.announcements = [];
    this.data.deliveries = [];
    // Reset users to initial manager
    const salt = bcrypt.genSaltSync(10);
    this.data.users = [
      {
        id: 'u_manager_1',
        email: 'manager@company.com',
        password_hash: bcrypt.hashSync('123456', salt),
        name: 'مدیر سامانه تیکتینگ',
        department: 'مدیریت',
        roleId: 'admin',
        avatar: './icons/company_logo.png',
        initials: 'م‌س',
        isRestricted: false,
        telegramChatId: null,
        telegramUsername: null,
        telegramAuthCode: this.generateTelegramAuthCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    this.data.roles = [...DEFAULT_ROLES];
    this.save();
    return true;
  }
}

module.exports = new Database();
