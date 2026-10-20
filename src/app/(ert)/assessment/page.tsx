'use client';

import { ProfileSetup } from '@/components/auth';
import { Loader } from '@/components/ui/loader';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ErtFrame } from '../_components/frame';
import { useErtAccess } from '../_lib/use-ert-access';
import { AssessmentHub } from './_components/assessment-hub';
import { AssessmentStepper } from './_components/assessment-stepper';
import { AssessmentView } from './_components/assessment-view';

/**
 * The building assessment, one route on purpose (a dynamic segment might not be cached by the
 * service worker offline): the hub, `?draft=<client_ref>` the form, `?view=<id>` a submitted
 * assessment.
 */
export default function AssessmentPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading…" />}>
      <AssessmentRoute />
    </Suspense>
  );
}

function AssessmentRoute() {
  const params = useSearchParams();
  const access = useErtAccess({ requireAssessment: true });

  if (access.status === 'checking') return <PageLoading label="Checking your access…" />;
  if (access.status === 'setup') return <ProfileSetup />;

  const view = params.get('view');
  const draft = params.get('draft');
  return (
    <ErtFrame>
      {view ? (
        <AssessmentView key={view} id={view} />
      ) : draft ? (
        <AssessmentStepper key={draft} clientRef={draft} profile={access.profile} />
      ) : (
        <AssessmentHub profile={access.profile} />
      )}
    </ErtFrame>
  );
}

function PageLoading({ label }: { label: string }) {
  return (
    <ErtFrame>
      <Loader label={label} className="flex-1 py-20" />
    </ErtFrame>
  );
}
