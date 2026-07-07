<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { FileText, Plus, X } from '@lucide/svelte';

  const appState = getCateringContext();

  let showFormModal = $state(false);

  let name = $state('');
  let category = $state('Traditional');
  let costPerServing = $state(150);
  let pricePerServing = $state(400);
  let cuisineTags = $state('');
  
  let menuMessage = $state('');

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Menu Name', sortable: true, isSans: true },
    { key: 'category', label: 'Category', sortable: true },
    { 
      key: 'cost_per_serving', 
      label: 'Raw Cost', 
      sortable: true,
      render: (row) => `₱${parseFloat(row.cost_per_serving).toFixed(2)}`
    },
    { 
      key: 'price_per_serving', 
      label: 'Serving Price', 
      sortable: true,
      render: (row) => `₱${parseFloat(row.price_per_serving).toFixed(2)}`
    },
    {
      key: 'cuisine_tags',
      label: 'Cuisine Tags',
      sortable: false,
      render: (row) => {
        if (row.cuisine_tags && row.cuisine_tags.length > 0) {
          return row.cuisine_tags.map(t => `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-[#767068] font-bold mr-1 text-[9px]">${t}</span>`).join('');
        }
        return `—`;
      }
    }
  ];

  async function submitMenu(e) {
    e.preventDefault();
    if (!name) return;

    const payload = {
      name,
      category,
      cost_per_serving: costPerServing,
      price_per_serving: pricePerServing,
      cuisine_tags: cuisineTags ? cuisineTags.split(',').map(x => x.trim()) : []
    };

    if (appState.usingMockData) {
      const mockMenu = {
        id: Date.now(),
        ...payload
      };
      appState.menus = [...appState.menus, mockMenu];
      menuMessage = '';
      name = '';
      cuisineTags = '';
      appState.showToast("🍽️ Menu index created");
      appState.playStampSound();
      showFormModal = false;
      return;
    }

    try {
      const response = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        appState.menus = [...appState.menus, res.menu];
        menuMessage = '';
        name = '';
        cuisineTags = '';
        appState.showToast("🍽️ Menu index created");
        appState.playStampSound();
        showFormModal = false;
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      menuMessage = `❌ Creation failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }
</script>

<div class="space-y-6 animate-fade-in">
  
  <!-- Header Action Row -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-[#24201E]/40 p-4 rounded-xl border border-[#767068]/20 backdrop-blur-sm">
    <div class="flex items-center gap-3">
      <div class="p-2.5 bg-[#3E6650] text-[#F6F2EA] rounded-lg animate-fade-in">
        <FileText size={20} />
      </div>
      <div>
        <h1 class="text-xl font-extrabold text-[#2A2521] dark:text-[#EBE5DC] tracking-tight">Configured Recipes & Menus</h1>
        <p class="text-xs text-[#767068] dark:text-zinc-400 font-mono mt-0.5">Manage and audit catering recipe and package templates.</p>
      </div>
    </div>
    
    <button 
      onclick={() => { appState.playClickSound(); showFormModal = true; menuMessage = ''; }}
      class="px-4 py-2 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-mono font-bold text-xs rounded uppercase tracking-wider transition-all btn-interactive flex items-center gap-1.5 shadow-sm"
    >
      <Plus size={14} /> New Menu Template
    </button>
  </div>

  <!-- Menus Table -->
  <div class="ticket-card p-6 bg-white font-sans">
    <div class="mb-4">
      <span class="ticket-stamp">CATALOG ARCHIVE</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <FileText size={16} /> Configured Recipes & Menus
      </h2>
    </div>

    <DataTable 
      rows={appState.menus} 
      {columns} 
      searchableKeys={['name', 'category', 'cuisine_tags']}
      emptyMessage="No menus currently configured."
    />
  </div>

</div>

<!-- Modal Dialog -->
{#if showFormModal}
  <div class="fixed inset-0 bg-[#2A2521]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
    <div class="ticket-card bg-white dark:bg-[#24201E] p-6 max-w-md w-full border border-[#767068]/30 dark:border-zinc-800 shadow-2xl relative my-8 animate-scale-up text-[#2A2521] dark:text-[#EBE5DC]">
      
      <!-- Close button overlay -->
      <button 
        type="button" 
        onclick={() => { appState.playClickSound(); showFormModal = false; }} 
        class="absolute top-4 right-4 text-[#767068] hover:text-[#2A2521] dark:hover:text-[#EBE5DC] btn-interactive p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        title="Close form"
      >
        <X size={18} />
      </button>

      <div class="mb-4">
        <span class="ticket-stamp">RECIPE ARCHIVE</span>
        <h2 class="text-xl font-bold text-[#2A2521] dark:text-[#EBE5DC] mt-2 flex items-center gap-1.5">
          <Plus size={18} /> New Menu Template
        </h2>
      </div>

      <form onsubmit={submitMenu} class="space-y-4 text-xs font-mono">
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="menu-name">Menu Title</label>
          <input id="menu-name" type="text" bind:value={name} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" required />
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="menu-category">Category</label>
          <select id="menu-category" bind:value={category} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none">
            <option>Traditional</option>
            <option>Seafood</option>
            <option>Vegetarian</option>
            <option>Corporate</option>
            <option>Western</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="menu-cost">Raw Cost (₱)</label>
            <input id="menu-cost" type="number" bind:value={costPerServing} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" min="0" />
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="menu-price">Price/Head (₱)</label>
            <input id="menu-price" type="number" bind:value={pricePerServing} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" min="0" />
          </div>
        </div>
        <div>
          <label class="block font-bold text-[#767068] uppercase mb-1" for="menu-tags">Cuisine Tags (comma separated)</label>
          <input id="menu-tags" type="text" bind:value={cuisineTags} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white dark:bg-[#1A1715] dark:text-[#EBE5DC] text-xs focus:outline-none" placeholder="chicken, soup, mild" />
        </div>

        <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
          Create Menu Template
        </button>
        
        {#if menuMessage}
          <p class="text-xs font-mono mt-2 text-[#767068]">{menuMessage}</p>
        {/if}
      </form>
    </div>
  </div>
{/if}
