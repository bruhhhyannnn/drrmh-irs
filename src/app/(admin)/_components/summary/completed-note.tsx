'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { COMPLETED_NOTE_MS, secondsLeft } from '@/lib/completed-note';
import { useCompletedNoteStore } from '@/store/completed-note.store';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { personName } from '../../_lib/format';
import type { Summary } from '../../_lib/summary';

const noteId = (eventId: string) => `completed-note-${eventId}`;
const chipId = (eventId: string) => `completed-chip-${eventId}`;

/** The event's note state, started from what this browser remembers. */
function useCompletedNote(eventId: string) {
  const note = useCompletedNoteStore((s) => s.notes[eventId]);
  const start = useCompletedNoteStore((s) => s.start);
  useEffect(() => start(eventId), [eventId, start]);
  return note;
}

/**
 * The status chip of a completed event. The note minimizes into it: "Completed" with a lock and
 * a chevron, a button that opens or minimizes the note in place.
 */
export function CompletedChip({ eventId }: { eventId: string }) {
  const note = useCompletedNote(eventId);
  const setOpen = useCompletedNoteStore((s) => s.setOpen);
  const open = !!note?.open;
  return (
    <button
      type="button"
      id={chipId(eventId)}
      aria-expanded={open}
      aria-controls={noteId(eventId)}
      onClick={() => setOpen(eventId, !open)}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-info-200 bg-info-50 pr-2 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-info-700 transition-colors duration-120 ease-out hover:border-info-700',
        FOCUS_RING
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-info-500" />
      Completed
      <Lock size={13} aria-hidden />
      <span className="sr-only">, {open ? 'hide' : 'show'} the completed note</span>
      {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
    </button>
  );
}

/**
 * Completed on … by …, reports locked, the clusters that didn't report. The first visit shows it
 * open, counting down 8 s to minimize (a hover or focus inside pauses it; Keep open stops it);
 * later visits start minimized unless the user kept it open. Minimized, it lives in
 * `CompletedChip`.
 */
export function CompletedNote({ summary }: { summary: Summary }) {
  const { event } = summary.source;
  const note = useCompletedNote(event.id);
  const setOpen = useCompletedNoteStore((s) => s.setOpen);
  const keepOpen = useCompletedNoteStore((s) => s.keepOpen);
  const autoMinimize = useCompletedNoteStore((s) => s.autoMinimize);
  const [left, setLeft] = useState(COMPLETED_NOTE_MS);
  const paused = useRef(false);
  const counting = !!note?.countdown;

  useEffect(() => {
    if (!counting) return;
    const step = 100;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      setLeft((ms) => Math.max(0, ms - step));
    }, step);
    return () => window.clearInterval(timer);
  }, [counting]);

  useEffect(() => {
    if (counting && left === 0) autoMinimize(event.id);
  }, [counting, left, autoMinimize, event.id]);

  const minimize = () => {
    setOpen(event.id, false);
    // The note goes, so focus moves to the chip that opens it again.
    document.getElementById(chipId(event.id))?.focus();
  };

  const by = personName(event.completer);
  const pending = summary.clusters.pending.map((c) => c.name);

  if (!note?.open) return <div id={noteId(event.id)} hidden />;
  return (
    <section
      id={noteId(event.id)}
      aria-label="Completed event"
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) paused.current = false;
      }}
      className="relative flex items-start gap-3 overflow-hidden rounded-[18px] border border-info-200 bg-info-50 px-4 py-3.5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-info-700">
        <Lock size={16} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] leading-[1.4] font-bold">
          Completed
          {event.ended_at && ` on ${format(new Date(event.ended_at), "MMM d, yyyy 'at' h:mm a")}`}
          {by && ` by ${by}`}
        </span>
        <span className="text-[16px] leading-normal text-pretty text-gray-600">
          Reports are locked.{' '}
          {pending.length > 0 &&
            `${pending.join(', ')} did not report before the event was completed. `}
          To reopen it, edit the event and set the status to Ongoing.
        </span>
        {counting && (
          <span className="mt-1 text-[14px] text-gray-600">
            <span aria-live="off">Minimizing in {secondsLeft(left)} s</span> ·{' '}
            <button
              type="button"
              onClick={() => keepOpen(event.id)}
              className={cn(
                'rounded font-semibold text-info-700 underline decoration-2 underline-offset-3 hover:text-gray-900',
                FOCUS_RING
              )}
            >
              Keep open
            </button>
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Minimize"
        aria-controls={noteId(event.id)}
        aria-expanded
        onClick={minimize}
        className={cn(
          '-mt-1 -mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-gray-600 transition-colors duration-120 ease-out hover:bg-hover-strong hover:text-gray-900',
          FOCUS_RING
        )}
      >
        <ChevronUp size={18} aria-hidden />
      </button>
      {counting && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.75 bg-info-500 transition-[width] duration-100 ease-linear motion-reduce:transition-none"
          style={{ width: `${(left / COMPLETED_NOTE_MS) * 100}%` }}
        />
      )}
    </section>
  );
}
