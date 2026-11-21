import {
  ETIQUETA_ROL,
  HORAS_ENLACE_INVITACION,
  MINUTOS_ENLACE_RECUPERACION,
  type UserRole,
} from '@wl/database';

import { enviarCorreo, plantillaCorreo, type ResultadoCorreo } from '@/lib/correo';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

/**
 * Correos de las cuentas del panel: invitación y restablecimiento.
 *
 * Solo se arma el mensaje; el envío lo hace `enviarCorreo` (Resend). El enlace
 * lleva un token de un solo uso y lo único que hace es abrir la pantalla para
 * elegir contraseña: no gasta nada hasta que la persona la guarda.
 */

async function pie(club?: string): Promise<string> {
  const nombre = club ?? (await exigirNegocio()).nombre;
  return `${nombre}. Recibes este correo porque tienes una cuenta en el panel de ${nombre}. Si no lo esperabas, ignóralo: sin abrir el enlace no cambia nada.`;
}

export async function urlEnlaceContrasena(token: string): Promise<string> {
  return `${await origenDeLaPeticion()}/admin/contrasena/${token}`;
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

const VIGENCIA_INVITACION =
  HORAS_ENLACE_INVITACION % 24 === 0
    ? `${HORAS_ENLACE_INVITACION / 24} días`
    : `${HORAS_ENLACE_INVITACION} horas`;

/** Enlace que manda administración: primera contraseña o restablecimiento. */
export async function mandarInvitacion(datos: {
  readonly email: string;
  readonly nombre: string;
  readonly rol: UserRole;
  readonly token: string;
  readonly primeraVez: boolean;
  readonly invitadoPor: string;
}): Promise<ResultadoCorreo> {
  const url = await urlEnlaceContrasena(datos.token);
  const { nombre: negocio } = await exigirNegocio();
  const PIE = await pie();
  const entrar = `${await origenDeLaPeticion()}/admin/entrar`;
  const hola = `Hola, ${primerNombre(datos.nombre)}:`;
  const vence = `El enlace vence en ${VIGENCIA_INVITACION} y sirve una sola vez.`;

  if (datos.primeraVez) {
    const intro = `${datos.invitadoPor} te dio acceso al panel de ${negocio} con el rol ${ETIQUETA_ROL[datos.rol]}. Para entrar, elige tu contraseña.`;
    return enviarCorreo({
      para: datos.email,
      asunto: `Tu acceso al panel de ${negocio}`,
      texto: `${hola} ${intro} Ábrelo aquí: ${url} . ${vence} Después entrarás en ${entrar} con este correo.`,
      html: plantillaCorreo(
        'Elige tu contraseña',
        [hola, intro, vence, `Después entrarás en ${entrar} con este correo y esa contraseña.`],
        { texto: 'Elegir mi contraseña', url },
        PIE,
      ),
    });
  }

  const intro = `${datos.invitadoPor} generó un enlace para que elijas una contraseña nueva del panel de ${negocio}. La anterior deja de servir en cuanto guardes la nueva.`;
  return enviarCorreo({
    para: datos.email,
    asunto: `Restablece tu contraseña del panel de ${negocio}`,
    texto: `${hola} ${intro} Ábrelo aquí: ${url} . ${vence}`,
    html: plantillaCorreo(
      'Elige una contraseña nueva',
      [hola, intro, vence],
      { texto: 'Elegir contraseña nueva', url },
      PIE,
    ),
  });
}

/** «Olvidé mi contraseña», pedido por la propia persona. */
export async function mandarRecuperacion(datos: {
  readonly email: string;
  readonly nombre: string;
  readonly token: string;
  /**
   * Club y su dirección completa («https://club-lealtad.com/cafe»), cuando se
   * pide desde el sitio del servicio y no desde la dirección del club.
   */
  readonly club?: { readonly nombre: string; readonly origen: string };
}): Promise<ResultadoCorreo> {
  const url = datos.club
    ? `${datos.club.origen}/admin/contrasena/${datos.token}`
    : await urlEnlaceContrasena(datos.token);
  const negocio = datos.club?.nombre ?? (await exigirNegocio()).nombre;
  const PIE = await pie(datos.club?.nombre);
  const hola = datos.nombre.trim() ? `Hola, ${primerNombre(datos.nombre)}:` : 'Hola:';
  const intro = `Pediste restablecer tu contraseña del panel de ${negocio}. Toca el botón para elegir una nueva.`;
  const vence = `El enlace vence en ${MINUTOS_ENLACE_RECUPERACION} minutos y sirve una sola vez. Si no lo pediste tú, ignora este correo: tu contraseña no cambia.`;
  return enviarCorreo({
    para: datos.email,
    asunto: `Restablece tu contraseña del panel de ${negocio}`,
    texto: `${hola} ${intro} ${url} . ${vence}`,
    html: plantillaCorreo(
      'Restablece tu contraseña',
      [hola, intro, vence],
      { texto: 'Elegir contraseña nueva', url },
      PIE,
    ),
  });
}
