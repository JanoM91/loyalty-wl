import {
  cerrarAvisoPlataforma,
  dueniosDeClubes,
  leerAvisoPlataforma,
  listarNegocios,
} from '@wl/database';

import { origenDelServicio } from '@/lib/avisos-dueno';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { enviarLote, type Correo } from '@/lib/correo';
import { plantillaCorreo } from '@/lib/correo-plantilla';
import { audienciaDe } from '@/lib/plataforma/audiencia';

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

/**
 * Manda un aviso ya creado (estado ENVIANDO): calcula su audiencia en este
 * momento, escribe a cada dueño, deja una copia en el buzón de cada club y
 * lo cierra. Lo usan el botón «Enviar» y la tarea de los programados.
 */
export async function despacharAviso(
  id: string,
): Promise<{ ok: true; enviados: number; fallidos: number } | { ok: false; error: string }> {
  const aviso = await leerAvisoPlataforma(id);
  if (!aviso || aviso.estado !== 'ENVIANDO')
    return { ok: false, error: 'Ese aviso ya no está por salir.' };
  const audiencia = audienciaDe(aviso.valorAudiencia ?? '', await listarNegocios());
  const clubes = audiencia?.clubes ?? [];
  const porId = new Map(clubes.map((f) => [f.negocio.id, f.negocio]));
  const duenios = await dueniosDeClubes([...porId.keys()]);
  const correos = duenios.map((d) =>
    correoDeAviso({
      para: d.email,
      nombre: d.nombre,
      club: porId.get(d.negocioId)!,
      asunto: aviso.asunto,
      mensaje: aviso.mensaje,
    }),
  );
  const envio =
    correos.length > 0 ? await enviarLote(correos) : { ids: [] as (string | null)[], error: null };
  const { enviados, fallidos } = await cerrarAvisoPlataforma(id, {
    audiencia: audiencia?.etiqueta ?? aviso.audiencia,
    destinatarios: duenios.map((d, i) => ({
      negocioId: d.negocioId,
      club: porId.get(d.negocioId)!.nombre,
      email: d.email,
      nombre: d.nombre,
      resendId: envio.ids[i] ?? null,
    })),
    // El buzón lo recibe todo club de la audiencia, tenga o no dueño con correo.
    clubes: [...porId.keys()],
  });
  if (enviados === 0 && duenios.length > 0) {
    return { ok: false, error: envio.error ?? 'No salió ningún correo. Inténtalo más tarde.' };
  }
  return { ok: true, enviados, fallidos };
}

/**
 * «2026-11-25T09:30» escrito en el formulario, como hora del centro de México.
 * Devuelve null si no es una fecha válida.
 */
export function instanteDeMexico(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [, a, mes, d, h, min] = m.map(Number) as [number, number, number, number, number, number];
  // Se prueba con la diferencia de hoy y se corrige con la del instante resultante.
  const comoUtc = Date.UTC(a, mes - 1, d, h, min);
  const diferencia = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, Number(x.value)]),
    ) as Record<string, number>;
    return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) - t;
  };
  const primero = comoUtc - diferencia(comoUtc);
  const instante = comoUtc - diferencia(primero);
  return Number.isNaN(instante) ? null : new Date(instante);
}
