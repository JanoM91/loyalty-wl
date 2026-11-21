import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Enlaces que no se guardan en la base: llevan un id y una firma del
 * servidor. Sirven para acciones que solo prueban que el enlace llegó a quien
 * lo abre (confirmar un correo, darse de baja), no para entrar a una cuenta.
 *
 * La firma incluye el propósito y el negocio: un enlace de baja de un club no
 * sirve en otro ni como confirmación de correo.
 */

function secreto(): string | null {
  const s = process.env.WL_SECRETO_ENLACES ?? process.env.CRON_SECRET ?? '';
  return s.length >= 16 ? s : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firma(proposito: string, partes: readonly string[]): string | null {
  const s = secreto();
  if (!s) return null;
  return createHmac('sha256', s)
    .update([proposito, ...partes].join(':'))
    .digest('base64url')
    .slice(0, 32);
}

/** `<id>.<firma>`, o null si el servidor no tiene secreto configurado. */
export function firmarEnlace(
  proposito: 'correo' | 'baja',
  negocioId: string,
  id: string,
  extra = '',
): string | null {
  const f = firma(proposito, [negocioId, id, extra]);
  return f ? `${id}.${f}` : null;
}

/** El id del enlace si la firma es buena; null si no. */
export function leerEnlace(
  proposito: 'correo' | 'baja',
  negocioId: string,
  token: string,
  extra: (id: string) => Promise<string | null> | string | null = () => '',
): Promise<string | null> {
  return (async () => {
    const [id = '', recibida = ''] = token.split('.');
    if (!UUID.test(id) || !/^[A-Za-z0-9_-]{32}$/.test(recibida)) return null;
    const dato = await extra(id);
    if (dato === null) return null;
    const esperada = firma(proposito, [negocioId, id, dato]);
    if (!esperada) return null;
    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    return a.length === b.length && timingSafeEqual(a, b) ? id : null;
  })();
}
