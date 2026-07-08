<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import BiometricScanner from './BiometricScanner.svelte';
  import mascot from '$lib/assets/catersync_ai_mascot.png';
  import idleVideo from '../../assets/iddle.mp4';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { 
    Lock, 
    UserPlus, 
    ChevronRight, 
    ChevronLeft,
    Volume2,
    Users,
    Download,
    X,
    Fingerprint,
    KeyRound,
    CheckCircle2,
    ChefHat,
    Truck
  } from '@lucide/svelte';

  const appState = getCateringContext();

  let selectedPortal = $state(null); // null = Card selection, 'operator' = Operator login
  let step = $state(1); // 1 = Operator ID, 2 = Authentication Challenge
  let username = $state('');
  let password = $state('');
  let isChecking = $state(false);
  let availableMethods = $state(['password']);
  let selectedMethod = $state('password'); // password, biometric, totp, totp-setup

  // Signup fields
  let isSignupMode = $state(false);
  let regUsername = $state('');
  let regPassword = $state('');
  let regMessage = $state('');
  let loginMessage = $state('');
  let biometricAvailable = $state(false);
  let showInstallHelp = $state(false);
  let installHelp = $derived(appState.getPwaInstallHelp());

  // TOTP Authenticator states
  let totpToken = $state('');
  let totpSetupSecret = $state('');
  let totpSetupQrUrl = $state('');

  // Biometric setup states after first login
  let showBiometricSetupPrompt = $state(false);
  let showBiometricRegisterScanner = $state(false);

  // Welcome screen animation states
  let showWelcomeScreen = $state(false);
  let welcomeName = $state('');

  function getSafeUsername() {
    if (appState.currentUser && appState.currentUser.username) {
      return appState.currentUser.username;
    }
    return username || 'Operator';
  }

  function getGreeting() {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return 'Good morning';
    if (hr >= 12 && hr < 18) return 'Good afternoon';
    return 'Good evening';
  }

  let consoleLines = $state([]);

  function triggerWelcomeRedirect(name) {
    welcomeName = name || 'Operator';
    showWelcomeScreen = true;
    consoleLines = [];
    const lines = [
      '⚡ Initializing CaterSync-AI Neural Hub...',
      '🤖 Loading predictive scheduling weights...',
      '📈 Fetching local inventory D1 records...',
      '🔑 Syncing namespaced security vaults...',
      '🚀 Launching interactive dashboard!'
    ];
    lines.forEach((line, index) => {
      setTimeout(() => {
        consoleLines.push(line);
      }, index * 500);
    });

    try {
      appState.playStampSound();
    } catch (e) {
      console.warn("Welcome sound error:", e);
    }
    setTimeout(() => {
      appState.isAuthenticated = true;
      goto('/');
    }, 3200);
  }

  function startBiometricRegistration() {
    try {
      appState.playClickSound();
    } catch (e) {
      console.warn("Click sound error:", e);
    }
    showBiometricSetupPrompt = false;
    showBiometricRegisterScanner = true;
  }

  function skipBiometricRegistration() {
    try {
      appState.playClickSound();
    } catch (e) {
      console.warn("Click sound error:", e);
    }
    showBiometricSetupPrompt = false;
    showBiometricRegisterScanner = false;
    
    let safeName = 'Operator';
    try {
      const u = getSafeUsername();
      safeName = appState.currentUser?.name || (u ? u.trim().split('@')[0] : 'Operator');
    } catch (e) {
      console.warn("Operator name resolve error:", e);
    }
    triggerWelcomeRedirect(safeName);
  }

  $effect(() => {
    if (totpToken && totpToken.trim().length === 6 && !isChecking) {
      handleTotpSubmit();
    }
  });

  async function handleIdentifierSubmit(e) {
    if (e) e.preventDefault();
    if (!username.trim()) return;

    appState.playClickSound();
    isChecking = true;
    loginMessage = '';
    totpToken = '';

    if (appState.usingMockData) {
      isChecking = false;
      const isRegistered = appState.currentUser && appState.currentUser.username === username.trim();
      const isLinkAdmin = username.trim().toLowerCase() === 'admin';
      availableMethods = isRegistered ? (isLinkAdmin ? ['password'] : ['totp']) : (isLinkAdmin ? ['password'] : ['totp-setup']);
      
      if (!isLinkAdmin && !isRegistered) {
        totpSetupSecret = 'OFFLINETOTPSECRET';
        totpSetupQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI';
      } else {
        totpSetupSecret = '';
        totpSetupQrUrl = '';
      }
      
      selectedMethod = availableMethods[0] || 'totp';
      step = 2;
    } else {
      try {
        const response = await fetch('/api/auth/pre-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim() })
        });
        const res = await response.json();
        isChecking = false;
        if (response.ok && res.success) {
          const isLinkAdmin = username.trim().toLowerCase() === 'admin';
          availableMethods = [...res.methods];
          if (!isLinkAdmin) {
            availableMethods = availableMethods.filter(m => m !== 'password');
          }
          if (res.totpSetup) {
            totpSetupSecret = res.totpSetup.secret;
            totpSetupQrUrl = res.totpSetup.qrCodeUrl;
          } else {
            totpSetupSecret = '';
            totpSetupQrUrl = '';
          }
          selectedMethod = availableMethods[0] || 'totp';
          step = 2;
        } else {
          loginMessage = `❌ ${res.error || 'User not found or inactive.'}`;
          appState.playBuzzerSound();
        }
      } catch (err) {
        isChecking = false;
        console.warn("Pre-auth check fallback to local check:", err.message);
        const isLinkAdmin = username.trim().toLowerCase() === 'admin';
        availableMethods = isLinkAdmin ? ['password'] : ['totp-setup'];
        if (!isLinkAdmin) {
          totpSetupSecret = 'OFFLINETOTPSECRET';
          totpSetupQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth%3A%2F%2Ftotp%2FCaterSync-AI%3Aoffline%3Fsecret%3DOFFLINETOTPSECRET%26issuer%3DCaterSync-AI';
        } else {
          totpSetupSecret = '';
          totpSetupQrUrl = '';
        }
        selectedMethod = availableMethods[0] || 'totp';
        step = 2;
      }
    }
  }

  async function handlePasswordLogin(e) {
    e.preventDefault();
    appState.playClickSound();

    if (appState.usingMockData) {
      const user = appState.currentUser || { username: 'admin', password: 'admin' };
      if (username.trim() === user.username && password === user.password) {
        triggerWelcomeRedirect(username.trim().split('@')[0]);
      } else {
        loginMessage = '❌ Invalid credentials.';
        appState.playBuzzerSound();
      }
    } else {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password })
        });
        const res = await response.json();
        if (response.ok && res.success) {
          triggerWelcomeRedirect(username.trim().split('@')[0]);
        } else {
          if (response.status === 503 || res.offlineFallback) {
            const user = appState.currentUser || { username: 'admin', password: 'admin' };
            if (username.trim() === user.username && password === user.password) {
              triggerWelcomeRedirect(username.trim().split('@')[0]);
            } else {
              loginMessage = '❌ Invalid credentials (Offline Mode).';
              appState.playBuzzerSound();
            }
          } else {
            loginMessage = `❌ ${res.error || 'Invalid credentials'}`;
            appState.playBuzzerSound();
          }
        }
      } catch (err) {
        loginMessage = `❌ Connection Error: ${err.message}`;
        appState.playBuzzerSound();
      }
    }
  }

  async function handleTotpSubmit(e) {
    if (e) e.preventDefault();
    isChecking = true;
    loginMessage = '';

    if (appState.usingMockData) {
      isChecking = false;
      if (totpToken.trim().length === 6 && !isNaN(totpToken.trim())) {
        // Keep profile picture and name if they were pre-fetched by Google login
        appState.currentUser = { 
          username: username.trim(), 
          role: 'Operator',
          name: appState.currentUser?.name || username.trim().split('@')[0],
          picture: appState.currentUser?.picture || null
        };
        appState.playStampSound();
        
        if (biometricAvailable) {
          showBiometricSetupPrompt = true;
        } else {
          appState.isAuthenticated = true;
          goto('/');
        }
      } else {
        loginMessage = '❌ Invalid code (Offline simulation requires 6 digits).';
        appState.playBuzzerSound();
      }
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          token: totpToken.trim(),
          setupSecret: selectedMethod === 'totp-setup' ? totpSetupSecret : undefined
        })
      });
      const data = await response.json();
      isChecking = false;

      if (response.ok && data.success) {
        // Merge the profile picture/name from Google OAuth if we had them!
        appState.currentUser = {
          ...data.user,
          name: appState.currentUser?.name || data.user.name || username.trim().split('@')[0],
          picture: appState.currentUser?.picture || data.user.picture || null
        };
        appState.playStampSound();
        
        if (biometricAvailable && !data.hasBiometrics) {
          showBiometricSetupPrompt = true;
        } else {
          appState.isAuthenticated = true;
          goto('/');
        }
      } else {
        loginMessage = `❌ ${data.error || 'Verification failed.'}`;
        appState.playBuzzerSound();
      }
    } catch (err) {
      isChecking = false;
      loginMessage = `❌ Connection error: ${err.message}`;
      appState.playBuzzerSound();
    }
  }

  function handleBiometricsSuccess() {
    triggerWelcomeRedirect(username.trim().split('@')[0]);
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regUsername || !regPassword) return;

    appState.playClickSound();

    if (appState.usingMockData) {
      appState.currentUser = {
        username: regUsername,
        password: regPassword
      };
      regMessage = `✅ Profile "${regUsername}" registered successfully.`;
      appState.playStampSound();
      setTimeout(() => {
        isSignupMode = false;
        username = regUsername;
        step = 1;
      }, 1200);
    } else {
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: regUsername, password: regPassword, role: 'Operator' })
        });
        const res = await response.json();
        if (response.ok) {
          appState.currentUser = {
            username: regUsername,
            password: regPassword,
            pin: regPIN
          };
          appState.registeredPIN = regPIN;
          regMessage = `✅ Profile "${regUsername}" registered successfully.`;
          appState.playStampSound();
          setTimeout(() => {
            isSignupMode = false;
            username = regUsername;
            step = 1;
          }, 1200);
        } else {
          regMessage = `❌ Registration failed: ${res.error}`;
          appState.playBuzzerSound();
        }
      } catch (err) {
        regMessage = `❌ Error: ${err.message}`;
        appState.playBuzzerSound();
      }
    }
  }

  function goBackToIdentifier() {
    appState.playClickSound();
    step = 1;
    loginMessage = '';
    password = '';
    inputPIN = '';
  }

  async function handleInstallClick() {
    const installedPromptOpened = await appState.executeAppInstall();
    if (!appState.pwaInstalled) {
      showInstallHelp = true;
    }
  }

  let googleClientId = $state('');

  // Dynamic Google identity script loader
  function loadGoogleScript() {
    if (typeof window === 'undefined') return;
    if (document.getElementById('google-gsi-client-operator')) {
      initializeGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client-operator';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initializeGoogleButton();
    };
    document.head.appendChild(script);
  }

  function initializeGoogleButton() {
    if (typeof window === 'undefined' || !window.google || !googleClientId) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const parentDiv = document.getElementById('google-btn-operator');
      if (parentDiv) {
        window.google.accounts.id.renderButton(
          parentDiv,
          { theme: 'outline', size: 'large', width: parentDiv.offsetWidth, text: isSignupMode ? 'signup_with' : 'signin_with' }
        );
      }
    } catch (err) {
      console.error("Google Identity Operator initialization error:", err);
    }
  }

  async function handleGoogleCredentialResponse(response) {
    isChecking = true;
    loginMessage = '';
    regMessage = '';

    try {
      const res = await fetch('/api/auth/google-operator-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      isChecking = false;

      if (res.ok && data.success) {
        username = data.user.username;
        // Temporarily store user details so once 2FA passes we can log in
        appState.currentUser = data.user;

        if (data.totpConfigured) {
          availableMethods = ['totp'];
          totpSetupSecret = '';
          totpSetupQrUrl = '';
        } else {
          availableMethods = ['totp-setup'];
          if (data.totpSetup) {
            totpSetupSecret = data.totpSetup.secret;
            totpSetupQrUrl = data.totpSetup.qrCodeUrl;
          } else {
            totpSetupSecret = '';
            totpSetupQrUrl = '';
          }
        }
        selectedMethod = availableMethods[0];
        step = 2;
      } else {
        const errMsg = data.error || 'Google Authentication failed.';
        if (isSignupMode) regMessage = errMsg;
        else loginMessage = errMsg;
        appState.playBuzzerSound();
      }
    } catch (err) {
      isChecking = false;
      const errMsg = 'Google auth error: ' + err.message;
      if (isSignupMode) regMessage = errMsg;
      else loginMessage = errMsg;
      appState.playBuzzerSound();
    }
  }

  $effect(() => {
    if (selectedPortal === 'operator' && googleClientId) {
      setTimeout(initializeGoogleButton, 80);
    }
  });

  $effect(() => {
    if (isSignupMode !== undefined && selectedPortal === 'operator' && googleClientId) {
      setTimeout(initializeGoogleButton, 80);
    }
  });

  $effect(() => {
    if (step === 1 && selectedPortal === 'operator' && googleClientId) {
      setTimeout(initializeGoogleButton, 80);
    }
  });


  onMount(async () => {
    // 1. Fetch settings to see if Google Client ID is configured
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok && data.success) {
        googleClientId = data.settings.googleClientId || '';
        if (googleClientId) {
          loadGoogleScript();
        }
      }
    } catch (e) {
      console.warn("Could not load settings in LandingPage:", e.message);
    }

    // 2. Check if biometric authentication is available
    if (window.PublicKeyCredential && 
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        biometricAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (err) {
        console.warn("WebAuthn platform check bypassed:", err);
      }
    }
  });
</script>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#1A1715] dark:text-[#EBE5DC] flex flex-col items-center justify-center p-4 md:p-6 animate-fade-in relative overflow-hidden transition-colors duration-300">
  
  <div class="absolute inset-0 bg-[radial-gradient(#767068/10_1px,transparent_1px)] dark:bg-[radial-gradient(#767068/5_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40"></div>
  
  <div class="{selectedPortal === null && !showWelcomeScreen ? 'max-w-3xl' : 'max-w-md'} w-full text-center space-y-6 relative z-10 transition-all duration-300">
    
    <div class="flex flex-col items-center">
      <!-- Text header remains intact at the top -->
      <div>
        <span class="ticket-stamp">WELCOME</span>
        <h1 class="text-3xl font-black tracking-tighter text-[#2A2521] dark:text-white uppercase leading-none mt-2">
          CaterSync<span class="text-[#3E6650]">-AI</span>
        </h1>
        <p class="text-[10px] font-mono text-[#767068] mt-1.5 uppercase tracking-widest">
          Your smart catering and planning companion
        </p>
      </div>

      <!-- Large idle video player positioned below -->
      <div class="relative w-[380px] h-[280px] mt-4 mb-2 select-none group flex items-center justify-center">
        <!-- Pulse glow behind -->
        <div class="absolute inset-4 rounded-full bg-[#3E6650]/8 dark:bg-emerald-450/5 blur-2xl animate-pulse"></div>
        <!-- Video Player -->
        <!-- svelte-ignore a11y_media_has_caption -->
        <video 
          src={idleVideo}
          autoplay
          muted
          playsinline
          loop
          class="w-full h-full relative z-10 filter drop-shadow-[0_8px_16px_rgba(62,102,80,0.15)] object-contain mascot-video"
        ></video>
      </div>
    </div>

    {#if selectedPortal === null && !showWelcomeScreen}
      <!-- 4 PORTAL CARDS SELECTION -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left animate-fade-in">
        <!-- 1. Customer Card -->
        <a 
          href="/login" 
          onclick={() => appState.playClickSound()}
          class="group p-6 bg-white dark:bg-[#24201E] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-md hover:shadow-xl hover:border-[#3E6650]/40 transition-all select-none no-underline block transform hover:-translate-y-0.5"
        >
          <div class="flex items-start justify-between">
            <div class="p-2.5 rounded bg-[#3E6650]/10 text-[#3E6650] dark:bg-[#3E6650]/20 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
            <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">CATERING CLIENTS</span>
          </div>
          <h3 class="text-sm font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-wide mt-4 group-hover:text-[#3E6650] transition-colors">Customer Portal</h3>
          <p class="text-[10px] leading-relaxed text-[#767068] dark:text-zinc-400 mt-2 font-sans">
            Request quotes, review event contracts, sign agreements, specify dietary preferences, and pay invoices.
          </p>
        </a>

        <!-- 2. Operator Card -->
        <button 
          onclick={() => { appState.playClickSound(); selectedPortal = 'operator'; }}
          class="group p-6 bg-white dark:bg-[#24201E] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-md hover:shadow-xl hover:border-[#2A2521]/40 dark:hover:border-zinc-650 transition-all text-left select-none block transform hover:-translate-y-0.5"
        >
          <div class="flex items-start justify-between">
            <div class="p-2.5 rounded bg-slate-100 text-[#2A2521] dark:bg-zinc-800 dark:text-[#EBE5DC] group-hover:scale-105 transition-transform">
              <ChefHat size={20} />
            </div>
            <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">CATERING MANAGERS</span>
          </div>
          <h3 class="text-sm font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-wide mt-4 group-hover:text-[#2A2521] dark:group-hover:text-zinc-300 transition-colors">Catering Operator</h3>
          <p class="text-[10px] leading-relaxed text-[#767068] dark:text-zinc-400 mt-2 font-sans">
            Manage events, create menus, schedule staff, track kitchen stock, and run your business.
          </p>
        </button>

        <!-- 3. Supplier Card -->
        <a 
          href="/supplier/login" 
          onclick={() => appState.playClickSound()}
          class="group p-6 bg-white dark:bg-[#24201E] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-md hover:shadow-xl hover:border-[#D9A441]/40 transition-all select-none no-underline block transform hover:-translate-y-0.5"
        >
          <div class="flex items-start justify-between">
            <div class="p-2.5 rounded bg-[#D9A441]/10 text-[#D9A441] dark:bg-[#D9A441]/20 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Truck size={20} />
            </div>
            <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">SUPPLY MERCHANTS</span>
          </div>
          <h3 class="text-sm font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-wide mt-4 group-hover:text-[#D9A441] transition-colors">Supplier Hub</h3>
          <p class="text-[10px] leading-relaxed text-[#767068] dark:text-zinc-400 mt-2 font-sans">
            Sell wholesale ingredients, update product catalog prices, and manage catering store orders.
          </p>
        </a>

        <!-- 4. Admin Card -->
        <a 
          href="/admin/login" 
          onclick={() => appState.playClickSound()}
          class="group p-6 bg-white dark:bg-[#24201E] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-md hover:shadow-xl hover:border-[#AC3B2A]/40 transition-all select-none no-underline block transform hover:-translate-y-0.5"
        >
          <div class="flex items-start justify-between">
            <div class="p-2.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] dark:bg-[#AC3B2A]/20 dark:text-red-400 group-hover:scale-105 transition-transform">
              <Lock size={20} />
            </div>
            <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">PLATFORM MANAGERS</span>
          </div>
          <h3 class="text-sm font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-wide mt-4 group-hover:text-[#AC3B2A] transition-colors">Admin Console</h3>
          <p class="text-[10px] leading-relaxed text-[#767068] dark:text-zinc-400 mt-2 font-sans">
            Manage global system settings, catering licenses, security audits, and system stats.
          </p>
        </a>
      </div>
    {:else}
      <!-- Ticket Card (Standard Operator Login) -->
      <div class="ticket-card bg-white dark:bg-[#24201E] p-6 md:p-8 text-left border border-slate-200 dark:border-zinc-800 shadow-2xl relative">
        {#if !showWelcomeScreen}
          <!-- Back to selection button inside card -->
          <button 
            type="button"
            onclick={() => { appState.playClickSound(); selectedPortal = null; goBackToIdentifier(); }}
            class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA] transition-colors mb-4 bg-slate-50 dark:bg-zinc-800/60 py-1 px-2 rounded border border-[#767068]/20"
          >
            <ChevronLeft size={12} /> Back to portals
          </button>
        {/if}
        
        <div class="mb-6 flex justify-between items-start">
          <div>
            <span class="ticket-stamp">OPERATOR LOGIN</span>
            <h2 class="text-xl font-bold mt-1 text-[#2A2521] dark:text-[#EBE5DC]">Staff Access Hub</h2>
          </div>
          <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-zinc-800 text-[#767068]">
            <Lock size={16} />
          </div>
        </div>

      {#if showWelcomeScreen}
        <!-- Welcome Screen -->
        <div class="space-y-6 text-center py-6 animate-fade-in">
          <!-- Holographic pulse circle -->
          <div class="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div class="absolute inset-0 rounded-full bg-[#3E6650]/10 animate-ping"></div>
            <div class="absolute inset-2 rounded-full bg-[#3E6650]/20 animate-pulse"></div>
            <div class="w-12 h-12 rounded-full bg-[#3E6650] text-[#F6F2EA] flex items-center justify-center shadow-lg transform scale-110">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div class="space-y-2">
            <h2 class="text-sm font-mono font-bold uppercase tracking-tight text-[#2A2521] dark:text-[#EBE5DC]">
              {getGreeting()}, <span class="text-[#3E6650]">{welcomeName}</span>!
            </h2>
            <p class="text-[9px] text-[#767068] font-mono uppercase tracking-wider animate-pulse">
              System Access Authorized
            </p>
          </div>

          <!-- Neural Network console boot sequence -->
          <div class="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded border border-slate-200 dark:border-zinc-800 text-left font-mono text-[9px] text-[#3E6650] space-y-1 select-none max-h-36 overflow-y-auto">
            {#each consoleLines as line}
              <div class="animate-fade-in">{line}</div>
            {/each}
          </div>

          <!-- AI Waveform Animation -->
          <div class="flex items-center justify-center gap-1.5 h-6">
            <div class="w-1 bg-[#3E6650] rounded-full animate-[bounce_1s_infinite_100ms]" style="height: 12px"></div>
            <div class="w-1 bg-[#3E6650] rounded-full animate-[bounce_1s_infinite_200ms]" style="height: 20px"></div>
            <div class="w-1 bg-[#3E6650] rounded-full animate-[bounce_1s_infinite_300ms]" style="height: 16px"></div>
            <div class="w-1 bg-[#3E6650] rounded-full animate-[bounce_1s_infinite_400ms]" style="height: 24px"></div>
            <div class="w-1 bg-[#3E6650] rounded-full animate-[bounce_1s_infinite_500ms]" style="height: 14px"></div>
          </div>

          <p class="text-[9px] text-slate-400 font-mono">
            Loading console workspace...
          </p>
        </div>
      {:else if isChecking}
        <!-- Sci-Fi AI Scanning Console -->
        <div class="flex flex-col items-center justify-center py-8 space-y-5 animate-fade-in text-center font-mono">
          <!-- Holographic pulsating brain/waveform visual -->
          <div class="relative w-24 h-24 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full border border-[#3E6650]/20 animate-ping duration-1000"></div>
            <div class="absolute inset-2 rounded-full border border-dashed border-[#3E6650]/40 animate-spin duration-[4000ms]"></div>
            <div class="absolute inset-4 rounded-full bg-[#3E6650]/5 border border-[#3E6650]/30 animate-pulse duration-700"></div>
            <div class="w-10 h-10 rounded-full bg-[#3E6650] shadow-[0_0_20px_#3e6650] flex items-center justify-center text-white">
              <span class="text-xs animate-bounce font-bold">AI</span>
            </div>
            <div class="absolute w-full h-[2px] bg-[#3E6650]/65 top-0 left-0 animate-[bounce_2s_infinite]"></div>
          </div>
          
          <div class="space-y-1.5 w-full">
            <span class="text-[9px] uppercase font-bold text-[#3E6650] tracking-widest block">AI Operations Scanning</span>
            <div class="flex items-center justify-center gap-1.5 text-[9px] text-[#767068] uppercase font-mono">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Footprint verification in progress...</span>
            </div>
          </div>

          <!-- Neural node connections activity visual -->
          <div class="flex gap-1 justify-center h-4 items-end pb-1 w-2/3 border-b border-[#767068]/15">
            <div class="w-[3px] bg-[#3E6650] animate-[pulse_0.8s_infinite]" style="height: 40%"></div>
            <div class="w-[3px] bg-[#3E6650] animate-[pulse_0.6s_infinite_100ms]" style="height: 80%"></div>
            <div class="w-[3px] bg-[#3E6650] animate-[pulse_0.9s_infinite_200ms]" style="height: 50%"></div>
            <div class="w-[3px] bg-[#3E6650] animate-[pulse_0.5s_infinite_300ms]" style="height: 95%"></div>
            <div class="w-[3px] bg-[#3E6650] animate-[pulse_0.7s_infinite_400ms]" style="height: 60%"></div>
          </div>
        </div>
      {:else if isSignupMode}
        <!-- signup card -->
        <form onsubmit={handleRegister} class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="reg-username">Configure Username</label>
            <input 
              id="reg-username"
              type="text" 
              bind:value={regUsername} 
              autocomplete="off"
              class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
              placeholder="e.g. operator_sally"
              required 
            />
          </div>
          <div>
            <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="reg-password">Password</label>
            <input 
              id="reg-password"
              type="password" 
              bind:value={regPassword} 
              class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
              placeholder="Select password"
              required 
            />
          </div>


          <button 
            type="submit" 
            class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1.5"
          >
            Register Profile
          </button>

          {#if googleClientId}
            <div class="border-t border-[#767068]/15 pt-4 my-2 text-center">
              <span class="text-[9px] uppercase text-[#767068] font-bold block mb-3 font-mono">Or connect with Google</span>
              <div id="google-btn-operator" class="w-full flex justify-center min-h-[40px]"></div>
            </div>
          {/if}

          <button 
            type="button" 
            onclick={() => { appState.playClickSound(); isSignupMode = false; }} 
            class="w-full text-center text-xs font-mono text-[#767068] hover:underline pt-2 block"
          >
            Already have an account? Sign In
          </button>

          {#if regMessage}
            <p class="text-xs font-mono text-[#3E6650] text-center mt-2 leading-relaxed">{regMessage}</p>
          {/if}
        </form>
      {:else if step === 1}
        <!-- Step 1: Identifier Entry -->
        <form onsubmit={handleIdentifierSubmit} class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="login-username">Operator ID</label>
            <input 
              id="login-username"
              type="text" 
              bind:value={username} 
              autocomplete="off"
              class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
              placeholder="operator username (default: admin)"
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={isChecking}
            class="w-full bg-[#2A2521] hover:bg-slate-800 disabled:bg-slate-300 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1"
          >
            {#if isChecking}
              Checking Account...
            {:else}
              Continue <ChevronRight size={14} />
            {/if}
          </button>

          {#if googleClientId}
            <div class="border-t border-[#767068]/15 pt-4 my-2 text-center">
              <span class="text-[9px] uppercase text-[#767068] font-bold block mb-3 font-mono">Or connect with Google</span>
              <div id="google-btn-operator" class="w-full flex justify-center min-h-[40px]"></div>
            </div>
          {/if}

          <button 
            type="button" 
            onclick={() => { appState.playClickSound(); isSignupMode = true; regMessage = ''; }} 
            class="w-full text-center text-xs font-mono text-[#3E6650] hover:underline pt-2 block"
          >
            Need an operator profile? Sign Up
          </button>

          {#if loginMessage}
            <p class="text-xs font-mono text-[#AC3B2A] text-center mt-2">{loginMessage}</p>
          {/if}
        </form>
      {:else}
        {#if showBiometricRegisterScanner}
          <div class="space-y-4">
            <h2 class="text-xs font-mono font-bold uppercase tracking-tight text-[#767068] text-center">Registering Device Biometrics</h2>
            <BiometricScanner
              action="register"
              username={getSafeUsername()}
              email={getSafeUsername()}
              accountType="operator"
              onsuccess={() => {
                showBiometricRegisterScanner = false;
                let safeName = 'Operator';
                try {
                  const u = getSafeUsername();
                  safeName = appState.currentUser?.name || (u ? u.trim().split('@')[0] : 'Operator');
                } catch (e) {
                  console.warn("Operator name resolve error:", e);
                }
                triggerWelcomeRedirect(safeName);
              }}
              oncancel={skipBiometricRegistration}
            />
          </div>
        {:else if showBiometricSetupPrompt}
          <div class="space-y-4 text-center">
            <div class="w-12 h-12 rounded-full bg-[#3E6650]/10 text-[#3E6650] flex items-center justify-center mx-auto mb-2 animate-bounce">
              <Fingerprint size={28} />
            </div>
            <h2 class="text-sm font-mono font-bold uppercase tracking-tight text-[#2A2521]">Enable Biometric Login?</h2>
            <p class="text-[11px] text-[#767068] leading-relaxed">
              Would you like to register your device's biometrics or device password lock for faster secure login next time?
            </p>

            <div class="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onclick={startBiometricRegistration}
                class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive"
              >
                Allow Biometrics
              </button>
              <button
                type="button"
                onclick={skipBiometricRegistration}
                class="w-full border border-[#767068]/30 hover:bg-[#767068]/5 text-[#767068] font-bold font-mono text-xs py-2.5 rounded uppercase tracking-wider transition-all btn-interactive"
              >
                Skip for Now
              </button>
            </div>
          </div>
        {:else}
          <!-- Step 2: Progressive disclosure based on available options -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 border-b border-[#767068]/10 pb-3">
              <button 
                onclick={goBackToIdentifier}
                class="text-[#767068] hover:text-[#2A2521] transition-all p-1 hover:bg-[#F6F2EA] rounded-full"
                title="Change ID"
              >
                <ChevronLeft size={16} />
              </button>
              <span class="text-xs font-mono font-bold text-[#767068] truncate">Active ID: <span class="text-[#2A2521]">{username}</span></span>
            </div>

            <!-- Tabs to swap methods contextually if multiple are registered -->
            {#if availableMethods.length > 1}
              <div class="grid gap-1 bg-[#F6F2EA] p-0.5 rounded border border-[#767068]/20 font-mono text-[8px] uppercase tracking-tighter"
                   style="grid-template-columns: repeat({availableMethods.length}, minmax(0, 1fr));">
                {#each availableMethods as method}
                  <button
                    type="button"
                    onclick={() => { appState.playClickSound(); selectedMethod = method; loginMessage = ''; totpToken = ''; }}
                    class="py-1 rounded text-center transition-all {selectedMethod === method ? 'bg-white text-[#2A2521] font-bold shadow-sm' : 'text-[#767068] hover:text-[#2A2521]'}"
                  >
                    {method === 'totp' ? 'Authenticator' : method === 'totp-setup' ? 'Setup 2FA' : method === 'biometric' ? 'Biometrics' : method}
                  </button>
                {/each}
              </div>
            {/if}

          <!-- Method inputs -->
          {#if selectedMethod === 'password'}
            <form onsubmit={handlePasswordLogin} class="space-y-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="login-password">Password</label>
                <input 
                  id="login-password"
                  type="password" 
                  bind:value={password} 
                  class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
                  placeholder="•••••••• (default: admin)"
                  required 
                  autofocus
                />
              </div>

              <button 
                type="submit" 
                class="w-full bg-[#2A2521] hover:bg-slate-800 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1"
              >
                Sign In <ChevronRight size={14} />
              </button>
            </form>
          {/if}



          {#if selectedMethod === 'biometric'}
            <BiometricScanner 
              onsuccess={handleBiometricsSuccess} 
              oncancel={goBackToIdentifier} 
            />
          {/if}

          {#if selectedMethod === 'totp'}
            <form onsubmit={handleTotpSubmit} class="space-y-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="totp-code">Google Authenticator Code</label>
                <input 
                  id="totp-code"
                  type="text" 
                  pattern="[0-9]*"
                  inputmode="numeric"
                  maxlength="6"
                  bind:value={totpToken} 
                  class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs text-center font-bold tracking-[1em] focus:outline-none focus:border-[#3E6650]" 
                  placeholder="000000"
                  required 
                  autofocus
                />
              </div>

              <button 
                type="submit" 
                class="w-full bg-[#2A2521] hover:bg-slate-800 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1"
              >
                Verify Code <ChevronRight size={14} />
              </button>
            </form>
          {/if}

          {#if selectedMethod === 'totp-setup'}
            <form onsubmit={handleTotpSubmit} class="space-y-4 text-center">
              <div class="space-y-2">
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase text-left">Setup Google Authenticator</label>
                <p class="text-[10px] text-[#767068] leading-relaxed text-left">
                  Scan the QR code with your Google Authenticator or generic TOTP app, then enter the 6-digit verification code below.
                </p>
                
                <div class="flex justify-center bg-white p-3 rounded border border-[#767068]/20 w-fit mx-auto shadow-sm">
                  {#if totpSetupQrUrl}
                    <img src={totpSetupQrUrl} alt="Google Authenticator QR Code" class="w-40 h-40 object-contain" />
                  {:else}
                    <div class="w-40 h-40 flex items-center justify-center text-xs font-mono text-slate-400">Loading QR...</div>
                  {/if}
                </div>

                <div class="bg-[#F6F2EA] px-2 py-1.5 rounded border border-[#767068]/10 text-center">
                  <span class="text-[8px] uppercase tracking-wider text-[#767068] block">Manual Key</span>
                  <code class="text-xs font-mono font-bold tracking-wider text-[#2A2521] select-all">{totpSetupSecret}</code>
                </div>

                <div class="text-left pt-2">
                  <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="totp-setup-code">Verification Code</label>
                  <input 
                    id="totp-setup-code"
                    type="text" 
                    pattern="[0-9]*"
                    inputmode="numeric"
                    maxlength="6"
                    bind:value={totpToken} 
                    class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs text-center font-bold tracking-[1em] focus:outline-none focus:border-[#3E6650]" 
                    placeholder="000000"
                    required 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1"
              >
                Verify & Enable 2FA <ChevronRight size={14} />
              </button>
            </form>
          {/if}

          {#if loginMessage}
            <p class="text-xs font-mono text-[#AC3B2A] text-center mt-2">{loginMessage}</p>
          {/if}
        </div>
        {/if}
      {/if}

      <!-- Alternate Portal Switcher -->
      <div class="mt-6 border-t border-dashed border-[#767068]/30 pt-5">
        <span class="block text-[9px] uppercase font-bold text-[#767068] tracking-widest mb-3 font-mono">Or Access Alternate Portals</span>
        <div class="grid grid-cols-3 gap-2 text-center text-[9px] font-bold font-mono">
          <a 
            href="/login" 
            onclick={() => appState.playClickSound()} 
            class="py-2 px-1 border border-[#3E6650]/30 rounded bg-[#3E6650]/5 hover:bg-[#3E6650]/15 text-[#3E6650] no-underline transition-all active:scale-[0.98]"
          >
            Customer Gate
          </a>
          <a 
            href="/supplier/login" 
            onclick={() => appState.playClickSound()} 
            class="py-2 px-1 border border-[#D9A441]/30 rounded bg-[#D9A441]/5 hover:bg-[#D9A441]/15 text-[#D9A441] no-underline transition-all active:scale-[0.98]"
          >
            Supplier Hub
          </a>
          <a 
            href="/admin/login" 
            onclick={() => appState.playClickSound()} 
            class="py-2 px-1 border border-[#AC3B2A]/30 rounded bg-[#AC3B2A]/5 hover:bg-[#AC3B2A]/15 text-[#AC3B2A] no-underline transition-all active:scale-[0.98]"
          >
            Admin System
          </a>
        </div>
      </div>

      <div class="ticket-divider my-6"></div>
      <p class="text-[9px] font-mono text-slate-400 text-center uppercase tracking-widest">
        Secure Core Security Protocol v3.12
      </p>

    </div>
    {/if}

    <!-- Clean Sound Toggle and Install App Button -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button 
        onclick={() => appState.toggleAudio()} 
        class="text-[10px] font-mono text-[#767068] hover:text-[#2A2521] flex items-center gap-1 bg-white/60 hover:bg-white px-2.5 py-1.5 rounded border border-[#767068]/20 transition-all btn-interactive"
      >
        <Volume2 size={12} class={appState.audioEnabled ? 'text-[#3E6650]' : ''} />
        <span>Sound Effects: {appState.audioEnabled ? 'Active' : 'Muted'}</span>
      </button>

      {#if appState.pwaInstallable}
        <button 
          onclick={handleInstallClick} 
          class="text-[10px] font-mono text-[#F6F2EA] bg-[#3E6650] hover:bg-[#3E6650]/90 flex items-center gap-1 px-2.5 py-1.5 rounded border border-transparent shadow-sm transition-all btn-interactive"
          title="Install CaterSync on this device"
        >
          <Download size={12} />
          <span>Install App</span>
        </button>
      {/if}
    </div>

    <div class="text-center mt-3 text-[10px] font-mono text-[#767068] opacity-75">
      Catersync Console v{appState.version}
    </div>

  </div>

  {#if showInstallHelp}
    <div class="fixed inset-0 z-50 bg-[#2A2521]/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div class="w-full max-w-sm bg-white rounded-lg border border-[#767068]/25 shadow-2xl overflow-hidden text-left animate-fade-in">
        <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#767068]/15">
          <div>
            <span class="ticket-stamp">PHONE INSTALL</span>
            <h3 class="text-base font-black text-[#2A2521] mt-1">{installHelp.title}</h3>
          </div>
          <button
            onclick={() => showInstallHelp = false}
            class="shrink-0 p-1.5 rounded hover:bg-[#F6F2EA] text-[#767068] transition-all"
            title="Close install instructions"
          >
            <X size={16} />
          </button>
        </div>

        <div class="px-5 py-4 space-y-4">
          <p class="text-xs leading-relaxed text-[#767068]">{installHelp.detail}</p>
          <ol class="space-y-2">
            {#each installHelp.steps as step, index}
              <li class="flex gap-2 text-xs text-[#2A2521] leading-relaxed">
                <span class="shrink-0 w-5 h-5 rounded bg-[#3E6650] text-[#F6F2EA] font-mono text-[10px] flex items-center justify-center">{index + 1}</span>
                <span>{step}</span>
              </li>
            {/each}
          </ol>

          {#if installHelp.platform.startsWith('android') && appState.pwaInstallPromptAvailable}
            <button
              onclick={handleInstallClick}
              class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1.5"
            >
              <Download size={14} />
              Install Now
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mascot-video {
    mix-blend-mode: multiply;
  }
  :global(.dark) .mascot-video {
    filter: invert(0.92) contrast(1.1) brightness(1.1) hue-rotate(180deg);
    mix-blend-mode: screen;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-8px);
    }
  }
</style>
