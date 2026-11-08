import { z } from 'zod';
import type { PsgcCity, PsgcTree } from './psgc';

// The off-campus account's first sign-in setup (DRRM-026), in three steps: About you, Your home
// address, Where you work. Addresses are picked from the PSGC lists, as in the assessment, and
// saved as one readable line in `users.address` / `users.organization_address`.

const required = (label: string) =>
  z.string().trim().min(1, `Enter your ${label}.`).max(200, 'Keep it under 200 characters');
const optional = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const choose = (what: string) => z.string().min(1, `Choose ${what}.`);

export const offCampusSetupSchema = z
  .object({
    first_name: required('first name'),
    middle_name: optional(200),
    last_name: required('last name'),
    suffix: optional(50),
    home_region_code: choose('a region'),
    home_province_code: z.string(),
    home_city_code: choose('a city or municipality'),
    home_barangay_code: choose('a barangay'),
    home_street: optional(150),
    organization: required('organization'),
    position_title: required('position'),
    work_same_as_home: z.boolean(),
    work_region_code: z.string(),
    work_province_code: z.string(),
    work_city_code: z.string(),
    work_barangay_code: z.string(),
    work_street: optional(150),
    consent: z.boolean().refine((v) => v, 'Agree to the data privacy notice to continue.'),
  })
  .superRefine((d, ctx) => {
    if (d.work_same_as_home) return;
    const need = (path: keyof typeof d, message: string) => {
      if (!d[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    need('work_region_code', 'Choose a region.');
    need('work_city_code', 'Choose a city or municipality.');
    need('work_barangay_code', 'Choose a barangay.');
  });

export type OffCampusSetupValues = z.infer<typeof offCampusSetupSchema>;

/** The fields each step checks before Next. Together they are every field of the form. */
export const SETUP_STEP_FIELDS = {
  about: ['first_name', 'middle_name', 'last_name', 'suffix'],
  home: [
    'home_region_code',
    'home_province_code',
    'home_city_code',
    'home_barangay_code',
    'home_street',
  ],
  work: [
    'organization',
    'position_title',
    'work_same_as_home',
    'work_region_code',
    'work_province_code',
    'work_city_code',
    'work_barangay_code',
    'work_street',
    'consent',
  ],
} satisfies Record<string, (keyof OffCampusSetupValues)[]>;

export type SetupStep = keyof typeof SETUP_STEP_FIELDS;

/** "123 Rizal St., Tabuc Suba, Iloilo City, Iloilo, Western Visayas"; null for an unknown barangay. */
export function composeAddress(
  tree: PsgcTree | null,
  barangayCode: string,
  street: string
): string | null {
  const line = (city: PsgcCity, rest: string[]) => {
    const barangay = city.barangays.find((b) => b.code === barangayCode);
    return barangay
      ? [street.trim(), barangay.name, city.name, ...rest].filter(Boolean).join(', ')
      : null;
  };
  for (const region of tree ?? []) {
    for (const city of region.cities) {
      const found = line(city, [region.name]);
      if (found) return found;
    }
    for (const province of region.provinces) {
      for (const city of province.cities) {
        const found = line(city, [province.name, region.name]);
        if (found) return found;
      }
    }
  }
  return null;
}
