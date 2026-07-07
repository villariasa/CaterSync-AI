<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Truck, Plus, FileCheck, ClipboardSignature, FileText, CheckCircle2, ShieldAlert } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let activeTab = $state('suppliers'); // suppliers, pos, receipts

  // Form states for suppliers
  let name = $state('');
  let reliabilityScore = $state(0.95);
  let avgLeadTime = $state(2);
  let supplierMessage = $state('');

  // Form states for custom PO creator
  let poSupplierId = $state('');
  let poIngredientId = $state('');
  let poQty = $state(10);
  let poCost = $state(1500);
  let poMessage = $state('');

  // Form states for Goods Receipts Matcher
  let matchPoId = $state('');
  let matchInvoiceAmount = $state(1500);
  let matchDeliveredQty = $state(10);
  let matchMessage = $state('');

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

  // PO table columns definition
  const poColumns = [
    { key: 'id', label: 'PO ID', sortable: true },
    { 
      key: 'supplier_name', 
      label: 'Supplier', 
      sortable: true,
      isSans: true,
      render: (row) => {
        const sup = appState.suppliers.find(s => s.id === row.supplier_id);
        return sup ? sup.name : `Supplier #${row.supplier_id}`;
      }
    },
    { 
      key: 'ingredient_name', 
      label: 'Item Line', 
      sortable: true,
      render: (row) => {
        const ing = appState.ingredients.find(i => i.id === row.ingredient_id);
        return ing ? `${ing.name} (x${row.quantity} ${ing.unit})` : `Item #${row.ingredient_id}`;
      }
    },
    { 
      key: 'cost', 
      label: 'Total Value', 
      sortable: true,
      render: (row) => `₱${parseFloat(row.cost).toLocaleString()}`
    },
    { 
      key: 'status', 
      label: 'Workflow Status', 
      sortable: true,
      render: (row) => {
        let bg = 'bg-slate-100 text-slate-700';
        if (row.status === 'Approved') bg = 'bg-amber-50 text-amber-600 border-amber-200';
        if (row.status === 'Received') bg = 'bg-emerald-50 text-[#3E6650] border-[#3E6650]/20';
        return `<span class="px-2 py-0.5 rounded border text-[9px] uppercase font-bold ${bg}">${row.status}</span>`;
      }
    },
    {
      key: 'actions',
      label: 'Approval Actions',
      sortable: false,
      align: 'right',
      render: (row) => {
        if (row.status === 'Draft') {
          return `<button onclick="window.dispatchPoAction(${row.id}, 'Approved')" class="px-2 py-0.5 bg-[#D9A441] text-[#1F1B18] font-bold text-[9px] uppercase rounded">Approve</button>`;
        }
        if (row.status === 'Approved') {
          return `<button onclick="window.dispatchPoAction(${row.id}, 'Received')" class="px-2 py-0.5 bg-[#3E6650] text-white font-bold text-[9px] uppercase rounded">Match & Receive</button>`;
        }
        return `<span class="text-emerald-500 font-bold text-[10px]">✓ Closed</span>`;
      }
    }
  ];

  // 3-way matches columns definition
  const matchColumns = [
    { key: 'id', label: 'Receipt ID', sortable: true },
    { key: 'po_id', label: 'PO Ref', sortable: true },
    { 
      key: 'matching_details', 
      label: '3-Way Match Check', 
      sortable: false,
      render: (row) => {
        const isDiscrepant = row.has_discrepancy;
        return isDiscrepant
          ? `<span class="text-[#AC3B2A] font-bold flex items-center gap-1"><span class="h-2 w-2 bg-[#AC3B2A] rounded-full inline-block"></span> Price Discrepancy</span>`
          : `<span class="text-[#3E6650] font-bold flex items-center gap-1"><span class="h-2 w-2 bg-[#3E6650] rounded-full inline-block"></span> 3-Way Match Verified</span>`;
      }
    },
    { 
      key: 'billed_amount', 
      label: 'Billed Value', 
      sortable: true,
      render: (row) => `₱${parseFloat(row.billed_amount).toLocaleString()}`
    },
    { 
      key: 'received_qty', 
      label: 'Received count', 
      sortable: true,
      render: (row) => `${row.received_qty} units`
    }
  ];

  // Global handler for action buttons inside datatable rows
  if (typeof window !== 'undefined') {
    window.dispatchPoAction = async (poId, nextStatus) => {
      appState.playClickSound();
      
      // Update local state
      appState.purchaseOrders = appState.purchaseOrders.map(po => {
        if (po.id === poId) {
          if (nextStatus === 'Received') {
            // Increment stock levels on receiving
            appState.ingredients = appState.ingredients.map(ing => {
              if (ing.id === po.ingredient_id) {
                const updatedStock = parseFloat(ing.current_stock) + po.quantity;
                return { ...ing, current_stock: updatedStock.toFixed(1) };
              }
              return ing;
            });
            appState.showToast(`📦 Received items into stores registry.`);
            appState.playStampSound();
          }
          return { ...po, status: nextStatus };
        }
        return po;
      });
    };
  }

  async function submitSupplier(e) {
    e.preventDefault();
    if (!name) return;

    const payload = {
      name,
      reliability_score: reliabilityScore,
      avg_lead_time_days: avgLeadTime
    };

    if (appState.usingMockData) {
      const mockSupplier = {
        id: Date.now(),
        ...payload
      };
      appState.suppliers = [...appState.suppliers, mockSupplier];
      supplierMessage = `✅ Supplier profile "${mockSupplier.name}" added successfully locally.`;
      name = '';
      appState.showToast("🚚 Supplier account verified");
      appState.playStampSound();
      return;
    }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      if (res.success) {
        appState.suppliers = [...appState.suppliers, res.supplier];
        supplierMessage = `✅ Supplier profile "${res.supplier.name}" added successfully.`;
        name = '';
        appState.showToast("🚚 Supplier account verified");
        appState.playStampSound();
      }
    } catch (err) {
      supplierMessage = `❌ Creation failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }

  // Create custom purchase order
  function createPurchaseOrder(e) {
    e.preventDefault();
    if (!poSupplierId || !poIngredientId || poQty <= 0) return;

    appState.playClickSound();

    const newPO = {
      id: appState.purchaseOrders.length + 1001,
      supplier_id: parseInt(poSupplierId),
      ingredient_id: parseInt(poIngredientId),
      quantity: poQty,
      cost: poCost,
      status: 'Draft'
    };

    appState.purchaseOrders = [...appState.purchaseOrders, newPO];
    poMessage = `✅ Draft PO #${newPO.id} raised successfully.`;
    appState.playStampSound();
    
    // reset form
    poQty = 10;
    poCost = 1500;
  }

  // Submit and verify Goods Receipt Matching
  function performThreeWayMatch(e) {
    e.preventDefault();
    if (!matchPoId) return;

    appState.playClickSound();

    const po = appState.purchaseOrders.find(p => p.id === parseInt(matchPoId));
    if (!po) {
      matchMessage = '❌ Purchase order reference not found.';
      appState.playBuzzerSound();
      return;
    }

    const priceMismatch = parseFloat(matchInvoiceAmount) !== parseFloat(po.cost);
    const qtyMismatch = parseFloat(matchDeliveredQty) !== parseFloat(po.quantity);
    const hasDiscrepancy = priceMismatch || qtyMismatch;

    const receipt = {
      id: appState.goodsReceipts.length + 5001,
      po_id: po.id,
      billed_amount: matchInvoiceAmount,
      received_qty: matchDeliveredQty,
      has_discrepancy: hasDiscrepancy
    };

    appState.goodsReceipts = [receipt, ...appState.goodsReceipts];
    
    if (hasDiscrepancy) {
      matchMessage = `⚠️ Discrepancy Flagged: Invoice (₱${matchInvoiceAmount}) / Delivery Qty (${matchDeliveredQty}) did not match PO details.`;
      appState.playBuzzerSound();
    } else {
      matchMessage = `✅ 3-Way Match Successful. PO #${po.id} receipt match verified.`;
      appState.playStampSound();
      
      // Auto receive PO
      window.dispatchPoAction(po.id, 'Received');
    }
  }

  onMount(() => {
    // Seed purchase orders if empty
    if (!appState.purchaseOrders || appState.purchaseOrders.length === 0) {
      appState.purchaseOrders = [
        { id: 1001, supplier_id: 1, ingredient_id: 2, quantity: 80, cost: 14400, status: 'Draft' },
        { id: 1002, supplier_id: 2, ingredient_id: 5, quantity: 40, cost: 22000, status: 'Approved' },
        { id: 1003, supplier_id: 4, ingredient_id: 1, quantity: 150, cost: 7800, status: 'Received' }
      ];
    }
    if (!appState.goodsReceipts || appState.goodsReceipts.length === 0) {
      appState.goodsReceipts = [
        { id: 5001, po_id: 1003, billed_amount: 7800, received_qty: 150, has_discrepancy: false }
      ];
    }
  });
</script>

<div class="space-y-6">
  
  <!-- TAB PANELS -->
  <nav class="flex border-b border-[#767068]/20 font-mono text-xs">
    <button 
      onclick={() => { activeTab = 'suppliers'; supplierMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'suppliers' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Truck size={13} />
        Partner Suppliers
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'pos'; poMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'pos' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <ClipboardSignature size={13} />
        Purchase Orders
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'receipts'; matchMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'receipts' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <FileCheck size={13} />
        Goods Receipts Matching
      </div>
    </button>
  </nav>

  {#if activeTab === 'suppliers'}
    <!-- TAB 1: SUPPLIERS PROFILES -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">LOGISTICS REGISTRY</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Plus size={18} /> Add Supplier Profile
          </h2>
        </div>

        <form onsubmit={submitSupplier} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="supplier-name">Supplier Name</label>
            <input id="supplier-name" type="text" bind:value={name} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="supplier-reliability">Reliability Index (0.00 to 1.00)</label>
            <input id="supplier-reliability" type="number" step="0.01" bind:value={reliabilityScore} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" max="1" />
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="supplier-lead">Avg Lead Time (days)</label>
            <input id="supplier-lead" type="number" bind:value={avgLeadTime} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" />
          </div>

          <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
            Verify Supplier
          </button>
          
          {#if supplierMessage}
            <p class="text-xs text-[#767068] mt-2">{supplierMessage}</p>
          {/if}
        </form>
      </div>

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
  {/if}

  {#if activeTab === 'pos'}
    <!-- TAB 2: PURCHASE ORDERS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">PO REQUISITION</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Plus size={18} /> Create Purchase Order
          </h2>
        </div>

        <form onsubmit={createPurchaseOrder} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="po-supplier">Choose Supplier</label>
            <select id="po-supplier" bind:value={poSupplierId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Select Partner --</option>
              {#each appState.suppliers as s}
                <option value={s.id}>{s.name} ({Math.round(s.reliability_score * 100)}% reliable)</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="po-ingredient">Select Stock Item</label>
            <select id="po-ingredient" bind:value={poIngredientId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Select Ingredient --</option>
              {#each appState.ingredients as ing}
                <option value={ing.id}>{ing.name} ({ing.unit})</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="po-qty">Order Qty</label>
              <input id="po-qty" type="number" bind:value={poQty} min="1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
            </div>
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="po-cost">Target Value (₱)</label>
              <input id="po-cost" type="number" bind:value={poCost} min="1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
            </div>
          </div>

          <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
            Raise Draft PO Document
          </button>

          {#if poMessage}
            <p class="text-xs text-[#3E6650] font-bold mt-2">{poMessage}</p>
          {/if}
        </form>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">PROCUREMENT LEDGER</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <FileText size={16} /> Active Purchase Orders
          </h2>
        </div>

        <DataTable 
          rows={appState.purchaseOrders || []} 
          columns={poColumns} 
          searchableKeys={['status']}
          emptyMessage="No purchase orders raised."
        />
      </div>
    </div>
  {/if}

  {#if activeTab === 'receipts'}
    <!-- TAB 3: GOODS RECEIPTS MATCHING -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">3-WAY AUDIT CHECK</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <FileCheck size={18} /> File Delivery Match
          </h2>
        </div>

        <form onsubmit={performThreeWayMatch} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="match-po">Select Active PO</label>
            <select id="match-po" bind:value={matchPoId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Choose Order Document --</option>
              {#each appState.purchaseOrders.filter(p => p.status !== 'Received') as po}
                <option value={po.id}>PO #{po.id} (Value: ₱{po.cost})</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="match-invoice">Supplier Invoice Amount (₱)</label>
            <input id="match-invoice" type="number" bind:value={matchInvoiceAmount} min="1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="match-delivered">Actual Received Quantity</label>
            <input id="match-delivered" type="number" bind:value={matchDeliveredQty} min="1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>

          <button type="submit" class="w-full bg-[#2A2521] hover:bg-[#2A2521]/90 text-white font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
            Perform 3-Way Match Check
          </button>

          {#if matchMessage}
            <div class="p-3 rounded border text-xs leading-relaxed font-mono {matchMessage.includes('❌') || matchMessage.includes('⚠️') ? 'bg-red-50 text-[#AC3B2A] border-[#AC3B2A]/20' : 'bg-emerald-50 text-[#3E6650] border-[#3E6650]/20'}">
              {matchMessage}
            </div>
          {/if}
        </form>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">VERIFICATION DIRECTORY</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={16} /> Verified Goods Receipts
          </h2>
        </div>

        <DataTable 
          rows={appState.goodsReceipts || []} 
          columns={matchColumns} 
          searchableKeys={['po_id']}
          emptyMessage="No verification records logged."
        />
      </div>
    </div>
  {/if}

</div>
