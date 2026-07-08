<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import BiometricScanner from '$lib/components/BiometricScanner.svelte';
  import { 
    Settings, 
    Building2, 
    Users, 
    FileText, 
    Package, 
    Truck, 
    Save, 
    Plus, 
    Trash2, 
    UserX 
  } from '@lucide/svelte';

  const appState = getCateringContext();

  let activeSection = $state('business'); // business, workers, recipes, inventory, suppliers

  // Business settings bindings
  let bizName = $state(appState.settings.business_name);
  let currency = $state(appState.settings.currency_symbol);
  let overhead = $state(appState.settings.overhead_rate);
  let minBudget = $state(appState.settings.min_budget_per_guest);
  let riskMed = $state(appState.settings.risk_medium_threshold);
  let riskHigh = $state(appState.settings.risk_high_threshold);
  let alertsEnabled = $state(appState.settings.low_stock_alerts_enabled);
  let soundDefault = $state(appState.settings.sound_enabled_default);

  let bizMessage = $state('');
  let googleClientId = $state(appState.settings.googleClientId || '');
  let biometricUsername = $state('admin');
  let showBiometricSetup = $state(false);

  // Email App configuration states (Organization-level)
  let gmailAddress = $state(appState.settings.emailConfig?.gmailAddress || '');
  let gmailAppPassword = $state(appState.settings.emailConfig?.gmailAppPassword || '');
  let smtpHost = $state(appState.settings.emailConfig?.smtpHost || 'smtp.gmail.com');
  let smtpPort = $state(appState.settings.emailConfig?.smtpPort || 465);

  // System Mailer configuration states (CaterSync platform-level, for customer OTPs)
  let systemGmailAddress = $state(appState.settings.systemMailerConfig?.gmailAddress || '');
  let systemGmailAppPassword = $state(appState.settings.systemMailerConfig?.gmailAppPassword || '');

  // Workers bindings
  let workerName = $state('');
  let workerRole = $state('Chef');
  let workerRate = $state(250);
  let workerHours = $state(40);
  let workerMessage = $state('');

  // Recipes bindings
  let recipeName = $state('');
  let recipeCategory = $state('Traditional');
  let recipeCost = $state(150);
  let recipePrice = $state(400);
  let recipeTags = $state('');
  let recipeMessage = $state('');

  // Inventory bindings
  let ingName = $state('');
  let ingUnit = $state('kg');
  let ingStock = $state(50);
  let ingReorder = $state(15);
  let ingShelf = $state(7);
  let ingMessage = $state('');

  // Suppliers bindings
  let supplierName = $state('');
  let supplierReliability = $state(0.95);
  let supplierLead = $state(2);
  let supplierMessage = $state('');

  // Save general settings
  async function saveBusinessProfile(e) {
    e.preventDefault();
    appState.playClickSound();
    
    const payload = {
      business_name: bizName,
      currency_symbol: currency,
      overhead_rate: parseFloat(overhead),
      min_budget_per_guest: parseFloat(minBudget),
      risk_medium_threshold: parseFloat(riskMed),
      risk_high_threshold: parseFloat(riskHigh),
      low_stock_alerts_enabled: alertsEnabled,
      sound_enabled_default: soundDefault,
      googleClientId: googleClientId
    };

    const emailConfig = {
      gmailAddress,
      gmailAppPassword,
      smtpHost,
      smtpPort
    };

    const systemMailerConfig = {
      gmailAddress: systemGmailAddress,
      gmailAppPassword: systemGmailAppPassword
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, emailConfig, systemMailerConfig, googleClientId })
      });

      const res = await response.json();
      if (res.success) {
        appState.settings = res.settings;
        bizMessage = '✅ Configuration parameters saved to Database.';
        appState.showToast("⚙️ Settings updated");
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.warn("DB save failed, falling back to local state:", err);
      appState.settings = { ...appState.settings, ...payload, emailConfig, systemMailerConfig, googleClientId };
      bizMessage = `⚠️ Saved locally (DB Write failed: ${err.message})`;
      appState.showToast("⚙️ Settings saved locally");
      appState.playBuzzerSound();
    }
  }

  function testBackgroundNotification() {
    appState.playClickSound();
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'schedule_test_notification',
        delay: 5000,
        title: '⚠️ Depot Stock Warning',
        body: 'Alert: Chicken Breast stocks have crossed the safety reorder limit.'
      });
    }
  }

  // Deactivate worker
  async function deactivateStaff(id) {
    appState.playClickSound();

    try {
      const response = await fetch(`/api/staff?id=${id}`, {
        method: 'DELETE'
      });
      const res = await response.json();
      if (res.success) {
        appState.staff = appState.staff.map(s => {
          if (s.id === id) {
            return { ...s, is_active: false };
          }
          return s;
        });
        appState.showToast("👥 Staff member deactivated");
        appState.playStampSound();
      } else {
        throw new Error(res.error || 'Server error');
      }
    } catch (err) {
      console.warn("DB staff deactivation failed, falling back locally:", err);
      appState.staff = appState.staff.map(s => {
        if (s.id === id) {
          return { ...s, is_active: false };
        }
        return s;
      });
      appState.showToast("👥 Staff deactivated locally (DB failed)");
      appState.playStampSound();
    }
  }

  // Delete menu template
  async function deleteMenu(id) {
    appState.playClickSound();

    try {
      const response = await fetch(`/api/menus?id=${id}`, {
        method: 'DELETE'
      });
      const res = await response.json();
      if (res.success) {
        appState.menus = appState.menus.filter(m => m.id !== id);
        appState.showToast("🍽️ Menu deleted");
        appState.playStampSound();
      } else {
        throw new Error(res.error || 'Server error');
      }
    } catch (err) {
      console.warn("DB menu delete failed, falling back locally:", err);
      appState.menus = appState.menus.filter(m => m.id !== id);
      appState.showToast("🍽️ Menu deleted locally (DB failed)");
      appState.playStampSound();
    }
  }

  import { onMount } from 'svelte';
  onMount(() => {
    window.deactivateStaff = deactivateStaff;
    window.deleteMenu = deleteMenu;
  });
</script>

<div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Left section navigation -->
  <div class="ticket-card p-6 md:col-span-3 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">OPERATIONAL SETUP</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Settings size={18} /> Settings Cockpit
      </h2>
    </div>

    <nav class="flex flex-col gap-1.5 font-mono text-xs">
      <button 
        onclick={() => { appState.playClickSound(); activeSection = 'business'; }}
        class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2 {activeSection === 'business' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'hover:bg-[#F6F2EA]/80 text-[#767068]'}"
      >
        <Building2 size={13} /> Business Profile
      </button>
      <button 
        onclick={() => { appState.playClickSound(); activeSection = 'workers'; }}
        class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2 {activeSection === 'workers' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'hover:bg-[#F6F2EA]/80 text-[#767068]'}"
      >
        <Users size={13} /> Workers Roster
      </button>
      <button 
        onclick={() => { appState.playClickSound(); activeSection = 'recipes'; }}
        class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2 {activeSection === 'recipes' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'hover:bg-[#F6F2EA]/80 text-[#767068]'}"
      >
        <FileText size={13} /> Recipes & Menus
      </button>
      <button 
        onclick={() => { appState.playClickSound(); activeSection = 'inventory'; }}
        class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2 {activeSection === 'inventory' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'hover:bg-[#F6F2EA]/80 text-[#767068]'}"
      >
        <Package size={13} /> Depot Stock
      </button>
      <button 
        onclick={() => { appState.playClickSound(); activeSection = 'suppliers'; }}
        class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2 {activeSection === 'suppliers' ? 'bg-[#2A2521] text-[#F6F2EA] font-bold' : 'hover:bg-[#F6F2EA]/80 text-[#767068]'}"
      >
        <Truck size={13} /> Suppliers Registry
      </button>
    </nav>
  </div>

  <!-- Right details workspace based on section -->
  <div class="md:col-span-9 space-y-6">
    
    <!-- ----------------------- BUSINESS PROFILE ----------------------- -->
    {#if activeSection === 'business'}
      <div class="ticket-card p-6 bg-white animate-fade-in">
        <div class="mb-4">
          <span class="ticket-stamp">PROFILING</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Catering Rules Configuration</h2>
        </div>

        <form onsubmit={saveBusinessProfile} class="space-y-4 font-sans text-xs">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Company Name</label>
              <input type="text" bind:value={bizName} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Currency Symbol</label>
              <input type="text" bind:value={currency} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Overhead Rate multiplier (0.00 to 1.00)</label>
              <input type="number" step="0.01" bind:value={overhead} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Minimum Budget/Head (₱)</label>
              <input type="number" bind:value={minBudget} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Medium Risk Threshold (0.00 to 1.00)</label>
              <input type="number" step="0.05" bind:value={riskMed} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">High Risk Threshold (0.00 to 1.00)</label>
              <input type="number" step="0.05" bind:value={riskHigh} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" required />
            </div>
          </div>

          <div class="flex flex-col gap-2 pt-3">
            <label class="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" bind:checked={alertsEnabled} class="rounded border-[#767068]/30 text-[#3E6650] w-4 h-4" />
              Enable depot stock low warnings
            </label>
            <label class="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" bind:checked={soundDefault} class="rounded border-[#767068]/30 text-[#3E6650] w-4 h-4" />
              Enable synthesizer sound effects by default
            </label>

            <!-- Test Background Notification Button -->
            <button 
              type="button"
              onclick={testBackgroundNotification}
              class="w-full mt-2.5 bg-[#D9A441]/10 hover:bg-[#D9A441]/20 text-[#D9A441] border border-[#D9A441]/30 font-mono text-[10px] font-bold py-2 rounded uppercase tracking-wider transition-all btn-interactive"
            >
              ⏱️ Test Background Push Notification (5s delay)
            </button>
            <span class="text-[9px] text-[#767068] font-mono leading-relaxed mt-0.5 block text-center">
              Click, then close this browser tab immediately. A system notification triggers in 5s.
            </span>
          </div>

          <!-- Email SMTP settings integration -->
          <div class="border-t-2 border-dashed border-[#767068]/20 my-6 pt-6 animate-fade-in">
            <span class="ticket-stamp">SMTP MAIL SERVER</span>
            <h3 class="text-sm font-bold text-[#2A2521] mt-2 mb-3">Gmail Application Link Setup</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Gmail Account Address</label>
                <input type="email" bind:value={gmailAddress} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" placeholder="example@gmail.com" />
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">App-Specific Password</label>
                <input type="password" bind:value={gmailAppPassword} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" placeholder="•••• •••• •••• ••••" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">SMTP Host</label>
                <input type="text" bind:value={smtpHost} class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" />
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">SMTP Port</label>
                <input type="number" bind:value={smtpPort} class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none" />
              </div>
            </div>
            <p class="text-[10px] text-[#767068] mt-2 font-mono leading-relaxed">
              ⚠️ Note: Requires enabling "App Passwords" in your Google Account security settings. This SMTP configuration will be used to automatically dispatch direct portal logins via Gmail.
            </p>
          </div>

          <!-- Google Sign-In Configuration Card -->
          <div class="border-t-2 border-dashed border-[#767068]/20 my-6 pt-6 animate-fade-in text-[#2A2521]">
            <span class="ticket-stamp">GOOGLE OAUTH IDENTITY</span>
            <h3 class="text-sm font-bold mt-2 mb-3">Google Sign-In API Credentials</h3>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">Google OAuth Client ID</label>
              <input type="text" bind:value={googleClientId} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 focus:outline-none text-xs bg-slate-50 font-mono" placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com" />
              <p class="text-[9px] text-[#767068] mt-1.5 font-mono leading-relaxed">
                Provide the Client ID generated in your Google Developer Console. If populated, clients will see a "Continue with Google" button to instantly sign up or log in.
              </p>
            </div>
          </div>

          <!-- System Mailer Configuration Card (CaterSync Platform OTP Sender) -->
          <div class="border-t-2 border-dashed border-[#3E6650]/30 my-6 pt-6 animate-fade-in text-[#2A2521]">
            <span class="ticket-stamp bg-[#3E6650]/10 text-[#3E6650] border-[#3E6650]/30">SYSTEM MAILER</span>
            <h3 class="text-sm font-bold mt-2 mb-1">Customer OTP Sender Account</h3>
            <p class="text-[10px] text-[#767068] font-mono mb-4 leading-relaxed">
              📧 This Gmail account is used by CaterSync to send OTP verification codes to all customers during Google sign-in. It is <strong>independent</strong> of any catering organization's email settings.
            </p>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">System Gmail Address</label>
                <input type="email" bind:value={systemGmailAddress} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#3E6650]/40 focus:outline-none focus:border-[#3E6650] bg-[#3E6650]/5" placeholder="noreply@gmail.com" />
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1">App-Specific Password</label>
                <input type="password" bind:value={systemGmailAppPassword} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#3E6650]/40 focus:outline-none focus:border-[#3E6650] bg-[#3E6650]/5" placeholder="•••• •••• •••• ••••" />
              </div>
            </div>
            <p class="text-[9px] text-[#767068] mt-2 font-mono leading-relaxed">
              ✅ Enable Gmail "App Passwords" in your Google Account security settings. This is a separate credential from your catering business's SMTP configuration above.
            </p>
          </div>

          <!-- Biometric & Passkey Registration Card -->
          <div class="border-t-2 border-dashed border-[#767068]/20 my-6 pt-6 animate-fade-in text-[#2A2521]">
            <span class="ticket-stamp">OPERATOR SECURITY</span>
            <h3 class="text-sm font-bold mt-2 mb-3">Operator Biometric / Passkey Setup</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <p class="text-[10px] text-[#767068] font-mono leading-relaxed">
                  Enrolling your device biometrics (Fingerprint, Face ID, Windows Hello) allows instant password-free and PIN-free access next time.
                </p>
                <div class="mt-3 flex items-center gap-3">
                  <input type="text" bind:value={biometricUsername} class="px-3 py-2 rounded border border-[#767068]/30 focus:outline-none text-xs w-full bg-slate-50 font-mono" placeholder="Operator username (e.g. admin)" />
                  <button type="button" onclick={() => { appState.playClickSound(); showBiometricSetup = true; }} class="bg-[#2A2521] text-white hover:bg-slate-800 px-3.5 py-2 text-xs font-mono font-bold rounded uppercase tracking-wider transition-all whitespace-nowrap">
                    Enroll Device
                  </button>
                </div>
              </div>
              
              {#if showBiometricSetup}
                <div class="border border-[#767068]/20 rounded p-4 bg-white shadow-inner">
                  <BiometricScanner action="register" username={biometricUsername} accountType="operator" onsuccess={() => { showBiometricSetup = false; appState.showToast("Biometrics registered successfully!"); }} oncancel={() => showBiometricSetup = false} />
                </div>
              {/if}
            </div>
          </div>

          <div class="pt-4 border-t border-[#767068]/20 flex items-center justify-between">
            <button type="submit" class="bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-mono text-xs font-bold py-2.5 px-4 rounded uppercase tracking-wider transition-all btn-interactive flex items-center gap-1.5">
              <Save size={14} /> Save configuration
            </button>
            {#if bizMessage}
              <span class="font-mono text-xs text-[#767068]">{bizMessage}</span>
            {/if}
          </div>
        </form>
      </div>
    {/if}

    <!-- ----------------------- WORKERS ROSTER ----------------------- -->
    {#if activeSection === 'workers'}
      <div class="ticket-card p-6 bg-white animate-fade-in">
        <div class="mb-4">
          <span class="ticket-stamp">ROSTER BUILDER</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Enrolled Roster Directory</h2>
        </div>

        <DataTable 
          rows={appState.staff}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Worker Name', isSans: true },
            { key: 'role', label: 'Role' },
            { key: 'hourly_rate', label: 'Rate (₱/hr)', render: (row) => `₱${parseFloat(row.hourly_rate).toFixed(2)}` },
            { key: 'is_active', label: 'Status', render: (row) => row.is_active ?? true ? 'Active' : 'Inactive' },
            { 
              key: 'actions', 
              label: 'Actions', 
              align: 'right',
              render: (row) => {
                if (row.is_active ?? true) {
                  return `<button onclick="window.deactivateStaff(${row.id})" class="text-[#AC3B2A] hover:underline font-mono text-[10px] uppercase">Deactivate</button>`;
                }
                return `<span class="text-slate-300">Inactive</span>`;
              }
            }
          ]}
        />
      </div>
    {/if}

    <!-- ----------------------- RECIPES & MENUS ----------------------- -->
    {#if activeSection === 'recipes'}
      <div class="ticket-card p-6 bg-white animate-fade-in">
        <div class="mb-4">
          <span class="ticket-stamp">MENU DIRECTORY</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Configured Menu Catalog</h2>
        </div>

        <DataTable 
          rows={appState.menus}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Menu Title', isSans: true },
            { key: 'category', label: 'Category' },
            { key: 'cost_per_serving', label: 'Cost', render: (row) => `₱${parseFloat(row.cost_per_serving).toFixed(2)}` },
            { key: 'price_per_serving', label: 'Price/Head', render: (row) => `₱${parseFloat(row.price_per_serving).toFixed(2)}` },
            { 
              key: 'actions', 
              label: 'Actions', 
              align: 'right',
              render: (row) => `<button onclick="window.deleteMenu(${row.id})" class="text-[#AC3B2A] hover:underline font-mono text-[10px] uppercase">Delete</button>`
            }
          ]}
        />
      </div>
    {/if}

    <!-- ----------------------- INVENTORY ITEMS ----------------------- -->
    {#if activeSection === 'inventory'}
      <div class="ticket-card p-6 bg-white animate-fade-in">
        <div class="mb-4">
          <span class="ticket-stamp">STOCK LEDGER</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Depot Stock Rules</h2>
        </div>

        <DataTable 
          rows={appState.ingredients}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Ingredient', isSans: true },
            { key: 'unit', label: 'Unit' },
            { key: 'reorder_point', label: 'Min Safety stock', render: (row) => `${parseFloat(row.reorder_point).toFixed(1)} ${row.unit}` },
            { key: 'shelf_life_days', label: 'Shelf Life', render: (row) => `${row.shelf_life_days} days` }
          ]}
        />
      </div>
    {/if}

    <!-- ----------------------- PARTNER SUPPLIERS ----------------------- -->
    {#if activeSection === 'suppliers'}
      <div class="ticket-card p-6 bg-white animate-fade-in">
        <div class="mb-4">
          <span class="ticket-stamp">SUPPLIERS MATRIX</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Active Partner Supplier list</h2>
        </div>

        <DataTable 
          rows={appState.suppliers}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Supplier Name', isSans: true },
            { key: 'reliability_score', label: 'Reliability Index', render: (row) => `${(parseFloat(row.reliability_score) * 100).toFixed(0)}%` },
            { key: 'avg_lead_time_days', label: 'Lead Time', render: (row) => `${row.avg_lead_time_days} days` }
          ]}
        />
      </div>
    {/if}

  </div>
</div>
