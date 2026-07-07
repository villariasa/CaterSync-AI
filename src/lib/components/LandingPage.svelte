<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import BiometricScanner from './BiometricScanner.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
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
    KeyRound
  } from '@lucide/svelte';

  const appState = getCateringContext();

  let step = $state(1); // 1 = Operator ID, 2 = Authentication Challenge
  let username = $state('');
  let password = $state('');
  let inputPIN = $state('');
  let isChecking = $state(false);
  let availableMethods = $state(['password']);
  let selectedMethod = $state('password'); // password, pin, biometric, totp, totp-setup

  // Signup fields
  let isSignupMode = $state(false);
  let regUsername = $state('');
  let regPassword = $state('');
  let regPIN = $state('1234');
  let regMessage = $state('');
  let loginMessage = $state('');
  let biometricAvailable = $state(false);
  let showInstallHelp = $state(false);
  let installHelp = $derived(appState.getPwaInstallHelp());

  // TOTP Authenticator states
  let totpToken = $state('');
  let totpSetupSecret = $state('');
  let totpSetupQrUrl = $state('');

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
      availableMethods = isRegistered ? (isLinkAdmin ? ['password', 'pin'] : ['totp', 'pin']) : (isLinkAdmin ? ['password'] : ['totp-setup']);
      
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
        availableMethods = isLinkAdmin ? ['password', 'pin'] : ['totp-setup', 'pin'];
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
        appState.isAuthenticated = true;
        appState.playStampSound();
        goto('/');
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
          appState.isAuthenticated = true;
          appState.playStampSound();
          goto('/');
        } else {
          if (response.status === 503 || res.offlineFallback) {
            const user = appState.currentUser || { username: 'admin', password: 'admin' };
            if (username.trim() === user.username && password === user.password) {
              appState.isAuthenticated = true;
              appState.playStampSound();
              goto('/');
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

    if (appState.usingMockData || totpSetupSecret === 'OFFLINETOTPSECRET') {
      isChecking = false;
      if (totpToken.trim().length === 6 && !isNaN(totpToken.trim())) {
        appState.isAuthenticated = true;
        appState.currentUser = { username: username.trim(), role: 'Operator' };
        appState.playStampSound();
        goto('/');
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
        appState.isAuthenticated = true;
        appState.currentUser = data.user;
        appState.playStampSound();
        goto('/');
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

  function handlePinInput() {
    inputPIN = inputPIN.replace(/[^0-9]/g, '');
    
    if (inputPIN.length === 4) {
      setTimeout(() => {
        const correctPIN = appState.registeredPIN || '1234';
        if (inputPIN === correctPIN) {
          appState.isAuthenticated = true;
          appState.playStampSound();
          goto('/');
        } else {
          appState.playBuzzerSound();
          loginMessage = '❌ Incorrect PIN';
          inputPIN = '';
        }
      }, 350);
    }
  }

  function handleBiometricsSuccess() {
    appState.isAuthenticated = true;
    goto('/');
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regUsername || !regPassword) return;

    appState.playClickSound();

    if (appState.usingMockData) {
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

      if (res.ok && data.success) {
        appState.isAuthenticated = true;
        appState.currentUser = data.user;
        appState.playStampSound();
        goto('/');
      } else {
        const errMsg = data.error || 'Google Authentication failed.';
        if (isSignupMode) regMessage = errMsg;
        else loginMessage = errMsg;
        appState.playBuzzerSound();
      }
    } catch (err) {
      const errMsg = 'Google auth error: ' + err.message;
      if (isSignupMode) regMessage = errMsg;
      else loginMessage = errMsg;
      appState.playBuzzerSound();
    } finally {
      isChecking = false;
    }
  }

  $effect(() => {
    if (isSignupMode !== undefined && googleClientId) {
      setTimeout(initializeGoogleButton, 80);
    }
  });

  $effect(() => {
    if (step === 1 && googleClientId) {
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

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] flex flex-col items-center justify-center p-4 md:p-6 animate-fade-in relative overflow-hidden">
  
  <div class="absolute inset-0 bg-[radial-gradient(#767068/10_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10">
    
    <div>
      <span class="ticket-stamp">OPERATIONAL SYSTEM</span>
      <h1 class="text-3xl font-black tracking-tighter text-[#2A2521] uppercase leading-none mt-2">
        CaterSync<span class="text-[#3E6650]">-AI</span>
      </h1>
      <p class="text-[10px] font-mono text-[#767068] mt-1.5 uppercase tracking-widest">
        Predictive Operations Console
      </p>
    </div>

    <div class="ticket-card bg-white p-6 md:p-8 text-left">
      
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="ticket-stamp">SECURITY CONSOLE</span>
          <h2 class="text-xl font-bold mt-1 text-[#2A2521]">Access Gate</h2>
        </div>
        <div class="p-2 rounded bg-slate-50 border border-slate-200">
          <Lock size={16} class="text-[#767068]" />
        </div>
      </div>

      {#if isSignupMode}
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
          <div>
            <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="reg-pin">Select 4-digit PIN</label>
            <input 
              id="reg-pin"
              type="text" 
              pattern="[0-9]{4}"
              maxlength="4"
              bind:value={regPIN} 
              autocomplete="off"
              class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
              placeholder="e.g. 1234"
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
                  {method === 'totp' ? 'Authenticator' : method === 'totp-setup' ? 'Setup 2FA' : method}
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

          {#if selectedMethod === 'pin'}
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="login-pin">Enter 4-Digit Access PIN</label>
                <input 
                  id="login-pin"
                  type="password" 
                  pattern="[0-9]*" 
                  inputmode="numeric" 
                  maxlength="4" 
                  bind:value={inputPIN} 
                  oninput={handlePinInput}
                  class="w-full text-center text-xl tracking-[1.2em] pl-6 py-2.5 rounded border border-[#767068]/30 bg-white focus:outline-none focus:border-[#3E6650] font-mono"
                  placeholder="••••"
                  required 
                  autofocus
                />
              </div>
              <p class="text-[9px] text-[#767068] font-mono text-center">
                Verification occurs automatically upon entering the 4th digit.
              </p>
            </div>
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

      <div class="ticket-divider my-6"></div>
      <p class="text-[9px] font-mono text-slate-400 text-center uppercase tracking-widest">
        Secure Core Security Protocol v3.12
      </p>

    </div>

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
