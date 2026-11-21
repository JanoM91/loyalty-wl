'use server';

import { revalidatePath } from 'next/cache';
import { ROLES_USUARIOS, guardarConfigArcade } from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';

export interface EstadoArcade {
  readonly ok: boolean;
  readonly error: string | null;
}

/**
 * Guarda la configuración de «Juega y gana». El formulario la manda como un
 * JSON; `guardarConfigArcade` la limpia y rechaza lo que el plan del club no
 * incluye, con el motivo.
 */
export async function guardarArcade(_previo: EstadoArcade, form: FormData): Promise<EstadoArcade> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const crudo = String(form.get('config') ?? '');
  if (crudo.length > 20_000) return { ok: false, error: 'La configuración es demasiado larga.' };
  let entrada: unknown;
  try {
    entrada = JSON.parse(crudo);
  } catch {
    return { ok: false, error: 'No pudimos leer el formulario. Recarga la página.' };
  }
  const r = await guardarConfigArcade(entrada, sesion.userId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/', 'layout');
  return { ok: true, error: null };
}
