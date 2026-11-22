import { diaConMes, type TipoRegalo } from '@wl/domain';

import type { CorreoDeLote } from '@/lib/correo';
import { plantillaCorreo } from '@/lib/correo-plantilla';

/**
 * Correos de los regalos automáticos: «Te extrañamos» y cumpleaños. Los
 * escribe club-lealtad con el regalo que eligió el dueño; salen a nombre del
 * negocio, con «Ver mi tarjeta» y el enlace para darse de baja, como los
 * mensajes del dueño.
 */

/** Origen del club fuera de una petición (la tarea diaria): club-lealtad.com/<club>. */
export function origenDelClub(slug: string): string {
  const servicio = (process.env.WL_ORIGEN_SITIO?.trim() || 'https://club-lealtad.com').replace(
    /\/$/,
    '',
  );
  return process.env.WL_NEGOCIO_UNICO ? servicio : `${servicio}/${slug}`;
}

const primerNombre = (n: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

export interface DatosCorreoRegalo {
  readonly tipo: TipoRegalo;
  readonly para: string;
  readonly nombre: string | null;
  readonly club: { readonly nombre: string; readonly domicilio: string | null };
  readonly regalo: string;
  /** Último día válido, "AAAA-MM-DD". */
  readonly ultimoDia: string;
  readonly tarjeta: string;
  readonly baja: string | null;
  /** Prueba para el dueño: dice que es una prueba y no lleva baja. */
  readonly prueba?: boolean;
}

/** Asunto y párrafos del correo, también para la vista previa del panel. */
export function textoCorreoRegalo(d: {
  readonly tipo: TipoRegalo;
  readonly nombre: string | null;
  readonly club: string;
  readonly regalo: string;
  readonly ultimoDia: string;
}): { asunto: string; titulo: string; parrafos: string[] } {
  const nombre = primerNombre(d.nombre);
  const hasta = `Muestra tu tarjeta en caja antes del ${diaConMes(d.ultimoDia)} y es tuyo.`;
  if (d.tipo === 'CUMPLE') {
    return {
      asunto: nombre ? `¡Feliz cumpleaños, ${nombre}!` : '¡Feliz cumpleaños!',
      titulo: 'Tienes un regalo de cumpleaños',
      parrafos: [
        nombre ? `Hola, ${nombre}:` : 'Hola:',
        `En ${d.club} queremos celebrarte. Tu regalo de cumpleaños: ${d.regalo}.`,
        hasta,
      ],
    };
  }
  return {
    asunto: `Te extrañamos en ${d.club}`,
    titulo: 'Te guardamos un regalo',
    parrafos: [
      nombre ? `Hola, ${nombre}:` : 'Hola:',
      `Hace tiempo que no te vemos en ${d.club} y queremos verte de nuevo. En tu próxima visita tienes de regalo: ${d.regalo}.`,
      hasta,
    ],
  };
}

export function correoRegalo(d: DatosCorreoRegalo): CorreoDeLote {
  const t = textoCorreoRegalo({ ...d, club: d.club.nombre });
  const pie = d.prueba
    ? 'Prueba: así lo verán tus clientes. Ellos verán debajo el enlace para darse de baja.'
    : `${d.club.nombre}${d.club.domicilio ? `, ${d.club.domicilio}` : ''}. Recibes este correo porque aceptaste promociones de ${d.club.nombre} en tu tarjeta de lealtad.`;
  const baja = d.baja ? { texto: 'Ya no quiero recibir promociones', url: d.baja } : undefined;
  return {
    para: d.para,
    asunto: d.prueba ? `Prueba: ${t.asunto}` : t.asunto,
    texto: [
      ...t.parrafos,
      `Ver mi tarjeta: ${d.tarjeta}`,
      pie,
      ...(baja ? [`${baja.texto}: ${baja.url}`] : []),
    ].join('\n\n'),
    html: plantillaCorreo(
      t.titulo,
      t.parrafos,
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
