import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  transpilePackages: ['@wl/domain', '@wl/database'],
  // Prisma y el adaptador pg (modo WASM) se cargan con require en el servidor.
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@prisma/adapter-pg', 'pg'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
