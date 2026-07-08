<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { Lock, ArrowRight, CheckCircle2, ChevronLeft, Mail, UserPlus, Phone } from '@lucide/svelte';

  const appState = getCateringContext();

  let tab = $state('login'); // 'login', 'register'
  let step = $state('email'); // 'email', 'otp'
  let customerContact = $state('');
  
  // Registration fields
  let regName = $state('');
  let regPhone = $state('');
  
  let otpCode = $state('');

  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let googleClientId = $state('');

  // Countdown timer variables
  let timerSeconds = $state(120);
  let timerInterval = null;

  function startCountdown() {
    clearInterval(timerInterval);
    timerSeconds = 120;
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
      } else {
        clearInterval(timerInterval);
        appState.playBuzzerSound();
        errorMessage = 'Verification code has expired. Please request a new one by going back.';
      }
    }, 1000);
  }

  onDestroy(() => {
    clearInterval(timerInterval);
  });

  // Handle email lookup and OTP dispatch for existing users
  async function checkIdentifier(e) {
    if (e) e.preventDefault();
    if (!customerContact.trim()) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      // Check if subscriber profile exists
      const preAuthRes = await fetch('/api/auth/pre-auth-subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerContact.trim() })
      });
      const preAuthData = await preAuthRes.json();

      if (preAuthRes.ok && preAuthData.success) {
        // Send OTP code
        const optRes = await fetch('/api/auth/register-subscriber', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerContact.trim() })
        });
        const otpData = await optRes.json();

        isChecking = false;

        if (optRes.ok && otpData.success) {
          successMessage = 'A verification code was sent to your email!';
          step = 'otp';
          startCountdown();
          if (otpData.usingFallback && otpData.previewUrl) {
            window.open(otpData.previewUrl, '_blank');
          }
        } else {
          appState.playBuzzerSound();
          errorMessage = otpData.error || 'Failed to dispatch code.';
        }
      } else {
        isChecking = false;
        appState.playBuzzerSound();
        errorMessage = 'Catering profile not found for this email. Please switch to the "Register Account" tab to sign up!';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Error: ' + err.message;
    }
  }

  // Handle manual customer registration and OTP dispatch
  async function handleManualRegister(e) {
    if (e) e.preventDefault();
    if (!customerContact.trim() || !regName.trim() || !regPhone.trim()) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/register-subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerContact.trim(),
          name: regName.trim(),
          phone: regPhone.trim()
        })
      });
      const data = await response.json();

      isChecking = false;

      if (response.ok && data.success) {
        successMessage = 'Profile registered successfully! A verification code has been dispatched to your email.';
        step = 'otp';
        startCountdown();
        if (data.usingFallback && data.previewUrl) {
          window.open(data.previewUrl, '_blank');
        }
      } else {
        appState.playBuzzerSound();
        errorMessage = data.error || 'Failed to complete registration.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Registration error: ' + err.message;
    }
  }

  // Handle OTP verification and login
  async function verifyOtp(e) {
    if (e) e.preventDefault();
    if (!otpCode.trim()) return;
    if (timerSeconds <= 0) {
      errorMessage = 'Verification code has expired. Please go back and request a new code.';
      appState.playBuzzerSound();
      return;
    }

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customerContact.trim(), otpCode: otpCode.trim() })
      });
      const res = await response.json();

      if (response.ok && res.success) {
        clearInterval(timerInterval);
        // Create backend session
        const loginRes = await fetch('/api/auth/portal-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: customerContact.trim() })
        });
        const loginData = await loginRes.json();

        isChecking = false;

        if (loginRes.ok && loginData.success) {
          appState.currentUser = {
            ...loginData.customer,
            userType: 'subscriber'
          };
          appState.playStampSound();
          successMessage = 'Session authenticated!';
          setTimeout(() => {
            appState.isAuthenticated = true;
            goto('/portal');
          }, 1200);
        } else {
          appState.playBuzzerSound();
          errorMessage = loginData.error || 'Failed to initialize session.';
        }
      } else {
        isChecking = false;
        appState.playBuzzerSound();
        errorMessage = res.error || 'Invalid OTP code.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Verification error: ' + err.message;
    }
  }

  function goBack() {
    appState.playClickSound();
    clearInterval(timerInterval);
    step = 'email';
    otpCode = '';
    errorMessage = '';
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

      const parentDiv = document.getElementById('google-btn-customer');
      if (parentDiv) {
        window.google.accounts.id.renderButton(
          parentDiv,
          { theme: 'outline', size: 'large', width: parentDiv.offsetWidth, text: tab === 'register' ? 'signup_with' : 'signin_with' }
        );
      }
    } catch (err) {
      console.error("Google Identity Customer initialization error:", err);
    }
  }

  async function handleGoogleCredentialResponse(response) {
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      isChecking = false;

      if (res.ok && data.success) {
        appState.currentUser = {
          ...data.customer,
          userType: 'subscriber'
        };
        appState.playStampSound();
        successMessage = 'Successfully signed in with Google!';
        setTimeout(() => {
          appState.isAuthenticated = true;
          goto('/portal');
        }, 1200);
      } else {
        appState.playBuzzerSound();
        errorMessage = data.error || 'Google Authentication failed.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Google authentication error: ' + err.message;
    }
  }

  onMount(() => {
    appState.initAudio();

    // Load settings to fetch googleClientId
    if (appState.settings && appState.settings.googleClientId) {
      googleClientId = appState.settings.googleClientId;
    }

    if (googleClientId && typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeGoogleButton();
      };
      document.head.appendChild(script);
    }
  });

  $effect(() => {
    if (googleClientId && tab && step === 'email') {
      setTimeout(() => {
        initializeGoogleButton();
      }, 50);
    }
  });
</script>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#1F1B18] dark:text-[#F6F2EA] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden transition-colors duration-300">
  <div class="absolute inset-0 bg-[radial-gradient(#3e6650/8_1px,transparent_1px)] dark:bg-[radial-gradient(#3e6650/4_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none opacity-30"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10 animate-fade-in">
    <div>
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#3E6650] border border-[#3E6650]/40 rounded bg-[#3E6650]/5 uppercase">CUSTOMER AREA</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] dark:text-white uppercase mt-2">
        CaterSync<span class="text-[#3E6650]"> Client</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Book event caterers and customize menus</p>
    </div>

    <!-- TABS (Only visible when entering identifiers) -->
    {#if step === 'email'}
      <div class="grid grid-cols-2 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded border border-slate-200 dark:border-zinc-700 text-[10px] uppercase font-bold text-center">
        <button 
          onclick={() => { appState.playClickSound(); tab = 'login'; errorMessage = ''; successMessage = ''; }}
          class="py-2 rounded transition-all {tab === 'login' ? 'bg-white dark:bg-zinc-900 text-[#3E6650] dark:text-emerald-400 shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA]'}"
        >
          Sign In
        </button>
        <button 
          onclick={() => { appState.playClickSound(); tab = 'register'; errorMessage = ''; successMessage = ''; }}
          class="py-2 rounded transition-all {tab === 'register' ? 'bg-white dark:bg-zinc-900 text-[#3E6650] dark:text-emerald-400 shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA]'}"
        >
          Create Account
        </button>
      </div>
    {/if}

    <div class="bg-white dark:bg-[#24201E] border border-[#767068]/30 dark:border-zinc-800 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#3E6650]"></div>
      
      {#if !isChecking && step === 'email'}
        <!-- Back to selection button inside card -->
        <a 
          href="/"
          onclick={() => appState.playClickSound()}
          class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA] transition-colors mb-4 no-underline bg-slate-50 dark:bg-zinc-800/60 py-1 px-2 rounded border border-[#767068]/20"
        >
          <ChevronLeft size={12} /> Back to portals
        </a>
      {/if}

      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {#if step === 'otp'}
              ENTER CODE
            {:else if tab === 'login'}
              SIGN IN
            {:else}
              SIGN UP
            {/if}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521] dark:text-[#F6F2EA]">
            {#if step === 'otp'}
              Verify your email
            {:else if tab === 'login'}
              Welcome back! Sign in
            {:else}
              Join CaterSync today
            {/if}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-zinc-800 text-[#3E6650] dark:text-[#F6F2EA]">
          {#if step === 'otp'}<Lock size={16} />{:else if tab === 'login'}<Mail size={16} />{:else}<UserPlus size={16} />{/if}
        </div>
      </div>

      {#if isChecking}
        <!-- Sci-Fi AI Scanning Console -->
        <div class="flex flex-col items-center justify-center py-8 space-y-5 animate-fade-in text-center font-mono">
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
            <span class="text-[9px] uppercase font-bold text-[#3E6650] tracking-widest block">CaterSync Smart Assistant</span>
            <div class="flex items-center justify-center gap-1.5 text-[9px] text-[#767068] uppercase font-mono">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Setting up your profile...</span>
            </div>
          </div>
        </div>
      {:else if step === 'email'}
        <!-- Google Single Sign-On Option -->
        {#if googleClientId}
          <div class="space-y-2 mb-4">
            <span class="block text-[9px] font-bold text-[#767068] uppercase tracking-widest mb-1.5">Quick Sign In with Google</span>
            <div id="google-btn-customer" class="w-full flex justify-center py-1 bg-white border border-slate-200 dark:border-zinc-800 rounded"></div>
          </div>

          <div class="relative my-5 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-[#767068]/20"></div></div>
            <span class="relative bg-white dark:bg-[#24201E] px-3 text-[9px] font-bold text-[#767068] uppercase font-mono">Or use email code</span>
          </div>
        {/if}

        {#if tab === 'login'}
          <!-- Manual Login (Email -> OTP) -->
          <form onsubmit={checkIdentifier} class="space-y-4">
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="cust-email">Your Email Address</label>
              <input 
                id="cust-email"
                type="email" 
                bind:value={customerContact}
                autocomplete="off"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#3E6650] transition-colors"
                placeholder="name@example.com"
                required
              />
            </div>

            {#if errorMessage}
              <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
                {errorMessage}
              </div>
            {/if}

            <button 
              type="submit"
              disabled={isChecking}
              class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
            >
              Send Access Code <ArrowRight size={13} />
            </button>
          </form>
        {:else}
          <!-- Manual Sign Up (Name, Email, Phone -> OTP) -->
          <form onsubmit={handleManualRegister} class="space-y-4">
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-cust-name">Your Name</label>
              <input 
                id="reg-cust-name"
                type="text" 
                bind:value={regName}
                autocomplete="off"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#3E6650] transition-colors"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-cust-email">Your Email</label>
              <input 
                id="reg-cust-email"
                type="email" 
                bind:value={customerContact}
                autocomplete="off"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#3E6650] transition-colors"
                placeholder="name@example.com"
                required
              />
            </div>

            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-cust-phone">Your Phone Number</label>
              <input 
                id="reg-cust-phone"
                type="tel" 
                bind:value={regPhone}
                autocomplete="off"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#3E6650] transition-colors"
                placeholder="+1 (555) 019-2834"
                required
              />
            </div>

            {#if errorMessage}
              <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
                {errorMessage}
              </div>
            {/if}

            <button 
              type="submit"
              disabled={isChecking}
              class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
            >
              Send Verification Code <ArrowRight size={13} />
            </button>
          </form>
        {/if}
      {:else}
        <!-- OTP Step -->
        <form onsubmit={verifyOtp} class="space-y-4">
          <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2.5 mb-2">
            <button 
              type="button" 
              onclick={goBack}
              class="text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA] transition-colors p-1"
            >
              <ChevronLeft size={16} />
            </button>
            <span class="text-[10px] text-[#767068] truncate font-sans">Email: <span class="text-[#2A2521] dark:text-[#F6F2EA]">{customerContact}</span></span>
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="cust-otp">We sent a 6-digit code to your email. Enter it below:</label>
            <input 
              id="cust-otp"
              type="text" 
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={otpCode}
              oninput={() => { if (otpCode.trim().length === 6 && timerSeconds > 0) verifyOtp(); }}
              class="w-full text-center text-lg font-bold tracking-[0.5em] px-3 py-2.5 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-[#2A2521] dark:text-[#EBE5DC] focus:outline-none focus:border-[#3E6650] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          <div class="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded border border-[#767068]/15 text-[10px] uppercase font-bold text-center select-none font-mono">
            <span class="text-[#767068]">Code Expires In:</span>
            {#if timerSeconds > 0}
              <span class="text-[#3E6650] dark:text-emerald-450 animate-pulse">{Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}</span>
            {:else}
              <span class="text-[#AC3B2A]">Expired</span>
            {/if}
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          {#if successMessage}
            <div class="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-[#3E6650] leading-relaxed flex items-center gap-2">
              <CheckCircle2 size={14} />
              {successMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking || otpCode.trim().length !== 6 || timerSeconds <= 0}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98] disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:text-slate-500"
          >
            Verify and Enter Dashboard <CheckCircle2 size={13} />
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
