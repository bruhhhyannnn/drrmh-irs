'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { CAMPUS_LOGO_EDGE } from '@/lib/campus-logo';
import { LOGO_INPUT_TYPES, scaleLogo } from '@/lib/scale-logo';
import { ImagePlus, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '../../_components/drawer-parts';

/** What the form holds for the logo: unchanged, a new scaled file, or removed. */
export type LogoChoice =
  { kind: 'keep' } | { kind: 'new'; blob: Blob; url: string; name: string } | { kind: 'remove' };

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Add / Edit campus: Logo. A 112 px preview, Choose file / Replace / Remove, and drag and drop
 * on web. PNG, JPG or SVG; the browser scales it to 512 × 512 (keeping transparency) before it
 * is saved with the campus. `current` is the uploaded logo, `fallback` what shows without one.
 */
export function LogoField({
  current,
  fallback,
  value,
  onChange,
}: {
  current: string | null;
  fallback: string | null;
  value: LogoChoice;
  onChange: (value: LogoChoice) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A new file's preview is an object URL; release it when it is replaced or the form closes.
  useEffect(() => {
    if (value.kind !== 'new') return;
    return () => URL.revokeObjectURL(value.url);
  }, [value]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_INPUT_TYPES.includes(file.type)) {
      setError('Choose a PNG, JPG or SVG image.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const blob = await scaleLogo(file);
      onChange({ kind: 'new', blob, url: URL.createObjectURL(blob), name: file.name });
    } catch {
      setError('That image couldn’t be read. Try another file.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const shown = value.kind === 'new' ? value.url : value.kind === 'remove' ? null : current;
  const preview = shown ?? fallback;
  const button = cn(
    'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold whitespace-nowrap transition-colors duration-120 ease-out',
    FOCUS_RING
  );

  return (
    <FormField
      id="campus-logo"
      label="Logo"
      hint="Optional"
      labelAs="span"
      error={error}
      help="Shown in the sidebar, campus cards, event lists and reports. Without one, the UP seal is used."
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-2xl',
          dragging && 'outline-2 outline-offset-4 outline-brand-500 outline-dashed'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={shown ? 'Replace the logo' : 'Add a logo'}
          className={cn(
            'grid size-28 shrink-0 place-items-center overflow-hidden rounded-[20px] border-[1.5px] bg-surface transition-colors duration-120 ease-out hover:border-gray-400',
            shown ? 'border-gray-200' : 'border-dashed border-gray-300',
            FOCUS_RING
          )}
        >
          {preview ? (
            <span
              aria-hidden
              className={cn('size-24 bg-contain bg-center bg-no-repeat', !shown && 'opacity-60')}
              style={{ backgroundImage: `url(${preview})` }}
            />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-[14px] font-semibold text-gray-600">
              <ImagePlus size={22} aria-hidden />
              Add logo
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2">
          <p aria-live="polite" className="text-[14px] leading-[1.45] text-gray-600">
            {busy ? (
              'Preparing the logo…'
            ) : value.kind === 'new' ? (
              <>
                <span className="block truncate font-semibold text-gray-900">{value.name}</span>
                {CAMPUS_LOGO_EDGE} × {CAMPUS_LOGO_EDGE} · {kb(value.blob.size)} after resizing
              </>
            ) : shown ? (
              'The uploaded logo.'
            ) : fallback && value.kind !== 'remove' ? (
              'The built-in logo. Upload one to replace it.'
            ) : (
              'PNG, JPG or SVG, square works best. Drop a file here or choose one.'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className={cn(
                button,
                'border-[1.5px] border-gray-300 bg-surface text-gray-900 hover:border-gray-400 hover:bg-hover'
              )}
            >
              <Upload size={16} aria-hidden />
              {shown ? 'Replace' : 'Choose file'}
            </button>
            {shown && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange(current ? { kind: 'remove' } : { kind: 'keep' })}
                className={cn(button, 'text-gray-700 hover:bg-hover hover:text-gray-900')}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={input}
          id="campus-logo"
          type="file"
          accept={LOGO_INPUT_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-labelledby="campus-logo-label"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>
    </FormField>
  );
}
