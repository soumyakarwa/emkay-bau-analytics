<script lang="ts">
  // One upload page, two sections: the brand's calendar workbook, and its LinkedIn analytics
  // exports. The brand and "Uploaded by" are chosen once for both; the section is in the address.

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { BRANDS } from '$lib/brands';
  import AnalyticsUpload from './AnalyticsUpload.svelte';
  import CalendarUpload from './CalendarUpload.svelte';
  import { brandName } from './format';
  import './upload.css';

  let { data } = $props();

  const allowed = $derived(BRANDS.filter((b) => data.uploadBrands.includes(b.id)));
  const brand = $derived(data.brand && data.uploadBrands.includes(data.brand) ? data.brand : allowed.length === 1 ? allowed[0].id : '');
  let uploadedBy = $state('');

  const SECTIONS = [
    { id: 'calendar', label: 'Calendar workbook', help: "The brand's content calendar (.xlsx). Upload it whenever the plan changes." },
    { id: 'analytics', label: 'Analytics', help: "The brand's exports from LinkedIn, YouTube, Instagram and X, once a month, all files at once." }
  ] as const;

  /** The upload page with some of its address changed. */
  function address(changes: Record<string, string | null>) {
    const q = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const s = q.toString();
    return `/upload${s ? `?${s}` : ''}`;
  }
</script>

<svelte:head>
  <title>Upload · Emkay BAU</title>
</svelte:head>

<div class="page upload-page">
  <h1>Upload</h1>
  <p class="lede">The site checks every file first and shows what it found. Nothing is published until you click Publish.</p>

  {#if !allowed.length}
    <p class="banner neutral">
      Your sign-in can view the site but not upload. To upload for a brand,
      <a href="/login?next=/upload">sign in with that brand's upload password</a>.
    </p>
  {:else}
    {#if data.brand && !data.uploadBrands.includes(data.brand)}
      <p class="banner neutral">
        You can't upload for {brandName(data.brand)} with your sign-in.
        <a href="/login?next=/upload%3Fbrand%3D{data.brand}">Sign in with its upload password</a> to add it.
      </p>
    {/if}

    <div class="card who">
      <label>
        <span>Brand</span>
        <select value={brand} onchange={(e) => goto(address({ brand: e.currentTarget.value || null }), { keepFocus: true, noScroll: true })} required>
          <option value="" disabled>Choose the brand you are uploading for</option>
          {#each allowed as b}<option value={b.id}>{b.name}</option>{/each}
        </select>
      </label>
      <label>
        <span>Uploaded by</span>
        <input type="text" bind:value={uploadedBy} list="team" placeholder="Your name" autocomplete="name" />
        <datalist id="team">
          {#each (brand ? data.team[brand as keyof typeof data.team] : undefined) ?? [] as name}<option value={name}></option>{/each}
        </datalist>
      </label>
    </div>

    <nav class="sections" aria-label="What to upload">
      {#each SECTIONS as s}
        <a href={address({ section: s.id === 'calendar' ? null : s.id })} aria-current={data.section === s.id ? 'page' : undefined} data-sveltekit-noscroll>
          {s.label}
        </a>
      {/each}
    </nav>
    <p class="note section-help">{SECTIONS.find((s) => s.id === data.section)?.help}</p>

    {#if data.section === 'analytics'}
      <AnalyticsUpload {brand} {uploadedBy} coverage={data.coverage} history={data.analyticsHistory} followerCounts={data.followerCounts} today={data.today} />
    {:else}
      <CalendarUpload {brand} {uploadedBy} history={data.history} />
    {/if}
  {/if}
</div>

<style>
  .who { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .sections { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin: 8px 0 0; overflow-x: auto; }
  .sections a {
    padding: 10px 16px; font-weight: 600; text-decoration: none; color: var(--text-secondary);
    border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap;
  }
  .sections a:hover { color: var(--text-primary); }
  .sections a[aria-current='page'] { color: var(--band); border-bottom-color: var(--growth-orange); }
  .section-help { margin: 10px 0 14px; }
  @media (max-width: 640px) {
    .who { grid-template-columns: 1fr; }
  }
</style>
