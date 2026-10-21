import { percent, type Tally } from './assessment-score';
import { PILLAR_CODES, type PillarCode } from './assessment-template';

// The admin side of the building assessment (DRRM-015 Phase 2): turning stored pillar rows into
// scores, the change between two assessments, and (Part B) the dashboard rollup. Pure code, so the
// Buildings list, the dashboard and the tests agree.

const emptyTally = (): Tally => ({ safe: 0, counted: 0, na: 0 });

/** An assessment's four assessment_pillar_scores rows as pillar tallies, and their sum. */
export function scoresFromPillarRows(
  rows: { code: string; safe_count: number; counted_count: number; na_count: number }[]
): { overall: Tally; pillars: Record<PillarCode, Tally> } {
  const pillars = Object.fromEntries(PILLAR_CODES.map((p) => [p, emptyTally()])) as Record<
    PillarCode,
    Tally
  >;
  const overall = emptyTally();
  for (const row of rows) {
    if (!(PILLAR_CODES as readonly string[]).includes(row.code)) continue;
    const tally = pillars[row.code as PillarCode];
    tally.safe += row.safe_count;
    tally.counted += row.counted_count;
    tally.na += row.na_count;
    overall.safe += row.safe_count;
    overall.counted += row.counted_count;
    overall.na += row.na_count;
  }
  return { overall, pillars };
}

/** The change in percentage points from `before` to `after`; null when either counted nothing. */
export function pointsChange(
  before: Tally | null | undefined,
  after: Tally | null | undefined
): number | null {
  const a = before ? percent(before) : null;
  const b = after ? percent(after) : null;
  return a === null || b === null ? null : b - a;
}
