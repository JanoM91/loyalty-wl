/**
 * Migraciones al construir en Vercel, solo contra la base que corresponde.
 *
 * - Producción: siempre (`VERCEL_ENV=production`).
 * - Vista previa: solo con `WL_MIGRAR_EN_VISTA_PREVIA=1`, que se pone cuando
 *   las vistas previas tienen su propia base (rama de Neon). Sin esa marca,
 *   una vista previa no cambia la estructura de la base de producción antes
 *   de que el PR se apruebe.
 * - Fuera de Vercel (CI, local): siempre; ahí la base es de pruebas.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const entorno = process.env.VERCEL_ENV;
const toca = !entorno || entorno === 'production' || process.env.WL_MIGRAR_EN_VISTA_PREVIA === '1';

if (!toca) {
  console.log(
    `[migraciones] ${entorno}: no se migra (la vista previa no tiene base propia; ver WL_MIGRAR_EN_VISTA_PREVIA).`,
  );
  process.exit(0);
}

const r = spawnSync(
  process.execPath,
  ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  { stdio: 'inherit', cwd: path.resolve(import.meta.dirname, '..') },
);
process.exit(r.status ?? 1);
