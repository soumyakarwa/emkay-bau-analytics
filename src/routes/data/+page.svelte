<script lang="ts">
  import { enhance } from '$app/forms';
  import IssueList from '$lib/components/IssueList.svelte';
  import { monthLabel } from '$lib/core/calendar-view';

  let { data, form } = $props();

  let busy = $state(false);
  let fileName = $state('');

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const report = $derived(data.report);
  const errors = $derived(report?.issues.filter((i) => i.level === 'error').length ?? 0);
  const warnings = $derived(report?.issues.filter((i) => i.level === 'warning').length ?? 0);
  const sourceLabel = { upload: 'Uploaded file', sample: 'Built-in sample' } as const;

  const submit = () => {
    busy = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busy = false;
      fileName = '';
    };
  };
</script>

<svelte:head>
  <title>Data · SM BAU calendar</title>
</svelte:head>

<main class="page narrow">
  <p class="kicker">Data</p>
  <h1>Calendar workbook</h1>
  <p class="lead">
    The site shows whatever is in the content calendar Excel file. If the file breaks a rule below, the update is
    blocked and the site keeps the last valid version until the file is fixed.
  </p>

  <div class="grid">
    <section class="card block">
      <h2>Live on the site</h2>
      <dl>
        <dt>Source</dt>
        <dd>{sourceLabel[data.published.source.kind]}</dd>
        <dt>File</dt>
        <dd>{data.published.source.fileName}</dd>
        <dt>Published</dt>
        <dd>{data.published.source.kind === 'sample' ? 'Not yet — showing sample data' : fmt(data.published.generatedAt)}</dd>
        <dt>Months</dt>
        <dd>{data.published.months.map(monthLabel).join(', ') || '—'}</dd>
        <dt>Items</dt>
        <dd>{data.published.entries}</dd>
      </dl>
    </section>

    <section class="card block">
      <h2>Publish a new version</h2>
      {#if data.canPublish}
        <p>Save the calendar in Excel, then upload the .xlsx file here. It is checked before anything changes on the site.</p>
        <form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance={submit}>
          <label class="drop" class:has={fileName}>
            <input
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onchange={(e) => (fileName = e.currentTarget.files?.[0]?.name ?? '')}
            />
            <span>{fileName || 'Choose the calendar .xlsx file'}</span>
          </label>
          <button class="btn primary" disabled={busy || !fileName}>{busy ? 'Checking…' : 'Check and publish'}</button>
        </form>
      {:else}
        <p>Publishing a new calendar needs the upload password.</p>
        <a class="btn primary" href="/login?next=/data">Enter upload password</a>
      {/if}
      {#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}
      <p class="meta"><a href={data.templateUrl} download="sm-bau-calendar-template.xlsx">Download the template</a> (with sample rows) to start a new workbook.</p>
    </section>
  </div>

  {#if report}
    <section class="card block result" class:ok={report.published} class:blocked={!report.published} aria-live="polite">
      <div class="result-head">
        <div>
          <p class="kicker">Last check · {fmt(report.attemptedAt)}</p>
          <h2>
            {#if report.published}
              Published “{report.source.fileName}”
            {:else}
              Not published: “{report.source.fileName}” needs fixing
            {/if}
          </h2>
        </div>
        <p class="tally">
          <span class="e">{errors} error{errors === 1 ? '' : 's'}</span>
          <span class="w">{warnings} warning{warnings === 1 ? '' : 's'}</span>
        </p>
      </div>
      {#if report.published && report.summary}
        <p>{report.summary.entries} items across {report.summary.months.map(monthLabel).join(', ')}.</p>
      {:else if !report.published}
        <p>The site still shows the previous version. Fix the errors below in Excel, save, and upload again. Warnings don’t block publishing.</p>
      {/if}
      {#if report.issues.length}
        <IssueList issues={report.issues} />
      {/if}
    </section>
  {/if}

  <section class="card block">
    <h2>Rules for the Excel file</h2>
    <ul class="rules">
      {#each data.contract.rules as rule}<li>{rule}</li>{/each}
    </ul>

    <h3>Month sheets (one per month, named like “October 2026”)</h3>
    <table>
      <thead><tr><th>Header in row 1</th><th>Header</th><th>What goes in each row</th></tr></thead>
      <tbody>
        {#each data.contract.monthColumns as c}
          <tr><td>{c.header}</td><td>{c.required ? 'Must exist' : 'Optional'}</td><td>{c.description}</td></tr>
        {/each}
      </tbody>
    </table>

    <h3>“{data.contract.frameworkSheet}” sheet</h3>
    <table>
      <thead><tr><th>Header in row 1</th><th>Header</th><th>What goes in each row</th></tr></thead>
      <tbody>
        {#each data.contract.frameworkColumns as c}
          <tr><td>{c.header}</td><td>{c.required ? 'Must exist' : 'Optional'}</td><td>{c.description}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
</main>

<style>
  .narrow {
    max-width: 1040px;
  }
  h1 {
    font-size: 28px;
    margin-bottom: 8px;
  }
  .lead {
    color: var(--ink-2);
    max-width: 70ch;
    margin: 0 0 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  .block {
    padding: 20px;
    margin-bottom: 16px;
  }
  .grid .block {
    margin: 0;
  }
  h2 {
    font-size: 18px;
    margin-bottom: 10px;
  }
  h3 {
    font-size: 15px;
    margin: 20px 0 8px;
  }
  p {
    margin: 0 0 12px;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
    font-size: 14px;
  }
  dt {
    color: var(--ink-3);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 13px;
    color: var(--ink-3);
    margin-top: 12px;
  }
  .err {
    color: var(--danger);
  }
  form {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .drop {
    flex: 1 1 240px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    cursor: pointer;
    color: var(--ink-2);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .drop.has {
    border-style: solid;
    color: var(--ink);
  }
  .drop input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .drop:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .result {
    border-left: 4px solid var(--line-strong);
  }
  .result.ok {
    border-left-color: var(--ok);
  }
  .result.blocked {
    border-left-color: var(--danger);
  }
  .result-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .tally {
    display: flex;
    gap: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .tally .e {
    color: var(--danger);
  }
  .tally .w {
    color: var(--warn);
  }
  .rules {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  th {
    font-size: 12px;
    color: var(--ink-3);
    font-weight: 600;
  }
  td:first-child {
    font-weight: 600;
    white-space: nowrap;
  }
  td:nth-child(2) {
    color: var(--ink-2);
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
    }
    td:first-child {
      white-space: normal;
    }
  }
</style>
