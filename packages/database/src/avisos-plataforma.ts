import { prisma } from './index';
import { clienteDuenio } from './plataforma';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Avisos de Exkalibur a los dueños, mandados a mano desde el panel de
 * plataforma. Aquí viven los destinatarios y el historial; el correo se arma
 * y se envía en la aplicación.
 */

export interface DuenioDeClub {
  readonly negocioId: string;
  readonly email: string;
  readonly nombre: string;
}

/** Dueños activos de varios clubes, en una sola consulta. */
export async function dueniosDeClubes(
  negocioIds: readonly string[],
): Promise<readonly DuenioDeClub[]> {
  if (negocioIds.length === 0) return [];
  const filas = await clienteDuenio().userAccount.findMany({
    where: { tenantId: { in: [...negocioIds] }, role: 'DUENO', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, email: true, name: true },
  });
  return filas
    .filter((f) => f.email.includes('@'))
    .map((f) => ({ negocioId: f.tenantId, email: f.email, nombre: f.name.trim() }));
}

export interface AvisoPlataforma {
  readonly id: string;
  readonly asunto: string;
  readonly mensaje: string;
  /** A quién se mandó, en palabras. */
  readonly audiencia: string;
  readonly clubes: number;
  readonly enviados: number;
  readonly fallidos: number;
  readonly enviadoPor: string;
  readonly creado: Date;
}

/** Anota un aviso ya enviado. */
export async function registrarAvisoPlataforma(
  d: Omit<AvisoPlataforma, 'id' | 'creado'>,
): Promise<void> {
  await clienteDuenio().platformNotice.create({
    data: {
      subject: d.asunto.slice(0, 160),
      body: d.mensaje,
      audience: d.audiencia.slice(0, 160),
      clubs: d.clubes,
      sent: d.enviados,
      failed: d.fallidos,
      sentBy: d.enviadoPor.slice(0, 160),
    },
  });
}

/** Los últimos avisos, del más reciente al más antiguo. */
export async function listarAvisosPlataforma(limite = 30): Promise<AvisoPlataforma[]> {
  const filas = await clienteDuenio().platformNotice.findMany({
    orderBy: { createdAt: 'desc' },
    take: limite,
  });
  return filas.map((f) => ({
    id: f.id,
    asunto: f.subject,
    mensaje: f.body,
    audiencia: f.audience,
    clubes: f.clubs,
    enviados: f.sent,
    fallidos: f.failed,
    enviadoPor: f.sentBy,
    creado: f.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Programados, destinatarios, plantillas y buzón del dueño
// ---------------------------------------------------------------------------

export type EstadoAvisoPlataforma = 'PROGRAMADO' | 'ENVIANDO' | 'ENVIADO' | 'CANCELADO';

export interface AvisoCompleto extends AvisoPlataforma {
  readonly estado: EstadoAvisoPlataforma;
  readonly valorAudiencia: string | null;
  readonly programadoPara: Date | null;
  readonly enviadoEl: Date | null;
}

type FilaAviso = Awaited<
  ReturnType<ReturnType<typeof clienteDuenio>['platformNotice']['findFirstOrThrow']>
>;

function aAvisoCompleto(f: FilaAviso): AvisoCompleto {
  return {
    id: f.id,
    asunto: f.subject,
    mensaje: f.body,
    audiencia: f.audience,
    clubes: f.clubs,
    enviados: f.sent,
    fallidos: f.failed,
    enviadoPor: f.sentBy,
    creado: f.createdAt,
    estado: f.status as EstadoAvisoPlataforma,
    valorAudiencia: f.audienceValue,
    programadoPara: f.scheduledAt,
    enviadoEl: f.sentAt,
  };
}

/** Avisos (enviados, programados y cancelados), lo más reciente primero. */
export async function listarAvisosCompletos(limite = 30): Promise<AvisoCompleto[]> {
  const filas = await clienteDuenio().platformNotice.findMany({
    orderBy: { createdAt: 'desc' },
    take: limite,
  });
  return filas.map(aAvisoCompleto);
}

export async function leerAvisoPlataforma(id: string): Promise<AvisoCompleto | null> {
  if (!UUID.test(id)) return null;
  const f = await clienteDuenio().platformNotice.findUnique({ where: { id } });
  return f ? aAvisoCompleto(f) : null;
}

/**
 * Crea un aviso. Con `programadoPara` queda PROGRAMADO y lo manda la tarea
 * cada 15 minutos; sin él queda ENVIANDO y quien llama lo despacha ya.
 */
export async function crearAvisoPlataforma(d: {
  readonly asunto: string;
  readonly mensaje: string;
  readonly audiencia: string;
  readonly valorAudiencia: string;
  readonly enviadoPor: string;
  readonly programadoPara?: Date | null;
}): Promise<string> {
  const fila = await clienteDuenio().platformNotice.create({
    data: {
      subject: d.asunto.slice(0, 160),
      body: d.mensaje,
      audience: d.audiencia.slice(0, 160),
      audienceValue: d.valorAudiencia.slice(0, 100),
      status: d.programadoPara ? 'PROGRAMADO' : 'ENVIANDO',
      scheduledAt: d.programadoPara ?? null,
      sentBy: d.enviadoPor.slice(0, 160),
    },
    select: { id: true },
  });
  return fila.id;
}

/**
 * Toma los avisos programados que ya tocan y los pasa a ENVIANDO en una sola
 * sentencia: si dos tareas corren a la vez, cada aviso lo toma solo una.
 */
export async function tomarAvisosQueTocan(ahora: Date = new Date()): Promise<string[]> {
  const filas = await clienteDuenio().$queryRaw<{ id: string }[]>`
    UPDATE platform_notice SET status = 'ENVIANDO'
    WHERE status = 'PROGRAMADO' AND scheduled_at <= ${ahora}
    RETURNING id`;
  return filas.map((f) => f.id);
}

/** Cancela un aviso que todavía no sale. */
export async function cancelarAvisoProgramado(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const r = await clienteDuenio().platformNotice.updateMany({
    where: { id, status: 'PROGRAMADO' },
    data: { status: 'CANCELADO' },
  });
  return r.count === 1;
}

export interface DestinatarioNuevo {
  readonly negocioId: string;
  readonly club: string;
  readonly email: string;
  readonly nombre: string;
  /** Id de Resend; null si el correo no salió. */
  readonly resendId: string | null;
}

/**
 * Cierra un aviso despachado: anota a quién le salió, deja una copia en el
 * buzón de cada club y lo marca ENVIADO con sus cuentas.
 */
export async function cerrarAvisoPlataforma(
  id: string,
  d: {
    readonly audiencia: string;
    readonly destinatarios: readonly DestinatarioNuevo[];
    /** Clubes a cuyo buzón llega, aunque su correo no haya salido. */
    readonly clubes: readonly string[];
  },
): Promise<{ enviados: number; fallidos: number }> {
  const bd = clienteDuenio();
  const aviso = await bd.platformNotice.findUniqueOrThrow({
    where: { id },
    select: { subject: true, body: true },
  });
  if (d.destinatarios.length > 0) {
    await bd.platformNoticeRecipient.createMany({
      data: d.destinatarios.map((x) => ({
        noticeId: id,
        tenantId: x.negocioId,
        tenantName: x.club.slice(0, 160),
        email: x.email.slice(0, 255),
        ownerName: x.nombre.slice(0, 160),
        resendId: x.resendId,
        status: x.resendId ? 'ENVIADO' : 'FALLIDO',
      })),
    });
  }
  if (d.clubes.length > 0) {
    // El rol dueño escribe en el buzón de cada club (tabla con RLS) con su tenant_id.
    await bd.clubNotice.createMany({
      data: d.clubes.map((tenantId) => ({
        tenantId,
        noticeId: id,
        subject: aviso.subject,
        body: aviso.body,
      })),
      skipDuplicates: true,
    });
  }
  const enviados = d.destinatarios.filter((x) => x.resendId).length;
  const fallidos = d.destinatarios.length - enviados;
  await bd.platformNotice.update({
    where: { id },
    data: {
      status: 'ENVIADO',
      sentAt: new Date(),
      audience: d.audiencia.slice(0, 160),
      clubs: d.clubes.length,
      sent: enviados,
      failed: fallidos,
    },
  });
  return { enviados, fallidos };
}

export interface DestinatarioDeAviso {
  readonly id: string;
  readonly clubId: string | null;
  readonly club: string;
  readonly email: string;
  readonly nombre: string;
  readonly estado: string;
  readonly resendId: string | null;
  readonly actualizado: Date;
}

export async function destinatariosDeAviso(id: string): Promise<DestinatarioDeAviso[]> {
  if (!UUID.test(id)) return [];
  const filas = await clienteDuenio().platformNoticeRecipient.findMany({
    where: { noticeId: id },
    orderBy: [{ tenantName: 'asc' }, { email: 'asc' }],
  });
  return filas.map((f) => ({
    id: f.id,
    clubId: f.tenantId,
    club: f.tenantName,
    email: f.email,
    nombre: f.ownerName,
    estado: f.status,
    resendId: f.resendId,
    actualizado: f.updatedAt,
  }));
}

/** Eventos de Resend que se guardan, ya en español. */
export const ESTADO_DE_EVENTO: Readonly<Record<string, string>> = {
  sent: 'ENVIADO',
  delivered: 'ENTREGADO',
  delivery_delayed: 'RETRASADO',
  bounced: 'REBOTADO',
  complained: 'QUEJA',
  opened: 'ABIERTO',
  clicked: 'CLIC',
  failed: 'FALLIDO',
  suppressed: 'SUPRIMIDO',
};

/** Guarda el último evento de Resend de cada correo. Devuelve cuántos cambiaron. */
export async function actualizarEntregas(eventos: ReadonlyMap<string, string>): Promise<number> {
  let cambiados = 0;
  for (const [resendId, evento] of eventos) {
    const estado = ESTADO_DE_EVENTO[evento];
    if (!estado) continue;
    const r = await clienteDuenio().platformNoticeRecipient.updateMany({
      where: { resendId, status: { not: estado } },
      data: { status: estado },
    });
    cambiados += r.count;
  }
  return cambiados;
}

export interface PlantillaAviso {
  readonly id: string;
  readonly nombre: string;
  readonly asunto: string;
  readonly mensaje: string;
}

export async function listarPlantillasAviso(): Promise<PlantillaAviso[]> {
  const filas = await clienteDuenio().platformNoticeTemplate.findMany({ orderBy: { name: 'asc' } });
  return filas.map((f) => ({ id: f.id, nombre: f.name, asunto: f.subject, mensaje: f.body }));
}

/** Guarda (o reemplaza, si ya existe con ese nombre) una plantilla. */
export async function guardarPlantillaAviso(
  p: { readonly nombre: string; readonly asunto: string; readonly mensaje: string },
  quien: string,
): Promise<void> {
  const name = p.nombre.trim().slice(0, 80);
  const datos = {
    subject: p.asunto.slice(0, 160),
    body: p.mensaje,
    updatedBy: quien.slice(0, 160),
  };
  await clienteDuenio().platformNoticeTemplate.upsert({
    where: { name },
    create: { name, ...datos },
    update: datos,
  });
}

export async function borrarPlantillaAviso(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  await clienteDuenio().platformNoticeTemplate.deleteMany({ where: { id } });
}

// ---------------------------------------------------------------------------
// Buzón del dueño (dentro del negocio, con RLS)
// ---------------------------------------------------------------------------

export interface AvisoDelClub {
  readonly id: string;
  readonly asunto: string;
  readonly mensaje: string;
  readonly fecha: Date;
  readonly leido: Date | null;
}

/** Avisos de club-lealtad que recibió el club en curso, el más reciente primero. */
export async function avisosDelClub(limite = 50): Promise<AvisoDelClub[]> {
  const filas = await prisma.clubNotice.findMany({
    orderBy: { createdAt: 'desc' },
    take: limite,
    select: { id: true, subject: true, body: true, createdAt: true, readAt: true },
  });
  return filas.map((f) => ({
    id: f.id,
    asunto: f.subject,
    mensaje: f.body,
    fecha: f.createdAt,
    leido: f.readAt,
  }));
}

export function avisosSinLeer(): Promise<number> {
  return prisma.clubNotice.count({ where: { readAt: null } });
}

/** Marca como leídos todos los avisos del club en curso. */
export async function marcarAvisosLeidos(): Promise<void> {
  await prisma.clubNotice.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
}
