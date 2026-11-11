import { REPORT_MAX_PHOTOS } from './constants';

// Edit report with photos: which saved photos one place (the damage, or one casualty) keeps,
// which new uploads it takes, and what is left to delete from Storage. Pure, so the server
// action stays a thin wrapper and the arithmetic is tested.

/**
 * The saved photos a place keeps: those in `keep` that are really its own (a client can't
 * point a place at someone else's photo). `keep` unset keeps them all, for a form that couldn't
 * load the photos and so never offered to remove any.
 */
export function keptPhotoPaths(existing: string[], keep: string[] | undefined): string[] {
  if (!keep) return existing;
  const wanted = new Set(keep);
  return existing.filter((path) => wanted.has(path));
}

/** How many new photos a place can still take. */
export function newPhotoRoom(existing: string[], keep: string[] | undefined): number {
  return Math.max(0, REPORT_MAX_PHOTOS - keptPhotoPaths(existing, keep).length);
}

/**
 * A place's photos after the edit: the kept ones, then the uploads, at most `REPORT_MAX_PHOTOS`.
 * `removed` is everything to delete once the edit commits: saved photos taken off, and uploads
 * that didn't fit.
 */
export function mergePhotoPaths(
  existing: string[],
  keep: string[] | undefined,
  uploaded: string[]
): { paths: string[]; removed: string[] } {
  const paths = [...keptPhotoPaths(existing, keep), ...uploaded].slice(0, REPORT_MAX_PHOTOS);
  const final = new Set(paths);
  return { paths, removed: [...existing, ...uploaded].filter((path) => !final.has(path)) };
}
