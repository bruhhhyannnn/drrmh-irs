---
type: module
module: checklist-editor
paths:
  - src/actions/assessment-templates
  - src/components/hooks/use-assessment-templates.ts
  - src/app/(admin)/assessments/checklist
tags: [module]
---

# Checklist editor

Super Admins edit the MATATAG checklist at `/assessments/checklist`. Wording fixes apply in place on any version, so old and new assessments both see them. Structural changes (add, remove, reorder, gating, pillar) only work on a `draft` version, which is then published and retires the previous published one. The same page manages the building area types.

**Related:** [[architecture]] · [[assessments]] · [[assessment-admin]] · [[building-safety]] · [[data-layer]] · [[auth-and-profiles]]

## Where it lives

| Path                                                            | What it holds                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/actions/assessment-templates/index.ts`                     | All editor server actions                                                                                          |
| `src/components/hooks/use-assessment-templates.ts`              | `useChecklistEditor` and one mutation hook per action                                                              |
| `src/app/(admin)/assessments/checklist/page.tsx`                | `ChecklistEditorPage`: version picker (`?version=`), sections, items, publish/delete draft, `AreaTypesSection`     |
| `src/app/(admin)/assessments/checklist/_components/editors.tsx` | `NewDraftForm`, `SectionEditor`, `ItemEditor`, `AreaTypeEditor` (wording-only and full forms)                      |
| `src/lib/assessment-template.ts`                                | `orderSectionItems`, `moveItemInSection`, `canPublishTemplate`, `itemLabel`, `ChecklistEditorData`                 |
| `src/lib/schemas.ts`                                            | `draftVersionSchema`, `sectionWordingSchema`, `sectionSchema`, `itemWordingSchema`, `itemSchema`, `areaTypeSchema` |

## Data

- `AssessmentTemplate` (`assessment_templates`): `code`, `name`.
- `AssessmentTemplateVersion` (`assessment_template_versions`): `label` (unique per template), `status` (`draft` / `published` / `retired`), `published_at`, `published_by`, `created_by`. Only one `published` per template (partial unique index `uq_template_versions_one_published`).
- `AssessmentSection` (`assessment_sections`): `code` (unique per version), `title_en`, `title_fil`, `sort_order`, `area_type_id` (section needs that area).
- `AssessmentItem` (`assessment_items`): `parent_id`, `code`, `prompt_en/fil`, `note_en/fil`, `reference`, `is_scored`, `safe_answer`, `area_type_id`, `min_floors`, `flag_label`, `pillar_id`, `sort_order`. CHECK `chk_assessment_items_pillar`: scored items have a pillar, group parents don't.
- `BuildingAreaType` (`building_area_types`): `code`, `name_en`, `name_fil`, `sort_order`, `is_active`. Shared across versions.
- `DrrmPillar` (`drrm_pillars`): looked up by `code` when an item's pillar is set.

## Server actions

`src/actions/assessment-templates/index.ts`. Every action calls the local `requireSuperAdmin(token)` (`requireAdmin` plus `scope.role === 'super_admin'`). Mutations return `TemplateActionResult` (`{ ok: true, id? }` or `{ ok: false, error }`) and call `revalidateChecklist()`.

- `getTemplateVersions(token, versionId?)`: all versions with assessment counts, all area types, and the chosen version's tree (default: the published one).
- `updateSectionTitle(token, sectionId, input)`: title wording, any version.
- `updateItemWording(token, itemId, input)`: prompt, note and reference wording, any version.
- `createDraftVersion(token, input)`: copies a version's sections and items (parents first, then sub-items) into a new `draft` with a new label.
- `publishVersion(token, versionId)`: draft only; checks `canPublishTemplate`, then retires the current published version and publishes this one in a transaction.
- `deleteDraftVersion(token, versionId)`: draft only.
- `upsertSection(token, input)`, `deleteSection(token, sectionId)`, `reorderSection(token, sectionId, direction)`: draft only.
- `upsertItem(token, input)`, `deleteItem(token, itemId)`, `reorderItem(token, itemId, direction)`: draft only. Re-numbers the section with `orderSectionItems`.
- `upsertAreaType(token, input)`: create or edit an area type (`is_active` instead of delete).

## Client side

- Route `/assessments/checklist`, `?version=<id>` picks the version. Reached from the "Edit checklist" button on `/assessments`.
- Hooks: `useChecklistEditor`, `useUpdateSectionTitle`, `useUpdateItemWording`, `useCreateDraftVersion`, `usePublishVersion`, `useDeleteDraftVersion`, `useUpsertSection`, `useDeleteSection`, `useReorderSection`, `useUpsertItem`, `useDeleteItem`, `useReorderItem`, `useUpsertAreaType`.
- Every mutation invalidates `checklist-editor`, `assessment-template`, `assessment-template-version`, `admin-assessment`, `my-assessment`, then re-fetches the published template into the IndexedDB `assessment-cache` (`template:published` and `template:<version_id>`).
- On a non-draft version the page shows only "Edit title" / wording edits; structural buttons need `isDraft`.

## Rules and gotchas

- Wording edits do not check the version status: they change the text of retired and published versions in place, on purpose.
- Any structural change on a published version is refused with `DRAFT_ONLY`. Create a draft first.
- Publishing needs at least one scored question and a pillar on every scored question.
- A group heading with sub-items can't become scored, and can't become a sub-item. A parent must be an unscored top-level item.
- `revalidateChecklist()` calls `clearVersionCache()` so `loadVersion` (60 s cache) sees the change at once.
- Inactive area types drop out of the template the form sees (`loadVersion` loads `is_active: true` only).
- Item ids in a published version must stay stable: drafts on phones refer to them. Never re-create items of a published version.
- The page is in `SUPER_ADMIN_HREFS`; the admin shell blocks Administrators, and the actions refuse them too.

## Decisions

- [[0006-versioned-checklist-template]] wording in place vs draft/publish for structure.
- [[0007-token-verified-actions]] every action verifies the token and the Super Admin role on the server.
- [[0001-server-actions-only]] edits go only through `src/actions/assessment-templates`.
- [[0002-manual-sql-schema-changes]] the template tables and their constraints come from `prisma/manual/DRRM-015-assessment.sql`.
