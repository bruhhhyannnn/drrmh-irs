'use client';

import { AuthBanner, AuthHeading, StatusIcon } from '@/components/auth/auth-ui';
import {
  Button,
  ButtonLink,
  FieldError,
  FieldLabel,
  PasswordInput,
  TextInput,
} from '@/components/ds';
import { Loader } from '@/components/ui/loader';
import { supabase, UpdatePasswordFormData, updatePasswordSchema } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

type Status = 'waiting' | 'ready' | 'invalid' | 'success';

export function UpdatePasswordForm() {
  const [status, setStatus] = useState<Status>('waiting');
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
  });

  useEffect(() => {
    // If PASSWORD_RECOVERY never fires within 3s, the link is expired/invalid
    const timeout = setTimeout(() => {
      setStatus((s) => (s === 'waiting' ? 'invalid' : s));
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout);
        setStatus('ready');
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // "Passwords match" shows as soon as the zod check passes, before Update is pressed.
  const [password, confirmPassword] = watch(['password', 'confirmPassword']);
  const passwordsMatch =
    !!confirmPassword && updatePasswordSchema.safeParse({ password, confirmPassword }).success;

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setAuthError('');
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    await supabase.auth.signOut();
    setStatus('success');
  };

  if (status === 'waiting') {
    return <Loader label="Checking your reset link…" className="py-6" />;
  }

  if (status === 'invalid') {
    return (
      <>
        <StatusIcon tone="warning" />
        <AuthHeading title="Link expired" focusOnMount>
          This reset link is invalid or has expired. Request a new one.
        </AuthHeading>
        <div className="flex flex-col gap-2.5">
          <ButtonLink href="/forgot-password" fullWidth>
            Request a new link
          </ButtonLink>
          <ButtonLink href="/signin" variant="ghost" fullWidth>
            Back to sign in
          </ButtonLink>
        </div>
      </>
    );
  }

  if (status === 'success') {
    return (
      <>
        <StatusIcon tone="success" />
        <AuthHeading title="Password updated" focusOnMount>
          Your password has been changed successfully.
        </AuthHeading>
        <ButtonLink href="/signin" fullWidth>
          Back to sign in
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Update password" focusOnMount>
        Enter your new password below.
      </AuthHeading>
      {authError && <AuthBanner>{authError}</AuthBanner>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            placeholder="Create a new password"
            autoComplete="new-password"
            invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          <FieldError id="password-error">{errors.password?.message}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <TextInput
            id="confirmPassword"
            type="password"
            placeholder="Retype your new password"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
          <FieldError id="confirm-password-error">{errors.confirmPassword?.message}</FieldError>
        </div>

        {/* The live region stays mounted (and out of the flex flow) so the change is announced. */}
        <p aria-live="polite" className="sr-only">
          {passwordsMatch ? 'Passwords match' : ''}
        </p>
        {passwordsMatch && (
          <p
            aria-hidden
            className="flex items-center gap-2 text-[13px] font-semibold text-success-700"
          >
            <Check size={16} strokeWidth={2.5} />
            Passwords match
          </p>
        )}

        <Button type="submit" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </>
  );
}
