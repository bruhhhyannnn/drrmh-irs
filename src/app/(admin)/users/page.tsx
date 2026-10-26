'use client';

import { Button, Switch } from '@/components/ds';
import { useDebounced } from '@/components/hooks/use-debounced';
import { useUserTypes } from '@/components/hooks/use-settings';
import { useDeleteUser, useSetUserActive, useUsers } from '@/components/hooks/use-users';
import { useAuthStore } from '@/store';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../_components/confirm-dialog';
import {
  DataTable,
  FilterSelect,
  IconAction,
  ListCard,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  RowActions,
  SearchField,
  TextCell,
  type Column,
} from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { useIsSuperAdmin, useScopedCampusId } from '../_components/shell/campus-switcher';
import { Avatar, Card, Chip } from '../_components/ui';
import { personName, plural } from '../_lib/format';
import { userTypeLabel, userTypeTone } from '../_lib/status';
import { UserDrawer } from './_components/user-drawer';

type UserRow = NonNullable<ReturnType<typeof useUsers>['data']>[number];

const fullName = (u: UserRow) => personName(u) || u.username;
const clusterOf = (u: UserRow) => u.cluster?.name ?? u.unit?.cluster?.name;

export default function UsersPage() {
  const campusId = useScopedCampusId();
  const myId = useAuthStore((s) => s.userProfile?.id);
  const isSuperAdmin = useIsSuperAdmin();
  const ownCampus = useAuthStore((s) => s.userProfile?.campus?.name);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const { data: users = [], isPending, error } = useUsers(debounced, campusId || undefined);
  const { data: userTypes = [] } = useUserTypes();
  const setActive = useSetUserActive();
  const deleteUser = useDeleteUser();
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [drawer, setDrawer] = useState<{ open: boolean; user?: UserRow }>({ open: false });
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const allCampuses = !campusId;
  const rows = users.filter(
    (u) =>
      (!typeId || u.user_type_id === typeId) && (!status || (status === 'active') === u.is_active)
  );

  // The switch acts at once; the toast offers Undo instead of asking first.
  const toggleActive = (u: UserRow, isActive: boolean, undo = false) =>
    setActive.mutate(
      { id: u.id, isActive },
      {
        onSuccess: () => {
          if (undo) return;
          toast(
            (t) => (
              <span className="flex items-center gap-3 text-[16px]">
                {fullName(u)} is now {isActive ? 'active' : 'inactive'}.
                <button
                  type="button"
                  className="text-brand-500 font-bold"
                  onClick={() => {
                    toast.dismiss(t.id);
                    toggleActive(u, !isActive, true);
                  }}
                >
                  Undo
                </button>
              </span>
            ),
            { duration: 6000 }
          );
        },
        onError: (err) => toast.error(err.message),
      }
    );

  const assignment = (u: UserRow) => ({
    unit: u.unit?.name ?? 'No unit',
    sub: [clusterOf(u), u.position?.name].filter(Boolean).join(' · ') || '—',
  });

  const columns: Column<UserRow>[] = [
    {
      key: 'user',
      header: 'User',
      width: 'minmax(0,1.8fr)',
      cell: (u) => (
        <NameCell
          avatar={<Avatar name={fullName(u)} highlight={u.id === myId} />}
          primary={fullName(u)}
          secondary={u.email}
          flag={u.is_profile_complete ? undefined : 'Profile incomplete'}
        />
      ),
    },
    ...(allCampuses
      ? [
          {
            key: 'campus',
            header: 'Campus',
            width: 'minmax(0,0.9fr)',
            hideOnTablet: true,
            cell: (u: UserRow) => <TextCell>{u.campus?.name ?? '—'}</TextCell>,
          },
        ]
      : []),
    {
      key: 'assignment',
      header: 'Unit and position',
      width: 'minmax(0,1.4fr)',
      cell: (u) => <NameCell muted primary={assignment(u).unit} secondary={assignment(u).sub} />,
    },
    {
      key: 'type',
      header: 'Type',
      width: '104px',
      cell: (u) => (
        <Chip tone={userTypeTone(u.user_type.name)}>{userTypeLabel(u.user_type.name)}</Chip>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      width: '56px',
      cell: (u) => (
        <Switch
          checked={u.is_active}
          label={`${fullName(u)} active`}
          // You can't switch yourself off.
          disabled={u.id === myId}
          onChange={(checked) => toggleActive(u, checked)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '72px',
      align: 'right',
      cell: (u) => (
        <RowActions>
          <IconAction
            label="Edit"
            icon={<Pencil size={18} aria-hidden />}
            onClick={() => setDrawer({ open: true, user: u })}
          />
          <IconAction
            label="Delete"
            icon={<Trash2 size={18} aria-hidden />}
            disabled={u.id === myId}
            onClick={() => setDeleting(u)}
          />
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={
          !isSuperAdmin && ownCampus
            ? `ERT members and administrators at ${ownCampus}.`
            : 'ERT members and administrators.'
        }
        actions={
          <Button size="sm" onClick={() => setDrawer({ open: true })}>
            <Plus size={16} aria-hidden />
            Add user
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-[17px] text-error-700">
          The users couldn&apos;t be loaded: {error.message}
        </Card>
      ) : (
        <ListCard>
          <ListToolbar>
            <SearchField
              label="Search users"
              placeholder="Search users…"
              value={query}
              onChange={setQuery}
            />
            <FilterSelect
              label="User type"
              allLabel="All types"
              value={typeId}
              onChange={setTypeId}
              options={userTypes.map((t) => ({ value: t.id, label: userTypeLabel(t.name) }))}
            />
            <FilterSelect
              label="Status"
              allLabel="All statuses"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <ListCount loading={isPending}>{plural(rows.length, 'user', 'users')}</ListCount>
          </ListToolbar>
          <DataTable
            label="Users"
            columns={columns}
            rows={rows}
            rowKey={(u) => u.id}
            loading={isPending}
            rowClassName={(u) => (u.is_active ? undefined : 'bg-gray-25')}
            empty={
              debounced || typeId || status ? 'No users match these filters.' : 'No users yet.'
            }
            card={(u) => (
              <MobileCard
                avatar={<Avatar name={fullName(u)} size={40} highlight={u.id === myId} />}
                title={fullName(u)}
                subtitle={u.email}
                chip={
                  <Chip tone={userTypeTone(u.user_type.name)}>
                    {userTypeLabel(u.user_type.name)}
                  </Chip>
                }
                meta={[
                  {
                    label: 'Unit',
                    value: u.unit
                      ? [clusterOf(u), u.unit.name].filter(Boolean).join(' · ')
                      : 'None',
                  },
                  ...(u.position ? [{ label: 'Position', value: u.position.name }] : []),
                  {
                    label: 'Status',
                    value: u.is_active ? 'Active' : 'Inactive',
                    tone: u.is_active ? ('green' as const) : ('grey' as const),
                  },
                  ...(u.is_profile_complete
                    ? []
                    : [{ label: 'Profile', value: 'Incomplete', tone: 'amber' as const }]),
                ]}
                actions={[
                  {
                    label: 'Edit',
                    icon: <Pencil size={16} aria-hidden />,
                    onClick: () => setDrawer({ open: true, user: u }),
                  },
                  ...(u.id === myId
                    ? []
                    : [
                        {
                          label: 'Delete',
                          icon: <Trash2 size={16} aria-hidden />,
                          onClick: () => setDeleting(u),
                          variant: 'danger' as const,
                        },
                      ]),
                ]}
              />
            )}
          />
        </ListCard>
      )}

      <UserDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        userId={drawer.user?.id}
        reports={drawer.user?._count.reports}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteUser.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${fullName(deleting)} deleted`);
              setDeleting(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteUser.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this user?"
        name={deleting ? fullName(deleting) : ''}
        body="will be permanently deleted and removed from sign-in. This cannot be undone."
        warning={
          deleting && deleting._count.reports > 0
            ? `${plural(deleting._count.reports, 'report is', 'reports are')} linked to this user. They stay, without a reporter.`
            : undefined
        }
        confirmLabel="Delete user"
      />
    </>
  );
}
