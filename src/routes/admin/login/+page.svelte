<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { Lock, ShieldCheck, ArrowRight, ChevronLeft, RefreshCw, CheckCircle2 } from '@lucide/svelte';

  const appState = getCateringContext();

  // 'email' = email entry, 'otp' = code entry
  let step = $state('email');
  let adminEmail = $state('');
  let otpCode = $state('');

  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

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
    const email = adminEmail.trim().toLowerCase();
    if (!email) return;

    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accountType: 'platform_admin' })
      });
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
          email: adminEmail.trim().toLowerCase(),
          otp: code,
          accountType: 'platform_admin'
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        clearInterval(timerInterval);
        appState.currentUser = { ...data.user, userType: 'platform_admin' };
        appState.playStampSound?.();
        successMessage = 'Authorized. Welcome to Admin Console...';
        setTimeout(() => {
          appState.isAuthenticated = true;
          goto(data.redirect || '/admin');
        }, 1500);
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
      if (data.authenticated && data.user?.type === 'platform_admin') {
        appState.isAuthenticated = true;
        goto(data.redirect || '/admin');
      }
    } catch { /* non-fatal */ }
  });
</script>

<svelte:head>
  <title>CaterSync — Admin Console Sign In</title>
  <meta name="description" content="Secure Admin Console login for CaterSync platform managers. Email OTP verification required." />
</svelte:head>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#141210] dark:text-[#EBE5DC] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden transition-colors duration-300">
  <div class="absolute inset-0 bg-[radial-gradient(#ac3b2a/8_1px,transparent_1px)] dark:bg-[radial-gradient(#ac3b2a/5_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-30"></div>

  <div class="max-w-md w-full space-y-6 relative z-10">

    <!-- Header -->
    <div class="text-center">
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#AC3B2A] border border-[#AC3B2A]/40 rounded bg-[#AC3B2A]/5 uppercase">Admin System</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] dark:text-[#EBE5DC] uppercase mt-2">
        CaterSync<span class="text-[#AC3B2A]"> Admin</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Platform Manager Access — Email OTP Required</p>
    </div>

    <!-- Card -->
    <div class="bg-white dark:bg-[#1F1C1A] border border-[#767068]/30 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#AC3B2A]"></div>

      {#if !isChecking && step === 'email'}
        <a
          href="/"
          class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] transition-colors mb-4 no-underline bg-slate-50 dark:bg-zinc-850/60 py-1 px-2 rounded border border-[#767068]/20"
        >
          <ChevronLeft size={12} /> Back to portals
        </a>
      {/if}

      <!-- Card Header -->
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {step === 'otp' ? 'ENTER CODE' : 'MANAGER ACCESS'}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521] dark:text-[#EBE5DC]">
            {step === 'otp' ? 'Verify Your Email' : 'Platform Admin Sign In'}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#767068]/20 text-[#AC3B2A]">
          {#if step === 'otp'}<ShieldCheck size={16} />{:else}<Lock size={16} />{/if}
        </div>
      </div>

      {#if step === 'email'}
        <!-- ── Email Entry ──────────────────────────────────────────────────── -->
        <form onsubmit={sendOtp} class="space-y-4">
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="admin-email">
              Admin Gmail Address
            </label>
            <input
              id="admin-email"
              type="email"
              bind:value={adminEmail}
              autocomplete="email"
              placeholder="admin@catersync.ai"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 focus:outline-none focus:border-[#AC3B2A] transition-colors"
              required
            />
            <p class="text-[9px] text-[#767068] mt-1.5">A 6-digit verification code will be sent to this email.</p>
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-admin-send-code"
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
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
            <span class="text-[10px] text-[#767068] truncate">Code sent to: <span class="text-[#2A2521] dark:text-[#EBE5DC] font-bold">{adminEmail}</span></span>
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="admin-otp">
              Enter the 6-digit code from your Gmail
            </label>
            <input
              id="admin-otp"
              type="text"
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={otpCode}
              oninput={() => { if (otpCode.trim().length === 6 && timerSeconds > 0) verifyOtp(); }}
              class="w-full text-center text-2xl font-bold tracking-[0.6em] px-3 py-3 bg-slate-50 dark:bg-[#141210] border-2 border-slate-300 dark:border-[#767068]/30 rounded text-[#2A2521] dark:text-[#EBE5DC] focus:outline-none focus:border-[#AC3B2A] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          <!-- Countdown -->
          <div class="flex justify-between items-center bg-slate-50 dark:bg-[#141210] p-2.5 rounded border border-[#767068]/15 text-[10px] uppercase font-bold font-mono">
            <span class="text-[#767068]">Code expires in:</span>
            {#if timerSeconds > 0}
              <span class="text-[#AC3B2A] animate-pulse">{Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}</span>
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
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button
            id="btn-admin-verify-otp"
            type="submit"
            disabled={isChecking || otpCode.trim().length !== 6 || timerSeconds <= 0}
            class="w-full py-3 rounded bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 disabled:bg-[#AC3B2A]/40 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            {#if isChecking}
              Verifying...
            {:else}
              Authorize Platform Access <ShieldCheck size={13} />
            {/if}
          </button>

          <button
            id="btn-admin-resend"
            type="button"
            onclick={sendOtp}
            class="w-full text-center text-[10px] text-[#767068] hover:text-[#AC3B2A] uppercase font-bold transition-colors flex items-center justify-center gap-1"
          >
            <RefreshCw size={11} /> Resend Code
          </button>
        </form>
      {/if}
    </div>

    <p class="text-center text-[9px] text-[#767068] tracking-widest uppercase">
      CaterSync Operations Inc. · Admin Console v2 · Email OTP Only
    </p>
  </div>
</div>
