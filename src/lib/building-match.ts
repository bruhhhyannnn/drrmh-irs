/** The row with this name, ignoring case and surrounding spaces, so a retype isn't a second building. */
export function matchBuildingByName<T extends { name: string }>(rows: T[], name: string): T | null {
  const wanted = name.trim().toLowerCase();
  return rows.find((row) => row.name.trim().toLowerCase() === wanted) ?? null;
}
