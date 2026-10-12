'use client';

import { createBystanderReport } from '@/actions/emergency-reports';
import { PeopleDrawer, PrivacyDrawer } from '@/components/ds';
import { useGetBystanderIncidentTypes } from '@/components/hooks/use-bystander-reports';
import { useCampuses } from '@/components/hooks/use-campus';
import { useCampusPopulationCategories } from '@/components/hooks/use-population-categories';
import {
  useCasualtyConditions,
  useClusters,
  useDamageConditions,
  useUnits,
} from '@/components/hooks/use-settings';
import {
  bystanderFormSchema,
  toBystanderPhotoFormData,
  toPhContactNumber,
  type BystanderCasualty,
  type BystanderFormValues,
  type BystanderMissingPerson,
  type BystanderReportFormData,
} from '@/lib';
import { getQueuedReportCount, isNetworkError, queueBystanderReport } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import toast from 'react-hot-toast';
import { HeroBand, PageCard } from './_components/chrome';
import type { PhotoItem } from './_components/photo-field';
import { ResultScreen, type ReportResult } from './_components/result-screen';
import { StepPeopleDamage } from './_components/step-people-damage';
import { StepReview } from './_components/step-review';
import { StepWhatWhere } from './_components/step-what-where';
import {
  casualtiesMeta,
  formatCoordinates,
  headcountSummary,
  missingPersonsMeta,
  peopleSummary,
} from './_lib/summary';

type Step = 1 | 2 | 3;
type DrawerName = 'privacy' | 'missing' | 'casualty';

const EMPTY_VALUES: BystanderFormValues = {
  incident_type_id: '',
  campus_id: '',
  latitude: null,
  longitude: null,
  cluster_id: '',
  unit_id: '',
  damage_condition_id: '',
  location_description: '',
  description: '',
  contact_number: '',
};

/** Step 1's required fields, in screen order, with the element that takes focus on error. */
const STEP_ONE_FIELDS = {
  incident_type_id: 'incident-type',
  campus_id: 'campus',
  latitude: 'location-map',
  cluster_id: 'cluster',
} as const;
type StepOneField = keyof typeof STEP_ONE_FIELDS;

const STEP_TWO_FIELDS = ['location_description', 'description'] as const;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Moves focus to a field that failed validation and brings it into view. */
function focusField(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const target = el.matches('input, select, textarea') ? el : (el.querySelector('input') ?? el);
  target.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Anonymous bystander report — a three-step form in response order: what and where (required),
 * people and damage (optional), then review and send. Reports sent without a connection go to
 * the offline queue with their photos and are sent by `OfflineQueueProvider` later.
 */
export function BystanderReportForm() {
  const queryClient = useQueryClient();
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const setPendingCount = useOfflineQueueStore((s) => s.setPendingCount);

  const {
    register,
    watch,
    setValue,
    trigger,
    handleSubmit,
    reset,
    getFieldState,
    formState: { errors: formErrors },
  } = useForm<BystanderFormValues>({
    resolver: zodResolver(bystanderFormSchema),
    defaultValues: EMPTY_VALUES,
  });
  const values = watch();
  const errors = Object.fromEntries(
    Object.entries(formErrors).map(([field, error]) => [field, error?.message])
  ) as Partial<Record<keyof BystanderFormValues, string>>;

  // ── Lookups ──────────────────────────────────────────────────────
  const { data: incidentTypes = [], isPending: incidentTypesPending } =
    useGetBystanderIncidentTypes();
  const { data: campuses = [] } = useCampuses();
  const { data: clusters = [] } = useClusters();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();
  const { data: units = [] } = useUnits(values.cluster_id || undefined, {
    enabled: !!values.cluster_id,
  });
  const { data: campusCategories = [], isLoading: categoriesLoading } =
    useCampusPopulationCategories(values.campus_id || undefined);

  // "Other" goes last; the rest keep the server's alphabetical order.
  const types = [...incidentTypes].sort(
    (a, b) => Number(a.name === 'Other') - Number(b.name === 'Other')
  );
  const activeCampuses = campuses.filter((c) => c.is_active);
  const campusClusters = clusters.filter((c) => c.is_active && c.campus_id === values.campus_id);
  const clusterUnits = units.filter((u) => u.is_active && u.cluster_id === values.cluster_id);
  const categories = campusCategories.map((cc) => ({ id: cc.category_id, name: cc.category.name }));
  const conditionName = (id: string) =>
    casualtyConditions.find((c) => c.id === id)?.name ?? 'Unknown condition';

  // ── Form state outside react-hook-form ───────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [missingPersons, setMissingPersons] = useState<BystanderMissingPerson[]>([]);
  const [casualties, setCasualties] = useState<BystanderCasualty[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [drawer, setDrawer] = useState<DrawerName | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);

  // A single active campus needs no choosing.
  const onlyCampusId = activeCampuses.length === 1 ? activeCampuses[0].id : '';
  useEffect(() => {
    if (onlyCampusId && !watch('campus_id')) setValue('campus_id', onlyCampusId);
  }, [onlyCampusId, setValue, watch]);

  // New step: back to the top, focus on its title so the change is announced.
  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Photo previews are object URLs; release them when the page goes away.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const goTo = (next: Step) => {
    stepChanged.current = true;
    setStep(next);
  };

  const openDrawer = (name: DrawerName) => {
    setDrawerKey((key) => key + 1);
    setDrawer(name);
  };

  const setField = (
    field: 'incident_type_id' | 'campus_id' | 'cluster_id' | 'unit_id' | 'damage_condition_id',
    value: string
  ) => {
    setValue(field, value, { shouldValidate: !!formErrors[field] });
    // Campus decides the cluster list and the headcount fields; cluster decides the units.
    if (field === 'campus_id') {
      setValue('cluster_id', '');
      setValue('unit_id', '');
      setCounts({});
    }
    if (field === 'cluster_id') setValue('unit_id', '');
  };

  const setLocation = (lat: number | null, lng: number | null) => {
    setValue('latitude', lat, { shouldValidate: !!formErrors.latitude });
    setValue('longitude', lng);
  };

  const continueFromStepOne = async () => {
    const fields = Object.keys(STEP_ONE_FIELDS) as StepOneField[];
    if (await trigger(fields)) return goTo(2);
    const firstInvalid = fields.find((field) => getFieldState(field).error);
    if (firstInvalid) focusField(STEP_ONE_FIELDS[firstInvalid]);
  };

  const continueFromStepTwo = async () => {
    if (await trigger([...STEP_TWO_FIELDS])) goTo(3);
  };

  const removePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.url);
    setPhotos((list) => list.filter((p) => p.id !== id));
  };

  const startOver = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setCounts({});
    setMissingPersons([]);
    setCasualties([]);
    // Someone sending a second report is very likely on the same campus.
    reset({ ...EMPTY_VALUES, campus_id: values.campus_id });
    setStep(1);
    setResult(null);
  };

  // ── Labels shared by the review step and the result screen ───────
  const typeName = types.find((t) => t.id === values.incident_type_id)?.name ?? '';
  const campusName = activeCampuses.find((c) => c.id === values.campus_id)?.name ?? '';
  const clusterName = campusClusters.find((c) => c.id === values.cluster_id)?.name ?? '';
  const unitName = clusterUnits.find((u) => u.id === values.unit_id)?.name;
  const incidentLabel = `${typeName} · ${[campusName, clusterName].filter(Boolean).join(', ')}`;

  // ── Send ─────────────────────────────────────────────────────────
  const send = async (v: BystanderFormValues) => {
    if (v.latitude === null || v.longitude === null) return;
    const payload: BystanderReportFormData = {
      incident_type_id: v.incident_type_id,
      cluster_id: v.cluster_id,
      unit_id: v.unit_id || null,
      latitude: v.latitude,
      longitude: v.longitude,
      description: v.description.trim() || undefined,
      location_description: v.location_description.trim() || undefined,
      damage_condition_id: v.damage_condition_id || null,
      contact_number: v.contact_number.trim() ? toPhContactNumber(v.contact_number) : null,
      population_counts: categories
        .map((c) => ({ category_id: c.id, count: counts[c.id] ?? 0 }))
        .filter((c) => c.count > 0),
      report_missing_persons: missingPersons,
      report_casualties: casualties,
    };
    const blobs = photos.map((p) => p.blob);
    const summary = { incident: incidentLabel, photosChosen: blobs.length };

    const saveOffline = async () => {
      try {
        await queueBystanderReport(payload, blobs);
      } catch {
        toast.error(
          "This report couldn't be saved on this device. If anyone needs help now, call 911."
        );
        return;
      }
      setPendingCount(await getQueuedReportCount());
      setResult({ kind: 'offline', at: new Date().toISOString(), photosSaved: 0, ...summary });
    };

    setIsSending(true);
    try {
      // No point trying the network if the browser already knows it's offline.
      if (!navigator.onLine) return await saveOffline();
      const saved = await createBystanderReport(payload, toBystanderPhotoFormData(blobs));
      queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
      setResult({ kind: 'sent', at: saved.submittedAt, photosSaved: saved.photoCount, ...summary });
    } catch (err) {
      // Connection dropped mid-send: keep the report instead of losing it.
      if (isNetworkError(err)) await saveOffline();
      else
        toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const onInvalid = (invalid: FieldErrors<BystanderFormValues>) => {
    const firstStepOne = (Object.keys(STEP_ONE_FIELDS) as StepOneField[]).find((f) => invalid[f]);
    if (firstStepOne) return goTo(1);
    if (STEP_TWO_FIELDS.some((f) => invalid[f])) return goTo(2);
    if (invalid.contact_number) focusField('contact-number');
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Enter in a text field on steps 1–2 must not send the report.
    if (step !== 3) return e.preventDefault();
    return handleSubmit(send, onInvalid)(e);
  };

  if (result) return <ResultScreen result={result} onSendAnother={startOver} />;

  return (
    <>
      <HeroBand className="h-40 px-4 pt-6 md:px-8 md:pt-9 lg:px-10">
        <h1 className="text-[24px] leading-[1.2] font-extrabold text-white md:text-[28px]">
          Report an emergency
        </h1>
        <p className="mt-1.5 text-[15px] leading-[1.45] text-[#fde8e8]">
          Anonymous. A contact number is optional.
        </p>
      </HeroBand>

      <PageCard className="-mt-12 mb-8 max-w-180 md:mb-14">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 p-5 md:gap-6 md:p-8">
          {!isOnline && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-[#fedf89] bg-warning-50 px-4 py-3.5 text-[14px] leading-normal text-[#93370d]"
            >
              <WifiOff size={18} aria-hidden className="mt-0.5 shrink-0 text-[#b54708]" />
              <span>
                <strong className="font-bold">You&apos;re offline.</strong> You can still fill out
                and submit this form. It will be saved on this device and sent automatically once
                you&apos;re back online.
              </span>
            </div>
          )}

          {step === 1 && (
            <StepWhatWhere
              titleRef={titleRef}
              values={values}
              errors={errors}
              incidentTypes={types}
              incidentTypesLoading={incidentTypesPending}
              campuses={activeCampuses}
              clusters={campusClusters}
              units={clusterUnits}
              pinLabel={typeName || 'Incident'}
              onFieldChange={setField}
              onLocationChange={setLocation}
              onOpenPrivacy={() => openDrawer('privacy')}
              onContinue={continueFromStepOne}
            />
          )}

          {step === 2 && (
            <StepPeopleDamage
              titleRef={titleRef}
              register={register}
              errors={errors}
              damageConditionId={values.damage_condition_id}
              onDamageChange={(value) => setField('damage_condition_id', value)}
              damageConditions={damageConditions.filter((d) => d.is_active)}
              campusName={campusName}
              categories={categories}
              categoriesLoading={categoriesLoading}
              counts={counts}
              onCountChange={(id, count) => setCounts((prev) => ({ ...prev, [id]: count }))}
              missingMeta={missingPersonsMeta(missingPersons)}
              casualtiesMeta={casualtiesMeta(casualties, conditionName)}
              hasMissing={missingPersons.length > 0}
              hasCasualties={casualties.length > 0}
              onOpenMissing={() => openDrawer('missing')}
              onOpenCasualties={() => openDrawer('casualty')}
              photos={photos}
              onAddPhotos={(added) => setPhotos((list) => [...list, ...added])}
              onRemovePhoto={removePhoto}
              onSkip={() => goTo(3)}
              onBack={() => goTo(1)}
              onContinue={continueFromStepTwo}
            />
          )}

          {step === 3 && (
            <StepReview
              titleRef={titleRef}
              register={register}
              contactError={errors.contact_number}
              isOnline={isOnline}
              isSending={isSending}
              summary={{
                incidentType: typeName,
                coordinates:
                  values.latitude !== null && values.longitude !== null
                    ? formatCoordinates(values.latitude, values.longitude)
                    : '',
                place: [campusName, clusterName, unitName].filter(Boolean).join(' · '),
                locationDescription: values.location_description.trim(),
                headcount: headcountSummary(
                  categories.map((c) => ({ name: c.name, count: counts[c.id] ?? 0 }))
                ),
                people: peopleSummary(missingPersons, casualties, conditionName),
                damage:
                  damageConditions.find((d) => d.id === values.damage_condition_id)?.name ?? null,
                description: values.description.trim(),
              }}
              photos={photos}
              onEdit={goTo}
              onOpenPrivacy={() => openDrawer('privacy')}
              onBack={() => goTo(2)}
            />
          )}
        </form>
      </PageCard>

      <PrivacyDrawer
        open={drawer === 'privacy'}
        onClose={() => setDrawer(null)}
        note="Bystander reports are anonymous. A contact number is optional and only shared if you add one."
      />
      <PeopleDrawer
        key={`missing-${drawerKey}`}
        kind="missing"
        open={drawer === 'missing'}
        onClose={() => setDrawer(null)}
        people={missingPersons}
        onSave={setMissingPersons}
        conditions={[]}
      />
      <PeopleDrawer
        key={`casualty-${drawerKey}`}
        kind="casualty"
        open={drawer === 'casualty'}
        onClose={() => setDrawer(null)}
        people={casualties}
        onSave={setCasualties}
        conditions={casualtyConditions.filter((c) => c.is_active)}
      />
    </>
  );
}
