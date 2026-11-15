// Central State Management with Event Bus & Storage Sync

import { LocalStorageProvider } from './storage/local.js';
import { GoogleDriveProvider } from './storage/gdrive.js';

export const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'مدیر ارشد سیستم (Admin)',
    description: 'دسترسی کامل به تمامی بخش‌ها، گزارشات، تعریف نقش‌ها و مدیریت کاربران',
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

export const INITIAL_USERS = [
  {
    id: 'u1',
    name: 'علی رضایی',
    email: 'ali.rezaei@company.com',
    roleId: 'admin',
    department: 'فناوری اطلاعات و زیرساخت',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    initials: 'ع‌ر'
  },
  {
    id: 'u2',
    name: 'سارا محمدی',
    email: 'sara.mohammadi@company.com',
    roleId: 'manager',
    department: 'پشتیبانی مشتریان و عملیات',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    initials: 'س‌م'
  },
  {
    id: 'u3',
    name: 'مهدی حسینی',
    email: 'mehdi.hosseini@company.com',
    roleId: 'staff',
    department: 'توسعه نرم‌افزار',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    initials: 'م‌ح'
  },
  {
    id: 'u4',
    name: 'مریم کاظمی',
    email: 'maryam.kazemi@company.com',
    roleId: 'staff',
    department: 'مارکتینگ و فروش',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    initials: 'م‌ک'
  },
  {
    id: 'u5',
    name: 'پژمان نوری',
    email: 'pejman.nouri@company.com',
    roleId: 'staff',
    department: 'شبکه و امنیت',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    initials: 'پ‌ن'
  },
  {
    id: 'u6',
    name: 'نگار صادقی',
    email: 'negar.sadeghi@company.com',
    roleId: 'member',
    department: 'منابع انسانی و اداری',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80',
    initials: 'ن‌ص'
  }
];

export const INITIAL_TICKETS = [
  {
    id: 'TCK-101',
    title: 'بررسی اختلال دسترسی به سرور پایگاه‌داده شعبه مرکزی',
    description: 'از صبح امروز ارتباط با دیتابیس پشتیبان دچار کندی شدید شده است. لطفاً تنظیمات Connection Pool و لاگ‌های خطا را بررسی فرمایید.',
    creatorId: 'u2',
    assigneeId: 'u1',
    taggedUserIds: ['u3', 'u5'],
    priority: 'urgent', // urgent, high, normal, low
    status: 'in_progress', // open, in_progress, waiting, resolved, closed
    department: 'فناوری اطلاعات و زیرساخت',
    deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), // 4 hours from now
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    attachments: [
      {
        id: 'att-1',
        name: 'database_error_log.txt',
        size: 45200,
        type: 'text/plain',
        url: '#',
        source: 'local'
      }
    ],
    replies: [
      {
        id: 'rep-1',
        authorId: 'u1',
        content: 'در حال بررسی لاگ‌های سرور PostgreSQL هستم. به نظر می‌رسد یک کوئری سنگین باعث قفل شدن جدول سفارشات شده است.',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        attachments: []
      },
      {
        id: 'rep-2',
        authorId: 'u5',
        content: 'ترافیک فایروال را هم مانیتور کردم، بسته‌های مشکوک دیده‌نشد. مشکل احتمالاً سمت برنامه است.',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        attachments: []
      }
    ],
    history: [
      { action: 'CREATED', actorId: 'u2', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
      { action: 'STATUS_CHANGE', from: 'open', to: 'in_progress', actorId: 'u1', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString() }
    ]
  },
  {
    id: 'TCK-102',
    title: 'آماده‌سازی قرارداد همکاری و دسترسی سامانه برای پرسنل جدید',
    description: 'سه نفر کارشناس جدید از ابتدای هفته آینده به تیم ملحق می‌شوند. لطفاً ایمیل سازمانی و مجوزهای لازم ایجاد شود.',
    creatorId: 'u6',
    assigneeId: 'u1',
    taggedUserIds: ['u2'],
    priority: 'high',
    status: 'open',
    department: 'منابع انسانی و اداری',
    deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // tomorrow
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    attachments: [],
    replies: [],
    history: [
      { action: 'CREATED', actorId: 'u6', timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString() }
    ]
  },
  {
    id: 'TCK-103',
    title: 'طراحی بنر و تیزر معرفی فیچرهای نسخه پاییز برای اینستاگرام',
    description: 'بنرهای استوری و پست اسلایدی جهت کمپین اطلاع‌رسانی قابلیت‌های جدید اپلیکیشن با تم پاییزه.',
    creatorId: 'u4',
    assigneeId: 'u4',
    taggedUserIds: ['u2', 'u3'],
    priority: 'normal',
    status: 'waiting',
    department: 'مارکتینگ و فروش',
    deadline: new Date(Date.now() - 8 * 3600 * 1000).toISOString(), // Overdue by 8 hours
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    attachments: [],
    replies: [
      {
        id: 'rep-3',
        authorId: 'u4',
        content: 'پیش‌نویس اولیه در فیگما آماده شد، منتظر تایید متن‌های مارکتینگ توسط خانم محمدی هستم.',
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        attachments: []
      }
    ],
    history: [
      { action: 'CREATED', actorId: 'u4', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() }
    ]
  },
  {
    id: 'TCK-104',
    title: 'رفع مشکل محاسبه مالیات در خروجی فاکتورهای اکسل',
    description: 'در گزارش فصلی مالیات، ردیف‌های مربوط به تخفیف کالا دو بار در جمع نهایی کسر می‌گردد.',
    creatorId: 'u2',
    assigneeId: 'u3',
    taggedUserIds: ['u1'],
    priority: 'high',
    status: 'resolved',
    department: 'توسعه نرم‌افزار',
    deadline: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    attachments: [],
    replies: [
      {
        id: 'rep-4',
        authorId: 'u3',
        content: 'فرمول ماکرو در نسخه جدید اصلاح شد و تست موفقیت‌آمیز بود.',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        attachments: []
      }
    ],
    history: [
      { action: 'CREATED', actorId: 'u2', timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString() },
      { action: 'STATUS_CHANGE', from: 'in_progress', to: 'resolved', actorId: 'u3', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }
    ]
  }
];

class StateManager {
  constructor() {
    this.listeners = new Set();
    this.currentUser = null;
    this.users = [...INITIAL_USERS];
    this.roles = [...DEFAULT_ROLES];
    this.tickets = [...INITIAL_TICKETS];
    this.notifications = [];
    this.unreadCount = 0;

    // Filters and UI State
    this.activeTab = 'all'; // all, assigned, created, tagged, overdue
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.priorityFilter = 'all';
    this.departmentFilter = 'all';
    this.currentView = 'tickets'; // tickets, admin
    this.activeTicketId = null;
    this.isTicketModalOpen = false;
    this.isSettingsModalOpen = false;

    // Storage and Google Drive
    this.storageMode = localStorage.getItem('storage_mode') || 'local'; // 'local' or 'gdrive'
    this.gdriveStatus = { status: 'idle', message: 'آماده به کار', lastSync: null };

    this.localProvider = new LocalStorageProvider((data, sourceId) => this.handleRemoteData(data, sourceId));
    this.gdriveProvider = new GoogleDriveProvider({
      onRemoteUpdate: (data) => this.handleRemoteData(data, 'gdrive'),
      onStatusChange: (status) => {
        this.gdriveStatus = status;
        if (status.status === 'connected' && this.gdriveProvider.googleUser) {
          this.syncGoogleUserWithCurrent();
        }
        this.emit('gdrive_status_change', status);
      }
    });

    this.init();
  }

  init() {
    // 1. Try to load from LocalStorage first
    const saved = this.localProvider.load();
    if (saved && saved.tickets && saved.users && saved.roles) {
      this.tickets = saved.tickets;
      this.users = saved.users;
      this.roles = saved.roles;
    } else {
      this.persistLocal();
    }

    // 2. Select initial logged-in user
    const savedUserId = localStorage.getItem('current_user_id') || 'u1';
    this.currentUser = this.users.find(u => u.id === savedUserId) || this.users[0];

    // 3. Compute initial notifications for current user
    this.rebuildNotifications();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(eventType, payload) {
    for (const listener of this.listeners) {
      try {
        listener(eventType, payload);
      } catch (err) {
        console.error('Listener execution error:', err);
      }
    }
  }

  persistLocal() {
    this.localProvider.save({
      tickets: this.tickets,
      users: this.users,
      roles: this.roles
    }, this.currentUser?.id);
  }

  async persistCurrentData() {
    this.persistLocal();
    if (this.storageMode === 'gdrive' && this.gdriveProvider.isConnected()) {
      await this.gdriveProvider.save({
        tickets: this.tickets,
        users: this.users,
        roles: this.roles,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Handle incoming remote updates (from Google Drive polling or cross-tab BroadcastChannel)
  handleRemoteData(incoming, source) {
    if (!incoming || !incoming.tickets) return;

    // Detect new tickets or replies targeting current user
    const previousTicketsMap = new Map(this.tickets.map(t => [t.id, t]));
    const newNotifications = [];

    incoming.tickets.forEach(newTicket => {
      const oldTicket = previousTicketsMap.get(newTicket.id);

      // Condition 1: Brand new ticket created targeting current user
      if (!oldTicket) {
        if (newTicket.assigneeId === this.currentUser.id && newTicket.creatorId !== this.currentUser.id) {
          newNotifications.push({
            id: 'notif-' + Date.now() + Math.random(),
            ticketId: newTicket.id,
            type: 'assigned',
            title: `تیکت جدید برای شما: ${newTicket.title}`,
            message: `توسط ${this.getUserName(newTicket.creatorId)} ارجاع داده شد.`,
            createdAt: new Date().toISOString(),
            read: false
          });
        } else if (newTicket.taggedUserIds?.includes(this.currentUser.id) && newTicket.creatorId !== this.currentUser.id) {
          newNotifications.push({
            id: 'notif-' + Date.now() + Math.random(),
            ticketId: newTicket.id,
            type: 'tagged',
            title: `شما در یک تیکت تگ شدید: ${newTicket.title}`,
            message: `توسط ${this.getUserName(newTicket.creatorId)}`,
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      } else {
        // Condition 2: Existing ticket updated
        // New replies
        const oldReplyCount = oldTicket.replies?.length || 0;
        const newReplyCount = newTicket.replies?.length || 0;
        if (newReplyCount > oldReplyCount) {
          const latestReply = newTicket.replies[newReplyCount - 1];
          if (latestReply.authorId !== this.currentUser.id) {
            const isRelevant = newTicket.assigneeId === this.currentUser.id ||
              newTicket.creatorId === this.currentUser.id ||
              newTicket.taggedUserIds?.includes(this.currentUser.id);

            if (isRelevant) {
              newNotifications.push({
                id: 'notif-' + Date.now() + Math.random(),
                ticketId: newTicket.id,
                type: 'reply',
                title: `پاسخ جدید در تیکت: ${newTicket.title}`,
                message: `${this.getUserName(latestReply.authorId)}: ${latestReply.content.slice(0, 50)}...`,
                createdAt: new Date().toISOString(),
                read: false
              });
            }
          }
        }

        // Status changed
        if (oldTicket.status !== newTicket.status) {
          const isRelevant = newTicket.assigneeId === this.currentUser.id || newTicket.creatorId === this.currentUser.id;
          if (isRelevant) {
            newNotifications.push({
              id: 'notif-' + Date.now() + Math.random(),
              ticketId: newTicket.id,
              type: 'status',
              title: `وضعیت تیکت تغییر یافت`,
              message: `تیکت "${newTicket.title}" به "${this.getStatusLabel(newTicket.status)}" تغییر کرد.`,
              createdAt: new Date().toISOString(),
              read: false
            });
          }
        }
      }
    });

    // Update state
    this.tickets = incoming.tickets;
    if (incoming.users) this.users = incoming.users;
    if (incoming.roles) this.roles = incoming.roles;

    if (newNotifications.length > 0) {
      this.notifications.unshift(...newNotifications);
      this.unreadCount = this.notifications.filter(n => !n.read).length;
      this.emit('instant_notification', newNotifications);
    }

    this.emit('state_updated');
  }

  // Active User Switcher
  setCurrentUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    this.currentUser = user;
    localStorage.setItem('current_user_id', user.id);
    this.rebuildNotifications();
    this.emit('user_changed', user);
    this.emit('state_updated');
  }

  // Automatically match or register logged-in Google account with internal user directory
  syncGoogleUserWithCurrent() {
    const gUser = this.gdriveProvider.googleUser;
    if (!gUser || !gUser.email) return;

    const email = gUser.email.toLowerCase().trim();
    let matchedUser = this.users.find(u => u.email?.toLowerCase().trim() === email);

    if (!matchedUser) {
      // Auto-register Google account in company team directory
      const initials = (gUser.name || 'کاربر گوگل').split(' ').map(p => p[0]).join('‌');
      matchedUser = {
        id: 'u_g_' + (gUser.sub || Date.now()),
        name: gUser.name || email.split('@')[0],
        email: email,
        roleId: this.users.length === 0 ? 'admin' : 'staff',
        department: 'پرسنل گوگل',
        avatar: gUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
        initials: initials || 'گ‌ک'
      };
      this.users.push(matchedUser);
      this.persistLocal();
    } else {
      if (gUser.picture && matchedUser.avatar !== gUser.picture) {
        matchedUser.avatar = gUser.picture;
      }
    }

    this.currentUser = matchedUser;
    localStorage.setItem('current_user_id', matchedUser.id);
    this.rebuildNotifications();
    this.emit('user_changed', matchedUser);
    this.emit('state_updated');
  }

  getCurrentUserRole() {
    return this.roles.find(r => r.id === this.currentUser.roleId) || this.roles[0];
  }

  hasPermission(permission) {
    if (!this.currentUser) return false;
    const role = this.getCurrentUserRole();
    if (!role) return false;
    if (role.id === 'admin') return true;
    return role.permissions?.includes(permission);
  }

  getUser(userId) {
    return this.users.find(u => u.id === userId);
  }

  getUserName(userId) {
    const u = this.getUser(userId);
    return u ? u.name : 'کاربر نامشخص';
  }

  // Ticket Operations
  async createTicket({ title, description, assigneeId, taggedUserIds, priority, department, deadline, attachments = [] }) {
    const nextNum = this.tickets.length + 101;
    const newTicket = {
      id: `TCK-${nextNum}`,
      title: title.trim(),
      description: description.trim(),
      creatorId: this.currentUser.id,
      assigneeId: assigneeId,
      taggedUserIds: taggedUserIds || [],
      priority: priority || 'normal',
      status: 'open',
      department: department || 'عمومی',
      deadline: deadline || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: attachments,
      replies: [],
      history: [
        {
          action: 'CREATED',
          actorId: this.currentUser.id,
          timestamp: new Date().toISOString()
        }
      ]
    };

    this.tickets.unshift(newTicket);
    await this.persistCurrentData();

    // Check if creator also assigned it to someone else -> prepare local notification test
    this.emit('ticket_created', newTicket);
    this.emit('state_updated');
    return newTicket;
  }

  async updateTicketStatus(ticketId, newStatus) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const oldStatus = ticket.status;
    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();
    ticket.history.push({
      action: 'STATUS_CHANGE',
      from: oldStatus,
      to: newStatus,
      actorId: this.currentUser.id,
      timestamp: new Date().toISOString()
    });

    await this.persistCurrentData();
    this.emit('state_updated');
  }

  async addReply(ticketId, content, attachments = [], newStatus = null) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const reply = {
      id: `rep-${Date.now()}`,
      authorId: this.currentUser.id,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      attachments: attachments || []
    };

    ticket.replies.push(reply);
    ticket.updatedAt = new Date().toISOString();

    if (newStatus && newStatus !== ticket.status) {
      ticket.history.push({
        action: 'STATUS_CHANGE',
        from: ticket.status,
        to: newStatus,
        actorId: this.currentUser.id,
        timestamp: new Date().toISOString()
      });
      ticket.status = newStatus;
    }

    ticket.history.push({
      action: 'REPLY_ADDED',
      actorId: this.currentUser.id,
      timestamp: new Date().toISOString()
    });

    await this.persistCurrentData();
    this.emit('state_updated');
    return reply;
  }

  async deleteTicket(ticketId) {
    if (!this.hasPermission('delete_ticket')) {
      alert('شما دسترسی حذف تیکت را ندارید.');
      return false;
    }
    this.tickets = this.tickets.filter(t => t.id !== ticketId);
    if (this.activeTicketId === ticketId) {
      this.activeTicketId = null;
    }
    await this.persistCurrentData();
    this.emit('state_updated');
    return true;
  }

  // Role & User Operations
  async createRole({ name, description, permissions }) {
    const newRole = {
      id: 'role_' + Date.now(),
      name: name.trim(),
      description: description.trim(),
      isSystem: false,
      permissions: permissions || []
    };
    this.roles.push(newRole);
    await this.persistCurrentData();
    this.emit('state_updated');
    return newRole;
  }

  async updateUserRole(userId, newRoleId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    user.roleId = newRoleId;
    await this.persistCurrentData();
    this.emit('state_updated');
  }

  async addUser({ name, email, roleId, department }) {
    const initials = name.split(' ').map(p => p[0]).join('‌');
    const newUser = {
      id: 'u' + (this.users.length + 1),
      name: name.trim(),
      email: email.trim(),
      roleId: roleId || 'member',
      department: department || 'عمومی',
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=120&auto=format&fit=crop&q=80`,
      initials: initials || 'ک‌ج'
    };
    this.users.push(newUser);
    await this.persistCurrentData();
    this.emit('state_updated');
    return newUser;
  }

  // Notifications
  rebuildNotifications() {
    this.notifications = [];
    const now = new Date();

    this.tickets.forEach(ticket => {
      // Check overdue tickets assigned to current user
      if (ticket.assigneeId === this.currentUser.id && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        if (ticket.deadline && new Date(ticket.deadline) < now) {
          this.notifications.push({
            id: `notif-overdue-${ticket.id}`,
            ticketId: ticket.id,
            type: 'deadline_overdue',
            title: `مهلت انجام تیکت سپری شد!`,
            message: `تیکت "${ticket.title}" به زمان اتمام مهلت رسیده است.`,
            createdAt: ticket.deadline,
            read: false
          });
        }
      }
    });

    this.unreadCount = this.notifications.filter(n => !n.read).length;
  }

  markAllNotificationsRead() {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
    this.emit('notifications_updated');
  }

  markNotificationRead(notifId) {
    const n = this.notifications.find(item => item.id === notifId);
    if (n) {
      n.read = true;
      this.unreadCount = this.notifications.filter(item => !item.read).length;
      this.emit('notifications_updated');
    }
  }

  getStatusLabel(status) {
    switch (status) {
      case 'open': return 'باز';
      case 'in_progress': return 'در حال بررسی';
      case 'waiting': return 'در انتظار پاسخ';
      case 'resolved': return 'حل شده';
      case 'closed': return 'بسته شده';
      default: return status;
    }
  }

  getPriorityLabel(priority) {
    switch (priority) {
      case 'urgent': return 'فوری';
      case 'high': return 'بالا';
      case 'normal': return 'عادی';
      case 'low': return 'کم';
      default: return priority;
    }
  }
}

export const state = new StateManager();
