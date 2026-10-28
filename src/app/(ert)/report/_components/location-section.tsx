import { LocationPicker, type PickedLocation } from '@/components/ds';
import { SectionCard } from '../../_components/chrome';

export type { PickedLocation };

/** Section 1. On a fresh form it asks for the device location straight away. */
export function LocationSection({
  location,
  error,
  onChange,
}: {
  location: PickedLocation | null;
  error?: string;
  onChange: (location: PickedLocation | null, userAction: boolean) => void;
}) {
  return (
    <SectionCard id="report-location" number={1} title="Location" aside="Required">
      {(titleId) => (
        <div className="mt-3.5">
          <LocationPicker
            autoLocate
            location={location}
            error={error}
            onChange={onChange}
            labelledBy={titleId}
          />
        </div>
      )}
    </SectionCard>
  );
}
