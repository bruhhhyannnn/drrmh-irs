'use client';

import { ReportForm } from '@/app/(admin)/reports/report-form';
import { AuthHeader } from '@/components/auth';
import { Spinner } from '@/components/ui';
import { cn, getInitials, supabase } from '@/lib';
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

  const BG_IMAGES = [
    '/upm-drrmh-background-1.jpg',
    '/upm-drrmh-background-2.jpg',
    '/upm-drrmh-background-3.jpg',
    '/upm-drrmh-background-4.jpg',
  ];
  const track = [...BG_IMAGES, ...BG_IMAGES]; // doubled for seamless loop
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % track.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [track.length]);

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
      <div className="p-6 flex justify-center items-center relative">
        <div className="absolute inset-0 overflow-hidden">
          {track.map((src, i) => (
            <div
              key={i}
              className={cn(
                'absolute inset-0 transition-opacity duration-1000',
                i === current ? 'opacity-100' : 'opacity-0'
              )}
            >
              <Image src={src} alt="" fill className="object-cover" priority={i === 0} />
            </div>
          ))}
          <div className="bg-brand-900/60 absolute inset-0" />
        </div>
        <div className="z-1">
          <ReportForm standalone onSuccess={() => setSubmitted(true)} />
        </div>
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
  return (
    <header className="border-b border-gray-200 bg-gray-25 px-6 py-3 dark:border-white/5 dark:bg-gray-900">
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
            <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex h-7 w-7 p-4 items-center justify-center rounded-full text-xs font-semibold uppercase">
              {getInitials(userProfile.first_name + ' ' + userProfile.last_name)}
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
