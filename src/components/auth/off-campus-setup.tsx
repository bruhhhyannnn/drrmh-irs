'use client';

import { completeOffCampusProfile } from '@/actions/users';
import { Button, FieldError, FieldLabel, PrivacyDrawer, TextInput } from '@/components/ds';
import { FOCUS_RING } from '@/components/ds/focus';
import { cn, getInitials, supabase } from '@/lib';
import { offCampusProfileSchema, type OffCampusProfileFormData } from '@/lib/schemas';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { AuthShell } from './auth-shell';
import { AUTH_LINK, AuthBanner, AuthHeading } from './auth-ui';

const FIELDS = [
  { name: 'first_name', label: 'First name', autoComplete: 'given-name', required: true },
  { name: 'middle_name', label: 'Middle name', autoComplete: 'additional-name', required: false },
  { name: 'last_name', label: 'Last name', autoComplete: 'family-name', required: true },
  { name: 'suffix', label: 'Suffix', autoComplete: 'honorific-suffix', required: false },
  { name: 'address', label: 'Address', autoComplete: 'street-address', required: true },
  { name: 'organization', label: 'Organization', autoComplete: 'organization', required: true },
  {
    name: 'organization_address',
    label: "Organization's address",
    autoComplete: 'off',
    required: true,
  },
  { name: 'position_title', label: 'Position', autoComplete: 'organization-title', required: true },
] as const;

/**
 * First sign-in setup for an off-campus account (DRRM-026): who they are and where they work,
 * instead of a UP campus, cluster and unit. Collecting an address needs the data privacy consent.
 */
export function OffCampusSetup() {
  const router = useRouter();
  const { user, userProfile, setUserProfile, reset } = useAuthStore();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OffCampusProfileFormData>({
    resolver: zodResolver(offCampusProfileSchema),
    defaultValues: {
      first_name: userProfile?.first_name ?? '',
      middle_name: userProfile?.middle_name ?? '',
      last_name: userProfile?.last_name ?? '',
      suffix: userProfile?.suffix ?? '',
      address: userProfile?.address ?? '',
      organization: userProfile?.organization ?? '',
      organization_address: userProfile?.organization_address ?? '',
      position_title: userProfile?.position_title ?? '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setSaveError('');
    try {
      const result = await completeOffCampusProfile(await getAccessToken(), data);
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

      <AuthHeading title="Set up your profile">
        Tell us who you are and where you work. You can then assess buildings with the safety
        checklist.
      </AuthHeading>
      {saveError && <AuthBanner>{saveError}</AuthBanner>}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor={`offcampus-${field.name}`}
              hint={field.required ? 'Required' : 'Optional'}
            >
              {field.label}
            </FieldLabel>
            <TextInput
              id={`offcampus-${field.name}`}
              autoComplete={field.autoComplete}
              maxLength={200}
              invalid={!!errors[field.name]}
              aria-describedby={errors[field.name] ? `offcampus-${field.name}-error` : undefined}
              {...register(field.name)}
            />
            <FieldError id={`offcampus-${field.name}-error`}>
              {errors[field.name]?.message}
            </FieldError>
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-normal text-gray-700">
            <input
              type="checkbox"
              className={cn('accent-brand-500 mt-1 size-5 shrink-0', FOCUS_RING)}
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? 'offcampus-consent-error' : undefined}
              {...register('consent')}
            />
            <span>
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className={cn(AUTH_LINK, 'font-semibold')}
              >
                data privacy notice
              </button>
              , and to DRRM-H keeping these details to manage my account.
            </span>
          </label>
          <FieldError id="offcampus-consent-error">{errors.consent?.message}</FieldError>
        </div>

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save and continue'}
        </Button>
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
