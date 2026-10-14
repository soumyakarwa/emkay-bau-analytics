<script lang="ts">
  import PostDetails from '$lib/calendar/PostDetails.svelte';
  import { shiftMonth, type CalendarPost } from '$lib/calendar/calendar';

  let { data } = $props();
  let selected: CalendarPost | null = $state(null);

  const cal = $derived(data.cal);
  const monthName = $derived(
    new Date(`${cal.month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  );
  const postsOn = (day: string) => cal.posts.filter((p) => p.date === day);
  const momentsOn = (day: string) => cal.moments.filter((m) => m.date === day);
  const activeDays = $derived(
    [...new Set([...cal.posts.map((p) => p.date), ...cal.moments.map((m) => m.date)])].sort()
  );

  function href(changes: { brand?: string; month?: string; dropped?: boolean }) {
    const brand = changes.brand ?? cal.view;
    const month = changes.month ?? cal.month;
    const dropped = changes.dropped ?? data.showDropped;
    const q = new URLSearchParams();
    if (brand !== 'all') q.set('brand', brand);
    q.set('month', month);
    if (dropped) q.set('dropped', '1');
    return `?${q}`;
  }

  const PLATFORM_ABBR: Record<string, string> = { LinkedIn: 'in', Instagram: 'IG', YouTube: 'YT', X: 'X', WhatsApp: 'WA' };
  const STAGE: Record<string, { key: string; label: string }> = {
    published: { key: 'published', label: 'Published' },
    working: { key: 'working', label: 'In progress' },
    planned: { key: 'planned', label: 'Planned' },
    dropped: { key: 'dropped', label: 'Dropped' }
  };
  function stage(p: CalendarPost) {
    const s = (p.status ?? '').toLowerCase();
    if (s === 'published') return STAGE.published;
    if (s === 'dropped') return STAGE.dropped;
    if (s.includes('progress') || s.startsWith('ready')) return STAGE.working;
    return STAGE.planned;
  }
  const dayNumber = (iso: string) => Number(iso.slice(8));
  const weekday = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const isWeekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
</script>

<svelte:head>
  <title>Emkay BAU calendar</title>
</svelte:head>

{#snippet chip(p: CalendarPost)}
  {@const st = stage(p)}
  <button class="chip" class:dropped={st === STAGE.dropped} style="--c: var(--{p.colour})" onclick={() => (selected = p)}>
    <span class="chip-title" class:untitled={!p.title}>
      <span class="stage {st.key}" title={p.status ?? st.label}></span><span class="visually-hidden">{p.status ?? st.label}: </span>
      {p.title ?? 'No title yet'}
    </span>
    <span class="chip-label">{p.label}</span>
    {#if p.platforms.length || p.problems.length}
      <span class="chip-foot">
        {#each p.platforms as pl}
          <span class="pf" class:live={pl.state !== 'planned'} title="{pl.platform}: {pl.state === 'planned' ? 'planned' : pl.state === 'sent' ? 'sent' : 'live'}"
            >{PLATFORM_ABBR[pl.platform]}</span
          >
        {/each}
        {#if p.problems.length}
          <span class="warn" title="{p.problems.length} to fix in the workbook">!<span class="visually-hidden"> {p.problems.length} problems to fix</span></span>
        {/if}
      </span>
    {/if}
  </button>
{/snippet}

<div class="page">
  <header class="top">
    <h1>Emkay BAU calendar</h1>
    <nav class="brands" aria-label="Brand">
      <a href={href({ brand: 'all' })} aria-current={cal.view === 'all' ? 'page' : undefined}>All of Emkay</a>
      {#each data.brands as b}
        <a href={href({ brand: b.id })} aria-current={cal.view === b.id ? 'page' : undefined} title={b.name}>{b.short}</a>
      {/each}
    </nav>
  </header>

  {#if !data.published}
    <section class="empty">
      <h2>Nothing published yet</h2>
      <p>Publish the brands' calendar workbooks from the <code>web</code> folder, then reload this page:</p>
      <pre><code>npm run publish-workbook -- "Emkay IM - Content calendar FY27.xlsx"</code></pre>
    </section>
  {:else}
    <div class="bar">
      <div class="month-nav">
        <a class="icon" href={href({ month: shiftMonth(cal.month, -1) })} aria-label="Previous month">‹</a>
        <h2>{monthName}</h2>
        <a class="icon" href={href({ month: shiftMonth(cal.month, 1) })} aria-label="Next month">›</a>
        {#if cal.month !== data.today.slice(0, 7)}<a class="today-link" href={href({ month: data.today.slice(0, 7) })}>Today</a>{/if}
      </div>
      <ul class="legend" aria-label="Colours">
        {#each cal.legend as l}
          <li><span class="swatch" style="background: var(--{l.colour})"></span>{l.label}</li>
        {/each}
      </ul>
    </div>

    <p class="key">
      <span><span class="stage published"></span> published</span><span><span class="stage working"></span> in progress</span><span><span class="stage planned"></span> planned</span>
      <span><span class="pf live">in</span> live <span class="pf">in</span> planned</span>
      <span><span class="warn">!</span> to fix in the workbook</span>
      {#if cal.hiddenDropped}
        <a href={href({ dropped: true })}>Show {cal.hiddenDropped} dropped</a>
      {:else if data.showDropped}
        <a href={href({ dropped: false })}>Hide dropped</a>
      {/if}
    </p>

    <div class="grid" role="grid" aria-label={monthName}>
      <div class="row head" role="row">
        {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d}<div role="columnheader">{d}</div>{/each}
      </div>
      {#each data.weeks as week}
        <div class="row" role="row">
          {#each week as day}
            {#if day}
              <div class="day" class:weekend={isWeekend(day)} class:today={day === data.today} role="gridcell">
                <span class="num">{dayNumber(day)}</span>
                {#each momentsOn(day) as m}<span class="moment">★ {m.text}</span>{/each}
                {#each postsOn(day) as p (p.key)}{@render chip(p)}{/each}
              </div>
            {:else}
              <div class="day blank" role="gridcell"></div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>

    <ol class="agenda" aria-label={monthName}>
      {#each activeDays as day}
        <li class:today={day === data.today}>
          <h3>{weekday(day)}</h3>
          {#each momentsOn(day) as m}<span class="moment">★ {m.text}</span>{/each}
          {#each postsOn(day) as p (p.key)}{@render chip(p)}{/each}
        </li>
      {:else}
        <li class="muted">No posts this month.</li>
      {/each}
    </ol>
  {/if}
</div>

<PostDetails post={selected} onclose={() => (selected = null)} />

<style>
  .page { max-width: 1400px; margin: 0 auto; padding: 16px; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; }
  .brands { display: flex; gap: 2px; padding: 3px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
  .brands a { padding: 6px 12px; border-radius: 7px; color: var(--text-secondary); text-decoration: none; font-weight: 500; }
  .brands a:hover { background: var(--weekend); }
  .brands a[aria-current='page'] { background: var(--text-primary); color: var(--surface-1); }

  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; margin-bottom: 8px; }
  .month-nav { display: flex; align-items: center; gap: 8px; }
  .month-nav h2 { margin: 0; font-size: 18px; min-width: 150px; text-align: center; }
  .icon {
    display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text-primary);
    text-decoration: none; font-size: 18px;
  }
  .today-link { margin-left: 4px; font-weight: 500; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; list-style: none; margin: 0; padding: 0; color: var(--text-secondary); }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .key { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 12px; color: var(--text-muted); font-size: 12px; }

  .grid { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--border); display: grid; gap: 1px; }
  .row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 1px; }
  .head div { background: var(--surface-1); padding: 6px 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .day { background: var(--surface-2); min-height: 112px; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .day.weekend { background: var(--weekend); }
  .day.blank { background: var(--surface-1); }
  .num { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .today .num {
    background: var(--today); color: #fff; border-radius: 999px; width: 22px; height: 22px;
    display: grid; place-items: center;
  }
  .moment { font-size: 11px; color: var(--text-secondary); font-style: italic; overflow-wrap: anywhere; }

  .chip {
    display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; cursor: pointer;
    padding: 5px 6px 5px 9px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--surface-1); box-shadow: inset 4px 0 0 var(--c);
  }
  .chip:hover { border-color: var(--c); }
  .chip.dropped .chip-title { text-decoration: line-through; color: var(--text-muted); }
  .chip-title { font-size: 12px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
  .stage {
    display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 3px; vertical-align: 0;
    border: 1.5px solid var(--c, var(--text-muted));
  }
  .stage.published { background: var(--c, var(--text-muted)); }
  .stage.working { background: linear-gradient(90deg, var(--c, var(--text-muted)) 50%, transparent 50%); }
  .stage.dropped { border-style: dashed; }
  .chip-title.untitled { font-style: italic; font-weight: 500; color: var(--text-muted); }
  .chip-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip-foot { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; margin-top: 2px; }
  .pf {
    font-size: 10px; line-height: 16px; padding: 0 4px; border-radius: 4px;
    border: 1px solid var(--border); color: var(--text-muted);
  }
  .pf.live { background: var(--text-secondary); border-color: var(--text-secondary); color: var(--surface-1); }
  .warn {
    display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%;
    background: var(--warning); color: #3d2a00; font-size: 11px; font-weight: 700;
  }

  .agenda { display: none; list-style: none; margin: 0; padding: 0; }
  .agenda li { padding: 10px 0; border-bottom: 1px solid var(--border); display: grid; gap: 6px; }
  .agenda h3 { margin: 0; font-size: 13px; color: var(--text-secondary); }
  .agenda li.today h3 { color: var(--today); }

  .empty { max-width: 640px; margin: 48px auto; padding: 24px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
  .empty h2 { margin-top: 0; }
  pre { overflow-x: auto; background: var(--weekend); padding: 10px 12px; border-radius: 6px; }
  .muted { color: var(--text-muted); }

  @media (max-width: 760px) {
    .grid { display: none; }
    .agenda { display: block; }
    .month-nav h2 { min-width: 0; }
  }
</style>
