// Main Application Entry Point & Orchestrator

import { state } from './state.js';
import { notificationEngine } from './notifications.js';
import { NavbarComponent } from './components/navbar.js';
import { TicketListComponent } from './components/ticketList.js';
import { AdminTabComponent } from './components/adminTab.js';
import { TicketModalComponent } from './components/ticketModal.js';
import { TicketDetailComponent } from './components/ticketDetail.js';
import { ProfileModalComponent } from './components/profileModal.js';
import { LoginModalComponent } from './components/loginModal.js';

class App {
  constructor() {
    this.navbar = null;
    this.ticketList = null;
    this.adminTab = null;
    this.ticketModal = null;
    this.ticketDetail = null;
    this.profileModal = null;
    this.loginModal = null;
  }

  async init() {
    // 1. Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Initialize Notifications Engine
    notificationEngine.init();

    // 3. Register Service Worker for PWA & Web Push
    this.registerServiceWorker();

    // 4. Instantiate Components
    this.navbar = new NavbarComponent('navbar-container');
    this.ticketList = new TicketListComponent('ticket-list-container');
    this.adminTab = new AdminTabComponent('admin-tab-container');
    this.ticketModal = new TicketModalComponent('ticket-modal-container');
    this.ticketDetail = new TicketDetailComponent('ticket-detail-container');
    this.profileModal = new ProfileModalComponent('profile-modal-container');
    this.loginModal = new LoginModalComponent('login-modal-container');

    // 5. Initial Render
    this.navbar.render();
    this.renderCurrentView();

    // 6. Subscribe to State Events
    state.subscribe((eventType, payload) => {
      this.handleStateEvent(eventType, payload);
    });

    // 7. Check URL for ticket query param
    const urlParams = new URLSearchParams(window.location.search);
    const initialTicketId = urlParams.get('ticket');
    if (initialTicketId) {
      setTimeout(() => {
        this.ticketDetail.open(initialTicketId);
      }, 300);
    }

    console.log('Mana In-Company Ticketing System Ready (Linux Server Engine).');
  }

  handleStateEvent(eventType, payload) {
    switch (eventType) {
      case 'state_updated':
      case 'user_changed':
        this.navbar.render();
        // Prevent background polling from destroying active form inputs while user is typing
        const activeEl = document.activeElement;
        const isEditingInForm = activeEl && (activeEl.closest('#admin-tab-container') || activeEl.closest('#ticket-modal-container') || activeEl.closest('#profile-modal-container')) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
        if (!isEditingInForm) {
          this.renderCurrentView();
        }
        break;

      case 'view_changed':
        this.navbar.render();
        this.renderCurrentView();
        break;

      case 'open_ticket_modal':
        this.ticketModal.open();
        break;

      case 'open_ticket_detail':
        this.ticketDetail.open(payload || state.activeTicketId);
        break;

      case 'open_profile_modal':
        this.profileModal.open();
        break;

      case 'open_login_modal':
        this.loginModal.open();
        break;

      case 'notifications_updated':
      case 'server_connection_change':
        this.navbar.render();
        break;
    }
  }

  renderCurrentView() {
    const listEl = document.getElementById('ticket-list-container');
    const adminEl = document.getElementById('admin-tab-container');

    if (state.currentView === 'tickets') {
      if (listEl) listEl.style.display = 'block';
      if (adminEl) adminEl.style.display = 'none';
      this.ticketList.render();
    } else if (state.currentView === 'admin') {
      if (listEl) listEl.style.display = 'none';
      if (adminEl) adminEl.style.display = 'block';
      this.adminTab.render();
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('PWA ServiceWorker registered with scope:', reg.scope);
            // Listen for messages from SW (e.g. notification clicks)
            navigator.serviceWorker.addEventListener('message', (event) => {
              if (event.data?.type === 'OPEN_TICKET' && event.data?.ticketId) {
                state.activeTicketId = event.data.ticketId;
                state.emit('open_ticket_detail', event.data.ticketId);
              }
            });
          })
          .catch((err) => {
            console.warn('ServiceWorker registration skipped:', err);
          });
      });
    }

    // Capture PWA Install Prompt for Android Chrome & Desktop
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      window.deferredPWAInstallPrompt = e;

      // Show in-app install banner if not dismissed before
      if (!localStorage.getItem('pwa_prompt_dismissed')) {
        this.showInstallBanner(e);
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully.');
      deferredPrompt = null;
      window.deferredPWAInstallPrompt = null;
      document.getElementById('pwa-install-banner')?.remove();
    });
  }

  showInstallBanner(promptEvent) {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'fixed top-16 inset-x-3 sm:inset-x-auto sm:left-6 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-white/20 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md';

    banner.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="/icons/company_logo.png" class="w-9 h-9 rounded-xl bg-white p-0.5 object-contain shrink-0" />
        <div class="min-w-0">
          <h4 class="font-bold text-xs">نصب اپلیکیشن تیکتینگ</h4>
          <p class="text-[10px] text-blue-100 truncate">دسترسی سریع و تمام‌صفحه بدون مرورگر</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button id="btn-pwa-dismiss" class="text-white/70 hover:text-white px-2 py-1 text-xs">بعداً</button>
        <button id="btn-pwa-install" class="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-sm transition transform active:scale-95">نصب</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('btn-pwa-install')?.addEventListener('click', async () => {
      if (promptEvent) {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        console.log('PWA Install choice:', outcome);
        banner.remove();
      }
    });

    document.getElementById('btn-pwa-dismiss')?.addEventListener('click', () => {
      localStorage.setItem('pwa_prompt_dismissed', 'true');
      banner.remove();
    });
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
