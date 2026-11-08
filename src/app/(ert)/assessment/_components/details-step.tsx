'use client';

import { LocationFields } from '@/components/common/location-fields';
import {
  FieldError,
  FieldHelp,
  FieldLabel,
  LocationPicker,
  SegmentedControl,
  SelectField,
  TextInput,
} from '@/components/ds';
import { useLocationTree } from '@/components/hooks/use-assessments';
import {
  applyBuildingProfile,
  detailsFromDraft,
  type AssessmentDraft,
} from '@/lib/assessment-draft';
import type { AssessmentSetup, AssessmentTemplate } from '@/lib/assessment-template';
import { locationOptions } from '@/lib/location-options';
import { assessmentDetailsSchema, type AssessmentDetailsFormData } from '@/lib/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, DetailList, Mono, personName } from '../../_components/chrome';
import { formatDateTime } from '../../_lib/format';
import type { ErtProfile } from '../../_lib/use-ert-access';

export type StepProps = {
  template: AssessmentTemplate;
  draft: AssessmentDraft;
  update: (fn: (d: AssessmentDraft) => AssessmentDraft) => void;
};

const ADD_BUILDING = '__add';

/** Where the building is, who is in charge and which event it's for. Every change is saved. */
export function DetailsStep({
  draft,
  update,
  setup,
  profile,
  onValidChange,
}: StepProps & {
  setup: AssessmentSetup;
  profile: ErtProfile;
  onValidChange: (valid: boolean) => void;
}) {
  const id = useId();
  const form = useForm<AssessmentDetailsFormData>({
    resolver: zodResolver(assessmentDetailsSchema),
    mode: 'onTouched',
    defaultValues: detailsFromDraft(draft),
  });
  const values = form.watch();
  const errors = form.formState.errors;
  const [adding, setAdding] = useState(!draft.building_id && !!draft.new_building_name);
  const [matched, setMatched] = useState(false);
  const locationTree = useLocationTree();

  const offCampus = values.location_kind === 'off_campus';
  const cluster = setup.clusters.find((c) => c.id === values.cluster_id);
  const units = cluster?.units ?? [];
  const placeChosen = offCampus ? !!values.barangay_code : !!values.unit_id;
  const buildings = setup.buildings.filter((b) =>
    offCampus ? b.barangay_code === values.barangay_code : b.unit_id === values.unit_id
  );
  const picks = {
    region_code: values.region_code,
    province_code: values.province_code,
    city_code: values.city_code,
  };
  const locations = locationOptions(locationTree.data ?? null, picks);

  const valid = assessmentDetailsSchema.safeParse(values).success;
  useEffect(() => onValidChange(valid), [valid, onValidChange]);

  /** The form's values into the draft. A newly chosen building brings its saved profile. */
  const sync = () => {
    const v = form.getValues();
    update((d) => {
      let next: AssessmentDraft = {
        ...d,
        location_kind: v.location_kind,
        region_code: v.region_code,
        province_code: v.province_code,
        city_code: v.city_code,
        barangay_code: v.barangay_code,
        cluster_id: v.cluster_id,
        unit_id: v.unit_id,
        new_building_name: v.building_id ? '' : v.new_building_name,
        incident_commander: v.incident_commander,
        event_id: v.event_id,
      };
      if (v.building_id !== d.building_id) {
        const option = setup.buildings.find((b) => b.id === v.building_id);
        next = option
          ? applyBuildingProfile(next, option)
          : { ...next, building_id: '', building_name: '', prefilled_from: null };
      }
      return next;
    });
  };

  const set = (patch: Partial<AssessmentDetailsFormData>) => {
    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key as keyof AssessmentDetailsFormData, value, {
        shouldValidate: true,
        shouldTouch: true,
      });
    }
    sync();
  };

  const chooseBuilding = (value: string) => {
    setMatched(false);
    if (value === ADD_BUILDING) {
      setAdding(true);
      set({ building_id: '' });
    } else {
      setAdding(false);
      set({ building_id: value, new_building_name: '' });
    }
  };

  // A typed name that's already listed picks that building instead of adding a second one.
  const checkTypedName = () => {
    const name = form.getValues('new_building_name').trim().toLowerCase();
    const existing = name && buildings.find((b) => b.name.toLowerCase() === name);
    if (!existing) return;
    setAdding(false);
    setMatched(true);
    set({ building_id: existing.id, new_building_name: '' });
  };

  /** A new place means a new list of buildings, so whatever was chosen no longer applies. */
  const pickPlace = (patch: Partial<AssessmentDetailsFormData>) => {
    setAdding(false);
    setMatched(false);
    set({ ...patch, building_id: '', new_building_name: '' });
  };

  const campusName = profile.campus?.name ?? '—';
  // An off-campus account (DRRM-026) always assesses off campus, for Super Admins only.
  const offCampusAccount = !!profile.is_off_campus;
  const fieldId = (name: string) => `${id}-${name}`;
  const pin = draft.pin ?? null;

  return (
    <Card className="flex flex-col gap-5 p-5 md:p-6">
      <h2 className="text-[19px] leading-[1.3] font-bold">Details</h2>

      {!offCampusAccount && (
        <div className="flex flex-col gap-2">
          <FieldLabel id={fieldId('kind-label')} hint="Required">
            Where is the building?
          </FieldLabel>
          <SegmentedControl
            name={fieldId('kind')}
            labelledBy={fieldId('kind-label')}
            options={[
              { value: 'campus', label: 'On campus' },
              { value: 'off_campus', label: 'Off campus' },
            ]}
            value={values.location_kind ?? ''}
            onChange={(value) => {
              if (value !== 'campus' && value !== 'off_campus') return;
              pickPlace({ location_kind: value });
            }}
          />
          <FieldError>{errors.location_kind?.message}</FieldError>
        </div>
      )}

      {values.location_kind === 'campus' && (
        <>
          <div className="flex flex-col gap-2">
            <FieldLabel>Campus</FieldLabel>
            <p className="text-[16px] font-semibold">{campusName}</p>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor={fieldId('cluster')} hint="Required">
              Cluster
            </FieldLabel>
            <SelectField
              id={fieldId('cluster')}
              value={values.cluster_id}
              onChange={(value) => pickPlace({ cluster_id: value, unit_id: '' })}
              options={setup.clusters.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choose a cluster"
              required
              invalid={!!errors.cluster_id}
              describedBy={errors.cluster_id ? fieldId('cluster-error') : undefined}
            />
            <FieldError id={fieldId('cluster-error')}>{errors.cluster_id?.message}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor={fieldId('unit')} hint="Required">
              College / Department / Unit
            </FieldLabel>
            <SelectField
              id={fieldId('unit')}
              value={values.unit_id}
              onChange={(value) => pickPlace({ unit_id: value })}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              placeholder={cluster ? 'Choose a college or unit' : 'Choose a cluster first'}
              required
              disabled={!cluster}
              invalid={!!errors.unit_id}
              describedBy={errors.unit_id ? fieldId('unit-error') : undefined}
            />
            <FieldError id={fieldId('unit-error')}>{errors.unit_id?.message}</FieldError>
          </div>
        </>
      )}

      {offCampus && (
        <>
          <LocationFields
            idPrefix={id}
            picks={picks}
            barangayCode={values.barangay_code}
            options={locations}
            loading={locationTree.isPending}
            errors={errors}
            onPick={pickPlace}
          />
          <FieldHelp>
            {offCampusAccount
              ? 'Results go to DRRM-H Super Admins.'
              : `Results go to ${campusName}.`}
          </FieldHelp>
        </>
      )}

      {values.location_kind && (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={fieldId('building')} hint="Required">
            Building
          </FieldLabel>
          <SelectField
            id={fieldId('building')}
            value={adding ? ADD_BUILDING : values.building_id}
            onChange={chooseBuilding}
            options={[
              ...buildings.map((b) => ({ value: b.id, label: b.name })),
              { value: ADD_BUILDING, label: 'Add a building…' },
            ]}
            placeholder={
              placeChosen
                ? 'Choose a building'
                : offCampus
                  ? 'Choose a barangay first'
                  : 'Choose a college or unit first'
            }
            required
            disabled={!placeChosen}
            invalid={!!errors.building_id && !adding}
            describedBy={matched ? fieldId('building-help') : undefined}
          />
          {matched && (
            <FieldHelp id={fieldId('building-help')}>Already listed — selected it</FieldHelp>
          )}
          {!adding && <FieldError>{errors.building_id?.message}</FieldError>}
        </div>
      )}

      {adding && (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={fieldId('new-building')} hint="Required">
            Building name
          </FieldLabel>
          <TextInput
            id={fieldId('new-building')}
            autoComplete="off"
            maxLength={120}
            invalid={!!errors.building_id}
            {...form.register('new_building_name', {
              onChange: () => {
                form.trigger('building_id');
                sync();
              },
              onBlur: checkTypedName,
            })}
          />
          <FieldError>{errors.building_id?.message}</FieldError>
        </div>
      )}

      {adding && offCampus && (
        <div className="flex flex-col gap-2">
          <FieldLabel id={fieldId('pin-label')} hint="Optional">
            Map pin
          </FieldLabel>
          <LocationPicker
            labelledBy={fieldId('pin-label')}
            location={pin}
            onChange={(next) =>
              update((d) => ({
                ...d,
                pin: next ? { lat: next.lat, lng: next.lng, name: next.name } : null,
              }))
            }
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={fieldId('commander')} hint="Optional">
          Incident Commander
        </FieldLabel>
        <TextInput
          id={fieldId('commander')}
          autoComplete="off"
          maxLength={200}
          {...form.register('incident_commander', { onChange: sync })}
        />
      </div>

      {!offCampusAccount && (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={fieldId('event')} hint="Optional">
            Linked event / drill
          </FieldLabel>
          <SelectField
            id={fieldId('event')}
            value={values.event_id}
            onChange={(value) => set({ event_id: value })}
            options={setup.events.map((e) => ({ value: e.id, label: e.name }))}
            placeholder="None"
          />
        </div>
      )}

      <DetailList
        rows={[
          { label: 'Evaluator', value: personName(profile) || profile.email },
          {
            label: 'Started',
            value: <Mono className="text-[14px]">{formatDateTime(draft.started_at)}</Mono>,
          },
        ]}
      />
    </Card>
  );
}
