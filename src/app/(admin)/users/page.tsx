'use client';

import type { getUsers } from '@/actions/users';
import { PageBreadcrumb } from '@/components/common';
import { Badge, Button, ConfirmDialog, DataTable, Input, Modal, PageError } from '@/components/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Trash2, UserPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDeleteUser, useToggleUserStatus, useUsers } from './use-users';
import { UserForm } from './user-form';

// TODO: revalidate
type UserRow = Awaited<ReturnType<typeof getUsers>>[number];

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const { data: users = [], isPending, isFetching, error } = useUsers(debounceQuery);
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
    toggleStatus.mutate({ id, current });
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
        <div className="flex flex-row items-center gap-2">
          <button
            className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
            onClick={() => {
              setIsModalOpen(true);
              setEditId(r.id);
            }}
          >
            <UserPen size={17} />
            Edit
          </button>
          <button
            className="hover:text-error-500 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
            onClick={() => {
              setDeleteId(r.id);
              setDeleteName([r.first_name, r.last_name].filter(Boolean).join(' '));
            }}
          >
            <Trash2 size={17} />
            Delete
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (error) return <PageError message={error.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Users" />

        <div className="flex flex-wrap items-center justify-between gap-3">
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
        onConfirm={() => deleteUserMutation.mutate(deleteId, { onSuccess: () => setDeleteId('') })}
        title="Delete user"
        message={`"${deleteName}" will be permanently deleted and removed from authentication. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteUserMutation.isPending}
      />
    </>
  );
}
