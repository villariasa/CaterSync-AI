<script>
  let { 
    stationNum = '', 
    title = '', 
    desc = '', 
    cta = 'OPEN →',
    onclick
  } = $props();
</script>

<button 
  type="button" 
  {onclick} 
  class="ticket-card station-card p-4 text-left w-full h-full flex flex-col justify-between"
>
  <div>
    {#if stationNum}
      <div class="text-[9px] font-mono text-[#767068] tracking-widest">{stationNum}</div>
    {/if}
    <h3 class="text-base font-black text-[#2A2521] mt-1 mb-1.5 uppercase tracking-tight">{title}</h3>
    <p class="text-[11px] text-[#767068] leading-snug">{desc}</p>
  </div>
  
  <span class="text-[9px] font-mono text-[#3E6650] block mt-4 font-bold tracking-wider">{cta}</span>
</button>
