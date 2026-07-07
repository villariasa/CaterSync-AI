<script>
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
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
    X,
    Bell
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
  let showNotificationsDropdown = $state(false);
  let shouldReloadOnControllerChange = false;

  function handleLogoutClick() {
    appState.playClickSound();
    showLogoutModal = true;
  }

  async function performLogout() {
    appState.playClickSound();
    showLogoutModal = false;
    appState.isAuthenticated = false;
    if (!appState.usingMockData) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn("Server logout request skipped or failed:", err);
      }
    }
  }

  function triggerAppUpdate() {
    appState.playClickSound();
    
    // Save version flag to localStorage to prevent repeated modals for this version
    localStorage.setItem('catersync_last_update_clicked_version', appState.version);

    shouldReloadOnControllerChange = true;

    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    showUpdateModal = false;

    // Force page reload immediately after message dispatch to trigger activation reload
    sessionStorage.setItem('catersync_update_reloaded', 'true');
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  function toggleAutoUpdate() {
    appState.playClickSound();
    localStorage.setItem('catersync_auto_update', autoUpdateEnabled ? 'true' : 'false');
  }

  // Automatic transaction caching watcher
  $effect(() => {
    // Reference state lists to establish reactive dependencies
    const _watchState = {
      cust: appState.customers,
      evts: appState.events,
      menu: appState.menus,
      ings: appState.ingredients,
      sups: appState.suppliers,
      stff: appState.staff,
      sett: appState.settings
    };

    if (appState.isDataLoaded && typeof window !== 'undefined') {
      appState.saveDataToFile();
    }
  });

  const unreadCount = $derived(appState.notifications.filter(n => n.unread).length);

  onMount(() => {
    // Fade out initial PWA loading screen
    if (typeof window !== 'undefined') {
      const loader = document.getElementById('pwa-loading-screen');
      const percentEl = document.getElementById('pwa-loading-percentage');
      if (loader) {
        let progress = 0;
        const loadInterval = setInterval(() => {
          progress += Math.floor(Math.random() * 25) + 15;
          if (progress >= 100) {
            progress = 100;
            clearInterval(loadInterval);
            if (percentEl) percentEl.textContent = '100%';
            
            // Fade out overlay
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            setTimeout(() => {
              try { loader.remove(); } catch (e) {}
            }, 450);
          } else {
            if (percentEl) percentEl.textContent = `${progress}%`;
          }
        }, 60);
      }
    }

    // Load transaction data cache from local file
    appState.loadDataFromFile().then(() => {
      // Set sound enabled if settings default is active
      if (appState.settings.sound_enabled_default) {
        appState.audioEnabled = true;
      }
    });

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
      autoUpdateEnabled = localStorage.getItem('catersync_auto_update') === 'true';

      // Listen for version info messages from Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'VERSION_RESPONSE') {
          console.log(`Active SW: ${event.data.version}, Client: ${appState.version}`);
          if (event.data.version === appState.version) {
            showUpdateModal = false;
          }
        }
      });

      navigator.serviceWorker.register('/service-worker.js', { type: 'module' })
        .then((reg) => {
          console.log("Service Worker registered.");
          swRegistration = reg;

          // Query active service worker for version
          if (reg.active) {
            reg.active.postMessage({ type: 'GET_VERSION' });
          }

          // Force check for updates to the service worker on reload
          reg.update().catch((err) => console.warn("Failed to check for updates:", err));

          // Check if an update was already waiting when the user opened the app
          const justReloaded = sessionStorage.getItem('catersync_update_reloaded') === 'true';
          const lastClickedVersion = localStorage.getItem('catersync_last_update_clicked_version');

          if (justReloaded) {
            sessionStorage.removeItem('catersync_update_reloaded');
          } else if (reg.waiting) {
            fetch('/service-worker.js')
              .then(r => r.text())
              .then(text => {
                const match = text.match(/const\s+SW_VERSION\s*=\s*['"]([^'"]+)['"]/);
                const serverVersion = match ? match[1] : null;

                if (serverVersion && serverVersion === appState.version) {
                  // Silent skip waiting if version matches
                  shouldReloadOnControllerChange = false;
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  return;
                }

                shouldReloadOnControllerChange = true;

                if (lastClickedVersion === appState.version) {
                  // Already clicked Update Now for this version: skip waiting silently
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                  if (autoUpdateEnabled) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  } else if (isStandalone) {
                    showUpdateModal = true;
                  } else {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  }
                }
              })
              .catch(() => {});
          }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // Trigger modal only if there was a previous active controller
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  fetch('/service-worker.js')
                    .then(r => r.text())
                    .then(text => {
                      const match = text.match(/const\s+SW_VERSION\s*=\s*['"]([^'"]+)['"]/);
                      const serverVersion = match ? match[1] : null;

                      if (serverVersion && serverVersion === appState.version) {
                        console.log("Service Worker files changed but SW_VERSION is identical. Skipping prompt.");
                        shouldReloadOnControllerChange = false;
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        return;
                      }

                      shouldReloadOnControllerChange = true;

                      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

                      if (autoUpdateEnabled) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                      } else if (isStandalone) {
                        showUpdateModal = true;

                        // Trigger device system notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                          reg.showNotification("🚀 CaterSync Upgrade Ready", {
                            body: "An update is ready. Click Update to apply the latest console features.",
                            icon: "/icon-192.png",
                            badge: "/favicon.svg",
                            tag: "catersync-update",
                            renotify: true,
                            actions: [
                              { action: 'update', title: 'Update Now' }
                            ],
                            data: { url: '/' }
                          });
                        }
                      } else {
                        // Update silently on normal web browsers without modal popups
                        console.log("Web client: applying SW update silently.");
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                      }
                    })
                    .catch(() => {});
                }
              });
            }
          });
        })
        .catch((err) => console.warn("Service Worker registration failed:", err));

      let refreshing = false;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !refreshing && shouldReloadOnControllerChange) {
          refreshing = true;
          sessionStorage.setItem('catersync_update_reloaded', 'true');
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

          <!-- Notification Bell with Dropdown -->
          <div class="relative">
            <button 
              onclick={() => {
                appState.playClickSound();
                showNotificationsDropdown = !showNotificationsDropdown;
                // Mark all as read when opened
                if (showNotificationsDropdown) {
                  appState.notifications.forEach(n => n.unread = false);
                }
              }} 
              class="btn-interactive p-1.5 rounded hover:bg-white/50 border border-transparent hover:border-[#767068]/20 flex items-center gap-1 text-[#767068] relative"
              title="Notifications"
            >
              <Bell size={13} class={unreadCount > 0 ? 'text-[#AC3B2A] animate-bounce' : ''} />
              <span class="hidden sm:inline text-[10px]">Alerts</span>
              
              {#if unreadCount > 0}
                <span class="absolute -top-1 -right-1 bg-[#AC3B2A] text-white text-[8px] font-mono font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unreadCount}
                </span>
              {/if}
            </button>

            {#if showNotificationsDropdown}
              <div 
                transition:slide={{ duration: 200 }} 
                class="absolute right-0 mt-2 w-72 bg-white border border-[#767068]/30 rounded shadow-xl py-2 z-50 text-[#2A2521] text-xs font-sans max-h-96 overflow-y-auto"
              >
                <div class="px-4 py-2 border-b border-[#767068]/15 flex items-center justify-between font-mono text-[10px] text-[#767068] font-bold">
                  <span>SYSTEM NOTIFICATIONS</span>
                  <button 
                    onclick={() => {
                      appState.playClickSound();
                      appState.notifications = [];
                      showNotificationsDropdown = false;
                    }}
                    class="hover:text-[#AC3B2A] transition-all uppercase"
                  >
                    Clear All
                  </button>
                </div>
                
                {#if appState.notifications.length === 0}
                  <div class="px-4 py-6 text-center text-[#767068]/60 font-mono text-[10px] uppercase">
                    No active notifications
                  </div>
                {:else}
                  <div class="divide-y divide-[#767068]/10 max-h-64 overflow-y-auto">
                    {#each appState.notifications as notif}
                      <div class="p-3 hover:bg-slate-50 flex items-start gap-2.5 transition-all">
                        <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 {notif.type === 'error' ? 'bg-[#AC3B2A]' : (notif.type === 'info' ? 'bg-[#D9A441]' : 'bg-[#3E6650]')}"></span>
                        <div class="min-w-0 flex-1">
                          <p class="leading-relaxed text-[11px] text-[#2A2521]">{notif.message}</p>
                          <span class="text-[8px] font-mono text-slate-400 block mt-1">{notif.timestamp}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

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

        </div>
      </header>

      <!-- DESKTOP NAVIGATION TABS ROW (Sleek Expanding Hover Icons) -->
      <div class="hidden md:block bg-white/20 px-6 py-2 border-t border-[#767068]/15">
        <nav class="navigation-bar-desktop">
          <a href="/" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/') ? 'active' : ''}" title="Overview">
            <LayoutDashboard size={18} />
            <span class="nav-text-desktop">Overview</span>
          </a>
          <a href="/planner" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/planner') ? 'active' : ''}" title="Planner">
            <UtensilsCrossed size={18} />
            <span class="nav-text-desktop">Planner</span>
          </a>
          <a href="/customers" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/customers') ? 'active' : ''}" title="Customers">
            <Users size={18} />
            <span class="nav-text-desktop">Customers</span>
          </a>
          <a href="/menus" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/menus') ? 'active' : ''}" title="Menus">
            <FileText size={18} />
            <span class="nav-text-desktop">Menus</span>
          </a>
          <a href="/inventory" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/inventory') ? 'active' : ''}" title="Inventory">
            <Package size={18} />
            <span class="nav-text-desktop">Inventory</span>
          </a>
          <a href="/scheduling" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/scheduling') ? 'active' : ''}" title="Kitchen & Roster">
            <ChefHat size={18} />
            <span class="nav-text-desktop">Kitchen</span>
          </a>
          <a href="/audits" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/audits') ? 'active' : ''}" title="Audits">
            <Wallet size={18} />
            <span class="nav-text-desktop">Audits</span>
          </a>
          <a href="/settings" onclick={() => appState.playClickSound()} class="nav-item-desktop {isRouteActive('/settings') ? 'active' : ''}" title="Settings">
            <Settings size={18} />
            <span class="nav-text-desktop">Settings</span>
          </a>
        </nav>
      </div>
    </div>

    <!-- MOBILE STICKY BOTTOM TAB BAR (Always Visible Icons) -->
    <nav class="navigation-bar-mobile md:hidden">
      <a href="/" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/') ? 'active' : ''}" title="Overview">
        <LayoutDashboard size={20} />
      </a>
      <a href="/planner" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/planner') ? 'active' : ''}" title="Planner">
        <UtensilsCrossed size={20} />
      </a>
      <a href="/customers" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/customers') ? 'active' : ''}" title="Customers">
        <Users size={20} />
      </a>
      <a href="/menus" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/menus') ? 'active' : ''}" title="Menus">
        <FileText size={20} />
      </a>
      <a href="/inventory" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/inventory') ? 'active' : ''}" title="Inventory">
        <Package size={20} />
      </a>
      <a href="/scheduling" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/scheduling') ? 'active' : ''}" title="Kitchen & Roster">
        <ChefHat size={20} />
      </a>
      <a href="/audits" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/audits') ? 'active' : ''}" title="Audits">
        <Wallet size={20} />
      </a>
      <a href="/settings" onclick={() => appState.playClickSound()} class="nav-item-mobile {isRouteActive('/settings') ? 'active' : ''}" title="Settings">
        <Settings size={20} />
      </a>
    </nav>

    <!-- MAIN WORKSPACE -->
    <main class="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-8 pb-24 md:pb-8">
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
          onclick={performLogout} 
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
