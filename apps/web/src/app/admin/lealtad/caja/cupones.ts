'use server';

import { revalidatePath } from 'next/cache';
import { arcadeDelNegocio, buscarCuponArcade, canjearCuponArcade } from '@wl/database';
import { normalizarCodigoCupon } from '@wl/domain';

import { ROLES_CAJA, sucursalDeCaja } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';

/**
 * Cobro en caja de las promociones que los clientes ganan en «Juega y gana».
 *
 * Igual que con los premios, la sucursal sale de la cuenta de quien atiende y
 * el servidor decide si el cupón se puede cobrar.
 */

export interface CuponParaCaja {
  readonly codigo: string;
  readonly titulo: string;
  readonly estado: 'DISPONIBLE' | 'CANJEADO' | 'VENCIDO';
  readonly vence: Date;
  readonly canjeado: Date | null;
  readonly cliente: string | null;
  readonly tarjeta: string;
  readonly verificada: boolean;
}

export type RespuestaCupon =
  | { readonly ok: true; readonly cupon: CuponParaCaja }
  | { readonly ok: false; readonly error: string };

const CODIGO = /^[A-Z0-9]{2,8}-[A-Z0-9]{4}$/;

async function contexto(slug: string) {
  const sesion = await exigirRol(ROLES_CAJA);
  const { sucursal } = await sucursalDeCaja(sesion, slug);
  return { sesion, sucursal };
}

export async function buscarCupon(texto: string, sucursalSlug: string): Promise<RespuestaCupon> {
  const { sucursal } = await contexto(sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };
  const codigo = normalizarCodigoCupon(String(texto).slice(0, 20));
  if (!CODIGO.test(codigo))
    return { ok: false, error: 'Escribe el código como aparece en el celular del cliente.' };
  const c = await buscarCuponArcade(codigo);
  if (!c) return { ok: false, error: `No encontramos la promoción ${codigo}. Revisa el código.` };
  return {
    ok: true,
    cupon: {
      codigo: c.codigo,
      titulo: c.titulo,
      estado: c.estado,
      vence: c.vence,
      canjeado: c.canjeado,
      cliente: c.tarjeta.nombre,
      tarjeta: c.tarjeta.codigo,
      verificada: c.tarjeta.verificada,
    },
  };
}

export async function cobrarCupon(
  texto: string,
  sucursalSlug: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const { sesion, sucursal } = await contexto(sucursalSlug);
  if (!sucursal) return { ok: false, error: 'Elige la sucursal en la que estás atendiendo.' };
  if (!sucursal.participa)
    return { ok: false, error: `${sucursal.nombre} todavía no participa en el programa.` };
  const { permisos } = await arcadeDelNegocio();
  // Un cupón ya ganado se respeta aunque el Arcade se haya apagado después.
  if (!permisos) return { ok: false, error: 'Tu club no tiene «Juega y gana».' };
  const r = await canjearCuponArcade(String(texto).slice(0, 20), sucursal.id, sesion.userId);
  revalidatePath('/admin/lealtad/caja');
  return r;
}
