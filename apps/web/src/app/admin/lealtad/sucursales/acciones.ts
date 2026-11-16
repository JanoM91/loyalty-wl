'use server';

import { revalidatePath } from 'next/cache';
import { cambiarParticipacion } from '@wl/database';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';

/** Enciende o apaga el programa en una sucursal. Queda en la bitácora. */
export async function alternarParticipacion(form: FormData): Promise<void> {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const slug = String(form.get('slug') ?? '');
  const participa = form.get('participa') === '1';
  if (!slug) return;
  await cambiarParticipacion(slug, participa, sesion.userId);
  revalidatePath('/admin/lealtad/sucursales');
  revalidatePath('/admin/lealtad');
  revalidatePath('/admin/lealtad/caja');
}
