'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Button, FOCUS_RING, SelectField, Switch } from '@/components/ds';
import {
  useChecklistEditor,
  useDeleteDraftVersion,
  useDeleteItem,
  useDeleteSection,
  usePublishVersion,
  useReorderItem,
  useReorderSection,
  useUpsertAreaType,
} from '@/components/hooks/use-assessment-templates';
import { cn } from '@/lib';
import {
  itemLabel,
  pillarItemCounts,
  type EditableAreaType,
  type PillarCode,
  type TemplateItem,
  type TemplateSection,
  type VersionStatus,
} from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  CopyPlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { IconAction, RowActions, SearchField } from '../../_components/data-list';
import { PageHeader } from '../../_components/page-header';
import { Card, CardHeading, Chip, EmptyNote, Mono, Skeleton } from '../../_components/ui';
import { plural } from '../../_lib/format';
import type { Tone } from '../../_lib/status';
import { AreaTypeEditor, ItemEditor, NewDraftForm, SectionEditor } from './_components/editors';

const BACK = { href: '/assessments', label: 'Assessments' };

const STATUS_CHIP: Record<VersionStatus, { label: string; tone: Tone }> = {
  published: { label: 'Published', tone: 'green' },
  draft: { label: 'Draft', tone: 'amber' },
  retired: { label: 'Retired', tone: 'grey' },
};

const PILLAR_SHORT: Record<PillarCode, { label: string; tone: Tone }> = {
  'prevention-mitigation': { label: 'Prevention', tone: 'maroon' },
  preparedness: { label: 'Preparedness', tone: 'blue' },
  response: { label: 'Response', tone: 'amber' },
  'rehabilitation-recovery': { label: 'Recovery', tone: 'green' },
};

export default function ChecklistEditorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ChecklistEditor />
    </Suspense>
  );
}

function ChecklistEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedId = params.get('version');

  const { data, isPending, error } = useChecklistEditor(requestedId);
  const publish = usePublishVersion();
  const deleteDraft = useDeleteDraftVersion();
  const deleteSection = useDeleteSection();
  const reorderSection = useReorderSection();
  const deleteItem = useDeleteItem();
  const reorderItem = useReorderItem();

  const [query, setQuery] = useState('');
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [addingToSection, setAddingToSection] = useState<{
    sectionId: string;
    parentId: string | null;
  } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [deletingSection, setDeletingSection] = useState<TemplateSection | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    section: TemplateSection;
    item: TemplateItem;
  } | null>(null);

  const selectVersion = (id: string) => {
    setCreatingDraft(false);
    setAddingSection(false);
    setEditingSectionId(null);
    setAddingToSection(null);
    setEditingItemId(null);
    router.replace(`${pathname}?version=${id}`, { scroll: false });
  };

  if (isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Skeleton className="h-20 w-full max-w-140" />
        <Skeleton className="h-44" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data || !data.version) {
    return (
      <>
        <PageHeader title="Checklist editor" back={BACK} />
        <Card className="p-6 text-[17px] text-gray-600">
          {error
            ? `The checklist couldn't be loaded: ${error.message}`
            : 'No checklist version is available.'}
        </Card>
      </>
    );
  }

  const { versions, area_types: areaTypes, version } = data;
  const isDraft = version.status === 'draft';
  const statusChip = STATUS_CHIP[version.status];
  const areaById = new Map(areaTypes.map((a) => [a.id, a]));
  const pillarCounts = pillarItemCounts(version.sections);
  const totalScored = Object.values(pillarCounts).reduce((a, b) => a + b, 0);

  const q = query.trim().toLowerCase();
  const matchesItem = (section: TemplateSection, item: TemplateItem) => {
    if (!q) return true;
    const label = itemLabel(section, item).toLowerCase();
    return (
      label.includes(q) ||
      item.prompt_en.toLowerCase().includes(q) ||
      item.prompt_fil.toLowerCase().includes(q) ||
      (item.reference?.toLowerCase().includes(q) ?? false)
    );
  };
  const filteredSections = version.sections.filter(
    (s) =>
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.title_en.toLowerCase().includes(q) ||
      s.title_fil.toLowerCase().includes(q) ||
      s.items.some((i) => matchesItem(s, i))
  );

  return (
    <>
      <PageHeader
        title="Checklist editor"
        subtitle="MATATAG building safety questions, versions and area gates"
        back={BACK}
        chip={
          <Chip tone={statusChip.tone} dot>
            {statusChip.label}
          </Chip>
        }
        actions={
          <>
            {!creatingDraft && (
              <Button variant="outline" size="sm" onClick={() => setCreatingDraft(true)}>
                <CopyPlus size={16} aria-hidden />
                New draft version
              </Button>
            )}
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingSection(true);
                    setEditingSectionId(null);
                  }}
                >
                  <Plus size={16} aria-hidden />
                  Add section
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeletingDraft(true)}>
                  <Trash2 size={16} aria-hidden />
                  Delete draft
                </Button>
                <Button size="sm" onClick={() => setPublishing(true)}>
                  <CheckCircle2 size={16} aria-hidden />
                  Publish version
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Version bar & DRRM pillar counts */}
      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
            <label htmlFor="checklist-version" className="text-[14px] font-semibold text-gray-700">
              Checklist version
            </label>
            <SelectField
              id="checklist-version"
              value={version.version_id}
              onChange={selectVersion}
              placeholder="Select version"
              options={versions.map((v) => ({
                value: v.id,
                label: `${v.label} · ${STATUS_CHIP[v.status].label} (${plural(
                  v.assessment_count,
                  'assessment',
                  'assessments'
                )})`,
              }))}
            />
          </div>
          <p className="min-w-0 flex-[1_1_300px] text-[14px] leading-[1.45] text-pretty text-gray-600">
            {isDraft
              ? 'Draft version: you can add, remove, reorder and re-gate sections and questions, and set each question’s DRRM pillar. Publish when ready.'
              : 'Wording, translations, notes and references can be edited in place and show on old and new assessments. Create a draft version to add, remove or re-gate questions.'}
          </p>
        </div>

        {creatingDraft && (
          <NewDraftForm
            fromVersionId={version.version_id}
            fromLabel={version.label}
            onCreated={selectVersion}
            onCancel={() => setCreatingDraft(false)}
          />
        )}

        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
              Questions per DRRM pillar
            </span>
            <span className="text-[13px] font-semibold text-gray-600">
              {plural(version.sections.length, 'section', 'sections')} ·{' '}
              {plural(totalScored, 'scored question', 'scored questions')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {PILLARS.map((pillar) => {
              const count = pillarCounts[pillar.slug as PillarCode] ?? 0;
              return (
                <div
                  key={pillar.slug}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-gray-50 px-3.5 py-3"
                >
                  <span className="bg-brand-25 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl">
                    <pillar.icon size={18} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold text-gray-600">
                      {pillar.label}
                    </span>
                    <Mono className="text-[20px] leading-tight font-extrabold text-gray-900">
                      {count}
                    </Mono>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {addingSection && isDraft && (
        <Card className="p-5 md:p-6">
          <CardHeading title="Add section" level={3} />
          <div className="mt-3">
            <SectionEditor
              versionId={version.version_id}
              isDraft
              areaTypes={areaTypes}
              onSaved={() => setAddingSection(false)}
              onCancel={() => setAddingSection(false)}
            />
          </div>
        </Card>
      )}

      {/* Search & section → item tree */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          label="Search checklist questions"
          placeholder="Search by code (e.g. V.4) or question text…"
          value={query}
          onChange={setQuery}
        />
        <span className="text-[14px] font-semibold text-gray-600">
          {plural(filteredSections.length, 'section', 'sections')} shown
        </span>
      </div>

      {filteredSections.length === 0 ? (
        <Card>
          <EmptyNote>No sections or questions match &ldquo;{query}&rdquo;.</EmptyNote>
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredSections.map((section, sIdx) => {
            const area = section.area_type_id ? areaById.get(section.area_type_id) : undefined;
            const scoredInSection = section.items.filter((i) => i.is_scored).length;
            const visibleItems = q
              ? section.items.filter(
                  (i) =>
                    matchesItem(section, i) ||
                    section.code.toLowerCase().includes(q) ||
                    section.title_en.toLowerCase().includes(q) ||
                    section.title_fil.toLowerCase().includes(q)
                )
              : section.items;

            const topLevelIds = section.items.filter((i) => i.parent_id === null).map((i) => i.id);

            return (
              <Card key={section.id} className="p-0">
                <details className="group flex flex-col" open={!!q || sIdx === 0 || undefined}>
                  <summary
                    className={cn(
                      'flex cursor-pointer list-none flex-wrap items-start gap-3 rounded-[22px] p-5 select-none md:p-6 [&::-webkit-details-marker]:hidden',
                      FOCUS_RING
                    )}
                  >
                    <Mono className="bg-brand-25 text-brand-500 grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-[14px] font-semibold">
                      {section.code}
                    </Mono>
                    <Bilingual
                      as="h2"
                      en={section.title_en}
                      fil={section.title_fil}
                      className="min-w-0 flex-[1_1_180px] text-[18px] leading-[1.3] font-bold"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {area && <Chip tone="neutral">Area: {area.name_en}</Chip>}
                      <Chip tone="grey">{plural(scoredInSection, 'question', 'questions')}</Chip>
                    </div>
                    <ChevronDown
                      size={20}
                      aria-hidden
                      className="mt-1 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180"
                    />
                  </summary>

                  <div className="flex flex-col gap-3 border-t border-line px-5 pt-3.5 pb-5 md:px-6 md:pb-6">
                    {/* Section actions bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-500">
                        Section {section.code}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditingSectionId(editingSectionId === section.id ? null : section.id)
                          }
                        >
                          <Pencil size={15} aria-hidden />
                          {isDraft ? 'Edit section' : 'Edit title'}
                        </Button>
                        {isDraft && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAddingToSection({ sectionId: section.id, parentId: null });
                                setEditingItemId(null);
                              }}
                            >
                              <Plus size={15} aria-hidden />
                              Add question
                            </Button>
                            <IconAction
                              label={`Move section ${section.code} up`}
                              icon={<ArrowUp size={17} aria-hidden />}
                              disabled={sIdx === 0 || reorderSection.isPending}
                              onClick={() =>
                                reorderSection.mutate(
                                  { id: section.id, direction: 'up' },
                                  { onError: (err) => toast.error(err.message) }
                                )
                              }
                            />
                            <IconAction
                              label={`Move section ${section.code} down`}
                              icon={<ArrowDown size={17} aria-hidden />}
                              disabled={
                                sIdx === version.sections.length - 1 || reorderSection.isPending
                              }
                              onClick={() =>
                                reorderSection.mutate(
                                  { id: section.id, direction: 'down' },
                                  { onError: (err) => toast.error(err.message) }
                                )
                              }
                            />
                            <IconAction
                              label={`Delete section ${section.code}`}
                              icon={<Trash2 size={17} aria-hidden />}
                              onClick={() => setDeletingSection(section)}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {editingSectionId === section.id && (
                      <SectionEditor
                        versionId={version.version_id}
                        isDraft={isDraft}
                        section={section}
                        areaTypes={areaTypes}
                        onSaved={() => setEditingSectionId(null)}
                        onCancel={() => setEditingSectionId(null)}
                      />
                    )}

                    {addingToSection?.sectionId === section.id &&
                      addingToSection.parentId === null && (
                        <ItemEditor
                          section={section}
                          isDraft={isDraft}
                          defaultParentId={null}
                          areaTypes={areaTypes}
                          onSaved={() => setAddingToSection(null)}
                          onCancel={() => setAddingToSection(null)}
                        />
                      )}

                    {/* Items list */}
                    <ul className="flex flex-col">
                      {visibleItems.map((item) => {
                        const label = itemLabel(section, item);
                        const itemArea = item.area_type_id
                          ? areaById.get(item.area_type_id)
                          : undefined;
                        const pillarChip = item.pillar_code
                          ? PILLAR_SHORT[item.pillar_code]
                          : undefined;
                        const siblings = item.parent_id
                          ? section.items
                              .filter((i) => i.parent_id === item.parent_id)
                              .map((i) => i.id)
                          : topLevelIds;
                        const siblingIdx = siblings.indexOf(item.id);

                        return (
                          <li
                            key={item.id}
                            className={cn(
                              'flex flex-col gap-2 border-b border-line py-3.5 last:border-b-0',
                              item.parent_id && 'pl-4 md:pl-6'
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2.5">
                              <div className="flex min-w-0 flex-[1_1_220px] items-start gap-2.5">
                                <Mono className="w-13 shrink-0 pt-0.5 text-[13px] font-semibold text-gray-500">
                                  {label}
                                </Mono>
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                  <Bilingual
                                    en={item.prompt_en}
                                    fil={item.prompt_fil}
                                    className={cn(
                                      'min-w-0 text-[15px] leading-[1.45]',
                                      !item.is_scored && 'font-bold text-gray-900'
                                    )}
                                  />
                                  {(item.note_en || item.note_fil) && (
                                    <Bilingual
                                      en={item.note_en ?? ''}
                                      fil={item.note_fil ?? ''}
                                      className="text-[13px] text-gray-500"
                                    />
                                  )}
                                  {item.reference && (
                                    <span className="text-[12px] font-medium text-gray-500">
                                      Ref: {item.reference}
                                    </span>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {!item.is_scored ? (
                                      <Chip tone="grey">Group heading</Chip>
                                    ) : pillarChip ? (
                                      <Chip tone={pillarChip.tone}>{pillarChip.label}</Chip>
                                    ) : (
                                      <Chip tone="red">No pillar</Chip>
                                    )}
                                    {item.is_scored && item.safe_answer === 'no' && (
                                      <Chip tone="amber">Safe: No</Chip>
                                    )}
                                    {itemArea && (
                                      <Chip tone="neutral">Area: {itemArea.name_en}</Chip>
                                    )}
                                    {item.min_floors !== null && (
                                      <Chip tone="neutral">≥ {item.min_floors} floors</Chip>
                                    )}
                                    {item.flag_label && (
                                      <Chip tone="amber" dot>
                                        {item.flag_label}
                                      </Chip>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <RowActions>
                                {!item.is_scored && isDraft && (
                                  <IconAction
                                    label={`Add sub-item under ${label}`}
                                    icon={<Plus size={17} aria-hidden />}
                                    onClick={() => {
                                      setAddingToSection({
                                        sectionId: section.id,
                                        parentId: item.id,
                                      });
                                      setEditingItemId(null);
                                    }}
                                  />
                                )}
                                <IconAction
                                  label={isDraft ? `Edit ${label}` : `Edit ${label} wording`}
                                  icon={<Pencil size={17} aria-hidden />}
                                  onClick={() => {
                                    setEditingItemId(editingItemId === item.id ? null : item.id);
                                    setAddingToSection(null);
                                  }}
                                />
                                {isDraft && (
                                  <>
                                    <IconAction
                                      label={`Move ${label} up`}
                                      icon={<ArrowUp size={17} aria-hidden />}
                                      disabled={siblingIdx <= 0 || reorderItem.isPending}
                                      onClick={() =>
                                        reorderItem.mutate(
                                          { id: item.id, direction: 'up' },
                                          { onError: (err) => toast.error(err.message) }
                                        )
                                      }
                                    />
                                    <IconAction
                                      label={`Move ${label} down`}
                                      icon={<ArrowDown size={17} aria-hidden />}
                                      disabled={
                                        siblingIdx < 0 ||
                                        siblingIdx >= siblings.length - 1 ||
                                        reorderItem.isPending
                                      }
                                      onClick={() =>
                                        reorderItem.mutate(
                                          { id: item.id, direction: 'down' },
                                          { onError: (err) => toast.error(err.message) }
                                        )
                                      }
                                    />
                                    <IconAction
                                      label={`Delete ${label}`}
                                      icon={<Trash2 size={17} aria-hidden />}
                                      onClick={() => setDeletingItem({ section, item })}
                                    />
                                  </>
                                )}
                              </RowActions>
                            </div>

                            {editingItemId === item.id && (
                              <ItemEditor
                                section={section}
                                isDraft={isDraft}
                                item={item}
                                areaTypes={areaTypes}
                                onSaved={() => setEditingItemId(null)}
                                onCancel={() => setEditingItemId(null)}
                              />
                            )}

                            {addingToSection?.sectionId === section.id &&
                              addingToSection.parentId === item.id && (
                                <ItemEditor
                                  section={section}
                                  isDraft={isDraft}
                                  defaultParentId={item.id}
                                  areaTypes={areaTypes}
                                  onSaved={() => setAddingToSection(null)}
                                  onCancel={() => setAddingToSection(null)}
                                />
                              )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      {/* Building area types */}
      <AreaTypesSection areaTypes={areaTypes} />

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={publishing}
        onClose={() => setPublishing(false)}
        onConfirm={() =>
          publish.mutate(version.version_id, {
            onSuccess: () => {
              toast.success(`${version.label} is now published`);
              setPublishing(false);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={publish.isPending}
        tone="success"
        confirmVariant="primary"
        icon={<CheckCircle2 size={20} aria-hidden />}
        title="Publish this checklist version?"
        name={version.label}
        body="will become the active checklist for new building assessments. The current published version will be retired, while past assessments keep the version they were answered with."
        confirmLabel="Publish version"
      />

      <ConfirmDialog
        open={deletingDraft}
        onClose={() => setDeletingDraft(false)}
        onConfirm={() =>
          deleteDraft.mutate(version.version_id, {
            onSuccess: () => {
              toast.success(`${version.label} deleted`);
              setDeletingDraft(false);
              router.replace(pathname, { scroll: false });
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteDraft.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this draft version?"
        name={version.label}
        body="and all of its sections and questions will be permanently deleted. Published and retired versions are untouched."
        confirmLabel="Delete draft"
      />

      <ConfirmDialog
        open={!!deletingSection}
        onClose={() => setDeletingSection(null)}
        onConfirm={() =>
          deletingSection &&
          deleteSection.mutate(deletingSection.id, {
            onSuccess: () => {
              toast.success(`Section ${deletingSection.code} deleted`);
              setDeletingSection(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteSection.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this section?"
        name={
          deletingSection ? `Section ${deletingSection.code} (${deletingSection.title_en})` : ''
        }
        body="and all of its questions in this draft version will be deleted."
        confirmLabel="Delete section"
      />

      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={() =>
          deletingItem &&
          deleteItem.mutate(deletingItem.item.id, {
            onSuccess: () => {
              toast.success(`${itemLabel(deletingItem.section, deletingItem.item)} deleted`);
              setDeletingItem(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteItem.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this question?"
        name={deletingItem ? itemLabel(deletingItem.section, deletingItem.item) : ''}
        body="will be removed from this draft version (along with any sub-items under it)."
        confirmLabel="Delete question"
      />
    </>
  );
}

function AreaTypesSection({ areaTypes }: { areaTypes: EditableAreaType[] }) {
  const upsertArea = useUpsertAreaType();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleActive = (area: EditableAreaType, isActive: boolean) => {
    upsertArea.mutate(
      {
        id: area.id,
        code: area.code,
        name_en: area.name_en,
        name_fil: area.name_fil,
        is_active: isActive,
      },
      {
        onSuccess: () =>
          toast.success(`${area.name_en} is now ${isActive ? 'active' : 'inactive'}`),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-5 md:p-6">
      <CardHeading
        title="Building area types"
        aside={
          !adding ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
            >
              <Plus size={15} aria-hidden />
              Add area type
            </Button>
          ) : undefined
        }
      />
      <p className="text-[14px] leading-[1.45] text-pretty text-gray-600">
        Areas shown on the &ldquo;About the building&rdquo; pre-screen step. Turning an area off
        hides it from new assessments while keeping past assessments intact.
      </p>

      {adding && (
        <AreaTypeEditor onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
      )}

      <ul className="flex flex-col border-t border-line">
        {areaTypes.map((area) => (
          <li
            key={area.id}
            className="flex flex-col gap-2 border-b border-line py-3.5 last:border-b-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-[1_1_200px] items-start gap-3">
                <Mono className="rounded-lg bg-gray-100 px-2 py-0.5 text-[12px] font-semibold text-gray-600">
                  {area.code}
                </Mono>
                <Bilingual
                  en={area.name_en}
                  fil={area.name_fil}
                  className={cn(
                    'min-w-0 flex-1 text-[15px] leading-[1.4] font-semibold',
                    !area.is_active && 'text-gray-400'
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={area.is_active}
                  label={`${area.name_en} active`}
                  onChange={(v) => toggleActive(area, v)}
                />
                <IconAction
                  label={`Edit ${area.name_en}`}
                  icon={<Pencil size={17} aria-hidden />}
                  onClick={() => {
                    setEditingId(editingId === area.id ? null : area.id);
                    setAdding(false);
                  }}
                />
              </div>
            </div>
            {editingId === area.id && (
              <AreaTypeEditor
                area={area}
                onSaved={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
