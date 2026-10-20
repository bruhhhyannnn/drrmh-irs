import type { ChecklistData, ChecklistItemData } from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { MATATAG_2025_07_25 } from './data/matatag-2025-07-25';

// Seeds the MATATAG checklist: the four DRRM pillars, the building area types, the template, its
// version and every section and item, from prisma/data/matatag-2025-07-25.ts.
//
// Safe to re-run (`npm run seed:matatag`): everything is matched by code, rows are updated only
// when a field differs and never deleted, so item ids stay the same — drafts on phones refer to
// them. A version that already has assessments is left as it is. Kept apart from prisma/seed.ts,
// which creates its events and reports again on every run.
//
// Uses DATABASE_URL: from the environment, else .env.development.local, else .env.

config({ path: ['.env.development.local', '.env'], quiet: true });

type Counts = { created: number; updated: number; unchanged: number };

/** Field-by-field comparison, so an unchanged row isn't written. */
function differs(row: Record<string, unknown>, fields: Record<string, unknown>) {
  return Object.entries(fields).some(([key, value]) => row[key] !== value);
}

async function seed(prisma: PrismaClient, data: ChecklistData) {
  const counts: Counts = { created: 0, updated: 0, unchanged: 0 };

  // 1. Pillars and area types ──────────────────────────────────────────────
  for (const [k, pillar] of PILLARS.entries()) {
    await prisma.drrmPillar.upsert({
      where: { code: pillar.slug },
      create: { code: pillar.slug, name: pillar.name, sort_order: k },
      update: { name: pillar.name, sort_order: k },
    });
  }
  for (const [k, area] of data.areaTypes.entries()) {
    const fields = { name_en: area.en, name_fil: area.fil, sort_order: k };
    await prisma.buildingAreaType.upsert({
      where: { code: area.code },
      create: { code: area.code, ...fields },
      update: fields,
    });
  }
  const pillarIds = Object.fromEntries(
    (await prisma.drrmPillar.findMany()).map((p) => [p.code, p.id])
  );
  const areaIds = Object.fromEntries(
    (await prisma.buildingAreaType.findMany()).map((a) => [a.code, a.id])
  );

  // 2. Template and version ────────────────────────────────────────────────
  const template = await prisma.assessmentTemplate.upsert({
    where: { code: data.template.code },
    create: data.template,
    update: { name: data.template.name, description: data.template.description },
  });
  let version = await prisma.assessmentTemplateVersion.findUnique({
    where: { template_id_label: { template_id: template.id, label: data.versionLabel } },
  });
  if (!version) {
    const published = await prisma.assessmentTemplateVersion.count({
      where: { template_id: template.id, status: 'published' },
    });
    version = await prisma.assessmentTemplateVersion.create({
      data: {
        template_id: template.id,
        label: data.versionLabel,
        status: published ? 'draft' : 'published',
        published_at: published ? null : new Date(),
      },
    });
    console.log(`  version "${version.label}": created (${version.status})`);
  } else {
    console.log(`  version "${version.label}": exists (${version.status})`);
  }

  const inUse = await prisma.assessment.count({ where: { template_version_id: version.id } });
  if (inUse > 0) {
    console.log(`  in use by ${inUse} assessments, left as is`);
    return version.id;
  }

  // 3. Sections and items, matched by code path ────────────────────────────
  const existing = await prisma.assessmentSection.findMany({
    where: { version_id: version.id },
    include: { items: true },
  });

  for (const [sectionOrder, section] of data.sections.entries()) {
    const sectionFields = {
      title_en: section.en,
      title_fil: section.fil,
      sort_order: sectionOrder,
      area_type_id: section.area ? areaIds[section.area] : null,
    };
    let row = existing.find((s) => s.code === section.code);
    if (!row) {
      const created = await prisma.assessmentSection.create({
        data: { version_id: version.id, code: section.code, ...sectionFields },
      });
      row = { ...created, items: [] };
      counts.created += 1;
    } else if (differs(row, sectionFields)) {
      await prisma.assessmentSection.update({ where: { id: row.id }, data: sectionFields });
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
    const sectionId = row.id;

    // Sort order runs through the section, each group parent right before its sub-items.
    const order = new Map<ChecklistItemData, number>();
    let next = 0;
    for (const item of section.items) {
      order.set(item, next++);
      for (const child of item.items ?? []) order.set(child, next++);
    }
    const itemFields = (item: ChecklistItemData) => ({
      prompt_en: item.en,
      prompt_fil: item.fil,
      reference: item.reference ?? null,
      is_scored: !item.items,
      safe_answer: item.safe ?? ('yes' as const),
      area_type_id: item.area ? areaIds[item.area] : null,
      min_floors: item.minFloors ?? null,
      flag_label: item.flag ?? null,
      pillar_id: item.items ? null : pillarIds[item.pillar!],
      sort_order: order.get(item)!,
    });

    const rows = [...row.items];
    const find = (parentId: string | null, code: string) =>
      rows.find((r) => r.parent_id === parentId && r.code === code);

    /** Updates the ones that exist, creates the rest in one call; returns code → id. */
    const sync = async (list: ChecklistItemData[], parentId: string | null) => {
      const ids = new Map<string, string>();
      const missing: ChecklistItemData[] = [];
      for (const item of list) {
        const found = find(parentId, item.code);
        if (!found) {
          missing.push(item);
          continue;
        }
        ids.set(item.code, found.id);
        const fields = itemFields(item);
        if (differs(found, fields)) {
          await prisma.assessmentItem.update({ where: { id: found.id }, data: fields });
          counts.updated += 1;
        } else {
          counts.unchanged += 1;
        }
      }
      if (missing.length > 0) {
        const created = await prisma.assessmentItem.createManyAndReturn({
          data: missing.map((item) => ({
            section_id: sectionId,
            parent_id: parentId,
            code: item.code,
            ...itemFields(item),
          })),
        });
        for (const c of created) ids.set(c.code, c.id);
        counts.created += created.length;
      }
      return ids;
    };

    const topIds = await sync(section.items, null);
    for (const item of section.items) {
      if (item.items) await sync(item.items, topIds.get(item.code)!);
    }

    const known = new Set(
      section.items.flatMap((i) => [i.code, ...(i.items ?? []).map((c) => c.code)])
    );
    for (const extra of row.items.filter((r) => !known.has(r.code))) {
      console.warn(`  warning: ${section.code}.${extra.code} is in the database, not in the data`);
    }
  }

  console.log(
    `  sections + items: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged`
  );
  return version.id;
}

/** What the database now holds for the version, for checking against the spec. */
async function report(prisma: PrismaClient, versionId: string) {
  const sections = await prisma.assessmentSection.findMany({
    where: { version_id: versionId },
    orderBy: { sort_order: 'asc' },
    include: {
      items: { select: { id: true, is_scored: true, pillar: { select: { code: true } } } },
    },
  });
  const items = sections.flatMap((s) => s.items);
  const scored = items.filter((i) => i.is_scored);

  console.log(
    '  scored per section:',
    sections.map((s) => `${s.code} ${s.items.filter((i) => i.is_scored).length}`).join(', ')
  );
  console.log(
    '  scored per pillar:',
    PILLARS.map((p) => `${p.slug} ${scored.filter((i) => i.pillar?.code === p.slug).length}`).join(
      ', '
    )
  );
  console.log(
    `  total: ${sections.length} sections, ${scored.length} scored, ${items.length} items`
  );
  const fingerprint = createHash('sha1')
    .update(
      items
        .map((i) => i.id)
        .sort()
        .join(',')
    )
    .digest('hex')
    .slice(0, 12);
  console.log(`  item id fingerprint: ${fingerprint}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  console.log(`Seeding MATATAG into ${new URL(url).host}…`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const versionId = await seed(prisma, MATATAG_2025_07_25);
    await report(prisma, versionId);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
