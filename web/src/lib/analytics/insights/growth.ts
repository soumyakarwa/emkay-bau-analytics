// The Growth page: followers, reach, engagement against posting, YouTube attention, what drove a
// month, how much growth is paid, and peers. Months a platform's exports don't cover show as gaps.

import type { GrowthInput, PlatformSeries } from './inputs';
import { PLAT_COLORS, PLAT_LETTER, fx, kfmt, monthDone, monthLabel, n0, plural, segs, sum, type SetState, type State, type VPost } from './view';

const nn = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
const any = (xs: (number | null)[]) => xs.some((v) => v !== null);
const pctChange = (a: number, b: number) => (b ? ((a / b - 1) * 100) : null);

export function growthView(input: GrowthInput, S: State, set: SetState): any {
  const months = input.months;
  if (!months.length || !input.series.some((s) => s.has)) return { hasData: false, noData: true, noDataText: `No ${input.brandName} analytics exports yet. Upload them on the Upload page and this page fills in.` };
  const GM = months.map((m) => monthLabel(m).short);
  const GY = months.map((m) => monthLabel(m).yshort);
  const L = months.length - 1;
  const lastDone = monthDone(months[L], input.asOf);
  const GFULL = months.map((m, i) => monthLabel(m).full + (i === L && !lastDone ? ' (so far)' : ''));
  const plain = (s: string) => s.replace(' (so far)', '');
  // The latest complete month, and the one before it.
  const cur = lastDone ? L : L - 1, prev = cur - 1;
  const curName = monthLabel(months[cur]).name, prevName = monthLabel(months[prev]).name;
  const series = input.series.filter((s) => s.has);
  const by = Object.fromEntries(input.series.map((s) => [s.platform, s])) as Record<string, PlatformSeries>;
  const hasData = series.length > 0;
  if (!hasData) return { hasData: false, noData: true, noDataText: `No ${input.brandName} analytics exports yet. Upload them on the Upload page and this page fills in.` };

  const posts = input.posts;
  const postsIn = (i: number) => posts.filter((p) => p.month === months[i]);
  const openList = (title: string, list: VPost[], note = '') => () => set({ gOpen: { brand: input.brand, title, list, note } });
  const toDrivers = (i: number) => () => {
    set({ gMonth: i });
    const el = typeof document !== 'undefined' ? document.getElementById('drivers') : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const at = (pick: (s: PlatformSeries) => (number | null)[], i: number) => { const v = series.map((s) => pick(s)[i]); return any(v) ? sum(v) : null; };
  const gainAt = (i: number) => at((s) => s.gains, i);
  const reachAt = (i: number) => at((s) => s.org.map((v, k) => (v === null && s.spo[k] === null ? null : nn(v) + nn(s.spo[k]))), i);
  const interAt = (i: number) => at((s) => s.inter, i);

  // Tiles.
  const withTotal = series.filter((s) => s.now !== null);
  const totalNow = withTotal.reduce((a, s) => a + (s.total[L] ?? s.now ?? 0), 0);
  const tile = (label: string, a: number | null, b: number | null, fmt: (v: number) => string, kind: 'abs' | 'pct') => {
    if (a === null) return { label, value: '–', change: '', dir: 'flat', vs: 'no figures yet' };
    if (b === null) return { label, value: fmt(a), change: '', dir: 'flat', vs: `no ${prevName} figures to compare` };
    const d = a - b;
    const change = kind === 'abs' ? (d >= 0 ? '+' : '−') + n0(Math.abs(d)) : (() => { const c = pctChange(a, b); return c === null ? '' : (c >= 0 ? '+' : '−') + Math.abs(c).toFixed(0) + '%'; })();
    return { label, value: fmt(a), change, dir: d >= 0 ? 'up' : 'down', vs: `on ${prevName}` };
  };
  const tiles = [
    { label: 'Followers, all platforms', value: withTotal.length ? '~' + n0(totalNow) : '–', change: '', dir: 'flat', vs: withTotal.length ? `${withTotal.map((s) => s.platform).join(', ')}; from the counts noted on the Upload page` : 'note follower counts on the Upload page' },
    tile(`Net new followers, ${curName}`, gainAt(cur), gainAt(prev), (v) => (v >= 0 ? '+' : '−') + n0(Math.abs(v)), 'abs'),
    tile(`Impressions and views, ${curName}`, reachAt(cur), reachAt(prev), kfmt, 'pct'),
    tile(`Interactions, ${curName}`, interAt(cur), interAt(prev), kfmt, 'pct')
  ];

  // 1. Followers, with goals.
  const monthName = (b: string) => monthLabel(b).full;
  const monthsTo = (b: string) => { const [y, mo] = b.split('-').map(Number); const [y0, m0] = months[L].split('-').map(Number); return (y - y0) * 12 + (mo - m0); };
  const fol = series.map((s) => {
    const pl = s.platform;
    const goal = input.goals[pl] ?? null;
    const approx = s.estimated;
    const tilde = approx ? '~' : '';
    const totals = s.total.filter((v): v is number => v !== null);
    const hasLine = totals.length > 0;
    const lo0 = hasLine ? Math.min(...totals) : 0, hi0 = hasLine ? Math.max(...totals, goal ? goal.target : 0) : 1;
    const lo = lo0 - (hi0 - lo0) * 0.08, hi = hi0 + (hi0 - lo0) * 0.12 || lo0 + 1;
    const fy = (v: number) => 105 - ((v - lo) / (hi - lo || 1)) * 85;
    const fxp = (i: number) => 26 + (i * 318) / Math.max(1, L);
    const pts = s.total.flatMap((v, i) => (v === null ? [] : [{ x: fxp(i).toFixed(1), y: fy(v).toFixed(1), open: openList(`${pl}: posts in ${plain(GFULL[i])}`, postsIn(i).filter((p) => p.platforms.includes(pl))), peek: `${GY[i]}: ${tilde}${n0(v)} followers` + (s.gains[i] !== null ? `, ${(s.gains[i] as number) >= 0 ? '+' : '−'}${n0(Math.abs(s.gains[i] as number))} that month` : '') + `. Click for that month’s ${pl} posts.` }]));
    const maxG = Math.max(1, ...s.gains.map((g) => Math.abs(nn(g))));
    const bars = s.gains.map((g, i) => {
      const h = (Math.abs(nn(g)) / maxG) * 50;
      const neg = nn(g) < 0;
      return { x: (fxp(i) - 9).toFixed(1), w: 18, y: (186 - h).toFixed(1), h: h.toFixed(1), cx: fxp(i).toFixed(1), ly: (186 - h - 3).toFixed(1), label: g === null ? '' : (g >= 0 ? '+' : '−') + (Math.abs(g) >= 1000 ? (Math.abs(g) / 1000).toFixed(1) + 'k' : Math.round(Math.abs(g))), m: GM[i], fill: neg ? '#ee8a22' : i === L && !lastDone ? '#8fb4cf' : PLAT_COLORS[pl], open: toDrivers(i), peek: g === null ? `${GY[i]}: no follower figures for this month.` : `${GY[i]}: ${g >= 0 ? '+' : '−'}${n0(Math.abs(g))} net new followers${pl === 'LinkedIn' && s.spons[i] !== null ? ` (${n0(s.spons[i])} from sponsored posts)` : ''}. Click to see what drove the month.` };
    });
    let goalBits: any = { hasGoal: false };
    if (goal && s.now !== null) {
      const left = Math.max(1, monthsTo(goal.by));
      const now = s.total[L] ?? s.now;
      const need = Math.max(0, goal.target - now);
      const perMonth = need / left;
      const recent = s.gains.slice(Math.max(0, cur - 2), cur + 1).filter((v): v is number => v !== null);
      const pace = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const onPace = pace >= perMonth;
      const byName = monthName(goal.by);
      goalBits = {
        hasGoal: true, goalY: fy(goal.target).toFixed(1), goalTY: (fy(goal.target) - 5).toFixed(1), goalLabel: `Goal ${n0(goal.target)} by ${byName}`,
        goalW: Math.min(100, (now / goal.target) * 100).toFixed(1),
        goalText: need === 0 ? `Goal reached: ${n0(now)} of ${n0(goal.target)}.` : `${n0(now)} of ${n0(goal.target)}. Needs about ${n0(perMonth)} new followers a month until ${byName}; the last ${recent.length} months averaged ${n0(pace)}, so ${onPace ? 'on pace' : 'behind pace'}.`,
        gtext: need === 0 ? 'Goal reached' : onPace ? 'On pace' : 'Behind pace', gcls: 'chip ' + (need === 0 || onPace ? 'c-up' : 'c-down')
      };
    }
    const firstI = s.total.findIndex((v) => v !== null);
    const lastI = s.total.length - 1 - [...s.total].reverse().findIndex((v) => v !== null);
    const yearGain = s.gains.reduce<number>((a, g) => a + nn(g), 0);
    const yearX = fxp(months.findIndex((m, i) => i > 0 && m.endsWith('-01')));
    return {
      name: pl, color: PLAT_COLORS[pl], letter: PLAT_LETTER[pl],
      now: s.now === null ? 'Count not noted' : tilde + n0(s.total[L] ?? s.now), month: s.gains[L] === null ? '–' : (nn(s.gains[L]) >= 0 ? '+' : '−') + n0(Math.abs(nn(s.gains[L]))),
      monthName: `in ${monthLabel(months[L]).name}${lastDone ? '' : ' so far'}`,
      year: any(s.gains) ? `${yearGain >= 0 ? '+' : '−'}${n0(Math.abs(yearGain))}` : '–',
      hasLine, pts, line: pts.map((d) => d.x + ',' + d.y).join(' '), bars,
      yearX: (yearX - 8).toFixed(1), firstYear: months[0].slice(0, 4), nextYear: String(Number(months[0].slice(0, 4)) + 1), hasYearMark: months.some((m, i) => i > 0 && m.endsWith('-01')),
      first: firstI >= 0 ? tilde + n0(s.total[firstI]) : '', firstX: firstI >= 0 ? Math.min(fxp(firstI) - 4, 320) : 22, firstLY: firstI >= 0 ? (fy(s.total[firstI] as number) - 8).toFixed(1) : '0',
      last: lastI >= 0 && lastI < s.total.length && lastI !== firstI ? tilde + n0(s.total[lastI]) : '', lastX: lastI >= 0 ? fxp(lastI) + 4 : 350, lastLY: lastI >= 0 && s.total[lastI] !== null ? (fy(s.total[lastI] as number) - 8).toFixed(1) : '0',
      notes: s.notes, gtext: '', gcls: '', ...goalBits,
      aria: `${pl} followers by month: ` + s.total.map((v, i) => `${GY[i]} ${v === null ? 'no figure' : n0(v)}`).join(', ') + '; net new: ' + s.gains.map((g, i) => `${GY[i]} ${g === null ? 'none' : n0(g)}`).join(', ') + (goal ? `; goal ${goal.target} by ${goal.by}` : '')
    };
  });

  // 2. Reach.
  const rPlat: string = series.some((s) => s.platform === S.rPlat) ? S.rPlat : 'all';
  const rPlats = segs([['all', 'All platforms'], ...series.map((s): [string, string] => [s.platform, s.platform])], rPlat, (id) => set({ rPlat: id }));
  const rp = rPlat === 'all' ? series : [by[rPlat]];
  const R = months.map((_, i) => ({ o: rp.reduce((a, s) => a + nn(s.org[i]), 0), s: rp.reduce((a, s) => a + nn(s.spo[i]), 0), has: rp.some((s) => s.org[i] !== null || s.spo[i] !== null) }));
  const rTop = Math.max(1, ...R.map((x) => x.o + x.s)) * 1.12;
  const ry = (v: number) => 260 - (v / rTop) * 240;
  const slot = 680 / months.length;
  const reach = R.map((x, i) => { const bx = 60 + slot * i + slot * 0.18, w = slot * 0.64; return { x: bx.toFixed(1), w: w.toFixed(1), cx: (bx + w / 2).toFixed(1), yo: ry(x.o).toFixed(1), ho: (260 - ry(x.o)).toFixed(1), ys: ry(x.o + x.s).toFixed(1), hs: (ry(x.o) - ry(x.o + x.s)).toFixed(1), ty: (ry(x.o + x.s) - 5).toFixed(1), total: x.has ? kfmt(x.o + x.s) : 'no data', m: GM[i], mFull: GFULL[i], org: x.has ? n0(x.o) : '–', spo: x.has ? n0(x.s) : '–', totalFull: x.has ? n0(x.o + x.s) : '–', open: toDrivers(i), peek: x.has ? `${GY[i]}: ${n0(x.o)} organic, ${n0(x.s)} sponsored. Click to see what drove the month.` : `${GY[i]}: no export covers this month.` }; });
  const reachGrid = [0, 0.5, 1].map((f) => ({ y: ry((rTop * f) / 1.12).toFixed(1), ty: (ry((rTop * f) / 1.12) + 4).toFixed(1), label: kfmt((rTop * f) / 1.12) }));
  const span = (a: number, b: number) => `${GM[Math.max(0, a)]}–${GM[b]}`;
  const sumR = (a: number, b: number, k: 'o' | 's') => R.slice(Math.max(0, a), b + 1).reduce((s, x) => s + x[k], 0);
  const reachStand: string[] = [];
  if (cur >= 5) {
    const o3 = sumR(cur - 2, cur, 'o'), o3b = sumR(cur - 5, cur - 3, 'o');
    const c = pctChange(o3, o3b);
    if (c !== null) reachStand.push(`Organic reach in ${span(cur - 2, cur)} is ${c >= 0 ? 'up' : 'down'} ${Math.abs(c).toFixed(0)}% on ${span(cur - 5, cur - 3)}.`);
  }
  const campaignMonths = R.map((x, i) => ({ x, i })).filter(({ x }) => x.s > 0);
  reachStand.push(campaignMonths.length ? `Sponsored posts added ${n0(campaignMonths.reduce((a, { x }) => a + x.s, 0))} impressions, in ${campaignMonths.map(({ i }) => GY[i]).join(', ')}.` : `No sponsored impressions${rPlat === 'all' ? '' : ' on ' + rPlat} in these 12 months.`);
  if (!lastDone) reachStand.push(`${monthLabel(months[L]).name} is not complete yet.`);
  const reachAria = 'Impressions by month, organic and sponsored: ' + R.map((x, i) => `${GY[i]} ${n0(x.o)} organic, ${n0(x.s)} sponsored`).join('; ');

  // 3. Engagement against posting.
  const I = months.map((_, i) => interAt(i));
  const eTop = Math.max(1, ...I.map(nn)) * 1.15;
  const ey = (v: number) => 170 - (v / eTop) * 140;
  const ppm = input.postsPerMonth;
  const eng = I.map((v, i) => { const bx = 60 + slot * i + slot * 0.2, w = slot * 0.6; return { x: bx.toFixed(1), w: w.toFixed(1), cx: (bx + w / 2).toFixed(1), y: ey(nn(v)).toFixed(1), h: (170 - ey(nn(v))).toFixed(1), ty: (ey(nn(v)) - 5).toFixed(1), label: v === null ? '' : kfmt(v), open: toDrivers(i), peek: `${GY[i]}: ${n0(v)} interactions from ${plural(ppm[i])}. Click to see what drove the month.` }; });
  const PPv = I.map((v, i) => (v === null || !ppm[i] ? null : v / ppm[i]));
  const pvals = PPv.filter((v): v is number => v !== null);
  const pTop = Math.max(1, ...pvals) * 1.15, pLo = pvals.length ? Math.min(...pvals) * 0.8 : 0;
  const ppy = (v: number) => 360 - ((v - pLo) / (pTop - pLo || 1)) * 130;
  const perPost = PPv.map((v, i) => ({ has: v !== null, x: (60 + slot * i + slot / 2).toFixed(1), y: ppy(nn(v)).toFixed(1), ly: (ppy(nn(v)) - 9).toFixed(1), label: v === null ? '' : n0(v), posts: ppm[i], m: GM[i], open: toDrivers(i), peek: v === null ? `${GY[i]}: no figures.` : `${GY[i]}: ${n0(v)} interactions per post (${plural(ppm[i])}). Click to see what drove the month.` }));
  const sumOf = (xs: (number | null)[], a: number, b: number) => xs.slice(Math.max(0, a), b + 1).reduce<number>((s, x) => s + nn(x), 0);
  const engStand: string[] = [];
  if (cur >= 5) {
    const iC = pctChange(sumOf(I, cur - 2, cur), sumOf(I, cur - 5, cur - 3));
    const pC = pctChange(sumOf(ppm, cur - 2, cur), sumOf(ppm, cur - 5, cur - 3));
    const ppC = pctChange(sumOf(PPv, cur - 2, cur), sumOf(PPv, cur - 5, cur - 3));
    const sg = (v: number | null) => (v === null ? 'not comparable' : (v >= 0 ? 'up ' : 'down ') + Math.abs(v).toFixed(0) + '%');
    engStand.push(`Comparing ${span(cur - 2, cur)} with ${span(cur - 5, cur - 3)}: interactions are ${sg(iC)}, posts ${sg(pC)}, interactions per post ${sg(ppC)}.`);
    engStand.push(ppC === null ? '' : ppC >= 5 ? 'Each post is doing better, not just more posts going out.' : ppC <= -5 ? 'More activity is coming from posting more; each post is doing less well.' : 'Each post is doing about as well as before.');
  } else engStand.push('Needs six complete months of figures to compare.', '');
  const engAria = 'Interactions per month and per post: ' + I.map((v, i) => `${GY[i]} ${n0(v)} total, ${n0(PPv[i])} per post from ${ppm[i]} posts`).join('; ');

  // 4. YouTube attention.
  const Y = by.YouTube;
  const hasYt = !!Y && Y.has && any(Y.org);
  const ytBars = (vals: (number | null)[], label: string) => { const top = Math.max(1, ...vals.map(nn)) * 1.15; const w = Math.min(22, 330 / months.length - 6); return vals.map((v, i) => { const h = (nn(v) / top) * 140; const bx = 14 + i * (336 / months.length); return { x: bx.toFixed(1), w: w.toFixed(1), cx: (bx + w / 2).toFixed(1), y: (170 - h).toFixed(1), h: h.toFixed(1), ly: (170 - h - 3).toFixed(1), label: v === null ? '' : kfmt(v), m: GM[i], open: toDrivers(i), peek: v === null ? `${GY[i]}: no ${label} figure (needs a whole-month export).` : `${GY[i]}: ${n0(v)} ${label}. Click to see what drove the month.` }; }); };
  const yv = hasYt ? Y.org : [], yh = hasYt ? (Y.hours ?? months.map(() => null)) : [];
  const ytViews = hasYt ? ytBars(yv, 'views') : [], ytHours = hasYt ? ytBars(yh, 'watch hours') : [];
  const ytStand: string[] = [];
  if (hasYt) {
    ytStand.push(`Views: ${kfmt(yv[cur])} in ${curName}${yv[0] !== null ? ` against ${kfmt(yv[0])} in ${monthLabel(months[0]).name} ${months[0].slice(0, 4)}` : ''}.`);
    const hm = yh.map((h, i) => ({ h, v: yv[i], i })).filter((x) => x.h !== null && x.v);
    if (hm.length) { const x = hm[hm.length - 1]; ytStand.push(`Watch hours: ${n0(x.h)} in ${monthLabel(months[x.i]).name}, about ${(((x.h as number) * 60) / (x.v as number)).toFixed(1)} minutes per view. Watch hours need a whole-month YouTube export, so months without one are blank.`); }
    else ytStand.push('Watch hours need a whole-month YouTube export; none uploaded yet.');
  }

  // 5. What drove a month.
  const dm: number = typeof S.gMonth === 'number' && S.gMonth >= 0 && S.gMonth <= L ? S.gMonth : cur;
  const dMonths = segs(months.map((_, i): [string, string] => [String(i), GY[i]]), String(dm), (id) => set({ gMonth: Number(id) }));
  const mp = postsIn(dm);
  const dHas = mp.length > 0;
  const maxI2 = Math.max(1, ...mp.map((p) => p.impr));
  const totalI = reachAt(dm);
  const metaOf = (p: VPost) => [`${p.day} ${monthLabel(p.month).short}`, p.format, p.peg ?? (p.inCal ? null : 'not in the calendar')].filter(Boolean).join(' · ');
  const dReach = [...mp].sort((a, b) => b.impr - a.impr).slice(0, 5).map((p) => ({ title: p.title, meta: metaOf(p), w: ((p.impr / maxI2) * 100).toFixed(1), v: kfmt(p.impr), share: totalI ? ((p.impr / totalI) * 100).toFixed(1) + '% of the month' : '', open: openList(p.title, [p]), peek: `${p.title}: ${n0(p.impr)} impressions and views. Click for details.` }));
  const igf = (p: VPost) => p.fig.Instagram?.follows ?? null;
  const igp = mp.filter((p) => igf(p) !== null).sort((a, b) => nn(igf(b)) - nn(igf(a))).slice(0, 5);
  const maxF2 = Math.max(1, ...igp.map((p) => nn(igf(p))));
  const dFollow = igp.map((p) => ({ title: p.title, meta: metaOf(p), w: ((nn(igf(p)) / maxF2) * 100).toFixed(1), v: plural(nn(igf(p)), 'follow'), open: openList(p.title, [p]), peek: `${p.title}: ${n0(igf(p))} new Instagram followers. Click for details.` }));
  const dNoneText = `No posts with figures in ${plain(GFULL[dm])}. Upload that month’s post exports to see what drove it.`;

  // 6. Paid.
  const Li = by.LinkedIn;
  const hasPaid = !!Li && any(Li.gains);
  const pdTop = hasPaid ? Math.max(1, ...Li.gains.map(nn)) * 1.2 : 1;
  const pdy = (v: number) => 220 - (Math.max(0, v) / pdTop) * 190;
  const paid = hasPaid ? Li.gains.map((g, i) => { const s = nn(Li.spons[i]), o = nn(g) - s; const bx = 60 + slot * i + slot * 0.2, w = slot * 0.6; const tot = nn(Li.org[i]) + nn(Li.spo[i]); return { x: bx.toFixed(1), w: w.toFixed(1), cx: (bx + w / 2).toFixed(1), yo: pdy(o).toFixed(1), ho: (220 - pdy(o)).toFixed(1), ys: pdy(nn(g)).toFixed(1), hs: (pdy(o) - pdy(nn(g))).toFixed(1), ty: (pdy(nn(g)) - 5).toFixed(1), label: g === null ? '' : n0(g), m: GM[i], spShare: tot ? Math.round((nn(Li.spo[i]) / tot) * 100) + '%' : '–', open: toDrivers(i), peek: g === null ? `${GY[i]}: no figures.` : `${GY[i]}: ${n0(o)} organic and ${n0(s)} sponsored new LinkedIn followers. Click to see what drove the month.` }; }) : [];
  const spAll = hasPaid ? Li.spons.reduce<number>((a, b) => a + nn(b), 0) : 0, gAll = hasPaid ? Li.gains.reduce<number>((a, b) => a + nn(b), 0) : 0;
  const spMonths = hasPaid ? Li.spons.map((v, i) => ({ v: nn(v), i })).filter((x) => x.v > 0) : [];
  const paidStand = hasPaid
    ? [`Over these 12 months, ${gAll ? Math.round((spAll / gAll) * 100) : 0}% of new LinkedIn followers came from sponsored posts (${n0(spAll)} of ${n0(gAll)}).`, spMonths.length ? `Sponsored followers came in ${spMonths.map((x) => GY[x.i]).join(', ')}. If ad spend is added later, this section can show the cost per new follower.` : 'No sponsored followers in these 12 months.']
    : ['No LinkedIn follower export yet, so paid and organic growth can’t be split.'];
  const paidAria = hasPaid ? 'New LinkedIn followers by month, organic and sponsored: ' + Li.gains.map((g, i) => `${GY[i]} ${nn(g) - nn(Li.spons[i])} organic, ${nn(Li.spons[i])} sponsored`).join('; ') : '';

  // 7. Peers.
  const peers = input.peers.filter((p) => p.followers);
  const gr = peers.map((p) => ({ name: p.name, g: (nn(p.newFollowers) / nn(p.followers)) * 100, n: nn(p.newFollowers), per: p.posts ? nn(p.engagements) / p.posts : 0, posts: nn(p.posts), own: p.own }));
  const maxGr = Math.max(0.001, ...gr.map((x) => x.g)), maxPer = Math.max(0.001, ...gr.map((x) => x.per));
  const peerGrowth = [...gr].sort((a, b) => b.g - a.g).map((x) => ({ name: x.name, cls: 'peer' + (x.own ? ' own' : ''), w: ((x.g / maxGr) * 100).toFixed(1), v: x.g.toFixed(1) + '%', sub: '+' + n0(x.n) + ' followers' }));
  const peerEng = [...gr].sort((a, b) => b.per - a.per).map((x) => ({ name: x.name, cls: 'peer' + (x.own ? ' own' : ''), w: ((x.per / maxPer) * 100).toFixed(1), v: x.per.toFixed(1), sub: plural(x.posts) }));
  const fmtD = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const peersText = input.peersPeriod ? `From LinkedIn’s competitor export, ${fmtD(input.peersPeriod.split(' to ')[0])} to ${fmtD(input.peersPeriod.split(' to ')[1])}. Peers are the pages LinkedIn lists for this page.` : '';

  // The open panel.
  const O = S.gOpen && S.gOpen.brand === input.brand ? S.gOpen : null;
  let dr2: any = { dOpen: false };
  if (O) {
    const list = O.list as VPost[];
    dr2 = {
      dOpen: true, dKicker: list.length === 1 ? 'Post' : 'Posts', dTitle: O.title, dMeta: list.length === 1 ? 'Full figures for every platform are on the Posts page.' : `${plural(list.length)}, most impressions first.`, dNote: O.note || '',
      dRows: [...list].sort((a, b) => b.impr - a.impr).map((p) => ({ title: p.title, chip: n0(p.impr) + ' impressions', ccls: 'chip c-flat', meta: [`${p.day} ${monthLabel(p.month).short}`, [p.task, p.peg].filter(Boolean).join(' › ') || 'Not in the calendar', p.format, `result ${fx(p.ratio)}`].join(' · ') + (igf(p) !== null ? ` · ${plural(nn(igf(p)), 'new Instagram follower')}` : ''), links: p.platforms.map((pl) => { const url = p.links[pl]; return { label: pl, url: url || '', hasUrl: !!url, noUrl: !url }; }) }))
    };
  }

  return {
    hasData: true, noData: false, periodText: `${GFULL[0]} to ${GFULL[L]}`, tiles, fol, curName, prevName,
    rPlats, reach, reachGrid, reachStand, reachAria,
    eng, perPost: perPost.filter((d) => d.has), perPostAll: perPost, perPostLine: perPost.filter((d) => d.has).map((d) => d.x + ',' + d.y).join(' '), engStand, engAria,
    hasYt, noYt: !hasYt, ytViews, ytHours, ytStand, ytViewsAria: 'YouTube views by month: ' + yv.map((v, i) => GY[i] + ' ' + n0(v)).join(', '), ytHoursAria: 'YouTube watch hours by month: ' + yh.map((v, i) => GY[i] + ' ' + n0(v)).join(', '),
    dMonths, dMonthName: plain(GFULL[dm]), dHas, dNone: !dHas, dNoneText, dReach, dFollow, dFollowNone: dFollow.length === 0,
    hasPaid, paid, paidStand, paidAria,
    hasPeers: gr.length > 0, noPeers: gr.length === 0, peerGrowth, peerEng, peersText,
    ...dr2, close: () => set({ gOpen: null })
  };
}
