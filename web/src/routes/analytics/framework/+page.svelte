<script lang="ts">
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { frameworkView } from '$lib/analytics/insights/framework';
  import { act, type State } from '$lib/analytics/insights/view';
  import BrandPicker from '$lib/analytics/ui/BrandPicker.svelte';

  let { data } = $props();
  let S = $state.raw<State>({});
  const set = (patch: State) => {
    S = { ...S, ...patch };
  };
  // Open on a tab named in the address (?tab=B), as the Overview's links do.
  $effect(() => {
    const tab = page.url.searchParams.get('tab');
    if (tab) untrack(() => set({ fwTab: tab }));
  });
  const V = $derived<any>(data.input ? frameworkView(data.input, S, set) : null);
</script>

<svelte:head><title>Framework · Analytics · Emkay BAU</title></svelte:head>
<svelte:window onkeydown={(e) => e.key === 'Escape' && V?.drawerOpen && V.closeDrawer()} />

{#if !V}
<BrandPicker what="The framework" />
{:else}
<div class="bar">
<span class="period"><strong>{data.input?.brandName}</strong>{#if V.periodText} · {V.periodText}{/if}</span>
</div>
<h1>Is the framework getting its due, and is it working?</h1>
<p class="lede">Five questions, one per tab. A post shared on several platforms counts once. Sponsored posts count in the split but not in performance.</p>
<details class="card explain measure"><summary>How we measure: what the “×” result means</summary>
<p><strong>A post’s result = its interaction rate ÷ the typical interaction rate for the same format on the same platform.</strong></p>
<ul>
<li><strong>Interaction rate</strong> = (likes + comments + shares or reposts + saves) ÷ impressions. On YouTube it is divided by views. Clicks are left out, because LinkedIn counts every carousel swipe as a click.</li>
<li><strong>Typical</strong> = the median interaction rate of the brand’s posts in that format on that platform over the last 6 months, so a LinkedIn carousel is measured against LinkedIn carousels.</li>
<li><strong>1.0×</strong> = a typical post. <strong>1.5×</strong> = 50% more interaction than typical. <strong>0.7×</strong> = 30% less.</li>
<li>A comms task, pillar or peg’s result is the median of its posts’ results, so one viral post can’t carry it.</li>
</ul>
<p class="note" style="margin: 0">Sponsored posts are left out, and a month counts once its posts are 7 days old.</p>
</details>

{#if V.noFramework}
<div class="card"><p style="margin: 0; line-height: 1.5">{V.noFwText}</p></div>
{/if}

{#if V.hasFramework}
<p class="note">{V.published} posts published since BAU began. {V.scored} of them have settled figures matched from the platform exports, and those count in parts B to E. Posts are matched to the exports by their links in the calendar.</p>
<nav class="tabs" aria-label="Parts of the framework page">{#each V.tabs as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</nav>
<div class="crow"><span class="clabel">Period</span>{#each V.periods as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>

{#if V.tabA}
<section class="sect tabbed">
<p class="sect-l">Part A</p>
<h2>Is the framework getting its due?</h2>
<p class="h3sub">How the posts that went out split across comms tasks, pillars and pegs, against targets, formats and platforms, and how much of the plan was delivered.</p>

<p class="q" style="margin-top: 24px">A1</p>
<h3 style="margin-top: 0">How posts split across comms tasks, month by month</h3>
<p class="h3sub">Posts published each month, split by comms task. The number in each block is its posts; the number on top is the month’s total.{V.a1Note}</p>
<div class="card cbox">
<svg class="chart" viewBox="0 0 760 330" role="img" aria-label={V.a1Aria}>
{#each V.a1Grid as g}<line x1="52" y1={g.y} x2="740" y2={g.y} stroke="#e4e2d8"></line><text x="44" y={g.ty} font-size="11" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
{#each V.a1Cols as c}
<rect x={c.hx} y="10" width={c.hw} height="306" fill={c.hl}></rect>
{/each}
<line x1="52" y1="290" x2="740" y2="290" stroke="#4a5560"></line>
{#each V.a1Cols as c}
{#each c.segs as s}<rect class="hit" {...act(s.open)} x={c.x} y={s.y} width={c.w} height={s.h} fill={s.color} stroke="#ffffff" stroke-width="1"><title>{s.peek}</title></rect><text x={c.cx} y={s.ty} font-size="12" font-weight="700" fill={s.tc} text-anchor="middle">{s.label}</text>{/each}
<text x={c.cx} y={c.ty} font-size="13" font-weight="700" fill="#1d2329" text-anchor="middle">{c.total}</text>
<text x={c.cx} y="310" font-size="12" font-weight={c.fw} fill="#1d2329" text-anchor="middle">{c.label}</text>
{/each}
</svg>
<div class="legend">{#each V.taskKeys as k}<span><span class="sw" style="background: {k.color}"></span>{k.name}</span>{/each}<span>Shaded column = the period you picked</span></div>
<details>
<summary>Show as a table</summary>
<div class="scroll" style="border: 0">
<table style="min-width: 480px">
<thead><tr><th>Month</th>{#each V.taskKeys as k}<th class="num">{k.name}</th>{/each}<th class="num">Total</th></tr></thead>
<tbody>{#each V.a1Cols as c}<tr><td>{c.label}</td>{#each c.cells as x}<td class="num">{x}</td>{/each}<td class="num">{c.total}</td></tr>{/each}</tbody>
</table>
</div>
</details>
</div>

<p class="q" style="margin-top: 32px">A2</p>
<h3 style="margin-top: 0">How each comms task splits into pillars and pegs ({V.periodShort})</h3>
<p class="h3sub">The bar shows each comms task’s pillars. Under it, each peg’s posts, grouped by pillar. Greyed pegs had no posts in the period.</p>
<div class="grid3">
{#each V.a2 as t}
<div class="card">
<div class="tc-head"><p class="tc-name" style="color: {t.color}">{t.name}</p><span class="tc-n">{t.nText} · {t.share}% of all</span></div>
<div class="stack" role="img" aria-label={t.aria}>{#each t.pillars as p}<span class="hit" {...act(p.open)} style="width: {p.w}%; background: {p.color}; color: {p.tc}" title={p.peek}>{p.inLabel}</span>{/each}</div>
{#each t.pillars as p}
<p class="pl"><span><span class="sw" style="background: {p.color}"></span>{p.name}</span><span>{p.n} · {p.share}%</span></p>
{#each p.pegs as g}
<div class="{g.cls} hit" title={g.peek} {...act(g.open)}><span>{g.name}</span><div class="ptrack"><div class="pfill" style="width: {g.w}%; background: {p.color}"></div></div><span class="pn">{g.text}</span></div>
{/each}
{/each}
</div>
{/each}
</div>

<p class="q" style="margin-top: 32px">A3</p>
<h3 style="margin-top: 0">Are the comms tasks meeting their targets?</h3>
<p class="h3sub">{V.a3Sub}</p>
<div class="tgt">
{#each V.a3 as t}
<div class="card">
<div class="tc-head"><p class="tc-name" style="color: {t.color}">{t.name}</p><span class={t.vcls}>{t.verdict}</span></div>
<svg class="chart" viewBox="0 0 370 170" role="img" aria-label={t.aria}>
{#each V.a3Grid as g}<line x1="40" y1={g.y} x2="300" y2={g.y} stroke="#eeece3"></line><text x="34" y={g.ty} font-size="10" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
{#if t.hasTarget}<line x1="40" y1={t.ty} x2="300" y2={t.ty} stroke="#1d2329" stroke-dasharray="5 4"></line><text x="306" y={t.tly} font-size="11" font-weight="700" fill="#1d2329">target</text><text x="306" y={t.tly2} font-size="11" font-weight="700" fill="#1d2329">{t.target}%</text>{/if}
<polyline points={t.line} fill="none" stroke={t.color} stroke-width="2.5"></polyline>
{#each t.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="6" fill={t.color}><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/each}
{#each t.months as m}<text x={m.x} y="164" font-size="11" fill="#4a5560" text-anchor="middle">{m.label}</text>{/each}
</svg>
<p class="note" style="margin: 8px 0 0"><strong>Year so far: {t.ytd}%</strong>{t.ytdText}</p>
<div class="bullet" role="img" aria-label={t.bAria}><div class="bfill" style="width: {t.ytdW}%; background: {t.color}"></div>{#if t.hasTarget}<div class="bmark" style="left: {t.targetW}%"></div>{/if}</div>
</div>
{/each}
</div>

<p class="q" style="margin-top: 32px">A4</p>
<h3 style="margin-top: 0">Gaps and overuse</h3>
<p class="h3sub">Pegs with no posts for two months or more, and pegs taking more than half of their pillar’s posts in the period.</p>
<div class="flags">
{#each V.a4 as f}
<div class="flag hit" title={f.peek} {...act(f.open)}><span class={f.cls}>{f.kind}</span><p>{f.text}</p></div>
{/each}
</div>
{#if V.a4None}<p class="note">Nothing to flag in this period.</p>{/if}

<p class="q" style="margin-top: 32px">A5</p>
<h3 style="margin-top: 0">Which formats each part uses ({V.periodShort})</h3>
<p class="h3sub">Posts per format. The darker the cell, the bigger that format’s share of the row.</p>
<div class="scroll">
<table class="mx" style="min-width: 760px">
<thead><tr><th>Comms task · pillar</th>{#each V.formatCols as f}<th class="num" style="text-align: center">{f}</th>{/each}<th class="num">Posts</th></tr></thead>
<tbody>{#each V.a5 as r}<tr class={r.cls}><td><span class="tsw" style="background: {r.color}"></span>{r.name}</td>{#each r.cells as c}<td class="{c.cls} hit" title={c.peek} {...act(c.open)}>{c.n}<small>{c.pct}</small></td>{/each}<td class="num">{r.n}</td></tr>{/each}</tbody>
</table>
</div>

<p class="q" style="margin-top: 32px">A6</p>
<h3 style="margin-top: 0">Which platforms each part goes out on ({V.periodShort})</h3>
<p class="h3sub">Posts that went out on each platform, and the share of the row’s posts. Shares add up to more than 100% because most posts go to several platforms.</p>
<div class="scroll">
<table class="mx" style="min-width: 640px">
<thead><tr><th>Comms task · pillar</th>{#each V.platformCols as f}<th class="num" style="text-align: center">{f}</th>{/each}<th class="num">Posts</th></tr></thead>
<tbody>{#each V.a6 as r}<tr class={r.cls}><td><span class="tsw" style="background: {r.color}"></span>{r.name}</td>{#each r.cells as c}<td class="{c.cls} hit" title={c.peek} {...act(c.open)}>{c.n}<small>{c.pct}</small></td>{/each}<td class="num">{r.n}</td></tr>{/each}</tbody>
</table>
</div>

<p class="q" style="margin-top: 32px">A7</p>
<h3 style="margin-top: 0">Planned against published ({V.periodShort})</h3>
<p class="h3sub">What the calendar planned and what happened to it.</p>
<div class="scroll">
<table style="min-width: 680px">
<thead><tr><th>Comms task · pillar</th><th class="num">Planned</th><th style="width: 42%">What happened</th><th class="num">Published</th><th class="num">Not yet</th><th class="num">Dropped</th></tr></thead>
<tbody>{#each V.a7 as r}<tr class="{r.cls} hit" title={r.peek} {...act(r.open)}><td><span class="tsw" style="background: {r.color}"></span>{r.name}</td><td class="num">{r.planned}</td><td><div class="hstack" role="img" aria-label={r.aria}><span class="s-pub" style="width: {r.pw}%"></span><span class="s-moved" style="width: {r.mw}%"></span><span class="s-drop" style="width: {r.dw}%"></span></div></td><td class="num">{r.pub}</td><td class="num">{r.moved}</td><td class="num">{r.dropped}</td></tr>{/each}</tbody>
</table>
</div>
<div class="legend"><span><span class="sw s-pub"></span>Published</span><span><span class="sw s-moved"></span>Not published yet</span><span><span class="sw s-drop"></span>Dropped</span></div>
{#if V.hasSlips}<p class="note"><strong>Keeps slipping (year so far):</strong> {V.slips}.</p>{/if}
</section>
{/if}

{#if V.tabB}
<section class="sect tabbed">
<p class="sect-l">Part B</p>
<h2>Is it performing the way we intend?</h2>

<div class="crow"><span class="clabel">Show</span>{#each V.bViews as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>

<p class="q" style="margin-top: 20px">B1</p>
<h3 style="margin-top: 0">How each part was received ({V.periodShort})</h3>
<p class="h3sub">Median result of its posts. Bars to the right of the line did better than same-format posts; bars to the left did worse. Pale bars have fewer than 3 posts, so read them with care.</p>
<div class="card">
<div class="dv-row dv-axis"><span></span><div class="dv-track dv-ticks">{#each V.dvTicks as t}<span class="dv-tick" style="left: {t.pos}%">{t.label}</span>{/each}</div><span class="dv-val">Result</span><span class="dv-n">Posts</span></div>
{#each V.b1 as r}
{#if r.isGroup}<div class={r.gcls}><span class="tsw" style="background: {r.color}"></span>{r.label}</div>{/if}
{#if r.notGroup}
<div class="dv-row hit" title={r.peek} {...act(r.open)}><span class={r.ncls}>{r.name}</span><div class="dv-track"><span class="dv-mid" style="left: {V.dvMid}%"></span><span class={r.bcls} style="left: {r.left}%; width: {r.width}%"></span></div><span class="dv-val">{r.val}</span><span class="dv-n">{r.n}</span></div>
{/if}
{/each}
<div class="legend"><span><span class="sw" style="background: #074974"></span>Better than same-format posts</span><span><span class="sw" style="background: #ee8a22"></span>Worse</span><span>The line is level (1.0×)</span></div>
</div>

<p class="q" style="margin-top: 32px">B2</p>
<h3 style="margin-top: 0">Is it improving or declining?</h3>
<p class="h3sub">Each comms task’s median result, month by month. The dashed line is level with same-format posts.</p>
<div class="card cbox">
<svg class="chart" viewBox="0 0 800 300" role="img" aria-label={V.b2Aria}>
{#each V.b2Band as h}<rect x={h.x} y="16" width={h.w} height="252" fill="#eef3f7"></rect>{/each}
{#each V.b2Grid as g}<line x1="60" y1={g.y} x2="640" y2={g.y} stroke={g.stroke} stroke-dasharray={g.dash}></line><text x="52" y={g.ty} font-size="11" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
{#each V.b2Lines as l}
<polyline points={l.points} fill="none" stroke={l.color} stroke-width="3"></polyline>
{#each l.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="6" fill={l.color}><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/each}
<text x="652" y={l.ey} font-size="12" font-weight="700" fill={l.tcolor}>{l.name}</text>
{/each}
{#each V.b2Months as m}<text x={m.x} y="290" font-size="12" font-weight={m.fw} fill="#1d2329" text-anchor="middle">{m.label}</text>{/each}
</svg>
</div>
{#if V.b2HasTable}
<p class="h3sub" style="margin-top: 16px">{V.b2TableSub}</p>
<div class="scroll">
<table class="mx" style="min-width: 560px">
<thead><tr><th>{V.bViewName}</th>{#each V.fwMonths as m}<th style="text-align: center">{m}</th>{/each}</tr></thead>
<tbody>{#each V.b2Rows as r}<tr class={r.cls}><td><span class="tsw" style="background: {r.color}"></span>{r.name}</td>{#each r.cells as c}<td class="{c.cls} hit" title={c.peek} {...act(c.open)}>{c.v}<small>{c.n}</small></td>{/each}</tr>{/each}</tbody>
</table>
</div>
<div class="legend"><span><span class="sw hv0"></span>under 0.8×</span><span><span class="sw hv1" style="border: 1px solid #d9d7cc"></span>0.8× to 1.2×</span><span><span class="sw hv2"></span>1.2× to 1.5×</span><span><span class="sw hv3"></span>1.5× or more</span><span>– no posts</span></div>
{/if}

<p class="q" style="margin-top: 32px">B3</p>
<h3 style="margin-top: 0">Is it consistent, or carried by one post? ({V.periodShort})</h3>
<p class="h3sub">Each dot is a post. The dashed line is level (1.0×); the black tick is the median. A part is “carried by one post” when one post did 2.5× or more while the median is below level.</p>
<div class="card">
<div class="st-row st-axis"><span></span><div class="st-track st-ticks">{#each V.stTicks as t}<span class="dv-tick" style="left: {t.pos}%">{t.label}</span>{/each}</div><span>Above level</span><span></span></div>
{#each V.b3 as r}
{#if r.isGroup}<div class={r.gcls}><span class="tsw" style="background: {r.color}"></span>{r.label}</div>{/if}
{#if r.notGroup}
<div class="st-row"><span class={r.ncls}>{r.name}</span><div class="st-track" role="img" aria-label={r.aria}><span class="st-level" style="left: {V.stMid}%"></span>{#each r.dots as d}<span class="st-dot hit" {...act(d.open)} style="left: {d.pos}%; background: {r.color}" title={d.peek}></span>{/each}{#if r.hasMed}<span class="st-med" style="left: {r.med}%"></span>{/if}</div><span class="st-pct">{r.above}</span><span class={r.bcls}>{r.badge}</span></div>
{/if}
{/each}
</div>

<p class="q" style="margin-top: 32px">B4</p>
<h3 style="margin-top: 0">Is each comms task getting the outcome it exists for?</h3>
<p class="h3sub">Each comms task is meant to do a different job, so each is judged on its own measure, against the other comms tasks on that same measure. The measure for each comms task is a setting and can be changed. Thought leadership also shows how often its posts are passed on.</p>
<div class="tgt">
{#each V.b4 as t}
<div class="card">
<div class="tc-head"><p class="tc-name" style="color: {t.tcolor}">{t.name}</p><span class={t.vcls}>{t.verdict}</span></div>
{#each t.charts as c}
<p class="note" style="margin: 4px 0 8px"><strong>{c.title}</strong> · {c.measure}</p>
<svg class="chart" viewBox="0 0 370 180" role="img" aria-label={c.aria}>
{#each c.grid as g}<line x1="44" y1={g.y} x2="300" y2={g.y} stroke="#eeece3"></line><text x="38" y={g.ty} font-size="10" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
<polyline points={c.other} fill="none" stroke="#8a8c8e" stroke-width="2" stroke-dasharray="5 4"></polyline>
<polyline points={c.mine} fill="none" stroke={t.color} stroke-width="3"></polyline>
{#each c.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="6" fill={t.color}><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/each}
<text x="306" y={c.mineY} font-size="11" font-weight="700" fill={t.tcolor}>this task</text>
<text x="306" y={c.otherY} font-size="11" fill="#4a5560">others</text>
{#each c.months as m}<text x={m.x} y="174" font-size="11" fill="#4a5560" text-anchor="middle">{m.label}</text>{/each}
</svg>
<p class="note" style="margin: 6px 0 14px">{c.summary}</p>
{/each}
</div>
{/each}
</div>

<div class="two-lists">
<div>
<p class="q" style="margin-top: 32px">B5</p>
<h3 style="margin-top: 0">Underperforming three months running</h3>
<p class="h3sub">Pillars and pegs under 0.8× in each of the last three months they were used, up to {V.endMonth}.</p>
<div class="card">
{#each V.b5 as i}
<div class="li-row"><div><strong>{i.name}</strong><span class="sub">{i.path}</span></div><div class="chips">{#each i.chips as c}<span class="{c.cls} hit" title={c.peek} {...act(c.open)}>{c.m} {c.v}</span>{/each}</div></div>
{/each}
{#if V.b5None}<p class="note" style="margin: 0">None in this period.</p>{/if}
</div>
</div>
<div>
<p class="q" style="margin-top: 32px">B6</p>
<h3 style="margin-top: 0">Doing well on few posts</h3>
<p class="h3sub">Pillars and pegs at 1.3× or more in the period, with less than an even share of their group’s posts.</p>
<div class="card">
{#each V.b6 as i}
<div class="li-row hit" title={i.peek} {...act(i.open)}><div><strong>{i.name}</strong><span class="sub">{i.path}</span></div><div class="chips"><span class="chip c-up">{i.v}</span><span class="chip c-flat">{i.share}</span></div></div>
{/each}
{#if V.b6None}<p class="note" style="margin: 0">None in this period.</p>{/if}
</div>
</div>
</div>
</section>
{/if}

{#if V.tabC}
<section class="sect tabbed">
<p class="sect-l">Part C</p>
<h2>How does it differ by platform?</h2>
<p class="h3sub">Results here are per platform: a post’s interaction rate on that platform against the typical rate for its format there (see “How we measure” at the top of the page). So 1.4× on Instagram means 40% more interaction than a typical Instagram post of that format, and platforms can be compared fairly.</p>
<div class="crow"><span class="clabel">Show</span>{#each V.cViews as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>

<p class="q" style="margin-top: 20px">C1</p>
<h3 style="margin-top: 0">Does each part do better on some platforms than others? ({V.cdeShort})</h3>
<p class="h3sub">Each dot is a platform’s median result for that part. The further apart the dots, the more the platform matters. Click a dot for its posts.</p>
<div class="card">
<div class="pd-row dv-axis"><span></span><div class="pd-track dv-ticks">{#each V.dvTicks as t}<span class="dv-tick" style="left: {t.pos}%">{t.label}</span>{/each}</div><span>Best platform, and is it still true lately?</span></div>
{#each V.c1 as r}
{#if r.isGroup}<div class={r.gcls}><span class="tsw" style="background: {r.color}"></span>{r.label}</div>{/if}
{#if r.notGroup}
<div class="pd-row"><span class={r.ncls}>{r.name}</span><div class="pd-track" role="img" aria-label={r.aria}><span class="dv-mid" style="left: {V.dvMid}%"></span>{#if r.hasSpan}<span class="pd-span" style="left: {r.spanL}%; width: {r.spanW}%"></span>{/if}{#each r.dots as d}<span class="pd-dot hit" style="left: {d.pos}%; top: {d.top}px; background: {d.color}" title={d.peek} {...act(d.open)}>{d.letter}</span>{/each}</div><span class="pd-best">{r.best}<span class="sub">{r.gap}</span><span class={r.lcls}>{r.lately}</span></span></div>
{/if}
{/each}
<div class="legend">{#each V.platKeys as k}<span><span class="pd-key" style="background: {k.color}">{k.letter}</span>{k.name}</span>{/each}<span>The line is level (1.0×)</span></div>
</div>

<p class="q" style="margin-top: 32px">C2</p>
<h3 style="margin-top: 0">Why is it different? ({V.cdeShort})</h3>
<p class="h3sub">Pick a comms task, and a pillar if you like. Each card shows what went out on that platform and how it did, so the differences behind the results sit side by side.</p>
<div class="crow"><span class="clabel">Comms task</span>{#each V.c2Tasks as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="crow"><span class="clabel">Pillar</span>{#each V.c2Pillars as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="card stand"><p class="dr-k" style="margin-bottom: 6px">What stands out</p>{#each V.c2Stand as s}<p>{s}</p>{/each}</div>
<div class="pcards">
{#each V.c2 as c}
<div class="card pcard">
<div class="pc-head hit" title={c.peek} {...act(c.open)}><span class="pd-key" style="background: {c.color}">{c.letter}</span><strong>{c.name}</strong><span class={c.rcls}>{c.result}</span></div>
<p class="note" style="margin: 2px 0 10px">{c.nText}</p>
{#if c.has}
<p class="pc-l">Formats</p>
{#each c.formats as f}<div class="pc-f hit" title={f.peek} {...act(f.open)}><span>{f.name}</span><div class="ptrack"><div class="pfill" style="width: {f.w}%; background: {c.color}"></div></div><span class="pn">{f.text}</span></div>{/each}
<p class="pc-l">Pegs</p>
{#each c.pegs as g}<div class="pc-p hit" title={g.peek} {...act(g.open)}><span>{g.label}: {g.name}</span><span class={g.cls}>{g.v}</span></div>{/each}
<p class="pc-l">Timing</p>
<p class="pc-t">{c.timing}</p>
<p class="pc-t">{c.bestDay}</p>
{/if}
</div>
{/each}
</div>

<p class="q" style="margin-top: 32px">C3</p>
<h3 style="margin-top: 0">Which platform suits each comms task, and is the plan using it? ({V.cdeShort})</h3>
<p class="h3sub">For each comms task: on the left, how its posts were spread across platforms; on the right, how they did on each. If the platform with the best result gets a short bar on the left, the plan is not using it.</p>
<div class="card">
<div class="fit-row dv-axis"><span>Platform</span><span>Share of the comms task’s posts</span><span class="fit-hdr">Result: interaction rate against a typical post of the same format there</span></div>
<div class="fit-row dv-axis" style="border: 0; padding-top: 0"><span></span><span></span><div class="dv-track dv-ticks">{#each V.dvTicks as t}<span class="dv-tick" style="left: {t.pos}%">{t.label}</span>{/each}</div><span></span></div>
{#each V.c3Rows as r}
<div class="dv-g1"><span class="tsw" style="background: {r.color}"></span>{r.name}<span class="gsub">{r.n}</span></div>
{#each r.cells as c}
<div class="fit-row hit" title={c.peek} {...act(c.open)}>
<span><span class="pd-key" style="background: {c.pcolor}">{c.letter}</span>{c.pl}</span>
<div class="fit-share"><div class="ptrack"><div class="pfill" style="width: {c.shareW}%; background: {r.color}"></div></div><span class="pn">{c.shareText}</span></div>
<div class="dv-track"><span class="dv-mid" style="left: {V.dvMid}%"></span><span class={c.bcls} style="left: {c.left}%; width: {c.width}%"></span></div>
<span class="fit-v">{c.v}{#if c.best} <span class="chip c-up">Best</span>{/if}</span>
</div>
{/each}
{/each}
<div class="legend"><span><span class="sw" style="background: #074974"></span>Better than same-format posts</span><span><span class="sw" style="background: #ee8a22"></span>Worse</span><span>Best = highest result with 2 posts or more</span></div>
</div>
<div class="flags" style="margin-top: 12px">
{#each V.c3Fit as f}<div class="flag"><span class={f.cls}>{f.kind}</span><p>{f.text}</p></div>{/each}
</div>
</section>
{/if}

{#if V.tabD}
<section class="sect tabbed">
<p class="sect-l">Part D</p>
<h2>Format, timing and series</h2>
<p class="h3sub">Which formats, days and times work best, and whether each series is building an audience. Results are as explained in Part B.</p>

<p class="q" style="margin-top: 20px">D1</p>
<h3 style="margin-top: 0">Which format works best for each part? ({V.cdeShort})</h3>
<p class="h3sub">Each cell is the median result of that part’s posts in that format, with the number of posts. The outlined cell is the best format (2 posts or more). Pick a platform to see it there.</p>
<div class="crow"><span class="clabel">Show</span>{#each V.dViews as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="crow"><span class="clabel">Platform</span>{#each V.dPlats as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="scroll">
<table class="mx" style="min-width: 820px">
<thead><tr><th>{V.dViewName}</th>{#each V.formatCols as f}<th style="text-align: center">{f}</th>{/each}<th>Works best as<span class="sub">still true lately?</span></th></tr></thead>
<tbody>{#each V.d1 as r}<tr class={r.cls}><td><span class="tsw" style="background: {r.color}"></span>{r.name}</td>{#each r.cells as c}<td class={c.cls} title={c.peek} {...act(c.open)}>{c.v}<small>{c.n}</small></td>{/each}<td class="d-best">{r.best}<span class={r.lcls}>{r.lately}</span></td></tr>{/each}</tbody>
</table>
</div>
<div class="legend"><span><span class="sw hv0"></span>under 0.8×</span><span><span class="sw hv1" style="border: 1px solid #d9d7cc"></span>0.8× to 1.2×</span><span><span class="sw hv2"></span>1.2× to 1.5×</span><span><span class="sw hv3"></span>1.5× or more</span><span><span class="sw" style="border: 2px solid #1d2329"></span>best format</span><span>– no posts</span></div>

<p class="q" style="margin-top: 32px">D2</p>
<h3 style="margin-top: 0">Do day and time matter? ({V.cdeShort})</h3>
<p class="h3sub">{V.timeNote} Cells with one post are shown but not used to pick the best slot. The bars below cover every platform by day.</p>
{#if V.hasTime}<div class="crow"><span class="clabel">Platform</span>{#each V.dTimePlats as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="card stand"><p class="dr-k" style="margin-bottom: 6px">What stands out</p>{#each V.d2Stand as s}<p>{s}</p>{/each}</div>
<div class="scroll">
<table class="mx" style="min-width: 760px">
<thead><tr><th>Day</th>{#each V.d2Bands as b}<th style="text-align: center">{b}</th>{/each}</tr></thead>
<tbody>{#each V.d2Grid as r}<tr><td><strong>{r.day}</strong></td>{#each r.cells as c}<td class={c.cls} title={c.peek} {...act(c.open)}>{c.v}<small>{c.n}</small></td>{/each}</tr>{/each}</tbody>
</table>
</div>{/if}
<div class="card" style="margin-top: 16px">
<p class="dr-k" style="margin-bottom: 8px">Result by day, all platforms</p>
<div class="dv-row dv-axis"><span></span><div class="dv-track dv-ticks">{#each V.dvTicks as t}<span class="dv-tick" style="left: {t.pos}%">{t.label}</span>{/each}</div><span class="dv-val">Result</span><span class="dv-n">Posts</span></div>
{#each V.d2Days as r}
<div class="dv-row hit" title={r.peek} {...act(r.open)}><span class="n0">{r.name}</span><div class="dv-track"><span class="dv-mid" style="left: {V.dvMid}%"></span><span class={r.bcls} style="left: {r.left}%; width: {r.width}%"></span></div><span class="dv-val">{r.val}</span><span class="dv-n">{r.n}</span></div>
{/each}
</div>

<p class="q" style="margin-top: 32px">D3</p>
<h3 style="margin-top: 0">How is each series doing, episode by episode?</h3>
<p class="h3sub">Series come from the calendar’s Series column. Top chart: each episode’s result. Bottom chart: its impressions (views on YouTube), all platforms together. Click an episode for its post. Covers every episode so far, whatever the period.</p>
{#if V.d3None}<div class="card"><p style="margin: 0">No series are marked in the calendar for this brand yet.</p></div>{/if}
<div class="tgt">
{#each V.d3 as s}
<div class="card">
<div class="tc-head"><p class="tc-name">{s.name}</p><span class={s.vcls}>{s.verdict}</span></div>
<p class="note" style="margin: -4px 0 8px">{s.path} · {s.n}</p>
<svg class="chart" viewBox="0 0 380 250" role="img" aria-label={s.aria}>
<text x="0" y="12" font-size="11" font-weight="700" fill="#3a4148">Result</text>
{#each s.grid as g}<line x1="40" y1={g.y} x2="370" y2={g.y} stroke={g.stroke} stroke-dasharray={g.dash}></line><text x="34" y={g.ty} font-size="10" fill="#4a5560" text-anchor="end">{g.label}</text>{/each}
<polyline points={s.line} fill="none" stroke="#074974" stroke-width="2.5"></polyline>
{#each s.pts as d}<circle class="hit" {...act(d.open)} cx={d.x} cy={d.y} r="6" fill="#074974"><title>{d.peek}</title></circle><text x={d.x} y={d.ly} font-size="11" font-weight="700" fill="#1d2329" text-anchor="middle">{d.label}</text>{/each}
<text x="0" y="146" font-size="11" font-weight="700" fill="#3a4148">Impressions</text>
<line x1="40" y1="222" x2="370" y2="222" stroke="#8a8c8e"></line>
{#each s.bars as b}<rect class="hit" {...act(b.open)} x={b.x} y={b.y} width={b.w} height={b.h} fill="#8fb4cf"><title>{b.peek}</title></rect><text x={b.cx} y={b.ly} font-size="10" font-weight="600" fill="#1d2329" text-anchor="middle">{b.label}</text><text x={b.cx} y="238" font-size="11" fill="#4a5560" text-anchor="middle">{b.ep}</text>{/each}
</svg>
<p class="note" style="margin: 6px 0 0">{s.summary}</p>
</div>
{/each}
</div>
</section>
{/if}

{#if V.tabE}
<section class="sect tabbed">
<p class="sect-l">Part E</p>
<h2>What should we change?</h2>
<p class="h3sub">Brings parts A to D together: where effort should shift, and what to do about it. Suggestions are prompts for the content team, not decisions.</p>

<p class="q" style="margin-top: 20px">E1</p>
<h3 style="margin-top: 0">Where should effort shift? ({V.cdeShort})</h3>
<p class="h3sub">Each dot is a {V.eUnit}. Across: how much it was used against an even split with the others in its group (1× = its fair share). Up: its result. Dot size is its number of posts. Parts with fewer than 2 posts are left off.</p>
<div class="crow"><span class="clabel">Show</span>{#each V.eViews as v}<button class={v.cls} aria-pressed={v.pressed} onclick={v.pick}>{v.name}</button>{/each}</div>
<div class="card cbox">
<svg class="chart" viewBox="0 0 760 450" role="img" aria-label={V.e1Aria}>
<rect x="60" y="20" width="272" height={V.e1TopH} fill="#eaf1f6"></rect>
<rect x="332" y="20" width="408" height={V.e1TopH} fill="#edf4ec"></rect>
<rect x="60" y={V.e1MidY} width="272" height={V.e1BotH} fill="#f5f4ef"></rect>
<rect x="332" y={V.e1MidY} width="408" height={V.e1BotH} fill="#fbefe0"></rect>
<text x="70" y="40" font-size="13" font-weight="700" fill="#06304d">Give more room</text>
<text x="70" y="56" font-size="11" fill="#3a4148">used little, does well</text>
<text x="730" y="40" font-size="13" font-weight="700" fill="#173a19" text-anchor="end">Keep backing</text>
<text x="730" y="56" font-size="11" fill="#3a4148" text-anchor="end">used a lot, does well</text>
<text x="70" y="370" font-size="13" font-weight="700" fill="#3a4148">Candidates to retire</text>
<text x="70" y="384" font-size="11" fill="#3a4148">used little, does poorly</text>
<text x="730" y="370" font-size="13" font-weight="700" fill="#6b3a00" text-anchor="end">Rethink</text>
<text x="730" y="384" font-size="11" fill="#3a4148" text-anchor="end">used a lot, does poorly</text>
<line x1="332" y1="20" x2="332" y2="390" stroke="#8a8c8e" stroke-dasharray="4 4"></line>
<line x1="60" y1={V.e1MidY} x2="740" y2={V.e1MidY} stroke="#8a8c8e" stroke-dasharray="4 4"></line>
<line x1="60" y1="390" x2="740" y2="390" stroke="#4a5560"></line>
<line x1="60" y1="20" x2="60" y2="390" stroke="#4a5560"></line>
{#each V.e1XTicks as t}<text x={t.x} y="408" font-size="11" fill="#4a5560" text-anchor="middle">{t.label}</text>{/each}
{#each V.e1YTicks as t}<text x="52" y={t.y} font-size="11" fill="#4a5560" text-anchor="end">{t.label}</text>{/each}
<text x="400" y="438" font-size="12" fill="#3a4148" text-anchor="middle">Share of its group’s posts, against an even split (1× = fair share)</text>
<text x="14" y="205" font-size="12" fill="#3a4148" text-anchor="middle" transform="rotate(-90 14 205)">Result</text>
{#each V.e1Points as p}
<circle class="hit" {...act(p.open)} cx={p.x} cy={p.y} r={p.r} fill={p.color} fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5"><title>{p.peek}</title></circle>
<text x={p.lx} y={p.ly} font-size="11" fill="#1d2329" text-anchor={p.anchor}>{p.label}</text>
{/each}
</svg>
<div class="legend">{#each V.taskKeys as k}<span><span class="dot" style="background: {k.color}"></span>{k.name}</span>{/each}<span>Labelled: everything outside “Keep backing”. Hover or click any dot for its posts.</span></div>
</div>

<p class="q" style="margin-top: 32px">E2</p>
<h3 style="margin-top: 0">What should we do? ({V.cdeShort})</h3>
<p class="h3sub">Each suggestion lists the evidence behind it from parts A to D, and something to try. Click a card for its posts.</p>
{#each V.e2 as g}
<div class="e-group">
<p class="e-gh"><span class={g.cls}>{g.name}</span><span class="gsub">{g.sub}</span></p>
<div class="e-cards">
{#each g.items as i}
<div class="card e-card hit" title={i.peek} {...act(i.open)}>
<p class="e-t">{i.name}</p>
<p class="sub" style="margin: 0 0 8px">{i.path}</p>
<ul class="e-why">{#each i.why as w}<li>{w}</li>{/each}</ul>
<p class="e-try"><strong>Try:</strong> {i.try}</p>
</div>
{/each}
</div>
{#if g.none}<p class="note">Nothing here in this period.</p>{/if}
</div>
{/each}

</section>
{/if}
{/if}
{#if V.drawerOpen}
<div class="dr-back" {...act(V.closeDrawer)}></div>
<aside class="drawer" aria-label="Posts behind this figure">
<div class="dr-head"><div><p class="dr-k">Posts behind this</p><h3>{V.drawer.title}</h3><p class="note" style="margin: 0">{V.drawer.sub}</p></div><button class="dr-x" onclick={V.closeDrawer} aria-label="Close">×</button></div>
<ol class="dr-list">
{#each V.drawer.rows as r}
<li><p class="dr-t">{r.title}</p><div class="dr-chips">{#each r.chips as c}<span class={c.cls}>{c.text}</span>{/each}</div><p class="dr-m">{r.meta}</p><div class="dr-links">{#each r.links as l}{#if l.hasUrl}<a href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>{/if}{#if l.noUrl}<span>{l.label}</span>{/if}{/each}</div></li>
{/each}
</ol>
{#if V.drawer.empty}<p class="note" style="padding: 0 20px">No posts here in this period.</p>{/if}
</aside>
{/if}
{/if}
