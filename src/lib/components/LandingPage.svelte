<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import BiometricScanner from './BiometricScanner.svelte';
  import { onMount } from 'svelte';
  import { 
    Lock, 
    UserPlus, 
    ChevronRight, 
    Volume2,
    Users
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
    } else {
      loginMessage = '❌ Invalid credentials.';
      appState.playBuzzerSound();
    }
  }

  // Mechanical PIN Dial grid presses
  function pressPinKey(num) {
    if (inputPIN.length >= 4) return;
    appState.playClickSound();
    inputPIN += num;
    
    if (inputPIN.length === 4) {
      setTimeout(() => {
        const correctPIN = appState.registeredPIN || '1234';
        if (inputPIN === correctPIN) {
          appState.isAuthenticated = true;
          appState.showToast("🔓 Access granted");
          appState.playStampSound();
        } else {
          appState.showToast("❌ Incorrect PIN", "error");
          appState.playBuzzerSound();
          inputPIN = '';
        }
      }, 350);
    }
  }

  function clearPIN() {
    appState.playClickSound();
    inputPIN = '';
  }

  function handleBiometricsSuccess() {
    appState.isAuthenticated = true;
    appState.showToast("🧬 Biometric validation granted");
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
        <div class="space-y-4 flex flex-col items-center">
          <!-- Pin Dots Visualizer -->
          <div class="flex gap-4 mb-2">
            {#each Array(4) as _, idx}
              <div class="w-4 h-4 rounded-full border-2 border-[#2A2521] flex items-center justify-center transition-all duration-150">
                {#if inputPIN.length > idx}
                  <div class="w-2 h-2 rounded-full bg-[#2A2521] animate-fade-in"></div>
                {/if}
              </div>
            {/each}
          </div>

          <!-- PIN Dial Grid Keypad -->
          <div class="grid grid-cols-3 gap-3 w-56 font-mono">
            {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
              <button
                type="button"
                onclick={() => pressPinKey(num)}
                class="w-16 h-12 bg-[#F6F2EA]/40 border border-[#767068]/30 hover:bg-[#F6F2EA] hover:border-[#2A2521] text-sm font-bold rounded flex items-center justify-center transition-all cursor-pointer select-none"
              >
                {num}
              </button>
            {/each}
            <button
              type="button"
              onclick={clearPIN}
              class="w-16 h-12 text-[10px] font-bold text-[#AC3B2A] hover:bg-red-50 rounded flex items-center justify-center transition-all cursor-pointer"
            >
              CLEAR
            </button>
            <button
              type="button"
              onclick={() => pressPinKey(0)}
              class="w-16 h-12 bg-[#F6F2EA]/40 border border-[#767068]/30 hover:bg-[#F6F2EA] hover:border-[#2A2521] text-sm font-bold rounded flex items-center justify-center transition-all cursor-pointer select-none"
            >
              0
            </button>
            <div class="w-16 h-12"></div>
          </div>
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

    <!-- Clean Sound Toggle -->
    <div class="flex justify-center">
      <button 
        onclick={() => appState.toggleAudio()} 
        class="text-[10px] font-mono text-[#767068] hover:text-[#2A2521] flex items-center gap-1 bg-white/60 hover:bg-white px-2.5 py-1.5 rounded border border-[#767068]/20 transition-all btn-interactive"
      >
        <Volume2 size={12} class={appState.audioEnabled ? 'text-[#3E6650]' : ''} />
        <span>Sound Effects: {appState.audioEnabled ? 'Active' : 'Muted'}</span>
      </button>
    </div>

  </div>
</div>
