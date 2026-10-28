---
type: feature
ticket: DRRM-020
status: in-review
branch: feat/DRRM-020-profile-custom-cluster
modules:
  - '[[auth]]'
  - '[[users]]'
  - '[[settings-lookups]]'
tags: [plan, feature]
---

# [DRRM-020] Feature Plan: Type your own cluster in profile setup

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-020-profile-custom-cluster` → `dev`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

The cluster list isn't final yet, so many campuses list only a few clusters. ERT members who can't find theirs in profile setup pick the closest one (often "Diliman"), so their reports land in the wrong cluster. Unit and position already end with "Other (please specify)". Cluster should too, so people can type the cluster they're really in. The office will clean up unused clusters later in Settings.

---

## 2. Requirements & User Stories

- **As an ERT Member**, I want to type my cluster when it isn't listed, so that my profile and reports name the right one.
- Key acceptance criteria:
  - [x] The Cluster select in profile setup ends with "Other (please specify)", which opens a required **Specify cluster** field.
  - [x] A typed name that matches a cluster on the chosen campus (in any case, extra spaces ignored) reuses it; otherwise a new active cluster is added on that campus.
  - [x] Cluster names are unique across all campuses, so a name another campus has (in any case) is refused with a message, not an error page.
  - [x] With a typed cluster, Building / Unit lists only No unit and Other (please specify), and a typed unit is added inside the new cluster.
  - [x] Save stays off and the hint says "Specify your cluster to continue." until the field is filled.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- No schema change. `Cluster.name` stays globally unique (`prisma/schema.prisma`), which is why another campus's name is refused instead of duplicated.

### Server Actions & Data Flow

- `clusterIdForName(campusId, name)` in `src/lib/lookup-names.ts`, beside `unitIdForName` and `positionIdForName`: reuses the campus's cluster by name, returns `null` when another campus has the name, else adds it. A `P2002` race re-reads instead of failing.
- `completeUserProfile` (`src/actions/users`) takes `custom_cluster_name`, resolves it before the unit (so a typed unit lands in the new cluster), and now returns `{ ok: true, user } | { ok: false, error }`. Profile setup is its only caller.

### UI & User Interaction

- `src/components/auth/profile-setup.tsx`: `OTHER_OPTION` in the cluster list, the Specify cluster field, the missing-field hint, and the `ok: false` message in the page banner. The units query is off while the cluster is typed, since `__other__` isn't a cluster id.

---

## 4. Implementation Tasks

- [x] `clusterIdForName` and `completeUserProfile` changes
- [x] Profile setup form
- [x] Verify: lint, type-check, `npm run test`, `npm run build`; the helper's six cases against the staging database (reuse, other-campus refusal in exact and other case, add, re-add, add on another campus), and the form end to end in headless Chrome at 390 px against staging (Other option, focus, hint, unit list, the other-campus banner, save with a typed cluster and unit). Test rows were deleted afterwards.

## 5. Notes

- Out of scope: Add / Edit user and the report forms still pick clusters from the list only.
- Typed clusters show everywhere active clusters do (Settings, event summaries' "No report yet", the bystander form). Review them in Settings → Clusters. A cluster still on someone's profile can't be deleted (`User.cluster` is `onDelete: NoAction`), so move those users first.
