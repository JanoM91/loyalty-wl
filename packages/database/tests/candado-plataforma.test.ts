import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

// Igual que candado.test.ts: nada de este paquete se importa arriba, porque al
// importarse crea la conexión con DATABASE_URL.
const CON_BD = process.env.WL_PRUEBAS_BD === '1';
const USUARIO = 'wl_plataforma_candado';
const CLAVE = 'candado-de-plataforma-largo';

/**
 * El rol del panel de plataforma ve todos los clubes por diseño. Si alguien
 * pusiera su cadena en DATABASE_URL, la aplicación quedaría sin aislamiento:
 * el paquete se niega a operar así.
 */
describe.skipIf(!CON_BD)('candado de arranque con el rol de plataforma', () => {
  const original = process.env.DATABASE_URL;

  afterAll(() => {
    process.env.DATABASE_URL = original;
  });

  it('se niega a consultar si DATABASE_URL es del panel de plataforma', async () => {
    const duenio = new pg.Client({ connectionString: process.env.DIRECT_URL });
    await duenio.connect();
    try {
      await duenio.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${USUARIO}') THEN
            CREATE ROLE ${USUARIO} LOGIN PASSWORD '${CLAVE}' IN ROLE wl_plataforma, wl_app;
          END IF;
        END
        $$`);
    } finally {
      await duenio.end();
    }
    const url = new URL(process.env.DIRECT_URL!);
    url.username = USUARIO;
    url.password = CLAVE;
    process.env.DATABASE_URL = url.toString();

    const db = await import('../src/index');
    await expect(db.comprobarRolDeConexion()).rejects.toBeInstanceOf(db.RolInseguroError);
    await db.desconectar();
  });
});
