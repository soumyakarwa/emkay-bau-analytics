<script lang="ts">
  import './analytics.css';
  import { page } from '$app/state';

  let { children } = $props();

  const SECTIONS = [
    { path: '/analytics', label: 'Overview' },
    { path: '/analytics/framework', label: 'Framework' },
    { path: '/analytics/posts', label: 'Posts' },
    { path: '/analytics/growth', label: 'Growth' },
    { path: '/analytics/audience', label: 'Audience' }
  ];
  const brand = $derived(page.url.searchParams.get('brand'));
  const href = (path: string) => (brand ? `${path}?brand=${brand}` : path);
</script>

<div class="an">
  <nav class="an-nav" aria-label="Analytics sections">
    <div class="an-nav-in">
      {#each SECTIONS as s}
        <a href={href(s.path)} aria-current={page.url.pathname === s.path ? 'page' : undefined}>{s.label}</a>
      {/each}
    </div>
  </nav>
  <main class="wrap">
    {@render children()}
  </main>
</div>

<style>
  .an-nav { background: #fff; border-bottom: 1px solid #e4e2d8; }
  .an-nav-in { max-width: 1240px; margin: 0 auto; padding: 0 12px; display: flex; flex-wrap: wrap; gap: 0 4px; }
  .an-nav a {
    color: #4a5560; text-decoration: none; padding: 0 12px; font-size: 14px; min-height: 44px; box-sizing: border-box;
    display: flex; align-items: center; border-bottom: 3px solid transparent;
  }
  .an-nav a:hover { color: #074974; }
  .an-nav a[aria-current='page'] { color: #074974; border-bottom-color: #ee8a22; font-weight: 600; }
</style>
