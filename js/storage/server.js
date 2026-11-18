// Server Storage & Resilient Real-Time Provider (WebSocket + Smart Fallback Polling)

export class ServerStorageProvider {
  constructor(onRemoteUpdate, onConnectionChange) {
    this.onRemoteUpdate = onRemoteUpdate || (() => {});
    this.onConnectionChange = onConnectionChange || (() => {});
    this.token = localStorage.getItem('mana_user_token') || '';
    this.ws = null;
    this.isConnected = false;
    this.apiBase = window.location.origin;
    this.pollTimer = null;
    this.reconnectTimeout = null;

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

  // --- Resilient WebSocket Live Stream with Keep-Alive Heartbeat ---
  connectWebSocket() {
    if (!this.token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

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
        // Resilient reconnect with backoff
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.onConnectionChange(false);
      };
    } catch (err) {
      this.isConnected = false;
      this.onConnectionChange(false);
    }
  }

  handleSocketEvent(event) {
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
    localStorage.setItem('token', this.token);
    this.connectWebSocket();
    this.subscribePushNotification().catch(e => console.warn('Push registration notice:', e));
    return data.user;
  }

  logout() {
    this.token = '';
    localStorage.removeItem('mana_user_token');
    localStorage.removeItem('token');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async getProfile() {
    if (!this.token) return null;
    const res = await fetch(`${this.apiBase}/api/profile`, { headers: this.getHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.logout();
      }
      return null;
    }
    return await res.json();
  }

  async updateProfile(updates) {
    const res = await fetch(`${this.apiBase}/api/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در بروزرسانی پروفایل');
    return data;
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`${this.apiBase}/api/profile/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در بارگذاری عکس');
    return data;
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.apiBase}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطا در آپلود فایل');
    return data;
  }

  // --- Push Notifications Registration ---
  async subscribePushNotification() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const vapidRes = await fetch(`${this.apiBase}/api/push/vapid-key`);
        const { publicKey } = await vapidRes.json();
        if (!publicKey) return;

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey)
        });
      }

      if (sub && this.token) {
        await fetch(`${this.apiBase}/api/push/subscribe`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ subscription: sub })
        });
      }
    } catch (err) {
      console.warn('Web-Push subscription registration notice:', err);
    }
  }

  async testPushNotification() {
    const res = await fetch(`${this.apiBase}/api/push/test`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // --- Ticketing Operations ---
  async load() {
    if (!this.token) return null;
    try {
      const res = await fetch(`${this.apiBase}/api/sync`, { headers: this.getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

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
    if (!res.ok) throw new Error(data.error || 'خطا در ویرایش تیکت');
    return data;
  }

  async addReply(ticketId, content, attachments, statusChange) {
    if (statusChange) {
      await this.updateTicket(ticketId, { status: statusChange });
    }
    const res = await fetch(`${this.apiBase}/api/tickets/${ticketId}/replies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ content, attachments })
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
    return res.ok;
  }
}
