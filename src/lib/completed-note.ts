// The completed-event note (event details, campus page): open or minimized into the status chip,
// remembered per event in this browser.

/** How long the note stays open on the first visit before it minimizes itself. */
export const COMPLETED_NOTE_MS = 8000;

export const completedNoteKey = (eventId: string) => `irs.completedNote.${eventId}`;

/** What this browser remembers for an event's note: null on the first visit. */
export type NoteMemory = 'open' | 'closed' | null;

export interface NoteState {
  open: boolean;
  /** Open on the first visit and counting down to minimize itself. */
  countdown: boolean;
}

/**
 * How the note starts. The first visit opens it and counts down; later visits start minimized
 * unless the user kept it open.
 */
export function initialNote(memory: NoteMemory): NoteState {
  if (memory === null) return { open: true, countdown: true };
  return { open: memory === 'open', countdown: false };
}

/** What to remember when the note starts: a first visit counts as seen, so the next starts small. */
export function memoryOnStart(memory: NoteMemory): NoteMemory {
  return memory ?? 'closed';
}

export function readNoteMemory(eventId: string): NoteMemory {
  try {
    const value = localStorage.getItem(completedNoteKey(eventId));
    return value === 'open' || value === 'closed' ? value : null;
  } catch {
    // Storage blocked (private window, previews): every visit is a first visit.
    return null;
  }
}

export function writeNoteMemory(eventId: string, memory: Exclude<NoteMemory, null>) {
  try {
    localStorage.setItem(completedNoteKey(eventId), memory);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/** Whole seconds left in the countdown, for "Minimizing in 6 s". */
export const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
