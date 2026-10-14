<script lang="ts">
  import { page } from '$app/state';
  import { BRANDS } from '$lib/brands';

  let { data, form } = $props();
  const brandNames = $derived(data.uploadBrands.map((id) => BRANDS.find((b) => b.id === id)?.name ?? id));
</script>

<svelte:head>
  <title>Sign in · Emkay BAU</title>
</svelte:head>

<div class="page">
  <form method="POST" action="?{page.url.searchParams}" class="card">
    <h1>Sign in</h1>
    {#if data.signedIn}
      <p class="lede">
        You are signed in{brandNames.length ? ` and can upload for ${brandNames.join(', ')}` : ' to view the site'}.
        Enter a brand's upload password to upload for it too.
      </p>
    {:else}
      <p class="lede">Enter the team password to view the calendar, or your brand's upload password to also upload its workbook.</p>
    {/if}
    <label>
      <span>Password</span>
      <input type="password" name="password" autocomplete="current-password" required />
    </label>
    {#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
    <button type="submit">Sign in</button>
  </form>
</div>

<style>
  .page { max-width: 440px; margin: 0 auto; padding: 48px 16px; }
  .card { background: var(--surface-2); border: 1px solid var(--border); border-top: 4px solid var(--growth-orange); border-radius: var(--radius); padding: 24px; display: grid; gap: 14px; }
  h1 { margin: 0; font-size: 22px; color: var(--band, var(--trust-teal)); }
  .lede { margin: 0; color: var(--text-secondary); }
  label { display: grid; gap: 6px; font-weight: 600; }
  label span { font-size: 13px; color: var(--text-secondary); }
  input { font: inherit; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1); }
  .error { margin: 0; color: #8f1f1f; font-weight: 600; }
  button { justify-self: start; padding: 9px 22px; border-radius: 999px; border: 1px solid var(--growth-orange); background: var(--growth-orange); color: var(--text-primary); font-weight: 600; cursor: pointer; }
</style>
