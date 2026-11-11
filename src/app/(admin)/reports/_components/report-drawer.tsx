'use client';

import { createReport } from '@/actions/reports';
import {
  Button,
  casualtiesMeta,
  Drawer,
  FieldError,
  LocationPicker,
  missingPersonsMeta,
  OptionTile,
  OTHER_OPTION,
  OTHER_VALUE,
  PeopleDrawer,
  photoBytes,
  PhotoField,
  SelectField,
  Stepper,
  TextInput,
  type CasualtyEntry,
  type PersonEntry,
  type PersonSex,
  type PhotoItem,
  type PickedLocation,
  type SavedPhoto,
} from '@/components/ds';
import { useCampusClusters } from '@/components/hooks/use-campus';
import { useOngoingEventOptions } from '@/components/hooks/use-events';
import { useCampusPopulationCategories } from '@/components/hooks/use-population-categories';
import { useReport, useReportPhotoUrls, useSaveReportEdits } from '@/components/hooks/use-reports';
import {
  useCasualtyConditions,
  useDamageConditions,
  useUnits,
} from '@/components/hooks/use-settings';
import {
  REPORT_MAX_PHOTOS,
  REPORT_PHOTO_BUDGET_BYTES,
  REPORT_PHOTO_MAX_BYTES,
  REPORT_PHOTO_MAX_EDGE,
  reportPhotoFiles,
  toReportPhotoFormData,
} from '@/lib';
import { newUuid } from '@/lib/assessment-draft';
import {
  getQueuedFieldReportCount,
  getQueuedReportCount,
  isNetworkError,
  queueFieldReport,
} from '@/lib/offline-queue';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore, useOfflineQueueStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  DrawerSection,
  FormField,
  FormGrid,
  PersonHeader,
} from '../../_components/drawer-parts';
import { useEventTitle } from '../../_components/shell/campus-switcher';
import { Avatar, Skeleton } from '../../_components/ui';
import { formatDateTime, personName } from '../../_lib/format';
import { ReportDetails } from './report-details';

export type Report = NonNullable<ReturnType<typeof useReport>['data']>;

const toSex = (sex: string | null): PersonSex =>
  sex === 'male' || sex === 'female' ? sex : 'unknown';

/** How many photos a report holds: its damage's and its casualties'. */
const savedPhotoCount = (report: Report) =>
  report.damage_photo_paths.length +
  report.casualties.reduce((n, c) => n + c.photo_paths.length, 0);

/**
 * Add report / Edit report: the same fields as the ERT report in a drawer — where, headcount
 * steppers, the people drawers, damage tiles and photos of the damage and of each casualty's
 * injury. Edits save in one write; a saved photo taken off is deleted only when the report saves.
 */
export function ReportDrawer({
  open,
  onClose,
  reportId,
  campusId,
  readOnly,
}: {
  open: boolean;
  onClose: () => void;
  /** Edit this report; without it the drawer adds one. */
  reportId?: string;
  /** The top-bar campus, which limits the events Add report offers. */
  campusId?: string;
  /** Show `reportId` to read, with nothing to edit or save. */
  readOnly?: boolean;
}) {
  const { data: report, isPending } = useReport(reportId);
  // Edit shows the saved photos, so it waits for their links; a failure still opens the form.
  const hasPhotos = !readOnly && !!report && savedPhotoCount(report) > 0;
  const photoUrls = useReportPhotoUrls(reportId, hasPhotos);
  const eventTitle = useEventTitle();
  const [saving, setSaving] = useState(false);
  const isEdit = !!reportId;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={readOnly ? 'Report' : isEdit ? 'Edit report' : 'Add report'}
      subtitle={
        isEdit
          ? report
            ? `${eventTitle(report.event.name, report.event.campus.name)} · submitted ${formatDateTime(report.submitted_at)}`
            : undefined
          : 'For an ongoing event. You are recorded as the reporter.'
      }
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </DrawerButton>
          {!readOnly && (
            <DrawerButton type="submit" form="report-form" loading={saving}>
              {isEdit ? 'Update report' : 'Submit report'}
            </DrawerButton>
          )}
        </DrawerButtons>
      }
    >
      {isEdit && (isPending || !report || (hasPhotos && photoUrls.isPending)) ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-12 w-60" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : readOnly && report ? (
        <ReportDetails report={report} />
      ) : (
        <ReportForm
          report={isEdit ? (report ?? null) : null}
          photoUrls={photoUrls.data?.byPath ?? null}
          campusId={campusId}
          onSaving={setSaving}
          onDone={onClose}
        />
      )}
    </Drawer>
  );
}

function ReportForm({
  report,
  photoUrls,
  campusId: scopedCampusId,
  onSaving,
  onDone,
}: {
  report: Report | null;
  /** Signed links to the report's saved photos by path; null when they couldn't be loaded. */
  photoUrls: Record<string, string> | null;
  campusId?: string;
  onSaving: (saving: boolean) => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const setPendingCount = useOfflineQueueStore((s) => s.setPendingCount);
  const saveEdits = useSaveReportEdits();
  const { data: events = [] } = useOngoingEventOptions(scopedCampusId, { enabled: !report });
  const eventTitle = useEventTitle();

  /**
   * One place's saved photos with their links. Undefined when a link is missing: then the form
   * can't show them, sends no keep list, and the server keeps them all.
   */
  const savedFrom = (paths: string[]): SavedPhoto[] | undefined =>
    paths.every((path) => photoUrls?.[path])
      ? paths.map((path) => ({ path, url: photoUrls![path] }))
      : undefined;

  const [eventId, setEventId] = useState(report?.event_id ?? '');
  const event = events.find((e) => e.id === eventId);
  const campusId = report ? report.cluster.campus_id : event?.campus_id;

  const [clusterId, setClusterId] = useState(report?.cluster_id ?? '');
  const [unitId, setUnitId] = useState(report?.unit_id ?? '');
  // "Other (please specify)": a unit not listed yet, added to the cluster when this saves.
  const [unitName, setUnitName] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(
    report?.latitude != null && report?.longitude != null
      ? { lat: report.latitude, lng: report.longitude, name: report.location_name }
      : null
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries((report?.population_counts ?? []).map((pc) => [pc.category_id, pc.count]))
  );
  const [missing, setMissing] = useState<PersonEntry[]>(
    (report?.missing_persons ?? []).map((p) => ({ name: p.name, age: p.age, sex: toSex(p.sex) }))
  );
  const [casualties, setCasualties] = useState<CasualtyEntry[]>(
    (report?.casualties ?? []).map((c) => ({
      // The id keeps the casualty's photos with it when the report saves.
      id: c.id,
      name: c.name,
      age: c.age,
      sex: toSex(c.sex),
      condition_id: c.condition_id,
      diagnosis: c.diagnosis,
      photoCount: c.photo_paths.length,
      savedPhotos: savedFrom(c.photo_paths),
    }))
  );
  // Saving takes off only the casualties removed here, so one added since the form opened stays.
  const [loadedCasualtyIds] = useState(() => (report?.casualties ?? []).map((c) => c.id));
  /** A new report's id, made before the first try and kept for retries, so it saves only once. */
  const newReportIdRef = useRef<string | null>(null);
  const [damageId, setDamageId] = useState(report?.damage_condition_id ?? '');
  const [damageSaved, setDamageSaved] = useState(() => savedFrom(report?.damage_photo_paths ?? []));
  /** Saved damage photos the form couldn't load; they stay with the report. */
  const damageUnloaded = damageSaved ? 0 : (report?.damage_photo_paths.length ?? 0);
  const [damagePhotos, setDamagePhotos] = useState<PhotoItem[]>([]);
  const casualtyPhotos = casualties.flatMap((c) => c.photos ?? []);

  // New photo previews are object URLs; release them when the drawer closes.
  const photosRef = useRef<PhotoItem[]>([]);
  photosRef.current = [...damagePhotos, ...casualtyPhotos];
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);
  const [people, setPeople] = useState<'missing' | 'casualty' | null>(null);
  const [peopleKey, setPeopleKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: clusters = [] } = useCampusClusters(campusId ?? '');
  const { data: units = [] } = useUnits(clusterId || undefined, { enabled: !!clusterId });
  const { data: categories = [], isLoading: categoriesLoading } = useCampusPopulationCategories(
    campusId ?? undefined
  );
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [], isLoading: damageLoading } = useDamageConditions();

  const conditions = casualtyConditions
    .filter((c) => c.is_active)
    .map((c) => ({ id: c.id, name: c.name }));
  const conditionName = (id: string) => conditions.find((c) => c.id === id)?.name ?? 'Unknown';
  const damages = damageConditions.filter((d) => d.is_active || d.id === damageId);
  const total = categories.reduce((sum, cc) => sum + (counts[cc.category_id] ?? 0), 0);

  const reporter = report?.user ?? userProfile;
  const reporterName = personName(reporter) || 'Unknown reporter';
  const reporterDetail = [reporter?.position?.name, reporter?.email].filter(Boolean).join(' · ');

  const openPeople = (kind: 'missing' | 'casualty') => {
    setPeopleKey((k) => k + 1);
    setPeople(kind);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!report && !eventId) next.event = 'Pick the event this report is for.';
    if (!clusterId) next.cluster = 'Pick a cluster.';
    if (unitId === OTHER_VALUE && !unitName.trim()) next.unitName = 'Enter the unit name.';
    if (!location) next.location = 'Drop a pin on the map.';
    if (!damageId) next.damage = 'Pick the structural damage.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      cluster_id: clusterId,
      unit_id: unitId === OTHER_VALUE ? null : unitId || null,
      unit_name: unitId === OTHER_VALUE ? unitName.trim() : null,
      latitude: location!.lat,
      longitude: location!.lng,
      location_name: location!.name,
      damage_condition_id: damageId,
      population_counts: categories.map((cc) => ({
        category_id: cc.category_id,
        code: cc.category.code,
        count: counts[cc.category_id] ?? 0,
      })),
      report_missing_persons: missing.map((p) => ({ name: p.name, age: p.age, sex: p.sex })),
      report_casualties: casualties.map((c) => ({
        ...(c.id && { id: c.id }),
        condition_id: c.condition_id,
        name: c.name,
        age: c.age,
        sex: c.sex,
        diagnosis: c.diagnosis ?? null,
      })),
    };
    // New photos only; saved ones stay in Storage and are listed by path below.
    const photos = reportPhotoFiles(
      damagePhotos.map((p) => p.blob),
      casualties.map((c) => (c.photos ?? []).map((p) => p.blob))
    );
    const warnIfDropped = (saved: number) => {
      if (saved < photos.length) {
        toast(`Only ${saved} of ${photos.length} new photos were saved with the report.`, {
          icon: '⚠️',
        });
      }
    };

    onSaving(true);
    try {
      if (report) {
        const kept = new Set(casualties.map((c) => c.id));
        const removed_casualty_ids = loadedCasualtyIds.filter((id) => !kept.has(id));
        const { photoCount } = await saveEdits.mutateAsync({
          id: report.id,
          data: {
            ...payload,
            report_casualties: payload.report_casualties.map((c, i) => ({
              ...c,
              ...(c.id && { photo_paths: casualties[i].savedPhotos?.map((p) => p.path) }),
            })),
            damage_photo_paths: damageSaved?.map((p) => p.path),
            removed_casualty_ids,
          },
          photos,
        });
        toast.success('Report updated');
        warnIfDropped(photoCount);
      } else {
        newReportIdRef.current ??= newUuid();
        const create = {
          ...payload,
          id: newReportIdRef.current,
          event_id: eventId,
          user_id: userProfile?.id,
        };
        const saveOffline = async () => {
          await queueFieldReport(create, photos, {
            title: event?.name ?? 'Status report',
            subtitle: 'Added from the admin dashboard',
          });
          const [bystander, field] = await Promise.all([
            getQueuedReportCount(),
            getQueuedFieldReportCount(),
          ]);
          setPendingCount(bystander + field);
          toast.success(
            "No connection — the report is saved on this device and sends once you're online."
          );
        };
        if (!navigator.onLine) {
          await saveOffline();
        } else {
          try {
            const result = await createReport(
              await getAccessToken(),
              create,
              toReportPhotoFormData(photos)
            );
            if (!result.ok) throw new Error(result.error);
            for (const key of ['reports', 'event-summary', 'dashboard', 'events']) {
              queryClient.invalidateQueries({ queryKey: [key] });
            }
            toast.success('Report submitted');
            warnIfDropped(result.photoCount);
          } catch (err) {
            if (!isNetworkError(err)) throw err;
            await saveOffline();
          }
        }
      }
      // A unit typed under Other is new in the unit lists.
      if (payload.unit_name) queryClient.invalidateQueries({ queryKey: ['units'] });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The report could not be saved.');
    } finally {
      onSaving(false);
    }
  };

  return (
    <form id="report-form" onSubmit={submit} noValidate>
      <DrawerBody>
        <PersonHeader
          avatar={<Avatar name={reporterName} size={48} highlight />}
          name={reporterName}
          detail={reporterDetail}
        />

        {!report && (
          <DrawerSection title="Event">
            <FormGrid>
              <FormField id="report-event" label="Event" hint="Required" error={errors.event}>
                <SelectField
                  id="report-event"
                  value={eventId}
                  onChange={(value) => {
                    setEventId(value);
                    setClusterId('');
                    setUnitId('');
                    setCounts({});
                    setErrors((er) => ({ ...er, event: '' }));
                  }}
                  options={events.map((e) => ({
                    value: e.id,
                    label: eventTitle(e.name, e.campus.name),
                  }))}
                  placeholder={events.length ? 'Select an ongoing event' : 'No event is ongoing'}
                  required
                  invalid={!!errors.event}
                  describedBy={errors.event ? 'report-event-error' : undefined}
                />
              </FormField>
            </FormGrid>
          </DrawerSection>
        )}

        <DrawerSection title="Where">
          <FormGrid>
            <FormField
              id="report-cluster"
              label="Cluster"
              hint="Required"
              half
              error={errors.cluster}
            >
              <SelectField
                id="report-cluster"
                value={clusterId}
                onChange={(value) => {
                  setClusterId(value);
                  setUnitId('');
                  setErrors((er) => ({ ...er, cluster: '' }));
                }}
                options={clusters
                  .filter((c) => c.is_active || c.id === clusterId)
                  .map((c) => ({ value: c.id, label: c.name }))}
                placeholder={campusId ? 'Select cluster' : 'Pick the event first'}
                disabled={!campusId}
                required
                invalid={!!errors.cluster}
                describedBy={errors.cluster ? 'report-cluster-error' : undefined}
              />
            </FormField>
            <FormField id="report-unit" label="Unit" hint="Optional" half>
              <SelectField
                id="report-unit"
                value={unitId}
                onChange={(value) => {
                  setUnitId(value);
                  setErrors((er) => ({ ...er, unitName: '' }));
                }}
                options={[
                  ...units
                    .filter((u) => u.is_active || u.id === unitId)
                    .map((u) => ({ value: u.id, label: u.name })),
                  OTHER_OPTION,
                ]}
                placeholder={clusterId ? 'No unit' : 'Pick the cluster first'}
                emptyLabel="No unit"
                disabled={!clusterId}
              />
            </FormField>
            {unitId === OTHER_VALUE && (
              <FormField
                id="report-unit-name"
                label="Unit name"
                hint="Required"
                error={errors.unitName}
              >
                <TextInput
                  id="report-unit-name"
                  autoFocus
                  placeholder="e.g. Room 500s"
                  autoComplete="off"
                  value={unitName}
                  onChange={(e) => {
                    setUnitName(e.target.value);
                    setErrors((er) => ({ ...er, unitName: '' }));
                  }}
                  invalid={!!errors.unitName}
                  aria-describedby={errors.unitName ? 'report-unit-name-error' : undefined}
                />
              </FormField>
            )}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span
                id="report-location-label"
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-[14px] font-semibold text-gray-700">Location</span>
                <span className="text-[12px] font-medium text-gray-500">Required</span>
              </span>
              <LocationPicker
                location={location}
                error={errors.location}
                labelledBy="report-location-label"
                onChange={(value) => {
                  setLocation(value);
                  if (value) setErrors((er) => ({ ...er, location: '' }));
                }}
              />
            </div>
          </FormGrid>
        </DrawerSection>

        <DrawerSection title="Headcount" aside={`Total ${total.toLocaleString()}`}>
          {categoriesLoading ? (
            <div aria-busy="true" className="flex flex-col">
              <span className="sr-only">Loading the headcount fields…</span>
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="flex min-h-14.5 items-center gap-2.5 border-b border-line py-1"
                >
                  <Skeleton className="h-4 w-2/5 rounded-md" />
                  <Skeleton className="ml-auto h-12.5 w-36 rounded-full" />
                </div>
              ))}
            </div>
          ) : categories.length ? (
            <div className="flex flex-col">
              {categories.map((cc) => (
                <div
                  key={cc.category_id}
                  className="flex min-h-14.5 items-center gap-2.5 border-b border-line py-1"
                >
                  <label
                    htmlFor={`count-${cc.category_id}`}
                    className="min-w-0 flex-1 text-[14px] leading-[1.3] font-semibold text-pretty text-gray-700"
                  >
                    {cc.category.name}
                  </label>
                  <Stepper
                    id={`count-${cc.category_id}`}
                    label={cc.category.name}
                    value={counts[cc.category_id] ?? 0}
                    onChange={(value) => setCounts((c) => ({ ...c, [cc.category_id]: value }))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-gray-500">
              {campusId
                ? 'This campus has no population fields yet. Add them in Settings › Population fields.'
                : 'Pick the event first.'}
            </p>
          )}
        </DrawerSection>

        <DrawerSection title="People affected">
          <ul className="flex flex-col">
            {[
              {
                kind: 'missing' as const,
                title: 'Missing persons',
                meta: missing.length ? missingPersonsMeta(missing) : 'None reported',
                icon: <UserRound size={20} aria-hidden />,
                tone: 'bg-gray-100 text-gray-600',
                count: missing.length,
              },
              {
                kind: 'casualty' as const,
                title: 'Casualties',
                meta: casualties.length
                  ? casualtiesMeta(casualties, conditionName)
                  : 'None reported',
                icon: <Users size={20} aria-hidden />,
                tone: 'bg-error-50 text-error-700',
                count: casualties.length,
              },
            ].map((row) => (
              <li key={row.kind} className="flex items-center gap-3.5 border-b border-line py-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${row.tone}`}
                >
                  {row.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{row.title}</span>
                  <span className="truncate text-[13px] text-gray-500">{row.meta}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => openPeople(row.kind)}>
                  {row.count ? 'Manage' : 'Add'}
                </Button>
              </li>
            ))}
          </ul>
        </DrawerSection>

        <DrawerSection title="Structural damage" aside="Required">
          <div
            role="radiogroup"
            aria-label="Structural damage"
            aria-describedby={errors.damage ? 'report-damage-error' : undefined}
            aria-busy={damageLoading || undefined}
            className="grid grid-cols-2 gap-2 md:grid-cols-3"
          >
            {damageLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-13 rounded-2xl" />
              ))}
            {damages.map((d) => (
              <OptionTile
                key={d.id}
                name="report-damage"
                value={d.id}
                checked={damageId === d.id}
                onSelect={(value) => {
                  setDamageId(value);
                  setErrors((er) => ({ ...er, damage: '' }));
                }}
                className="min-h-13 py-2 text-[14px]"
              >
                {d.name}
              </OptionTile>
            ))}
          </div>
          <FieldError id="report-damage-error">{errors.damage}</FieldError>
          <div className="mt-2">
            <PhotoField
              id="report-damage-photos"
              max={REPORT_MAX_PHOTOS - damageUnloaded}
              maxBytes={REPORT_PHOTO_MAX_BYTES}
              maxEdge={REPORT_PHOTO_MAX_EDGE}
              roomBytes={
                REPORT_PHOTO_BUDGET_BYTES - photoBytes(damagePhotos) - photoBytes(casualtyPhotos)
              }
              saved={damageSaved}
              onRemoveSaved={(path) =>
                setDamageSaved((list) => list?.filter((p) => p.path !== path))
              }
              photos={damagePhotos}
              onAdd={(added) => setDamagePhotos((list) => [...list, ...added])}
              onRemove={(id) => {
                const photo = damagePhotos.find((p) => p.id === id);
                if (photo) URL.revokeObjectURL(photo.url);
                setDamagePhotos((list) => list.filter((p) => p.id !== id));
              }}
            />
            {damageUnloaded > 0 && (
              <p className="mt-2 text-[13px] text-gray-500">
                {damageUnloaded === 1
                  ? 'One saved photo couldn’t be loaded. It stays with the report.'
                  : `${damageUnloaded} saved photos couldn’t be loaded. They stay with the report.`}
              </p>
            )}
          </div>
        </DrawerSection>
      </DrawerBody>

      {/* Over the report drawer, outside its sliding panel. A new key per open starts fresh. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <PeopleDrawer
              key={`missing-${peopleKey}`}
              kind="missing"
              audience="ert"
              open={people === 'missing'}
              onClose={() => setPeople(null)}
              conditions={conditions}
              people={missing}
              onSave={setMissing}
              allowEdit
            />
            <PeopleDrawer
              key={`casualty-${peopleKey}`}
              kind="casualty"
              audience="ert"
              open={people === 'casualty'}
              onClose={() => setPeople(null)}
              conditions={conditions}
              people={casualties}
              onSave={setCasualties}
              photos={{ budgetBytes: REPORT_PHOTO_BUDGET_BYTES - photoBytes(damagePhotos) }}
              allowEdit
            />
          </>,
          document.body
        )}
    </form>
  );
}
