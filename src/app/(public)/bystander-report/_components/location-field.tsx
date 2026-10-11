'use client';

import { MapClickHandler, MapFlyTo } from '@/components/common/map-pick';
import { FieldError, FieldLabel, FOCUS_RING } from '@/components/ds';
import { Map, MapControls, MapMarker, MarkerContent } from '@/components/ui';
import { cn } from '@/lib';
import { LocateFixed, MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCoordinates } from '../_lib/summary';

const MANILA: [number, number] = [120.9842, 14.5995];

interface LocationFieldProps {
  lat: number | null;
  lng: number | null;
  /** Shown on the pin — the chosen incident type. */
  pinLabel: string;
  error?: string;
  onChange: (lat: number | null, lng: number | null) => void;
}

/**
 * Map picker: tap the map or drag the pin, or use the device location. On a fresh form it asks
 * for the device location straight away, since that is the quickest way to a pin.
 */
export function LocationField({ lat, lng, pinLabel, error, onChange }: LocationFieldProps) {
  const pin = lat !== null && lng !== null ? { lat, lng } : null;
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('This browser can’t share its location. Tap the map to drop a pin.');
      return;
    }
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        onChangeRef.current(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is off. Tap the map to drop a pin.'
            : 'Couldn’t get your location. Tap the map to drop a pin.'
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  useEffect(() => {
    if (lat === null) locate();
    // Only on mount: returning to step 1 with a pin, or after Clear, must not re-prompt.
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="location-label" hint="Required">
        Location
      </FieldLabel>

      <div
        id="location-map"
        tabIndex={-1}
        aria-labelledby="location-label"
        aria-describedby={error ? 'location-error' : undefined}
        className={cn(
          'relative h-50 overflow-hidden rounded-2xl border outline-none md:h-55',
          error ? 'border-[#b42318]' : 'border-gray-200'
        )}
      >
        <Map theme="light" center={pin ? [pin.lng, pin.lat] : MANILA} zoom={pin ? 16 : 12}>
          <MapControls showZoom position="top-right" />
          <MapClickHandler onPick={(pickedLng, pickedLat) => onChange(pickedLat, pickedLng)} />
          {pin && <MapFlyTo lat={pin.lat} lng={pin.lng} />}
          {pin && (
            <MapMarker
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              draggable
              onDragEnd={({ lng: draggedLng, lat: draggedLat }) => onChange(draggedLat, draggedLng)}
            >
              <MarkerContent>
                <div className="font-landing flex flex-col items-center">
                  <span className="rounded-full bg-gray-900 px-2.5 py-1.25 text-[12px] font-semibold whitespace-nowrap text-white">
                    {pinLabel}
                  </span>
                  <span className="h-2.5 w-0.5 bg-gray-900" />
                  <span className="bg-brand-500 size-5 rounded-full border-3 border-white shadow-[0_2px_6px_rgba(16,24,40,.35)]" />
                </div>
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
        <button
          type="button"
          onClick={locate}
          disabled={isLocating}
          className={cn(
            'absolute right-3 bottom-3 z-10 flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-gray-900 shadow-[0_4px_8px_-2px_rgba(16,24,40,.16)] transition-[filter] hover:brightness-97 disabled:cursor-wait',
            FOCUS_RING
          )}
        >
          <LocateFixed size={16} aria-hidden className="text-brand-500" />
          {isLocating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {pin ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <MapPin size={16} aria-hidden className="text-[#027a48]" />
          <span className="text-[14px] font-semibold">Pinned</span>
          <span className="font-landing-mono text-[13px] text-gray-600">
            {formatCoordinates(pin.lat, pin.lng)}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className={cn(
              'text-brand-500 h-8 rounded px-1 text-[14px] font-bold hover:text-[#7a1515] hover:underline',
              FOCUS_RING
            )}
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-gray-500">
          {isLocating
            ? 'Finding your location…'
            : 'Tap the map to drop a pin, or use your location.'}
        </p>
      )}
      {geoError && !pin && <p className="text-[13px] font-medium text-[#b54708]">{geoError}</p>}
      <FieldError id="location-error">{error}</FieldError>
    </div>
  );
}
