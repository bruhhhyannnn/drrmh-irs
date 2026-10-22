---
type: reference
tags: [glossary]
---

# Glossary

Terms used in the code, the UI and the plans.

**Related:** [[00-index]] · [[architecture]]

## Organisation and people

- **UPM**: University of the Philippines Manila.
- **DRRM-H**: Disaster Risk Reduction and Management in Health, the UPM office that owns this system.
- **IRS**: Incident Reporting System, this app.
- **ERT / ERT Member**: Emergency Response Team member. The default user type for new Google sign-ins. Files field reports and building assessments. → [[field-reports]], [[assessments]]
- **Administrator**: admin user type locked to one campus. → [[campus-scoping]]
- **Super Admin**: admin user type that can switch between campuses, edit the checklist and delete assessments.
- **Bystander**: anyone without an account who reports an emergency through the public QR form. → [[bystander-reports]]
- **User type**: the role lookup (`user_types`): ERT Member, Administrator, Super Admin. `isAdminUserType()` decides admin vs. not.
- **Position**: a user's job position, a lookup table.

## Places

- **Campus**: top-level scope (`campus` table). Most data carries `campus_id`.
- **Cluster**: a group of units within a campus (for example Pedro Gil, Padre Faura, Taft, SHS, PGH at UPM).
- **Unit**: a college, office or building group inside a cluster. Users and buildings belong to a unit.
- **Building**: a physical building under a unit, the subject of a MATATAG assessment. Keeps a profile (floors, building areas).
- **Building area / area type**: a kind of space in a building (for example corridors, bathrooms, offices) that decides which checklist items apply. → [[checklist-editor]]
- **Location**: free text and map coordinates on a report (`location_name`, `location_description`), not a lookup table.
- **Campus scope**: the campus chosen in the admin top-bar switcher (`useCampusScopeStore`). → [[campus-scoping]]

## Events and reports

- **Event**: a drill or a real incident that admins open, run and complete. Field reports are filed against an ongoing event. → [[events]]
- **Event status**: lookup seeded as `upcoming`, `ongoing`, `completed`.
- **Field report / status report**: an ERT member's report for one unit during an event: headcount, casualties, missing persons, damage. One per user per ongoing event. → [[field-reports]]
- **Headcount / population counts**: people accounted for, per population category.
- **Population category**: a headcount row (faculty, students, guests…), set up per campus (`CampusPopulationCategory`).
- **Casualty / missing person**: rows attached to a report, with a casualty condition.
- **Damage condition**: lookup for structural damage on a report.
- **Bystander report / emergency report**: a public report. The admin page is `/emergency-reports`, the table is `bystander_reports`.
- **Event summary**: the shared model that totals reports for an event, used by campus details, event details and the event PDF.

## Assessments

- **MATATAG**: _Monitoring and Assessment Tool for Area Threats and Accident Generators_, the UP Resilience Institute building safety checklist (Ver. July 25, 2025). → [[assessments]]
- **DRRM pillars**: the four pillars of RA 10121: Disaster Prevention and Mitigation, Disaster Preparedness, Disaster Response, Disaster Rehabilitation and Recovery (`src/lib/pillars.ts`, `DrrmPillar`). Every scored checklist item has one pillar.
- **Template / version**: the checklist lives as `AssessmentTemplate` → `AssessmentTemplateVersion` (`draft` | `published` | `retired`) → sections → items. Only one version is published at a time. → [[0006-versioned-checklist-template]]
- **Group parent**: an unscored item that holds a prompt shared by its child items.
- **Answer**: `yes` | `no` | `na` per item. Each item's `safe_answer` (`yes` by default) says which answer counts as safe. For some items "no" is the safe one.
- **Gating**: an item can need a building area type (`area_type_id`) or a minimum number of floors (`min_floors`) before it applies.
- **Checklist language**: prompts are stored in English and Filipino (`prompt_en` / `prompt_fil`). Each device picks one or both in My profile.
- **Pre-screen**: the first step of the form (building, floors, areas) that decides which items apply.
- **Draft (assessment)**: an assessment in progress, kept on the phone in IndexedDB by its `client_ref`.
- **`client_ref`**: the client-made id of a draft or queued submit, used to de-duplicate offline replays.
- **Pillar score / section score**: points per pillar and per section of one assessment.
- **Building safety**: the dashboard rollup Campus → Cluster → Unit → Building, with change since the last assessment and A/B comparison. → [[building-safety]]
- **Like-for-like change**: change in pooled score counted only over buildings assessed at least twice (latest vs. previous), so newly assessed buildings don't skew it (`poolBuildings` in `src/lib/building-safety.ts`).

## Tech

- **PWA**: the installable app with a service worker (next-pwa). → [[offline-pwa]]
- **Offline queue**: IndexedDB queues (field reports, bystander reports, assessments) replayed when back online. `failed` entries are never retried automatically.
- **Manual SQL**: a schema change file in `prisma/manual/`. → [[0002-manual-sql-schema-changes]]
- **Lookup table**: a small reference table (clusters, units, buildings, positions, casualty and damage conditions) edited on Settings. → [[settings-lookups]]
- **DS**: the design-system controls in `src/components/ds`. → [[design-system]]
