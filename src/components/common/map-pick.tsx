'use client';

import { useMap } from '@/components/ui';
import { useEffect, useRef } from 'react';

/** Flies the map to a point whenever it changes. Render inside `<Map>`. */
export function MapFlyTo({ lat, lng, zoom = 16 }: { lat: number; lng: number; zoom?: number }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center: [lng, lat], zoom, duration: 1200 });
  }, [map, isLoaded, lat, lng, zoom]);
  return null;
}

/** Reports map clicks as (lng, lat) and shows a crosshair cursor. Render inside `<Map>`. */
export function MapClickHandler({ onPick }: { onPick: (lng: number, lat: number) => void }) {
  const { map, isLoaded } = useMap();
  const cbRef = useRef(onPick);
  cbRef.current = onPick;

  useEffect(() => {
    if (!map || !isLoaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => cbRef.current(e.lngLat.lng, e.lngLat.lat);
    map.on('click', handler);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map, isLoaded]);

  return null;
}
