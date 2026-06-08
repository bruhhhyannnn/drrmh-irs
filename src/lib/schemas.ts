import { z } from 'zod';

/* ─── Auth ─── */
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/* ─── User ─── */
export const userCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  suffix: z.string().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  unit_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  user_type_id: z.string().uuid('User type is required'),
  is_active: z.boolean().default(true),
});
export const userEditSchema = userCreateSchema.omit({ password: true });

/* ─── Main Tables ─── */
export const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  description: z.string().optional(),
  quarter: z.string().optional(),
  started_at: z.string().optional().nullable(),
  ended_at: z.string().optional().nullable(),
  location_id: z.string().optional().nullable(),
  status_id: z.string().uuid('Status is required'),
});

export const missingPersonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().min(0),
  sex: z.enum(['male', 'female', 'unknown']),
});

export const casualtySchema = z.object({
  condition_id: z.string().uuid('Condition is required'),
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().min(0),
  sex: z.enum(['male', 'female', 'unknown']),
});

const headcountField = () => z.coerce.number().int().min(0).default(0);
export const reportSchema = z.object({
  event_id: z.string().uuid('Event is required'),
  cluster_id: z.string().uuid('Cluster is required'),
  unit_id: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  location_name: z.string().optional().nullable(),
  faculty_members: headcountField(),
  admin_members: headcountField(),
  reps_members: headcountField(),
  ra_members: headcountField(),
  students: headcountField(),
  philcare_staff: headcountField(),
  security_personnel: headcountField(),
  construction_workers: headcountField(),
  tenants: headcountField(),
  health_workers: headcountField(),
  non_academic_staff: headcountField(),
  guests: headcountField(),
  damage_condition_id: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().uuid().optional().nullable()
  ),
  report_missing_persons: z.array(missingPersonSchema).default([]),
  report_casualties: z.array(casualtySchema).default([]),
});

export const bystanderReportSchema = z.object({
  incident_type_id: z.string().uuid('Please select an incident type'),
  cluster_id: z.string().uuid('Please select a cluster'),
  unit_id: z.string().uuid().optional().nullable(),
  latitude: z.number({ required_error: 'Please capture your location' }),
  longitude: z.number({ required_error: 'Please capture your location' }),
  description: z.string().optional(),
  location_description: z.string().optional(),
  damage_condition_id: z.string().uuid().optional().nullable(),
  report_missing_persons: z.array(missingPersonSchema).default([]),
  report_casualties: z.array(casualtySchema).default([]),
});

/* ─── Lookup tables ─── */
export const clusterSchema = z.object({
  name: z.string().min(1, 'Cluster name is required'),
  is_active: z.boolean().default(true),
});

export const unitSchema = z.object({
  name: z.string().min(1, 'Unit name is required'),
  cluster_id: z.string().uuid('Cluster is required'),
  is_active: z.boolean().default(true),
});

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  cluster_id: z.string().uuid('Cluster is required'),
  is_active: z.boolean().default(true),
});

export const positionSchema = z.object({
  name: z.string().min(1, 'Position name is required'),
  is_active: z.boolean().default(true),
});

export const userTypeSchema = z.object({
  name: z.string().min(1, 'Type name is required'),
  is_active: z.boolean().default(true),
});

export const eventStatusSchema = z.object({
  name: z.string().min(1, 'Status name is required'),
  is_active: z.boolean().default(true),
});

export const casualtyConditionSchema = z.object({
  name: z.string().min(1, 'Condition name is required'),
  is_active: z.boolean().default(true),
});

export const damageConditionSchema = z.object({
  name: z.string().min(1, 'Condition name is required'),
  is_active: z.boolean().default(true),
});

/* ─── Inferred types ─── */
export type SignInFormData = z.infer<typeof signInSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type UserEditFormData = z.infer<typeof userEditSchema>;
export type EventFormData = z.infer<typeof eventSchema>;
export type ReportFormData = z.infer<typeof reportSchema>;
export type MissingPersonFormData = z.infer<typeof missingPersonSchema>;
export type CasualtyFormData = z.infer<typeof casualtySchema>;
export type BystanderReportFormData = z.infer<typeof bystanderReportSchema>;
