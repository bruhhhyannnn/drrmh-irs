'use client';

import { Button, Input } from '@/components/ui';
import { ForgotPasswordFormData, forgotPasswordSchema, supabase } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function ForgotPasswordForm() {
  const [authError, setAuthError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setAuthError('');
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
            <MailCheck size={28} className="text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Check your email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We sent a password reset link to{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {getValues('email')}
            </span>
          </p>
        </div>
        <div className="flex justify-center">
          <Link
            href="/signin"
            className="text-sm text-gray-500 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Forgot password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {authError && (
        <div className="bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400 rounded-lg px-4 py-3 text-sm">
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          id="email"
          type="email"
          placeholder="you@up.edu.ph"
          error={!!errors.email}
          hint={errors.email?.message}
          {...register('email')}
        />

        <div className="flex justify-center">
          <Link
            href="/signin"
            className="text-sm text-gray-500 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back to sign in
          </Link>
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Sending...">
          Send reset link
        </Button>
      </form>
    </div>
  );
}
