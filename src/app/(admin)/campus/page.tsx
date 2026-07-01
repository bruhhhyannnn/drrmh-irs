'use client';

import { PageBreadcrumb } from '@/components/common';
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  PageError,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCampuses, useDeleteCampus } from '../../../components/hooks/use-campus';
import { CampusForm } from './campus-form';

export default function CampusPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data: campus, isPending, isFetching, error } = useCampuses(debouncedQuery);
  const deleteCampusMutation = useDeleteCampus();
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (error) return <PageError message={error.message} />;

  return (
    <>
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Campus" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-sm min-w-2xs flex-1">
            <Search
              size={16}
              className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <Input
              placeholder="Search campus..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
            Add Campus
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campus Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campus?.map((campus) => (
              <TableRow key={campus.id}>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {campus.name}
                </TableCell>
                <TableCell>
                  <Badge color={campus.is_active ? 'success' : 'error'} size="sm">
                    {campus.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/campus/details?id=${campus.id}`}
                      className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
                    >
                      <Eye size={17} />
                    </Link>
                    <button
                      onClick={() => {
                        setEditId(campus.id);
                        setIsModalOpen(true);
                      }}
                      className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500"
                      onClick={() => setDeleteId(campus.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(isPending || isFetching) && (
              <TableRow>
                <TableCell className="py-10" colSpan={5}>
                  <Spinner center />
                </TableCell>
              </TableRow>
            )}
            {!campus?.length && !isPending && !isFetching && (
              <TableRow>
                <TableCell className="py-10 text-center text-gray-400" colSpan={5}>
                  No campus found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <CampusForm editId={editId} onSuccess={handleClose} onCancel={handleClose} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId('')}
        onConfirm={() =>
          deleteCampusMutation.mutate(deleteId, { onSuccess: () => setDeleteId('') })
        }
        title="Delete campus"
        message="This campus will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteCampusMutation.isPending}
      />
    </>
  );
}
