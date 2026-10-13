<script lang="ts">
  import type { CalendarEntry } from '$lib/core/types';

  let {
    entry,
    slot,
    selected = false,
    onselect
  }: { entry: CalendarEntry; slot: number; selected?: boolean; onselect: (e: CalendarEntry) => void } = $props();

  const cls = $derived(entry.kind === 'moment' ? 'task-moment' : `task-${slot % 6}`);
</script>

<button
  type="button"
  class="chip {cls}"
  class:moment={entry.kind === 'moment'}
  class:selected
  aria-pressed={selected}
  onclick={() => onselect(entry)}
  title={entry.title}
>
  {#if entry.kind === 'content' && entry.taskCode}
    <span class="code">{entry.taskCode}</span>
  {/if}
  <span class="title">{entry.title}</span>
</button>

<style>
  .chip {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    text-align: left;
    border: 0;
    border-left: 3px solid var(--c-bar);
    background: var(--c-bg);
    color: var(--c-fg);
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 12.5px;
    line-height: 1.3;
    cursor: pointer;
  }
  .chip:hover {
    filter: brightness(0.97);
  }
  .chip.selected {
    outline: 2px solid var(--c-bar);
    outline-offset: 1px;
  }
  .moment {
    border-left-style: dashed;
    font-style: italic;
  }
  .code {
    font-weight: 700;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    flex: none;
  }
  .title {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
