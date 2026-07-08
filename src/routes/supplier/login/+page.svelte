<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Lock, ArrowRight, CheckCircle2, Truck, ClipboardList } from '@lucide/svelte';

  const appState = getCateringContext();

  let tab = $state('login'); // 'login', 'register'
  let email = $state('');
  let password = $state('');
  
  // Registration fields
  let regBusinessName = $state('');
  let regEmail = $state('');
  let regPassword = $state('');

  let isChecking = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Welcome redirect
  function triggerWelcomeRedirect(username) {
    appState.playStampSound();
    successMessage = 'Access granted. Welcome to Supplier Dashboard...';
    setTimeout(() => {
      appState.isAuthenticated = true;
      goto('/');
    }, 1500);
  }

  // Handle Login submission
  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (!email.trim() || !password) return;

    appState.playClickSound();
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/supplier-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password })
      });
      const data = await response.json();

      isChecking = false;

      if (response.ok && data.success) {
        appState.currentUser = {
          ...data.user,
          userType: 'supplier'
        };
        triggerWelcomeRedirect(data.user.username);
      } else {
        appState.playBuzzerSound();
        errorMessage = data.error || 'Invalid email or password.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Connection error: ' + err.message;
    }
  }

  // Handle Registration submission
  async function handleRegister(e) {
    if (e) e.preventDefault();
    if (!regBusinessName.trim() || !regEmail.trim() || !regPassword) return;

    appState.playClickSound();
    isChecking = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetch('/api/auth/register-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: regBusinessName.trim(),
          email: regEmail.trim(),
          password: regPassword
        })
      });
      const data = await response.json();

      isChecking = false;

      if (response.ok && data.success) {
        appState.playStampSound();
        successMessage = 'Registration submitted! Please verify your email to activate account.';
        regBusinessName = '';
        regEmail = '';
        regPassword = '';
        setTimeout(() => {
          tab = 'login';
          successMessage = '';
        }, 3000);
      } else {
        appState.playBuzzerSound();
        errorMessage = data.error || 'Failed to submit registration.';
      }
    } catch (err) {
      isChecking = false;
      appState.playBuzzerSound();
      errorMessage = 'Error submitting registration: ' + err.message;
    }
  }

  onMount(() => {
    appState.initAudio();
  });
</script>

<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] dark:bg-[#1A1816] dark:text-[#EBE5DC] flex flex-col items-center justify-center p-4 font-mono select-none relative overflow-hidden transition-colors duration-300">
  <!-- Subtle line grids -->
  <div class="absolute inset-0 bg-[radial-gradient(#d9a441/6_1px,transparent_1px)] dark:bg-[radial-gradient(#d9a441/4_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-20"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10 animate-fade-in">
    <div>
      <span class="px-2 py-0.5 text-[8px] tracking-[0.2em] font-bold text-[#D9A441] border border-[#D9A441]/40 rounded bg-[#D9A441]/5 uppercase">SUPPLY PORTAL GATEWAY</span>
      <h1 class="text-2xl font-black tracking-tight text-[#2A2521] dark:text-[#EBE5DC] uppercase mt-2">
        CATERSYNC<span class="text-[#D9A441]">-PARTNER</span>
      </h1>
      <p class="text-[9px] text-[#767068] uppercase tracking-widest mt-1">Supplier Commerce Hub</p>
    </div>

    <!-- TABS -->
    <div class="grid grid-cols-2 bg-slate-100 dark:bg-[#25221F] p-0.5 rounded border border-slate-200 dark:border-[#767068]/20 text-[10px] uppercase font-bold text-center">
      <button 
        onclick={() => { appState.playClickSound(); tab = 'login'; errorMessage = ''; successMessage = ''; }}
        class="py-2 rounded transition-all {tab === 'login' ? 'bg-white dark:bg-[#35302C] text-[#D9A441] shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC]'}"
      >
        Sign In
      </button>
      <button 
        onclick={() => { appState.playClickSound(); tab = 'register'; errorMessage = ''; successMessage = ''; }}
        class="py-2 rounded transition-all {tab === 'register' ? 'bg-white dark:bg-[#35302C] text-[#D9A441] shadow' : 'text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC]'}"
      >
        Register Account
      </button>
    </div>

    <div class="bg-white dark:bg-[#1F1C1A] border border-slate-200 dark:border-[#767068]/30 shadow-2xl p-6 md:p-8 rounded text-left relative">
      <!-- Back to selection button -->
      <a 
        href="/"
        onclick={() => appState.playClickSound()}
        class="absolute -top-10 left-0 text-[10px] font-mono font-bold uppercase tracking-wider text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] flex items-center gap-1 transition-colors bg-white/60 dark:bg-[#1F1C1A]/60 py-1.5 px-3 rounded border border-[#767068]/20 no-underline"
      >
        <ChevronLeft size={14} /> Back to Portals
      </a>
      <div class="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-transparent to-[#D9A441]"></div>
      
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="text-[8px] uppercase tracking-widest text-[#767068] font-bold">
            {#if tab === 'login'}PARTNER SECURE LOGIN{:else}PARTNER ENROLLMENT{/if}
          </span>
          <h2 class="text-lg font-bold mt-0.5 text-[#2A2521] dark:text-[#EBE5DC]">
            {#if tab === 'login'}Access Commerce Workspace{:else}Merchant Signup{/if}
          </h2>
        </div>
        <div class="p-2 rounded bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#767068]/20 text-[#D9A441]">
          {#if tab === 'login'}<Lock size={16} />{:else}<Truck size={16} />{/if}
        </div>
      </div>

      {#if tab === 'login'}
        <!-- Login Form -->
        <form onsubmit={handleLogin} class="space-y-4">
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="supplier-email">Merchant Email Address</label>
            <input 
              id="supplier-email"
              type="email" 
              bind:value={email}
              autocomplete="off"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="partner@wholesale.com"
              required
            />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="supplier-pass">Access Password</label>
            <input 
              id="supplier-pass"
              type="password" 
              bind:value={password}
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          {#if successMessage}
            <div class="p-3 rounded bg-[#3D6E52]/10 border border-[#3D6E52]/30 text-xs text-[#3D6E52] leading-relaxed flex items-center gap-1.5">
              <CheckCircle2 size={13} /> {successMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-slate-100 dark:bg-[#35302C] hover:bg-slate-200 dark:hover:bg-[#433D38] border border-slate-300 dark:border-[#D9A441]/50 text-[#2A2521] dark:text-[#D9A441] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Verifying...{:else}Access Hub <ArrowRight size={13} />{/if}
          </button>
        </form>
      {:else}
        <!-- Register Form -->
        <form onsubmit={handleRegister} class="space-y-4">
          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-biz">Registered Business Name</label>
            <input 
              id="reg-biz"
              type="text" 
              bind:value={regBusinessName}
              autocomplete="off"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="Metro Wholesale Foods Inc."
              required
            />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-email">Business Email Address</label>
            <input 
              id="reg-email"
              type="email" 
              bind:value={regEmail}
              autocomplete="off"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="sales@metrowholesale.com"
              required
            />
          </div>

          <div>
            <label class="block text-[9px] font-bold text-[#767068] uppercase mb-1.5" for="reg-pass">Create Account Password</label>
            <input 
              id="reg-pass"
              type="password" 
              bind:value={regPassword}
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#141210] border border-slate-300 dark:border-[#767068]/30 rounded text-xs text-[#2A2521] dark:text-[#EBE5DC] placeholder-slate-400 dark:placeholder-zinc-700 focus:outline-none focus:border-[#D9A441] transition-colors"
              placeholder="Minimum 8 characters"
              required
            />
          </div>

          {#if errorMessage}
            <div class="p-3 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-xs text-[#AC3B2A] leading-relaxed">
              {errorMessage}
            </div>
          {/if}

          {#if successMessage}
            <div class="p-3 rounded bg-[#3D6E52]/10 border border-[#3D6E52]/30 text-xs text-[#3D6E52] leading-relaxed flex items-center gap-1.5">
              <CheckCircle2 size={13} /> {successMessage}
            </div>
          {/if}

          <button 
            type="submit"
            disabled={isChecking}
            class="w-full py-3 rounded bg-slate-100 dark:bg-[#35302C] hover:bg-slate-200 dark:hover:bg-[#433D38] border border-slate-300 dark:border-[#D9A441]/50 text-[#2A2521] dark:text-[#D9A441] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
          >
            {#if isChecking}Submitting Signup...{:else}Enroll Merchant Catalog <ClipboardList size={13} />{/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
