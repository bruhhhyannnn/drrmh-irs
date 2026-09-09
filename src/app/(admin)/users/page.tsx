'use client';

import type { getUsers } from '@/actions/users';
import { PageBreadcrumb } from '@/components/common';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDeleteUser, useToggleUserStatus, useUsers } from '@/components/hooks/use-users';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageError,
  RowActions,
  Select,
} from '@/components/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserForm } from './user-form';

// TODO: revalidate
type UserRow = Awaited<ReturnType<typeof getUsers>>[number];

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [campusId, setCampusId] = useState('');
  const { data: campuses = [] } = useCampuses();
  const {
    data: users = [],
    isPending,
    isFetching,
    error,
  } = useUsers(debounceQuery, campusId || undefined);
  const toggleStatus = useToggleUserStatus();
  const deleteUserMutation = useDeleteUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [deleteName, setDeleteName] = useState('');

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const handleToggleStatus = (id: string, current: boolean) => {
    if (!confirm(`${current ? 'Deactivate' : 'Activate'} this user?`)) return;
    toggleStatus.mutate(
      { id, current },
      {
        onSuccess: () => toast.success(current ? 'User deactivated' : 'User activated'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorFn: (r) => `${r.first_name ?? ''} ${r.last_name ?? ''}`,
      cell: ({ row: { original: r } }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {[r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(' ')}
        </span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      id: 'cluster',
      header: 'Cluster',
      accessorFn: (r) => r.unit?.cluster?.name ?? '',
      cell: ({ row: { original: r } }) => r.unit?.cluster?.name ?? '—',
    },
    {
      id: 'unit',
      header: 'Unit',
      accessorFn: (r) => r.unit?.name ?? '',
      cell: ({ row: { original: r } }) => r.unit?.name ?? '—',
    },
    {
      id: 'position',
      header: 'Position',
      accessorFn: (r) => r.position?.name ?? '',
      cell: ({ row: { original: r } }) => r.position?.name ?? '—',
    },
    {
      id: 'campus',
      header: 'Campus',
      accessorFn: (r) => r.campus?.name ?? '',
      cell: ({ row: { original: r } }) => r.campus?.name ?? '—',
    },
    {
      id: 'reports',
      header: 'Reports',
      accessorFn: (r) => r._count.reports,
      cell: ({ row: { original: r } }) => (
        <span className="font-medium text-gray-900 dark:text-white">{r._count.reports}</span>
      ),
    },
    {
      id: 'profile',
      header: 'Profile',
      accessorFn: (r) => (r.is_profile_complete ? 'Complete' : 'Incomplete'),
      cell: ({ row: { original: r } }) => (
        <Badge color={r.is_profile_complete ? 'success' : 'warning'} size="sm">
          {r.is_profile_complete ? 'Complete' : 'Incomplete'}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (r) => r.user_type.name,
      cell: ({ row: { original: r } }) => (
        <Badge color="primary" size="sm">
          {r.user_type.name}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => (r.is_active ? 'Active' : 'Inactive'),
      cell: ({ row: { original: r } }) => (
        <button
          onClick={() => handleToggleStatus(r.id, r.is_active)}
          disabled={toggleStatus.isPending}
          className="cursor-pointer"
        >
          <Badge color={r.is_active ? 'success' : 'error'} size="sm">
            {r.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: r } }) => (
        <RowActions
          quickAction={{
            label: 'Edit user',
            icon: Pencil,
            onClick: () => {
              setIsModalOpen(true);
              setEditId(r.id);
            },
          }}
          actions={[
            {
              label: 'Delete user',
              icon: Trash2,
              variant: 'danger',
              onClick: () => {
                setDeleteId(r.id);
                setDeleteName([r.first_name, r.last_name].filter(Boolean).join(' '));
              },
            },
          ]}
        />
      ),
      enableSorting: false,
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const campusOptions = campuses.map((c) => ({ value: c.id, label: c.name }));

  if (error) return <PageError message={error.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Users" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-sm min-w-2xs flex-1">
              <Search
                size={16}
                className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <Input
                placeholder="Search users..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              placeholder="All campuses"
              className="w-full max-w-2xs"
              options={campusOptions}
              value={campusId}
              allowClear
              onChange={setCampusId}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{users.length} total</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add User
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={users ?? []}
          loading={isPending || isFetching}
          emptyMessage="No users found"
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <UserForm editId={editId} onSuccess={handleClose} onCancel={handleClose} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() => {
          const toastId = toast.loading('Deleting user...');
          deleteUserMutation.mutate(deleteId, {
            onSuccess: () => {
              setDeleteId('');
              toast.success(`"${deleteName}" has been deleted.`, { id: toastId });
            },
            onError: () => {
              toast.error('Failed to delete user. Please try again.', { id: toastId });
            },
          });
        }}
        title="Delete user"
        message={`"${deleteName}" will be permanently deleted and removed from authentication. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteUserMutation.isPending}
      />
    </>
  );
}
