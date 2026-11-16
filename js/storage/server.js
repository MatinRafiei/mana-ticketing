// Server Storage & Real-Time WebSocket Provider for Mana Ticketing

export class ServerStorageProvider {
  constructor(onRemoteUpdate, onConnectionChange) {
    this.onRemoteUpdate = onRemoteUpdate || (() => {});
    this.onConnectionChange = onConnectionChange || (() => {});
    this.token = localStorage.getItem('mana_user_token') || '';
    this.ws = null;
    this.isConnected = false;
    this.apiBase = window.location.origin;

    if (this.token) {
      this.connectWebSocket();
    }
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.token ? `Bearer ${this.token}` : ''
    };
  }

  isLoggedIn() {
    return Boolean(this.token);
  }

  // --- WebSocket Live Stream (<50ms) ---
  connectWebSocket() {
    if (!this.token) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleSocketEvent(payload);
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onConnectionChange(false);
        // Auto-reconnect after 3 seconds
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.onConnectionChange(false);
      };
    } catch (err) {
      console.warn('WS connection setup error:', err);
    }
  }

  handleSocketEvent(event) {
    // When any ticket or user update happens on the server, trigger fresh sync
    this.load().then(freshData => {
      if (freshData) {
        this.onRemoteUpdate(freshData, 'server_ws');
      }
    });
  }

  // --- Auth API ---
  async login(email, password) {
    const res = await fetch(`${this.apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در ورود به سامانه');
    }

    this.token = data.token;
    localStorage.setItem('mana_user_token', this.token);
    this.connectWebSocket();
    this.subscribePushNotification().catch(e => console.warn('Push registration notice:', e));
    return data.user;
  }

  logout() {
    this.token = '';
    localStorage.removeItem('mana_user_token');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async getProfile() {
    if (!this.token) return null;
    const res = await fetch(`${this.apiBase}/api/auth/me`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.logout();
      }
      return null;
    }
    return res.json();
  }

  async updateProfile(updates) {
    const res = await fetch(`${this.apiBase}/api/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در ذخیره پروفایل');
    }
    return data;
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`${this.apiBase}/api/upload/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در آپلود عکس');
    }
    return data.url;
  }

  // --- Data Load & Sync ---
  async load() {
    if (!this.token) return null;
    try {
      const res = await fetch(`${this.apiBase}/api/sync`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Server sync error:', e);
    }
    return null;
  }

  // --- Ticket CRUD ---
  async createTicket(ticketData) {
    const res = await fetch(`${this.apiBase}/api/tickets`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(ticketData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در ثبت تیکت');
    return data;
  }

  async updateTicket(ticketId, updates) {
    const res = await fetch(`${this.apiBase}/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در بروزرسانی تیکت');
    return data;
  }

  async addReply(ticketId, replyData) {
    const res = await fetch(`${this.apiBase}/api/tickets/${ticketId}/replies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(replyData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در ثبت پاسخ');
    return data;
  }

  async deleteTicket(ticketId) {
    const res = await fetch(`${this.apiBase}/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'خطا در حذف تیکت');
    }
    return true;
  }

  // --- Web-Push Browser Registration ---
  async subscribePushNotification() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Web-Push not supported on this browser.');
      return false;
    }

    try {
      const keyRes = await fetch(`${this.apiBase}/api/push/public-key`);
      const { publicKey } = await keyRes.json();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const convertedKey = this.urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      // Send subscription to server
      await fetch(`${this.apiBase}/api/push/subscribe`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ subscription: sub })
      });

      console.log('Device push subscription registered successfully.');
      return true;
    } catch (err) {
      console.warn('Web-Push subscribe error:', err);
      return false;
    }
  }

  async testPushNotification() {
    const res = await fetch(`${this.apiBase}/api/push/test`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
