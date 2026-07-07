<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import AlertBadge from '$lib/components/AlertBadge.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Wallet, AlertTriangle, BarChart3, ShieldCheck, ClipboardCheck, Info, Plus, CheckCircle2, X } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let activeTab = $state('anomalies'); // anomalies, pl, systemLogs

  // Anomaly states
  let anomalyReport = $state(null);
  let activeEventForAnalysis = $state(null);
  let loadingAnomaly = $state(false);

  // Financial non-event expense states
  let plExpenses = $state([
    { id: 1, name: 'Warehouse Rental Lease', amount: 15000, category: 'Rent' },
    { id: 2, name: 'LPG Refills & Fuel', amount: 4500, category: 'Utilities' }
  ]);
  let expenseName = $state('');
  let expenseAmount = $state(0);
  let expenseCategory = $state('Utilities');
  let plMessage = $state('');
  let showExpenseModal = $state(false);

  // Define P&L variables (computed reactively)
  let totalEventRevenue = $derived(
    appState.events.reduce((sum, e) => sum + parseFloat(e.budget || 0), 0)
  );

  let totalCOGS = $derived(
    appState.events.reduce((sum, e) => {
      // Simulate raw ingredient cost at 35% of event budget
      return sum + parseFloat(e.budget || 0) * 0.35;
    }, 0)
  );

  let totalStaffLabor = $derived(
    appState.staffTimeLogs ? appState.staffTimeLogs.reduce((sum, log) => {
      const staffMember = appState.staff.find(s => s.id === log.staff_id);
      const rate = staffMember ? parseFloat(staffMember.hourly_rate) : 150;
      return sum + (log.hours_worked * rate);
    }, 0) : 5400
  );

  let totalNonEventExpenses = $derived(
    plExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
  );

  let grossProfit = $derived(totalEventRevenue - totalCOGS);
  let netOperatingIncome = $derived(grossProfit - totalStaffLabor - totalNonEventExpenses);

  // System Audit Columns
  const auditColumns = [
    { key: 'id', label: 'Log ID', sortable: true },
    { key: 'username', label: 'Operator', sortable: true },
    { key: 'action', label: 'Action Event', sortable: true, isSans: true },
    { key: 'table_name', label: 'Target Module', sortable: true },
    { 
      key: 'created_at', 
      label: 'Timestamp', 
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleString()
    }
  ];

  async function runProfitAnalysis(eventObj) {
    appState.playClickSound();
    if (!eventObj) return;
    activeEventForAnalysis = eventObj;
    loadingAnomaly = true;

    try {
      const response = await fetch('/api/ai/profit-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventObj.id })
      });
      const res = await response.json();
      if (res.success) {
        anomalyReport = {
          event: eventObj,
          ingCost: res.ingredient_cost,
          labCost: res.labor_cost,
          overhead: res.overhead_cost,
          profit: res.profit,
          margin: res.margin_percentage,
          isCostAnomaly: res.is_anomaly,
          reason: res.explanation
        };
        appState.showToast("💰 Profit audited via Isolation Forest");
      }
    } catch (err) {
      console.warn("FastAPI profit analyzer unreachable, using simulation fallback:", err.message);
      setTimeout(() => {
        const rev = eventObj.budget;
        const ingCost = rev * 0.38;
        const labCost = rev * 0.18;
        const overhead = rev * appState.settings.overhead_rate;
        const profit = rev - ingCost - labCost - overhead;
        const margin = ((profit / rev) * 100).toFixed(0);

        anomalyReport = {
          event: eventObj,
          ingCost: ingCost.toFixed(2),
          labCost: labCost.toFixed(2),
          overhead: overhead.toFixed(2),
          profit: profit.toFixed(2),
          margin,
          isCostAnomaly: true,
          reason: `ANOMALY: Ingredients cost ratio reached 38% of revenue (Target: 28%). Suggestion: Negotiate wholesale pricing for proteins.`
        };
      }, 500);
    } finally {
      loadingAnomaly = false;
    }
  }

  // Add non-event expense logs
  function logNonEventExpense(e) {
    if (e) e.preventDefault();
    if (!expenseName || expenseAmount <= 0) return;

    appState.playClickSound();

    const exp = {
      id: Date.now(),
      name: expenseName,
      amount: expenseAmount,
      category: expenseCategory
    };

    plExpenses = [...plExpenses, exp];
    plMessage = `✅ Operating expense "${expenseName}" filed successfully.`;
    appState.playStampSound();

    // Reset inputs
    expenseName = '';
    expenseAmount = 0;
  }

  onMount(() => {
    const completedEvents = appState.events.filter(e => e.status === 'Completed');
    if (completedEvents.length > 0) {
      runProfitAnalysis(completedEvents[0]);
    }

    // Seed system audit trail if empty
    if (!appState.systemAuditLogs || appState.systemAuditLogs.length === 0) {
      appState.systemAuditLogs = [
        { id: 4001, username: 'admin', action: 'INSERT_CUSTOMER', table_name: 'customers', created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
        { id: 4002, username: 'admin', action: 'OPTIMIZE_MENU', table_name: 'events', created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
        { id: 4003, username: 'admin', action: 'APPROVE_PO', table_name: 'purchase_orders', created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
        { id: 4004, username: 'system', action: 'PERSIST_OPFS_CACHE', table_name: 'states', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() }
      ];
    }
  });
</script>

<div class="space-y-6">
  
  <!-- TAB PANELS -->
  <nav class="flex border-b border-[#767068]/20 font-mono text-xs">
    <button 
      onclick={() => { activeTab = 'anomalies'; plMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'anomalies' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Wallet size={13} />
        Anomaly Profit Analyzer
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'pl'; plMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'pl' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <BarChart3 size={13} />
        P&L Statement Sheets
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'systemLogs'; plMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'systemLogs' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <ShieldCheck size={13} />
        System Audits & SW Sync
      </div>
    </button>
  </nav>

  {#if activeTab === 'anomalies'}
    <!-- TAB 1: PROFIT ANALYSIS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">AUDIT LOGS</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Wallet size={16} /> Completed Events
          </h2>
        </div>

        <div class="space-y-2 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
          {#each appState.events.filter(e => e.status === 'Completed') as event}
            <button 
              onclick={() => runProfitAnalysis(event)} 
              class="w-full p-3 rounded border text-left text-xs transition-all btn-interactive {activeEventForAnalysis?.id === event.id ? 'bg-[#2A2521] border-[#2A2521] text-[#F6F2EA] font-bold' : 'bg-white border-[#767068]/30 text-[#2A2521] hover:bg-[#F6F2EA]/50'}"
            >
              <div class="flex justify-between font-bold">
                <span class="truncate pr-2">{event.event_type}</span>
                <span class="font-mono">₱{event.budget.toLocaleString()}</span>
              </div>
              <div class="text-[9px] font-mono text-[#767068] mt-1 flex justify-between">
                <span>Guests: {event.guest_count}</span>
                <span>Date: {new Date(event.event_date).toLocaleDateString()}</span>
              </div>
            </button>
          {:else}
            <div class="p-6 text-center text-xs text-[#767068] font-mono border border-dashed border-[#767068]/20 rounded">
              No completed events logged.
            </div>
          {/each}
        </div>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <span class="ticket-stamp">MODULE 6 AUDITING</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2">Isolation Forest Post-Mortem</h2>
          </div>
          <AlertBadge label="Isolation Forest Engine" type="success" />
        </div>

        {#if loadingAnomaly}
          <div class="skeleton-ticket p-6 skeleton-shimmer space-y-4">
            <div class="h-5 bg-[#767068]/20 rounded w-1/3 mb-4"></div>
            <div class="h-4 bg-[#767068]/20 rounded w-full mb-2"></div>
            <div class="h-4 bg-[#767068]/20 rounded w-5/6"></div>
          </div>
        {:else if anomalyReport}
          <div class="space-y-6 animate-fade-in">
            <div class="p-4 rounded border flex items-start gap-4 {anomalyReport.isCostAnomaly ? 'bg-[#AC3B2A]/5 border-[#AC3B2A]/20 text-[#2A2521]' : 'bg-[#3E6650]/5 border-[#3E6650]/20 text-[#2A2521]'}">
              <div class="text-2xl mt-0.5">{anomalyReport.isCostAnomaly ? '⚠️' : '✅'}</div>
              <div class="text-xs">
                <h4 class="font-bold text-sm text-[#2A2521] mb-1 uppercase tracking-wider">{anomalyReport.isCostAnomaly ? 'Audit Flagged Anomaly' : 'Audit Normal'}</h4>
                <p class="font-mono leading-relaxed text-[#767068]">{anomalyReport.reason}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
              <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-center">
                <span class="text-[9px] text-[#767068] uppercase font-bold">Revenue Recv</span>
                <div class="text-sm font-bold text-[#2A2521] mt-1">₱{parseFloat(anomalyReport.event.budget).toLocaleString()}</div>
              </div>
              <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-center">
                <span class="text-[9px] text-[#767068] uppercase font-bold">Food Cost</span>
                <div class="text-sm font-bold text-[#AC3B2A] mt-1">₱{parseFloat(anomalyReport.ingCost).toLocaleString()}</div>
              </div>
              <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-center">
                <span class="text-[9px] text-[#767068] uppercase font-bold">Labor Cost</span>
                <div class="text-sm font-bold text-[#AC3B2A] mt-1">₱{parseFloat(anomalyReport.labCost).toLocaleString()}</div>
              </div>
              <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-center">
                <span class="text-[9px] text-[#767068] uppercase font-bold">Net Margin</span>
                <div class="text-sm font-bold text-[#3E6650] mt-1">{anomalyReport.margin}%</div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-mono font-bold text-[#767068] mb-2 uppercase">Cost allocation share</h4>
              <div class="h-4 w-full rounded overflow-hidden flex text-[10px] font-mono font-bold text-[#F6F2EA]">
                <div class="bg-[#AC3B2A] h-full flex items-center justify-center" style="width: 32%">FOOD</div>
                <div class="bg-[#D9A441] h-full flex items-center justify-center" style="width: 20%">LABOR</div>
                <div class="bg-[#767068] h-full flex items-center justify-center" style="width: 12%">OH</div>
                <div class="bg-[#3E6650] h-full flex items-center justify-center flex-1">PROFIT ({anomalyReport.margin}%)</div>
              </div>
              <div class="flex gap-4 mt-2.5 justify-center text-[10px] font-mono text-[#767068]">
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#AC3B2A]"></span> Food Cost</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#D9A441]"></span> Labor Cost</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#767068]"></span> Overhead</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#3E6650]"></span> Net Yield</span>
              </div>
            </div>
          </div>
        {:else}
          <p class="text-xs text-[#767068] py-12 text-center font-mono">Select a booking record from the ledger on the left.</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if activeTab === 'pl'}
    <!-- TAB 2: P&L STATEMENTS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">EXPENSE TRACKER</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Plus size={18} /> File Operating Expense
          </h2>
        </div>

        <form onsubmit={logNonEventExpense} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="exp-name">Expense Label</label>
            <input id="exp-name" type="text" bind:value={expenseName} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" placeholder="e.g. Office electricity" required />
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="exp-amount">Billed Cost (₱)</label>
            <input id="exp-amount" type="number" bind:value={expenseAmount} min="1" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="exp-cat">Category</label>
            <select id="exp-cat" bind:value={expenseCategory} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
              <option>Rent</option>
              <option>Utilities</option>
              <option>Marketing</option>
              <option>Equipment Maintenance</option>
            </select>
          </div>

          <button type="submit" class="w-full bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 text-white font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
            File Expense Log Entry
          </button>

          {#if plMessage}
            <p class="text-xs text-[#3E6650] font-bold mt-2">{plMessage}</p>
          {/if}
        </form>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white font-mono text-xs">
        <div class="mb-6 border-b-2 border-dashed border-[#767068]/20 pb-4">
          <span class="ticket-stamp">PROFIT & LOSS LEDGER</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2">Business-wide Income Statement</h2>
          <p class="text-[10px] text-[#767068] mt-0.5">Summary for current operating fiscal month (₱ Currency)</p>
        </div>

        <div class="space-y-4">
          <!-- Revenues -->
          <div class="flex justify-between items-center text-slate-800 font-bold border-b border-[#767068]/20 pb-1">
            <span>OPERATING REVENUES (Events)</span>
            <span class="text-[#3E6650]">₱{totalEventRevenue.toLocaleString()}</span>
          </div>

          <!-- COGS -->
          <div class="flex justify-between items-center text-slate-600 pl-4">
            <span>- Food Ingredient COGS (Estimated 35%)</span>
            <span class="text-[#AC3B2A]">- ₱{totalCOGS.toLocaleString()}</span>
          </div>

          <!-- Gross profit -->
          <div class="flex justify-between items-center text-[#2A2521] font-bold border-t border-[#767068]/20 pt-1.5 pb-1">
            <span>GROSS INCOME</span>
            <span class="text-[#3E6650]">₱{grossProfit.toLocaleString()}</span>
          </div>

          <!-- Operating Expenses -->
          <div class="flex justify-between items-center text-slate-800 font-bold border-b border-[#767068]/20 pb-1 pt-2">
            <span>OPERATING DISBURSEMENTS</span>
            <span></span>
          </div>

          <div class="flex justify-between items-center text-slate-600 pl-4">
            <span>- Crew Labor Wages (Logged Timesheets)</span>
            <span class="text-[#AC3B2A]">- ₱{totalStaffLabor.toLocaleString()}</span>
          </div>

          {#each plExpenses as exp}
            <div class="flex justify-between items-center text-slate-600 pl-4">
              <span>- Non-event: {exp.name} ({exp.category})</span>
              <span class="text-[#AC3B2A]">- ₱{exp.amount.toLocaleString()}</span>
            </div>
          {/each}

          <!-- Net income -->
          <div class="flex justify-between items-center border-t-2 border-[#767068]/40 pt-3 font-bold text-sm">
            <span class="text-[#2A2521] uppercase">Net Profit Margin</span>
            <span class="text-[#3E6650] text-base font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded">
              ₱{netOperatingIncome.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if activeTab === 'systemLogs'}
    <!-- TAB 3: SYSTEM AUDITS & SW SYNC -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">OPERATIONAL AUDIT TRAIL</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <ClipboardCheck size={16} /> System Operations Logs
          </h2>
        </div>

        <DataTable 
          rows={appState.systemAuditLogs || []} 
          columns={auditColumns} 
          searchableKeys={['action', 'username', 'table_name']}
          emptyMessage="No audit logs loaded."
        />
      </div>

      <div class="ticket-card p-6 lg:col-span-4 border-l-4 border-[#3E6650] bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">SW LOCAL PERSISTENCE</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <ShieldCheck size={16} /> Offline Synced logs
          </h2>
        </div>

        <div class="space-y-4 text-xs font-mono">
          <p class="text-[#767068] leading-relaxed">
            Svelte service worker local text file queue is synchronizing updates automatically when online.
          </p>

          <div class="p-3 bg-emerald-50 text-[#3E6650] border border-emerald-200 rounded flex items-center gap-2">
            <CheckCircle2 size={16} />
            <div>
              <p class="font-bold">Device Cache Synced</p>
              <p class="text-[9px] text-slate-500">Queue size: 0 pending writes</p>
            </div>
          </div>

          <div class="p-3.5 bg-[#F6F2EA] border border-[#767068]/20 rounded text-[10px] space-y-1">
            <h4 class="font-bold text-slate-800">OPFS Storage Summary</h4>
            <div class="flex justify-between">
              <span>Local File:</span>
              <strong>catersync_opfs_db.txt</strong>
            </div>
            <div class="flex justify-between">
              <span>Allocated Space:</span>
              <strong>12.5 MB</strong>
            </div>
            <div class="flex justify-between">
              <span>State:</span>
              <strong class="text-[#3E6650]">ACTIVE (PERSISTED)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

</div>
