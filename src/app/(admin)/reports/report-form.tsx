'use client';

import { upsertDamageCondition } from '@/actions/settings';
import { PageBreadcrumb } from '@/components/common';
import { useOngoingEvents } from '@/components/hooks/use-events';
import {
  useCreateReport,
  useCreateReportCasualty,
  useCreateReportMissingPerson,
  useDeleteReportCasualty,
  useDeleteReportMissingPerson,
  useReport,
  useReportCasualties,
  useReportMissingPersons,
  useUpdateReport,
} from '@/components/hooks/use-reports';
import {
  useCasualtyConditions,
  useClusters,
  useDamageConditions,
  useUnits,
} from '@/components/hooks/use-settings';
import {
  Button,
  Input,
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  Select,
  Spinner,
  useMap,
} from '@/components/ui';
import { HEADCOUNT_FIELDS, reportSchema, type ReportFormData } from '@/lib';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, UserRound, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  CasualtyModal,
  CasualtyRow,
  MissingPersonRow,
  PersonModal,
} from './missing-casualty-modals';

// ─── Main form ────────────────────────────────────────────────────────────────
interface ReportFormProps {
  editId?: string;
  eventId?: string;
  standalone?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReportForm({
  editId,
  eventId,
  standalone = false,
  onSuccess,
  onCancel,
}: ReportFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!editId;
  const { userProfile } = useAuthStore();

  // ─── Data fetching ───────────────────────────────────────────
  const { data: existingReport, isLoading: isReportLoading } = useReport(editId);
  const createReportMutation = useCreateReport();
  const updateReportMutation = useUpdateReport();

  const { data: ongoingEvents = [] } = useOngoingEvents();
  const { data: clusters = [] } = useClusters();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();

  const createCasualtyMutation = useCreateReportCasualty();
  const deleteCasualtyMutation = useDeleteReportCasualty();
  const createMissingPersonMutation = useCreateReportMissingPerson();
  const deleteMissingPersonMutation = useDeleteReportMissingPerson();

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const { data: units = [] } = useUnits(selectedClusterId || undefined);

  const { data: existingCasualties = [] } = useReportCasualties(editId);
  const { data: existingMissingPersons = [] } = useReportMissingPersons(editId);

  // ─── Location state ──────────────────────────────────────────
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);

  // ─── Location error ──────────────────────────────────────────
  const [locationError, setLocationError] = useState(false);

  // ─── Modal state ─────────────────────────────────────────────
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [casualtyModalOpen, setCasualtyModalOpen] = useState(false);

  // ─── Dynamic section state ───────────────────────────────────
  const [casualties, setCasualties] = useState<CasualtyRow[]>([]);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRow[]>([]);

  // ─── Structural damage — "Other" handling ────────────────────
  const OTHER_DAMAGE = '__other__';
  const [selectedDamageId, setSelectedDamageId] = useState('');
  const [customDamage, setCustomDamage] = useState('');
  const isOtherDamage = selectedDamageId === OTHER_DAMAGE;

  // ─── Main form ───────────────────────────────────────────────
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      event_id: eventId ?? '',
      faculty_members: 0,
      admin_members: 0,
      reps_members: 0,
      ra_members: 0,
      students: 0,
      philcare_staff: 0,
      security_personnel: 0,
      construction_workers: 0,
      tenants: 0,
      health_workers: 0,
      non_academic_staff: 0,
      guests: 0,
      damage_condition_id: '',
    },
  });

  // ─── Populate form on edit ───────────────────────────────────
  useEffect(() => {
    if (!existingReport) return;
    reset({
      event_id: existingReport.event_id,
      cluster_id: existingReport.cluster_id,
      unit_id: existingReport.unit_id ?? '',
      faculty_members: existingReport.faculty_members,
      admin_members: existingReport.admin_members,
      reps_members: existingReport.reps_members,
      ra_members: existingReport.ra_members,
      students: existingReport.students,
      philcare_staff: existingReport.philcare_staff,
      security_personnel: existingReport.security_personnel,
      construction_workers: existingReport.construction_workers,
      tenants: existingReport.tenants,
      health_workers: existingReport.health_workers,
      non_academic_staff: existingReport.non_academic_staff,
      guests: existingReport.guests,
      damage_condition_id: existingReport.damage_condition_id ?? '',
    });
    if (existingReport.cluster_id) setSelectedClusterId(existingReport.cluster_id);
    if (existingReport.damage_condition_id) setSelectedDamageId(existingReport.damage_condition_id);
    // Restore coordinates if they exist on the existing report
    const r = existingReport as typeof existingReport & {
      latitude?: number | null;
      longitude?: number | null;
      location_name?: string | null;
    };
    if (r.latitude != null) setPickedLat(Number(r.latitude));
    if (r.longitude != null) setPickedLng(Number(r.longitude));
    if (r.location_name) setPickedName(r.location_name);
  }, [existingReport, reset]);

  useEffect(() => {
    if (existingCasualties.length > 0) {
      setCasualties(
        existingCasualties.map((c) => ({
          id: c.id,
          condition_id: c.condition_id,
          name: c.name ?? '',
          age: c.age ?? 0,
          sex: (c.sex as 'male' | 'female' | 'unknown') ?? 'unknown',
        }))
      );
    }
  }, [existingCasualties]);

  useEffect(() => {
    if (existingMissingPersons.length > 0) {
      setMissingPersons(
        existingMissingPersons.map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age ?? 0,
          sex: (p.sex as 'male' | 'female' | 'unknown') ?? 'unknown',
        }))
      );
    }
  }, [existingMissingPersons]);

  // When the user has a cluster assigned on their profile, it's the source of truth for new reports.
  const profileClusterId = !isEdit
    ? (userProfile?.cluster_id ?? userProfile?.unit?.cluster_id ?? null)
    : null;
  const profileUnitId = !isEdit ? (userProfile?.unit?.id ?? null) : null;

  // ─── Auto-fill cluster/unit from user profile on new reports ──────
  useEffect(() => {
    if (!profileClusterId) return;
    setValue('cluster_id', profileClusterId);
    setSelectedClusterId(profileClusterId);
    if (profileUnitId) setValue('unit_id', profileUnitId);
  }, [profileClusterId, profileUnitId, setValue]);

  // ─── Submit ──────────────────────────────────────────────────
  const onSubmit = handleSubmit(async (data) => {
    if (pickedLat === null || pickedLng === null) {
      setLocationError(true);
      document
        .getElementById('location-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLocationError(false);
    try {
      // Resolve custom damage condition before saving
      if (isOtherDamage && customDamage.trim()) {
        const condition = await upsertDamageCondition(customDamage.trim());
        setValue('damage_condition_id', condition.id);
        data.damage_condition_id = condition.id;
      }

      let reportId: string;
      if (isEdit) {
        await updateReportMutation.mutateAsync({
          id: editId!,
          data: {
            event: { connect: { id: data.event_id } },
            cluster: { connect: { id: data.cluster_id } },
            unit: data.unit_id ? { connect: { id: data.unit_id } } : { disconnect: true },
            damage_conditions: data.damage_condition_id
              ? { connect: { id: data.damage_condition_id } }
              : { disconnect: true },
            latitude: pickedLat,
            longitude: pickedLng,
            location_name: pickedName,
            faculty_members: data.faculty_members,
            admin_members: data.admin_members,
            reps_members: data.reps_members,
            ra_members: data.ra_members,
            students: data.students,
            philcare_staff: data.philcare_staff,
            security_personnel: data.security_personnel,
            construction_workers: data.construction_workers,
            tenants: data.tenants,
            health_workers: data.health_workers,
            non_academic_staff: data.non_academic_staff,
            guests: data.guests,
          },
        });
        reportId = editId!;
      } else {
        const report = await createReportMutation.mutateAsync({
          ...data,
          cluster_id: profileClusterId ?? data.cluster_id,
          unit_id: profileUnitId ?? data.unit_id,
          user_id: userProfile?.id,
          latitude: pickedLat,
          longitude: pickedLng,
          location_name: pickedName,
          report_missing_persons: [],
          report_casualties: [],
        });
        reportId = report.id;
      }

      // Casualties — delete all existing, re-create current
      await Promise.all(
        existingCasualties.map((c) => deleteCasualtyMutation.mutateAsync({ id: c.id, reportId }))
      );
      await Promise.all(
        casualties
          .filter((c) => c.condition_id && c.name.trim())
          .map((c) =>
            createCasualtyMutation.mutateAsync({
              report_id: reportId,
              condition_id: c.condition_id,
              name: c.name.trim(),
              age: c.age,
              sex: c.sex,
            })
          )
      );

      // Missing persons — delete all existing, re-create current
      await Promise.all(
        existingMissingPersons.map((p) =>
          deleteMissingPersonMutation.mutateAsync({ id: p.id, reportId })
        )
      );
      await Promise.all(
        missingPersons
          .filter((p) => p.name.trim())
          .map((p) =>
            createMissingPersonMutation.mutateAsync({
              report_id: reportId,
              name: p.name.trim(),
              age: p.age,
              sex: p.sex,
            })
          )
      );

      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['report', editId] });
        queryClient.invalidateQueries({ queryKey: ['report-casualties', editId] });
        queryClient.invalidateQueries({ queryKey: ['report-missing-persons', editId] });
      }

      toast.success(isEdit ? 'Report updated' : 'Report submitted');
      onSuccess ? onSuccess() : router.push('/reports');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    }
  });

  // ─── Select options ──────────────────────────────────────────
  const eventOptions = ongoingEvents.map((e) => ({ value: e.id, label: e.name }));
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const casualtyConditionOptions = casualtyConditions.map((c) => ({ value: c.id, label: c.name }));
  const damageConditionOptions = [
    { value: '', label: 'None' },
    ...damageConditions.map((d) => ({ value: d.id, label: d.name })),
    { value: OTHER_DAMAGE, label: 'Other (please specify)' },
  ];

  return (
    <div className="space-y-6">
      {!standalone && <PageBreadcrumb pageTitle={isEdit ? 'Edit Report' : 'Submit Report'} />}

      {/* ── Form info header ───────────────────────────────── */}
      <div className="max-w-2xl space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-white/5 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Status Report for UPM-PGH NSED Q2 2026
        </h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          This form is intended to collect the status report for the UP Manila – Philippine General
          Hospital (UPM-PGH) participation in the 2nd Quarter 2026 Nationwide Simultaneous
          Earthquake Drill (NSED). Please provide accurate and complete information on the conduct
          of the drill, including participation, observations, issues encountered, and
          recommendations. The data will be consolidated for internal documentation and reporting to
          relevant authorities.
        </p>
        <div className="space-y-1 border-t border-gray-100 pt-3 dark:border-white/5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Data Privacy Notice:
          </p>
          <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-500">
            All information provided in this form will be collected and processed in accordance with
            the Data Privacy Act of 2012. The data will be used solely for documentation,
            evaluation, and reporting purposes related to the NSED. Any personal information
            collected will be kept confidential and will not be shared outside of authorized
            personnel without your consent.
          </p>
        </div>
      </div>

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/5 dark:bg-gray-900">
        {isEdit && isReportLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-7">
            {/* ── Event card ─────────────────────────────── */}
            <Select
              options={eventOptions}
              label="Reporting for"
              placeholder="Select event..."
              error={!!errors.event_id}
              hint={errors.event_id?.message}
              required
              disabled={!!eventId}
              value={watch('event_id') ?? ''}
              onChange={(e) => setValue('event_id', e.target.value)}
            />

            {/* ── Reporting as ───────────────────────────── */}
            {userProfile && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reporting as</p>
                <div className="flex mt-2 items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/5 dark:bg-gray-900">
                  <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
                    {(userProfile.first_name?.[0] ?? '') + (userProfile.last_name?.[0] ?? '')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                      {userProfile.first_name} {userProfile.last_name}
                    </p>
                    {userProfile.position && (
                      <p className="truncate text-xs text-gray-400">{userProfile.position.name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Cluster/unit selects — admin only (no profile cluster) ── */}
            {!profileClusterId && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Select
                  options={clusterOptions}
                  label="Cluster"
                  placeholder="Select cluster..."
                  error={!!errors.cluster_id}
                  hint={errors.cluster_id?.message}
                  value={watch('cluster_id') ?? ''}
                  required
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedClusterId(id);
                    setValue('cluster_id', id);
                    setValue('unit_id', '');
                  }}
                />
                <Select
                  options={unitOptions}
                  label="Unit"
                  placeholder="Select unit..."
                  value={watch('unit_id') ?? ''}
                  onChange={(e) => setValue('unit_id', e.target.value)}
                />
              </div>
            )}

            {/* ── Location map picker ─────────────────────── */}
            <div className="border-t border-gray-100 dark:border-white/5" />
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

            <div className="border-t border-gray-100 dark:border-white/5" />

            {/* ── Headcount ───────────────────────────────── */}
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Headcount</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {HEADCOUNT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Input
                      type="number"
                      label={field.label}
                      id={field.label}
                      min={0}
                      placeholder="0"
                      className="placeholder:text-gray-800 dark:placeholder:text-gray-200"
                      value={
                        (watch(field.key as keyof ReportFormData) as number) === 0
                          ? ''
                          : (watch(field.key as keyof ReportFormData) as number)
                      }
                      onKeyDown={(e) => {
                        if (e.key === '-') e.preventDefault();
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = val === '' ? 0 : parseInt(val, 10);
                        setValue(field.key as keyof ReportFormData, Math.max(0, parsed));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/5" />

            {/* ── Missing Persons ─────────────────────────── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Missing Persons
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPersonModalOpen(true)}
                  startIcon={
                    missingPersons.length === 0 ? <Plus size={13} /> : <Pencil size={13} />
                  }
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400">
                      <UserRound size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {missingPersons.length} missing{' '}
                        {missingPersons.length === 1 ? 'person' : 'persons'}
                      </p>
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
            </div>

            {/* ── Casualties ───────────────────────────────── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Casualty Details
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400">
                      <Users size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {casualties.length} {casualties.length === 1 ? 'casualty' : 'casualties'}
                      </p>
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
            </div>

            {/* ── Structural Damage ────────────────────────── */}
            <div className="space-y-3">
              <Select
                options={damageConditionOptions}
                label="Structural Damage"
                placeholder="Select damage type..."
                value={selectedDamageId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDamageId(val);
                  setCustomDamage('');
                  setValue('damage_condition_id', val === OTHER_DAMAGE ? '' : val);
                }}
              />
              {isOtherDamage && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Specify damage condition <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customDamage}
                    onChange={(e) => setCustomDamage(e.target.value)}
                    placeholder="e.g. Partial collapse"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
              )}
            </div>

            {/* ── Actions ──────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3">
              {!standalone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (onCancel ? onCancel() : router.push('/reports'))}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving...">
                {isEdit ? 'Update Report' : 'Submit Report'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
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
        conditionOptions={casualtyConditionOptions}
        onSave={(updated) => setCasualties(updated)}
      />
    </div>
  );
}

// ─── Map fly-to ───────────────────────────────────────────────────────────────
function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center: [lng, lat], zoom: 16, duration: 1200 });
  }, [map, isLoaded, lat, lng]);
  return null;
}

// ─── Map click handler ────────────────────────────────────────────────────────
function MapClickHandler({ onPick }: { onPick: (lng: number, lat: number) => void }) {
  const { map, isLoaded } = useMap();
  const cbRef = useRef(onPick);
  cbRef.current = onPick;

  useEffect(() => {
    if (!map || !isLoaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => cbRef.current(e.lngLat.lng, e.lngLat.lat);
    map.on('click', handler);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map, isLoaded]);

  return null;
}

// ─── Location picker sub-component ───────────────────────────────────────────
interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  error?: boolean;
  onPick: (lat: number, lng: number, name: string | null) => void;
  onClear: () => void;
}

function LocationPicker({ lat, lng, locationName, error, onPick, onClear }: LocationPickerProps) {
  const hasPin = lat !== null && lng !== null;
  const [showMap, setShowMap] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Keep a stable ref to onPick so the auto-trigger effect doesn't go stale
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Auto-request geolocation on mount for new reports (no existing coordinates)
  useEffect(() => {
    if (lat !== null || lng !== null) return; // edit mode with existing pin — skip
    if (!navigator.geolocation) return;
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onPickRef.current(latitude, longitude, null);
        setIsGettingLocation(false);
        setIsGeocoding(true);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const json = await res.json();
          onPickRef.current(latitude, longitude, json.display_name ?? null);
        } catch {
          // non-fatal
        } finally {
          setIsGeocoding(false);
        }
      },
      (err) => {
        setIsGettingLocation(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied. Place the pin manually on the map.'
            : 'Could not get your location. Place the pin manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const reverseGeocode = async (pickedLat: number, pickedLng: number) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pickedLat}&lon=${pickedLng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const json = await res.json();
      onPick(pickedLat, pickedLng, json.display_name ?? null);
    } catch {
      // non-fatal — coordinates already saved
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleMapClick = async (pickedLng: number, pickedLat: number) => {
    onPick(pickedLat, pickedLng, null);
    await reverseGeocode(pickedLat, pickedLng);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setIsGettingLocation(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setShowMap(true);
        onPick(latitude, longitude, null);
        setIsGettingLocation(false);
        await reverseGeocode(latitude, longitude);
      },
      (err) => {
        setIsGettingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location access denied. Place the pin manually on the map.');
        } else {
          setGeoError('Could not get your location. Place the pin manually.');
        }
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClear = () => {
    onClear();
    setShowMap(false);
    setGeoError(null);
  };

  const center: [number, number] = hasPin ? [lng!, lat!] : [120.9842, 14.5995];
  const zoom = hasPin ? 16 : 12;

  return (
    <div id="location-section" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Location <span className="text-error-500">*</span>
        </p>
        {showMap && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {!showMap ? (
        <div
          className={`flex flex-col gap-2 rounded-xl border border-dashed p-4 ${error ? 'border-error-400 bg-error-50 dark:border-error-500/50 dark:bg-error-500/5' : 'border-gray-200 dark:border-white/10'}`}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            isLoading={isGettingLocation}
            loadingText="Getting location…"
            startIcon={!isGettingLocation ? <MapPin size={14} /> : undefined}
          >
            Use My Current Location
          </Button>
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="text-center text-xs text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
          >
            or place pin manually on map
          </button>
          {geoError && <p className="text-xs text-error-500">{geoError}</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div
            className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10"
            style={{ height: 260 }}
          >
            <Map center={center} zoom={zoom}>
              <MapControls showZoom position="top-right" />
              <MapClickHandler onPick={handleMapClick} />
              {hasPin && <MapFlyTo lat={lat!} lng={lng!} />}
              {hasPin && (
                <MapMarker
                  longitude={lng!}
                  latitude={lat!}
                  draggable
                  onDragEnd={({ lng: dLng, lat: dLat }: { lng: number; lat: number }) =>
                    handleMapClick(dLng, dLat)
                  }
                >
                  <MarkerContent>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-500 shadow-lg">
                      <MapPin size={14} className="text-white" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              )}
            </Map>
          </div>

          {hasPin ? (
            <div className="space-y-0.5">
              {isGeocoding && <p className="text-xs text-gray-400">Fetching address…</p>}
              {locationName && (
                <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                  {locationName}
                </p>
              )}
            </div>
          ) : isGettingLocation ? (
            <p className="text-xs text-gray-400">Getting your location…</p>
          ) : (
            <p className="text-xs text-gray-400">Click anywhere on the map to place a pin</p>
          )}
        </div>
      )}

      {error && !hasPin && (
        <p className="text-xs text-error-500">
          Location is required. Please allow location access or place a pin on the map.
        </p>
      )}
    </div>
  );
}
