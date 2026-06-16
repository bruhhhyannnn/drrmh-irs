import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
};

module.exports = {
  allowedDevOrigins: ['10.49.218.251'],
};

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
})(nextConfig);
