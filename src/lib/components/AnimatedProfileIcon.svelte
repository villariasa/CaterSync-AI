<script>
  import { User } from '@lucide/svelte';

  let { name = 'Client', picture = null, size = 32 } = $props();

  let initial = $derived(name ? name.charAt(0).toUpperCase() : '?');
</script>

<div 
  class="profile-avatar-container relative select-none cursor-pointer"
  style="width: {size}px; height: {size}px;"
>
  <!-- Outer premium aura glow -->
  <div class="absolute inset-0 rounded-full avatar-aura opacity-30 transition-opacity duration-300"></div>

  <!-- Rotating tech border -->
  <div class="absolute inset-[-3px] rounded-full avatar-tech-ring border border-dashed border-[#3E6650]/50 animate-[spin_10s_linear_infinite] group-hover:animate-[spin_4s_linear_infinite] group-hover:border-[#D9A441]"></div>

  <!-- Inner core wrapper -->
  <div class="w-full h-full rounded-full overflow-hidden border border-[#767068]/20 bg-white dark:bg-zinc-800 flex items-center justify-center relative z-10 transition-transform duration-300 active:scale-95 shadow-md">
    {#if picture}
      <img src={picture} alt="User profile" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
    {:else if name}
      <span class="text-xs font-black tracking-tight text-[#3E6650] dark:text-emerald-400 font-mono">
        {initial}
      </span>
    {:else}
      <User size={size * 0.5} class="text-[#767068]" />
    {/if}

    <!-- Scanline micro-animation -->
    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#3E6650]/10 to-transparent w-full h-[30%] top-[-30%] pointer-events-none avatar-scanline animate-[scan_2.5s_linear_infinite]"></div>
  </div>

  <!-- Online indicator dot -->
  <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full z-20 animate-pulse"></span>
</div>

<style>
  .profile-avatar-container:hover .avatar-aura {
    opacity: 0.6;
    box-shadow: 0 0 12px rgba(62, 102, 80, 0.4);
  }

  @keyframes scan {
    0% {
      top: -30%;
    }
    100% {
      top: 100%;
    }
  }
</style>
