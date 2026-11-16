'use server';

import { emitirEnlaceAccesoDesdePanel } from '@wl/database';

import { ROLES_CAJA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaLarga, hora } from '@/lib/lealtad/formato';
import { qrSvg } from '@/lib/lealtad/qr';
import { origenDeLaPeticion } from '@/lib/negocio';

export interface EstadoAcceso {
  readonly error: string | null;
  readonly enlace?: {
    readonly url: string;
    readonly svg: string;
    readonly vence: string;
    readonly codigo: string;
    readonly nombre: string | null;
    readonly contacto: string;
  };
}

/**
 * Genera un enlace de acceso de un solo uso para una tarjeta.
 *
 * Lo usa el personal con la persona enfrente: ella escanea el QR (o abre el
 * enlace) desde su celular y la tarjeta queda abierta ahí. Es la salida para
 * quien se dio de alta solo con celular o ya no entra a su correo.
 */
export async function generarEnlaceAcceso(
  _previo: EstadoAcceso,
  form: FormData,
): Promise<EstadoAcceso> {
  const sesion = await exigirRol(ROLES_CAJA);
  const r = await emitirEnlaceAccesoDesdePanel(String(form.get('busqueda') ?? ''), sesion.userId);
  if (!r.ok) return { error: r.error };

  const url = `${await origenDeLaPeticion()}/lealtad/acceso/${r.token}`;
  return {
    error: null,
    enlace: {
      url,
      svg: await qrSvg(url),
      vence: `${fechaLarga(r.expira)} a las ${hora(r.expira)}`,
      codigo: r.codigo,
      nombre: r.nombre,
      contacto: r.contacto,
    },
  };
}
