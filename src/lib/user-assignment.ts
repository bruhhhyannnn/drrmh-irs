type Assignment = 'campus_id' | 'cluster_id' | 'unit_id' | 'position_id';
type FormOnly = 'custom_unit_name' | 'custom_position_name';

/**
 * An off-campus account's data as saved (DRRM-026): no campus, cluster, unit or position, which
 * `chk_users_off_campus` requires. The form's "Other (please specify)" names are dropped too: they
 * aren't columns, and the campus path turns them into ids before saving.
 */
export function withoutAssignment<T extends object>(
  data: T
): Omit<T, Assignment | FormOnly> & Record<Assignment, null> {
  const rest = { ...data } as Record<string, unknown>;
  delete rest.custom_unit_name;
  delete rest.custom_position_name;
  return {
    ...rest,
    campus_id: null,
    cluster_id: null,
    unit_id: null,
    position_id: null,
  } as Omit<T, Assignment | FormOnly> & Record<Assignment, null>;
}
