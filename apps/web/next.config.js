/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@agentflow/types'],
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
