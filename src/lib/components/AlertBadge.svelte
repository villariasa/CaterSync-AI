<script>
  let { 
    label = '', 
    type = 'info' // 'risk', 'warning', 'info', 'success'
  } = $props();

  let themeClass = $derived.by(() => {
    switch (type) {
      case 'risk': return 'bg-[#AC3B2A]/10 text-[#AC3B2A] border-[#AC3B2A]/20';
      case 'warning': return 'bg-[#D9A441]/10 text-[#D9A441] border-[#D9A441]/20';
      case 'success': return 'bg-[#3E6650]/10 text-[#3E6650] border-[#3E6650]/20';
      default: return 'bg-[#767068]/10 text-[#767068] border-[#767068]/20';
    }
  });
</script>

<span class="px-2 py-0.5 rounded text-[9px] font-mono font-bold border uppercase tracking-wider {themeClass}">
  {label}
</span>
