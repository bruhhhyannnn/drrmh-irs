'use client';

import { Button, SelectField, SwitchField, TextArea, TextInput } from '@/components/ds';
import {
  useCreateDraftVersion,
  useUpdateItemWording,
  useUpdateSectionTitle,
  useUpsertAreaType,
  useUpsertItem,
  useUpsertSection,
} from '@/components/hooks/use-assessment-templates';
import type {
  EditableAreaType,
  PillarCode,
  TemplateItem,
  TemplateSection,
} from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import {
  areaTypeSchema,
  draftVersionSchema,
  itemSchema,
  itemWordingSchema,
  sectionSchema,
  sectionWordingSchema,
  type AreaTypeFormData,
  type DraftVersionFormData,
  type ItemFormData,
  type ItemWordingFormData,
  type SectionFormData,
  type SectionWordingFormData,
} from '@/lib/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FormField, FormGrid } from '../../../_components/drawer-parts';

// Inline forms for the Super Admin checklist editor (/assessments/checklist): new draft version,
// section wording / full section, item wording / full item, and building area types.

const PILLAR_OPTIONS = PILLARS.map((p) => ({
  value: p.slug,
  label: `${p.label} — ${p.name}`,
}));

const SAFE_OPTIONS = [
  { value: 'yes', label: 'Yes is safe (standard)' },
  { value: 'no', label: 'No is safe (reverse-scored hazard)' },
];

function FormActions({
  saving,
  submitLabel,
  onCancel,
}: {
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5 pt-1">
      <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" size="sm" loading={saving}>
        {submitLabel}
      </Button>
    </div>
  );
}

/* ─── New draft version ─── */

export function NewDraftForm({
  fromVersionId,
  fromLabel,
  onCreated,
  onCancel,
}: {
  fromVersionId: string;
  fromLabel: string;
  onCreated: (newVersionId: string) => void;
  onCancel: () => void;
}) {
  const createDraft = useCreateDraftVersion();
  const today = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DraftVersionFormData>({
    resolver: zodResolver(draftVersionSchema),
    defaultValues: {
      from_version_id: fromVersionId,
      label: `Ver. ${today}`,
    },
  });

  const submit = handleSubmit((data) => {
    createDraft.mutate(data, {
      onSuccess: (res) => {
        toast.success('Draft version created');
        if (res.id) onCreated(res.id);
      },
      onError: (err) => toast.error(err.message),
    });
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormField
        id="draft-label"
        label="New draft version label"
        hint="Required"
        help={`Copies all sections and questions from ${fromLabel}.`}
        error={errors.label?.message}
      >
        <TextInput
          id="draft-label"
          placeholder="e.g. Ver. October 2026"
          autoFocus
          invalid={!!errors.label}
          {...register('label')}
        />
      </FormField>
      <FormActions
        saving={createDraft.isPending}
        submitLabel="Create draft version"
        onCancel={onCancel}
      />
    </form>
  );
}

/* ─── Section editor (wording on published/retired; full on draft) ─── */

export function SectionEditor({
  versionId,
  isDraft,
  section,
  areaTypes,
  onSaved,
  onCancel,
}: {
  versionId: string;
  isDraft: boolean;
  section?: TemplateSection;
  areaTypes: EditableAreaType[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  if (!isDraft && section) {
    return <SectionWordingEditor section={section} onSaved={onSaved} onCancel={onCancel} />;
  }
  return (
    <SectionFullEditor
      versionId={versionId}
      section={section}
      areaTypes={areaTypes}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function SectionWordingEditor({
  section,
  onSaved,
  onCancel,
}: {
  section: TemplateSection;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const updateTitle = useUpdateSectionTitle();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SectionWordingFormData>({
    resolver: zodResolver(sectionWordingSchema),
    defaultValues: {
      title_en: section.title_en,
      title_fil: section.title_fil,
    },
  });

  const submit = handleSubmit((data) => {
    updateTitle.mutate(
      { id: section.id, data },
      {
        onSuccess: () => {
          toast.success(`Section ${section.code} updated`);
          onSaved();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormGrid>
        <FormField
          id={`sec-en-${section.id}`}
          label="English title"
          hint="Required"
          error={errors.title_en?.message}
        >
          <TextInput
            id={`sec-en-${section.id}`}
            invalid={!!errors.title_en}
            {...register('title_en')}
          />
        </FormField>
        <FormField
          id={`sec-fil-${section.id}`}
          label="Filipino title"
          hint="Optional"
          error={errors.title_fil?.message}
        >
          <TextInput
            id={`sec-fil-${section.id}`}
            invalid={!!errors.title_fil}
            {...register('title_fil')}
          />
        </FormField>
      </FormGrid>
      <FormActions saving={updateTitle.isPending} submitLabel="Save wording" onCancel={onCancel} />
    </form>
  );
}

function SectionFullEditor({
  versionId,
  section,
  areaTypes,
  onSaved,
  onCancel,
}: {
  versionId: string;
  section?: TemplateSection;
  areaTypes: EditableAreaType[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const upsert = useUpsertSection();
  const key = section?.id ?? 'new';
  const areaOptions = areaTypes
    .filter((a) => a.is_active || a.id === section?.area_type_id)
    .map((a) => ({ value: a.id, label: a.name_en }));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      code: section?.code ?? '',
      title_en: section?.title_en ?? '',
      title_fil: section?.title_fil ?? '',
      area_type_id: section?.area_type_id ?? '',
    },
  });

  const submit = handleSubmit((data) => {
    upsert.mutate(
      { version_id: versionId, id: section?.id, ...data },
      {
        onSuccess: () => {
          toast.success(section ? `Section ${data.code} updated` : `Section ${data.code} added`);
          onSaved();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormGrid>
        <FormField
          id={`sec-code-${key}`}
          label="Section code"
          hint="Required"
          half
          error={errors.code?.message}
        >
          <TextInput
            id={`sec-code-${key}`}
            placeholder="e.g. XVIII"
            invalid={!!errors.code}
            {...register('code')}
          />
        </FormField>
        <FormField
          id={`sec-area-${key}`}
          label="Only when building has area"
          hint="Optional"
          half
          error={errors.area_type_id?.message}
        >
          <Controller
            control={control}
            name="area_type_id"
            render={({ field }) => (
              <SelectField
                id={`sec-area-${key}`}
                value={field.value ?? ''}
                onChange={field.onChange}
                options={areaOptions}
                placeholder="Always asked (no area gate)"
              />
            )}
          />
        </FormField>
        <FormField
          id={`sec-en-${key}`}
          label="English title"
          hint="Required"
          error={errors.title_en?.message}
        >
          <TextInput
            id={`sec-en-${key}`}
            placeholder="Enter section title in English"
            invalid={!!errors.title_en}
            {...register('title_en')}
          />
        </FormField>
        <FormField
          id={`sec-fil-${key}`}
          label="Filipino title"
          hint="Optional"
          error={errors.title_fil?.message}
        >
          <TextInput
            id={`sec-fil-${key}`}
            placeholder="Enter section title in Filipino"
            invalid={!!errors.title_fil}
            {...register('title_fil')}
          />
        </FormField>
      </FormGrid>
      <FormActions
        saving={upsert.isPending}
        submitLabel={section ? 'Save section' : 'Add section'}
        onCancel={onCancel}
      />
    </form>
  );
}

/* ─── Item editor (wording on published/retired; full on draft) ─── */

export function ItemEditor({
  section,
  isDraft,
  item,
  defaultParentId,
  areaTypes,
  onSaved,
  onCancel,
}: {
  section: TemplateSection;
  isDraft: boolean;
  item?: TemplateItem;
  defaultParentId?: string | null;
  areaTypes: EditableAreaType[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  if (!isDraft && item) {
    return (
      <ItemWordingEditor
        sectionCode={section.code}
        item={item}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    );
  }
  return (
    <ItemFullEditor
      section={section}
      item={item}
      defaultParentId={defaultParentId}
      areaTypes={areaTypes}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function ItemWordingEditor({
  sectionCode,
  item,
  onSaved,
  onCancel,
}: {
  sectionCode: string;
  item: TemplateItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const updateWording = useUpdateItemWording();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemWordingFormData>({
    resolver: zodResolver(itemWordingSchema),
    defaultValues: {
      prompt_en: item.prompt_en,
      prompt_fil: item.prompt_fil,
      note_en: item.note_en ?? '',
      note_fil: item.note_fil ?? '',
      reference: item.reference ?? '',
    },
  });

  const submit = handleSubmit((data) => {
    updateWording.mutate(
      { id: item.id, data },
      {
        onSuccess: () => {
          toast.success(`${sectionCode}.${item.code} wording saved`);
          onSaved();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-2 flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormGrid>
        <FormField
          id={`item-en-${item.id}`}
          label="Question (English)"
          hint="Required"
          error={errors.prompt_en?.message}
        >
          <TextArea
            id={`item-en-${item.id}`}
            invalid={!!errors.prompt_en}
            {...register('prompt_en')}
          />
        </FormField>
        <FormField
          id={`item-fil-${item.id}`}
          label="Question (Filipino)"
          hint="Optional"
          error={errors.prompt_fil?.message}
        >
          <TextArea
            id={`item-fil-${item.id}`}
            invalid={!!errors.prompt_fil}
            {...register('prompt_fil')}
          />
        </FormField>
        <FormField
          id={`item-note-en-${item.id}`}
          label="Note (English)"
          hint="Optional"
          half
          error={errors.note_en?.message}
        >
          <TextInput
            id={`item-note-en-${item.id}`}
            invalid={!!errors.note_en}
            {...register('note_en')}
          />
        </FormField>
        <FormField
          id={`item-note-fil-${item.id}`}
          label="Note (Filipino)"
          hint="Optional"
          half
          error={errors.note_fil?.message}
        >
          <TextInput
            id={`item-note-fil-${item.id}`}
            invalid={!!errors.note_fil}
            {...register('note_fil')}
          />
        </FormField>
        <FormField
          id={`item-ref-${item.id}`}
          label="Reference"
          hint="Optional"
          error={errors.reference?.message}
        >
          <TextInput
            id={`item-ref-${item.id}`}
            placeholder="e.g. RA 9514 Fire Code of the Philippines"
            invalid={!!errors.reference}
            {...register('reference')}
          />
        </FormField>
      </FormGrid>
      <FormActions
        saving={updateWording.isPending}
        submitLabel="Save wording"
        onCancel={onCancel}
      />
    </form>
  );
}

function ItemFullEditor({
  section,
  item,
  defaultParentId = null,
  areaTypes,
  onSaved,
  onCancel,
}: {
  section: TemplateSection;
  item?: TemplateItem;
  defaultParentId?: string | null;
  areaTypes: EditableAreaType[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const upsert = useUpsertItem();
  const key = item?.id ?? `new-${section.id}`;
  const groupParents = section.items.filter(
    (i) => i.parent_id === null && !i.is_scored && i.id !== item?.id
  );
  const areaOptions = areaTypes
    .filter((a) => a.is_active || a.id === item?.area_type_id)
    .map((a) => ({ value: a.id, label: a.name_en }));

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema as never),
    defaultValues: {
      code: item?.code ?? '',
      parent_id: item?.parent_id ?? defaultParentId ?? '',
      is_scored: item ? item.is_scored : true,
      pillar_code: (item?.pillar_code ?? 'prevention-mitigation') as PillarCode,
      safe_answer: item?.safe_answer ?? 'yes',
      area_type_id: item?.area_type_id ?? '',
      min_floors: item?.min_floors ?? null,
      flag_label: item?.flag_label ?? '',
      prompt_en: item?.prompt_en ?? '',
      prompt_fil: item?.prompt_fil ?? '',
      note_en: item?.note_en ?? '',
      note_fil: item?.note_fil ?? '',
      reference: item?.reference ?? '',
    },
  });

  const parentId = watch('parent_id');
  const isScored = watch('is_scored');

  const submit = handleSubmit((data) => {
    upsert.mutate(
      {
        section_id: section.id,
        id: item?.id,
        ...data,
        pillar_code: data.is_scored ? data.pillar_code : null,
      },
      {
        onSuccess: () => {
          toast.success(
            item ? `${section.code}.${data.code} updated` : `${section.code}.${data.code} added`
          );
          onSaved();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-2 flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormGrid>
        <FormField
          id={`item-code-${key}`}
          label="Item code"
          hint="Required"
          half
          error={errors.code?.message}
        >
          <TextInput
            id={`item-code-${key}`}
            placeholder="e.g. 10 or 3.5"
            invalid={!!errors.code}
            {...register('code')}
          />
        </FormField>
        <FormField
          id={`item-parent-${key}`}
          label="Under group heading"
          hint="Optional"
          half
          error={errors.parent_id?.message}
        >
          <Controller
            control={control}
            name="parent_id"
            render={({ field }) => (
              <SelectField
                id={`item-parent-${key}`}
                value={field.value ?? ''}
                onChange={(val) => {
                  field.onChange(val);
                  if (val) setValue('is_scored', true);
                }}
                options={groupParents.map((g) => ({
                  value: g.id,
                  label: `${section.code}.${g.code} — ${g.prompt_en.slice(0, 48)}`,
                }))}
                placeholder="Top-level question"
              />
            )}
          />
        </FormField>

        {!parentId && (
          <div className="md:col-span-2">
            <Controller
              control={control}
              name="is_scored"
              render={({ field }) => (
                <SwitchField
                  id={`item-scored-${key}`}
                  label="Scored question"
                  description="Turn off to make this an unscored group heading for sub-items."
                  checked={field.value}
                  onChange={(checked) => {
                    field.onChange(checked);
                    if (checked && !watch('pillar_code')) {
                      setValue('pillar_code', 'prevention-mitigation');
                    }
                  }}
                />
              )}
            />
          </div>
        )}

        {isScored && (
          <>
            <FormField
              id={`item-pillar-${key}`}
              label="DRRM pillar"
              hint="Required"
              half
              error={errors.pillar_code?.message}
            >
              <Controller
                control={control}
                name="pillar_code"
                render={({ field }) => (
                  <SelectField
                    id={`item-pillar-${key}`}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={PILLAR_OPTIONS}
                    placeholder="Select DRRM pillar"
                    required
                    invalid={!!errors.pillar_code}
                  />
                )}
              />
            </FormField>
            <FormField
              id={`item-safe-${key}`}
              label="Safe answer"
              hint="Required"
              half
              error={errors.safe_answer?.message}
            >
              <Controller
                control={control}
                name="safe_answer"
                render={({ field }) => (
                  <SelectField
                    id={`item-safe-${key}`}
                    value={field.value}
                    onChange={field.onChange}
                    options={SAFE_OPTIONS}
                    placeholder="Select safe answer"
                    required
                  />
                )}
              />
            </FormField>
            <FormField
              id={`item-area-${key}`}
              label="Only when building has area"
              hint="Optional"
              half
              error={errors.area_type_id?.message}
            >
              <Controller
                control={control}
                name="area_type_id"
                render={({ field }) => (
                  <SelectField
                    id={`item-area-${key}`}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={areaOptions}
                    placeholder="No item area gate"
                  />
                )}
              />
            </FormField>
            <FormField
              id={`item-floors-${key}`}
              label="Minimum floors"
              hint="Optional"
              half
              error={errors.min_floors?.message}
            >
              <TextInput
                id={`item-floors-${key}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                step={1}
                placeholder="Any floor count"
                invalid={!!errors.min_floors}
                {...register('min_floors')}
              />
            </FormField>
            <FormField
              id={`item-flag-${key}`}
              label="Follow-up flag when unsafe"
              hint="Optional"
              error={errors.flag_label?.message}
            >
              <TextInput
                id={`item-flag-${key}`}
                placeholder="e.g. Needs structural follow-up"
                invalid={!!errors.flag_label}
                {...register('flag_label')}
              />
            </FormField>
          </>
        )}

        <FormField
          id={`item-en-${key}`}
          label="Question (English)"
          hint="Required"
          error={errors.prompt_en?.message}
        >
          <TextArea
            id={`item-en-${key}`}
            placeholder="Enter the question in English"
            invalid={!!errors.prompt_en}
            {...register('prompt_en')}
          />
        </FormField>
        <FormField
          id={`item-fil-${key}`}
          label="Question (Filipino)"
          hint="Optional"
          error={errors.prompt_fil?.message}
        >
          <TextArea
            id={`item-fil-${key}`}
            placeholder="Enter the question in Filipino"
            invalid={!!errors.prompt_fil}
            {...register('prompt_fil')}
          />
        </FormField>
        <FormField
          id={`item-note-en-${key}`}
          label="Note (English)"
          hint="Optional"
          half
          error={errors.note_en?.message}
        >
          <TextInput
            id={`item-note-en-${key}`}
            invalid={!!errors.note_en}
            {...register('note_en')}
          />
        </FormField>
        <FormField
          id={`item-note-fil-${key}`}
          label="Note (Filipino)"
          hint="Optional"
          half
          error={errors.note_fil?.message}
        >
          <TextInput
            id={`item-note-fil-${key}`}
            invalid={!!errors.note_fil}
            {...register('note_fil')}
          />
        </FormField>
        <FormField
          id={`item-ref-${key}`}
          label="Reference"
          hint="Optional"
          error={errors.reference?.message}
        >
          <TextInput
            id={`item-ref-${key}`}
            placeholder="e.g. RA 9514 Fire Code of the Philippines"
            invalid={!!errors.reference}
            {...register('reference')}
          />
        </FormField>
      </FormGrid>
      <FormActions
        saving={upsert.isPending}
        submitLabel={item ? 'Save question' : 'Add question'}
        onCancel={onCancel}
      />
    </form>
  );
}

/* ─── Building area type editor ─── */

export function AreaTypeEditor({
  area,
  onSaved,
  onCancel,
}: {
  area?: EditableAreaType;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const upsert = useUpsertAreaType();
  const key = area?.id ?? 'new';
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AreaTypeFormData>({
    resolver: zodResolver(areaTypeSchema),
    defaultValues: {
      code: area?.code ?? '',
      name_en: area?.name_en ?? '',
      name_fil: area?.name_fil ?? '',
      is_active: area?.is_active ?? true,
    },
  });

  const submit = handleSubmit((data) => {
    upsert.mutate(
      { id: area?.id, ...data },
      {
        onSuccess: () => {
          toast.success(area ? `${data.name_en} updated` : `${data.name_en} added`);
          onSaved();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-line bg-gray-50 p-4"
    >
      <FormGrid>
        <FormField
          id={`area-code-${key}`}
          label="Code"
          hint="Required"
          half
          error={errors.code?.message}
        >
          <TextInput
            id={`area-code-${key}`}
            placeholder="e.g. cafeteria"
            disabled={!!area}
            invalid={!!errors.code}
            {...register('code')}
          />
        </FormField>
        <FormField
          id={`area-en-${key}`}
          label="English name"
          hint="Required"
          half
          error={errors.name_en?.message}
        >
          <TextInput
            id={`area-en-${key}`}
            placeholder="e.g. Cafeteria / canteen"
            invalid={!!errors.name_en}
            {...register('name_en')}
          />
        </FormField>
        <FormField
          id={`area-fil-${key}`}
          label="Filipino name"
          hint="Optional"
          error={errors.name_fil?.message}
        >
          <TextInput
            id={`area-fil-${key}`}
            placeholder="e.g. Kantina"
            invalid={!!errors.name_fil}
            {...register('name_fil')}
          />
        </FormField>
        <div className="md:col-span-2">
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <SwitchField
                id={`area-active-${key}`}
                label="Active"
                description="Turn off to hide this area from new pre-screens without breaking past assessments."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </FormGrid>
      <FormActions
        saving={upsert.isPending}
        submitLabel={area ? 'Save area type' : 'Add area type'}
        onCancel={onCancel}
      />
    </form>
  );
}
