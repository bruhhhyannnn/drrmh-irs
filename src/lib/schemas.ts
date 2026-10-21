import { z } from 'zod';

/* ─── Auth ─── */
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/* ─── User ─── */
const userBaseSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  suffix: z.string().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  cluster_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  user_type_id: z.string().uuid('User type is required'),
  is_active: z.boolean().default(true),
  campus_id: z.string().uuid('Campus is required'),
});

export const userCreateSchema = userBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }
);

export const userEditSchema = userBaseSchema.omit({ password: true, confirmPassword: true });

/* ─── Main Tables ─── */
/** Add / Edit event. Add can tick several campuses: one event is created per campus. */
export const eventSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter an event name.'),
    description: z.string().optional(),
    quarter: z.string().optional(),
    campus_ids: z.array(z.string().uuid()).min(1, 'Pick at least one campus.'),
    started_at: z.string().optional().nullable(),
    ended_at: z.string().optional().nullable(),
    status_id: z.string().uuid('Pick a status.'),
  })
  .refine(
    (data) => {
      if (!data.started_at || !data.ended_at) return true;
      return new Date(data.ended_at) > new Date(data.started_at);
    },
    {
      message: 'The end must be after the start.',
      path: ['ended_at'],
    }
  );

export const missingPersonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Null when unknown, so it shows as unknown rather than "0 yrs".
  age: z.coerce.number().min(0).nullable(),
  sex: z.enum(['male', 'female', 'unknown']),
});

export const casualtySchema = z.object({
  condition_id: z.string().uuid('Condition is required'),
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().min(0).nullable(),
  sex: z.enum(['male', 'female', 'unknown']),
  diagnosis: z.string().optional().nullable(),
});

const populationCountEntrySchema = z.object({
  category_id: z.string().uuid(),
  code: z.string(),
  count: z.coerce.number().int().min(0).default(0),
});

export const reportSchema = z.object({
  event_id: z.string().uuid('Event is required'),
  cluster_id: z.string().uuid('Cluster is required'),
  unit_id: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  location_name: z.string().optional().nullable(),
  population_counts: z.array(populationCountEntrySchema).default([]),
  damage_condition_id: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().uuid().optional().nullable()
  ),
  report_missing_persons: z.array(missingPersonSchema).default([]),
  report_casualties: z.array(casualtySchema).default([]),
});

/* ─── Bystander report ─── */

const PH_CONTACT_NUMBER = /^\+63[2-9]\d{8,9}$/;
const PH_CONTACT_NUMBER_MESSAGE = 'Enter a Philippine number, e.g. 917 123 4567';

/**
 * Normalises what a reporter types after the fixed +63 ("917 123 4567", "0917-123-4567",
 * "+63 917 123 4567") to "+639171234567". Returns null when it isn't a Philippine mobile or
 * landline number. Mirrors the CHECK constraint on bystander_reports.contact_number.
 */
export function toPhContactNumber(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length >= 11 && digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  const normalised = `+63${digits}`;
  return PH_CONTACT_NUMBER.test(normalised) ? normalised : null;
}

const emptyToNull = (value: unknown) => (value === '' ? null : value);

// Bystanders often can't know a name or an exact age, so both are optional here — unlike the
// ERT schemas above. A blank name is shown as "Unknown person".
export const bystanderMissingPersonSchema = z.object({
  name: z.string().trim().max(120).default(''),
  age: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.number().int().min(0).max(130).nullable()
  ),
  sex: z.enum(['male', 'female', 'unknown']).default('unknown'),
});

export const bystanderCasualtySchema = bystanderMissingPersonSchema.extend({
  condition_id: z.string().uuid('Pick a condition'),
  diagnosis: z.string().trim().max(500).optional().nullable(),
});

/** What `createBystanderReport` accepts — also the payload stored in the offline queue. */
export const bystanderReportSchema = z.object({
  incident_type_id: z.string().uuid('Please select an incident type'),
  cluster_id: z.string().uuid('Please select a cluster'),
  unit_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  latitude: z.number({ required_error: 'Please capture your location' }).min(-90).max(90),
  longitude: z.number({ required_error: 'Please capture your location' }).min(-180).max(180),
  description: z.string().trim().max(2000).optional(),
  location_description: z.string().trim().max(500).optional(),
  damage_condition_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  contact_number: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() ? (toPhContactNumber(value) ?? value) : null,
    z.string().regex(PH_CONTACT_NUMBER, PH_CONTACT_NUMBER_MESSAGE).nullable().optional()
  ),
  population_counts: z
    .array(
      z.object({ category_id: z.string().uuid(), count: z.number().int().min(0).max(100_000) })
    )
    .max(50)
    .default([]),
  report_missing_persons: z.array(bystanderMissingPersonSchema).max(50).default([]),
  report_casualties: z.array(bystanderCasualtySchema).max(50).default([]),
});

/**
 * The bystander form's own fields. Missing persons, casualties, headcount and photos are kept
 * in component state. Step 1's required fields carry the messages shown under each field.
 */
export const bystanderFormSchema = z.object({
  incident_type_id: z.string().min(1, 'Choose the type of incident'),
  campus_id: z.string().min(1, 'Choose a campus'),
  latitude: z
    .number()
    .nullable()
    .refine((value) => value !== null, 'Pin the location on the map, or use your location'),
  longitude: z.number().nullable(),
  cluster_id: z.string().min(1, 'Choose a cluster'),
  unit_id: z.string(),
  damage_condition_id: z.string(),
  location_description: z.string().max(500, 'Keep it under 500 characters'),
  description: z.string().max(2000, 'Keep it under 2,000 characters'),
  contact_number: z
    .string()
    .refine(
      (value) => !value.trim() || toPhContactNumber(value) !== null,
      PH_CONTACT_NUMBER_MESSAGE
    ),
});

/* ─── Lookup tables ─── */
export const clusterSchema = z.object({
  name: z.string().trim().min(1, 'Enter a cluster name.'),
  is_active: z.boolean().default(true),
  campus_id: z.string().uuid('Pick a campus.'),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1, 'Enter a unit name.'),
  cluster_id: z.string().uuid('Pick a cluster.'),
  is_active: z.boolean().default(true),
});

/** A building assessments are made of (DRRM-015); settings fix its name, unit and floors. */
export const buildingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a building name.')
    .max(120, 'Keep it under 120 characters.'),
  unit_id: z.string().uuid('Pick a unit.'),
  floor_count: z.coerce
    .number({ invalid_type_error: 'Enter the number of floors.' })
    .int('Enter a whole number of floors.')
    .min(1, 'A building has at least 1 floor.')
    .max(200, 'Enter 200 floors or fewer.'),
  is_active: z.boolean().default(true),
});

export const positionSchema = z.object({
  name: z.string().trim().min(1, 'Enter a position name.'),
  is_active: z.boolean().default(true),
});

export const campusSchema = z.object({
  name: z.string().trim().min(1, 'Enter a campus name.'),
  is_active: z.boolean().default(true),
});

export const casualtyConditionSchema = z.object({
  name: z.string().trim().min(1, 'Enter a condition name.'),
  is_active: z.boolean().default(true),
});

export const damageConditionSchema = z.object({
  name: z.string().trim().min(1, 'Enter a condition name.'),
  is_active: z.boolean().default(true),
});

export const populationCategorySchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .regex(/^[a-z0-9_]+$/, 'Code must be lowercase letters, numbers, and underscores only'),
  name: z.string().trim().min(1, 'Enter a field name.'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

/* ─── Building assessment ─── */
const uuid = z.string().uuid();

// One submitted assessment, as the form sends it and the offline queue replays it. The server
// re-checks it against the template (prepareAssessmentWrite) and takes the evaluator from the
// caller's token, not from `evaluator_id`.
export const assessmentPayloadSchema = z.object({
  client_ref: uuid,
  evaluator_id: uuid,
  template_version_id: uuid,
  building: z.union([
    z.object({ id: uuid }),
    z.object({ new: z.object({ unit_id: uuid, name: z.string().trim().min(1).max(120) }) }),
  ]),
  event_id: uuid.nullable(),
  incident_commander: z.string().trim().max(200),
  floor_count: z.number().int().min(1).max(200),
  area_type_ids: z.array(uuid).max(50),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  answers: z
    .array(
      z.object({
        item_id: uuid,
        answer: z.enum(['yes', 'no', 'na']).nullable(),
        remarks: z.string().max(2000).nullable(),
      })
    )
    .max(1000),
  comments: z
    .array(z.object({ section_id: uuid, comment: z.string().trim().min(1).max(2000) }))
    .max(100),
});

// The Details step: where the building is and who is in charge.
export const assessmentDetailsSchema = z
  .object({
    cluster_id: z.string().min(1, 'Choose a cluster'),
    unit_id: z.string().min(1, 'Choose a college or unit'),
    building_id: z.string(),
    new_building_name: z.string().trim().max(120),
    incident_commander: z.string().trim().max(200),
    event_id: z.string(),
  })
  .refine((d) => d.building_id || d.new_building_name, {
    path: ['building_id'],
    message: 'Choose a building or add one',
  });

/* ─── Inferred types ─── */
export type SignInFormData = z.infer<typeof signInSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type CampusFormData = z.infer<typeof campusSchema>;
export type PopulationCategoryFormData = z.infer<typeof populationCategorySchema>;
export type EventFormData = z.infer<typeof eventSchema>;
export type ReportFormData = z.infer<typeof reportSchema>;
export type MissingPersonFormData = z.infer<typeof missingPersonSchema>;
export type CasualtyFormData = z.infer<typeof casualtySchema>;
export type BystanderReportFormData = z.infer<typeof bystanderReportSchema>;
// Input type: latitude stays `number | null` while the form is being filled in.
export type BystanderFormValues = z.input<typeof bystanderFormSchema>;
export type BystanderMissingPerson = z.infer<typeof bystanderMissingPersonSchema>;
export type BystanderCasualty = z.infer<typeof bystanderCasualtySchema>;
export type AssessmentPayload = z.infer<typeof assessmentPayloadSchema>;
export type AssessmentDetailsFormData = z.infer<typeof assessmentDetailsSchema>;
