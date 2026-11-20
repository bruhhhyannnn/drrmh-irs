import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

/** The Supabase project (auth, Storage photos and logos), for the content security policy. */
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();

/**
 * Where the app may load things from (#104). Sent as Report-Only for now: the browser console
 * lists anything it would block, and nothing breaks. Check the admin pages, the ERT form, the QR
 * form and the maps, then switch to enforcing. Next's inline hydration scripts need
 * 'unsafe-inline' until the app sends a per-request nonce.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://*.cartocdn.com https://*.googleusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace(/^https:/, 'wss:')} https://*.cartocdn.com https://nominatim.openstreetmap.org`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .replace(/\s+/g, ' ');

/** Sent with every response (#104). */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The report forms take photos and the location; nothing uses the microphone.
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  turbopack: {},
  allowedDevOrigins: ['10.10.4.89'],
  experimental: {
    agentUpgrade: 'security',
    serverActions: {
      // Bystander reports carry up to 3 photos (~1 MB each after the browser resizes them) in
      // one createBystanderReport call; the 1 MB default would reject them.
      bodySizeLimit: '8mb',
    },
  },
};

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  disable: process.env.NODE_ENV === 'development',
  // This app has no /api/* routes (data access goes through server actions), and reloading
  // the page the instant connectivity returns would blow away an in-progress offline report
  // draft — the offline queue's own online listener handles syncing instead.
  reloadOnOnline: false,
  fallbacks: {
    document: '/~offline',
  },
  // Everything in public/ is precached, on every phone, unless excluded. The NSED report
  // template is only fetched by admins exporting a report, online.
  publicExcludes: ['!noprecache/**/*', '!templates/**/*'],
  // Keep next-pwa's own defaultCache (fonts, images, JS/CSS chunks, Next data); the rules below
  // are added in front of it rather than replacing it.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Report and bystander photos (casualty photos are health information) load through
        // signed Supabase Storage URLs. Never keep them in Cache Storage, where the default
        // cross-origin rule would leave them on a shared office PC after the link expires.
        urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/sign/'),
        handler: 'NetworkOnly',
      },
      {
        // Google profile photos (DRRM-039) are personal information: they load from Google
        // each time and are never kept in Cache Storage.
        urlPattern: ({ url }) => url.hostname.endsWith('googleusercontent.com'),
        handler: 'NetworkOnly',
      },
      {
        // The ERT landing page and the building assessment open from the cache with any query
        // string (?draft=…, ?view=…): the page is the same for all of them and reads the draft
        // from IndexedDB, so a draft reopened offline, or after the default one-day page cache
        // has expired, still loads instead of the offline page.
        urlPattern: ({ request, url, sameOrigin }) =>
          sameOrigin &&
          request.mode === 'navigate' &&
          (url.pathname === '/assessment' || url.pathname === '/home'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'ert-pages',
          networkTimeoutSeconds: 5,
          matchOptions: { ignoreSearch: true },
          expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
})(nextConfig);
