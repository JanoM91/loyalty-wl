import { clienteDuenio } from './plataforma';

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
