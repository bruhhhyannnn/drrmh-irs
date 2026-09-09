'use client';

import type { SettingsTable } from '@/actions/settings';
import { PageBreadcrumb } from '@/components/common';
import { SettingsForm } from '@/components/settings';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DeleteAction,
  EditAction,
  Input,
  Modal,
  PageError,
  Select,
  TableActions,
} from '@/components/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useCampus, useClusters, useDeleteSetting, useSettingsTable } from '../hooks/use-settings';

interface SettingsPageProps {
  title: string;
  table: SettingsTable;
}

type SettingItem = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export function SettingsTablePage({ title, table }: SettingsPageProps) {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [campusId, setCampusId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const isClusters = table === 'clusters';
  const isUnits = table === 'units';
  const {
    data: items,
    isPending,
    isFetching,
    error,
  } = useSettingsTable(table, isClusters ? campusId : isUnits ? clusterId : undefined);
  const { data: campusList = [] } = useCampus();
  const { data: clusterList = [] } = useClusters();
  const deleteMutation = useDeleteSetting(table);
  const [deleteId, setDeleteId] = useState('');
  const [editId, setEditId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = (id = '') => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const columns: ColumnDef<SettingItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {String(getValue() ?? '—')}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row: { original: item } }) => (
        <Badge color={item.is_active ? 'success' : 'error'} size="sm">
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row: { original: item } }) =>
        item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row: { original: item } }) => (
        <TableActions>
          <EditAction onClick={() => handleOpen(item.id)} />
          <DeleteAction disabled={deleteMutation.isPending} onClick={() => setDeleteId(item.id)} />
        </TableActions>
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
        <PageBreadcrumb pageTitle={title} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-sm min-w-2xs flex-1">
              <Search
                size={16}
                className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <Input
                placeholder={`Search ${title.toLowerCase()}...`}
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {isClusters && (
              <Select
                className="max-w-2xs"
                placeholder="All campuses"
                allowClear
                options={(campusList as { id: string; name: string }[]).map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={campusId}
                onChange={setCampusId}
              />
            )}
            {isUnits && (
              <Select
                className="max-w-2xs"
                placeholder="All clusters"
                allowClear
                options={(clusterList as { id: string; name: string }[]).map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={clusterId}
                onChange={setClusterId}
              />
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">{items?.length ?? 0} total</p>
          </div>
          <Button onClick={() => handleOpen()} startIcon={<Plus size={16} />}>
            Add {title.replace(/s$/, '')}
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={(items ?? []) as SettingItem[]}
          globalFilter={debounceQuery}
          loading={isPending || isFetching}
          emptyMessage={`No ${title.toLowerCase()} found`}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <SettingsForm
          title={title}
          table={table}
          editId={editId}
          onSuccess={handleClose}
          onCancel={handleClose}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() =>
          deleteMutation.mutate(deleteId, {
            onSuccess: () => {
              setDeleteId('');
              toast.success(`${title.replace(/s$/, '')} deleted`);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        title={`Delete ${title.replace(/s$/, '').toLowerCase()}`}
        message="This item will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
