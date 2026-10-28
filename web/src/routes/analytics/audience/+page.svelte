<script lang="ts">
  import { audienceView } from '$lib/analytics/insights/audience';
  import { act, type State } from '$lib/analytics/insights/view';
  import BrandPicker from '$lib/analytics/ui/BrandPicker.svelte';

  let { data } = $props();
  let S = $state.raw<State>({});
  const set = (patch: State) => {
    S = { ...S, ...patch };
  };
  const V = $derived<any>(data.input ? audienceView(data.input, S, set) : null);
</script>

<svelte:head><title>Audience · Analytics · Emkay BAU</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && V?.dOpen && V.close()} />

{#if !V}
<BrandPicker what="Audience" />
{:else}
<div class="bar">
<span class="period"><strong>{data.input?.brandName}</strong>{#if V.periodText} · {V.periodText}{/if} · LinkedIn unless marked</span>
</div>
<h1>Are we reaching the people we want?</h1>
<p class="lede">Platforms describe the whole account’s followers and visitors, not who saw each post, and LinkedIn is the only one that gives industry, job and seniority. So this page is about the audience as a whole, export by export.</p>
{#if V.noData}<div class="card"><p style="margin: 0; line-height: 1.5">{V.noDataText}</p></div>{/if}
{#if V.hasData}
{#if V.single}<div class="card explain"><p>{V.historyNote}</p></div>{/if}

<section class="sect">
<p class="q">1</p>
<h2>Target audiences</h2>
<p class="h3sub">LinkedIn doesn’t record “investor” or “distributor”, so each audience is spotted by a rule (shown on each card, with how reliable it is). Solid line: share of all followers. Dashed line: share of the new followers between one export and the next; when it runs above the solid line, the audience is growing faster than the page. Audiences overlap, so shares don’t add up to 100%. The rules are drafts to refine with the content team.</p>
<div class="fcards">
{#each V.aud as a}
<div class="card">
<div class="tc-head"><p class="tc-name">{a.name}</p><span class={a.ccls}>{a.conf}</span></div>
<p class="note" style="margin: 0 0 6px">Rule: {a.rule}</p>
<p class="fnow">{a.now}</p>
<p class="k-sub">of followers{#if a.change} · <span class={a.dir}>{a.change}</span>{/if}{#if a.newNow} · {a.newNow}{/if}</p>
{#if !a.hasLine}<div class="ptr" style="margin-top: 8px"><span class="pbar up" style="width: {a.w}%"></span></div>{/if}
{#if a.hasLine}<svg class="chart" viewBox="0 0 360 190" role="img" aria-label={a.aria}>
<polyline points={a.lineNew} fill="none" stroke="#ee8a22" stroke-width="2" stroke-dasharray="5 4"></polyline>
<polyline points={a.line} fill="none" stroke="#074974" stroke-width="2.5"></polyline>
{#each a.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="4" fill="#074974"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="9" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text><text x={d.x} y="182" font-size="9" fill="#4a5560" text-anchor="middle">{d.m}</text>{/each}
{#each a.ptsNew as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="3" fill="#ee8a22"><title>{d.peek}</title></circle>{/each}
<text x={a.newLX} y={a.newLY} font-size="9" font-weight="700" fill="#a85a00" text-anchor="end">{a.newLabel}</text>
</svg>
<div class="legend" style="margin-top: 2px"><span><span class="sw" style="background: #074974"></span>All followers</span><span><span class="sw" style="background: #ee8a22"></span>New followers</span></div>{/if}
</div>
{/each}
</div>
</section>

<section class="sect">
<p class="q">2</p>
<h2>Are we growing beyond financial services?</h2>
<p class="h3sub">Share of followers outside financial services (Financial Services, Banking, Investment Banking, Investment Management, Insurance, Capital Markets, Venture Capital and Private Equity), and the industries on each side.</p>
<div class="card stand"><p><strong>{V.fsText}</strong></p></div>
{#if V.multi}<div class="card cbox">
<svg class="chart" viewBox="0 0 760 230" role="img" aria-label={V.fsAria}>
{#each V.fsGrid as g}<line x1="50" y1={g.y} x2="740" y2={g.y} stroke="#eeece3"></line><text x="44" y={g.ty} font-size="10" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
<polyline points={V.fsLine} fill="none" stroke="#215224" stroke-width="3"></polyline>
{#each V.fsPts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="5" fill="#215224"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text><text x={d.x} y="222" font-size="11" fill="#4a5560" text-anchor="middle">{d.m}</text>{/each}
</svg>
</div>{/if}
<div class="two" style="margin-top: 16px">
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Biggest industries outside financial services</p>
{#each V.indOut as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar fs-out" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class={r.ccls}>{r.change}</span></span></div>{/each}
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 6px">Financial services industries</p>
{#each V.indIn as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class={r.ccls}>{r.change}</span></span></div>{/each}
</div>
</div>
<p class="note">Shares are of all followers. Change is in percentage points since the previous export.</p>
</section>

<section class="sect">
<p class="q">3</p>
<h2>Seniority split</h2>
<p class="h3sub">Followers by seniority at each export, grouped into future talent (training and entry level), mid-career (senior and manager) and decision makers (Director and above). Below: all followers against new followers (once there are two exports) and page visitors.</p>
<div class="card cbox">
<svg class="chart" viewBox="0 0 760 300" role="img" aria-label={V.senAria}>
{#each V.senCols as c}
{#each c.segs as s}<rect x={c.x} y={s.y} width={c.w} height={s.h} fill={s.color} stroke="#ffffff" stroke-width="1"><title>{s.peek}</title></rect><text x={c.cx} y={s.ty} font-size="10" font-weight="700" fill={s.tc} text-anchor="middle">{s.label}</text>{/each}
<text x={c.cx} y="292" font-size="11" fill="#4a5560" text-anchor="middle">{c.m}</text>
{/each}
</svg>
<div class="legend">{#each V.senKeys as k}<span><span class="sw" style="background: {k.color}"></span>{k.name}</span>{/each}</div>
</div>
<div class="card" style="margin-top: 16px">
{#each V.senCompare as r}
<div class="sc-row"><span class="sc-l">{r.name}</span><div class="stack2">{#each r.segs as s}<span style="width: {s.w}%; background: {s.color}; color: {s.tc}" title={s.peek}>{s.label}</span>{/each}</div></div>
{/each}
<div class="grp3">{#each V.senGroups as g}<div><p class="dr-k">{g.name}</p><p class="fnow" style="font-size: 22px">{g.now}</p><p class="k-sub">{#if g.change}<span class={g.dir}>{g.change}</span> · {/if}{g.newNow}{#if g.newNow && g.visNow} · {/if}{g.visNow}</p></div>{/each}</div>
</div>
</section>

<section class="sect">
<p class="q">4</p>
<h2>Who follows us?</h2>
<div class="crow"><span class="clabel">By</span>{#each V.whoDims as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="two">
<div class="card"><p class="dr-k" style="margin-bottom: 6px">LinkedIn followers by {V.whoName}</p>
{#each V.who as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class={r.ccls}>{r.change}</span></span></div>{/each}
<p class="note" style="margin: 8px 0 0">Top 10. Change is in percentage points since the previous export.</p>
</div>
<div class="card"><p class="dr-k" style="margin-bottom: 6px">YouTube views{#if V.hasYtAud}, {V.ytPeriod}{/if}</p>
{#if !V.hasYtAud}<p class="note" style="margin: 0">No YouTube audience export for this brand yet.</p>{/if}
{#if V.hasYtAud}<p class="pc-l">By country</p>
{#each V.ytCountry as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar yt" style="width: {r.w}%"></span></div><span class="pv">{r.v}</span></div>{/each}
<p class="pc-l">By traffic source</p>
{#each V.ytSource as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar yt" style="width: {r.w}%"></span></div><span class="pv">{r.v}</span></div>{/each}
<p class="pc-l">By content type</p>
{#each V.ytType as r}<div class="brow2"><span>{r.name}</span><div class="ptr"><span class="pbar yt" style="width: {r.w}%"></span></div><span class="pv">{r.v}</span></div>{/each}{/if}
<p class="note" style="margin: 8px 0 0">YouTube’s export gives country, traffic source and content type but not age. Instagram and X exports don’t include audience details.</p>
</div>
</div>
</section>

<section class="sect">
<p class="q">5</p>
<h2>Who visits but doesn’t follow?</h2>
<p class="h3sub">LinkedIn page visitors ({V.visPeriod}) against followers. Where a group is a bigger share of visitors than of followers, those people come to look but don’t stay: a chance to give them a reason to follow.</p>
{#if !V.hasVis}<div class="card"><p style="margin: 0">No LinkedIn visitors export for this brand yet.</p></div>{/if}
{#if V.hasVis}<div class="crow"><span class="clabel">By</span>{#each V.visDims as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="card">
<div class="vis-row vis-head"><span></span><span>Share of visitors and of followers</span><span>Gap</span></div>
{#each V.vis as r}
<div class="vis-row"><span class="vis-n">{r.name}</span><div class="vis-bars"><div class="vb"><div class="ptr"><span class="pbar vis" style="width: {r.vw}%"></span></div><span class="pv">{r.vv}</span></div><div class="vb"><div class="ptr"><span class="pbar up" style="width: {r.fw}%"></span></div><span class="pv">{r.fv}</span></div></div><span class={r.gcls}>{r.gap}</span></div>
{/each}
<div class="legend"><span><span class="sw" style="background: #b5541c"></span>Visitors</span><span><span class="sw" style="background: #074974"></span>Followers</span><span>Gap = visitors’ share minus followers’ share</span></div>
</div>{/if}
<div class="two" style="margin-top: 16px">
<div class="card stand"><p class="dr-k" style="margin-bottom: 6px">What stands out</p>{#each V.visStand as s}<p>{s}</p>{/each}</div>
<div class="card"><p class="dr-k" style="margin-bottom: 4px">Follow rate: new followers per 100 unique page visitors</p>
{#if !V.hasFr}<p class="note" style="margin: 0">Needs LinkedIn’s followers and visitors exports.</p>{/if}
{#if V.hasFr}<svg class="chart" viewBox="0 0 360 170" role="img" aria-label={V.frAria}><polyline points={V.frLine} fill="none" stroke="#074974" stroke-width="2.5"></polyline>{#each V.frPts as d}<circle cx={d.x} cy={d.y} r="3.5" fill="#074974"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="9" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text><text x={d.x} y="162" font-size="9" fill="#4a5560" text-anchor="middle">{d.m}</text>{/each}</svg>
<p class="note" style="margin: 4px 0 0">Many people follow from a post without visiting the page, so this can go above 100. Watch the trend rather than the level.</p>{/if}
</div>
</div>
</section>

<section class="sect">
<p class="q">6</p>
<h2>Which periods brought in the most target-audience followers?</h2>
<p class="h3sub">Each target audience’s share of new followers between one export and the next. Highlighted cells jumped 4 points or more above the previous 3 periods. Click a period to see what was posted then: it may hint at what drew them in, but can’t prove it.</p>
{#if V.jNone}<div class="card"><p style="margin: 0">Needs two LinkedIn follower exports or more: each new export adds a column.</p></div>{/if}
{#if V.jHas}<div class="scroll">
<table class="mx" style="min-width: 900px">
<thead><tr><th>Audience</th>{#each V.jMonths as m}<th style="text-align: center">{m}</th>{/each}</tr></thead>
<tbody>{#each V.jump as r}<tr><td><strong>{r.name}</strong></td>{#each r.cells as c}<td class={c.cls} title={c.peek} {...act(c.open)}>{c.v}<small>{c.d}</small></td>{/each}</tr>{/each}</tbody>
</table>
</div>
<div class="legend"><span><span class="sw hv3"></span>jumped 4 points or more</span><span>Small number = change on the previous 3 periods’ average</span></div>{/if}
</section>
{/if}

{#if V.dOpen}
<div class="dr-back" {...act(V.close)}></div>
<aside class="drawer" aria-label="Posts">
<div class="dr-head"><div><p class="dr-k">{V.dKicker}</p><h3>{V.dTitle}</h3><p class="note" style="margin: 0">{V.dMeta}</p></div><button class="dr-x" onclick={V.close} aria-label="Close">×</button></div>
<div class="dr-body">
<ol class="dr-list">{#each V.dRows as r}<li><p class="dr-t">{r.title}</p><div class="dr-chips"><span class={r.ccls}>{r.chip}</span></div><p class="dr-m">{r.meta}</p><div class="dr-links">{#each r.links as l}{#if l.hasUrl}<a href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>{/if}{#if l.noUrl}<span>{l.label}</span>{/if}{/each}</div></li>{/each}</ol>
<p class="note">{V.dNote}</p>
</div>
</aside>
{/if}
{/if}
