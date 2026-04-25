import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@agentflow/types'],
};

export default nextConfig;
