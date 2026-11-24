import { origenDelServicio } from '@/lib/avisos-dueno';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import type { Correo } from '@/lib/correo';
import { plantillaCorreo } from '@/lib/correo-plantilla';

/**
 * Aviso que Exkalibur escribe a mano para los dueños, desde
 * `/plataforma/avisos`. Sale como club-lealtad, con el nombre del dueño y de
 * su club, y un botón a su panel.
 */

export const LARGO_ASUNTO = { min: 3, max: 120 } as const;
export const LARGO_MENSAJE = { min: 10, max: 3000 } as const;

/** Revisa el aviso; devuelve qué corregir o null si está bien. */
export function revisarAviso(asunto: string, mensaje: string): string | null {
  if (asunto.length < LARGO_ASUNTO.min) return 'Escribe el asunto.';
  if (asunto.length > LARGO_ASUNTO.max)
    return `El asunto no puede pasar de ${LARGO_ASUNTO.max} caracteres.`;
  if (/[\r\n]/.test(asunto)) return 'El asunto va en una sola línea.';
  if (mensaje.length < LARGO_MENSAJE.min) return 'Escribe el mensaje.';
  if (mensaje.length > LARGO_MENSAJE.max)
    return `El mensaje no puede pasar de ${LARGO_MENSAJE.max} caracteres.`;
  return null;
}

/** El mensaje en párrafos: una línea en blanco separa uno de otro. */
export function parrafosDe(mensaje: string): string[] {
  return mensaje
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export function correoDeAviso(d: {
  readonly para: string;
  /** Nombre del dueño; vacío si no se sabe. */
  readonly nombre: string;
  readonly club: { readonly nombre: string; readonly slug: string };
  readonly asunto: string;
  readonly mensaje: string;
}): Correo {
  const saludo = d.nombre ? `Hola, ${d.nombre.split(' ')[0]}:` : 'Hola:';
  const ayuda = `¿Dudas? Escríbenos por WhatsApp: ${enlaceWhatsAppServicio('').split('?')[0]}`;
  const parrafos = [saludo, ...parrafosDe(d.mensaje), ayuda];
  const boton = { texto: 'Abrir mi panel', url: `${origenDelServicio()}/${d.club.slug}/admin` };
  return {
    para: d.para,
    asunto: d.asunto,
    texto: [...parrafos, `${boton.texto}: ${boton.url}`].join('\n\n'),
    html: plantillaCorreo(
      d.asunto,
      parrafos,
      boton,
      `club-lealtad. Recibes este correo porque eres dueño del club ${d.club.nombre} en club-lealtad.com. Es un aviso del servicio.`,
    ),
  };
}
