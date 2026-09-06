'use client';

import { Badge, Modal } from '@/components/ui';
import { getInitials } from '@/lib';
import { useAuthStore } from '@/store';
import { format } from 'date-fns';
import { SignOutButton } from './sign-out-button';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { userProfile, user } = useAuthStore();

  if (!userProfile) return null;

  const fullName =
    [userProfile.first_name, userProfile.middle_name, userProfile.last_name, userProfile.suffix]
      .filter(Boolean)
      .join(' ') ||
    (user?.email?.split('@')[0] ?? 'User');

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-sm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="bg-brand-500 flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white">
            {getInitials(fullName)}
          </div>
          <h3 className="mt-3 text-base font-semibold text-gray-800 dark:text-gray-100">
            {fullName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {userProfile.email ?? user?.email}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge color="primary" size="sm">
              {userProfile.user_type.name}
            </Badge>
            <Badge color={userProfile.is_active ? 'success' : 'error'} size="sm">
              {userProfile.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge color={userProfile.is_profile_complete ? 'success' : 'warning'} size="sm">
              {userProfile.is_profile_complete ? 'Profile Complete' : 'Profile Incomplete'}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-white/3">
          <ProfileField label="Username" value={userProfile.username} />
          <ProfileField label="Campus" value={userProfile.campus?.name} />
          <ProfileField
            label="Cluster"
            value={userProfile.cluster?.name ?? userProfile.unit?.cluster?.name}
          />
          <ProfileField label="Unit / Building" value={userProfile.unit?.name} />
          <ProfileField label="Position" value={userProfile.position?.name} />
          <ProfileField
            label="Member since"
            value={
              userProfile.created_at
                ? format(new Date(userProfile.created_at), 'MMM d, yyyy')
                : undefined
            }
          />
        </div>

        <SignOutButton />
      </div>
    </Modal>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="truncate font-medium text-gray-800 dark:text-gray-200">{value ?? '—'}</span>
    </div>
  );
}
