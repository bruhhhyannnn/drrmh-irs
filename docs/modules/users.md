---
type: module
updated: 2026-10-27
module: users
paths:
  - src/actions/users
  - src/app/(admin)/users
  - src/components/hooks/use-users.ts
tags: [module]
---

# Users

The admin Users page: list, search, add, edit, deactivate and delete user accounts. Administrators manage the users of their own campus; Super Admins see every campus through the campus switcher and are the only ones who can make another Super Admin. The same action file also holds the profile reads and the profile-setup write used by [[auth]].

**Related:** [[architecture]] · [[auth]] · [[campus-scoping]] · [[settings-lookups]] · [[database]] · [[design-system]]

## Where it lives

| Path                                                | What it holds                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `src/actions/users/index.ts`                        | All user server actions, `CreateUserInput`, `UpdateUserInput`         |
| `src/lib/lookup-names.ts`                           | `unitIdForName`, `positionIdForName` (server only)                    |
| `src/components/hooks/use-users.ts`                 | TanStack Query hooks around those actions                             |
| `src/app/(admin)/users/page.tsx`                    | `/users` list: search, type and status filters, Active switch, delete |
| `src/app/(admin)/users/_components/user-drawer.tsx` | `UserDrawer`: Add user / Edit user form                               |
| `src/lib/schemas.ts`                                | `userCreateSchema`, `userEditSchema`, `passwordSchema`                |

## Data

- `User` (`users`): name parts (`first_name`, `middle_name`, `last_name`, `suffix`), `email` and `username` (unique), `auth_id` (unique), `user_type_id`, `campus_id`, `cluster_id`, `unit_id`, `position_id`, `is_active`, `is_profile_complete`.
- Reads include `user_type`, `position`, `campus`, `cluster`, `unit` (with its `cluster`). `getUsers` also counts `reports`.
- `Report` (`reports`) and `Event` (`events`): `deleteUser` sets `user_id` to null on the user's reports and the events they created.
- `Unit`, `Position`: a name typed under "Other (please specify)" reuses the unit in that cluster (or the position) with the same name in any case, or adds one.
- Supabase Auth users (through `supabaseAdmin.auth.admin`): created and deleted alongside the `users` row.

## Server actions

`src/actions/users/index.ts`. None of these verify the caller or the campus; the page decides what is shown.

- `getUsers(query?, campusId?)`: users matching name, email or username (case-insensitive), filtered by `campus_id` when given, newest first.
- `getUser(id)`: one user with relations.
- `getUserByAuthId(authId)`: the profile for a Supabase user; used by `AuthProvider`.
- `createUser(data)`: resolves `custom_unit_name` / `custom_position_name` to ids (`withNamedAssignment`), then creates the Supabase Auth user (`email_confirm: true`) with the password, then the `users` row. `is_profile_complete` is `true` only for admin user types. If the row insert fails, the Auth user is deleted. Revalidates `/users`.
- `updateUser(id, data)`: resolves the typed names the same way, then updates the `users` row only. Revalidates `/users`.
- `setUserActive(id, isActive)`: the Active switch and its Undo. Revalidates `/users`.
- `completeUserProfile(id, data)`: requires `campus_id`; resolves `custom_unit_name` / `custom_position_name`; sets `is_profile_complete = true`. Revalidates `/`.
- `deleteUser(id)`: returns `DeleteUserResult`. `{ ok: false, error }` when the user is gone or evaluated building assessments (each keeps its evaluator, so Active should be turned off instead). Otherwise nulls `reports.user_id` and `events.user_id` and deletes the row in one transaction, then deletes the Supabase Auth user. Revalidates `/users`.

Errors from Prisma go through `toFriendlyError(err, 'user')` (see [[database]]).

## Client side

- Route `/users` inside the `(admin)` shell.
- Hooks: `useUsers(query, campusId)` (key `['users', query, campusId]`), `useUser(id)`, `useCreateUser` (also invalidates `dashboard` and `campuses-overview`), `useUpdateUser` (both also invalidate `units` / `positions` when a name was typed), `useSetUserActive`, `useDeleteUser` (invalidates only when `ok`).
- The page reads the campus from `useScopedCampusId()` and `useIsSuperAdmin()` (see [[campus-scoping]]). A Campus column shows only when All campuses is picked.
- Search is debounced (`useDebounced`); the type and status filters run on the loaded rows.
- The Active switch acts at once and shows a toast with Undo. Delete asks first in `ConfirmDialog`; when it fails, the dialog stays open with "… was not deleted." and the reason (or, for a thrown error, a plain "nothing was changed" with Try again) and logs the raw error to the console.
- Rows flag "Profile incomplete" when `is_profile_complete` is false. The signed-in user's own row cannot be switched off or deleted.
- `UserDrawer` groups the form into Name (First, Middle, Last, Suffix, in Tab order), Account, Assignment and Access, with a placeholder in every field. Password and Confirm password show only on Add, with live rule ticks matching `passwordSchema`.
- An ERT member must have a cluster; Unit and Position are optional for everyone. Unit lists No unit first and Other (please specify) last; Other opens Unit name. Position works the same way (Position name).
- The Campus field shows only for Super Admins. An Administrator's new user gets the Administrator's own `campus_id`.
- The type picker lists `ERT Member`, `Administrator`, `Super Admin` (labelled ERT, Admin, Super Admin); Administrators cannot pick Super Admin unless the user already has it.

## Rules and gotchas

- Who may do what is enforced only in the UI. The actions take any id or campus the client sends.
- `updateUser` does not touch Supabase Auth. Changing the email in Edit user changes the profile, not the sign-in email, and there is no admin password reset here.
- Deactivating a user does not sign them out or block the client pages; only token-verified actions refuse inactive profiles (see [[auth]]).
- A user's changes reach their own app only after they sign out, because `AuthProvider` reuses the persisted profile.
- Deleting a user keeps their reports and the events they created, with `user_id = null`. Assessments they evaluated (`assessments.evaluator_id`, required, `NoAction`) block the delete, so `deleteUser` checks for them first and says so. `events.completed_by`, `buildings.created_by` and the template version `created_by` / `published_by` are set to null by the database.
- `createUser` makes the Auth user first. Keep the rollback (`deleteUser` on the Auth user) if you change the order or add steps.
- New Google sign-ins are created by `provisionGoogleUser`, not here.

## Decisions

- [[0001-server-actions-only]] every read and write goes through `src/actions/users`.
- [[0007-token-verified-actions]] these older actions predate it; new user actions should verify the token.
