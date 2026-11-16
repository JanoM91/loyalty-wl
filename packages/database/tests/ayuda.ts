import pg from 'pg';

import {
  borrarNegocio,
  conNegocio,
  crearNegocio,
  negocioPorSlug,
  type Negocio,
  type NegocioNuevo,
} from '../src/index';

/**
 * Las pruebas de integración escriben en la base. Solo corren con
 * `WL_PRUEBAS_BD=1`, que se pone en CI y en una base local de pruebas; en una
 * computadora de desarrollo `DATABASE_URL` podría apuntar a datos reales.
 */
export const CON_BD = process.env.WL_PRUEBAS_BD === '1';

/** Consulta con el rol dueño, saltándose RLS: para comprobar desde fuera qué quedó guardado. */
export async function comoDuenio<T extends pg.QueryResultRow>(
  sql: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const cliente = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await cliente.connect();
  try {
    return (await cliente.query<T>(sql, valores)).rows;
  } finally {
    await cliente.end();
  }
}

/** Crea (o recrea) un negocio de prueba, vacío salvo su programa y sus sucursales. */
export async function negocioDePrueba(d: NegocioNuevo): Promise<Negocio> {
  const previo = await negocioPorSlug(d.slug);
  if (previo) await borrarNegocio(previo.id);
  const r = await crearNegocio(d);
  if (!r.ok) throw new Error(r.error);
  return r.negocio;
}

export const en = conNegocio;
