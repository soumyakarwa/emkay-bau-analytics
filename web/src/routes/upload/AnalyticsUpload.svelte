<script lang="ts">
  // The LinkedIn analytics section: a brand's monthly exports, several at once. Each file is
  // checked on its own as soon as it is chosen; "Publish" then publishes every file that is
  // ready, skipping (and listing) the rest, so one bad file never holds up the others.

  import { invalidateAll } from '$app/navigation';
  import type { LinkedInFile } from '$lib/analytics/rows';
  import type { AnalyticsUploadInfo, Coverage } from '$lib/analytics/uploads';
  import { KIND_LABEL, brandName, day, daysAgo, failureOf, when } from './format';

  interface Checked {
    status: 'published' | 'ready' | 'unchanged' | 'refused';
    message: string | null;
    contentHash: string;
    upload: AnalyticsUploadInfo | null;
    export: { file: LinkedInFile; page: string | null; from: string; to: string; posts: number; sponsored: number; days: number; audience: number; peers: number } | null;
  }

  interface Row {
    file: File;
    state: 'checking' | 'ready' | 'refused' | 'unchanged' | 'duplicate' | 'publishing' | 'published' | 'failed';
    result: Checked | null;
    /** Why it cannot be published, or what went wrong. */
    message: string | null;
  }

  let { brand, uploadedBy, coverage, history }: {
    brand: string;
    uploadedBy: string;
    coverage: Coverage[] | null;
    history: AnalyticsUploadInfo[];
  } = $props();

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
    const span = `${day(x.from)} – ${day(x.to)}`;
    if (x.file === 'content') return `${span} · ${x.posts} posts${x.sponsored ? ` + ${x.sponsored} sponsored rows` : ''}`;
    if (x.file === 'competitors') return `${span} · ${x.peers} peer pages`;
    return `${span} · ${x.days} days, ${x.audience} audience rows`;
  }
</script>

<div
  class="card dropzone"
  class:dragging
  role="group"
  aria-label="LinkedIn exports"
  ondragover={(e) => { e.preventDefault(); dragging = !!brand; }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => { e.preventDefault(); dragging = false; if (!publishing) choose(e.dataTransfer?.files); }}
>
  <label>
    <span>LinkedIn exports: choose or drop all of this month's files at once</span>
    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      disabled={!brand || publishing || checking}
      onchange={(e) => choose(e.currentTarget.files)}
    />
  </label>
  <p class="note">Content, Followers and Visitors (and Competitors, if set up), exactly as LinkedIn gives them. Each file is checked as soon as you choose it.</p>
</div>

{#if rows.length}
  <section class="card result" aria-live="polite">
    <ul class="batch">
      {#each rows as r}
        {@const x = r.result?.export}
        <li class="state-{r.state}">
          <span class="icon" aria-hidden="true">{ICON[r.state]}</span>
          <div class="what">
            <strong>{x ? KIND_LABEL[x.file] : r.file.name}</strong>
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
    <h2>LinkedIn files · {brandName(brand)}</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>File</th><th>Figures up to</th><th>Covered since</th><th class="num">Uploads</th><th>Status</th></tr></thead>
        <tbody>
          {#each coverage as c}
            <tr>
              <td>{c.label}{#if c.optional}<span class="sub">optional</span>{/if}</td>
              <td>{c.to ? day(c.to) : '–'}</td>
              <td>{c.from ? day(c.from) : '–'}</td>
              <td class="num">{c.uploads}</td>
              <td>
                {#if !c.uploads}<span class="sub">{c.optional ? 'Not used yet' : `Not uploaded yet: ${c.help}`}</span>
                {:else if c.gaps.length}⚠ Gap: {c.gaps.map((g) => `${day(g.from)} – ${day(g.to)}`).join(', ')}
                {:else if c.to && daysAgo(c.to) > 40}⚠ Over a month old: time for a new export
                {:else}Up to date{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="note">Each month, export the last 365 days of Content, Followers and Visitors (and Competitors, if set up) and upload them here.</p>
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
              <td>{KIND_LABEL[u.file]}{#if u.warnings.length}<span class="sub" title={u.warnings.join('\n')}>⚠ {u.warnings.length}</span>{/if}</td>
              <td>{day(u.from)} – {day(u.to)}</td>
              <td>{u.uploadedBy ?? '—'}</td>
              <td class="file">{u.fileName}</td>
              <td class="num">{u.file === 'content' ? u.counts.posts : '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="note">No LinkedIn exports uploaded yet.</p>
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
  @media (max-width: 520px) {
    .batch > li { grid-template-columns: 22px 1fr; }
    .state { grid-column: 2; }
  }
</style>
