/**
 * Plantilla de los correos, sin dependencias: la usan el envío (`correo.ts`)
 * y los armadores de correos que se prueban solos.
 */

/** Marcas que la plantilla deja y `vestirCorreo` llena con el negocio. */
export const HUECO_NOMBRE = '%%WL_NOMBRE%%';
export const HUECO_FONDO = '%%WL_FONDO%%';
export const HUECO_SOBRE = '%%WL_SOBRE%%';
export const HUECO_PIE = '%%WL_PIE%%';

export function escapar(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
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
