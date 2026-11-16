import { afterAll, describe, expect, it } from 'vitest';

// No se importa nada de este paquete aquí arriba: al importarse crea la
// conexión, y esta prueba necesita cambiar antes con qué rol se conecta.
const CON_BD = process.env.WL_PRUEBAS_BD === '1';

/**
 * Si la aplicación se conectara con el rol dueño, RLS no aplicaría y el
 * aislamiento dependería solo del código. El paquete se niega a operar así.
 */
describe.skipIf(!CON_BD)('candado de arranque', () => {
  const original = process.env.DATABASE_URL;

  afterAll(() => {
    process.env.DATABASE_URL = original;
  });

  it('se niega a consultar con un rol que se salta RLS', async () => {
    // Este archivo corre en su propio proceso: aquí la «aplicación» se conecta
    // con el rol dueño, que es justo el error de configuración a detectar.
    process.env.DATABASE_URL = process.env.DIRECT_URL;
    const db = await import('../src/index');
    const negocio = (await db.negociosActivos())[0] ?? {
      id: '00000000-0000-4000-8000-000000000000',
      slug: 'x',
      nombre: 'x',
      activo: true,
      zonaHoraria: 'America/Mexico_City',
      prefijoCodigo: 'WL',
      marca: db.MARCA_POR_OMISION,
      ajustes: db.AJUSTES_POR_OMISION,
    };
    await expect(
      db.conNegocio(negocio, () => db.prisma.loyaltyCard.count()),
    ).rejects.toBeInstanceOf(db.RolInseguroError);
    await expect(
      db.conNegocio(negocio, () => db.transaccion((tx) => tx.loyaltyCard.count())),
    ).rejects.toBeInstanceOf(db.RolInseguroError);
    await db.desconectar();
  });
});
