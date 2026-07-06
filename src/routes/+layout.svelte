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
    LogOut
  } from '@lucide/svelte';
  import { page } from '$app/state';
  import { CateringState, setCateringContext } from '$lib/states.svelte.js';

  let { data, children } = $props();

  // Create the shared Svelte 5 context state
  const appState = new CateringState(data);
  setCateringContext(appState);

  // Live Ledger Clock ticker
  let currentDateTime = $state('');

  onMount(() => {
    // Set sound enabled if settings default is active
    if (appState.settings.sound_enabled_default) {
      appState.audioEnabled = true;
    }

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { type: 'module' })
        .then(() => console.log("Service Worker registered successfully."))
        .catch((err) => console.warn("Service Worker registration failed:", err));
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
      <header class="px-6 py-4 flex items-center justify-between bg-white/50">
        <div class="flex items-center gap-3">
          <!-- Minimalist receipt stamp logo -->
          <div class="px-2.5 py-1 border-2 border-[#2A2521] font-mono text-sm font-black tracking-tighter uppercase select-none">
            THE PASS
          </div>
          <div>
            <h1 class="text-lg font-black tracking-tight leading-none uppercase">{appState.settings.business_name}</h1>
            <span class="text-[9px] font-mono text-[#767068] tracking-widest uppercase">System Core Control</span>
          </div>
        </div>

        <!-- Right Controls and Network status -->
        <div class="flex items-center gap-4">
          <!-- PWA Install app Button -->
          {#if appState.pwaInstallable}
            <button 
              onclick={() => appState.executeAppInstall()} 
              class="btn-interactive px-3 py-1.5 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-mono text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download size={12} /> Install App
            </button>
          {/if}

          <!-- Sound toggle -->
          <button onclick={() => appState.toggleAudio()} class="btn-interactive p-2 rounded hover:bg-white/50 border border-transparent hover:border-[#767068]/20 flex items-center gap-1.5 text-xs font-mono text-[#767068]">
            {#if appState.audioEnabled}
              <Volume2 size={14} class="text-[#3E6650]" />
              <span class="hidden sm:inline">Sound: ON</span>
            {:else}
              <VolumeX size={14} class="text-[#AC3B2A]" />
              <span class="hidden sm:inline">Sound: MUTED</span>
            {/if}
          </button>

          <!-- Log Out Button -->
          <button 
            onclick={() => {
              appState.playClickSound();
              if (confirm("Are you sure you want to log out of the CaterSync-AI console?")) {
                appState.isAuthenticated = false;
                appState.showToast("🔒 Logged out of console session.");
              }
            }} 
            class="btn-interactive p-2 rounded hover:bg-[#AC3B2A]/10 hover:text-[#AC3B2A] border border-transparent hover:border-[#AC3B2A]/20 flex items-center gap-1.5 text-xs font-mono text-[#767068]"
          >
            <LogOut size={14} class="text-[#AC3B2A]" />
            <span class="hidden sm:inline">Log Out</span>
          </button>

          <!-- Live Clock -->
          <div class="hidden md:flex items-center gap-2 text-xs font-mono text-[#767068]">
            <span>CLOCK:</span>
            <span class="text-[#2A2521] font-bold">{currentDateTime || '2026-07-06 13:33'}</span>
          </div>

          {#if appState.usingMockData}
            <span class="px-3 py-1 text-[10px] font-mono font-bold bg-[#D9A441]/15 text-[#D9A441] border border-[#D9A441]/30 rounded">▲ OFFLINE SIMULATION</span>
          {:else}
            <span class="px-3 py-1 text-[10px] font-mono font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/30 rounded">● POSTGRES ACTIVE</span>
          {/if}
        </div>
      </header>

      <!-- NAVIGATION TABS ROW -->
      <div class="bg-white/20 px-6 py-2 border-t border-[#767068]/15">
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
