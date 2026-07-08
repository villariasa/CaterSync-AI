<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Lock, ShieldAlert, KeyRound, ChevronLeft, ArrowRight, CheckCircle2, QrCode } from '@lucide/svelte';

  const appState = getCateringContext();

  let step = $state(1); // 1 = Credentials, 2 = TOTP Verification
  let identifier = $state('');
  let password = $state('');
  let totpToken = $state('');
  
  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');
  
  let availableMethods = $state([]);
  let totpSetupSecret = $state('');
  let totpSetupQrUrl = $state('');
  let userType = $state('platform_admin');

  // Trigger login redirect
  function triggerWelcomeRedirect(username) {
    appState.playStampSound();
    successMessage = 'Authorized. Welcome to Platform Admin Console...';
    setTimeout(() => {
      appState.isAuthenticated = true;
      goto('/');
    }, 1500);
  }

  // Step 1: Submit email/username and password
  async function handleCredentialsSubmit(e) {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password) return;

    appState.playClickSound();
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      // 1. Fetch pre-auth options to check user type and 2FA status
      const preAuthRes = await fetch('/api/auth/pre-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim() })
      });
      const preAuthData = await preAuthRes.json();

      if (!preAuthRes.ok || !preAuthData.success || preAuthData.userType !== 'platform_admin') {
        appState.playBuzzerSound();
        errorMessage = 'Unauthorized. Invalid Platform Admin credentials.';
        isChecking = false;
        return;
      }

      availableMethods = preAuthData.methods;
      if (preAuthData.totpSetup) {
        totpSetupSecret = preAuthData.totpSetup.secret;
        totpSetupQrUrl = preAuthData.totpSetup.qrCodeUrl;
      }

      // 2. Validate password
      const loginRes = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim(), password })
      });
      const loginData = await loginRes.json();

      isChecking = false;

      if (loginRes.ok && loginData.success) {
        appState.currentUser = loginData.user;
        step = 2; // Advance to TOTP verification
      } else {
        appState.playBuzzerSound();
        errorMessage = loginData.error || 'Invalid credentials.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Connection error: ' + err.message;
    }
  }

  // Step 2: Verify TOTP code
  async function handleTotpSubmit(e) {
    if (e) e.preventDefault();
    if (totpToken.trim().length !== 6) return;

    appState.playClickSound();
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const verifyRes = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: identifier.trim(),
          token: totpToken.trim(),
          userType: 'platform_admin',
          setupSecret: availableMethods.includes('totp-setup') ? totpSetupSecret : undefined
        })
      });
      const verifyData = await verifyRes.json();

      isChecking = false;

      if (verifyRes.ok && verifyData.success) {
        appState.currentUser = {
          ...verifyData.user,
          userType: 'platform_admin'
        };
        triggerWelcomeRedirect(verifyData.user.username);
      } else {
        appState.playBuzzerSound();
        errorMessage = verifyData.error || 'Verification code failed.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Verification error: ' + err.message;
    }
  }

  function goBack() {
    appState.playClickSound();
    step = 1;
    totpToken = '';
    errorMessage = '';
  }

  onMount(() => {
    appState.initAudio();
  });
</script>

<div class="min-h-screen bg-[#141210] text-[#EBE5DC] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden">
  <!-- Glowing hacker grids -->
  <div class="absolute inset-0 bg-[radial-gradient(#ac3b2a/5_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-30"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10 animate-fade-in">
    <div>
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#AC3B2A] border border-[#AC3B2A]/40 rounded bg-[#AC3B2A]/5 uppercase">SYSTEM KERNEL SECURITY</span>
      <h1 class="text-2xl font-black tracking-tight text-[#EBE5DC] uppercase mt-2">
        CATERSYNC<span class="text-[#AC3B2A]">-ADMIN</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Platform Operations Gateway</p>
    </div>

    <div class="bg-[#1F1C1A] border border-[#767068]/30 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#AC3B2A]"></div>
      
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">AUTHENTICATION</span>
          <h2 class="text-lg font-bold mt-0.5 text-[#EBE5DC]">
            {#if step === 1}Credentials Gate{:else}2FA Security Key{/if}
          </h2>
        </div>
        <div class="p-2 rounded bg-[#141210] border border-[#767068]/20 text-[#AC3B2A]">
          <Lock size={16} />
        </div>
      </div>

      {#if step === 1}
        <!-- Step 1 Form -->
        <form onsubmit={handleCredentialsSubmit} class="space-y-4">
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="admin-email">Admin Email / Username</label>
            <input 
              id="admin-email"
              type="text" 
              bind:value={identifier}
              autocomplete="off"
              class="w-full px-3 py-2 bg-[#141210] border border-[#767068]/30 rounded text-xs text-[#EBE5DC] placeholder-zinc-700 focus:outline-none focus:border-[#AC3B2A] transition-colors"
              placeholder="admin@catersync.ai"
              required
            />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="admin-pass">Access Password</label>
            <input 
              id="admin-pass"
              type="password" 
              bind:value={password}
              class="w-full px-3 py-2 bg-[#141210] border border-[#767068]/30 rounded text-xs text-[#EBE5DC] placeholder-zinc-700 focus:outline-none focus:border-[#AC3B2A] transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 disabled:bg-[#AC3B2A]/50 text-[#F6F2EA] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Checking Credentials...{:else}Next Verification <ArrowRight size={13} />{/if}
          </button>
        </form>
      {:else}
        <!-- Step 2 Form (TOTP Check) -->
        <form onsubmit={handleTotpSubmit} class="space-y-4">
          <div class="flex items-center gap-1.5 border-b border-[#767068]/15 pb-2.5 mb-2">
            <button 
              type="button" 
              onclick={goBack}
              class="text-[#767068] hover:text-[#EBE5DC] transition-colors p-1"
            >
              <ChevronLeft size={16} />
            </button>
            <span class="text-[10px] text-[#767068] truncate">Admin User: <span class="text-[#EBE5DC]">{identifier}</span></span>
          </div>

          {#if availableMethods.includes('totp-setup')}
            <!-- TOTP Setup Wizard -->
            <div class="space-y-4 p-4 rounded bg-[#141210] border border-[#767068]/20 text-center select-text">
              <div class="flex justify-center mb-1">
                {#if totpSetupQrUrl}
                  <img src={totpSetupQrUrl} alt="2FA QR Code" class="w-40 h-40 border border-white p-2 rounded bg-white" />
                {:else}
                  <div class="w-40 h-40 bg-[#1F1C1A] border border-[#767068]/20 flex items-center justify-center text-[#767068]">
                    <QrCode size={40} />
                  </div>
                {/if}
              </div>
              <p class="text-[9px] leading-relaxed text-[#767068]">
                Scan the QR code above in Google Authenticator or manual enter secret key below:
              </p>
              <div class="bg-[#1F1C1A] py-1.5 px-3 rounded text-[10px] select-all break-all border border-[#767068]/15 text-[#AC3B2A] font-bold font-mono">
                {totpSetupSecret}
              </div>
            </div>
          {/if}

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5 text-center" for="totp-input">Enter 6-Digit Authenticator Token</label>
            <input 
              id="totp-input"
              type="text" 
              pattern="[0-9]*"
              inputmode="numeric"
              maxlength="6"
              bind:value={totpToken}
              oninput={() => { if (totpToken.trim().length === 6) handleTotpSubmit(); }}
              class="w-full text-center text-lg font-bold tracking-[0.5em] px-3 py-2.5 bg-[#141210] border border-[#767068]/30 rounded text-[#EBE5DC] focus:outline-none focus:border-[#AC3B2A] transition-colors"
              placeholder="000000"
              required
              autofocus
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          {#if successMessage}
            <div class="p-3 rounded bg-[#3E6650]/15 border border-[#3E6650]/30 text-xs text-[#3E6650] leading-relaxed flex items-center gap-2">
              <CheckCircle2 size={14} />
              {successMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking || totpToken.trim().length !== 6}
            class="w-full py-3 rounded bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 disabled:bg-[#AC3B2A]/40 text-[#F6F2EA] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Verifying Key...{:else}Authorize Platform Access <KeyRound size={13} />{/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
