<script>
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import { onMount } from 'svelte';
  import { 
    LayoutDashboard, 
    UtensilsCrossed, 
    Users, 
    Package, 
    ChefHat, 
    Wallet, 
    Volume2, 
    VolumeX, 
    Settings,
    FileText,
    Download,
    LogOut,
    Menu,
    X
  } from '@lucide/svelte';
  import { page } from '$app/state';
  import { CateringState, setCateringContext } from '$lib/states.svelte.js';

  let { data, children } = $props();

  // Create the shared Svelte 5 context state
  const appState = new CateringState(data);
  setCateringContext(appState);

  let currentDateTime = $state('');
  let showLogoutModal = $state(false);
  let showUpdateModal = $state(false);
  let autoUpdateEnabled = $state(false);
  let swRegistration = $state(null);
  let showMobileMenu = $state(false);

  function handleLogoutClick() {
    appState.playClickSound();
    showLogoutModal = true;
  }

  function triggerAppUpdate() {
    appState.playClickSound();
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    showUpdateModal = false;
  }

  function toggleAutoUpdate() {
    appState.playClickSound();
    localStorage.setItem('catersync_auto_update', autoUpdateEnabled ? 'true' : 'false');
  }

  onMount(() => {
    // Set sound enabled if settings default is active
    if (appState.settings.sound_enabled_default) {
      appState.audioEnabled = true;
    }

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
      autoUpdateEnabled = localStorage.getItem('catersync_auto_update') === 'true';

      navigator.serviceWorker.register('/service-worker.js', { type: 'module' })
        .then((reg) => {
          console.log("Service Worker registered.");
          swRegistration = reg;

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // Trigger modal only if there was a previous active controller
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

                  if (autoUpdateEnabled) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  } else if (isStandalone) {
                    showUpdateModal = true;

                    // Trigger device system notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                      reg.showNotification("🚀 CaterSync Upgrade Ready", {
                        body: "Tap here to reload the console and activate the latest update.",
                        icon: "/favicon.svg",
                        tag: "catersync-update",
                        renotify: true,
                        data: { url: '/' }
                      });
                    }
                  } else {
                    // Update silently on normal web browsers without modal popups
                    console.log("Web client: applying SW update silently.");
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  }
                }
              });
            }
          });
        })
        .catch((err) => console.warn("Service Worker registration failed:", err));

      let refreshing = false;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Listen to browser PWA install availability
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      appState.deferredPrompt = e;
      appState.pwaInstallable = true;
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // Request permissions for standard local notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const updateClock = () => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const dy = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      currentDateTime = `${yr}-${mo}-${dy} ${hr}:${mi}`;
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    // Periodic simulation push notifications to highlight capability
    const notificationInterval = setInterval(() => {
      if (appState.isAuthenticated && Math.random() > 0.6) {
        const triggers = [
          { title: "⚠️ Low Stock Alert", body: "Depot alert: Jasmine Rice supply crossed minimum threshold safety limits!" },
          { title: "⏱️ Prep Scheduler Solved", body: "Job-shop solver successfully calculated task precedence for Event #048." },
          { title: "💰 Profit Margin Flushed", body: "Isolation Forest flagged cost anomaly on Classic Filipino Feast. Ingredient ratios over target." }
        ];
        const match = triggers[Math.floor(Math.random() * triggers.length)];
        appState.triggerSystemNotification(match.title, match.body);
      }
    }, 45000);

    return () => {
      clearInterval(interval);
      clearInterval(notificationInterval);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  });

  // Helper to determine if tab route is active
  function isRouteActive(path) {
    if (path === '/') {
      return page.url.pathname === '/';
    }
    return page.url.pathname.startsWith(path);
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<!-- TOAST CONTAINER -->
<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
  {#each appState.toasts as t (t.id)}
    <div class="p-3.5 bg-[#2A2521] text-[#F6F2EA] text-xs font-mono rounded shadow-lg border-l-4 pointer-events-auto transition-all duration-300 flex items-center justify-between gap-3 animate-slide-up {t.type === 'error' ? 'border-[#AC3B2A]' : (t.type === 'info' ? 'border-[#D9A441]' : 'border-[#3E6650]')}">
      <span>{t.message}</span>
      <button class="text-slate-500 hover:text-white font-bold" onclick={() => appState.toasts = appState.toasts.filter(toast => toast.id !== t.id)}>×</button>
    </div>
  {/each}
</div>

{#if !appState.isAuthenticated}
  <LandingPage />
{:else}
  <!-- Outer Market Ledger container -->
  <div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] flex flex-col antialiased">
    
    <!-- STICKY HEADER & NAV CONTAINER -->
    <div class="sticky top-0 z-30 bg-[#F6F2EA]/90 backdrop-blur-md border-b border-[#767068]/30 animate-fade-in">
      <!-- TOP BAR -->
      <header class="px-4 sm:px-6 py-3 flex items-center justify-between bg-white/50">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <!-- Minimalist receipt stamp logo -->
          <div class="hidden sm:block px-2.5 py-1 border-2 border-[#2A2521] font-mono text-sm font-black tracking-tighter uppercase select-none">
            THE PASS
          </div>
          <div class="truncate">
            <h1 class="text-sm sm:text-base md:text-lg font-black tracking-tight leading-none uppercase truncate">{appState.settings.business_name}</h1>
            <span class="text-[8px] sm:text-[9px] font-mono text-[#767068] tracking-widest uppercase block mt-0.5">System Core Control</span>
          </div>
        </div>

        <!-- Right Controls and Network status -->
        <div class="flex items-center gap-2 sm:gap-4 shrink-0 font-mono text-xs">
          <!-- PWA Install app Button -->
          {#if appState.pwaInstallable}
            <button 
              onclick={() => appState.executeAppInstall()} 
              class="btn-interactive px-2 py-1.5 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm"
              title="Install App"
            >
              <Download size={12} />
              <span class="hidden sm:inline">Install App</span>
            </button>
          {/if}

          <!-- Sound toggle -->
          <button onclick={() => appState.toggleAudio()} class="btn-interactive p-1.5 rounded hover:bg-white/50 border border-transparent hover:border-[#767068]/20 flex items-center gap-1 text-[#767068]">
            {#if appState.audioEnabled}
              <Volume2 size={13} class="text-[#3E6650]" />
              <span class="hidden sm:inline text-[10px]">Sound: ON</span>
            {:else}
              <VolumeX size={13} class="text-[#AC3B2A]" />
              <span class="hidden sm:inline text-[10px]">Sound: MUTED</span>
            {/if}
          </button>

          <!-- Log Out Button -->
          <button 
            onclick={handleLogoutClick} 
            class="btn-interactive p-1.5 rounded border border-transparent hover:bg-[#AC3B2A]/10 hover:text-[#AC3B2A] hover:border-[#AC3B2A]/20 flex items-center gap-1 text-[#767068]"
            title="Log Out"
          >
            <LogOut size={13} class="text-[#AC3B2A]" />
            <span class="hidden sm:inline text-[10px]">Log Out</span>
          </button>

          <!-- Live Clock -->
          <div class="hidden lg:flex items-center gap-1.5 text-[#767068]">
            <span>CLOCK:</span>
            <span class="text-[#2A2521] font-bold">{currentDateTime || '2026-07-06 13:33'}</span>
          </div>

          {#if appState.usingMockData}
            <span class="hidden md:inline-block px-2.5 py-0.5 text-[9px] font-bold bg-[#D9A441]/15 text-[#D9A441] border border-[#D9A441]/30 rounded">▲ OFFLINE SIMULATION</span>
          {:else}
            <span class="hidden md:inline-block px-2.5 py-0.5 text-[9px] font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/30 rounded">● POSTGRES ACTIVE</span>
          {/if}

          <!-- Mobile Hamburger Toggle -->
          <button 
            onclick={() => { appState.playClickSound(); showMobileMenu = !showMobileMenu; }} 
            class="md:hidden p-1.5 rounded hover:bg-white/50 border border-transparent hover:border-[#767068]/20 text-[#767068]"
            aria-label="Toggle Menu"
          >
            {#if showMobileMenu}
              <X size={16} />
            {:else}
              <Menu size={16} />
            {/if}
          </button>
        </div>
      </header>

      <!-- MOBILE NAVIGATION TABS (Toggled) -->
      {#if showMobileMenu}
        <div class="md:hidden bg-white/95 border-t border-[#767068]/20 px-6 py-4 space-y-2 animate-fade-in">
          <nav class="flex flex-col gap-2 font-sans">
            <a 
              href="/" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <LayoutDashboard size={14} />
              Overview
            </a>
            <a 
              href="/planner" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/planner') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <UtensilsCrossed size={14} />
              Planner
            </a>
            <a 
              href="/customers" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/customers') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <Users size={14} />
              Customers
            </a>
            <a 
              href="/menus" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/menus') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <FileText size={14} />
              Menus
            </a>
            <a 
              href="/inventory" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/inventory') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <Package size={14} />
              Inventory
            </a>
            <a 
              href="/scheduling" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/scheduling') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <ChefHat size={14} />
              Kitchen & Roster
            </a>
            <a 
              href="/audits" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/audits') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <Wallet size={14} />
              Audits
            </a>
            <a 
              href="/settings" 
              onclick={() => { showMobileMenu = false; appState.playClickSound(); }}
              class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 {isRouteActive('/settings') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521] bg-slate-50' }"
            >
              <Settings size={14} />
              Settings
            </a>
          </nav>
        </div>
      {/if}

      <!-- DESKTOP NAVIGATION TABS ROW -->
      <div class="hidden md:block bg-white/20 px-6 py-2 border-t border-[#767068]/15">
        <nav class="flex flex-wrap gap-1">
          <a href="/" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <LayoutDashboard size={13} />
            Overview
          </a>
          <a href="/planner" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/planner') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <UtensilsCrossed size={13} />
            Planner
          </a>
          <a href="/customers" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/customers') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <Users size={13} />
            Customers
          </a>
          <a href="/menus" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/menus') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <FileText size={13} />
            Menus
          </a>
          <a href="/inventory" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/inventory') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <Package size={13} />
            Inventory
          </a>
          <a href="/scheduling" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/scheduling') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <ChefHat size={13} />
            Kitchen & Roster
          </a>
          <a href="/audits" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/audits') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <Wallet size={13} />
            Audits
          </a>
          <a href="/settings" class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 {isRouteActive('/settings') ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
            <Settings size={13} />
            Settings
          </a>
        </nav>
      </div>
    </div>

    <!-- MAIN WORKSPACE -->
    <main class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8">
      {@render children()}
    </main>
  </div>
{/if}

<!-- MODAL: LOG OUT CONFIRMATION -->
{#if showLogoutModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white p-6 max-w-sm w-full border border-[#767068]/30 shadow-2xl relative animate-scale-up">
      <div class="mb-4">
        <span class="ticket-stamp bg-red-50 text-[#AC3B2A] border-[#AC3B2A]/20">LOCK SESSION</span>
        <h3 class="text-base font-bold text-[#2A2521] mt-2">Operator Exit Request</h3>
        <p class="text-xs text-[#767068] leading-relaxed mt-1.5">
          Are you sure you want to end your operator session? You will need to enter your password, PIN, or biometric key to regain access to the console.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-3 border-t border-[#767068]/20 font-mono text-xs">
        <button 
          onclick={() => { appState.playClickSound(); showLogoutModal = false; }} 
          class="py-2.5 rounded border border-[#767068]/30 text-[#767068] bg-slate-50 hover:bg-slate-100 transition-all font-bold text-center"
        >
          Cancel
        </button>
        <button 
          onclick={() => {
            appState.playClickSound();
            showLogoutModal = false;
            appState.isAuthenticated = false;
            appState.showToast("🔒 Logged out of console session.");
          }} 
          class="py-2.5 rounded bg-[#AC3B2A] text-white hover:bg-[#AC3B2A]/90 transition-all font-bold text-center"
        >
          Log Out
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL: PWA VERSION UPDATE -->
{#if showUpdateModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white p-6 max-w-sm w-full border border-[#767068]/30 shadow-2xl relative animate-scale-up">
      <div class="mb-4">
        <span class="ticket-stamp bg-amber-50 text-[#D9A441] border-[#D9A441]/20">CORE UPGRADE</span>
        <h3 class="text-base font-bold text-[#2A2521] mt-2">New Version Available!</h3>
        <p class="text-xs text-[#767068] leading-relaxed mt-1.5">
          An update is ready for your app. Upgrade now to activate the latest features, brand assets, and client interface enhancements.
        </p>
      </div>

      <!-- Auto-Update Toggle -->
      <label class="flex items-center gap-2 font-mono text-[10px] text-[#767068] cursor-pointer bg-[#F6F2EA]/60 p-2 rounded border border-[#767068]/15 mb-4">
        <input 
          type="checkbox" 
          bind:checked={autoUpdateEnabled} 
          onchange={toggleAutoUpdate}
          class="rounded border-[#767068]/30 text-[#3E6650] w-4 h-4" 
        />
        <span>Enable Auto-Update in the future</span>
      </label>

      <div class="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
        <button 
          onclick={() => { appState.playClickSound(); showUpdateModal = false; }} 
          class="py-2.5 rounded border border-[#767068]/30 text-[#767068] bg-slate-50 hover:bg-slate-100 transition-all font-bold text-center"
        >
          Later
        </button>
        <button 
          onclick={triggerAppUpdate} 
          class="py-2.5 rounded bg-[#3E6650] text-white hover:bg-[#3E6650]/90 transition-all font-bold text-center"
        >
          Update Now
        </button>
      </div>
    </div>
  </div>
{/if}
