<script lang="ts">
  import { growthView } from '$lib/analytics/insights/growth';
  import { act, type State } from '$lib/analytics/insights/view';
  import BrandPicker from '$lib/analytics/ui/BrandPicker.svelte';

  let { data } = $props();
  let S = $state.raw<State>({});
  const set = (patch: State) => {
    S = { ...S, ...patch };
  };
  const V = $derived<any>(data.input ? growthView(data.input, S, set) : null);
</script>

<svelte:head><title>Growth · Analytics · Emkay BAU</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && V?.dOpen && V.close()} />

{#if !V}
<BrandPicker what="Growth" />
{:else}
<div class="bar">
<span class="period"><strong>{data.input?.brandName}</strong>{#if V.periodText} · {V.periodText}{/if}</span>
</div>
<h1>Are we growing?</h1>
<p class="lede">The accounts month by month: followers, reach, engagement and attention, what drove each month, how much was paid for, and how we compare with peers. Click any month for the posts behind it.</p>

{#if V.noData}<div class="card"><p style="margin: 0; line-height: 1.5">{V.noDataText}</p></div>{/if}
{#if V.hasData}
<div class="tiles">
{#each V.tiles as t}
<div class="card tile"><p class="k-label">{t.label}</p><p class="k-val">{t.value}</p><p class="k-sub"><span class={t.dir}>{t.change}</span> {t.vs}</p></div>
{/each}
</div>

<section class="sect">
<p class="q">1</p>
<h2>Followers on each platform</h2>
<p class="h3sub">Followers at the end of each month, and net new followers each month. Platforms export gains and losses, not totals, so totals are worked back from the count noted on the upload page; “~” marks an estimate. Bars below zero (orange) are months with more unfollows than follows.</p>
<div class="fcards">
{#each V.fol as f}
<div class="card">
<div class="tc-head"><p class="tc-name"><span class="pk" style="background: {f.color}">{f.letter}</span> {f.name}</p>{#if f.hasGoal}<span class={f.gcls}>{f.gtext}</span>{/if}</div>
<p class="fnow">{f.now}</p>
<p class="k-sub"><span class="up">{f.month}</span> {f.monthName} · <span class="up">{f.year}</span> net over 12 months</p>
<svg class="chart" viewBox="0 0 360 226" role="img" aria-label={f.aria}>
{#if f.hasGoal}<line x1="20" y1={f.goalY} x2="350" y2={f.goalY} stroke="#1d2329" stroke-dasharray="6 4"></line><text x="350" y={f.goalTY} font-size="11" font-weight="700" fill="#1d2329" text-anchor="end">{f.goalLabel}</text>{/if}
{#if f.hasLine}<polyline points={f.line} fill="none" stroke={f.color} stroke-width="2.5"></polyline>
{#each f.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="4" fill={f.color}><title>{d.peek}</title></circle>{/each}
<text x={f.firstX} y={f.firstLY} font-size="11" font-weight="700" fill="#1d2329" text-anchor="start">{f.first}</text>
<text x={f.lastX} y={f.lastLY} font-size="11" font-weight="700" fill="#1d2329" text-anchor="end">{f.last}</text>{/if}
<text x="20" y="122" font-size="10" font-weight="700" fill="#3a4148">Net new followers each month</text>
<line x1="20" y1="186" x2="350" y2="186" stroke="#8a8c8e"></line>
{#each f.bars as b}<rect class="hit" {...act(b.open)} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill}><title>{b.peek}</title></rect><text x={b.cx} y={b.ly} font-size="9" font-weight="700" fill="#1d2329" text-anchor="middle">{b.label}</text><text x={b.cx} y="200" font-size="9" fill="#4a5560" text-anchor="middle">{b.m}</text>{/each}
<text x="26" y="218" font-size="9" fill="#4a5560">{f.firstYear}</text>{#if f.hasYearMark}<text x={f.yearX} y="218" font-size="9" fill="#4a5560">{f.nextYear} →</text>{/if}
</svg>
{#each f.notes as n}<p class="note" style="margin: 4px 0 0">{n}</p>{/each}
{#if f.hasGoal}
<div class="gprog"><div class="ptr"><span class="pbar up" style="width: {f.goalW}%"></span></div><p class="note" style="margin: 4px 0 0">{f.goalText}</p></div>
{/if}
</div>
{/each}
</div>
</section>

<section class="sect">
<p class="q">2</p>
<h2>Are more people seeing us?</h2>
<p class="h3sub">Impressions (views on YouTube) each month, organic and sponsored apart. Click a month to see what drove it, in section 5.</p>
<div class="crow"><span class="clabel">Platform</span>{#each V.rPlats as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="card cbox">
<svg class="chart" viewBox="0 0 760 300" role="img" aria-label={V.reachAria}>
{#each V.reachGrid as g}<line x1="60" y1={g.y} x2="740" y2={g.y} stroke="#e4e2d8"></line><text x="52" y={g.ty} font-size="11" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
<line x1="60" y1="260" x2="740" y2="260" stroke="#4a5560"></line>
{#each V.reach as c}
<rect class="hit" {...act(c.open)} x={c.x} y={c.yo} width={c.w} height={c.ho} fill="#074974"><title>{c.peek}</title></rect>
<rect class="hit" {...act(c.open)} x={c.x} y={c.ys} width={c.w} height={c.hs} fill="#fcb537"><title>{c.peek}</title></rect>
<text x={c.cx} y={c.ty} font-size="10" font-weight="700" fill="#1d2329" text-anchor="middle">{c.total}</text>
<text x={c.cx} y="278" font-size="11" fill="#4a5560" text-anchor="middle">{c.m}</text>
{/each}
</svg>
<div class="legend"><span><span class="sw" style="background: #074974"></span>Organic</span><span><span class="sw" style="background: #fcb537"></span>Sponsored</span></div>
<details><summary>Show as a table</summary><div class="scroll" style="border: 0"><table style="min-width: 480px"><thead><tr><th>Month</th><th class="num">Organic</th><th class="num">Sponsored</th><th class="num">Total</th></tr></thead><tbody>{#each V.reach as c}<tr><td>{c.mFull}</td><td class="num">{c.org}</td><td class="num">{c.spo}</td><td class="num">{c.totalFull}</td></tr>{/each}</tbody></table></div></details>
</div>
<div class="card stand" style="margin-top: 12px">{#each V.reachStand as s}<p>{s}</p>{/each}</div>
</section>

<section class="sect">
<p class="q">3</p>
<h2>Are people engaging more, or are we just posting more?</h2>
<p class="h3sub">Top: all likes, comments, shares and saves each month. Bottom: the same per post, with the number of posts. If the top rises but the bottom doesn’t, the growth came from posting more, not from better posts.</p>
<div class="card cbox">
<svg class="chart" viewBox="0 0 760 420" role="img" aria-label={V.engAria}>
<text x="60" y="14" font-size="12" font-weight="700" fill="#3a4148">Interactions per month</text>
<line x1="60" y1="170" x2="740" y2="170" stroke="#4a5560"></line>
{#each V.eng as c}<rect class="hit" {...act(c.open)} x={c.x} y={c.y} width={c.w} height={c.h} fill="#074974"><title>{c.peek}</title></rect><text x={c.cx} y={c.ty} font-size="10" font-weight="700" fill="#1d2329" text-anchor="middle">{c.label}</text>{/each}
<text x="60" y="214" font-size="12" font-weight="700" fill="#3a4148">Interactions per post</text>
<polyline points={V.perPostLine} fill="none" stroke="#ee8a22" stroke-width="2.5"></polyline>
{#each V.perPostAll as d}{#if d.has}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="5" fill="#ee8a22"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="10" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/if}<text x={d.x} y="388" font-size="10" fill="#4a5560" text-anchor="middle">{d.posts}</text><text x={d.x} y="406" font-size="11" fill="#4a5560" text-anchor="middle">{d.m}</text>{/each}
<text x="20" y="388" font-size="10" fill="#4a5560">Posts</text>
</svg>
</div>
<div class="card stand" style="margin-top: 12px">{#each V.engStand as s}<p>{s}</p>{/each}</div>
</section>

<section class="sect">
<p class="q">4</p>
<h2>Are people paying attention? (YouTube)</h2>
{#if V.noYt}<div class="card"><p style="margin: 0">No YouTube exports for this brand yet.</p></div>{/if}
{#if V.hasYt}
<div class="two">
<div class="card"><p class="dr-k">Views per month</p>
<svg class="chart" viewBox="0 0 360 200" role="img" aria-label={V.ytViewsAria}><line x1="10" y1="170" x2="350" y2="170" stroke="#8a8c8e"></line>{#each V.ytViews as b}<rect class="hit" {...act(b.open)} x={b.x} y={b.y} width={b.w} height={b.h} fill="#4f7a28"><title>{b.peek}</title></rect><text x={b.cx} y={b.ly} font-size="9" font-weight="700" fill="#1d2329" text-anchor="middle">{b.label}</text><text x={b.cx} y="186" font-size="9" fill="#4a5560" text-anchor="middle">{b.m}</text>{/each}</svg>
</div>
<div class="card"><p class="dr-k">Watch hours per month</p>
<svg class="chart" viewBox="0 0 360 200" role="img" aria-label={V.ytHoursAria}><line x1="10" y1="170" x2="350" y2="170" stroke="#8a8c8e"></line>{#each V.ytHours as b}<rect class="hit" {...act(b.open)} x={b.x} y={b.y} width={b.w} height={b.h} fill="#8fb4cf"><title>{b.peek}</title></rect><text x={b.cx} y={b.ly} font-size="9" font-weight="700" fill="#1d2329" text-anchor="middle">{b.label}</text><text x={b.cx} y="186" font-size="9" fill="#4a5560" text-anchor="middle">{b.m}</text>{/each}</svg>
</div>
</div>
<div class="card stand" style="margin-top: 12px">{#each V.ytStand as s}<p>{s}</p>{/each}</div>
{/if}
</section>

<section class="sect" id="drivers">
<p class="q">5</p>
<h2>What drove {V.dMonthName}?</h2>
<p class="h3sub">The posts that reached the most people and brought in the most new followers that month. Pick a month, or click one in any chart above.</p>
<div class="crow"><span class="clabel">Month</span>{#each V.dMonths as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
{#if V.dNone}<div class="card"><p style="margin: 0; line-height: 1.5">{V.dNoneText}</p></div>{/if}
{#if V.dHas}
<div class="two">
<div class="card"><p class="dr-k" style="margin-bottom: 4px">Reached the most people</p>
{#each V.dReach as r}<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.share}</span></span></div>{/each}
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 4px">Brought in the most new followers (Instagram)</p>
{#each V.dFollow as r}<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class="pbar ig" style="width: {r.w}%"></span></div><span class="pv">{r.v}</span></div>{/each}
{#if V.dFollowNone}<p class="note" style="margin: 0">No Instagram posts with follow figures this month.</p>{/if}
<p class="note" style="margin: 8px 0 0">Only Instagram says which post brought each new follower. Other platforms give follower gains by day, not by post.</p>
</div>
</div>
{/if}
</section>

<section class="sect">
<p class="q">6</p>
<h2>How much of the growth is paid?</h2>
<p class="h3sub">New LinkedIn followers each month from organic posts and from sponsored ones (LinkedIn’s export splits the two), and the sponsored share of impressions. Other platforms don’t split followers this way.</p>
{#if V.hasPaid}<div class="card cbox">
<svg class="chart" viewBox="0 0 760 260" role="img" aria-label={V.paidAria}>
<line x1="60" y1="220" x2="740" y2="220" stroke="#4a5560"></line>
{#each V.paid as c}
<rect class="hit" {...act(c.open)} x={c.x} y={c.yo} width={c.w} height={c.ho} fill="#074974"><title>{c.peek}</title></rect>
<rect class="hit" {...act(c.open)} x={c.x} y={c.ys} width={c.w} height={c.hs} fill="#fcb537"><title>{c.peek}</title></rect>
<text x={c.cx} y={c.ty} font-size="10" font-weight="700" fill="#1d2329" text-anchor="middle">{c.label}</text>
<text x={c.cx} y="238" font-size="11" fill="#4a5560" text-anchor="middle">{c.m}</text>
<text x={c.cx} y="254" font-size="10" fill="#a85a00" text-anchor="middle">{c.spShare}</text>
{/each}
<text x="20" y="254" font-size="10" fill="#a85a00">Paid</text>
</svg>
<div class="legend"><span><span class="sw" style="background: #074974"></span>New followers, organic</span><span><span class="sw" style="background: #fcb537"></span>New followers, sponsored</span><span>Bottom row: sponsored share of LinkedIn impressions</span></div>
</div>{/if}
<div class="card stand" style="margin-top: 12px">{#each V.paidStand as s}<p>{s}</p>{/each}</div>
</section>

<section class="sect">
<p class="q">7</p>
<h2>How do we compare with peers? (LinkedIn)</h2>
{#if V.noPeers}<div class="card"><p style="margin: 0; line-height: 1.5">No LinkedIn competitor export for this brand yet. Upload one on the Upload page and the comparison appears here.</p></div>{/if}
{#if V.hasPeers}
<p class="h3sub">{V.peersText}</p>
<div class="two">
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Follower growth over the period</p>
{#each V.peerGrowth as r}<div class={r.cls}><span>{r.name}</span><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.sub}</span></span></div>{/each}
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Likes, comments and reposts per post</p>
{#each V.peerEng as r}<div class={r.cls}><span>{r.name}</span><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.sub}</span></span></div>{/each}
</div>
</div>
{/if}
</section>
{/if}

{#if V.dOpen}
<div class="dr-back" {...act(V.close)}></div>
<aside class="drawer" aria-label="Post figures">
<div class="dr-head"><div><p class="dr-k">{V.dKicker}</p><h3>{V.dTitle}</h3><p class="note" style="margin: 0">{V.dMeta}</p></div><button class="dr-x" onclick={V.close} aria-label="Close">×</button></div>
<div class="dr-body">
<ol class="dr-list">{#each V.dRows as r}<li><p class="dr-t">{r.title}</p><div class="dr-chips"><span class={r.ccls}>{r.chip}</span></div><p class="dr-m">{r.meta}</p><div class="dr-links">{#each r.links as l}{#if l.hasUrl}<a href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>{/if}{#if l.noUrl}<span>{l.label}</span>{/if}{/each}</div></li>{/each}</ol>
<p class="note">{V.dNote}</p>
</div>
</aside>
{/if}
{/if}
