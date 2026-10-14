<script lang="ts">
  import { BRANDS } from '$lib/brands';
  import type { CalendarPost } from './calendar';
  import PlatformIcon from './PlatformIcon.svelte';

  let { post, onclose }: { post: CalendarPost | null; onclose: () => void } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (post && !dialog.open) dialog.showModal();
    if (!post && dialog.open) dialog.close();
  });

  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const brandName = (id: string) => BRANDS.find((b) => b.id === id)?.name ?? id;
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
</script>

<dialog
  bind:this={dialog}
  onclose={onclose}
  onclick={(e) => e.target === dialog && onclose()}
  aria-labelledby="post-title"
>
  {#if post}
    <div class="panel">
      <header>
        <p class="eyebrow">
          <span class="swatch" style="background: var(--mark-{post.colour})"></span>
          {brandName(post.brand)} · {longDate(post.date)}
        </p>
        <h2 id="post-title">{post.title ?? 'No title yet'}</h2>
        <button class="close" onclick={onclose} aria-label="Close">✕</button>
      </header>

      {#if post.problems.length}
        <section class="problems" aria-label="Problems to fix">
          <h3>⚠ {post.problems.length === 1 ? '1 problem' : `${post.problems.length} problems`} to fix in the workbook</h3>
          <ul>
            {#each post.problems as p}
              <li>
                <strong>{p.sheet} {p.cell}</strong>: {p.message}
                {#if p.owner}<span class="who">For {p.owner}</span>{/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if post.details}<p class="details">{post.details}</p>{/if}

      <dl>
        <dt>Peg</dt>
        <dd>
          {#if post.peg}{post.peg} <span class="muted">· {post.pillar} · {post.commsTask}</span>{:else}<span class="muted">No valid peg, so not counted in the BAU mix</span>{/if}
        </dd>
        {#if post.beforeBauStart}
          <dt>BAU</dt><dd class="muted">Before this brand's BAU started: kept as a baseline, not counted</dd>
        {:else if post.countsAsBau === false}
          <dt>BAU</dt><dd class="muted">Not BAU (counted separately)</dd>
        {/if}
        <dt>Status</dt><dd>{post.status ?? '—'}</dd>
        <dt>Owner</dt><dd>{post.owner ?? '—'}</dd>
        {#if post.series}<dt>Series</dt><dd>{post.series}</dd>{/if}
        {#if post.format}<dt>Format</dt><dd>{post.format}</dd>{/if}
        {#if post.moment}<dt>Moment</dt><dd>{post.moment}</dd>{/if}
      </dl>

      <h3>Platforms</h3>
      {#if post.platforms.length}
        <ul class="platforms">
          {#each post.platforms as pl}
            <li>
              <span class="pf-name"><PlatformIcon platform={pl.platform} live={pl.state !== 'planned'} size={20} label={pl.platform} />{pl.platform}</span>
              {#if pl.url}<a href={pl.url} target="_blank" rel="noopener noreferrer">{host(pl.url)}</a>
              {:else}<span class="muted">{pl.state === 'sent' ? 'Sent' : 'Planned'}</span>{/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">None yet.</p>
      {/if}

      {#if post.copyLink || post.longFormLink || post.referenceLink}
        <h3>Links</h3>
        <ul class="links">
          {#if post.copyLink}<li><a href={post.copyLink} target="_blank" rel="noopener noreferrer">Copy</a></li>{/if}
          {#if post.longFormLink}<li><a href={post.longFormLink} target="_blank" rel="noopener noreferrer">Long-form</a></li>{/if}
          {#if post.referenceLink}<li><a href={post.referenceLink} target="_blank" rel="noopener noreferrer">Reference</a></li>{/if}
        </ul>
      {/if}

      <p class="source">In the workbook: {post.source.sheet}, row {post.source.row}</p>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    border: none;
    padding: 0;
    margin: 0 0 0 auto;
    height: 100dvh;
    max-height: 100dvh;
    width: min(440px, 100vw);
    background: var(--surface-2);
    color: var(--text-primary);
    box-shadow: -8px 0 32px rgb(0 0 0 / 0.18);
    border-top: 4px solid var(--growth-orange);
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.35); }
  .panel { padding: 20px 20px 32px; }
  header { position: relative; padding-right: 36px; }
  .eyebrow { margin: 0 0 4px; color: var(--text-secondary); font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .swatch { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.3; }
  h3 { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  .close {
    position: absolute; top: -4px; right: -8px; width: 36px; height: 36px;
    border: none; background: none; border-radius: 50%; cursor: pointer; color: var(--text-secondary);
  }
  .close:hover { background: var(--weekend); }
  .details { margin: 0 0 12px; color: var(--text-secondary); }
  dl { display: grid; grid-template-columns: 84px 1fr; gap: 6px 12px; margin: 12px 0 0; }
  dt { color: var(--text-muted); }
  dd { margin: 0; }
  .muted { color: var(--text-muted); }
  ul { list-style: none; margin: 0; padding: 0; }
  .platforms li, .links li { padding: 6px 0; border-bottom: 1px solid var(--border); display: flex; gap: 12px; }
  .pf-name { width: 120px; color: var(--text-secondary); flex: none; display: inline-flex; align-items: center; gap: 8px; }
  .platforms li { align-items: center; }
  .links li a { font-weight: 500; }
  .problems {
    margin: 4px 0 12px; padding: 10px 12px; border-radius: var(--radius);
    background: color-mix(in srgb, var(--warning) 14%, var(--surface-2));
    border: 1px solid color-mix(in srgb, var(--warning) 55%, transparent);
  }
  .problems h3 { margin: 0 0 6px; color: var(--text-primary); text-transform: none; letter-spacing: 0; font-size: 14px; }
  .problems li { padding: 4px 0; }
  .who { display: block; color: var(--text-muted); font-size: 12px; }
  .source { margin-top: 20px; font-size: 12px; color: var(--text-muted); }
</style>
