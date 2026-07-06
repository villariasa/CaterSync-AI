<script>
  import { Clock } from '@lucide/svelte';

  let { 
    tasks = [], 
    solved = false 
  } = $props();
</script>

<div class="space-y-4 relative">
  {#if tasks.length > 0}
    <div class="absolute left-7 top-2 bottom-2 w-0.5 border-l border-dashed border-[#767068]/30"></div>
    {#each tasks as task, i}
      <div class="flex gap-4 items-start relative z-10 transition-all duration-300">
        <!-- Time Node Badge -->
        <div class="w-16 flex-shrink-0 text-right pr-2">
          <span class="text-[9px] font-mono font-bold text-[#767068] block">{task.time}</span>
          <span class="text-[8px] font-mono text-slate-400 block mt-0.5">{task.duration}</span>
        </div>

        <!-- Node Dot -->
        <div class="w-4 h-4 rounded-full bg-[#3E6650] flex items-center justify-center mt-1 flex-shrink-0">
          <Clock size={10} class="text-[#F6F2EA]" />
        </div>

        <!-- Details Card -->
        <div class="flex-1 p-3 border border-[#767068]/20 rounded text-xs font-mono {solved ? 'cell-updated-flash' : 'bg-[#F6F2EA]/20'}">
          <div class="flex justify-between items-start font-bold">
            <span class="text-[#2A2521] font-sans font-bold leading-tight">{task.task}</span>
          </div>
          <div class="flex justify-between text-[10px] text-[#767068] mt-2">
            <span>Staff Assigned: <strong>{task.staff}</strong></span>
          </div>
        </div>
      </div>
    {/each}
  {:else}
    <p class="text-xs text-[#767068] py-8 text-center font-mono">No tasks loaded in the timeline.</p>
  {/if}
</div>
