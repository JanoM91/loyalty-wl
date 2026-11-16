'use server';

import { cambiarContrasenaPropia } from '@wl/database';

import { exigirSesion, tokenDeEsteNavegador } from '@/lib/admin/sesion';

export interface EstadoCuenta {
  readonly error: string | null;
  readonly aviso: string | null;
}

export async function cambiarMiContrasena(
  _previo: EstadoCuenta,
  form: FormData,
): Promise<EstadoCuenta> {
  const sesion = await exigirSesion();
  const actual = String(form.get('actual') ?? '');
  const nueva = String(form.get('nueva') ?? '');
  const confirmacion = String(form.get('confirmacion') ?? '');

  if (nueva !== confirmacion)
    return { error: 'Las dos contraseñas nuevas no coinciden.', aviso: null };

  const r = await cambiarContrasenaPropia(
    sesion.userId,
    actual,
    nueva,
    await tokenDeEsteNavegador(),
  );
  if (!r.ok) return { error: r.error, aviso: null };

  return {
    error: null,
    aviso:
      r.sesionesCerradas > 0
        ? `Listo. Cerramos ${r.sesionesCerradas === 1 ? 'la sesión abierta' : `${r.sesionesCerradas} sesiones abiertas`} en otros dispositivos; aquí sigues dentro.`
        : 'Listo. La próxima vez entra con la contraseña nueva.',
  };
}
