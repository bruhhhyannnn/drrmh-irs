'use client';

import { AUTH_LINK, AuthBanner, AuthHeading } from '@/components/auth/auth-ui';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import {
  Button,
  FieldError,
  FieldLabel,
  FOCUS_RING,
  PasswordInput,
  TextInput,
} from '@/components/ds';
import { cn, SignInFormData, signInSchema, supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

type Banner = { tone: 'error' | 'warning'; message: string };

/** Banners for `?error=` values set by the OAuth callback. */
const PARAM_BANNERS: Record<string, Banner> = {
  timeout: { tone: 'warning', message: 'Sign-in timed out. Please try again.' },
  domain: {
    tone: 'error',
    message:
      'Only UP (up.edu.ph) accounts are allowed. Please sign in with your UP Google account.',
  },
  setup: { tone: 'error', message: 'Failed to set up your account. Please contact support.' },
};

/**
 * Google first for ERT members, email and password below for admins. The password step shows
 * the email as a chip with Change; errors show in one banner under the title.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('from') ?? '/dashboard';
  const { user } = useAuthStore();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [banner, setBanner] = useState<Banner | null>(
    () => PARAM_BANNERS[searchParams?.get('error') ?? ''] ?? null
  );

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({ resolver: zodResolver(signInSchema) });

  useEffect(() => {
    if (user) router.push(redirectTo);
  }, [user, router, redirectTo]);

  // Move focus with the step, but leave the page alone on first load (the Google button,
  // not the email field, is what most people need).
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    setFocus(step);
  }, [step, setFocus]);

  const goToPassword = async () => {
    setBanner(null);
    if (await trigger('email')) setStep('password');
  };

  const changeEmail = () => {
    setBanner(null);
    setStep('email');
  };

  const onSubmit = async (data: SignInFormData) => {
    setBanner(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setBanner({ tone: 'error', message: error.message });
      return;
    }
    router.push(redirectTo);
  };

  const bannerEl = banner && <AuthBanner tone={banner.tone}>{banner.message}</AuthBanner>;

  if (step === 'password') {
    const email = getValues('email');
    return (
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <button
          type="button"
          onClick={changeEmail}
          className={cn(
            'flex h-11 max-w-full items-center gap-2 self-start rounded-full border border-gray-200 bg-white pr-3.5 pl-2.5 text-[14px] font-medium text-gray-900 hover:bg-gray-50',
            FOCUS_RING
          )}
        >
          <ArrowLeft size={16} aria-hidden className="shrink-0 text-gray-600" />
          <span className="truncate">{email}</span>
          <span className="text-brand-500 font-bold">Change</span>
        </button>

        <AuthHeading title="Enter your password">
          Admin sign-in with email and password.
        </AuthHeading>
        {bannerEl}

        {/* Lets password managers pair the password with the email from the first step. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />

        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="password"
            action={
              <Link
                href={`/forgot-password?email=${encodeURIComponent(email)}`}
                className={cn(AUTH_LINK, 'text-[14px]')}
              >
                Forgot password?
              </Link>
            }
          >
            Password
          </FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={!!errors.password || banner?.tone === 'error'}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          <FieldError id="password-error">{errors.password?.message}</FieldError>
        </div>

        <Button type="submit" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void goToPassword();
      }}
      className="flex flex-col gap-5"
    >
      <AuthHeading title="Sign in">
        ERT members use Google. Admins use email and password.
      </AuthHeading>
      {bannerEl}

      <GoogleSignInButton
        onStart={() => setBanner(null)}
        onError={(message) => setBanner({ tone: 'error', message })}
      />

      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[#eaecf0]" />
        <span className="text-[13px] font-medium text-gray-500">or with email</span>
        <span aria-hidden className="h-px flex-1 bg-[#eaecf0]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <TextInput
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="you@up.edu.ph"
          invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        <FieldError id="email-error">{errors.email?.message}</FieldError>
      </div>

      <Button type="submit" fullWidth>
        Continue
      </Button>
    </form>
  );
}
