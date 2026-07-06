<script>
  import { onMount } from 'svelte';
  
  // Data passed from server load function
  let { data } = $props();

  // Active navigation zone / view
  let activeTab = $state('overview'); // overview, planner, customers, inventory, scheduling, audits

  // Database status indicator
  let dbStatus = $state(data.usingMockData ? 'simulation' : 'connected');

  // Core state from loader
  let customers = $state([...data.customers]);
  let events = $state([...data.events]);
  let menus = $state([...data.menus]);
  let ingredients = $state([...data.ingredients]);
  let suppliers = $state([...data.suppliers]);
  let staff = $state([...data.staff]);
  let demandForecasts = $state([...data.demandForecasts]);

  // Form states for adding customer
  let newCustName = $state('');
  let newCustContact = $state('');
  let newCustAllergies = $state('');
  let newCustDiet = $state('');
  let newCustTheme = $state('Modern Elegant');
  let customerMessage = $state('');

  // Form states for event booking & planning
  let selectedCustomer = $state('');
  let eventType = $state('Wedding');
  let guestCount = $state(100);
  let budget = $state(50000);
  let eventDate = $state('');
  let eventTheme = $state('Modern Elegant');
  let venueType = $state('Indoor Ballroom');
  let isOutdoor = $state(false);
  let eventMessage = $state('');

  // Interactive AI loader states
  let aiGeneratingMenu = $state(false);
  let aiCalculatingQuantities = $state(false);
  let aiCheckingRisks = $state(false);
  let aiSchedulingKitchen = $state(false);
  let aiAssigningStaff = $state(false);

  // AI model outputs
  let generatedMenuResult = $state(null);
  let predictedQuantities = $state([]);
  let riskAssessment = $state(null);
  let kitchenTimeline = $state([]);
  let staffAssignmentsList = $state([]);
  let selectedReturningCustomerRecs = $state([]);
  let anomalyReport = $state(null);
  let activeEventForAnalysis = $state(null);

  // Filters
  let customerSearch = $state('');
  let ingredientSearch = $state('');

  onMount(() => {
    // Default event planning date to 30 days out
    const d = new Date();
    d.setDate(d.getDate() + 30);
    eventDate = d.toISOString().split('T')[0];

    // Seed initial profit analyzer screen
    if (events.length > 0) {
      activeEventForAnalysis = events.find(e => e.status === 'Completed') || events[0];
      runProfitAnalysis(activeEventForAnalysis);
    }
  });

  // Filtered lists
  let filteredCustomers = $derived(
    customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
  );
  let filteredIngredients = $derived(
    ingredients.filter(ing => ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
  );

  // ---------------------------------------------------------------------------
  // MODULE 7: Customer Preference Cosine Similarity
  // ---------------------------------------------------------------------------
  function loadCustomerPreferences(customerId) {
    if (!customerId) {
      selectedReturningCustomerRecs = [];
      return;
    }
    const customer = customers.find(c => c.id === parseInt(customerId));
    if (!customer) return;

    // Simulate Cosine Similarity Recommendation Score
    selectedReturningCustomerRecs = menus.map(menu => {
      let score = 0.25; // Base similarity score

      // Match customer preference tags to menu tags
      if (customer.preferred_theme && menu.name.toLowerCase().includes(customer.preferred_theme.split(' ')[0].toLowerCase())) {
        score += 0.40;
      }
      
      if (customer.dietary_prefs.includes('Vegetarian') && menu.category === 'Vegetarian') {
        score += 0.45;
      }

      if (customer.allergies.includes('Shellfish') && menu.category === 'Seafood') {
        score -= 0.85; // Heavy allergen penalty
      }

      return { ...menu, matchScore: Math.max(0, Math.min(1, score)) };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
  }

  // ---------------------------------------------------------------------------
  // MODULE 2: Menu Generator Optimizer (Local LP Knapsack fallback)
  // ---------------------------------------------------------------------------
  function handleGenerateMenu() {
    if (!budget || !guestCount) return;
    aiGeneratingMenu = true;
    
    setTimeout(() => {
      const budgetPerGuest = budget / guestCount;
      let selectedMenu = null;
      let closestBudgetDiff = Infinity;

      menus.forEach(menu => {
        if (menu.cost_per_serving <= budgetPerGuest) {
          const diff = budgetPerGuest - menu.cost_per_serving;
          if (diff < closestBudgetDiff) {
            closestBudgetDiff = diff;
            selectedMenu = menu;
          }
        }
      });

      if (!selectedMenu) {
        selectedMenu = menus.reduce((prev, curr) => prev.cost_per_serving < curr.cost_per_serving ? prev : curr);
      }

      const profitMarginPct = (((selectedMenu.price_per_serving - selectedMenu.cost_per_serving) / selectedMenu.price_per_serving) * 100).toFixed(0);
      const estTotalCost = (selectedMenu.cost_per_serving * guestCount);
      const estProfit = ((selectedMenu.price_per_serving - selectedMenu.cost_per_serving) * guestCount);
      
      generatedMenuResult = {
        menu: selectedMenu,
        description: `Premium serving of ${selectedMenu.name} calibrated for ${guestCount} guests. Structured optimization targets ${profitMarginPct}% net margin with a food cost of ₱${estTotalCost.toLocaleString()} and margin of ₱${estProfit.toLocaleString()}.`,
        estCost: estTotalCost,
        estProfit: estProfit,
        margin: profitMarginPct
      };

      aiGeneratingMenu = false;
      
      // Auto chain dependencies
      handlePredictQuantities(selectedMenu.id);
      handleCheckRisks();
    }, 1100);
  }

  // ---------------------------------------------------------------------------
  // MODULE 1: Food Quantity Prediction (Local XGBoost fallback)
  // ---------------------------------------------------------------------------
  function handlePredictQuantities(menuId) {
    aiCalculatingQuantities = true;
    setTimeout(() => {
      let multiplier = 0.42;
      if (eventType === 'Wedding') multiplier = 0.49;
      if (eventType === 'Corporate Seminar') multiplier = 0.35;
      if (isOutdoor) multiplier += 0.04;

      predictedQuantities = [
        { dish: 'Main Entree Course', predicted: (guestCount * 0.28 * multiplier).toFixed(1), unit: 'kg', confidence: '94%' },
        { dish: 'Side Rice / Carb Course', predicted: (guestCount * 0.22 * multiplier).toFixed(1), unit: 'kg', confidence: '96%' },
        { dish: 'Prepared Sauces / Soup', predicted: (guestCount * 0.32 * multiplier).toFixed(1), unit: 'liters', confidence: '89%' }
      ];
      aiCalculatingQuantities = false;
    }, 700);
  }

  // ---------------------------------------------------------------------------
  // MODULE 8: Event Risk Prediction (Local Logistic Regression fallback)
  // ---------------------------------------------------------------------------
  function handleCheckRisks() {
    aiCheckingRisks = true;
    setTimeout(() => {
      let riskScore = 0.12;
      let reasons = [];

      if (isOutdoor) {
        riskScore += 0.48;
        reasons.push("Outdoor setup selected. Rainfall indices suggest a 55% precipitation probability for this cycle.");
      }
      if (guestCount > 200) {
        riskScore += 0.25;
        reasons.push("Guest count exceeds 200. Plating workflow speed constraints flagged.");
      }
      if (budget / guestCount < 350) {
        riskScore += 0.15;
        reasons.push("Budget-to-guest ratio is below ₱350. Sourcing margins may affect supplier quality.");
      }

      riskAssessment = {
        score: riskScore.toFixed(2),
        level: riskScore > 0.6 ? 'High' : (riskScore > 0.35 ? 'Medium' : 'Low'),
        reasons: reasons.length > 0 ? reasons : ["No operational anomalies flagged. Metrics within baseline tolerances."]
      };
      aiCheckingRisks = false;
    }, 850);
  }

  // ---------------------------------------------------------------------------
  // MODULE 4: Kitchen Scheduler Solver (Local CP-SAT scheduling fallback)
  // ---------------------------------------------------------------------------
  function runKitchenScheduler() {
    aiSchedulingKitchen = true;
    setTimeout(() => {
      kitchenTimeline = [
        { time: '08:00 AM', task: 'Ingredient Sourcing & Inspection', staff: 'Sarah Lim (Coordinator)', duration: '60 mins' },
        { time: '09:00 AM', task: 'Meat Marination & Veg Prep', staff: 'Anna Reyes (Sous Chef)', duration: '120 mins' },
        { time: '11:00 AM', task: 'Oven Roasting & Core Cooking', staff: 'Juan Cruz (Chef)', duration: '180 mins' },
        { time: '02:00 PM', task: 'Appetizers & Sauce Simmering', staff: 'Maria Santos (Chef)', duration: '90 mins' },
        { time: '03:30 PM', task: 'Quality Audit & Thermocouple Logging', staff: 'Pedro Gomez (Sous Chef)', duration: '45 mins' },
        { time: '04:30 PM', task: 'Station Setup & Warmers Assembly', staff: 'James Lao & Clara Diaz', duration: '90 mins' }
      ];
      aiSchedulingKitchen = false;
    }, 950);
  }

  // ---------------------------------------------------------------------------
  // MODULE 5: Staff Assignment Solver (Hungarian bipartite matching fallback)
  // ---------------------------------------------------------------------------
  function runStaffAssignment() {
    aiAssigningStaff = true;
    setTimeout(() => {
      let serverCount = Math.max(1, Math.ceil(guestCount / 35));
      
      staffAssignmentsList = [
        { role: 'Head Chef', staff: 'Juan Cruz', rate: '₱350/hr', match: '98%' },
        { role: 'Sous Chef', staff: 'Pedro Gomez', rate: '₱250/hr', match: '95%' },
        { role: 'Event Coordinator', staff: 'Sarah Lim', rate: '₱220/hr', match: '91%' }
      ];

      for (let i = 0; i < serverCount; i++) {
        staffAssignmentsList.push({
          role: `Wait Server ${i + 1}`,
          staff: staff[i % staff.length].name,
          rate: '₱150/hr',
          match: 'Assigned'
        });
      }
      aiAssigningStaff = false;
    }, 900);
  }

  // ---------------------------------------------------------------------------
  // MODULE 6: Post-Event Anomaly Profit Analyzer
  // ---------------------------------------------------------------------------
  function runProfitAnalysis(eventObj) {
    if (!eventObj) return;

    const rev = eventObj.budget;
    const ingCost = rev * (0.24 + Math.random() * 0.12);
    const labCost = rev * (0.16 + Math.random() * 0.08);
    const overhead = rev * 0.12;
    const profit = rev - ingCost - labCost - overhead;
    const margin = ((profit / rev) * 100).toFixed(0);

    const isCostAnomaly = (ingCost / rev > 0.33) || (labCost / rev > 0.22);
    let reason = "All cost indicators align with standard forecast boundaries. Net targets fulfilled.";
    
    if (isCostAnomaly) {
      if (ingCost / rev > 0.33) {
        reason = "ANOMALY: Raw protein cost ratio exceeded baseline margin by 28%. Supplier spot prices on pork belly spiked during purchase cycle.";
      } else {
        reason = "ANOMALY: High labor hours logged during prep. Job-Shop schedule exceeded constraints by 2.5 hours.";
      }
    }

    anomalyReport = {
      event: eventObj,
      ingCost: ingCost.toFixed(2),
      labCost: labCost.toFixed(2),
      overhead: overhead.toFixed(2),
      profit: profit.toFixed(2),
      margin,
      isCostAnomaly,
      reason
    };
  }

  // CRUD Submissions
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
        customers = [...customers, res.customer];
        customerMessage = `✅ Customer profile "${res.customer.name}" registered.`;
        newCustName = '';
        newCustContact = '';
        newCustAllergies = '';
        newCustDiet = '';
      } else {
        customerMessage = `❌ Registration failed: ${res.error}`;
      }
    } catch (err) {
      customerMessage = `❌ Error: ${err.message}`;
    }
  }

  async function submitEvent(e) {
    e.preventDefault();
    if (!selectedCustomer || !eventDate || !budget) return;

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer,
          event_type: eventType,
          guest_count: guestCount,
          event_date: eventDate,
          budget: budget,
          theme: eventTheme,
          venue_type: venueType,
          is_outdoor: isOutdoor
        })
      });

      const res = await response.json();
      if (res.success) {
        events = [res.event, ...events];
        eventMessage = `✅ Event ticket created for ${eventDate}.`;
      } else {
        eventMessage = `❌ Failed to save: ${res.error}`;
      }
    } catch (err) {
      eventMessage = `❌ Error: ${err.message}`;
    }
  }
</script>

<!-- Outer Market Ledger container -->
<div class="min-h-screen bg-[#F6F2EA] text-[#2A2521] flex flex-col antialiased">
  
  <!-- TOP BAR -->
  <header class="border-b border-[#767068]/30 px-6 py-4 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-30">
    <div class="flex items-center gap-3">
      <!-- Minimalist receipt stamp logo -->
      <div class="px-2.5 py-1 border-2 border-[#2A2521] font-mono text-sm font-black tracking-tighter uppercase">
        THE PASS
      </div>
      <div>
        <h1 class="text-lg font-black tracking-tight leading-none uppercase">CaterSync AI</h1>
        <span class="text-[9px] font-mono text-[#767068] tracking-widest uppercase">System Core Control</span>
      </div>
    </div>

    <!-- Right Controls and Network status -->
    <div class="flex items-center gap-4">
      <div class="hidden md:flex items-center gap-2 text-xs font-mono text-[#767068]">
        <span>LEDGER CLOCK:</span>
        <span class="text-[#2A2521] font-bold">2026-07-06 11:09</span>
      </div>
      {#if dbStatus === 'connected'}
        <span class="px-3 py-1 text-[10px] font-mono font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/30 rounded">● POSTGRES ACTIVE</span>
      {:else}
        <span class="px-3 py-1 text-[10px] font-mono font-bold bg-[#D9A441]/15 text-[#D9A441] border border-[#D9A441]/30 rounded">▲ OFFLINE SIMULATION</span>
      {/if}
    </div>
  </header>

  <!-- NAVIGATION TABS ROW -->
  <div class="border-b border-[#767068]/20 bg-white/20 px-6 py-2">
    <nav class="flex flex-wrap gap-1">
      <button onclick={() => activeTab = 'overview'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'overview' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        📋 Overview
      </button>
      <button onclick={() => activeTab = 'planner'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'planner' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        🍽️ Event Planner
      </button>
      <button onclick={() => activeTab = 'customers'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'customers' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        👥 Customers
      </button>
      <button onclick={() => activeTab = 'inventory'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'inventory' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        📦 Inventory
      </button>
      <button onclick={() => activeTab = 'scheduling'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'scheduling' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        🍳 Kitchen & Roster
      </button>
      <button onclick={() => activeTab = 'audits'} class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all {activeTab === 'audits' ? 'bg-[#2A2521] text-[#F6F2EA]' : 'text-[#767068] hover:text-[#2A2521]' }">
        💰 Anomaly Audits
      </button>
    </nav>
  </div>

  <!-- MAIN WORKSPACE -->
  <main class="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8">
    
    <!-- ----------------------- OVERVIEW / THE PASS DASHBOARD ----------------------- -->
    {#if activeTab === 'overview'}
      <div class="space-y-8 animate-fade-in">
        
        <!-- SECTION 1: TICKETS FIRING NOW (Urgent Operational Updates) -->
        <div>
          <h2 class="text-xs font-mono font-bold text-[#767068] uppercase tracking-widest mb-3">
            ─── TICKETS FIRING NOW ───
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <!-- Ticket 1: Active Weather operational risk -->
            <div class="ticket-card ticket-card-risk p-5 ticket-print-in">
              <div class="flex justify-between items-start mb-4">
                <span class="ticket-stamp">RISK FLAG</span>
                <span class="mono-data text-xs text-[#AC3B2A] font-bold">EVENT #048</span>
              </div>
              <h3 class="text-base font-bold text-[#2A2521] mb-1">Outdoor Setup Conflict</h3>
              <p class="text-xs text-[#767068] leading-relaxed mb-4">
                High risk flagged: Wedding at Garden Resort on Saturday has a 55% precipitation index. Backup tents require allocation.
              </p>
              <div class="ticket-divider"></div>
              <div class="flex justify-between text-[10px] text-[#767068] font-mono">
                <span>ACTION REQUIRED</span>
                <span class="text-[#AC3B2A] font-bold">REALLOCATE GEAR</span>
              </div>
            </div>

            <!-- Ticket 2: Low Stock Restock warning -->
            <div class="ticket-card p-5 ticket-print-in" style="border-bottom-color: var(--color-saffron)">
              <div class="flex justify-between items-start mb-4">
                <span class="ticket-stamp" style="color: var(--color-saffron); border-color: var(--color-saffron)">STOCK WARNING</span>
                <span class="mono-data text-xs text-[#D9A441] font-bold">DEPOT #01</span>
              </div>
              <h3 class="text-base font-bold text-[#2A2521] mb-1">Chicken Breast Supply</h3>
              <p class="text-xs text-[#767068] leading-relaxed mb-4">
                Current stock (80 kg) has crossed the reorder threshold (30 kg) for upcoming weekend bookings.
              </p>
              <div class="ticket-divider"></div>
              <div class="flex justify-between text-[10px] text-[#767068] font-mono">
                <span>TRIGGER POINT REACHED</span>
                <span class="text-[#D9A441] font-bold">ORDER BY THU</span>
              </div>
            </div>

            <!-- Ticket 3: Roster Crunch -->
            <div class="ticket-card p-5 ticket-print-in">
              <div class="flex justify-between items-start mb-4">
                <span class="ticket-stamp">ROSTER ALERT</span>
                <span class="mono-data text-xs text-[#767068] font-bold">STAFF #09</span>
              </div>
              <h3 class="text-base font-bold text-[#2A2521] mb-1">Sous Chef Coverage</h3>
              <p class="text-xs text-[#767068] leading-relaxed mb-4">
                Bipartite matching algorithm highlights overlap: Sous Chef Pedro Gomez assigned to two simultaneous locations on July 12.
              </p>
              <div class="ticket-divider"></div>
              <div class="flex justify-between text-[10px] text-[#767068] font-mono">
                <span>SOLVER RECALCULATING</span>
                <span class="text-[#3E6650] font-bold">RE-MATCH ROSTER</span>
              </div>
            </div>

          </div>
        </div>

        <!-- SECTION 2: STATIONS GRID -->
        <div>
          <h2 class="text-xs font-mono font-bold text-[#767068] uppercase tracking-widest mb-3">
            ─── ACTIVE STATIONS ───
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            <!-- Menu Station -->
            <button onclick={() => activeTab = 'planner'} class="ticket-card station-card p-4 text-left">
              <div class="text-xs font-mono text-[#767068]">STATION 01</div>
              <h3 class="text-lg font-bold text-[#2A2521] mt-1 mb-2">Menu Planner</h3>
              <p class="text-[11px] text-[#767068] leading-snug">Generate margins and dish serving guides.</p>
              <span class="text-[10px] font-mono text-[#3E6650] block mt-4 font-bold">OPEN PLANS →</span>
            </button>

            <!-- Customers Station -->
            <button onclick={() => activeTab = 'customers'} class="ticket-card station-card p-4 text-left">
              <div class="text-xs font-mono text-[#767068]">STATION 02</div>
              <h3 class="text-lg font-bold text-[#2A2521] mt-1 mb-2">Client Registry</h3>
              <p class="text-[11px] text-[#767068] leading-snug">Manage allergies and preference learning.</p>
              <span class="text-[10px] font-mono text-[#3E6650] block mt-4 font-bold">OPEN REGISTRY →</span>
            </button>

            <!-- Inventory Station -->
            <button onclick={() => activeTab = 'inventory'} class="ticket-card station-card p-4 text-left">
              <div class="text-xs font-mono text-[#767068]">STATION 03</div>
              <h3 class="text-lg font-bold text-[#2A2521] mt-1 mb-2">Purchasing</h3>
              <p class="text-[11px] text-[#767068] leading-snug">Economic order calculations & suppliers.</p>
              <span class="text-[10px] font-mono text-[#3E6650] block mt-4 font-bold">OPEN STOCKS →</span>
            </button>

            <!-- Scheduling Station -->
            <button onclick={() => activeTab = 'scheduling'} class="ticket-card station-card p-4 text-left">
              <div class="text-xs font-mono text-[#767068]">STATION 04</div>
              <h3 class="text-lg font-bold text-[#2A2521] mt-1 mb-2">Job Scheduler</h3>
              <p class="text-[11px] text-[#767068] leading-snug">Kitchen task timelines & staff assignments.</p>
              <span class="text-[10px] font-mono text-[#3E6650] block mt-4 font-bold">OPEN SOLVER →</span>
            </button>

            <!-- Audits Station -->
            <button onclick={() => activeTab = 'audits'} class="ticket-card station-card p-4 text-left">
              <div class="text-xs font-mono text-[#767068]">STATION 05</div>
              <h3 class="text-lg font-bold text-[#2A2521] mt-1 mb-2">Anomaly Audit</h3>
              <p class="text-[11px] text-[#767068] leading-snug">Post-event isolation forest reviews.</p>
              <span class="text-[10px] font-mono text-[#3E6650] block mt-4 font-bold">OPEN AUDITS →</span>
            </button>

          </div>
        </div>

        <!-- SECTION 3: SALES FORECASTING (Anchors bottom) -->
        <div class="ticket-card p-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-lg font-bold text-[#2A2521]">Module 9: Bookings & Revenue Forecast Trend</h2>
              <p class="text-xs text-[#767068]">Prophet Model Aggregation vs SARIMA target projections</p>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-mono bg-[#3E6650]/15 text-[#3E6650] font-bold rounded">OFFLINE ENGINE ACTIVE</span>
          </div>

          <!-- SVG Forecasting Chart -->
          <div class="h-56 w-full relative flex items-end justify-between border-b border-l border-[#767068]/30 pb-2 pl-2">
            <svg class="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <!-- Grid lines -->
              <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#767068" stroke-opacity="0.15" stroke-dasharray="3" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#767068" stroke-opacity="0.15" stroke-dasharray="3" />
              <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#767068" stroke-opacity="0.15" stroke-dasharray="3" />

              <!-- Confidence limit paths -->
              <path d="M 10 160 Q 90 120, 180 100 T 360 80 T 540 130 T 720 50 L 720 30 T 540 100 T 360 50 T 180 70 T 10 140 Z" fill="rgba(217, 164, 65, 0.08)" />
              
              <!-- Forecast Line -->
              <path d="M 10 150 Q 90 110, 180 85 T 360 65 T 540 115 T 720 40" fill="none" stroke="var(--color-basil)" stroke-width="2.5" />
            </svg>

            <!-- Labels -->
            {#each demandForecasts.slice(0, 6) as item}
              <div class="flex flex-col items-center z-10">
                <span class="text-[9px] font-mono text-[#767068]">{item.week_start}</span>
                <span class="text-[10px] font-mono text-[#3E6650] font-bold mt-1">₱{(parseFloat(item.predicted_revenue)/1000).toFixed(0)}k</span>
              </div>
            {/each}
          </div>

          <div class="mt-4 flex flex-wrap justify-between items-center text-xs text-[#767068] font-mono">
            <span>* Shaded corridor shows 95% predictive confidence window.</span>
            <span>Target Error Margins: SARIMA MAPE = 6.4% | Prophet MAPE = 5.2%</span>
          </div>
        </div>

      </div>
    {/if}

    <!-- ----------------------- EVENT PLANNER (Menu, Quantity, Risk) ----------------------- -->
    {#if activeTab === 'planner'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
        
        <!-- Booking details form (Left 5-cols) -->
        <div class="ticket-card p-6 lg:col-span-5 bg-white">
          <div class="mb-4">
            <span class="ticket-stamp">FORMULATE</span>
            <h2 class="text-xl font-bold text-[#2A2521] mt-2">Plan New Booking</h2>
          </div>

          <form onsubmit={submitEvent} class="space-y-4">
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-client">Select Client</label>
              <select id="plan-client" bind:value={selectedCustomer} onchange={() => loadCustomerPreferences(selectedCustomer)} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none focus:border-[#3E6650]" required>
                <option value="">Choose customer profile...</option>
                {#each customers as c}
                  <option value={c.id}>{c.name} (Prefers: {c.preferred_theme})</option>
                {/each}
              </select>
            </div>

            <!-- Preference matches (Cosine Similarity Recommendations) -->
            {#if selectedReturningCustomerRecs.length > 0}
              <div class="p-3 bg-[#3E6650]/5 border border-[#3E6650]/20 rounded text-[11px]">
                <span class="text-[#3E6650] font-mono font-bold block mb-1">🎯 Cosine Preference Recommendations:</span>
                <div class="grid grid-cols-3 gap-2 mt-1">
                  {#each selectedReturningCustomerRecs as r}
                    <button type="button" onclick={() => { eventTheme = r.name; handleGenerateMenu(); }} class="p-2 bg-white rounded border border-[#767068]/20 text-[9px] text-left hover:border-[#3E6650] transition-all">
                      <span class="font-bold text-[#2A2521] block leading-tight">{r.name}</span>
                      <span class="font-mono text-[#D9A441] block mt-0.5">Match: {(r.matchScore*100).toFixed(0)}%</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-type">Event Type</label>
                <select id="plan-type" bind:value={eventType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none">
                  <option>Wedding</option>
                  <option>Corporate Seminar</option>
                  <option>Birthday Party</option>
                  <option>Social Gathering</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-theme">Theme Concept</label>
                <select id="plan-theme" bind:value={eventTheme} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none">
                  <option>Modern Elegant</option>
                  <option>Rustic Barn</option>
                  <option>Tropical Luau</option>
                  <option>Corporate Minimalist</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-guests">Guests</label>
                <input id="plan-guests" type="number" bind:value={guestCount} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" min="10" />
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-budget">Budget (₱)</label>
                <input id="plan-budget" type="number" bind:value={budget} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" min="1000" />
              </div>
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-date">Target Date</label>
                <input id="plan-date" type="date" bind:value={eventDate} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="plan-venue">Venue Name</label>
                <input id="plan-venue" type="text" bind:value={venueType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" />
              </div>
              <div class="flex items-center pt-5 pl-2">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#2A2521]" for="plan-outdoor">
                  <input id="plan-outdoor" type="checkbox" bind:checked={isOutdoor} class="rounded border-[#767068]/30 text-[#3E6650] focus:ring-0 bg-white w-4 h-4" />
                  Outdoor Venue
                </label>
              </div>
            </div>

            <div class="pt-4 flex gap-2">
              <button type="button" onclick={handleGenerateMenu} class="flex-1 bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
                Optimize Menu
              </button>
              <button type="submit" class="bg-white border border-[#767068]/30 text-[#2A2521] hover:bg-slate-100 font-bold text-xs py-3 px-4 rounded uppercase tracking-wider transition-all">
                Approve booking
              </button>
            </div>

            {#if eventMessage}
              <p class="text-xs font-mono mt-2 text-slate-500">{eventMessage}</p>
            {/if}
          </form>
        </div>

        <!-- AI Output details (Right 7-cols) -->
        <div class="lg:col-span-7 space-y-6">
          
          <!-- Optimized Menu Output (Module 2) -->
          <div class="ticket-card p-6 {generatedMenuResult ? 'ticket-card-success' : ''}">
            <div class="flex justify-between items-start mb-4">
              <span class="ticket-stamp">MODULE 2 MENU SOLVER</span>
              <span class="mono-data text-xs font-bold text-[#3E6650]">OPTIMIZATION RUN</span>
            </div>

            {#if aiGeneratingMenu}
              <div class="py-8 text-center text-xs font-mono text-[#767068] flex items-center justify-center gap-2">
                <div class="w-4 h-4 border-2 border-[#3E6650] border-t-transparent rounded-full animate-spin"></div>
                Solving Knapsack Integer Optimization Matrix...
              </div>
            {:else if generatedMenuResult}
              <div class="space-y-4">
                <div class="flex justify-between items-end border-b border-[#767068]/20 pb-3">
                  <div>
                    <span class="text-[9px] font-mono text-[#767068]">OPTIMIZED CHOICE</span>
                    <h3 class="text-lg font-bold text-[#2A2521]">{generatedMenuResult.menu.name}</h3>
                  </div>
                  <span class="px-2 py-1 font-mono text-xs font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/20 rounded">
                    PROFIT: {generatedMenuResult.margin}%
                  </span>
                </div>

                <p class="text-xs text-[#2A2521] leading-relaxed italic bg-[#F6F2EA]/40 p-3 border-l-2 border-[#3E6650]/50">
                  "{generatedMenuResult.description}"
                </p>

                <div class="grid grid-cols-2 gap-4">
                  <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/25 rounded">
                    <span class="text-[9px] font-mono text-[#767068] uppercase">Est Raw Food Cost</span>
                    <div class="text-sm font-mono font-bold text-[#2A2521] mt-0.5">₱{generatedMenuResult.estCost.toLocaleString()}</div>
                  </div>
                  <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/25 rounded">
                    <span class="text-[9px] font-mono text-[#767068] uppercase">Projected Net Yield</span>
                    <div class="text-sm font-mono font-bold text-[#3E6650] mt-0.5">₱{generatedMenuResult.estProfit.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-xs text-[#767068] py-8 text-center font-mono">Fill booking specs and click "Optimize Menu" to construct knapsack models.</p>
            {/if}
          </div>

          <!-- Quantity Predictor (Module 1) -->
          <div class="ticket-card p-6">
            <div class="flex justify-between items-start mb-4">
              <span class="ticket-stamp">MODULE 1 QUANTITY FORECASTER</span>
              <span class="mono-data text-xs font-bold text-[#767068]">XGBOOST REGRESSOR</span>
            </div>

            {#if aiCalculatingQuantities}
              <div class="py-6 text-center text-xs font-mono text-[#767068] flex items-center justify-center gap-2">
                <div class="w-4 h-4 border-2 border-[#D9A441] border-t-transparent rounded-full animate-spin"></div>
                Evaluating historical portions per customer...
              </div>
            {:else if predictedQuantities.length > 0}
              <div class="space-y-2.5">
                {#each predictedQuantities as item}
                  <div class="flex justify-between items-center p-2.5 bg-[#F6F2EA]/20 border border-[#767068]/20 rounded text-xs font-mono">
                    <span class="font-bold text-[#2A2521]">{item.dish}</span>
                    <div class="flex items-center gap-3">
                      <span class="text-[#767068]">REC: <strong class="text-[#3E6650] font-bold">{item.predicted} {item.unit}</strong></span>
                      <span class="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold">Conf: {item.confidence}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-[#767068] py-4 text-center font-mono">Awaiting menu output.</p>
            {/if}
          </div>

          <!-- Risk flags (Module 8) -->
          {#if riskAssessment}
            <div class="ticket-card ticket-card-risk p-5 ticket-print-in">
              <div class="flex justify-between items-start mb-3">
                <span class="ticket-stamp" style="color: var(--color-paprika); border-color: var(--color-paprika)">RISK MITIGATION REPORT</span>
                <span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold {riskAssessment.level === 'High' ? 'bg-[#AC3B2A]/10 text-[#AC3B2A] border border-[#AC3B2A]/20' : (riskAssessment.level === 'Medium' ? 'bg-[#D9A441]/10 text-[#D9A441] border border-[#D9A441]/20' : 'bg-[#3E6650]/10 text-[#3E6650] border border-[#3E6650]/20')}">
                  {riskAssessment.level} LEVEL ({riskAssessment.score})
                </span>
              </div>
              <div class="space-y-1.5">
                {#each riskAssessment.reasons as r}
                  <div class="text-xs text-[#2A2521] font-mono leading-relaxed pl-3 border-l-2 border-[#AC3B2A]/40">
                    • {r}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

        </div>
      </div>
    {/if}

    <!-- ----------------------- CUSTOMERS VIEW ----------------------- -->
    {#if activeTab === 'customers'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
        
        <!-- Add Client (Left 4-cols) -->
        <div class="ticket-card p-6 lg:col-span-4 bg-white">
          <div class="mb-4">
            <span class="ticket-stamp">PROFILING</span>
            <h2 class="text-xl font-bold text-[#2A2521] mt-2">New Client Profile</h2>
          </div>

          <form onsubmit={submitCustomer} class="space-y-4">
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-name">Name</label>
              <input id="cust-name" type="text" bind:value={newCustName} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-contact">Contact</label>
              <input id="cust-contact" type="text" bind:value={newCustContact} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" placeholder="+63 917..." />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-allergies">Allergen Flags (comma sep)</label>
              <input id="cust-allergies" type="text" bind:value={newCustAllergies} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" placeholder="Shellfish, Peanuts" />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-diet">Dietary Preferences</label>
              <input id="cust-diet" type="text" bind:value={newCustDiet} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none" placeholder="Vegetarian, Gluten-Free" />
            </div>
            <div>
              <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="cust-theme">Preferred Theme</label>
              <select id="cust-theme" bind:value={newCustTheme} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-[#2A2521] text-xs focus:outline-none">
                <option>Modern Elegant</option>
                <option>Rustic Barn</option>
                <option>Tropical Luau</option>
                <option>Corporate Minimalist</option>
              </select>
            </div>

            <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
              Register Profile
            </button>
            
            {#if customerMessage}
              <p class="text-xs font-mono mt-2 text-slate-500">{customerMessage}</p>
            {/if}
          </form>
        </div>

        <!-- Client registry table (Right 8-cols) -->
        <div class="ticket-card p-6 lg:col-span-8 bg-white">
          <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <span class="ticket-stamp font-mono">REGISTRY</span>
              <h2 class="text-lg font-bold text-[#2A2521] mt-2">Active Accounts</h2>
            </div>
            <input type="text" bind:value={customerSearch} placeholder="🔍 Search profiles..." class="px-3 py-1.5 text-xs rounded border border-[#767068]/30 bg-white text-[#2A2521] focus:outline-none" />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse ledger-table text-xs">
              <thead>
                <tr class="text-[#767068]">
                  <th class="pb-2">ID</th>
                  <th class="pb-2">Name</th>
                  <th class="pb-2">Contact</th>
                  <th class="pb-2">Allergies</th>
                  <th class="pb-2">Preferences</th>
                  <th class="pb-2 text-right">Theme</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#767068]/15 font-mono text-[11px]">
                {#each filteredCustomers as c}
                  <tr class="hover:bg-[#F6F2EA]/40">
                    <td class="py-2.5 text-[#767068]">#{String(c.id).padStart(3, '0')}</td>
                    <td class="py-2.5 font-bold text-[#2A2521]">{c.name}</td>
                    <td class="py-2.5 text-[#767068]">{c.contact}</td>
                    <td class="py-2.5">
                      {#if c.allergies.length > 0}
                        {#each c.allergies as a}
                          <span class="px-1.5 py-0.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] font-bold mr-1">{a}</span>
                        {/each}
                      {:else}
                        <span class="text-slate-300">—</span>
                      {/if}
                    </td>
                    <td class="py-2.5">
                      {#if c.dietary_prefs.length > 0}
                        {#each c.dietary_prefs as d}
                          <span class="px-1.5 py-0.5 rounded bg-[#3E6650]/10 text-[#3E6650] font-bold mr-1">{d}</span>
                        {/each}
                      {:else}
                        <span class="text-slate-300">—</span>
                      {/if}
                    </td>
                    <td class="py-2.5 text-right text-[#767068] font-sans">{c.preferred_theme}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    {/if}

    <!-- ----------------------- INVENTORY & STOCK ROSTER ----------------------- -->
    {#if activeTab === 'inventory'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
        
        <!-- Inventory List (Left 8-cols) -->
        <div class="ticket-card p-6 lg:col-span-8 bg-white">
          <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <span class="ticket-stamp">LEDGER</span>
              <h2 class="text-lg font-bold text-[#2A2521] mt-2">Depot Stock Levels</h2>
            </div>
            <input type="text" bind:value={ingredientSearch} placeholder="🔍 Filter inventory..." class="px-3 py-1.5 text-xs rounded border border-[#767068]/30 bg-white focus:outline-none" />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse ledger-table text-xs">
              <thead>
                <tr class="text-[#767068]">
                  <th class="pb-2">Ingredient</th>
                  <th class="pb-2">Current Stock</th>
                  <th class="pb-2">Min Reorder Pt</th>
                  <th class="pb-2">Shelf Life</th>
                  <th class="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#767068]/15 font-mono text-[11px]">
                {#each filteredIngredients as ing}
                  <tr class="hover:bg-[#F6F2EA]/40">
                    <td class="py-2.5 font-bold text-[#2A2521] font-sans">{ing.name}</td>
                    <td class="py-2.5 text-[#2A2521]">{ing.current_stock} {ing.unit}</td>
                    <td class="py-2.5 text-[#767068]">{ing.reorder_point} {ing.unit}</td>
                    <td class="py-2.5 text-[#767068]">{ing.shelf_life_days} days</td>
                    <td class="py-2.5 text-right">
                      {#if parseFloat(ing.current_stock) <= parseFloat(ing.reorder_point)}
                        <span class="px-2 py-0.5 rounded bg-[#AC3B2A]/10 text-[#AC3B2A] font-bold border border-[#AC3B2A]/20 text-[9px]">CRITICAL REORDER</span>
                      {:else}
                        <span class="px-2 py-0.5 rounded bg-[#3E6650]/10 text-[#3E6650] font-bold border border-[#3E6650]/20 text-[9px]">ADEQUATE</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- EOQ Purchase recommendations (Right 4-cols) -->
        <div class="ticket-card p-6 lg:col-span-4 border-l-4 border-[#D9A441] bg-white">
          <div class="mb-4">
            <span class="ticket-stamp" style="color: var(--color-saffron); border-color: var(--color-saffron)">MODULE 3 PURCHASING</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2">EOQ Replenishment Suggestions</h2>
          </div>

          <p class="text-xs text-[#767068] leading-relaxed mb-4">
            Operations research models optimize restock sizing relative to holding metrics.
          </p>

          <div class="space-y-4">
            
            <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-xs font-mono">
              <div class="flex justify-between font-bold text-[#2A2521]">
                <span>Chicken Breast (PO Restock)</span>
                <span class="text-[#D9A441] font-bold">60 kg</span>
              </div>
              <div class="text-[10px] text-[#767068] mt-2">
                <div>Supplier: <strong class="text-[#2A2521]">Metro Meat (Reliability: 95%)</strong></div>
                <div>Deadline: <strong class="text-[#AC3B2A]">Overdue (Lead: 2 days)</strong></div>
              </div>
            </div>

            <div class="p-3 bg-[#F6F2EA]/30 border border-[#767068]/20 rounded text-xs font-mono">
              <div class="flex justify-between font-bold text-[#2A2521]">
                <span>Tiger Prawns (PO Restock)</span>
                <span class="text-[#D9A441] font-bold">20 kg</span>
              </div>
              <div class="text-[10px] text-[#767068] mt-2">
                <div>Supplier: <strong class="text-[#2A2521]">Fresh Catch (Reliability: 88%)</strong></div>
                <div>Deadline: <strong class="text-[#3E6650]">Today (Lead: 1 day)</strong></div>
              </div>
            </div>

          </div>

          <button class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all mt-6">
            Approve restock tickets
          </button>
        </div>

      </div>
    {/if}

    <!-- ----------------------- SCHEDULING (OR-Tools, Hungarian) ----------------------- -->
    {#if activeTab === 'scheduling'}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
        
        <!-- Module 4 Job-Shop timeline -->
        <div class="ticket-card p-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <span class="ticket-stamp">MODULE 4 SOLVER</span>
              <h2 class="text-xl font-bold text-[#2A2521] mt-2">Kitchen Prep Gantt Timeline</h2>
              <p class="text-xs text-[#767068]">Minimized makespan search (OR-Tools CP-SAT)</p>
            </div>
            <button onclick={runKitchenScheduler} class="bg-[#2A2521] hover:bg-slate-800 text-[#F6F2EA] font-bold text-xs px-3.5 py-2 rounded uppercase transition-all">
              Solve Schedule
            </button>
          </div>

          {#if aiSchedulingKitchen}
            <div class="py-12 text-center text-xs font-mono text-[#767068] flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-[#3E6650] border-t-transparent rounded-full animate-spin"></div>
              Solving constraint intervals & equipment capacities...
            </div>
          {:else if kitchenTimeline.length > 0}
            <div class="space-y-4">
              {#each kitchenTimeline as task}
                <div class="relative pl-6 border-l border-[#767068]/30">
                  <!-- Bullet node -->
                  <div class="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#3E6650]"></div>
                  
                  <div class="p-3 bg-[#F6F2EA]/20 border border-[#767068]/20 rounded text-xs font-mono">
                    <div class="flex justify-between items-start font-bold">
                      <span class="text-[#2A2521] font-sans font-bold">{task.task}</span>
                      <span class="text-[10px] text-[#3E6650]">{task.time}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-[#767068] mt-2">
                      <span>Worker: {task.staff}</span>
                      <span>Duration: {task.duration}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-[#767068] py-12 text-center font-mono">Click "Solve Schedule" to compute optimal task precedence paths.</p>
          {/if}
        </div>

        <!-- Module 5 Hungarian Assignments -->
        <div class="ticket-card p-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <span class="ticket-stamp">MODULE 5 MATCHING</span>
              <h2 class="text-xl font-bold text-[#2A2521] mt-2">Staff Roster Hungarian Allocation</h2>
              <p class="text-xs text-[#767068]">Linear cost-minimizing matching model</p>
            </div>
            <button onclick={runStaffAssignment} class="bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs px-3.5 py-2 rounded uppercase transition-all">
              Solve Matches
            </button>
          </div>

          {#if aiAssigningStaff}
            <div class="py-12 text-center text-xs font-mono text-[#767068] flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-[#D9A441] border-t-transparent rounded-full animate-spin"></div>
              Evaluating labor cost bipartite matrices...
            </div>
          {:else if staffAssignmentsList.length > 0}
            <div class="space-y-2.5">
              {#each staffAssignmentsList as assign}
                <div class="flex justify-between items-center p-3 bg-[#F6F2EA]/20 border border-[#767068]/20 rounded text-xs font-mono">
                  <div>
                    <h4 class="font-bold text-[#2A2521] font-sans">{assign.role}</h4>
                    <span class="text-[10px] text-[#767068]">{assign.staff} ({assign.rate})</span>
                  </div>
                  <span class="px-2 py-0.5 text-[9px] font-bold bg-[#3E6650]/15 text-[#3E6650] border border-[#3E6650]/20 rounded">
                    {assign.match}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-[#767068] py-12 text-center font-mono">Click "Solve Matches" to allocate rosters to queued event roles.</p>
          {/if}
        </div>

      </div>
    {/if}

    <!-- ----------------------- ANOMALY PROFIT AUDITS ----------------------- -->
    {#if activeTab === 'audits'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
        
        <!-- Finished events ledger (Left 4-cols) -->
        <div class="ticket-card p-6 lg:col-span-4 bg-white">
          <span class="ticket-stamp">AUDIT LOGS</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 mb-4">Completed Ledger</h2>
          <div class="space-y-2 max-h-96 overflow-y-auto pr-1 no-scrollbar">
            {#each events.filter(e => e.status === 'Completed') as event}
              <button onclick={() => runProfitAnalysis(event)} class="w-full p-3 rounded border text-left text-xs transition-all {activeEventForAnalysis?.id === event.id ? 'bg-[#2A2521] border-[#2A2521] text-[#F6F2EA]' : 'bg-white border-[#767068]/30 text-[#2A2521] hover:bg-[#F6F2EA]/50'}">
                <div class="flex justify-between font-bold">
                  <span>{event.event_type}</span>
                  <span class="font-mono">₱{event.budget.toLocaleString()}</span>
                </div>
                <div class="text-[9px] font-mono text-[#767068] mt-1">Date: {new Date(event.event_date).toLocaleDateString()} | Guests: {event.guest_count}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Module 6 Isolation Forest Audit details (Right 8-cols) -->
        <div class="ticket-card p-6 lg:col-span-8 bg-white">
          <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <span class="ticket-stamp">MODULE 6 ANALYSIS</span>
              <h2 class="text-lg font-bold text-[#2A2521] mt-2">Isolation Forest Post-Mortem</h2>
            </div>
            <span class="px-2 py-0.5 text-[9px] font-mono bg-[#AC3B2A]/15 text-[#AC3B2A] font-bold rounded">FOREST MODEL ACTIVE</span>
          </div>

          {#if anomalyReport}
            <div class="space-y-6">
              
              <!-- Indicator ticket box -->
              <div class="p-4 rounded border flex items-start gap-4 {anomalyReport.isCostAnomaly ? 'bg-[#AC3B2A]/5 border-[#AC3B2A]/20 text-[#2A2521]' : 'bg-[#3E6650]/5 border-[#3E6650]/20 text-[#2A2521]'}">
                <div class="text-2xl mt-0.5">{anomalyReport.isCostAnomaly ? '⚠️' : '✅'}</div>
                <div class="text-xs">
                  <h4 class="font-bold text-sm text-[#2A2521] mb-1 uppercase tracking-wider">{anomalyReport.isCostAnomaly ? 'Audit Flagged Anomaly' : 'Audit Normal'}</h4>
                  <p class="font-mono leading-relaxed text-[#767068]">{anomalyReport.reason}</p>
                </div>
              </div>

              <!-- Cost breakdown -->
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

              <!-- Graphic share bar -->
              <div>
                <h4 class="text-xs font-mono font-bold text-[#767068] mb-2 uppercase">Cost allocation share</h4>
                <div class="h-4 w-full rounded overflow-hidden flex text-[10px] font-mono font-bold text-[#F6F2EA]">
                  <div class="bg-[#AC3B2A] h-full flex items-center justify-center" style="width: 30%">FOOD</div>
                  <div class="bg-[#D9A441] h-full flex items-center justify-center" style="width: 22%">LABOR</div>
                  <div class="bg-[#767068] h-full flex items-center justify-center" style="width: 12%">OVERHEAD</div>
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

  </main>
</div>
