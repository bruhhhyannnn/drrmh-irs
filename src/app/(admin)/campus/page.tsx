'use client';

import { CampusForm } from '@/app/(admin)/campus/campus-form';
import { PageBreadcrumb } from '@/components/common';
import { Button, Modal } from '@/components/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export default function CampusPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const handleClose = () => {
    setIsModalOpen(false);
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Campus" />
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          This is the campus page. You can manage campus-related information here.
        </p>
      </div>
      <Button onClick={() => setIsModalOpen(true)} startIcon={<Plus size={16} />}>
        Add Campus
      </Button>
      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <CampusForm onSuccess={handleClose} onCancel={handleClose} />
      </Modal>
    </div>
  );
}
