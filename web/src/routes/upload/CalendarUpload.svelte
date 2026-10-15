<script lang="ts">
  // The calendar workbook section: one workbook at a time, checked and previewed in full
  // (BAU mix, framework changes, problems by person) before it is published.

  import { invalidateAll } from '$app/navigation';
  import type { FrameworkChange } from '$lib/dataset/changes';
  import type { UploadInfo } from '$lib/dataset/uploads';
  import type { Summary } from '$lib/workbook/summary';
  import type { Issue } from '$lib/workbook/types';
  import { brandName, failureOf, fy, pct, when } from './format';

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

  let { brand, uploadedBy, history }: {
    brand: string;
    uploadedBy: string;
    history: (UploadInfo & { live: boolean })[];
  } = $props();

  let file = $state<File | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let busy = $state<'check' | 'publish' | null>(null);
  let result = $state<Result | null>(null);
  let failure = $state<string | null>(null);

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

  // A different brand starts afresh.
  $effect(() => {
    void brand;
    result = null;
    failure = null;
  });

  async function send(mode: 'check' | 'publish') {
    if (!file || !brand) return;
    busy = mode;
    failure = null;
    const body = new FormData();
    body.set('mode', mode);
    body.set('section', 'calendar');
    body.set('brand', brand);
    body.set('uploadedBy', uploadedBy);
    body.set('file', file);
    if (mode === 'publish' && result) body.set('checkedHash', result.contentHash);
    try {
      const res = await fetch('/upload/submit', { method: 'POST', body });
      if (!res.ok) {
        failure = await failureOf(res);
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

<form class="card" onsubmit={(e) => { e.preventDefault(); send('check'); }}>
  <label>
    <span>Calendar workbook (.xlsx)</span>
    <input
      bind:this={fileInput}
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      required
      disabled={!!busy || !brand}
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
  <h2>Workbook history{brand ? ` · ${brandName(brand)}` : ''}</h2>
  {#if history.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Uploaded</th>{#if !brand}<th>Brand</th>{/if}<th>Year</th><th>By</th><th>File</th><th class="num">Posts</th><th class="num">To fix</th><th></th></tr>
        </thead>
        <tbody>
          {#each history as u (u.id)}
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
    <p class="note">No workbook uploaded yet.</p>
  {/if}
</section>
