// The Posts page: the best and least received posts and what the best share, posts still
// settling, YouTube watch share, Instagram follows, LinkedIn and X clicks, and every post.

import type { PostsInput } from './inputs';
import { NO_FORMAT } from './view';
import {
  DAYS, PLATFORMS, PLAT_COLORS, PLAT_LETTER, fx, median, monthDone, monthLabel, n0, pct, plural, segs,
  type PlatformName, type SetState, type State, type VPost
} from './view';

type PP = VPost & { m: number };

export function postsView(input: PostsInput, S: State, set: SetState): any {
  const months = input.months;
  if (!input.posts.length) return { hasPosts: false, noPosts: true, noPostsText: `No ${input.brandName} posts with figures this financial year yet. Upload the platforms’ post exports on the Upload page.` };
  const short = months.map((m) => monthLabel(m).short);
  const full = months.map((m) => monthLabel(m).full + (monthDone(m, input.asOf) ? '' : ' (so far)'));
  const plain = (s: string) => s.replace(' (so far)', '');
  const yr = (s: string) => s.replace(/ \d{4}/, '');
  const last = months.length - 1;
  const pub: PP[] = input.posts.map((p) => ({ ...p, m: months.indexOf(p.month) })).filter((p) => p.m >= 0);
  const fig = (p: PP, pl: PlatformName) => p.fig[pl];
  const plats = (p: PP, only?: PlatformName | null) => (only ? [only] : p.platforms.filter((pl) => p.fig[pl])).map((pl) => ({ letter: PLAT_LETTER[pl], color: PLAT_COLORS[pl] }));
  const metaOf = (p: PP) => [`${p.day} ${short[p.m]}`, p.format, p.peg ?? (p.inCal ? null : 'not in the calendar')].filter(Boolean).join(' · ');

  // Period: a month, the last 3 months, or the year so far. Opens on the latest month.
  const valid = (x: unknown) => typeof x === 'string' && (x === 'ytd' || x === '3m' || (/^m\d+$/.test(x) && Number(x.slice(1)) <= last));
  const pp: string = S.pBrand === input.brand && valid(S.pPeriod) ? S.pPeriod : 'm' + last;
  const inP = pp === 'ytd' ? months.map((_, i) => i) : pp === '3m' ? months.map((_, i) => i).filter((i) => i >= last - 2) : [Number(pp.slice(1))];
  const periods = segs([...short.map((m, i): [string, string] => ['m' + i, m]), ['3m', 'Last 3 months'], ['ytd', 'Year so far']], pp, (id) => set({ pPeriod: id, pBrand: input.brand }));
  const pShort = pp === 'ytd' ? 'year so far' : pp === '3m' ? 'last 3 months' : yr(plain(full[inP[0]]));
  const periodText = (pp === 'ytd' ? 'Year so far: ' : pp === '3m' ? 'Last 3 months: ' : '') + (inP.length > 1 ? yr(full[inP[0]]) + ' to ' + full[last] : full[inP[0]]);
  const PPl = pub.filter((p) => inP.includes(p.m));
  const ranked = PPl.filter((p) => !p.settling && p.ratio !== null).sort((a, b) => (b.ratio as number) - (a.ratio as number));

  // Opening a post, or a list of posts.
  const openPost = (p: PP) => () => set({ pOpen: { brand: input.brand, post: p } });
  const openList = (title: string, list: PP[], chip: string) => () => set({ pOpen: { brand: input.brand, title, list, chip } });

  // 1. Best and least received.
  const maxR = Math.max(2, ...ranked.map((p) => p.ratio as number));
  const rowOf = (p: PP) => ({ title: p.title, meta: metaOf(p), plats: plats(p), w: (((p.ratio as number) / maxR) * 100).toFixed(1), mid: ((1 / maxR) * 100).toFixed(1), v: fx(p.ratio), bcls: 'pbar ' + ((p.ratio as number) >= 1 ? 'up' : 'down'), open: openPost(p), peek: `${p.title}: ${fx(p.ratio)} against a typical post. Click for its figures.` });
  const best = ranked.slice(0, 5).map(rowOf);
  const worst = ranked.slice(Math.max(5, ranked.length - 5)).reverse().map(rowOf);
  const topN = ranked.slice(0, Math.max(3, Math.round(ranked.length / 4)));
  const bestPl = (p: PP) => (Object.keys(p.pr) as PlatformName[]).sort((a, b) => (p.pr[b] as number) - (p.pr[a] as number))[0];
  const dims: [(p: PP) => string | null | undefined, (x: string) => string][] = [
    [(p) => (p.format === NO_FORMAT ? null : p.format), (x) => `were ${x.toLowerCase()} posts`],
    [(p) => p.peg, (x) => `came from the peg “${x}”`],
    [(p) => p.task, (x) => `were ${x}`],
    [(p) => DAYS[p.dow], (x) => `went out on a ${x}`],
    [bestPl, (x) => `did best on ${x}`]
  ];
  const cand: { lift: number; text: string }[] = [];
  if (ranked.length >= 6) dims.forEach(([key, say]) => {
    const vals = [...new Set(topN.map(key))].filter((x): x is string => !!x);
    vals.forEach((x) => {
      const inTop = topN.filter((p) => key(p) === x).length, inAll = ranked.filter((p) => key(p) === x).length;
      const lift = inTop / topN.length / (inAll / ranked.length);
      if (inTop >= 2 && lift >= 1.3) cand.push({ lift, text: `${inTop} of the top ${topN.length} ${say(x)}, against ${pct(inAll, ranked.length)}% of all posts in the period.` });
    });
  });
  const traits = cand.sort((a, b) => b.lift - a.lift).slice(0, 4).map((c) => c.text);
  if (!traits.length) traits.push(ranked.length < 6 ? 'Too few settled posts in this period to find a pattern. Try a longer period.' : 'Nothing stands out: the best posts are a mix of formats, pegs, days and platforms.');
  const settlingAll = PPl.filter((p) => p.settling);
  const settlingMore = settlingAll.length > 8 ? `And ${plural(settlingAll.length - 8)} more, in the table below.` : '';
  const settlingRows = settlingAll.slice(0, 8).map((p) => ({ title: p.title, meta: metaOf(p), plats: plats(p), so: `${n0(p.impr)} impressions so far`, open: openPost(p), peek: `${p.title}: out less than 7 days. Click for its figures so far.` }));

  // 2. YouTube.
  const nMo = months.length;
  const mx = (i: number) => (nMo === 1 ? 190 : 70 + (i * 250) / (nMo - 1));
  const monthX = short.map((label, i) => ({ x: mx(i).toFixed(1), label }));
  const watched = (p: PP) => fig(p, 'YouTube')?.watched ?? null;
  const ytList = PPl.filter((p) => watched(p) !== null).sort((a, b) => (watched(b) as number) - (watched(a) as number));
  const yt = ytList.slice(0, 12).map((p) => ({ title: p.title, meta: metaOf(p) + (p.settling ? ' · still settling' : ''), w: Math.min(100, Math.round(watched(p) as number)), v: Math.round(watched(p) as number) + '%', views: n0(fig(p, 'YouTube')?.impr) + ' views', open: openPost(p), peek: `${p.title}: ${Math.round(watched(p) as number)}% watched on average, ${n0(fig(p, 'YouTube')?.impr)} views. Click for its figures.` }));
  const py = (v: number) => 170 - (v / 100) * 150;
  const pctGrid = [0, 50, 100].map((v) => ({ y: py(v).toFixed(1), ty: (py(v) + 3).toFixed(1), label: v + '%' }));
  const ytPts = months.flatMap((_, m) => { const l = pub.filter((p) => watched(p) !== null && p.m === m); const v = median(l.map(watched)); return v === null ? [] : [{ x: mx(m).toFixed(1), y: py(v).toFixed(1), ly: (py(v) - 9).toFixed(1), label: Math.round(v) + '%', open: openList(`YouTube videos, ${plain(full[m])}`, l, 'yt'), peek: `${short[m]}: median ${Math.round(v)}% watched across ${plural(l.length, 'video')}. Click to see them.` }]; });
  const ytCall = ytList.length >= 2 ? [`Holds viewers longest: ${ytList[0].title} (${Math.round(watched(ytList[0]) as number)}% watched).`, `Loses them fastest: ${ytList[ytList.length - 1].title} (${Math.round(watched(ytList[ytList.length - 1]) as number)}%).`] : [];

  // 3. Instagram.
  const follows = (p: PP) => fig(p, 'Instagram')?.follows ?? null;
  const igList = PPl.filter((p) => fig(p, 'Instagram')).sort((a, b) => (follows(b) ?? 0) - (follows(a) ?? 0));
  const maxF = Math.max(1, ...igList.map((p) => follows(p) ?? 0));
  const ig = igList.slice(0, 8).map((p) => ({ title: p.title, meta: metaOf(p) + (p.settling ? ' · still settling' : ''), w: (((follows(p) ?? 0) / maxF) * 100).toFixed(1), v: plural(follows(p) ?? 0, 'follow'), extra: `${n0(fig(p, 'Instagram')?.saves)} saves · ${n0(fig(p, 'Instagram')?.shares)} shares`, open: openPost(p), peek: `${p.title}: ${n0(follows(p))} follows, ${n0(fig(p, 'Instagram')?.saves)} saves, ${n0(fig(p, 'Instagram')?.shares)} shares. Click for its figures.` }));
  const igMonth = months.map((_, m) => { const l = pub.filter((p) => fig(p, 'Instagram') && p.m === m); return { l, v: l.reduce((s, p) => s + (follows(p) ?? 0), 0) }; });
  const maxIM = Math.max(1, ...igMonth.map((x) => x.v));
  const bw = Math.min(44, 250 / Math.max(1, nMo) - 6);
  const igBars = igMonth.map((x, m) => { const h = (x.v / maxIM) * 130; return { x: (mx(m) - bw / 2).toFixed(1), w: bw.toFixed(1), y: (170 - h).toFixed(1), h: h.toFixed(1), cx: mx(m).toFixed(1), ly: (170 - h - 6).toFixed(1), label: String(x.v), m: short[m], open: openList(`Instagram posts, ${plain(full[m])}`, x.l, 'ig'), peek: `${short[m]}: ${x.v} follows from ${plural(x.l.length)}. Click to see them.` }; });

  // 4. LinkedIn and X.
  const liRate = (p: PP) => { const f = fig(p, 'LinkedIn'); return f && f.clicks !== null && f.impr ? (f.clicks / f.impr) * 1000 : null; };
  const liList = PPl.filter((p) => liRate(p) !== null);
  const liF = input.formats.map((f) => { const l = liList.filter((p) => p.format === f); return { f, l, v: median(l.map(liRate)) as number }; }).filter((x) => x.l.length);
  const maxC = Math.max(1, ...liF.map((x) => x.v));
  const liFormats = liF.sort((a, b) => b.v - a.v).map((x) => ({ name: x.f, n: plural(x.l.length), w: ((x.v / maxC) * 100).toFixed(1), v: x.v.toFixed(1), open: openList(`LinkedIn ${x.f.toLowerCase()} posts, ${pShort}`, x.l, 'li'), peek: `${x.f}: ${x.v.toFixed(1)} clicks per 1,000 impressions (median of ${x.l.length}). Click to see them.` }));
  const liTop = liList.filter((p) => !/carousel|document/i.test(p.format)).sort((a, b) => (liRate(b) as number) - (liRate(a) as number)).slice(0, 3).map((p) => ({ title: p.title, meta: metaOf(p), v: (liRate(p) as number).toFixed(1) + ' per 1,000', open: openPost(p), peek: `${p.title}: ${n0(fig(p, 'LinkedIn')?.clicks)} clicks. Click for its figures.` }));
  const xClicks = (p: PP) => fig(p, 'X')?.clicks ?? 0;
  const xList = PPl.filter((p) => fig(p, 'X')).sort((a, b) => xClicks(b) - xClicks(a));
  const maxX = Math.max(1, ...xList.map(xClicks));
  const xTop = xList.slice(0, 5).map((p) => ({ title: p.title, meta: metaOf(p), w: ((xClicks(p) / maxX) * 100).toFixed(1), v: plural(xClicks(p), 'click'), extra: `${n0(fig(p, 'X')?.visits)} profile visits`, open: openPost(p), peek: `${p.title}: ${n0(xClicks(p))} clicks, ${n0(fig(p, 'X')?.visits)} profile visits. Click for its figures.` }));
  const xNote = xList.length ? `Median per post: ${n0(median(xList.map(xClicks)))} clicks and ${n0(median(xList.map((p) => fig(p, 'X')?.visits)))} profile visits, from ${plural(xList.length)}. Most clicked first.` : 'No X posts in this period.';
  const hasLi = liFormats.length > 0, hasX = xList.length > 0;

  // 5. Every post.
  const q = typeof S.pQ === 'string' ? S.pQ : '';
  const used = PLATFORMS.filter((pl) => pub.some((p) => p.fig[pl]));
  const tPlat: string = used.includes(S.pPlat) ? S.pPlat : 'all';
  const tSort: string = ['new', 'best', 'impr'].includes(S.pSort) ? S.pSort : 'new';
  const tPlats = segs([['all', 'All'], ...used.map((x): [string, string] => [x, x])], tPlat, (id) => set({ pPlat: id }));
  const tSorts = segs([['new', 'Newest'], ['best', 'Best result'], ['impr', 'Most impressions']], tSort, (id) => set({ pSort: id }));
  const needle = q.trim().toLowerCase();
  const val = (p: PP) => (tPlat === 'all' ? { impr: p.impr, rate: p.rateAll, res: p.ratio } : { impr: fig(p, tPlat as PlatformName)?.impr ?? 0, rate: fig(p, tPlat as PlatformName)?.rate ?? null, res: p.pr[tPlat as PlatformName] ?? null });
  const rows = PPl.filter((p) => tPlat === 'all' || p.fig[tPlat as PlatformName]).filter((p) => !needle || [p.title, p.peg, p.pillar, p.format, p.task, p.series].join(' ').toLowerCase().includes(needle))
    .sort((a, b) => (tSort === 'best' ? (val(b).res ?? -1) - (val(a).res ?? -1) : tSort === 'impr' ? (val(b).impr ?? 0) - (val(a).impr ?? 0) : b.date.localeCompare(a.date)));
  const tRows = rows.slice(0, 80).map((p) => { const v = val(p); const settling = p.settling || v.res === null; return { date: `${p.day} ${short[p.m]}`, title: p.title, sub: [[p.task, p.pillar, p.peg].filter(Boolean).join(' › ') || 'Not in the calendar', p.format].join(' · ') + (p.settling ? ' · still settling' : ''), plats: plats(p, tPlat === 'all' ? null : (tPlat as PlatformName)), impr: n0(v.impr), rate: v.rate === null ? '–' : v.rate.toFixed(1) + '%', result: p.settling ? 'settling' : fx(v.res), rcls: 'chip ' + (settling ? 'c-flat' : (v.res as number) >= 1 ? 'c-up' : 'c-down'), open: openPost(p), peek: `${p.title}. Click for its figures.` }; });
  const tCount = `${plural(rows.length)}` + (needle ? ` matching “${q.trim()}”` : '') + (rows.length > 80 ? ', showing the first 80' : '') + '.';

  // The open post or list.
  const O = S.pOpen && S.pOpen.brand === input.brand ? S.pOpen : null;
  let d: any = { dOpen: false };
  if (O && O.post) {
    const p = O.post as PP;
    const pls = PLATFORMS.filter((pl) => p.fig[pl]);
    const notes: string[] = [];
    if (pls.includes('YouTube')) notes.push(`YouTube: ${n0(fig(p, 'YouTube')?.watched)}% of the video watched on average` + (fig(p, 'YouTube')?.watchHours ? `, ${(fig(p, 'YouTube')?.watchHours as number).toFixed(1)} hours watched.` : '.'));
    if (pls.includes('Instagram') && follows(p) !== null) notes.push(`Instagram: ${plural(follows(p) as number, 'new follower')} came from this post.`);
    if (pls.includes('X') && fig(p, 'X')?.visits !== null) notes.push(`X: ${n0(fig(p, 'X')?.visits)} profile visits.`);
    if (pls.includes('LinkedIn') && /carousel|document/i.test(p.format)) notes.push('LinkedIn clicks include carousel swipes.');
    d = {
      dOpen: true, dIsPost: true, dIsList: false, dCls: 'drawer wide', dKicker: 'Post figures', dTitle: p.title,
      dMeta: `${p.day} ${monthLabel(p.month).full} · ` + ([p.task, p.pillar, p.peg].filter(Boolean).join(' › ') || 'Not in the calendar') + ` · ${p.format}` + (p.series ? ` · ${p.series}, episode ${p.ep ?? '?'}` : ''),
      dChips: [p.settling ? { text: 'Still settling: out less than 7 days', cls: 'chip c-flat' } : p.ratio === null ? { text: 'No result yet', cls: 'chip c-flat' } : { text: fx(p.ratio) + ' overall result', cls: 'chip ' + (p.ratio >= 1 ? 'c-up' : 'c-down') }],
      dRows: pls.map((pl) => { const f = p.fig[pl]!; return { pl: pl === 'YouTube' ? 'YouTube (views)' : pl, letter: PLAT_LETTER[pl], color: PLAT_COLORS[pl], impr: n0(f.impr), likes: n0(f.likes), comments: n0(f.comments), shares: n0(f.shares), saves: n0(f.saves), clicks: n0(f.clicks), rate: f.rate === null ? '–' : f.rate.toFixed(1) + '%', typical: f.typical === null ? '–' : f.typical.toFixed(1) + '%', result: f.settled ? fx(f.result) : 'settling', rcls: 'chip ' + (!f.settled || f.result === null ? 'c-flat' : f.result >= 1 ? 'c-up' : 'c-down') }; }),
      dExtras: [`All platforms: ${n0(p.impr)} impressions and views` + (p.rateAll === null ? '.' : `, ${p.rateAll.toFixed(1)}% interaction rate.`), ...notes],
      dLinks: pls.map((pl) => { const url = p.links[pl]; return { label: pl, url: url || '', hasUrl: !!url }; }),
      dNote: 'Shares include reposts on LinkedIn and X; saves are Instagram saves and X bookmarks. Interaction rate = (likes + comments + shares + saves) ÷ impressions (views on YouTube); typical = the median for this format on that platform over the last 6 months.'
    };
  } else if (O && O.list) {
    const list = O.list as PP[];
    const chipOf = (p: PP) => (O.chip === 'yt' ? Math.round(watched(p) ?? 0) + '% watched' : O.chip === 'ig' ? plural(follows(p) ?? 0, 'follow') : O.chip === 'li' ? (liRate(p) ?? 0).toFixed(1) + ' per 1,000' : fx(p.ratio));
    d = {
      dOpen: true, dIsPost: false, dIsList: true, dCls: 'drawer', dKicker: 'Posts behind this', dTitle: O.title, dMeta: `${plural(list.length)}. Click one for its figures.`, dChips: [],
      dList: [...list].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ title: p.title, meta: metaOf(p), chip: chipOf(p), ccls: 'chip c-flat', open: openPost(p) }))
    };
  }

  return {
    hasPosts: true, noPosts: false, periods, periodText, pShort,
    rankedNote: ranked.length < 10 ? `Only ${ranked.length} settled posts in this period, so the two lists may overlap.` : `${ranked.length} settled posts in this period.`,
    best, worst, traits, settlingRows, settlingMore, hasSettling: settlingRows.length > 0,
    yt, ytNone: yt.length === 0, hasYt: pub.some((p) => p.fig.YouTube), pctGrid, ytPts, ytLine: ytPts.map((x) => x.x + ',' + x.y).join(' '), monthX, ytCall, ytTrendAria: 'Median share of YouTube videos watched by month: ' + ytPts.map((x) => x.label).join(', '),
    ig, igNone: ig.length === 0, hasIg: pub.some((p) => p.fig.Instagram), igBars, igTrendAria: 'Follows from Instagram posts by month: ' + igBars.map((b) => b.m + ' ' + b.label).join(', '),
    liFormats, liTop, xTop, xNote, hasLi, hasX, hasLiX: hasLi || hasX,
    q, onQ: (e: Event) => set({ pQ: (e.target as HTMLInputElement).value }), tPlats, tSorts, tRows, tCount, tImprHead: tPlat === 'YouTube' ? 'Views' : 'Impressions',
    ...d, close: () => set({ pOpen: null }),
    best1: ranked[0] ?? null
  };
}
