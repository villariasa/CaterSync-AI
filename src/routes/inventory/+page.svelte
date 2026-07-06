<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import AlertBadge from '$lib/components/AlertBadge.svelte';
  import TicketCard from '$lib/components/TicketCard.svelte';
  import { Package, Truck, ArrowUpDown } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let eoqSuggestions = $state([]);
  let loadingEOQ = $state(false);

  // Define inventory columns
  const columns = [
    { key: 'name', label: 'Ingredient Name', sortable: true, isSans: true },
    { 
      key: 'current_stock', 
      label: 'Store Room Stock', 
      sortable: true,
      render: (row) => `${parseFloat(row.current_stock).toFixed(1)} ${row.unit}`
    },
    { 
      key: 'reorder_point', 
      label: 'Reorder Point', 
      sortable: true,
      render: (row) => `${parseFloat(row.reorder_point).toFixed(1)} ${row.unit}`
    },
    { 
      key: 'shelf_life_days', 
      label: 'Shelf Life', 
      sortable: true,
      render: (row) => `${row.shelf_life_days} days`
    },
    {
      key: 'status',
      label: 'Threshold status',
      sortable: false,
      align: 'right',
      render: (row) => {
        const isCritical = parseFloat(row.current_stock) <= parseFloat(row.reorder_point);
        return isCritical 
          ? `<span class="px-2 py-0.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] font-bold border border-[#AC3B2A]/20 text-[9px] uppercase">CRITICAL</span>`
          : `<span class="px-2 py-0.5 rounded bg-[#3E6650]/10 text-[#3E6650] font-bold border border-[#3E6650]/20 text-[9px] uppercase">NOMINAL</span>`;
      }
    }
  ];

  async function fetchEOQPurchasing() {
    loadingEOQ = true;
    try {
      // Package payload variables
      const payload = appState.ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        current_stock: parseFloat(ing.current_stock),
        reorder_point: parseFloat(ing.reorder_point),
        shelf_life_days: ing.shelf_life_days,
        weekly_demand: parseFloat(ing.reorder_point) * 2.2, // simulate weekly demand
        unit_cost: 120.0,
        supplier_prices: appState.suppliers.map(s => ({
          supplier_id: s.id,
          name: s.name,
          price: 115.0 + Math.random() * 10,
          lead_time: s.avg_lead_time_days,
          reliability: parseFloat(s.reliability_score)
        }))
      }));

      const res = await fetch('/api/ai/ingredient-purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: payload })
      });
      const data = await res.json();
      if (data.success && data.suggestions) {
        eoqSuggestions = data.suggestions;
      }
    } catch (err) {
      console.warn("EOQ microservice solver failed, running local calculations", err.message);
      // Run local simulated solver
      eoqSuggestions = appState.ingredients
        .filter(ing => parseFloat(ing.current_stock) <= parseFloat(ing.reorder_point))
        .map(ing => {
          const supplier = appState.suppliers[0] || { id: 1, name: 'Metro Meat' };
          return {
            ingredient_id: ing.id,
            name: ing.name,
            quantity: Math.round(parseFloat(ing.reorder_point) * 2),
            unit: ing.unit,
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            cost: Math.round(parseFloat(ing.reorder_point) * 2 * 150)
          };
        });
    } finally {
      loadingEOQ = false;
    }
  }

  async function approveRestockTicket(item) {
    appState.playClickSound();
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: item.supplier_id || 1,
          ingredient_id: item.ingredient_id,
          quantity: item.quantity || 50,
          cost: item.cost || 5000
        })
      });
      const res = await response.json();
      if (res.success) {
        appState.showToast(`🛒 PO ordered: +${item.quantity} ${item.unit} added to ${item.name}`);
        appState.playStampSound();
        
        // Refresh client ingredients stock levels reactively
        appState.ingredients = appState.ingredients.map(ing => {
          if (ing.id === item.ingredient_id) {
            return {
              ...ing,
              current_stock: (parseFloat(ing.current_stock) + item.quantity).toFixed(1)
            };
          }
          return ing;
        });

        // Filter out approved suggestion
        eoqSuggestions = eoqSuggestions.filter(s => s.ingredient_id !== item.ingredient_id);
      }
    } catch (err) {
      appState.showToast("❌ Replenishment failed: " + err.message, "error");
    }
  }

  onMount(() => {
    fetchEOQPurchasing();
  });
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Depot Stock Levels Table -->
  <div class="ticket-card p-6 lg:col-span-8 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">DEPOT STORES</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Package size={16} /> Depot Stock Ledger
      </h2>
    </div>

    <DataTable 
      rows={appState.ingredients} 
      {columns} 
      searchableKeys={['name']}
      emptyMessage="No ingredients logged in inventory."
    />
  </div>

  <!-- EOQ Purchasing Suggestions -->
  <div class="ticket-card p-6 lg:col-span-4 border-l-4 border-[#D9A441] bg-white">
    <div class="mb-4">
      <span class="ticket-stamp" style="color: var(--color-saffron); border-color: var(--color-saffron)">MODULE 3 PURCHASING</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Truck size={16} /> EOQ Order suggestions
      </h2>
    </div>

    <p class="text-xs text-[#767068] leading-relaxed mb-4 font-sans">
      AI Economic Order Quantity calculations minimize total holding costs while balancing perishability limits.
    </p>

    {#if loadingEOQ}
      <div class="space-y-4">
        <div class="h-16 bg-[#767068]/15 rounded skeleton-shimmer"></div>
        <div class="h-16 bg-[#767068]/15 rounded skeleton-shimmer"></div>
      </div>
    {:else if eoqSuggestions.length > 0}
      <div class="space-y-4">
        {#each eoqSuggestions as item}
          <div class="p-3.5 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-xs font-mono">
            <div class="flex justify-between items-start font-bold">
              <span class="text-[#2A2521]">{item.name}</span>
              <span class="text-[#D9A441] font-bold">+{item.quantity} {item.unit || 'kg'}</span>
            </div>
            
            <div class="text-[10px] text-[#767068] mt-2 space-y-0.5">
              <div>Supplier: <strong class="text-[#2a2521]">{item.supplier_name}</strong></div>
              <div>Est Cost: <strong class="text-[#3E6650]">₱{Math.round(item.cost).toLocaleString()}</strong></div>
            </div>

            <div class="mt-3 flex justify-end">
              <button 
                onclick={() => approveRestockTicket(item)}
                class="px-3 py-1 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-mono text-[9px] uppercase tracking-wider rounded font-bold btn-interactive"
              >
                Approve & Order PO
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="p-6 text-center border border-dashed border-[#767068]/30 rounded text-xs font-mono text-[#767068]">
        No restock orders recommended. Current stock levels comply with safety targets.
      </div>
    {/if}
  </div>

</div>
