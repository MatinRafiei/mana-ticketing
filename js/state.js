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
    id: 'admin_initial',
    name: 'مدیر سامانه',
    email: '',
    roleId: 'admin',
    department: 'مدیریت و راهبری',
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
    const savedUserId = localStorage.getItem('current_user_id');
    this.currentUser = (savedUserId && this.users.find(u => u.id === savedUserId)) || this.users[0] || INITIAL_USERS[0];

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
      // Check if an admin with a valid email already exists
      const hasRealAdmin = this.users.some(u => u.roleId === 'admin' && u.email && u.id !== 'admin_initial');
      const initials = (gUser.name || 'کاربر').split(' ').map(p => p[0]).join('‌');
      matchedUser = {
        id: 'u_g_' + (gUser.sub || Date.now()),
        name: gUser.name || email.split('@')[0],
        email: email,
        roleId: hasRealAdmin ? 'member' : 'admin',
        department: hasRealAdmin ? 'پرسنل' : 'مدیریت و راهبری',
        avatar: gUser.picture || './icons/company_logo.png',
        initials: initials || 'گ‌ک'
      };
      // Remove placeholder admin_initial if present
      this.users = this.users.filter(u => u.id !== 'admin_initial');
      this.users.unshift(matchedUser);
      this.persistLocal();
      if (this.storageMode === 'gdrive' && this.gdriveProvider.isConnected()) {
        this.persistCurrentData();
      }
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

  // Clear all tickets (wiping tickets to start fresh)
  async clearAllTickets() {
    this.tickets = [];
    this.notifications = [];
    this.unreadCount = 0;
    this.activeTicketId = null;
    await this.persistCurrentData();
    this.emit('state_updated');
  }

  // Factory Reset: Completely wipes local storage, sessions, service worker caches, and reloads
  async factoryReset() {
    try {
      this.gdriveProvider.signOut();
    } catch (e) {
      console.warn('Sign-out on reset:', e);
    }
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

  async deleteRole(roleId) {
    if (roleId === 'admin') {
      throw new Error('نقش مدیر ارشد سیستم غیرقابل حذف است.');
    }
    const roleToDelete = this.roles.find(r => r.id === roleId);
    if (!roleToDelete) return false;

    // Fallback role for any users that had this role
    const fallbackRoleId = this.roles.find(r => r.id !== roleId)?.id || 'admin';
    this.users.forEach(u => {
      if (u.roleId === roleId) {
        u.roleId = fallbackRoleId;
      }
    });

    this.roles = this.roles.filter(r => r.id !== roleId);
    await this.persistCurrentData();
    this.emit('state_updated');
    return true;
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
      id: 'u_' + Date.now(),
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

  async deleteUser(userId) {
    if (this.users.length <= 1) {
      throw new Error('حداقل یک کاربر در سامانه باید وجود داشته باشد.');
    }
    this.users = this.users.filter(u => u.id !== userId);
    // If active user was deleted, switch to the first remaining user
    if (this.currentUser.id === userId) {
      this.currentUser = this.users[0];
    }
    await this.persistCurrentData();
    this.emit('state_updated');
    return true;
  }

  async clearDemoUsers() {
    const googleUser = this.gdrive.getGoogleUser();
    let keepUser = null;
    if (googleUser && googleUser.email) {
      keepUser = this.users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase());
    }
    if (!keepUser) {
      keepUser = this.currentUser || this.users[0];
    }
    // Make sure keepUser has admin role
    keepUser.roleId = 'admin';
    this.users = [keepUser];
    this.currentUser = keepUser;
    await this.persistCurrentData();
    this.emit('state_updated');
    return true;
  }

  // Notifications
  rebuildNotifications() {
    this.notifications = [];
    if (!this.currentUser) return;
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
