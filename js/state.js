// Central State Management with Event Bus & Server API Sync

import { LocalStorageProvider } from './storage/local.js';
import { ServerStorageProvider } from './storage/server.js';

export const DEFAULT_ROLES = [
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

export const INITIAL_USERS = [
  {
    id: 'u_manager_1',
    name: 'مدیر سامانه تیکتینگ',
    email: 'manager@company.com',
    roleId: 'admin',
    department: 'مدیریت و فناوری',
    avatar: './icons/company_logo.png',
    initials: 'م‌س'
  }
];

export const INITIAL_TICKETS = [];

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
    this.isProfileModalOpen = false;
    this.isLoginModalOpen = false;

    // Server Provider & Local Fallback
    this.serverConnected = false;
    this.localProvider = new LocalStorageProvider((data, sourceId) => this.handleRemoteData(data, sourceId));
    this.serverProvider = new ServerStorageProvider(
      (data, sourceId) => this.handleRemoteData(data, sourceId),
      (isConnected) => {
        this.serverConnected = isConnected;
        this.emit('server_connection_change', isConnected);
      }
    );

    this.init();
  }

  async init() {
    // 1. Try to load cached data from LocalStorage
    const saved = this.localProvider.load();
    if (saved && saved.tickets && saved.users && saved.roles) {
      this.tickets = saved.tickets;
      this.users = saved.users;
      this.roles = saved.roles;
    } else {
      this.persistLocal();
    }

    const savedUserId = localStorage.getItem('current_user_id');
    this.currentUser = (savedUserId && this.users.find(u => u.id === savedUserId)) || this.users[0] || INITIAL_USERS[0];

    // 2. If authenticated with server, fetch latest profile and live data
    if (this.serverProvider.isLoggedIn()) {
      try {
        const profile = await this.serverProvider.getProfile();
        if (profile) {
          this.currentUser = profile;
          localStorage.setItem('current_user_id', profile.id);
        }
        const freshData = await this.serverProvider.load();
        if (freshData) {
          this.handleRemoteData(freshData, 'server_init');
        }
      } catch (err) {
        console.warn('Initial server sync notice:', err);
      }
    } else {
      // Prompt user to log in if not logged in
      setTimeout(() => {
        if (!this.serverProvider.isLoggedIn()) {
          this.emit('open_login_modal');
        }
      }, 300);
    }

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

  // Handle incoming remote updates (WebSocket or polling)
  handleRemoteData(incoming, source) {
    if (!incoming || !incoming.tickets) return;

    const previousTicketsMap = new Map(this.tickets.map(t => [t.id, t]));
    const newNotifications = [];

    incoming.tickets.forEach(newTicket => {
      const oldTicket = previousTicketsMap.get(newTicket.id);

      // Condition 1: Brand new ticket created targeting current user
      if (!oldTicket) {
        if (this.currentUser && newTicket.assigneeId === this.currentUser.id && newTicket.creatorId !== this.currentUser.id) {
          newNotifications.push({
            id: 'notif-' + Date.now() + Math.random(),
            ticketId: newTicket.id,
            type: 'assigned',
            title: `تیکت جدید برای شما: ${newTicket.title}`,
            message: `توسط ${this.getUserName(newTicket.creatorId)} ارجاع داده شد.`,
            createdAt: new Date().toISOString(),
            read: false
          });
        } else if (this.currentUser && newTicket.taggedUserIds?.includes(this.currentUser.id) && newTicket.creatorId !== this.currentUser.id) {
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
        // Condition 2: Existing ticket updated with new replies
        const oldReplyCount = oldTicket.replies?.length || 0;
        const newReplyCount = newTicket.replies?.length || 0;
        if (newReplyCount > oldReplyCount) {
          const latestReply = newTicket.replies[newReplyCount - 1];
          if (this.currentUser && latestReply.authorId !== this.currentUser.id) {
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
          const isRelevant = this.currentUser && (newTicket.assigneeId === this.currentUser.id || newTicket.creatorId === this.currentUser.id);
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

    this.persistLocal();
    this.emit('state_updated');
  }

  // --- Auth Methods ---
  async loginWithServer(email, password) {
    const user = await this.serverProvider.login(email, password);
    this.currentUser = user;
    localStorage.setItem('current_user_id', user.id);

    const fresh = await this.serverProvider.load();
    if (fresh) {
      this.handleRemoteData(fresh, 'login');
    }

    this.rebuildNotifications();
    this.emit('user_changed', user);
    this.emit('state_updated');
    return user;
  }

  logout() {
    this.serverProvider.logout();
    this.currentUser = null;
    localStorage.removeItem('current_user_id');
    this.emit('user_changed', null);
    this.emit('open_login_modal');
  }

  // Factory Reset
  async factoryReset() {
    this.logout();
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {
        console.warn('Cache purge on reset:', e);
      }
    }
    window.location.href = window.location.origin + window.location.pathname;
  }

  getCurrentUserRole() {
    if (!this.currentUser) return this.roles[0] || DEFAULT_ROLES[0];
    return this.roles.find(r => r.id === this.currentUser.roleId) || this.roles[0] || DEFAULT_ROLES[0];
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

  // --- Ticket Operations ---
  async createTicket({ title, description, assigneeId, taggedUserIds, priority, department, deadline, attachments = [] }) {
    let newTicket;
    if (this.serverProvider.isLoggedIn()) {
      newTicket = await this.serverProvider.createTicket({
        title,
        description,
        assigneeId,
        taggedUserIds,
        priority,
        department,
        deadline,
        attachments
      });
    } else {
      const nextNum = this.tickets.length + 101;
      newTicket = {
        id: `TCK-${nextNum}`,
        title: title.trim(),
        description: description.trim(),
        creatorId: this.currentUser?.id || 'u_manager_1',
        assigneeId,
        taggedUserIds: taggedUserIds || [],
        priority: priority || 'normal',
        status: 'open',
        department: department || 'عمومی',
        deadline: deadline || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: attachments,
        replies: [],
        history: [{ action: 'CREATED', actorId: this.currentUser?.id || 'u_manager_1', timestamp: new Date().toISOString() }]
      };
    }

    const exists = this.tickets.some(t => t.id === newTicket.id);
    if (!exists) {
      this.tickets.unshift(newTicket);
    }
    this.persistLocal();
    this.emit('state_updated');
    return newTicket;
  }

  async updateTicketStatus(ticketId, newStatus) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    if (this.serverProvider.isLoggedIn()) {
      await this.serverProvider.updateTicket(ticketId, { status: newStatus });
    }

    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();
    ticket.history.push({
      action: 'STATUS_CHANGE',
      from: ticket.status,
      to: newStatus,
      actorId: this.currentUser?.id || 'u_manager_1',
      timestamp: new Date().toISOString()
    });

    this.persistLocal();
    this.rebuildNotifications();
    this.emit('state_updated');
  }

  async addReply(ticketId, content, attachments = []) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    let reply;
    if (this.serverProvider.isLoggedIn()) {
      reply = await this.serverProvider.addReply(ticketId, { content, attachments });
    } else {
      reply = {
        id: `rep-${Date.now()}`,
        authorId: this.currentUser?.id || 'u_manager_1',
        content: content.trim(),
        attachments: attachments,
        createdAt: new Date().toISOString()
      };
    }

    if (!ticket.replies.some(r => r.id === reply.id)) {
      ticket.replies.push(reply);
    }
    ticket.updatedAt = new Date().toISOString();

    this.persistLocal();
    this.emit('state_updated');
    return reply;
  }

  async deleteTicket(ticketId) {
    if (this.serverProvider.isLoggedIn()) {
      await this.serverProvider.deleteTicket(ticketId);
    }
    this.tickets = this.tickets.filter(t => t.id !== ticketId);
    this.persistLocal();
    this.emit('state_updated');
  }

  async clearAllTickets() {
    this.tickets = [];
    this.notifications = [];
    this.unreadCount = 0;
    this.activeTicketId = null;
    this.persistLocal();
    this.emit('state_updated');
  }

  // --- Roles & Users Helpers ---
  async createRole({ name, description, permissions }) {
    const id = 'role_' + Date.now();
    const newRole = {
      id,
      name: name.trim(),
      description: description.trim(),
      isSystem: false,
      permissions: permissions || ['create_ticket']
    };
    this.roles.push(newRole);
    this.persistLocal();
    this.emit('state_updated');
    return newRole;
  }

  async deleteRole(roleId) {
    const role = this.roles.find(r => r.id === roleId);
    if (!role) throw new Error('نقش مورد نظر یافت نشد.');
    if (role.isSystem || role.id === 'admin') {
      throw new Error('امکان حذف نقش‌های سیستمی پیش‌فرض وجود ندارد.');
    }
    this.users.forEach(u => {
      if (u.roleId === roleId) u.roleId = 'member';
    });
    this.roles = this.roles.filter(r => r.id !== roleId);
    this.persistLocal();
    this.emit('state_updated');
    return true;
  }

  async addUser({ name, email, department, roleId }) {
    const initials = name.split(' ').map(p => p[0]).join('‌');
    const newUser = {
      id: 'u_' + Date.now(),
      name: name.trim(),
      email: email.trim(),
      roleId: roleId || 'member',
      department: department || 'عمومی',
      avatar: './icons/company_logo.png',
      initials: initials || 'ک‌ج'
    };
    this.users.push(newUser);
    this.persistLocal();
    this.emit('state_updated');
    return newUser;
  }

  async deleteUser(userId) {
    if (this.users.length <= 1) {
      throw new Error('حداقل یک کاربر در سامانه باید وجود داشته باشد.');
    }
    this.users = this.users.filter(u => u.id !== userId);
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = this.users[0];
    }
    this.persistLocal();
    this.emit('state_updated');
    return true;
  }

  async updateUserRole(userId, newRoleId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    user.roleId = newRoleId;
    this.persistLocal();
    this.emit('state_updated');
  }

  // --- Notifications Helper ---
  rebuildNotifications() {
    this.notifications = [];
    if (!this.currentUser) return;
    const now = new Date();

    this.tickets.forEach(ticket => {
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
      case 'in_progress': return 'در حال اقدام';
      case 'waiting': return 'در انتظار';
      case 'resolved': return 'حل شده';
      case 'closed': return 'بسته شده';
      default: return status;
    }
  }

  getPriorityLabel(priority) {
    switch (priority) {
      case 'urgent': return 'فوری و اضطراری';
      case 'high': return 'بالا';
      case 'normal': return 'عادی';
      case 'low': return 'پایین';
      default: return priority;
    }
  }
}

export const state = new StateManager();
