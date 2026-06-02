'use client';

import { ReportForm } from '@/app/(admin)/reports/report-form';
import { AuthHeader } from '@/components/auth';
import { Spinner } from '@/components/ui';
import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import type { Prisma } from '@prisma/client';
import { CheckCircle, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GoogleSignInForm } from './google-sign-in-form';

type UserProfile = Prisma.UserGetPayload<{
  include: { unit: { include: { cluster: true } }; position: true; user_type: true };
}>;

export default function ErtReportPage() {
  const { user, userProfile, loading, reset } = useAuthStore();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  // Redirect Admins / Super Admins to the dashboard
  useEffect(() => {
    if (!loading && user && userProfile) {
      const type = userProfile.user_type?.name;
      if (type === 'Administrator' || type === 'Super Admin') {
        router.replace('/dashboard');
      }
    }
  }, [loading, user, userProfile, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    reset();
    // Stay on /report — user will see the sign-in screen again
  };

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────
  if (!user) {
    return (
      <AuthHeader maxWidth="md">
        <GoogleSignInForm />
      </AuthHeader>
    );
  }

  // ── Profile still loading ────────────────────────────────────
  if (!userProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
        <ReportHeader userProfile={userProfile} onSignOut={handleSignOut} />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex justify-center">
              <CheckCircle className="text-success-500 h-12 w-12" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Report Submitted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your incident report has been recorded. Thank you.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-brand-500 mt-6 text-sm hover:underline"
            >
              Submit another report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ERT Member — report form ─────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <ReportHeader userProfile={userProfile} onSignOut={handleSignOut} />
      <div className="p-6 flex justify-center items-center">
        <ReportForm onSuccess={() => setSubmitted(true)} />
      </div>
    </div>
  );
}

// ── Top bar shown when authenticated ────────────────────────────
interface ReportHeaderProps {
  userProfile: UserProfile;
  onSignOut: () => void;
}

function ReportHeader({ userProfile, onSignOut }: ReportHeaderProps) {
  const initials = (userProfile.first_name?.[0] ?? '') + (userProfile.last_name?.[0] ?? '');

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-3 dark:border-white/5 dark:bg-gray-900">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/irs-favicon.png"
            alt="IRS"
            width={28}
            height={28}
            className="object-contain"
          />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">DRRM-H IRS</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold uppercase">
              {initials}
            </div>
            <span className="hidden text-sm text-gray-600 dark:text-gray-400 sm:block">
              {userProfile.first_name} {userProfile.last_name}
            </span>
          </div>

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
          >
            <LogOut size={15} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
