<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import EntryDetails from '$lib/components/EntryDetails.svelte';
  import MonthGrid from '$lib/components/MonthGrid.svelte';
  import {
    EMPTY_FILTERS,
    filterEntries,
    initialMonth,
    isFiltered,
    monthLabel,
    presentValues,
    taskSlot,
    taxonomyOptions,
    type Filters
  } from '$lib/core/calendar-view';

  let { data } = $props();

  const today = new Date().toISOString().slice(0, 10);
  // Initial month from ?month=YYYY-MM, else today's month (or nearest). The effect below
  // keeps it valid when new data arrives.
  let month = $state(
    untrack(() => {
      const requested = page.url.searchParams.get('month');
      return requested && data.months.includes(requested) ? requested : initialMonth(data.months);
    })
  );
  let filters: Filters = $state({ ...EMPTY_FILTERS });
  let selectedId: string | null = $state(null);

  // Keep the month valid if a new dataset arrives without it.
  $effect(() => {
    if (!month || !data.months.includes(month)) month = initialMonth(data.months);
  });

  const index = $derived(month ? data.months.indexOf(month) : -1);
  const options = $derived(taxonomyOptions(data.framework, filters));
  const present = $derived(presentValues(data.entries));
  const monthEntries = $derived(data.entries.filter((e) => e.month === month));
  const visible = $derived(filterEntries(monthEntries, filters));
  const selected = $derived(data.entries.find((e) => e.id === selectedId) ?? null);
  const contentCount = $derived(visible.filter((e) => e.kind === 'content').length);
  const momentCount = $derived(visible.filter((e) => e.kind === 'moment').length);
  const perTask = $derived(
    data.framework.tasks.map((t) => ({ ...t, count: visible.filter((e) => e.taskCode === t.code).length }))
  );

  function go(step: number) {
    const next = data.months[index + step];
    if (!next) return;
    month = next;
    selectedId = null;
    const url = new URL(page.url);
    url.searchParams.set('month', next);
    replaceState(url, {});
  }

  function setTask(value: string) {
    filters.task = value;
    filters.pillar = '';
    filters.peg = '';
  }
  function setPillar(value: string) {
    filters.pillar = value;
    filters.peg = '';
  }
</script>

<svelte:head>
  <title>{month ? monthLabel(month) : 'Calendar'} · SM BAU calendar</title>
</svelte:head>

<main class="page">
  {#if !month}
    <div class="card empty">
      <h2>No months published yet</h2>
      <p>Upload the calendar workbook on the <a href="/data">Data</a> page.</p>
    </div>
  {:else}
    <section class="toolbar">
      <div class="month-nav">
        <button class="icon" type="button" aria-label="Previous month" disabled={index <= 0} onclick={() => go(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <p class="kicker">Content calendar</p>
          <h1>{monthLabel(month)}</h1>
        </div>
        <button class="icon" type="button" aria-label="Next month" disabled={index >= data.months.length - 1} onclick={() => go(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <ul class="counts" aria-label="This month">
        {#each perTask as t, i}
          <li class="task-{taskSlot(data.framework, t.code) % 6}">
            <button type="button" class:active={filters.task === t.code} onclick={() => setTask(filters.task === t.code ? '' : t.code)}>
              <span class="n">{t.count}</span>
              <span class="l">{t.name}</span>
            </button>
          </li>
        {/each}
        <li class="total"><span class="n">{contentCount}</span><span class="l">pieces · {momentCount} moments</span></li>
      </ul>
    </section>

    <section class="filters card" aria-label="Filters">
      <label class="search">
        <span class="sr-only">Search</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input type="search" placeholder="Search titles, details, people…" bind:value={filters.search} />
      </label>
      <label>
        <span>Comms task</span>
        <select value={filters.task} onchange={(e) => setTask(e.currentTarget.value)}>
          <option value="">All</option>
          {#each options.tasks as t}<option value={t.code}>{t.code} · {t.name}</option>{/each}
        </select>
      </label>
      <label>
        <span>Pillar</span>
        <select value={filters.pillar} onchange={(e) => setPillar(e.currentTarget.value)}>
          <option value="">All</option>
          {#each options.pillars as p}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <label>
        <span>Peg</span>
        <select bind:value={filters.peg}>
          <option value="">All</option>
          {#each options.pegs as p}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <label>
        <span>Platform</span>
        <select bind:value={filters.platform}>
          <option value="">All</option>
          {#each present.platforms as p}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select bind:value={filters.status}>
          <option value="">All</option>
          {#each present.statuses as s}<option value={s}>{s}</option>{/each}
        </select>
      </label>
      <button class="btn reset" type="button" disabled={!isFiltered(filters)} onclick={() => (filters = { ...EMPTY_FILTERS })}>Reset</button>
    </section>

    <div class="workspace" class:open={selected}>
      <section class="card calendar">
        <MonthGrid {month} entries={visible} framework={data.framework} {selectedId} {today} onselect={(e) => (selectedId = e.id)} />
        {#if isFiltered(filters) && visible.length === 0}
          <p class="no-match">No items match these filters. <button class="link" type="button" onclick={() => (filters = { ...EMPTY_FILTERS })}>Clear filters</button></p>
        {/if}
      </section>

      {#if selected}
        <button class="scrim" type="button" aria-label="Close details" onclick={() => (selectedId = null)}></button>
        <aside class="card panel" aria-label="Item details">
          <EntryDetails entry={selected} framework={data.framework} onclose={() => (selectedId = null)} />
        </aside>
      {/if}
    </div>
  {/if}
</main>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px 24px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .month-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h1 {
    font-size: 28px;
    line-height: 1.1;
  }
  .icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .icon svg,
  .search svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }
  .counts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .counts button,
  .counts .total {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    cursor: pointer;
  }
  .counts button {
    border-left: 4px solid var(--c-bar);
  }
  .counts button.active {
    background: var(--c-bg);
    color: var(--c-fg);
    border-color: var(--c-bar);
  }
  .counts .total {
    cursor: default;
    background: transparent;
    border-style: dashed;
  }
  .n {
    font-weight: 700;
    font-family: var(--font-display);
  }
  .l {
    font-size: 13px;
    color: var(--ink-2);
  }
  .counts button.active .l {
    color: inherit;
  }
  .filters {
    display: flex;
    gap: 10px 12px;
    align-items: flex-end;
    flex-wrap: wrap;
    padding: 12px;
    margin-bottom: 16px;
  }
  .filters label {
    display: grid;
    gap: 3px;
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 500;
  }
  .filters select,
  .filters input {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 7px 8px;
    font-size: 14px;
    max-width: 230px;
  }
  .search {
    position: relative;
    flex: 1 1 220px;
  }
  .search svg {
    position: absolute;
    left: 9px;
    bottom: 9px;
    color: var(--ink-3);
  }
  .search input {
    width: 100%;
    max-width: none;
    padding-left: 32px;
  }
  .reset {
    margin-left: auto;
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .workspace.open {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .calendar {
    overflow: hidden;
  }
  .panel {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow: auto;
  }
  .scrim {
    display: none;
  }
  .no-match {
    padding: 16px;
    margin: 0;
    color: var(--ink-2);
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }
  .empty {
    padding: 32px;
  }
  @media (max-width: 1100px) {
    .workspace.open {
      grid-template-columns: minmax(0, 1fr);
    }
    .scrim {
      display: block;
      position: fixed;
      inset: 0;
      background: rgb(10 15 12 / 0.45);
      border: 0;
      z-index: 10;
    }
    .panel {
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      max-height: 80vh;
      z-index: 11;
      border-radius: var(--radius) var(--radius) 0 0;
      box-shadow: var(--shadow-lg);
    }
  }
  @media (min-width: 700px) and (max-width: 1100px) {
    .panel {
      left: auto;
      top: 0;
      width: 400px;
      max-height: none;
      border-radius: 0;
    }
  }
  @media (max-width: 640px) {
    h1 {
      font-size: 22px;
    }
    .filters label:not(.search) {
      flex: 1 1 140px;
    }
    .filters select {
      max-width: none;
      width: 100%;
    }
  }
</style>
