'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ListCard, ListTabs } from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { Skeleton } from '../_components/ui';
import { AssessmentsTab } from './_components/assessments-tab';
import { BuildingsTab } from './_components/buildings-tab';

type Tab = 'buildings' | 'assessments';

const TABS: { key: Tab; label: string }[] = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'assessments', label: 'Assessments' },
];

export default function AssessmentsPage() {
  return (
    <>
      <PageHeader title="Assessments" subtitle="Building safety checklists (MATATAG)" />
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
  const tab: Tab = params.get('tab') === 'assessments' ? 'assessments' : 'buildings';
  const setTab = (next: Tab) =>
    router.replace(next === 'buildings' ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <ListCard>
      <ListTabs label="Assessments" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'buildings' ? <BuildingsTab /> : <AssessmentsTab />}
    </ListCard>
  );
}
