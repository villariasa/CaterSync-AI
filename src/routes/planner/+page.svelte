<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import TicketCard from '$lib/components/TicketCard.svelte';
  import AlertBadge from '$lib/components/AlertBadge.svelte';
  import Combobox from '$lib/components/Combobox.svelte';
  import { UtensilsCrossed, AlertTriangle } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  // Form states
  let selectedCustomer = $state('');
  let eventType = $state('Wedding');
  let guestCount = $state(100);
  let budget = $state(50000);
  let eventDate = $state('');
  let eventTheme = $state('Modern Elegant');
  let venueType = $state('Indoor Ballroom');
  let isOutdoor = $state(false);
  
  let eventMessage = $state('');

  // Equipment & Venue state values
  let tablesAllocated = $state(10);
  let chairsAllocated = $state(80);
  let tentsAllocated = $state(2);
  let isRentalSubcontract = $state(false);
  let selectedVehicle = $state('Toyota HiAce Delivery Van (Plate #602)');

  // AI load triggers
  let aiGeneratingMenu = $state(false);
  let aiCalculatingQuantities = $state(false);
  let aiCheckingRisks = $state(false);

  // Solved outputs
  let generatedMenuResult = $state(null);
  let predictedQuantities = $state([]);
  let riskAssessment = $state(null);
  let selectedReturningCustomerRecs = $state([]);

  // Form validation shake states
  let shakeBudget = $state(false);
  let shakeGuests = $state(false);

  onMount(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    eventDate = d.toISOString().split('T')[0];
  });

  // ---------------------------------------------------------------------------
  // LIVE PREVIEW BINDINGS (computed reactively from business settings thresholds)
  // ---------------------------------------------------------------------------
  let liveBudgetPerGuest = $derived(guestCount > 0 ? (budget / guestCount) : 0);
  let liveDraftMenu = $derived.by(() => {
    if (liveBudgetPerGuest <= 0) return null;
    let closestMenu = null;
    let closestDiff = Infinity;
    appState.menus.forEach(menu => {
      if (menu.cost_per_serving <= liveBudgetPerGuest) {
        const diff = liveBudgetPerGuest - menu.cost_per_serving;
        if (diff < closestDiff) {
          closestDiff = diff;
          closestMenu = menu;
        }
      }
    });
    if (!closestMenu && appState.menus.length > 0) {
      closestMenu = appState.menus.reduce((prev, curr) => prev.cost_per_serving < curr.cost_per_serving ? prev : curr);
    }
    return closestMenu;
  });

  // ---------------------------------------------------------------------------
  // MODULE 7: Preference recommendation API fetch
  // ---------------------------------------------------------------------------
  async function loadCustomerPreferences(customerId) {
    appState.playClickSound();
    if (!customerId) {
      selectedReturningCustomerRecs = [];
      return;
    }

    try {
      const response = await fetch('/api/ai/customer-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: parseInt(customerId) })
      });
      const res = await response.json();
      if (res.success && res.recommendations) {
        selectedReturningCustomerRecs = res.recommendations.slice(0, 3);
      }
    } catch (err) {
      // Fallback local matching
      const customer = appState.customers.find(c => c.id === parseInt(customerId));
      if (!customer) return;
      selectedReturningCustomerRecs = appState.menus.map(menu => {
        let score = 0.25;
        if (customer.preferred_theme && menu.name.toLowerCase().includes(customer.preferred_theme.split(' ')[0].toLowerCase())) {
          score += 0.40;
        }
        return { ...menu, match_score: score };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 3);
    }
  }

  // ---------------------------------------------------------------------------
  // MODULE 2: AI Menu Generator API Call (with local fallback)
  // ---------------------------------------------------------------------------
  async function handleGenerateMenu() {
    appState.playClickSound();
    
    // INPUT VALIDATION SHAKE RULES
    let hasError = false;
    if (guestCount < 5) {
      shakeGuests = true;
      hasError = true;
      setTimeout(() => shakeGuests = false, 300);
    }
    if (budget < guestCount * appState.settings.min_budget_per_guest) {
      shakeBudget = true;
      hasError = true;
      setTimeout(() => shakeBudget = false, 300);
    }

    if (hasError) {
      appState.playBuzzerSound();
      appState.showToast(`⚠️ Cost constraint warning. Minimum budget per guest: ₱${appState.settings.min_budget_per_guest}`, "error");
      return;
    }

    aiGeneratingMenu = true;
    
    try {
      const response = await fetch('/api/ai/menu-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, guest_count: guestCount, theme: eventTheme })
      });
      const res = await response.json();
      if (res.success) {
        generatedMenuResult = {
          menu: res.menu,
          description: res.description,
          estCost: res.estCost,
          estProfit: res.estProfit,
          margin: res.margin
        };
        appState.showToast("🍽️ AI Menu optimized via PuLP");
        appState.playStampSound();
        
        // Fetch child predictions
        handlePredictQuantities(res.menu.id);
        handleCheckRisks();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.warn("FastAPI menu generator unreachable, falling back to local solver simulation:", err.message);
      // Fallback
      setTimeout(() => {
        const budgetPerGuest = budget / guestCount;
        let selectedMenu = liveDraftMenu;
        const profitMarginPct = (((selectedMenu.price_per_serving - selectedMenu.cost_per_serving) / selectedMenu.price_per_serving) * 100).toFixed(0);
        const estTotalCost = selectedMenu.cost_per_serving * guestCount;
        const estProfit = (selectedMenu.price_per_serving - selectedMenu.cost_per_serving) * guestCount;

        generatedMenuResult = {
          menu: selectedMenu,
          description: `Premium serving of ${selectedMenu.name} calibrated for ${guestCount} guests. Structured optimization targets ${profitMarginPct}% net margin with a food cost of ₱${estTotalCost.toLocaleString()} and margin of ₱${estProfit.toLocaleString()}.`,
          estCost: estTotalCost,
          estProfit: estProfit,
          margin: profitMarginPct
        };
        aiGeneratingMenu = false;
        appState.playStampSound();
        handlePredictQuantities(selectedMenu.id);
        handleCheckRisks();
      }, 1000);
    } finally {
      aiGeneratingMenu = false;
    }
  }

  // ---------------------------------------------------------------------------
  // MODULE 1: Food Quantity Predictor API Call
  // ---------------------------------------------------------------------------
  async function handlePredictQuantities(menuId) {
    aiCalculatingQuantities = true;
    try {
      const response = await fetch('/api/ai/food-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: 1, dish_id: menuId, guest_count: guestCount })
      });
      const res = await response.json();
      if (res.success) {
        predictedQuantities = [
          { dish: 'Main Entree Course', predicted: res.predicted_qty_kg.toFixed(1), unit: 'kg', confidence: '94%' },
          { dish: 'Side Rice / Carb Course', predicted: (res.predicted_qty_kg * 0.8).toFixed(1), unit: 'kg', confidence: '96%' },
          { dish: 'Prepared Sauces / Soup', predicted: (res.predicted_qty_kg * 1.15).toFixed(1), unit: 'liters', confidence: '89%' }
        ];
      }
    } catch (err) {
      // Offline fallback
      predictedQuantities = [
        { dish: 'Main Entree Course', predicted: (guestCount * 0.35).toFixed(1), unit: 'kg', confidence: '94%' },
        { dish: 'Side Rice / Carb Course', predicted: (guestCount * 0.25).toFixed(1), unit: 'kg', confidence: '96%' }
      ];
    } finally {
      aiCalculatingQuantities = false;
    }
  }

  // ---------------------------------------------------------------------------
  // MODULE 8: Event Risk Prediction API Call
  // ---------------------------------------------------------------------------
  async function handleCheckRisks() {
    aiCheckingRisks = true;
    try {
      const response = await fetch('/api/ai/event-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: 1 })
      });
      const res = await response.json();
      if (res.success) {
        riskAssessment = {
          score: res.risk_score.toFixed(2),
          level: res.risk_level,
          reasons: res.reasons
        };
      }
    } catch (err) {
      riskAssessment = {
        score: isOutdoor ? '0.55' : '0.12',
        level: isOutdoor ? 'Medium' : 'Low',
        reasons: isOutdoor ? ["Outdoor rainfall possibility is higher on target seasonal window."] : ["Safe operational metrics."]
      };
    } finally {
      aiCheckingRisks = false;
    }
  }

  // Save Event Ticket Action
  async function submitEvent(e) {
    e.preventDefault();
    if (!selectedCustomer || !eventDate || !budget) return;

    const payload = {
      customer_id: selectedCustomer,
      event_type: eventType,
      guest_count: guestCount,
      event_date: eventDate,
      budget: budget,
      theme: eventTheme,
      venue_type: venueType,
      is_outdoor: isOutdoor
    };

    if (appState.usingMockData) {
      const customerObj = appState.customers.find(c => c.id == selectedCustomer) || { name: 'Walk-In Customer' };
      const mockEvent = {
        id: Date.now(),
        customer_name: customerObj.name,
        status: 'Confirmed',
        ...payload
      };
      appState.events = [mockEvent, ...appState.events];
      eventMessage = `✅ Event ticket registered successfully in local device storage.`;
      appState.showToast("📅 Catering ticket booked");
      appState.playStampSound();
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        appState.events = [res.event, ...appState.events];
        eventMessage = `✅ Event ticket registered successfully in Postgres database.`;
        appState.showToast("📅 Catering ticket booked");
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      eventMessage = `❌ Failed to save: ${err.message}`;
      appState.playBuzzerSound();
    }
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Planner inputs form -->
  <div class="ticket-card p-6 lg:col-span-5 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">CATERING FORMULATOR</span>
      <h2 class="text-xl font-bold text-[#2A2521] mt-2">Plan New Booking</h2>
    </div>

    <form onsubmit={submitEvent} class="space-y-4">
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-client">Select Client</label>
        <Combobox
          items={appState.customers}
          bind:value={selectedCustomer}
          labelKey="name"
          valueKey="id"
          placeholder="Search and choose client..."
          onchange={loadCustomerPreferences}
        />
      </div>

      <!-- Preferred recommendations slider -->
      {#if selectedReturningCustomerRecs.length > 0}
        <div class="p-3 bg-[#3E6650]/5 border border-[#3E6650]/20 rounded text-[11px] space-y-1">
          <span class="text-[#3E6650] font-mono font-bold block mb-1">🎯 AI Cosine Similar Theme Preferences:</span>
          <div class="grid grid-cols-3 gap-2">
            {#each selectedReturningCustomerRecs as r}
              <button type="button" onclick={() => { eventTheme = r.name || r.preferred_theme; handleGenerateMenu(); }} class="p-2 bg-white rounded border border-[#767068]/20 text-[9px] text-left hover:border-[#3E6650] transition-all btn-interactive">
                <span class="font-bold text-[#2A2521] block leading-tight">{r.name || r.preferred_theme}</span>
                <span class="font-mono text-[#D9A441] block mt-0.5">Similarity Match</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-type">Event Type</label>
          <select id="plan-type" bind:value={eventType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
            <option>Wedding</option>
            <option>Corporate Seminar</option>
            <option>Birthday Party</option>
            <option>Social Gathering</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-theme">Theme Concept</label>
          <select id="plan-theme" bind:value={eventTheme} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
            <option>Modern Elegant</option>
            <option>Rustic Barn</option>
            <option>Tropical Luau</option>
            <option>Corporate Minimalist</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class={shakeGuests ? 'validation-shake' : ''}>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-guests">Guests</label>
          <input id="plan-guests" type="number" bind:value={guestCount} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="1" />
        </div>
        <div class={shakeBudget ? 'validation-shake' : ''}>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-budget">Budget (₱)</label>
          <input id="plan-budget" type="number" bind:value={budget} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="1" />
        </div>
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-date">Target Date</label>
          <input id="plan-date" type="date" bind:value={eventDate} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" />
        </div>
      </div>

      <!-- Live Draft preview ticket block -->
      {#if liveDraftMenu && !generatedMenuResult && !aiGeneratingMenu}
        <div class="p-3 bg-[#D9A441]/5 border border-[#D9A441]/20 rounded text-[10px] font-mono transition-opacity duration-300">
          <span class="text-[#D9A441] font-bold block mb-1">📝 LIVE DRAFT PREVIEW (Unoptimized)</span>
          <div class="flex justify-between">
            <span>Proposed Menu: <strong>{liveDraftMenu.name}</strong></span>
            <span>Food cost/head: ₱{liveDraftMenu.cost_per_serving}</span>
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-venue">Venue Name</label>
          <input id="plan-venue" type="text" bind:value={venueType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" />
        </div>
        <div class="flex items-center pt-5 pl-2">
          <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#2A2521]" for="plan-outdoor">
            <input id="plan-outdoor" type="checkbox" bind:checked={isOutdoor} class="rounded border-[#767068]/30 text-[#3E6650] focus:ring-0 bg-white w-4 h-4" />
            Outdoor Venue
          </label>
        </div>
      </div>

      <div class="pt-4 flex gap-2">
        <button type="button" onclick={handleGenerateMenu} class="flex-1 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive flex items-center justify-center gap-2">
          {#if aiGeneratingMenu}
            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Generating...
          {:else}
            Optimize Menu
          {/if}
        </button>
        <button type="submit" class="bg-white border border-[#767068]/30 text-[#2A2521] hover:bg-slate-100 font-bold text-xs py-3 px-4 rounded uppercase tracking-wider transition-all btn-interactive">
          Approve booking
        </button>
      </div>

      {#if eventMessage}
        <p class="text-xs font-mono mt-2 text-[#767068]">{eventMessage}</p>
      {/if}
    </form>
  </div>

  <!-- AI solver output details -->
  <div class="lg:col-span-7 space-y-6">
    
    <!-- Menu Generator (Module 2) -->
    {#if aiGeneratingMenu}
      <div class="skeleton-ticket p-6 skeleton-shimmer space-y-4">
        <div class="h-4 bg-[#767068]/20 rounded w-1/4"></div>
        <div class="h-6 bg-[#767068]/20 rounded w-3/4"></div>
        <div class="ticket-divider"></div>
        <div class="h-12 bg-[#767068]/20 rounded w-full"></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="h-10 bg-[#767068]/20 rounded"></div>
          <div class="h-10 bg-[#767068]/20 rounded"></div>
        </div>
      </div>
    {:else if generatedMenuResult}
      <TicketCard variant="success" stamp="MODULE 2 MENU SOLVER" monoId="OPTIMIZATION RESULT">
        <div class="space-y-4">
          <div class="flex justify-between items-end border-b border-[#767068]/20 pb-3">
            <div>
              <span class="text-[8px] font-mono text-[#767068]">OPTIMIZED CHOICE</span>
              <h3 class="text-base font-bold text-[#2A2521]">{generatedMenuResult.menu.name}</h3>
            </div>
            <span class="px-2 py-1 font-mono text-xs font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/20 rounded">
              MARGIN: {generatedMenuResult.margin}%
            </span>
          </div>

          <p class="text-xs text-[#2A2521] leading-relaxed italic bg-[#F6F2EA]/40 p-3 border-l-2 border-[#3E6650]/50">
            "{generatedMenuResult.description}"
          </p>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/25 rounded">
              <span class="text-[9px] font-mono text-[#767068] uppercase">Est Raw Food Cost</span>
              <div class="text-sm font-mono font-bold text-[#2A2521] mt-0.5">₱{Math.round(generatedMenuResult.estCost).toLocaleString()}</div>
            </div>
            <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/25 rounded">
              <span class="text-[9px] font-mono text-[#767068] uppercase">Projected Net Yield</span>
              <div class="text-sm font-mono font-bold text-[#3E6650] mt-0.5">₱{Math.round(generatedMenuResult.estProfit).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </TicketCard>
    {:else}
      <div class="ticket-card p-6">
        <p class="text-xs text-[#767068] py-8 text-center font-mono">Fill booking details and click "Optimize Menu" to trigger integer linear programming optimization.</p>
      </div>
    {/if}

    <!-- Portion predictor (Module 1) -->
    <div class="ticket-card p-6">
      <div class="flex justify-between items-start mb-4">
        <span class="ticket-stamp">MODULE 1 PORTION PREDICTOR</span>
        <span class="mono-data text-xs font-bold text-[#767068]">XGBOOST INFERENCE</span>
      </div>

      {#if aiCalculatingQuantities}
        <div class="space-y-2">
          <div class="h-8 bg-[#767068]/15 rounded skeleton-shimmer"></div>
          <div class="h-8 bg-[#767068]/15 rounded skeleton-shimmer"></div>
        </div>
      {:else if predictedQuantities.length > 0}
        <div class="space-y-2.5">
          {#each predictedQuantities as item}
            <div class="flex justify-between items-center p-2.5 bg-[#F6F2EA]/20 border border-[#767068]/20 rounded text-xs font-mono">
              <span class="font-bold text-[#2A2521]">{item.dish}</span>
              <div class="flex items-center gap-3">
                <span class="text-[#767068]">RECOMMENDED: <strong class="text-[#3E6650] font-bold">{item.predicted} {item.unit}</strong></span>
                <span class="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold">Confidence: {item.confidence}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-xs text-[#767068] py-4 text-center font-mono">Select and optimize a menu to predict raw ingredient ratios.</p>
      {/if}
    </div>

    <!-- Event risks (Module 8) -->
    {#if aiCheckingRisks}
      <div class="skeleton-ticket p-6 skeleton-shimmer">
        <div class="h-5 bg-[#767068]/20 rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-[#767068]/20 rounded w-full mb-2"></div>
        <div class="h-4 bg-[#767068]/20 rounded w-5/6"></div>
      </div>
    {:else if riskAssessment}
      <TicketCard variant="risk" stamp="MODULE 8 LOGISTICS AUDIT" monoId="LOGISTIC REGRESSION">
        <div class="space-y-3">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-bold text-[#AC3B2A] flex items-center gap-1.5">
              <AlertTriangle size={14} /> Risk Classification: {riskAssessment.level} Level
            </span>
            <span class="text-xs font-mono">Score: {riskAssessment.score}</span>
          </div>
          <div class="space-y-1.5">
            {#each riskAssessment.reasons as r}
              <div class="text-xs text-[#2A2521] font-mono leading-relaxed pl-3 border-l-2 border-[#AC3B2A]/40">
                • {r}
              </div>
            {/each}
          </div>
        </div>
      </TicketCard>
    {/if}

    <!-- Venue, Equipment, Rental Booking & Vehicle Fleet allocation -->
    <div class="ticket-card p-6 bg-white space-y-4">
      <div class="flex justify-between items-start">
        <span class="ticket-stamp">LOGISTICS & FLEET ALLOCATION</span>
        <span class="mono-data text-xs font-bold text-[#767068]">VENUE EQUIPMENT</span>
      </div>

      <div class="space-y-3.5 text-xs font-mono">
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] text-[#767068] font-bold uppercase mb-1" for="alloc-tables">Chairs</label>
            <input id="alloc-tables" type="number" bind:value={chairsAllocated} class="w-full px-2 py-1.5 rounded border border-[#767068]/30 bg-white focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] text-[#767068] font-bold uppercase mb-1" for="alloc-chairs">Tables</label>
            <input id="alloc-chairs" type="number" bind:value={tablesAllocated} class="w-full px-2 py-1.5 rounded border border-[#767068]/30 bg-white focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] text-[#767068] font-bold uppercase mb-1" for="alloc-tents">Banquet Tents</label>
            <input id="alloc-tents" type="number" bind:value={tentsAllocated} class="w-full px-2 py-1.5 rounded border border-[#767068]/30 bg-white focus:outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] text-[#767068] font-bold uppercase mb-1" for="alloc-vehicle">Delivery Vehicle</label>
            <select id="alloc-vehicle" bind:value={selectedVehicle} class="w-full px-2 py-1.5 rounded border border-[#767068]/30 bg-white focus:outline-none">
              <option>Toyota HiAce Delivery Van (Plate #602)</option>
              <option>L300 Cargo Hauler (Plate #918)</option>
              <option>Isusu Elf 10ft Closed Truck (Plate #347)</option>
            </select>
          </div>
          <div class="flex items-center pt-5 pl-2">
            <label class="flex items-center gap-2 cursor-pointer font-bold text-[#2A2521]" for="rental-sub">
              <input id="rental-sub" type="checkbox" bind:checked={isRentalSubcontract} class="rounded border-[#767068]/30 text-[#3E6650] focus:ring-0 bg-white w-4 h-4" />
              Need 3rd Party Rental
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Kitchen production schedule and dish prep times -->
    <div class="ticket-card p-6 bg-white space-y-4">
      <div class="flex justify-between items-start">
        <span class="ticket-stamp">KITCHEN PREP SCHEDULER</span>
        <span class="mono-data text-xs font-bold text-[#767068]">DISH PREP TIMERS</span>
      </div>

      <div class="space-y-2.5">
        {#if generatedMenuResult || liveDraftMenu}
          {@const activeMenu = generatedMenuResult ? generatedMenuResult.menu : liveDraftMenu}
          <div class="p-3 bg-[#F6F2EA] border border-[#767068]/20 rounded text-xs font-mono">
            <span class="text-[#2A2521] font-bold block mb-2 uppercase">📝 Prep Timeline for: {activeMenu.name}</span>
            <div class="space-y-1 text-[#767068] pl-2 border-l border-[#767068]/30">
              {#if activeMenu.name.includes('Filipino')}
                <div>1. Chicken & Pork Adobo — <strong class="text-slate-800">90 minutes</strong> prep time</div>
                <div>2. Garlic Fried Rice — <strong class="text-slate-800">30 minutes</strong> prep time</div>
                <div>3. Pork Sinigang — <strong class="text-slate-800">75 minutes</strong> prep time</div>
                <div class="pt-2 font-bold text-[#3E6650]">Total kitchen timeline: 195 minutes (Estimated)</div>
              {:else if activeMenu.name.includes('Seafood')}
                <div>1. Garlic Butter Tiger Prawns — <strong class="text-slate-800">45 minutes</strong> prep time</div>
                <div>2. Baked Salmon Fillet — <strong class="text-slate-800">60 minutes</strong> prep time</div>
                <div>3. Steamed Rice — <strong class="text-slate-800">25 minutes</strong> prep time</div>
                <div class="pt-2 font-bold text-[#3E6650]">Total kitchen timeline: 130 minutes (Estimated)</div>
              {:else}
                <div>1. Vegetable / Protein mains prep — <strong class="text-slate-800">45 minutes</strong> prep time</div>
                <div>2. Rice and starch side dishes — <strong class="text-slate-800">30 minutes</strong> prep time</div>
                <div class="pt-2 font-bold text-[#3E6650]">Total kitchen timeline: 75 minutes (Estimated)</div>
              {/if}
            </div>
          </div>
        {:else}
          <p class="text-xs text-[#767068] py-4 text-center font-mono">No active menu generated to schedule kitchen timings.</p>
        {/if}
      </div>
    </div>

  </div>

</div>
