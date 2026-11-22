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

import { negocioDeLaPeticion } from '@/lib/negocio';

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

/** Remitente y «responder a» del negocio en curso (o de la plataforma). */
async function remitenteDelNegocio(): Promise<{ from: string; replyTo?: string } | null> {
  const direccion = process.env.RESEND_FROM_EMAIL;
  if (!direccion) return null;
  const negocio = await negocioDeLaPeticion();
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

/** Marcas que la plantilla deja y `vestirCorreo` llena con el negocio. */
const HUECO_NOMBRE = '%%WL_NOMBRE%%';
const HUECO_FONDO = '%%WL_FONDO%%';
const HUECO_SOBRE = '%%WL_SOBRE%%';
const HUECO_PIE = '%%WL_PIE%%';

function escapar(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
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
  const negocio = await negocioDeLaPeticion();
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

/**
 * Plantilla sencilla con la marca. Sin imágenes externas: muchos clientes las
 * bloquean. El nombre y los colores del negocio se ponen al enviar.
 */
export function plantillaCorreo(
  titulo: string,
  parrafos: readonly string[],
  boton?: { texto: string; url: string },
  /** Por qué le llega este correo. Por omisión, el de la tarjeta de lealtad. */
  pie?: string,
  /** Enlace para darse de baja, debajo del pie (mensajes del negocio). */
  baja?: { texto: string; url: string },
): string {
  const esc = escapar;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ec;font-family:Helvetica,Arial,sans-serif;color:#14100c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e0dcd2" cellpadding="0" cellspacing="0">
<tr><td style="background:${HUECO_FONDO};color:${HUECO_SOBRE};padding:18px 24px;font-size:20px;font-weight:bold">${HUECO_NOMBRE}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(titulo)}</h1>
${parrafos.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(p)}</p>`).join('')}
${boton ? `<p style="margin:20px 0"><a href="${esc(boton.url)}" style="background:${HUECO_FONDO};color:${HUECO_SOBRE};text-decoration:none;padding:12px 20px;display:inline-block;font-weight:bold">${esc(boton.texto)}</a></p>` : ''}
<p style="font-size:12px;color:#6b665c;margin:20px 0 0">${pie ? esc(pie) : HUECO_PIE}</p>
${baja ? `<p style="font-size:12px;margin:8px 0 0"><a href="${esc(baja.url)}" style="color:#6b665c">${esc(baja.texto)}</a></p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}
