/**
 * Envío de correo con Resend.
 *
 * Se llama a su API directamente con `fetch`: son dos líneas y no justifican
 * una dependencia más. Si mañana se cambia de proveedor, solo cambia este
 * archivo. Ver `EmailPort` en packages/integrations.
 *
 * **Sin configurar.** Mientras no exista `RESEND_API_KEY` (y el dominio
 * verificado en Resend), no se envía nada y se devuelve `configurado: false`
 * para que la pantalla lo diga en lugar de prometer un correo que no llegará.
 * En desarrollo, el contenido se escribe en la consola del servidor.
 */

import { negocioFijado } from '@wl/database';

import { negocioDeLaPeticion } from '@/lib/negocio';

import {
  HUECO_FONDO,
  HUECO_NOMBRE,
  HUECO_PIE,
  HUECO_SOBRE,
  escapar,
  plantillaCorreo,
} from './correo-plantilla';

export { plantillaCorreo };

export interface Correo {
  readonly para: string;
  readonly asunto: string;
  readonly texto: string;
  readonly html: string;
}

export type ResultadoCorreo =
  | { readonly ok: true }
  | { readonly ok: false; readonly configurado: boolean; readonly error: string };

export const CORREO_CONFIGURADO = Boolean(
  process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL,
);

/** API de Resend. Se puede apuntar a un simulador local para probar. */
const API = (process.env.RESEND_API_URL ?? 'https://api.resend.com').replace(/\/$/, '');

/**
 * El negocio del correo: el fijado con `conNegocio` (una tarea diaria que
 * escribe a los clientes de cada club) o el de la petición. Sin ninguno, el
 * correo sale como club-lealtad.
 */
async function negocioDelCorreo() {
  return negocioFijado() ?? (await negocioDeLaPeticion());
}

/** Remitente y «responder a» del negocio en curso (o de la plataforma). */
async function remitenteDelNegocio(): Promise<{ from: string; replyTo?: string } | null> {
  const direccion = process.env.RESEND_FROM_EMAIL;
  if (!direccion) return null;
  const negocio = await negocioDelCorreo();
  const nombre = (negocio?.nombre ?? process.env.RESEND_FROM_NAME ?? 'Programa de lealtad').replace(
    /[<>"\r\n]/g,
    '',
  );
  const responderA = negocio?.marca.contacto.correo ?? undefined;
  return { from: `${nombre} <${direccion}>`, ...(responderA ? { replyTo: responderA } : {}) };
}

export interface CorreoDeLote extends Correo {
  /** Encabezados extra, como `List-Unsubscribe`. */
  readonly encabezados?: Readonly<Record<string, string>>;
}

/**
 * Manda varios correos con la API de lotes de Resend (100 por llamada), con
 * el remitente del negocio en curso. Devuelve cuántos salieron y cuántos no.
 * Un lote rechazado (por ejemplo, por el límite diario del plan) cuenta
 * entero como fallido y se siguen intentando los demás.
 */
export async function enviarLote(
  correos: readonly CorreoDeLote[],
): Promise<{ enviados: number; fallidos: number; error: string | null }> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = await remitenteDelNegocio();
  if (!clave || !remitente) {
    return {
      enviados: 0,
      fallidos: correos.length,
      error: 'El envío de correos todavía no está activo.',
    };
  }
  let enviados = 0;
  let fallidos = 0;
  let error: string | null = null;
  for (let i = 0; i < correos.length; i += 100) {
    const parte = correos.slice(i, i + 100);
    const cuerpo = await Promise.all(
      parte.map(async (c) => ({
        from: remitente.from,
        to: [c.para],
        subject: c.asunto,
        text: c.texto,
        html: await vestirCorreo(c.html),
        ...(remitente.replyTo ? { reply_to: remitente.replyTo } : {}),
        ...(c.encabezados ? { headers: c.encabezados } : {}),
      })),
    );
    try {
      const r = await fetch(`${API}/emails/batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      if (r.ok) {
        enviados += parte.length;
      } else {
        fallidos += parte.length;
        const detalle = await r.text();
        console.error('Resend rechazó un lote', r.status, detalle);
        error =
          r.status === 429
            ? 'Se alcanzó el límite de envíos de la cuenta de correo. Los que faltan no salieron.'
            : 'Algunos correos no salieron. Inténtalo más tarde.';
      }
    } catch (e) {
      fallidos += parte.length;
      console.error('Error al enviar un lote de correos', e);
      error = 'Algunos correos no salieron. Inténtalo más tarde.';
    }
  }
  return { enviados, fallidos, error };
}

export async function enviarCorreo(c: Correo): Promise<ResultadoCorreo> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[correo sin enviar · falta RESEND_API_KEY] para ${c.para}: ${c.texto}`);
    }
    return { ok: false, configurado: false, error: 'El envío de correos todavía no está activo.' };
  }

  // Un solo remitente de plataforma, con el nombre del negocio delante: es el
  // negocio quien le escribe a su cliente. Sin dirección configurada no se envía.
  const remitente = await remitenteDelNegocio();
  if (!remitente) {
    return { ok: false, configurado: false, error: 'El envío de correos todavía no está activo.' };
  }

  try {
    const r = await fetch(`${API}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remitente.from,
        to: [c.para],
        subject: c.asunto,
        text: c.texto,
        html: await vestirCorreo(c.html),
        ...(remitente.replyTo ? { reply_to: remitente.replyTo } : {}),
      }),
    });
    if (!r.ok) {
      console.error('Resend respondió', r.status, await r.text());
      return {
        ok: false,
        configurado: true,
        error: 'No pudimos enviar el correo. Inténtalo en un momento.',
      };
    }
    return { ok: true };
  } catch (e) {
    console.error('Error al enviar correo', e);
    return {
      ok: false,
      configurado: true,
      error: 'No pudimos enviar el correo. Inténtalo en un momento.',
    };
  }
}

const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Logotipo de club-lealtad para el encabezado de los correos sin negocio
 * (sobre noche): texto con el píxel lima en lugar del guion. Sin imágenes, por
 * la misma razón que la plantilla.
 */
const LOGOTIPO_CORREO =
  'club<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#C6FF3D;margin:0 3px;vertical-align:2px"></span>lealtad';

/** Pone el nombre y los colores del negocio en un correo armado con la plantilla. */
async function vestirCorreo(html: string): Promise<string> {
  const negocio = await negocioDelCorreo();
  const nombre = negocio?.nombre ?? process.env.RESEND_FROM_NAME ?? 'club-lealtad';
  // Sin negocio (correos del sitio, como la bienvenida): colores de club-lealtad.
  const fondo =
    negocio && COLOR.test(negocio.marca.colores.fondo) ? negocio.marca.colores.fondo : '#120A2A';
  const sobre =
    negocio && COLOR.test(negocio.marca.colores.sobreFondo)
      ? negocio.marca.colores.sobreFondo
      : '#FFF6EA';
  return html
    .replaceAll(HUECO_NOMBRE, negocio ? escapar(nombre) : LOGOTIPO_CORREO)
    .replaceAll(HUECO_FONDO, fondo)
    .replaceAll(HUECO_SOBRE, sobre)
    .replaceAll(
      HUECO_PIE,
      escapar(`${nombre}. Recibes este correo porque se solicitó desde tu tarjeta de lealtad.`),
    );
}
