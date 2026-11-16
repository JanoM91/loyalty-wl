import path from 'node:path';

import type { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { Pool } from 'pg';

/**
 * Cliente de Prisma sin contexto de negocio.
 *
 * **No se exporta fuera de este paquete.** Con él se puede leer la tabla de
 * negocios y abrir las transacciones que fijan `app.tenant_id`; todo lo demás
 * pasa por `prisma` y `transaccion` (ver index.ts), que sí llevan el negocio.
 *
 * Modo WASM (`WL_PRISMA_WASM=1`): para entornos que no pueden descargar los
 * motores nativos de Prisma. Ver scripts/prisma-wasm.mjs.
 */
export function crearCliente(url?: string): PrismaClient {
  const log: ('warn' | 'error')[] = ['warn', 'error'];

  if (process.env.WL_PRISMA_WASM === '1') {
    // Se resuelve desde la carpeta de este paquete, encontrada en tiempo de
    // ejecución: así funciona igual en las pruebas y dentro del servidor de
    // Next, cuyo empaquetador no debe intentar seguir estos `require`.
    // `getBuiltinModule` en vez de `import`: el empaquetador reconoce
    // `createRequire` importado y trata de seguirlo.
    const { createRequire } = (
      process as unknown as {
        getBuiltinModule(id: 'node:module'): {
          createRequire(desde: string): NodeJS.Require;
        };
      }
    ).getBuiltinModule('node:module');
    const aqui = createRequire(path.join(process.cwd(), 'noop.js'));
    let raizPaquete = process.cwd();
    try {
      raizPaquete = path.dirname(aqui.resolve('@wl/database/package.json'));
    } catch {
      // Ya estamos dentro del paquete (pruebas, siembra).
    }
    const require = createRequire(path.join(raizPaquete, 'noop.js'));
    const raiz = path.dirname(require.resolve('@prisma/client/package.json'));
    const generado = require(path.join(raiz, '..', '..', '.prisma', 'client', 'wasm.js')) as {
      PrismaClient: new (opciones: object) => PrismaClient;
    };
    const adaptador = require('@prisma/adapter-pg') as { PrismaPg: typeof PrismaPg };
    const pg = require('pg') as { Pool: typeof Pool };
    const pool = new pg.Pool({ connectionString: url ?? process.env.DATABASE_URL, max: 5 });
    return new generado.PrismaClient({ adapter: new adaptador.PrismaPg(pool), log });
  }

  const opciones: Prisma.PrismaClientOptions = url ? { log, datasourceUrl: url } : { log };
  return new PrismaClient(opciones);
}

/**
 * Singleton. En desarrollo, Next.js recarga módulos en cada cambio; sin esto
 * se abren decenas de conexiones y se agota el pool en minutos.
 */
const global = globalThis as unknown as { wlPrismaBase?: PrismaClient };

export const base: PrismaClient = global.wlPrismaBase ?? crearCliente();

if (process.env.NODE_ENV !== 'production') {
  global.wlPrismaBase = base;
}
