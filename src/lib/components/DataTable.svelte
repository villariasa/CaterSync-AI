<script>
  import { ChevronLeft, ChevronRight, ArrowUpDown } from '@lucide/svelte';

  let { 
    rows = [], 
    columns = [], 
    rowKey = 'id', 
    emptyMessage = 'No records found', 
    loading = false,
    searchableKeys = []
  } = $props();

  // Pagination states
  let pageSize = $state(10);
  let currentPage = $state(1);
  let searchQuery = $state('');

  // Sorting states
  let sortKey = $state('');
  let sortDirection = $state('asc'); // 'asc' or 'desc'

  function handleSort(key) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  // Derived filtered & sorted rows
  let processedRows = $derived.by(() => {
    let result = [...rows];

    // Apply Search
    if (searchQuery.trim() && searchableKeys.length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(row => {
        return searchableKeys.some(key => {
          const val = row[key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
      });
    }

    // Apply Sort
    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle string comparison safely
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }

        // Handle numerical/general comparison
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  });

  // Derived pagination totals
  let totalPages = $derived(Math.max(1, Math.ceil(processedRows.length / pageSize)));
  
  // Auto reset page if filters drop matching size
  $effect(() => {
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
  });

  let pagedRows = $derived(
    processedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );

  let startItemIndex = $derived((currentPage - 1) * pageSize + 1);
  let endItemIndex = $derived(Math.min(currentPage * pageSize, processedRows.length));
</script>

<div class="space-y-4">
  <!-- Top bar search & size selection -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    {#if searchableKeys.length > 0}
      <div class="relative max-w-sm w-full">
        <input 
          type="text" 
          bind:value={searchQuery} 
          placeholder="Search records..." 
          class="w-full pl-3 pr-3 py-1.5 text-xs rounded border border-[#767068]/30 bg-white text-[#2A2521] focus:outline-none focus:border-[#3E6650]" 
        />
      </div>
    {:else}
      <div></div>
    {/if}

    <div class="flex items-center gap-2 text-xs font-mono text-[#767068]">
      <span>Show</span>
      <select bind:value={pageSize} class="px-2 py-1 bg-white border border-[#767068]/30 rounded text-xs text-[#2A2521] focus:outline-none focus:border-[#3E6650]">
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
      <span>rows</span>
    </div>
  </div>

  <!-- Main Table wrapper -->
  <div class="overflow-x-auto border border-[#767068]/20 rounded">
    <table class="w-full text-left border-collapse ledger-table text-xs">
      <thead>
        <tr class="bg-[#F6F2EA] text-[#767068]">
          {#each columns as col}
            <th class="sticky top-0 z-10 bg-[#F6F2EA] py-2.5 px-4 font-bold select-none border-b border-[#767068]/20 {col.align === 'right' ? 'text-right' : 'text-left'}">
              {#if col.sortable}
                <button 
                  type="button" 
                  onclick={() => handleSort(col.key)} 
                  class="flex items-center gap-1.5 hover:text-[#2A2521] focus:outline-none w-full justify-start {col.align === 'right' ? 'justify-end' : ''}"
                >
                  <span>{col.label}</span>
                  <ArrowUpDown size={12} class="text-[#767068]/60" />
                </button>
              {:else}
                <span>{col.label}</span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      
      <tbody class="divide-y divide-[#767068]/15 font-mono text-[11px]">
        {#if loading}
          {#each Array(pageSize) as _}
            <tr class="skeleton-shimmer">
              {#each columns as col}
                <td class="py-3 px-4">
                  <div class="h-3.5 bg-[#767068]/15 rounded w-3/4"></div>
                </td>
              {/each}
            </tr>
          {/each}
        {:else if pagedRows.length > 0}
          {#each pagedRows as row (row[rowKey] || Math.random())}
            <tr class="hover:bg-[#F6F2EA]/40 transition-colors">
              {#each columns as col}
                <td class="py-2.5 px-4 {col.align === 'right' ? 'text-right' : 'text-left'}">
                  {#if col.render}
                    {#if col.isSnippet}
                      {@render col.render(row)}
                    {:else}
                      {@html col.render(row)}
                    {/if}
                  {:else}
                    <span class={col.isSans ? 'font-sans text-[#2A2521]' : 'text-[#2A2521]'}>
                      {row[col.key] ?? '—'}
                    </span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan={columns.length} class="py-8 text-center text-[#767068] font-sans">
              {emptyMessage}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Bottom pagination control panel -->
  {#if processedRows.length > 0 && !loading}
    <div class="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#767068] pt-2">
      <div>
        Showing <span class="font-bold text-[#2A2521]">{startItemIndex}</span> to 
        <span class="font-bold text-[#2A2521]">{endItemIndex}</span> of 
        <span class="font-bold text-[#2A2521]">{processedRows.length}</span> rows
      </div>

      <div class="flex items-center gap-1">
        <button 
          type="button" 
          disabled={currentPage === 1} 
          onclick={() => currentPage = Math.max(1, currentPage - 1)}
          class="p-1 border border-[#767068]/30 rounded hover:bg-[#2A2521]/5 hover:text-[#2A2521] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        
        <span class="px-3">Page {currentPage} of {totalPages}</span>

        <button 
          type="button" 
          disabled={currentPage === totalPages} 
          onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
          class="p-1 border border-[#767068]/30 rounded hover:bg-[#2A2521]/5 hover:text-[#2A2521] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  {/if}
</div>
