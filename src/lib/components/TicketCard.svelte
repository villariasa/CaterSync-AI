<script>
  let { 
    variant = 'default', // 'default', 'risk', 'success', 'saffron'
    stamp = '', 
    monoId = '', 
    printIn = true,
    children
  } = $props();

  let variantClass = $derived.by(() => {
    switch (variant) {
      case 'risk': return 'ticket-card-risk';
      case 'success': return 'ticket-card-success';
      case 'saffron': return 'border-b-2 border-[#D9A441] border-l-2 border-[#D9A441] border-r-2 border-[#D9A441]';
      default: return '';
    }
  });

  let stampColor = $derived.by(() => {
    switch (variant) {
      case 'risk': return 'color: var(--color-paprika); border-color: var(--color-paprika)';
      case 'success': return 'color: var(--color-basil); border-color: var(--color-basil)';
      case 'saffron': return 'color: var(--color-saffron); border-color: var(--color-saffron)';
      default: return '';
    }
  });
</script>

<div class="ticket-card p-5 {variantClass} {printIn ? 'ticket-print-in' : ''}">
  {#if stamp || monoId}
    <div class="flex justify-between items-start mb-4">
      {#if stamp}
        <span class="ticket-stamp text-[9px]" style={stampColor}>{stamp}</span>
      {:else}
        <div></div>
      {/if}

      {#if monoId}
        <span class="mono-data text-xs text-[#767068] font-bold">{monoId}</span>
      {/if}
    </div>
  {/if}

  {@render children()}
</div>
