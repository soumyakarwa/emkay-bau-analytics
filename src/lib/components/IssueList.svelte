<script lang="ts">
  import type { Issue } from '$lib/core/types';

  let { issues }: { issues: Issue[] } = $props();

  // Group by sheet, workbook-level issues first; errors before warnings within each group.
  const groups = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const i of issues) {
      const key = i.sheet ?? 'Workbook';
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Workbook' ? -1 : b === 'Workbook' ? 1 : 0))
      .map(([sheet, list]) => ({
        sheet,
        list: [...list].sort((a, b) => (a.level === b.level ? (a.row ?? 0) - (b.row ?? 0) : a.level === 'error' ? -1 : 1))
      }));
  });

  const where = (i: Issue) => [i.row ? `Row ${i.row}` : null, i.column ? `column ${i.column}` : null].filter(Boolean).join(', ');
</script>

{#each groups as group}
  <section class="group">
    <h3>{group.sheet} <span>{group.list.length}</span></h3>
    <ul>
      {#each group.list as issue}
        <li class={issue.level}>
          <span class="badge">{issue.level === 'error' ? 'Error' : 'Warning'}</span>
          {#if where(issue)}<span class="where">{where(issue)}</span>{/if}
          <span class="msg">{issue.message}</span>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .group + .group {
    margin-top: 16px;
  }
  h3 {
    font-size: 14px;
    margin-bottom: 6px;
  }
  h3 span {
    font-weight: 500;
    color: var(--ink-3);
    font-size: 12px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  li {
    display: grid;
    grid-template-columns: 72px 130px 1fr;
    gap: 10px;
    padding: 8px 12px;
    font-size: 14px;
    align-items: baseline;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .error .badge {
    color: var(--danger);
  }
  .warning .badge {
    color: var(--warn);
  }
  .error {
    background: var(--danger-bg);
  }
  .where {
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  li:not(:has(.where)) .msg {
    grid-column: 2 / -1;
  }
  @media (max-width: 640px) {
    li {
      grid-template-columns: auto 1fr;
    }
    .msg,
    li:not(:has(.where)) .msg {
      grid-column: 1 / -1;
    }
  }
</style>
