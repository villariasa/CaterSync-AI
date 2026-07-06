<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Users, Plus, CheckCircle } from '@lucide/svelte';

  const appState = getCateringContext();

  // New customer form bindings
  let newCustName = $state('');
  let newCustContact = $state('');
  let newCustAllergies = $state('');
  let newCustDiet = $state('');
  let newCustTheme = $state('Modern Elegant');
  
  let customerMessage = $state('');

  // Define table columns
  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true, isSans: true },
    { key: 'contact', label: 'Contact Number', sortable: false },
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
    { key: 'preferred_theme', label: 'Preferred Theme', sortable: true, isSans: true, align: 'right' }
  ];

  async function submitCustomer(e) {
    e.preventDefault();
    if (!newCustName) return;

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustName,
          contact: newCustContact,
          allergies: newCustAllergies ? newCustAllergies.split(',').map(x => x.trim()) : [],
          dietary_prefs: newCustDiet ? newCustDiet.split(',').map(x => x.trim()) : [],
          preferred_theme: newCustTheme
        })
      });

      const res = await response.json();
      if (res.success) {
        appState.customers = [...appState.customers, res.customer];
        customerMessage = `✅ Customer profile "${res.customer.name}" registered successfully.`;
        newCustName = '';
        newCustContact = '';
        newCustAllergies = '';
        newCustDiet = '';
        appState.showToast("👥 New customer profile created");
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      customerMessage = `❌ Registration failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Add Customer Form -->
  <div class="ticket-card p-6 lg:col-span-4 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">REGISTRATION</span>
      <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Plus size={18} /> New Client Profile
      </h2>
    </div>

    <form onsubmit={submitCustomer} class="space-y-4">
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-name">Name</label>
        <input id="cust-name" type="text" bind:value={newCustName} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-contact">Contact Info</label>
        <input id="cust-contact" type="text" bind:value={newCustContact} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" placeholder="+63 917..." />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-allergies">Allergen Flags (comma separated)</label>
        <input id="cust-allergies" type="text" bind:value={newCustAllergies} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" placeholder="Shellfish, Peanuts" />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-diet">Dietary Preferences</label>
        <input id="cust-diet" type="text" bind:value={newCustDiet} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" placeholder="Vegetarian, Gluten-Free" />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-theme">Preferred Theme</label>
        <select id="cust-theme" bind:value={newCustTheme} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
          <option>Modern Elegant</option>
          <option>Rustic Barn</option>
          <option>Tropical Luau</option>
          <option>Corporate Minimalist</option>
        </select>
      </div>

      <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
        Register Profile
      </button>
      
      {#if customerMessage}
        <p class="text-xs font-mono mt-2 text-[#767068]">{customerMessage}</p>
      {/if}
    </form>
  </div>

  <!-- Client list Registry table utilizing DataTable pagination -->
  <div class="ticket-card p-6 lg:col-span-8 bg-white">
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
      searchableKeys={['name', 'contact', 'preferred_theme']}
      emptyMessage="No customer profiles in directory registry."
    />
  </div>

</div>
