'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useReport,
  useEvents,
  useClusters,
  useUnits,
  useLocations,
  useCasualtyConditions,
  useDamageConditions,
  useReportCasualties,
  useReportMissingPersons,
  useReportDamages,
  useOngoingEvents,
} from '@/hooks';
import { reportSchema, type ReportFormData } from '@/lib';
import { useAuthStore } from '@/store';
import { HEADCOUNT_FIELDS } from '@/types';
import { PageBreadcrumb } from '@/components/common';
import { Input, Label, Select, Button, Spinner } from '@/components/ui';
import { createReport, updateReport } from '@/actions/reports';
import { upsertReportCasualty, deleteReportCasualty } from '@/actions/report-casualties';
import {
  createReportMissingPerson,
  deleteReportMissingPerson,
} from '@/actions/report-missing-persons';
import { toggleReportDamage, deleteReportDamage } from '@/actions/report-damages';
import toast from 'react-hot-toast';

type CasualtyRow = { id?: string; condition_id: string; count: number; names: string };
type MissingPersonRow = { id?: string; name: string };

interface ReportFormProps {
  editId?: string;
  eventId?: string;
  isBystander?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReportForm({ editId, eventId, isBystander, onSuccess, onCancel }: ReportFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!editId;
  const userId = useAuthStore((s) => s.userProfile?.id);

  // ─── Main report data ───────────────────────────────────────
  const { data: existingReport, isLoading: isReportLoading } = useReport(editId);

  // ─── Dropdown options ───────────────────────────────────────
  const { data: allEvents = [] } = useEvents();
  const { data: ongoingEvents = [] } = useOngoingEvents();

  const events = isBystander ? ongoingEvents : allEvents;

  const { data: clusters = [] } = useClusters();
  const { data: casualtyConditions = [] } = useCasualtyConditions();
  const { data: damageConditions = [] } = useDamageConditions();

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const { data: units = [] } = useUnits(selectedClusterId || undefined);
  const { data: locations = [] } = useLocations(selectedClusterId || undefined);

  // ─── Related records (edit only) ────────────────────────────
  const { data: existingCasualties = [] } = useReportCasualties(editId);
  const { data: existingMissingPersons = [] } = useReportMissingPersons(editId);
  const { data: existingDamages = [] } = useReportDamages(editId);

  // ─── Dynamic section state ───────────────────────────────────
  const [casualties, setCasualties] = useState<CasualtyRow[]>([]);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRow[]>([]);
  const [selectedDamageIds, setSelectedDamageIds] = useState<Set<string>>(new Set());

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
      missing_count: 0,
      casualties_count: 0,
    },
  });

  // ─── Populate form on edit ───────────────────────────────────
  useEffect(() => {
    if (!existingReport) return;
    reset({
      event_id: existingReport.event_id,
      cluster_id: existingReport.cluster_id,
      unit_id: existingReport.unit_id ?? '',
      location_id: existingReport.location_id ?? '',
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
      missing_count: existingReport.missing_count,
      casualties_count: existingReport.casualties_count,
    });
    if (existingReport.cluster_id) setSelectedClusterId(existingReport.cluster_id);
  }, [existingReport, reset]);

  useEffect(() => {
    if (existingCasualties.length > 0) {
      setCasualties(
        existingCasualties.map((c) => ({
          id: c.id,
          condition_id: c.condition_id,
          count: c.count,
          names: c.names ?? '',
        }))
      );
    }
  }, [existingCasualties]);

  useEffect(() => {
    if (existingMissingPersons.length > 0) {
      setMissingPersons(existingMissingPersons.map((p) => ({ id: p.id, name: p.name })));
    }
  }, [existingMissingPersons]);

  useEffect(() => {
    if (existingDamages.length > 0) {
      setSelectedDamageIds(new Set(existingDamages.map((d) => d.damage_condition_id)));
    }
  }, [existingDamages]);

  // ─── Missing persons helpers ─────────────────────────────────
  const addMissingPerson = () => setMissingPersons((p) => [...p, { name: '' }]);
  const removeMissingPerson = (i: number) =>
    setMissingPersons((p) => p.filter((_, idx) => idx !== i));
  const updateMissingPerson = (i: number, name: string) =>
    setMissingPersons((p) => p.map((item, idx) => (idx === i ? { ...item, name } : item)));

  // ─── Casualties helpers ──────────────────────────────────────
  const addCasualty = () => setCasualties((p) => [...p, { condition_id: '', count: 1, names: '' }]);
  const removeCasualty = (i: number) => setCasualties((p) => p.filter((_, idx) => idx !== i));
  const updateCasualty = (i: number, patch: Partial<CasualtyRow>) =>
    setCasualties((p) => p.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  // ─── Damage helpers ──────────────────────────────────────────
  const toggleDamage = (id: string) =>
    setSelectedDamageIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ─── Submit ──────────────────────────────────────────────────
  const onSubmit = handleSubmit(async (data) => {
    const headcounts = {
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
      missing_count: data.missing_count,
      casualties_count: data.casualties_count,
    };

    try {
      // 1. Save main report
      let reportId: string;
      if (isEdit) {
        await updateReport(editId!, {
          event: { connect: { id: data.event_id } },
          cluster: { connect: { id: data.cluster_id } },
          unit: data.unit_id ? { connect: { id: data.unit_id } } : { disconnect: true },
          location: data.location_id ? { connect: { id: data.location_id } } : { disconnect: true },
          ...headcounts,
        });
        reportId = editId!;
      } else {
        const report = await createReport({
          event: { connect: { id: data.event_id } },
          cluster: { connect: { id: data.cluster_id } },
          ...(data.unit_id && { unit: { connect: { id: data.unit_id } } }),
          ...(data.location_id && { location: { connect: { id: data.location_id } } }),
          ...(userId && { user: { connect: { id: userId } } }),
          is_verified: !isBystander,
          ...headcounts,
        });
        reportId = report.id;
      }

      // 2. Save casualties — upsert all current, delete removed
      const currentConditionIds = new Set(casualties.map((c) => c.condition_id));
      await Promise.all(
        casualties
          .filter((c) => c.condition_id)
          .map((c) =>
            upsertReportCasualty({
              report_id: reportId,
              condition_id: c.condition_id,
              count: c.count,
              names: c.names || null,
            })
          )
      );
      await Promise.all(
        existingCasualties
          .filter((c) => !currentConditionIds.has(c.condition_id))
          .map((c) => deleteReportCasualty(c.id))
      );

      // 3. Save missing persons — delete removed, create new
      const keepPersonIds = new Set(missingPersons.filter((p) => p.id).map((p) => p.id));
      await Promise.all(
        existingMissingPersons
          .filter((p) => !keepPersonIds.has(p.id))
          .map((p) => deleteReportMissingPerson(p.id))
      );
      await Promise.all(
        missingPersons
          .filter((p) => !p.id && p.name.trim())
          .map((p) => createReportMissingPerson({ report_id: reportId, name: p.name.trim() }))
      );

      // 4. Save damages — add new selections, remove deselected
      const existingDamageCondIds = new Set(existingDamages.map((d) => d.damage_condition_id));
      await Promise.all(
        Array.from(selectedDamageIds)
          .filter((id) => !existingDamageCondIds.has(id))
          .map((id) => toggleReportDamage({ report_id: reportId, damage_condition_id: id }))
      );
      await Promise.all(
        existingDamages
          .filter((d) => !selectedDamageIds.has(d.damage_condition_id))
          .map((d) => deleteReportDamage(d.id))
      );

      // 5. Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['report', editId] });
        queryClient.invalidateQueries({ queryKey: ['report-casualties', editId] });
        queryClient.invalidateQueries({ queryKey: ['report-missing-persons', editId] });
        queryClient.invalidateQueries({ queryKey: ['report-damages', editId] });
      }

      toast.success(isEdit ? 'Report updated' : 'Report submitted');
      onSuccess ? onSuccess() : router.push('/reports');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    }
  });

  const eventOptions = events.map((e) => ({ value: e.id, label: e.name }));
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const casualtyConditionOptions = casualtyConditions.map((c) => ({ value: c.id, label: c.name }));

  const usedConditionIds = new Set(casualties.map((c) => c.condition_id));

  return (
    <div className="space-y-6">
      {!isBystander && <PageBreadcrumb pageTitle={isEdit ? 'Edit Report' : 'Submit Report'} />}

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/5 dark:bg-white/3">
        {isEdit && isReportLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-7">
            {/* ── Context ────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label required>Event</Label>
                <Select
                  options={eventOptions}
                  placeholder="Select event..."
                  error={!!errors.event_id}
                  hint={errors.event_id?.message}
                  disabled={!!eventId}
                  value={watch('event_id') ?? ''}
                  onChange={(e) => setValue('event_id', e.target.value)}
                />
              </div>
              <div>
                <Label required>Cluster</Label>
                <Select
                  options={clusterOptions}
                  placeholder="Select cluster..."
                  error={!!errors.cluster_id}
                  hint={errors.cluster_id?.message}
                  value={watch('cluster_id') ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedClusterId(id);
                    setValue('cluster_id', id);
                    setValue('unit_id', '');
                    setValue('location_id', '');
                  }}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  options={unitOptions}
                  placeholder="Select unit..."
                  value={watch('unit_id') ?? ''}
                  onChange={(e) => setValue('unit_id', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Location</Label>
                <Select
                  options={locationOptions}
                  placeholder="Select location..."
                  value={watch('location_id') ?? ''}
                  onChange={(e) => setValue('location_id', e.target.value)}
                />
              </div>
            </div>

            {/* ── Headcount ───────────────────────────────── */}
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Headcount</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {HEADCOUNT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label>{field.label}</Label>
                    <Input type="number" min={0} {...register(field.key as keyof ReportFormData)} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Missing / Casualties summary counts ─────── */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>Missing Persons Count</Label>
                <Input type="number" min={0} {...register('missing_count')} />
              </div>
              <div>
                <Label>Casualties Count</Label>
                <Input type="number" min={0} {...register('casualties_count')} />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/5" />

            {/* ── Missing persons (named) ──────────────────── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Missing Persons
                  {missingPersons.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({missingPersons.length})
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMissingPerson}
                  startIcon={<Plus size={13} />}
                >
                  Add Person
                </Button>
              </div>
              {missingPersons.length === 0 ? (
                <p className="text-sm text-gray-400">No missing persons added</p>
              ) : (
                <div className="space-y-2">
                  {missingPersons.map((person, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Full name"
                        value={person.name}
                        onChange={(e) => updateMissingPerson(i, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeMissingPerson(i)}
                        className="hover:text-error-500 shrink-0 text-gray-400 transition-colors duration-100"
                      >
                        <Trash2 size={16} />
                      </button>
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
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({casualties.length})
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCasualty}
                  startIcon={<Plus size={13} />}
                >
                  Add Casualty
                </Button>
              </div>
              {casualties.length === 0 ? (
                <p className="text-sm text-gray-400">No casualty details added</p>
              ) : (
                <div className="space-y-3">
                  {casualties.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 p-3 dark:border-white/5"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Casualty #{i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCasualty(i)}
                          className="hover:text-error-500 text-gray-400 transition-colors duration-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Label>Condition</Label>
                          <Select
                            options={casualtyConditionOptions.filter(
                              (opt) =>
                                opt.value === c.condition_id || !usedConditionIds.has(opt.value)
                            )}
                            placeholder="Select condition..."
                            value={c.condition_id}
                            onChange={(e) => updateCasualty(i, { condition_id: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Count</Label>
                          <Input
                            type="number"
                            min={1}
                            value={c.count}
                            onChange={(e) =>
                              updateCasualty(i, { count: Number(e.target.value) || 1 })
                            }
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Label>Names (optional)</Label>
                          <Input
                            placeholder="e.g. Juan Dela Cruz, Maria Santos"
                            value={c.names}
                            onChange={(e) => updateCasualty(i, { names: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Structural damage ────────────────────────── */}
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Structural Damage
              </p>
              {damageConditions.length === 0 ? (
                <p className="text-sm text-gray-400">No damage conditions available</p>
              ) : (
                <div className="space-y-2">
                  {damageConditions.map((dc) => (
                    <label
                      key={dc.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/3"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                        checked={selectedDamageIds.has(dc.id)}
                        onChange={() => toggleDamage(dc.id)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{dc.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ── Actions ──────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving...">
                {isEdit ? 'Update Report' : 'Submit Report'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (onCancel ? onCancel() : router.push('/reports'))}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
