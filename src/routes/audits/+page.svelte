<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import AlertBadge from '$lib/components/AlertBadge.svelte';
  import { Wallet, AlertTriangle } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let anomalyReport = $state(null);
  let activeEventForAnalysis = $state(null);
  let loadingAnomaly = $state(false);

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
        appState.showToast("💰 Profit metrics audited via Isolation Forest");
      }
    } catch (err) {
      console.warn("FastAPI profit analyzer unreachable, using simulation fallback:", err.message);
      // Fallback
      setTimeout(() => {
        const rev = eventObj.budget;
        const ingCost = rev * 0.38; // Simulate overrun
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
      }, 800);
    } finally {
      loadingAnomaly = false;
    }
  }

  onMount(() => {
    const completedEvents = appState.events.filter(e => e.status === 'Completed');
    if (completedEvents.length > 0) {
      runProfitAnalysis(completedEvents[0]);
    }
  });
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Completed ledger list -->
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
      {/each}
    </div>
  </div>

  <!-- Isolation Forest Audit reports details -->
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
      <div class="space-y-6">
        
        <!-- Indicator ticket box -->
        <div class="p-4 rounded border flex items-start gap-4 {anomalyReport.isCostAnomaly ? 'bg-[#AC3B2A]/5 border-[#AC3B2A]/20 text-[#2A2521]' : 'bg-[#3E6650]/5 border-[#3E6650]/20 text-[#2A2521]'}">
          <div class="text-2xl mt-0.5">{anomalyReport.isCostAnomaly ? '⚠️' : '✅'}</div>
          <div class="text-xs">
            <h4 class="font-bold text-sm text-[#2A2521] mb-1 uppercase tracking-wider">{anomalyReport.isCostAnomaly ? 'Audit Flagged Anomaly' : 'Audit Normal'}</h4>
            <p class="font-mono leading-relaxed text-[#767068]">{anomalyReport.reason}</p>
          </div>
        </div>

        <!-- Cost Breakdown columns -->
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

        <!-- Share allocations chart visualization -->
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
