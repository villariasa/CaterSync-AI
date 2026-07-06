<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Truck, Plus } from '@lucide/svelte';

  const appState = getCateringContext();

  let name = $state('');
  let reliabilityScore = $state(0.95);
  let avgLeadTime = $state(2);
  
  let supplierMessage = $state('');

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Supplier Name', sortable: true, isSans: true },
    { 
      key: 'reliability_score', 
      label: 'Reliability Index', 
      sortable: true,
      render: (row) => `${(parseFloat(row.reliability_score) * 100).toFixed(0)}%`
    },
    { 
      key: 'avg_lead_time_days', 
      label: 'Avg Lead Time', 
      sortable: true,
      render: (row) => `${row.avg_lead_time_days} days`
    }
  ];

  async function submitSupplier(e) {
    e.preventDefault();
    if (!name) return;

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          reliability_score: reliabilityScore,
          avg_lead_time_days: avgLeadTime
        })
      });

      const res = await response.json();
      if (res.success) {
        appState.suppliers = [...appState.suppliers, res.supplier];
        supplierMessage = `✅ Supplier profile "${res.supplier.name}" added successfully.`;
        name = '';
        appState.showToast("🚚 Supplier account verified");
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      supplierMessage = `❌ Creation failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Add Supplier Form -->
  <div class="ticket-card p-6 lg:col-span-4 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">LOGISTICS REGISTRY</span>
      <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Plus size={18} /> Add Supplier Profile
      </h2>
    </div>

    <form onsubmit={submitSupplier} class="space-y-4">
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="supplier-name">Supplier Name</label>
        <input id="supplier-name" type="text" bind:value={name} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="supplier-reliability">Reliability Index (0.00 to 1.00)</label>
        <input id="supplier-reliability" type="number" step="0.01" bind:value={reliabilityScore} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" max="1" />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="supplier-lead">Avg Lead Time (days)</label>
        <input id="supplier-lead" type="number" bind:value={avgLeadTime} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" />
      </div>

      <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
        Verify Supplier
      </button>
      
      {#if supplierMessage}
        <p class="text-xs font-mono mt-2 text-[#767068]">{supplierMessage}</p>
      {/if}
    </form>
  </div>

  <!-- Suppliers list -->
  <div class="ticket-card p-6 lg:col-span-8 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">LEDGER DIRECTORY</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Truck size={16} /> Partner Suppliers
      </h2>
    </div>

    <DataTable 
      rows={appState.suppliers} 
      {columns} 
      searchableKeys={['name']}
      emptyMessage="No suppliers enrolled."
    />
  </div>

</div>
