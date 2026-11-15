// Google Drive API v3 Client with Polling Sync & Direct Attachment Upload

export class GoogleDriveProvider {
  constructor({ onRemoteUpdate, onStatusChange }) {
    this.onRemoteUpdate = onRemoteUpdate;
    this.onStatusChange = onStatusChange;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.fileId = null;
    this.folderId = null;
    this.lastModifiedTime = null;
    this.pollingTimer = null;
    this.pollIntervalMs = 12000; // 12 seconds default (within the 10-15s requirement)
    this.isPolling = false;

    // Load saved settings
    this.clientId = localStorage.getItem('gdrive_client_id') || '';
    this.apiKey = localStorage.getItem('gdrive_api_key') || '';
    this.fileId = localStorage.getItem('gdrive_file_id') || null;
    this.folderId = localStorage.getItem('gdrive_folder_id') || null;
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

  // Initialize Google Identity Services
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
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              this.notifyStatus('error', 'خطا در احراز هویت گوگل: ' + tokenResponse.error);
              reject(new Error(tokenResponse.error));
              return;
            }
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiresAt = Date.now() + (Number(tokenResponse.expires_in) * 1000);
            this.notifyStatus('connected', 'متصل به گوگل درایو');
            this.startPolling();
            resolve(this.accessToken);
          }
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async signIn() {
    if (!this.tokenClient) {
      await this.initGis();
    }
    return new Promise((resolve) => {
      // Prompt user for OAuth consent
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
      const checkToken = setInterval(() => {
        if (this.isConnected()) {
          clearInterval(checkToken);
          resolve(this.accessToken);
        }
      }, 500);
    });
  }

  notifyStatus(status, message) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({ status, message, lastSync: new Date().toISOString() });
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

  // Fetch or create the shared database file in Google Drive
  async getOrCreateDataFile() {
    if (this.fileId) {
      // Check if file still exists
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?fields=id,name,modifiedTime`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        if (res.ok) {
          const info = await res.json();
          this.lastModifiedTime = info.modifiedTime;
          return this.fileId;
        }
      } catch (e) {
        console.warn('Existing file check failed, creating or finding new file', e);
      }
    }

    // Search for existing file named mana_ticketing_data.json
    const q = "name = 'mana_ticketing_data.json' and trashed = false";
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, {
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

    // Create a new data file in Google Drive
    const metadata = {
      name: 'mana_ticketing_data.json',
      mimeType: 'application/json',
      description: 'Mana Persian In-Company Ticketing App Storage'
    };

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
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
    return this.fileId;
  }

  // Download tickets state from Google Drive
  async load() {
    if (!this.isConnected()) return null;
    try {
      const fileId = await this.getOrCreateDataFile();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const text = await res.text();
        if (!text || text.trim() === '') return null;
        return JSON.parse(text);
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

      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
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

    // Construct multipart body
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

    // Make viewable by anyone with link or team
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
        const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?fields=modifiedTime,version`, {
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
