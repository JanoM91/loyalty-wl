import type { CifrasDelClub } from '@wl/database';
import type { AvisoPendiente } from '@wl/domain';

import { enlaceWhatsAppServicio } from '@/lib/contacto';
import type { Correo } from '@/lib/correo';
import { plantillaCorreo } from '@/lib/correo-plantilla';

/**
 * Correos de club-lealtad al dueño de un club: fin de prueba, pausa, último
 * aviso antes del borrado y resumen de la semana. Los manda la plataforma (no
 * el negocio) desde la tarea diaria `/api/cron/avisos-dueno`.
 *
 * Fuera de una petición del club no hay dirección de la que sacar el
 * origen: se usa `WL_ORIGEN_SITIO` o club-lealtad.com.
 */

export function origenDelServicio(): string {
  return (process.env.WL_ORIGEN_SITIO?.trim() || 'https://club-lealtad.com').replace(/\/$/, '');
}

const numero = (n: number) => n.toLocaleString('es-MX');
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;

function fecha(d: Date, zona: string, conAnio = false): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    ...(conAnio ? { year: 'numeric' } : {}),
    timeZone: zona,
  }).format(d);
}

/** WhatsApp de ayuda sin mensaje armado: en el correo se lee completo. */
const ayuda = () => `¿Dudas? Escríbenos por WhatsApp: ${enlaceWhatsAppServicio('').split('?')[0]}`;

const saludo = (nombre: string) => (nombre ? `Hola, ${nombre.split(' ')[0]}:` : 'Hola:');

const pie = (club: string, motivo: string) =>
  `club-lealtad. Recibes este correo porque eres dueño del club ${club} en club-lealtad.com. ${motivo}`;

function armar(
  para: string,
  asunto: string,
  titulo: string,
  parrafos: readonly string[],
  boton: { texto: string; url: string },
  piePagina: string,
): Correo {
  return {
    para,
    asunto,
    texto: [...parrafos, `${boton.texto}: ${boton.url}`].join('\n\n'),
    html: plantillaCorreo(titulo, parrafos, boton, piePagina),
  };
}

export interface ClubDelAviso {
  readonly nombre: string;
  readonly slug: string;
  readonly zonaHoraria: string;
}

/** Correo de fin de prueba o de pago, pausa o borrado. */
export function correoDeCiclo(datos: {
  readonly para: string;
  readonly nombre: string;
  readonly club: ClubDelAviso;
  readonly aviso: AvisoPendiente;
  /** Números desde que se creó el club. */
  readonly cifras: CifrasDelClub;
  /** Día en que se borra si sigue en pausa; null si el borrado automático está apagado. */
  readonly borrarDesde: Date | null;
  readonly diasEnPausa: number;
}): Correo {
  const { club, aviso, cifras } = datos;
  const plan = `${origenDelServicio()}/${club.slug}/admin/plan`;
  const dia = fecha(aviso.fecha, club.zonaHoraria);
  const llevas =
    cifras.tarjetas === 0
      ? 'Tu club todavía no tiene tarjetas. Pon tu cartel QR junto a la caja y saca tu propia tarjeta para probarlo.'
      : `Tu club lleva ${plural(cifras.tarjetas, 'tarjeta', 'tarjetas')}, ${plural(cifras.visitas, 'visita', 'visitas')} y ${plural(cifras.premiosEntregados, 'premio entregado', 'premios entregados')}.`;

  if (aviso.tipo === 'por-vencer') {
    const titulo = aviso.pagado ? 'Tu plan vence pronto' : 'Tu prueba termina pronto';
    return armar(
      datos.para,
      aviso.pagado
        ? `Tu plan de ${club.nombre} vence el ${dia}`
        : `Tu prueba de ${club.nombre} termina el ${dia}`,
      titulo,
      [
        `${saludo(datos.nombre)} ${aviso.pagado ? `el plan de ${club.nombre} vence` : `la prueba gratis de ${club.nombre} termina`} el ${dia}.`,
        llevas,
        `${aviso.pagado ? 'Renueva' : 'Activa tu plan'} antes de esa fecha para que tu caja siga sumando sellos y tus clientes no se queden sin su tarjeta.`,
        ayuda(),
      ],
      { texto: aviso.pagado ? 'Renovar mi plan' : 'Activar mi club', url: plan },
      pie(club.nombre, 'Es un aviso de tu plan.'),
    );
  }

  if (aviso.tipo === 'pausa') {
    const guardados = datos.borrarDesde
      ? ` hasta el ${fecha(datos.borrarDesde, club.zonaHoraria)}`
      : '';
    return armar(
      datos.para,
      `${club.nombre} está en pausa`,
      'Tu club está en pausa',
      [
        `${saludo(datos.nombre)} ${aviso.pagado ? 'tu plan venció' : 'tu prueba gratis terminó'} el ${dia}. Mientras el club está en pausa, la caja no suma sellos y no se crean tarjetas nuevas.`,
        cifras.tarjetas === 0
          ? `Tu club y lo que configuraste siguen guardados${guardados}. Actívalo y sigues donde te quedaste.`
          : `Tus ${plural(cifras.tarjetas, 'tarjeta', 'tarjetas')} y sus sellos siguen guardados${guardados}. Actívalo y sigues donde te quedaste.`,
        ayuda(),
      ],
      { texto: 'Activar mi club', url: plan },
      pie(club.nombre, 'Es un aviso de tu plan.'),
    );
  }

  return armar(
    datos.para,
    `Último aviso: ${club.nombre} se borra el ${dia}`,
    'Último aviso',
    [
      `${saludo(datos.nombre)} ${club.nombre} lleva ${plural(datos.diasEnPausa, 'día', 'días')} en pausa. El ${fecha(aviso.fecha, club.zonaHoraria, true)} se borra ${cifras.tarjetas > 0 ? `con sus ${plural(cifras.tarjetas, 'tarjeta', 'tarjetas')} y sus sellos` : 'con todo lo que configuraste'}, y no se puede recuperar.`,
      'Si quieres conservarlo, actívalo antes de esa fecha.',
      ayuda(),
    ],
    { texto: 'Conservar mi club', url: plan },
    pie(club.nombre, 'Es un aviso de tu plan.'),
  );
}

/** Una sugerencia según cómo fue la semana. */
function consejo(c: CifrasDelClub): string {
  if (c.visitas === 0)
    return 'Esta semana no hubo visitas con tarjeta. Pon tu cartel QR junto a la caja y pide a tu equipo que ofrezca la tarjeta en cada cobro.';
  if (c.tarjetasNuevas === 0)
    return 'No hubo tarjetas nuevas: ofrece la tarjeta a cada cliente que pague por primera vez. Se crea en segundos desde tu QR.';
  if (c.premiosEntregados === 0 && c.premiosGanados === 0)
    return 'Tus clientes van sumando sellos. Recuérdales cuánto les falta para su premio cuando los selles.';
  return 'Vas bien: tus clientes están regresando. Sigue sellando en cada visita.';
}

/** Resumen del lunes con los números de la semana anterior. */
export function correoResumenSemanal(datos: {
  readonly para: string;
  readonly nombre: string;
  readonly club: ClubDelAviso;
  readonly cifras: CifrasDelClub;
  /** Primer y último día de la semana (lunes y domingo). */
  readonly desde: Date;
  readonly hasta: Date;
  readonly conJuegos: boolean;
}): Correo {
  const { club, cifras } = datos;
  const lineas = [
    `Visitas: ${numero(cifras.visitas)}`,
    `Clientes que vinieron: ${numero(cifras.clientes)}`,
    `Tarjetas nuevas: ${numero(cifras.tarjetasNuevas)}`,
    `Premios entregados: ${numero(cifras.premiosEntregados)}`,
    ...(datos.conJuegos
      ? [
          `Partidas en Juega y gana: ${numero(cifras.partidas)}`,
          `Promociones ganadas: ${numero(cifras.promocionesGanadas)}`,
        ]
      : []),
  ];
  const semana = `del ${fecha(datos.desde, club.zonaHoraria)} al ${fecha(datos.hasta, club.zonaHoraria)}`;
  return armar(
    datos.para,
    cifras.visitas > 0
      ? `Tu semana en ${club.nombre}: ${plural(cifras.visitas, 'visita', 'visitas')}`
      : `Tu semana en ${club.nombre}`,
    'Tu semana',
    [`${saludo(datos.nombre)} así le fue a ${club.nombre} ${semana}.`, ...lineas, consejo(cifras)],
    {
      texto: 'Ver mis números',
      url: `${origenDelServicio()}/${club.slug}/admin/lealtad/analitica`,
    },
    pie(club.nombre, 'Llega cada lunes; lo apagas en tu panel, en Mi cuenta.'),
  );
}
