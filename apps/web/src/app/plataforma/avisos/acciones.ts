'use server';

import { redirect } from 'next/navigation';
import { dueniosDeClubes, listarNegocios, registrarAvisoPlataforma } from '@wl/database';

import { correoDeAviso, revisarAviso } from '@/lib/avisos-plataforma';
import { CORREO_CONFIGURADO, enviarCorreo, enviarLote } from '@/lib/correo';
import { audienciaDe } from '@/lib/plataforma/audiencia';
import { anotar } from '@/lib/plataforma/bitacora';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

export interface EstadoAviso {
  readonly error: string | null;
  /** Lo que sí pasó (la prueba salió). */
  readonly listo: string | null;
  readonly asunto: string;
  readonly mensaje: string;
  readonly audiencia: string;
}

/**
 * Manda un aviso a los dueños de los clubes elegidos, o una prueba a quien lo
 * escribe. Un correo por dueño y club, con su nombre y el de su club.
 */
export async function enviarAviso(_previo: EstadoAviso, form: FormData): Promise<EstadoAviso> {
  const sesion = await exigirPlataforma();
  const asunto = String(form.get('asunto') ?? '').trim();
  const mensaje = String(form.get('mensaje') ?? '').trim();
  const valor = String(form.get('audiencia') ?? '');
  const prueba = form.get('intencion') === 'prueba';
  const estado = { asunto, mensaje, audiencia: valor, listo: null };
  const con = (error: string): EstadoAviso => ({ ...estado, error });

  const falta = revisarAviso(asunto, mensaje);
  if (falta) return con(falta);
  if (!CORREO_CONFIGURADO) return con('El envío de correos no está activo en este sitio.');

  const audiencia = audienciaDe(valor, await listarNegocios());
  if (!audiencia) return con('Elige a quién va el aviso.');

  if (prueba) {
    const ejemplo = audiencia.clubes[0]?.negocio;
    const r = await enviarCorreo(
      correoDeAviso({
        para: sesion.email,
        nombre: sesion.nombre,
        club: ejemplo ?? { nombre: 'Tu club', slug: '' },
        asunto: `[Prueba] ${asunto}`,
        mensaje,
      }),
    );
    if (!r.ok) return con(r.error);
    return { ...estado, error: null, listo: `La prueba salió a ${sesion.email}.` };
  }

  if (form.get('confirmo') !== 'si') return con('Marca la casilla para confirmar el envío.');
  if (audiencia.clubes.length === 0) return con('No hay clubes en ese grupo.');

  const porId = new Map(audiencia.clubes.map((f) => [f.negocio.id, f.negocio]));
  const duenios = await dueniosDeClubes([...porId.keys()]);
  if (duenios.length === 0) return con('Esos clubes no tienen un dueño con correo.');

  const { enviados, fallidos, error } = await enviarLote(
    duenios.map((d) =>
      correoDeAviso({
        para: d.email,
        nombre: d.nombre,
        club: porId.get(d.negocioId)!,
        asunto,
        mensaje,
      }),
    ),
  );
  if (enviados === 0) return con(error ?? 'No salió ningún correo. Inténtalo más tarde.');

  await registrarAvisoPlataforma({
    asunto,
    mensaje,
    audiencia: audiencia.etiqueta,
    clubes: new Set(duenios.map((d) => d.negocioId)).size,
    enviados,
    fallidos,
    enviadoPor: sesion.email,
  });
  await anotar(sesion, 'aviso.enviar', {
    club: audiencia.valor.startsWith('club:') ? audiencia.clubes[0]?.negocio : null,
    detalle: { asunto, audiencia: audiencia.etiqueta, enviados, fallidos },
  });
  redirect(`/plataforma/avisos?enviados=${enviados}&fallidos=${fallidos}`);
}
