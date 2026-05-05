'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { SignInFormData, signInSchema, supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { Button, Input, Label } from '@/components/ui';
import Link from 'next/link';

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('from') ?? '/';
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (user && errorParam !== 'unauthorized') {
      router.push(redirectTo);
    }
  }, [user, router, redirectTo, searchParams]);

  useEffect(() => {
    const errorParam = searchParams?.get('error');
    const messageParam = searchParams?.get('message');
    if (errorParam === 'unauthorized' && messageParam) {
      setAuthError(decodeURIComponent(messageParam));
      const timer = setTimeout(() => router.replace('/signin'), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const onSubmit = async (data: SignInFormData) => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    router.push(redirectTo);
  };

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Sign in form */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sign in</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your credentials to access the IRS dashboard
          </p>
        </div>

        {authError && (
          <div className="bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400 rounded-lg px-4 py-3 text-sm">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@up.edu.ph"
              error={!!errors.email}
              hint={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
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

          <div className="flex justify-center">
            <Link
              href="/forgot-password"
              className="text-sm text-gray-500 transition-all duration-200 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting}
            loadingText="Signing in..."
          >
            Sign in
          </Button>
        </form>

        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* Bystander report card */}
      <div>
        <Link
          href="/report-select"
          className="group flex items-center gap-4 rounded-xl border border-red-200 bg-white p-4 transition-all duration-200 hover:border-red-300 hover:shadow-sm dark:border-red-900/50 dark:bg-white/5 dark:hover:border-red-800"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Report an Incident
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Anonymous bystander submission — no account needed
            </p>
          </div>
          <ArrowRight
            size={16}
            className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-red-400 dark:text-gray-600"
          />
        </Link>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-600">
          Your identity will not be stored
        </p>
      </div>
    </div>
  );
}
