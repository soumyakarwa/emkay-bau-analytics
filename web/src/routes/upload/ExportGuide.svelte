<script lang="ts">
  // What to export from each platform, and for which dates, worked out for the cycle that last
  // ended. The same guide is in the main README.

  import { PLATFORMS } from '$lib/analytics/catalog';
  import { cycleDates, lastDoneCycle } from '$lib/analytics/cycle';

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const cycle = lastDoneCycle(today);
  const name = new Date(`${cycle}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const span = cycleDates(cycle, true);
  const dates = (rule: string) => (rule === 'cycle' ? span : rule === 'rolling' ? 'Last 365 days' : 'Any period');
</script>

<details class="card guide" open>
  <summary>What to export: the {name} cycle, {span}</summary>
  <ul class="rules">
    <li>The month runs from the <strong>25th to the 24th</strong>. Pull the exports on or after the 25th, once the cycle has ended, and upload them all here at once.</li>
    <li>LinkedIn, X and Instagram posts: export the <strong>last 365 days</strong>. Their figures are day by day or per post, so the site sorts them into cycles itself.</li>
    <li>YouTube and the Instagram overview: set a <strong>custom date range of exactly {span}</strong>. They only give totals for the dates you pick, so other dates can't be split into cycles.</li>
    <li>Upload the files exactly as the platforms give them. Don't open and re-save them in Excel first.</li>
  </ul>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Platform</th><th>File</th><th>Dates</th><th>Where to find it</th></tr></thead>
      <tbody>
        {#each PLATFORMS as p}
          {#each p.files as f, i}
            <tr>
              <td>{#if i === 0}<strong>{p.label}</strong>{/if}</td>
              <td>{f.label}{#if f.optional}<span class="sub">optional</span>{/if}</td>
              <td class:cycle={f.rule === 'cycle'}>{dates(f.rule)}</td>
              <td>{f.help}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
  <p class="note">Posts from the cycle’s last week are less than 7 days old when you export, so they show as “still settling” at the review and are ranked at the next one.</p>
</details>

<style>
  .guide { margin-bottom: 16px; }
  .guide summary { cursor: pointer; font-weight: 700; }
  .rules { margin: 10px 0; padding-left: 20px; line-height: 1.5; }
  .cycle { font-weight: 600; white-space: nowrap; }
</style>
