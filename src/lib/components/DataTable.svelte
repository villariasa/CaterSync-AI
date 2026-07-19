<script>
  import { ChevronLeft, ChevronRight, ArrowUpDown, Inbox } from '@lucide/svelte';

  import { onMount } from 'svelte';

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

  onMount(() => {
    if (typeof window !== 'undefined') {
      const pendingSearch = localStorage.getItem('catersync_global_search_redirect');
      if (pendingSearch) {
        searchQuery = pendingSearch;
        localStorage.removeItem('catersync_global_search_redirect');
      }
    }
  });

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
          class="w-full pl-3 pr-3 py-1.5 text-xs rounded border border-[#767068]/30 bg-white text-[#2A2521] placeholder:text-[#767068]/70 focus:outline-none focus:border-[#3E6650] dark:bg-[#1A1715] dark:text-[#ECE7DF] dark:placeholder:text-[#9E978F] dark:border-[#9E978F]/35" 
        />
      </div>
    {:else}
      <div></div>
    {/if}

    <div class="flex items-center gap-2 text-xs font-mono text-[#767068] dark:text-[#9E978F]">
      <span>Show</span>
      <select bind:value={pageSize} class="px-2 py-1 bg-white border border-[#767068]/30 rounded text-xs text-[#2A2521] focus:outline-none focus:border-[#3E6650] dark:bg-[#1A1715] dark:text-[#ECE7DF] dark:border-[#9E978F]/35">
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
      <span>rows</span>
    </div>
  </div>

  <!-- Main Table wrapper -->
  <div class="overflow-x-auto border border-[#767068]/20 rounded dark:border-[#9E978F]/25">
    <table class="w-full text-left border-collapse ledger-table text-xs dark:text-[#ECE7DF]">
      <thead>
        <tr class="bg-[#F6F2EA] text-[#767068] dark:bg-[#332E2A] dark:text-[#ECE7DF]">
          {#each columns as col}
            <th class="sticky top-0 z-10 bg-[#F6F2EA] py-2.5 px-4 font-bold select-none border-b border-[#767068]/20 text-[#767068] dark:bg-[#332E2A] dark:text-[#ECE7DF] dark:border-[#9E978F]/35 {col.align === 'right' ? 'text-right' : 'text-left'}">
              {#if col.sortable}
                <button 
                  type="button" 
                  onclick={() => handleSort(col.key)} 
                  class="flex items-center gap-1.5 text-inherit hover:text-[#2A2521] focus:outline-none w-full justify-start dark:hover:text-white {col.align === 'right' ? 'justify-end' : ''}"
                >
                  <span>{col.label}</span>
                  <ArrowUpDown size={12} class="text-[#767068]/60 dark:text-[#ECE7DF]/70" />
                </button>
              {:else}
                <span>{col.label}</span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      
      <tbody class="divide-y divide-[#767068]/15 font-mono text-[11px] dark:divide-[#9E978F]/18">
        {#if loading}
          {#each Array(pageSize) as _}
            <tr class="skeleton-shimmer">
              {#each columns as col}
                <td class="py-3 px-4">
                  <div class="h-3.5 bg-[#767068]/15 rounded w-3/4 dark:bg-[#9E978F]/20"></div>
                </td>
              {/each}
            </tr>
          {/each}
        {:else if pagedRows.length > 0}
          {#each pagedRows as row (row[rowKey] || Math.random())}
            <tr class="hover:bg-[#F6F2EA]/40 transition-colors dark:hover:bg-[#332E2A]/65">
              {#each columns as col}
                <td class="py-2.5 px-4 {col.align === 'right' ? 'text-right' : 'text-left'}">
                  {#if col.render}
                    {#if col.isSnippet}
                      {@render col.render(row)}
                    {:else}
                      {@html col.render(row)}
                    {/if}
                  {:else}
                    <span class={col.isSans ? 'font-sans text-[#2A2521] dark:text-[#ECE7DF]' : 'text-[#2A2521] dark:text-[#ECE7DF]'}>
                      {row[col.key] ?? '—'}
                    </span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan={columns.length} class="py-14 px-4 text-center">
              <div class="flex flex-col items-center gap-3 max-w-sm mx-auto">
                <div class="w-12 h-12 rounded-full bg-[#F6F2EA] dark:bg-[#332E2A] flex items-center justify-center border-2 border-dashed border-[#767068]/30 dark:border-[#9E978F]/30">
                  <Inbox size={20} class="text-[#767068]/60 dark:text-[#9E978F]/60" />
                </div>
                <p class="text-xs font-mono text-[#767068] dark:text-[#9E978F] leading-relaxed text-center">
                  {emptyMessage}
                </p>
              </div>
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Bottom pagination control panel -->
  {#if processedRows.length > 0 && !loading}
    <div class="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#767068] dark:text-[#9E978F] pt-2">
      <div>
        Showing <span class="font-bold text-[#2A2521] dark:text-[#ECE7DF]">{startItemIndex}</span> to 
        <span class="font-bold text-[#2A2521] dark:text-[#ECE7DF]">{endItemIndex}</span> of 
        <span class="font-bold text-[#2A2521] dark:text-[#ECE7DF]">{processedRows.length}</span> rows
      </div>

      <div class="flex items-center gap-1">
        <button 
          type="button" 
          disabled={currentPage === 1} 
          onclick={() => currentPage = Math.max(1, currentPage - 1)}
          class="p-1 border border-[#767068]/30 rounded hover:bg-[#2A2521]/5 hover:text-[#2A2521] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all dark:border-[#9E978F]/30 dark:hover:bg-[#332E2A] dark:hover:text-[#ECE7DF]"
        >
          <ChevronLeft size={14} />
        </button>
        
        <span class="px-3">Page {currentPage} of {totalPages}</span>

        <button 
          type="button" 
          disabled={currentPage === totalPages} 
          onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
          class="p-1 border border-[#767068]/30 rounded hover:bg-[#2A2521]/5 hover:text-[#2A2521] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all dark:border-[#9E978F]/30 dark:hover:bg-[#332E2A] dark:hover:text-[#ECE7DF]"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  {/if}
</div>
