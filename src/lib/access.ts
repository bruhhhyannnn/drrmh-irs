// Who can use the building assessment (spec 5.6). This is the one place the rule lives: the /home
// card, the top-bar switch, the /assessment page guard and the server actions all call it.

type AccessProfile = {
  user_type?: { name: string } | null;
  position?: { name: string } | null;
};

// Phase 1: every ERT member. Later: ERT member AND position is Safety Officer.
export function canUseAssessment(p: AccessProfile | null | undefined): boolean {
  return p?.user_type?.name === 'ERT Member';
  // && ASSESSMENT_POSITIONS.includes(p.position?.name ?? '')
}
