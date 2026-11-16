const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'ticketing_db.json');

const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'مدیر سیستم (Admin)',
    description: 'دسترسی کامل به تمامی بخش‌های تیکتینگ، گزارشات، تعریف نقش‌ها و ارجاعات',
    isSystem: true,
    permissions: [
      'view_all_tickets',
      'create_ticket',
      'edit_all_tickets',
      'delete_ticket',
      'reassign_ticket',
      'manage_roles',
      'manage_users',
      'view_reports'
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
      login_logs: []
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

    // Initialize Default Roles
    if (!this.data.roles || this.data.roles.length === 0) {
      this.data.roles = [...DEFAULT_ROLES];
    }

    // Initialize default Manager user if no users exist
    if (!this.data.users || this.data.users.length === 0) {
      this.data.users = [];
      const salt = bcrypt.genSaltSync(10);
      const managerUser = {
        id: 'u_manager_1',
        email: 'manager@company.com',
        password_hash: bcrypt.hashSync('123456', salt),
        name: 'مدیر سامانه تیکتینگ',
        department: 'مدیریت و فناوری',
        roleId: 'admin',
        avatar: './icons/company_logo.png',
        initials: 'م‌س',
        isRestricted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.data.users.push(managerUser);
    }

    if (!this.data.tickets) this.data.tickets = [];
    if (!this.data.push_subscriptions) this.data.push_subscriptions = [];
    if (!this.data.login_logs) this.data.login_logs = [];

    this.save();
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
    // Keep last 1000 logs
    if (this.data.login_logs.length > 1000) {
      this.data.login_logs = this.data.login_logs.slice(0, 1000);
    }
    this.save();
    return log;
  }

  getLoginLogs(limit = 100) {
    return this.data.login_logs.slice(0, limit);
  }

  // --- Users Management ---
  findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    return this.data.users.find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  createUser({ email, password, name, department, roleId, avatar }) {
    const cleanEmail = email.toLowerCase().trim();
    if (this.findUserByEmail(cleanEmail)) {
      throw new Error('این ایمیل قبلاً در سامانه ثبت شده است.');
    }

    const salt = bcrypt.genSaltSync(10);
    const initials = (name || 'کاربر').split(' ').map(p => p[0]).join('‌');
    const newUser = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      email: cleanEmail,
      password_hash: bcrypt.hashSync(password || '123456', salt),
      name: (name || cleanEmail.split('@')[0]).trim(),
      department: (department || 'عمومی').trim(),
      roleId: roleId || 'member',
      avatar: avatar || './icons/company_logo.png',
      initials: initials || 'ک‌ج',
      isRestricted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) throw new Error('کاربر مورد نظر یافت نشد.');

    if (updates.email && updates.email.toLowerCase().trim() !== user.email) {
      const cleanEmail = updates.email.toLowerCase().trim();
      const existing = this.findUserByEmail(cleanEmail);
      if (existing && existing.id !== id) {
        throw new Error('این ایمیل به کاربر دیگری اختصاص دارد.');
      }
      user.email = cleanEmail;
    }

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.department !== undefined) user.department = updates.department.trim();
    if (updates.roleId !== undefined) user.roleId = updates.roleId;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    if (updates.isRestricted !== undefined) user.isRestricted = Boolean(updates.isRestricted);
    if (updates.password) {
      const salt = bcrypt.genSaltSync(10);
      user.password_hash = bcrypt.hashSync(updates.password, salt);
    }

    if (user.name) {
      user.initials = user.name.split(' ').map(p => p[0]).join('‌');
    }

    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  setUserRestricted(id, isRestricted) {
    const user = this.findUserById(id);
    if (!user) throw new Error('کاربر یافت نشد.');
    user.isRestricted = Boolean(isRestricted);
    user.updatedAt = new Date().toISOString();
    this.save();
    return user;
  }

  deleteUser(id) {
    if (this.data.users.length <= 1) {
      throw new Error('حداقل یک کاربر باید در سامانه باقی بماند.');
    }
    this.data.users = this.data.users.filter(u => u.id !== id);
    // Remove user push subscriptions
    this.data.push_subscriptions = this.data.push_subscriptions.filter(s => s.userId !== id);
    this.save();
    return true;
  }

  // --- Roles Management ---
  createRole({ name, description, permissions }) {
    const id = 'role_' + Date.now();
    const newRole = {
      id,
      name: name.trim(),
      description: (description || '').trim(),
      isSystem: false,
      permissions: permissions || ['create_ticket']
    };
    this.data.roles.push(newRole);
    this.save();
    return newRole;
  }

  deleteRole(roleId) {
    const role = this.data.roles.find(r => r.id === roleId);
    if (!role) throw new Error('نقش یافت نشد.');
    if (role.isSystem || role.id === 'admin') {
      throw new Error('امکان حذف نقش‌های سیستمی پیش‌فرض وجود ندارد.');
    }
    // Reassign users with this role to 'member'
    this.data.users.forEach(u => {
      if (u.roleId === roleId) u.roleId = 'member';
    });
    this.data.roles = this.data.roles.filter(r => r.id !== roleId);
    this.save();
    return true;
  }

  // --- Push Subscriptions ---
  savePushSubscription(userId, subscription, userAgent, ip) {
    if (!subscription || !subscription.endpoint) return null;
    // Remove any existing subscription with the same endpoint
    this.data.push_subscriptions = this.data.push_subscriptions.filter(s => s.endpoint !== subscription.endpoint);
    const newSub = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
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

  // --- Factory Reset ---
  factoryReset() {
    this.data.tickets = [];
    this.data.login_logs = [];
    this.data.push_subscriptions = [];
    // Reset users to initial manager
    const salt = bcrypt.genSaltSync(10);
    this.data.users = [
      {
        id: 'u_manager_1',
        email: 'manager@company.com',
        password_hash: bcrypt.hashSync('123456', salt),
        name: 'مدیر سامانه تیکتینگ',
        department: 'مدیریت و فناوری',
        roleId: 'admin',
        avatar: './icons/company_logo.png',
        initials: 'م‌س',
        isRestricted: false,
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
