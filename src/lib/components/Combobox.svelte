<script>
  import { onMount } from 'svelte';
  import { Search, ChevronDown, Check } from '@lucide/svelte';

  let {
    items = [],
    value = $bindable(''),
    placeholder = 'Select option...',
    labelKey = 'name',
    valueKey = 'id',
    searchPlaceholder = 'Search items...',
    onchange = () => {}
  } = $props();

  let isOpen = $state(false);
  let searchQuery = $state('');
  let containerRef = $state(null);

  // Derived filtered items matching query
  let filteredItems = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(item => {
      const val = item[labelKey];
      return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
    });
  });

  // Selected item display name
  let selectedDisplay = $derived.by(() => {
    if (value === undefined || value === null || value === '') return '';
    const match = items.find(item => String(item[valueKey]) === String(value));
    return match ? match[labelKey] : '';
  });

  function selectItem(item) {
    value = item[valueKey];
    isOpen = false;
    searchQuery = '';
    onchange(value);
  }

  // Click outside to close combobox handler
  function clickOutside(e) {
    if (isOpen && containerRef && !containerRef.contains(e.target)) {
      isOpen = false;
      searchQuery = '';
    }
  }

  onMount(() => {
    window.addEventListener('click', clickOutside);
    return () => window.removeEventListener('click', clickOutside);
  });
</script>

<div class="relative w-full" bind:this={containerRef}>
  <!-- Trigger Button -->
  <button
    type="button"
    onclick={() => isOpen = !isOpen}
    class="w-full px-3 py-2 rounded border border-[#767068]/30 bg-white text-xs text-left text-[#2A2521] focus:outline-none focus:border-[#3E6650] flex justify-between items-center transition-all cursor-pointer"
  >
    <span class={selectedDisplay ? 'text-[#2A2521]' : 'text-slate-400'}>
      {selectedDisplay || placeholder}
    </span>
    <ChevronDown size={14} class="text-[#767068] transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
  </button>

  <!-- Dropdown Panel -->
  {#if isOpen}
    <div class="absolute left-0 right-0 mt-1 bg-white border border-[#767068]/30 rounded shadow-xl z-50 animate-fade-in max-h-60 flex flex-col overflow-hidden">
      <!-- Search Input Header -->
      <div class="p-2 border-b border-[#767068]/15 bg-slate-50 flex items-center gap-1.5 sticky top-0">
        <Search size={12} class="text-[#767068]" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={searchPlaceholder}
          autocomplete="off"
          class="w-full bg-transparent border-none text-xs focus:outline-none text-[#2A2521]"
          onclick={(e) => e.stopPropagation()}
        />
      </div>

      <!-- Items List -->
      <div class="overflow-y-auto flex-1 font-mono text-[11px] no-scrollbar">
        {#if filteredItems.length > 0}
          {#each filteredItems as item}
            <button
              type="button"
              onclick={() => selectItem(item)}
              class="w-full px-3 py-2 text-left hover:bg-[#F6F2EA] flex items-center justify-between text-[#2A2521] border-b border-slate-50 transition-colors"
            >
              <span>{item[labelKey]}</span>
              {#if String(item[valueKey]) === String(value)}
                <Check size={11} class="text-[#3E6650] font-black" />
              {/if}
            </button>
          {/each}
        {:else}
          <div class="p-4 text-center text-slate-400 font-sans text-xs">
            No matching options found.
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
