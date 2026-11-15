// Local storage provider with BroadcastChannel for instant cross-tab syncing

const DB_KEY = 'mana_ticketing_store';
const CHANNEL_NAME = 'mana_ticketing_broadcast';

export class LocalStorageProvider {
  constructor(onRemoteUpdate) {
    this.onRemoteUpdate = onRemoteUpdate;
    this.channel = null;
    this.initChannel();
  }

  initChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_UPDATED') {
          if (typeof this.onRemoteUpdate === 'function') {
            this.onRemoteUpdate(event.data.payload, event.data.sourceUserId);
          }
        }
      };
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Failed to load local storage:', e);
      return null;
    }
  }

  save(data, sourceUserId = null) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
      if (this.channel) {
        this.channel.postMessage({
          type: 'DATA_UPDATED',
          payload: data,
          sourceUserId: sourceUserId,
          timestamp: Date.now()
        });
      }
      return true;
    } catch (e) {
      console.error('Failed to save to local storage:', e);
      return false;
    }
  }
}
