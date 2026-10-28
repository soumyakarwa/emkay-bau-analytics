// The Audience page: target audiences, reach beyond financial services, the seniority split, who
// follows (and watches), who visits but doesn't follow, and which periods brought in target
// audiences. LinkedIn exports a snapshot of its followers each time; trends build up as more
// snapshots are uploaded, and "new followers" are the difference between two snapshots.

import type { AudienceInput, AudRow, AudSnapshot } from './inputs';
import { monthLabel, n0, plural, segs, type SetState, type State, type VPost } from './view';

const p1 = (v: number) => v.toFixed(1) + '%';
const pts1 = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' pts';
const ptsCls = (v: number | null) => 'chg ' + (v === null ? 'flat' : v >= 0.3 ? 'up' : v <= -0.3 ? 'down' : 'flat');
const CONF: Record<string, [string, string]> = { 'Fairly sure': ['Fairly sure', 'chip c-up'], Rough: ['Rough', 'chip c-flat'], Weak: ['Weak', 'chip c-down'] };
const fmtDay = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const COUNTRY = (code: string) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code; } catch { return code; } };

/** The share of a breakdown's total whose labels match. */
function share(rows: AudRow[] | undefined, match: (label: string) => boolean): number | null {
  if (!rows?.length) return null;
  const total = rows.reduce((s, r) => s + r.value, 0);
  return total ? (rows.filter((r) => match(r.label)).reduce((s, r) => s + r.value, 0) / total) * 100 : null;
}
/** New followers between two snapshots, per label (losses count as none). */
function gained(a: AudSnapshot, b: AudSnapshot): Record<string, AudRow[]> {
  const out: Record<string, AudRow[]> = {};
  for (const [dim, rows] of Object.entries(b.dims)) {
    const before = new Map((a.dims[dim] ?? []).map((r) => [r.label, r.value]));
    out[dim] = rows.map((r) => ({ label: r.label, value: Math.max(0, r.value - (before.get(r.label) ?? 0)) }));
  }
  return out;
}

export function audienceView(input: AudienceInput, S: State, set: SetState): any {
  const F = input.followers;
  if (!F.length) return { hasData: false, noData: true, noDataText: `No LinkedIn follower export for ${input.brandName} yet. Upload LinkedIn’s followers export on the Upload page and this page fills in.` };
  const latest = F[F.length - 1];
  const prev = F.length > 1 ? F[F.length - 2] : null;
  const first = F[0];
  const multi = F.length > 1;
  const snapLabel = (s: AudSnapshot) => fmtDay(s.to);
  const shortLabel = (s: AudSnapshot) => monthLabel(s.to.slice(0, 7)).short;
  // "New followers" per interval between snapshots.
  const intervals = F.slice(1).map((s, i) => ({ from: F[i], to: s, dims: gained(F[i], s) }));
  const lastNew = intervals.at(-1) ?? null;
  const rx = (r: { labels: string; flags: string }) => new RegExp(r.labels, r.flags);
  const historyNote = multi ? '' : `Only one LinkedIn follower export so far (${snapLabel(latest)}), so there are no trends or new-follower shares yet. They build up as each month’s export is uploaded.`;
  const openPosts = (title: string, list: VPost[], note = '') => () => set({ aOpen: { brand: input.brand, title, list, note } });
  const postsBetween = (a: string, b: string) => input.posts.filter((p) => p.date > a && p.date <= b);

  // 1. Target audiences.
  const ax = (i: number, n: number) => (n === 1 ? 180 : 22 + (i * 316) / (n - 1));
  const aud = input.rules.map((r) => {
    const re = rx(r);
    const fol = F.map((s) => share(s.dims[r.dimension], (l) => re.test(l)));
    const nw = intervals.map((iv) => share(iv.dims[r.dimension], (l) => re.test(l)));
    const vals = [...fol, ...nw].filter((v): v is number => v !== null);
    const top = Math.max(1, ...vals) * 1.18, low = Math.max(0, Math.min(...vals) * 0.75);
    const ay = (v: number) => 160 - ((v - low) / (top - low || 1)) * 140;
    const pts = fol.flatMap((v, i) => (v === null ? [] : [{ x: ax(i, F.length).toFixed(1), y: ay(v).toFixed(1), ly: (ay(v) - 7).toFixed(1), label: Math.round(v) + '%', m: shortLabel(F[i]), open: i > 0 ? openPosts(`Posts between ${snapLabel(F[i - 1])} and ${snapLabel(F[i])}`, postsBetween(F[i - 1].to, F[i].to)) : null, peek: `${snapLabel(F[i])}: ${p1(v)} of followers` + (i > 0 && nw[i - 1] !== null ? `, ${p1(nw[i - 1] as number)} of new followers since the export before` : '') + '.' }]));
    const ptsNew = nw.flatMap((v, i) => (v === null ? [] : [{ x: ax(i + 1, F.length).toFixed(1), y: ay(v).toFixed(1), open: openPosts(`Posts between ${snapLabel(F[i])} and ${snapLabel(F[i + 1])}`, postsBetween(F[i].to, F[i + 1].to)), peek: `${p1(v)} of new followers between ${snapLabel(F[i])} and ${snapLabel(F[i + 1])} were ${r.name}.` }]));
    const now = fol.at(-1) ?? null, was = fol[0];
    const ch = now !== null && was !== null && multi ? now - was : null;
    const newNow = nw.at(-1) ?? null;
    return {
      name: r.name, rule: r.rule, conf: CONF[r.reliability]?.[0] ?? r.reliability, ccls: CONF[r.reliability]?.[1] ?? 'chip c-flat',
      now: now === null ? '–' : p1(now), change: ch === null ? '' : pts1(ch) + ` since ${snapLabel(first)}`, dir: ch === null ? 'flat' : ch >= 0 ? 'up' : 'down',
      newNow: newNow === null ? '' : `${p1(newNow)} of new followers since ${snapLabel(prev as AudSnapshot)}`,
      hasLine: multi, pts, ptsNew, line: pts.map((d) => d.x + ',' + d.y).join(' '), lineNew: ptsNew.map((d) => d.x + ',' + d.y).join(' '),
      w: now === null ? '0' : Math.min(100, now).toFixed(1),
      aria: `${r.name}: ${now === null ? 'no figure' : p1(now)} of followers` + (multi ? '; by export: ' + fol.map((v, i) => `${snapLabel(F[i])} ${v === null ? '–' : p1(v)}`).join(', ') : '')
    };
  });

  // 2. Beyond financial services.
  const fsRe = new RegExp(input.financialServices.source, input.financialServices.flags);
  const fs = F.map((s) => share(s.dims.Industry, (l) => !fsRe.test(l)));
  const fsVals = fs.filter((v): v is number => v !== null);
  const fsLo = Math.max(0, Math.min(...fsVals) - 6), fsHi = Math.max(...fsVals) + 6;
  const fy2 = (v: number) => 190 - ((v - fsLo) / (fsHi - fsLo || 1)) * 160;
  const fsPts = fs.flatMap((v, i) => (v === null ? [] : [{ x: (F.length === 1 ? 400 : 80 + (i * 640) / (F.length - 1)).toFixed(1), y: fy2(v).toFixed(1), ly: (fy2(v) - 10).toFixed(1), label: p1(v), m: shortLabel(F[i]), open: null, peek: `${snapLabel(F[i])}: ${p1(v)} of followers outside financial services.` }]));
  const fsGrid = [fsLo, (fsLo + fsHi) / 2, fsHi].map((v) => ({ y: fy2(v).toFixed(1), ty: (fy2(v) + 3).toFixed(1), label: Math.round(v) + '%' }));
  const indTotal = (s: AudSnapshot | null) => (s?.dims.Industry ?? []).reduce((a, r) => a + r.value, 0);
  const barList = (rows: AudRow[], s: AudSnapshot, before: AudSnapshot | null, dim: string) => {
    const t = (s.dims[dim] ?? []).reduce((a, r) => a + r.value, 0) || 1;
    const bt = before ? (before.dims[dim] ?? []).reduce((a, r) => a + r.value, 0) : 0;
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => {
      const v = (r.value / t) * 100;
      const b = before?.dims[dim]?.find((x) => x.label === r.label);
      const ch = b && bt ? v - (b.value / bt) * 100 : null;
      return { name: dim === 'Geography' ? COUNTRY(r.label) : r.label, w: ((r.value / max) * 100).toFixed(1), v: p1(v), change: ch === null ? '' : pts1(ch), ccls: ptsCls(ch) };
    });
  };
  const ind = [...(latest.dims.Industry ?? [])].sort((a, b) => b.value - a.value);
  const indOut = barList(ind.filter((r) => !fsRe.test(r.label)).slice(0, 6), latest, prev, 'Industry');
  const indIn = barList(ind.filter((r) => fsRe.test(r.label)).slice(0, 6), latest, prev, 'Industry');
  const fsNow = fs.at(-1) ?? null;
  const fsText = fsNow === null ? 'No industry breakdown in the export.' : `${p1(fsNow)} of followers work outside financial services` + (multi && fs[0] !== null ? ` (${p1(fs[0] as number)} on ${snapLabel(first)}).` : '.');

  // 3. Seniority split.
  const ORDER = input.seniorityOrder;
  const SCOL = ['#fbe3c6', '#f7c58a', '#ee8a22', '#c9cbcc', '#8a8c8e', '#8fb4cf', '#4f86ad', '#215f8a', '#074974', '#04304d'];
  const STC = ['#1d2329', '#1d2329', '#1d2329', '#1d2329', '#ffffff', '#1d2329', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
  const senOf = (rows: AudRow[] | undefined) => { const t = (rows ?? []).reduce((a, r) => a + r.value, 0) || 1; return ORDER.map((l) => (((rows ?? []).find((r) => r.label.toLowerCase() === l.toLowerCase())?.value ?? 0) / t) * 100); };
  const senM = F.map((s) => senOf(s.dims.Seniority));
  const sw = 680 / Math.max(F.length, 4);
  const senCols = senM.map((d, i) => { let acc = 0; const w = Math.min(90, sw * 0.7); const x = 60 + (F.length < 4 ? (680 - F.length * sw) / 2 : 0) + sw * i + (sw - w) / 2; const segsS = d.map((v, k) => { const y0 = 270 - (acc / 100) * 250; acc += v; const y1 = 270 - (acc / 100) * 250; return { y: y1.toFixed(1), h: (y0 - y1).toFixed(1), color: SCOL[k], tc: STC[k], ty: ((y0 + y1) / 2 + 4).toFixed(1), label: v >= 6 ? Math.round(v) + '%' : '', peek: `${snapLabel(F[i])}: ${ORDER[k]} ${p1(v)} of followers` }; }); return { x: x.toFixed(1), w: w.toFixed(1), cx: (x + w / 2).toFixed(1), m: snapLabel(F[i]), segs: segsS }; });
  const senKeys = ORDER.map((name, k) => ({ name, color: SCOL[k] }));
  const stackRow = (name: string, d: number[]) => ({ name, segs: d.map((v, k) => ({ w: v.toFixed(2), color: SCOL[k], tc: STC[k], label: v >= 7 ? Math.round(v) + '%' : '', peek: `${ORDER[k]}: ${p1(v)}` })) });
  const V0 = input.visitors.at(-1) ?? null;
  const senCompare = [stackRow(`All followers, ${snapLabel(latest)}`, senM[senM.length - 1])];
  if (lastNew) senCompare.push(stackRow(`New followers since ${snapLabel(lastNew.from)}`, senOf(lastNew.dims.Seniority)));
  if (V0?.dims.Seniority) senCompare.push(stackRow(`Page visitors, ${fmtDay(V0.from)} to ${fmtDay(V0.to)}`, senOf(V0.dims.Seniority)));
  const grpRes = input.seniorityGroups.map((g) => ({ name: g.name, re: new RegExp(g.source, g.flags) }));
  const grpShare = (rows: AudRow[] | undefined, re: RegExp) => share(rows, (l) => re.test(l));
  const senGroups = grpRes.map((g) => {
    const now = grpShare(latest.dims.Seniority, g.re), was = grpShare(first.dims.Seniority, g.re);
    const ch = multi && now !== null && was !== null ? now - was : null;
    const nw = lastNew ? grpShare(lastNew.dims.Seniority, g.re) : null;
    const vis = V0 ? grpShare(V0.dims.Seniority, g.re) : null;
    return { name: g.name, now: now === null ? '–' : p1(now), nowV: now, change: ch === null ? '' : pts1(ch), dir: ch === null ? 'flat' : ch >= 0 ? 'up' : 'down', newNow: nw === null ? '' : `${p1(nw)} of new followers`, visNow: vis === null ? '' : `${p1(vis)} of page visitors` };
  });
  const senAria = 'Seniority of followers: ' + senM.map((d, i) => snapLabel(F[i]) + ' ' + d.map((v, k) => ORDER[k] + ' ' + Math.round(v) + '%').join(', ')).join('; ');

  // 4. Who follows us.
  const WHO: [string, string][] = [['Industry', 'Industry'], ['Job function', 'Job function'], ['Seniority', 'Seniority'], ['Company size', 'Company size'], ['Location', 'Location']];
  const avail = WHO.filter(([d]) => latest.dims[d]?.length);
  const wd: string = avail.some(([d]) => d === S.aWho) ? S.aWho : (avail[0]?.[0] ?? 'Industry');
  const whoDims = segs(avail, wd, (id) => set({ aWho: id }));
  const who = barList([...(latest.dims[wd] ?? [])].sort((a, b) => b.value - a.value).slice(0, 10), latest, prev, wd);
  const Y = input.youtube;
  const ytList = (dim: string) => (Y?.dims[dim] ? barList([...Y.dims[dim]].sort((a, b) => b.value - a.value).slice(0, 6), Y, null, dim) : []);
  const ytCountry = ytList('Geography'), ytSource = ytList('Traffic source'), ytType = ytList('Content type');
  const ytPeriod = Y ? `${fmtDay(Y.from)} to ${fmtDay(Y.to)}` : '';

  // 5. Visitors against followers.
  const VIS: [string, string][] = [['Job function', 'Job function'], ['Industry', 'Industry'], ['Seniority', 'Seniority'], ['Location', 'Location'], ['Company size', 'Company size']];
  const vAvail = VIS.filter(([d]) => V0?.dims[d]?.length && latest.dims[d]?.length);
  const vd: string = vAvail.some(([d]) => d === S.aVis) ? S.aVis : (vAvail[0]?.[0] ?? 'Job function');
  const visDims = segs(vAvail, vd, (id) => set({ aVis: id }));
  const fRows = latest.dims[vd] ?? [], vRows = V0?.dims[vd] ?? [];
  const fTot = fRows.reduce((a, r) => a + r.value, 0) || 1, vTot = vRows.reduce((a, r) => a + r.value, 0) || 1;
  const labels = [...new Set([...fRows, ...vRows].sort((a, b) => b.value - a.value).map((r) => r.label))].slice(0, 8);
  const visRows = labels.map((l) => ({ n: l, f: ((fRows.find((r) => r.label === l)?.value ?? 0) / fTot) * 100, vis: ((vRows.find((r) => r.label === l)?.value ?? 0) / vTot) * 100 }));
  const vmax = Math.max(1, ...visRows.map((r) => Math.max(r.f, r.vis)));
  const vis = visRows.map((r) => { const g = r.vis - r.f; return { name: r.n, vw: ((r.vis / vmax) * 100).toFixed(1), fw: ((r.f / vmax) * 100).toFixed(1), vv: p1(r.vis), fv: p1(r.f), gap: (g >= 0 ? '+' : '−') + Math.abs(g).toFixed(1) + ' pts', gcls: 'chip ' + (g >= 2 ? 'c-down' : g <= -2 ? 'c-up' : 'c-flat') }; });
  const looking = visRows.filter((r) => r.vis - r.f >= 2).sort((a, b) => b.vis - b.f - (a.vis - a.f));
  const visStand = !V0 ? ['No LinkedIn visitors export yet.'] : looking.length ? looking.slice(0, 3).map((r) => `${r.n}: ${p1(r.vis)} of visitors but only ${p1(r.f)} of followers. They look but don’t stay.`) : ['No group visits much more than it follows: visitors and followers look alike.'];
  if (vd === 'Seniority' && looking.some((r) => /^(training|entry|unpaid)$/i.test(r.n))) visStand.push('Many early-career visitors: a chance to win future talent with careers and culture posts.');
  const visPeriod = V0 ? `${fmtDay(V0.from)} to ${fmtDay(V0.to)}` : '';
  const FR = input.followRate.map((x) => ({ ...x, rate: x.newFollowers !== null && x.visitors ? (x.newFollowers / x.visitors) * 100 : null }));
  const frv = FR.map((x) => x.rate).filter((v): v is number => v !== null);
  const frTop = Math.max(0.1, ...frv) * 1.25, frLo = frv.length ? Math.min(...frv) * 0.7 : 0;
  const fry = (v: number) => 145 - ((v - frLo) / (frTop - frLo || 1)) * 120;
  const frPts = FR.flatMap((x, i) => (x.rate === null ? [] : [{ x: (22 + (i * 316) / Math.max(1, FR.length - 1)).toFixed(1), y: fry(x.rate).toFixed(1), ly: (fry(x.rate) - 7).toFixed(1), label: x.rate.toFixed(1), m: monthLabel(x.month).short, peek: `${monthLabel(x.month).full}: ${n0(x.newFollowers)} new followers from ${n0(x.visitors)} unique visitors (${x.rate.toFixed(1)} per 100)` }]));

  // 6. Periods with jumps in target-audience new followers.
  const jHas = intervals.length > 0;
  const jMonths = intervals.map((iv) => `${shortLabel(iv.from)}–${shortLabel(iv.to)}`);
  const jump = input.rules.map((r) => {
    const re = rx(r);
    const nw = intervals.map((iv) => share(iv.dims[r.dimension], (l) => re.test(l)));
    return { name: r.name, cells: nw.map((v, i) => {
      const prev3 = i >= 3 ? nw.slice(i - 3, i) : null;
      const base = prev3 && prev3.every((x) => x !== null) ? (prev3 as number[]).reduce((a, b) => a + b, 0) / 3 : null;
      const d = v === null || base === null ? null : v - base;
      const iv = intervals[i];
      return { v: v === null ? '–' : p1(v), d: d === null ? '' : pts1(d), cls: 'cell ' + (d !== null && d >= 4 ? 'hv3' : 'hv1'), hot: d !== null && d >= 4, open: openPosts(`Posts between ${snapLabel(iv.from)} and ${snapLabel(iv.to)}`, postsBetween(iv.from.to, iv.to.to), `${r.name} were ${v === null ? '–' : p1(v)} of new followers in this period` + (d === null ? '.' : `, ${pts1(d)} on the previous 3.`)), peek: `${v === null ? '–' : p1(v)} of new followers between ${snapLabel(iv.from)} and ${snapLabel(iv.to)} were ${r.name}` + (d === null ? '' : ` (${pts1(d)} on the previous 3)`) + '. Click for the posts in between.' };
    }) };
  });

  // The open panel.
  const O = S.aOpen && S.aOpen.brand === input.brand ? S.aOpen : null;
  let dr3: any = { dOpen: false };
  if (O) {
    const list = O.list as VPost[];
    dr3 = {
      dOpen: true, dKicker: 'Posts', dTitle: O.title, dMeta: list.length ? `${plural(list.length)}, most impressions first.` : 'No posts with figures in this period.', dNote: O.note || '',
      dRows: [...list].sort((a, b) => b.impr - a.impr).map((p) => ({ title: p.title, chip: n0(p.impr) + ' impressions', ccls: 'chip c-flat', meta: [`${p.day} ${monthLabel(p.month).short}`, [p.task, p.peg].filter(Boolean).join(' › ') || 'Not in the calendar', p.format].join(' · '), links: p.platforms.map((pl) => { const url = p.links[pl]; return { label: pl, url: url || '', hasUrl: !!url, noUrl: !url }; }) }))
    };
  }

  return {
    hasData: true, noData: false, multi, single: !multi, historyNote, latestLabel: snapLabel(latest), periodText: `LinkedIn followers as of ${snapLabel(latest)}` + (multi ? `, against ${F.length - 1} earlier ${F.length === 2 ? 'export' : 'exports'}` : ''),
    aud, hasAud: aud.length > 0,
    fsPts, fsLine: fsPts.map((d) => d.x + ',' + d.y).join(' '), fsGrid, fsAria: 'Share of followers outside financial services: ' + fs.map((v, i) => snapLabel(F[i]) + ' ' + (v === null ? '–' : p1(v))).join(', '), indOut, indIn, fsText, fsNow,
    senCols, senKeys, senCompare, senGroups, senAria,
    whoDims, whoName: wd.toLowerCase(), who, hasYtAud: !!Y, ytCountry, ytSource, ytType, ytPeriod,
    visDims, vis, visStand, visPeriod, hasVis: !!V0 && vAvail.length > 0, frPts, frLine: frPts.map((d) => d.x + ',' + d.y).join(' '), hasFr: frPts.length > 0, frAria: 'New followers per 100 unique visitors by month: ' + frPts.map((d) => d.m + ' ' + d.label).join(', '),
    jHas, jNone: !jHas, jMonths, jump,
    ...dr3, close: () => set({ aOpen: null })
  };
}
