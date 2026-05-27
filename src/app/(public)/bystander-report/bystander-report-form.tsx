'use client';

import {
  useCreateBystanderReport,
  useGetBystanderIncidentTypes,
} from '@/app/(admin)/emergency-reports/use-bystander-reports';
import {
  useCasualtyConditions,
  useClusters,
  useDamageConditions,
  useUnits,
} from '@/app/(admin)/settings/use-settings';
import { Button, Input, Label, Select } from '@/components/ui';
import { BystanderReportFormData, cn } from '@/lib';
import { CheckCircle, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

// ─── Types ────────────────────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function BystanderReportForm() {
  const router = useRouter();
  const submitReport = useCreateBystanderReport();

  const { data: incidentTypes = [] } = useGetBystanderIncidentTypes();
  const { data: clusters = [] } = useClusters();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: units = [] } = useUnits(selectedClusterId || undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<BystanderReportFormData>({
    defaultValues: {
      incident_type_id: '',
      cluster_id: '',
      report_missing_persons: [],
      report_casualties: [],
    },
  });

  const {
    fields: missingFields,
    append: appendMissing,
    remove: removeMissing,
  } = useFieldArray({ control, name: 'report_missing_persons' });

  const {
    fields: casualtyFields,
    append: appendCasualty,
    remove: removeCasualty,
  } = useFieldArray({ control, name: 'report_casualties' });

  // ── GPS ───────────────────────────────────────────────────────────────────

  const handleGetLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        setValue('latitude', latitude);
        setValue('longitude', longitude);
        setLocating(false);
      },
      () => {
        setLocationError(
          'Could not get your location. Please allow location access and try again.'
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: BystanderReportFormData) => {
    if (!coords) {
      setLocationError('Please capture your location before submitting.');
      return;
    }

    await submitReport.mutateAsync({
      ...values,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    setSubmitted(true);
  };

  // ── Options ───────────────────────────────────────────────────────────────

  const incidentTypeOptions = incidentTypes.map((t) => ({ value: t.id, label: t.name }));
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const conditionOptions = casualtyConditions.map((c) => ({ value: c.id, label: c.name }));
  const damageOptions = damageConditions.map((d) => ({ value: d.id, label: d.name }));

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
          <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Received</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Thank you. Your report has been received and will be reviewed by the DRRM-H Emergency
            Response Team.
          </p>
        </div>
        <button
          onClick={() => router.push('/signin')}
          className="text-sm text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200"
        >
          Back to home
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report an Emergency</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Anonymous bystander submission
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/40">
        <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Anonymous submission.</span> Your identity will not be
          stored. For life-threatening emergencies, call <span className="font-semibold">911</span>{' '}
          immediately.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ── Incident Type ───────────────────────────────────────────────── */}
        <SectionCard title="Incident Type *" accent>
          <Select
            options={incidentTypeOptions}
            placeholder="What type of emergency is this?"
            error={!watch('incident_type_id') && isSubmitting}
            {...register('incident_type_id', { required: true })}
          />
        </SectionCard>

        {/* ── Location ────────────────────────────────────────────────────── */}
        <SectionCard title="Your Location *">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={locating}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200',
              coords
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400',
              locating && 'cursor-not-allowed opacity-60'
            )}
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            {locating
              ? 'Getting your location...'
              : coords
                ? 'Location captured — click to update'
                : 'Get My Location'}
          </button>

          {coords && (
            <div className="mt-3 rounded-lg bg-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <span>Lat: {coords.latitude.toFixed(6)}</span>
              <span className="ml-4">Lng: {coords.longitude.toFixed(6)}</span>
            </div>
          )}

          {locationError && <p className="mt-2 text-xs text-red-500">{locationError}</p>}
        </SectionCard>

        {/* ── Cluster & Unit ───────────────────────────────────────────────── */}
        <SectionCard title="Cluster / Unit *">
          <div className="space-y-4">
            <div>
              <Label required>Cluster</Label>
              <Select
                options={clusterOptions}
                placeholder="Select cluster"
                error={!watch('cluster_id') && isSubmitting}
                {...register('cluster_id', { required: true })}
                onChange={(e) => {
                  setSelectedClusterId(e.target.value);
                  setValue('cluster_id', e.target.value);
                  setValue('unit_id', '');
                }}
              />
            </div>

            <div>
              <Label>Unit (optional)</Label>
              <Select
                options={unitOptions}
                placeholder={selectedClusterId ? 'Select unit' : 'Select cluster first'}
                disabled={!selectedClusterId}
                {...register('unit_id')}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Missing Persons ──────────────────────────────────────────────── */}
        <SectionCard title="Missing Persons">
          <div className="space-y-3">
            {missingFields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Person {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMissing(index)}
                    className="text-gray-400 transition hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <Label>Full Name</Label>
                  <Input
                    placeholder="e.g. Juan dela Cruz"
                    {...register(`report_missing_persons.${index}.name`)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Age</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 32"
                      min={0}
                      max={120}
                      {...register(`report_missing_persons.${index}.age`)}
                    />
                  </div>
                  <div>
                    <Label>Sex</Label>
                    <Select
                      options={SEX_OPTIONS}
                      placeholder="Select"
                      {...register(`report_missing_persons.${index}.sex`)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => appendMissing({ name: '', age: 0, sex: 'unknown' })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:text-gray-300"
            >
              <Plus size={14} />
              Add Missing Person
            </button>
          </div>
        </SectionCard>

        {/* ── Casualties ───────────────────────────────────────────────────── */}
        <SectionCard title="Casualties">
          <div className="space-y-3">
            {casualtyFields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Casualty {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCasualty(index)}
                    className="text-gray-400 transition hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <Label>Condition</Label>
                  <Select
                    options={conditionOptions}
                    placeholder="Select condition"
                    {...register(`report_casualties.${index}.condition_id`)}
                  />
                </div>

                <div>
                  <Label>Names (optional)</Label>
                  <Input
                    placeholder="e.g. Maria Santos, Pedro Reyes"
                    {...register(`report_casualties.${index}.names`)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Count</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      min={1}
                      {...register(`report_casualties.${index}.count`)}
                    />
                  </div>
                  <div>
                    <Label>Age</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 45"
                      min={0}
                      max={120}
                      {...register(`report_casualties.${index}.age`)}
                    />
                  </div>
                  <div>
                    <Label>Sex</Label>
                    <Select
                      options={SEX_OPTIONS}
                      placeholder="Select"
                      {...register(`report_casualties.${index}.sex`)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                appendCasualty({ condition_id: '', count: 0, names: '', age: 0, sex: 'unknown' })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:text-gray-300"
            >
              <Plus size={14} />
              Add Casualty
            </button>
          </div>
        </SectionCard>

        {/* ── Structural Damage ────────────────────────────────────────────── */}
        <SectionCard title="Structural Damage">
          <Select
            options={damageOptions}
            placeholder="Select damage type"
            {...register('damage_condition_id')}
          />
        </SectionCard>

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <Button
          type="submit"
          className="w-full"
          isLoading={isSubmitting || submitReport.isPending}
          loadingText="Submitting..."
        >
          Submit Emergency Report
        </Button>
      </form>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 shadow-sm',
        accent
          ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      )}
    >
      <h3
        className={cn(
          'mb-4 text-sm font-semibold',
          accent ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
        )}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
