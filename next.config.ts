import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ['10.10.4.89'],
  experimental: {
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
  // Keep next-pwa's own defaultCache (fonts, images, JS/CSS chunks, Next data); the rule below
  // is added in front of it rather than replacing it.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
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
