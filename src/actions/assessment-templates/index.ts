'use server';

import { loadVersion } from '@/lib/assessment-records';
import {
  canPublishTemplate,
  moveItemInSection,
  orderSectionItems,
  type ChecklistEditorData,
  type TemplateActionResult,
} from '@/lib/assessment-template';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
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
import { requireAdmin } from '@/lib/server-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Super Admin checklist editor (DRRM-015 Phase 3). Wording fixes (titles, prompts, notes,
// references) apply in place on any version so typos are fixed on old and new assessments alike.
// Structural edits (adding, removing, reordering, gating, pillars) are allowed only on a `draft`
// version, which is then published to replace the active one.

const isUuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;

const fail = (error: string): TemplateActionResult => ({ ok: false, error });

const DRAFT_ONLY =
  'Only a draft version can be changed structurally. Create a draft version first.';

async function requireSuperAdmin(token: string | null) {
  const caller = await requireAdmin(token);
  if (!caller.ok || caller.scope.role !== 'super_admin') return null;
  return caller.profile;
}

function revalidateChecklist() {
  revalidatePath('/assessments/checklist');
  revalidatePath('/assessments');
  revalidatePath('/assessment');
}

/** Versions with status and assessment counts, all area types, and the chosen version's tree. */
export async function getTemplateVersions(
  token: string | null,
  versionId?: string | null
): Promise<ChecklistEditorData | null> {
  if (!(await requireSuperAdmin(token))) return null;

  const [versions, areaTypes] = await Promise.all([
    prisma.assessmentTemplateVersion.findMany({
      orderBy: [{ created_at: 'desc' }],
      include: { _count: { select: { assessments: true } } },
    }),
    prisma.buildingAreaType.findMany({ orderBy: { sort_order: 'asc' } }),
  ]);

  const target =
    (isUuid(versionId) && versions.find((v) => v.id === versionId)) ||
    versions.find((v) => v.status === 'published') ||
    versions[0] ||
    null;

  const loaded = target ? await loadVersion({ id: target.id }) : null;

  return {
    versions: versions.map((v) => ({
      id: v.id,
      label: v.label,
      status: v.status,
      published_at: v.published_at?.toISOString() ?? null,
      created_at: v.created_at.toISOString(),
      assessment_count: v._count.assessments,
    })),
    area_types: areaTypes.map((a) => ({
      id: a.id,
      code: a.code,
      name_en: a.name_en,
      name_fil: a.name_fil,
      sort_order: a.sort_order,
      is_active: a.is_active,
    })),
    version:
      target && loaded
        ? {
            ...loaded.template,
            status: target.status,
            assessment_count: target._count.assessments,
          }
        : null,
  };
}

/* ─── Wording edits (allowed on published and draft versions) ─── */

export async function updateSectionTitle(
  token: string | null,
  sectionId: string,
  input: SectionWordingFormData
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(sectionId)) return fail('This section could not be found.');
  const parsed = sectionWordingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the section title.');

  try {
    await prisma.assessmentSection.update({
      where: { id: sectionId },
      data: parsed.data,
    });
  } catch (err) {
    return fail(toFriendlyError(err, 'section').message);
  }
  revalidateChecklist();
  return { ok: true, id: sectionId };
}

export async function updateItemWording(
  token: string | null,
  itemId: string,
  input: ItemWordingFormData
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(itemId)) return fail('This question could not be found.');
  const parsed = itemWordingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the question text.');

  try {
    await prisma.assessmentItem.update({
      where: { id: itemId },
      data: parsed.data,
    });
  } catch (err) {
    return fail(toFriendlyError(err, 'question').message);
  }
  revalidateChecklist();
  return { ok: true, id: itemId };
}

/* ─── Version lifecycle (draft, publish, delete draft) ─── */

export async function createDraftVersion(
  token: string | null,
  input: DraftVersionFormData
): Promise<TemplateActionResult> {
  const profile = await requireSuperAdmin(token);
  if (!profile) return fail('Only a super admin can create a checklist version.');
  const parsed = draftVersionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Enter a version label.');

  const source = await prisma.assessmentTemplateVersion.findUnique({
    where: { id: parsed.data.from_version_id },
    include: {
      sections: {
        orderBy: { sort_order: 'asc' },
        include: { items: { orderBy: { sort_order: 'asc' } } },
      },
    },
  });
  if (!source) return fail('The version to copy from could not be found.');

  try {
    const createdId = await prisma.$transaction(async (tx) => {
      const version = await tx.assessmentTemplateVersion.create({
        data: {
          template_id: source.template_id,
          label: parsed.data.label,
          status: 'draft',
          created_by: profile.id,
        },
        select: { id: true },
      });

      for (const section of source.sections) {
        const createdSection = await tx.assessmentSection.create({
          data: {
            version_id: version.id,
            code: section.code,
            title_en: section.title_en,
            title_fil: section.title_fil,
            sort_order: section.sort_order,
            area_type_id: section.area_type_id,
          },
          select: { id: true },
        });

        const topItems = section.items.filter((i) => i.parent_id === null);
        const parentMap = new Map<string, string>();
        for (const item of topItems) {
          const createdItem = await tx.assessmentItem.create({
            data: {
              section_id: createdSection.id,
              parent_id: null,
              code: item.code,
              prompt_en: item.prompt_en,
              prompt_fil: item.prompt_fil,
              note_en: item.note_en,
              note_fil: item.note_fil,
              reference: item.reference,
              is_scored: item.is_scored,
              safe_answer: item.safe_answer,
              area_type_id: item.area_type_id,
              min_floors: item.min_floors,
              flag_label: item.flag_label,
              pillar_id: item.pillar_id,
              sort_order: item.sort_order,
            },
            select: { id: true },
          });
          parentMap.set(item.id, createdItem.id);
        }

        const subItems = section.items.filter((i) => i.parent_id !== null);
        if (subItems.length > 0) {
          await tx.assessmentItem.createMany({
            data: subItems.map((item) => ({
              section_id: createdSection.id,
              parent_id: parentMap.get(item.parent_id!) ?? null,
              code: item.code,
              prompt_en: item.prompt_en,
              prompt_fil: item.prompt_fil,
              note_en: item.note_en,
              note_fil: item.note_fil,
              reference: item.reference,
              is_scored: item.is_scored,
              safe_answer: item.safe_answer,
              area_type_id: item.area_type_id,
              min_floors: item.min_floors,
              flag_label: item.flag_label,
              pillar_id: item.pillar_id,
              sort_order: item.sort_order,
            })),
          });
        }
      }
      return version.id;
    });
    revalidateChecklist();
    return { ok: true, id: createdId };
  } catch (err) {
    return fail(toFriendlyError(err, 'checklist version').message);
  }
}

export async function publishVersion(
  token: string | null,
  versionId: string
): Promise<TemplateActionResult> {
  const profile = await requireSuperAdmin(token);
  if (!profile) return fail('Only a super admin can publish a checklist version.');
  if (!isUuid(versionId)) return fail('This checklist version could not be found.');

  const row = await prisma.assessmentTemplateVersion.findUnique({
    where: { id: versionId },
    select: { id: true, template_id: true, status: true },
  });
  if (!row) return fail('This checklist version could not be found.');
  if (row.status !== 'draft') return fail('Only a draft version can be published.');

  const loaded = await loadVersion({ id: versionId });
  if (!loaded) return fail('This checklist version could not be found.');
  const check = canPublishTemplate(loaded.template.sections);
  if (!check.ok) return check;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assessmentTemplateVersion.updateMany({
        where: { template_id: row.template_id, status: 'published' },
        data: { status: 'retired' },
      });
      await tx.assessmentTemplateVersion.update({
        where: { id: versionId },
        data: {
          status: 'published',
          published_at: new Date(),
          published_by: profile.id,
        },
      });
    });
  } catch (err) {
    return fail(toFriendlyError(err, 'checklist version').message);
  }
  revalidateChecklist();
  return { ok: true, id: versionId };
}

export async function deleteDraftVersion(
  token: string | null,
  versionId: string
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) {
    return fail('Only a super admin can delete a draft version.');
  }
  if (!isUuid(versionId)) return fail('This checklist version could not be found.');

  const row = await prisma.assessmentTemplateVersion.findUnique({
    where: { id: versionId },
    select: { status: true },
  });
  if (!row) return fail('This checklist version could not be found.');
  if (row.status !== 'draft') return fail('Only a draft version can be deleted.');

  try {
    await prisma.assessmentTemplateVersion.delete({ where: { id: versionId } });
  } catch (err) {
    return fail(toFriendlyError(err, 'checklist version').message);
  }
  revalidateChecklist();
  return { ok: true };
}

/* ─── Structural edits (draft versions only) ─── */

export async function upsertSection(
  token: string | null,
  input: SectionFormData & { version_id: string; id?: string }
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(input.version_id)) return fail('This checklist version could not be found.');
  if (input.id !== undefined && !isUuid(input.id)) return fail('This section could not be found.');

  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the section details.');

  const version = await prisma.assessmentTemplateVersion.findUnique({
    where: { id: input.version_id },
    select: { status: true, _count: { select: { sections: true } } },
  });
  if (!version) return fail('This checklist version could not be found.');
  if (version.status !== 'draft') return fail(DRAFT_ONLY);

  try {
    if (input.id) {
      const existing = await prisma.assessmentSection.findUnique({
        where: { id: input.id },
        select: { version_id: true },
      });
      if (!existing || existing.version_id !== input.version_id) {
        return fail('This section could not be found.');
      }
      await prisma.assessmentSection.update({
        where: { id: input.id },
        data: {
          code: parsed.data.code,
          title_en: parsed.data.title_en,
          title_fil: parsed.data.title_fil,
          area_type_id: parsed.data.area_type_id ?? null,
        },
      });
      revalidateChecklist();
      return { ok: true, id: input.id };
    }

    const created = await prisma.assessmentSection.create({
      data: {
        version_id: input.version_id,
        code: parsed.data.code,
        title_en: parsed.data.title_en,
        title_fil: parsed.data.title_fil,
        area_type_id: parsed.data.area_type_id ?? null,
        sort_order: version._count.sections,
      },
      select: { id: true },
    });
    revalidateChecklist();
    return { ok: true, id: created.id };
  } catch (err) {
    return fail(toFriendlyError(err, 'section').message);
  }
}

export async function deleteSection(
  token: string | null,
  sectionId: string
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(sectionId)) return fail('This section could not be found.');

  const section = await prisma.assessmentSection.findUnique({
    where: { id: sectionId },
    select: { version_id: true, version: { select: { status: true } } },
  });
  if (!section) return fail('This section could not be found.');
  if (section.version.status !== 'draft') return fail(DRAFT_ONLY);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assessmentSection.delete({ where: { id: sectionId } });
      const remaining = await tx.assessmentSection.findMany({
        where: { version_id: section.version_id },
        orderBy: { sort_order: 'asc' },
        select: { id: true },
      });
      for (const [k, row] of remaining.entries()) {
        await tx.assessmentSection.update({ where: { id: row.id }, data: { sort_order: k } });
      }
    });
  } catch (err) {
    return fail(toFriendlyError(err, 'section').message);
  }
  revalidateChecklist();
  return { ok: true };
}

export async function reorderSection(
  token: string | null,
  sectionId: string,
  direction: 'up' | 'down'
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(sectionId)) return fail('This section could not be found.');

  const section = await prisma.assessmentSection.findUnique({
    where: { id: sectionId },
    select: { version_id: true, version: { select: { status: true } } },
  });
  if (!section) return fail('This section could not be found.');
  if (section.version.status !== 'draft') return fail(DRAFT_ONLY);

  const list = await prisma.assessmentSection.findMany({
    where: { version_id: section.version_id },
    orderBy: { sort_order: 'asc' },
    select: { id: true },
  });
  const idx = list.findIndex((s) => s.id === sectionId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return { ok: true };

  [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
  await prisma.$transaction(
    list.map((s, k) =>
      prisma.assessmentSection.update({ where: { id: s.id }, data: { sort_order: k } })
    )
  );
  revalidateChecklist();
  return { ok: true };
}

export async function upsertItem(
  token: string | null,
  input: ItemFormData & { section_id: string; id?: string }
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(input.section_id)) return fail('This section could not be found.');
  if (input.id !== undefined && !isUuid(input.id)) return fail('This question could not be found.');

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the question fields.');
  const data = parsed.data;

  const section = await prisma.assessmentSection.findUnique({
    where: { id: input.section_id },
    include: {
      version: { select: { status: true } },
      items: {
        orderBy: { sort_order: 'asc' },
        select: { id: true, parent_id: true, is_scored: true, sort_order: true },
      },
    },
  });
  if (!section) return fail('This section could not be found.');
  if (section.version.status !== 'draft') return fail(DRAFT_ONLY);

  const parentId = data.parent_id ?? null;
  if (parentId) {
    const parent = section.items.find((i) => i.id === parentId);
    if (!parent || parent.parent_id !== null || parent.is_scored) {
      return fail('Choose a group heading in this section.');
    }
  }

  let pillarId: string | null = null;
  if (data.is_scored && data.pillar_code) {
    const pillar = await prisma.drrmPillar.findUnique({
      where: { code: data.pillar_code },
      select: { id: true },
    });
    if (!pillar) return fail('Choose a valid DRRM pillar.');
    pillarId = pillar.id;
  }

  const fields = {
    parent_id: parentId,
    code: data.code,
    prompt_en: data.prompt_en,
    prompt_fil: data.prompt_fil,
    note_en: data.note_en ?? null,
    note_fil: data.note_fil ?? null,
    reference: data.reference ?? null,
    is_scored: data.is_scored,
    safe_answer: data.safe_answer,
    area_type_id: data.area_type_id ?? null,
    min_floors: data.min_floors ?? null,
    flag_label: data.flag_label ?? null,
    pillar_id: pillarId,
  };

  try {
    const savedId = await prisma.$transaction(async (tx) => {
      let itemId = input.id;
      if (itemId) {
        const current = section.items.find((i) => i.id === itemId);
        if (!current) throw new Error('This question could not be found.');
        const hasChildren = section.items.some((i) => i.parent_id === itemId);
        if (hasChildren && data.is_scored) {
          throw new Error('Remove its sub-items before making this a scored question.');
        }
        if (hasChildren && parentId) {
          throw new Error('A group heading with sub-items cannot become a sub-item.');
        }
        await tx.assessmentItem.update({ where: { id: itemId }, data: fields });
      } else {
        const created = await tx.assessmentItem.create({
          data: {
            section_id: section.id,
            ...fields,
            sort_order: section.items.length,
          },
          select: { id: true },
        });
        itemId = created.id;
      }

      const allItems = await tx.assessmentItem.findMany({
        where: { section_id: section.id },
        orderBy: { sort_order: 'asc' },
        select: { id: true, parent_id: true, sort_order: true },
      });
      const ordered = orderSectionItems(allItems);
      for (const row of ordered) {
        await tx.assessmentItem.update({
          where: { id: row.id },
          data: { sort_order: row.sort_order },
        });
      }
      return itemId!;
    });

    revalidateChecklist();
    return { ok: true, id: savedId };
  } catch (err) {
    return fail(toFriendlyError(err, 'question').message);
  }
}

export async function deleteItem(
  token: string | null,
  itemId: string
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(itemId)) return fail('This question could not be found.');

  const item = await prisma.assessmentItem.findUnique({
    where: { id: itemId },
    select: {
      section_id: true,
      section: { select: { version: { select: { status: true } } } },
    },
  });
  if (!item) return fail('This question could not be found.');
  if (item.section.version.status !== 'draft') return fail(DRAFT_ONLY);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assessmentItem.delete({ where: { id: itemId } });
      const remaining = await tx.assessmentItem.findMany({
        where: { section_id: item.section_id },
        orderBy: { sort_order: 'asc' },
        select: { id: true, parent_id: true, sort_order: true },
      });
      for (const row of orderSectionItems(remaining)) {
        await tx.assessmentItem.update({
          where: { id: row.id },
          data: { sort_order: row.sort_order },
        });
      }
    });
  } catch (err) {
    return fail(toFriendlyError(err, 'question').message);
  }
  revalidateChecklist();
  return { ok: true };
}

export async function reorderItem(
  token: string | null,
  itemId: string,
  direction: 'up' | 'down'
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit the checklist.');
  if (!isUuid(itemId)) return fail('This question could not be found.');

  const item = await prisma.assessmentItem.findUnique({
    where: { id: itemId },
    select: {
      section: {
        select: {
          version: { select: { status: true } },
          items: {
            orderBy: { sort_order: 'asc' },
            select: { id: true, parent_id: true, sort_order: true },
          },
        },
      },
    },
  });
  if (!item) return fail('This question could not be found.');
  if (item.section.version.status !== 'draft') return fail(DRAFT_ONLY);

  const ordered = moveItemInSection(item.section.items, itemId, direction);
  await prisma.$transaction(
    ordered.map((row) =>
      prisma.assessmentItem.update({
        where: { id: row.id },
        data: { sort_order: row.sort_order },
      })
    )
  );
  revalidateChecklist();
  return { ok: true };
}

/* ─── Building area types (global lookup) ─── */

export async function upsertAreaType(
  token: string | null,
  input: AreaTypeFormData & { id?: string }
): Promise<TemplateActionResult> {
  if (!(await requireSuperAdmin(token))) return fail('Only a super admin can edit area types.');
  if (input.id !== undefined && !isUuid(input.id))
    return fail('This area type could not be found.');

  const parsed = areaTypeSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Check the area type fields.');
  const data = parsed.data;

  try {
    if (input.id) {
      await prisma.buildingAreaType.update({
        where: { id: input.id },
        data: {
          code: data.code,
          name_en: data.name_en,
          name_fil: data.name_fil,
          is_active: data.is_active,
        },
      });
      revalidateChecklist();
      return { ok: true, id: input.id };
    }

    const count = await prisma.buildingAreaType.count();
    const created = await prisma.buildingAreaType.create({
      data: {
        code: data.code,
        name_en: data.name_en,
        name_fil: data.name_fil,
        is_active: data.is_active,
        sort_order: count,
      },
      select: { id: true },
    });
    revalidateChecklist();
    return { ok: true, id: created.id };
  } catch (err) {
    return fail(toFriendlyError(err, 'area type').message);
  }
}
