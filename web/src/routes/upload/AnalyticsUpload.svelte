<script lang="ts">
  // The analytics section: a brand's monthly exports from every platform, several at once. Each
  // file is recognised and checked on its own as soon as it is chosen; "Publish" then publishes
  // every file that is ready, skipping (and listing) the rest, so one bad file never holds up the
  // others. Below: what is due this month, each platform's files, and the upload history.

  import { invalidateAll } from '$app/navigation';
  import type { FollowerCount } from '$lib/analytics/followers';
  import type { AnalyticsUploadInfo, Coverage, PlatformCoverage } from '$lib/analytics/uploads';
  import { brandName, day, exportLabel, failureOf, when } from './format';

  type Status = Coverage & { due: boolean };
  type PlatformStatus = Omit<PlatformCoverage, 'files'> & { files: Status[] };

  interface Checked {
    status: 'published' | 'ready' | 'unchanged' | 'refused';
    message: string | null;
    contentHash: string;
    upload: AnalyticsUploadInfo | null;
    export: {
      platform: string; file: string; label: string; account: string | null; from: string; to: string;
      posts: number; sponsored: number; days: number; audience: number; peers: number; totals: number;
    } | null;
  }

  interface Row {
    file: File;
    state: 'checking' | 'ready' | 'refused' | 'unchanged' | 'duplicate' | 'publishing' | 'published' | 'failed';
    result: Checked | null;
    /** Why it cannot be published, or what went wrong. */
    message: string | null;
  }

  let { brand, uploadedBy, coverage, history, followerCounts, today }: {
    brand: string;
    uploadedBy: string;
    coverage: PlatformStatus[] | null;
    history: AnalyticsUploadInfo[];
    followerCounts: FollowerCount[];
    today: string;
  } = $props();

  // Follower totals read off the profiles: the latest per platform, and a form to note a new one.
  const latestCount = (platform: string) => followerCounts.filter((c) => c.platform === platform).at(-1);
  let countInput = $state<Record<string, string>>({});
  let countDate = $state<Record<string, string>>({});
  let countSaving = $state<string | null>(null);
  let countMessage = $state<{ platform: string; text: string; ok: boolean } | null>(null);

  async function saveCount(platform: string) {
    const body = new FormData();
    body.set('brand', brand);
    body.set('platform', platform);
    body.set('count', countInput[platform] ?? '');
    body.set('date', countDate[platform] || today);
    body.set('enteredBy', uploadedBy);
    countSaving = platform;
    try {
      const res = await fetch('/upload/followers', { method: 'POST', body });
      if (!res.ok) {
        countMessage = { platform, text: await failureOf(res), ok: false };
        return;
      }
      countInput[platform] = '';
      countMessage = { platform, text: 'Saved.', ok: true };
      await invalidateAll();
    } finally {
      countSaving = null;
    }
  }

  let rows = $state<Row[]>([]);
  let fileInput = $state<HTMLInputElement>();
  let dragging = $state(false);
  let publishing = $state(false);

  const checking = $derived(rows.some((r) => r.state === 'checking'));
  const ready = $derived(rows.filter((r) => r.state === 'ready'));
  const done = $derived(rows.length > 0 && rows.every((r) => !['checking', 'ready', 'publishing'].includes(r.state)));

  // A different brand starts afresh.
  $effect(() => {
    void brand;
    rows = [];
  });

  function request(mode: 'check' | 'publish', file: File, checkedHash?: string): Promise<Response> {
    const body = new FormData();
    body.set('mode', mode);
    body.set('section', 'analytics');
    body.set('brand', brand);
    body.set('uploadedBy', uploadedBy);
    body.set('file', file);
    if (checkedHash) body.set('checkedHash', checkedHash);
    return fetch('/upload/submit', { method: 'POST', body });
  }

  async function choose(files: FileList | File[] | null | undefined) {
    if (!files?.length || !brand) return;
    rows = [...files].map((file) => ({ file, state: 'checking', result: null, message: null }));
    await Promise.all(rows.map(async (_, i) => {
      try {
        const res = await request('check', rows[i].file);
        if (!res.ok) {
          rows[i] = { ...rows[i], state: 'refused', message: await failureOf(res) };
          return;
        }
        const result: Checked = await res.json();
        rows[i] = { ...rows[i], result, state: result.status === 'ready' ? 'ready' : result.status === 'unchanged' ? 'unchanged' : 'refused', message: result.message };
      } catch {
        rows[i] = { ...rows[i], state: 'failed', message: 'Could not reach the site. Check that it is still running and try again.' };
      }
    }));
    // The same file chosen twice: only the first is published.
    const seen = new Map<string, string>();
    rows = rows.map((r) => {
      const hash = r.result?.contentHash;
      if (r.state !== 'ready' || !hash) return r;
      if (seen.has(hash)) return { ...r, state: 'duplicate', message: `The same file as ${seen.get(hash)}.` };
      seen.set(hash, r.file.name);
      return r;
    });
  }

  async function publishAll() {
    publishing = true;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].state !== 'ready') continue;
      rows[i] = { ...rows[i], state: 'publishing' };
      try {
        const res = await request('publish', rows[i].file, rows[i].result!.contentHash);
        if (!res.ok) {
          rows[i] = { ...rows[i], state: 'failed', message: await failureOf(res) };
          continue;
        }
        const result: Checked = await res.json();
        rows[i] = { ...rows[i], result, state: result.status === 'published' ? 'published' : result.status === 'unchanged' ? 'unchanged' : 'failed', message: result.message };
      } catch {
        rows[i] = { ...rows[i], state: 'failed', message: 'Could not reach the site. Check that it is still running and try again.' };
      }
    }
    publishing = false;
    await invalidateAll();
  }

  function reset() {
    rows = [];
    if (fileInput) fileInput.value = '';
  }

  const STATE_LABEL: Record<Row['state'], string> = {
    checking: 'Checking…', ready: 'Ready', refused: "Can't publish", unchanged: 'Already uploaded', duplicate: 'Chosen twice',
    publishing: 'Publishing…', published: 'Published', failed: 'Not published'
  };
  const ICON: Record<Row['state'], string> = {
    checking: '…', ready: '✔', refused: '✖', unchanged: '=', duplicate: '=', publishing: '…', published: '✔', failed: '✖'
  };

  function describe(x: NonNullable<Checked['export']>): string {
    const parts = [`${day(x.from)} – ${day(x.to)}`];
    if (x.account) parts.push(x.account);
    if (x.posts) parts.push(`${x.posts} posts${x.sponsored ? ` + ${x.sponsored} sponsored rows` : ''}`);
    if (x.days) parts.push(`${x.days} days`);
    if (x.audience) parts.push(`${x.audience} audience rows`);
    if (x.peers) parts.push(`${x.peers} peer pages`);
    if (x.totals && !x.posts && !x.days) parts.push(`${x.totals} totals`);
    return parts.join(' · ');
  }

  /** "This month": per platform in use, how many of its required files are up to date. */
  const thisMonth = $derived((coverage ?? []).filter((p) => p.used).map((p) => {
    const required = p.files.filter((f) => !f.optional);
    return { label: p.label, done: required.filter((f) => !f.due).length, of: required.length };
  }));
  const status = (f: Status) =>
    !f.uploads ? (f.optional ? 'Not used' : 'Not uploaded yet')
      : f.gaps.length ? `⚠ Gap: ${f.gaps.map((g) => `${day(g.from)} – ${day(g.to)}`).join(', ')}`
      : f.due ? (f.rule === 'month' ? '⚠ Last month not uploaded yet' : '⚠ Over a month old: time for a new export')
      : 'Up to date';
</script>

<div
  class="card dropzone"
  class:dragging
  role="group"
  aria-label="Analytics exports"
  ondragover={(e) => { e.preventDefault(); dragging = !!brand; }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => { e.preventDefault(); dragging = false; if (!publishing) choose(e.dataTransfer?.files); }}
>
  <label>
    <span>Exports: choose or drop all of this month's files at once, from any platform</span>
    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept=".xls,.xlsx,.csv,.zip,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/zip"
      disabled={!brand || publishing || checking}
      onchange={(e) => choose(e.currentTarget.files)}
    />
  </label>
  <p class="note">
    LinkedIn (.xls), YouTube (the .zip files, as downloaded), Instagram and X (.csv): exactly as each platform gives them,
    without opening or renaming them. Each file is recognised and checked as soon as you choose it.
  </p>
</div>

{#if rows.length}
  <section class="card result" aria-live="polite">
    <ul class="batch">
      {#each rows as r}
        {@const x = r.result?.export}
        <li class="state-{r.state}">
          <span class="icon" aria-hidden="true">{ICON[r.state]}</span>
          <div class="what">
            <strong>{x ? x.label : r.file.name}</strong>
            {#if x}<span class="sub">{r.file.name} · {describe(x)}</span>{/if}
            {#if r.message}<span class="why">{r.message}</span>{/if}
            {#if r.state === 'unchanged' && r.result?.upload}<span class="sub">Uploaded {when(r.result.upload.uploadedAt)}{r.result.upload.uploadedBy ? ` by ${r.result.upload.uploadedBy}` : ''}.</span>{/if}
            {#if r.result?.upload?.warnings.length && r.state !== 'unchanged'}
              <ul class="warn-list">{#each r.result.upload.warnings as w}<li>{w}</li>{/each}</ul>
            {/if}
          </div>
          <span class="state">{STATE_LABEL[r.state]}</span>
        </li>
      {/each}
    </ul>
    <div class="actions">
      {#if ready.length}
        <button class="primary" onclick={publishAll} disabled={publishing || checking}>
          {publishing ? 'Publishing…' : `Publish ${ready.length === 1 ? 'the ready file' : `all ${ready.length} ready files`}`}
        </button>
      {/if}
      <button onclick={reset} disabled={publishing || checking}>{done ? 'Upload more files' : 'Clear'}</button>
      {#if done && rows.some((r) => r.state === 'published')}<a class="go" href="/analytics?brand={brand}">See the analytics</a>{/if}
    </div>
    {#if ready.length && rows.some((r) => ['refused', 'failed'].includes(r.state))}
      <p class="note">Files that can't be published are skipped; the others are published as normal.</p>
    {/if}
  </section>
{/if}

{#if coverage}
  <section class="history">
    <h2>Files · {brandName(brand)}</h2>
    {#if thisMonth.length}
      <p class="month">
        <strong>This month:</strong>
        {#each thisMonth as t, i}{i ? ' · ' : ''}<span class:due={t.done < t.of}>{t.label} {t.done < t.of ? '⚠' : '✔'} {t.done}/{t.of}</span>{/each}
      </p>
    {/if}
    {#each coverage as p (p.platform)}
      {@const issues = p.files.filter((f) => f.due || f.gaps.length).length}
      <details class="platform" open={p.used && issues > 0}>
        <summary>
          <strong>{p.label}</strong>
          <span class="sub-inline">
            {#if !p.used}Not used yet
            {:else if issues}⚠ {issues} {issues === 1 ? 'file needs' : 'files need'} attention
            {:else}Up to date{/if}
          </span>
        </summary>
        <p class="note routine">{p.routine}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>File</th><th>Covered</th><th class="num">Uploads</th><th>Status</th></tr></thead>
            <tbody>
              {#each p.files as f}
                <tr>
                  <td>{f.label}{#if f.optional}<span class="sub">optional</span>{/if}</td>
                  <td>{f.from && f.to ? `${day(f.from)} – ${day(f.to)}` : '–'}</td>
                  <td class="num">{f.uploads}</td>
                  <td>{status(f)}{#if !f.uploads && !f.optional}<span class="sub">{f.help}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {/each}
  </section>
{/if}

{#if coverage}
  <section class="history">
    <h2>Follower counts · {brandName(brand)}</h2>
    <p class="note">
      The exports only say how many people followed each day, not the total. Note each profile's total here once
      (and re-check it once a year); the site works out the totals for other months from it.
    </p>
    <div class="table-wrap">
      <table class="counts">
        <thead><tr><th>Platform</th><th>Last noted</th><th>New count</th><th>Read on</th><th></th></tr></thead>
        <tbody>
          {#each coverage as p (p.platform)}
            {@const c = latestCount(p.platform)}
            <tr>
              <td>{p.label}</td>
              <td>{#if c}{c.count.toLocaleString('en-IN')}{c.approximate ? ' (approx.)' : ''}<span class="sub">{day(c.date)}</span>{:else}<span class="sub">Not noted yet</span>{/if}</td>
              <td><input class="count" type="text" inputmode="decimal" placeholder="e.g. 3,735 or 1.6k" bind:value={countInput[p.platform]} aria-label="{p.label} followers" /></td>
              <td><input class="date" type="date" max={today} value={countDate[p.platform] ?? today} onchange={(e) => (countDate[p.platform] = e.currentTarget.value)} aria-label="{p.label} count read on" /></td>
              <td>
                <button onclick={() => saveCount(p.platform)} disabled={!countInput[p.platform] || countSaving === p.platform}>{countSaving === p.platform ? 'Saving…' : 'Save'}</button>
                {#if countMessage?.platform === p.platform}<span class="sub" class:bad={!countMessage.ok}>{countMessage.text}</span>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<section class="history">
  <h2>Analytics history{brand ? ` · ${brandName(brand)}` : ''}</h2>
  {#if history.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Uploaded</th>{#if !brand}<th>Brand</th>{/if}<th>Export</th><th>Covers</th><th>By</th><th>File</th><th class="num">Posts</th></tr>
        </thead>
        <tbody>
          {#each history as u (u.id)}
            <tr>
              <td>{when(u.uploadedAt)}</td>
              {#if !brand}<td>{brandName(u.brand)}</td>{/if}
              <td>{exportLabel(u.platform, u.file)}{#if u.warnings.length}<span class="sub" title={u.warnings.join('\n')}>⚠ {u.warnings.length}</span>{/if}</td>
              <td>{day(u.from)} – {day(u.to)}</td>
              <td>{u.uploadedBy ?? '—'}</td>
              <td class="file">{u.fileName}</td>
              <td class="num">{u.counts.posts || '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="note">No analytics exports uploaded yet.</p>
  {/if}
</section>

<style>
  .dropzone { border-style: dashed; border-width: 2px; }
  .dropzone.dragging { border-color: var(--growth-orange); background: color-mix(in srgb, var(--growth-orange) 6%, var(--surface-2)); }
  .batch { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .batch > li {
    display: grid; grid-template-columns: 22px 1fr auto; gap: 4px 10px; align-items: start;
    padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1);
    border-left-width: 3px; min-width: 0;
  }
  .what { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .icon { font-weight: 700; text-align: center; }
  .state { font-size: 12px; font-weight: 600; white-space: nowrap; color: var(--text-secondary); }
  .why { font-size: 13px; }
  .state-ready, .state-published { border-left-color: var(--investment-pine) !important; }
  .state-refused, .state-failed { border-left-color: #d03b3b !important; background: #fbeaea !important; }
  .state-unchanged, .state-duplicate { border-left-color: var(--grey) !important; }
  .state-checking, .state-publishing { border-left-color: var(--amber) !important; }
  .go { align-self: center; font-weight: 600; }
  .month { margin: 4px 0 12px; font-size: 14px; }
  .month .due { color: #8f1f1f; font-weight: 600; }
  details.platform { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); margin-bottom: 8px; }
  details.platform summary { cursor: pointer; padding: 10px 14px; display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  details.platform[open] summary { border-bottom: 1px solid var(--border); }
  details.platform .table-wrap { border: none; border-radius: 0; }
  .sub-inline { font-size: 13px; color: var(--text-muted); }
  .routine { padding: 0 14px; }
  .counts input { font: inherit; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1); }
  .counts input.count { width: 140px; }
  .counts td { vertical-align: middle; }
  .counts button { padding: 6px 14px; }
  .bad { color: #8f1f1f; }
  @media (max-width: 520px) {
    .batch > li { grid-template-columns: 22px 1fr; }
    .state { grid-column: 2; }
  }
</style>
