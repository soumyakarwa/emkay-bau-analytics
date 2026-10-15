<script lang="ts">
  import { page } from '$app/state';
  import { brandById } from '$lib/brands';
  import { GROUPINGS, GROUP_LABELS, METRICS, SETTLE_DAYS, type AnalysedPost, type Figure } from '$lib/analytics/analysis';

  let { data } = $props();

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;
  const longMonth = (k: string) =>
    new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const brandName = (id: string) => brandById(id)?.name ?? id;

  const metric = $derived(METRICS.find((m) => m.id === data.metric)!);
  const fmt = (n: number | null, percent = metric.percent) =>
    n === null ? '–' : percent ? `${(n * 100).toFixed(1)}%` : Math.round(n).toLocaleString('en-IN');
  const count = (n: number | null) => (n === null ? '–' : Math.round(n).toLocaleString('en-IN'));
  /** Fewer posts than this behind a median: shown, but marked as a thin sample. */
  const FEW = 3;

  const lastMonth = $derived(data.table.months.at(-1));
  const partial = $derived(data.asOf !== null && lastMonth !== undefined && data.asOf.slice(0, 7) === lastMonth);

  /** The current address with some parameters changed. */
  function withParams(changes: Record<string, string | null>) {
    const q = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return `${page.url.pathname}${s ? `?${s}` : ''}`;
  }

  const fixes = $derived(data.brand ? data.fixes.filter((f) => f.brand === data.brand) : data.fixes);
  const PROBLEM_LABEL = { 'not-linkedin': 'Wrong link', 'not-found': 'Link not in the export', missing: 'Link missing' };

  function where(p: AnalysedPost): string {
    if (!p.calendar) return GROUP_LABELS[p.group];
    if (p.group !== 'bau') return `${GROUP_LABELS[p.group]}${p.calendar.peg ? ` · ${p.calendar.peg}` : ''}`;
    return `${p.calendar.commsTaskName ?? p.calendar.commsTask} · ${p.calendar.pillar} · ${p.calendar.peg}`;
  }
  const cellTitle = (f: Figure) => `${f.n} ${f.n === 1 ? 'post' : 'posts'}${f.n > 0 && f.n < FEW ? ': too few to read much into' : ''}`;
</script>

<svelte:head>
  <title>Analytics · Emkay BAU</title>
</svelte:head>

<div class="page">
  <h1>LinkedIn analytics{data.brand ? ` · ${brandName(data.brand)}` : ' · All of Emkay'}</h1>

  {#if !data.hasContent}
    <p class="banner neutral">
      No LinkedIn content export uploaded{data.brand ? ` for ${brandName(data.brand)}` : ''} yet.
      On LinkedIn, open the page's admin view, then Analytics → Content → Export, and upload the file on the
      <a href="/upload{data.brand ? `?brand=${data.brand}` : ''}">Upload page</a>.
    </p>
  {:else}
    <p class="lede">
      Figures as of {day(data.asOf!)}, from the latest export. Each cell is the median per post, for organic posts
      at least {SETTLE_DAYS} days old on the export day. Sponsored posts and newer posts are listed below but not counted.
      {#if !data.hasCalendar}<strong>No calendar workbook is uploaded, so nothing can be matched to the framework yet.</strong>{/if}
    </p>

    <div class="filters">
      {#if data.brand}
        <nav class="seg" aria-label="Compare by">
          {#each GROUPINGS as g}
            <a href={withParams({ by: g.id === 'commsTask' ? null : g.id })} aria-current={data.by === g.id ? 'true' : undefined}>{g.label}</a>
          {/each}
        </nav>
      {/if}
      <nav class="seg" aria-label="Measure">
        {#each METRICS as m}
          <a href={withParams({ metric: m.id === 'interactionRate' ? null : m.id })} aria-current={data.metric === m.id ? 'true' : undefined}>{m.label}</a>
        {/each}
      </nav>
    </div>
    <p class="help">{metric.label}: {metric.help}</p>

    <div class="table-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th class="label">{data.brand ? GROUPINGS.find((g) => g.id === data.by)?.label : 'Brand'}</th>
            {#each data.table.months as m}
              <th class="num">
                <a href={withParams({ month: m })} aria-current={m === data.month ? 'true' : undefined}>{monthLabel(m)}</a>
                {#if partial && m === lastMonth}<span class="sub">to date</span>{/if}
              </th>
            {/each}
            <th class="num all">All months</th>
          </tr>
        </thead>
        <tbody>
          {#each data.table.rows as r, i}
            <tr class:total={r.kind === 'total'} class:first-total={r.kind === 'total' && data.table.rows[i - 1]?.kind !== 'total'}>
              <th class="label" scope="row">
                {r.label}
                {#if r.context}<span class="sub">{r.context}</span>{/if}
              </th>
              {#each data.table.months as m}
                {@const f = r.byMonth[m]}
                <td class="num" class:few={f.n > 0 && f.n < FEW} title={cellTitle(f)}>
                  {#if f.n}{fmt(f.median)}<span class="n">{f.n}</span>{:else}<span class="none">–</span>{/if}
                </td>
              {/each}
              <td class="num all" class:few={r.all.n > 0 && r.all.n < FEW} title={cellTitle(r.all)}>
                {#if r.all.n}{fmt(r.all.median)}<span class="n">{r.all.n}</span>{:else}<span class="none">–</span>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="note">
      Small grey numbers are how many posts are behind each median; faded cells have fewer than {FEW}, too few to read much into.
      {#if data.brand}
        Framework rows count BAU posts only, matched to the calendar by the link in the LinkedIn column. Outside BAU: on LinkedIn but not in the calendar.
      {:else}
        Each brand keeps its own framework, so All of Emkay compares brands overall. Pick a brand to compare comms tasks, pillars, pegs and formats.
      {/if}
    </p>

    {#if fixes.length}
      <section>
        <h2>Links to fix in the workbook <span class="count">{fixes.length}</span></h2>
        <p class="note">Until these are fixed, these posts' figures cannot be matched to their pegs.</p>
        <ul class="fixes">
          {#each fixes as f}
            <li>
              <div class="fix-head">
                <span class="tag">{PROBLEM_LABEL[f.problem]}</span>
                <strong>{f.post.title ?? 'No title'}</strong>
                <span class="muted">{data.brand ? '' : `${brandName(f.brand)} · `}{day(f.post.date)} · {f.post.sheet}, row {f.post.row}</span>
              </div>
              <p>{f.message}</p>
              {#if f.candidates.length}
                <p class="muted">{f.candidates.length === 1 ? 'Probably this LinkedIn post:' : 'Possibly one of these LinkedIn posts:'}</p>
                <ul class="candidates">
                  {#each f.candidates as c}
                    <li><a href={c.link} target="_blank" rel="noopener noreferrer">{day(c.created)}: {c.title || 'No text'}</a></li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if data.month}
      <section>
        <h2>Posts in {longMonth(data.month)} <span class="count">{data.posts.length}</span></h2>
        <p class="note">Pick a month in the table header to see its posts. LinkedIn dates are in UTC, so a late-night post can show the day before.</p>
        {#if data.posts.length}
          <div class="table-wrap">
            <table class="posts">
              <thead>
                <tr>
                  <th>Date</th>{#if !data.brand}<th>Brand</th>{/if}<th>Post</th><th>Format</th>
                  <th class="num">Impressions</th><th class="num">Interaction rate</th><th class="num">LinkedIn's engagement rate</th><th class="num">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {#each data.posts as p (p.brand + p.postId + (p.campaignId ?? ''))}
                  <tr class:muted-row={p.sponsored || !p.settled}>
                    <td class="date">{day(p.created)}</td>
                    {#if !data.brand}<td>{brandById(p.brand)?.short}</td>{/if}
                    <td class="post">
                      <a href={p.link} target="_blank" rel="noopener noreferrer">{p.calendar?.title ?? (p.title || 'No text')}</a>
                      <span class="sub">{where(p)}</span>
                      {#if p.sponsored}<span class="tag">Sponsored{p.campaign ? ` (${p.campaign})` : ''}: not counted</span>{/if}
                      {#if !p.settled}<span class="tag">Still collecting: {p.ageDays} {p.ageDays === 1 ? 'day' : 'days'} old</span>{/if}
                      {#if p.maybe.length}<span class="tag">Might be “{p.maybe[0].title}” in the calendar</span>{/if}
                    </td>
                    <td>{p.calendar?.format ?? p.contentType ?? '–'}</td>
                    <td class="num">{count(p.impressions)}</td>
                    <td class="num">{fmt(p.interactionRate, true)}</td>
                    <td class="num">{fmt(p.engagementRate, true)}</td>
                    <td class="num">{count(p.clicks)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="note">No LinkedIn posts this month.</p>
        {/if}
      </section>
    {/if}

    {#if data.brand && data.account.some((a) => a.organicFollowers !== null || a.pageViews !== null)}
      <section>
        <h2>The page as a whole</h2>
        <div class="table-wrap">
          <table class="account">
            <thead>
              <tr><th>Month</th><th class="num">New followers (organic)</th><th class="num">New followers (paid)</th><th class="num">Page views</th><th class="num">Impressions (organic)</th></tr>
            </thead>
            <tbody>
              {#each data.account as a}
                <tr>
                  <td>{monthLabel(a.month)}{#if !a.complete}<span class="sub">to date</span>{/if}</td>
                  <td class="num">{count(a.organicFollowers)}</td>
                  <td class="num paid">{count(a.sponsoredFollowers)}</td>
                  <td class="num">{count(a.pageViews)}</td>
                  <td class="num">{count(a.impressions)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="note">Totals per month from the followers, visitors and content exports. Paid followers came from sponsored (boosted) posts, so they are kept apart from organic growth.</p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { margin: 0 0 6px; font-size: 24px; color: var(--band); }
  h2 { font-size: 16px; margin: 32px 0 6px; }
  .lede { margin: 0 0 16px; color: var(--text-secondary); max-width: 80ch; }
  .help { margin: 6px 0 12px; font-size: 13px; color: var(--text-secondary); }
  .note { color: var(--text-muted); font-size: 13px; margin: 8px 0; max-width: 90ch; }
  .muted { color: var(--text-muted); }
  .count { font-weight: 400; color: var(--text-muted); }
  .banner { margin: 12px 0; padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--weekend); }

  .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .seg { display: flex; flex-wrap: wrap; max-width: 100%; gap: 2px; padding: 3px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; }
  .seg a { padding: 4px 12px; border-radius: 999px; color: var(--text-secondary); text-decoration: none; font-size: 13px; font-weight: 600; }
  .seg a:hover { background: var(--weekend); }
  .seg a[aria-current='true'] { background: var(--band, var(--trust-teal)); color: #fff; }

  .table-wrap { overflow-x: auto; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--weekend); vertical-align: top; }
  thead th { text-align: left; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border); white-space: nowrap; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sub { display: block; font-size: 11px; font-weight: 400; color: var(--text-muted); }

  .grid th.label { text-align: left; font-weight: 600; min-width: 200px; }
  .grid thead a { color: inherit; text-decoration: none; border-bottom: 2px solid transparent; }
  .grid thead a:hover { color: var(--link); }
  .grid thead a[aria-current='true'] { color: var(--text-primary); border-bottom-color: var(--growth-orange); }
  .grid td { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .grid .n { display: block; font-size: 11px; font-weight: 400; color: var(--text-muted); }
  .grid td.few { color: var(--text-muted); font-weight: 400; }
  .grid .none { color: var(--border); font-weight: 400; }
  .grid .all { background: var(--surface-1); }
  .grid tr.first-total th, .grid tr.first-total td { border-top: 2px solid var(--border); }
  .grid tr.total th.label { font-weight: 700; }

  .fixes { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
  .fixes > li { min-width: 0; overflow-wrap: anywhere; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--warning); border-radius: 6px; }
  .fixes p { margin: 4px 0; }
  .fix-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .candidates { margin: 4px 0 0; padding-left: 18px; }
  .candidates li { margin: 2px 0; }
  .tag {
    display: inline-block; margin: 4px 6px 0 0; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: var(--weekend); color: var(--text-secondary); border: 1px solid var(--border);
  }
  .fix-head .tag { margin: 0; background: color-mix(in srgb, var(--warning) 25%, var(--surface-2)); border-color: color-mix(in srgb, var(--warning) 60%, transparent); color: var(--text-primary); }

  .posts .post { min-width: 280px; max-width: 520px; }
  .posts .post a { font-weight: 600; }
  .posts .date { white-space: nowrap; }
  .posts tr.muted-row td { color: var(--text-muted); }
  .account .paid { color: var(--text-muted); }

  @media (max-width: 640px) {
    .seg { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; width: 100%; min-width: 0; }
    .seg a { flex: none; }
    .grid th.label { min-width: 150px; }
  }
</style>
