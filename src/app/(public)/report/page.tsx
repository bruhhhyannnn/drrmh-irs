'use client';

import { ReportForm } from '@/app/(admin)/reports/report-form';
import { useMyReport } from '@/app/(admin)/reports/use-reports';
import { CompleteProfileModal } from '@/components/auth';
import { Spinner } from '@/components/ui';
import { cn, getInitials, supabase } from '@/lib';
import { useAuthStore, useThemeStore } from '@/store';
import type { Prisma } from '@prisma/client';
import { CheckCircle, ClipboardList, LogOut, Moon, Pencil, Sun } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GoogleSignInForm } from './google-sign-in-form';

type UserProfile = Prisma.UserGetPayload<{
  include: { unit: { include: { cluster: true } }; position: true; user_type: true };
}>;

const BG_IMAGES = [
  '/upm-drrmh-background-1.jpg',
  '/upm-drrmh-background-2.jpg',
  '/upm-drrmh-background-3.jpg',
  '/upm-drrmh-background-4.jpg',
];
const track = [...BG_IMAGES, ...BG_IMAGES];

export default function ErtReportPage() {
  const { user, userProfile, loading, reset } = useAuthStore();
  const router = useRouter();
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);

  const { data: myReport, isLoading: isReportLoading } = useMyReport(userProfile?.id ?? undefined);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((p) => (p + 1) % track.length), 4000);
    return () => clearInterval(timer);
  }, []);

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
    const toastId = toast.loading('Logging out...');
    await supabase.auth.signOut();
    reset();
    toast.success('Logged out successfully', { id: toastId });
  };

  // ── Background carousel — always rendered ───────────────────
  const Background = (
    <div className="fixed inset-0 -z-10">
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
      <div className="absolute inset-0 bg-brand-900/65" />
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────
  if (loading || (user && !userProfile) || (userProfile && isReportLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {Background}
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        {Background}
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Image
              src="/irs-favicon.png"
              alt="IRS"
              width={52}
              height={52}
              className="object-contain drop-shadow-lg"
            />
            <div className="text-center">
              <p className="text-lg font-bold text-white drop-shadow">DRRM-H IRS</p>
              <p className="text-sm text-white/70">Incident Reporting System</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl backdrop-blur-sm dark:bg-gray-900">
            <GoogleSignInForm />
          </div>
        </div>
      </div>
    );
  }

  // userProfile is guaranteed non-null past this point
  const profile = userProfile!;

  // ── Already submitted — status card ─────────────────────────
  if (myReport && !editingReportId) {
    return (
      <div className="flex min-h-screen flex-col">
        {Background}
        <CompleteProfileModal />
        <ReportHeader userProfile={profile} onSignOut={handleSignOut} />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl backdrop-blur-sm dark:bg-gray-900">
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
                  <CheckCircle className="text-success-500 h-7 w-7" />
                </div>
              </div>
              <h2 className="mb-1 text-center text-lg font-semibold text-gray-900 dark:text-white">
                Report Already Submitted
              </h2>
              <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
                You have already submitted a report for this event.
              </p>

              <div className="mb-6 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-white/3">
                <div className="flex items-start gap-2.5">
                  <ClipboardList size={15} className="mt-0.5 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Event</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {myReport.event.name}
                    </p>
                  </div>
                </div>
                {myReport.cluster && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        Cluster{myReport.unit ? ' / Unit' : ''}
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {myReport.cluster.name}
                        {myReport.unit && (
                          <span className="font-normal text-gray-400"> / {myReport.unit.name}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Submitted</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {new Date(myReport.submitted_at).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEditingReportId(myReport.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              >
                <Pencil size={14} />
                Edit Submission
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit existing report ─────────────────────────────────────
  if (editingReportId) {
    return (
      <div className="min-h-screen flex flex-col">
        {Background}
        <CompleteProfileModal />
        <ReportHeader userProfile={profile} onSignOut={handleSignOut} />
        <div className="flex justify-center p-6 py-8">
          <ReportForm
            standalone
            editId={editingReportId}
            onSuccess={() => {
              setEditingReportId(null);
              toast.success('Report updated');
            }}
            onCancel={() => setEditingReportId(null)}
          />
        </div>
      </div>
    );
  }

  // ── New report form ──────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {Background}
      <CompleteProfileModal />
      <ReportHeader userProfile={profile} onSignOut={handleSignOut} />
      <div className="flex justify-center p-6 py-8">
        <ReportForm standalone onSuccess={() => {}} />
      </div>
    </div>
  );
}

// ── Glass top bar ────────────────────────────────────────────────
interface ReportHeaderProps {
  userProfile: UserProfile;
  onSignOut: () => void;
}

function ReportHeader({ userProfile, onSignOut }: ReportHeaderProps) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/irs-favicon.png"
            alt="IRS"
            width={26}
            height={26}
            className="object-contain"
          />
          <span className="text-sm font-semibold text-white">DRRM-H IRS</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 p-4 text-xs font-semibold uppercase text-white">
              {getInitials(userProfile.first_name + ' ' + userProfile.last_name)}
            </div>
            <span className="hidden text-sm text-white/80 sm:block">
              {userProfile.first_name} {userProfile.last_name}
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            <LogOut size={15} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
