'use server';

import { revalidatePath } from 'next/cache';
import { guardarMarca as guardar, ROLES_USUARIOS } from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';

export interface EstadoMarca {
  readonly ok: boolean;
  readonly error: string | null;
  readonly avisos: readonly string[];
}

export async function guardarMarca(_previo: EstadoMarca, form: FormData): Promise<EstadoMarca> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const t = (k: string) => String(form.get(k) ?? '');
  const r = await guardar(
    {
      nombre: t('nombre'),
      plantilla: t('plantilla'),
      frase: t('frase'),
      colores: {
        fondo: t('fondo'),
        sobreFondo: t('sobreFondo'),
        acento: t('acento'),
        papel: t('papel'),
        tinta: t('tinta'),
      },
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
  if (!r.ok) return { ok: false, error: r.error, avisos: [] };
  revalidatePath('/', 'layout');
  return { ok: true, error: null, avisos: r.avisos };
}
