<script lang="ts">
  import { page } from '$app/state';
  import { BRANDS } from '$lib/brands';

  let { what }: { what: string } = $props();
  const href = (id: string) => {
    const q = new URLSearchParams(page.url.searchParams);
    q.set('brand', id);
    return `${page.url.pathname}?${q}`;
  };
</script>

<div class="bar"><span class="period">All of Emkay</span></div>
<h1>{what}</h1>
<p class="lede">Each brand has its own framework, audiences and accounts, so these pages show one brand at a time. Pick one.</p>
<div class="sections">
  {#each BRANDS as b}
    <a class="sec" href={href(b.id)}><h3>{b.name}</h3><p>See {b.short}’s {what.toLowerCase()}.</p></a>
  {/each}
</div>
