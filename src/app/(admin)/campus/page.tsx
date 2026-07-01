'use client';

import { PageBreadcrumb } from '@/components/common';
import { Badge, Button, ConfirmDialog, Input, Modal, PageError } from '@/components/ui';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCampuses, useDeleteCampus } from '../../../components/hooks/use-campus';
import { CampusForm } from './campus-form';

export default function CampusPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data: campuses, error } = useCampuses(debouncedQuery);
  const deleteCampusMutation = useDeleteCampus();
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const campuslogos: Record<string, string> = {
    'UP Manila': '/up-manila-logo.png',
    'UP Diliman': '/up-diliman-logo.png',
    'UP Baguio': '/up-baguio-logo.png',
    'UP Los Banos': '/up-losbanos-logo.png',
    'UP Visayas': '/up-visayas-logo.png',
    'UP Mindanao': '/up-mindanao-logo.png',
    'UP Tacloban': '/up-tacloban-logo.png',
    'UP Open University': '/up-openuniversity-logo.png',
    'UP Cebu': '/up-cebu-logo.png',
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campuses?.length ? (
            campuses.map((campus) => (
              <div
                key={campus.id}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900 min-h-40 hover:bg-gray-100"
              >
                <div>
                  <Link key={campus.id} href={`/campus/details?id=${campus.id}`}>
                    <div className="flex-1 flex items-center justify-center">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-[#a11d1d]">
                        {campus.name}
                      </p>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <img src={campuslogos[campus.name] ?? '/up-logo.png'} width="300px"></img>
                    </div>
                  </Link>
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Badge color={campus.is_active ? 'success' : 'error'} size="sm">
                    {campus.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <button
                    onClick={() => handleEdit(campus.id)}
                    className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100 hover:bg-transparent hover:border-transparent"
                  >
                    <Pencil size={20} />
                  </button>
                  <button
                    onClick={() => setDeleteId(campus.id)}
                    className="hover:text-error-500 text-gray-400 transition-all duration-100 dark:text-gray-500 focus:outline-none hover:bg-transparent hover:border-transparent"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">No campuses found.</p>
          )}
        </div>
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
