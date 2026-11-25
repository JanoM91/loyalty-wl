import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';

const CON_BD = process.env.WL_PRUEBAS_BD === '1';
const USUARIO = 'wl_plataforma_prueba';
const CLAVE = 'plataforma-de-prueba-larga';

async function comoDuenio<T extends pg.QueryResultRow>(sql: string): Promise<T[]> {
  const cliente = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await cliente.connect();
  try {
    return (await cliente.query<T>(sql)).rows;
  } finally {
    await cliente.end();
  }
}

/**
 * El panel de plataforma con su propio rol (`wl_plataforma`, migración
 * `rol_plataforma`): hace lo de siempre, pero no puede cambiar la estructura,
 * el aislamiento, los permisos ni las bitácoras. Este archivo corre en su
 * propio proceso y conecta la plataforma con un usuario miembro del rol.
 */
describe.skipIf(!CON_BD)('rol del panel de plataforma', () => {
  let club: db.Negocio | null = null;

  beforeAll(async () => {
    await comoDuenio(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${USUARIO}') THEN
          CREATE ROLE ${USUARIO} LOGIN PASSWORD '${CLAVE}' IN ROLE wl_plataforma;
        END IF;
      END
      $$`);
    const url = new URL(process.env.DIRECT_URL!);
    url.username = USUARIO;
    url.password = CLAVE;
    await db.desconectarPlataforma();
    process.env.DATABASE_URL_PLATAFORMA = url.toString();
  });

  afterAll(async () => {
    if (club) await db.borrarNegocio(club.id).catch(() => undefined);
    await db.desconectarPlataforma();
    await db.desconectar();
    delete process.env.DATABASE_URL_PLATAFORMA;
  });

  it('se conecta con el usuario del rol y hace el trabajo de siempre', async () => {
    const [yo] = await db.clienteDuenio().$queryRaw<
      { yo: string }[]
    >`SELECT current_user::text AS yo`;
    expect(yo?.yo).toBe(USUARIO);

    const previo = await db.negocioPorSlug('prueba-rol-plataforma');
    if (previo) await db.borrarNegocio(previo.id);
    const r = await db.crearNegocio({
      slug: 'prueba-rol-plataforma',
      nombre: 'Rol de plataforma',
      prefijoCodigo: 'RL',
      sucursales: [{ slug: 'centro', nombre: 'Centro', participa: true }],
    });
    if (!r.ok) throw new Error(r.error);
    club = r.negocio;

    // Datos del club con la app (RLS) y una entrada en su bitácora.
    await db.conNegocio(club, async () => {
      await db.prisma.auditLog.create({ data: { action: 'prueba.rol', entityType: 'tenant' } });
    });

    expect((await db.obtenerNegocioEnLista('prueba-rol-plataforma'))?.sucursales).toBe(1);
    expect((await db.usoDeClubes([club.id])).has(club.id)).toBe(true);
    const pago = await db.registrarPagoDeClub(
      club,
      { concepto: 'LITE', periodo: 'MES', centavos: 26_900 },
      'jano@ejemplo.mx',
    );
    expect(pago.ok).toBe(true);
    await db.anotarPlataforma({
      actor: 'jano@ejemplo.mx',
      accion: 'club.prueba_rol',
      club: { id: club.id, slug: club.slug },
    });
    const bitacora = await db.listarBitacoraPlataforma({ clubId: club.id, limite: 5 });
    expect(bitacora.some((b) => b.accion === 'club.prueba_rol')).toBe(true);
    await db.cambiarPlan(club.id, 'PRIVADA');
    expect((await db.negocioPorId(club.id))?.ajustes.plan).toBe('PRIVADA');
    expect(await db.solicitudesPrivadaPendientes([club.id])).toEqual([]);
    await db.correosDelEquipoPlataforma();

    // Borrar el club arrastra sus filas (también la bitácora) aunque el rol
    // no pueda borrar bitácoras: la cascada la hace la base.
    await db.borrarNegocio(club.id);
    club = null;
    expect(await db.negocioPorSlug('prueba-rol-plataforma')).toBeNull();
  });

  it('no puede cambiar la estructura, el aislamiento, los permisos ni las bitácoras', async () => {
    const prohibido = [
      'ALTER TABLE loyalty_card DISABLE ROW LEVEL SECURITY',
      'DROP POLICY loyalty_card_por_negocio ON loyalty_card',
      'DROP TABLE loyalty_card',
      'CREATE TABLE intruso (id int)',
      'TRUNCATE loyalty_card',
      'UPDATE audit_log SET action = action',
      'DELETE FROM platform_audit',
    ];
    for (const sql of prohibido) {
      await expect(db.clienteDuenio().$executeRawUnsafe(sql), sql).rejects.toThrow();
    }
    // Dar permisos sin ser dueño no falla: Postgres avisa y no concede nada.
    await db.clienteDuenio().$executeRawUnsafe('GRANT ALL ON loyalty_card TO PUBLIC');
    const [r] = await comoDuenio<{ puede: boolean }>(
      `SELECT has_table_privilege('wl_app', 'loyalty_card', 'TRUNCATE') AS puede`,
    );
    expect(r?.puede).toBe(false);
  });

  it('cada tabla tiene permisos para el rol y, si tiene RLS, su política', async () => {
    const sinPermiso = await comoDuenio<{ tabla: string }>(`
      SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'
         AND NOT has_table_privilege('wl_plataforma', c.oid, 'SELECT, INSERT')`);
    expect(sinPermiso).toEqual([]);
    const sinPolitica = await comoDuenio<{ tabla: string }>(`
      SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relrowsecurity
         AND NOT EXISTS (
           SELECT 1 FROM pg_policy p
            WHERE p.polrelid = c.oid
              AND (SELECT oid FROM pg_roles WHERE rolname = 'wl_plataforma') = ANY (p.polroles))`);
    expect(sinPolitica).toEqual([]);
  });
});
