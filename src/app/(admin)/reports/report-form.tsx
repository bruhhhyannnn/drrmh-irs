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
  const [casualtyModalOpen, setCasualtyModalOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      {!standalone && <PageBreadcrumb pageTitle={isEdit ? 'Edit Report' : 'Submit Report'} />}

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/5 dark:bg-white/3">
        {isEdit && isReportLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-7">
            {/* ── Reporting as ───────────────────────────── */}
            {userProfile && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reporting as</p>
                <div className="flex mt-2 items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/5 dark:bg-white/3">
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
  persons: MissingPersonRow[];
  onSave: (persons: MissingPersonRow[]) => void;
}

function PersonModal({ isOpen, onClose, persons, onSave }: PersonModalProps) {
  const [list, setList] = useState<MissingPersonRow[]>([]);
  const [draft, setDraft] = useState<MissingPersonRow>({ name: '', age: 0, sex: 'unknown' });

  useEffect(() => {
    if (isOpen) {
      setList(persons);
      setDraft({ name: '', age: 0, sex: 'unknown' });
    }
  }, [isOpen, persons]);

  const addPerson = () => {
    if (!draft.name.trim()) return;
    setList((l) => [...l, { ...draft }]);
    setDraft({ name: '', age: 0, sex: 'unknown' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        Missing Persons
      </h3>

      {list.length > 0 && (
        <div className="mb-4 max-h-52 space-y-2 overflow-y-auto">
          {list.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                  {p.name || <span className="italic text-gray-400">Unnamed</span>}
                </p>
                <p className="text-xs capitalize text-gray-400">
                  {p.sex} · {p.age} yrs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
                className="hover:text-error-500 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`space-y-3 ${list.length > 0 ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Add a person</p>
        <Input
          label="Full Name"
          placeholder="Full name"
          value={draft.name}
          onChange={(e) => setDraft((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            value={draft.age}
            onChange={(e) => setDraft((f) => ({ ...f, age: Number(e.target.value) || 0 }))}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={draft.sex}
            onChange={(e) =>
              setDraft((f) => ({ ...f, sex: e.target.value as MissingPersonRow['sex'] }))
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPerson}
          startIcon={<Plus size={13} />}
          className="w-full"
        >
          Add Person
        </Button>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(list);
            onClose();
          }}
        >
          Done{list.length > 0 && ` (${list.length})`}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Casualty Modal ───────────────────────────────────────────────────────────
interface CasualtyModalProps {
  isOpen: boolean;
  onClose: () => void;
  casualties: CasualtyRow[];
  conditionOptions: { value: string; label: string }[];
  onSave: (casualties: CasualtyRow[]) => void;
}

function CasualtyModal({
  isOpen,
  onClose,
  casualties,
  conditionOptions,
  onSave,
}: CasualtyModalProps) {
  const [list, setList] = useState<CasualtyRow[]>([]);
  const [draft, setDraft] = useState<CasualtyRow>({
    condition_id: '',
    name: '',
    age: 0,
    sex: 'unknown',
  });

  useEffect(() => {
    if (isOpen) {
      setList(casualties);
      setDraft({ condition_id: '', name: '', age: 0, sex: 'unknown' });
    }
  }, [isOpen, casualties]);

  const addCasualty = () => {
    if (!draft.condition_id || !draft.name.trim()) return;
    setList((l) => [...l, { ...draft }]);
    setDraft({ condition_id: '', name: '', age: 0, sex: 'unknown' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        Casualty Details
      </h3>

      {list.length > 0 && (
        <div className="mb-4 max-h-52 space-y-2 overflow-y-auto">
          {list.map((c, i) => {
            const condLabel = conditionOptions.find((o) => o.value === c.condition_id)?.label ?? '';
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {c.name || <span className="italic text-gray-400">Unnamed</span>}
                  </p>
                  <p className="text-xs capitalize text-gray-400">
                    {condLabel} · {c.sex} · {c.age} yrs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
                  className="hover:text-error-500 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`space-y-3 ${list.length > 0 ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Add a casualty</p>
        <Select
          label="Condition"
          placeholder="Select condition..."
          options={conditionOptions}
          value={draft.condition_id}
          onChange={(e) => setDraft((f) => ({ ...f, condition_id: e.target.value }))}
        />
        <Input
          label="Full Name"
          placeholder="Full name"
          value={draft.name}
          onChange={(e) => setDraft((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            value={draft.age}
            onChange={(e) => setDraft((f) => ({ ...f, age: Number(e.target.value) || 0 }))}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={draft.sex}
            onChange={(e) => setDraft((f) => ({ ...f, sex: e.target.value as CasualtyRow['sex'] }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCasualty}
          startIcon={<Plus size={13} />}
          className="w-full"
        >
          Add Casualty
        </Button>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(list);
            onClose();
          }}
        >
          Done{list.length > 0 && ` (${list.length})`}
        </Button>
      </div>
    </Modal>
  );
}
