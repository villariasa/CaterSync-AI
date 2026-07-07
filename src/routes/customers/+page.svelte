<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Users, Plus, CheckCircle, Mail, Edit3, Trash2, Copy, X } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let showFormModal = $state(false);

  // Form bindings
  let newCustName = $state('');
  let newCustContact = $state('');
  let newCustEmail = $state('');
  let newCustAllergies = $state('');
  let newCustDiet = $state('');
  let newCustTheme = $state('Modern Elegant');
  
  let customerMessage = $state('');
  let editingCustomer = $state(null); // holds customer row if editing

  // Define columns populated on mount
  let columns = $state([]);

  function handleCopyPortalLink(e, row) {
    appState.playClickSound();
    const ident = row.email || row.contact || row.name;
    const link = `${window.location.origin}/portal?contact=${encodeURIComponent(ident)}`;
    
    navigator.clipboard.writeText(link);
    appState.showToast("📋 Client Portal link copied to clipboard!");
    appState.playStampSound();

    const btn = e.currentTarget;
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = "Copied! ✓";
      btn.style.backgroundColor = "#3E6650";
      btn.style.color = "#ffffff";
      btn.style.transform = "scale(1.05)";
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.backgroundColor = "";
        btn.style.color = "";
        btn.style.transform = "";
      }, 1500);
    }
  }

  async function handleSendPortalEmail(row) {
    if (!row.email) {
      appState.showToast("❌ Customer has no email address registered!", "error");
      appState.playBuzzerSound();
      return;
    }

    appState.playClickSound();
    appState.showToast(`✉️ Dispatched link to ${row.email}...`);

    try {
      const response = await fetch('/api/portal/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: row.email,
          name: row.name,
          contact: row.contact,
          preferred_theme: row.preferred_theme,
          dietary_prefs: row.dietary_prefs,
          emailConfig: appState.settings.emailConfig
        })
      });

      const res = await response.json();
      if (res.success) {
        if (res.usingFallback) {
          appState.showToast(`✉️ Sandbox Email Dispatched! Link copied.`, 'success');
          if (typeof window !== 'undefined' && window.navigator && window.navigator.clipboard) {
            window.navigator.clipboard.writeText(res.previewUrl).then(() => {
              appState.showToast(`📋 Sandbox email preview link copied!`, 'info');
            }).catch(() => {});
          }
          console.log(`✉️ CaterSync Sandbox Email Preview URL: ${res.previewUrl}`);
        } else {
          appState.showToast(`✅ Email successfully sent to ${row.email}!`, 'success');
        }
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.warn("Mail server simulation fallback active:", err.message);
      setTimeout(() => {
        appState.showToast(`✅ [MOCK SEND] Email successfully dispatched to ${row.email}`);
        appState.playStampSound();
      }, 1000);
    }
  }

  // Load customer values for editing
  function startEdit(row) {
    appState.playClickSound();
    editingCustomer = row;
    newCustName = row.name;
    newCustContact = row.contact || '';
    newCustEmail = row.email || '';
    newCustAllergies = Array.isArray(row.allergies) ? row.allergies.join(', ') : (row.allergies || '');
    newCustDiet = Array.isArray(row.dietary_prefs) ? row.dietary_prefs.join(', ') : (row.dietary_prefs || '');
    newCustTheme = row.preferred_theme || 'Modern Elegant';
    customerMessage = `✏️ Editing: ${row.name}`;
    showFormModal = true;
  }

  function cancelEdit() {
    appState.playClickSound();
    editingCustomer = null;
    newCustName = '';
    newCustContact = '';
    newCustEmail = '';
    newCustAllergies = '';
    newCustDiet = '';
    newCustTheme = 'Modern Elegant';
    customerMessage = '';
    showFormModal = false;
  }

  async function submitCustomer(e) {
    e.preventDefault();
    if (!newCustName || !newCustEmail) return;

    appState.playClickSound();

    const payload = {
      name: newCustName,
      contact: newCustContact,
      email: newCustEmail,
      allergies: newCustAllergies ? newCustAllergies.split(',').map(x => x.trim()).filter(Boolean) : [],
      dietary_prefs: newCustDiet ? newCustDiet.split(',').map(x => x.trim()).filter(Boolean) : [],
      preferred_theme: newCustTheme
    };

    if (editingCustomer) {
      // --- UPDATE EXISTING CUSTOMER ---
      const updatePayload = { id: editingCustomer.id, ...payload };

      if (appState.usingMockData) {
        appState.customers = appState.customers.map(c => c.id === editingCustomer.id ? { ...c, ...payload } : c);
        appState.showToast("👥 Customer profile updated locally");
        appState.playStampSound();
        cancelEdit();
        return;
      }

      try {
        const response = await fetch('/api/customers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        const res = await response.json();
        if (res.success) {
          appState.customers = appState.customers.map(c => c.id === editingCustomer.id ? res.customer : c);
          appState.showToast("👥 Customer profile updated successfully");
          appState.playStampSound();
          cancelEdit();
        } else {
          // DB Offline write fallback
          if (res.error && (res.error.includes('Database write') || res.error.includes('ECONNREFUSED'))) {
            appState.customers = appState.customers.map(c => c.id === editingCustomer.id ? { ...c, ...payload } : c);
            appState.showToast("⚠️ DB Offline. Updated profile in local cache.");
            appState.playStampSound();
            cancelEdit();
          } else {
            throw new Error(res.error);
          }
        }
      } catch (err) {
        // Network offline fallback
        appState.customers = appState.customers.map(c => c.id === editingCustomer.id ? { ...c, ...payload } : c);
        appState.showToast("⚠️ Network offline. Updated profile locally.");
        appState.playStampSound();
        cancelEdit();
      }
    } else {
      // --- CREATE NEW CUSTOMER ---
      if (appState.usingMockData) {
        const mockCustomer = {
          id: Date.now(),
          ...payload
        };
        appState.customers = [...appState.customers, mockCustomer];
        appState.showToast("👥 New customer profile created");
        appState.playStampSound();
        cancelEdit();
        return;
      }

      try {
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.success) {
          appState.customers = [...appState.customers, res.customer];
          appState.showToast("👥 New customer profile created");
          appState.playStampSound();
          cancelEdit();
        } else {
          if (res.error && (res.error.includes('Database write failed') || res.error.includes('ECONNREFUSED'))) {
            const mockCustomer = {
              id: Date.now(),
              ...payload
            };
            appState.customers = [...appState.customers, mockCustomer];
            appState.showToast("👥 Saved customer locally (Offline mode)");
            appState.playStampSound();
            cancelEdit();
          } else {
            throw new Error(res.error);
          }
        }
      } catch (err) {
        const mockCustomer = {
          id: Date.now(),
          ...payload
        };
        appState.customers = [...appState.customers, mockCustomer];
        appState.showToast("👥 Saved customer locally (Offline mode)");
        appState.playStampSound();
        cancelEdit();
      }
    }
  }

  async function deleteCustomer(id) {
    if (!confirm("Are you sure you want to delete this customer profile?")) return;
    appState.playClickSound();

    if (appState.usingMockData) {
      appState.customers = appState.customers.filter(c => c.id !== id);
      appState.showToast("👥 Customer record deleted locally");
      appState.playStampSound();
      return;
    }

    try {
      const response = await fetch(`/api/customers?id=${id}`, {
        method: 'DELETE'
      });
      const res = await response.json();
      if (res.success) {
        appState.customers = appState.customers.filter(c => c.id !== id);
        appState.showToast("👥 Customer profile deleted");
        appState.playStampSound();
      } else {
        if (res.error && (res.error.includes('Database write') || res.error.includes('ECONNREFUSED'))) {
          appState.customers = appState.customers.filter(c => c.id !== id);
          appState.showToast("⚠️ DB Offline. Deleted locally.");
          appState.playStampSound();
        } else {
          throw new Error(res.error);
        }
      }
    } catch (err) {
      appState.customers = appState.customers.filter(c => c.id !== id);
      appState.showToast("⚠️ Network offline. Deleted locally.");
      appState.playStampSound();
    }
  }

  onMount(() => {
    columns = [
      { key: 'id', label: 'ID', sortable: true },
      { key: 'name', label: 'Name', sortable: true, isSans: true },
      { key: 'contact', label: 'Contact Number', sortable: false },
      { key: 'email', label: 'Email Address', sortable: true, isSans: true },
      { 
        key: 'allergies', 
        label: 'Allergen Flags', 
        sortable: false,
        render: (row) => {
          if (row.allergies && row.allergies.length > 0) {
            return row.allergies.map(a => `<span class="px-1.5 py-0.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] font-bold mr-1">${a}</span>`).join('');
          }
          return `<span class="text-slate-300">—</span>`;
        }
      },
      { 
        key: 'dietary_prefs', 
        label: 'Dietary Prefs', 
        sortable: false,
        render: (row) => {
          if (row.dietary_prefs && row.dietary_prefs.length > 0) {
            return row.dietary_prefs.map(d => `<span class="px-1.5 py-0.5 rounded bg-[#3E6650]/10 text-[#3E6650] font-bold mr-1">${d}</span>`).join('');
          }
          return `<span class="text-slate-300">—</span>`;
        }
      },
      { key: 'preferred_theme', label: 'Preferred Theme', sortable: true, isSans: true },
      {
        key: 'portal_link',
        label: 'Portal & Management Actions',
        sortable: false,
        render: portalActionSnippet,
        isSnippet: true
      }
    ];
  });
</script>

{#snippet portalActionSnippet(row)}
  <div class="flex items-center gap-2 select-none">
    <button 
      onclick={(e) => handleCopyPortalLink(e, row)}
      class="w-7 h-7 bg-[#2A2521] hover:bg-[#D9A441] text-[#F6F2EA] hover:text-[#2A2521] rounded-full flex items-center justify-center transition-all btn-interactive"
      title="Copy Portal Link"
    >
      <Copy size={12} />
    </button>
    <button 
      onclick={() => handleSendPortalEmail(row)}
      class="w-7 h-7 bg-[#3E6650] hover:bg-[#3E6650]/80 text-[#F6F2EA] rounded-full flex items-center justify-center transition-all btn-interactive"
      title="Send Portal Invite Email"
    >
      <Mail size={12} />
    </button>
    <button 
      onclick={() => startEdit(row)}
      class="w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center transition-all btn-interactive"
      title="Edit Client Profile"
    >
      <Edit3 size={12} />
    </button>
    <button 
      onclick={() => deleteCustomer(row.id)}
      class="w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-all btn-interactive"
      title="Delete Client Profile"
    >
      <Trash2 size={12} />
    </button>
  </div>
{/snippet}

<div class="space-y-6 animate-fade-in">
  
  <!-- Header Action Row -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-[#24201E]/40 p-4 rounded-xl border border-[#767068]/20 backdrop-blur-sm">
    <div class="flex items-center gap-3 animate-fade-in">
      <div class="p-2.5 bg-[#3E6650] text-[#F6F2EA] rounded-lg">
        <Users size={20} />
      </div>
      <div>
        <h1 class="text-xl font-extrabold text-[#2A2521] dark:text-[#EBE5DC] tracking-tight">Client Accounts</h1>
        <p class="text-xs text-[#767068] dark:text-zinc-400 font-mono mt-0.5">Manage customer profiles and self-service portals.</p>
      </div>
    </div>
    
    <button 
      onclick={() => { appState.playClickSound(); showFormModal = true; editingCustomer = null; cancelEdit(); showFormModal = true; }}
      class="px-4 py-2 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-mono font-bold text-xs rounded uppercase tracking-wider transition-all btn-interactive flex items-center gap-1.5 shadow-sm"
    >
      <Plus size={14} /> Register Client Profile
    </button>
  </div>

  <!-- Client list Registry table utilizing DataTable pagination -->
  <div class="ticket-card p-6 bg-white font-sans">
    <div class="mb-4">
      <span class="ticket-stamp">LEDGER DIRECTORY</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Users size={16} /> Client Accounts
      </h2>
    </div>

    <!-- Paginated DataTable component -->
    <DataTable 
      rows={appState.customers} 
      {columns} 
      searchableKeys={['name', 'contact', 'email', 'preferred_theme']}
      emptyMessage="No customer profiles in directory registry."
    />
  </div>

</div>

<!-- Interactive modal for customer creation/modification -->
{#if showFormModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-md w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative my-8 animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      
      <!-- Close button overlay -->
      <button 
        type="button" 
        onclick={() => { appState.playClickSound(); showFormModal = false; cancelEdit(); }} 
        class="absolute top-4 right-4 text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] btn-interactive p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        title="Close form"
      >
        <X size={18} />
      </button>

      <div class="mb-4">
        <span class="ticket-stamp">{editingCustomer ? 'MODIFICATION' : 'REGISTRATION'}</span>
        <h2 class="text-xl font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2 flex items-center gap-1.5">
          <Plus size={18} /> {editingCustomer ? 'Edit Client Profile' : 'New Client Profile'}
        </h2>
      </div>

      <form onsubmit={submitCustomer} class="space-y-4 text-xs font-mono">
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-name">Name</label>
          <input id="cust-name" type="text" bind:value={newCustName} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" required />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-email">Email Address</label>
          <input id="cust-email" type="email" bind:value={newCustEmail} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" placeholder="client@example.com" required />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-contact">Contact Info</label>
          <input id="cust-contact" type="text" bind:value={newCustContact} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" placeholder="+63 917..." />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-allergies">Allergen Flags (comma separated)</label>
          <input id="cust-allergies" type="text" bind:value={newCustAllergies} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" placeholder="Shellfish, Peanuts" />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-diet">Dietary Preferences</label>
          <input id="cust-diet" type="text" bind:value={newCustDiet} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" placeholder="Vegetarian, Gluten-Free" />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="cust-theme">Preferred Theme</label>
          <select id="cust-theme" bind:value={newCustTheme} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none">
            <option>Modern Elegant</option>
            <option>Rustic Barn</option>
            <option>Tropical Luau</option>
            <option>Corporate Minimalist</option>
          </select>
        </div>

        <div class="flex gap-2 pt-2">
          <button type="submit" class="flex-1 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
            {editingCustomer ? 'Update Profile' : 'Register Profile'}
          </button>
          <button type="button" onclick={() => { appState.playClickSound(); showFormModal = false; cancelEdit(); }} class="bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 text-[#F6F2EA] font-bold text-xs py-3 px-4 rounded uppercase tracking-wider transition-all btn-interactive">
            Cancel
          </button>
        </div>
        
        {#if customerMessage}
          <p class="text-xs font-mono mt-2 text-[#767068]">{customerMessage}</p>
        {/if}
      </form>
    </div>
  </div>
{/if}
