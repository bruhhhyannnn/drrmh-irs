'use client';

import { TEXT_BUTTON } from '@/app/(public)/_components/primitives';
import {
  Button,
  FieldError,
  FieldLabel,
  SelectField,
  Stepper,
  TextArea,
  TextInput,
} from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, type BystanderFormValues } from '@/lib';
import { User, Users, type LucideIcon } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';
import { FooterSlot, StepFooter, StepHeader, StepTitle } from './chrome';
import { PhotoField, type PhotoItem } from './photo-field';

interface StepPeopleDamageProps {
  titleRef: React.Ref<HTMLHeadingElement>;
  register: UseFormRegister<BystanderFormValues>;
  errors: Partial<Record<keyof BystanderFormValues, string>>;
  damageConditionId: string;
  onDamageChange: (value: string) => void;
  damageConditions: { id: string; name: string }[];
  campusName: string;
  categories: { id: string; name: string }[];
  categoriesLoading: boolean;
  counts: Record<string, number>;
  onCountChange: (categoryId: string, count: number) => void;
  missingMeta: string;
  casualtiesMeta: string;
  hasMissing: boolean;
  hasCasualties: boolean;
  onOpenMissing: () => void;
  onOpenCasualties: () => void;
  photos: PhotoItem[];
  onAddPhotos: (photos: PhotoItem[]) => void;
  onRemovePhoto: (id: string) => void;
  onSkip: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 2 — optional details: who is affected and what is damaged. */
export function StepPeopleDamage(props: StepPeopleDamageProps) {
  const { titleRef, register, errors, categories, counts } = props;
  const total = categories.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);

  return (
    <>
      <StepHeader
        step={2}
        aside={
          <span className="flex gap-1.5">
            Optional ·
            <button type="button" onClick={props.onSkip} className={TEXT_BUTTON}>
              Skip
            </button>
          </span>
        }
      />
      <StepTitle ref={titleRef}>Who is affected and what is damaged</StepTitle>

      {props.categoriesLoading && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading the headcount fields…</span>
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-full max-w-100 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex min-h-15 items-center gap-3 border-b border-line py-1.25"
              >
                <Skeleton className="h-4 w-2/5 rounded-md" />
                <Skeleton className="ml-auto h-12.5 w-36 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <section aria-labelledby="headcount-label" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="headcount-label" className="text-[16px] font-semibold text-gray-700">
              Headcount
            </h3>
            <span className="flex items-baseline gap-1.5 text-[14px] font-medium text-gray-500">
              Total
              <span className="font-landing-mono text-[19px] font-bold text-gray-900">{total}</span>
            </span>
          </div>
          <p className="text-[14px] leading-[1.45] text-pretty text-gray-500">
            People you can see in the area. These are the {props.campusName} fields; leave any you
            are unsure of at 0.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex min-h-15 items-center gap-3 border-b border-line py-1.25"
              >
                <label
                  htmlFor={`count-${category.id}`}
                  className="min-w-0 flex-1 text-[16px] leading-[1.3] font-semibold text-pretty text-gray-700"
                >
                  {category.name}
                </label>
                <Stepper
                  id={`count-${category.id}`}
                  label={category.name}
                  value={counts[category.id] ?? 0}
                  onChange={(count) => props.onCountChange(category.id, count)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col rounded-2xl border border-gray-200 px-4">
        <PeopleRow
          icon={User}
          title="Missing persons"
          meta={props.missingMeta}
          hasPeople={props.hasMissing}
          onOpen={props.onOpenMissing}
        />
        <div className="h-px bg-line" />
        <PeopleRow
          icon={Users}
          tone="danger"
          title="Casualties"
          meta={props.casualtiesMeta}
          hasPeople={props.hasCasualties}
          onOpen={props.onOpenCasualties}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="damage">Structural damage</FieldLabel>
        <SelectField
          id="damage"
          value={props.damageConditionId}
          onChange={props.onDamageChange}
          options={props.damageConditions.map((d) => ({ value: d.id, label: d.name }))}
          placeholder="None seen, or not sure"
        />
      </div>

      <PhotoField photos={props.photos} onAdd={props.onAddPhotos} onRemove={props.onRemovePhoto} />

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="location-description">Location description</FieldLabel>
        <TextInput
          id="location-description"
          placeholder="e.g. Near the main gate, beside the flagpole"
          invalid={!!errors.location_description}
          aria-describedby={errors.location_description ? 'location-description-error' : undefined}
          {...register('location_description')}
        />
        <FieldError id="location-description-error">{errors.location_description}</FieldError>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <TextArea
          id="description"
          placeholder="Briefly describe what happened..."
          invalid={!!errors.description}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
        <FieldError id="description-error">{errors.description}</FieldError>
      </div>

      <StepFooter>
        <FooterSlot>
          <Button variant="outline" fullWidth onClick={props.onBack}>
            Back
          </Button>
        </FooterSlot>
        <FooterSlot>
          <Button fullWidth onClick={props.onContinue}>
            Continue
          </Button>
        </FooterSlot>
      </StepFooter>
    </>
  );
}

function PeopleRow({
  icon: Icon,
  tone = 'neutral',
  title,
  meta,
  hasPeople,
  onOpen,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'danger';
  title: string;
  meta: string;
  hasPeople: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3.5">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          tone === 'danger' ? 'bg-error-50 text-error-700' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-semibold">{title}</span>
        <span className="truncate text-[14px] text-gray-500">{meta}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpen}
        aria-label={`${hasPeople ? 'Manage' : 'Add'} ${title.toLowerCase()}`}
      >
        {hasPeople ? 'Manage' : 'Add'}
      </Button>
    </div>
  );
}
