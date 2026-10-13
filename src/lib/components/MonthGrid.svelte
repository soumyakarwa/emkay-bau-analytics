<script lang="ts">
  import { formatLongDate, monthWeeks, taskSlot } from '$lib/core/calendar-view';
  import type { CalendarEntry, Framework } from '$lib/core/types';
  import EntryChip from './EntryChip.svelte';

  let {
    month,
    entries,
    framework,
    selectedId,
    today,
    onselect
  }: {
    month: string;
    entries: CalendarEntry[];
    framework: Framework;
    selectedId: string | null;
    today: string;
    onselect: (e: CalendarEntry) => void;
  } = $props();

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeks = $derived(monthWeeks(month));
  const byDate = $derived.by(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  });
  const agendaDays = $derived([...byDate.keys()].sort());
</script>

<!-- Grid for wider screens -->
<div class="grid" role="table" aria-label="Calendar">
  <div class="head" role="row">
    {#each WEEKDAYS as d}
      <div role="columnheader">{d}</div>
    {/each}
  </div>
  {#each weeks as week}
    <div class="week" role="row">
      {#each week as date}
        <div class="day" class:blank={!date} class:today={date === today} role="cell">
          {#if date}
            <span class="num" aria-label={formatLongDate(date)}>{Number(date.slice(8))}</span>
            <div class="items">
              {#each byDate.get(date) ?? [] as entry (entry.id)}
                <EntryChip {entry} slot={taskSlot(framework, entry.taskCode)} selected={entry.id === selectedId} {onselect} />
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<!-- Agenda list for phones -->
<ol class="agenda">
  {#each agendaDays as date}
    <li>
      <h3 class:today={date === today}>{formatLongDate(date)}</h3>
      <div class="items">
        {#each byDate.get(date) ?? [] as entry (entry.id)}
          <EntryChip {entry} slot={taskSlot(framework, entry.taskCode)} selected={entry.id === selectedId} {onselect} />
        {/each}
      </div>
    </li>
  {:else}
    <li class="none">Nothing this month.</li>
  {/each}
</ol>

<style>
  .grid {
    display: grid;
    border-top: 1px solid var(--line);
  }
  .head,
  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .head div {
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--line);
  }
  .day {
    min-height: 118px;
    padding: 6px;
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .week .day:last-child {
    border-right: 0;
  }
  .day.blank {
    background: var(--surface-2);
  }
  .num {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink-3);
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .today .num {
    background: var(--today);
    color: #2a1d06;
  }
  .items {
    display: grid;
    gap: 4px;
  }
  .agenda {
    display: none;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .agenda li {
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }
  .agenda h3 {
    font-size: 13px;
    color: var(--ink-2);
    margin-bottom: 8px;
    font-family: var(--font-sans);
    font-weight: 600;
  }
  .agenda h3.today::after {
    content: ' · Today';
    color: var(--warn);
  }
  .none {
    color: var(--ink-3);
  }
  @media (max-width: 760px) {
    .grid {
      display: none;
    }
    .agenda {
      display: block;
    }
  }
</style>
