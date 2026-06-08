'use client';

import { completeUserProfile } from '@/actions/users';
import { usePositions } from '@/app/(admin)/settings/use-settings';
import { Button, Modal, Select } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function CompleteProfileModal() {
  const { userProfile, loading, setUserProfile } = useAuthStore();
  const { data: positions = [] } = usePositions();

  const [positionId, setPositionId] = useState('');
  const [saving, setSaving] = useState(false);

  const needsCompletion = !loading && userProfile && !userProfile.is_profile_complete;
  const positionOptions = positions.map((p) => ({ value: p.id, label: p.name }));

  const handleSave = async () => {
    if (!positionId || !userProfile) return;
    setSaving(true);
    try {
      const updated = await completeUserProfile(userProfile.id, { position_id: positionId });
      setUserProfile(updated);
      toast.success('Profile completed!');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!needsCompletion} onClose={() => {}} className="sm:max-w-sm">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
        <span className="text-lg">👤</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-gray-800 dark:text-gray-100">
        Complete your profile
      </h3>
      <p className="mt-1 mb-5 text-sm text-gray-500 dark:text-gray-400">
        Before you continue, please fill in your position. This is required to submit reports.
      </p>

      <div className="space-y-4">
        <Select
          label="Position"
          placeholder="Select your position..."
          options={positionOptions}
          value={positionId}
          required
          onChange={(e) => setPositionId(e.target.value)}
        />

        <Button
          className="w-full"
          onClick={handleSave}
          isLoading={saving}
          loadingText="Saving..."
          disabled={!positionId}
        >
          Save and continue
        </Button>
      </div>
    </Modal>
  );
}
