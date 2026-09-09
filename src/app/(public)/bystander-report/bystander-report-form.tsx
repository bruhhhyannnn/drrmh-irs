'use client';

import {
  useCreateBystanderReport,
  useGetBystanderIncidentTypes,
} from '@/app/(admin)/emergency-reports/use-bystander-reports';
import {
  CasualtyModal,
  CasualtyRow,
  MissingPersonRow,
  PersonModal,
} from '@/app/(admin)/reports/missing-casualty-modals';
import { LocationPicker } from '@/app/(admin)/reports/report-form';
import { DataPrivacyNotice } from '@/components/common';
import {
  useCasualtyConditions,
  useClusters,
  useDamageConditions,
  useUnits,
} from '@/components/hooks/use-settings';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { BystanderReportFormData, cn } from '@/lib';
import { CheckCircle, Pencil, Plus, UserRound, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

// ─── Main component ───────────────────────────────────────────────────────────

export function BystanderReportForm() {
  const router = useRouter();
  const submitReport = useCreateBystanderReport();

  const { data: incidentTypes = [] } = useGetBystanderIncidentTypes();
  const { data: clusters = [] } = useClusters();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // ── Location state ──────────────────────────────────────────
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);

  // ── Missing persons / casualties ────────────────────────────
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [casualtyModalOpen, setCasualtyModalOpen] = useState(false);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRow[]>([]);
  const [casualties, setCasualties] = useState<CasualtyRow[]>([]);

  const { data: units = [] } = useUnits(selectedClusterId || undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<BystanderReportFormData>();

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = handleSubmit(async (values) => {
    if (pickedLat === null || pickedLng === null) {
      setLocationError(true);
      document
        .getElementById('location-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLocationError(false);

    await submitReport.mutateAsync({
      ...values,
      latitude: pickedLat,
      longitude: pickedLng,
      report_missing_persons: missingPersons.filter((p) => p.name.trim()),
      report_casualties: casualties.filter((c) => c.condition_id && c.name.trim()),
    });

    setSubmitted(true);
  });

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

      {/* ── Form info header ───────────────────────────────── */}
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-white/5 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Bystander Emergency Report
        </h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Use this form to report an emergency or incident you have witnessed on campus. Please
          provide as much accurate information as possible — including location, affected people,
          and any structural damage — so the DRRM-H Emergency Response Team can respond
          appropriately.
        </p>
        <DataPrivacyNotice summary="This submission is anonymous — your identity will not be collected or stored. Any information provided will be used solely for emergency response and internal documentation purposes. For life-threatening emergencies, call 911 immediately." />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* ── Incident Type ───────────────────────────────────────────────── */}
        <SectionCard title="Incident" accent>
          <Controller
            control={control}
            name="incident_type_id"
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                options={incidentTypeOptions}
                label="Incident Type"
                required
                placeholder="What type of emergency is this?"
                error={!watch('incident_type_id') && isSubmitting}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </SectionCard>

        {/* ── Location ────────────────────────────────────────────────────── */}
        <SectionCard title="Location *">
          <LocationPicker
            lat={pickedLat}
            lng={pickedLng}
            locationName={pickedName}
            error={locationError}
            onPick={(lat, lng, name) => {
              setPickedLat(lat);
              setPickedLng(lng);
              setPickedName(name);
              setLocationError(false);
            }}
            onClear={() => {
              setPickedLat(null);
              setPickedLng(null);
              setPickedName(null);
            }}
          />
        </SectionCard>

        {/* ── Cluster & Unit ───────────────────────────────────────────────── */}
        <SectionCard title="Cluster / Unit *">
          <div className="space-y-4">
            <Controller
              control={control}
              name="cluster_id"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  label="Cluster"
                  required
                  options={clusterOptions}
                  placeholder="Select cluster"
                  error={!watch('cluster_id') && isSubmitting}
                  value={field.value}
                  onChange={(value) => {
                    setSelectedClusterId(value);
                    field.onChange(value);
                    setValue('unit_id', '');
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="unit_id"
              render={({ field }) => (
                <Select
                  label="Unit (optional)"
                  options={unitOptions}
                  placeholder={selectedClusterId ? 'Select unit' : 'Select cluster first'}
                  disabled={!selectedClusterId}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </SectionCard>

        {/* ── Additional Details ──────────────────────────────────────────── */}
        <SectionCard title="Additional Details">
          <div className="space-y-4">
            <Input
              label="Location Description (optional)"
              id="Location Description (optional)"
              placeholder="e.g. Near the main gate, beside the flagpole"
              {...register('location_description')}
            />
            <div>
              <p className="mb-1.5 block text-sm font-medium text-gray-500 dark:text-gray-400">
                Description (optional)
              </p>
              <Textarea
                placeholder="Briefly describe what happened..."
                rows={4}
                {...register('description')}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Missing Persons ──────────────────────────────────────────────── */}
        <SectionCard title="Missing Persons">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {missingPersons.length === 0
                ? 'No missing persons added'
                : `${missingPersons.length} missing ${missingPersons.length === 1 ? 'person' : 'persons'}`}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPersonModalOpen(true)}
              startIcon={missingPersons.length === 0 ? <Plus size={13} /> : <Pencil size={13} />}
            >
              {missingPersons.length === 0 ? 'Add' : 'Manage'}
            </Button>
          </div>

          {missingPersons.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
              <UserRound size={16} className="shrink-0 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400">No missing persons added</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPersonModalOpen(true)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/3"
            >
              <div className="flex items-center gap-3">
                <div className="bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <UserRound size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-gray-400">
                    {missingPersons
                      .slice(0, 2)
                      .map((p) => p.name || 'Unnamed')
                      .join(', ')}
                    {missingPersons.length > 2 && ` +${missingPersons.length - 2} more`}
                  </p>
                </div>
              </div>
            </button>
          )}
        </SectionCard>

        {/* ── Casualties ───────────────────────────────────────────────────── */}
        <SectionCard title="Casualties">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {casualties.length === 0
                ? 'No casualty details added'
                : `${casualties.length} ${casualties.length === 1 ? 'casualty' : 'casualties'}`}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCasualtyModalOpen(true)}
              startIcon={casualties.length === 0 ? <Plus size={13} /> : <Pencil size={13} />}
            >
              {casualties.length === 0 ? 'Add' : 'Manage'}
            </Button>
          </div>

          {casualties.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
              <Users size={16} className="shrink-0 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400">No casualty details added</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCasualtyModalOpen(true)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/3"
            >
              <div className="flex items-center gap-3">
                <div className="bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-gray-400">
                    {casualties
                      .slice(0, 2)
                      .map((c) => c.name || 'Unnamed')
                      .join(', ')}
                    {casualties.length > 2 && ` +${casualties.length - 2} more`}
                  </p>
                </div>
              </div>
            </button>
          )}
        </SectionCard>

        {/* ── Structural Damage ────────────────────────────────────────────── */}
        <SectionCard title="Structural Damage">
          <Controller
            control={control}
            name="damage_condition_id"
            render={({ field }) => (
              <Select
                options={damageOptions}
                placeholder="Select damage type"
                value={field.value}
                onChange={field.onChange}
              />
            )}
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

      <PersonModal
        isOpen={personModalOpen}
        onClose={() => setPersonModalOpen(false)}
        persons={missingPersons}
        onSave={(updated) => setMissingPersons(updated)}
      />
      <CasualtyModal
        isOpen={casualtyModalOpen}
        onClose={() => setCasualtyModalOpen(false)}
        casualties={casualties}
        conditionOptions={conditionOptions}
        onSave={(updated) => setCasualties(updated)}
      />
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
