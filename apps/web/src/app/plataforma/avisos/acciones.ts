'use server';

import {
  actualizarEntregas,
  borrarPlantillaAviso,
  cancelarAvisoProgramado,
  crearAvisoPlataforma,
  guardarPlantillaAviso,
  leerAvisoPlataforma,
  listarNegocios,
} from '@wl/database';

import {
  correoDeAviso,
  despacharAviso,
  instanteDeMexico,
  revisarAviso,
} from '@/lib/avisos-plataforma';
import { CORREO_CONFIGURADO, enviarCorreo, eventosRecientes } from '@/lib/correo';
import { audienciaDe } from '@/lib/plataforma/audiencia';
import { anotar } from '@/lib/plataforma/bitacora';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

export interface EstadoAviso {
  readonly error: string | null;
  /** Lo que sí pasó (la prueba salió, la plantilla se guardó). */
  readonly listo: string | null;
  readonly asunto: string;
  readonly mensaje: string;
  readonly audiencia: string;
  /**
   * Carga completa de esta dirección al terminar: repintar la página dentro
   * de la respuesta de la acción a veces no se aplica (ver plataforma/acciones.ts).
   */
  readonly recargar?: string;
}

/** Lo más lejos que se puede programar un aviso. */
const DIAS_MAXIMOS_PROGRAMAR = 60;

/**
 * Manda un aviso a los dueños de los clubes elegidos (ya o programado), una
 * prueba a quien lo escribe, o lo guarda como plantilla. Un correo por dueño y
 * club, con su nombre y el de su club, y una copia en el buzón de cada club.
 */
export async function enviarAviso(_previo: EstadoAviso, form: FormData): Promise<EstadoAviso> {
  const sesion = await exigirPlataforma();
  const asunto = String(form.get('asunto') ?? '').trim();
  const mensaje = String(form.get('mensaje') ?? '').trim();
  const valor = String(form.get('audiencia') ?? '');
  const intencion = String(form.get('intencion') ?? '');
  const estado = { asunto, mensaje, audiencia: valor, listo: null };
  const con = (error: string): EstadoAviso => ({ ...estado, error });

  const falta = revisarAviso(asunto, mensaje);
  if (falta) return con(falta);

  if (intencion === 'plantilla') {
    const nombre = String(form.get('nombrePlantilla') ?? '').trim();
    if (nombre.length < 2) return con('Ponle un nombre a la plantilla.');
    await guardarPlantillaAviso({ nombre, asunto, mensaje }, sesion.email);
    return { ...estado, error: null, listo: `Plantilla «${nombre}» guardada.` };
  }

  if (!CORREO_CONFIGURADO) return con('El envío de correos no está activo en este sitio.');
  const audiencia = audienciaDe(valor, await listarNegocios());
  if (!audiencia) return con('Elige a quién va el aviso.');

  if (intencion === 'prueba') {
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
    return {
      ...estado,
      error: null,
      listo: `La prueba salió a ${sesion.email}. Revísala y, si está bien, envía el aviso.`,
    };
  }

  if (form.get('confirmo') !== 'si') return con('Marca la casilla para confirmar el envío.');

  let programadoPara: Date | null = null;
  if (form.get('cuando') === 'programar') {
    programadoPara = instanteDeMexico(String(form.get('fecha') ?? ''));
    const ahora = Date.now();
    if (!programadoPara) return con('Elige el día y la hora del envío.');
    if (programadoPara.getTime() < ahora + 5 * 60_000)
      return con('Programa el envío al menos 5 minutos después de ahora.');
    if (programadoPara.getTime() > ahora + DIAS_MAXIMOS_PROGRAMAR * 86_400_000)
      return con(`Se puede programar hasta ${DIAS_MAXIMOS_PROGRAMAR} días adelante.`);
  } else if (audiencia.clubes.length === 0) {
    return con('No hay clubes en ese grupo.');
  }

  const id = await crearAvisoPlataforma({
    asunto,
    mensaje,
    audiencia: audiencia.etiqueta,
    valorAudiencia: audiencia.valor,
    enviadoPor: sesion.email,
    programadoPara,
  });
  const club = audiencia.valor.startsWith('club:') ? audiencia.clubes[0]?.negocio : null;

  if (programadoPara) {
    await anotar(sesion, 'aviso.programar', {
      club,
      detalle: { asunto, audiencia: audiencia.etiqueta, para: programadoPara.toISOString() },
    });
    return {
      ...estado,
      error: null,
      listo: 'Aviso programado.',
      recargar: '/plataforma/avisos?aviso=programado',
    };
  }

  const r = await despacharAviso(id);
  if (!r.ok) return con(r.error);
  await anotar(sesion, 'aviso.enviar', {
    club,
    detalle: { asunto, audiencia: audiencia.etiqueta, enviados: r.enviados, fallidos: r.fallidos },
  });
  return {
    ...estado,
    error: null,
    listo: 'Aviso enviado.',
    recargar: `/plataforma/avisos/${id}`,
  };
}

export interface EstadoEntregas {
  readonly mensaje: string | null;
  readonly recargar?: string;
}

/** Cancela un aviso programado que todavía no sale. */
export async function cancelarAviso(
  _previo: EstadoEntregas,
  form: FormData,
): Promise<EstadoEntregas> {
  const sesion = await exigirPlataforma();
  const id = String(form.get('id') ?? '');
  const aviso = await leerAvisoPlataforma(id);
  if (!aviso || !(await cancelarAvisoProgramado(id))) {
    return { mensaje: 'Ese aviso ya salió o ya estaba cancelado.' };
  }
  await anotar(sesion, 'aviso.cancelar', { detalle: { asunto: aviso.asunto } });
  return { mensaje: null, recargar: '/plataforma/avisos?aviso=cancelado' };
}

/** Pregunta a Resend qué pasó con los correos recientes y lo guarda. */
export async function actualizarEstados(
  _previo: EstadoEntregas,
  form: FormData,
): Promise<EstadoEntregas> {
  await exigirPlataforma();
  const id = String(form.get('id') ?? '');
  const { permitido, eventos } = await eventosRecientes();
  if (!permitido) {
    return {
      mensaje:
        'La llave de Resend de este sitio solo puede enviar. Para ver entregas, crea en Resend una llave con acceso completo y ponla en RESEND_API_KEY.',
    };
  }
  await actualizarEntregas(eventos);
  return { mensaje: null, recargar: `/plataforma/avisos/${id}?aviso=estados` };
}

export async function borrarPlantilla(
  _previo: EstadoEntregas,
  form: FormData,
): Promise<EstadoEntregas> {
  const sesion = await exigirPlataforma();
  await borrarPlantillaAviso(String(form.get('id') ?? ''));
  await anotar(sesion, 'aviso.plantilla_borrar', {
    detalle: { nombre: String(form.get('nombre') ?? '') },
  });
  return { mensaje: null, recargar: '/plataforma/avisos?aviso=plantilla-borrada' };
}
