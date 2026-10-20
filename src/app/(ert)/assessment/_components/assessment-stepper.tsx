'use client';

import { ButtonLink } from '@/components/ds';
import { ClipboardList } from 'lucide-react';
import { NoticeCard } from '../../_components/chrome';
import type { ErtProfile } from '../../_lib/use-ert-access';

/** The step-by-step form for one draft. Placeholder until the steps land. */
export function AssessmentStepper({ clientRef }: { clientRef: string; profile: ErtProfile }) {
  return (
    <NoticeCard
      icon={<ClipboardList size={28} aria-hidden />}
      iconTone="neutral"
      title="Draft saved"
      description={`The checklist steps for this draft (${clientRef.slice(0, 8)}) come next.`}
    >
      <ButtonLink href="/assessment" variant="outline">
        Back to assessments
      </ButtonLink>
    </NoticeCard>
  );
}
