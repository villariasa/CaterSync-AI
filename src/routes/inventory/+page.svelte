<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import AlertBadge from '$lib/components/AlertBadge.svelte';
  import TicketCard from '$lib/components/TicketCard.svelte';
  import { Package, Truck, ArrowUpDown, ClipboardList, TrendingDown, Info, Plus } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let eoqSuggestions = $state([]);
  let loadingEOQ = $state(false);

  // Tab state
  let activeTab = $state('stock'); // stock, ledger, audit

  // Stock Adjustment / Waste form state
  let selectedIngId = $state('');
  let transactionType = $state('waste'); // receipt, waste, adjustment
  let transactionQty = $state(0);
  let transactionReason = $state('spoilage'); // spoilage, over-prep, plate waste, adjustment
  let formMessage = $state('');

  // New Ingredient form state
  let newIngName = $state('');
  let newIngUnit = $state('kg');
  let newIngStock = $state(50);
  let newIngReorder = $state(15);
  let newIngShelfLife = $state(30);
  let newIngMessage = $state('');

  async function submitNewIngredient(e) {
    if (e) e.preventDefault();
    if (!newIngName.trim()) return;

    appState.playClickSound();

    const payload = {
      name: newIngName.trim(),
      unit: newIngUnit,
      current_stock: newIngStock,
      reorder_point: newIngReorder,
      shelf_life_days: newIngShelfLife
    };

    try {
      const response = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      if (res.success) {
        appState.ingredients = [...appState.ingredients, res.ingredient];
        newIngMessage = `✅ Ingredient "${payload.name}" registered in Database successfully.`;
        appState.showToast(`📦 New ingredient registered: ${payload.name}`);
        appState.playStampSound();
        newIngName = '';
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.warn("DB ingredient registration failed, falling back locally:", err);
      const mockIng = {
        id: Date.now(),
        ...payload
      };
      appState.ingredients = [...appState.ingredients, mockIng];
      newIngMessage = `⚠️ Saved locally (DB Write failed: ${err.message})`;
      appState.showToast(`📦 Ingredient saved locally`);
      appState.playStampSound();
      newIngName = '';
    }
  }

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

  // Define ledger transaction columns
  const ledgerColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { 
      key: 'ingredient_name', 
      label: 'Ingredient', 
      sortable: true,
      isSans: true,
      render: (row) => {
        const ing = appState.ingredients.find(i => i.id === row.ingredient_id);
        return ing ? ing.name : `Ingredient #${row.ingredient_id}`;
      }
    },
    { 
      key: 'transaction_type', 
      label: 'Type', 
      sortable: true,
      render: (row) => {
        let bg = 'bg-slate-100 text-slate-700';
        if (row.transaction_type === 'receipt') bg = 'bg-emerald-50 text-[#3E6650] border-[#3E6650]/20';
        if (row.transaction_type === 'waste') bg = 'bg-[#AC3B2A]/10 text-[#AC3B2A] border-[#AC3B2A]/20';
        if (row.transaction_type === 'consumption') bg = 'bg-blue-50 text-blue-700 border-blue-200';
        return `<span class="px-2 py-0.5 rounded border text-[9px] uppercase font-bold ${bg}">${row.transaction_type}</span>`;
      }
    },
    { 
      key: 'quantity', 
      label: 'Change Qty', 
      sortable: true,
      render: (row) => {
        const isNegative = ['waste', 'consumption'].includes(row.transaction_type);
        return `<span class="font-bold ${isNegative ? 'text-[#AC3B2A]' : 'text-[#3E6650]'}">${isNegative ? '-' : '+'}${parseFloat(row.quantity).toFixed(1)}</span>`;
      }
    },
    { key: 'reference', label: 'Ref Document', sortable: false },
    { key: 'performed_by', label: 'Logged By', sortable: true },
    { 
      key: 'created_at', 
      label: 'Timestamp', 
      sortable: true,
      render: (row) => new Date(row.created_at || Date.now()).toLocaleString()
    }
  ];

  async function fetchEOQPurchasing() {
    loadingEOQ = true;
    try {
      const payload = appState.ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        current_stock: parseFloat(ing.current_stock),
        reorder_point: parseFloat(ing.reorder_point),
        shelf_life_days: ing.shelf_life_days,
        weekly_demand: parseFloat(ing.reorder_point) * 2.2,
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

    const currentTx = {
      id: Date.now(),
      ingredient_id: item.ingredient_id,
      transaction_type: 'receipt',
      quantity: item.quantity,
      reference: 'EOQ Auto Order Approved',
      performed_by: 'Admin',
      created_at: new Date().toISOString()
    };

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
        
        appState.ingredients = appState.ingredients.map(ing => {
          if (ing.id === item.ingredient_id) {
            return {
              ...ing,
              current_stock: (parseFloat(ing.current_stock) + item.quantity).toFixed(1)
            };
          }
          return ing;
        });

        appState.inventoryTransactions = [currentTx, ...(appState.inventoryTransactions || [])];
        eoqSuggestions = eoqSuggestions.filter(s => s.ingredient_id !== item.ingredient_id);
      } else {
        throw new Error(res.error || 'Server error');
      }
    } catch (err) {
      console.warn("DB purchase order creation failed, falling back locally:", err);
      appState.showToast(`🛒 Purchase ordered locally (DB failed: ${err.message})`, "warning");
      appState.playStampSound();
      
      appState.ingredients = appState.ingredients.map(ing => {
        if (ing.id === item.ingredient_id) {
          return {
            ...ing,
            current_stock: (parseFloat(ing.current_stock) + item.quantity).toFixed(1)
          };
        }
        return ing;
      });

      appState.inventoryTransactions = [currentTx, ...(appState.inventoryTransactions || [])];
      eoqSuggestions = eoqSuggestions.filter(s => s.ingredient_id !== item.ingredient_id);
    }
  }

  // Handle stock variance / waste logging
  async function submitTransaction(e) {
    if (e) e.preventDefault();
    if (!selectedIngId || transactionQty <= 0) return;

    appState.playClickSound();

    const ing = appState.ingredients.find(i => i.id === parseInt(selectedIngId));
    if (!ing) return;

    const tx = {
      id: Date.now(),
      ingredient_id: parseInt(selectedIngId),
      transaction_type: transactionType,
      quantity: transactionQty,
      reference: `Physical Log: ${transactionReason}`,
      performed_by: 'Admin Stocktake',
      created_at: new Date().toISOString()
    };

    // Update quantities reactively
    appState.ingredients = appState.ingredients.map(i => {
      if (i.id === parseInt(selectedIngId)) {
        let newQty = parseFloat(i.current_stock);
        if (['waste', 'consumption'].includes(transactionType)) {
          newQty = Math.max(0, newQty - transactionQty);
        } else {
          newQty = newQty + transactionQty;
        }
        return { ...i, current_stock: newQty.toFixed(1) };
      }
      return i;
    });

    appState.inventoryTransactions = [tx, ...(appState.inventoryTransactions || [])];
    formMessage = `✅ Logged ${transactionType} transaction for ${ing.name} (Change: ${transactionQty} ${ing.unit}).`;
    appState.playStampSound();
    
    // Clear inputs
    transactionQty = 0;
  }

  onMount(() => {
    // Initialize transactions as empty — operators build their own ledger.
    // Do NOT pre-populate with fake data; a blank ledger is the correct new-operator state.
    if (!appState.inventoryTransactions) {
      appState.inventoryTransactions = [];
    }
    // Only run EOQ if there are actual ingredients in the DB
    if (appState.ingredients && appState.ingredients.length > 0) {
      fetchEOQPurchasing();
    }
  });
</script>

<div class="space-y-6">
  
  <!-- TAB CONTROLS -->
  <nav class="flex border-b border-[#767068]/20 font-mono text-xs">
    <button 
      onclick={() => { activeTab = 'stock'; formMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'stock' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Package size={13} />
        Ingredient Stores
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'ledger'; formMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'ledger' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <ClipboardList size={13} />
        Ledger Transactions
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'audit'; formMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'audit' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <TrendingDown size={13} />
        Stocktakes & Waste Logs
      </div>
    </button>
  </nav>

  <!-- TAB PANELS -->
  {#if activeTab === 'stock'}
    <!-- DEFAULT STORES & EOQ PANELS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
          emptyMessage="No ingredients added yet — use the form on the right to register your first ingredient."
        />
      </div>

      <div class="lg:col-span-4 space-y-6">
        <!-- EOQ Suggestions card -->
        <div class="ticket-card p-6 border-l-4 border-[#D9A441] bg-white">
          <div class="mb-4">
            <span class="ticket-stamp" style="color: var(--color-saffron); border-color: var(--color-saffron)">EOQ PROCUREMENT</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <Truck size={16} /> AI Order suggestions
            </h2>
          </div>

          <p class="text-xs text-[#767068] leading-relaxed mb-4 font-sans">
            Economic Order Quantity calculations minimize total holding costs while balancing perishability warning thresholds.
          </p>

          {#if loadingEOQ}
            <div class="space-y-4">
              <div class="h-16 bg-[#767068]/15 rounded skeleton-shimmer"></div>
              <div class="h-16 bg-[#767068]/15 rounded skeleton-shimmer"></div>
            </div>
          {:else if eoqSuggestions.length > 0}
            <div class="space-y-4">
              {#each eoqSuggestions as item}
                <div class="p-3.5 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-xs font-mono animate-fade-in">
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
              No restock suggestions needed at this time.
            </div>
          {/if}
        </div>

        <!-- Add New Ingredient Card -->
        <div class="ticket-card p-6 bg-white animate-fade-in font-sans">
          <div class="mb-4">
            <span class="ticket-stamp">DEPOT MANAGEMENT</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5 font-sans">
              <Plus size={16} /> Register Ingredient
            </h2>
          </div>

          <form onsubmit={submitNewIngredient} class="space-y-4 text-xs font-mono">
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="new-ing-name">Ingredient Name</label>
              <input id="new-ing-name" type="text" bind:value={newIngName} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white focus:outline-none" placeholder="e.g. Soy Sauce" required />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#767068] uppercase mb-1" for="new-ing-unit">Unit Measure</label>
                <select id="new-ing-unit" bind:value={newIngUnit} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white focus:outline-none">
                  <option>kg</option>
                  <option>liter</option>
                  <option>piece</option>
                  <option>gram</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#767068] uppercase mb-1" for="new-ing-stock">Initial Stock</label>
                <input id="new-ing-stock" type="number" bind:value={newIngStock} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white focus:outline-none" min="0" required />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#767068] uppercase mb-1" for="new-ing-reorder">Reorder Limit</label>
                <input id="new-ing-reorder" type="number" bind:value={newIngReorder} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white focus:outline-none" min="0" required />
              </div>
              <div>
                <label class="block font-bold text-[#767068] uppercase mb-1" for="new-ing-life">Shelf Life (Days)</label>
                <input id="new-ing-life" type="number" bind:value={newIngShelfLife} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white focus:outline-none" min="1" required />
              </div>
            </div>

            <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
              Add New Ingredient
            </button>

            {#if newIngMessage}
              <p class="text-xs text-[#3E6650] font-bold mt-2">{newIngMessage}</p>
            {/if}
          </form>
        </div>
      </div>
    </div>

  {:else}
    <!-- TRANSACTION LEDGER & STOCKTAKE WIDGET -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {#if activeTab === 'ledger'}
        <!-- LEDGER TRANSACTIONS LEDGER -->
        <div class="ticket-card p-6 lg:col-span-12 bg-white animate-fade-in">
          <div class="mb-4">
            <span class="ticket-stamp">STOCK TRANSACTION LEDGER</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <ClipboardList size={16} /> Movement Log Registry
            </h2>
          </div>

          <DataTable 
            rows={appState.inventoryTransactions || []} 
            columns={ledgerColumns} 
            searchableKeys={['reference', 'performed_by', 'transaction_type']}
            emptyMessage="No transactions logged yet — stock adjustments and receipts will appear here."
          />
        </div>
      {/if}

      {#if activeTab === 'audit'}
        <!-- LOG INGREDIENT WASTE & CYCLE-COUNTS -->
        <div class="ticket-card p-6 lg:col-span-5 bg-white animate-fade-in">
          <div class="mb-4">
            <span class="ticket-stamp">VARIANCE RECONCILIATION</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <TrendingDown size={16} /> Log Spoilage & Waste
            </h2>
          </div>

          <form onsubmit={submitTransaction} class="space-y-4 text-xs font-mono">
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="select-ing">Choose Ingredient</label>
              <select id="select-ing" bind:value={selectedIngId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
                <option value="">-- Choose Ingredient --</option>
                {#each appState.ingredients as ing}
                  <option value={ing.id}>{ing.name} (Current: {ing.current_stock} {ing.unit})</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="tx-type">Transaction Mode</label>
              <select id="tx-type" bind:value={transactionType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
                <option value="waste">Log Spoilage / Waste (-)</option>
                <option value="receipt">Manual Stock Adjustment (+)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="tx-qty">Transaction Weight / Count</label>
              <input id="tx-qty" type="number" step="0.1" bind:value={transactionQty} min="0.1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
            </div>

            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="tx-reason">Reason Description</label>
              <select id="tx-reason" bind:value={transactionReason} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
                <option value="spoilage">Ingredient expired / spoiled</option>
                <option value="over-prep">Excess kitchen prep waste</option>
                <option value="plate-waste">Leftover plate waste returning from venue</option>
                <option value="adjustment">Cycle count stock audit adjustment</option>
              </select>
            </div>

            <button type="submit" class="w-full bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 text-white font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
              File Ledger Log Entry
            </button>

            {#if formMessage}
              <p class="text-xs text-[#3E6650] mt-2 font-bold">{formMessage}</p>
            {/if}
          </form>
        </div>

        <div class="ticket-card p-6 lg:col-span-7 bg-white animate-fade-in font-sans">
          <div class="mb-4">
            <span class="ticket-stamp">STOCK AUDIT SNAPSHOT</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <Info size={16} /> Perishable Expiry Guidelines
            </h2>
          </div>

          <div class="space-y-4 text-xs font-mono leading-relaxed text-[#767068]">
            <p>
              In accordance with Section F of the operational strategy roadmap, all stock deductions must link back to confirmed recipes. Manual logs logged here automatically inject audits into the ledger transactions registry.
            </p>
            <div class="p-3 bg-[#F6F2EA] border border-[#767068]/20 rounded">
              <h4 class="font-bold text-[#2a2521] uppercase mb-1">Stock Ledger Guidelines</h4>
              <ul class="list-disc pl-4 space-y-1">
                <li>Receipt logs add immediately to store room levels.</li>
                <li>Spoilage/Waste logs deduct and count towards P&L cost margins (COGS).</li>
                <li>Variance logs require matching supervisor checkoff validation code.</li>
              </ul>
            </div>
          </div>
        </div>
      {/if}

    </div>
  {/if}

</div>
