import type { AdminScope } from './admin-scope';

// Who may rename or change a shared headcount field (#102, owner decision). A field is one
// catalog row that many campuses share, so an Administrator may change it only while no other
// campus has it on its list and no other campus's report (or bystander report) carries a
// headcount for it. Otherwise the labels on that campus's old reports and NSED exports would move.

export type PopulationFieldUse = {
  /** Links to the field from campuses other than the caller's. */
  linkedElsewhere: number;
  /** Report and bystander report headcounts for the field, from campuses other than the caller's. */
  reportedElsewhere: number;
};

/** A Super Admin may change any field; an Administrator only one no other campus uses. */
export function canEditPopulationField(
  scope: AdminScope & { ok: true },
  use: PopulationFieldUse
): boolean {
  if (scope.role === 'super_admin') return true;
  return use.linkedElsewhere === 0 && use.reportedElsewhere === 0;
}
