import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
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
  workboxOptions: {
    disableDevLogs: true,
    // No custom runtimeCaching here — leave next-pwa's own defaultCache in place
    // (fonts, images, JS/CSS chunks, Next data) rather than replacing it outright.
  },
})(nextConfig);
