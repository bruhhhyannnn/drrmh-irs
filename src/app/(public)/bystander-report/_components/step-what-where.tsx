'use client';

import { TEXT_BUTTON } from '@/app/(public)/_components/primitives';
import {
  Button,
  FieldError,
  FieldHelp,
  FieldLabel,
  OptionTile,
  SelectField,
} from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import type { BystanderFormValues } from '@/lib';
import { campusLogo } from '@/lib/campus-logo';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { FooterSlot, StepFooter, StepHeader, StepTitle } from './chrome';
import { LocationField } from './location-field';

type Option = { id: string; name: string };
type StepOneField = 'incident_type_id' | 'campus_id' | 'cluster_id' | 'unit_id';

interface StepWhatWhereProps {
  titleRef: React.Ref<HTMLHeadingElement>;
  values: BystanderFormValues;
  errors: Partial<Record<keyof BystanderFormValues, string>>;
  incidentTypes: Option[];
  incidentTypesLoading: boolean;
  campuses: Option[];
  clusters: Option[];
  units: Option[];
  pinLabel: string;
  onFieldChange: (field: StepOneField, value: string) => void;
  onLocationChange: (lat: number | null, lng: number | null) => void;
  onOpenPrivacy: () => void;
  onContinue: () => void;
}

/** Step 1 — only the required items, so a report can go out with the least effort. */
export function StepWhatWhere({
  titleRef,
  values,
  errors,
  incidentTypes,
  incidentTypesLoading,
  campuses,
  clusters,
  units,
  pinLabel,
  onFieldChange,
  onLocationChange,
  onOpenPrivacy,
  onContinue,
}: StepWhatWhereProps) {
  const campus = campuses.find((c) => c.id === values.campus_id);
  const toOptions = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));

  return (
    <>
      <StepHeader step={1} aside="Next: Headcount and people" />
      <StepTitle ref={titleRef}>What happened and where</StepTitle>

      <div className="flex flex-col gap-2">
        <FieldLabel id="incident-type-label" hint="Required">
          Incident type
        </FieldLabel>
        <div
          id="incident-type"
          role="radiogroup"
          aria-labelledby="incident-type-label"
          aria-describedby={errors.incident_type_id ? 'incident-type-error' : undefined}
          aria-busy={incidentTypesLoading || undefined}
          className="grid grid-cols-2 gap-2 md:grid-cols-5"
        >
          {incidentTypesLoading &&
            Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-15 rounded-2xl" />)}
          {incidentTypes.map((type) => (
            <OptionTile
              key={type.id}
              name="incident-type"
              value={type.id}
              checked={values.incident_type_id === type.id}
              onSelect={(value) => onFieldChange('incident_type_id', value)}
              className="h-15 text-[13px]"
            >
              {type.name}
            </OptionTile>
          ))}
        </div>
        <FieldError id="incident-type-error">{errors.incident_type_id}</FieldError>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="campus" hint="Required">
          Campus
        </FieldLabel>
        <SelectField
          id="campus"
          value={values.campus_id}
          onChange={(value) => onFieldChange('campus_id', value)}
          options={toOptions(campuses)}
          placeholder="Select campus"
          required
          invalid={!!errors.campus_id}
          describedBy={errors.campus_id ? 'campus-help campus-error' : 'campus-help'}
          leading={
            <Image
              src={campus ? campusLogo(campus.name) : '/up-logo.png'}
              alt=""
              width={28}
              height={28}
              className="size-7 object-contain"
            />
          }
        />
        <FieldHelp id="campus-help">
          Sets the cluster and unit lists below and the headcount fields in step 2.
        </FieldHelp>
        <FieldError id="campus-error">{errors.campus_id}</FieldError>
      </div>

      <LocationField
        lat={values.latitude}
        lng={values.longitude}
        pinLabel={pinLabel}
        error={errors.latitude}
        onChange={onLocationChange}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cluster" hint="Required">
            Cluster
          </FieldLabel>
          <SelectField
            id="cluster"
            value={values.cluster_id}
            onChange={(value) => onFieldChange('cluster_id', value)}
            options={toOptions(clusters)}
            placeholder={values.campus_id ? 'Select cluster' : 'Select campus first'}
            required
            disabled={!values.campus_id}
            invalid={!!errors.cluster_id}
            describedBy={errors.cluster_id ? 'cluster-error' : undefined}
          />
          <FieldError id="cluster-error">{errors.cluster_id}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="unit" hint="Optional">
            Unit
          </FieldLabel>
          <SelectField
            id="unit"
            value={values.unit_id}
            onChange={(value) => onFieldChange('unit_id', value)}
            options={toOptions(units)}
            placeholder={values.cluster_id ? 'Select unit' : 'Select cluster first'}
            disabled={!values.cluster_id}
          />
        </div>
      </div>

      <StepFooter>
        <p className="flex items-center gap-2 text-[13px] text-gray-600">
          <ShieldCheck size={16} aria-hidden />
          <button type="button" onClick={onOpenPrivacy} className={TEXT_BUTTON}>
            Privacy notice
          </button>
        </p>
        <FooterSlot>
          <Button fullWidth onClick={onContinue}>
            Continue
          </Button>
        </FooterSlot>
      </StepFooter>
    </>
  );
}
