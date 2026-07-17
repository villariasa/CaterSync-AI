<script>
  import { onMount } from 'svelte';
  import { CheckCircle, XCircle, Smartphone, Globe, Clock, Shield, RefreshCw, ChevronRight } from '@lucide/svelte';

  let history = $state([]);
  let isLoading = $state(true);

  const METHOD_LABELS = {
    otp: 'Email OTP',
    google: 'Google OAuth',
    webauthn: 'Biometrics',
    totp: 'Authenticator App',
    password: 'Password',
    magic_link: 'Magic Link',
    refresh_token: 'Auto-refresh'
  };

  const EVENT_LABELS = {
    login_success: { label: 'Login', success: true },
    login_failed: { label: 'Failed Login', success: false },
    otp_sent: { label: 'OTP Sent', success: true },
    otp_verified: { label: 'OTP Verified', success: true },
    otp_failed: { label: 'OTP Failed', success: false },
    logout: { label: 'Logout', success: true },
    logout_all: { label: 'All Devices Logout', success: true },
    token_refresh: { label: 'Auto Sign-In', success: true },
    device_trusted: { label: 'Device Trusted', success: true },
    webauthn_success: { label: 'Biometric Auth', success: true },
    webauthn_failed: { label: 'Biometric Failed', success: false },
    google_auth: { label: 'Google Auth', success: true },
    account_locked: { label: 'Account Locked', success: false },
    totp_verified: { label: 'TOTP Verified', success: true },
    totp_failed: { label: 'TOTP Failed', success: false }
  };

  onMount(async () => {
    try {
      const res = await fetch('/api/auth/history?limit=100');
      const data = await res.json();
      if (data.success) history = data.history || [];
    } catch { /* silently fail */ }
    finally { isLoading = false; }
  });

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function getEventInfo(eventType) {
    return EVENT_LABELS[eventType] || { label: eventType, success: true };
  }
</script>

<svelte:head>
  <title>Login History — CaterSync</title>
  <meta name="description" content="View your account login history and security events." />
</svelte:head>

<div class="min-h-screen bg-[#F6F2EA] dark:bg-[#1A1715] p-4 md:p-8 font-mono">
  <div class="max-w-3xl mx-auto space-y-6">

    <!-- Header -->
    <div>
      <span class="text-[9px] uppercase tracking-widest text-[#767068] font-bold">Security</span>
      <h1 class="text-xl font-black text-[#2A2521] dark:text-[#EBE5DC] uppercase tracking-tight">Login History</h1>
      <p class="text-[10px] text-[#767068] mt-0.5">All authentication events on your account.</p>
    </div>

    <!-- Quick navigation -->
    <a href="/settings/devices"
      class="flex items-center justify-between p-3 bg-white dark:bg-[#24201E] rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-[#3E6650]/30 transition-all group no-underline">
      <div class="flex items-center gap-2">
        <Smartphone size={15} class="text-[#3E6650]" />
        <span class="text-[11px] font-bold text-[#2A2521] dark:text-[#EBE5DC]">Manage Active Devices</span>
      </div>
      <ChevronRight size={14} class="text-[#767068] group-hover:text-[#3E6650] transition-colors" />
    </a>

    {#if isLoading}
      <div class="space-y-2">
        {#each [1,2,3,4,5] as _}
          <div class="bg-white dark:bg-[#24201E] rounded border border-slate-200 dark:border-zinc-800 p-3 animate-pulse flex gap-3">
            <div class="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 shrink-0"></div>
            <div class="flex-1 space-y-1.5">
              <div class="h-2.5 bg-slate-200 dark:bg-zinc-700 rounded w-1/4"></div>
              <div class="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-1/2"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if history.length === 0}
      <div class="bg-white dark:bg-[#24201E] rounded-lg border border-slate-200 dark:border-zinc-800 p-8 text-center">
        <Clock size={28} class="mx-auto text-[#767068] mb-3" />
        <p class="text-sm text-[#767068]">No login history yet.</p>
      </div>
    {:else}
      <!-- History Table -->
      <div class="bg-white dark:bg-[#24201E] rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div class="divide-y divide-slate-100 dark:divide-zinc-800">
          {#each history as event}
            {@const info = getEventInfo(event.event_type)}
            <div class="p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
              <!-- Status Icon -->
              <div class="shrink-0 mt-0.5">
                {#if info.success}
                  <CheckCircle size={14} class="text-[#3E6650]" />
                {:else}
                  <XCircle size={14} class="text-[#AC3B2A]" />
                {/if}
              </div>

              <!-- Event Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[11px] font-bold {info.success ? 'text-[#2A2521] dark:text-[#EBE5DC]' : 'text-[#AC3B2A]'}">
                    {info.label}
                  </span>
                  {#if event.method}
                    <span class="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-slate-100 dark:bg-zinc-800 text-[#767068] rounded">
                      {METHOD_LABELS[event.method] || event.method}
                    </span>
                  {/if}
                </div>
                <div class="flex flex-wrap gap-2 mt-0.5">
                  <span class="text-[9px] text-[#767068]">
                    <Clock size={8} class="inline mr-0.5" />{formatDate(event.created_at)}
                  </span>
                  {#if event.ip_address}
                    <span class="text-[9px] text-[#767068]">
                      <Globe size={8} class="inline mr-0.5" />{event.ip_address}
                      {#if event.city || event.country}{event.city || ''} {event.country || ''}{/if}
                    </span>
                  {/if}
                </div>
                {#if event.failure_reason}
                  <p class="text-[9px] text-[#AC3B2A] mt-0.5 capitalize">
                    {event.failure_reason.replace(/_/g, ' ')}
                  </p>
                {/if}
              </div>

              <!-- Risk score (only for notable events) -->
              {#if event.risk_score >= 30}
                <div class="shrink-0 text-right">
                  <span class="px-1.5 py-0.5 text-[8px] font-bold rounded
                    {event.risk_score >= 60 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}">
                    Risk: {event.risk_score}
                  </span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <p class="text-center text-[9px] text-[#767068]">Showing last {history.length} events.</p>
    {/if}
  </div>
</div>
