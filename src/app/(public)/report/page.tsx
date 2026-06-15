'use client';

import {
  CasualtyModal,
  CasualtyRow,
  MissingPersonRow,
  PersonModal,
} from '@/app/(admin)/reports/missing-casualty-modals';
import { ReportForm } from '@/app/(admin)/reports/report-form';
import {
  useCreateReportCasualty,
  useCreateReportMissingPerson,
  useDeleteReportCasualty,
  useDeleteReportMissingPerson,
  useMyReport,
  useReport,
  useReportCasualties,
  useReportMissingPersons,
} from '@/app/(admin)/reports/use-reports';
import { useCasualtyConditions } from '@/app/(admin)/settings/use-settings';
import { CompleteProfileModal } from '@/components/auth';
import { Button, Modal, Spinner } from '@/components/ui';
import { cn, getInitials, supabase } from '@/lib';
import { useAuthStore, useThemeStore } from '@/store';
import type { Prisma } from '@prisma/client';
import { CheckCircle, ClipboardList, LogOut, Moon, Pencil, Plus, Sun } from 'lucide-react';
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
  const [current, setCurrent] = useState(0);
  const [viewingReport, setViewingReport] = useState(false);

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
              src="/irs-logo.png"
              alt="IRS"
              width={84}
              height={84}
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
  if (myReport) {
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
                onClick={() => setViewingReport(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              >
                <ClipboardList size={14} />
                View Submission
              </button>
            </div>
          </div>
        </div>
        <ReportDetailsModal
          reportId={myReport.id}
          isOpen={viewingReport}
          onClose={() => setViewingReport(false)}
        />
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
          <Image src="/irs-logo.png" alt="IRS" width={26} height={26} className="object-contain" />
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

// ── Report details modal ───────────────────────────────────────
function ReportDetailsModal({
  reportId,
  isOpen,
  onClose,
}: {
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: report, isLoading } = useReport(reportId);
  const { data: casualties = [] } = useReportCasualties(reportId);
  const { data: missingPersons = [] } = useReportMissingPersons(reportId);
  const { data: casualtyConditions = [] } = useCasualtyConditions();

  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [casualtyModalOpen, setCasualtyModalOpen] = useState(false);

  const createCasualtyMutation = useCreateReportCasualty();
  const deleteCasualtyMutation = useDeleteReportCasualty();
  const createMissingPersonMutation = useCreateReportMissingPerson();
  const deleteMissingPersonMutation = useDeleteReportMissingPerson();

  const conditionOptions = casualtyConditions.map((c) => ({ value: c.id, label: c.name }));

  const handleSavePersons = async (updated: MissingPersonRow[]) => {
    await Promise.all(
      missingPersons.map((p) => deleteMissingPersonMutation.mutateAsync({ id: p.id, reportId }))
    );
    await Promise.all(
      updated
        .filter((p) => p.name.trim())
        .map((p) =>
          createMissingPersonMutation.mutateAsync({
            report_id: reportId,
            name: p.name.trim(),
            age: p.age,
            sex: p.sex,
          })
        )
    );
    toast.success('Missing persons updated');
  };

  const handleSaveCasualties = async (updated: CasualtyRow[]) => {
    await Promise.all(
      casualties.map((c) => deleteCasualtyMutation.mutateAsync({ id: c.id, reportId }))
    );
    await Promise.all(
      updated
        .filter((c) => c.condition_id && c.name.trim())
        .map((c) =>
          createCasualtyMutation.mutateAsync({
            report_id: reportId,
            condition_id: c.condition_id,
            name: c.name.trim(),
            age: c.age,
            sex: c.sex,
          })
        )
    );
    toast.success('Casualties updated');
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <h2 className="mb-6 text-lg font-semibold text-gray-800 dark:text-gray-100">
          Report Details
        </h2>

        {isLoading ? (
          <Spinner center />
        ) : !report ? (
          <p className="text-sm text-gray-400">Could not load report.</p>
        ) : (
          <div className="space-y-6">
            <Section title="Overview">
              <Field label="Event" value={report.event.name} />
              <Field label="Cluster" value={report.cluster?.name ?? '—'} />
              <Field label="Unit" value={report.unit?.name ?? '—'} />
              <Field
                label="Submitted"
                value={new Date(report.submitted_at).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              />
              {report.location_name && <Field label="Location" value={report.location_name} />}
            </Section>

            <Section title="Headcount">
              <Field label="Faculty Members" value={report.faculty_members} />
              <Field label="Admin Members" value={report.admin_members} />
              <Field label="REPS Members" value={report.reps_members} />
              <Field label="RA Members" value={report.ra_members} />
              <Field label="Students" value={report.students} />
              <Field label="Philcare Staff" value={report.philcare_staff} />
              <Field label="Security Personnel" value={report.security_personnel} />
              <Field label="Construction Workers" value={report.construction_workers} />
              <Field label="Tenants" value={report.tenants} />
              <Field label="Health Workers" value={report.health_workers} />
              <Field label="Non-Academic Staff" value={report.non_academic_staff} />
              <Field label="Guests" value={report.guests} />
            </Section>

            {report.damage_conditions && (
              <Section title="Structural Damage">
                <Field label="Condition" value={report.damage_conditions.name} />
              </Section>
            )}

            {/* Missing Persons */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Missing Persons ({missingPersons.length})
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPersonModalOpen(true)}
                  startIcon={
                    missingPersons.length === 0 ? <Plus size={13} /> : <Pencil size={13} />
                  }
                >
                  {missingPersons.length === 0 ? 'Add' : 'Manage'}
                </Button>
              </div>
              {missingPersons.length === 0 ? (
                <p className="text-sm text-gray-400">No Missing Person reported</p>
              ) : (
                <div className="space-y-2">
                  {missingPersons.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-gray-200 px-3 py-2 dark:border-white/5"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {p.name || 'Unnamed'}
                      </p>
                      <p className="text-xs capitalize text-gray-400">
                        {p.sex} · {p.age} yrs
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Casualties */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Casualties ({casualties.length})
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCasualtyModalOpen(true)}
                  startIcon={casualties.length === 0 ? <Plus size={13} /> : <Pencil size={13} />}
                >
                  {casualties.length === 0 ? 'Add' : 'Manage'}
                </Button>
              </div>
              {casualties.length === 0 ? (
                <p className="text-sm text-gray-400">No Damage reported</p>
              ) : (
                <div className="space-y-2">
                  {casualties.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-gray-200 px-3 py-2 dark:border-white/5"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {c.name || 'Unnamed'}
                      </p>
                      <p className="text-xs capitalize text-gray-400">
                        {c.condition?.name} · {c.sex} · {c.age} yrs
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <PersonModal
        isOpen={personModalOpen}
        onClose={() => setPersonModalOpen(false)}
        persons={missingPersons.map((p) => ({
          id: p.id,
          name: p.name ?? '',
          age: p.age ?? 0,
          sex: (p.sex as 'male' | 'female' | 'unknown') ?? 'unknown',
        }))}
        onSave={handleSavePersons}
      />
      <CasualtyModal
        isOpen={casualtyModalOpen}
        onClose={() => setCasualtyModalOpen(false)}
        casualties={casualties.map((c) => ({
          id: c.id,
          condition_id: c.condition_id,
          name: c.name ?? '',
          age: c.age ?? 0,
          sex: (c.sex as 'male' | 'female' | 'unknown') ?? 'unknown',
        }))}
        conditionOptions={conditionOptions}
        onSave={handleSaveCasualties}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 dark:border-white/5 dark:bg-gray-800">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{value ?? '—'}</p>
      </div>
    </div>
  );
}
