<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { data, children } = $props();

  const nav = [
    { href: '/', label: 'Calendar' },
    { href: '/data', label: 'Data' }
  ];
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">
      <span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>
        <span class="eyebrow">Social media operations</span>
        <span class="name">SM BAU calendar</span>
      </span>
    </a>
    {#if data.role}
      <nav aria-label="Main">
        {#each nav as item}
          <a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
        {/each}
        {#if data.authEnabled}
          <form method="POST" action="/logout">
            <button type="submit">Sign out</button>
          </form>
        {/if}
      </nav>
    {/if}
  </div>
</header>

{#if data.isSample}
  <div class="banner" role="status">
    <div class="inner">
      <strong>Sample data.</strong>
      This is dummy content from the template.
      <a href="/data">Publish the real calendar</a> to replace it.
    </div>
  </div>
{/if}

{@render children()}

<style>
  .topbar {
    background: var(--brand);
    color: var(--brand-ink);
  }
  .inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .topbar .inner {
    min-height: 64px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    color: inherit;
    text-decoration: none;
  }
  .mark {
    display: grid;
    gap: 3px;
    width: 26px;
  }
  .mark i {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: #7fc79a;
  }
  .mark i:nth-child(2) {
    width: 70%;
    background: #e3b26b;
  }
  .mark i:nth-child(3) {
    width: 85%;
    background: #8fb1e8;
  }
  .eyebrow {
    display: block;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.65;
  }
  .name {
    display: block;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
  }
  nav {
    display: flex;
    gap: 4px;
  }
  nav form {
    display: contents;
  }
  nav a,
  nav button {
    border: 0;
    background: none;
    cursor: pointer;
    color: inherit;
    text-decoration: none;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    opacity: 0.75;
    font-weight: 500;
  }
  nav a:hover,
  nav button:hover {
    opacity: 1;
    background: rgb(255 255 255 / 0.08);
  }
  nav a[aria-current='page'] {
    opacity: 1;
    background: rgb(255 255 255 / 0.14);
  }
  .banner {
    background: var(--warn-bg);
    color: var(--warn);
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .banner .inner {
    display: block;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .banner a {
    color: inherit;
    font-weight: 600;
  }
  @media (max-width: 640px) {
    .inner {
      padding: 0 16px;
    }
    .eyebrow {
      display: none;
    }
  }
</style>
