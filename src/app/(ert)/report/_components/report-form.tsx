'use client';

import { createReport } from '@/actions/reports';
import {
  Banner,
  Button,
  casualtiesMeta,
  FieldError,
  FOCUS_RING,
  formatCoordinates,
  missingPersonsMeta,
  OptionTile,
  PeopleDrawer,
  PrivacyDrawer,
  Stepper,
  type CasualtyEntry,
  type PersonEntry,
} from '@/components/ds';
import { useCampusPopulationCategories } from '@/components/hooks/use-population-categories';
import { useCasualtyConditions, useDamageConditions } from '@/components/hooks/use-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, type ReportFormData } from '@/lib';
import { getAllQueuedCount, isNetworkError, queueFieldReport } from '@/lib/offline-queue';
import { useAuthStore, useOfflineQueueStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Shield, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Card,
  Dot,
  GUTTER,
  Hero,
  Mono,
  personName,
  Pill,
  SectionCard,
} from '../../_components/chrome';
import { formatTime } from '../../_lib/format';
import { clearDraft, loadDraft, saveDraft } from '../_lib/draft';
import { EventDrawer, type OngoingEvent } from './event-drawer';
import { LocationSection, type PickedLocation } from './location-section';
import { PeopleRow } from './people-rows';

type DrawerName = 'event' | 'missing' | 'casualty' | 'privacy';

const TEXT_LINK = cn('text-brand-500 font-bold hover:text-brand-600 hover:underline', FOCUS_RING);

/**
 * The status report as one page, not steps: the leader fills the headcount as people arrive,
 * so every count and the total stay in view together. Web has a summary rail with Submit;
 * tablet and phone get a bottom bar with the total and Submit. A draft is kept on the phone
 * after each change and restored when the page is opened again.
 */
export function ErtReportForm({
  events,
  campusName,
}: {
  events: OngoingEvent[];
  campusName: string;
}) {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.userProfile)!;
  const userId = profile.id;
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const setPendingCount = useOfflineQueueStore((s) => s.setPendingCount);

  const { data: categories = [], isPending: categoriesPending } = useCampusPopulationCategories(
    profile.campus_id ?? undefined
  );
  const { data: damageConditions = [], isPending: damagePending } = useDamageConditions();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const activeDamage = damageConditions.filter((d) => d.is_active);
  const activeConditions = casualtyConditions.filter((c) => c.is_active);

  // With one ongoing event it is preselected; with several, the member picks.
  const defaultEventId = events.length === 1 ? events[0].id : '';

  const [restored] = useState(() => {
    const draft = loadDraft(userId);
    const eventStillOngoing = !draft?.eventId || events.some((e) => e.id === draft.eventId);
    return draft && eventStillOngoing ? draft : null;
  });

  const [eventId, setEventId] = useState(restored?.eventId || defaultEventId);
  const [location, setLocation] = useState<PickedLocation | null>(restored?.location ?? null);
  const [counts, setCounts] = useState<Record<string, number>>(restored?.counts ?? {});
  const [damageId, setDamageId] = useState(restored?.damageId ?? '');
  const [missingPersons, setMissingPersons] = useState<PersonEntry[]>(
    restored?.missingPersons ?? []
  );
  const [casualties, setCasualties] = useState<CasualtyEntry[]>(restored?.casualties ?? []);
  /** Set by every change the member makes; null until then, so an untouched form isn't saved. */
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);
  const [restoredAt, setRestoredAt] = useState<number | null>(restored?.savedAt ?? null);
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const [drawer, setDrawer] = useState<DrawerName | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const finishedRef = useRef(false);

  const touch = () => setSavedAt(Date.now());

  useEffect(() => {
    if (savedAt === null || finishedRef.current) return;
    saveDraft(userId, {
      version: 1,
      eventId,
      location,
      counts,
      damageId,
      missingPersons,
      casualties,
      savedAt,
    });
  }, [userId, eventId, location, counts, damageId, missingPersons, casualties, savedAt]);

  const openDrawer = (name: DrawerName) => {
    setDrawerKey((k) => k + 1);
    setDrawer(name);
  };

  const selectedEvent = events.find((e) => e.id === eventId);
  const selectedDamage = activeDamage.find((d) => d.id === damageId);
  const total = categories.reduce((sum, cc) => sum + (counts[cc.category_id] ?? 0), 0);
  const conditionName = (id: string) => casualtyConditions.find((c) => c.id === id)?.name ?? '';
  const missing = { event: !selectedEvent, location: !location, damage: !selectedDamage };

  const name = personName(profile) || profile.email;
  const place = [profile.cluster?.name ?? profile.unit?.cluster?.name, profile.unit?.name]
    .filter(Boolean)
    .join(' / ');

  const startOver = () => {
    clearDraft(userId);
    setEventId(defaultEventId);
    setLocation(null);
    setCounts({});
    setDamageId('');
    setMissingPersons([]);
    setCasualties([]);
    setSavedAt(null);
    setRestoredAt(null);
    setConfirmingStartOver(false);
    setShowErrors(false);
    setSubmitError('');
    // Remounts the location section, which asks for the device location again.
    setFormKey((k) => k + 1);
  };

  const submit = async () => {
    setShowErrors(true);
    setSubmitError('');
    if (missing.event) {
      openDrawer('event');
      return;
    }
    if (missing.location || missing.damage) {
      const section = document.getElementById(
        missing.location ? 'report-location' : 'report-damage'
      );
      section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      section?.focus({ preventScroll: true });
      return;
    }
    const clusterId = profile.cluster_id ?? profile.unit?.cluster_id;
    if (!clusterId || !location || !selectedEvent) {
      setSubmitError(
        'Your profile has no cluster yet. Ask the DRRM-H office to set it, then try again.'
      );
      return;
    }

    const payload: ReportFormData & { user_id: string } = {
      event_id: selectedEvent.id,
      cluster_id: clusterId,
      unit_id: profile.unit_id ?? null,
      user_id: userId,
      latitude: location.lat,
      longitude: location.lng,
      location_name: location.name,
      damage_condition_id: damageId,
      population_counts: categories.map((cc) => ({
        category_id: cc.category_id,
        code: cc.category.code,
        count: counts[cc.category_id] ?? 0,
      })),
      report_missing_persons: missingPersons.map(({ name, age, sex }) => ({ name, age, sex })),
      report_casualties: casualties.map(({ condition_id, name, age, sex, diagnosis }) => ({
        condition_id,
        name,
        age,
        sex,
        diagnosis: diagnosis ?? null,
      })),
    };

    const finish = () => {
      finishedRef.current = true;
      clearDraft(userId);
    };

    // The page notices the queued report and shows "Report saved on this phone".
    const saveOffline = async () => {
      await queueFieldReport(payload, undefined, {
        title: selectedEvent.name,
        subtitle: place ? `Status report · ${place}` : 'Status report',
      });
      finish();
      setPendingCount(await getAllQueuedCount());
    };

    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await saveOffline();
        return;
      }
      try {
        await createReport(payload);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await saveOffline();
        return;
      }
      finish();
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      // The page switches to the submitted report once this comes back.
      await queryClient.invalidateQueries({ queryKey: ['my-report', userId] });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'The report couldn’t be submitted. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = submitting
    ? isOnline
      ? 'Submitting…'
      : 'Saving…'
    : isOnline
      ? 'Submit report'
      : 'Save report to send later';

  const locationSummary = location
    ? (location.name?.split(',').slice(0, 2).join(',').trim() ??
      formatCoordinates(location.lat, location.lng))
    : null;

  return (
    <>
      <Hero
        eyebrow={`Status report · ${campusName}`}
        title={selectedEvent?.name ?? 'Choose the event you’re reporting for'}
      >
        {selectedEvent && (
          <Pill tone="live" icon={<Dot className="bg-[#32d583]" />}>
            Ongoing
          </Pill>
        )}
        {(events.length > 1 || !selectedEvent) && (
          <button
            type="button"
            onClick={() => openDrawer('event')}
            className={cn(
              'rounded text-[16px] font-bold text-white underline underline-offset-3 hover:text-[#fbd5d5]',
              FOCUS_RING
            )}
          >
            {selectedEvent ? 'Change event' : 'Choose event'}
          </button>
        )}
      </Hero>

      <div
        className={cn(
          GUTTER,
          'grid flex-1 items-start gap-6 pt-6 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]'
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          {!isOnline && (
            <Banner tone="warning" icon={<WifiOff size={18} aria-hidden />}>
              You&apos;re offline. You can still fill in this report and save it on this phone; it
              sends when your connection returns.
            </Banner>
          )}
          {restoredAt && (
            <DraftRestored
              at={restoredAt}
              confirming={confirmingStartOver}
              onStartOver={() => setConfirmingStartOver(true)}
              onConfirm={startOver}
              onCancel={() => setConfirmingStartOver(false)}
            />
          )}
          {submitError && <Banner>{submitError}</Banner>}

          <Card className="flex flex-wrap items-center gap-x-3.5 gap-y-3 px-5 py-4 md:px-6">
            <Avatar name={name} />
            <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
              <span className="text-[17px] font-bold">
                {name}
                {profile.position && ` · ${profile.position.name}`}
              </span>
              <span className="text-[14px] text-gray-600">
                {place || 'No cluster on your profile'}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500">
              <Shield size={14} aria-hidden />
              From your profile
            </span>
          </Card>

          <LocationSection
            key={formKey}
            location={location}
            error={
              showErrors && missing.location
                ? 'Pin the location on the map, or use your location.'
                : undefined
            }
            onChange={(next, userAction) => {
              setLocation(next);
              if (userAction) touch();
            }}
          />

          <SectionCard
            number={2}
            title="Headcount"
            aside={
              <span className="flex items-baseline gap-1.5 text-[14px] font-medium text-gray-500">
                Total
                <Mono className="text-[19px] font-bold text-gray-900">{total}</Mono>
              </span>
            }
          >
            {() =>
              categoriesPending ? (
                <div aria-busy="true" className="mt-1.5 grid md:grid-cols-2 md:gap-x-6">
                  <span className="sr-only">Loading the headcount fields…</span>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      className="flex min-h-15 items-center gap-3 border-b border-line py-1.5"
                    >
                      <Skeleton className="h-4 w-2/5 rounded-md" />
                      <Skeleton className="ml-auto h-12.5 w-36 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : categories.length ? (
                <div className="mt-1.5 grid md:grid-cols-2 md:gap-x-6">
                  {categories.map((cc) => (
                    <div
                      key={cc.category_id}
                      className="flex min-h-15 items-center gap-3 border-b border-line py-1.5"
                    >
                      <span className="min-w-0 flex-1 text-[16px] leading-[1.3] font-semibold text-pretty text-gray-700">
                        {cc.category.name}
                      </span>
                      <Stepper
                        id={`count-${cc.category_id}`}
                        label={cc.category.name}
                        value={counts[cc.category_id] ?? 0}
                        onChange={(value) => {
                          setCounts((c) => ({ ...c, [cc.category_id]: value }));
                          touch();
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[16px] text-gray-500">
                  No headcount fields are set up for your campus yet.
                </p>
              )
            }
          </SectionCard>

          <SectionCard number={3} title="People affected" aside="Optional">
            {() => (
              <div className="mt-1.5 flex flex-col">
                <PeopleRow
                  kind="missing"
                  meta={missingPersonsMeta(missingPersons)}
                  hasPeople={missingPersons.length > 0}
                  onManage={() => openDrawer('missing')}
                />
                <div className="h-px bg-line" />
                <PeopleRow
                  kind="casualty"
                  meta={casualtiesMeta(casualties, conditionName)}
                  hasPeople={casualties.length > 0}
                  onManage={() => openDrawer('casualty')}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard id="report-damage" number={4} title="Structural damage" aside="Required">
            {(titleId) => (
              <div className="mt-3.5 flex flex-col gap-2">
                <div
                  role="radiogroup"
                  aria-labelledby={titleId}
                  aria-describedby={showErrors && missing.damage ? 'damage-error' : undefined}
                  aria-busy={damagePending || undefined}
                  className="grid grid-cols-2 gap-2 md:grid-cols-4"
                >
                  {damagePending &&
                    Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-14 rounded-2xl" />
                    ))}
                  {activeDamage.map((damage) => (
                    <OptionTile
                      key={damage.id}
                      name="structural-damage"
                      value={damage.id}
                      checked={damageId === damage.id}
                      onSelect={(value) => {
                        setDamageId(value);
                        touch();
                      }}
                      className="min-h-14 py-2 text-[16px]"
                    >
                      {damage.name}
                    </OptionTile>
                  ))}
                </div>
                <FieldError id="damage-error">
                  {showErrors && missing.damage ? 'Choose the structural damage.' : undefined}
                </FieldError>
              </div>
            )}
          </SectionCard>

          <PrivacyLine className="lg:hidden" onRead={() => openDrawer('privacy')} />
        </div>

        <aside
          aria-label="Before you submit"
          className="sticky top-6 hidden flex-col gap-4.5 rounded-[22px] border border-gray-200 bg-surface p-6 shadow-theme-md lg:flex"
        >
          <h2 className="text-[19px] leading-[1.3] font-bold">Before you submit</h2>
          <ul className="flex flex-col gap-3.5">
            <CheckItem
              done={!missing.event}
              error={showErrors && missing.event}
              label="Event"
              detail={selectedEvent?.name ?? 'Not chosen yet'}
            />
            <CheckItem
              done={!missing.location}
              error={showErrors && missing.location}
              label="Location"
              detail={locationSummary ?? 'Not pinned yet'}
            />
            <CheckItem
              done={!missing.damage}
              error={showErrors && missing.damage}
              label="Structural damage"
              detail={selectedDamage?.name ?? 'Not chosen yet'}
            />
          </ul>
          <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-gray-50 px-4 py-3.5">
            <span className="text-[16px] font-semibold text-gray-600">Headcount total</span>
            <Mono className="text-[28px] font-extrabold">{total}</Mono>
          </div>
          <div className="flex flex-col gap-3">
            <Button fullWidth loading={submitting} onClick={submit}>
              {submitLabel}
            </Button>
            {savedAt && (
              <span className="flex items-center justify-center gap-1.5 text-[14px] font-medium text-gray-500">
                <Check size={12} strokeWidth={3} aria-hidden className="text-success-700" />
                Draft saved on this phone · <Mono>{formatTime(savedAt)}</Mono>
              </span>
            )}
          </div>
          <PrivacyLine stacked onRead={() => openDrawer('privacy')} />
        </aside>
      </div>

      <div
        data-bottom-bar
        className="sticky bottom-0 z-20 border-t border-line bg-surface shadow-[0_-4px_12px_rgba(16,24,40,.06)] lg:hidden"
      >
        <div className={cn(GUTTER, 'flex items-center gap-4 py-3')}>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[13px] font-medium text-gray-500">Headcount total</span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <Mono className="text-[22px] font-bold">{total}</Mono>
              {savedAt && (
                <span className="flex items-center gap-1 text-[13px] font-medium whitespace-nowrap text-gray-500">
                  <Check size={12} strokeWidth={3} aria-hidden className="text-success-700" />
                  Draft saved <Mono>{formatTime(savedAt)}</Mono>
                </span>
              )}
            </div>
          </div>
          <Button loading={submitting} onClick={submit} className="shrink-0">
            {isOnline || submitting ? submitLabel : 'Save to send later'}
          </Button>
        </div>
      </div>

      <EventDrawer
        key={`event-${drawerKey}`}
        open={drawer === 'event'}
        onClose={() => setDrawer(null)}
        events={events}
        selectedId={eventId}
        onChoose={(id) => {
          setEventId(id);
          touch();
        }}
      />
      <PeopleDrawer
        key={`missing-${drawerKey}`}
        audience="ert"
        kind="missing"
        open={drawer === 'missing'}
        onClose={() => setDrawer(null)}
        people={missingPersons}
        onSave={(people) => {
          setMissingPersons(people);
          touch();
        }}
        conditions={[]}
      />
      <PeopleDrawer
        key={`casualty-${drawerKey}`}
        audience="ert"
        kind="casualty"
        open={drawer === 'casualty'}
        onClose={() => setDrawer(null)}
        people={casualties}
        onSave={(people) => {
          setCasualties(people);
          touch();
        }}
        conditions={activeConditions}
      />
      <PrivacyDrawer open={drawer === 'privacy'} onClose={() => setDrawer(null)} />
    </>
  );
}

/** "Draft restored from 9:14 AM." with Start over, which asks before clearing. */
function DraftRestored({
  at,
  confirming,
  onStartOver,
  onConfirm,
  onCancel,
}: {
  at: number;
  confirming: boolean;
  onStartOver: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-2xl border border-gray-200 bg-gray-100 py-2 pr-2 pl-4 text-gray-700"
    >
      <div className="flex min-w-0 flex-[1_1_240px] items-start gap-2.5 py-1.5">
        <RotateCcw size={16} aria-hidden className="mt-0.75 shrink-0 text-gray-600" />
        <span className="text-[16px] leading-normal text-pretty">
          {confirming ? (
            <>
              <strong className="font-bold">Start over?</strong> This clears the counts, people and
              choices in this draft.
            </>
          ) : (
            <>
              <strong className="font-bold">Draft restored from {formatTime(at)}.</strong> Counts
              and choices are as you left them.
            </>
          )}
        </span>
      </div>
      {confirming ? (
        <div className="flex shrink-0 gap-1">
          <GhostAction onClick={onCancel} tone="neutral">
            Keep it
          </GhostAction>
          <GhostAction onClick={onConfirm}>Clear draft</GhostAction>
        </div>
      ) : (
        <GhostAction onClick={onStartOver}>Start over</GhostAction>
      )}
    </div>
  );
}

function GhostAction({
  tone = 'brand',
  onClick,
  children,
}: {
  tone?: 'brand' | 'neutral';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-12 shrink-0 rounded-full px-4 text-[16px] font-bold',
        tone === 'brand' ? 'text-brand-500 hover:bg-brand-25' : 'text-gray-700 hover:bg-gray-200',
        FOCUS_RING
      )}
    >
      {children}
    </button>
  );
}

function CheckItem({
  done,
  error,
  label,
  detail,
}: {
  done: boolean;
  error: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full',
          done
            ? 'bg-success-50 text-success-700'
            : error
              ? 'border-[1.5px] border-error-700'
              : 'border-[1.5px] border-gray-300'
        )}
      >
        {done && <Check size={14} strokeWidth={2.5} aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="text-[16px] font-semibold">
          {label}
          <span className="sr-only">{done ? ': done' : ': not done yet'}</span>
        </span>
        <span className={cn('truncate text-[14px]', error ? 'text-error-700' : 'text-gray-500')}>
          {detail}
        </span>
      </div>
    </li>
  );
}

/** The privacy line next to Submit, with the full notice in a drawer. */
function PrivacyLine({
  stacked,
  className,
  onRead,
}: {
  stacked?: boolean;
  className?: string;
  onRead: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 text-[14px] leading-normal text-gray-600',
        stacked ? 'border-t border-line pt-4' : 'px-1',
        className
      )}
    >
      <Shield size={16} aria-hidden className="mt-0.5 shrink-0" />
      <div className={cn(stacked && 'flex flex-col gap-1')}>
        <span>
          Processed under the Data Privacy Act of 2012, for documentation, evaluation and reporting
          only.
        </span>{' '}
        <button type="button" onClick={onRead} className={cn(TEXT_LINK, 'self-start')}>
          Read the full notice
        </button>
      </div>
    </div>
  );
}
