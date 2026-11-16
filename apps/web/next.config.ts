import type { NextConfig } from 'next';
import path from 'node:path';

// Un solo archivo de variables para todo el proyecto: `.env.local` en la raíz.
// Next solo busca en apps/web, así que aquí se carga el de la raíz. En Vercel
// no existe ese archivo y las variables vienen del panel: no pasa nada.
try {
  process.loadEnvFile(path.join(process.cwd(), '../../.env.local'));
} catch {
  // Sin archivo: se usan las variables del entorno.
}

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  // Monorepo: al empaquetar para Vercel hay que seguir los archivos desde la
  // raíz del repositorio (ahí vive el motor de Prisma), no desde apps/web.
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
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
