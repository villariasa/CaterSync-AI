<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Users, Plus } from '@lucide/svelte';

  const appState = getCateringContext();

  let name = $state('');
  let role = $state('Chef');
  let hourlyRate = $state(250);
  let maxHours = $state(40);
  
  let staffMessage = $state('');

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Staff Name', sortable: true, isSans: true },
    { key: 'role', label: 'Role Designation', sortable: true },
    { 
      key: 'hourly_rate', 
      label: 'Hourly Rate', 
      sortable: true,
      render: (row) => `₱${parseFloat(row.hourly_rate).toFixed(2)}/hr`
    },
    { 
      key: 'max_hours_per_week', 
      label: 'Weekly Limit', 
      sortable: true,
      render: (row) => `${row.max_hours_per_week} hrs max`
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      align: 'right',
      render: (row) => {
        return row.is_active ?? true 
          ? `<span class="px-2 py-0.5 rounded bg-[#3E6650]/10 text-[#3E6650] font-bold border border-[#3E6650]/20 text-[9px] uppercase">ACTIVE</span>`
          : `<span class="px-2 py-0.5 rounded bg-[#767068]/15 text-[#767068] font-bold border border-[#767068]/20 text-[9px] uppercase">INACTIVE</span>`;
      }
    }
  ];

  async function submitStaff(e) {
    e.preventDefault();
    if (!name) return;

    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role,
          hourly_rate: hourlyRate,
          max_hours_per_week: maxHours
        })
      });

      const res = await response.json();
      if (res.success) {
        appState.staff = [...appState.staff, res.staff];
        staffMessage = `✅ Staff member "${res.staff.name}" enrolled.`;
        name = '';
        appState.showToast("👥 Worker registered");
        appState.playStampSound();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      staffMessage = `❌ Enrollment failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }
</script>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
  
  <!-- Add Staff Form -->
  <div class="ticket-card p-6 lg:col-span-4 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">OPERATIONAL ROSTER</span>
      <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Plus size={18} /> Enroll Staff Member
      </h2>
    </div>

    <form onsubmit={submitStaff} class="space-y-4">
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="staff-name">Worker Name</label>
        <input id="staff-name" type="text" bind:value={name} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
      </div>
      <div>
        <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="staff-role">Role</label>
        <select id="staff-role" bind:value={role} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
          <option>Chef</option>
          <option>Sous Chef</option>
          <option>Coordinator</option>
          <option>Server</option>
          <option>Bartender</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="staff-rate">Hourly Rate (₱)</label>
          <input id="staff-rate" type="number" bind:value={hourlyRate} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="1" />
        </div>
        <div>
          <label class="block text-xs font-mono font-bold text-[#767068] uppercase mb-1" for="staff-hours">Weekly Limit (hrs)</label>
          <input id="staff-hours" type="number" bind:value={maxHours} autocomplete="off" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="1" />
        </div>
      </div>

      <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
        Enroll Worker
      </button>
      
      {#if staffMessage}
        <p class="text-xs font-mono mt-2 text-[#767068]">{staffMessage}</p>
      {/if}
    </form>
  </div>

  <!-- Staff Table -->
  <div class="ticket-card p-6 lg:col-span-8 bg-white">
    <div class="mb-4">
      <span class="ticket-stamp">ROSTER DIRECTORY</span>
      <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
        <Users size={16} /> Enrolled Kitchen Staff & Servers
      </h2>
    </div>

    <DataTable 
      rows={appState.staff} 
      {columns} 
      searchableKeys={['name', 'role']}
      emptyMessage="No staff profiles configured."
    />
  </div>

</div>
