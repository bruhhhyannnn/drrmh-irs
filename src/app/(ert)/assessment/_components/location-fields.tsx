'use client';

import { Banner, FieldError, FieldLabel, SelectField } from '@/components/ds';
import type { LocationOptions, LocationPicks } from '@/lib/location-options';
import type { AssessmentDetailsFormData } from '@/lib/schemas';
import type { FieldErrors } from 'react-hook-form';

type Place = { code: string; name: string };
const toOptions = (places: Place[]) => places.map((p) => ({ value: p.code, label: p.name }));

/** Region, Province (where there are any), City/Municipality and Barangay. */
export function LocationFields({
  idPrefix,
  picks,
  barangayCode,
  options,
  loading,
  errors,
  onPick,
}: {
  idPrefix: string;
  picks: LocationPicks;
  barangayCode: string;
  options: LocationOptions;
  loading: boolean;
  errors: FieldErrors<AssessmentDetailsFormData>;
  /** A choice clears the choices under it. */
  onPick: (patch: Partial<LocationPicks & { barangay_code: string }>) => void;
}) {
  if (!options.available) {
    return loading ? (
      <p className="text-[14px] text-gray-500">Downloading the location list…</p>
    ) : (
      <Banner tone="warning">Connect to the internet once to download the location list.</Banner>
    );
  }

  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const needsProvince = options.showProvince && !picks.province_code;

  return (
    <>
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={fieldId('region')} hint="Required">
          Region
        </FieldLabel>
        <SelectField
          id={fieldId('region')}
          value={picks.region_code}
          onChange={(value) =>
            onPick({ region_code: value, province_code: '', city_code: '', barangay_code: '' })
          }
          options={toOptions(options.regions)}
          placeholder="Choose a region"
          required
          invalid={!!errors.region_code}
          describedBy={errors.region_code ? fieldId('region-error') : undefined}
        />
        <FieldError id={fieldId('region-error')}>{errors.region_code?.message}</FieldError>
      </div>

      {options.showProvince && (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={fieldId('province')} hint="Required">
            Province
          </FieldLabel>
          <SelectField
            id={fieldId('province')}
            value={picks.province_code}
            onChange={(value) => onPick({ province_code: value, city_code: '', barangay_code: '' })}
            options={toOptions(options.provinces)}
            placeholder="Choose a province"
            required
            searchable
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={fieldId('city')} hint="Required">
          City / Municipality
        </FieldLabel>
        <SelectField
          id={fieldId('city')}
          value={picks.city_code}
          onChange={(value) => onPick({ city_code: value, barangay_code: '' })}
          options={toOptions(options.cities)}
          placeholder={
            !picks.region_code
              ? 'Choose a region first'
              : needsProvince
                ? 'Choose a province first'
                : 'Choose a city or municipality'
          }
          required
          searchable
          disabled={options.cities.length === 0}
          invalid={!!errors.city_code}
          describedBy={errors.city_code ? fieldId('city-error') : undefined}
        />
        <FieldError id={fieldId('city-error')}>{errors.city_code?.message}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={fieldId('barangay')} hint="Required">
          Barangay
        </FieldLabel>
        <SelectField
          id={fieldId('barangay')}
          value={barangayCode}
          onChange={(value) => onPick({ barangay_code: value })}
          options={toOptions(options.barangays)}
          placeholder={
            picks.city_code ? 'Choose a barangay' : 'Choose a city or municipality first'
          }
          required
          searchable
          disabled={options.barangays.length === 0}
          invalid={!!errors.barangay_code}
          describedBy={errors.barangay_code ? fieldId('barangay-error') : undefined}
        />
        <FieldError id={fieldId('barangay-error')}>{errors.barangay_code?.message}</FieldError>
      </div>
    </>
  );
}
