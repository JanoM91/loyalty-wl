'use server';

import { correosDelEquipoPlataforma, solicitarPrivada } from '@wl/database';

import { enviarCorreo } from '@/lib/correo';
import { contextoPeticion, exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio } from '@/lib/negocio';
import { correoSolicitudPrivada } from '@/lib/plataforma/correos';

export interface EstadoPrivada {
  readonly ok: boolean;
  readonly error?: string;
  /** Cuándo quedó la solicitud (ISO). */
  readonly fecha?: string;
}

/**
 * «Quiero pasar a Privada»: deja la solicitud en la bitácora del club y avisa
 * por correo al equipo de plataforma. El plan no cambia: eso lo hace la
 * plataforma después de la demo.
 */
export async function pedirPrivada(
  _previo: EstadoPrivada | null,
  form: FormData,
): Promise<EstadoPrivada> {
  const sesion = await exigirRol(['ADMIN', 'DUENO']);
  const negocio = await exigirNegocio();
  if (negocio.ajustes.plan === 'PRIVADA') {
    return { ok: false, error: 'Tu club ya está en Privada.' };
  }
  const nota =
    String(form.get('nota') ?? '')
      .trim()
      .slice(0, 500) || null;
  const { ip } = await contextoPeticion();
  const r = await solicitarPrivada(sesion.userId, nota, ip);

  if (r.nueva) {
    // Si el correo falla, la solicitud igual queda a la vista en la plataforma.
    try {
      const equipo = await correosDelEquipoPlataforma();
      await Promise.all(
        equipo.map((para) =>
          enviarCorreo(
            correoSolicitudPrivada({
              para,
              club: negocio.nombre,
              slug: negocio.slug,
              quien: sesion.nombre,
              correo: sesion.email,
              whatsapp: negocio.ajustes.alta?.whatsapp ?? null,
              nota,
            }),
          ),
        ),
      );
    } catch (e) {
      console.error('[plan] No salió el aviso de la solicitud de Privada', e);
    }
  }
  return { ok: true, fecha: r.fecha.toISOString() };
}
