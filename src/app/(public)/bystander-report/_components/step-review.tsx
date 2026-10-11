'use client';

import { FOCUS_RING, TEXT_BUTTON } from '@/app/(public)/_components/primitives';
import { cn, type BystanderFormValues } from '@/lib';
import { ShieldCheck } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';
import { FooterSlot, StepFooter, StepHeader, StepTitle } from './chrome';
import { Button, FieldError, FieldHelp, FieldLabel } from './fields';
import type { PhotoItem } from './photo-field';

interface StepReviewProps {
  titleRef: React.Ref<HTMLHeadingElement>;
  register: UseFormRegister<BystanderFormValues>;
  contactError?: string;
  isOnline: boolean;
  isSending: boolean;
  summary: {
    incidentType: string;
    coordinates: string;
    place: string;
    locationDescription: string;
    headcount: string | null;
    people: string | null;
    damage: string | null;
    description: string;
  };
  photos: PhotoItem[];
  onEdit: (step: 1 | 2) => void;
  onOpenPrivacy: () => void;
  onBack: () => void;
}

/** Step 3 — one summary before sending, each line with Edit, then the optional contact number. */
export function StepReview({
  titleRef,
  register,
  contactError,
  isOnline,
  isSending,
  summary,
  photos,
  onEdit,
  onOpenPrivacy,
  onBack,
}: StepReviewProps) {
  return (
    <>
      <StepHeader step={3} aside="Check, then send" />
      <StepTitle ref={titleRef}>Review and send</StepTitle>

      <div className="flex flex-col rounded-2xl border border-gray-200 px-4">
        <ReviewRow label="Incident type" onEdit={() => onEdit(1)}>
          <span className="text-[15px] font-semibold">{summary.incidentType}</span>
        </ReviewRow>
        <ReviewRow label="Location" onEdit={() => onEdit(1)}>
          <span className="font-landing-mono text-[13px]">{summary.coordinates}</span>
          <span className="text-[15px] font-semibold">{summary.place}</span>
          {summary.locationDescription && (
            <span className="text-[14px] text-gray-600">{summary.locationDescription}</span>
          )}
        </ReviewRow>
        <ReviewRow label="Headcount" onEdit={() => onEdit(2)}>
          <Filled value={summary.headcount} />
        </ReviewRow>
        <ReviewRow label="People affected" onEdit={() => onEdit(2)}>
          <Filled value={summary.people} />
        </ReviewRow>
        <ReviewRow label="Structural damage" onEdit={() => onEdit(2)}>
          <Filled value={summary.damage} />
        </ReviewRow>
        <ReviewRow label="Photos" onEdit={() => onEdit(2)} gap="gap-1.5">
          {photos.length ? (
            <div className="flex gap-1.5">
              {photos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={`Photo ${i + 1} of the damage`}
                  className="block size-11 rounded-[10px] object-cover"
                />
              ))}
            </div>
          ) : (
            <Filled value={null} />
          )}
        </ReviewRow>
        <ReviewRow label="Description" onEdit={() => onEdit(2)} last>
          <Filled value={summary.description || null} />
        </ReviewRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="contact-number" hint="Optional">
          Contact number
        </FieldLabel>
        <div
          className={cn(
            'flex h-12 items-center overflow-hidden rounded-2xl border bg-white has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]',
            contactError ? 'border-[#b42318]' : 'border-gray-300'
          )}
        >
          <span
            aria-hidden
            className="font-landing-mono flex h-full shrink-0 items-center border-r border-[#eaecf0] bg-gray-50 px-3.5 text-[15px] font-medium text-gray-600"
          >
            +63
          </span>
          <input
            id="contact-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="917 123 4567"
            aria-invalid={!!contactError || undefined}
            aria-describedby={contactError ? 'contact-help contact-error' : 'contact-help'}
            className="font-landing-mono h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-500"
            {...register('contact_number')}
          />
        </div>
        <FieldHelp id="contact-help">
          So responders can call you about this report. Only the DRRM-H team sees it.
        </FieldHelp>
        <FieldError id="contact-error">{contactError}</FieldError>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gray-100 px-4 py-3.5 text-[13px] leading-normal text-gray-700">
        <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Anonymous unless you add a contact number. Used only for emergency response and internal
          documentation.{' '}
          <button type="button" onClick={onOpenPrivacy} className={TEXT_BUTTON}>
            Read the full privacy notice
          </button>
        </span>
      </div>

      <StepFooter>
        <FooterSlot>
          <Button variant="outline" fullWidth onClick={onBack}>
            Back
          </Button>
        </FooterSlot>
        <FooterSlot>
          <Button type="submit" fullWidth loading={isSending}>
            {isSending
              ? isOnline
                ? 'Sending…'
                : 'Saving…'
              : isOnline
                ? 'Submit emergency report'
                : 'Save report to send later'}
          </Button>
        </FooterSlot>
      </StepFooter>
    </>
  );
}

function ReviewRow({
  label,
  onEdit,
  last,
  gap = 'gap-0.5',
  children,
}: {
  label: string;
  onEdit: () => void;
  last?: boolean;
  gap?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center gap-4 py-3', !last && 'border-b border-[#eaecf0]')}>
      <div className={cn('flex min-w-0 flex-1 flex-col', gap)}>
        <span className="text-[13px] font-medium text-gray-500">{label}</span>
        <div className={cn('flex flex-col break-words', gap)}>{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={cn(
          'text-brand-500 shrink-0 rounded text-[14px] font-bold hover:text-[#7a1515] hover:underline',
          FOCUS_RING
        )}
      >
        Edit
      </button>
    </div>
  );
}

/** The value, or a grey "Not added". */
function Filled({ value }: { value: string | null }) {
  return value ? (
    <span className="text-[15px] leading-[1.4] font-semibold text-pretty">{value}</span>
  ) : (
    <span className="text-[15px] text-gray-500">Not added</span>
  );
}
