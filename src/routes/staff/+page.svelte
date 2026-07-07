<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import DataTable from '$lib/components/DataTable.svelte';
  import { Users, Plus, Shield, CalendarCheck, Clock, Check } from '@lucide/svelte';
  import { onMount } from 'svelte';

  const appState = getCateringContext();

  let activeTab = $state('roster'); // roster, certs, clock

  // Form states for staff
  let name = $state('');
  let role = $state('Chef');
  let hourlyRate = $state(250);
  let maxHours = $state(40);
  let staffMessage = $state('');

  // Form states for leave requests
  let leaveStaffId = $state('');
  let leaveStart = $state('');
  let leaveEnd = $state('');
  let leaveType = $state('Sick Leave'); // Sick, Vacation, Personal
  let leaveMessage = $state('');

  // Form states for clocking logs
  let clockEventId = $state('');
  let clockStaffId = $state('');
  let clockHours = $state(8);
  let clockMessage = $state('');

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

  // Certifications columns definition
  const certColumns = [
    { key: 'id', label: 'Cert ID', sortable: true },
    { 
      key: 'staff_name', 
      label: 'Staff Member', 
      sortable: true,
      render: (row) => {
        const member = appState.staff.find(s => s.id === row.staff_id);
        return member ? member.name : `Staff #${row.staff_id}`;
      }
    },
    { key: 'cert_name', label: 'Certification License', sortable: true, isSans: true },
    { key: 'issuing_body', label: 'Authority', sortable: false },
    { 
      key: 'expires_at', 
      label: 'Expiry Date', 
      sortable: true,
      render: (row) => new Date(row.expires_at).toLocaleDateString()
    }
  ];

  // Leave logs columns definition
  const leaveColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { 
      key: 'staff_name', 
      label: 'Staff Member', 
      sortable: true,
      render: (row) => {
        const member = appState.staff.find(s => s.id === row.staff_id);
        return member ? member.name : `Staff #${row.staff_id}`;
      }
    },
    { key: 'leave_type', label: 'Category', sortable: true },
    { 
      key: 'duration', 
      label: 'Span dates', 
      sortable: false,
      render: (row) => `${new Date(row.start_date).toLocaleDateString()} - ${new Date(row.end_date).toLocaleDateString()}`
    },
    { 
      key: 'status', 
      label: 'Approval Status', 
      sortable: true,
      render: (row) => {
        const bg = row.status === 'Approved' ? 'bg-emerald-50 text-[#3E6650] border-[#3E6650]/20' : 'bg-amber-50 text-amber-600 border-amber-200';
        return `<span class="px-2 py-0.5 rounded border text-[9px] uppercase font-bold ${bg}">${row.status}</span>`;
      }
    }
  ];

  // Clock log columns definition
  const clockColumns = [
    { key: 'id', label: 'Timesheet ID', sortable: true },
    { 
      key: 'staff_name', 
      label: 'Staff Name', 
      sortable: true,
      render: (row) => {
        const member = appState.staff.find(s => s.id === row.staff_id);
        return member ? member.name : `Staff #${row.staff_id}`;
      }
    },
    { key: 'event_id', label: 'Event Ref', sortable: true },
    { 
      key: 'hours_worked', 
      label: 'Hours Logged', 
      sortable: true,
      render: (row) => `${row.hours_worked} Hours`
    },
    { 
      key: 'recorded_at', 
      label: 'Filed Timestamp', 
      sortable: true,
      render: (row) => new Date(row.recorded_at).toLocaleString()
    }
  ];

  async function submitStaff(e) {
    e.preventDefault();
    if (!name) return;

    const payload = {
      name,
      role,
      hourly_rate: hourlyRate,
      max_hours_per_week: maxHours
    };

    if (appState.usingMockData) {
      const mockStaff = {
        id: Date.now(),
        ...payload
      };
      appState.staff = [...appState.staff, mockStaff];
      staffMessage = `✅ Staff member "${mockStaff.name}" enrolled locally.`;
      name = '';
      appState.showToast("👥 Worker registered");
      appState.playStampSound();
      return;
    }

    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      if (res.success) {
        appState.staff = [...appState.staff, res.staff];
        staffMessage = `✅ Staff member "${res.staff.name}" enrolled.`;
        name = '';
        appState.showToast("👥 Worker registered");
        appState.playStampSound();
      }
    } catch (err) {
      staffMessage = `❌ Enrollment failed: ${err.message}`;
      appState.playBuzzerSound();
    }
  }

  // Handle leave requests
  function requestLeave(e) {
    e.preventDefault();
    if (!leaveStaffId || !leaveStart || !leaveEnd) return;

    appState.playClickSound();

    const leave = {
      id: appState.staffLeaves.length + 301,
      staff_id: parseInt(leaveStaffId),
      leave_type: leaveType,
      start_date: leaveStart,
      end_date: leaveEnd,
      status: 'Pending'
    };

    appState.staffLeaves = [...appState.staffLeaves, leave];
    leaveMessage = `✅ Leave request registered. Awaiting manager checkoff.`;
    appState.playStampSound();
    
    // Clear inputs
    leaveStart = '';
    leaveEnd = '';
  }

  // Submit hours worked timesheet clock logs
  function logHoursWorked(e) {
    e.preventDefault();
    if (!clockEventId || !clockStaffId || clockHours <= 0) return;

    appState.playClickSound();

    const log = {
      id: appState.staffTimeLogs.length + 801,
      event_id: parseInt(clockEventId),
      staff_id: parseInt(clockStaffId),
      hours_worked: clockHours,
      recorded_at: new Date().toISOString()
    };

    appState.staffTimeLogs = [log, ...appState.staffTimeLogs];
    clockMessage = `✅ Reconciled Timesheet hours successfully.`;
    appState.playStampSound();
  }

  onMount(() => {
    // Seed staff lists if empty
    if (!appState.staffCertifications || appState.staffCertifications.length === 0) {
      appState.staffCertifications = [
        { id: 201, staff_id: 1, cert_name: 'Food Safety & Handling', issuing_body: 'DOH Food Hygiene', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString() },
        { id: 202, staff_id: 5, cert_name: 'Professional Driving License (Heavy vehicle)', issuing_body: 'LTO Philippines', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString() }
      ];
    }
    if (!appState.staffLeaves || appState.staffLeaves.length === 0) {
      appState.staffLeaves = [
        { id: 301, staff_id: 3, leave_type: 'Sick Leave', start_date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), end_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), status: 'Approved' }
      ];
    }
    if (!appState.staffTimeLogs || appState.staffTimeLogs.length === 0) {
      appState.staffTimeLogs = [
        { id: 801, event_id: 501, staff_id: 1, hours_worked: 8, recorded_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() }
      ];
    }
  });
</script>

<div class="space-y-6">
  
  <!-- TAB PANELS -->
  <nav class="flex border-b border-[#767068]/20 font-mono text-xs">
    <button 
      onclick={() => { activeTab = 'roster'; staffMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'roster' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Users size={13} />
        Staff Registry
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'certs'; leaveMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'certs' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Shield size={13} />
        Availabilities & Certs
      </div>
    </button>
    <button 
      onclick={() => { activeTab = 'clock'; clockMessage = ''; }}
      class="px-4 py-2 font-bold uppercase border-b-2 transition-all {activeTab === 'clock' ? 'border-[#3E6650] text-[#3E6650]' : 'border-transparent text-[#767068] hover:text-[#2A2521]'}"
    >
      <div class="flex items-center gap-1.5">
        <Clock size={13} />
        Timesheet Clock-In
      </div>
    </button>
  </nav>

  {#if activeTab === 'roster'}
    <!-- TAB 1: ROSTER DIRECTORY -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">OPERATIONAL ROSTER</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Plus size={18} /> Enroll Staff Member
          </h2>
        </div>

        <form onsubmit={submitStaff} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="staff-name">Staff Name</label>
            <input id="staff-name" type="text" bind:value={name} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="staff-role">Role Designation</label>
            <select id="staff-role" bind:value={role} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
              <option>Chef</option>
              <option>Sous Chef</option>
              <option>Coordinator</option>
              <option>Bartender</option>
              <option>Server</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="staff-rate">Hourly Rate (₱/hr)</label>
            <input id="staff-rate" type="number" bind:value={hourlyRate} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" />
          </div>
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="staff-hours">Weekly Cap Limit (hours)</label>
            <input id="staff-hours" type="number" bind:value={maxHours} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" min="0" />
          </div>

          <button type="submit" class="w-full bg-[#3E6650] hover:bg-[#3E6650]/90 text-[#F6F2EA] font-bold text-xs py-3 rounded uppercase tracking-wider transition-all btn-interactive">
            Enroll Active Worker
          </button>
          
          {#if staffMessage}
            <p class="text-xs text-[#767068] mt-2">{staffMessage}</p>
          {/if}
        </form>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">LEDGER DIRECTORY</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Users size={16} /> Enrolled Crew members
          </h2>
        </div>

        <DataTable 
          rows={appState.staff} 
          {columns} 
          searchableKeys={['name', 'role']}
          emptyMessage="No employees registered."
        />
      </div>
    </div>
  {/if}

  {#if activeTab === 'certs'}
    <!-- TAB 2: CERTIFICATIONS & LEAVES -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">ROSTER CALENDAR</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <CalendarCheck size={18} /> File Leave Request
          </h2>
        </div>

        <form onsubmit={requestLeave} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="leave-staff">Select Crew Member</label>
            <select id="leave-staff" bind:value={leaveStaffId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Choose Member --</option>
              {#each appState.staff as s}
                <option value={s.id}>{s.name} ({s.role})</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="leave-start">Start Date</label>
              <input id="leave-start" type="date" bind:value={leaveStart} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
            </div>
            <div>
              <label class="block font-bold text-[#767068] uppercase mb-1" for="leave-end">End Date</label>
              <input id="leave-end" type="date" bind:value={leaveEnd} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
            </div>
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="leave-type">Leave Category</label>
            <select id="leave-type" bind:value={leaveType} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none">
              <option>Sick Leave</option>
              <option>Vacation Leave</option>
              <option>Personal Leave</option>
            </select>
          </div>

          <button type="submit" class="w-full bg-[#AC3B2A] hover:bg-[#AC3B2A]/90 text-white font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
            File Leave Request
          </button>

          {#if leaveMessage}
            <p class="text-xs text-[#3E6650] font-bold mt-2">{leaveMessage}</p>
          {/if}
        </form>
      </div>

      <div class="lg:col-span-8 space-y-6">
        <!-- Leave registry table -->
        <div class="ticket-card p-6 bg-white">
          <div class="mb-4">
            <span class="ticket-stamp">UNAVAILABILITY DIRECTORY</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <CalendarCheck size={16} /> Leaves Registry
            </h2>
          </div>
          <DataTable 
            rows={appState.staffLeaves || []} 
            columns={leaveColumns} 
            searchableKeys={['leave_type']}
            emptyMessage="No leave records logged."
          />
        </div>

        <!-- Certifications table -->
        <div class="ticket-card p-6 bg-white">
          <div class="mb-4">
            <span class="ticket-stamp">CREDENTIALS REGISTRY</span>
            <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
              <Shield size={16} /> Certified Crew Clearances
            </h2>
          </div>
          <DataTable 
            rows={appState.staffCertifications || []} 
            columns={certColumns} 
            searchableKeys={['cert_name']}
            emptyMessage="No certifications registered."
          />
        </div>
      </div>
    </div>
  {/if}

  {#if activeTab === 'clock'}
    <!-- TAB 3: CLOCK-IN/OUT TIMESHEETS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
      <div class="ticket-card p-6 lg:col-span-4 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">ATTENDANCE RECONCILER</span>
          <h2 class="text-xl font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Clock size={18} /> Record Worked Hours
          </h2>
        </div>

        <form onsubmit={logHoursWorked} class="space-y-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="clock-event">Select Active Event</label>
            <select id="clock-event" bind:value={clockEventId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Choose Event --</option>
              {#each appState.events as ev}
                <option value={ev.id}>Event #{ev.id} - {ev.event_type} ({ev.event_date})</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="clock-staff">Select Crew Member</label>
            <select id="clock-staff" bind:value={clockStaffId} class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required>
              <option value="">-- Choose Member --</option>
              {#each appState.staff as s}
                <option value={s.id}>{s.name} ({s.role})</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block font-bold text-[#767068] uppercase mb-1" for="clock-hours">Hours Logged</label>
            <input id="clock-hours" type="number" step="0.5" bind:value={clockHours} min="0.5" class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs focus:outline-none" required />
          </div>

          <button type="submit" class="w-full bg-[#2A2521] hover:bg-[#2A2521]/90 text-white font-bold text-xs py-3 rounded uppercase tracking-wider transition-all">
            Clock Timesheet Hours
          </button>

          {#if clockMessage}
            <p class="text-xs text-[#3E6650] font-bold mt-2">{clockMessage}</p>
          {/if}
        </form>
      </div>

      <div class="ticket-card p-6 lg:col-span-8 bg-white">
        <div class="mb-4">
          <span class="ticket-stamp">TIMESHEET ATTENDANCE DIRECTORY</span>
          <h2 class="text-lg font-bold text-[#2A2521] mt-2 flex items-center gap-1.5">
            <Clock size={16} /> Timesheet Logs
          </h2>
        </div>

        <DataTable 
          rows={appState.staffTimeLogs || []} 
          columns={clockColumns} 
          searchableKeys={['staff_name']}
          emptyMessage="No timesheet logs logged."
        />
      </div>
    </div>
  {/if}

</div>
