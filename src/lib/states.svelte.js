import { setContext, getContext } from 'svelte';

const STATE_KEY = Symbol('CATERING_STATE');

export class CateringState {
  customers = $state([]);
  events = $state([]);
  menus = $state([]);
  ingredients = $state([]);
  suppliers = $state([]);
  staff = $state([]);
  demandForecasts = $state([]);
  toasts = $state([]);
  audioEnabled = $state(false);
  clickSound = null;
  stampSound = null;
  buzzerSound = null;
  activeEventForAnalysis = $state(null);
  anomalyReport = $state(null);
  usingMockData = $state(false);
  version = '1.2.9';
  isDataLoaded = $state(false);

  // Authentication & PWA variables
  _isAuthenticated = $state(false);
  _currentUser = $state(null);
  _registeredPIN = $state('1234'); // Default dummy PIN

  get isAuthenticated() {
    return this._isAuthenticated;
  }
  set isAuthenticated(value) {
    this._isAuthenticated = value;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('catersync_auth_state', value ? 'true' : 'false');
    }
  }

  get currentUser() {
    return this._currentUser;
  }
  set currentUser(value) {
    this._currentUser = value;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('catersync_current_user', value ? JSON.stringify(value) : '');
    }
  }

  get registeredPIN() {
    return this._registeredPIN;
  }
  set registeredPIN(value) {
    this._registeredPIN = value;
    if (typeof window !== 'undefined') {
      localStorage.setItem('catersync_registered_pin', value);
    }
  }

  biometricCredentialRegistered = $state(false);
  deferredPrompt = $state(null);
  pwaInstallable = $state(false);
  pushSubscriptionActive = $state(false);

  settings = $state({
    business_name: 'CaterSync',
    currency_symbol: '₱',
    overhead_rate: 0.12,
    min_budget_per_guest: 150.00,
    risk_medium_threshold: 0.35,
    risk_high_threshold: 0.60,
    low_stock_alerts_enabled: true,
    sound_enabled_default: false
  });

  // Web Audio Context
  audioCtx = null;

  constructor(data) {
    if (typeof window !== 'undefined') {
      this._isAuthenticated = sessionStorage.getItem('catersync_auth_state') === 'true';
      this._registeredPIN = localStorage.getItem('catersync_registered_pin') || '1234';
      const storedUser = sessionStorage.getItem('catersync_current_user');
      if (storedUser) {
        try {
          this._currentUser = JSON.parse(storedUser);
        } catch (e) {
          this._currentUser = null;
        }
      }
    }

    if (data) {
      this.customers = [...data.customers];
      this.events = [...data.events];
      this.menus = [...data.menus];
      this.ingredients = [...data.ingredients];
      this.suppliers = [...data.suppliers];
      this.staff = [...data.staff];
      this.demandForecasts = [...data.demandForecasts];
      this.usingMockData = data.usingMockData;
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }
    }
  }

  showToast(message, type = 'success') {
    const id = Date.now() + Math.random();
    this.toasts = [...this.toasts, { id, message, type }];
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 3500);
  }

  initAudio() {
    if (typeof window === 'undefined') return;
    if (this.clickSound) return; // Already initialized Howl instances

    import('howler').then((module) => {
      const Howl = module.Howl;
      this.clickSound = new Howl({ src: ['/sounds/click.wav'], volume: 0.35 });
      this.stampSound = new Howl({ src: ['/sounds/stamp.mp3'], volume: 0.55 });
      this.buzzerSound = new Howl({ src: ['/sounds/error.wav'], volume: 0.40 });
      console.log("🔊 Howler.js UI audio sound assets initialized successfully.");
    }).catch(err => {
      console.warn("Failed to load Howler sounds", err);
    });
  }

  toggleAudio() {
    if (!this.audioEnabled) {
      this.initAudio();
      this.audioEnabled = true;
      this.showToast("🔈 Sound effects enabled", "info");
      // Delay play until Howler finishes dynamic import
      setTimeout(() => this.playClickSound(), 150);
    } else {
      this.audioEnabled = false;
      this.showToast("🔇 Sound effects muted", "info");
    }
  }

  playClickSound() {
    if (!this.audioEnabled) return;
    this.initAudio();
    if (this.clickSound) {
      this.clickSound.play();
    }
  }

  playStampSound() {
    if (!this.audioEnabled) return;
    this.initAudio();
    if (this.stampSound) {
      this.stampSound.play();
    }
  }

  playBuzzerSound() {
    if (!this.audioEnabled) return;
    this.initAudio();
    if (this.buzzerSound) {
      this.buzzerSound.play();
    }
  }

  playScanSuccessSound() {
    if (!this.audioEnabled) return;
    this.playClickSound();
  }

  // Push notifications generator
  triggerSystemNotification(title, body) {
    // Standard visual toast fallback
    this.showToast(`🔔 ${title}: ${body}`, "info");

    // Real browser Notification API if authorized
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/icon-192.png',
              badge: '/favicon.svg',
              vibrate: [100, 50, 100]
            });
          });
        } catch (e) {
          new Notification(title, { body });
        }
      }
    }
  }

  // SvelteKit PWA installer prompt execution
  async executeAppInstall() {
    if (this.deferredPrompt) {
      this.playClickSound();
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.pwaInstallable = false;
        this.deferredPrompt = null;
        this.showToast("📲 App installation accepted! Welcome to the Desktop.");
      }
    }
  }

  // Save all transaction cache lists to local text file in OPFS
  async saveDataToFile() {
    if (typeof window === 'undefined') return;
    try {
      const dataToSave = {
        customers: this.customers,
        events: this.events,
        menus: this.menus,
        ingredients: this.ingredients,
        suppliers: this.suppliers,
        staff: this.staff,
        settings: this.settings
      };
      
      const serialized = JSON.stringify(dataToSave, null, 2);

      // Attempt to save to Origin Private File System (OPFS)
      if (navigator.storage && navigator.storage.getDirectory) {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle("catersync_data.txt", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(serialized);
        await writable.close();
        console.log("📝 Saved transaction cache to local OPFS catersync_data.txt");
      }
      
      // Secondary fallback backup in localStorage
      localStorage.setItem("catersync_data_backup", serialized);
    } catch (err) {
      console.warn("Failed to write to OPFS text file:", err);
    }
  }

  // Load transaction cache lists from local text file in OPFS
  async loadDataFromFile() {
    if (typeof window === 'undefined') return;
    try {
      let serialized = null;

      // Attempt reading from OPFS
      if (navigator.storage && navigator.storage.getDirectory) {
        try {
          const root = await navigator.storage.getDirectory();
          const fileHandle = await root.getFileHandle("catersync_data.txt");
          const file = await fileHandle.getFile();
          serialized = await file.text();
        } catch (e) {
          console.log("No existing CaterSync OPFS data file found. Checking localStorage backup...");
        }
      }

      // Fallback to localStorage if OPFS read was empty or failed
      if (!serialized) {
        serialized = localStorage.getItem("catersync_data_backup");
      }

      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (this.usingMockData) {
          if (parsed.customers) this.customers = parsed.customers;
          if (parsed.events) this.events = parsed.events;
          if (parsed.menus) this.menus = parsed.menus;
          if (parsed.ingredients) this.ingredients = parsed.ingredients;
          if (parsed.suppliers) this.suppliers = parsed.suppliers;
          if (parsed.staff) this.staff = parsed.staff;
          if (parsed.settings) this.settings = { ...this.settings, ...parsed.settings };
          console.log("🎉 Loaded active transaction data from local file cache.");
        }
      } else {
        // Initial populate to file if none exists
        await this.saveDataToFile();
      }
    } catch (err) {
      console.warn("Failed to read from local file cache:", err);
    } finally {
      this.isDataLoaded = true;
    }
  }
}

export function setCateringContext(state) {
  return setContext(STATE_KEY, state);
}

export function getCateringContext() {
  return getContext(STATE_KEY);
}
