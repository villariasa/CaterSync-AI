<script>
  import { getCateringContext } from '$lib/states.svelte.js';
  import { Fingerprint, CheckCircle2, XCircle } from '@lucide/svelte';

  const appState = getCateringContext();

  let { onsuccess = () => {}, oncancel = () => {} } = $props();

  let scanState = $state('idle'); // idle, scanning, success, error
  let scanMessage = $state('Click scanner area to verify identity');

  async function triggerBiometricScan() {
    if (scanState === 'scanning' || scanState === 'success') return;
    
    appState.playClickSound();
    scanState = 'scanning';
    scanMessage = 'Requesting device authenticator...';

    if (!window.PublicKeyCredential) {
      scanState = 'error';
      scanMessage = 'Biometrics not supported on this browser/device.';
      appState.playBuzzerSound();
      resetToIdle();
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const publicKey = {
        challenge,
        rp: {
          name: "CaterSync-AI Console",
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: "operator@catersync.ai",
          displayName: "System Operator"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000
      };

      const credential = await navigator.credentials.create({ publicKey });
      
      if (credential) {
        scanState = 'success';
        scanMessage = 'Device verified successfully!';
        appState.playScanSuccessSound();
        setTimeout(() => {
          onsuccess();
        }, 800);
      } else {
        throw new Error('Credential check returned null');
      }
    } catch (err) {
      console.warn("Device biometric verification failed:", err);
      scanState = 'error';
      if (err.name === 'NotAllowedError') {
        scanMessage = 'Lock screen validation cancelled.';
      } else {
        scanMessage = 'Biometric signature rejected.';
      }
      appState.playBuzzerSound();
      resetToIdle();
    }
  }

  function resetToIdle() {
    setTimeout(() => {
      scanState = 'idle';
      scanMessage = 'Click scanner area to verify identity';
    }, 2500);
  }
</script>

<div class="p-6 bg-white border border-[#767068]/30 rounded shadow-inner flex flex-col items-center justify-center space-y-4">
  <div class="relative w-28 h-28 flex items-center justify-center">
    
    <!-- Radar scanning sweep lines (only visible during scanning state) -->
    {#if scanState === 'scanning'}
      <div class="absolute inset-0 rounded-full border-2 border-dashed border-[#3E6650] animate-spin"></div>
      <div class="absolute top-0 bottom-0 left-0 right-0 bg-[#3E6650]/5 rounded-full animate-ping"></div>
      <div class="absolute top-1/2 left-0 right-0 h-0.5 bg-[#3E6650]/40 shadow-[0_0_8px_rgba(62,102,80,0.8)] animate-[bounce_2s_infinite]"></div>
    {/if}

    <!-- Visual status circle states -->
    <button
      type="button"
      onclick={triggerBiometricScan}
      class="w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-300 focus:outline-none cursor-pointer btn-interactive
      {scanState === 'idle' ? 'bg-[#F6F2EA] border-[#767068]/30 text-[#767068] hover:border-[#3E6650] hover:text-[#3E6650]' : ''}
      {scanState === 'scanning' ? 'bg-[#3E6650]/10 border-[#3E6650] text-[#3E6650]' : ''}
      {scanState === 'success' ? 'bg-[#3E6650]/20 border-[#3E6650] text-[#3E6650] scale-105' : ''}
      {scanState === 'error' ? 'bg-[#AC3B2A]/20 border-[#AC3B2A] text-[#AC3B2A] validation-shake' : ''}"
      disabled={scanState === 'scanning' || scanState === 'success'}
    >
      {#if scanState === 'success'}
        <CheckCircle2 size={44} class="animate-bounce" />
      {:else}
        <Fingerprint size={44} class={scanState === 'scanning' ? 'animate-pulse' : ''} />
      {/if}
    </button>
  </div>

  <div class="text-center space-y-1">
    <p class="text-xs font-mono font-bold tracking-tight
      {scanState === 'success' ? 'text-[#3E6650]' : ''}
      {scanState === 'error' ? 'text-[#AC3B2A]' : 'text-[#2A2521]'}">
      {scanMessage}
    </p>
    <span class="text-[9px] text-[#767068] font-mono block">SYSTEM CORE AUDIT: WEBAUTHN HYBRID</span>
  </div>

  {#if scanState !== 'scanning' && scanState !== 'success'}
    <button
      type="button"
      onclick={oncancel}
      class="text-[10px] font-mono uppercase tracking-wider text-[#767068] hover:underline"
    >
      ← Cancel biometrics login
    </button>
  {/if}
</div>
