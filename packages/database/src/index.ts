import { AsyncLocalStorage } from 'node:async_hooks';

import type { Prisma } from '@prisma/client';

import { base } from './cliente';
import { negocioActual } from './negocio';

/**
 * Acceso a datos por negocio.
 *
 * `prisma` se usa igual que un cliente de Prisma, pero cada operación:
 *
 * 1. exige un negocio en contexto (ver negocio.ts); sin él, lanza;
 * 2. corre en una transacción que fija `app.tenant_id`, que es lo que RLS usa
 *    para dejar ver y escribir solo las filas de ese negocio;
 * 3. además lleva `tenantId` en el `where` (segunda red, por si la conexión
 *    estuviera mal configurada).
 *
 * `transaccion(fn)` abre una transacción interactiva con el negocio ya fijado.
 * Dentro, el aislamiento lo da RLS (también para `$queryRaw`).
 *
 * Al crear filas no hay que escribir `tenantId`: la base lo pone a partir de
 * `app.tenant_id` y RLS rechaza cualquier otro valor.
 */

export type Tx = Prisma.TransactionClient;

/** Marca que el código ya corre dentro de `transaccion`. */
const enTransaccion = new AsyncLocalStorage<true>();

// ---------------------------------------------------------------------------
// Candado de arranque: la conexión no debe poder saltarse RLS
// ---------------------------------------------------------------------------

let candado: Promise<void> | null = null;

export class RolInseguroError extends Error {
  constructor(detalle: string) {
    super(
      `La aplicación está conectada a la base con un rol que se salta el aislamiento entre negocios (${detalle}). ` +
        'DATABASE_URL debe usar un rol miembro de wl_app que no sea dueño de las tablas ni tenga BYPASSRLS. ' +
        'El rol dueño va solo en DIRECT_URL, para las migraciones.',
    );
    this.name = 'RolInseguroError';
  }
}

/**
 * Comprueba, una vez por proceso, que el rol de la conexión no es superusuario,
 * no tiene BYPASSRLS y no es dueño de las tablas. Si lo fuera, RLS no aplicaría
 * y un error de programación podría mezclar negocios: se prefiere no arrancar.
 */
export function comprobarRolDeConexion(): Promise<void> {
  candado ??= (async () => {
    const filas = await base.$queryRaw<{ salta: boolean; duenio: boolean; usuario: string }[]>`
      SELECT
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS salta,
        EXISTS (
          SELECT 1 FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'loyalty_card' AND tableowner = current_user
        ) AS duenio,
        current_user::text AS usuario`;
    const f = filas[0];
    if (!f) throw new RolInseguroError('no se pudo leer el rol');
    if (f.salta) throw new RolInseguroError(`«${f.usuario}» es superusuario o tiene BYPASSRLS`);
    if (f.duenio) throw new RolInseguroError(`«${f.usuario}» es dueño de las tablas`);
  })().catch((e) => {
    candado = null;
    throw e;
  });
  return candado;
}

// ---------------------------------------------------------------------------
// Cliente por negocio
// ---------------------------------------------------------------------------

/** Operaciones cuyo `where` se acota al negocio. */
const CON_WHERE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

export const prisma = base.$extends({
  name: 'por-negocio',
  query: {
    async $allOperations({ model, operation, args, query }) {
      // La tabla de negocios es de plataforma: no lleva filtro.
      if (model === 'Tenant') return query(args);

      const negocio = await negocioActual();
      await comprobarRolDeConexion();

      let argumentos = args;
      if (model && CON_WHERE.has(operation)) {
        const a = (args ?? {}) as { where?: Record<string, unknown> };
        argumentos = { ...a, where: { ...(a.where ?? {}), tenantId: negocio.id } } as typeof args;
      }

      const [, resultado] = await base.$transaction([
        base.$executeRaw`SELECT set_config('app.tenant_id', ${negocio.id}, true)`,
        query(argumentos),
      ]);
      return resultado;
    },
  },
});

/**
 * Transacción interactiva dentro del negocio en contexto.
 *
 * Sustituye a `prisma.$transaction(async (tx) => …)`. No se anida: si ya hay
 * una abierta, lanza (una transacción dentro de otra correría en otra
 * conexión y no vería lo que la primera lleva escrito).
 */
export async function transaccion<T>(
  fn: (tx: Tx) => Promise<T>,
  opciones?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  if (enTransaccion.getStore()) {
    throw new Error('transaccion() no se puede anidar: pasa el `tx` a la función que lo necesita.');
  }
  const negocio = await negocioActual();
  await comprobarRolDeConexion();
  return base.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${negocio.id}, true)`;
    return enTransaccion.run(true, () => fn(tx));
  }, opciones);
}

/**
 * Varias escrituras que deben entrar todas o ninguna, sin lógica entre ellas.
 * Sustituye a `prisma.$transaction([a, b])`: las operaciones se arman con el
 * `tx` que recibe la función.
 */
export function lote(armar: (tx: Tx) => Prisma.PrismaPromise<unknown>[]): Promise<void> {
  return transaccion(async (tx) => {
    for (const operacion of armar(tx)) await operacion;
  });
}

/**
 * ¿Es el error de «restricción única» de Prisma (P2002)?
 *
 * Se mira el código y no la clase: el error puede venir de otra copia del
 * runtime de Prisma (motor nativo o WASM) y `instanceof` daría falso.
 */
export function esErrorUnico(e: unknown): e is { code: 'P2002'; meta?: { target?: unknown } } {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: unknown }).code === 'P2002' &&
    (e as { name?: unknown }).name === 'PrismaClientKnownRequestError'
  );
}

/** Columnas (o nombre del índice) que chocaron en un error de restricción única. */
export function camposDelError(e: { meta?: { target?: unknown } }): string {
  return String(e.meta?.target ?? '');
}

/** Cierra las conexiones. Para scripts y pruebas. */
export function desconectar(): Promise<void> {
  return base.$disconnect();
}

export * from '@prisma/client';
export * from './negocio';
export * from './plataforma';
export * from './marca';
export * from './plataforma-acceso';
export * from './plataforma-equipo';
export * from './plataforma-ingresos';
export * from './plataforma-actividad';
export * from './plan-privada';
export * from './arcade';
export * from './mensajes';
export * from './avisos';
export * from './avisos-plataforma';
export * from './regalos';

/** Acceso al panel del negocio: contraseñas, sesiones, roles y usuarios. */
export * from './auth/password';
export * from './auth/sesion';
export * from './auth/roles';
export * from './auth/usuarios';

/** Programa de lealtad. Las reglas viven en @wl/domain; aquí se guarda y se consulta. */
export * from './lealtad/programa';
export * from './lealtad/tarjetas';
export * from './lealtad/verificacion';
export * from './lealtad/acceso';
export * from './lealtad/caja';
export * from './lealtad/alta-caja';
export * from './lealtad/reenvio';
export * from './lealtad/enlace-personal';
export * from './lealtad/reportes';
export * from './lealtad/analitica';
export * from './lealtad/mantenimiento';
export * from './lealtad/exportar';
export * from './lealtad/reportes-periodo';
export * from './lealtad/wallet';
