'use client';

import { completeUserProfile } from '@/actions/users';
import { useClusters, usePositions, useUnits } from '@/app/(admin)/settings/use-settings';
import { Button, Modal, Select } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useState } from 'react';
import toast from 'react-hot-toast';

const OTHER_VALUE = '__other__';

export function CompleteProfileModal() {
  const { userProfile, loading, setUserProfile } = useAuthStore();
  const { data: positions = [] } = usePositions();
  const { data: clusters = [] } = useClusters();

  const [positionId, setPositionId] = useState('');
  const [customPosition, setCustomPosition] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: units = [] } = useUnits(clusterId || undefined);

  const needsCompletion = !loading && userProfile && !userProfile.is_profile_complete;
  const isOther = positionId === OTHER_VALUE;

  const positionOptions = [
    ...positions.map((p) => ({ value: p.id, label: p.name })),
    { value: OTHER_VALUE, label: 'Other (please specify)' },
  ];
  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));

  const canSave = positionId && (!isOther || customPosition.trim().length > 0) && clusterId;

  const handleSave = async () => {
    if (!canSave || !userProfile) return;
    setSaving(true);
    try {
      const payload = {
        ...(isOther
          ? { custom_position_name: customPosition.trim() }
          : { position_id: positionId }),
        cluster_id: clusterId,
        ...(unitId ? { unit_id: unitId } : {}),
      };
      const updated = await completeUserProfile(userProfile.id, payload);
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
          onChange={(e) => {
            setPositionId(e.target.value);
            setCustomPosition('');
            setClusterId('');
            setUnitId('');
          }}
        />

        {isOther && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Specify position <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={customPosition}
              onChange={(e) => setCustomPosition(e.target.value)}
              placeholder="e.g. Safety Officer"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>
        )}

        <Select
          label="Cluster"
          placeholder="Select cluster..."
          options={clusterOptions}
          value={clusterId}
          required
          onChange={(e) => {
            setClusterId(e.target.value);
            setUnitId('');
          }}
        />
        <Select
          label="Building / Unit"
          placeholder={clusterId ? 'Select unit...' : 'Select cluster first'}
          options={unitOptions}
          value={unitId}
          disabled={!clusterId}
          onChange={(e) => setUnitId(e.target.value)}
        />

        <Button
          className="w-full"
          onClick={handleSave}
          isLoading={saving}
          loadingText="Saving..."
          disabled={!canSave}
        >
          Save and continue
        </Button>
      </div>
    </Modal>
  );
}
