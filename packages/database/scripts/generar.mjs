/**
 * `prisma generate`, o su variante WASM cuando el entorno no puede bajar los
 * motores nativos (WL_PRISMA_WASM=1). Ver scripts/prisma-wasm.mjs.
 */
import { execFileSync } from 'node:child_process';

if (process.env.WL_PRISMA_WASM === '1') {
  execFileSync('node', ['scripts/prisma-wasm.mjs'], { stdio: 'inherit' });
} else {
  execFileSync('npx', ['prisma', 'generate'], { stdio: 'inherit' });
}
