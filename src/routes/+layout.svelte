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
    Bell,
    ChevronRight,
    HelpCircle,
    MessageSquare,
    Moon,
    MoreHorizontal,
    AlertTriangle,
    Info,
    User,
    Search,
    Truck
  } from '@lucide/svelte';
  import { page } from '$app/state';
  import { CateringState, setCateringContext } from '$lib/states.svelte.js';

  let { data, children } = $props();

  // Create the shared Svelte 5 context state
  const appState = new CateringState(data);
  setCateringContext(appState);

  // Persist notifications on change
  $effect(() => {
    if (typeof window !== 'undefined' && appState.notifications) {
      localStorage.setItem('catersync_notifications', JSON.stringify(appState.notifications));
    }
  });

  let showLogoutModal = $state(false);
  let showUpdateModal = $state(false);
  let autoUpdateEnabled = $state(false);
  let swRegistration = $state(null);
  let showMobileMenu = $state(false);
  let showNotificationsDropdown = $state(false);
  let shouldReloadOnControllerChange = false;

  // Global Search states
  let globalSearchQuery = $state('');
  let showGlobalSearchResults = $state(false);

  // Premium Profile Switcher and Sub-modals state
  let activeProfile = $state('Medy Villarias');
  let secondaryProfile = $state('itsuki');
  let showProfileDropdown = $state(false);
  let showAllProfilesModal = $state(false);
  let showHelpDiagnosticsModal = $state(false);
  let showReportProblemModal = $state(false);
  let showAccessibilityModal = $state(false);
  let showInstallHelpModal = $state(false);
  let installHelp = $derived(appState.getPwaInstallHelp());
  let problemDescription = $state('');
  let darkThemeEnabled = $state(false);

  // Profile switch confirmation modal state
  let showProfileSwitchModal = $state(false);
  let pendingProfileToSwitch = $state('');

  function toggleDarkTheme() {
    appState.playClickSound();
    darkThemeEnabled = !darkThemeEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('catersync_dark_theme', darkThemeEnabled ? 'true' : 'false');
      if (darkThemeEnabled) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  function initiateProfileSwitch(name) {
    appState.playClickSound();
    if (name === activeProfile) {
      showProfileDropdown = false;
      showAllProfilesModal = false;
      return;
    }
    pendingProfileToSwitch = name;
    showProfileSwitchModal = true;
    showProfileDropdown = false;
    showAllProfilesModal = false;
  }

  function switchProfile(name) {
    appState.playClickSound();
    if (name === secondaryProfile) {
      const oldActive = activeProfile;
      activeProfile = secondaryProfile;
      secondaryProfile = oldActive;
      appState.showToast(`👤 Switched operator profile to ${activeProfile}`, 'success');
      appState.playStampSound();
    }
  }

  function handleReportSubmit(e) {
    e.preventDefault();
    if (!problemDescription.trim()) return;
    appState.playClickSound();
    appState.showToast(`📩 Problem report submitted. Ticket #${Math.floor(1000 + Math.random() * 9000)} created.`, 'success');
    appState.playStampSound();
    problemDescription = '';
    showReportProblemModal = false;
  }


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

  async function handleAppInstallClick() {
    const installedPromptOpened = await appState.executeAppInstall();
    if (!installedPromptOpened && !appState.pwaInstalled) {
      showInstallHelpModal = true;
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
  let activeNotifFilter = $state('all');
  const filteredNotifications = $derived(
    activeNotifFilter === 'unread' 
      ? appState.notifications.filter(n => n.unread) 
      : appState.notifications
  );

  // Global search result filter matching Customers, Events, Menus, and Help Actions
  const globalSearchResults = $derived(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    
    // Core actions (help navigation guide)
    const appActions = [
      { type: 'action', title: 'Schedule Catering Event', desc: 'Create and plan client orders', path: '/planner' },
      { type: 'action', title: 'Register New Client', desc: 'Manage client list and preferences', path: '/customers' },
      { type: 'action', title: 'Generate AI Menus', desc: 'Auto-create menu options using AI', path: '/menus' },
      { type: 'action', title: 'Check Stock & Inventory', desc: 'Track ingredient stock levels & reorders', path: '/inventory' },
      { type: 'action', title: 'Roster Staff & Chefs', desc: 'Assign prep tasks and schedule kitchen roster', path: '/scheduling' },
      { type: 'action', title: 'View Financial Audits', desc: 'Check profit analysis and ledger', path: '/audits' }
    ];

    if (!query) {
      // Default: show quick guide actions (Recent search guides)
      return appActions.slice(0, 4); 
    }

    const results = [];

    // 1. Match system actions
    appActions.forEach(act => {
      if (act.title.toLowerCase().includes(query) || act.desc.toLowerCase().includes(query)) {
        results.push(act);
      }
    });

    // 2. Match customers
    if (appState.customers) {
      appState.customers.forEach(c => {
        if (c.name.toLowerCase().includes(query) || (c.email && c.email.toLowerCase().includes(query))) {
          results.push({
            type: 'customer',
            title: `👤 Customer: ${c.name}`,
            desc: c.email || 'No email registered',
            path: '/customers',
            action: () => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('catersync_search_customer', c.name);
              }
            }
          });
        }
      });
    }

    // 3. Match events/orders
    if (appState.events) {
      appState.events.forEach(e => {
        if (e.name.toLowerCase().includes(query) || e.client.toLowerCase().includes(query)) {
          results.push({
            type: 'event',
            title: `📅 Order: ${e.name}`,
            desc: `Client: ${e.client} · Status: ${e.status}`,
            path: '/planner'
          });
        }
      });
    }

    // 4. Match menus
    if (appState.menus) {
      appState.menus.forEach(m => {
        if (m.name.toLowerCase().includes(query)) {
          results.push({
            type: 'menu',
            title: `🍽️ Menu: ${m.name}`,
            desc: `₱${m.price_per_serving}/serving · Cost: ₱${m.cost_per_serving}`,
            path: '/menus'
          });
        }
      });
    }

    return results.slice(0, 6); // Max 6 results for compact Facebook style
  });

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

    // Keep the install affordance accurate across install, uninstall, and tab focus changes.
    appState.syncPwaInstallState();
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const syncInstallState = () => {
      appState.syncPwaInstallState();
    };
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      appState.setPwaInstallPrompt(e);
    };
    const handleAppInstalled = () => {
      appState.markPwaInstalled();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) syncInstallState();
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', syncInstallState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (standaloneQuery.addEventListener) {
      standaloneQuery.addEventListener('change', syncInstallState);
    } else if (standaloneQuery.addListener) {
      standaloneQuery.addListener(syncInstallState);
    }

    // Request permissions for standard local notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }


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

    // Read dark theme settings on mount
    if (typeof window !== 'undefined') {
      darkThemeEnabled = localStorage.getItem('catersync_dark_theme') === 'true';
      if (darkThemeEnabled) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        appState.playClickSound();
        showReportProblemModal = true;
        showProfileDropdown = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(notificationInterval);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', syncInstallState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (standaloneQuery.removeEventListener) {
        standaloneQuery.removeEventListener('change', syncInstallState);
      } else if (standaloneQuery.removeListener) {
        standaloneQuery.removeListener(syncInstallState);
      }
      window.removeEventListener('keydown', handleKeyDown);
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
  <div class="min-h-screen bg-[var(--color-paper)] text-ink flex flex-col antialiased">
    <!-- STICKY HEADER & NAV CONTAINER -->
    <div class="sticky top-0 z-30 bg-[#F6F2EA]/95 dark:bg-[#1A1715]/95 backdrop-blur-md border-b border-[#767068]/30 animate-fade-in">
      <!-- TOP BAR -->
      <header class="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 bg-white/50 dark:bg-[#24201E]/50">
        <!-- LEFT: LOGO & TITLE & SEARCH -->
        <div class="flex items-center gap-3 min-w-0 shrink-0">
          <a href="/" onclick={() => appState.playClickSound()} class="flex items-center gap-2 no-underline text-[#2A2521] dark:text-[#EBE5DC] select-none hover:opacity-90 active:scale-95 transition-all">
            <img src={favicon} alt="Logo" class="w-6 h-6 object-contain" />
          </a>
          
          <!-- Global Search (Facebook style) -->
          <div class="relative hidden md:block select-none">
            <div class="flex items-center bg-[#767068]/10 dark:bg-zinc-800 rounded-full px-3 py-1.5 w-52 border border-transparent focus-within:border-[#3E6650]/65 transition-all">
              <Search size={12} class="text-[#767068] dark:text-zinc-400 shrink-0 mr-1.5" />
              <input 
                type="text" 
                placeholder="Search orders, clients, help..."
                bind:value={globalSearchQuery}
                onfocus={() => { showGlobalSearchResults = true; appState.playClickSound(); }}
                onblur={() => { setTimeout(() => { showGlobalSearchResults = false; }, 200); }}
                class="bg-transparent border-none outline-none text-[10px] w-full text-[#2A2521] dark:text-[#EBE5DC] placeholder-[#767068]/60"
              />
            </div>
            
            {#if showGlobalSearchResults}
              <div 
                class="absolute left-0 mt-1 w-64 bg-white dark:bg-[#24201E] border border-[#767068]/20 dark:border-zinc-800 rounded-lg shadow-2xl z-50 py-2 text-[10px]"
              >
                <div class="px-3 pb-1 border-b border-[#767068]/10 dark:border-zinc-800/60 text-[9px] font-bold text-[#767068] dark:text-zinc-500 uppercase tracking-wider font-mono">
                  {globalSearchQuery.trim() ? 'Search Results' : 'Suggested Guides'}
                </div>
                
                <div class="divide-y divide-[#767068]/5 dark:divide-zinc-850 max-h-60 overflow-y-auto">
                  {#each globalSearchResults() as res}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <a 
                      href={res.path}
                      onclick={() => {
                        if (res.action) res.action();
                        appState.playClickSound();
                        showGlobalSearchResults = false;
                        globalSearchQuery = '';
                      }}
                      class="px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800/20 block text-[#2A2521] dark:text-[#EBE5DC] no-underline text-left"
                    >
                      <div class="font-bold text-[10px] truncate">{res.title || res.name}</div>
                      <div class="text-[8px] text-[#767068] dark:text-zinc-500 truncate mt-0.5">{res.desc}</div>
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- CENTER: DESKTOP HEADER NAVIGATION (Sleek Centered Icons) -->
        <div class="hidden md:flex flex-1 justify-center min-w-0 px-4">
          <nav class="app-nav-row justify-center max-w-full">
            <a href="/planner" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/planner') ? 'active' : ''}" data-tooltip="Planner">
              <UtensilsCrossed size={16} />
            </a>
            <a href="/customers" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/customers') ? 'active' : ''}" data-tooltip="Customers">
              <Users size={16} />
            </a>
            <a href="/menus" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/menus') ? 'active' : ''}" data-tooltip="Menus">
              <FileText size={16} />
            </a>
            <a href="/inventory" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/inventory') ? 'active' : ''}" data-tooltip="Inventory">
              <Package size={16} />
            </a>
            <a href="/suppliers" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/suppliers') ? 'active' : ''}" data-tooltip="Purchasing">
              <Truck size={16} />
            </a>
            <a href="/scheduling" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/scheduling') ? 'active' : ''}" data-tooltip="Kitchen">
              <ChefHat size={16} />
            </a>
            <a href="/audits" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/audits') ? 'active' : ''}" data-tooltip="Audits">
              <Wallet size={16} />
            </a>

          </nav>
        </div>

        <!-- RIGHT: CONTROLS & AVATAR -->
        <div class="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-xs">
          <!-- PWA Install app Button -->
          {#if appState.pwaInstallable}
            <button 
              onclick={handleAppInstallClick} 
              class="btn-interactive px-2 py-1.5 rounded bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm"
              title="Install CaterSync on this device"
            >
              <Download size={12} />
              <span class="hidden sm:inline">Install</span>
            </button>
          {/if}


          <!-- Notification Bell with Dropdown -->
          <div class="relative">
            <button 
              onclick={() => {
                appState.playClickSound();
                showNotificationsDropdown = !showNotificationsDropdown;
              }} 
              class="btn-interactive p-1.5 rounded hover:bg-white/50 dark:hover:bg-zinc-800/30 border border-transparent hover:border-[#767068]/20 flex items-center gap-1 text-[#767068] dark:text-zinc-400 relative"
              title="Notifications"
            >
              <Bell size={13} class={unreadCount > 0 ? 'text-[#AC3B2A] animate-bounce' : ''} />
              <span class="hidden lg:inline text-[9px]">ALERTS</span>
              
              {#if unreadCount > 0}
                <span class="absolute -top-1 -right-1 bg-[#AC3B2A] text-white text-[8px] font-mono font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unreadCount}
                </span>
              {/if}
            </button>

            {#if showNotificationsDropdown}
              <div 
                transition:slide={{ duration: 180 }} 
                class="absolute right-0 mt-2 w-80 bg-white dark:bg-[#24201E] border border-[#767068]/30 dark:border-zinc-800 rounded-lg shadow-2xl py-2 z-50 text-[#2A2521] dark:text-[#EBE5DC] text-xs font-sans text-left"
              >
                <!-- Title & Option header -->
                <div class="px-4 pt-2 pb-1 flex items-center justify-between">
                  <h3 class="text-base font-extrabold tracking-tight">Notifications</h3>
                  <button 
                    onclick={() => {
                      appState.playClickSound();
                      appState.notifications = [];
                      showNotificationsDropdown = false;
                    }}
                    class="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-[#767068] dark:text-zinc-400 transition-all"
                    title="Clear All Notifications"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                <!-- Filter Pills -->
                <div class="flex gap-2 px-4 py-1.5 border-b border-[#767068]/10 dark:border-zinc-800/60 font-sans text-xs">
                  <button 
                    onclick={() => { appState.playClickSound(); activeNotifFilter = 'all'; }}
                    class="px-3 py-1 rounded-full font-bold transition-all {activeNotifFilter === 'all' ? 'bg-[#3E6650] text-[#F6F2EA]' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/80 dark:hover:bg-zinc-700'}"
                  >
                    All
                  </button>
                  <button 
                    onclick={() => { appState.playClickSound(); activeNotifFilter = 'unread'; }}
                    class="px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1.5 {activeNotifFilter === 'unread' ? 'bg-[#3E6650] text-[#F6F2EA]' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/80 dark:hover:bg-zinc-700'}"
                  >
                    <span>Unread</span>
                    {#if unreadCount > 0}
                      <span class="bg-[#AC3B2A] text-white text-[8px] px-1 rounded-full font-mono">{unreadCount}</span>
                    {/if}
                  </button>
                </div>

                <!-- Section Label -->
                <div class="px-4 py-2 flex items-center justify-between text-[10px] font-bold text-[#767068] dark:text-zinc-500 font-sans uppercase tracking-wider">
                  <span>Earlier</span>
                  <button 
                    onclick={() => {
                      appState.playClickSound();
                      appState.notifications.forEach(n => n.unread = false);
                      appState.showToast("All notifications marked as read", "success");
                    }}
                    class="hover:underline text-[9px] text-[#3E6650] dark:text-zinc-400 capitalize normal-case"
                  >
                    Mark all as read
                  </button>
                </div>

                <!-- Notification items -->
                {#if filteredNotifications.length === 0}
                  <div class="px-4 py-10 text-center text-[#767068]/60 dark:text-zinc-500 font-mono text-[10px] uppercase select-none">
                    No active notifications
                  </div>
                {:else}
                  <div class="max-h-80 overflow-y-auto divide-y divide-[#767068]/5 dark:divide-zinc-850">
                    {#each filteredNotifications as notif}
                      <div 
                        onclick={() => {
                          notif.unread = false;
                          appState.playClickSound();
                        }}
                        class="p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/20 flex items-start gap-3 transition-all cursor-pointer relative {notif.unread ? 'bg-slate-50/40 dark:bg-zinc-800/10' : ''}"
                      >
                        <!-- Left Avatar Circle with type Badge Overlay -->
                        <div class="relative shrink-0 select-none">
                          <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[#767068] dark:text-[#EBE5DC]">
                            <User size={16} />
                          </div>
                          <!-- Bottom Right Icon badge overlay -->
                          <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#24201E] {notif.type === 'error' ? 'bg-[#AC3B2A] text-white' : (notif.type === 'info' ? 'bg-[#D9A441] text-white' : 'bg-[#3E6650] text-white')}">
                            {#if notif.type === 'error'}
                              <AlertTriangle size={9} />
                            {:else if notif.type === 'info'}
                              <Info size={9} />
                            {:else}
                              <Bell size={9} />
                            {/if}
                          </div>
                        </div>

                        <!-- Message Text & Relative Time -->
                        <div class="min-w-0 flex-1 pr-4">
                          <p class="leading-snug text-[11px] text-[#2A2521] dark:text-[#EBE5DC] font-sans">
                            {notif.message}
                          </p>
                          <span class="text-[9px] text-[#767068] dark:text-zinc-500 font-sans block mt-1.5">{notif.timestamp}</span>
                        </div>

                        <!-- Right Unread dot badge -->
                        {#if notif.unread}
                          <span class="absolute right-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#3E6650] shrink-0" title="Unread"></span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Footer button -->
                <button 
                  onclick={() => {
                    showNotificationsDropdown = false;
                    appState.playClickSound();
                    appState.showToast("Retrieving older system logs...", "info");
                  }} 
                  class="w-full text-center py-2 bg-slate-100/60 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[10px] font-bold text-[#3E6650] dark:text-[#EBE5DC] rounded-b border-t border-[#767068]/10 dark:border-zinc-800 uppercase tracking-wide"
                >
                  See previous notifications
                </button>
              </div>
            {/if}
          </div>



          <!-- User Profile Dropdown Button -->
          <div class="relative">
            <button 
              onclick={() => {
                appState.playClickSound();
                showProfileDropdown = !showProfileDropdown;
              }}
              class="btn-interactive w-8 h-8 rounded-full bg-[#3E6650] hover:bg-[#3E6650]/95 text-[#F6F2EA] flex items-center justify-center font-bold relative border border-[#767068]/20 select-none shadow-sm transition-all focus:outline-none"
              title="Profile menu"
            >
              <span>{activeProfile.split(' ').map(n => n[0]).join('')}</span>
              <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white"></span>
            </button>

            {#if showProfileDropdown}
              <div 
                transition:slide={{ duration: 180 }} 
                class="absolute right-0 mt-2 w-80 bg-white dark:bg-[#24201E] border border-[#767068]/30 dark:border-zinc-800 rounded-lg shadow-2xl py-3 z-50 text-[#2A2521] dark:text-[#EBE5DC] text-left"
              >
                <!-- Active Profiles list -->
                <div class="px-4 pb-3 border-b border-[#767068]/15 dark:border-zinc-800/60 font-sans">
                  <div class="flex items-center justify-between py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/30 rounded px-2 cursor-pointer transition-all">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-[#3E6650] text-[#F6F2EA] flex items-center justify-center font-bold text-sm">
                        <span>{activeProfile.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <span class="font-bold text-sm text-[#2A2521] dark:text-[#EBE5DC]">{activeProfile}</span>
                    </div>
                    <span class="text-[#3E6650] dark:text-[#EBE5DC] font-bold text-sm">✓</span>
                  </div>

                  <!-- Secondary profile switcher -->
                  <div 
                    onclick={() => initiateProfileSwitch(secondaryProfile)}
                    class="flex items-center justify-between py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/30 rounded px-2 cursor-pointer transition-all mt-1"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-[#767068]/20 dark:bg-zinc-800 text-[#767068] dark:text-[#EBE5DC] flex items-center justify-center font-bold text-xs">
                        <span>{secondaryProfile.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <span class="text-sm font-semibold text-[#767068] dark:text-zinc-400">{secondaryProfile}</span>
                    </div>
                  </div>

                  <button 
                    onclick={() => { showAllProfilesModal = true; showProfileDropdown = false; appState.playClickSound(); }}
                    class="w-full mt-3 py-2 px-4 bg-[#767068]/10 hover:bg-[#767068]/15 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider font-mono text-[#767068] dark:text-[#EBE5DC]"
                  >
                    See all profiles
                  </button>
                </div>

                <!-- Profile Menu list -->
                <div class="px-2 py-1.5 text-xs font-bold font-sans space-y-1">
                  <a 
                    href="/settings"
                    onclick={() => { showProfileDropdown = false; appState.playClickSound(); }}
                    class="flex items-center justify-between py-1.5 px-3 hover:bg-slate-100 dark:hover:bg-zinc-800/30 rounded-md transition-all text-[#2A2521] dark:text-[#EBE5DC] no-underline"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[#2A2521] dark:text-[#EBE5DC]">
                        <Settings size={16} />
                      </div>
                      <span>Settings & privacy</span>
                    </div>
                    <ChevronRight size={14} class="text-[#767068] dark:text-zinc-500" />
                  </a>

                  <button 
                    onclick={() => { showHelpDiagnosticsModal = true; showProfileDropdown = false; appState.playClickSound(); }}
                    class="w-full flex items-center justify-between py-1.5 px-3 hover:bg-slate-100 dark:hover:bg-zinc-800/30 rounded-md transition-all text-[#2A2521] dark:text-[#EBE5DC] text-left"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[#2A2521] dark:text-[#EBE5DC]">
                        <HelpCircle size={16} />
                      </div>
                      <span>Help & support</span>
                    </div>
                    <ChevronRight size={14} class="text-[#767068] dark:text-zinc-500" />
                  </button>

                  <button 
                    onclick={() => { showReportProblemModal = true; showProfileDropdown = false; appState.playClickSound(); }}
                    class="w-full flex items-center justify-between py-1.5 px-3 hover:bg-slate-100 dark:hover:bg-zinc-800/30 rounded-md transition-all text-[#2A2521] dark:text-[#EBE5DC] text-left"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[#2A2521] dark:text-[#EBE5DC]">
                        <MessageSquare size={16} />
                      </div>
                      <div class="flex flex-col leading-none">
                        <span>Report a problem</span>
                        <span class="text-[8px] font-mono text-[#767068] dark:text-zinc-500 font-normal mt-0.5">CTRL B</span>
                      </div>
                    </div>
                    <ChevronRight size={14} class="text-[#767068] dark:text-zinc-500" />
                  </button>

                  <button 
                    onclick={() => { showAccessibilityModal = true; showProfileDropdown = false; appState.playClickSound(); }}
                    class="w-full flex items-center justify-between py-1.5 px-3 hover:bg-slate-100 dark:hover:bg-zinc-800/30 rounded-md transition-all text-[#2A2521] dark:text-[#EBE5DC] text-left"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[#2A2521] dark:text-[#EBE5DC]">
                        <Moon size={16} />
                      </div>
                      <span>Display & accessibility</span>
                    </div>
                    <ChevronRight size={14} class="text-[#767068] dark:text-zinc-500" />
                  </button>

                  <div class="h-px bg-[#767068]/10 dark:bg-zinc-800/50 my-1"></div>

                  <button 
                    onclick={() => { showLogoutModal = true; showProfileDropdown = false; appState.playClickSound(); }}
                    class="w-full flex items-center justify-between py-1.5 px-3 hover:bg-[#AC3B2A]/10 hover:text-[#AC3B2A] rounded-md transition-all text-[#2A2521] dark:text-[#EBE5DC] text-left"
                  >
                    <div class="flex items-center gap-3 text-[#AC3B2A] dark:text-red-400">
                      <div class="w-9 h-9 rounded-full bg-[#AC3B2A]/10 flex items-center justify-center shrink-0 text-[#AC3B2A] dark:text-red-400">
                        <LogOut size={16} />
                      </div>
                      <span>Log out</span>
                    </div>
                  </button>
                </div>

                <!-- Policies Footer -->
                <div class="px-4 pt-2.5 border-t border-[#767068]/10 dark:border-zinc-800/50 text-[9px] text-[#767068] dark:text-zinc-500 font-mono leading-relaxed select-none">
                  <a href="#privacy" class="hover:underline">Privacy</a> · 
                  <a href="#terms" class="hover:underline">Terms</a> · 
                  <a href="#advertising" class="hover:underline">Advertising</a> · 
                  <a href="#cookies" class="hover:underline">Cookies</a> · 
                  <button onclick={() => appState.showToast('Console v' + appState.version, 'info')} class="hover:underline font-mono text-[9px]">More</button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </header>

      <!-- MOBILE-ONLY HEADER NAVIGATION (Scrollable Row Under Logo row) -->
      <div class="md:hidden bg-white/20 dark:bg-[#24201E]/20 px-4 py-2 border-t border-[#767068]/15 backdrop-blur-sm">
        <nav class="app-nav-row justify-center max-w-full">

          <a href="/planner" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/planner') ? 'active' : ''}" data-tooltip="Planner">
            <UtensilsCrossed size={16} />
          </a>
          <a href="/customers" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/customers') ? 'active' : ''}" data-tooltip="Customers">
            <Users size={16} />
          </a>
          <a href="/menus" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/menus') ? 'active' : ''}" data-tooltip="Menus">
            <FileText size={16} />
          </a>
          <a href="/inventory" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/inventory') ? 'active' : ''}" data-tooltip="Inventory">
            <Package size={16} />
          </a>
          <a href="/suppliers" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/suppliers') ? 'active' : ''}" data-tooltip="Purchasing">
            <Truck size={16} />
          </a>
          <a href="/scheduling" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/scheduling') ? 'active' : ''}" data-tooltip="Kitchen">
            <ChefHat size={16} />
          </a>
          <a href="/audits" onclick={() => appState.playClickSound()} class="app-nav-item {isRouteActive('/audits') ? 'active' : ''}" data-tooltip="Audits">
            <Wallet size={16} />
          </a>

        </nav>
      </div>
    </div>

    <!-- MAIN WORKSPACE -->
    <main class="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-8 pb-12 md:pb-8">
      {@render children()}
    </main>
  </div>
{/if}

<!-- MODAL: PHONE APP INSTALL HELP -->
{#if showInstallHelpModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-0 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl overflow-hidden text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#767068]/15 dark:border-zinc-800">
        <div>
          <span class="ticket-stamp bg-emerald-50 text-[#3E6650] border-[#3E6650]/20 dark:bg-[#3E6650]/15 dark:text-emerald-400">PHONE INSTALL</span>
          <h3 class="text-base font-black mt-2">{installHelp.title}</h3>
        </div>
        <button
          onclick={() => { appState.playClickSound(); showInstallHelpModal = false; }}
          class="shrink-0 p-1.5 rounded hover:bg-[#F6F2EA] dark:hover:bg-zinc-800 text-[#767068] transition-all"
          title="Close install instructions"
        >
          <X size={16} />
        </button>
      </div>

      <div class="px-5 py-4 space-y-4">
        <p class="text-xs leading-relaxed text-[#767068] dark:text-zinc-400">{installHelp.detail}</p>
        <ol class="space-y-2">
          {#each installHelp.steps as step, index}
            <li class="flex gap-2 text-xs leading-relaxed">
              <span class="shrink-0 w-5 h-5 rounded bg-[#3E6650] text-[#F6F2EA] font-mono text-[10px] flex items-center justify-center">{index + 1}</span>
              <span>{step}</span>
            </li>
          {/each}
        </ol>

        {#if installHelp.platform === 'android' && appState.pwaInstallPromptAvailable}
          <button
            onclick={handleAppInstallClick}
            class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold font-mono text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-1.5"
          >
            <Download size={14} />
            Install Now
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- MODAL: LOG OUT CONFIRMATION -->
{#if showLogoutModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-red-50 text-[#AC3B2A] border-[#AC3B2A]/20 dark:bg-[#AC3B2A]/10 dark:text-[#AC3B2A]">LOCK SESSION</span>
        <h3 class="text-base font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2">Operator Exit Request</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 leading-relaxed mt-1.5">
          Are you sure you want to end your operator session? You will need to enter your password, PIN, or biometric key to regain access to the console.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-3 border-t border-[#767068]/20 dark:border-zinc-850 font-mono text-xs">
        <button 
          onclick={() => { appState.playClickSound(); showLogoutModal = false; }} 
          class="py-2.5 rounded border border-[#767068]/30 text-[#767068] bg-slate-50 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-[#EBE5DC] transition-all font-bold text-center"
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

<!-- MODAL: PROFILE SWITCH CONFIRMATION -->
{#if showProfileSwitchModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-emerald-50 text-[#3E6650] border-[#3E6650]/25 dark:bg-[#3E6650]/15 dark:text-emerald-400">SWITCH OPERATOR</span>
        <h3 class="text-base font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2">Confirm Operator Swap</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 leading-relaxed mt-1.5">
          Are you sure you want to switch the active operator console profile to <strong class="text-[#3E6650] dark:text-[#3E6650]">{pendingProfileToSwitch}</strong>? All future actions and changes will be logged under this user name.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-3 border-t border-[#767068]/20 dark:border-zinc-850 font-mono text-xs">
        <button 
          onclick={() => { appState.playClickSound(); showProfileSwitchModal = false; pendingProfileToSwitch = ''; }} 
          class="py-2.5 rounded border border-[#767068]/30 text-[#767068] bg-slate-50 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-[#EBE5DC] transition-all font-bold text-center"
        >
          Cancel
        </button>
        <button 
          onclick={() => {
            switchProfile(pendingProfileToSwitch);
            showProfileSwitchModal = false;
          }} 
          class="py-2.5 rounded bg-[#3E6650] text-[#F6F2EA] hover:bg-[#3E6650]/90 transition-all font-bold text-center"
        >
          Switch Profile
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL: PWA VERSION UPDATE -->
{#if showUpdateModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-amber-50 text-[#D9A441] border-[#D9A441]/20 dark:bg-[#D9A441]/10 dark:text-[#D9A441]">CORE UPGRADE</span>
        <h3 class="text-base font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2">New Version Available!</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 leading-relaxed mt-1.5">
          An update is ready for your app. Upgrade now to activate the latest features, brand assets, and client interface enhancements.
        </p>
      </div>

      <!-- Auto-Update Toggle -->
      <label class="flex items-center gap-2 font-mono text-[10px] text-[#767068] dark:text-zinc-400 cursor-pointer bg-[#F6F2EA]/60 dark:bg-zinc-900/40 p-2 rounded border border-[#767068]/15 dark:border-zinc-800 mb-4">
        <input 
          type="checkbox" 
          bind:checked={autoUpdateEnabled} 
          onchange={toggleAutoUpdate}
          class="rounded border-[#767068]/30 dark:border-zinc-700 text-[#3E6650] dark:bg-[#1A1715] w-4 h-4" 
        />
        <span>Enable Auto-Update in the future</span>
      </label>

      <div class="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
        <button 
          onclick={() => { appState.playClickSound(); showUpdateModal = false; }} 
          class="py-2.5 rounded border border-[#767068]/30 text-[#767068] bg-slate-50 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-[#EBE5DC] transition-all font-bold text-center"
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

<!-- MODAL: REPORT A PROBLEM (CTRL + B) -->
{#if showReportProblemModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-md w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-amber-50 text-[#D9A441] border-[#D9A441]/20 dark:bg-[#D9A441]/10 dark:text-[#D9A441]">FEEDBACK DESK</span>
        <h3 class="text-base font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2">Report a System Problem</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 mt-1.5 leading-relaxed">
          Describe the issue, defect, or operational blocker you encountered. System metadata will be attached automatically to aid offline troubleshooting.
        </p>
      </div>

      <form onsubmit={handleReportSubmit} class="space-y-4">
        <div>
          <label class="block text-[10px] font-mono text-[#767068] dark:text-zinc-400 uppercase font-bold mb-1">Issue Description</label>
          <textarea 
            bind:value={problemDescription}
            rows="4"
            placeholder="Please specify step-by-step how to reproduce the issue..."
            class="w-full p-2.5 text-xs rounded border border-[#767068]/20 focus:border-[#3E6650] dark:border-zinc-800 dark:bg-[#1A1715] dark:text-[#EBE5DC] focus:outline-none"
            required
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
          <button 
            type="button"
            onclick={() => { appState.playClickSound(); showReportProblemModal = false; problemDescription = ''; }} 
            class="py-2.5 rounded border border-[#767068]/30 text-[#767068] dark:text-[#EBE5DC] dark:border-zinc-700 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all font-bold text-center"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="py-2.5 rounded bg-[#3E6650] text-white hover:bg-[#3E6650]/90 transition-all font-bold text-center"
          >
            Submit Report
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL: DISPLAY & ACCESSIBILITY -->
{#if showAccessibilityModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-blue-50 text-blue-600 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">PREFERENCES</span>
        <h3 class="text-base font-bold mt-2 text-[#2A2521] dark:text-[#EBE5DC]">Display & Accessibility</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 mt-1.5 leading-relaxed">
          Configure settings for high-contrast viewing, theme presets, and auditory cues.
        </p>
      </div>

      <div class="space-y-4 py-2 text-left">
        <!-- Dark theme toggle -->
        <div class="flex items-center justify-between p-3 bg-[#F6F2EA]/60 dark:bg-zinc-900/40 rounded border border-[#767068]/15 dark:border-zinc-800">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-[#2A2521] dark:text-[#EBE5DC]">Dark Theme Mode</span>
            <span class="text-[9px] text-[#767068] dark:text-zinc-400 mt-0.5">Toggle dark slate layout</span>
          </div>
          <button 
            onclick={toggleDarkTheme}
            class="px-3 py-1 rounded text-xs font-mono font-bold {darkThemeEnabled ? 'bg-[#3E6650] text-white' : 'bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-[#EBE5DC]'}"
          >
            {darkThemeEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <!-- Audio sound toggle -->
        <div class="flex items-center justify-between p-3 bg-[#F6F2EA]/60 dark:bg-zinc-900/40 rounded border border-[#767068]/15 dark:border-zinc-800">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-[#2A2521] dark:text-[#EBE5DC]">Auditory Tones</span>
            <span class="text-[9px] text-[#767068] dark:text-zinc-400 mt-0.5">Button clicking sounds</span>
          </div>
          <button 
            onclick={() => { appState.toggleAudio(); }}
            class="px-3 py-1 rounded text-xs font-mono font-bold {appState.audioEnabled ? 'bg-[#3E6650] text-white' : 'bg-[#AC3B2A] text-white'}"
          >
            {appState.audioEnabled ? 'ENABLED' : 'MUTED'}
          </button>
        </div>
      </div>

      <div class="pt-4 border-t border-[#767068]/20 dark:border-zinc-800 font-mono text-xs flex justify-end">
        <button 
          onclick={() => { appState.playClickSound(); showAccessibilityModal = false; }} 
          class="px-5 py-2 rounded bg-[#2A2521] text-white dark:bg-zinc-800 hover:bg-opacity-90 transition-all font-bold text-center border-none cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL: HELP & DIAGNOSTICS -->
{#if showHelpDiagnosticsModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-md w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-[#3E6650]/15 text-[#3E6650] dark:text-[#EBE5DC] border-[#3E6650]/20">DIAGNOSTICS</span>
        <h3 class="text-base font-bold mt-2 text-[#2A2521] dark:text-[#EBE5DC]">Help & System Support</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 mt-1.5 leading-relaxed">
          Technical parameters and database status check for local operator console nodes.
        </p>
      </div>

      <div class="space-y-2.5 font-mono text-[10px] bg-slate-50 dark:bg-zinc-900/40 p-4 rounded border border-[#767068]/15 dark:border-zinc-800 leading-relaxed text-left">
        <div class="flex justify-between">
          <span class="text-[#767068] dark:text-zinc-400">PLATFORM VERSION:</span>
          <span class="font-bold">v{appState.version}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#767068] dark:text-zinc-400">DATABASE SERVICE:</span>
          <span class="font-bold {appState.usingMockData ? 'text-[#D9A441]' : 'text-[#3E6650]'}">
            {appState.usingMockData ? 'OFFLINE SIMULATION' : 'ACTIVE POSTGRESQL'}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#767068] dark:text-zinc-400">OFFLINE PERSISTENCE:</span>
          <span class="font-bold text-[#3E6650]">OPFS STANDALONE CACHE</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#767068] dark:text-zinc-400">PUSH SERVICE STATE:</span>
          <span class="font-bold {appState.pushSubscriptionActive ? 'text-[#3E6650]' : 'text-[#767068]'}">
            {appState.pushSubscriptionActive ? 'SUBSCRIBED' : 'INACTIVE'}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#767068] dark:text-zinc-400">USER USERNAME:</span>
          <span class="font-bold">{activeProfile}</span>
        </div>
      </div>

      <div class="pt-4 border-t border-[#767068]/20 dark:border-zinc-800 font-mono text-xs flex justify-end">
        <button 
          onclick={() => { appState.playClickSound(); showHelpDiagnosticsModal = false; }} 
          class="px-5 py-2 rounded bg-[#2A2521] text-white dark:bg-zinc-800 hover:bg-opacity-90 transition-all font-bold text-center border-none cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL: SEE ALL PROFILES SWITCHER -->
{#if showAllProfilesModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-sm w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      <div class="mb-4">
        <span class="ticket-stamp bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400">ACCOUNTS</span>
        <h3 class="text-base font-bold mt-2 text-[#2A2521] dark:text-[#EBE5DC]">Switch Active Operator</h3>
        <p class="text-xs text-[#767068] dark:text-zinc-400 mt-1.5 leading-relaxed">
          Select one of the registered system operator profiles to switch sessions immediately.
        </p>
      </div>

      <div class="space-y-2 py-2 text-left">
        <button 
          onclick={() => initiateProfileSwitch(activeProfile)}
          class="w-full flex items-center justify-between p-3 bg-[#F6F2EA]/60 dark:bg-zinc-900/20 rounded border-2 border-[#3E6650] hover:bg-[#767068]/5 transition-all text-left"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#3E6650] text-[#F6F2EA] flex items-center justify-center font-bold text-xs">
              <span>{activeProfile.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <span class="text-xs font-bold text-[#2A2521] dark:text-[#EBE5DC]">{activeProfile}</span>
          </div>
          <span class="text-[#3E6650] dark:text-[#EBE5DC] font-bold text-xs">Active</span>
        </button>

        <button 
          onclick={() => initiateProfileSwitch(secondaryProfile)}
          class="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded border border-[#767068]/15 dark:border-zinc-800 transition-all text-left"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#767068]/20 dark:bg-zinc-800 text-[#767068] dark:text-[#EBE5DC] flex items-center justify-center font-bold text-xs">
              <span>{secondaryProfile.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <span class="text-xs font-bold text-[#767068] dark:text-zinc-400">{secondaryProfile}</span>
          </div>
        </button>
      </div>

      <div class="pt-4 border-t border-[#767068]/20 dark:border-zinc-800 font-mono text-xs flex justify-end">
        <button 
          onclick={() => { appState.playClickSound(); showAllProfilesModal = false; }} 
          class="px-5 py-2 rounded bg-[#2A2521] text-white dark:bg-zinc-800 hover:bg-opacity-90 transition-all font-bold text-center border-none cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
