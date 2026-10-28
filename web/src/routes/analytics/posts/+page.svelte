<script lang="ts">
  import { postsView } from '$lib/analytics/insights/posts';
  import { act, type State } from '$lib/analytics/insights/view';
  import BrandPicker from '$lib/analytics/ui/BrandPicker.svelte';

  let { data } = $props();
  let S = $state.raw<State>({});
  const set = (patch: State) => {
    S = { ...S, ...patch };
  };
  const V = $derived<any>(data.input ? postsView(data.input, S, set) : null);
</script>

<svelte:head><title>Posts · Analytics · Emkay BAU</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && V?.dOpen && V.close()} />

{#if !V}
<BrandPicker what="Posts" />
{:else}
<div class="bar">
<span class="period"><strong>{data.input?.brandName}</strong>{#if V.periodText} · {V.periodText}{/if}</span>
</div>
<h1>How did each post do?</h1>
<p class="lede">Every post, ranked fairly and with its full figures. Click any post for its numbers on each platform. Posts are ranked by the × result (see “How we measure” on the Framework page), so a carousel is only ever compared with carousels on the same platform. Posts that aren’t in the calendar are included, marked “not in the calendar”.</p>

{#if V.noPosts}
<div class="card"><p style="margin: 0; line-height: 1.5">{V.noPostsText}</p></div>
{/if}

{#if V.hasPosts}
<div class="crow"><span class="clabel">Period</span>{#each V.periods as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>

<section class="sect">
<p class="q">Ranking</p>
<h2>Best and least received posts ({V.pShort})</h2>
<p class="h3sub">Ranked by result. The bar runs from 0; the black line is a typical post (1.0×). {V.rankedNote}</p>
<div class="two">
<div class="card">
<p class="dr-k" style="margin-bottom: 4px">Best received</p>
{#each V.best as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}{#each r.plats as k}<span class="pk" style="background: {k.color}">{k.letter}</span>{/each}</p></div><div class="ptr"><span class={r.bcls} style="width: {r.w}%"></span><span class="pmid" style="left: {r.mid}%"></span></div><span class="pv">{r.v}</span></div>
{/each}
</div>
<div class="card">
<p class="dr-k" style="margin-bottom: 4px">Least received</p>
{#each V.worst as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}{#each r.plats as k}<span class="pk" style="background: {k.color}">{k.letter}</span>{/each}</p></div><div class="ptr"><span class={r.bcls} style="width: {r.w}%"></span><span class="pmid" style="left: {r.mid}%"></span></div><span class="pv">{r.v}</span></div>
{/each}
</div>
</div>
<div class="card stand" style="margin-top: 16px"><p class="dr-k" style="margin-bottom: 6px">What the best posts have in common</p>{#each V.traits as s}<p>{s}</p>{/each}</div>
{#if V.hasSettling}
<div class="card" style="margin-top: 16px">
<p class="dr-k" style="margin-bottom: 4px">Still settling: out less than 7 days, not ranked yet</p>
{#each V.settlingRows as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}{#each r.plats as k}<span class="pk" style="background: {k.color}">{k.letter}</span>{/each}</p></div><span class="note">{r.so}</span><span class="pv"></span></div>
{/each}
{#if V.settlingMore}<p class="note" style="margin: 8px 0 0">{V.settlingMore}</p>{/if}
</div>
{/if}
</section>

{#if V.hasYt}
<section class="sect">
<p class="q">YouTube</p>
<h2>YouTube: how much of each video is watched ({V.pShort})</h2>
<p class="h3sub">Average share of each video watched, longest-held first. The chart on the right is the median for each month.</p>
<div class="two">
<div class="card">
{#each V.yt as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class="pbar up" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.views}</span></span></div>
{/each}
{#if V.ytNone}<p class="note" style="margin: 0">No YouTube videos in this period.</p>{/if}
</div>
<div class="card">
<p class="dr-k" style="margin-bottom: 4px">Median share watched, month by month</p>
<svg class="chart" viewBox="0 0 360 200" role="img" aria-label={V.ytTrendAria}>
{#each V.pctGrid as g}<line x1="40" y1={g.y} x2="340" y2={g.y} stroke="#eeece3"></line><text x="34" y={g.ty} font-size="10" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
<polyline points={V.ytLine} fill="none" stroke="#4f7a28" stroke-width="2.5"></polyline>
{#each V.ytPts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="6" fill="#4f7a28"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/each}
{#each V.monthX as m}<text x={m.x} y="192" font-size="11" fill="#4a5560" text-anchor="middle">{m.label}</text>{/each}
</svg>
{#each V.ytCall as s}<p class="note" style="margin: 6px 0 0">{s}</p>{/each}
</div>
</div>
</section>

{/if}

{#if V.hasIg}
<section class="sect">
<p class="q">Instagram</p>
<h2>Instagram: which posts brought new followers ({V.pShort})</h2>
<p class="h3sub">Follows that came from each post, most first, with its saves and shares. The chart on the right is follows from posts each month.</p>
<div class="two">
<div class="card">
{#each V.ig as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class="pbar ig" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.extra}</span></span></div>
{/each}
{#if V.igNone}<p class="note" style="margin: 0">No Instagram posts in this period.</p>{/if}
</div>
<div class="card">
<p class="dr-k" style="margin-bottom: 4px">Follows from posts, month by month</p>
<svg class="chart" viewBox="0 0 360 200" role="img" aria-label={V.igTrendAria}>
<line x1="40" y1="170" x2="340" y2="170" stroke="#8a8c8e"></line>
{#each V.igBars as b}<rect class="hit" {...act(b.open)} x={b.x} y={b.y} width={b.w} height={b.h} fill="#b5541c"><title>{b.peek}</title></rect><text x={b.cx} y={b.ly} font-size="12" font-weight="700" fill="#1d2329" text-anchor="middle">{b.label}</text><text x={b.cx} y="188" font-size="11" fill="#4a5560" text-anchor="middle">{b.m}</text>{/each}
</svg>
</div>
</div>
</section>

{/if}

{#if V.hasLiX}
<section class="sect">
<p class="q">LinkedIn and X</p>
<h2>LinkedIn and X ({V.pShort})</h2>
<div class="two">
{#if V.hasLi}<div class="card">
<p class="dr-k" style="margin-bottom: 4px">LinkedIn: clicks per 1,000 impressions, by format</p>
<p class="note" style="margin: 0 0 8px">LinkedIn counts each carousel swipe as a click, so carousels always look high. Compare carousels with carousels.</p>
{#each V.liFormats as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.name}</p><p class="pm">{r.n}</p></div><div class="ptr"><span class="pbar li" style="width: {r.w}%"></span></div><span class="pv">{r.v}</span></div>
{/each}
<p class="dr-k" style="margin: 14px 0 4px">Most clicked posts (not counting carousels)</p>
{#each V.liTop as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><span></span><span class="pv">{r.v}</span></div>
{/each}
</div>{/if}
{#if V.hasX}<div class="card">
<p class="dr-k" style="margin-bottom: 4px">X: clicks and profile visits per post</p>
<p class="note" style="margin: 0 0 8px">{V.xNote}</p>
{#each V.xTop as r}
<div class="prow hit" title={r.peek} {...act(r.open)}><div><p class="pt">{r.title}</p><p class="pm">{r.meta}</p></div><div class="ptr"><span class="pbar x" style="width: {r.w}%"></span></div><span class="pv">{r.v}<span class="sub">{r.extra}</span></span></div>
{/each}
</div>{/if}
</div>
</section>

{/if}

<section class="sect">
<p class="q">All posts</p>
<h2>Every post ({V.pShort})</h2>
<div class="crow">
<label class="clabel" for="post-search">Search</label>
<input id="post-search" class="search" type="search" value={V.q} oninput={V.onQ} placeholder="Title, peg, pillar or format" autocomplete="off">
</div>
<div class="crow"><span class="clabel">Platform</span>{#each V.tPlats as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="crow"><span class="clabel">Sort</span>{#each V.tSorts as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<p class="note">{V.tCount}</p>
<div class="scroll">
<table style="min-width: 820px">
<thead><tr><th>Date</th><th>Post</th><th>Platforms</th><th class="num">{V.tImprHead}</th><th class="num">Interaction rate</th><th class="num">Result</th></tr></thead>
<tbody>{#each V.tRows as r}<tr class="hit" title={r.peek} {...act(r.open)}><td style="white-space: nowrap">{r.date}</td><td><strong>{r.title}</strong><span class="sub">{r.sub}</span></td><td>{#each r.plats as k}<span class="pk" style="background: {k.color}">{k.letter}</span> {/each}</td><td class="num">{r.impr}</td><td class="num">{r.rate}</td><td class="num"><span class={r.rcls}>{r.result}</span></td></tr>{/each}</tbody>
</table>
</div>
</section>
{/if}

{#if V.dOpen}
<div class="dr-back" {...act(V.close)}></div>
<aside class={V.dCls} aria-label="Post figures">
<div class="dr-head"><div><p class="dr-k">{V.dKicker}</p><h3>{V.dTitle}</h3><p class="note" style="margin: 0">{V.dMeta}</p><div class="chips" style="margin-top: 6px">{#each V.dChips as c}<span class={c.cls}>{c.text}</span>{/each}</div></div><button class="dr-x" onclick={V.close} aria-label="Close">×</button></div>
<div class="dr-body">
{#if V.dIsPost}
<div class="scroll" style="border: 0">
<table class="dt">
<thead><tr><th>Platform</th><th class="num">Impressions</th><th class="num">Likes</th><th class="num">Comments</th><th class="num">Shares</th><th class="num">Saves</th><th class="num">Clicks</th><th class="num">Interaction rate</th><th class="num">Typical</th><th class="num">Result</th></tr></thead>
<tbody>{#each V.dRows as r}<tr><td style="white-space: nowrap"><span class="pk" style="background: {r.color}">{r.letter}</span> {r.pl}</td><td class="num">{r.impr}</td><td class="num">{r.likes}</td><td class="num">{r.comments}</td><td class="num">{r.shares}</td><td class="num">{r.saves}</td><td class="num">{r.clicks}</td><td class="num">{r.rate}</td><td class="num">{r.typical}</td><td class="num"><span class={r.rcls}>{r.result}</span></td></tr>{/each}</tbody>
</table>
</div>
<ul class="dr-extra">{#each V.dExtras as x}<li>{x}</li>{/each}</ul>
<div class="dr-links">{#each V.dLinks as l}{#if l.hasUrl}<a href={l.url} target="_blank" rel="noopener">Open on {l.label} ↗</a>{/if}{/each}</div>
<p class="note">{V.dNote}</p>
{/if}
{#if V.dIsList}
<ol class="dr-list">
{#each V.dList as r}
<li class="hit" {...act(r.open)}><p class="dr-t">{r.title}</p><div class="dr-chips"><span class={r.ccls}>{r.chip}</span></div><p class="dr-m">{r.meta}</p></li>
{/each}
</ol>
{/if}
</div>
</aside>
{/if}
{/if}
