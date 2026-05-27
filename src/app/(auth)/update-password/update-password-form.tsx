'use client';

import { Button, Input, Label, Spinner } from '@/components/ui';
import { supabase, UpdatePasswordFormData, updatePasswordSchema } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

type Status = 'waiting' | 'ready' | 'invalid' | 'success';

export function UpdatePasswordForm() {
  const [status, setStatus] = useState<Status>('waiting');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
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
    return (
      <div className="flex w-full flex-col items-center gap-4 py-6 text-center">
        <Spinner size="md" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Validating reset link...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="bg-error-100 dark:bg-error-500/15 flex h-14 w-14 items-center justify-center rounded-full">
            <ShieldAlert size={28} className="text-error-600 dark:text-error-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Link expired</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This reset link is invalid or has expired. Request a new one.
          </p>
        </div>
        <div className="flex justify-center">
          <Link
            href="/forgot-password"
            className="text-brand-600 dark:text-brand-400 text-sm transition-all duration-200 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
            <Check size={28} className="text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Password updated</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your password has been changed successfully.
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Update password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Enter your new password below.</p>
      </div>

      {authError && (
        <div className="bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400 rounded-lg px-4 py-3 text-sm">
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              error={!!errors.password}
              hint={errors.password?.message}
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-all duration-200 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              error={!!errors.confirmPassword}
              hint={errors.confirmPassword?.message}
              className="pr-10"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-all duration-200 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Updating...">
          Update password
        </Button>
      </form>
    </div>
  );
}
