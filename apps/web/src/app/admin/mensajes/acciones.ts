'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  ROLES_USUARIOS,
  audienciaMensajes,
  cerrarMensaje,
  conNegocio,
  destinatariosMensaje,
  registrarMensaje,
  revisarMensaje,
  siguienteMensajePosible,
  usoMensajesDelMes,
  type MensajeRevisado,
  type Negocio,
} from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';
import {
  CORREO_CONFIGURADO,
  enviarCorreo,
  enviarLote,
  plantillaCorreo,
  type CorreoDeLote,
} from '@/lib/correo';
import { urlPersonalDeTarjeta } from '@/lib/lealtad/enlace-personal';
import { urlBaja } from '@/lib/mensajes';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

export interface EstadoMensaje {
  readonly error: string | null;
  readonly aviso: string | null;
}

const primerNombre = (n: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

/** El correo de un mensaje para una persona. */
function armarCorreo(
  m: MensajeRevisado,
  negocio: Negocio,
  d: {
    readonly para: string;
    readonly nombre: string | null;
    readonly tarjeta: string;
    readonly baja: string | null;
    readonly prueba?: boolean;
  },
): CorreoDeLote {
  const nombre = primerNombre(d.nombre);
  const parrafos = [
    nombre ? `Hola, ${nombre}:` : 'Hola:',
    ...m.cuerpo.split(/\n+/).filter((p) => p.trim() !== ''),
  ];
  const domicilio = negocio.marca.legal.domicilio;
  const pie = d.prueba
    ? `Prueba: así verán este mensaje tus clientes. Ellos verán debajo el enlace para darse de baja.`
    : `${negocio.nombre}${domicilio ? `, ${domicilio}` : ''}. Recibes este correo porque aceptaste promociones de ${negocio.nombre} en tu tarjeta de lealtad.`;
  const baja = d.baja ? { texto: 'Ya no quiero recibir promociones', url: d.baja } : undefined;
  return {
    para: d.para,
    asunto: m.asunto,
    texto: [
      ...parrafos,
      `Ver mi tarjeta: ${d.tarjeta}`,
      pie,
      ...(baja ? [`${baja.texto}: ${baja.url}`] : []),
    ].join('\n\n'),
    html: plantillaCorreo(
      m.asunto,
      parrafos,
      { texto: 'Ver mi tarjeta', url: d.tarjeta },
      pie,
      baja,
    ),
    ...(d.baja
      ? {
          encabezados: {
            'List-Unsubscribe': `<${d.baja}/rapida>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  };
}

function leer(form: FormData) {
  return revisarMensaje(String(form.get('asunto') ?? ''), String(form.get('cuerpo') ?? ''));
}

/** Manda el mensaje solo al dueño, para que vea cómo queda. */
export async function probarMensaje(
  _previo: EstadoMensaje,
  form: FormData,
): Promise<EstadoMensaje> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  if (!negocio.ajustes.mensajes?.activo)
    return { error: 'Tu club no tiene activados los mensajes.', aviso: null };
  const r = leer(form);
  if (!r.ok) return { error: r.error, aviso: null };
  if (!CORREO_CONFIGURADO)
    return { error: 'El envío de correos todavía no está activo.', aviso: null };
  const origen = await origenDeLaPeticion();
  const correo = armarCorreo(r.mensaje, negocio, {
    para: sesion.email,
    nombre: sesion.nombre,
    tarjeta: `${origen}/lealtad`,
    baja: null,
    prueba: true,
  });
  const envio = await enviarCorreo(correo);
  return envio.ok
    ? { error: null, aviso: `Te mandamos la prueba a ${sesion.email}.` }
    : { error: envio.error, aviso: null };
}

/**
 * Manda el mensaje a quienes aceptaron promociones. Revisa el servicio, el
 * tope del mes y que haya pasado un día desde el anterior; registra el
 * mensaje y lo manda después de responder, en lotes de 100.
 */
export async function enviarMensaje(
  _previo: EstadoMensaje,
  form: FormData,
): Promise<EstadoMensaje> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const ajustes = negocio.ajustes.mensajes;
  if (!ajustes?.activo) return { error: 'Tu club no tiene activados los mensajes.', aviso: null };
  const r = leer(form);
  if (!r.ok) return { error: r.error, aviso: null };
  if (!CORREO_CONFIGURADO)
    return { error: 'El envío de correos todavía no está activo.', aviso: null };

  const [audiencia, uso, siguiente] = await Promise.all([
    audienciaMensajes(),
    usoMensajesDelMes(),
    siguienteMensajePosible(),
  ]);
  if (siguiente) {
    const cuando = siguiente.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    return {
      error: `Ya mandaste un mensaje hoy. El siguiente puede salir el ${cuando}`,
      aviso: null,
    };
  }
  if (audiencia === 0) {
    return {
      error: 'Todavía no hay clientes que hayan aceptado promociones con su correo verificado.',
      aviso: null,
    };
  }
  const restante = Math.max(0, ajustes.topeMensual - uso);
  if (audiencia > restante) {
    return {
      error: `Este mensaje llegaría a ${audiencia} clientes y este mes te quedan ${restante} correos. Pide más por WhatsApp a club-lealtad.`,
      aviso: null,
    };
  }

  const origen = await origenDeLaPeticion();
  // Sin enlace de baja no sale ningún mensaje de promociones.
  if (!urlBaja(origen, negocio.id, negocio.id)) {
    return { error: 'Falta configurar los enlaces de baja. Avisa a club-lealtad.', aviso: null };
  }

  const destinatarios = await destinatariosMensaje(audiencia);
  const id = await registrarMensaje(r.mensaje, destinatarios.length, { userId: sesion.userId });
  const mensaje = r.mensaje;

  after(async () => {
    await conNegocio(negocio, async () => {
      const correos: CorreoDeLote[] = [];
      for (const d of destinatarios) {
        const tarjeta = (await urlPersonalDeTarjeta(d.cardId)) ?? `${origen}/lealtad`;
        correos.push(
          armarCorreo(mensaje, negocio, {
            para: d.correo,
            nombre: d.nombre,
            tarjeta,
            baja: urlBaja(origen, negocio.id, d.cardId),
          }),
        );
      }
      const envio = await enviarLote(correos);
      await cerrarMensaje(id, envio);
    });
  });

  revalidatePath('/admin/mensajes');
  return {
    error: null,
    aviso: `Enviando a ${destinatarios.length} ${destinatarios.length === 1 ? 'cliente' : 'clientes'}. En unos minutos verás el resultado abajo.`,
  };
}
