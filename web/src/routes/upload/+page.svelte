<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { BRANDS, brandById } from '$lib/brands';
  import type { FrameworkChange } from '$lib/dataset/changes';
  import type { UploadInfo } from '$lib/dataset/uploads';
  import type { Summary } from '$lib/workbook/summary';
  import type { Issue } from '$lib/workbook/types';

  let { data } = $props();

  interface Result {
    status: 'published' | 'ready' | 'unchanged' | 'refused';
    contentHash: string;
    fileName: string;
    upload: UploadInfo | null;
    previous: UploadInfo | null;
    issues: Issue[];
    changes: FrameworkChange[];
    workbook: { brand: string; fy: number; bauStart: string | null; posts: number; summary: Summary } | null;
  }

  let brand = $derived(data.brand ?? '');
  let uploadedBy = $state('');
  let file = $state<File | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let busy = $state<'check' | 'publish' | null>(null);
  let result = $state<Result | null>(null);
  let failure = $state<string | null>(null);

  const brandName = (id: string) => brandById(id)?.name ?? id;
  const when = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
  const fy = (n: number) => `FY${String(n).slice(2)}`;

  const blocking = $derived(result ? result.issues.filter((i) => i.level === 'error') : []);
  /** Warnings grouped by the person who should fix them. */
  const warningsByOwner = $derived.by(() => {
    const groups = new Map<string, Issue[]>();
    for (const i of result?.issues ?? []) {
      if (i.level === 'error') continue;
      const k = i.owner ?? 'No owner named';
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    return [...groups.entries()];
  });

  function chooseBrand(id: string) {
    result = null;
    failure = null;
    goto(id ? `?brand=${id}` : '?', { keepFocus: true, noScroll: true });
  }

  async function send(mode: 'check' | 'publish') {
    if (!file || !brand) return;
    busy = mode;
    failure = null;
    const body = new FormData();
    body.set('mode', mode);
    body.set('brand', brand);
    body.set('uploadedBy', uploadedBy);
    body.set('file', file);
    if (mode === 'publish' && result) body.set('checkedHash', result.contentHash);
    try {
      const res = await fetch('/upload/submit', { method: 'POST', body });
      if (!res.ok) {
        failure = (await res.json().catch(() => null))?.message ?? `Something went wrong (${res.status}).`;
        if (res.status === 409) result = null;
        return;
      }
      result = await res.json();
      if (result?.status === 'published') await invalidateAll();
    } catch {
      failure = 'Could not reach the site. Check that it is still running and try again.';
    } finally {
      busy = null;
    }
  }

  function reset() {
    result = null;
    failure = null;
    file = null;
    if (fileInput) fileInput.value = '';
  }
</script>

<svelte:head>
  <title>Upload · Emkay BAU</title>
</svelte:head>

<div class="page">
  <h1>Upload a calendar workbook</h1>
  <p class="lede">The site checks the workbook first and shows what would change. Nothing is published until you click Publish.</p>

  <form class="card" onsubmit={(e) => { e.preventDefault(); send('check'); }}>
    <label>
      <span>Brand</span>
      <select value={brand} onchange={(e) => chooseBrand(e.currentTarget.value)} required disabled={!!busy}>
        <option value="" disabled>Choose the brand you are uploading for</option>
        {#each BRANDS as b}<option value={b.id}>{b.name}</option>{/each}
      </select>
    </label>
    <label>
      <span>Uploaded by</span>
      <input type="text" bind:value={uploadedBy} list="team" placeholder="Your name" autocomplete="name" disabled={!!busy} />
      <datalist id="team">
        {#each (brand ? data.team[brand as keyof typeof data.team] : undefined) ?? [] as name}<option value={name}></option>{/each}
      </datalist>
    </label>
    <label>
      <span>Workbook</span>
      <input
        bind:this={fileInput}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        disabled={!!busy}
        onchange={(e) => { file = e.currentTarget.files?.[0] ?? null; result = null; failure = null; }}
      />
    </label>
    <div class="actions">
      <button type="submit" class="primary" disabled={!file || !brand || !!busy}>{busy === 'check' ? 'Checking…' : 'Check workbook'}</button>
    </div>
  </form>

  {#if failure}<p class="banner critical" role="alert">{failure}</p>{/if}

  {#if result}
    <section class="card result" aria-live="polite">
      {#if result.status === 'refused'}
        <p class="banner critical">
          <strong>Can't publish yet.</strong>
          {blocking.length === 1 ? 'One blocking problem needs' : `${blocking.length} blocking problems need`} fixing in the workbook first. Fix them in Excel, save, and check the file again.
        </p>
      {:else if result.status === 'unchanged'}
        <p class="banner neutral">
          <strong>Nothing new.</strong> This file is identical to the latest upload
          {#if result.previous}({when(result.previous.uploadedAt)}{result.previous.uploadedBy ? `, by ${result.previous.uploadedBy}` : ''}){/if}, so there is nothing to publish.
        </p>
      {:else if result.status === 'ready'}
        <p class="banner good">
          <strong>Ready to publish</strong> {brandName(brand)} {fy(result.workbook!.fy)}: {result.workbook!.posts} posts.
          {#if result.issues.length}{result.issues.length} {result.issues.length === 1 ? 'thing' : 'things'} to fix later (not blocking).{/if}
        </p>
      {:else}
        <p class="banner good">
          <strong>Published.</strong> {brandName(brand)} {fy(result.workbook!.fy)} now shows this workbook.
          <a href="/?brand={brand}">See it on the calendar</a>
        </p>
      {/if}

      {#if result.workbook && result.status !== 'refused'}
        {@const s = result.workbook.summary}
        <h2>BAU mix in this workbook</h2>
        <table>
          <thead><tr><th>Comms task</th><th>Counts as BAU</th><th class="num">Posts</th><th class="num">Share</th><th class="num">Target</th></tr></thead>
          <tbody>
            {#each s.tasks as t}
              <tr><td>{t.name}</td><td>{t.countsAsBau ? 'Yes' : 'No'}</td><td class="num">{t.total}</td><td class="num">{t.countsAsBau ? pct(t.share) : '–'}</td><td class="num">{pct(t.target)}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="note">
          Counted from {result.workbook.bauStart ? 'the BAU start' : 'the start of the year'}, leaving out Dropped posts.
          {#if s.beforeBauStart}{s.beforeBauStart} earlier posts are kept as a baseline.{/if}
        </p>

        <h2>Changes since the last upload</h2>
        {#if !result.previous}
          <p class="note">This is the first upload for {brandName(brand)} {fy(result.workbook.fy)}.</p>
        {:else}
          <p class="note">Last upload: {when(result.previous.uploadedAt)}{result.previous.uploadedBy ? `, by ${result.previous.uploadedBy}` : ''}, {result.previous.posts} posts. Now: {result.workbook.posts} posts.</p>
          {#if result.changes.length}
            <ul class="changes">
              {#each result.changes as c}<li class:moved={c.kind === 'peg-moved' || c.kind === 'peg-removed'}>{c.message}</li>{/each}
            </ul>
          {:else}
            <p class="note">No changes to the comms tasks or framework.</p>
          {/if}
        {/if}
      {/if}

      {#snippet issue(i: Issue)}
        <li class:blocking={i.level === 'error'}>
          <span class="where">{[i.sheet, i.cell].filter(Boolean).join(' ')}{i.level === 'error' && i.owner ? ` · for ${i.owner}` : ''}</span>
          {#if i.post}<span class="post">“{i.post}”</span>{/if}
          <span>{i.message}</span>
        </li>
      {/snippet}

      {#if blocking.length}
        <h2 class="blocking-title">✖ Blocking: fix {blocking.length === 1 ? 'this' : 'these'} first</h2>
        <ul class="issues">{#each blocking as i}{@render issue(i)}{/each}</ul>
      {/if}

      {#if warningsByOwner.length}
        <h2>To fix in the workbook <span class="count">(not blocking)</span></h2>
        {#each warningsByOwner as [owner, list]}
          <details class="owner">
            <summary><strong>{owner}</strong> <span class="count">{list.length} to fix</span></summary>
            <ul class="issues">{#each list as i}{@render issue(i)}{/each}</ul>
          </details>
        {/each}
      {/if}

      <div class="actions">
        {#if result.status === 'ready'}
          <button class="primary" onclick={() => send('publish')} disabled={!!busy}>{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>
        {/if}
        <button onclick={reset} disabled={!!busy}>{result.status === 'published' ? 'Upload another workbook' : 'Choose another file'}</button>
      </div>
    </section>
  {/if}

  <section class="history">
    <h2>Upload history{brand ? ` · ${brandName(brand)}` : ''}</h2>
    {#if data.history.length}
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Uploaded</th>{#if !brand}<th>Brand</th>{/if}<th>Year</th><th>By</th><th>File</th><th class="num">Posts</th><th class="num">To fix</th><th></th></tr>
          </thead>
          <tbody>
            {#each data.history as u (u.id)}
              <tr>
                <td>{when(u.uploadedAt)}</td>
                {#if !brand}<td>{brandName(u.brand)}</td>{/if}
                <td>{fy(u.fy)}</td>
                <td>{u.uploadedBy ?? '—'}</td>
                <td class="file">{u.fileName}</td>
                <td class="num">{u.posts}</td>
                <td class="num">{u.warnings}</td>
                <td>{#if u.live}<span class="live">Live</span>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="note">Every upload is kept. "Live" is the one the calendar shows for that brand and year.</p>
    {:else}
      <p class="note">Nothing uploaded yet.</p>
    {/if}
  </section>
</div>

<style>
  .page { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { margin: 0 0 4px; font-size: 24px; color: var(--band); }
  .lede { margin: 0 0 20px; color: var(--text-secondary); }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
  form.card { display: grid; gap: 14px; }
  label { display: grid; gap: 6px; font-weight: 600; }
  label span { font-size: 13px; color: var(--text-secondary); }
  select, input[type='text'], input[type='file'] {
    font: inherit; padding: 9px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1); width: 100%;
  }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  button { padding: 9px 18px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); font-weight: 600; cursor: pointer; }
  button.primary { background: var(--growth-orange); border-color: var(--growth-orange); color: var(--text-primary); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .banner { margin: 0 0 8px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid; }
  .banner.good { background: color-mix(in srgb, var(--investment-pine) 9%, var(--surface-2)); border-color: color-mix(in srgb, var(--investment-pine) 40%, transparent); }
  .banner.neutral { background: var(--weekend); border-color: var(--border); }
  .banner.critical { background: #fbeaea; border-color: #d03b3b; color: #5c1515; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border); padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid var(--weekend); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .note { color: var(--text-muted); font-size: 13px; margin: 6px 0; }
  .changes { margin: 6px 0; padding-left: 18px; }
  .changes li { margin: 4px 0; }
  .changes li.moved { font-weight: 600; }
  .issues { list-style: none; margin: 0; padding: 0; }
  .blocking-title { color: #8f1f1f; }
  details.owner { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; background: var(--surface-2); }
  details.owner summary { cursor: pointer; padding: 10px 12px; }
  details.owner[open] summary { border-bottom: 1px solid var(--border); }
  details.owner .issues { padding: 8px; }
  .issues li { display: grid; gap: 2px; padding: 8px 10px; border-left: 3px solid var(--warning); background: var(--surface-1); margin-bottom: 6px; border-radius: 4px; }
  .issues li.blocking { border-left-color: #d03b3b; background: #fbeaea; }
  .where { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .post { font-size: 12px; color: var(--text-muted); }
  .count { font-weight: 400; color: var(--text-muted); }
  .history { margin-top: 28px; }
  .table-wrap { overflow-x: auto; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
  .file { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .live { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--growth-orange); color: var(--text-primary); }
</style>
