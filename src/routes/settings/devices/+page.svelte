<script>
  import { onMount } from 'svelte';
  import { Monitor, Smartphone, Tablet, Shield, ShieldCheck, ShieldOff, LogOut, Clock, MapPin, Wifi, Trash2, CheckCircle, AlertCircle, RefreshCw } from '@lucide/svelte';

  let sessions = $state([]);
  let devices = $state([]);
  let currentSessionId = $state(null);
  let currentDeviceId = $state(null);
  let isLoading = $state(true);
  let actionLoading = $state(null);
  let toast = $state(null);

  function showToast(message, type = 'success') {
    toast = { message, type };
    setTimeout(() => toast = null, 4000);
  }

  onMount(async () => {
    await loadDevices();
  });

  async function loadDevices() {
    isLoading = true;
    try {
      const res = await fetch('/api/auth/devices');
      const data = await res.json();
      if (data.success) {
        sessions = data.sessions || [];
        devices = data.devices || [];
        currentSessionId = data.currentSessionId;
        currentDeviceId = data.currentDeviceId;
      }
    } catch (e) {
      showToast('Failed to load devices.', 'error');
    } finally {
      isLoading = false;
    }
  }

  async function trustDevice(deviceId) {
    actionLoading = `trust:${deviceId}`;
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trust', deviceId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Device marked as trusted. OTP will be skipped on this device.');
        await loadDevices();
      }
    } catch {
      showToast('Failed to trust device.', 'error');
    } finally {
      actionLoading = null;
    }
  }

  async function logoutDevice(sessionId) {
    actionLoading = `logout:${sessionId}`;
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout_device', sessionId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Device session revoked.');
        await loadDevices();
      }
    } catch {
      showToast('Failed to revoke device.', 'error');
    } finally {
      actionLoading = null;
    }
  }

  async function logoutAll() {
    if (!confirm('This will log you out of all devices. You will need to log in again. Continue?')) return;
    actionLoading = 'logout_all';
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout_all' })
      });
      const data = await res.json();
      if (data.success) {
        showToast('All sessions revoked. Redirecting...');
        setTimeout(() => window.location.href = '/', 2000);
      }
    } catch {
      showToast('Failed to revoke all sessions.', 'error');
    } finally {
      actionLoading = null;
    }
  }

  function getPlatformIcon(session) {
    const platform = (session.platform || '').toLowerCase();
    const os = (session.os || '').toLowerCase();
    if (os.includes('android') || os.includes('ios') || platform === 'mobile') return Smartphone;
    if (os.includes('ipad') || os.includes('tablet')) return Tablet;
    return Monitor;
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function getExpiryPct(session) {
    if (!session.expires_at || !session.created_at) return 100;
    const total = new Date(session.expires_at).getTime() - new Date(session.created_at).getTime();
    const remaining = new Date(session.expires_at).getTime() - Date.now();
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }
</script>

<svelte:head>
  <title>Active Devices — CaterSync</title>
  <meta name="description" content="Manage your active sessions and trusted devices on CaterSync." />
</svelte:head>

<div class="min-h-screen bg-[#F6F2EA] dark:bg-[#1A1715] p-4 md:p-8 font-mono">

  <!-- Toast -->
  {#if toast}
    <div class="fixed top-4 right-4 z-50 max-w-sm animate-fade-in">
      <div class="flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm font-bold
        {toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}">
        {#if toast.type === 'error'}
          <AlertCircle size={15} />
        {:else}
          <CheckCircle size={15} />
        {/if}
        {toast.message}
      </div>
    </div>
  {/if}

  <div class="max-w-3xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <span class="text-[9px] uppercase tracking-widest text-[#767068] font-bold">Security</span>
        <h1 class="text-xl font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-tight">Active Devices</h1>
        <p class="text-[10px] text-[#767068] mt-0.5">Manage all devices where you're logged in.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          onclick={loadDevices}
          disabled={isLoading}
          class="p-2 rounded border border-[#767068]/25 bg-white dark:bg-zinc-800 text-[#767068] hover:text-[#2A2521] transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
        </button>
        <button
          onclick={logoutAll}
          disabled={actionLoading === 'logout_all'}
          class="flex items-center gap-1.5 px-3 py-2 rounded bg-[#AC3B2A]/10 border border-[#AC3B2A]/30 text-[#AC3B2A] text-[10px] font-bold uppercase tracking-wider hover:bg-[#AC3B2A]/20 transition-all disabled:opacity-50"
        >
          <LogOut size={12} />
          Logout All
        </button>
      </div>
    </div>

    {#if isLoading}
      <!-- Skeleton -->
      <div class="space-y-3">
        {#each [1,2,3] as _}
          <div class="bg-white dark:bg-[#24201E] rounded-lg border border-slate-200 dark:border-zinc-800 p-4 animate-pulse">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/3"></div>
                <div class="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if sessions.length === 0}
      <div class="bg-white dark:bg-[#24201E] rounded-lg border border-slate-200 dark:border-zinc-800 p-8 text-center">
        <Shield size={32} class="mx-auto text-[#767068] mb-3" />
        <p class="text-sm text-[#767068]">No active sessions found.</p>
      </div>
    {:else}
      <!-- Sessions List -->
      <div class="space-y-3">
        {#each sessions as session}
          {@const isCurrentSession = session.id === currentSessionId}
          {@const isCurrentDevice = session.device_id === currentDeviceId}
          {@const PlatformIcon = getPlatformIcon(session)}

          <div class="bg-white dark:bg-[#24201E] rounded-lg border transition-all
            {isCurrentSession ? 'border-[#3E6650]/50 shadow-md' : 'border-slate-200 dark:border-zinc-800'}">

            <div class="p-4 flex items-start gap-3">
              <!-- Device Icon -->
              <div class="p-2.5 rounded-lg shrink-0
                {isCurrentSession ? 'bg-[#3E6650]/10 text-[#3E6650]' : 'bg-slate-100 dark:bg-zinc-800 text-[#767068]'}">
                <PlatformIcon size={18} />
              </div>

              <!-- Device Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold text-[#2A2521] dark:text-[#EBE5DC] truncate">
                    {session.device_name || `${session.browser || 'Unknown'} on ${session.os || 'Unknown'}`}
                  </span>
                  {#if isCurrentSession}
                    <span class="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-[#3E6650]/10 text-[#3E6650] border border-[#3E6650]/20">
                      Current
                    </span>
                  {/if}
                  {#if session.is_trusted}
                    <span class="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck size={9} /> Trusted
                    </span>
                  {/if}
                </div>

                <div class="flex flex-wrap gap-3 mt-1.5">
                  <span class="flex items-center gap-1 text-[10px] text-[#767068]">
                    <Clock size={10} /> {formatRelativeTime(session.last_active_at)}
                  </span>
                  {#if session.ip_address}
                    <span class="flex items-center gap-1 text-[10px] text-[#767068]">
                      <Wifi size={10} /> {session.ip_address}
                    </span>
                  {/if}
                  {#if session.last_city || session.last_country}
                    <span class="flex items-center gap-1 text-[10px] text-[#767068]">
                      <MapPin size={10} /> {[session.last_city, session.last_country].filter(Boolean).join(', ')}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1.5 shrink-0">
                {#if !session.is_trusted && session.device_id}
                  <button
                    onclick={() => trustDevice(session.device_id)}
                    disabled={actionLoading === `trust:${session.device_id}`}
                    class="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] font-bold uppercase border border-[#3E6650]/30 text-[#3E6650] bg-[#3E6650]/5 hover:bg-[#3E6650]/15 transition-all disabled:opacity-50"
                    title="Trust this device"
                  >
                    <ShieldCheck size={10} />
                    Trust
                  </button>
                {/if}
                {#if !isCurrentSession}
                  <button
                    onclick={() => logoutDevice(session.id)}
                    disabled={actionLoading === `logout:${session.id}`}
                    class="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] font-bold uppercase border border-[#AC3B2A]/30 text-[#AC3B2A] bg-[#AC3B2A]/5 hover:bg-[#AC3B2A]/15 transition-all disabled:opacity-50"
                    title="Logout this device"
                  >
                    <LogOut size={10} />
                    Logout
                  </button>
                {/if}
              </div>
            </div>

            <!-- Expiry bar -->
            <div class="h-0.5 bg-slate-100 dark:bg-zinc-800 mx-4 mb-3 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-[#3E6650]/50 transition-all" style="width: {getExpiryPct(session)}%"></div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Security Tips -->
      <div class="bg-[#3E6650]/5 border border-[#3E6650]/20 rounded-lg p-4">
        <div class="flex items-start gap-2">
          <Shield size={14} class="text-[#3E6650] mt-0.5 shrink-0" />
          <div>
            <p class="text-[10px] font-bold text-[#3E6650] uppercase tracking-wider mb-1">Security Tips</p>
            <ul class="text-[10px] text-[#5A544F] space-y-0.5 leading-relaxed">
              <li>• Trust devices you own to skip verification prompts.</li>
              <li>• If you see an unfamiliar device, revoke it immediately.</li>
              <li>• Use "Logout All" if you think your account is compromised.</li>
            </ul>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
