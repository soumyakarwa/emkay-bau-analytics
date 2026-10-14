<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { BRANDS, brandById } from '$lib/brands';

  let { children } = $props();

  const brand = $derived(brandById(page.url.searchParams.get('brand') ?? '')?.id ?? 'all');
  /** The guidebook's one substitution: Trust Teal for the group, the division colour for IM and Wealth. */
  const band = $derived(
    brand === 'im' ? 'var(--investment-pine)' : brand === 'wealth' ? 'var(--wealth-indigo)' : 'var(--trust-teal)'
  );

  /** The current page with a different brand, keeping everything else in the address. */
  function withBrand(id: string) {
    const q = new URLSearchParams(page.url.searchParams);
    if (id === 'all') q.delete('brand');
    else q.set('brand', id);
    const s = q.toString();
    return `${page.url.pathname}${s ? `?${s}` : ''}`;
  }
  /** Another page, keeping only the brand. */
  function to(path: string) {
    return brand === 'all' ? path : `${path}?brand=${brand}`;
  }
  const PAGES = [
    { path: '/', label: 'Calendar' },
    { path: '/upload', label: 'Upload' }
  ];
</script>

<div class="frame" style="--band: {band}">
  <header class="band">
    <div class="band-inner">
      <nav class="pages" aria-label="Pages">
        <span class="site">Emkay BAU</span>
        {#each PAGES as p}
          <a href={to(p.path)} aria-current={page.url.pathname === p.path ? 'page' : undefined}>{p.label}</a>
        {/each}
      </nav>
      <nav class="brands" aria-label="Viewing">
        <span class="viewing">Viewing</span>
        <a href={withBrand('all')} aria-current={brand === 'all' ? 'true' : undefined}>All of Emkay</a>
        {#each BRANDS as b}
          <a href={withBrand(b.id)} aria-current={brand === b.id ? 'true' : undefined} title={b.name}>{b.short}</a>
        {/each}
      </nav>
    </div>
  </header>

  {@render children()}
</div>

<style>
  .band { background: var(--band); color: #fff; }
  .band-inner {
    max-width: 1400px; margin: 0 auto; padding: 12px 16px;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 24px;
  }
  .pages, .brands { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .site { font-size: 18px; font-weight: 700; margin-right: 16px; letter-spacing: 0.01em; }
  .pages a {
    color: #fff; text-decoration: none; font-weight: 600; padding: 6px 4px; margin-right: 12px; opacity: 0.85;
    border-bottom: 3px solid transparent;
  }
  .pages a:hover { opacity: 1; }
  .pages a[aria-current='page'] { opacity: 1; border-bottom-color: var(--growth-orange); }
  .viewing { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; margin-right: 6px; }
  .brands a { padding: 6px 14px; border-radius: 999px; color: #fff; text-decoration: none; font-weight: 600; opacity: 0.85; }
  .brands a:hover { opacity: 1; background: rgb(255 255 255 / 0.12); }
  .brands a[aria-current='true'] { background: var(--growth-orange); color: var(--text-primary); opacity: 1; }
</style>
