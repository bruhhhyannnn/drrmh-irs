'use client';

import { FieldError, FieldHelp, FieldLabel, SelectField, TextInput } from '@/components/ds';
import { applyBuildingProfile, type AssessmentDraft } from '@/lib/assessment-draft';
import type { AssessmentSetup, AssessmentTemplate } from '@/lib/assessment-template';
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
    defaultValues: {
      cluster_id: draft.cluster_id,
      unit_id: draft.unit_id,
      building_id: draft.building_id,
      new_building_name: draft.new_building_name,
      incident_commander: draft.incident_commander,
      event_id: draft.event_id,
    },
  });
  const values = form.watch();
  const errors = form.formState.errors;
  const [adding, setAdding] = useState(!draft.building_id && !!draft.new_building_name);
  const [matched, setMatched] = useState(false);

  const cluster = setup.clusters.find((c) => c.id === values.cluster_id);
  const units = cluster?.units ?? [];
  const buildings = setup.buildings.filter((b) => b.unit_id === values.unit_id);

  const valid = assessmentDetailsSchema.safeParse(values).success;
  useEffect(() => onValidChange(valid), [valid, onValidChange]);

  /** The form's values into the draft. A newly chosen building brings its saved profile. */
  const sync = () => {
    const v = form.getValues();
    update((d) => {
      let next: AssessmentDraft = {
        ...d,
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

  const campusName = profile.campus?.name ?? '—';
  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <Card className="flex flex-col gap-5 p-5 md:p-6">
      <h2 className="text-[19px] leading-[1.3] font-bold">Details</h2>

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
          onChange={(value) => {
            setAdding(false);
            setMatched(false);
            set({ cluster_id: value, unit_id: '', building_id: '', new_building_name: '' });
          }}
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
          onChange={(value) => {
            setAdding(false);
            setMatched(false);
            set({ unit_id: value, building_id: '', new_building_name: '' });
          }}
          options={units.map((u) => ({ value: u.id, label: u.name }))}
          placeholder={cluster ? 'Choose a college or unit' : 'Choose a cluster first'}
          required
          disabled={!cluster}
          invalid={!!errors.unit_id}
          describedBy={errors.unit_id ? fieldId('unit-error') : undefined}
        />
        <FieldError id={fieldId('unit-error')}>{errors.unit_id?.message}</FieldError>
      </div>

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
          placeholder={values.unit_id ? 'Choose a building' : 'Choose a college or unit first'}
          required
          disabled={!values.unit_id}
          invalid={!!errors.building_id && !adding}
          describedBy={matched ? fieldId('building-help') : undefined}
        />
        {matched && (
          <FieldHelp id={fieldId('building-help')}>Already listed — selected it</FieldHelp>
        )}
        {!adding && <FieldError>{errors.building_id?.message}</FieldError>}
      </div>

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
