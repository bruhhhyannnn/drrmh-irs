'use client';

import { FOCUS_RING } from '@/app/(public)/_components/primitives';
import { BYSTANDER_MAX_PHOTOS, cn } from '@/lib';
import { Camera, Loader2, ShieldCheck, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { preparePhoto } from '../_lib/prepare-photo';
import { FieldError, FieldLabel } from './fields';

export interface PhotoItem {
  id: string;
  /** Re-encoded JPEG, without the original file's metadata. */
  blob: Blob;
  /** Object URL for the preview; revoked when the photo is removed. */
  url: string;
}

interface PhotoFieldProps {
  photos: PhotoItem[];
  onAdd: (photos: PhotoItem[]) => void;
  onRemove: (id: string) => void;
}

let nextPhotoId = 0;

/** Up to 3 photos of the damage, from the camera or the gallery. */
export function PhotoField({ photos, onAdd, onRemove }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = BYSTANDER_MAX_PHOTOS - photos.length;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setIsPreparing(true);
    const picked = [...files].slice(0, room);
    const prepared: PhotoItem[] = [];
    let failed = 0;
    for (const file of picked) {
      try {
        const blob = await preparePhoto(file);
        prepared.push({ id: `photo-${(nextPhotoId += 1)}`, blob, url: URL.createObjectURL(blob) });
      } catch {
        failed += 1;
      }
    }
    setIsPreparing(false);
    if (prepared.length) onAdd(prepared);
    if (failed) {
      setError(
        failed === 1
          ? 'One photo couldn’t be opened. Try a JPG or PNG.'
          : 'Some photos couldn’t be opened. Try JPG or PNG files.'
      );
    } else if (files.length > picked.length) {
      setError(`Only ${BYSTANDER_MAX_PHOTOS} photos can be added.`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel id="photos-label" hint={`Optional · up to ${BYSTANDER_MAX_PHOTOS}`}>
        Photos of the damage
      </FieldLabel>
      <div role="group" aria-labelledby="photos-label" className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className="relative aspect-square overflow-hidden rounded-[14px] border border-[#eaecf0] bg-gray-100"
          >
            <img
              src={photo.url}
              alt={`Photo ${i + 1} of the damage`}
              className="block size-full object-cover"
            />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onRemove(photo.id)}
              className={cn(
                'absolute top-0 right-0 grid size-11 place-items-center rounded-[14px]',
                FOCUS_RING,
                'focus-visible:-outline-offset-3'
              )}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[rgba(16,24,40,.75)] text-white">
                <X size={14} strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isPreparing}
            className={cn(
              'hover:border-brand-500 hover:text-brand-500 flex aspect-square min-h-22 flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-gray-300 bg-gray-50 text-[13px] font-semibold text-gray-700 transition-colors disabled:cursor-wait',
              FOCUS_RING
            )}
          >
            {isPreparing ? (
              <Loader2 size={20} aria-hidden className="animate-spin" />
            ) : (
              <Camera size={20} aria-hidden />
            )}
            {isPreparing ? 'Adding…' : 'Add photo'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          // Allow picking the same file again after removing it.
          e.target.value = '';
        }}
      />
      <p className="flex items-start gap-2 text-[13px] leading-[1.45] text-gray-600">
        <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span className="text-pretty">
          Avoid faces, name tags and IDs. Location data saved in the photo is removed before it is
          sent.
        </span>
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}
