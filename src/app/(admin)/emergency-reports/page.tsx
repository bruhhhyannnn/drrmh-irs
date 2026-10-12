'use client';

import {
  useBystanderReports,
  useDeleteBystanderReport,
  useUpdateBystanderReportStatus,
  type BystanderStatus,
} from '@/components/hooks/use-bystander-reports';
import { Check, Eye, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../_components/confirm-dialog';
import {
  DataTable,
  IconAction,
  ListCard,
  ListCount,
  ListTabs,
  ListToolbar,
  MobileCard,
  NameCell,
  RowActions,
  RowButton,
  SearchField,
  TextCell,
  type Column,
} from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { useScopedCampusId } from '../_components/shell/campus-switcher';
import { Card, Chip } from '../_components/ui';
import { formatDate, formatTime, plural } from '../_lib/format';
import { bystanderStatusKey, bystanderTone, capitalize } from '../_lib/status';
import { useDebounced } from '../_lib/use-debounced';
import { BystanderDrawer, type BystanderRow } from './_components/bystander-drawer';

type Tab = 'action' | 'verified' | 'dismissed' | 'all';

const statusOf = (r: BystanderRow) => bystanderStatusKey(r.bystander_report_statuses?.name);
const placeOf = (r: BystanderRow) => [r.clusters?.name, r.units?.name].filter(Boolean).join(' · ');

function PeopleChips({ report }: { report: BystanderRow }) {
  const casualties = report.report_casualties.length;
  const missing = report.report_missing_persons.length;
  if (!casualties && !missing)
    return <span className="font-landing-mono text-[16px] text-gray-400">—</span>;
  return (
    <>
      {casualties > 0 && <Chip tone="red">{plural(casualties, 'casualty', 'casualties')}</Chip>}
      {missing > 0 && <Chip tone="amber">{missing} missing</Chip>}
    </>
  );
}

export default function BystanderReportsPage() {
  const campusId = useScopedCampusId();
  const { data: reports = [], isPending, error } = useBystanderReports(campusId || undefined);
  const updateStatus = useUpdateBystanderReportStatus();
  const deleteReport = useDeleteBystanderReport();
  const [tab, setTab] = useState<Tab>('action');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 200).trim().toLowerCase();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ report: BystanderRow; status: BystanderStatus } | null>(
    null
  );
  const [deleting, setDeleting] = useState<BystanderRow | null>(null);

  const allCampuses = !campusId;
  const open = reports.find((r) => r.id === openId) ?? null;
  const counts = { action: 0, verified: 0, dismissed: 0, all: reports.length };
  for (const r of reports) {
    const s = statusOf(r);
    if (s === 'pending' || s === 'reviewed') counts.action++;
    else counts[s]++;
  }
  const rows = reports.filter((r) => {
    const s = statusOf(r);
    const inTab =
      tab === 'all' || (tab === 'action' ? s === 'pending' || s === 'reviewed' : s === tab);
    if (!inTab) return false;
    if (!debounced) return true;
    return [
      r.bystander_incident_types?.name,
      r.clusters?.campus?.name,
      r.clusters?.name,
      r.units?.name,
    ]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(debounced));
  });

  const setStatus = (report: BystanderRow, status: BystanderStatus, after?: () => void) =>
    updateStatus.mutate(
      { id: report.id, status },
      {
        onSuccess: () => {
          toast.success(`Marked ${status}`);
          after?.();
        },
        onError: (err) => toast.error(err.message),
      }
    );

  const nextStep = (r: BystanderRow) => {
    const s = statusOf(r);
    if (s === 'pending') return { label: 'Review', run: () => setOpenId(r.id) };
    if (s === 'reviewed')
      return { label: 'Verify', run: () => setConfirm({ report: r, status: 'verified' }) };
    return null;
  };

  const columns: Column<BystanderRow>[] = [
    {
      key: 'incident',
      header: 'Incident',
      width: 'minmax(0,1.5fr)',
      cell: (r) => (
        <NameCell
          primary={r.bystander_incident_types?.name ?? 'Incident'}
          secondary={
            <>
              {allCampuses && <span className="lg:hidden">{r.clusters?.campus?.name} · </span>}
              {placeOf(r)}
            </>
          }
        />
      ),
    },
    ...(allCampuses
      ? [
          {
            key: 'campus',
            header: 'Campus',
            width: 'minmax(0,0.85fr)',
            hideOnTablet: true,
            cell: (r: BystanderRow) => <TextCell>{r.clusters?.campus?.name ?? '—'}</TextCell>,
          },
        ]
      : []),
    {
      key: 'people',
      header: 'People',
      width: 'minmax(0,1fr)',
      cell: (r) => <PeopleChips report={r} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '108px',
      cell: (r) => (
        <Chip tone={bystanderTone(statusOf(r))} dot>
          {capitalize(statusOf(r))}
        </Chip>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (r) => (
        <NameCell
          muted
          primary={formatDate(r.submitted_at)}
          secondary={formatTime(r.submitted_at)}
        />
      ),
    },
    {
      key: 'next',
      header: '',
      width: '96px',
      align: 'right',
      cell: (r) => {
        const step = nextStep(r);
        return step && <RowButton onClick={step.run}>{step.label}</RowButton>;
      },
    },
    {
      key: 'actions',
      header: '',
      width: '72px',
      align: 'right',
      cell: (r) => (
        <RowActions>
          <IconAction
            label="View"
            icon={<Eye size={18} aria-hidden />}
            onClick={() => setOpenId(r.id)}
          />
          <IconAction
            label="Delete"
            icon={<Trash2 size={18} aria-hidden />}
            onClick={() => setDeleting(r)}
          />
        </RowActions>
      ),
    },
  ];

  const confirmCopy =
    confirm?.status === 'verified'
      ? {
          title: 'Verify this report?',
          body: 'will be marked Verified: confirmed by an admin. It moves to the Verified tab.',
          label: 'Verify',
          icon: <Check size={20} aria-hidden />,
          tone: 'success' as const,
        }
      : {
          title: 'Dismiss this report?',
          body: 'will be marked Dismissed: not actionable. It moves to the Dismissed tab and stays on record.',
          label: 'Dismiss',
          icon: <X size={20} aria-hidden />,
          tone: 'neutral' as const,
        };

  return (
    <>
      <PageHeader
        title="Bystander reports"
        subtitle="Anonymous reports sent from the public site."
      />

      {error ? (
        <Card className="p-6 text-[17px] text-[#b42318]">
          The bystander reports couldn&apos;t be loaded: {error.message}
        </Card>
      ) : (
        <ListCard>
          <ListTabs
            loading={isPending}
            label="Report status"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'action', label: 'Needs action', count: counts.action },
              { key: 'verified', label: 'Verified', count: counts.verified },
              { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
              { key: 'all', label: 'All', count: counts.all },
            ]}
          />
          <ListToolbar>
            <SearchField
              label="Search bystander reports"
              placeholder="Search by incident type, campus, cluster, unit…"
              value={query}
              onChange={setQuery}
            />
            <ListCount loading={isPending}>{plural(rows.length, 'report', 'reports')}</ListCount>
          </ListToolbar>
          <DataTable
            label="Bystander reports"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={isPending}
            empty={
              debounced
                ? 'No reports match this search.'
                : tab === 'action'
                  ? 'Nothing needs action. New reports from the public site show up here.'
                  : `No ${tab === 'all' ? '' : `${tab} `}reports.`
            }
            card={(r) => {
              const step = nextStep(r);
              return (
                <MobileCard
                  title={r.bystander_incident_types?.name ?? 'Incident'}
                  subtitle={[allCampuses && r.clusters?.campus?.name, placeOf(r)]
                    .filter(Boolean)
                    .join(' · ')}
                  chip={
                    <Chip tone={bystanderTone(statusOf(r))} dot>
                      {capitalize(statusOf(r))}
                    </Chip>
                  }
                  meta={[
                    {
                      label: 'Submitted',
                      value: `${formatDate(r.submitted_at).replace(/, \d{4}$/, '')} · ${formatTime(r.submitted_at)}`,
                    },
                    ...(r.report_casualties.length
                      ? [
                          {
                            label: 'People',
                            value: plural(r.report_casualties.length, 'casualty', 'casualties'),
                            tone: 'red' as const,
                          },
                        ]
                      : []),
                    ...(r.report_missing_persons.length
                      ? [
                          {
                            label: 'People',
                            value: `${r.report_missing_persons.length} missing`,
                            tone: 'amber' as const,
                          },
                        ]
                      : []),
                  ]}
                  actions={[
                    {
                      label: 'Open',
                      icon: <Eye size={16} aria-hidden />,
                      onClick: () => setOpenId(r.id),
                    },
                    ...(step
                      ? [
                          {
                            label: step.label,
                            icon: <Check size={16} aria-hidden />,
                            onClick: step.run,
                            variant: 'primary' as const,
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
        </ListCard>
      )}

      <BystanderDrawer
        report={open}
        onClose={() => setOpenId(null)}
        reviewing={updateStatus.isPending && !confirm}
        onReview={(r) => setStatus(r, 'reviewed')}
        onVerify={(r) => setConfirm({ report: r, status: 'verified' })}
        onDismiss={(r) => setConfirm({ report: r, status: 'dismissed' })}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          setStatus(confirm.report, confirm.status, () => {
            setConfirm(null);
            setOpenId(null);
          })
        }
        loading={updateStatus.isPending}
        tone={confirmCopy.tone}
        icon={confirmCopy.icon}
        title={confirmCopy.title}
        name={confirm ? (confirm.report.bystander_incident_types?.name ?? 'This report') : ''}
        body={
          confirm ? `at ${placeOf(confirm.report) || 'an unknown place'} ${confirmCopy.body}` : ''
        }
        confirmVariant="primary"
        confirmLabel={confirmCopy.label}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteReport.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Report deleted');
              if (openId === deleting.id) setOpenId(null);
              setDeleting(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteReport.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this report?"
        name={deleting ? (deleting.bystander_incident_types?.name ?? 'This report') : ''}
        body={
          deleting
            ? `at ${placeOf(deleting) || 'an unknown place'} will be permanently deleted, with the people listed on it. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete report"
      />
    </>
  );
}
