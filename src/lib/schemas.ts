import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const requiredText = (field: string, max: number) =>
  z.string().trim().min(1, `${field} is required`).max(max);
const optionalUuid = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().uuid().optional().nullable()
);
const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

export const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const userCreateSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: requiredText('First name', 100),
  middle_name: optionalText(100),
  last_name: requiredText('Last name', 100),
  suffix: optionalText(30),
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(60),
  unit_id: optionalUuid,
  position_id: optionalUuid,
  user_type_id: z.string().uuid('User type is required'),
  is_active: z.boolean().default(true),
});
export const userEditSchema = userCreateSchema.omit({ password: true });

export const eventSchema = z.object({
  name: requiredText('Event name', 160),
  description: optionalText(1000),
  quarter: optionalText(40),
  started_at: z.string().optional().nullable(),
  ended_at: z.string().optional().nullable(),
  location_id: optionalUuid,
  status_id: z.string().uuid('Status is required'),
});

export const missingPersonSchema = z.object({
  name: requiredText('Name', 120),
  age: z.coerce.number().int().min(0).max(120),
  sex: z.enum(['male', 'female', 'unknown']),
});

export const casualtySchema = z.object({
  condition_id: z.string().uuid('Condition is required'),
  name: requiredText('Name', 120),
  age: z.coerce.number().int().min(0).max(120),
  sex: z.enum(['male', 'female', 'unknown']),
});

const headcountField = () => z.coerce.number().int().min(0).max(100000).default(0);

export const reportSchema = z.object({
  event_id: z.string().uuid('Event is required'),
  cluster_id: z.string().uuid('Cluster is required'),
  unit_id: optionalUuid,
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
  location_name: z.string().trim().max(500).optional().nullable(),
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
  damage_condition_id: optionalUuid,
  report_missing_persons: z.array(missingPersonSchema).max(200).default([]),
  report_casualties: z.array(casualtySchema).max(200).default([]),
});

export const bystanderReportSchema = z.object({
  incident_type_id: z.string().uuid('Please select an incident type'),
  cluster_id: z.string().uuid('Please select a cluster'),
  unit_id: optionalUuid,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  description: optionalText(2000),
  location_description: optionalText(500),
  damage_condition_id: optionalUuid,
  report_missing_persons: z.array(missingPersonSchema).max(50).default([]),
  report_casualties: z.array(casualtySchema).max(50).default([]),
});

export const clusterSchema = z.object({
  name: requiredText('Cluster name', 120),
  is_active: z.boolean().default(true),
});

export const unitSchema = z.object({
  name: requiredText('Unit name', 160),
  cluster_id: z.string().uuid('Cluster is required'),
  is_active: z.boolean().default(true),
});

export const locationSchema = z.object({
  name: requiredText('Location name', 160),
  cluster_id: z.string().uuid('Cluster is required'),
  is_active: z.boolean().default(true),
});

export const positionSchema = z.object({
  name: requiredText('Position name', 120),
  is_active: z.boolean().default(true),
});

export const userTypeSchema = z.object({
  name: requiredText('Type name', 80),
  is_active: z.boolean().default(true),
});

export const eventStatusSchema = z.object({
  name: requiredText('Status name', 80),
  is_active: z.boolean().default(true),
});

export const casualtyConditionSchema = z.object({
  name: requiredText('Condition name', 160),
  is_active: z.boolean().default(true),
});

export const damageConditionSchema = z.object({
  name: requiredText('Condition name', 160),
  is_active: z.boolean().default(true),
});

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
