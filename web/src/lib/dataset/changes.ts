// What changed in a brand's framework between two uploads of the same year, so a significant
// change (for example a peg moved to another pillar, which re-files its past posts) is visible.

import { normalise } from '../workbook/contract';
import type { CalendarWorkbook } from '../workbook/types';

export interface FrameworkChange {
  kind: 'peg-added' | 'peg-removed' | 'peg-moved' | 'peg-retired' | 'peg-reactivated' | 'task-added' | 'task-removed' | 'task-changed';
  message: string;
}

const pct = (n: number | null) => (n === null ? 'none' : `${Math.round(n * 100)}%`);

export function compareFrameworks(before: CalendarWorkbook, after: CalendarWorkbook): FrameworkChange[] {
  const changes: FrameworkChange[] = [];
  const postsOn = (peg: string) => after.posts.filter((p) => p.peg === peg).length;

  const oldTasks = new Map(before.commsTasks.map((t) => [normalise(t.code), t]));
  const newTasks = new Map(after.commsTasks.map((t) => [normalise(t.code), t]));
  for (const [k, t] of newTasks) {
    const o = oldTasks.get(k);
    if (!o) {
      changes.push({ kind: 'task-added', message: `New comms task ${t.code} (${t.name}).` });
      continue;
    }
    const diffs: string[] = [];
    if (o.name !== t.name) diffs.push(`renamed from "${o.name}" to "${t.name}"`);
    if (o.target !== t.target) diffs.push(`target ${pct(o.target)} → ${pct(t.target)}`);
    if (o.countsAsBau !== t.countsAsBau) diffs.push(t.countsAsBau ? 'now counts as BAU' : 'no longer counts as BAU');
    if (o.active !== t.active) diffs.push(t.active ? 'brought back into use' : 'retired');
    if (diffs.length) changes.push({ kind: 'task-changed', message: `Comms task ${t.code}: ${diffs.join(', ')}.` });
  }
  for (const [k, o] of oldTasks) {
    if (!newTasks.has(k)) changes.push({ kind: 'task-removed', message: `Comms task ${o.code} (${o.name}) was deleted.` });
  }

  const oldPegs = new Map(before.framework.map((p) => [normalise(p.peg), p]));
  const newPegs = new Map(after.framework.map((p) => [normalise(p.peg), p]));
  for (const [k, p] of newPegs) {
    const o = oldPegs.get(k);
    if (!o) {
      changes.push({ kind: 'peg-added', message: `New peg "${p.peg}" under ${p.commsTask} › ${p.pillar}.` });
      continue;
    }
    if (o.pillar !== p.pillar || o.commsTask !== p.commsTask) {
      const n = postsOn(p.peg);
      changes.push({
        kind: 'peg-moved',
        message: `Peg "${p.peg}" moved from ${o.commsTask} › ${o.pillar} to ${p.commsTask} › ${p.pillar}. ` +
          `This re-files ${n} post${n === 1 ? '' : 's'} this year, past ones included.`
      });
    }
    if (o.active && !p.active) changes.push({ kind: 'peg-retired', message: `Peg "${p.peg}" was retired.` });
    if (!o.active && p.active) changes.push({ kind: 'peg-reactivated', message: `Peg "${p.peg}" is back in use.` });
  }
  for (const [k, o] of oldPegs) {
    if (!newPegs.has(k)) changes.push({ kind: 'peg-removed', message: `Peg "${o.peg}" was deleted instead of retired.` });
  }
  return changes;
}
