'use client';

import {
  AUTH_LINK,
  AuthBanner,
  AuthHeading,
  BackLink,
  StatusIcon,
} from '@/components/auth/auth-ui';
import { Button, ButtonLink, FieldError, FieldLabel, TextInput } from '@/components/ds';
import { ForgotPasswordFormData, forgotPasswordSchema, supabase } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

/** Supabase sends one reset email per address about every 60s by default. */
const RESEND_SECONDS = 60;

function sendResetLink(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
}

/** Forgot password (the email carries over from sign-in), then Check your email. */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: searchParams?.get('email') ?? '' },
  });

  const onSubmit = async ({ email }: ForgotPasswordFormData) => {
    setAuthError('');
    const { error } = await sendResetLink(email);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setSentTo(email);
  };

  if (sentTo) return <CheckYourEmail email={sentTo} />;

  return (
    <>
      <BackLink href="/signin">Back to sign in</BackLink>
      <AuthHeading title="Forgot password">
        Enter your email and we&apos;ll send you a reset link.
      </AuthHeading>
      {authError && <AuthBanner>{authError}</AuthBanner>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <TextInput
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@up.edu.ph"
            invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="email-error">{errors.email?.message}</FieldError>
        </div>
        <Button type="submit" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </>
  );
}

/** Send again counts down first, then turns into a maroon link once Supabase will accept it. */
function CheckYourEmail({ email }: { email: string }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendAgain = async () => {
    setSending(true);
    setResendError('');
    const { error } = await sendResetLink(email);
    setSending(false);
    if (error) {
      setResendError(error.message);
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <>
      <StatusIcon tone="success" />
      <AuthHeading title="Check your email" focusOnMount>
        We sent a password reset link to{' '}
        <strong className="font-bold text-gray-900">{email}</strong>. Open it to set a new password.
      </AuthHeading>
      {resendError && <AuthBanner>{resendError}</AuthBanner>}
      <ButtonLink href="/signin" variant="outline" fullWidth>
        Back to sign in
      </ButtonLink>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[14px] leading-normal text-gray-600">
        <span>Didn&apos;t get it? Check spam, or</span>
        {secondsLeft > 0 ? (
          <span className="flex items-center gap-1.5 font-bold text-gray-400">
            send again in
            <span className="font-landing-mono text-[13px] font-semibold">
              {minutes}:{seconds}
            </span>
          </span>
        ) : (
          <button type="button" onClick={sendAgain} disabled={sending} className={AUTH_LINK}>
            {sending ? 'Sending…' : 'send again'}
          </button>
        )}
      </p>
    </>
  );
}
