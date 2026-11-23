// Which assessment may rewrite a building's profile (its areas and floor count). The profile is
// what the building's newest assessment found, for pre-filling the next one, so only the newest
// one writes it. Pure, so the rule is unit tested (src/lib/building-profile.test.ts).

/**
 * True when an assessment that ended at `endedAt` is the building's newest, given the newest
 * assessment already saved (`latestEndedAt`, or null when there is none). An equal end time
 * counts as newest. An older assessment synced late from a phone's offline queue keeps its own
 * answers but leaves the profile alone (#108).
 */
export function isNewestAssessment(endedAt: string | Date, latestEndedAt: Date | null): boolean {
  if (!latestEndedAt) return true;
  return new Date(endedAt).getTime() >= latestEndedAt.getTime();
}
