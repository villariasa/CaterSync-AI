<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { Truck, ShieldCheck, ArrowRight, ChevronLeft, RefreshCw, CheckCircle2, Mail } from '@lucide/svelte';

  const appState = getCateringContext();

  // 'login' = login, 'register' = signup
  let tab = $state('login');
  let regName = $state('');

  // 'email' = email entry, 'otp' = code entry
  let step = $state('email');
  let supplierEmail = $state('');
  let otpCode = $state('');

  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  let showGreeting = $state(false);
  let greetingName = $state('');

  // 10-minute OTP timer
  let timerSeconds = $state(600);
  let timerInterval = null;

  function startCountdown() {
    clearInterval(timerInterval);
    timerSeconds = 600;
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--;
      } else {
        clearInterval(timerInterval);
        appState.playBuzzerSound?.();
        errorMessage = 'Verification code expired. Please request a new one.';
      }
    }, 1000);
  }

  onDestroy(() => clearInterval(timerInterval));

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  async function sendOtp(e) {
    if (e) e.preventDefault();
    const email = supplierEmail.trim().toLowerCase();
    if (!email) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      let res;
      if (tab === 'register') {
        res = await fetch('/api/auth/register-supplier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: regName.trim() })
        });
      } else {
        res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, accountType: 'supplier' })
        });
      }

      const data = await res.json();

      if (data.success) {
        successMessage = `Verification code sent to ${email}`;
        step = 'otp';
        startCountdown();
        setTimeout(() => successMessage = '', 4000);
      } else {
        appState.playBuzzerSound?.();
        errorMessage = data.error || 'Failed to send verification code.';
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
      errorMessage = 'Code expired. Please request a new one.';
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
          email: supplierEmail.trim().toLowerCase(),
          otp: code,
          accountType: 'supplier'
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        clearInterval(timerInterval);
        appState.currentUser = { ...data.user, userType: 'supplier' };
        appState.playStampSound?.();

        greetingName = data.user?.name || supplierEmail;
        showGreeting = true;
        setTimeout(() => {
          appState.isAuthenticated = true;
          goto(data.redirect || '/supplier');
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

  // ── Persistent session check (Facebook-style) ───────────────────────────────
  onMount(async () => {
    appState.initAudio?.();
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user?.type === 'supplier') {
        appState.isAuthenticated = true;
        goto(data.redirect || '/supplier');
      }
    } catch { /* non-fatal */ }
  });
</script>

<svelte:head>
  <title>CaterSync — Supplier Hub Sign In</title>
  <meta name="description" content="Supplier Hub login for CaterSync partner vendors. Email OTP verification required." />
</svelte:head>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#1A1714] dark:text-[#EBE5DC] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden transition-colors duration-300">
  <div class="absolute inset-0 bg-[radial-gradient(#D9A441/8_1px,transparent_1px)] dark:bg-[radial-gradient(#D9A441/4_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-25"></div>

  <!-- Greeting Overlay -->
  {#if showGreeting}
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F6F2EA]/95 dark:bg-[#1A1714]/95 backdrop-blur-sm">
      <div class="text-center space-y-4">
        <div class="text-5xl mb-2 animate-bounce">📦</div>
        <h2 class="text-2xl font-black text-[#D9A441] tracking-tight">Welcome back, {greetingName.split(' ')[0]}!</h2>
        <p class="text-[10px] text-[#767068] uppercase tracking-widest">Redirecting to Supplier Hub...</p>
        <div class="flex justify-center gap-1 mt-4">
          <span class="w-2 h-2 rounded-full bg-[#D9A441] animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-2 h-2 rounded-full bg-[#D9A441] animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-2 h-2 rounded-full bg-[#D9A441] animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>
    </div>
  {/if}

  <div class="max-w-md w-full space-y-6 relative z-10">

    <!-- Header -->
    <div class="text-center">
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#D9A441] border border-[#D9A441]/40 rounded bg-[#D9A441]/5 uppercase">Supplier Hub</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] dark:text-[#EBE5DC] uppercase mt-2">
        CaterSync<span class="text-[#D9A441]"> Supplier</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Vendor & Supply Partner Access</p>
    </div>

    <!-- Card -->
    <div class="bg-white dark:bg-[#201D1A] border border-[#767068]/30 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#D9A441]"></div>

      {#if !isChecking && step === 'email'}
        <a
          href="/"
          class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] transition-colors mb-4 no-underline bg-slate-50 dark:bg-zinc-800/40 py-1 px-2 rounded border border-[#767068]/20"
        >
          <ChevronLeft size={12} /> Back to portals
        </a>
      {/if}

      <!-- Card Header -->
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {step === 'otp' ? 'ENTER CODE' : 'VENDOR ACCESS'}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521] dark:text-[#EBE5DC]">
            {step === 'otp' ? 'Verify Your Email' : 'Supplier Hub Sign In'}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#767068]/20 text-[#D9A441]">
          {#if step === 'otp'}<ShieldCheck size={16} />{:else}<Truck size={16} />{/if}
        </div>
      </div>

      {#if step === 'email'}
        <!-- Tabs: Login vs Register -->
        <div class="flex border-b border-[#767068]/15 mb-4">
          <button 
            type="button"
            onclick={() => { appState.playClickSound?.(); tab = 'login'; errorMessage = ''; }}
            class="flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 font-mono {tab === 'login' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
          >
            Sign In
          </button>
          <button 
            type="button"
            onclick={() => { appState.playClickSound?.(); tab = 'register'; errorMessage = ''; }}
            class="flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 font-mono {tab === 'register' ? 'border-[#D9A441] text-[#D9A441]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
          >
            Sign Up
          </button>
        </div>

        <!-- ── Email / Reg Entry ────────────────────────────────────────────── -->
        <form onsubmit={sendOtp} class="space-y-4">
          {#if tab === 'register'}
            <div>
              <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="supplier-name">
                Supplier Company Name
              </label>
              <input
                id="supplier-name"
                type="text"
                bind:value={regName}
                placeholder="e.g. Acme Fresh Foods"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#D9A441] transition-colors"
                required
              />
            </div>
          {/if}

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="supplier-email">
              Gmail Address
            </label>
            <input
              id="supplier-email"
              type="email"
              bind:value={supplierEmail}
              autocomplete="email"
              placeholder="supplier@example.com"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#D9A441] transition-colors"
              required
            />
            <p class="text-[9px] text-[#767068] mt-1.5">We'll send a 6-digit code to this email address.</p>
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-supplier-send-code"
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-[#D9A441] hover:bg-[#D9A441]/90 disabled:bg-slate-300 text-[#1F1B18] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            {#if isChecking}
              Sending Code...
            {:else}
              Send Verification Code <ArrowRight size={13} />
            {/if}
          </button>
        </form>

      {:else}
        <!-- ── OTP Entry ────────────────────────────────────────────────────── -->
        <form onsubmit={verifyOtp} class="space-y-4">
          <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2.5 mb-2">
            <button type="button" onclick={goBack} class="text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] transition-colors p-1">
              <ChevronLeft size={16} />
            </button>
            <span class="text-[10px] text-[#767068] truncate">Code sent to: <span class="text-[#2A2521] dark:text-[#EBE5DC] font-bold">{supplierEmail}</span></span>
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="supplier-otp">
              Enter the 6-digit code from your Gmail
            </label>
            <input
              id="supplier-otp"
              type="text"
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={otpCode}
              oninput={() => { if (otpCode.trim().length === 6 && timerSeconds > 0) verifyOtp(); }}
              class="w-full text-center text-2xl font-bold tracking-[0.6em] px-3 py-3 bg-slate-50 dark:bg-[#141210] border-2 border-slate-300 dark:border-[#767068]/30 rounded text-[#2A2521] dark:text-[#EBE5DC] focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          <!-- Countdown -->
          <div class="flex justify-between items-center bg-slate-50 dark:bg-[#141210] p-2.5 rounded border border-[#767068]/15 text-[10px] uppercase font-bold font-mono">
            <span class="text-[#767068]">Code expires in:</span>
            {#if timerSeconds > 0}
              <span class="text-[#D9A441] animate-pulse">{Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}</span>
            {:else}
              <span class="text-[#AC3B2A]">Expired</span>
            {/if}
          </div>

          {#if successMessage}
            <div class="p-3 rounded bg-[#3E6650]/10 border border-[#3E6650]/30 text-xs text-[#3E6650] flex items-center gap-2">
              <CheckCircle2 size={14} /> {successMessage}
            </div>
          {/if}

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 dark:bg-[#AC3B2A]/10 border border-red-200 dark:border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-supplier-verify-otp"
            type="submit"
            disabled={isChecking || otpCode.trim().length !== 6 || timerSeconds <= 0}
            class="w-full py-3 rounded bg-[#D9A441] hover:bg-[#D9A441]/90 disabled:bg-[#D9A441]/40 text-[#1F1B18] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            Access Supplier Hub <ShieldCheck size={13} />
          </button>

          <button
            id="btn-supplier-resend"
            type="button"
            onclick={sendOtp}
            class="w-full text-center text-[10px] text-[#767068] hover:text-[#D9A441] uppercase font-bold transition-colors flex items-center justify-center gap-1"
          >
            <RefreshCw size={11} /> Resend Code
          </button>
        </form>
      {/if}
    </div>

    <p class="text-center text-[9px] text-[#767068] tracking-widest uppercase">
      CaterSync Operations Inc. · Supplier Hub v2 · Email OTP Only
    </p>
  </div>
</div>
