'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { aprobarPendiente, rechazarPendiente } from '@wl/database';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { avisarCambioPorAcreditacion } from '@/lib/wallet/avisar';

export interface EstadoRevision {
  readonly error: string | null;
  readonly ok: boolean;
}

/** Aprobar o rechazar una visita pendiente. Rechazar exige motivo. */
export async function resolver(_previo: EstadoRevision, form: FormData): Promise<EstadoRevision> {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const id = String(form.get('id') ?? '');
  const decision = String(form.get('decision') ?? '');

  const r =
    decision === 'aprobar'
      ? await aprobarPendiente(id, sesion.userId)
      : await rechazarPendiente(id, sesion.userId, String(form.get('motivo') ?? ''));

  revalidatePath('/admin/lealtad/pendientes');
  revalidatePath('/admin/lealtad');
  if (r.ok && decision === 'aprobar') after(() => avisarCambioPorAcreditacion(id));
  return r.ok ? { ok: true, error: null } : { ok: false, error: r.error };
}
