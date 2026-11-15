// Notification Engine: Audio, Native Web Push & In-App Alerts

import { sound } from './utils/audio.js';
import { state } from './state.js';
import { renderIcon } from './icons.js';
import { formatRelative } from './utils/jalali.js';

class NotificationEngine {
  constructor() {
    this.toastContainer = null;
    this.hasRequestedPermission = false;
  }

  init() {
    this.createToastContainer();
    this.checkPermission();

    // Listen for instant notifications from State
    state.subscribe((eventType, payload) => {
      if (eventType === 'instant_notification') {
        if (Array.isArray(payload)) {
          payload.forEach(notif => this.triggerAlert(notif));
        } else if (payload) {
          this.triggerAlert(payload);
        }
      }
    });
  }

  checkPermission() {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  async requestPermission() {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          this.triggerToast({
            title: 'اعلان‌های مرورگر فعال شد',
            message: 'اکنون تیکت‌ها و ارجاعات جدید بلافاصله به شما اطلاع داده می‌شود.',
            type: 'success'
          });
          sound.playNotification();
        }
        return perm;
      } catch (e) {
        console.warn('Notification permission error:', e);
      }
    }
    return 'unsupported';
  }

  createToastContainer() {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 left-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none';
    document.body.appendChild(container);
    this.toastContainer = container;
  }

  // Trigger sound, native notification, and in-app toast
  triggerAlert(notif) {
    // 1. Play sound chime
    if (notif.type === 'deadline_overdue') {
      sound.playUrgent();
    } else {
      sound.playNotification();
    }

    // 2. Show native browser notification
    this.showNativeNotification(notif);

    // 3. Show animated on-screen toast
    this.triggerToast(notif);
  }

  showNativeNotification(notif) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const nativeNotif = new Notification(notif.title, {
          body: notif.message,
          icon: './icons/icon.svg',
          dir: 'rtl',
          lang: 'fa',
          tag: notif.ticketId || 'ticketing-alert',
          badge: './icons/icon.svg'
        });

        nativeNotif.onclick = () => {
          window.focus();
          nativeNotif.close();
          if (notif.ticketId) {
            state.activeTicketId = notif.ticketId;
            state.emit('open_ticket_detail', notif.ticketId);
          }
        };
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  }

  triggerToast(notif) {
    if (!this.toastContainer) this.createToastContainer();

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-white dark:bg-slate-800 border-2 border-blue-500/30 dark:border-blue-500/50 rounded-2xl p-4 shadow-2xl flex items-start gap-3 transform translate-y-6 opacity-0 transition-all duration-300 ease-out';

    let iconHtml = renderIcon('bellRing', 'w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0');
    if (notif.type === 'deadline_overdue') {
      iconHtml = renderIcon('alertTriangle', 'w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0');
      toast.classList.add('border-rose-500/50');
    }

    toast.innerHTML = `
      <div class="mt-0.5">${iconHtml}</div>
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-sm text-slate-900 dark:text-white truncate">${notif.title}</h4>
        <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">${notif.message}</p>
        ${notif.ticketId ? `
          <button class="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 view-ticket-btn">
            مشاهده تیکت ${renderIcon('chevronLeft', 'w-3 h-3')}
          </button>
        ` : ''}
      </div>
      <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 close-toast-btn">
        ${renderIcon('x', 'w-4 h-4')}
      </button>
    `;

    // Events
    toast.querySelector('.close-toast-btn')?.addEventListener('click', () => {
      this.dismissToast(toast);
    });

    toast.querySelector('.view-ticket-btn')?.addEventListener('click', () => {
      if (notif.ticketId) {
        state.activeTicketId = notif.ticketId;
        state.emit('open_ticket_detail', notif.ticketId);
        this.dismissToast(toast);
      }
    });

    this.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-6', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      this.dismissToast(toast);
    }, 6000);
  }

  dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }
}

export const notificationEngine = new NotificationEngine();
