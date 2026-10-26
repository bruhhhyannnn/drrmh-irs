'use client';

import { ProfileSetup } from '@/components/auth';
import { FOCUS_RING } from '@/components/ds';
import { useAssessmentDrafts, useMyAssessments } from '@/components/hooks/use-assessments';
import { useOngoingEvents } from '@/components/hooks/use-events';
import { useMyReport } from '@/components/hooks/use-reports';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib';
import { canUseAssessment } from '@/lib/access';
import { Building2, ChevronRight, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { Card, Dot, GUTTER, Hero } from '../_components/chrome';
import { ErtFrame } from '../_components/frame';
import { formatDate } from '../_lib/format';
import { useErtAccess, type ErtProfile } from '../_lib/use-ert-access';

/** The ERT landing page: the status report, and for those who can, the building assessment. */
export default function ErtHomePage() {
  const access = useErtAccess();

  if (access.status === 'checking') {
    return (
      <ErtFrame>
        <Loader label="Checking your access…" className="flex-1 py-20" />
      </ErtFrame>
    );
  }
  if (access.status === 'setup') return <ProfileSetup />;

  return (
    <ErtFrame>
      <HomeChooser profile={access.profile} />
    </ErtFrame>
  );
}

type Status = { tone: 'success' | 'warning' | 'neutral'; text: string } | null;

function HomeChooser({ profile }: { profile: ErtProfile }) {
  const canAssess = canUseAssessment(profile);
  const events = useOngoingEvents(profile.campus_id ?? '');
  const myReport = useMyReport(profile.id);
  const drafts = useAssessmentDrafts(canAssess ? profile.id : undefined);
  const mine = useMyAssessments(canAssess ? profile.id : undefined);

  let reportStatus: Status = null;
  if (myReport.data) reportStatus = { tone: 'success', text: 'Report sent' };
  else if (myReport.data !== undefined && events.data) {
    reportStatus = events.data.length
      ? { tone: 'warning', text: 'Event ongoing — report due' }
      : { tone: 'neutral', text: 'No ongoing event' };
  }

  const draftCount = drafts.data?.length ?? 0;
  const last = mine.data?.[0];
  let assessmentStatus: Status = {
    tone: 'neutral',
    text: 'Check a building with the MATATAG checklist',
  };
  if (draftCount > 0) {
    assessmentStatus = {
      tone: 'warning',
      text: draftCount === 1 ? '1 draft on this phone' : `${draftCount} drafts on this phone`,
    };
  } else if (last) {
    assessmentStatus = {
      tone: 'neutral',
      text: `Last: ${last.building_name}, ${formatDate(last.ended_at)}`,
    };
  }

  return (
    <>
      <Hero eyebrow={profile.campus?.name ?? 'Your campus'} title="What would you like to do?" />
      <main className={cn(GUTTER, 'grid gap-4 py-6 md:grid-cols-2 md:py-8')}>
        <ChoiceCard
          href="/report"
          icon={<ClipboardList size={24} aria-hidden />}
          title="Status report"
          description="Where you are and who is with you, during an event or drill."
          status={reportStatus}
        />
        {canAssess && (
          <ChoiceCard
            href="/assessment"
            icon={<Building2 size={24} aria-hidden />}
            title="Building assessment"
            description="Walk a building with the MATATAG safety checklist."
            status={assessmentStatus}
          />
        )}
      </main>
    </>
  );
}

const STATUS_DOT = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  neutral: 'bg-gray-400',
};

/** A whole card that is one link. */
function ChoiceCard({
  href,
  icon,
  title,
  description,
  status,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  status: Status;
}) {
  return (
    <Link href={href} className={cn('group block rounded-[22px]', FOCUS_RING)}>
      <Card className="flex h-full items-start gap-4 p-5 transition-shadow group-hover:shadow-[0_6px_18px_rgba(16,24,40,.12)] md:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[19px] leading-[1.25] font-extrabold">{title}</span>
          <span className="text-[15px] text-gray-600">{description}</span>
          {status && (
            <span className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-gray-800">
              <Dot className={STATUS_DOT[status.tone]} />
              <span className="min-w-0">{status.text}</span>
            </span>
          )}
        </span>
        <ChevronRight
          size={20}
          aria-hidden
          className="mt-3 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
        />
      </Card>
    </Link>
  );
}
