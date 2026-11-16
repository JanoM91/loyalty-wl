/**
 * Apoyo del recorrido E2E (tests/e2e/recorrido.mjs). NO es para producción.
 *
 * Una tarjeta gana una estampa por sucursal y día, así que un recorrido que
 * llegue al premio en minutos necesita un atajo: aquí se suman, directo en la
 * base, las estampas que faltan para el primer premio y se marca el contacto
 * como verificado (en la vida real lo verifica el cliente con su código).
 *
 *     tsx scripts/e2e-completar.ts <slug> <código de tarjeta>
 */
import * as db from '../src/index';

const [slug, codigo] = process.argv.slice(2);
const negocio = slug ? await db.negocioPorSlug(slug) : null;
if (!negocio || !codigo) {
  console.error('Uso: e2e-completar <slug> <código>');
  process.exit(1);
}
await db.conNegocio(negocio, async () => {
  const programa = await db.programaVigente();
  const primero = Math.min(...programa.hitos.map((h) => h.posicion));
  const tarjeta = await db.prisma.loyaltyCard.findFirstOrThrow({ where: { publicCode: codigo } });
  await db.transaccion(async (tx) => {
    const fila = await db.bloquearTarjeta(tx, codigo);
    const faltan = primero - fila!.stamps;
    if (faltan > 0) await db.sumarEstampas(tx, fila!, null, faltan, programa);
  });
  await db.prisma.loyaltyCard.update({
    where: { id: tarjeta.id },
    data: { phoneVerifiedAt: new Date() },
  });
  process.stdout.write(`primer premio a las ${primero} estampas\n`);
});
await db.desconectar();
await db.desconectarPlataforma();
