type MatatagActor = {
  id: string;
  campus_id: string | null;
  user_type: { name: string };
  cluster?: { name: string } | null;
  unit?: { name: string; cluster?: { name: string } | null } | null;
};

type MatatagFormAccess = {
  campus_id: string;
  access_mode: string;
  is_open: boolean;
  assignments?: { user_id: string }[];
};

export function canManageMatatagForm(user: MatatagActor, campusId: string) {
  return (
    user.user_type.name === 'Super Admin' ||
    (user.user_type.name === 'Administrator' && !!campusId && user.campus_id === campusId)
  );
}

// Apply to record reads and updates; campus identifiers never come from the client.
export function matatagAccessScope(user: MatatagActor) {
  if (user.user_type.name === 'Super Admin') return {};
  if (user.user_type.name === 'Administrator' && user.campus_id) {
    return { campus_id: user.campus_id };
  }
  return { user_id: user.id };
}

export function canSaveMatatagCampus(user: MatatagActor, campusId: string) {
  return (
    !!campusId &&
    (user.campus_id ? user.campus_id === campusId : user.user_type.name === 'Super Admin')
  );
}

export function matatagAssignedOrganization(user: MatatagActor) {
  return user.cluster?.name || user.unit?.cluster?.name || user.unit?.name || '';
}

export function canSubmitMatatagForm(user: MatatagActor, form: MatatagFormAccess) {
  return (
    form.is_open &&
    user.campus_id === form.campus_id &&
    (form.access_mode !== 'ASSIGNED' ||
      form.assignments?.some((assignment) => assignment.user_id === user.id))
  );
}
