'use client';

import {
  FOCUS_RING,
  PeopleDrawer,
  type CasualtyEntry,
  type PersonEntry,
  type PersonSex,
} from '@/components/ds';
import { useCampusPopulationCategories } from '@/components/hooks/use-population-categories';
import {
  useCreateReportCasualty,
  useCreateReportMissingPerson,
  useDeleteReportCasualty,
  useDeleteReportMissingPerson,
  useReport,
  useReportCasualties,
  useReportMissingPersons,
} from '@/components/hooks/use-reports';
import { useCasualtyConditions } from '@/components/hooks/use-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, totalPopulationCount } from '@/lib';
import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, GUTTER, Hero, HeroSkeleton, Mono, Pill } from '../../_components/chrome';
import { formatDateTime } from '../../_lib/format';
import { PeopleList, PeopleRow } from './people-rows';

const toSex = (sex: string | null): PersonSex =>
  sex === 'male' || sex === 'female' ? sex : 'unknown';

/**
 * The member's report after submitting: totals first, then the headcount breakdown, people and
 * details. Missing persons and casualties stay editable while the event is ongoing; changes
 * save straight to the report. `onBack` shows a Back link (used for a past report).
 */
export function SubmittedReport({
  reportId,
  campusName,
  editable,
  onBack,
}: {
  reportId: string;
  campusName: string;
  editable: boolean;
  onBack?: () => void;
}) {
  const { data: report, isLoading } = useReport(reportId);
  const { data: missingRows = [], isPending: missingPending } = useReportMissingPersons(reportId);
  const { data: casualtyRows = [], isPending: casualtiesPending } = useReportCasualties(reportId);
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: campusCategories = [] } = useCampusPopulationCategories(
    report?.cluster?.campus_id ?? undefined
  );

  const createMissing = useCreateReportMissingPerson();
  const deleteMissing = useDeleteReportMissingPerson();
  const createCasualty = useCreateReportCasualty();
  const deleteCasualty = useDeleteReportCasualty();
  const [drawer, setDrawer] = useState<'missing' | 'casualty' | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <SubmittedReportSkeleton />;
  if (!report) {
    return (
      <p
        role="alert"
        className="flex flex-1 items-center justify-center py-20 text-[17px] text-gray-600"
      >
        This report couldn&apos;t be loaded.
      </p>
    );
  }

  const missingPersons: (PersonEntry & { id: string })[] = missingRows.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    sex: toSex(p.sex),
  }));
  const casualties: (CasualtyEntry & { id: string; condition: string })[] = casualtyRows.map(
    (c) => ({
      id: c.id,
      name: c.name,
      age: c.age,
      sex: toSex(c.sex),
      condition_id: c.condition_id,
      condition: c.condition?.name ?? '',
      diagnosis: c.diagnosis,
    })
  );

  // Headcount in the campus's field order; fields added later go last.
  const order = new Map(campusCategories.map((cc, i) => [cc.category_id, i]));
  const headcount = [...report.population_counts].sort(
    (a, b) => (order.get(a.category_id) ?? 999) - (order.get(b.category_id) ?? 999)
  );
  const total = totalPopulationCount(report.population_counts);

  const openDrawer = (name: 'missing' | 'casualty') => {
    setDrawerKey((k) => k + 1);
    setDrawer(name);
  };

  // Replaces the list on the report: removes the old rows, then adds the current ones.
  const saveMissing = async (people: PersonEntry[]) => {
    setSaving(true);
    try {
      await Promise.all(missingRows.map((p) => deleteMissing.mutateAsync({ id: p.id, reportId })));
      await Promise.all(
        people.map((p) =>
          createMissing.mutateAsync({ report_id: reportId, name: p.name, age: p.age, sex: p.sex })
        )
      );
      toast.success('Missing persons saved');
    } catch {
      toast.error('Couldn’t save missing persons. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveCasualties = async (people: CasualtyEntry[]) => {
    setSaving(true);
    try {
      await Promise.all(
        casualtyRows.map((c) => deleteCasualty.mutateAsync({ id: c.id, reportId }))
      );
      await Promise.all(
        people.map((c) =>
          createCasualty.mutateAsync({
            report_id: reportId,
            condition_id: c.condition_id,
            name: c.name,
            age: c.age,
            sex: c.sex,
            diagnosis: c.diagnosis ?? null,
          })
        )
      );
      toast.success('Casualties saved');
    } catch {
      toast.error('Couldn’t save casualties. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reporter = [report.user?.first_name, report.user?.last_name].filter(Boolean).join(' ');
  const stats = [
    { label: 'Headcount', value: total },
    { label: 'Missing persons', value: missingPending ? null : missingRows.length },
    { label: 'Casualties', value: casualtiesPending ? null : casualtyRows.length },
  ];

  return (
    <>
      <Hero eyebrow={`Status report · ${campusName}`} title={report.event.name}>
        <Pill tone="success" icon={<Check size={12} strokeWidth={3} aria-hidden />}>
          Submitted
        </Pill>
        <Mono className="text-[14px] text-[#fde8e8]">{formatDateTime(report.submitted_at)}</Mono>
      </Hero>

      <div className={cn(GUTTER, 'pt-6 pb-10')}>
        <div className="mx-auto flex max-w-190 flex-col gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={cn(
                'flex h-10 items-center gap-1.5 self-start text-[16px] font-bold text-gray-600 hover:text-gray-900',
                FOCUS_RING
              )}
            >
              <ArrowLeft size={16} aria-hidden />
              Back
            </button>
          )}

          <Card className="flex flex-col gap-4.5 p-5 md:p-6">
            <div className="flex items-center gap-3.5">
              <span className="bg-success-50 grid size-11 shrink-0 place-items-center rounded-full text-success-700">
                <Check size={22} strokeWidth={2.5} aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[22px] leading-tight font-extrabold">Report submitted</h2>
                <span className="text-[16px] leading-[1.45] text-gray-600">
                  {editable
                    ? 'You have already submitted a report for this event.'
                    : 'Your report for an event that has ended.'}
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {stats.map((stat) => (
                <StatTile key={stat.label} label={stat.label}>
                  {stat.value === null ? (
                    <Skeleton className="my-1 h-7 w-10 rounded-lg" />
                  ) : (
                    <Mono className="text-[30px] leading-[1.1] font-extrabold">{stat.value}</Mono>
                  )}
                </StatTile>
              ))}
              <StatTile label="Structural damage">
                <span className="text-[19px] leading-[1.3] font-extrabold text-balance">
                  {report.damage_conditions?.name ?? 'Not given'}
                </span>
              </StatTile>
            </dl>
          </Card>

          <Card className="flex flex-col gap-1.5 p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[19px] leading-[1.3] font-bold">Headcount</h2>
              <span className="text-[14px] font-medium text-gray-500">
                Total <Mono className="text-[17px] font-bold text-gray-900">{total}</Mono>
              </span>
            </div>
            {headcount.length ? (
              <dl className="grid md:grid-cols-2 md:gap-x-6">
                {headcount.map((pc) => (
                  <div
                    key={pc.category_id}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-line"
                  >
                    <dt className="text-[16px] leading-[1.3] text-gray-700">{pc.category.name}</dt>
                    <dd>
                      <Mono className="text-[16px] font-semibold">{pc.count}</Mono>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[16px] text-gray-500">No headcount on this report.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-1.5 p-5 md:p-6">
            <h2 className="mb-1 text-[19px] leading-[1.3] font-bold">People affected</h2>
            <PeopleRow
              kind="missing"
              meta={
                missingPending ? (
                  <PeopleMetaSkeleton />
                ) : missingPersons.length ? (
                  `${missingPersons.length} reported`
                ) : (
                  'None reported'
                )
              }
              hasPeople={missingPersons.length > 0}
              onManage={
                editable && !saving && !missingPending ? () => openDrawer('missing') : undefined
              }
            />
            <PeopleList people={missingPersons} />
            <div className="h-px bg-line" />
            <PeopleRow
              kind="casualty"
              meta={
                casualtiesPending ? (
                  <PeopleMetaSkeleton />
                ) : casualties.length ? (
                  `${casualties.length} reported`
                ) : (
                  'None reported'
                )
              }
              hasPeople={casualties.length > 0}
              onManage={
                editable && !saving && !casualtiesPending ? () => openDrawer('casualty') : undefined
              }
            />
            <PeopleList people={casualties} />
          </Card>

          <Card className="flex flex-col px-5 py-1 text-[16px] leading-[1.45] md:px-6">
            <dl className="flex flex-col">
              <DetailRow label="Location">{report.location_name ?? 'Pinned on the map'}</DetailRow>
              <DetailRow label="Cluster / Unit">
                {[report.cluster?.name, report.unit?.name].filter(Boolean).join(' / ') || '—'}
              </DetailRow>
              <DetailRow label="Reported by">
                {[reporter, report.user?.position?.name].filter(Boolean).join(' · ') || '—'}
              </DetailRow>
            </dl>
          </Card>
        </div>
      </div>

      <PeopleDrawer
        key={`missing-${drawerKey}`}
        audience="ert"
        kind="missing"
        open={drawer === 'missing'}
        onClose={() => setDrawer(null)}
        people={missingPersons}
        onSave={(people) => void saveMissing(people)}
        conditions={[]}
        subtitle="Changes save straight to your submitted report."
        doneLabel="Save changes"
      />
      <PeopleDrawer
        key={`casualty-${drawerKey}`}
        audience="ert"
        kind="casualty"
        open={drawer === 'casualty'}
        onClose={() => setDrawer(null)}
        people={casualties}
        onSave={(people) => void saveCasualties(people)}
        conditions={casualtyConditions.filter((c) => c.is_active)}
        subtitle="Changes save straight to your submitted report."
        doneLabel="Save changes"
      />
    </>
  );
}

function PeopleMetaSkeleton() {
  return (
    <>
      <span className="sr-only">Loading…</span>
      <Skeleton className="mt-1 h-3.5 w-24 rounded-md" />
    </>
  );
}

/** The submitted report's layout in placeholders while it loads. */
function SubmittedReportSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <span className="sr-only">Loading your report…</span>
      <HeroSkeleton />
      <div className={cn(GUTTER, 'pt-6 pb-10')}>
        <div className="mx-auto flex max-w-190 flex-col gap-4">
          <Card className="flex flex-col gap-4.5 p-5 md:p-6">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-full max-w-80 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-21 rounded-2xl" />
              ))}
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-5 md:p-6">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 rounded-lg" />
              ))}
            </div>
          </Card>
          <Card className="flex flex-col gap-2 p-5 md:p-6">
            <Skeleton className="mb-1 h-5 w-40 rounded-md" />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3.5 py-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-gray-50 px-4 py-3.5">
      <dt className="text-[13px] font-semibold text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line py-3.5 last:border-b-0">
      <dt className="flex-[0_0_140px] text-gray-500">{label}</dt>
      <dd className="min-w-0 flex-[1_1_220px]">{children}</dd>
    </div>
  );
}
