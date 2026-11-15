// Google Drive API v3 Client with Persistent Session, Silent Refresh & Auto-Sync

export class GoogleDriveProvider {
  constructor({ onRemoteUpdate, onStatusChange }) {
    this.onRemoteUpdate = onRemoteUpdate;
    this.onStatusChange = onStatusChange;
    this.tokenClient = null;
    this.accessToken = localStorage.getItem('gdrive_access_token') || null;
    this.tokenExpiresAt = Number(localStorage.getItem('gdrive_token_expires_at')) || 0;
    this.fileId = localStorage.getItem('gdrive_file_id') || null;
    this.folderId = localStorage.getItem('gdrive_folder_id') || null;
    this.lastModifiedTime = null;
    this.pollingTimer = null;
    this.pollIntervalMs = (Number(localStorage.getItem('gdrive_poll_interval')) || 12) * 1000;
    this.isPolling = false;

    // Load saved client settings
    this.clientId = localStorage.getItem('gdrive_client_id') || '';
    this.apiKey = localStorage.getItem('gdrive_api_key') || '';

    // Load saved Google User Profile
    this.googleUser = null;
    try {
      const savedUser = localStorage.getItem('gdrive_google_user');
      if (savedUser) this.googleUser = JSON.parse(savedUser);
    } catch (e) {}
  }

  isConfigured() {
    return Boolean(this.clientId);
  }

  isConnected() {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  saveConfig(clientId, apiKey, pollIntervalSec = 12) {
    this.clientId = (clientId || '').trim();
    this.apiKey = (apiKey || '').trim();
    this.pollIntervalMs = Math.max(5, Number(pollIntervalSec) || 12) * 1000;

    localStorage.setItem('gdrive_client_id', this.clientId);
    localStorage.setItem('gdrive_api_key', this.apiKey);
    localStorage.setItem('gdrive_poll_interval', String(pollIntervalSec));
  }

  // Initialize Google Identity Services Client
  async initGis() {
    if (!window.google?.accounts?.oauth2) {
      await this.loadScript('https://accounts.google.com/gsi/client');
    }

    if (!this.clientId) {
      throw new Error('لطفاً ابتدا Client ID گوگل را در تنظیمات وارد نمایید.');
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.warn('Google Auth callback error:', tokenResponse.error);
              this.notifyStatus('error', 'خطا در احراز هویت: ' + tokenResponse.error);
              return;
            }

            // Persist token in localStorage
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiresAt = Date.now() + (Number(tokenResponse.expires_in) * 1000);
            localStorage.setItem('gdrive_access_token', this.accessToken);
            localStorage.setItem('gdrive_token_expires_at', String(this.tokenExpiresAt));

            // Fetch user profile and save
            await this.fetchUserProfile();

            this.notifyStatus('connected', 'متصل به گوگل درایو');
            this.startPolling();
          }
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Interactive Sign In with Consent Dialog
  async signIn() {
    if (!this.tokenClient) {
      await this.initGis();
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
        const checkToken = setInterval(() => {
          if (this.isConnected()) {
            clearInterval(checkToken);
            resolve(this.accessToken);
          }
        }, 500);

        // Timeout after 60s
        setTimeout(() => {
          clearInterval(checkToken);
          if (!this.isConnected()) {
            reject(new Error('زمان ورود به حساب گوگل به پایان رسید یا پنجره بسته شد.'));
          }
        }, 60000);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Silent Background Token Refresh (without prompt)
  async refreshTokenSilently() {
    if (!this.tokenClient) {
      await this.initGis();
    }
    try {
      this.tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      console.warn('Silent refresh error:', e);
    }
  }

  // Fetch logged-in Google profile
  async fetchUserProfile() {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        this.googleUser = await res.json();
        localStorage.setItem('gdrive_google_user', JSON.stringify(this.googleUser));
        return this.googleUser;
      }
    } catch (err) {
      console.warn('Could not fetch Google profile:', err);
    }
    return null;
  }

  // Automatic Session Restoration on Page Reload / Startup
  async autoRestoreSession() {
    if (!this.isConfigured()) return false;

    try {
      await this.initGis();

      if (this.isConnected()) {
        // Token is still valid!
        console.log('Restored valid Google Drive session from localStorage.');
        this.notifyStatus('connected', 'متصل به گوگل درایو');
        this.startPolling();

        // Check if token will expire in less than 5 minutes -> refresh silently
        if (Date.now() > this.tokenExpiresAt - 300000) {
          this.refreshTokenSilently();
        }
        return true;
      } else if (this.accessToken) {
        // Token expired, attempt silent background refresh
        console.log('Google token expired, attempting silent refresh...');
        await this.refreshTokenSilently();
        return this.isConnected();
      }
    } catch (err) {
      console.warn('Failed to restore Google session:', err);
    }
    return false;
  }

  // Sign out cleanly
  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (e) {}
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.googleUser = null;
    this.stopPolling();
    localStorage.removeItem('gdrive_access_token');
    localStorage.removeItem('gdrive_token_expires_at');
    localStorage.removeItem('gdrive_google_user');
    this.notifyStatus('idle', 'قطع ارتباط');
  }

  notifyStatus(status, message) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({
        status,
        message,
        googleUser: this.googleUser,
        lastSync: new Date().toISOString()
      });
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Update or switch target database file ID
  setFileId(id) {
    this.fileId = (id || '').trim();
    if (this.fileId) {
      localStorage.setItem('gdrive_file_id', this.fileId);
    } else {
      localStorage.removeItem('gdrive_file_id');
    }
  }

  // Generate shareable invite link with Client ID and Database File ID
  getInviteLink() {
    const origin = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (this.fileId) params.set('db', this.fileId);
    if (this.clientId) params.set('client_id', this.clientId);
    return `${origin}?${params.toString()}`;
  }

  // Share database file directly with a colleague's Google email
  async shareFileWithUser(email, role = 'writer') {
    if (!this.fileId || !this.accessToken || !email) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: role,
          type: 'user',
          emailAddress: email.trim().toLowerCase()
        })
      });
      if (res.ok) {
        console.log(`Shared database with ${email}`);
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error?.message?.includes('already has access')) return true;
        console.warn(`Could not share with ${email}:`, err);
        return false;
      }
    } catch (e) {
      console.warn('Share file error:', e);
      return false;
    }
  }

  // Ensure file is shared with link
  async makeFileShared(targetFileId = this.fileId) {
    if (!targetFileId || !this.accessToken) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${targetFileId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'anyone'
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('Could not set permissions on data file:', e);
      return false;
    }
  }

  // Fetch or create the shared database file in Google Drive
  async getOrCreateDataFile() {
    // 1. TOP PRIORITY: Search in 'sharedWithMe' first!
    // If an Admin has shared the company database file with this account, it MUST take priority over any local/empty files.
    try {
      const sharedQ = "name = 'mana_ticketing_data.json' and trashed = false and sharedWithMe = true";
      const sharedRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(sharedQ)}&fields=files(id,name,modifiedTime,owners)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (sharedRes.ok) {
        const data = await sharedRes.json();
        if (data.files && data.files.length > 0) {
          this.fileId = data.files[0].id;
          this.lastModifiedTime = data.files[0].modifiedTime;
          localStorage.setItem('gdrive_file_id', this.fileId);
          console.log('Successfully connected to Admin shared database file:', this.fileId);
          return this.fileId;
        }
      }
    } catch (sharedErr) {
      console.warn('Shared file query notice:', sharedErr);
    }

    // 2. If explicit fileId is already saved (e.g. from invite link or settings), verify it!
    if (this.fileId) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?fields=id,name,modifiedTime&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        if (res.ok) {
          const info = await res.json();
          this.lastModifiedTime = info.modifiedTime;
          return this.fileId;
        } else if (res.status === 401) {
          await this.refreshTokenSilently();
        }
      } catch (e) {
        console.warn('Existing file check error, checking search...', e);
      }
    }

    // 3. Search for existing file named mana_ticketing_data.json in user's own Drive
    try {
      const ownQ = "name = 'mana_ticketing_data.json' and trashed = false";
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(ownQ)}&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          this.fileId = data.files[0].id;
          this.lastModifiedTime = data.files[0].modifiedTime;
          localStorage.setItem('gdrive_file_id', this.fileId);
          return this.fileId;
        }
      }
    } catch (ownErr) {
      console.warn('Own drive search warning:', ownErr);
    }

    // 4. Create new data file in Google Drive as root database
    const metadata = {
      name: 'mana_ticketing_data.json',
      mimeType: 'application/json',
      description: 'Mana Persian In-Company Ticketing App Storage'
    };

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!createRes.ok) {
      throw new Error('عدم امکان ایجاد فایل داده در گوگل درایو');
    }

    const created = await createRes.json();
    this.fileId = created.id;
    localStorage.setItem('gdrive_file_id', this.fileId);

    // Make newly created file shared so team members can access it
    await this.makeFileShared(this.fileId);

    return this.fileId;
  }

  // Download tickets state from Google Drive
  async load() {
    if (!this.isConnected()) return null;
    try {
      const fileId = await this.getOrCreateDataFile();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const text = await res.text();
        if (!text || text.trim() === '') return null;
        return JSON.parse(text);
      } else if (res.status === 401) {
        await this.refreshTokenSilently();
      } else {
        const errText = await res.text();
        console.warn('Google Drive load failed:', res.status, errText);
      }
      return null;
    } catch (e) {
      console.error('Google Drive load error:', e);
      return null;
    }
  }

  // Upload updated state to Google Drive
  async save(data) {
    if (!this.isConnected()) return false;
    try {
      const fileId = await this.getOrCreateDataFile();
      const jsonContent = JSON.stringify(data, null, 2);

      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonContent
      });

      if (res.ok) {
        const fileInfo = await res.json();
        this.lastModifiedTime = fileInfo.modifiedTime;
        this.notifyStatus('connected', 'همگام‌سازی با درایو موفق بود');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Google Drive save error:', e);
      this.notifyStatus('error', 'خطا در ذخیره‌سازی در گوگل درایو');
      return false;
    }
  }

  // Direct Attachment Upload to Google Drive
  async uploadAttachment(file) {
    if (!this.isConnected()) {
      throw new Error('برای آپلود در درایو، ابتدا باید به حساب گوگل وارد شوید.');
    }

    const metadata = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      description: 'پیوست تیکت در سامانه مانا'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();
    const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaPartHeader = `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    const enc = new TextEncoder();
    const p1 = enc.encode(delimiter + metaPart + mediaPartHeader);
    const p2 = new Uint8Array(fileBuffer);
    const p3 = enc.encode(closeDelimiter);

    const fullBody = new Uint8Array(p1.byteLength + p2.byteLength + p3.byteLength);
    fullBody.set(p1, 0);
    fullBody.set(p2, p1.byteLength);
    fullBody.set(p3, p1.byteLength + p2.byteLength);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,mimeType', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: fullBody
    });

    if (!uploadRes.ok) {
      throw new Error('خطا در آپلود فایل به گوگل درایو');
    }

    const uploaded = await uploadRes.json();

    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('Could not set public permission on attachment:', permErr);
    }

    return {
      id: uploaded.id,
      name: uploaded.name,
      size: Number(uploaded.size) || file.size,
      mimeType: uploaded.mimeType,
      url: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      downloadUrl: uploaded.webContentLink || `https://drive.google.com/uc?id=${uploaded.id}&export=download`,
      source: 'gdrive'
    };
  }

  // 10-15s Background Polling Engine
  startPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    this.pollingTimer = setInterval(async () => {
      if (!this.isConnected() || !this.fileId || this.isPolling) return;
      this.isPolling = true;

      try {
        const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?fields=modifiedTime,version&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });

        if (checkRes.ok) {
          const info = await checkRes.json();
          if (this.lastModifiedTime && info.modifiedTime !== this.lastModifiedTime) {
            console.log('Detected remote changes in Google Drive file!');
            this.lastModifiedTime = info.modifiedTime;
            const freshData = await this.load();
            if (freshData && typeof this.onRemoteUpdate === 'function') {
              this.onRemoteUpdate(freshData, 'gdrive');
            }
          }
          this.notifyStatus('connected', 'همگام (در حال پایش هر ' + (this.pollIntervalMs / 1000) + ' ثانیه)');
        } else if (checkRes.status === 401) {
          // Token expired, refresh
          await this.refreshTokenSilently();
        }
      } catch (err) {
        console.warn('Google Drive poll check failed:', err);
      } finally {
        this.isPolling = false;
      }
    }, this.pollIntervalMs);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}
