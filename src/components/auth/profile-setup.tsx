'use client';

import { completeUserProfile } from '@/actions/users';
import {
  Button,
  FieldLabel,
  OTHER_OPTION,
  OTHER_VALUE,
  SelectField,
  TextInput,
} from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials, supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCampusClusters } from '../hooks/use-campus';
import { useCampus, usePositions, useUnits } from '../hooks/use-settings';
import { AuthShell } from './auth-shell';
import { AUTH_LINK, AuthBanner, AuthHeading } from './auth-ui';

/** Shows profile setup in place of the page until the signed-in user's profile is complete. */
export function ProfileSetupGate({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuthStore();
  const needsSetup = !loading && !!userProfile && !userProfile.is_profile_complete;
  return needsSetup ? <ProfileSetup /> : children;
}

/**
 * First sign-in setup: campus, cluster and position, plus building / unit when there is one
 * (some clusters have none). A full page (in the auth frame) instead of a modal that can't be
 * closed, with "Not you? Sign out".
 */
export function ProfileSetup() {
  const router = useRouter();
  const { user, userProfile, setUserProfile, reset } = useAuthStore();
  const [campusId, setCampusId] = useState(userProfile?.campus_id ?? '');
  const [clusterId, setClusterId] = useState(userProfile?.cluster_id ?? '');
  const [unitId, setUnitId] = useState(userProfile?.unit_id ?? '');
  const [positionId, setPositionId] = useState(userProfile?.position_id ?? '');
  const [customPosition, setCustomPosition] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { data: campus = [], isPending: campusPending } = useCampus();
  const { data: positions = [], isPending: positionsPending } = usePositions();
  const { data: campusClusters = [] } = useCampusClusters(campusId);
  const { data: units = [] } = useUnits(clusterId, { enabled: !!clusterId });

  const isOther = positionId === OTHER_VALUE;
  const isOtherUnit = unitId === OTHER_VALUE;

  const campusOptions = (campus as { id: string; name: string; is_active: boolean }[])
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.id, label: c.name }));
  const clusterOptions = campusClusters
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = [
    ...units.filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name })),
    OTHER_OPTION,
  ];
  const positionOptions = [...positions.map((p) => ({ value: p.id, label: p.name })), OTHER_OPTION];

  // Save stays off until every field is filled; this line says what's still missing.
  const missing = !campusId
    ? 'Choose your campus to continue.'
    : !clusterId
      ? 'Choose your cluster to continue.'
      : isOtherUnit && !customUnit.trim()
        ? 'Specify your building or unit to continue.'
        : !positionId
          ? 'Choose your position to continue.'
          : isOther && !customPosition.trim()
            ? 'Specify your position to continue.'
            : null;

  const handleSave = async () => {
    if (missing || !userProfile) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await completeUserProfile(userProfile.id, {
        ...(isOther
          ? { custom_position_name: customPosition.trim() }
          : { position_id: positionId }),
        campus_id: campusId,
        cluster_id: clusterId,
        ...(isOtherUnit
          ? { custom_unit_name: customUnit.trim() }
          : unitId
            ? { unit_id: unitId }
            : {}),
      });
      setUserProfile(updated);
      toast.success('Profile completed!');
    } catch {
      setSaveError("We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    reset();
    router.replace('/signin');
  };

  const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ');
  const email = userProfile?.email ?? user?.email ?? '';
  const provider = user?.app_metadata?.provider === 'google' ? 'Google' : 'Email';

  return (
    <AuthShell>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-gray-50 px-3.5 py-3">
        <span className="bg-brand-solid grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white uppercase">
          {getInitials(fullName || email)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{fullName || email}</span>
          <span className="truncate text-[13px] text-gray-500">
            {email} · {provider}
          </span>
        </span>
      </div>

      <AuthHeading title="Set up your profile">
        Before you continue, please fill in your position. This is required to submit reports.
      </AuthHeading>
      {saveError && <AuthBanner>{saveError}</AuthBanner>}

      {campusPending || positionsPending ? (
        <ProfileFormSkeleton />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="profile-campus" hint="Required">
              Campus
            </FieldLabel>
            <SelectField
              id="profile-campus"
              value={campusId}
              onChange={(value) => {
                setCampusId(value);
                setClusterId('');
                setUnitId('');
                setCustomUnit('');
              }}
              options={campusOptions}
              placeholder="Select your campus"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="profile-cluster" hint="Required">
              Cluster
            </FieldLabel>
            <SelectField
              id="profile-cluster"
              value={clusterId}
              onChange={(value) => {
                setClusterId(value);
                setUnitId('');
                setCustomUnit('');
              }}
              options={clusterOptions}
              placeholder={campusId ? 'Select your cluster' : 'Select a campus first'}
              disabled={!campusId}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="profile-unit" hint="Optional">
              Building / Unit
            </FieldLabel>
            <SelectField
              id="profile-unit"
              value={unitId}
              onChange={(value) => {
                setUnitId(value);
                setCustomUnit('');
              }}
              options={unitOptions}
              placeholder={clusterId ? 'No unit' : 'Select a cluster first'}
              emptyLabel="No unit"
              disabled={!clusterId}
            />
          </div>

          {isOtherUnit && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-custom-unit" hint="Required">
                Specify unit
              </FieldLabel>
              <TextInput
                id="profile-custom-unit"
                autoFocus
                autoComplete="off"
                placeholder="e.g. Room 500s"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="profile-position" hint="Required">
              Position
            </FieldLabel>
            <SelectField
              id="profile-position"
              value={positionId}
              onChange={(value) => {
                setPositionId(value);
                setCustomPosition('');
              }}
              options={positionOptions}
              placeholder="Select your position"
              required
            />
          </div>

          {isOther && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-custom-position" hint="Required">
                Specify position
              </FieldLabel>
              <TextInput
                id="profile-custom-position"
                autoFocus
                autoComplete="organization-title"
                placeholder="e.g. Safety Officer"
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              fullWidth
              disabled={!!missing}
              loading={saving}
              aria-describedby={missing ? 'profile-missing' : undefined}
            >
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>
            {missing && (
              <span id="profile-missing" className="text-center text-[13px] text-gray-500">
                {missing}
              </span>
            )}
          </div>
        </form>
      )}

      <p className="text-center text-[14px] text-gray-600">
        Not you?{' '}
        <button type="button" onClick={handleSignOut} className={AUTH_LINK}>
          Sign out
        </button>
      </p>
    </AuthShell>
  );
}

/** Campus, cluster, unit and position fields in placeholders while their lists load. */
function ProfileFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading…</span>
      {['w-16', 'w-14', 'w-28', 'w-18'].map((label) => (
        <div key={label} className="flex flex-col gap-2">
          <Skeleton className={`h-4 rounded-md ${label}`} />
          <Skeleton className="h-12 rounded-2xl" />
        </div>
      ))}
      <Skeleton className="h-13 rounded-full" />
    </div>
  );
}
