import type { BrowserContext, Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Keeps the end-to-end tests from changing the database they run against.
//
// Every database write goes through a server action, and a server action is a POST carrying a
// `next-action` header with the action's id. Next's server reference manifest maps each id to
// the function's exported name; reads are all named get…, so anything else is stopped in the
// browser before it is sent. The app sees a dropped connection, which is what a test of a
// write path checks for (e.g. a bystander report then waits in the offline queue).
//
// The browser also talks to Supabase directly, for auth only. Signing in and refreshing the
// session go through; anything else that isn't a read (reset emails, password changes,
// sign-out, which ends the session the other tests share) is stopped too.

const NEXT_DIR = path.join(__dirname, '..', '..', '.next');
const MANIFEST = 'server-reference-manifest.json';

type Manifest = { node?: Record<string, { exportedName?: string }> };

const actionNames = new Map<string, string>();

/** The dev server's per-page manifests, which can be ahead of its merged one. */
function devPageManifests() {
  try {
    return fs
      .readdirSync(path.join(NEXT_DIR, 'dev', 'server', 'app'), { recursive: true })
      .map(String)
      .filter((file) => path.basename(file) === MANIFEST)
      .map((file) => path.join(NEXT_DIR, 'dev', 'server', 'app', file));
  } catch {
    return [];
  }
}

function readManifests() {
  const files = [
    path.join(NEXT_DIR, 'dev', 'server', MANIFEST), // next dev
    ...devPageManifests(),
    path.join(NEXT_DIR, 'server', MANIFEST), // next build, then next start
  ];
  for (const file of files) {
    let manifest: Manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // not built yet, or being rewritten
    }
    for (const [id, action] of Object.entries(manifest.node ?? {})) {
      if (action.exportedName) actionNames.set(id, action.exportedName);
    }
  }
}

/**
 * The action's exported name, or undefined if no manifest has it. The dev server adds actions
 * as it compiles pages, so an unknown id is looked up again for a couple of seconds.
 */
async function actionName(id: string) {
  for (let attempt = 0; attempt < 5 && !actionNames.has(id); attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 500));
    readManifests();
  }
  return actionNames.get(id);
}

const SUPABASE_API = /\/(auth|rest|storage|functions)\/v1\//;

function isSupabaseWrite(request: Request) {
  const { pathname } = new URL(request.url());
  if (!SUPABASE_API.test(pathname)) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return false;
  return !pathname.endsWith('/auth/v1/token');
}

export interface Writes {
  /** What was stopped, in order: an action's name, or a Supabase call like `POST /auth/v1/recover`. */
  blocked: string[];
}

/**
 * Stops writes from every page in the context. A test's own `page.route` mocks run first, so a
 * test can still answer a call itself, e.g. fulfil the reset-password request.
 */
export async function blockWrites(context: BrowserContext): Promise<Writes> {
  const writes: Writes = { blocked: [] };

  await context.route('**/*', async (route) => {
    const request = route.request();

    const actionId = await request.headerValue('next-action');
    if (actionId) {
      const name = await actionName(actionId);
      if (name?.startsWith('get')) return route.fallback();
      // An id no manifest knows is stopped as well: when unsure, don't write.
      writes.blocked.push(name ?? `unknown action ${actionId}`);
      return route.abort('blockedbyclient');
    }

    if (isSupabaseWrite(request)) {
      writes.blocked.push(`${request.method()} ${new URL(request.url()).pathname}`);
      return route.abort('blockedbyclient');
    }

    return route.fallback();
  });

  return writes;
}
