import {
  initialNote,
  memoryOnStart,
  readNoteMemory,
  writeNoteMemory,
  type NoteState,
} from '@/lib/completed-note';
import { create } from 'zustand';

interface CompletedNoteState {
  /** Each completed event's note on this page visit, once started. */
  notes: Record<string, NoteState>;
  /** Starts an event's note from what this browser remembers (once per page load). */
  start: (eventId: string) => void;
  /** The chip or the Minimize button: remembered, and the countdown stops. */
  setOpen: (eventId: string, open: boolean) => void;
  /** Keep open: stays open now and on later visits. */
  keepOpen: (eventId: string) => void;
  /** The first visit's countdown ran out. */
  autoMinimize: (eventId: string) => void;
}

/** Shared by the status chip (page header) and the note (event summary). */
export const useCompletedNoteStore = create<CompletedNoteState>((set, get) => ({
  notes: {},
  start: (eventId) => {
    if (get().notes[eventId]) return;
    const memory = readNoteMemory(eventId);
    const remember = memoryOnStart(memory);
    if (remember && remember !== memory) writeNoteMemory(eventId, remember);
    set((s) => ({ notes: { ...s.notes, [eventId]: initialNote(memory) } }));
  },
  setOpen: (eventId, open) => {
    writeNoteMemory(eventId, open ? 'open' : 'closed');
    set((s) => ({ notes: { ...s.notes, [eventId]: { open, countdown: false } } }));
  },
  keepOpen: (eventId) => {
    writeNoteMemory(eventId, 'open');
    set((s) => ({ notes: { ...s.notes, [eventId]: { open: true, countdown: false } } }));
  },
  autoMinimize: (eventId) =>
    set((s) => ({ notes: { ...s.notes, [eventId]: { open: false, countdown: false } } })),
}));
