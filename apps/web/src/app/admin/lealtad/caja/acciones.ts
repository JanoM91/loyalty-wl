'use server';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  acreditarVisita,
  entregarPremio,
  reportarIncidencia,
  vistaCaja,
  type ResultadoCaja,
  type VistaCaja,
} from '@wl/database';
import { extraerCodigoTarjeta, fechaLocal, textoRechazo, type TextoRechazo } from '@wl/domain';

import { ROLES_CAJA, sucursalDeCaja } from '@/lib/admin/lealtad';
import { avisarCambioPorCodigo } from '@/lib/wallet/avisar';
import { exigirRol } from '@/lib/admin/sesion';
import { fotoDelNegocio } from '@/lib/lealtad/fotos';
import { exigirNegocio } from '@/lib/negocio';

/**
 * Acciones de la caja de lealtad.
 *
 * Cada una vuelve a comprobar la sesión y resuelve la sucursal desde la cuenta
 * de quien atiende. Lo que mande el navegador sobre la sucursal solo cuenta
 * para la administración central; una tableta de sucursal no puede operar
 * otra aunque cambie la petición.
 */

async function contexto(slug: string) {
  const sesion = await exigirRol(ROLES_CAJA);
  const { sucursal } = await sucursalDeCaja(sesion, slug);
  return { sesion, sucursal };
}

export type RespuestaBusqueda =
  | { readonly ok: true; readonly tarjeta: VistaCaja }
  | { readonly ok: false; readonly error: string };

export async function buscarTarjeta(
  texto: string,
  sucursalSlug: string,
): Promise<RespuestaBusqueda> {
  const { sucursal } = await contexto(sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  const negocio = await exigirNegocio();
  const codigo = extraerCodigoTarjeta(texto, negocio.prefijoCodigo);
  if (!codigo)
    return {
      ok: false,
      error: `Ese no es un código de tarjeta de ${negocio.nombre}. Debe verse como ${negocio.prefijoCodigo}-XXXX-XXXX.`,
    };

  const tarjeta = await vistaCaja(codigo, sucursal.id);
  if (!tarjeta)
    return { ok: false, error: `No encontramos la tarjeta ${codigo}. Revisa el código.` };
  return { ok: true, tarjeta };
}

export interface DatosVisita {
  readonly codigo: string;
  readonly sucursalSlug: string;
  readonly folio: string;
  readonly caja: string;
  readonly fecha: string;
  /** Pesos como los escribe la persona: "185", "185.50". */
  readonly total: string;
  readonly propina: string;
  readonly descuento: string;
  readonly fotoUrl: string | null;
  readonly registrarComo?: 'CONTINGENCIA' | 'REVISION';
  readonly nota?: string;
}

export type RespuestaVisita =
  | (ResultadoCaja & { readonly tarjeta: VistaCaja | null; readonly texto: TextoRechazo | null })
  | { readonly tipo: 'ERROR'; readonly error: string };

function centavos(valor: string): number | null {
  const limpio = valor.replace(/[$,\s]/g, '');
  if (limpio === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

export async function registrarVisita(d: DatosVisita): Promise<RespuestaVisita> {
  const { sesion, sucursal } = await contexto(d.sucursalSlug);
  if (!sucursal) return { tipo: 'ERROR', error: 'Elige la sucursal en la que estás atendiendo.' };

  const total = centavos(d.total);
  const propina = centavos(d.propina);
  const descuento = centavos(d.descuento);
  if (total === null || propina === null || descuento === null) {
    return { tipo: 'ERROR', error: 'Escribe los importes con números, por ejemplo 185.50.' };
  }
  // El total es deseable, no obligatorio: hoy la estampa es por visita.

  const r = await acreditarVisita({
    codigo: d.codigo,
    sucursalId: sucursal.id,
    usuarioId: sesion.userId,
    ticket: {
      folio: d.folio,
      caja: d.caja,
      fecha: d.fecha,
      totalCentavos: total,
      propinaCentavos: propina,
      descuentoCentavos: descuento,
      fotoUrl: fotoDelNegocio(d.fotoUrl, (await exigirNegocio()).id),
      origen: 'MANUAL',
    },
    registrarComo: d.registrarComo,
    nota: d.nota ?? null,
  });

  revalidatePath('/admin/lealtad/caja');
  // Los pases (Apple y Google) se enteran después de responder a la caja.
  if (r.tipo === 'ACREDITADA') after(() => avisarCambioPorCodigo(d.codigo));
  const tarjeta = await vistaCaja(d.codigo, sucursal.id);
  const texto =
    r.tipo === 'RECHAZADA' && r.motivo !== 'TARJETA_NO_ENCONTRADA'
      ? textoRechazo(r.motivo, d.fecha)
      : null;
  return { ...r, tarjeta, texto };
}

export type RespuestaEntrega =
  | {
      readonly ok: true;
      readonly tipo: string;
      readonly nombre: string;
      readonly tarjeta: VistaCaja | null;
    }
  | { readonly ok: false; readonly error: string };

export async function entregar(
  codigo: string,
  premioId: string,
  sucursalSlug: string,
): Promise<RespuestaEntrega> {
  const { sesion, sucursal } = await contexto(sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  const r = await entregarPremio({
    premioId,
    codigo,
    sucursalId: sucursal.id,
    usuarioId: sesion.userId,
  });
  revalidatePath('/admin/lealtad/caja');
  if (!r.ok) return r;
  after(() => avisarCambioPorCodigo(codigo));
  return {
    ok: true,
    tipo: r.tipo,
    nombre: r.nombre,
    tarjeta: await vistaCaja(codigo, sucursal.id),
  };
}

export async function reportar(
  codigo: string | null,
  sucursalSlug: string,
  detalle: string,
): Promise<{ ok: boolean }> {
  const { sesion, sucursal } = await contexto(sucursalSlug);
  if (!sucursal) return { ok: false };
  await reportarIncidencia({
    usuarioId: sesion.userId,
    sucursalId: sucursal.id,
    codigo,
    detalle,
  });
  return { ok: true };
}

/** Un megabyte y medio: la tableta reduce la foto antes de mandarla. */
const MAXIMO_BYTES = 1.5 * 1024 * 1024;

/**
 * Guarda la foto del ticket.
 *
 * Llega ya reducida y sin metadatos (la tableta la redibuja en un lienzo
 * antes de enviarla, lo que borra la ubicación y el modelo del teléfono). La
 * ruta lleva un sufijo aleatorio: la dirección no se puede adivinar y nunca
 * se muestra al cliente.
 */
export async function subirFotoTicket(
  form: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { sucursal } = await contexto(String(form.get('sucursal') ?? ''));
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: 'Falta configurar el almacén de fotos (Vercel Blob).' };
  }

  const negocio = await exigirNegocio();
  const archivo = form.get('foto');
  if (!(archivo instanceof File) || archivo.size === 0)
    return { ok: false, error: 'No llegó la foto.' };
  if (archivo.type !== 'image/jpeg') return { ok: false, error: 'La foto debe ser JPG.' };
  if (archivo.size > MAXIMO_BYTES)
    return { ok: false, error: 'La foto pesa demasiado. Tómala de nuevo.' };

  // Misma ruta para el ticket y para la tarjeta física que se migra; la
  // carpeta dice cuál es. Las fotos de tarjeta no se borran a los 90 días.
  const carpeta = form.get('tipo') === 'tarjeta-fisica' ? 'tarjetas-fisicas' : 'tickets';
  const subida = await put(
    // Cada negocio en su carpeta: la limpieza y el control de qué foto es de
    // quién van por este prefijo.
    `negocios/${negocio.id}/lealtad/${carpeta}/${sucursal.slug}/${fechaLocal(new Date(), negocio.zonaHoraria)}.jpg`,
    archivo,
    {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/jpeg',
    },
  );
  return { ok: true, url: subida.url };
}
