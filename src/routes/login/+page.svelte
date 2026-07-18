<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { Lock, ArrowRight, CheckCircle2, ChevronLeft, Mail, UserPlus, RefreshCw } from '@lucide/svelte';
  import VideoLoader from '$lib/components/VideoLoader.svelte';

  const appState = getCateringContext();

  // 'login' = returning user sign-in, 'register' = new customer sign-up
  let tab = $state('login');
  // 'email' = entering email, 'otp' = entering verification code
  let step = $state('email');

  let customerEmail = $state('');
  let regName  = $state(''); // collected at Step 1 for new signups
  let regPhone = $state(''); // collected at Step 1 for new signups

  // Step 3 customer profile form
  let profFullName    = $state('');
  let profPhone       = $state('');
  let profAddress     = $state('');
  let profBirthday    = $state('');
  let profAllergies   = $state([]);
  let profDietaryPrefs = $state([]);

  const ALLERGY_OPTIONS   = ['Nuts', 'Seafood', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Shellfish'];
  const DIETARY_OPTIONS   = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free', 'Keto', 'Low-Sodium'];

  function toggleChip(arr, val) {
    const idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  }

  let otpCode = $state('');
  let isChecking = $state(false);
  let isRedirecting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let greetingMessage = $state('');
  let showGreeting = $state(false);
  let googleClientId = $state('');

  function loadGoogleScript() {
    if (document.getElementById('google-gsi-client-customer')) {
      initializeGoogleButton();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client-customer';
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
      const parentDiv = document.getElementById('google-btn-customer');
      if (parentDiv) {
        window.google.accounts.id.renderButton(
          parentDiv,
          { 
            theme: 'outline', 
            size: 'large', 
            width: parentDiv.offsetWidth || 340, 
            text: tab === 'register' ? 'signup_with' : 'signin_with' 
          }
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
        appState.currentUser = { ...data.customer, userType: 'subscriber' };
        if (data.needsOtp) {
          successMessage = 'Google authenticated. Verification code sent!';
          customerEmail = data.email;
          step = 'otp';
          startCountdown();
          setTimeout(() => successMessage = '', 4000);
        } else {
          appState.playStampSound?.();
          greetingMessage = getGreeting(data.name || data.customer.name);
          showGreeting = true;
          isRedirecting = true;
          setTimeout(() => {
            appState.isAuthenticated = true;
            goto('/portal');
          }, 1800);
        }
      } else {
        appState.playBuzzerSound?.();
        errorMessage = data.error || 'Google Authentication failed.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound?.();
      errorMessage = 'Google auth error: ' + err.message;
    }
  }

  $effect(() => {
    if (googleClientId && tab && step === 'email') {
      setTimeout(() => {
        initializeGoogleButton();
      }, 80);
    }
  });

  // 10 minute countdown
  let timerSeconds = $state(600);
  let timerInterval = null;

  function getGreeting(name) {
    const hour = new Date().getHours();
    const display = name?.split(' ')[0] || 'there';
    if (hour >= 5 && hour < 12) return `Good morning, ${display}! ☀️`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${display}! 🌤️`;
    if (hour >= 17 && hour < 21) return `Good evening, ${display}! 🌇`;
    return `Welcome back, ${display}! 🌙`;
  }

  function startCountdown() {
    clearInterval(timerInterval);
    timerSeconds = 600;
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
      } else {
        clearInterval(timerInterval);
        appState.playBuzzerSound?.();
        errorMessage = 'Verification code has expired. Please go back and request a new one.';
      }
    }, 1000);
  }

  onDestroy(() => clearInterval(timerInterval));

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  async function sendOtp(e) {
    if (e) e.preventDefault();
    const email = customerEmail.trim();
    if (!email) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      if (tab === 'register') {
        // New customer registration — creates minimal account then dispatches OTP
        const regRes = await fetch('/api/auth/register-subscriber', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: regName.trim(), phone: regPhone.trim() })
        });
        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          errorMessage = regData.error || 'Registration failed. Please try again.';
          appState.playBuzzerSound?.();
          return;
        }
        // OTP already sent by register-subscriber — go straight to OTP step
        successMessage = `Verification code sent to ${email}. Check your inbox!`;
        step = 'otp';
        startCountdown();
        setTimeout(() => successMessage = '', 4000);
        return;
      }

      // Sign In: Dispatch OTP via unified send-otp endpoint
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accountType: 'subscriber' })
      });
      const otpData = await otpRes.json();

      if (otpData.success) {
        successMessage = `Verification code sent to ${email}. Check your inbox!`;
        step = 'otp';
        startCountdown();
        setTimeout(() => successMessage = '', 4000);
      } else {
        appState.playBuzzerSound?.();
        errorMessage = otpData.error || 'Failed to send verification code.';
      }
    } catch (err) {
      appState.playBuzzerSound?.();
      errorMessage = 'Connection error: ' + err.message;
    } finally {
      isChecking = false;
    }
  }

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────────
  async function verifyOtp(e) {
    if (e) e.preventDefault();
    const code = otpCode.trim();
    if (!code || code.length !== 6) return;
    if (timerSeconds <= 0) {
      errorMessage = 'Code expired. Please go back and request a new one.';
      appState.playBuzzerSound?.();
      return;
    }

    isChecking = true;
    errorMessage = '';

    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail.trim(),
          otp: code,
          accountType: 'subscriber'
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        clearInterval(timerInterval);

        // New registration → Step 3 profile form
        if (data.needsProfile && tab === 'register') {
          appState.currentUser = { ...data.user, userType: 'subscriber' };
          profFullName = regName.trim();
          profPhone = regPhone.trim();
          step = 'profile';
          errorMessage = '';
          isChecking = false;
          return;
        }

        // Returning login → go directly to portal
        const name = data.customer?.name || data.user?.name || customerEmail;
        appState.currentUser = { ...data.customer, ...data.user, userType: 'subscriber' };
        appState.playStampSound?.();
        greetingMessage = getGreeting(name);
        showGreeting = true;
        isRedirecting = true;
        setTimeout(() => {
          appState.isAuthenticated = true;
          goto('/portal');
        }, 1800);
      } else {
        appState.playBuzzerSound?.();
        errorMessage = data.error || 'Invalid verification code.';
      }
    } catch (err) {
      appState.playBuzzerSound?.();
      errorMessage = 'Verification error: ' + err.message;
    } finally {
      isChecking = false;
    }
  }

  function goBack() {
    appState.playClickSound?.();
    clearInterval(timerInterval);
    step = 'email';
    otpCode = '';
    errorMessage = '';
    successMessage = '';
  }

  // ── Step 3: Submit Customer Profile ─────────────────────────────────────────
  async function submitProfile(e) {
    if (e) e.preventDefault();
    if (!profFullName.trim() || !profPhone.trim()) return;
    isChecking = true;
    errorMessage = '';
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'customer',
          email: customerEmail.trim().toLowerCase(),
          fullName:     profFullName.trim(),
          phone:        profPhone.trim(),
          address:      profAddress.trim() || null,
          birthday:     profBirthday || null,
          allergies:    profAllergies,
          dietaryPrefs: profDietaryPrefs
        })
      });
      const data = await res.json();
      isChecking = false;
      if (res.ok && data.success) {
        appState.currentUser = { ...appState.currentUser, name: profFullName.trim() };
        appState.playStampSound?.();
        greetingMessage = getGreeting(profFullName.trim());
        showGreeting = true;
        isRedirecting = true;
        setTimeout(() => {
          appState.isAuthenticated = true;
          goto('/portal');
        }, 1800);
      } else {
        appState.playBuzzerSound?.();
        errorMessage = data.error || 'Profile submission failed.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound?.();
      errorMessage = 'Error: ' + err.message;
    }
  }

  // ── Persistent session check on mount (Facebook-style) ─────────────────────
  // If user already has a valid session, skip login and redirect immediately.
  onMount(async () => {
    appState.initAudio?.();
    
    // 1. Silent persistent session check
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user?.type === 'subscriber') {
        appState.isAuthenticated = true;
        goto(data.redirect || '/portal');
        return;
      }
    } catch { /* non-fatal */ }

    // 2. Fetch settings for Google Client ID
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
      console.warn("Could not load settings in Customer Portal:", e.message);
    }
  });
</script>

<svelte:head>
  <title>CaterSync — Customer Sign In</title>
  <meta name="description" content="Sign in to the CaterSync Customer Portal to manage your catering event, review menus and billing, and sign your catering agreement." />
</svelte:head>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#1F1B18] dark:text-[#F6F2EA] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden transition-colors duration-300">
  <div class="absolute inset-0 bg-[radial-gradient(#3e6650/8_1px,transparent_1px)] dark:bg-[radial-gradient(#3e6650/4_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none opacity-30"></div>

  <!-- ── Success Greeting Overlay ─────────────────────────────────────────── -->
  {#if showGreeting}
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F6F2EA]/95 dark:bg-[#1A1715]/95 backdrop-blur-sm">
      <div class="text-center space-y-4">
        <div class="text-5xl mb-2 animate-bounce">🍽️</div>
        <h2 class="text-2xl font-black text-[#3E6650] dark:text-emerald-400 tracking-tight">{greetingMessage}</h2>
        <p class="text-[10px] text-[#767068] uppercase tracking-widest">Redirecting to your portal...</p>
        <div class="flex justify-center gap-1 mt-4">
          <span class="w-2 h-2 rounded-full bg-[#3E6650] animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-2 h-2 rounded-full bg-[#3E6650] animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-2 h-2 rounded-full bg-[#3E6650] animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>
    </div>
  {/if}

  <div class="max-w-md w-full space-y-6 relative z-10">

    <!-- Header -->
    <div class="text-center">
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#3E6650] border border-[#3E6650]/40 rounded bg-[#3E6650]/5 uppercase">Customer Area</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] dark:text-white uppercase mt-2">
        CaterSync<span class="text-[#3E6650]"> Client</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Book event caterers and customize menus</p>
    </div>

    <!-- Tabs (only on email step) -->
    {#if step === 'email'}
      <div class="grid grid-cols-2 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded border border-slate-200 dark:border-zinc-700 text-[10px] uppercase font-bold text-center">
        <button
          id="tab-sign-in"
          onclick={() => { appState.playClickSound?.(); tab = 'login'; errorMessage = ''; }}
          class="py-2 rounded transition-all {tab === 'login' ? 'bg-white dark:bg-zinc-900 text-[#3E6650] shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA]'}"
        >Sign In</button>
        <button
          id="tab-register"
          onclick={() => { appState.playClickSound?.(); tab = 'register'; errorMessage = ''; }}
          class="py-2 rounded transition-all {tab === 'register' ? 'bg-white dark:bg-zinc-900 text-[#3E6650] shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA]'}"
        >Create Account</button>
      </div>
    {/if}

    <!-- Main Card -->
    <div class="bg-white dark:bg-[#24201E] border border-[#767068]/30 dark:border-zinc-800 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#3E6650]"></div>

      {#if !isChecking && step === 'email'}
        <a
          href="/"
          class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA] transition-colors mb-4 no-underline bg-slate-50 dark:bg-zinc-800/60 py-1 px-2 rounded border border-[#767068]/20"
        >
          <ChevronLeft size={12} /> Back to portals
        </a>
      {/if}

      <!-- Card Header -->
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {#if step === 'profile'}PROFILE SETUP{:else if step === 'otp'}ENTER CODE{:else if tab === 'login'}SIGN IN{:else}SIGN UP{/if}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521] dark:text-[#F6F2EA]">
            {#if step === 'profile'}Complete your profile{:else if step === 'otp'}Verify your email{:else if tab === 'login'}Welcome back! Sign in{:else}Join CaterSync today{/if}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-zinc-800 text-[#3E6650]">
          {#if step === 'profile'}<UserPlus size={16} />{:else if step === 'otp'}<Lock size={16} />{:else if tab === 'login'}<Mail size={16} />{:else}<UserPlus size={16} />{/if}
        </div>
      </div>

      {#if isChecking}
        <VideoLoader message="Authenticating..." />

      {:else if step === 'email'}
        <!-- Google Single Sign-On Option -->
        {#if googleClientId}
          <div class="space-y-2 mb-4 animate-fade-in text-left">
            <span class="block text-[9px] font-bold text-[#767068] uppercase tracking-widest">Marketplace One-Tap Identity</span>
            <div id="google-btn-customer" class="w-full flex justify-center py-1 bg-white border border-slate-200 dark:border-zinc-800 rounded min-h-[45px]"></div>
          </div>

          <div class="relative my-4 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-[#767068]/20"></div></div>
            <span class="relative bg-white dark:bg-[#24201E] px-3 text-[9px] font-bold text-[#767068] uppercase font-mono">Or Manual Method</span>
          </div>
        {/if}

        <!-- ── Email Entry Step ──────────────────────────────────────────────── -->
        <form onsubmit={sendOtp} class="space-y-4">

          {#if tab === 'register'}
            <!-- Name -->
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-name">
                Full Name <span class="text-[#AC3B2A]">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                bind:value={regName}
                placeholder="Juan dela Cruz"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
                required
              />
            </div>
            <!-- Phone -->
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-phone">
                Phone Number <span class="text-[#AC3B2A]">*</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                bind:value={regPhone}
                placeholder="09171234567"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
                required
              />
            </div>
            <!-- Email -->
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="cust-email-reg">
                Gmail Address <span class="text-[#AC3B2A]">*</span>
              </label>
              <input
                id="cust-email-reg"
                type="email"
                bind:value={customerEmail}
                autocomplete="email"
                placeholder="name@gmail.com"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
                required
              />
              <p class="text-[9px] text-[#767068] mt-1.5">We'll send a 6-digit verification code to confirm your email.</p>
            </div>
          {:else}
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="cust-email">
                Your Gmail Address
              </label>
              <input
                id="cust-email"
                type="email"
                bind:value={customerEmail}
                autocomplete="email"
                placeholder="name@gmail.com"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
                required
              />
              <p class="text-[9px] text-[#767068] mt-1.5">We'll send a 6-digit code to this Gmail address.</p>
            </div>
          {/if}

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-send-code"
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            {tab === 'register' ? 'Send Verification Code' : 'Send Verification Code'} <ArrowRight size={13} />
          </button>
        </form>


      {:else if step === 'otp'}
        <!-- ── OTP Entry Step ────────────────────────────────────────────────── -->
        <form onsubmit={verifyOtp} class="space-y-4">
          <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2.5 mb-2">
            <button type="button" onclick={goBack} class="text-[#767068] hover:text-[#2A2521] dark:hover:text-[#F6F2EA] transition-colors p-1">
              <ChevronLeft size={16} />
            </button>
            <span class="text-[10px] text-[#767068] truncate">Code sent to: <span class="text-[#2A2521] dark:text-[#F6F2EA] font-bold">{customerEmail}</span></span>
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="cust-otp">
              Enter the 6-digit code from your Gmail
            </label>
            <input
              id="cust-otp"
              type="text"
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={otpCode}
              oninput={() => { if (otpCode.trim().length === 6 && timerSeconds > 0) verifyOtp(); }}
              class="w-full text-center text-2xl font-bold tracking-[0.6em] px-3 py-3 bg-slate-50 dark:bg-[#141210] border-2 border-slate-300 dark:border-zinc-700 rounded text-[#2A2521] dark:text-[#EBE5DC] focus:outline-none focus:border-[#3E6650] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          <!-- Countdown -->
          <div class="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded border border-[#767068]/15 text-[10px] uppercase font-bold font-mono">
            <span class="text-[#767068]">Code expires in:</span>
            {#if timerSeconds > 0}
              <span class="text-[#3E6650] animate-pulse">{Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}</span>
            {:else}
              <span class="text-[#AC3B2A]">Expired</span>
            {/if}
          </div>

          {#if successMessage}
            <div class="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-[#3E6650] leading-relaxed flex items-center gap-2">
              <CheckCircle2 size={14} /> {successMessage}
            </div>
          {/if}

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-verify-otp"
            type="submit"
            disabled={isChecking || otpCode.trim().length !== 6 || timerSeconds <= 0}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:text-slate-500"
          >
            {#if isChecking}Verifying...{:else}Verify & Enter Portal <CheckCircle2 size={13} />{/if}
          </button>

          <button
            id="btn-resend-code"
            type="button"
            onclick={sendOtp}
            class="w-full text-center text-[10px] text-[#767068] hover:text-[#3E6650] uppercase font-bold transition-colors flex items-center justify-center gap-1"
          >
            <RefreshCw size={11} /> Resend Code
          </button>
        </form>

      <!-- ══ STEP 3: CUSTOMER PROFILE FORM ════════════════════════════════════ -->
      {:else if step === 'profile'}
        <!-- Progress indicator -->
        <div class="flex items-center gap-2 mb-5">
          <div class="flex items-center gap-1 text-[9px] text-[#767068] uppercase font-bold">
            <span class="w-5 h-5 rounded-full bg-[#3E6650]/20 border border-[#3E6650] flex items-center justify-center text-[8px] font-black text-[#3E6650]">✓</span>
            Email
          </div>
          <div class="flex-1 h-px bg-[#3E6650]/40"></div>
          <div class="flex items-center gap-1 text-[9px] text-[#767068] uppercase font-bold">
            <span class="w-5 h-5 rounded-full bg-[#3E6650]/20 border border-[#3E6650] flex items-center justify-center text-[8px] font-black text-[#3E6650]">✓</span>
            Verified
          </div>
          <div class="flex-1 h-px bg-[#3E6650]/40"></div>
          <div class="flex items-center gap-1 text-[9px] text-[#3E6650] uppercase font-bold">
            <span class="w-5 h-5 rounded-full bg-[#3E6650] flex items-center justify-center text-[8px] font-black text-white">3</span>
            Profile
          </div>
        </div>

        <p class="text-[10px] text-[#767068] mb-4 leading-relaxed">
          Almost done! Tell us a bit about yourself so we can personalize your catering experience.
        </p>

        <form onsubmit={submitProfile} class="space-y-4">

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="pf-name">
              Full Name <span class="text-[#AC3B2A]">*</span>
            </label>
            <input id="pf-name" type="text" bind:value={profFullName}
              placeholder="Juan dela Cruz"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
              required />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="pf-phone">
              Phone Number <span class="text-[#AC3B2A]">*</span>
            </label>
            <input id="pf-phone" type="tel" bind:value={profPhone}
              placeholder="+63 917 123 4567"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
              required />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="pf-address">Address</label>
            <input id="pf-address" type="text" bind:value={profAddress}
              placeholder="Street, Barangay, City (optional)"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors" />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="pf-bday">Birthday</label>
            <input id="pf-bday" type="date" bind:value={profBirthday}
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-zinc-800 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] focus:outline-none focus:border-[#3E6650] transition-colors" />
          </div>

          <!-- Dietary Preferences (chip multi-select) -->
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-2">Dietary Preferences</label>
            <div class="flex flex-wrap gap-1.5">
              {#each DIETARY_OPTIONS as opt}
                <button
                  type="button"
                  onclick={() => { toggleChip(profDietaryPrefs, opt); profDietaryPrefs = [...profDietaryPrefs]; }}
                  class="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border transition-all
                    {profDietaryPrefs.includes(opt)
                      ? 'bg-[#3E6650] border-[#3E6650] text-white'
                      : 'bg-slate-50 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-[#767068] hover:border-[#3E6650]'}"
                >{opt}</button>
              {/each}
            </div>
          </div>

          <!-- Allergies (chip multi-select) -->
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-2">Allergies</label>
            <div class="flex flex-wrap gap-1.5">
              {#each ALLERGY_OPTIONS as opt}
                <button
                  type="button"
                  onclick={() => { toggleChip(profAllergies, opt); profAllergies = [...profAllergies]; }}
                  class="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border transition-all
                    {profAllergies.includes(opt)
                      ? 'bg-[#AC3B2A] border-[#AC3B2A] text-white'
                      : 'bg-slate-50 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-[#767068] hover:border-[#AC3B2A]'}"
                >{opt}</button>
              {/each}
            </div>
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">{errorMessage}</div>
          {/if}

          <button
            id="btn-cust-complete-profile"
            type="submit"
            disabled={isChecking || !profFullName.trim() || !profPhone.trim()}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:bg-slate-300"
          >
            {#if isChecking}Saving Profile...{:else}Complete & Enter Portal <ArrowRight size={13} />{/if}
          </button>
        </form>
      {/if}
    </div>

    <p class="text-center text-[9px] text-[#767068] tracking-widest uppercase">
      CaterSync Operations Inc. · Customer Portal v2
    </p>
  </div>
</div>
