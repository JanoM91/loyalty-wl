/**
 * Apoyo de las pruebas E2E. Borra un negocio de prueba y, si se indica, una
 * cuenta de plataforma de prueba. Solo acepta slugs que empiecen por «e2e-».
 *
 *     tsx scripts/e2e-borrar.ts <slug> [correo de plataforma]
 */
import { borrarNegocio, clienteDuenio, desconectarPlataforma, negocioPorSlug } from '../src/index';

const [slug, email] = process.argv.slice(2);
if (!slug?.startsWith('e2e-')) {
  console.error('Solo borra negocios de prueba (slug «e2e-…»).');
  process.exit(1);
}
const negocio = await negocioPorSlug(slug);
if (negocio) await borrarNegocio(negocio.id);
if (email?.startsWith('e2e-')) await clienteDuenio().platformUser.deleteMany({ where: { email } });
await desconectarPlataforma();
