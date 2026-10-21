'use client';

import { ButtonLink } from '@/components/ds';
import { ListChecks } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ListCard, ListTabs } from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { useIsSuperAdmin } from '../_components/shell/campus-switcher';
import { Skeleton } from '../_components/ui';
import { AssessmentsTab } from './_components/assessments-tab';
import { BuildingsTab } from './_components/buildings-tab';
import { CompareTab } from './_components/compare-tab';

type Tab = 'buildings' | 'assessments' | 'compare';

const TABS: { key: Tab; label: string }[] = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'compare', label: 'Compare' },
];

export default function AssessmentsPage() {
  const isSuperAdmin = useIsSuperAdmin();
  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Building safety checklists (MATATAG)"
        actions={
          isSuperAdmin ? (
            <ButtonLink href="/assessments/checklist" variant="outline" size="sm">
              <ListChecks size={16} aria-hidden />
              Edit checklist
            </ButtonLink>
          ) : undefined
        }
      />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <AssessmentLists />
      </Suspense>
    </>
  );
}

/** The two lists, with the open tab kept in `?tab=` so a link can open either one. */
function AssessmentLists() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawTab = params.get('tab');
  const tab: Tab =
    rawTab === 'assessments' ? 'assessments' : rawTab === 'compare' ? 'compare' : 'buildings';
  const setTab = (next: Tab) =>
    router.replace(next === 'buildings' ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <ListCard>
      <ListTabs label="Assessments" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'buildings' ? (
        <BuildingsTab />
      ) : tab === 'assessments' ? (
        <AssessmentsTab />
      ) : (
        <CompareTab />
      )}
    </ListCard>
  );
}
