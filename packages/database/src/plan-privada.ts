import { negocioActual, prisma } from './index';
import { clienteDuenio } from './plataforma';

/**
 * Solicitud del dueño para pasar su club de Lite a Privada.
 *
 * El dueño no puede cambiarse el plan (eso lo hace la plataforma): solo deja
 * la solicitud. Queda en la bitácora del club (`audit_log`) y la plataforma
 * la ve en la ficha del club y en su inicio hasta que el club pase a Privada.
 * La migración de datos a una instalación propia se planea con el cliente.
 */

export const ACCION_SOLICITA_PRIVADA = 'plan.solicita_privada';

/** Una solicitud por día: un segundo toque no repite el aviso. */
const HORAS_ENTRE_SOLICITUDES = 24;

export interface SolicitudPrivada {
  readonly fecha: Date;
  readonly quien: string | null;
  readonly nota: string | null;
}

function notaDe(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const nota = (metadata as { nota?: unknown }).nota;
  return typeof nota === 'string' && nota.trim() ? nota.trim() : null;
}

/** La solicitud más reciente del club en contexto, si la hay. */
export async function solicitudPrivada(): Promise<SolicitudPrivada | null> {
  const fila = await prisma.auditLog.findFirst({
    where: { action: ACCION_SOLICITA_PRIVADA },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, metadata: true, user: { select: { name: true } } },
  });
  return fila
    ? { fecha: fila.createdAt, quien: fila.user?.name ?? null, nota: notaDe(fila.metadata) }
    : null;
}

/**
 * Deja la solicitud del club en contexto. Devuelve `nueva: false` si ya había
 * una en las últimas 24 horas (no se duplica ni se vuelve a avisar).
 */
export async function solicitarPrivada(
  userId: string,
  nota: string | null,
  ip: string | null,
): Promise<{ readonly nueva: boolean; readonly fecha: Date }> {
  const negocio = await negocioActual();
  if (negocio.ajustes.plan === 'PRIVADA') return { nueva: false, fecha: new Date() };
  const previa = await solicitudPrivada();
  if (previa && Date.now() - previa.fecha.getTime() < HORAS_ENTRE_SOLICITUDES * 3600_000) {
    return { nueva: false, fecha: previa.fecha };
  }
  const limpia = nota?.trim().slice(0, 500) || null;
  const fila = await prisma.auditLog.create({
    data: {
      userId,
      action: ACCION_SOLICITA_PRIVADA,
      entityType: 'tenant',
      entityId: negocio.id,
      metadata: limpia ? { nota: limpia } : {},
      ipAddress: ip,
    },
    select: { createdAt: true },
  });
  return { nueva: true, fecha: fila.createdAt };
}

/** Correos del equipo de plataforma con la cuenta activa, para avisarles. */
export async function correosDelEquipoPlataforma(): Promise<string[]> {
  const filas = await clienteDuenio().platformUser.findMany({
    where: { isActive: true, passwordHash: { not: null } },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });
  return filas.map((f) => f.email);
}

export interface SolicitudPrivadaPendiente extends SolicitudPrivada {
  readonly clubId: string;
  readonly slug: string;
  readonly nombre: string;
}

/**
 * Para la plataforma: la última solicitud de cada club que sigue en Lite (o
 * de los clubes de `ids`), de la más reciente a la más vieja.
 */
export async function solicitudesPrivadaPendientes(
  ids?: readonly string[],
): Promise<SolicitudPrivadaPendiente[]> {
  if (ids && ids.length === 0) return [];
  const filtro = ids ? [...ids] : null;
  const filas = await clienteDuenio().$queryRaw<
    {
      id: string;
      slug: string;
      nombre: string;
      fecha: Date;
      quien: string | null;
      metadata: unknown;
    }[]
  >`
    SELECT DISTINCT ON (t.id) t.id, t.slug, t.name AS nombre, a.created_at AS fecha,
           u.name AS quien, a.metadata
      FROM audit_log a
      JOIN tenant t ON t.id = a.tenant_id
      LEFT JOIN user_account u ON u.id = a.user_id
     WHERE a.action = ${ACCION_SOLICITA_PRIVADA}
       AND coalesce(t.settings->>'plan', 'LITE') <> 'PRIVADA'
       AND (${filtro}::uuid[] IS NULL OR t.id = ANY(${filtro}::uuid[]))
     ORDER BY t.id, a.created_at DESC`;
  return filas
    .map((f) => ({
      clubId: f.id,
      slug: f.slug,
      nombre: f.nombre,
      fecha: f.fecha,
      quien: f.quien,
      nota: notaDe(f.metadata),
    }))
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}
