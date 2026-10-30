// The Overview: the latest complete month at a glance. It runs the other pages' own
// calculations, so every number matches the page it comes from.

import { audienceView } from './audience';
import { frameworkView } from './framework';
import { growthView } from './growth';
import type { AudienceInput, FwInput, GrowthInput, PostsInput } from './inputs';
import { postsView } from './posts';
import { cycleRange } from '../cycle';
import { RESULT, SETTLE_DAYS } from './settings';
import { cycleSpan, monthDone, monthLabel, TASK_COLORS } from './view';

export interface OverviewInput { fw: FwInput; posts: PostsInput; growth: GrowthInput; audience: AudienceInput }
const noop = () => {};

export function overviewView(input: OverviewInput, href: (page: string, tab?: string) => string): any {
  const brand = input.fw.brand;
  // The month under review: the latest complete one.
  const months = input.fw.hasFramework ? input.fw.months : input.posts.months;
  const L = months.length - 1;
  const mi = L > 0 && months.length && !monthDone(months[L], input.fw.asOf) ? L - 1 : L;
  const month = months[mi] ?? input.growth.months.at(-1) ?? input.fw.asOf.slice(0, 7);
  const mName = monthLabel(month).name;
  const inProgress = months.length && !monthDone(months[L], input.fw.asOf) && mi !== L ? monthLabel(months[L]).name : null;

  const hasFw = input.fw.hasFramework && mi >= 0;
  const F = hasFw ? frameworkView(input.fw, { fwPeriod: 'm' + mi, fwBrand: brand }, noop) : null;
  const pIdx = input.posts.months.indexOf(month);
  const PP = input.posts.posts.length && pIdx >= 0 ? postsView(input.posts, { pPeriod: 'm' + pIdx, pBrand: brand }, noop) : null;
  const G = growthView(input.growth, {}, noop);
  const A = audienceView(input.audience, {}, noop);

  // Tiles: growth's figures for the month, and posts published against plan.
  const tiles = G.hasData ? G.tiles.map((t: any) => ({ ...t })) : [];
  if (F?.hasFramework) {
    const rt = F.a7.filter((r: any) => r.cls === 'rt');
    const planned = rt.reduce((s: number, r: any) => s + r.planned, 0), done = rt.reduce((s: number, r: any) => s + r.pub, 0), notYet = rt.reduce((s: number, r: any) => s + r.moved, 0), dropped = rt.reduce((s: number, r: any) => s + r.dropped, 0);
    tiles.push({ label: `Posts published, ${mName}`, value: `${done} of ${planned}`, change: '', dir: 'flat', vs: `${notYet} not published, ${dropped} dropped` });
  }

  // Flags from every page: warnings first, then good news, then things to check.
  type Flag = { kind: string; cls: string; text: string; href: string; go: string };
  const W: Flag[] = [], Gd: Flag[] = [], I: Flag[] = [];
  const flag = (list: Flag[], kind: string, cls: string, text: string, page: string, go: string, tab?: string) => list.push({ kind, cls: 'kind ' + cls, text, href: href(page, tab), go });
  if (F?.hasFramework) {
    F.a3.forEach((t: any) => { if (t.hasTarget && t.verdict !== 'On target') { const under = t.verdict.includes('under'); flag(under ? W : I, under ? 'Below target' : 'Above target', under ? 'k-warn' : 'k-info', `${t.name}: ${t.ytd}% of posts this year against a ${t.target}% target.`, 'framework', 'Framework · Split', 'A'); } });
    F.b5.forEach((i: any) => flag(W, 'Underperforming', 'k-warn', `${i.name} (${i.path}) has been under ${RESULT.rethink}× for three months running: ${i.chips.map((c: any) => c.m + ' ' + c.v).join(', ')}.`, 'framework', 'Framework · Performance', 'B'));
    F.c3Fit.filter((f: any) => f.kind === 'Under-used').forEach((f: any) => flag(W, 'Under-used platform', 'k-warn', f.text, 'framework', 'Framework · Platforms', 'C'));
    F.d3.forEach((s: any) => { const eps = s.epLabels.join(', '); if (s.verdict === 'Fading') flag(W, 'Series fading', 'k-warn', `${s.name} is trending down: ${eps}.`, 'framework', 'Framework · Series', 'D'); if (s.verdict === 'Building') flag(Gd, 'Series building', 'k-good', `${s.name} is trending up: ${eps}.`, 'framework', 'Framework · Series', 'D'); });
    const dorm = F.a4.filter((f: any) => f.kind.startsWith('Dormant'));
    if (dorm.length) flag(I, 'Dormant', 'k-info', dorm.slice(0, 2).map((f: any) => f.text).join(' ') + (dorm.length > 2 ? ` And ${dorm.length - 2} more.` : ''), 'framework', 'Framework · Split', 'A');
    F.b6.slice(0, 2).forEach((i: any) => flag(Gd, 'Doing well on few posts', 'k-good', `${i.name} (${i.path}): ${i.v} from ${i.share}.`, 'framework', 'Framework · Performance', 'B'));
  }
  if (PP?.best1 && PP.best1.ratio >= 2) flag(Gd, 'Standout post', 'k-good', `“${PP.best1.title}” did ${PP.best1.ratio.toFixed(1)}× against a typical post of its format.`, 'posts', 'Posts');
  if (G.hasData) {
    const t = G.tiles[1];
    const cur = input.growth.series.filter((s) => s.has).map((s) => s.gains);
    const L2 = input.growth.months.length - 1;
    const ci = monthDone(input.growth.months[L2], input.growth.asOf) ? L2 : L2 - 1;
    const at = (i: number) => (cur.some((g) => g[i] !== null) ? cur.reduce((a, g) => a + (g[i] ?? 0), 0) : null);
    const a = at(ci), b = at(ci - 1);
    if (a !== null && b !== null) {
      const diff = a - b;
      if (diff < 0 && b > 0 && -diff / b >= 0.15) flag(W, 'Growth dip', 'k-warn', `${t.value} net new followers in ${G.curName}, ${Math.round((-diff / b) * 100)}% fewer than ${G.prevName}.`, 'growth', 'Growth');
      else if (diff >= 0) flag(Gd, 'Growing', 'k-good', `${t.value} net new followers in ${G.curName}, ${t.change} on ${G.prevName}.`, 'growth', 'Growth');
      else flag(I, 'Steady growth', 'k-info', `${t.value} net new followers in ${G.curName}, about the same as ${G.prevName} (${t.change}).`, 'growth', 'Growth');
    }
    if (G.engStand[1]?.startsWith('More activity')) flag(W, 'Engagement per post down', 'k-warn', G.engStand[0] + ' ' + G.engStand[1], 'growth', 'Growth');
    if (G.hasPaid && !/, 0% of new/.test(G.paidStand[0])) flag(I, 'Paid growth', 'k-info', G.paidStand[0], 'growth', 'Growth');
  }
  if (A.hasData) {
    A.jump.forEach((r: any) => { const c = r.cells.at(-1); if (c?.hot) flag(Gd, 'Audience shift', 'k-good', `${r.name}: ${c.v} of new followers in the latest period, ${c.d} on the previous 3.`, 'audience', 'Audience'); });
    if (A.hasVis && A.visStand[0] && !A.visStand[0].startsWith('No group')) flag(I, 'Visits but doesn’t follow', 'k-info', A.visStand[0], 'audience', 'Audience');
  }
  const flags = [...W, ...Gd, ...I];

  // The framework in the month.
  let fwRows: any[] = [], ideas: any[] = [], best: any[] = [], worst: any[] = [];
  if (F?.hasFramework) {
    const col = F.a1Cols[mi];
    const tot = col.cells.reduce((a: number, b: number) => a + b, 0) || 1;
    fwRows = F.taskKeys.map((k: any, i: number) => {
      const b1 = F.b1.find((r: any) => r.name === k.name) || {};
      const t = F.a3[i];
      const res = parseFloat(b1.val);
      return { name: k.name, color: k.color, w: ((col.cells[i] / tot) * 100).toFixed(1), share: `${col.cells[i]} posts · ${Math.round((col.cells[i] / tot) * 100)}%`, result: b1.val || '–', rcls: 'chip ' + (Number.isNaN(res) ? 'c-flat' : res >= 1 ? 'c-up' : 'c-down'), target: t.hasTarget ? `${t.ytd}% against ${t.target}%` : 'No target set', tcls: 'chip ' + (t.verdict === 'On target' ? 'c-up' : t.hasTarget ? (t.verdict.includes('under') ? 'c-down' : 'c-flat') : 'c-flat') };
    });
    const E = frameworkView(input.fw, { fwTab: 'E', fwPeriod: 'm' + mi, fwBrand: brand }, noop);
    ideas = E.e2.filter((g: any) => g.items.length).map((g: any) => ({ group: g.name, cls: g.cls, name: g.items[0].name, path: g.items[0].path, try: g.items[0].try }));
  }
  if (PP?.hasPosts) { best = PP.best.slice(0, 3); worst = PP.worst.slice(0, 3); }

  // Posts that were still settling at the last review (the previous cycle's last week), now ranked.
  const prev = input.posts.months[pIdx - 1];
  const prevEnd = prev ? cycleRange(prev).to : null;
  const settledSince = prevEnd ? input.posts.posts
    .filter((p) => p.month === prev && p.ratio !== null && !p.settling && Date.parse(prevEnd) - Date.parse(p.date) < (SETTLE_DAYS - 1) * 86400000 + 1)
    .sort((a, b) => (b.ratio as number) - (a.ratio as number))
    .map((p) => ({ title: p.title, meta: [`${p.day} ${monthLabel(p.date.slice(0, 7)).short}`, p.format, p.peg ?? (p.inCal ? null : 'not in the calendar')].filter(Boolean).join(' · '), v: (p.ratio as number).toFixed(1) + '×', cls: 'chip ' + ((p.ratio as number) >= 1 ? 'c-up' : 'c-down') })) : [];

  // Audience at a glance.
  let audRows: any[] = [], senRows: any[] = [], fsNow = '';
  if (A.hasData) {
    const audTop = Math.max(1, ...A.aud.map((a: any) => parseFloat(a.now) || 0));
    audRows = A.aud.slice(0, 4).map((a: any) => ({ name: a.name, w: (((parseFloat(a.now) || 0) / audTop) * 100).toFixed(1), now: a.now, change: a.change, ccls: 'chg ' + a.dir }));
    const senColors = ['#ee8a22', '#8a8c8e', '#074974'];
    senRows = A.senGroups.map((g: any, i: number) => ({ name: g.name, w: (g.nowV ?? 0).toFixed(1), now: g.now, change: g.change, ccls: 'chg ' + g.dir, color: senColors[i] ?? TASK_COLORS[0] }));
    fsNow = A.fsNow === null ? '–' : A.fsNow.toFixed(1) + '%';
  }

  return {
    name: input.fw.brandName, mName, periodText: `Monthly review: ${monthLabel(month).full} (${cycleSpan(month)})` + (inProgress ? ` · ${inProgress}’s cycle is still in progress` : ''),
    tiles, flags, flagCount: flags.length, noFlags: flags.length === 0, hasFw: !!F?.hasFramework, noFw: !F?.hasFramework, noFwText: input.fw.noFwText,
    fwRows, ideas, best, worst, hasPosts: best.length > 0, settledSince, hasSettledSince: settledSince.length > 0, prevName: prev ? monthLabel(prev).name : '', audRows, senRows, fsNow, hasAud: A.hasData, audNote: A.single ? A.historyNote : ''
  };
}
