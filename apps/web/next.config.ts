import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@aegispay/shared'],
  poweredByHeader: false,
};

export default nextConfig;
