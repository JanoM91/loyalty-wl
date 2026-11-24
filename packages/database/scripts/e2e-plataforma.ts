/**
 * Apoyo de la prueba E2E del panel de plataforma (apps/web/e2e). NO es para
 * producción: crea (o reinicia) una cuenta de plataforma y un club en prueba.
 *
 *     tsx scripts/e2e-plataforma.ts <correo> <contraseña> <slug del club>
 */
import { vencimientoDePrueba } from '@wl/domain';

import * as db from '../src/index';

const [email, clave, slug] = process.argv.slice(2);
if (process.env.WL_PRUEBAS_BD !== '1' || !email || !clave || !slug) {
  console.error('Uso (solo con WL_PRUEBAS_BD=1): e2e-plataforma <correo> <contraseña> <slug>');
  process.exit(1);
}
const cuenta = await db.crearUsuarioPlataforma({ email, nombre: 'Prueba E2E', clave });
if (!cuenta.ok) throw new Error(cuenta.error);
const previo = await db.negocioPorSlug(slug);
if (previo) await db.borrarNegocio(previo.id);
const club = await db.crearNegocio({
  slug,
  nombre: `Club ${slug}`,
  prefijoCodigo: 'PE',
  ajustes: {
    pruebaVence: vencimientoDePrueba(),
    alta: {
      giro: 'cafeteria',
      correo: `duenio-${slug}@ejemplo.mx`,
      whatsapp: '522281234567',
      origen: 'empezar',
      legal: 'v1',
    },
  },
  sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
});
if (!club.ok) throw new Error(club.error);
process.stdout.write(`listo ${slug}\n`);
await db.desconectar();
await db.desconectarPlataforma();
