import { origenDelServicio } from '@/lib/avisos-dueno';
import type { Correo } from '@/lib/correo';
import { plantillaCorreo } from '@/lib/correo-plantilla';

/**
 * Correos del equipo de plataforma: invitación y recuperación de contraseña.
 * Salen como club-lealtad. El enlace usa siempre la dirección configurada del
 * servicio (no la de la petición), para que nadie pueda colar otro dominio en
 * un correo de recuperación.
 */

export function enlaceDeContrasena(token: string, origen = origenDelServicio()): string {
  return `${origen}/plataforma/contrasena/${encodeURIComponent(token)}`;
}

export function correoDeInvitacion(d: {
  readonly para: string;
  readonly nombre: string;
  readonly quien: string;
  readonly token: string;
}): Correo {
  const url = enlaceDeContrasena(d.token);
  const asunto = 'Tu cuenta en la plataforma de club-lealtad';
  const parrafos = [
    `Hola, ${d.nombre.split(' ')[0]}:`,
    `${d.quien} te dio acceso al panel de plataforma de club-lealtad, desde donde se administran los clubes.`,
    'Con el botón eliges tu contraseña. El enlace sirve una sola vez y vence en 72 horas.',
  ];
  return {
    para: d.para,
    asunto,
    texto: [...parrafos, `Elegir mi contraseña: ${url}`].join('\n\n'),
    html: plantillaCorreo(
      asunto,
      parrafos,
      { texto: 'Elegir mi contraseña', url },
      'club-lealtad. Recibes este correo porque alguien del equipo te invitó a la plataforma. Si no esperabas esta invitación, ignóralo.',
    ),
  };
}

export function correoDeRecuperacion(d: {
  readonly para: string;
  readonly nombre: string;
  readonly token: string;
}): Correo {
  const url = enlaceDeContrasena(d.token);
  const asunto = 'Tu contraseña de la plataforma';
  const parrafos = [
    `Hola, ${d.nombre.split(' ')[0]}:`,
    'Pediste elegir una contraseña nueva para la plataforma de club-lealtad.',
    'El enlace sirve una sola vez y vence en una hora. Tu contraseña de ahora sigue sirviendo mientras no lo uses.',
  ];
  return {
    para: d.para,
    asunto,
    texto: [...parrafos, `Elegir una contraseña nueva: ${url}`].join('\n\n'),
    html: plantillaCorreo(
      asunto,
      parrafos,
      { texto: 'Elegir una contraseña nueva', url },
      'club-lealtad. Si no lo pediste tú, ignora este correo: nadie puede entrar sin el enlace.',
    ),
  };
}

/** Aviso al equipo: un club pidió pasar a Privada. Responder le escribe al club. */
export function correoSolicitudPrivada(d: {
  readonly para: string;
  readonly club: string;
  readonly slug: string;
  readonly quien: string;
  readonly correo: string;
  readonly whatsapp: string | null;
  readonly nota: string | null;
}): Correo {
  const url = `${origenDelServicio()}/plataforma/${encodeURIComponent(d.slug)}`;
  const asunto = `${d.club} quiere pasar a Privada`;
  const parrafos = [
    `${d.quien} (${d.correo}) pidió desde «Mi plan» pasar ${d.club} a Privada.`,
    ...(d.nota ? [`Nota: «${d.nota}»`] : []),
    d.whatsapp
      ? `WhatsApp del alta: +${d.whatsapp}. El siguiente paso es agendar la demo y cotizar.`
      : 'El siguiente paso es agendar la demo y cotizar.',
    'La solicitud también aparece en la ficha del club y en el inicio de la plataforma hasta que el club pase a Privada.',
  ];
  return {
    para: d.para,
    asunto,
    texto: [...parrafos, `Ficha del club: ${url}`].join('\n\n'),
    html: plantillaCorreo(
      asunto,
      parrafos,
      { texto: 'Abrir la ficha del club', url },
      'club-lealtad. Te llega porque tienes cuenta en la plataforma.',
    ),
  };
}
