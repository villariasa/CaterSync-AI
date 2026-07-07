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
  notifications = $state([]);
  systemAuditLogs = $state([]);
  audioEnabled = $state(false);
  clickSound = null;
  stampSound = null;
  buzzerSound = null;
  activeEventForAnalysis = $state(null);
  anomalyReport = $state(null);
  usingMockData = $state(false);
  version = '1.4.0';
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
  pwaInstallPromptAvailable = $state(false);
  pwaInstalled = $state(false);
  pushSubscriptionActive = $state(false);

  settings = $state({
    business_name: 'CaterSync',
    currency_symbol: '₱',
    overhead_rate: 0.12,
    min_budget_per_guest: 150.00,
    risk_medium_threshold: 0.35,
    risk_high_threshold: 0.60,
    low_stock_alerts_enabled: true,
    sound_enabled_default: false,
    emailConfig: {
      gmailAddress: '',
      gmailAppPassword: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465
    }
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
      const storedNotifs = localStorage.getItem('catersync_notifications');
      if (storedNotifs) {
        try {
          this.notifications = JSON.parse(storedNotifs);
        } catch (e) {
          this.notifications = [];
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

  showToast(message, type = 'success', persist = true) {
    if (!persist) return; // Completely ignore ignored alerts

    const id = Date.now() + Math.random();
    const newNotif = {
      id,
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: true
    };
    this.notifications = [newNotif, ...this.notifications];
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
      // Delay play until Howler finishes dynamic import
      setTimeout(() => this.playClickSound(), 150);
    } else {
      this.audioEnabled = false;
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

  isPwaStandalone() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  getPwaInstallPlatform() {
    if (typeof navigator === 'undefined') return 'desktop';

    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isSamsung = /SamsungBrowser/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /EdgA|EdgiOS|Edg/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge && !isSamsung;

    if (isIOS) return isFirefox ? 'ios-firefox' : isChrome ? 'ios-chrome' : isEdge ? 'ios-edge' : 'ios-safari';
    if (isAndroid && isSamsung) return 'android-samsung';
    if (isAndroid && isFirefox) return 'android-firefox';
    if (isAndroid && isEdge) return 'android-edge';
    if (isAndroid) return 'android-chrome';
    if (isFirefox) return 'desktop-firefox';
    if (isEdge) return 'desktop-edge';
    if (isChrome) return 'desktop-chrome';
    return 'desktop';
  }

  getPwaInstallHelp() {
    const platform = this.getPwaInstallPlatform();

    if (platform.startsWith('ios')) {
      return {
        platform,
        title: 'Install on iPhone / iPad',
        detail: 'Apple does not allow any browser button to directly install a PWA. Install from Safari using Add to Home Screen.',
        steps: [
          'Open this page in Safari.',
          'Tap the Share button in the bottom toolbar.',
          'Scroll and tap Add to Home Screen.',
          'Tap Add. CaterSync will appear like a normal app.'
        ]
      };
    }

    if (platform === 'android-firefox') {
      return {
        platform,
        title: 'Install on Android Firefox',
        detail: 'Firefox handles PWA install from the browser menu instead of a site-controlled popup.',
        steps: [
          'Open this page in Firefox.',
          'Tap the three-dot browser menu.',
          'Tap Install or Add to Home screen.',
          'Confirm Add.'
        ]
      };
    }

    if (platform === 'android-samsung') {
      return {
        platform,
        title: 'Install on Samsung Internet',
        detail: 'Samsung Internet installs web apps from its browser menu when the app is available.',
        steps: [
          'Open this page in Samsung Internet.',
          'Tap the menu button.',
          'Tap Add page to, then Home screen.',
          'Confirm Add.'
        ]
      };
    }

    if (platform.startsWith('android')) {
      return {
        platform,
        title: 'Install on Android',
        detail: 'Android Chrome and Edge can open the install popup when the browser marks this PWA installable.',
        steps: [
          'Open this page in Chrome or Edge.',
          'Tap Install App.',
          'If no popup appears, tap the three-dot browser menu.',
          'Tap Install app or Add to Home screen.',
          'Confirm Install.'
        ]
      };
    }

    if (platform === 'desktop-firefox') {
      return {
        platform,
        title: 'Install in Firefox',
        detail: 'Firefox does not support the same direct PWA install popup as Chrome and Edge.',
        steps: [
          'Use Chrome or Edge for one-click PWA install.',
          'Or open the browser menu and look for Add to Home screen / Install if your Firefox version provides it.',
          'Confirm the install from the browser prompt.'
        ]
      };
    }

    return {
      platform,
      title: 'Install CaterSync',
      detail: 'Install is controlled by the browser. Chrome and Edge support the direct install popup; other browsers use their menu.',
      steps: [
        'Open this app from HTTPS, localhost, or 127.0.0.1.',
        'Click Install App when the prompt appears.',
        'If no prompt appears, open the browser menu and choose Install app.'
      ]
    };
  }

  async syncPwaInstallState() {
    if (typeof window === 'undefined') return;

    let installedRelatedApp = false;
    if ('getInstalledRelatedApps' in navigator) {
      try {
        const relatedApps = await navigator.getInstalledRelatedApps();
        installedRelatedApp = Array.isArray(relatedApps) && relatedApps.length > 0;
      } catch (err) {
        console.warn("Unable to check installed related apps:", err);
      }
    }

    this.pwaInstalled = this.isPwaStandalone() || installedRelatedApp;
    this.pwaInstallable = !this.pwaInstalled;

    if (this.pwaInstalled) {
      this.deferredPrompt = null;
      this.pwaInstallPromptAvailable = false;
    }
  }

  setPwaInstallPrompt(promptEvent) {
    this.deferredPrompt = promptEvent;
    this.pwaInstallPromptAvailable = true;
    this.pwaInstalled = false;
    this.pwaInstallable = true;
  }

  markPwaInstalled() {
    this.pwaInstalled = true;
    this.pwaInstallable = false;
    this.pwaInstallPromptAvailable = false;
    this.deferredPrompt = null;
  }

  hydrateSavedInstallPrompt() {
    if (typeof window === 'undefined') return false;
    if (this.deferredPrompt) return true;

    const savedPrompt = window.__catersyncDeferredInstallPrompt;
    if (savedPrompt) {
      this.setPwaInstallPrompt(savedPrompt);
      return true;
    }

    return false;
  }

  // SvelteKit PWA installer prompt execution
  async executeAppInstall() {
    this.playClickSound();
    this.hydrateSavedInstallPrompt();

    if (this.pwaInstalled) {
      this.pwaInstallable = false;
      this.pwaInstallPromptAvailable = false;
      return true;
    }

    if (!this.deferredPrompt) {
      if (typeof window !== 'undefined') {
        await this.syncPwaInstallState();
      }

      if (this.pwaInstalled) return true;

      const isSecureInstallOrigin = typeof window !== 'undefined' && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname));
      const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
      const help = this.getPwaInstallHelp();

      if (!isSecureInstallOrigin) {
        console.warn("Install on phones needs HTTPS. Open CaterSync from a secure link, then install again.");
      } else if (!hasServiceWorker) {
        console.warn("This browser does not support the service worker needed for app install.");
      } else if (help.platform.startsWith('android')) {
        console.warn("Chrome has not marked this PWA installable yet. Use HTTPS, reload once, then tap Install App again.");
      } else {
        console.info(help.platform.startsWith('ios') ? "On iPhone, use Safari Share > Add to Home Screen." : "Use the browser menu: Install app / Add to Home screen.");
      }
      return false;
    }

    try {
      const promptEvent = this.deferredPrompt;
      this.deferredPrompt = null;
      this.pwaInstallPromptAvailable = false;

      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;

      if (outcome === 'accepted') {
        this.markPwaInstalled();
        return true;
      } else {
        this.pwaInstallable = !this.pwaInstalled;
        return false;
      }
    } catch (err) {
      this.pwaInstallable = !this.pwaInstalled;
      console.error(`Install prompt failed: ${err.message || 'browser blocked the prompt'}`);
      return false;
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
        settings: this.settings,
        systemAuditLogs: this.systemAuditLogs
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
          if (parsed.systemAuditLogs) this.systemAuditLogs = parsed.systemAuditLogs;
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
