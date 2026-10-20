export const CLUSTERS = ['Pedro Gil', 'Padre Faura', 'Taft', 'SHS', 'PGH'] as const;
type Cluster = (typeof CLUSTERS)[number];

// Used to render headcount rows in forms and tables
export const HEADCOUNT_FIELDS = [
  { key: 'faculty_members', label: 'Faculty Members' },
  { key: 'admin_members', label: 'Administrative Members' },
  { key: 'reps_members', label: 'REPS Members' },
  { key: 'ra_members', label: 'RA Members' },
  { key: 'students', label: 'Students' },
  { key: 'philcare_staff', label: 'Philcare Staff' },
  { key: 'security_personnel', label: 'Security Personnel' },
  { key: 'construction_workers', label: 'Construction Workers' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'health_workers', label: 'Health Workers' },
  { key: 'non_academic_staff', label: 'Non-Academic Staff' },
  { key: 'guests', label: 'Visitors / Guests / Patients' },
] as const;

// All below are used in seeding data
export const UNITS: Record<Cluster, string[]> = {
  'Pedro Gil': [
    'College of Nursing',
    'College of Dentistry',
    'College of Pharmacy',
    'UP Manila Phi House Dormitory',
    'National Institutes of Health',
    'UP Manila Dorm',
    'College of Allied Medical Professions',
    'College of Public Health',
    'College of Medicine',
    'Sports Science and Wellness Center',
  ],
  'Padre Faura': [
    'College of Arts and Sciences',
    'Student Center',
    'Joaquin Gonzales Building',
    'Museum',
    'IMS Building',
    'Campus Planning, Development, and Management Office',
  ],
  Taft: ['Central Administration (CAD)', 'Faculty of Medical Arts Building'],
  SHS: ['Palo', 'Baler', 'Koronadal', 'Tarlac'],
  PGH: [
    'Zone 1',
    'Zone 2',
    'Zone 3',
    'Zone 4',
    'Zone 5',
    'Zone 6',
    'Zone 7',
    'Zone 8',
    'Zone 9',
    'Zone 10',
    'Zone 11',
    'Zone 12',
  ],
};

export const CASUALTY_CONDITIONS = [
  'Minor injuries — no hospitalization needed',
  'Moderate injuries — requires medical attention',
  'Serious injuries — requires hospitalization',
  'Critical condition',
  'Fatality',
  'Other (please specify)',
] as const;

export const DAMAGE_CONDITION = [
  'No visible damage',
  'Minor damage — cosmetic only',
  'Moderate damage — needs repair',
  'Major structural damage',
  'Unsafe for occupancy — needs inspection',
  'Unsafe for occupancy — condemned',
  'Other (please specify)',
] as const;

export const POSITIONS = [
  // From the form dropdown
  'Head of Unit',
  'Head of Department',
  'Manager',
  // Administrative series
  'Administrative Aide I',
  'Administrative Aide II',
  'Administrative Aide III',
  'Administrative Aide IV',
  'Administrative Aide V',
  'Administrative Aide VI',
  'Administrative Assistant I',
  'Administrative Assistant II',
  'Administrative Assistant III',
  'Administrative Assistant IV',
  'Administrative Assistant V',
  'Administrative Officer I',
  'Administrative Officer II',
  'Administrative Officer III',
  'Administrative Officer IV',
  'Administrative Officer V',
  'Supervising Administrative Officer',
  // ERT roles
  'Incident Commander',
  'Liaison Officer',
  'Safety Officer',
  'Safety and Security Officer',
  'Health and Safety Officer',
  'Public Information Officer',
  'Marshall',
  'Floor Warden',
  'Evacuation Coordinator',
  'First Responder',
  'First Aider',
  'Search and Rescue Team Leader',
  'Search and Rescue Member',
  'Medical Team Leader',
  'Medical Team Member',
  'Communications Team Leader',
  'Communications Team Member',
  'Fire Marshal',
  // Technical / other staff
  'Laboratory Technician I',
  'Laboratory Technician II',
  'Laboratory Technician III',
  'Computer Programmer I',
  'Computer Programmer II',
  'Computer Programmer III',
  'Dormitory Manager I',
  'Dormitory Manager II',
  'Dormitory Manager III',
  'Student Records Evaluator',
  'REPS',
  'SRE',
  'Other (please specify)',
] as const;

export const EVENT_STATUSES = ['upcoming', 'ongoing', 'completed'] as const;

export const USER_TYPES = {
  1: 'ERT Member',
  2: 'Administrator',
  3: 'Super Admin',
} as const;

const ADMIN_USER_TYPES = ['Administrator', 'Super Admin'] as const;
type AdminUserType = (typeof ADMIN_USER_TYPES)[number];

export function isAdminUserType(type?: string | null): type is AdminUserType {
  return (ADMIN_USER_TYPES as readonly string[]).includes(type ?? '');
}

/* ─── Bystander report photos ─── */

/** Most damage photos a bystander can attach to one report (also a DB CHECK constraint). */
export const BYSTANDER_MAX_PHOTOS = 3;

/** FormData field the photos travel in to `createBystanderReport`. */
export const BYSTANDER_PHOTO_FIELD = 'photos';
