<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Lock, ArrowRight, CheckCircle2, ChevronLeft, Mail } from '@lucide/svelte';

  const appState = getCateringContext();

  let step = $state('email'); // 'email', 'otp'
  let customerContact = $state('');
  let otpCode = $state('');

  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Handle email lookup and OTP dispatch
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
          successMessage = 'A login code was sent to your email!';
          step = 'otp';
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
        errorMessage = preAuthData.error || 'Customer profile not found.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Error: ' + err.message;
    }
  }

  // Handle OTP verification and login
  async function verifyOtp(e) {
    if (e) e.preventDefault();
    if (!otpCode.trim()) return;

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
    step = 'email';
    otpCode = '';
    errorMessage = '';
  }

  onMount(() => {
    appState.initAudio();
  });
</script>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden">
  <div class="absolute inset-0 bg-[radial-gradient(#3e6650/8_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none opacity-30"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10 animate-fade-in">
    <div>
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#3E6650] border border-[#3E6650]/40 rounded bg-[#3E6650]/5 uppercase">MARKETPLACE CUSTOMER</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] uppercase mt-2">
        CATERSYNC<span class="text-[#3E6650]">-MEMBER</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Client Access Portal</p>
    </div>

    <div class="bg-white border border-[#767068]/30 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#3E6650]"></div>
      
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {#if step === 'email'}CLIENT IDENTIFIER{:else}VERIFICATION KEY{/if}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521]">
            {#if step === 'email'}Sign In to Member Portal{:else}Enter Login Code{/if}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 border border-slate-200 text-[#3E6650]">
          {#if step === 'email'}<Mail size={16} />{:else}<Lock size={16} />{/if}
        </div>
      </div>

      {#if step === 'email'}
        <form onsubmit={checkIdentifier} class="space-y-4">
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="cust-email">Registered Customer Email</label>
            <input 
              id="cust-email"
              type="email" 
              bind:value={customerContact}
              autocomplete="off"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-[#2A2521] placeholder-slate-400 focus:outline-none focus:border-[#3E6650] transition-colors"
              placeholder="name@example.com"
              required
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 border border-red-200 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Checking Profile...{:else}Request Secure Link <ArrowRight size={13} />{/if}
          </button>
        </form>
      {:else}
        <form onsubmit={verifyOtp} class="space-y-4">
          <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2.5 mb-2">
            <button 
              type="button" 
              onclick={goBack}
              class="text-[#767068] hover:text-[#2A2521] transition-colors p-1"
            >
              <ChevronLeft size={16} />
            </button>
            <span class="text-[10px] text-[#767068] truncate">Email: <span class="text-[#2A2521]">{customerContact}</span></span>
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="cust-otp">Enter 6-Digit Verification Code</label>
            <input 
              id="cust-otp"
              type="text" 
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={otpCode}
              oninput={() => { if (otpCode.trim().length === 6) verifyOtp(); }}
              class="w-full text-center text-lg font-bold tracking-[0.5em] px-3 py-2.5 bg-slate-50 border border-slate-300 rounded text-[#2A2521] focus:outline-none focus:border-[#3E6650] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-red-50 border border-red-200 text-xs text-[#AC3B2A] leading-relaxed">
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
            disabled={isChecking || otpCode.trim().length !== 6}
            class="w-full py-3 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Authenticating...{:else}Authorize Portal Access <CheckCircle2 size={13} />{/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
