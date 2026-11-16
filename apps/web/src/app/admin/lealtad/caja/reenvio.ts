'use server';

import { reenviarAccesoTarjeta } from '@wl/database';
import {
  correoReenvio,
  esCanalReenvio,
  mensajeReenvioWhatsApp,
  vigenciaEnlace,
  type CanalReenvio,
  type DatosReenvio,
} from '@wl/domain';

import { ROLES_CAJA, sucursalDeCaja } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { enviarCorreo, plantillaCorreo } from '@/lib/correo';
import { urlPersonalDeTarjeta } from '@/lib/lealtad/enlace-personal';
import { qrSvg } from '@/lib/lealtad/qr';
import { exigirNegocio, origenDeLaPeticion, sitioDeLaPeticion } from '@/lib/negocio';

/**
 * «Volver a mandar el enlace» en la caja: para quien ya tiene tarjeta pero no
 * la tiene abierta en su celular (p. ej. no abrió a tiempo la bienvenida). El
 * enlace va al contacto registrado de la tarjeta; aquí no se escribe ninguno.
 * Reglas en `@wl/database` (`reenvio.ts`) y textos en `@wl/domain`.
 */

export type RespuestaReenvio =
  | {
      readonly ok: true;
      readonly canal: 'WHATSAPP';
      /** Enlace wa.me con el mensaje escrito, al celular registrado. */
      readonly whatsapp: string;
      readonly contacto: string;
      readonly vence: string;
    }
  | {
      readonly ok: true;
      readonly canal: 'CORREO';
      readonly contacto: string;
      readonly vence: string;
    }
  | {
      readonly ok: true;
      readonly canal: 'PANTALLA';
      readonly url: string;
      readonly svg: string;
      readonly vence: string;
    }
  | { readonly ok: false; readonly error: string };

export async function reenviarAcceso(d: {
  readonly codigo: string;
  readonly sucursalSlug: string;
  readonly canal: CanalReenvio;
}): Promise<RespuestaReenvio> {
  const sesion = await exigirRol(ROLES_CAJA);
  if (!esCanalReenvio(d.canal)) return { ok: false, error: 'Elige cómo mandar el enlace.' };
  const { sucursal } = await sucursalDeCaja(sesion, d.sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  const r = await reenviarAccesoTarjeta({
    codigo: d.codigo,
    canal: d.canal,
    usuarioId: sesion.userId,
    sucursalId: sucursal.id,
  });
  if (!r.ok) return r;

  // El enlace personal (permanente) lleva el de un solo uso en `a`: abrirlo
  // verifica el contacto por el que llegó y la tarjeta queda siempre a la mano.
  const url =
    (await urlPersonalDeTarjeta(r.cardId, { a: r.token })) ??
    `${await origenDeLaPeticion()}/lealtad/acceso/${r.token}`;
  const permanente = !url.includes('/lealtad/acceso/');
  const vence = permanente ? 'no vence' : vigenciaEnlace(r.minutos);
  const datos: DatosReenvio = {
    nombre: r.nombre,
    estampas: r.estampas,
    url,
    creaContrasena: !r.tieneContrasena,
    negocio: (await exigirNegocio()).nombre,
    sitio: await sitioDeLaPeticion(),
    minutos: r.minutos,
    permanente,
  };

  if (r.canal === 'WHATSAPP') {
    if (!r.celular) return { ok: false, error: 'La tarjeta no tiene celular registrado.' };
    return {
      ok: true,
      canal: 'WHATSAPP',
      whatsapp: `https://wa.me/52${r.celular}?text=${encodeURIComponent(mensajeReenvioWhatsApp(datos))}`,
      contacto: r.contacto,
      vence,
    };
  }

  if (r.canal === 'CORREO') {
    if (!r.correo) return { ok: false, error: 'La tarjeta no tiene correo registrado.' };
    const c = correoReenvio(datos);
    const envio = await enviarCorreo({
      para: r.correo,
      asunto: c.asunto,
      texto: [...c.parrafos, url].join('\n\n'),
      html: plantillaCorreo(c.titulo, c.parrafos, { texto: 'Abrir mi tarjeta', url }),
    });
    if (!envio.ok) {
      return {
        ok: false,
        error: envio.configurado
          ? 'El correo no salió. Mándalo por WhatsApp o que escanee el QR.'
          : envio.error,
      };
    }
    return { ok: true, canal: 'CORREO', contacto: r.contacto, vence };
  }

  return { ok: true, canal: 'PANTALLA', url, svg: await qrSvg(url), vence };
}
