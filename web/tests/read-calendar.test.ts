// Each rule of the reader, using the template sample with one mistake injected at a time.

import { beforeAll, describe, expect, it } from 'vitest';
import { summarise } from '../src/lib/workbook';
import { readCalendar } from '../src/lib/workbook/read-calendar';
import type { Issue } from '../src/lib/workbook/types';
import type { Sheet } from '../src/lib/workbook/xlsx';
import { buildSample, patch, readXlsx, rowOf } from './sample';

const TODAY = '2026-10-13';
let base: Sheet[];
const read = (sheets: Sheet[]) => readCalendar(sheets, { today: TODAY });
const only = (issues: Issue[]) => {
  expect(issues).toHaveLength(1);
  return issues[0];
};

beforeAll(() => {
  base = readXlsx(buildSample().bytes);
});

describe('posts', () => {
  it('takes pillar and comms task from the framework, not from the grey cells', () => {
    const post = read(base).workbook!.posts.find((p) => p.title === 'Three myths')!;
    expect(post).toMatchObject({ peg: 'Myths vs reality', pillar: 'Fact-led opinions', commsTask: 'TL', countsAsBau: true, owner: 'Asha Rao' });
  });

  it('keeps posts before the BAU start as a baseline, outside the counts', () => {
    const wb = read(base).workbook!;
    expect(wb.posts.find((p) => p.title === 'Baseline post')!.beforeBauStart).toBe(true);
    expect(summarise(wb).beforeBauStart).toBe(1);
  });

  it('counts compliance posts, but not as BAU', () => {
    const wb = read(base).workbook!;
    expect(wb.posts.find((p) => p.title === 'Do not share your OTP')!.countsAsBau).toBe(false);
    const s = summarise(wb);
    expect(s.notBau.total).toBe(1);
    expect(s.tasks.find((t) => t.code === 'CO')!.share).toBeNull();
  });

  it('leaves Dropped posts out of the counts', () => {
    const s = summarise(read(base).workbook!);
    expect(s.tasks.find((t) => t.code === 'ML')!.byMonth['2026-08']).toBe(1);
  });

  it('still counts posts on a retired peg', () => {
    const wb = read(base).workbook!;
    expect(wb.framework.find((p) => p.peg === 'Old peg')!.active).toBe(false);
    expect(wb.posts.find((p) => p.title === 'Post on a retired peg')!.commsTask).toBe('BB');
  });

  it('reads special characters', () => {
    expect(read(base).workbook!.posts.find((p) => p.title === 'Data post')!.details).toBe('Charts… and “quotes” & more');
  });

  it('reads a long-form article as planned or live', () => {
    const wb = read(base).workbook!;
    expect(wb.posts.find((p) => p.title === 'Planned post')!.longForm).toEqual({ state: 'planned', url: null });
    expect(wb.posts.find((p) => p.title === 'Data post')!.longForm).toEqual({ state: 'published', url: 'https://example.sharepoint.com/article7' });
    expect(wb.posts.find((p) => p.title === 'Three myths')!.longForm).toBeNull();
  });

  it('reports anything else in Long-form', () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const issue = only(read(patch(base, 'Aug 2026', { [`R${r}`]: { value: 'Yes' } })).issues);
    expect(issue.message).toContain('"Yes" is not valid in Long-form. Type Planned');
  });

  it('reads platform links, Planned and Sent', () => {
    const wb = read(base).workbook!;
    expect(wb.posts.find((p) => p.title === 'Do not share your OTP')!.platforms).toEqual([
      { platform: 'LinkedIn', state: 'published', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7400000000000000005' },
      { platform: 'WhatsApp', state: 'sent', url: null }
    ]);
    expect(wb.posts.find((p) => p.title === 'Planned post')!.platforms).toEqual([{ platform: 'LinkedIn', state: 'planned', url: null }]);
  });
});

describe('grey cells', () => {
  it('reports a typed-over comms task but still uses the framework', () => {
    const r = rowOf(base, 'Aug 2026', 'Monthly performance');
    const { workbook, issues } = read(patch(base, 'Aug 2026', { [`C${r}`]: { value: 'TL', formula: false } }));
    const issue = only(issues);
    expect(issue).toMatchObject({ level: 'warning', sheet: 'Aug 2026', cell: `C${r}`, owner: 'Dev Mehta' });
    expect(issue.message).toContain('typed over with "TL"');
    expect(issue.message).toContain('"ML"');
    expect(workbook!.posts.find((p) => p.title === 'Monthly performance')!.commsTask).toBe('ML');
  });

  it('reports a saved value that disagrees with the framework', () => {
    const r = rowOf(base, 'Aug 2026', 'Monthly performance');
    const issue = only(read(patch(base, 'Aug 2026', { [`D${r}`]: { value: 'Company', formula: true } })).issues);
    expect(issue.message).toContain('shows "Company" but should show "Product placement"');
  });
});

describe('blocking errors', () => {
  it('a peg that is not in the framework', () => {
    const r = rowOf(base, 'Sep 2026', 'Data post');
    const { workbook, issues } = read(patch(base, 'Sep 2026', { [`E${r}`]: { value: 'Made-up peg' } }));
    expect(only(issues)).toMatchObject({ level: 'error', cell: `E${r}` });
    expect(workbook!.posts.find((p) => p.title === 'Data post')!.commsTask).toBeNull();
  });

  it('a date typed as text', () => {
    const r = rowOf(base, 'Sep 2026', 'Data post');
    const issue = only(read(patch(base, 'Sep 2026', { [`A${r}`]: { value: '9th Sept' } })).issues);
    expect(issue).toMatchObject({ level: 'error', cell: `A${r}` });
    expect(issue.message).toContain('typed as text');
  });

  it('a date in another month', () => {
    const r = rowOf(base, 'Sep 2026', 'Data post');
    const issue = only(read(patch(base, 'Sep 2026', { [`A${r}`]: { value: 46296 } })).issues); // 1 Oct 2026
    expect(issue).toMatchObject({ level: 'error', cell: `A${r}` });
    expect(issue.message).toContain('2026-10-01 is not in Sep 2026');
  });

  it('a missing month sheet', () => {
    const { issues } = read(base.filter((s) => s.name !== 'Jan 2027'));
    expect(only(issues)).toMatchObject({ level: 'error', sheet: 'Jan 2027' });
  });

  it('a template version the site does not know', () => {
    const { workbook, issues } = read(patch(base, 'Start here', { B5: { value: '9.9' } }));
    expect(workbook).toBeNull();
    expect(only(issues).level).toBe('error');
  });
});

describe('warnings', () => {
  it('a value that is not on the Lists sheet', () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const issue = only(read(patch(base, 'Aug 2026', { [`I${r}`]: { value: 'Carousal' } })).issues);
    expect(issue).toMatchObject({ level: 'warning', cell: `I${r}` });
  });

  it('a platform cell that is neither Planned nor a link', () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const issue = only(read(patch(base, 'Aug 2026', { [`L${r}`]: { value: 'Post link', url: null } })).issues);
    expect(issue.message).toContain('"Post link" is not valid in LinkedIn');
  });

  it("a link in another platform's column", () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const insta = read(patch(base, 'Aug 2026', { [`L${r}`]: { value: 'https://www.instagram.com/reel/abc/', url: null } })).issues;
    expect(only(insta).message).toBe('The LinkedIn column has an Instagram link. Move it to the Instagram column and paste the LinkedIn post link here.');
    const other = read(patch(base, 'Aug 2026', { [`L${r}`]: { value: 'https://example.com/post', url: null } })).issues;
    expect(only(other).message).toBe('The LinkedIn column has a link to example.com, not to a LinkedIn post. Paste the LinkedIn post link.');
    const sub = read(patch(base, 'Aug 2026', { [`L${r}`]: { value: 'https://in.linkedin.com/posts/x-activity-7400000000000000002-AbCd', url: null } })).issues;
    expect(sub).toEqual([]);
  });

  it('a short LinkedIn link, which cannot be matched to the analytics', () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const issues = read(patch(base, 'Aug 2026', { [`L${r}`]: { value: 'https://lnkd.in/p/dYxWBdqV', url: null } })).issues;
    expect(only(issues).message).toMatch(/^This is a short LinkedIn link \(lnkd\.in\).*Copy link to post/);
  });

  it('a link to a file on one computer', () => {
    const r = rowOf(base, 'Aug 2026', 'Three myths');
    const issue = only(read(patch(base, 'Aug 2026', { [`Q${r}`]: { value: '../AppData/Roaming/Microsoft/Excel/copy.docx', url: null } })).issues);
    expect(issue.message).toContain('points to a file on one computer');
  });

  it('missing details on a past post, but not on a future one', () => {
    const past = rowOf(base, 'Aug 2026', 'Three myths');
    const future = rowOf(base, 'Nov 2026', 'Planned post');
    const sheets = patch(patch(base, 'Aug 2026', { [`J${past}`]: null }), 'Nov 2026', { [`J${future}`]: null });
    const issue = only(read(sheets).issues);
    expect(issue).toMatchObject({ sheet: 'Aug 2026', cell: `J${past}` });
    expect(issue.message).toContain('no owner');
  });

  it('a Published post with no link', () => {
    const r = rowOf(base, 'Aug 2026', 'Second post on the same day');
    const issue = only(read(patch(base, 'Aug 2026', { [`N${r}`]: null })).issues);
    expect(issue.message).toContain('Published but has no post link');
  });

  it('a row typed below the table', () => {
    const s = base.find((x) => x.name === 'Oct 2026')!;
    const below = s.tables[0].bottom + 2;
    const issue = only(read(patch(base, 'Oct 2026', { [`G${below}`]: { value: 'Typed under the table' } })).issues);
    expect(issue.message).toContain('below the table');
  });

  it('BAU targets that do not add up to 100%', () => {
    const issue = only(read(patch(base, 'Comms tasks', { D2: { value: 0.5 } })).issues);
    expect(issue.message).toContain('110%');
  });
});
