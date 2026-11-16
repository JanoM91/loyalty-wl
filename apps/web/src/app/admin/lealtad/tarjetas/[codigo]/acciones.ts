'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { idDeTarjetaPorCodigo, regenerarEnlacePersonal } from '@wl/database';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { contextoPeticion, exigirRol } from '@/lib/admin/sesion';
import { avisarCambioDeTarjeta } from '@/lib/wallet/avisar';

/**
 * Cambiar el enlace personal de una tarjeta (p. ej. el cliente lo compartió
 * por error). El anterior deja de servir; los pases de Wallet toman el nuevo.
 */
export async function regenerarEnlace(form: FormData): Promise<void> {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const codigo = String(form.get('codigo') ?? '');
  const id = await idDeTarjetaPorCodigo(codigo);
  if (!id) return;
  const { ip } = await contextoPeticion();
  const token = await regenerarEnlacePersonal(id, { usuarioId: sesion.userId, ip });
  if (token) after(() => avisarCambioDeTarjeta(id));
  revalidatePath(`/admin/lealtad/tarjetas/${encodeURIComponent(codigo)}`);
}
