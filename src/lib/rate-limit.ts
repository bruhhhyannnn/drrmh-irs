import { createHash } from 'crypto';

// A per-client limit for public server actions (#104): the QR bystander form takes anonymous
// reports with photos, so nothing else stops a script from filling the database and Storage.
// The counter lives in Postgres (prisma/manual/DRRM-049-rate-limits.sql), so it holds across
// serverless copies; until that SQL runs, each copy counts on its own. Server only.

type HeaderBag = { get(name: string): string | null };

/**
 * The client's IP as the host reports it. Vercel sets `x-real-ip` and `x-vercel-forwarded-for`
 * itself and overwrites `x-forwarded-for`, so a client can't pick its own; elsewhere only the
 * left-most `x-forwarded-for` value is read. Null when there is none (local development).
 */
export function clientIp(headers: HeaderBag): string | null {
  const raw =
    headers.get('x-real-ip') ??
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-forwarded-for') ??
    '';
  const ip = raw.split(',')[0]?.trim();
  return ip ? ip.slice(0, 100) : null;
}

/** One client's count in the current window. */
export type WindowCount = { start: number; hits: number };

/** The count after one more hit: a new window once `windowMs` has passed since it started. */
export function nextWindow(
  current: WindowCount | undefined,
  now: number,
  windowMs: number
): WindowCount {
  if (!current || now - current.start >= windowMs) return { start: now, hits: 1 };
  return { start: current.start, hits: current.hits + 1 };
}

const memory = new Map<string, WindowCount>();
const MEMORY_MAX = 5_000;

function memoryHit(key: string, windowMs: number) {
  const count = nextWindow(memory.get(key), Date.now(), windowMs);
  memory.delete(key);
  memory.set(key, count);
  if (memory.size > MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  return count.hits;
}

/** IPs are personal data, so only a salted hash of one is kept. */
function hashKey(key: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'irs';
  return createHash('sha256').update(`${salt}:${key}`).digest('hex');
}

/**
 * The shared counter's one statement: count a hit for the key, starting a new window once
 * `$2` seconds have passed since it began. Bound parameters: $1 the hashed key, $2 the window in
 * seconds. Exported so the test can run this exact text against a real Postgres.
 */
export const COUNT_HIT_SQL = `
  INSERT INTO public.rate_limits (key, window_start, hits)
  VALUES ($1, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE
      WHEN rate_limits.window_start <= now() - make_interval(secs => $2::float8) THEN 1
      ELSE rate_limits.hits + 1 END,
    window_start = CASE
      WHEN rate_limits.window_start <= now() - make_interval(secs => $2::float8)
      THEN now() ELSE rate_limits.window_start END
  RETURNING hits`;

/** Counts a hit for an already-hashed key in the shared table; resolves to the window's hits. */
export type CountHit = (hashedKey: string, windowMs: number) => Promise<number>;

/** The production counter: COUNT_HIT_SQL through Prisma. */
export const countHitInDatabase: CountHit = async (hashedKey, windowMs) => {
  // Loaded here, so the pure helpers above can be tested without a database client.
  const { prisma } = await import('./prisma');
  const rows = await prisma.$queryRawUnsafe<{ hits: number }[]>(
    COUNT_HIT_SQL,
    hashedKey,
    windowMs / 1000
  );
  // Now and then, forget clients not seen for a day.
  if (Math.random() < 0.01) {
    await prisma.$executeRaw`
      DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day'`;
  }
  return Number(rows[0]?.hits ?? 1);
};

/**
 * Counts one hit for `key` and says whether it is still within `limit` per `windowMs`. Never
 * throws: if the database can't be reached (or `countHit` throws) the hit is counted in this
 * server copy only. `countHit` defaults to the shared table; tests pass their own.
 */
export async function withinRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  countHit: CountHit = countHitInDatabase
): Promise<boolean> {
  const hashed = hashKey(key);
  try {
    return (await countHit(hashed, windowMs)) <= limit;
  } catch {
    return memoryHit(hashed, windowMs) <= limit;
  }
}
