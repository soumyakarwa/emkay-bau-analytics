// The Framework page: is the framework getting its due (A), is it working (B), on which
// platforms (C), in which formats, at which times and in which series (D), and what to change (E).
// Works in the browser from the posts the server sends; `set` changes the page's toggles.

import { cycleOf } from '../cycle';
import type { FwInput } from './inputs';
import { MEASURE_LABEL, OUTCOMES, RESULT, DORMANT_MONTHS, type OutcomeMeasure } from './settings';
import {
  DAYS, PLATFORMS, PLAT_COLORS, PLAT_LETTER, TASK_COLORS, TASK_TEXT, TASK_TEXT_COLORS, fx, median, cycleSpan, tidyPeriod, monthDone, monthLabel, pct, plural,
  segs, type PlatformName, type SetState, type State, type VPost
} from './view';

export type FP = VPost & { m: number };
type Kind = 'mix' | 'plan' | 'perf' | 'outcome' | 'plat';
interface Extra { key?: OutcomeMeasure; unit?: string; platform?: PlatformName; fmt?: (v: number | null) => string }
export interface Ref { peek: string; open: () => void }

/** The months of a period, labelled: short ("Sep"), full ("September 2026", the last "(so far)"). */
export function fwMonths(months: string[], asOf: string) {
  const short = months.map((m) => monthLabel(m).short);
  const full = months.map((m) => monthLabel(m).full + (monthDone(m, asOf) ? '' : ' (so far)'));
  // Last quarter: the latest calendar quarter that has ended, within these months.
  const cur = cycleOf(asOf);
  const [y, mo] = cur.split('-').map(Number);
  const qStartMonth = Math.floor((mo - 1) / 3) * 3 + 1;
  const qEnd = new Date(Date.UTC(y, qStartMonth - 1, 0)).toISOString().slice(0, 7);
  const qStart = new Date(Date.UTC(y, qStartMonth - 4, 1)).toISOString().slice(0, 7);
  const lastQ = months.map((m, i) => (m >= qStart && m <= qEnd ? i : -1)).filter((i) => i >= 0);
  const lastQText = `${monthLabel(qStart).short}–${monthLabel(qEnd).short}`;
  const lastQFull = `${monthLabel(qStart).name} to ${monthLabel(qEnd).full}`;
  return { short, full, lastQ, lastQText, lastQFull };
}

const plain = (s: string) => s.replace(' (so far)', '');
const outcomeOf = (task: string) => OUTCOMES.find((o) => o.match.test(task))?.outcome ?? null;

export function frameworkView(input: FwInput, S: State, set: SetState): any {
  if (!input.hasFramework) return { hasFramework: false as const, noFramework: true as const, noFwText: input.noFwText };
  const fwm = fwMonths(input.months, input.asOf);
  const fw = { months: fwm.short, full: fwm.full, lastQ: fwm.lastQ, lastQText: fwm.lastQText, tasks: input.tasks };
  const COLORS = TASK_COLORS, TEXT_ON = TASK_TEXT, TCOLORS = TASK_TEXT_COLORS;
  const FORMATS = input.formats;
  const posts: FP[] = input.posts.map((p) => ({ ...p, m: input.months.indexOf(p.month) })).filter((p) => p.m >= 0);
  const on = (p: FP, pl: PlatformName) => p.pr[pl] !== undefined;

  // The posts behind any figure: a short preview on hover, the full list on click.
  const dr = (title: string, list: FP[], kind: Kind, extra: Extra = {}): Ref => {
    const one = list.length === 1 && kind !== 'mix' && kind !== 'plan' && kind !== 'plat' && list[0].ratio !== null;
    const peek = one
      ? `${list[0].title} · ${list[0].day} ${fw.months[list[0].m]} · ${fx(list[0].ratio)} against a typical post. Click for details.`
      : `${title}: ` + (list.length ? plural(list.length) + ' (' + list.slice(0, 3).map((p) => p.title).join('; ') + (list.length > 3 ? '; and ' + (list.length - 3) + ' more' : '') + '). Click to see all.' : 'no posts.');
    return { peek, open: () => set({ drawer: { brand: input.brand, title, kind, extra, list } }) };
  };

  // Period: one month, last quarter, or year so far. Opens on the latest month.
  const last = fw.months.length - 1;
  const validP = (p: unknown) => typeof p === 'string' && (p === 'ytd' || (p === 'q' && fw.lastQ.length > 0) || (/^m\d+$/.test(p) && Number(p.slice(1)) <= last));
  const period: string = S.fwBrand === input.brand && validP(S.fwPeriod) ? S.fwPeriod : 'm' + last;
  const inPeriod = period === 'ytd' ? fw.months.map((_, i) => i) : period === 'q' ? fw.lastQ : [Number(period.slice(1))];
  const pOpts: [string, string][] = [...fw.months.map((m, i): [string, string] => ['m' + i, m]), ...(fw.lastQ.length ? [['q', 'Last quarter (' + fw.lastQText + ')'] as [string, string]] : []), ['ytd', 'Year so far']];
  const periodsAB = segs(pOpts, period, (id) => set({ fwPeriod: id, fwBrand: input.brand }));
  const yr = (s: string) => s.replace(/ \d{4}/, '');
  let periodShort = period === 'ytd' ? 'year so far' : period === 'q' ? 'last quarter' : yr(plain(fw.full[inPeriod[0]]));
  const span = (a: number, b: number) => cycleSpan(input.months[a]).split('–')[0] + '–' + cycleSpan(input.months[b]).split('–')[1];
  const periodTextAB = (period === 'ytd' ? 'Year so far: ' + yr(fw.full[0]) + ' to ' + fw.full[last] : period === 'q' ? 'Last quarter: ' + fwm.lastQFull : fw.full[inPeriod[0]]) + ` (${span(inPeriod[0], inPeriod[inPeriod.length - 1])})`;
  const pubAll = posts.filter((p) => p.status === 'published');
  let pub = pubAll;
  let P = pub.filter((p) => inPeriod.includes(p.m));
  // Tabs, and the period for each: A and B follow the month picker; C, D and E use the last 3 months or the year so far.
  const tab: string = ['A', 'B', 'C', 'D', 'E'].includes(S.fwTab) ? S.fwTab : 'A';
  const isCDE = tab === 'C' || tab === 'D' || tab === 'E';
  const cdeP = S.cdePeriod === 'ytd' ? 'ytd' : '3m';
  const cdeMonths = fw.months.map((_, i) => i).filter((i) => cdeP === 'ytd' || i >= last - 2);
  const cdeShort = cdeP === 'ytd' ? 'year so far' : 'last 3 months';
  const periods = isCDE ? segs([['3m', 'Last 3 months'], ['ytd', 'Year so far']], cdeP, (id) => set({ cdePeriod: id })) : periodsAB;
  const periodText = isCDE ? (cdeP === 'ytd' ? 'Year so far: ' : 'Last 3 months: ') + yr(fw.full[cdeMonths[0]]) + ' to ' + fw.full[last] + ` (${span(cdeMonths[0], last)})` : periodTextAB;
  const tabs = segs([['A', 'A · Split'], ['B', 'B · Performance'], ['C', 'C · Platforms'], ['D', 'D · Format, timing, series'], ['E', 'E · What to change']], tab, (id) => set({ fwTab: id }), 'tab');
  const total = P.length || 1;
  const taskKeys = fw.tasks.map((t, i) => ({ name: t.name, color: COLORS[i % COLORS.length] }));
  const colorOf = (k: number) => COLORS[k % COLORS.length];

  // A1: stacked columns, every month.
  const counts = fw.months.map((_, m) => fw.tasks.map((t) => pub.filter((p) => p.m === m && p.task === t.name).length));
  const maxTotal = Math.max(1, ...counts.map((c) => c.reduce((s, x) => s + x, 0)));
  const step = Math.max(1, Math.ceil((maxTotal * 1.1) / 4 / 2) * 2);
  const top = step * 4;
  const Y = (v: number) => 290 - (v / top) * 260;
  const n = fw.months.length;
  const slot = 688 / n;
  const a1Cols = counts.map((c, m) => {
    const w = Math.min(110, slot * 0.55);
    const x = 52 + slot * m + (slot - w) / 2;
    const tot = c.reduce((s, x2) => s + x2, 0);
    let acc = 0;
    const segsA = c.map((v, k) => {
      const y0 = Y(acc), y1 = Y(acc + v); acc += v;
      return { ...dr(`${fw.tasks[k].name}, ${plain(fw.full[m])}`, pub.filter((p) => p.m === m && p.task === fw.tasks[k].name), 'mix'), y: y1.toFixed(1), h: (y0 - y1).toFixed(1), color: colorOf(k), tc: TEXT_ON[k % TEXT_ON.length], ty: ((y0 + y1) / 2 + 4).toFixed(1), label: y0 - y1 >= 16 ? String(v) : '' };
    });
    return { x: x.toFixed(1), w: w.toFixed(1), cx: (x + w / 2).toFixed(1), hx: (52 + slot * m + 4).toFixed(1), hw: (slot - 8).toFixed(1), hl: inPeriod.includes(m) ? '#eef3f7' : 'none', fw: inPeriod.includes(m) ? '700' : '400', segs: segsA, total: tot, ty: (Y(tot) - 8).toFixed(1), label: fw.months[m], cells: c };
  });
  const a1Grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: Y(top * f).toFixed(1), ty: (Y(top * f) + 4).toFixed(1), label: String(Math.round(top * f)) }));
  const a1Aria = 'Posts per month by comms task: ' + a1Cols.map((c, m) => fw.months[m] + ' ' + fw.tasks.map((t, k) => t.name + ' ' + c.cells[k]).join(', ')).join('; ');

  // A2: drill-down per comms task.
  const shade = (hex: string, f: number) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return '#' + c.map((v) => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0')).join(''); };
  const a2 = fw.tasks.map((t, k) => {
    const tp = P.filter((p) => p.task === t.name);
    const tn = tp.length;
    const pillars = t.pillars.map((pl, j) => {
      const pp = tp.filter((p) => p.pillar === pl.name);
      const color = shade(colorOf(k), [0, 0.4, 0.65][j] ?? 0.75);
      const maxPeg = Math.max(1, ...pl.pegs.map((g) => pp.filter((p) => p.peg === g).length));
      return {
        ...dr(`${pl.name} (${t.name}), ${periodShort}`, pp, 'mix'), name: pl.name, n: pp.length, share: pct(pp.length, tn), w: tn ? (pp.length / tn) * 100 : 0, color, tc: j === 0 && k !== 1 ? '#ffffff' : '#1d2329',
        inLabel: tn && pp.length / tn > 0.18 ? pp.length + ' · ' + pct(pp.length, tn) + '%' : '',
        pegs: pl.pegs.map((g) => { const gl = pp.filter((p) => p.peg === g); const c = gl.length; return { ...dr(`${g}, ${periodShort}`, gl, 'mix'), name: g, w: (c / maxPeg) * 100, text: c ? c + ' · ' + pct(c, pp.length) + '%' : 'none', cls: c ? 'peg' : 'peg off' }; })
      };
    });
    return { name: t.name, color: colorOf(k), n: tn, nText: plural(tn), share: pct(tn, total), pillars, aria: t.name + ': ' + pillars.map((p) => p.name + ' ' + p.n).join(', ') };
  });

  // A3: share of posts by month against target, and year so far.
  const hasTargets = fw.tasks.some((t) => t.target !== null);
  const sY = (v: number) => 140 - (Math.min(80, v) / 80) * 125;
  const sX = (i: number) => (n === 1 ? 170 : 62 + (i * 218) / (n - 1));
  const a3Grid = [0, 20, 40, 60, 80].map((v) => ({ y: sY(v).toFixed(1), ty: (sY(v) + 3).toFixed(1), label: v + '%' }));
  const a3 = fw.tasks.map((t, k) => {
    const shares = counts.map((c) => pct(c[k], c.reduce((s, x) => s + x, 0)));
    const ytdN = pub.filter((p) => p.task === t.name).length;
    const ytd = pct(ytdN, pub.length);
    const pts = shares.map((s, i) => ({ ...dr(`${t.name}, ${plain(fw.full[i])}`, pub.filter((p) => p.task === t.name && p.m === i), 'mix'), x: sX(i).toFixed(1), y: sY(s).toFixed(1), ly: (sY(s) - 9).toFixed(1), label: s + '%' }));
    const gap = t.target === null ? null : ytd - t.target;
    const verdict = gap === null ? ['No target', 'verdict v-grey'] : Math.abs(gap) <= 3 ? ['On target', 'verdict v-good'] : gap < 0 ? [Math.abs(gap) + ' pts under', 'verdict v-warn'] : [gap + ' pts over', 'verdict v-info'];
    return {
      name: t.name, color: colorOf(k), hasTarget: t.target !== null, target: t.target, ty: t.target === null ? '0' : sY(t.target).toFixed(1), tly: t.target === null ? '0' : (sY(t.target) - 2).toFixed(1), tly2: t.target === null ? '0' : (sY(t.target) + 11).toFixed(1),
      line: pts.map((d) => d.x + ',' + d.y).join(' '), pts, months: fw.months.map((m, i) => ({ x: sX(i).toFixed(1), label: m })),
      ytd, ytdW: Math.min(100, ytd / 0.8), targetW: t.target === null ? 0 : t.target / 0.8,
      ytdText: t.target === null ? ' of posts (no target set)' : ' of posts against a ' + t.target + '% target',
      verdict: verdict[0], vcls: verdict[1],
      aria: t.name + ' share of posts by month: ' + fw.months.map((m, i) => m + ' ' + shares[i] + '%').join(', ') + (t.target === null ? '' : '; target ' + t.target + '%'),
      bAria: t.name + ' year so far ' + ytd + '%' + (t.target === null ? '' : ' against target ' + t.target + '%')
    };
  });
  const a3Sub = hasTargets
    ? 'Each comms task’s share of the month’s posts, against its target (dashed line). The bar underneath is the year so far, with the target marked.'
    : 'No comms-task targets are set for this brand, so the charts show each comms task’s share of posts over time. Add targets to the calendar and they appear here as a dashed line.';

  // A4: dormant pegs (no posts in the last two months up to the period's end) and crowding.
  const endM = Math.max(...inPeriod);
  const a4: { peek: string; open: () => void; kind: string; cls: string; text: string }[] = [];
  fw.tasks.forEach((t) => t.pillars.forEach((pl) => {
    const idle: string[] = [];
    const idlePegs: string[] = [];
    pl.pegs.forEach((g) => {
      const used = pub.filter((p) => p.peg === g && p.pillar === pl.name && p.m <= endM).map((p) => p.m);
      const lastM = used.length ? Math.max(...used) : -1;
      if (endM - lastM >= DORMANT_MONTHS) { idle.push(g + (lastM < 0 ? ' (none yet)' : ' (last in ' + fw.months[lastM] + ')')); idlePegs.push(g); }
    });
    if (idle.length) a4.push({ ...dr(`Last posts of the dormant pegs in ${pl.name}`, pub.filter((p) => p.task === t.name && p.pillar === pl.name && p.m <= endM && idlePegs.includes(p.peg ?? '')), 'mix'), kind: idle.length === pl.pegs.length ? 'Dormant pillar' : 'Dormant', cls: 'verdict v-grey', text: (idle.length === pl.pegs.length ? `The whole ${pl.name} pillar (${t.name}) has had no posts for ${DORMANT_MONTHS} months: ` : `${pl.name} (${t.name}): `) + idle.join(', ') + '.' });
    const pp = P.filter((p) => p.pillar === pl.name && p.task === t.name);
    if (pp.length >= 4 && pl.pegs.length >= 3) pl.pegs.forEach((g) => {
      const c = pp.filter((p) => p.peg === g).length;
      if (c / pp.length > 0.5) a4.push({ ...dr(`${g} in ${pl.name}, ${periodShort}`, pp.filter((p) => p.peg === g), 'mix'), kind: 'Crowding', cls: 'verdict v-warn', text: `${g} is ${pct(c, pp.length)}% of ${pl.name} (${c} of ${pp.length} posts); its ${pl.pegs.length - 1} other pegs share the rest.` });
    });
  }));

  // A5 and A6: matrices of formats and platforms by comms task and pillar.
  const bucket = (f: number) => (f === 0 ? 'c0' : f < 0.15 ? 'c1' : f < 0.3 ? 'c2' : f < 0.5 ? 'c3' : f < 0.75 ? 'c4' : 'c5');
  const matrix = (cols: string[], has: (p: FP, c: string) => boolean) => {
    const rows: { name: string; cls: string; color: string; n: number; cells: ({ n: number; pct: string; cls: string } & Ref)[] }[] = [];
    fw.tasks.forEach((t, k) => {
      const add = (name: string, list: FP[], cls: string) => rows.push({ name, cls, color: colorOf(k), n: list.length, cells: cols.map((c) => { const cl = list.filter((p) => has(p, c)); const v = cl.length; return { ...dr(`${name} · ${c}, ${periodShort}`, cl, 'mix'), n: v, pct: list.length ? pct(v, list.length) + '%' : '', cls: 'cell ' + bucket(list.length ? v / list.length : 0) }; }) });
      add(t.name, P.filter((p) => p.task === t.name), 'rt');
      t.pillars.forEach((pl) => add(pl.name, P.filter((p) => p.task === t.name && p.pillar === pl.name), 'rp'));
    });
    return rows;
  };
  const a5 = matrix(FORMATS, (p, c) => p.format === c);
  const a6 = matrix(PLATFORMS, (p, c) => p.platforms.includes(c as PlatformName));

  // A7: plan against delivery.
  const planned = posts.filter((p) => inPeriod.includes(p.m));
  const a7: any[] = [];
  const addPlan = (name: string, list: FP[], cls: string, k: number) => {
    const pubN = list.filter((p) => p.status === 'published').length, notYet = list.filter((p) => p.status === 'not-yet').length, dropped = list.filter((p) => p.status === 'dropped').length, all = list.length || 1;
    a7.push({ ...dr(`${name}: planned for ${periodShort}`, list, 'plan'), name, cls, color: cls === 'rt' ? colorOf(k) : 'transparent', planned: list.length, pub: pubN, moved: notYet, dropped, pw: (pubN / all) * 100, mw: (notYet / all) * 100, dw: (dropped / all) * 100, aria: `${name}: ${list.length} planned, ${pubN} published, ${notYet} not published yet, ${dropped} dropped` });
  };
  fw.tasks.forEach((t, k) => { addPlan(t.name, planned.filter((p) => p.task === t.name), 'rt', k); t.pillars.forEach((pl) => addPlan(pl.name, planned.filter((p) => p.task === t.name && p.pillar === pl.name), 'rp', k)); });
  const slipCount: Record<string, number> = {};
  posts.filter((p) => p.status !== 'published' && p.date <= input.asOf && p.peg).forEach((p) => { slipCount[p.peg as string] = (slipCount[p.peg as string] || 0) + 1; });
  const slips = Object.entries(slipCount).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([peg, c]) => `${peg} (${c} times)`);

  // ---------- Part B: performance ----------
  // Only posts with a settled result count from here on.
  pub = pubAll.filter((p) => p.ratio !== null);
  P = pub.filter((p) => inPeriod.includes(p.m));
  const r = (p: FP) => p.ratio as number;
  const bView: string = ['task', 'pillar', 'peg'].includes(S.bView) ? S.bView : 'task';
  const bViews = segs([['task', 'Comms tasks'], ['pillar', 'Pillars'], ['peg', 'Pegs']], bView, (id) => set({ bView: id }));
  const bViewName = ({ task: 'Comms task', pillar: 'Pillar', peg: 'Peg' } as Record<string, string>)[bView];
  type Unit = { unit?: boolean; group?: boolean; name: string; label?: string; level: number; k: number; path?: string; match: (p: FP) => boolean };
  const unitsFor = (grouping: string): Unit[] => {
    const out: Unit[] = [];
    fw.tasks.forEach((t, k) => {
      if (grouping === 'task') { out.push({ unit: true, name: t.name, level: 0, k, match: (p) => p.task === t.name }); return; }
      out.push({ group: true, name: t.name, label: t.name, level: 1, k, match: () => false });
      t.pillars.forEach((pl) => {
        if (grouping === 'pillar') out.push({ unit: true, name: pl.name, level: 1, k, path: t.name, match: (p) => p.task === t.name && p.pillar === pl.name });
        else {
          out.push({ group: true, name: pl.name, label: pl.name, level: 2, k, match: () => false });
          pl.pegs.forEach((g) => out.push({ unit: true, name: g, level: 2, k, path: t.name + ' › ' + pl.name, match: (p) => p.task === t.name && p.pillar === pl.name && p.peg === g }));
        }
      });
    });
    return out;
  };
  const groupRow = (u: Unit) => ({ isGroup: true, notGroup: false, label: u.label, gcls: u.level === 1 ? 'dv-g1' : 'dv-g2', color: colorOf(u.k) });
  const units = unitsFor(bView);

  // B1: diverging bars.
  const dvPos = (v: number) => ((Math.min(2.2, Math.max(0.4, v)) - 0.4) / 1.8) * 100;
  const dvMid = dvPos(1);
  const b1 = units.map((u) => {
    if (u.group) return groupRow(u);
    const list = P.filter(u.match);
    const med = median(list.map(r));
    const left = med === null ? dvMid : Math.min(dvPos(med), dvMid);
    return {
      ...dr(`${u.name}, ${periodShort}`, list, 'perf'), isGroup: false, notGroup: true, name: u.name, ncls: 'n' + u.level, n: list.length, val: fx(med),
      left: left.toFixed(1), width: med === null ? '0' : Math.abs(dvPos(med) - dvMid).toFixed(1),
      bcls: 'dv-bar ' + (med !== null && med >= 1 ? 'up' : 'down') + (list.length < 3 ? ' faint' : '')
    };
  });
  const dvTicks = [0.5, 1, 1.5, 2].map((v) => ({ pos: dvPos(v).toFixed(1), label: v.toFixed(1) + '×' }));

  // B2: comms task lines, month by month; a coloured table for pillars or pegs.
  const nM = fw.months.length;
  const lx = (i: number) => (nM === 1 ? 350 : 90 + (i * 520) / (nM - 1));
  const b2Max = Math.max(1.5, ...fw.tasks.flatMap((t) => fw.months.map((_, m) => median(pub.filter((p) => p.task === t.name && p.m === m).map(r)) || 0))) * 1.08;
  const b2Min = 0.4;
  const ly = (v: number) => 268 - ((Math.max(b2Min, v) - b2Min) / (b2Max - b2Min)) * 240;
  const b2Grid = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].filter((v) => v <= b2Max).map((v) => ({ y: ly(v).toFixed(1), ty: (ly(v) + 4).toFixed(1), label: v.toFixed(2).replace(/0$/, '') + '×', stroke: v === 1 ? '#1d2329' : '#e4e2d8', dash: v === 1 ? '6 4' : '' }));
  const b2Lines = fw.tasks.map((t, k) => {
    const vals = fw.months.map((_, m) => median(pub.filter((p) => p.task === t.name && p.m === m).map(r)));
    const pts = vals.flatMap((v, i) => (v === null ? [] : [{ ...dr(`${t.name}, ${plain(fw.full[i])}`, pub.filter((p) => p.task === t.name && p.m === i), 'perf'), i, x: lx(i).toFixed(1), y: ly(v).toFixed(1), ly: (ly(v) - 10).toFixed(1), label: fx(v), raw: v }]));
    return { name: t.name, color: colorOf(k), tcolor: TCOLORS[k % TCOLORS.length], pts, points: pts.map((d) => d.x + ',' + d.y).join(' '), endY: pts.length ? ly(pts[pts.length - 1].raw) + 4 : 0, ey: '' };
  });
  fw.months.forEach((_, i) => {
    const here = b2Lines.map((l) => l.pts.find((d) => d.i === i)).filter((d): d is NonNullable<typeof d> => !!d).sort((a, b) => Number(a.y) - Number(b.y));
    here.forEach((d, j) => { if (j > 0 && Number(d.y) - Number(here[j - 1].y) < 18) d.ly = (Number(d.y) + 19).toFixed(1); });
  });
  const ends = [...b2Lines].filter((l) => l.pts.length).sort((a, b) => a.endY - b.endY);
  ends.forEach((l, i) => { if (i > 0 && l.endY - ends[i - 1].endY < 16) l.endY = ends[i - 1].endY + 16; });
  b2Lines.forEach((l) => { l.ey = l.endY.toFixed(1); });
  const b2Months = fw.months.map((label, i) => ({ x: lx(i).toFixed(1), label, fw: inPeriod.includes(i) ? '700' : '400' }));
  const b2Band = inPeriod.length < nM ? [{ x: (Math.min(...inPeriod.map(lx)) - 40).toFixed(1), w: (Math.max(...inPeriod.map(lx)) - Math.min(...inPeriod.map(lx)) + 80).toFixed(1) }] : [];
  const b2Aria = 'Median result by month: ' + b2Lines.map((l) => l.name + ' ' + l.pts.map((d) => fw.months[d.i] + ' ' + d.label).join(', ')).join('; ');
  const heat = (v: number | null) => (v === null ? 'hvx' : v < RESULT.rethink ? 'hv0' : v < 1.2 ? 'hv1' : v < 1.5 ? 'hv2' : 'hv3');
  const b2Rows = bView === 'task' ? [] : units.map((u) => {
    if (u.group) return { cls: u.level === 1 ? 'rt' : 'rg', name: u.label, color: colorOf(u.k), cells: fw.months.map(() => ({ cls: 'cell hvx', v: '', n: '', peek: '', open: null as null | (() => void) })) };
    return { cls: u.level === 2 ? 'rp rp2' : 'rp', name: u.name, color: colorOf(u.k), cells: fw.months.map((_, m) => { const list = pub.filter((p) => u.match(p) && p.m === m); const v = median(list.map(r)); return { ...dr(`${u.name}, ${plain(fw.full[m])}`, list, 'perf'), cls: 'cell ' + heat(v), v: v === null ? '–' : fx(v), n: list.length ? plural(list.length) : '' }; }) };
  });

  // B3: strip of posts per part.
  const stPos = (v: number) => ((Math.min(3, Math.max(0.2, v)) - 0.2) / 2.8) * 100;
  const b3 = units.map((u) => {
    if (u.group) return groupRow(u);
    const list = P.filter(u.match);
    const rs = list.map(r);
    const med = median(rs);
    const up = rs.filter((x) => x >= 1).length;
    let badge = ['Too few posts', 'chip c-flat'];
    if (list.length >= 3 && med !== null) {
      if (Math.max(...rs) >= 2.5 && med < 1) badge = ['Carried by one post', 'chip c-down'];
      else if (up / rs.length >= 0.6) badge = ['Consistent', 'chip c-up'];
      else if (up / rs.length < 0.4) badge = ['Mostly below typical', 'chip c-down'];
      else badge = ['Patchy', 'chip c-flat'];
    }
    return {
      isGroup: false, notGroup: true, name: u.name, ncls: 'n' + u.level, color: colorOf(u.k),
      dots: list.map((p) => ({ ...dr(p.title, [p], 'perf'), pos: stPos(r(p)).toFixed(1) })),
      hasMed: med !== null, med: med === null ? '0' : stPos(med).toFixed(1),
      above: list.length ? `${up} of ${list.length}` : '–', badge: badge[0], bcls: badge[1],
      aria: `${u.name}: ${list.length} posts, ${up} above typical, median ${fx(med)}`
    };
  });
  const stTicks = [0.5, 1, 1.5, 2, 2.5].map((v) => ({ pos: stPos(v).toFixed(1), label: v.toFixed(1) + '×' }));

  // B4: each comms task on its own outcome measure, against the other comms tasks.
  const outChart = (t: { name: string }, o: { title: string; measure: OutcomeMeasure }) => {
    const key = o.measure === 'conversation' ? 'deep' : o.measure === 'reach' ? 'impr' : o.measure;
    const val = (p: FP) => (p[key as 'deep' | 'action' | 'spread' | 'impr'] ?? null) as number | null;
    const fmtO = (v: number | null) => (v === null ? '–' : o.measure === 'reach' ? Math.round(v).toLocaleString('en-IN') : v.toFixed(1));
    const mine = fw.months.map((_, m) => median(pub.filter((p) => p.task === t.name && p.m === m).map(val)));
    const other = fw.months.map((_, m) => median(pub.filter((p) => p.task !== t.name && p.m === m).map(val)));
    const topO = Math.max(0.001, ...mine.concat(other).filter((v): v is number => v !== null)) * 1.2;
    const oy = (v: number) => 150 - (v / topO) * 130;
    const ox = (i: number) => (nM === 1 ? 170 : 64 + (i * 216) / (nM - 1));
    const pts = mine.flatMap((v, i) => (v === null ? [] : [{ ...dr(`${t.name}, ${plain(fw.full[i])}: ${MEASURE_LABEL[o.measure]}`, pub.filter((p) => p.task === t.name && p.m === i), 'outcome', { key: o.measure, fmt: fmtO, unit: o.measure === 'reach' ? 'impressions' : 'per 1,000 impressions' }), x: ox(i).toFixed(1), y: oy(v).toFixed(1), ly: (oy(v) - 9).toFixed(1), label: fmtO(v) }]));
    const mAll = median(pub.filter((p) => p.task === t.name).map(val));
    const oAll = median(pub.filter((p) => p.task !== t.name).map(val));
    const ratio = mAll !== null && oAll ? mAll / oAll : null;
    const lastMine = mine.filter((v): v is number => v !== null).at(-1) ?? 0, lastOther = other.filter((v): v is number => v !== null).at(-1) ?? 0;
    return {
      title: o.title, measure: MEASURE_LABEL[o.measure], r: ratio,
      grid: [0, 0.5, 1].map((f) => ({ y: oy(topO * f).toFixed(1), ty: (oy(topO * f) + 3).toFixed(1), label: fmtO(topO * f) })),
      mine: pts.map((d) => d.x + ',' + d.y).join(' '), pts,
      other: other.map((v, i) => (v === null ? null : ox(i).toFixed(1) + ',' + oy(v).toFixed(1))).filter(Boolean).join(' '),
      mineY: (oy(lastMine) + 4).toFixed(1), otherY: (oy(lastOther) + (Math.abs(oy(lastOther) - oy(lastMine)) < 14 ? (lastOther > lastMine ? -10 : 16) : 4)).toFixed(1),
      months: fw.months.map((m, i) => ({ x: ox(i).toFixed(1), label: m })),
      summary: ratio === null ? 'Too few posts with these figures yet.' : `Year so far: ${fmtO(mAll)} against ${fmtO(oAll)} for the other comms tasks (${ratio >= 1 ? Math.round((ratio - 1) * 100) + '% higher' : Math.round((1 - ratio) * 100) + '% lower'}).`,
      aria: `${t.name}, ${MEASURE_LABEL[o.measure]}, by month: ` + mine.map((v, i) => fw.months[i] + ' ' + fmtO(v)).join(', ') + '; other comms tasks: ' + other.map((v, i) => fw.months[i] + ' ' + fmtO(v)).join(', ')
    };
  };
  const b4 = fw.tasks.flatMap((t, k) => {
    const o = outcomeOf(t.name);
    if (!o) return [];
    const charts = [outChart(t, { title: 'Job: ' + o.job, measure: o.measure })];
    if (o.second) charts.push(outChart(t, { title: 'Also: ' + o.second.job, measure: o.second.measure }));
    const rr = charts[0].r;
    const verdict = rr === null ? ['Too few posts', 'verdict v-grey'] : rr >= 1.1 ? ['Doing its job', 'verdict v-good'] : rr < 0.9 ? ['Not yet', 'verdict v-warn'] : ['Level with others', 'verdict v-grey'];
    return [{ name: t.name, color: colorOf(k), tcolor: TCOLORS[k % TCOLORS.length], verdict: verdict[0], vcls: verdict[1], charts }];
  });

  // B5 and B6: watch lists across pillars and pegs.
  const watch = [...unitsFor('pillar'), ...unitsFor('peg')].filter((u) => u.unit);
  const b5: { name: string; path?: string; chips: any[] }[] = [];
  watch.forEach((u) => {
    const ms: { m: number; v: number }[] = [];
    for (let m = endM; m >= 0 && ms.length < 3; m--) { const v = median(pub.filter((p) => u.match(p) && p.m === m).map(r)); if (v !== null) ms.unshift({ m, v }); }
    if (ms.length === 3 && ms.every((x) => x.v < RESULT.rethink)) b5.push({ name: u.name, path: u.path, chips: ms.map((x) => ({ ...dr(`${u.name}, ${plain(fw.full[x.m])}`, pub.filter((p) => u.match(p) && p.m === x.m), 'perf'), m: fw.months[x.m], v: fx(x.v), cls: 'chip c-down' })) });
  });
  const b6: any[] = [];
  watch.forEach((u) => {
    const list = P.filter(u.match);
    if (list.length < RESULT.minPostsForBest) return;
    const v = median(list.map(r));
    const siblings = watch.filter((w) => w.path === u.path);
    const groupN = P.filter((p) => siblings.some((w) => w.match(p))).length;
    const share = list.length / (groupN || 1);
    if (v !== null && v >= RESULT.giveMoreRoom && share < 1 / siblings.length) b6.push({ ...dr(`${u.name}, ${periodShort}`, list, 'perf'), name: u.name, path: u.path, v: fx(v), share: `${list.length} of ${groupN} posts in its group` });
  });

  const periodShortAB = periodShort;
  P = pub.filter((p) => cdeMonths.includes(p.m));
  periodShort = cdeShort;

  // ---------- Part C: platforms ----------
  const drp = (title: string, list: FP[], platform: PlatformName) => dr(title, list, 'plat', { platform });
  const usedPlatforms = PLATFORMS.filter((pl) => posts.some((p) => p.platforms.includes(pl)));
  const platKeys = usedPlatforms.map((pl) => ({ name: pl, color: PLAT_COLORS[pl], letter: PLAT_LETTER[pl] }));
  const hourText = (h: number) => (h === 12 ? '12 noon' : h === 0 ? '12 am' : h < 12 ? h + ' am' : (h - 12) + ' pm');
  const prOf = (pl: PlatformName) => (p: FP) => p.pr[pl] ?? null;

  // C1: a dot per platform for each part.
  const cView: string = ['task', 'pillar', 'peg'].includes(S.cView) ? S.cView : 'task';
  const cViews = segs([['task', 'Comms tasks'], ['pillar', 'Pillars'], ['peg', 'Pegs']], cView, (id) => set({ cView: id }));
  const lateText = (best: string | null, late: string | null, lower = false) =>
    !best ? ['', 'late'] : !late ? [`Too few ${fw.months[last]} posts to check`, 'late l-flat'] : late === best ? [`Still true in ${fw.months[last]}`, 'late l-up'] : [`${fw.months[last]}: ${lower ? late.toLowerCase() : late} led instead`, 'late l-warn'];
  const c1 = unitsFor(cView).map((u) => {
    if (u.group) return groupRow(u);
    const list = P.filter(u.match);
    const dots = usedPlatforms.flatMap((pl) => {
      const pll = list.filter((p) => on(p, pl));
      const v = median(pll.map(prOf(pl)));
      return v === null ? [] : [{ pl, v, n: pll.length, pos: dvPos(v) as number | string, top: 6, color: PLAT_COLORS[pl], letter: PLAT_LETTER[pl], ...drp(`${u.name} on ${pl}, ${periodShort}`, pll, pl) }];
    }).sort((a, b) => Number(a.pos) - Number(b.pos));
    dots.forEach((d, i) => { d.top = i > 0 && Number(d.pos) - Number(dots[i - 1].pos) < 4 && dots[i - 1].top === 6 ? 24 : 6; d.pos = Number(d.pos).toFixed(1); });
    const ok = dots.filter((d) => d.n >= 2);
    const best = ok.length ? ok.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const worst = ok.length ? ok.reduce((a, b) => (b.v < a.v ? b : a)) : null;
    const late = usedPlatforms.flatMap((pl) => { const l2 = list.filter((p) => p.m === last && on(p, pl)); return l2.length >= 2 ? [{ pl, v: median(l2.map(prOf(pl))) as number }] : []; }).sort((a, b) => b.v - a.v)[0];
    const lately = lateText(best?.pl ?? null, late?.pl ?? null);
    const lo = dots.length ? Math.min(...dots.map((d) => Number(d.pos))) : 0, hi = dots.length ? Math.max(...dots.map((d) => Number(d.pos))) : 0;
    return {
      isGroup: false, notGroup: true, name: u.name, ncls: 'n' + u.level, dots, lately: lately[0], lcls: lately[1], hasSpan: dots.length > 1, spanL: lo.toFixed(1), spanW: (hi - lo).toFixed(1),
      best: best ? `${best.pl} ${fx(best.v)}` : list.length ? 'Too few posts' : 'No posts',
      gap: best && worst && best !== worst ? `Lowest: ${worst.pl} ${fx(worst.v)}` : '',
      aria: `${u.name}: ` + dots.map((d) => `${d.pl} ${fx(d.v)} from ${d.n} posts`).join(', ')
    };
  });

  // C2: one comms task (and pillar) across platforms.
  const cTaskName: string = fw.tasks.some((t) => t.name === S.cTask) ? S.cTask : fw.tasks[0].name;
  const cTask = fw.tasks.find((t) => t.name === cTaskName) as (typeof fw.tasks)[number];
  const cPillar: string = cTask.pillars.some((pl) => pl.name === S.cPillar) ? S.cPillar : 'all';
  const c2Tasks = segs(fw.tasks.map((t): [string, string] => [t.name, t.name]), cTaskName, (id) => set({ cTask: id, cPillar: 'all' }));
  const c2Pillars = segs([['all', 'All pillars'], ...cTask.pillars.map((pl): [string, string] => [pl.name, pl.name])], cPillar, (id) => set({ cPillar: id }));
  const sel = (p: FP) => p.task === cTaskName && (cPillar === 'all' || p.pillar === cPillar);
  const selName = cPillar === 'all' ? cTaskName : cPillar;
  const timedPlatforms = PLATFORMS.filter((pl) => pubAll.some((p) => p.hours[pl] !== undefined));
  const c2 = usedPlatforms.map((pl) => {
    const list = P.filter((p) => sel(p) && on(p, pl));
    const v = median(list.map(prOf(pl)));
    const fCount = FORMATS.map((f) => ({ f, l: list.filter((p) => p.format === f) })).filter((x) => x.l.length).sort((a, b) => b.l.length - a.l.length);
    const pegStats = [...new Set(list.map((p) => p.peg))].map((g) => { const l = list.filter((p) => p.peg === g); return { g: g ?? '', l, v: median(l.map(prOf(pl))) as number }; }).sort((a, b) => b.v - a.v);
    const pegs: any[] = [];
    if (pegStats.length) pegs.push({ label: 'Best', name: pegStats[0].g, v: fx(pegStats[0].v), cls: 'chip ' + (pegStats[0].v >= 1 ? 'c-up' : 'c-down'), ...drp(`${pegStats[0].g} on ${pl}, ${periodShort}`, pegStats[0].l, pl) });
    if (pegStats.length > 1) { const w = pegStats[pegStats.length - 1]; pegs.push({ label: 'Weakest', name: w.g, v: fx(w.v), cls: 'chip ' + (w.v >= 1 ? 'c-up' : 'c-down'), ...drp(`${w.g} on ${pl}, ${periodShort}`, w.l, pl) }); }
    const dowCount: Record<number, number> = {}; list.forEach((p) => { dowCount[p.dow] = (dowCount[p.dow] || 0) + 1; });
    const topDays = Object.entries(dowCount).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => DAYS[Number(d)].slice(0, 3));
    const timed = timedPlatforms.includes(pl);
    const hr = timed ? median(list.map((p) => p.hours[pl])) : null;
    const dayStats = Object.keys(dowCount).map((d) => ({ d: Number(d), v: median(list.filter((p) => p.dow === Number(d)).map(prOf(pl))) as number, n: dowCount[Number(d)] })).filter((x) => x.n >= 2).sort((a, b) => b.v - a.v);
    return {
      name: pl, color: PLAT_COLORS[pl], letter: PLAT_LETTER[pl], has: list.length > 0, top: fCount.length ? fCount[0].f : null, topShare: fCount.length ? pct(fCount[0].l.length, list.length) : 0, v,
      result: v === null ? 'No posts' : fx(v), rcls: 'chip ' + (v === null ? 'c-flat' : v >= 1 ? 'c-up' : 'c-down'),
      nText: list.length ? `${plural(list.length)} of ${selName}` : `No ${selName} posts with settled figures on ${pl} in this period.`,
      formats: fCount.slice(0, 3).map((x) => ({ name: x.f, w: (x.l.length / list.length) * 100, text: `${x.l.length} · ${pct(x.l.length, list.length)}%`, ...drp(`${selName} · ${x.f} on ${pl}, ${periodShort}`, x.l, pl) })),
      pegs, hour: hr,
      timing: list.length ? `Usually ${topDays.join(' and ')}` + (timed && hr !== null ? `, around ${hourText(Math.round(hr))}.` : '. (Time of day is not in this platform’s export.)') : '',
      bestDay: dayStats.length ? `Best day: ${DAYS[dayStats[0].d]} (${fx(dayStats[0].v)}).` : 'Too few posts to pick a best day.',
      ...drp(`${selName} on ${pl}, ${periodShort}`, list, pl)
    };
  });
  const ranked = c2.filter((c) => c.v !== null).sort((a, b) => (b.v as number) - (a.v as number));
  const c2Stand: string[] = [];
  if (ranked.length >= 2) {
    const b = ranked[0], w = ranked[ranked.length - 1];
    c2Stand.push(`${selName} does best on ${b.name} (${fx(b.v)}) and weakest on ${w.name} (${fx(w.v)}).`);
    if (b.top && w.top && b.top !== w.top) c2Stand.push(`Format: on ${b.name} it is mostly ${b.top.toLowerCase()} posts (${b.topShare}%); on ${w.name}, mostly ${w.top.toLowerCase()} (${w.topShare}%).`);
    else if (b.top) c2Stand.push(`Format is not the difference: both lean on ${b.top.toLowerCase()} posts.`);
    if (b.pegs.length && w.pegs.length && b.pegs[0].name !== w.pegs[0].name) c2Stand.push(`Content: the best peg on ${b.name} is ${b.pegs[0].name}; on ${w.name} it is ${w.pegs[0].name}.`);
  } else c2Stand.push('Too few posts with settled figures on two or more platforms to compare in this period.');

  // C3: comms tasks by platform: share of posts against result, side by side.
  const c3Fit: { kind: string; cls: string; text: string }[] = [];
  const c3Rows = fw.tasks.map((t, k) => {
    const tl = P.filter((p) => p.task === t.name);
    const cells = usedPlatforms.map((pl) => {
      const l = tl.filter((p) => on(p, pl));
      const share = tl.length ? l.length / tl.length : 0;
      const v = median(l.map(prOf(pl)));
      const dvp = v === null ? dvMid : dvPos(v);
      return { pl, l, raw: v, pcolor: PLAT_COLORS[pl], letter: PLAT_LETTER[pl], shareW: (share * 100).toFixed(1), left: Math.min(dvp, dvMid).toFixed(1), width: Math.abs(dvp - dvMid).toFixed(1), bcls: 'dv-bar ' + (v !== null && v >= 1 ? 'up' : 'down') + (l.length < 2 ? ' faint' : ''), v: v === null ? '' : fx(v), share: l.length ? pct(l.length, tl.length) + '% · ' + l.length : 'not used', shareText: l.length ? pct(l.length, tl.length) + '% · ' + l.length : 'not used', best: false, ...drp(`${t.name} on ${pl}, ${periodShort}`, l, pl) };
    });
    const ok = cells.filter((c) => c.l.length >= 2 && c.raw !== null);
    const best = ok.length ? ok.reduce((a, b) => ((b.raw as number) > (a.raw as number) ? b : a)) : null;
    cells.forEach((c) => { c.best = c === best; });
    const most = cells.length ? cells.reduce((a, b) => (b.l.length > a.l.length ? b : a)) : null;
    if (best && most && best.l.length < most.l.length * 0.7) c3Fit.push({ kind: 'Under-used', cls: 'verdict v-warn', text: `${t.name} does best on ${best.pl} (${best.v}) but only ${pct(best.l.length, tl.length)}% of its posts go there; ${most.pl} gets ${pct(most.l.length, tl.length)}% and does ${most.v || '–'}.` });
    else if (best) c3Fit.push({ kind: 'Good fit', cls: 'verdict v-good', text: `${t.name} does best on ${best.pl} (${best.v}), and ${pct(best.l.length, tl.length)}% of its posts go there.` });
    return { name: t.name, color: colorOf(k), n: plural(tl.length), cells };
  });

  // ---------- Part D: format, timing, series ----------
  const heatRow = (u: Unit) => ({ cls: u.level === 1 ? 'rt' : 'rg', name: u.label, color: colorOf(u.k), cells: FORMATS.map(() => ({ cls: 'cell hvx', v: '', n: '', peek: '', open: null as null | (() => void) })), best: '', lately: '', lcls: 'late' });
  // D1: format by part.
  const dView: string = ['task', 'pillar', 'peg'].includes(S.dView) ? S.dView : 'pillar';
  const dPlat: string = S.dPlat && usedPlatforms.includes(S.dPlat) ? S.dPlat : 'all';
  const dViews = segs([['task', 'Comms tasks'], ['pillar', 'Pillars'], ['peg', 'Pegs']], dView, (id) => set({ dView: id }));
  const dPlats = segs([['all', 'All platforms'], ...usedPlatforms.map((x): [string, string] => [x, x])], dPlat, (id) => set({ dPlat: id }));
  const dVal = (p: FP) => (dPlat === 'all' ? p.ratio : p.pr[dPlat as PlatformName] ?? null);
  const onPlat = (p: FP) => dPlat === 'all' || on(p, dPlat as PlatformName);
  const dOpen = (title: string, l: FP[]) => (dPlat === 'all' ? dr(title, l, 'perf') : drp(title, l, dPlat as PlatformName));
  const where = dPlat === 'all' ? '' : ' on ' + dPlat;
  const d1 = unitsFor(dView).map((u) => {
    if (u.group) return heatRow(u);
    const cells = FORMATS.map((f) => {
      const l = P.filter((p) => u.match(p) && p.format === f && onPlat(p));
      const v = median(l.map(dVal));
      return { raw: v, nn: l.length, f, v: v === null ? '–' : fx(v), n: l.length ? plural(l.length) : '', cls: 'cell ' + heat(v), ...dOpen(`${u.name} · ${f}${where}, ${periodShort}`, l) };
    });
    const ok = cells.filter((c) => c.nn >= 2 && c.raw !== null);
    const best = ok.length ? ok.reduce((a, b) => ((b.raw as number) > (a.raw as number) ? b : a)) : null;
    if (best) best.cls += ' d-top';
    const late = FORMATS.flatMap((f) => { const l2 = P.filter((p) => u.match(p) && p.format === f && onPlat(p) && p.m === last); return l2.length >= 2 ? [{ f, v: median(l2.map(dVal)) as number }] : []; }).sort((a, b) => b.v - a.v)[0];
    const lately = lateText(best?.f ?? null, late?.f ?? null, true);
    return { cls: u.level === 2 ? 'rp rp2' : 'rp', name: u.name, color: colorOf(u.k), cells, lately: lately[0], lcls: lately[1], best: best ? `${best.f} (${best.v})` : 'Too few posts' };
  });
  const dViewName = ({ task: 'Comms task', pillar: 'Pillar', peg: 'Peg' } as Record<string, string>)[dView];

  // D2: day and time. Time of day only where the export gives it.
  const tp: PlatformName | null = timedPlatforms.includes(S.dTime) ? S.dTime : (timedPlatforms[0] ?? null);
  const dTimePlats = tp ? segs(timedPlatforms.map((x): [string, string] => [x, x]), tp, (id) => set({ dTime: id })) : [];
  const BANDS: [number, number, string][] = [[0, 9, 'Before 9 am'], [9, 11, '9–11 am'], [11, 13, '11 am–1 pm'], [13, 16, '1–4 pm'], [16, 19, '4–7 pm'], [19, 24, 'After 7 pm']];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const slots: { d: number; label: string; v: number; n: number }[] = [];
  const d2Grid = tp ? ORDER.map((d) => ({
    day: DAYS[d],
    cells: BANDS.map(([a, b, label]) => {
      const l = P.filter((p) => on(p, tp) && p.dow === d && (p.hours[tp] ?? -1) >= a && (p.hours[tp] ?? -1) < b);
      const v = median(l.map(prOf(tp)));
      if (l.length >= 2 && v !== null) slots.push({ d, label, v, n: l.length });
      return { v: v === null ? '' : fx(v), n: l.length ? plural(l.length) : '', cls: 'cell ' + heat(v), ...drp(`${tp}: ${DAYS[d]}, ${label}, ${periodShort}`, l, tp) };
    })
  })) : [];
  const d2Days = ORDER.map((d) => {
    const l = P.filter((p) => p.dow === d);
    const v = median(l.map(r));
    const left = v === null ? dvMid : Math.min(dvPos(v), dvMid);
    return { name: DAYS[d], d, raw: v, n: l.length, val: fx(v), left: left.toFixed(1), width: v === null ? '0' : Math.abs(dvPos(v) - dvMid).toFixed(1), bcls: 'dv-bar ' + (v !== null && v >= 1 ? 'up' : 'down') + (l.length < 3 ? ' faint' : ''), ...dr(`Posts on ${DAYS[d]}s, ${periodShort}`, l, 'perf') };
  });
  const d2Stand: string[] = [];
  const okDays = d2Days.filter((x) => x.n >= 3 && x.raw !== null).sort((a, b) => (b.raw as number) - (a.raw as number));
  if (okDays.length >= 2) d2Stand.push(`Across all platforms, ${okDays[0].name} posts do best (${okDays[0].val}) and ${okDays[okDays.length - 1].name} posts weakest (${okDays[okDays.length - 1].val}).`);
  else d2Stand.push('Too few posts on most days to compare them. Try a longer period.');
  if (tp) {
    const sortedSlots = slots.sort((a, b) => b.v - a.v);
    if (sortedSlots.length >= 2) d2Stand.push(`On ${tp}, the best slot is ${DAYS[sortedSlots[0].d]}, ${sortedSlots[0].label} (${fx(sortedSlots[0].v)} from ${plural(sortedSlots[0].n)}); the weakest is ${DAYS[sortedSlots[sortedSlots.length - 1].d]}, ${sortedSlots[sortedSlots.length - 1].label} (${fx(sortedSlots[sortedSlots.length - 1].v)}).`);
    else d2Stand.push(`Too few ${tp} posts in this period to compare times. Try a longer period.`);
    const am = median(P.filter((p) => on(p, tp) && (p.hours[tp] ?? 99) < 13).map(prOf(tp)));
    const pm = median(P.filter((p) => on(p, tp) && (p.hours[tp] ?? -1) >= 13).map(prOf(tp)));
    if (am !== null && pm !== null) d2Stand.push(`Mornings (before 1 pm) average ${fx(am)} on ${tp}; afternoons and evenings ${fx(pm)}.`);
  }
  const timeNote = tp ? `Time of day is only in ${timedPlatforms.join(' and ')}’s export; LinkedIn and X give the date only.` : 'None of the platform exports give the time of day yet, so this shows days only.';

  // D3: series, episode by episode (all data, not the period).
  const seriesNames = [...new Set(pub.filter((p) => p.series).map((p) => p.series as string))];
  const d3 = seriesNames.flatMap((name) => {
    const eps = pub.filter((p) => p.series === name).sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0) || a.date.localeCompare(b.date));
    if (eps.length < 2) return [];
    const ne = eps.length;
    const ex = (i: number) => (ne === 1 ? 205 : 60 + (i * 290) / (ne - 1));
    const topS = Math.max(1.6, ...eps.map(r)) * 1.1;
    const ry = (v: number) => 120 - ((Math.max(0.3, v) - 0.3) / (topS - 0.3)) * 96;
    const epNo = (p: FP, i: number) => p.ep ?? i + 1;
    const pts = eps.map((p) => ({ x: '', y: ry(r(p)).toFixed(1), ly: (ry(r(p)) - 10).toFixed(1), label: fx(p.ratio), ...dr(p.title, [p], 'perf') }));
    pts.forEach((d, i) => { d.x = ex(i).toFixed(1); });
    const maxI = Math.max(1, ...eps.map((p) => p.impr));
    const bw = Math.min(34, 220 / ne);
    const bars = eps.map((p, i) => { const h = Math.max(2, (p.impr / maxI) * 62); return { x: (ex(i) - bw / 2).toFixed(1), w: bw.toFixed(1), y: (222 - h).toFixed(1), h: h.toFixed(1), cx: ex(i).toFixed(1), ly: (222 - h - 4).toFixed(1), label: p.impr >= 1000 ? (p.impr / 1000).toFixed(1) + 'k' : String(p.impr), ep: 'EP' + epNo(p, i), ...dr(p.title, [p], 'perf') }; });
    const xs = eps.map((_, i) => i), ys = eps.map(r);
    const mx = xs.reduce((a, b) => a + b, 0) / ne, my = ys.reduce((a, b) => a + b, 0) / ne;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
    const verdict = ne < 4 ? ['Too early to tell', 'verdict v-grey'] : slope > 0.04 ? ['Building', 'verdict v-good'] : slope < -0.04 ? ['Fading', 'verdict v-warn'] : ['Steady', 'verdict v-grey'];
    const first = eps[0], lastE = eps[ne - 1];
    const imprUp = lastE.impr > first.impr * 1.1, imprDown = lastE.impr < first.impr * 0.9;
    return [{
      name, path: [first.task, first.pillar, first.peg].filter(Boolean).join(' › '), n: `${ne} episodes, ${fw.months[first.m]} to ${fw.months[lastE.m]}`,
      verdict: verdict[0], vcls: verdict[1], pts, bars, line: pts.map((d) => d.x + ',' + d.y).join(' '),
      epLabels: eps.map((p, i) => `EP${epNo(p, i)} ${fx(p.ratio)}`),
      grid: [0.5, 1, 1.5, 2, 2.5].filter((v) => v < topS).map((v) => ({ y: ry(v).toFixed(1), ty: (ry(v) + 3).toFixed(1), label: v.toFixed(1) + '×', stroke: v === 1 ? '#4a5560' : '#eeece3', dash: v === 1 ? '4 3' : '' })),
      summary: `EP1 ${fx(first.ratio)} → EP${ne} ${fx(lastE.ratio)}; impressions ${first.impr.toLocaleString('en-IN')} → ${lastE.impr.toLocaleString('en-IN')}. ` + (verdict[0] === 'Too early to tell' ? 'Needs 4 episodes or more before the trend means much.' : verdict[0] === 'Building' ? 'Results are trending up across episodes' + (imprDown ? ', though fewer people are seeing each one: worth promoting it more.' : ': worth continuing.') : verdict[0] === 'Fading' ? 'Results are trending down across episodes: refresh the format or wrap it up.' : 'Results are holding steady' + (imprUp ? ', and each episode reaches more people.' : '.')),
      aria: `${name}: ` + eps.map((p, i) => `EP${epNo(p, i)} ${fx(p.ratio)}, ${p.impr} impressions`).join('; ')
    }];
  });

  // ---------- Part E: what to change ----------
  // E1: priority map of pillars or pegs.
  const eView = S.eView === 'pillar' ? 'pillar' : 'peg';
  const eViews = segs([['pillar', 'Pillars'], ['peg', 'Pegs']], eView, (id) => set({ eView: id }));
  const eUnits = unitsFor(eView).filter((u) => u.unit);
  type Stat = { u: Unit; list: FP[]; n: number; v: number | null; use: number; share: number; groupN: number };
  const statsIn = (u: Unit, pool: Unit[]): Stat => {
    const list = P.filter(u.match);
    const sibs = pool.filter((w) => w.path === u.path);
    const groupN = P.filter((p) => sibs.some((w) => w.match(p))).length;
    const use = groupN ? (list.length / groupN) * sibs.length : 0;
    return { u, list, n: list.length, v: median(list.map(r)), use, share: groupN ? pct(list.length, groupN) : 0, groupN };
  };
  const eStats = eUnits.map((u) => statsIn(u, eUnits));
  const EX = (v: number) => 60 + (Math.min(2.5, Math.max(0, v)) / 2.5) * 680;
  const EY = (v: number) => 390 - ((Math.min(2, Math.max(0.3, v)) - 0.3) / 1.7) * 370;
  const quad = (s: Stat) => ((s.v as number) >= 1 ? (s.use >= 1 ? 'Keep backing' : 'Give more room') : s.use >= 1 ? 'Rethink' : 'Candidate to retire');
  const e1Points = eStats.filter((s) => s.n >= RESULT.minPostsForBest && s.v !== null).map((s) => {
    const x = EX(s.use), y = EY(s.v as number), rad = 5 + Math.sqrt(s.n) * 2.2, right = x > 600;
    return {
      x: x.toFixed(1), y: y.toFixed(1), r: rad.toFixed(1), color: colorOf(s.u.k), label: quad(s) === 'Keep backing' ? '' : s.u.name,
      lx: (right ? x - rad - 4 : x + rad + 4).toFixed(1), ly: (y + 4).toFixed(1), anchor: right ? 'end' : 'start',
      ...dr(`${s.u.name} (${quad(s)}): ${s.share}% of ${s.u.path}, ${fx(s.v)}`, s.list, 'perf')
    };
  });
  const placed: { a: number; b: number; y: number }[] = [];
  [...e1Points].sort((a, b) => Number(a.ly) - Number(b.ly)).forEach((pt) => {
    if (!pt.label) return;
    const w = pt.label.length * 6.2;
    const box = () => { const lx2 = Number(pt.lx); return pt.anchor === 'end' ? [lx2 - w, lx2] : [lx2, lx2 + w]; };
    for (let k = 0; k < 4; k++) {
      const [a, b] = box(), y = Number(pt.ly);
      if (!placed.some((q) => Math.abs(q.y - y) < 13 && a < q.b && b > q.a)) break;
      pt.ly = (y + 13).toFixed(1);
    }
    const [a, b] = box(); placed.push({ a, b, y: Number(pt.ly) });
  });
  const e1XTicks = [0, 0.5, 1, 1.5, 2, 2.5].map((v) => ({ x: EX(v).toFixed(1), label: v === 2.5 ? '2.5×+' : v + '×' }));
  const e1YTicks = [0.5, 1, 1.5, 2].map((v) => ({ y: (EY(v) + 4).toFixed(1), label: v.toFixed(1) + '×' }));
  const e1Aria = 'Priority map: ' + eStats.filter((s) => s.n >= 2 && s.v !== null).map((s) => `${s.u.name} ${quad(s)}, ${s.share}% of its group, ${fx(s.v)}`).join('; ');

  // E2: suggestions, with evidence from parts A to D.
  const bestFormatOf = (list: FP[]) => {
    const fs = FORMATS.map((f) => ({ f, l: list.filter((p) => p.format === f) })).filter((x) => x.l.length >= 2).map((x) => ({ f: x.f, v: median(x.l.map(r)) as number, n: x.l.length })).sort((a, b) => b.v - a.v);
    return fs.length ? fs[0] : null;
  };
  const bestPlatformOf = (list: FP[]) => {
    const ps = usedPlatforms.map((pl) => ({ pl, l: list.filter((p) => on(p, pl)) })).filter((x) => x.l.length >= 2).map((x) => ({ pl: x.pl, v: median(x.l.map(prOf(x.pl))) as number, share: pct(x.l.length, list.length) })).sort((a, b) => b.v - a.v);
    return ps.length ? ps[0] : null;
  };
  const monthsUnder = (u: Unit) => { let c = 0; for (let m = endM; m >= 0; m--) { const v = median(pub.filter((p) => u.match(p) && p.m === m).map(r)); if (v === null) continue; if (v < RESULT.rethink) c++; else break; } return c; };
  const allUnits = [...unitsFor('pillar'), ...unitsFor('peg')].filter((u) => u.unit);
  const allStats = allUnits.map((u) => statsIn(u, allUnits));
  type Card = { name: string; path?: string; why: string[]; try: string; peek: string; open: (() => void) | null };
  const card = (s: Stat, why: string[], tryText: string): Card => ({ name: s.u.name, path: s.u.path, why, try: tryText, ...dr(`${s.u.name}, ${periodShort}`, s.list, 'perf') });
  const room: Card[] = [], rethink: Card[] = [], retire: Card[] = [], add: Card[] = [];
  allStats.forEach((s) => {
    const lastM = Math.max(-1, ...pubAll.filter((p) => s.u.match(p) && p.m <= endM).map((p) => p.m));
    const dormant = endM - lastM >= DORMANT_MONTHS;
    if (s.v === null) return;
    if (s.n >= RESULT.minPostsForBest && s.v >= RESULT.giveMoreRoom && s.use < 1 && !dormant) {
      const bf = bestFormatOf(s.list), bp = bestPlatformOf(s.list);
      room.push(card(s, [`Result ${fx(s.v)} from ${plural(s.n)} (B1)`, `Only ${s.share}% of ${s.u.path}’s posts, under its fair share (E1)`].concat(bf ? [`Best as ${bf.f.toLowerCase()} (${fx(bf.v)}, D1)`] : []).concat(bp ? [`Best on ${bp.pl} (${fx(bp.v)}, C1)`] : []),
        `plan ${s.n + 2} posts over the next 3 months instead of ${s.n}` + (bf ? `, mostly ${bf.f.toLowerCase()}` : '') + (bp ? `, led on ${bp.pl}` : '') + '.'));
    } else if (s.n >= 3 && s.v < RESULT.rethink) {
      const mu = monthsUnder(s.u), bf = bestFormatOf(s.list);
      rethink.push(card(s, [`Result ${fx(s.v)} from ${plural(s.n)} (B1)`].concat(mu >= 2 ? [`Under ${RESULT.rethink}× for ${mu} months running (B5)`] : []).concat([`${s.share}% of ${s.u.path}’s posts`]).concat(bf && bf.v >= 1 ? [`Its ${bf.f.toLowerCase()} posts do ${fx(bf.v)} (D1)`] : []),
        bf && bf.v >= 1 ? `switch to ${bf.f.toLowerCase()} posts, which already do better, and check again in a month.` : 'change the angle or format for the next month and check again.'));
    } else if (s.n >= 2 && s.v < RESULT.rethink && s.use < 1) {
      retire.push(card(s, [`Result ${fx(s.v)} from ${plural(s.n)} (B1)`, `Only ${s.share}% of ${s.u.path}’s posts (E1)`], 'fold it into a stronger peg in the same pillar, or retire it.'));
    }
  });
  a4.filter((f) => f.kind.startsWith('Dormant')).forEach((f) => retire.push({ name: f.kind === 'Dormant pillar' ? 'A whole pillar is dormant' : 'Dormant pegs', path: f.text.split(':')[0], why: [f.text.split(': ').slice(1).join(': ') || f.text, `No posts for ${DORMANT_MONTHS} months or more (A4)`], try: 'decide: plan one post to test it, or retire it from the framework.', peek: f.peek, open: f.open }));
  a3.forEach((t) => { if (t.hasTarget && t.target !== null && t.ytd < t.target - 3) add.push({ name: `More ${t.name}`, path: 'Comms task', why: [`${t.ytd}% of posts this year against a ${t.target}% target (A3)`], try: `add about ${plural(Math.max(1, Math.ceil(((t.target - t.ytd) / 100) * (pubAll.length / fw.months.length))))} a month to reach the target.`, peek: t.pts.length ? t.pts[t.pts.length - 1].peek : '', open: t.pts.length ? t.pts[t.pts.length - 1].open : null }); });
  c3Fit.filter((f) => f.kind === 'Under-used').forEach((f) => add.push({ name: 'Shift to the best platform', path: f.text.split(' does best')[0], why: [f.text + ' (C3)'], try: 'put more of these posts on the platform where they do best.', peek: '', open: null }));
  d3.forEach((s) => { if (s.verdict === 'Building') add.push({ name: `More episodes of ${s.name}`, path: s.path, why: [s.summary.split('. ')[0] + ' (D3)'], try: 'keep the series going and give each episode a push on its best platform.', peek: '', open: null }); if (s.verdict === 'Fading') rethink.push({ name: s.name, path: s.path, why: [s.summary.split('. ')[0] + ' (D3)'], try: 'refresh the format, or end the series on a strong episode.', peek: '', open: null }); });
  const e2 = [
    { name: 'Give more room', cls: 'verdict v-info', sub: 'doing well on few posts', items: room.slice(0, 4) },
    { name: 'Rethink', cls: 'verdict v-warn', sub: 'used a lot, doing poorly', items: rethink.slice(0, 4) },
    { name: 'Retire or revive', cls: 'verdict v-grey', sub: 'little used and doing poorly, or dormant', items: retire.slice(0, 4) },
    { name: 'Add or shift', cls: 'verdict v-good', sub: 'targets, platforms and series', items: add.slice(0, 4) }
  ].map((g) => ({ ...g, none: g.items.length === 0 }));

  // The open post list, if any.
  const D = S.drawer && S.drawer.brand === input.brand ? (S.drawer as { title: string; kind: Kind; extra: Extra; list: FP[] }) : null;
  let drawer: any = {};
  if (D) {
    const val = (p: FP): number => (D.kind === 'plat' ? p.pr[D.extra.platform as PlatformName] ?? -1 : D.kind === 'outcome' ? ((p as any)[D.extra.key === 'conversation' ? 'deep' : D.extra.key === 'reach' ? 'impr' : (D.extra.key as string)] ?? -1) : p.ratio ?? -1);
    const sorted = D.kind === 'perf' || D.kind === 'outcome' || D.kind === 'plat' ? [...D.list].sort((a, b) => val(b) - val(a)) : [...D.list].sort((a, b) => a.date.localeCompare(b.date));
    const rows = sorted.map((p) => {
      const chips: { text: string; cls: string }[] = [];
      if (D.kind === 'plan') chips.push({ text: { published: 'Published', 'not-yet': 'Not published yet', dropped: 'Dropped' }[p.status], cls: 'chip ' + (p.status === 'published' ? 'c-up' : p.status === 'not-yet' ? 'c-flat' : 'c-down') });
      if (D.kind === 'outcome' && D.extra.fmt) chips.push({ text: D.extra.fmt(val(p) < 0 ? null : val(p)) + ' ' + D.extra.unit, cls: 'chip c-flat' });
      if (D.kind === 'plat' && D.extra.platform) { const v = p.pr[D.extra.platform] ?? null; chips.push({ text: fx(v) + ' on ' + D.extra.platform, cls: 'chip ' + (v !== null && v >= 1 ? 'c-up' : 'c-down') }); }
      if (D.kind === 'plat' && D.extra.platform && p.hours[D.extra.platform] !== undefined) chips.push({ text: DAYS[p.dow].slice(0, 3) + ', ' + hourText(p.hours[D.extra.platform] as number), cls: 'chip c-flat' });
      if ((D.kind === 'perf' || D.kind === 'outcome' || D.kind === 'mix') && p.ratio !== null) chips.push({ text: fx(p.ratio) + ' against a typical post', cls: 'chip ' + (p.ratio >= 1 ? 'c-up' : 'c-down') });
      if (p.settling) chips.push({ text: 'Still settling', cls: 'chip c-flat' });
      const live = p.status === 'published';
      return {
        title: p.title, chips,
        meta: (live ? '' : 'Planned for ') + `${p.day} ${fw.months[p.m]} · ${[p.task, p.pillar, p.peg].filter(Boolean).join(' › ')} · ${p.format}`,
        links: p.platforms.map((pl) => { const url = p.links[pl]; return { label: pl, url: url || '', hasUrl: !!url, noUrl: !url }; })
      };
    });
    drawer = { title: D.title, rows, empty: rows.length === 0, sub: plural(rows.length) + (D.kind === 'perf' || D.kind === 'outcome' || D.kind === 'plat' ? ', best result first' : ', oldest first') + '. Links open the live post.' };
  }

  return {
    hasFramework: true as const, noFramework: false as const, noFwText: '', periods, periodText: tidyPeriod(periodText), periodShort: periodShortAB, cdeShort, taskKeys, months: fw.months, full: fw.full,
    tab, tabs, tabA: tab === 'A', tabB: tab === 'B', tabC: tab === 'C', tabD: tab === 'D', tabE: tab === 'E',
    a1Cols, a1Grid, a1Aria, a1Note: ' BAU began in ' + yr(plain(fw.full[0])) + ', so the chart starts there.',
    a2, a3, a3Grid, a3Sub, a4, a4None: a4.length === 0,
    formatCols: FORMATS, platformCols: PLATFORMS, a5, a6, a7, slips: slips.join(', '), hasSlips: slips.length > 0,
    bViews, bViewName, dvTicks, dvMid: dvMid.toFixed(1), b1, b2Grid, b2Lines, b2Months, b2Band, b2Aria, b2Rows, b2HasTable: bView !== 'task',
    b2TableSub: 'Each ' + (bView === 'peg' ? 'peg' : 'pillar') + '’s median result month by month, with its number of posts.', fwMonths: fw.months,
    cViews, c1, platKeys, c2Tasks, c2Pillars, c2, c2Stand, c3Rows, c3Fit,
    dViews, dPlats, d1, dViewName, dTimePlats, hasTime: !!tp, timeNote, d2Bands: BANDS.map((b) => b[2]), d2Grid, d2Days, d2Stand, d3, d3None: d3.length === 0,
    eViews, eUnit: eView === 'peg' ? 'peg' : 'pillar', e1Points, e1XTicks, e1YTicks, e1Aria, e1MidY: EY(1).toFixed(1), e1TopH: (EY(1) - 20).toFixed(1), e1BotH: (390 - EY(1)).toFixed(1), e2,
    drawerOpen: !!D, drawer, closeDrawer: () => set({ drawer: null }),
    stTicks, stMid: stPos(1).toFixed(1), b3, b4, b5, b5None: b5.length === 0, b6, b6None: b6.length === 0, endMonth: yr(plain(fw.full[endM])),
    scored: pubAll.filter((p) => p.ratio !== null).length, published: pubAll.length
  };
}
