/**
 * Genera el cliente de Prisma SIN descargar los motores nativos y lo deja
 * listo para correr con el motor WASM que ya viene en el paquete, sobre el
 * adaptador `pg`.
 *
 * Para qué sirve: entornos sin acceso a `binaries.prisma.sh` (un sandbox de
 * agente, una red corporativa cerrada). Ahí `prisma generate` normal falla.
 * Con esto se pueden correr las pruebas de integración y la aplicación
 * poniendo `WL_PRISMA_WASM=1`.
 *
 * Qué NO es: el modo de producción. En la computadora de desarrollo y en
 * Vercel se usa `prisma generate` normal y el motor nativo. Las migraciones
 * (`prisma migrate`) necesitan el motor nativo sí o sí; en un entorno cerrado
 * se aplica el SQL de `prisma/migrations` con `psql`.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const falso = path.join(mkdtempSync(path.join(tmpdir(), 'wl-prisma-')), 'motor-falso');
writeFileSync(falso, '', { mode: 0o755 });

execFileSync('npx', ['prisma', 'generate', '--no-engine'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://x:x@localhost:5432/x',
    DIRECT_URL: process.env.DIRECT_URL ?? 'postgresql://x:x@localhost:5432/x',
    PRISMA_QUERY_ENGINE_LIBRARY: falso,
    PRISMA_SCHEMA_ENGINE_BINARY: falso,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  },
});

const carpeta = path.join(
  path.dirname(require.resolve('@prisma/client/package.json')),
  '..',
  '..',
  '.prisma',
  'client',
);
const archivo = path.join(carpeta, 'wasm.js');
let codigo = readFileSync(archivo, 'utf8');
if (!codigo.includes('config.engineWasm = undefined')) {
  console.log('wasm.js ya estaba preparado.');
} else {
  codigo = codigo
    .replace(
      'config.engineWasm = undefined',
      `config.engineWasm = {
  getRuntime: () => require('@prisma/client/runtime/query_engine_bg.postgresql.js'),
  getQueryEngineWasmModule: async () =>
    WebAssembly.compile(require('fs').readFileSync(require.resolve('@prisma/client/runtime/query_engine_bg.postgresql.wasm'))),
}`,
    )
    .replace('"copyEngine": false', '"copyEngine": true');
  writeFileSync(archivo, codigo);
  console.log('Cliente de Prisma listo para el motor WASM (WL_PRISMA_WASM=1).');
}
