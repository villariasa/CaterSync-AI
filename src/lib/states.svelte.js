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
  activeEventForAnalysis = $state(null);
  anomalyReport = $state(null);
  usingMockData = $state(false);
  version = '1.2.4';

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
      localStorage.setItem('catersync_auth_state', value ? 'true' : 'false');
    }
  }

  get currentUser() {
    return this._currentUser;
  }
  set currentUser(value) {
    this._currentUser = value;
    if (typeof window !== 'undefined') {
      localStorage.setItem('catersync_current_user', value ? JSON.stringify(value) : '');
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
      this._isAuthenticated = localStorage.getItem('catersync_auth_state') === 'true';
      this._registeredPIN = localStorage.getItem('catersync_registered_pin') || '1234';
      const storedUser = localStorage.getItem('catersync_current_user');
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
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleAudio() {
    if (!this.audioEnabled) {
      this.initAudio();
      this.audioEnabled = true;
      this.showToast("🔈 Sound effects enabled", "info");
      this.playClickSound();
    } else {
      this.audioEnabled = false;
      this.showToast("🔇 Sound effects muted", "info");
    }
  }

  playClickSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio click failed", e);
    }
  }

  playStampSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    try {
      const bufferSize = this.audioCtx.sampleRate * 0.12;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, this.audioCtx.currentTime);
      filter.Q.setValueAtTime(5, this.audioCtx.currentTime);
      
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      noise.start();
      
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);
      osc.frequency.setValueAtTime(75, this.audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, this.audioCtx.currentTime + 0.10);
      oscGain.gain.setValueAtTime(0.20, this.audioCtx.currentTime);
      oscGain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio stamp failed", e);
    }
  }

  playBuzzerSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn("Audio buzzer failed", e);
    }
  }

  playScanSuccessSound() {
    if (!this.audioEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      
      osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.18);
    } catch (e) {
      console.warn("Scan sound failed", e);
    }
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
}

export function setCateringContext(state) {
  return setContext(STATE_KEY, state);
}

export function getCateringContext() {
  return getContext(STATE_KEY);
}
