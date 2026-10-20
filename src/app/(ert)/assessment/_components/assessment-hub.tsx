'use client';

import { Button, Drawer, FOCUS_RING } from '@/components/ds';
import {
  useAssessmentDrafts,
  useAssessmentSetup,
  useAssessmentTemplate,
  useMyAssessments,
  useTemplateVersion,
} from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import {
  draftFromPayload,
  newDraft,
  newUuid,
  sectionProgress,
  type AssessmentDraft,
} from '@/lib/assessment-draft';
import { percent } from '@/lib/assessment-score';
import {
  deleteAssessmentDraft,
  getAllQueuedCount,
  removeQueuedAssessment,
  retryQueuedAssessment,
  saveAssessmentDraft,
  type QueuedAssessment,
} from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, CloudOff } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Dot, GUTTER, Hero, Mono, NoticeCard, Pill } from '../../_components/chrome';
import { formatDate, formatDateTime } from '../../_lib/format';
import { useQueuedAssessments } from '../../_lib/use-assessment-queue';
import type { ErtProfile } from '../../_lib/use-ert-access';
import { AssessmentLink, goToAssessment } from '../_lib/nav';

/** The assessment hub: start a new one, drafts on this phone, waiting to send, submitted. */
export function AssessmentHub({ profile }: { profile: ErtProfile }) {
  const queryClient = useQueryClient();
  const setPendingCount = useOfflineQueueStore((s) => s.setPendingCount);
  const flushNow = useOfflineQueueStore((s) => s.flushNow);
  const template = useAssessmentTemplate();
  const setup = useAssessmentSetup(profile.campus_id ?? undefined);
  const drafts = useAssessmentDrafts(profile.id);
  const [queueKey, setQueueKey] = useState(0);
  const queued = useQueuedAssessments(queueKey).filter(
    (e) => e.payload.evaluator_id === profile.id
  );
  const [starting, setStarting] = useState(false);
  const [discarding, setDiscarding] = useState<Discard | null>(null);

  const unavailable = (!template.data && template.isError) || (!setup.data && setup.isError);
  const ready = !!template.data && !!setup.data;

  const start = async () => {
    if (!template.data) return;
    setStarting(true);
    try {
      const draft = newDraft({
        client_ref: newUuid(),
        evaluator_id: profile.id,
        campus_id: profile.campus_id ?? '',
        template_version_id: template.data.version_id,
        cluster_id: profile.cluster_id ?? profile.unit?.cluster_id ?? '',
        unit_id: profile.unit_id ?? '',
        now: new Date(),
      });
      await saveAssessmentDraft(draft);
      await queryClient.invalidateQueries({ queryKey: ['assessment-drafts'] });
      goToAssessment(`?draft=${draft.client_ref}`);
    } catch {
      toast.error("Couldn't save a draft on this phone.");
      setStarting(false);
    }
  };

  const refreshQueue = async () => {
    setQueueKey((k) => k + 1);
    setPendingCount(await getAllQueuedCount());
  };

  /** A refused assessment back to pending, to be sent again as it is. */
  const tryAgain = async (entry: QueuedAssessment) => {
    try {
      await retryQueuedAssessment(entry.id);
      await refreshQueue();
      flushNow();
    } catch {
      toast.error("Couldn't change it on this phone. Try again.");
    }
  };

  /** A refused assessment back into a draft, to fix and send again (same client_ref). */
  const openAsDraft = async (entry: QueuedAssessment) => {
    const { payload } = entry;
    const saved =
      'id' in payload.building
        ? setup.data?.buildings.find(
            (b) => 'id' in payload.building && b.id === payload.building.id
          )
        : undefined;
    const unitId =
      'new' in payload.building
        ? payload.building.new.unit_id
        : (saved?.unit_id ?? profile.unit_id ?? '');
    const cluster = setup.data?.clusters.find((c) => c.units.some((u) => u.id === unitId));
    let draft = draftFromPayload(payload, {
      campus_id: profile.campus_id ?? '',
      cluster_id: cluster?.id ?? profile.cluster_id ?? '',
      unit_id: unitId,
      building_name: saved?.name ?? entry.summary?.title ?? '',
      now: new Date(),
    });
    // A building that's no longer listed has to be chosen again on Details.
    if ('id' in payload.building && setup.data && !saved) {
      draft = { ...draft, building_id: '', building_name: '' };
    }
    try {
      await saveAssessmentDraft(draft);
      await removeQueuedAssessment(entry.id);
      await queryClient.invalidateQueries({ queryKey: ['assessment-drafts'] });
      await refreshQueue();
      goToAssessment(`?draft=${draft.client_ref}`);
    } catch {
      toast.error("Couldn't reopen it on this phone. Try again.");
    }
  };

  const confirmDiscard = async () => {
    if (!discarding) return;
    try {
      if (discarding.kind === 'draft') {
        await deleteAssessmentDraft(discarding.id);
        await queryClient.invalidateQueries({ queryKey: ['assessment-drafts'] });
      } else {
        await removeQueuedAssessment(discarding.id);
        await refreshQueue();
      }
      toast.success(discarding.kind === 'draft' ? 'Draft discarded' : 'Assessment discarded');
    } catch {
      toast.error("Couldn't discard it. Try again.");
    }
    setDiscarding(null);
  };

  return (
    <>
      <Hero eyebrow={profile.campus?.name ?? 'Your campus'} title="Building assessment" />

      {unavailable ? (
        <NoticeCard
          icon={<CloudOff size={28} aria-hidden />}
          iconTone="warning"
          title="Not on this phone yet"
          description="The checklist needs a connection the first time it opens. It loads here as soon as you're back online."
        />
      ) : null}

      <main className={cn(GUTTER, 'flex flex-col gap-5 py-6 md:py-8', unavailable && 'pt-0')}>
        {!unavailable && (
          <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-[19px] leading-[1.3] font-bold">Check a building</h2>
              <p className="text-[15px] text-gray-600">
                {template.data
                  ? `MATATAG checklist, ${template.data.label}. Saved on this phone as you go, so it works offline.`
                  : template.data === null
                    ? 'No checklist has been published yet. Ask your DRRM office.'
                    : 'Getting the checklist…'}
              </p>
            </div>
            <Button
              onClick={start}
              loading={starting || (!ready && template.data !== null)}
              disabled={!ready}
              className="md:shrink-0"
            >
              Start new assessment
            </Button>
          </Card>
        )}

        {(drafts.data?.length ?? 0) > 0 && (
          <HubSection title="On this phone" count={drafts.data!.length}>
            {drafts.data!.map((draft) => (
              <DraftRow
                key={draft.client_ref}
                draft={draft}
                onDiscard={() =>
                  setDiscarding({
                    kind: 'draft',
                    id: draft.client_ref,
                    name: draftName(draft),
                  })
                }
              />
            ))}
          </HubSection>
        )}

        {queued.length > 0 && (
          <HubSection title="Waiting to send" count={queued.length}>
            {queued.map((entry) => (
              <QueuedRow
                key={entry.id}
                entry={entry}
                onTryAgain={() => tryAgain(entry)}
                onOpenAsDraft={() => openAsDraft(entry)}
                onDiscard={() =>
                  setDiscarding({
                    kind: 'queued',
                    id: entry.id,
                    name: entry.summary?.title ?? 'Building assessment',
                  })
                }
              />
            ))}
          </HubSection>
        )}

        <Submitted userId={profile.id} />
      </main>

      <Drawer
        open={!!discarding}
        onClose={() => setDiscarding(null)}
        title={discarding?.kind === 'queued' ? 'Discard this assessment?' : 'Discard this draft?'}
        subtitle={
          discarding?.kind === 'queued'
            ? "It hasn't been sent, and its answers can't be recovered."
            : "Its answers can't be recovered."
        }
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDiscarding(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-[16px] font-semibold">{discarding?.name}</p>
      </Drawer>
    </>
  );
}

type Discard = { kind: 'draft' | 'queued'; id: string; name: string };

const draftName = (draft: AssessmentDraft) =>
  draft.building_name || draft.new_building_name.trim() || 'New building';

function HubSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-[19px] font-bold">
        {title}
        {count !== undefined && (
          <Mono className="rounded-full bg-gray-100 px-2 text-[14px] font-semibold text-gray-600">
            {count}
          </Mono>
        )}
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function DraftRow({ draft, onDiscard }: { draft: AssessmentDraft; onDiscard: () => void }) {
  const template = useTemplateVersion(draft.template_version_id);
  const progress = template.data ? Object.values(sectionProgress(template.data, draft)) : [];
  const answered = progress.reduce((n, s) => n + s.answered, 0);
  const total = progress.reduce((n, s) => n + s.total, 0);

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[17px] font-bold">{draftName(draft)}</span>
          <span className="text-[14px] text-gray-600">
            {template.data && (
              <>
                <Mono>{answered}</Mono> of <Mono>{total}</Mono> answered ·{' '}
              </>
            )}
            Edited <Mono>{formatDateTime(draft.updated_at)}</Mono>
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={() => goToAssessment(`?draft=${draft.client_ref}`)}>
            Continue
          </Button>
        </div>
      </Card>
    </li>
  );
}

function QueuedRow({
  entry,
  onTryAgain,
  onOpenAsDraft,
  onDiscard,
}: {
  entry: QueuedAssessment;
  onTryAgain: () => void;
  onOpenAsDraft: () => void;
  onDiscard: () => void;
}) {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const failed = entry.status === 'failed';

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
            <span className="text-[17px] font-bold">
              {entry.summary?.title ?? 'Building assessment'}
            </span>
            <span className="text-[14px] text-gray-600">
              Saved <Mono>{formatDateTime(entry.createdAt)}</Mono>
            </span>
          </div>
          {failed ? (
            <Pill tone="error" icon={<Dot className="bg-error-500" />}>
              Couldn&apos;t send
            </Pill>
          ) : (
            <Pill tone="warning" icon={<Dot className="bg-warning-500" />}>
              {!isOnline ? 'Waiting for connection' : isSyncing ? 'Sending…' : 'Waiting to retry'}
            </Pill>
          )}
        </div>
        {failed && (
          <div className="flex flex-col gap-3">
            {entry.errorMessage && (
              <p className="text-[14px] leading-[1.45] font-medium text-error-700">
                {entry.errorMessage}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onTryAgain}>
                Try again
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenAsDraft}>
                Open as draft
              </Button>
              <Button variant="danger" size="sm" onClick={onDiscard}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

function Submitted({ userId }: { userId: string }) {
  const mine = useMyAssessments(userId);
  const isOnline = useOfflineQueueStore((s) => s.isOnline);

  let body: React.ReactNode;
  if (mine.data && mine.data.length > 0) {
    body = mine.data.map((row) => {
      const p = percent({ safe: row.safe, counted: row.counted, na: 0 });
      return (
        <li key={row.id}>
          <AssessmentLink
            query={`?view=${row.id}`}
            className={cn('group block rounded-[22px]', FOCUS_RING)}
          >
            <Card className="flex items-center gap-3 p-4 transition-shadow group-hover:shadow-[0_6px_18px_rgba(16,24,40,.12)] md:p-5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[17px] font-bold">{row.building_name}</span>
                <span className="text-[14px] text-gray-600">
                  {row.unit_name} · <Mono>{formatDate(row.ended_at)}</Mono>
                </span>
              </div>
              {row.needs_follow_up && (
                <Pill tone="warning" icon={<Dot className="bg-warning-500" />}>
                  Follow-up
                </Pill>
              )}
              <Mono className="text-[20px] font-semibold">{p === null ? '—' : `${p}%`}</Mono>
              <ChevronRight size={20} aria-hidden className="shrink-0 text-gray-400" />
            </Card>
          </AssessmentLink>
        </li>
      );
    });
  } else if (mine.data) {
    body = <EmptyLine>No submitted assessments yet.</EmptyLine>;
  } else if (!isOnline) {
    body = <EmptyLine>Connect to see your submitted assessments.</EmptyLine>;
  } else if (mine.isError) {
    body = <EmptyLine>Couldn&apos;t load your submitted assessments.</EmptyLine>;
  } else {
    body = <EmptyLine>Loading…</EmptyLine>;
  }

  return <HubSection title="Submitted">{body}</HubSection>;
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <li className="text-[15px] text-gray-600">{children}</li>;
}
