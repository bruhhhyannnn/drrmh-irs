'use client';

import { completeOffCampusProfile } from '@/actions/users';
import { LocationFields } from '@/components/common/location-fields';
import { Button, FieldError, FieldLabel, PrivacyDrawer, TextInput } from '@/components/ds';
import { FOCUS_RING } from '@/components/ds/focus';
import { useLocationTree } from '@/components/hooks/use-assessments';
import { cn, getInitials, supabase } from '@/lib';
import { locationOptions } from '@/lib/location-options';
import {
  composeAddress,
  offCampusSetupSchema,
  SETUP_STEP_FIELDS,
  type OffCampusSetupValues,
  type SetupStep,
} from '@/lib/off-campus-setup';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import toast from 'react-hot-toast';
import { AuthShell } from './auth-shell';
import { AUTH_LINK, AuthBanner, AuthHeading } from './auth-ui';

const STEPS: { id: SetupStep; title: string; intro: string }[] = [
  { id: 'about', title: 'About you', intro: 'Your name as it should appear on assessments.' },
  { id: 'home', title: 'Your home address', intro: 'Pick your barangay from the list.' },
  {
    id: 'work',
    title: 'Where you work',
    intro: 'Your organization, your position there, and its address.',
  },
];

type Form = UseFormReturn<OffCampusSetupValues>;
type TextField =
  | 'first_name'
  | 'middle_name'
  | 'last_name'
  | 'suffix'
  | 'organization'
  | 'position_title'
  | 'home_street'
  | 'work_street';

/**
 * First sign-in setup for an off-campus account (DRRM-026), in three steps with Back and Next:
 * about you, your home address, where you work (with the data privacy consent). Each address is
 * picked from the PSGC lists, as in the assessment, and saved as one readable line.
 */
export function OffCampusSetup() {
  const router = useRouter();
  const { user, userProfile, setUserProfile, reset } = useAuthStore();
  const locationTree = useLocationTree();
  const [stepIndex, setStepIndex] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const form = useForm<OffCampusSetupValues>({
    resolver: zodResolver(offCampusSetupSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: userProfile?.first_name ?? '',
      middle_name: userProfile?.middle_name ?? '',
      last_name: userProfile?.last_name ?? '',
      suffix: userProfile?.suffix ?? '',
      home_region_code: '',
      home_province_code: '',
      home_city_code: '',
      home_barangay_code: '',
      home_street: '',
      organization: userProfile?.organization ?? '',
      position_title: userProfile?.position_title ?? '',
      work_same_as_home: false,
      work_region_code: '',
      work_province_code: '',
      work_city_code: '',
      work_barangay_code: '',
      work_street: '',
      consent: false,
    },
  });
  const {
    handleSubmit,
    trigger,
    formState: { isSubmitting },
  } = form;
  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;

  const next = async () => {
    if (await trigger(SETUP_STEP_FIELDS[step.id])) setStepIndex((i) => i + 1);
  };

  const save = handleSubmit(async (v) => {
    setSaveError('');
    const tree = locationTree.data ?? null;
    const address = composeAddress(tree, v.home_barangay_code, v.home_street);
    const organizationAddress = v.work_same_as_home
      ? address
      : composeAddress(tree, v.work_barangay_code, v.work_street);
    if (!address || !organizationAddress) {
      setSaveError('The location list is missing. Connect to the internet and try again.');
      return;
    }
    try {
      const result = await completeOffCampusProfile(await getAccessToken(), {
        first_name: v.first_name,
        middle_name: v.middle_name,
        last_name: v.last_name,
        suffix: v.suffix,
        address,
        organization: v.organization,
        organization_address: organizationAddress,
        position_title: v.position_title,
        consent: true,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setUserProfile(result.user);
      toast.success('Profile completed!');
    } catch {
      setSaveError("We couldn't save your profile. Please try again.");
    }
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    reset();
    router.replace('/signin');
  };

  const email = userProfile?.email ?? user?.email ?? '';
  const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ');

  return (
    <AuthShell>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-gray-50 px-3.5 py-3">
        <span className="bg-brand-solid grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white uppercase">
          {getInitials(fullName || email)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{fullName || email}</span>
          <span className="truncate text-[13px] text-gray-500">{email} · Off-campus account</span>
        </span>
      </div>

      <AuthHeading title="Set up your profile">{step.intro}</AuthHeading>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i <= stepIndex ? 'bg-brand-solid' : 'bg-gray-200'
              )}
            />
          ))}
        </div>
        <p className="text-[13px] font-bold tracking-[.06em] text-gray-500 uppercase">
          Step {stepIndex + 1} of {STEPS.length} · {step.title}
        </p>
      </div>

      {saveError && <AuthBanner>{saveError}</AuthBanner>}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (last) void save();
          else void next();
        }}
        className="flex flex-col gap-5"
      >
        {step.id === 'about' && (
          <>
            <TextRow form={form} name="first_name" label="First name" required />
            <TextRow form={form} name="middle_name" label="Middle name" />
            <TextRow form={form} name="last_name" label="Last name" required />
            <TextRow form={form} name="suffix" label="Suffix" />
          </>
        )}

        {step.id === 'home' && (
          <>
            <AddressPicker
              form={form}
              prefix="home"
              tree={locationTree.data ?? null}
              loading={locationTree.isPending}
            />
            <TextRow
              form={form}
              name="home_street"
              label="House no., street"
              placeholder="e.g. 123 Rizal St."
            />
          </>
        )}

        {step.id === 'work' && (
          <>
            <TextRow
              form={form}
              name="organization"
              label="Organization"
              required
              placeholder="e.g. Iloilo City DRRM Office"
            />
            <TextRow
              form={form}
              name="position_title"
              label="Position"
              required
              placeholder="e.g. Safety Officer"
            />
            <label className="flex cursor-pointer items-center gap-3 text-[15px] text-gray-700">
              <input
                type="checkbox"
                className={cn('accent-brand-500 size-5 shrink-0', FOCUS_RING)}
                {...form.register('work_same_as_home')}
              />
              My organization&apos;s address is the same as my home address
            </label>
            {!form.watch('work_same_as_home') && (
              <>
                <AddressPicker
                  form={form}
                  prefix="work"
                  tree={locationTree.data ?? null}
                  loading={locationTree.isPending}
                />
                <TextRow
                  form={form}
                  name="work_street"
                  label="Building, street"
                  placeholder="e.g. City Hall, Bonifacio Drive"
                />
              </>
            )}
            <Consent form={form} onReadNotice={() => setPrivacyOpen(true)} />
          </>
        )}

        <div className="flex gap-3">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setStepIndex((i) => i - 1)}
            >
              Back
            </Button>
          )}
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {last ? (isSubmitting ? 'Saving…' : 'Save and continue') : 'Next'}
          </Button>
        </div>
      </form>

      <p className="text-center text-[14px] text-gray-600">
        Not you?{' '}
        <button type="button" onClick={handleSignOut} className={cn(AUTH_LINK, 'font-semibold')}>
          Sign out
        </button>
      </p>

      <PrivacyDrawer
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        backLabel="Back to my profile"
      />
    </AuthShell>
  );
}

function TextRow({
  form,
  name,
  label,
  required = false,
  placeholder,
}: {
  form: Form;
  name: TextField;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `offcampus-${name}`;
  const error = form.formState.errors[name]?.message;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} hint={required ? 'Required' : 'Optional'}>
        {label}
      </FieldLabel>
      <TextInput
        id={id}
        maxLength={200}
        placeholder={placeholder}
        invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...form.register(name)}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** Region → Province → City/Municipality → Barangay, the same lists as the assessment. */
function AddressPicker({
  form,
  prefix,
  tree,
  loading,
}: {
  form: Form;
  prefix: 'home' | 'work';
  tree: Parameters<typeof locationOptions>[0];
  loading: boolean;
}) {
  const id = useId();
  const field = (part: 'region' | 'province' | 'city' | 'barangay') =>
    `${prefix}_${part}_code` as const;
  const picks = {
    region_code: form.watch(field('region')),
    province_code: form.watch(field('province')),
    city_code: form.watch(field('city')),
  };
  const errors = form.formState.errors;
  return (
    <LocationFields
      idPrefix={`${id}-${prefix}`}
      picks={picks}
      barangayCode={form.watch(field('barangay'))}
      options={locationOptions(tree, picks)}
      loading={loading}
      errors={{
        region_code: errors[field('region')],
        city_code: errors[field('city')],
        barangay_code: errors[field('barangay')],
      }}
      onPick={(patch) => {
        const touched = { shouldValidate: true, shouldTouch: true };
        if ('region_code' in patch)
          form.setValue(field('region'), patch.region_code ?? '', touched);
        if ('province_code' in patch)
          form.setValue(field('province'), patch.province_code ?? '', touched);
        if ('city_code' in patch) form.setValue(field('city'), patch.city_code ?? '', touched);
        if ('barangay_code' in patch)
          form.setValue(field('barangay'), patch.barangay_code ?? '', touched);
      }}
    />
  );
}

function Consent({ form, onReadNotice }: { form: Form; onReadNotice: () => void }) {
  const error = form.formState.errors.consent?.message;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-normal text-gray-700">
        <input
          type="checkbox"
          className={cn('accent-brand-500 mt-1 size-5 shrink-0', FOCUS_RING)}
          aria-invalid={!!error}
          aria-describedby={error ? 'offcampus-consent-error' : undefined}
          {...form.register('consent')}
        />
        <span>
          I agree to the{' '}
          <button type="button" onClick={onReadNotice} className={cn(AUTH_LINK, 'font-semibold')}>
            data privacy notice
          </button>
          , and to DRRM-H keeping these details to manage my account.
        </span>
      </label>
      <FieldError id="offcampus-consent-error">{error}</FieldError>
    </div>
  );
}
