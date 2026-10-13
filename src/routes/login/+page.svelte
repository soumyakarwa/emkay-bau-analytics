<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let busy = $state(false);
  const upgrading = $derived(data.role === 'viewer');
</script>

<svelte:head>
  <title>Sign in · SM BAU calendar</title>
</svelte:head>

<main class="page">
  <form
    class="card box"
    method="POST"
    use:enhance={() => {
      busy = true;
      return async ({ update }) => {
        await update();
        busy = false;
      };
    }}
  >
    <p class="kicker">{upgrading ? 'Publishing access' : 'Private site'}</p>
    <h1>{upgrading ? 'Enter the upload password' : 'Sign in'}</h1>
    <p class="muted">
      {upgrading
        ? 'Publishing a new calendar needs the upload password.'
        : 'Use the team password. Editors can use the upload password to also publish updates.'}
    </p>
    <label>
      <span>Password</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="password" name="password" autocomplete="current-password" required autofocus />
    </label>
    {#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}
    <button class="btn primary" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
  </form>
</main>

<style>
  .box {
    max-width: 400px;
    margin: 8vh auto 0;
    padding: 28px;
    display: grid;
    gap: 14px;
  }
  h1 {
    font-size: 24px;
  }
  .muted {
    color: var(--ink-2);
    margin: 0;
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--ink-2);
    font-weight: 500;
  }
  input {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 9px 10px;
    font-size: 15px;
  }
  .err {
    color: var(--danger);
    margin: 0;
  }
  button {
    justify-content: center;
  }
</style>
