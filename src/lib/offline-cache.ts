import { isNetworkError } from './offline-queue';

// Reading through a local cache when the network is missing or too slow to wait for. Field
// phones are often "online" with no usable signal, and server actions have no timeout of their
// own, so a slow answer counts as no answer once a cached copy exists.

/** Rejects after `ms` with a TypeError, which isNetworkError treats like a dropped connection. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TypeError('Network request timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const NOT_SAVED = "This isn't saved on this phone yet. Connect to the internet once to get it.";

/**
 * Offline: the cached copy. Online: a fresh copy, which then replaces the cached one — unless
 * it takes longer than `slowMs` or can't reach the server, when the cached copy is used (the
 * fresh one still lands in the cache for next time). With nothing cached, it waits.
 */
export async function cachedFetch<T>({
  online,
  read,
  write,
  fetch,
  slowMs,
}: {
  online: boolean;
  read: () => Promise<T | undefined>;
  write: (value: T) => Promise<void>;
  fetch: () => Promise<T>;
  slowMs: number;
}): Promise<T> {
  const cached = await read().catch(() => undefined);
  if (!online) {
    if (cached !== undefined) return cached;
    throw new Error(NOT_SAVED);
  }

  const fresh = fetch().then(async (value) => {
    await write(value).catch(() => {});
    return value;
  });
  if (cached === undefined) return fresh;

  fresh.catch(() => {}); // it may settle after we've answered from the cache
  try {
    return await withTimeout(fresh, slowMs);
  } catch (err) {
    // Same rule as the offline queue: a connectivity-shaped failure (or the timeout) falls back
    // to the cache, a real server error comes through.
    if (isNetworkError(err)) return cached;
    throw err;
  }
}
