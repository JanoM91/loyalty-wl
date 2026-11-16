/**
 * Emite un enlace nuevo para que el dueño de un negocio fije su contraseña.
 *
 *     pnpm --filter @wl/database invitar <slug> <correo> "<nombre>"
 *
 * Imprime la ruta del enlace (un solo uso). No crea ni imprime contraseñas.
 */
import { desconectar, desconectarPlataforma, invitarDuenio, negocioPorSlug } from '../src/index';

const [slug, email, nombre] = process.argv.slice(2);
if (!slug || !email) {
  console.error('Uso: invitar <slug> <correo> "<nombre>"');
  process.exit(1);
}
const negocio = await negocioPorSlug(slug);
if (!negocio) {
  console.error(`No existe el negocio «${slug}».`);
  process.exit(1);
}
const r = await invitarDuenio(negocio, { email, nombre: nombre ?? email });
if (!r.ok) {
  console.error(r.error);
  process.exitCode = 1;
} else {
  process.stdout.write(`/admin/contrasena/${r.token}\n`);
}
await desconectar();
await desconectarPlataforma();
