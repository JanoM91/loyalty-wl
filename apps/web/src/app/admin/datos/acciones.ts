'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { guardarDatosNegocio, ROLES_USUARIOS } from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';
import { actualizarTodosLosPases } from '@/lib/wallet/avisar';

export interface EstadoDatos {
  readonly ok: boolean;
  readonly error: string | null;
}

/** Guarda el contacto y los datos legales del negocio. */
export async function guardarDatos(_previo: EstadoDatos, form: FormData): Promise<EstadoDatos> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const t = (k: string) => String(form.get(k) ?? '');
  const r = await guardarDatosNegocio(
    {
      correo: t('correo'),
      whatsapp: t('whatsapp'),
      sitio: t('sitio'),
      instagram: t('instagram'),
      razonSocial: t('razonSocial'),
      domicilio: t('domicilio'),
      correoPrivacidad: t('correoPrivacidad'),
    },
    { userId: sesion.userId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/', 'layout');
  // El pase de Wallet muestra el contacto del negocio.
  after(() => actualizarTodosLosPases());
  return { ok: true, error: null };
}
