'use client';

import { MapClickHandler, MapFlyTo } from '@/components/common/map-pick';
import { Map, MapControls, MapMarker, MarkerContent } from '@/components/ui';
import { cn } from '@/lib';
import { LocateFixed, MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldError } from './fields';
import { FOCUS_RING } from './focus';
import { formatCoordinates } from './format';

const MANILA: [number, number] = [120.9842, 14.5995];

export interface PickedLocation {
  lat: number;
  lng: number;
  /** Street address from reverse geocoding; null until it arrives (or if it fails). */
  name: string | null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const json = await res.json();
    return json.display_name ?? null;
  } catch {
    return null; // non-fatal: the coordinates are what matter
  }
}

/**
 * Tap the map, drag the pin or use the device location; the address is looked up after. With
 * `autoLocate`, an empty picker asks for the device location straight away. `onChange` is
 * called with `userAction: false` for that automatic first fix and for the address arriving
 * later.
 */
export function LocationPicker({
  location,
  error,
  onChange,
  labelledBy,
  autoLocate = false,
}: {
  location: PickedLocation | null;
  error?: string;
  onChange: (location: PickedLocation | null, userAction: boolean) => void;
  labelledBy?: string;
  autoLocate?: boolean;
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Only the latest pin's address is applied.
  const requestRef = useRef(0);

  const pick = useCallback(async (lat: number, lng: number, userAction: boolean) => {
    const request = ++requestRef.current;
    onChangeRef.current({ lat, lng, name: null }, userAction);
    setIsGeocoding(true);
    const name = await reverseGeocode(lat, lng);
    if (request !== requestRef.current) return;
    setIsGeocoding(false);
    if (name) onChangeRef.current({ lat, lng, name }, false);
  }, []);

  const locate = useCallback(
    (userAction: boolean) => {
      if (!navigator.geolocation) {
        setGeoError('This browser can’t share its location. Tap the map to drop a pin.');
        return;
      }
      setIsLocating(true);
      setGeoError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false);
          void pick(position.coords.latitude, position.coords.longitude, userAction);
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
    },
    [pick]
  );

  useEffect(() => {
    if (autoLocate && !location) locate(false);
    // Only on mount: after Clear, or with a restored pin, it must not re-prompt.
  }, []);

  const clear = () => {
    requestRef.current++;
    setIsGeocoding(false);
    onChange(null, true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={error ? 'location-error' : undefined}
        className={cn(
          'relative h-45 overflow-hidden rounded-2xl border md:h-50',
          error ? 'border-[#b42318]' : 'border-gray-200'
        )}
      >
        <Map
          theme="light"
          center={location ? [location.lng, location.lat] : MANILA}
          zoom={location ? 16 : 12}
        >
          <MapControls showZoom position="top-right" />
          <MapClickHandler onPick={(lng, lat) => void pick(lat, lng, true)} />
          {location && <MapFlyTo lat={location.lat} lng={location.lng} />}
          {location && (
            <MapMarker
              longitude={location.lng}
              latitude={location.lat}
              anchor="center"
              draggable
              onDragEnd={({ lng, lat }) => void pick(lat, lng, true)}
            >
              <MarkerContent>
                <span className="bg-brand-500 block size-5 rounded-full border-3 border-white shadow-[0_2px_6px_rgba(16,24,40,.35)]" />
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
        <button
          type="button"
          onClick={() => locate(true)}
          disabled={isLocating}
          className={cn(
            'absolute bottom-3 left-3 z-10 flex h-12 items-center gap-2 rounded-full bg-white px-4.5 text-[14px] large-text:text-[16px] font-bold text-gray-900 shadow-[0_4px_8px_-2px_rgba(16,24,40,.16)] transition-[filter] hover:brightness-97 disabled:cursor-wait',
            FOCUS_RING
          )}
        >
          <LocateFixed size={16} aria-hidden className="text-brand-500" />
          {isLocating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {location ? (
        <div className="flex items-start gap-2.5">
          <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-[#027a48]" />
          <span className="min-w-0 flex-1 text-[14px] large-text:text-[16px] leading-[1.45] text-gray-700">
            {location.name ??
              (isGeocoding ? (
                'Finding the address…'
              ) : (
                <span className="font-landing-mono text-[13px] large-text:text-[14px]">
                  {formatCoordinates(location.lat, location.lng)}
                </span>
              ))}
          </span>
          <button
            type="button"
            onClick={clear}
            className={cn(
              'text-brand-500 hover:bg-brand-25 -my-3.5 -mr-3 h-12 shrink-0 rounded-full px-3 text-[14px] large-text:text-[16px] font-bold',
              FOCUS_RING
            )}
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-[13px] large-text:text-[14px] text-gray-500">
          {isLocating
            ? 'Finding your location…'
            : 'Tap the map to drop a pin, or use your location.'}
        </p>
      )}
      {geoError && !location && (
        <p className="text-[13px] large-text:text-[14px] font-medium text-[#b54708]">{geoError}</p>
      )}
      <FieldError id="location-error">{error}</FieldError>
    </div>
  );
}
