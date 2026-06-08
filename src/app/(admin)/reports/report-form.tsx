'use client';

import { useOngoingEvents } from '@/app/(admin)/events/use-events';
import {
  useCasualtyConditions,
  useClusters,
  useDamageConditions,
  useUnits,
} from '@/app/(admin)/settings/use-settings';
import { PageBreadcrumb } from '@/components/common';
import {
  Button,
  Input,
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  Modal,
  Select,
  Spinner,
  useMap,
} from '@/components/ui';
import {
  reportSchema,
  type CasualtyFormData,
  type MissingPersonFormData,
  type ReportFormData,
} from '@/lib';
import { useAuthStore } from '@/store';
import { HEADCOUNT_FIELDS } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
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
} from './use-reports';

// ─── Types ────────────────────────────────────────────────────────────────────
type CasualtyRow = CasualtyFormData & { id?: string };
type MissingPersonRow = MissingPersonFormData & { id?: string };

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

  const { data: events = [] } = useOngoingEvents();
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

  // ─── Modal state ─────────────────────────────────────────────
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPersonIdx, setEditingPersonIdx] = useState<number | null>(null);
  const [casualtyModalOpen, setCasualtyModalOpen] = useState(false);
  const [editingCasualtyIdx, setEditingCasualtyIdx] = useState<number | null>(null);

  // ─── Dynamic section state ───────────────────────────────────
  const [casualties, setCasualties] = useState<CasualtyRow[]>([]);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRow[]>([]);

  // ─── Main form ───────────────────────────────────────────────
  const {
    register,
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

  // ─── Submit ──────────────────────────────────────────────────
  const onSubmit = handleSubmit(async (data) => {
    try {
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
  const eventOptions = events.map((e) => ({ value: e.id, label: e.name }));
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const casualtyConditionOptions = casualtyConditions.map((c) => ({ value: c.id, label: c.name }));
  const damageConditionOptions = [
    { value: '', label: 'None' },
    ...damageConditions.map((d) => ({ value: d.id, label: d.name })),
  ];

  const editingPerson = editingPersonIdx !== null ? missingPersons[editingPersonIdx] : undefined;
  const editingCasualty = editingCasualtyIdx !== null ? casualties[editingCasualtyIdx] : undefined;

  return (
    <div className="space-y-6">
      {!standalone && <PageBreadcrumb pageTitle={isEdit ? 'Edit Report' : 'Submit Report'} />}

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/5 dark:bg-white/3">
        {isEdit && isReportLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-7">
            {/* ── Submitting as ──────────────────────────── */}
            {userProfile && (
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/5 dark:bg-white/3">
                <div className="bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
                  {(userProfile.first_name?.[0] ?? '') + (userProfile.last_name?.[0] ?? '')}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {userProfile.first_name} {userProfile.last_name}
                  </p>
                  {userProfile.unit && (
                    <p className="truncate text-xs text-gray-400">{userProfile.unit.name}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Context ────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Select
                  options={eventOptions}
                  label="Event"
                  placeholder="Select event..."
                  error={!!errors.event_id}
                  hint={errors.event_id?.message}
                  disabled={!!eventId}
                  required
                  value={watch('event_id') ?? ''}
                  onChange={(e) => setValue('event_id', e.target.value)}
                />
              </div>
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

            {/* ── Location map picker ─────────────────────── */}
            <div className="border-t border-gray-100 dark:border-white/5" />
            <LocationPicker
              lat={pickedLat}
              lng={pickedLng}
              locationName={pickedName}
              onPick={(lat, lng, name) => {
                setPickedLat(lat);
                setPickedLng(lng);
                setPickedName(name);
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
                      {...register(field.key as keyof ReportFormData)}
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
                  {missingPersons.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-normal text-warning-700 dark:bg-warning-900/30 dark:text-warning-400">
                      {missingPersons.length}
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPersonIdx(null);
                    setPersonModalOpen(true);
                  }}
                  startIcon={<Plus size={13} />}
                >
                  Add Person
                </Button>
              </div>

              {missingPersons.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
                  <UserRound size={16} className="shrink-0 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">No missing persons added</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {missingPersons.map((person, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                          {person.name || <span className="text-gray-400 italic">Unnamed</span>}
                        </p>
                        <p className="text-xs capitalize text-gray-400">
                          {person.sex} · {person.age} yrs
                        </p>
                      </div>
                      <div className="ml-2 flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPersonIdx(i);
                            setPersonModalOpen(true);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMissingPersons((p) => p.filter((_, idx) => idx !== i))}
                          className="hover:text-error-500 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Casualties ───────────────────────────────── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Casualty Details
                  {casualties.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-error-100 px-2 py-0.5 text-xs font-normal text-error-700 dark:bg-error-900/30 dark:text-error-400">
                      {casualties.length}
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCasualtyIdx(null);
                    setCasualtyModalOpen(true);
                  }}
                  startIcon={<Plus size={13} />}
                >
                  Add Casualty
                </Button>
              </div>

              {casualties.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
                  <Users size={16} className="shrink-0 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400">No casualty details added</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {casualties.map((c, i) => {
                    const condLabel =
                      casualtyConditionOptions.find((o) => o.value === c.condition_id)?.label ?? '';
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {c.name || <span className="text-gray-400 italic">Unnamed</span>}
                          </p>
                          <p className="text-xs capitalize text-gray-400">
                            {condLabel} · {c.sex} · {c.age} yrs
                          </p>
                        </div>
                        <div className="ml-2 flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCasualtyIdx(i);
                              setCasualtyModalOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCasualties((p) => p.filter((_, idx) => idx !== i))}
                            className="hover:text-error-500 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Structural Damage ────────────────────────── */}
            <div>
              <Select
                options={damageConditionOptions}
                label="Structural Damage"
                placeholder="Select damage type..."
                value={watch('damage_condition_id') ?? ''}
                onChange={(e) => setValue('damage_condition_id', e.target.value)}
              />
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
        initial={editingPerson}
        onSave={(data) => {
          if (editingPersonIdx !== null) {
            setMissingPersons((p) =>
              p.map((item, idx) => (idx === editingPersonIdx ? { ...item, ...data } : item))
            );
          } else {
            setMissingPersons((p) => [...p, data]);
          }
          setEditingPersonIdx(null);
        }}
      />
      <CasualtyModal
        isOpen={casualtyModalOpen}
        onClose={() => setCasualtyModalOpen(false)}
        initial={editingCasualty}
        conditionOptions={casualtyConditionOptions}
        onSave={(data) => {
          if (editingCasualtyIdx !== null) {
            setCasualties((p) =>
              p.map((item, idx) => (idx === editingCasualtyIdx ? { ...item, ...data } : item))
            );
          } else {
            setCasualties((p) => [...p, data]);
          }
          setEditingCasualtyIdx(null);
        }}
      />
    </div>
  );
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
  onPick: (lat: number, lng: number, name: string | null) => void;
  onClear: () => void;
}

function LocationPicker({ lat, lng, locationName, onPick, onClear }: LocationPickerProps) {
  const hasPin = lat !== null && lng !== null;
  const [showMap, setShowMap] = useState(hasPin);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // If an existing report loads with coordinates, show the map immediately
  useEffect(() => {
    if (hasPin) setShowMap(true);
  }, [hasPin]);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</p>
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
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-200 p-4 dark:border-white/10">
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
              <p className="font-mono text-xs text-gray-500">
                {lat!.toFixed(6)}, {lng!.toFixed(6)}
                {isGeocoding && <span className="ml-2 text-gray-400">fetching address…</span>}
              </p>
              {locationName && (
                <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                  {locationName}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Click anywhere on the map to place a pin</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Missing Person Modal ─────────────────────────────────────────────────────
interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial?: MissingPersonRow;
  onSave: (data: MissingPersonRow) => void;
}

function PersonModal({ isOpen, onClose, initial, onSave }: PersonModalProps) {
  const [form, setForm] = useState<MissingPersonRow>(
    initial ?? { name: '', age: 0, sex: 'unknown' }
  );

  useEffect(() => {
    if (isOpen) setForm(initial ?? { name: '', age: 0, sex: 'unknown' });
  }, [isOpen, initial]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        {initial ? 'Edit Missing Person' : 'Add Missing Person'}
      </h3>
      <div className="space-y-3">
        <Input
          label="Full Name"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) || 0 }))}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={form.sex}
            onChange={(e) =>
              setForm((f) => ({ ...f, sex: e.target.value as MissingPersonRow['sex'] }))
            }
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!form.name.trim()) return;
              onSave(form);
              onClose();
            }}
          >
            {initial ? 'Update' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Casualty Modal ───────────────────────────────────────────────────────────
interface CasualtyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial?: CasualtyRow;
  conditionOptions: { value: string; label: string }[];
  onSave: (data: CasualtyRow) => void;
}

function CasualtyModal({ isOpen, onClose, initial, conditionOptions, onSave }: CasualtyModalProps) {
  const [form, setForm] = useState<CasualtyRow>(
    initial ?? { condition_id: '', name: '', age: 0, sex: 'unknown' }
  );

  useEffect(() => {
    if (isOpen) setForm(initial ?? { condition_id: '', name: '', age: 0, sex: 'unknown' });
  }, [isOpen, initial]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        {initial ? 'Edit Casualty' : 'Add Casualty'}
      </h3>
      <div className="space-y-3">
        <Select
          label="Condition"
          placeholder="Select condition..."
          options={conditionOptions}
          value={form.condition_id}
          onChange={(e) => setForm((f) => ({ ...f, condition_id: e.target.value }))}
        />
        <Input
          label="Full Name"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) || 0 }))}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={form.sex}
            onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value as CasualtyRow['sex'] }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!form.condition_id || !form.name.trim()) return;
              onSave(form);
              onClose();
            }}
          >
            {initial ? 'Update' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
