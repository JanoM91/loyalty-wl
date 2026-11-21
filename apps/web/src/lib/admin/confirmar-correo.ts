import { cuentaParaConfirmar } from '@wl/database';

import { firmarEnlace, leerEnlace } from '@/lib/enlaces-firmados';

/**
 * Enlace para confirmar el correo de una cuenta del panel. Va firmado con el
 * correo: si la cuenta cambia de correo, el enlace anterior deja de servir.
 */
export function urlConfirmacionCorreo(
  origenClub: string,
  negocioId: string,
  userId: string,
  email: string,
): string | null {
  const token = firmarEnlace('correo', negocioId, userId, email.toLowerCase());
  return token ? `${origenClub}/admin/confirmar/${token}` : null;
}

/** La cuenta del enlace si la firma es buena (dentro del negocio en curso). */
export async function cuentaDelEnlace(
  negocioId: string,
  token: string,
): Promise<{ userId: string; email: string; nombre: string; confirmado: boolean } | null> {
  let cuenta: Awaited<ReturnType<typeof cuentaParaConfirmar>> = null;
  const userId = await leerEnlace('correo', negocioId, token, async (id) => {
    cuenta = await cuentaParaConfirmar(id);
    return cuenta ? cuenta.email.toLowerCase() : null;
  });
  if (!userId || !cuenta) return null;
  const c = cuenta as { email: string; nombre: string; confirmado: boolean };
  return { userId, ...c };
}
