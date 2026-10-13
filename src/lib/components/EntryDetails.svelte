<script lang="ts">
  import { formatLongDate, taskSlot } from '$lib/core/calendar-view';
  import type { CalendarEntry, Framework } from '$lib/core/types';

  let {
    entry,
    framework,
    onclose
  }: { entry: CalendarEntry; framework: Framework; onclose: () => void } = $props();

  const taskName = $derived(framework.tasks.find((t) => t.code === entry.taskCode)?.name ?? null);
  const slot = $derived(entry.kind === 'moment' ? 'task-moment' : `task-${taskSlot(framework, entry.taskCode) % 6}`);

  const facts = $derived(
    [
      ['Comms task', taskName ? `${taskName} (${entry.taskCode})` : entry.taskCode],
      ['Pillar', entry.pillar],
      ['Peg', entry.peg],
      ['Format', entry.format],
      ['Status', entry.status],
      ['POC', entry.poc],
      ['Moment marketing', entry.kind === 'content' ? entry.moment : null]
    ].filter((f): f is [string, string] => Boolean(f[1]))
  );

  let closeButton: HTMLButtonElement | undefined = $state();
  $effect(() => {
    entry; // refocus when the selection changes
    closeButton?.focus();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="details {slot}">
  <div class="top">
    <p class="kicker">{entry.kind === 'moment' ? 'Moment marketing' : formatLongDate(entry.date)}</p>
    <button bind:this={closeButton} class="close" type="button" aria-label="Close details" onclick={onclose}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </div>
  <h2>{entry.title}</h2>
  {#if entry.kind === 'moment'}
    <p class="muted">{formatLongDate(entry.date)}</p>
  {/if}

  {#if facts.length}
    <dl>
      {#each facts as [label, value]}
        <dt>{label}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
  {/if}

  {#if entry.details}
    <h3>Details</h3>
    <p class="text">{entry.details}</p>
  {/if}

  {#if entry.platforms.length}
    <h3>Platforms</h3>
    <ul class="platforms">
      {#each entry.platforms as p}
        <li>
          {#if p.url}
            <a href={p.url} target="_blank" rel="noopener noreferrer">{p.platform} <span aria-hidden="true">↗</span></a>
          {:else}
            <span>{p.platform}</span> <span class="muted">· no link yet</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if entry.links.length}
    <h3>Documents</h3>
    <ul class="platforms">
      {#each entry.links as l}
        <li>
          <span class="muted">{l.label}:</span>
          {#if l.url}
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.text} <span aria-hidden="true">↗</span></a>
          {:else}
            {l.text}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <p class="source">From <strong>{entry.source.sheet}</strong>, row {entry.source.row}</p>
</div>

<style>
  .details {
    padding: 20px;
    border-top: 4px solid var(--c-bar);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .close {
    border: 0;
    background: transparent;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--ink-2);
  }
  .close:hover {
    background: var(--surface-2);
  }
  .close svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }
  h2 {
    font-size: 20px;
    line-height: 1.25;
    margin: 4px 0 12px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
    margin: 18px 0 6px;
    font-family: var(--font-sans);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 14px;
    margin: 0;
    font-size: 14px;
  }
  dt {
    color: var(--ink-3);
  }
  dd {
    margin: 0;
  }
  .text {
    margin: 0;
    white-space: pre-line;
  }
  .platforms {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .muted {
    color: var(--ink-3);
  }
  .source {
    margin: 24px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--ink-3);
  }
</style>
