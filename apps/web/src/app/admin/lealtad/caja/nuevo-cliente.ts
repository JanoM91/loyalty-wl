'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  accesoTarjetaCaja,
  acreditarVisita,
  crearEnlaceAcceso,
  crearTarjetaEnCaja,
  marcarEnlaceEnviadoPorWhatsApp,
  migrarTarjetaFisica,
  tarjetaPorContacto,
  vistaCaja,
  type AccesoTarjetaCaja,
  type ResultadoCaja,
  type VistaCaja,
} from '@wl/database';
import {
  fechaLocal,
  textoRechazo,
  validarComprobanteSinTarjeta,
  validarNombreDicho,
  type TextoRechazo,
} from '@wl/domain';

import { ROLES_CAJA, sucursalDeCaja } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { enviarCorreo, plantillaCorreo } from '@/lib/correo';
import { urlPersonalDeTarjeta } from '@/lib/lealtad/enlace-personal';
import { qrSvg } from '@/lib/lealtad/qr';
import { avisarCambioPorCodigo } from '@/lib/wallet/avisar';
import { registrarVisita, type RespuestaVisita } from './acciones';
import { fotoDelNegocio } from '@/lib/lealtad/fotos';
import { exigirNegocio } from '@/lib/negocio';

/**
 * «Registrar visita sin tarjeta»: alta desde el mostrador, visita por contacto y
 * migración de la tarjeta física.
 *
 * Sin el QR del cliente a la vista, la caja exige lo que con el QR es solo
 * deseable (decisión heredada de LAPANA, oct 2026): el nombre que dice la persona,
 * para cotejarlo con la tarjeta, y el comprobante de compra (foto del ticket
 * o folio). Es la defensa contra sumar visitas a un contacto conocido sin
 * haber comprado. Las reglas viven en `@wl/domain` (`sin-tarjeta.ts`) y
 * se comprueban aquí aunque el navegador ya las haya aplicado.
 *
 * El alta la hace el personal con la persona enfrente; el acceso a la tarjeta
 * le llega a ella por correo (Resend) o, si solo dejó celular, el personal se
 * lo manda por WhatsApp con un botón que abre el mensaje ya escrito. Desde
 * nov 2026 es su enlace personal permanente: no vence ni pide contraseña.
 */

/** Tres días: quien se registra en caja abre su tarjeta cuando puede. */
const MINUTOS_ENLACE_BIENVENIDA = 72 * 60;

export interface DatosNuevoCliente {
  readonly sucursalSlug: string;
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno: string;
  readonly celular: string;
  readonly correo: string;
  /** Comprobante de compra: folio o foto del ticket, al menos uno. */
  readonly folio: string;
  readonly fotoTicketUrl: string | null;
  readonly traeTarjetaFisica: boolean;
  readonly visitasFisicas: string;
  readonly fotoTarjetaUrl: string | null;
}

export interface Bienvenida {
  /** Enlace personal (permanente), por si hay que dictarlo o mostrarlo. */
  readonly url: string;
  /** QR del enlace, para que la persona lo escanee ahí mismo si quiere. */
  readonly svg: string;
  readonly venceEn: string;
  /** Qué pasó con el correo: enviado, sin correo, o el error. */
  readonly correo: 'ENVIADO' | 'SIN_CORREO' | 'FALLO';
  /** Enlace wa.me con el mensaje listo, si dejó celular. */
  readonly whatsapp: string | null;
}

export type RespuestaNuevoCliente =
  | {
      readonly ok: true;
      readonly tarjeta: VistaCaja;
      readonly visitaHoy: ResultadoCaja['tipo'];
      /** Por qué no se acreditó la visita de hoy, si fue rechazada (p. ej. folio repetido). */
      readonly visitaTexto: TextoRechazo | null;
      readonly visitasMigradas: number;
      readonly bienvenida: Bienvenida | null;
    }
  | { readonly ok: false; readonly error: string };

function textoBienvenida(nombre: string, estampas: number, url: string, negocio: string): string {
  const cuantas = estampas === 1 ? '1 sello' : `${estampas} sellos`;
  return [
    `Hola ${nombre.split(' ')[0]}, te damos la bienvenida al programa de lealtad de ${negocio}.`,
    `Tu tarjeta digital ya tiene ${cuantas}. Este es tu enlace personal: guárdalo, sirve siempre y en cualquier celular, sin contraseña.`,
    url,
    `Al abrirlo puedes agregar la tarjeta a la pantalla de inicio de tu celular para tenerla a la mano.`,
    `Es personal: no lo compartas. Si no quieres recibir promociones, puedes desactivarlas en tu perfil.`,
  ].join('\n\n');
}

async function mandarBienvenida(t: {
  cardId: string;
  codigo: string;
  nombre: string;
  correo: string | null;
  celular: string | null;
  estampas: number;
}): Promise<Bienvenida | null> {
  // Un solo enlace en el mensaje: el personal (permanente), que de paso canjea
  // el de un solo uso (`a`) para verificar el correo o el celular por el que
  // llegó. Ver docs/30-lealtad-push-y-enlace-personal.md.
  const enlace = await crearEnlaceAcceso(t.cardId, t.correo ?? '', MINUTOS_ENLACE_BIENVENIDA);
  const url = await urlPersonalDeTarjeta(t.cardId, { a: enlace?.token ?? null });
  if (!url) return null;
  const { nombre: negocio } = await exigirNegocio();

  let correo: Bienvenida['correo'] = 'SIN_CORREO';
  if (t.correo) {
    const envio = await enviarCorreo({
      para: t.correo,
      asunto: `Tu tarjeta de lealtad de ${negocio} está lista`,
      texto: textoBienvenida(t.nombre, t.estampas, url, negocio),
      html: plantillaCorreo(
        'Te damos la bienvenida al programa de lealtad',
        [
          `Hola ${t.nombre.split(' ')[0]}, en caja te dimos de alta y tu tarjeta digital ya tiene ${t.estampas === 1 ? '1 sello' : `${t.estampas} sellos`}.`,
          'Toca el botón para abrir tu tarjeta. Es tu enlace personal: guarda este correo, sirve siempre y en cualquier celular, sin contraseña.',
          'Al abrirla puedes agregarla a la pantalla de inicio de tu celular para tenerla a la mano.',
          'Te avisaremos de promociones por este medio. Si no quieres recibirlas, desactívalas en tu perfil cuando gustes.',
        ],
        { texto: 'Abrir mi tarjeta', url },
      ),
    });
    correo = envio.ok ? 'ENVIADO' : 'FALLO';
  }

  const whatsapp = t.celular
    ? `https://wa.me/52${t.celular}?text=${encodeURIComponent(textoBienvenida(t.nombre, t.estampas, url, negocio))}`
    : null;

  return { url, svg: await qrSvg(url), venceEn: 'no vence', correo, whatsapp };
}

/**
 * La caja tocó «Enviar acceso por WhatsApp» en la bienvenida: el enlace va al
 * celular registrado de la tarjeta. Se anota en el enlace para que, cuando
 * la persona lo abra, su celular quede verificado (y pueda canjear). Si la
 * persona escanea el QR en pantalla en lugar del WhatsApp, no se verifica.
 */
export async function marcarBienvenidaPorWhatsApp(url: string): Promise<void> {
  const sesion = await exigirRol(ROLES_CAJA);
  // El de un solo uso viaja como `a` en el enlace personal; antes de nov 2026
  // era la ruta /lealtad/acceso/<token>.
  let token: string | null = null;
  try {
    const u = new URL(url);
    token = u.searchParams.get('a') ?? u.pathname.split('/lealtad/acceso/')[1] ?? null;
  } catch {
    token = null;
  }
  if (token) await marcarEnlaceEnviadoPorWhatsApp(token, sesion.userId);
}

export type RespuestaBusquedaContacto =
  | {
      readonly ok: true;
      readonly tarjeta: VistaCaja | null;
      /** Si ya abrió su tarjeta en un celular, para ofrecerle reenviar el enlace. */
      readonly acceso: AccesoTarjetaCaja | null;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Primer paso de «Registrar visita sin tarjeta»: nombre y contacto. ¿Este
 * contacto ya tiene tarjeta? Si sí, la caja coteja el nombre dicho con el
 * registrado, captura el comprobante y acredita con `acreditarSinTarjeta`; si
 * no, completa el nombre y crea la tarjeta con `registrarNuevoCliente`.
 * Con tarjeta, la caja también puede volver a mandarle el enlace
 * (`reenvio.ts`), sobre todo si todavía no la abre en su celular.
 */
export async function buscarPorContacto(d: {
  readonly sucursalSlug: string;
  readonly nombre: string;
  readonly celular: string;
  readonly correo: string;
}): Promise<RespuestaBusquedaContacto> {
  const sesion = await exigirRol(ROLES_CAJA);
  const { sucursal } = await sucursalDeCaja(sesion, d.sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };
  const faltaNombre = validarNombreDicho(d.nombre);
  if (faltaNombre) return { ok: false, error: faltaNombre };

  const r = await tarjetaPorContacto({ celular: d.celular, correo: d.correo });
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.codigo) return { ok: true, tarjeta: null, acceso: null };
  const [tarjeta, acceso] = await Promise.all([
    vistaCaja(r.codigo, sucursal.id),
    accesoTarjetaCaja(r.codigo),
  ]);
  return { ok: true, tarjeta, acceso };
}

/**
 * Tarjeta existente, sin QR: acredita la visita de hoy con el comprobante de
 * compra y deja anotado el nombre que dijo la persona, para que administración
 * pueda revisar las acreditaciones hechas por contacto.
 */
export async function acreditarSinTarjeta(d: {
  readonly codigo: string;
  readonly sucursalSlug: string;
  readonly nombreDicho: string;
  readonly folio: string;
  readonly fotoTicketUrl: string | null;
  /** Fecha local de hoy, "AAAA-MM-DD". */
  readonly fecha: string;
}): Promise<RespuestaVisita> {
  const faltaNombre = validarNombreDicho(d.nombreDicho);
  if (faltaNombre) return { tipo: 'ERROR', error: faltaNombre };
  const faltaComprobante = validarComprobanteSinTarjeta(d);
  if (faltaComprobante) return { tipo: 'ERROR', error: faltaComprobante };

  return registrarVisita({
    codigo: d.codigo,
    sucursalSlug: d.sucursalSlug,
    folio: d.folio,
    caja: '1',
    fecha: d.fecha,
    total: '',
    propina: '',
    descuento: '',
    fotoUrl: fotoDelNegocio(d.fotoTicketUrl, (await exigirNegocio()).id),
    nota: `Sin tarjeta: dijo llamarse «${d.nombreDicho.trim().replace(/\s+/g, ' ').slice(0, 80)}»`,
  });
}

export async function registrarNuevoCliente(d: DatosNuevoCliente): Promise<RespuestaNuevoCliente> {
  const sesion = await exigirRol(ROLES_CAJA);
  const { sucursal } = await sucursalDeCaja(sesion, d.sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  const faltaComprobante = validarComprobanteSinTarjeta(d);
  if (faltaComprobante) return { ok: false, error: faltaComprobante };

  const visitas = d.traeTarjetaFisica ? Number(d.visitasFisicas.trim() || '0') : 0;
  if (d.traeTarjetaFisica && (!Number.isInteger(visitas) || visitas < 1)) {
    return { ok: false, error: 'Escribe cuántas visitas traía la tarjeta física (al menos 1).' };
  }

  const alta = await crearTarjetaEnCaja({
    nombre: d.nombre,
    apellidoPaterno: d.apellidoPaterno,
    apellidoMaterno: d.apellidoMaterno,
    celular: d.celular,
    correo: d.correo,
    visitasFisicas: visitas,
    fotoTarjetaFisicaUrl: d.traeTarjetaFisica
      ? fotoDelNegocio(d.fotoTarjetaUrl, (await exigirNegocio()).id)
      : null,
    sucursalId: sucursal.id,
    usuarioId: sesion.userId,
  });
  if (!alta.ok) return { ok: false, error: alta.error };

  // La visita de hoy, con el comprobante (folio o foto). Si el folio ya se
  // usó, la tarjeta se crea igual y la visita queda rechazada: se avisa.
  const visita = await acreditarVisita({
    codigo: alta.tarjeta.codigo,
    sucursalId: sucursal.id,
    usuarioId: sesion.userId,
    ticket: {
      folio: d.folio,
      caja: '1',
      fecha: fechaLocal(new Date(), (await exigirNegocio()).zonaHoraria),
      totalCentavos: 0,
      propinaCentavos: 0,
      descuentoCentavos: 0,
      fotoUrl: fotoDelNegocio(d.fotoTicketUrl, (await exigirNegocio()).id),
      origen: 'MANUAL',
    },
    nota: 'Alta en caja',
  });

  const tarjeta = await vistaCaja(alta.tarjeta.codigo, sucursal.id);
  if (!tarjeta)
    return { ok: false, error: 'La tarjeta se creó pero no se pudo leer. Búscala por código.' };

  const bienvenida = await mandarBienvenida({
    cardId: alta.tarjeta.cardId,
    codigo: alta.tarjeta.codigo,
    nombre: alta.tarjeta.nombre,
    correo: alta.tarjeta.correo,
    celular: alta.tarjeta.celular,
    estampas: tarjeta.estampas,
  });

  revalidatePath('/admin/lealtad/caja');
  after(() => avisarCambioPorCodigo(alta.tarjeta.codigo));

  return {
    ok: true,
    tarjeta,
    visitaHoy: visita.tipo,
    visitaTexto:
      visita.tipo === 'RECHAZADA' && visita.motivo !== 'TARJETA_NO_ENCONTRADA'
        ? textoRechazo(visita.motivo, fechaLocal(new Date(), (await exigirNegocio()).zonaHoraria))
        : null,
    visitasMigradas: alta.tarjeta.visitasMigradas,
    bienvenida,
  };
}

export type RespuestaMigracion =
  | { readonly ok: true; readonly tarjeta: VistaCaja; readonly estampasSumadas: number }
  | { readonly ok: false; readonly error: string };

/** Pasa las visitas de la tarjeta física a una tarjeta digital que ya existe. */
export async function migrarFisicaExistente(d: {
  readonly codigo: string;
  readonly sucursalSlug: string;
  readonly visitas: string;
  readonly fotoTarjetaUrl: string | null;
}): Promise<RespuestaMigracion> {
  const sesion = await exigirRol(ROLES_CAJA);
  const { sucursal } = await sucursalDeCaja(sesion, d.sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  const visitas = Number(d.visitas.trim() || '0');
  const r = await migrarTarjetaFisica({
    codigo: d.codigo,
    visitas,
    fotoUrl: fotoDelNegocio(d.fotoTarjetaUrl, (await exigirNegocio()).id),
    sucursalId: sucursal.id,
    usuarioId: sesion.userId,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath('/admin/lealtad/caja');
  after(() => avisarCambioPorCodigo(d.codigo));
  const tarjeta = await vistaCaja(d.codigo, sucursal.id);
  if (!tarjeta) return { ok: false, error: 'No se pudo volver a leer la tarjeta.' };
  return { ok: true, tarjeta, estampasSumadas: visitas };
}
