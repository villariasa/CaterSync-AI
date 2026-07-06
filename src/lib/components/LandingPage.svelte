<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import BiometricScanner from './BiometricScanner.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { 
    Lock, 
    UserPlus, 
    ChevronRight, 
    Volume2,
    Users,
    Download
  } from '@lucide/svelte';

  const appState = getCateringContext();

  let activeTab = $state('password'); // password, pin, biometric, register
  let biometricAvailable = $state(false);

  // Password Login Fields
  let username = $state('');
  let password = $state('');
  let loginMessage = $state('');

  // Register Fields
  let regUsername = $state('');
  let regPassword = $state('');
  let regPIN = $state('1234');
  let regMessage = $state('');

  // PIN Access Fields
  let inputPIN = $state('');

  function selectTab(tab) {
    appState.playClickSound();
    activeTab = tab;
    loginMessage = '';
    regMessage = '';
    inputPIN = '';

    if (tab === 'pin') {
      setTimeout(() => {
        const el = document.getElementById('login-pin');
        if (el) el.focus();
      }, 100);
    }
  }

  function handleRegister(e) {
    e.preventDefault();
    if (!regUsername || !regPassword) return;

    appState.playClickSound();
    appState.currentUser = {
      username: regUsername,
      password: regPassword,
      pin: regPIN
    };
    appState.registeredPIN = regPIN;
    regMessage = `✅ Profile "${regUsername}" registered successfully. You can now login.`;
    appState.showToast("👥 User enrolled");
    appState.playStampSound();
    setTimeout(() => {
      activeTab = 'password';
      username = regUsername;
    }, 1200);
  }

  function handlePasswordLogin(e) {
    e.preventDefault();
    appState.playClickSound();

    const user = appState.currentUser || { username: 'admin', password: 'admin' };

    if (username === user.username && password === user.password) {
      appState.isAuthenticated = true;
      appState.showToast(`🔒 Welcome, ${username}`);
      appState.playStampSound();
      goto('/');
    } else {
      loginMessage = '❌ Invalid credentials.';
      appState.playBuzzerSound();
    }
  }

  // Native Keyboard PIN input handler
  function handlePinInput() {
    inputPIN = inputPIN.replace(/[^0-9]/g, '');
    
    if (inputPIN.length === 4) {
      setTimeout(() => {
        const correctPIN = appState.registeredPIN || '1234';
        if (inputPIN === correctPIN) {
          appState.isAuthenticated = true;
          appState.showToast("🔓 Quick access PIN granted");
          appState.playStampSound();
          goto('/');
        } else {
          appState.showToast("❌ Incorrect access PIN", "error");
          appState.playBuzzerSound();
          inputPIN = '';
        }
      }, 350);
    }
  }

  function handleBiometricsSuccess() {
    appState.isAuthenticated = true;
    appState.showToast("🧬 Biometric validation granted");
    goto('/');
  }

  onMount(async () => {
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
  
  <!-- Sleek blueprint grids in the background -->
  <div class="absolute inset-0 bg-[radial-gradient(#767068/10_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40"></div>
  
  <div class="max-w-md w-full text-center space-y-6 relative z-10">
    
    <!-- Clean Header -->
    <div>
      <span class="ticket-stamp">OPERATIONAL SYSTEM</span>
      <h1 class="text-3xl font-black tracking-tighter text-[#2A2521] uppercase leading-none mt-2">
        CaterSync<span class="text-[#3E6650]">-AI</span>
      </h1>
      <p class="text-[10px] font-mono text-[#767068] mt-1.5 uppercase tracking-widest">
        Predictive Operations Console
      </p>
    </div>

    <!-- Centered Access Gate Ticket -->
    <div class="ticket-card bg-white p-6 md:p-8 text-left">
      
      <div class="mb-6 flex justify-between items-start">
        <div>
          <span class="ticket-stamp">SECURITY CONSOLE</span>
          <h2 class="text-xl font-bold mt-1 text-[#2A2521]">Access Gate</h2>
        </div>
        <!-- Tiny lock logo badge -->
        <div class="p-2 rounded bg-slate-50 border border-slate-200">
          <Lock size={16} class="text-[#767068]" />
        </div>
      </div>

      <!-- Navigation Tabs for Login options -->
      <div class="grid gap-1 border-b border-[#767068]/20 pb-3 mb-6 font-mono text-[9px] uppercase tracking-tighter"
           style="grid-template-columns: repeat({biometricAvailable ? 4 : 3}, minmax(0, 1fr));">
        <button 
          onclick={() => selectTab('password')}
          class="py-1 rounded text-center transition-all {activeTab === 'password' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'text-[#767068] hover:bg-[#F6F2EA]'}"
        >
          Password
        </button>
        <button 
          onclick={() => selectTab('pin')}
          class="py-1 rounded text-center transition-all {activeTab === 'pin' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'text-[#767068] hover:bg-[#F6F2EA]'}"
        >
          PIN
        </button>
        {#if biometricAvailable}
          <button 
            onclick={() => selectTab('biometric')}
            class="py-1 rounded text-center transition-all {activeTab === 'biometric' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'text-[#767068] hover:bg-[#F6F2EA]'}"
          >
            Biometric
          </button>
        {/if}
        <button 
          onclick={() => selectTab('register')}
          class="py-1 rounded text-center transition-all {activeTab === 'register' ? 'bg-[#3E6650] text-[#F6F2EA] font-bold' : 'text-[#767068] hover:bg-[#F6F2EA]'}"
        >
          Sign Up
        </button>
      </div>

      <!-- ---------------- PASSWORD TAB ---------------- -->
      {#if activeTab === 'password'}
        <form onsubmit={handlePasswordLogin} class="space-y-4 text-left">
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
          <div>
            <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="login-password">Password</label>
            <input 
              id="login-password"
              type="password" 
              bind:value={password} 
              class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none focus:border-[#3E6650]" 
              placeholder="•••••••• (default: admin)"
              required 
            />
          </div>

          <button 
            type="submit" 
            class="w-full bg-[#2A2521] hover:bg-slate-800 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1"
          >
            Sign In <ChevronRight size={14} />
          </button>

          {#if loginMessage}
            <p class="text-xs font-mono text-[#AC3B2A] text-center mt-2">{loginMessage}</p>
          {/if}
        </form>
      {/if}

      <!-- ---------------- PIN TAB ---------------- -->
      {#if activeTab === 'pin'}
        <div class="space-y-4 text-left">
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
            />
          </div>
          <p class="text-[9px] text-[#767068] font-mono text-center">
            Verification occurs automatically upon entering the 4th digit.
          </p>
        </div>
      {/if}

      <!-- ---------------- BIOMETRIC TAB ---------------- -->
      {#if activeTab === 'biometric'}
        <BiometricScanner 
          onsuccess={handleBiometricsSuccess} 
          oncancel={() => selectTab('password')} 
        />
      {/if}

      <!-- ---------------- REGISTER TAB ---------------- -->
      {#if activeTab === 'register'}
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

          {#if regMessage}
            <p class="text-xs font-mono text-[#3E6650] text-center mt-2 leading-relaxed">{regMessage}</p>
          {/if}
        </form>
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
          onclick={() => appState.executeAppInstall()} 
          class="text-[10px] font-mono text-[#F6F2EA] bg-[#3E6650] hover:bg-[#3E6650]/90 flex items-center gap-1 px-2.5 py-1.5 rounded border border-transparent shadow-sm transition-all btn-interactive"
        >
          <Download size={12} />
          <span>Install App</span>
        </button>
      {/if}
    </div>

    <!-- App Version -->
    <div class="text-center mt-3 text-[10px] font-mono text-[#767068] opacity-75">
      Catersync Console v{appState.version}
    </div>

  </div>
</div>
