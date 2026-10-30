<script lang="ts">
  import { overviewView } from '$lib/analytics/insights/overview';
  import BrandPicker from '$lib/analytics/ui/BrandPicker.svelte';

  let { data } = $props();
  const link = (p: string, tab?: string) => `/analytics/${p}?brand=${data.brand}${tab ? `&tab=${tab}` : ''}`;
  const V = $derived<any>(data.input ? overviewView(data.input, link) : null);
  const PROBLEM: Record<string, string> = { 'not-linkedin': 'Wrong link', 'not-found': 'Link not in the export', missing: 'Link missing' };
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head><title>Overview · Analytics · Emkay BAU</title></svelte:head>

{#if !V}
<BrandPicker what="Analytics" />
{:else}
<div class="bar">
<span class="period">{V.periodText}</span>
</div>
<h1>{V.name}: how did {V.mName} go?</h1>
<p class="lede">The headline numbers, what needs a look, and what to try next. Everything here comes from the other pages; follow the links for the detail.</p>

<div class="tiles">
{#each V.tiles as t}
<div class="card tile"><p class="k-label">{t.label}</p><p class="k-val">{t.value}</p><p class="k-sub"><span class={t.dir}>{t.change}</span> {t.vs}</p></div>
{/each}
</div>

<section class="sect">
<h2>Needs a look ({V.flagCount})</h2>
<p class="h3sub">Raised automatically from the other pages. Warnings first, then good news, then things to check.</p>
<div class="flags-list">
{#each V.flags as f}
<div class="fl-row"><span class={f.cls}>{f.kind}</span><p class="fl-t">{f.text}</p><a class="fl-go" href={f.href}>{f.go} →</a></div>
{/each}
</div>
{#if V.noFlags}<p class="note">Nothing to flag this month.</p>{/if}
</section>

{#if V.hasFw}
<section class="sect">
<h2>The framework in {V.mName}</h2>
<p class="h3sub">How {V.mName}’s posts split across the comms tasks, how they were received, and how each comms task stands against its target for the year.</p>
<div class="card">
<div class="ft-row ft-head"><span>Comms task</span><span>Share of {V.mName}’s posts</span><span class="num">Result</span><span>Target, year so far</span></div>
{#each V.fwRows as r}
<div class="ft-row"><span><span class="tsw" style="background: {r.color}"></span><strong>{r.name}</strong></span><div class="ft-share"><div class="ptr"><span class="pbar" style="width: {r.w}%; background: {r.color}"></span></div><span class="pn">{r.share}</span></div><span class="num"><span class={r.rcls}>{r.result}</span></span><span><span class={r.tcls}>{r.target}</span></span></div>
{/each}
<p class="note" style="margin: 10px 0 0">Result = how the comms task’s posts did against typical posts of the same format on the same platform (1.0× = typical). <a href={link('framework', 'A')}>See the full split and performance →</a></p>
</div>
</section>

<section class="sect">
<h2>What to try next</h2>
<p class="h3sub">The top suggestion from each group in Framework › What to change (last 3 months).</p>
<div class="e-cards">
{#each V.ideas as i}
<div class="card e-card"><span class={i.cls}>{i.group}</span><p class="e-t" style="margin-top: 8px">{i.name}</p><p class="sub" style="margin: 0 0 8px">{i.path}</p><p class="e-try"><strong>Try:</strong> {i.try}</p></div>
{/each}
</div>
<p class="note"><a href={link('framework', 'E')}>See every suggestion and the evidence behind it →</a></p>
</section>
{/if}

{#if V.hasPosts}
<section class="sect">
<h2>{V.mName}’s best and least received posts</h2>
<div class="two">
<div class="card"><p class="dr-k" style="margin-bottom: 4px">Best received</p>
{#each V.best as r}<div class="prow"><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class={r.bcls} style="width: {r.w}%"></span><span class="pmid" style="left: {r.mid}%"></span></div><span class="pv">{r.v}</span></div>{/each}
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 4px">Least received</p>
{#each V.worst as r}<div class="prow"><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class={r.bcls} style="width: {r.w}%"></span><span class="pmid" style="left: {r.mid}%"></span></div><span class="pv">{r.v}</span></div>{/each}
</div>
</div>
<p class="note"><a href={link('posts')}>See every post and its figures →</a></p>
</section>
{/if}

{#if V.hasSettledSince}
<section class="sect">
<h2>Settled since last review</h2>
<p class="h3sub">Posts from the last days of {V.prevName}’s cycle were still settling (less than 7 days old) at the last review. They have settled now.</p>
<div class="card">
{#each V.settledSince as r}<div class="prow"><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><span></span><span class="pv"><span class={r.cls}>{r.v}</span></span></div>{/each}
</div>
</section>
{/if}

{#if V.noFw}
<section class="sect"><div class="card"><p style="margin: 0; line-height: 1.5">{V.noFwText} Growth and audience are below.</p></div></section>
{/if}

{#if V.hasAud}
<section class="sect">
<h2>Audience at a glance</h2>
<div class="two">
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Target audiences, share of followers</p>
{#each V.audRows as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.now}<span class={r.ccls}>{r.change}</span></span></div>{/each}
<p class="note" style="margin: 8px 0 0">Spotted by draft rules; see the Audience page. {V.audNote}</p>
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Seniority, share of followers</p>
{#each V.senRows as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar" style="width: {r.w}%; background: {r.color}"></span></div><span class="pv">{r.now}<span class={r.ccls}>{r.change}</span></span></div>{/each}
<p class="note" style="margin: 8px 0 0">Followers outside financial services: <strong>{V.fsNow}</strong>.</p>
</div>
</div>
<p class="note"><a href={link('audience')}>See the full audience picture →</a></p>
</section>
{/if}

{#if data.fixes.length}
<section class="sect">
<h2>Data checks: LinkedIn links to fix in the calendar ({data.fixes.length})</h2>
<p class="h3sub">Until these are fixed, these posts’ figures can’t be matched to their pegs, so they are left out of the framework.</p>
<div class="flags-list">
{#each data.fixes as f}
<div class="fl-row"><span class="kind k-warn">{PROBLEM[f.problem]}</span><div><p class="fl-t"><strong>{f.post.title ?? 'No title'}</strong> · {day(f.post.date)} · {f.post.sheet}, row {f.post.row}</p><p class="fl-t">{f.message}</p>{#each f.candidates as c}<p class="fl-t">{f.candidates.length === 1 ? 'Probably' : 'Possibly'}: <a href={c.link} target="_blank" rel="noopener noreferrer">{day(c.created)}: {c.title || 'No text'}</a></p>{/each}</div><span></span></div>
{/each}
</div>
</section>
{/if}

<section class="sect">
<h2>Pages</h2>
<div class="sections">
<a class="sec" href={link('framework', 'A')}><h3>Framework</h3><p>Is the framework getting its due, and is it working? Split, performance, platforms, format and timing, and what to change.</p></a>
<a class="sec" href={link('posts')}><h3>Posts</h3><p>How each post did: best and least received, YouTube watch time, Instagram follows, and every post with its figures.</p></a>
<a class="sec" href={link('growth')}><h3>Growth</h3><p>Followers, reach, engagement and attention month by month, what drove each month, paid growth, and peers.</p></a>
<a class="sec" href={link('audience')}><h3>Audience</h3><p>Target audiences, growth beyond financial services, seniority, who visits but doesn’t follow.</p></a>
</div>
</section>
{/if}
