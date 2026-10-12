'use client';

import { Button, Drawer } from '@/components/ds';
import { cn } from '@/lib';
import { useState } from 'react';
import { formatShortDateTime } from '../_lib/format';

export interface OngoingEvent {
  id: string;
  name: string;
  started_at: Date | string | null;
}

/** "Change event": the ongoing events for the member's campus, as radio cards. */
export function EventDrawer({
  open,
  onClose,
  events,
  selectedId,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  events: OngoingEvent[];
  selectedId: string;
  onChoose: (eventId: string) => void;
}) {
  const [choice, setChoice] = useState(selectedId);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Reporting for"
      subtitle="Ongoing events you can report on."
      footer={
        <Button
          fullWidth
          disabled={!choice}
          onClick={() => {
            onChoose(choice);
            onClose();
          }}
        >
          Use this event
        </Button>
      }
    >
      <div role="radiogroup" aria-label="Ongoing events" className="flex flex-col gap-2.5">
        {events.map((event) => {
          const checked = event.id === choice;
          return (
            <label
              key={event.id}
              className={cn(
                'flex cursor-pointer items-center gap-3.5 rounded-2xl p-4 text-left has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]',
                checked
                  ? 'border-brand-500 bg-brand-25 border-2 shadow-[0_4px_8px_-2px_rgba(16,24,40,.10)]'
                  : 'border-[1.5px] border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                name="ongoing-event"
                value={event.id}
                checked={checked}
                onChange={() => setChoice(event.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'size-5.5 shrink-0 rounded-full bg-white',
                  checked ? 'border-brand-500 border-6' : 'border-[1.5px] border-gray-400'
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                <span
                  className={cn(
                    'text-[17px] text-gray-900',
                    checked ? 'font-bold' : 'font-semibold'
                  )}
                >
                  {event.name}
                </span>
                <span className={cn('text-[14px]', checked ? 'text-gray-600' : 'text-gray-500')}>
                  Ongoing
                  {event.started_at && ` · started ${formatShortDateTime(event.started_at)}`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Drawer>
  );
}
